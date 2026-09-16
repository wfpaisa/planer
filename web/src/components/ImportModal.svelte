<!--
  Importar datos a la tabla abierta.

  Primero se pega o se arrastra un archivo CSV, Excel o JSON; despues, en una
  previsualizacion a pantalla completa, se emparejan las columnas, se ven los
  errores y se elige como guardar. Un archivo que se lee bien pasa solo a la
  previsualizacion: la primera pantalla se queda unicamente para lo que hay que
  escribir o corregir.

  A donde va cada columna y como se convierte cada celda vive en
  `lib/importPlan.ts`: aqui esta lo que se ve y lo que se escribe.
-->
<script lang="ts">
  import { IMPORT_BATCH_CHUNK } from "@shared/importBatch";
  import { isPeopleTable } from "@shared/people";
  import { type Match, relationCellValues } from "@shared/relations";
  import { type FieldType, isRelationField, type TableRecord } from "@shared/types";

  import type { Row } from "../lib/cellValues";
  import { cx } from "../lib/cx";
  import { ROW_ORDER } from "../lib/dropFiles";
  import {
    type ColumnMatchReport,
    detectSeparator,
    matchRelationColumns,
    MAX_IMPORT_ROWS,
    missingRowCount,
    parseImport,
  } from "../lib/importParse";
  import {
    buildPlans,
    type ColumnPlan,
    type ColumnRule,
    type ColumnTarget,
    type ConvertedRow,
    convertRows,
    defaultMapping,
    findRequiredGaps,
    findRuleIssues,
    IGNORED_SYSTEM_COLUMNS,
    type ImportNote,
    looksJson,
    type RowStatus,
    ruleMessage,
    type SaveMode,
    SEPARATORS,
  } from "../lib/importPlan";
  import { errorMessage, isRateLimited, patch, pb } from "../lib/pb";
  import { getPeople } from "../lib/people.svelte";
  import {
    buildPeopleRows,
    countPeopleImport,
    type PeopleImportReport,
    runPeopleImport,
  } from "../lib/peopleGrid";
  import { panelLookup } from "../lib/relations";
  import {
    isLegacySheetFile,
    isSheetFile,
    legacySheetMessage,
    readSheet,
    SHEET_ACCEPT,
  } from "../lib/sheet";
  import { downloadFile, rowsToCsv } from "../lib/tableExport";
  import Icon from "./Icon.svelte";
  import ImportColumnHead from "./import/ImportColumnHead.svelte";
  import Toast, { type ToastKind } from "./Toast.svelte";
  import { Button, ConfirmDialog, Modal, Note, Select, Tag, Textarea } from "./ui";

  /**
   * Ejemplo que sale en el campo de pegar texto. Los saltos de linea son reales:
   * un atributo normal de Svelte no los escribe.
   */
  const EJEMPLO_CSV = `nombre,correo,ingreso
Ana,ana@example.com,2024-03-01
Bruno,bruno@example.com,2023-11-15`;

  let {
    table,
    tables,
    initialFile = null,
    onClose,
    onDone,
  }: {
    table: TableRecord;
    /** Todas las tablas de la aplicacion: hacen falta para emparejar relaciones. */
    tables: TableRecord[];
    /**
     * Un archivo que llega ya soltado, cuando la importacion no empieza aqui.
     *
     * Es el caso de un archivo de personas soltado en el constructor: alli no
     * se puede importar --crear las cuentas es cosa de este dialogo-- asi que
     * el archivo viaja y esto se abre con el ya leido, en la previsualizacion.
     */
    initialFile?: File | null;
    onClose: () => void;
    /** Recarga la tabla. El resumen llega cuando el dialogo se va a cerrar. */
    onDone: (note?: ImportNote) => Promise<void> | void;
  } = $props();

  const people = getPeople();

  let stage = $state<"content" | "preview">("content");
  let text = $state("");
  let separator = $state(";");
  /**
   * De donde viene el contenido: de un archivo o pegado a mano.
   *
   * Las dos formas escriben el mismo `text` --un archivo se lee y se vuelca
   * ahi--, asi que esto solo decide cual de las dos se ensena. Empieza en el
   * archivo, que es lo que se hace casi siempre; el area de pegar ocupaba media
   * pantalla para el caso raro.
   */
  let source = $state<"archivo" | "texto">("archivo");
  /**
   * El nombre del ultimo archivo leido.
   *
   * Con el area de texto escondida, la zona de arrastre es lo unico que queda
   * mirando: sin decir que archivo entro, soltar uno y no soltar nada se ven
   * igual.
   */
  let fileName = $state("");
  /**
   * Lo que se cambio a mano, por nombre de columna.
   *
   * Solo lo cambiado: lo demas sale de `defaultMapping` cada vez que se lee el
   * archivo. Asi cambiar el separador sin salir de la previsualizacion vuelve a
   * leerlo conservando lo elegido, y una columna que con el separador nuevo ya
   * no existe deja de mirarse sola.
   */
  let overrides = $state<Record<string, ColumnTarget>>({});
  /**
   * Lo que se le exige a cada columna, por nombre de columna.
   *
   * Es de esta importacion y no de la tabla: nada de esto se guarda al terminar.
   * Se pone desde el encabezado de la columna, como su destino.
   */
  let rules = $state<Record<string, ColumnRule>>({});
  let mode = $state<SaveMode>("add");
  let continueOnError = $state(false);
  let existingRows = $state<Row[]>([]);
  let confirmReplace = $state(false);
  let busy = $state(false);
  /**
   * Lo que hay que contar de esta importacion, con su tono. No todo lo que se
   * dice aqui es un fallo --una hoja de mas, filas que se quedaron fuera-- y
   * contarlo todo en rojo hacia parecer roto lo que solo estaba incompleto.
   */
  let notice = $state<{ kind: ToastKind; text: string } | null>(null);
  const say = (kind: ToastKind, text: string) => (notice = { kind, text });
  const fail = (err: unknown) => say("error", errorMessage(err));
  const hush = () => (notice = null);

  /**
   * Por que llave se empareja cada columna de relacion en esta importacion.
   *
   * Es del archivo, no de la columna: el de transito trae cedulas y el de
   * nomina, correos. Cambiarla aqui no toca lo que ensena la grilla.
   */
  let keys = $state<Record<string, string>>({});
  /** Como le fue a cada columna de relacion, para contarlo antes de guardar. */
  let reports = $state<ColumnMatchReport[]>([]);
  let matches = $state<Map<string, Map<string, Match>>>(new Map());
  let matching = $state(false);
  /** La columna cuya lista de valores sin registro se esta mirando. */
  let seeMissing = $state<ColumnMatchReport | null>(null);

  /**
   * La tabla de personas se importa por su propia ruta.
   *
   * Una fila suya no se puede crear escribiendo en la coleccion: necesita una
   * cuenta detras, que el navegador no puede consultar. Ver
   * `server/peopleImport.ts`.
   */
  const isPeople = $derived(isPeopleTable(table));
  /**
   * Crear las cuentas que falten.
   *
   * Se llama por lo que hace --es lo que el servidor entiende-- pero en el pie
   * se lee al reves: la casilla es "Solo modificar", y marcarla es apagar esto.
   * Lo que se lee es lo que va a pasar --"Modificar y crear" sin marcar, "Solo
   * modificar" marcada-- en vez del nombre de una opcion que hay que traducir.
   *
   * Empieza marcada: importar gente a la tabla de personas es, casi siempre,
   * darle acceso a quien todavia no lo tiene, y con la casilla apagada la
   * importacion se quedaba en nada sin que nadie entendiera por que. Lo que va
   * a pasar --cuantas cuentas se crean y con que correos-- se cuenta encima de
   * la tabla antes de guardar, y la casilla esta ahi mismo para apagarla.
   */
  let crearCuentas = $state(true);
  /** Lo que el servidor dice que pasaria. Se pregunta antes de escribir nada. */
  let peopleReport = $state<PeopleImportReport | null>(null);
  /** Las claves de las cuentas recien creadas. Se ven una vez y no se guardan. */
  let newKeys = $state<{ cuenta: string; clave: string }[]>([]);
  /**
   * El parte de una importacion que ya escribio.
   *
   * Con esto puesto el dialogo deja de ser un formulario: no hay nada mas que
   * elegir --lo que entro, entro-- asi que se apagan los mandos, el pie se
   * queda solo con Cerrar y la tabla pasa a ensenar unicamente las filas que se
   * quedaron fuera, que son las que todavia hay que hacer algo con ellas. Si no
   * se quedo ninguna, la tabla queda vacia.
   */
  let result = $state<{ ok: boolean; text: string; leftover: number[] } | null>(null);

  const parsed = $derived(parseImport(text, separator));
  const tooMany = $derived(parsed.ok && parsed.data.rows.length > MAX_IMPORT_ROWS);
  /**
   * Si el archivo que entro sirve para seguir.
   *
   * Lo que decide el color de la zona de arrastre: uno que se leyo pero no se
   * puede importar --sin columnas, con mas filas de la cuenta-- pintado en
   * verde diria que todo fue bien y mandaria a leer el aviso de abajo para
   * enterarse de que no.
   */
  const fileOk = $derived(parsed.ok && !tooMany);
  /**
   * El archivo que entro pero no se puede importar.
   *
   * Es lo unico que la zona de arrastre tiene que ensenar de un archivo ya
   * leido: el que se puede importar no llega a verse ahi, porque abre la
   * previsualizacion en cuanto se lee.
   */
  const fileRejected = $derived(!!fileName && !fileOk);
  /** El archivo ya leido. Se rehace solo cuando cambia el texto o el separador. */
  const parsedTable = $derived(parsed.ok ? parsed.data : null);
  /** Lo sugerido, con lo elegido a mano encima. */
  const mapping = $derived(
    parsedTable ? { ...defaultMapping(parsedTable, table), ...overrides } : {},
  );
  const isJson = $derived(looksJson(text));

  const setTarget = (column: string, target: ColumnTarget) => {
    overrides = { ...overrides, [column]: target };
  };
  /** Devolver una columna a lo sugerido: se quita lo que se habia elegido. */
  const clearTarget = (column: string) => {
    const next = { ...overrides };
    delete next[column];
    overrides = next;
  };
  const setRule = (column: string, rule: ColumnRule) => {
    rules = { ...rules, [column]: rule };
  };

  async function readFile(file: File) {
    hush();
    // Una hoja en formato viejo no se lee, pero se sabe que es: se dice que
    // hacer con ella en vez de dejar que falle como un archivo cualquiera.
    if (isLegacySheetFile(file)) {
      say("warning", legacySheetMessage(file));
      return;
    }
    try {
      // Una hoja de calculo se convierte a CSV antes de nada: de ahi en
      // adelante es el mismo archivo que cualquier otro, con el mismo lector y
      // el mismo emparejado de columnas.
      if (isSheetFile(file)) {
        const { csv, sheet, sheets } = await readSheet(file);
        separator = ",";
        text = csv;
        fileName = file.name;
        if (sheets.length > 1) {
          say(
            "warning",
            `El archivo tiene ${sheets.length} hojas y se leyo "${sheet}". Las demas quedan fuera.`,
          );
        }
        seguir();
        return;
      }

      const content = await file.text();
      // El separador se adivina del propio archivo, y solo si es uno de los dos
      // que se ofrecen: dejarlo en uno que no esta en los botones seria dejar
      // los dos apagados y sin manera de volver. Cuando falla se cambia a mano
      // en la previsualizacion, sin volver a soltar el archivo.
      const found = looksJson(content) ? "" : detectSeparator(content);
      if (SEPARATORS.some((s) => s.value === found)) separator = found;
      text = content;
      fileName = file.name;
      seguir();
    } catch (err) {
      fail(err);
    }
  }

  /*
   * El archivo que llego ya soltado se lee una sola vez, al abrirse.
   *
   * `read` marca que ya se hizo: sin el, cualquier cambio que vuelva a correr
   * el efecto releeria el archivo y tiraria lo que se hubiera emparejado a
   * mano en la previsualizacion.
   */
  let read = false;
  $effect(() => {
    if (read || !initialFile) return;
    read = true;
    void readFile(initialFile);
  });

  /**
   * Un archivo que se leyo bien pasa solo a la previsualizacion.
   *
   * Antes se quedaba en la primera pantalla, con la zona de arrastre en verde
   * diciendo que ya estaba cargado y un boton "Previsualizar" al lado: un paso
   * que solo servia para confirmar lo que ya se veia. Se sigue de largo, que es
   * a donde se iba igualmente.
   *
   * El que NO se puede importar --ilegible, sin columnas, con mas filas de la
   * cuenta-- se queda aqui: ahi la primera pantalla si tiene algo que decir, y
   * lo dice en rojo. Lo avisado al leerlo (una hoja de calculo con varias
   * pestanas) viaja con el aviso, que la previsualizacion tambien ensena.
   */
  function seguir() {
    if (fileOk) stage = "preview";
  }

  // Para Sobrescribir y Reemplazar hace falta saber que ids existen y, si no
  // viene columna de id, el orden en que se exporto la tabla (created,id).
  $effect(() => {
    if (stage !== "preview") return;
    const collection = table.dataCollection;
    let alive = true;
    pb.collection(collection)
      .getFullList<Row>({ fields: "id", sort: ROW_ORDER })
      .then((items) => {
        if (alive) existingRows = items;
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  });

  const existingIds = $derived(new Set(existingRows.map((i) => i.id)));

  const plans = $derived(parsedTable ? buildPlans(parsedTable, mapping) : []);
  /** Las columnas que se ensenan y se dejan elegir: sin las de la base. */
  const shownPlans = $derived(
    plans.filter((p) => !IGNORED_SYSTEM_COLUMNS.has(p.column.trim().toLowerCase())),
  );
  const conversion = $derived(
    parsedTable ? convertRows(parsedTable, plans) : { converted: [], errors: [] },
  );
  const failing = $derived(conversion.converted.filter((c) => c.errors.length > 0));
  const visiblePlans = $derived(plans.filter((p) => p.target.kind !== "skip"));

  /*
   * Lo que incumple lo exigido a las columnas.
   *
   * No es un error de conversion --el dato se entiende perfectamente-- sino una
   * condicion que puso quien importa, asi que va por su lado: se pinta en rojo
   * en la grilla y detiene el boton hasta que se corrija el archivo o se quite
   * la regla. La casilla de seguir con las demas filas no lo salta: seguir seria
   * escribir justo lo que se pidio no escribir.
   */
  const ruleIssues = $derived(parsedTable ? findRuleIssues(parsedTable, plans, rules) : []);

  /*
   * Lo que la tabla exige por su cuenta y esta importacion no trae.
   *
   * No lo pide quien importa --eso son las reglas de arriba-- sino la columna:
   * marcada obligatoria, la base rechaza la fila que llegue sin ella y con ella
   * el lote entero. Se mira aqui para decirlo antes de escribir nada.
   *
   * La tabla de personas se queda fuera: sus filas no se escriben en la
   * coleccion sino por su propia ruta, que decide aparte que hacer con cada una.
   */
  const requiredGaps = $derived(
    parsedTable && !isPeople
      ? findRequiredGaps(parsedTable, plans, table.fields)
      : { unmapped: [], blank: [] },
  );
  /**
   * Si alguna fila va a nacer, que es cuando falta una columna obligatoria
   * importa: sobrescribir una fila que ya esta no toca lo que no se manda, asi
   * que una columna obligatoria que el archivo no trae no le quita nada.
   */
  const createsRows = $derived.by(() => {
    if (result) return false;
    if (mode !== "overwrite") return conversion.converted.length > 0;
    return conversion.converted.some((conv, i) => statusOf(conv, i) !== "update");
  });
  /** Columnas obligatorias de la tabla a las que no llega ninguna del archivo. */
  const requiredMissing = $derived(createsRows ? requiredGaps.unmapped : []);
  /** Celdas vacias en una columna que la tabla exige. Detienen el guardado. */
  const requiredBlank = $derived(requiredGaps.blank);
  /** Si la tabla exige algo que no esta: el boton se queda apagado. */
  const requiredUnmet = $derived(requiredMissing.length > 0 || requiredBlank.length > 0);
  /** Cuantas filas y en que columnas, para contarlo en el aviso sin repetir. */
  const requiredBlankRows = $derived(new Set(requiredBlank.map((i) => i.row)));
  const requiredBlankColumns = $derived(new Set(requiredBlank.map((i) => i.column)));
  /** Los nombres de las columnas que faltan, ya juntos: se dicen dos veces. */
  const requiredMissingNames = $derived(requiredMissing.map((f) => f.label).join(", "));

  /**
   * Todo lo que se pinta en rojo en la grilla: lo exigido a mano y lo que exige
   * la tabla. Para el aviso van por separado --se arreglan de maneras
   * distintas-- pero la celda se marca igual, y de la misma forma.
   */
  const markedIssues = $derived([...ruleIssues, ...requiredBlank]);
  /** Las filas marcadas, por su sitio en el archivo (desde 0). */
  const ruleRows = $derived(new Set(markedIssues.map((i) => i.row - 1)));
  /** Que le pasa a cada celda marcada. La llave es fila y columna. */
  const ruleCells = $derived(
    new Map(markedIssues.map((i) => [`${i.row - 1}\u0000${i.column}`, i.kind])),
  );
  const ruleCell = (row: number, column: string) => ruleCells.get(`${row}\u0000${column}`);
  const duplicateRows = $derived(
    new Set(ruleIssues.filter((i) => i.kind === "duplicate").map((i) => i.row)),
  );
  const missingRows = $derived(
    new Set(ruleIssues.filter((i) => i.kind === "missing").map((i) => i.row)),
  );
  /**
   * En que columnas pasa.
   *
   * Para nombrarlas en el aviso --y no mandar a buscarlas-- y para que cada
   * encabezado sepa si la regla que lleva puesta se esta incumpliendo: la
   * pastilla se pone roja ahi mismo, encima de la columna que hay que mirar.
   */
  const duplicateColumns = $derived(
    new Set(ruleIssues.filter((i) => i.kind === "duplicate").map((i) => i.column)),
  );
  const missingColumns = $derived(
    new Set(ruleIssues.filter((i) => i.kind === "missing").map((i) => i.column)),
  );

  /**
   * Las filas del archivo repartidas como personas, para contar.
   *
   * Solo para contar: lo que se manda al guardar se reparte otra vez en `save`,
   * cuando las columnas nuevas ya existen y tienen nombre. Para el recuento da
   * igual --se cuenta por el correo, que es una columna de siempre-- y hacerlo
   * aqui es lo que permite decir cuantas cuentas se crearian antes de crear la
   * primera.
   */
  const peopleRows = $derived(
    !isPeople || !parsedTable
      ? []
      : buildPeopleRows(
          table.fields,
          conversion.converted.filter((c) => c.errors.length === 0).map((c) => ({ ...c.values })),
        ),
  );

  /*
   * Cuantas cuentas se van a crear, dicho antes de guardar nada.
   *
   * Se pregunta al servidor porque solo el ve la lista de cuentas de esta
   * aplicacion. Con `soloContar` no escribe nada.
   */
  $effect(() => {
    const rows = peopleRows;
    const crear = crearCuentas;
    if (!isPeople || stage !== "preview" || rows.length === 0) {
      peopleReport = null;
      return;
    }
    let alive = true;
    countPeopleImport(table.app, rows, crear)
      .then((r) => {
        if (alive) peopleReport = r;
      })
      .catch(() => {
        if (alive) peopleReport = null;
      });
    return () => {
      alive = false;
    };
  });

  /** Las columnas del archivo que van a parar a una relacion, con su destino. */
  const relationPlans = $derived(
    visiblePlans.filter(
      (p) =>
        p.target.kind === "field" &&
        isRelationField(p.target.field) &&
        p.target.field.multiple !== true,
    ),
  );

  /*
   * El emparejado, en cuanto se sabe a donde va cada columna y con que llave.
   *
   * Se hace antes de guardar nada para poder decir cuantos valores encontraron
   * registro y cuantos no: quien importa tiene derecho a saberlo antes, no a
   * descubrirlo despues en la grilla.
   */
  $effect(() => {
    const source = parsedTable;
    const current = plans;
    const byKey = keys;
    const list = people.list;
    if (stage !== "preview" || !source || relationPlans.length === 0) {
      reports = [];
      matches = new Map();
      return;
    }
    let alive = true;
    matching = true;

    const targets = current.map((plan) =>
      plan.target.kind === "field" && isRelationField(plan.target.field) ? plan.target.field : null,
    );

    void matchRelationColumns({
      targets,
      rows: source.rows,
      tables,
      keys: byKey,
      lookup: panelLookup(list),
    })
      .then((result) => {
        if (!alive) return;
        reports = result.reports;
        matches = result.matches;
      })
      .catch(() => {
        if (alive) reports = [];
      })
      .finally(() => {
        if (alive) matching = false;
      });

    return () => {
      alive = false;
    };
  });

  /**
   * Lo que no entro, tal como venia en el archivo.
   *
   * Con sus columnas y sus valores de origen --no los convertidos--: el archivo
   * que sale de aqui es el que se corrige y se vuelve a importar.
   */
  function downloadLeftover(rows: number[]) {
    if (!parsedTable || rows.length === 0) return;
    const source = parsedTable;
    const out = rows.map((r) => {
      const row = { id: "" } as Row;
      source.columns.forEach((col, i) => {
        row[col] = source.rows[r]?.[i] ?? "";
      });
      return row;
    });
    const csv = rowsToCsv(
      source.columns.map((c) => ({ name: c, label: c, type: "text" })),
      out,
      separator,
    );
    downloadFile("filas-no-importadas.csv", csv, "text/csv;charset=utf-8");
  }

  function downloadFailed() {
    if (!parsedTable) return;
    const source = parsedTable;
    const failedRows = failing.map((conv) => {
      const row = { id: "" } as Row;
      source.columns.forEach((col, i) => {
        row[col] = source.rows[conv.errors[0].row - 1]?.[i] ?? "";
      });
      return row;
    });
    const csv = rowsToCsv(
      source.columns.map((c) => ({ name: c, label: c, type: "text" })),
      failedRows,
      separator,
    );
    downloadFile("filas-fallidas.csv", csv, "text/csv;charset=utf-8");
  }

  const overwriteByOrder = $derived(
    mode === "overwrite" && !visiblePlans.some((p) => p.target.kind === "id"),
  );

  /**
   * Los correos del archivo que ya tienen cuenta aqui.
   *
   * Los dice el servidor, en el mismo recuento que se lee encima de la tabla:
   * es el unico que ve las cuentas de esta aplicacion. Mirarlo contra la lista
   * de invitados que el panel tiene cargada era barato, pero podia no ser la
   * misma --llega recortada, y se queda vieja en cuanto alguien entra o sale--
   * y entonces el color de las filas contaba una historia y el recuento de
   * encima, otra. Mientras el recuento no llega no hay ninguna tenida, que es
   * lo correcto: todavia no se sabe.
   */
  const knownEmails = $derived(
    new Set(
      (peopleReport?.existenCorreos ?? []).map((c) => c.trim().toLowerCase()).filter(Boolean),
    ),
  );
  /** Donde guarda el correo esta tabla de personas. */
  const accountField = $derived(table.fields.find((f) => f.system === "cuenta")?.name ?? "");

  /**
   * Que turno ocupa cada fila al sobrescribir por orden, o -1 si no gasta uno.
   *
   * Al guardar, las filas se emparejan en su orden contra las que ya estan,
   * pero solo las validas: una fila con error no se manda y no gasta turno.
   * Contando aqui por el sitio que ocupa en el archivo, un archivo con una fila
   * mala corria el emparejamiento y la previsualizacion tenia de amarillo
   * --"pisa una fila"-- filas que al guardar se creaban nuevas.
   */
  const orderTurns = $derived.by(() => {
    const turns: number[] = [];
    let turn = 0;
    for (const conv of conversion.converted) turns.push(conv.errors.length === 0 ? turn++ : -1);
    return turns;
  });

  function statusOf(conv: ConvertedRow, index: number): RowStatus {
    /*
     * En personas no hay modo que elegir: cada fila se reconoce por su correo.
     * La de quien ya tiene cuenta aqui se actualiza --con lo que traiga el
     * archivo-- y la de quien no, nace. Cuales son unas y cuales otras lo dice
     * el servidor en `knownEmails`, que es lo mismo que cuenta el aviso de
     * encima de la tabla: asi el color y el numero no pueden discrepar.
     */
    if (isPeople) {
      const email = String(conv.values[accountField] ?? "")
        .trim()
        .toLowerCase();
      return email && knownEmails.has(email) ? "update" : "new";
    }
    if (mode === "add") return "add";
    if (mode === "replace") return "replace";
    if (conv.id && existingIds.has(conv.id)) return "update";
    if (overwriteByOrder) {
      const turn = orderTurns[index] ?? -1;
      return turn >= 0 && existingRows[turn] ? "update" : "new";
    }
    return "new";
  }

  /**
   * La fila que se manda a guardar.
   *
   * Los planes llegan de fuera y no se leen de `visiblePlans` a proposito: al
   * guardar, las columnas recien creadas ya existen y tienen nombre, pero
   * `visiblePlans` sale de `table.fields`, que es la tabla tal como estaba al
   * abrir el dialogo. Con los planes de antes, el valor de una columna nueva se
   * guardaba bajo la clave vacia --el borrador aun no tenia nombre-- y la
   * columna quedaba creada y vacia.
   *
   * La celda vacia manda igual que la escrita: deja la columna vacia. El
   * archivo es lo que queda, y no una mezcla de lo que trae con lo que hubiera
   * antes; solo se tocan las columnas que entran --las que se recorren aqui--,
   * asi que lo que el archivo ni menciona se queda como estaba. Era una casilla
   * ("Las celdas vacias borran el valor guardado") y no lo es: al importar
   * apagada, corregir un dato quitandolo no hacia nada y no se veia por que.
   */
  function buildBody(conv: ConvertedRow, plansToUse: ColumnPlan[]): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    for (const plan of plansToUse) {
      const target = plan.target;
      if (target.kind !== "field" && target.kind !== "create") continue;
      const field = target.kind === "create" ? target.draft : target.field;

      // Una relacion se guarda por el registro que encontro, no por el texto:
      // el id si lo encontro, y el corralito del valor sin dueno si no. Una
      // fila sin enlace entra igual; no es un error de importacion.
      if (isRelationField(field) && field.multiple !== true) {
        const raw = conv.values[field.name];
        if (raw === undefined) {
          Object.assign(body, relationCellValues(field, { id: "", value: "" }));
          continue;
        }
        const value = String(raw);
        const match = matches.get(field.name)?.get(value) ?? { id: "", value };
        Object.assign(body, relationCellValues(field, match));
        continue;
      }

      const value = conv.values[field.name];
      body[field.name] = value === undefined ? null : value;
    }
    return body;
  }

  async function save() {
    busy = true;
    hush();
    try {
      const source = parsedTable;
      if (!source) return;

      // 1. Las columnas nuevas se crean antes de guardar las filas.
      let fields = table.fields;
      const toCreate = visiblePlans.filter((p) => p.target.kind === "create");
      if (toCreate.length > 0) {
        const updated = await patch<TableRecord>(`/api/tables/${table.id}`, {
          fields: [
            ...fields,
            /*
             * Con el nombre que se leyo en la previsualizacion, no con el del
             * archivo: el borrador ya trae la mayuscula puesta y el tipo
             * adivinado, y crearla por `p.column` dejaba en la tabla una
             * columna llamada "contacto mail" despues de haber ensenado
             * "Contacto mail" en el encabezado.
             */
            ...toCreate.map((p) => {
              const draft = p.target.kind === "create" ? p.target.draft : null;
              return {
                name: "",
                label: draft?.label || p.column,
                type: draft?.type ?? ("text" as FieldType),
              };
            }),
          ],
        });
        fields = updated.fields;
        /*
         * Las columnas ya existen: se olvida el "crear" que se habia elegido a
         * mano para que no se vuelvan a crear.
         *
         * Guardar no siempre cierra el dialogo --una importacion de personas
         * con filas fuera se queda abierta para decir cuales-- y volver a darle
         * repetia la creacion. De ahi salen las columnas con `_2` y `_3` en el
         * nombre. Sin la eleccion a mano encima, la sugerencia ya empareja con
         * la columna recien creada.
         */
        const next = { ...overrides };
        for (const p of toCreate) delete next[p.column];
        overrides = next;
      }

      // 2. Conversion con los nombres ya reales (las nuevas tienen nombre).
      const resolvedPlans = plans.map((plan) => {
        if (plan.target.kind !== "create") return plan;
        const label = plan.target.draft.label || plan.column;
        const created = fields.find((f) => f.label === label);
        const target: ColumnTarget = created ? { kind: "field", field: created } : { kind: "skip" };
        return { ...plan, target };
      });
      const resolved = convertRows(source, resolvedPlans);

      /*
       * Lo que se va a guardar, cada fila con el sitio que ocupa en el archivo.
       * El sitio hace falta despues: es lo que permite decir cuales no entraron
       * y volver a sacarlas del archivo tal como venian.
       */
      const validPairs = resolved.converted
        .map((conv, row) => ({ conv, row }))
        .filter((p) => p.conv.errors.length === 0);
      const valid = validPairs.map((p) => p.conv);
      /** Las que ni se intentaron: traian error de conversion. */
      const conError = resolved.converted
        .map((c, i) => (c.errors.length > 0 ? i : -1))
        .filter((i) => i >= 0);
      if (resolved.errors.length > 0 && !continueOnError) {
        say(
          "warning",
          "Hay filas con errores. Marca la casilla del pie para guardar solo las válidas.",
        );
        return;
      }

      // 3. Personas va por su ruta: reconoce por correo a quien ya tiene cuenta
      // y lo actualiza en vez de duplicarlo, y solo crea cuentas si se pidio.
      // Las filas que las crearian sin haberlo pedido se quedan fuera.
      if (isPeople) {
        /*
         * Se reparte otra vez aqui, y no se manda lo que se conto antes.
         *
         * `peopleRows` sale de la conversion de la previsualizacion, donde una
         * columna que todavia no existe es un borrador sin nombre: sus valores
         * se amontonaban bajo la clave vacia y `buildPeopleRows` los buscaba en
         * unas columnas que aun no estaban. La gente entraba con su correo y su
         * nivel, y las columnas recien creadas se quedaban vacias.
         *
         * `valid` y `fields` son de despues de crearlas, asi que aqui cada
         * valor ya sabe en que columna va.
         */
        const rows = buildPeopleRows(
          fields,
          valid.map((c) => ({ ...c.values })),
        );
        const report = await runPeopleImport(table.app, rows, crearCuentas);
        peopleReport = report;
        newKeys = report.claves;

        /*
         * Las filas que no entraron, por su sitio en el archivo: las que ya
         * traian error, las que no tienen un correo utilizable y las de quien
         * no tiene cuenta cuando no se pidio crearlas. El servidor las cuenta y
         * dice sus correos; aqui se vuelven a encontrar en el archivo para
         * poder ensenarlas y descargarlas tal como venian.
         */
        const cuenta = table.fields.find((f) => f.system === "cuenta")?.name ?? "";
        const sinCuenta = new Set(report.fueraCorreos.map((c) => c.trim().toLowerCase()));
        const leftover: number[] = [];
        resolved.converted.forEach((c, i) => {
          if (c.errors.length > 0) {
            leftover.push(i);
            return;
          }
          const correo = String(c.values[cuenta] ?? "")
            .trim()
            .toLowerCase();
          if (!correo || sinCuenta.has(correo)) leftover.push(i);
        });

        /*
         * Una frase por cifra, y cada una nombrando su sujeto: aqui se cuentan
         * personas, y quien recoge esto cuenta ademas filas de otras tablas
         * --las que quedaron enlazadas y las que no--. Con todo en una frase no
         * se sabria cual de los tres numeros cuenta que. Ver `peopleImportNote`.
         */
        const guardadas = report.existen + report.seCrearan;
        const partes: string[] = [
          `Se ${guardadas === 1 ? "importó 1 persona" : `importaron ${guardadas} personas`}${
            report.seCrearan > 0 ? `, ${report.seCrearan} con cuenta nueva` : ""
          }.`,
        ];
        if (report.fuera > 0) {
          partes.push(
            `${report.fuera} ${report.fuera === 1 ? "fila se quedó fuera" : "filas se quedaron fuera"} porque ${report.fuera === 1 ? "esa persona no tiene" : "esas personas no tienen"} cuenta y no se pidió crearlas.`,
          );
        }
        if (report.sinCorreo > 0) {
          partes.push(
            `${report.sinCorreo} ${report.sinCorreo === 1 ? "quedó fuera" : "quedaron fuera"} sin un correo utilizable.`,
          );
        }
        if (report.rolesNuevos.length > 0) {
          partes.push(
            `${report.rolesNuevos.length === 1 ? "Nació 1 rol nuevo" : `Nacieron ${report.rolesNuevos.length} roles nuevos`}: ${report.rolesNuevos.join(", ")}.`,
          );
        }
        const resumen = partes.join(" ");
        const todoEntro = report.fuera === 0 && report.sinCorreo === 0;

        /*
         * Terminar de importar cierra el dialogo. La excepcion son las claves
         * recien creadas: se ven una vez y no se vuelven a sacar de ningun
         * sitio, asi que cerrar encima de ellas seria perderlas. Ahi se queda
         * abierto hasta que quien importa las descargue o las copie.
         */
        /*
         * Terminar de importar ya no cierra el dialogo: lo convierte en el
         * parte. El aviso de fuera se manda igual --lo cuenta quien abrio el
         * dialogo, y sobrevive a cerrarlo-- pero lo que hay que mirar, que son
         * las filas que no entraron, se queda aqui.
         */
        result = { ok: todoEntro && leftover.length === 0, text: resumen, leftover };
        await onDone({ text: resumen, ok: todoEntro });
        return;
      }

      // 4. Pedidos por modo de guardado. `row` dice de que fila del archivo sale
      // cada uno; los borrados de "Reemplazar todo" no salen de ninguna (-1).
      const requests: {
        method: string;
        url: string;
        body: Record<string, unknown>;
        row: number;
      }[] = [];
      const records = (id: string) =>
        `/api/collections/${table.dataCollection}/records${id ? `/${id}` : ""}`;

      if (mode === "replace") {
        for (const id of existingIds) {
          requests.push({ method: "DELETE", url: records(id), body: {}, row: -1 });
        }
        for (const { conv, row } of validPairs) {
          requests.push({
            method: "POST",
            url: records(""),
            body: { ...buildBody(conv, resolvedPlans), id: conv.id ?? undefined },
            row,
          });
        }
      } else if (mode === "overwrite") {
        const hasIdColumn = visiblePlans.some((p) => p.target.kind === "id");
        for (const [n, { conv, row }] of validPairs.entries()) {
          const body = buildBody(conv, resolvedPlans);
          if (conv.id && existingIds.has(conv.id)) {
            requests.push({ method: "PATCH", url: records(conv.id), body, row });
          } else if (hasIdColumn) {
            // Con columna de id se conserva el id aunque sea nuevo, para no
            // romper relaciones que ya apunten a el.
            requests.push({
              method: "POST",
              url: records(""),
              body: { ...body, id: conv.id ?? undefined },
              row,
            });
          } else {
            // Sin columna de id: se actualiza por orden contra la fila
            // existente que toca; las que sobran se crean como nuevas.
            const target = existingRows[n]?.id;
            if (target) requests.push({ method: "PATCH", url: records(target), body, row });
            else requests.push({ method: "POST", url: records(""), body, row });
          }
        }
      } else {
        // Anadir: las ids del archivo se ignoran.
        for (const { conv, row } of validPairs) {
          requests.push({
            method: "POST",
            url: records(""),
            body: buildBody(conv, resolvedPlans),
            row,
          });
        }
      }

      // 5. Escrituras por lotes con la API Batch, tramo a tramo.
      let failures = 0;
      /** Las filas del archivo que no llegaron a la tabla, por su sitio en el. */
      const leftover = new Set<number>(conError);
      let parado = -1;
      for (let i = 0; i < requests.length; i += IMPORT_BATCH_CHUNK) {
        const chunk = requests.slice(i, i + IMPORT_BATCH_CHUNK);
        const enviar = () =>
          fetch("/pb/api/batch", {
            method: "POST",
            headers: { "content-type": "application/json", authorization: pb.authStore.token },
            // `row` es solo nuestro --dice de que fila del archivo sale cada
            // pedido-- y la API de lote rechaza lo que no conoce: se queda aqui.
            body: JSON.stringify({
              requests: chunk.map(({ method, url, body }) => ({ method, url, body })),
            }),
          });

        let res = await enviar();
        /*
         * Un tramo que se paso de rapido se vuelve a intentar entero.
         *
         * Se puede porque el lote es una transaccion: del tramo que fallo no
         * entro ni una fila, asi que repetirlo no duplica nada. El limite lo
         * pone PocketBase por ventana de segundos (ver `IMPORT_RATE_FLOOR` en
         * `shared/importBatch.ts`), de modo que esperar es todo lo que hay que
         * hacer; se espera un poco mas en cada intento y se abandona al tercero
         * para no quedarse dando vueltas en una instalacion con el limite muy
         * abajo.
         */
        let body: unknown = null;
        for (let intento = 1; intento <= 2 && !res.ok; intento++) {
          body = await res.json().catch(() => null);
          if (!isRateLimited(body)) break;
          await new Promise((listo) => setTimeout(listo, intento * 2000));
          res = await enviar();
          body = null;
        }
        if (!res.ok) {
          const detalle = body ?? (await res.json().catch(() => ({})));
          throw new Error(
            errorMessage({ message: `La API de lote respondio ${res.status}`, response: detalle }),
          );
        }
        const data = (await res.json()) as Record<string, { status: number }>;
        // La respuesta viene en el orden del tramo, asi que la posicion dice de
        // que pedido --y de que fila del archivo-- habla cada resultado.
        for (const [key, r] of Object.entries(data)) {
          if (r.status < 400) continue;
          failures++;
          const row = chunk[Number(key)]?.row ?? -1;
          if (row >= 0) leftover.add(row);
        }
        if (failures > 0 && !continueOnError) {
          parado = i + chunk.length;
          break;
        }
      }
      // Lo que quedo sin intentar cuando se paro en el primer fallo tampoco
      // esta en la tabla: cuenta como fuera.
      if (parado >= 0) {
        for (const r of requests.slice(parado)) if (r.row >= 0) leftover.add(r.row);
      }

      const fuera = [...leftover].sort((a, b) => a - b);
      const guardadas = resolved.converted.length - fuera.length;
      const resumen =
        fuera.length === 0
          ? `${guardadas} ${guardadas === 1 ? "fila guardada" : "filas guardadas"}.`
          : `${guardadas} ${guardadas === 1 ? "fila guardada" : "filas guardadas"}, ${fuera.length} ${
              fuera.length === 1 ? "se quedo fuera" : "se quedaron fuera"
            }.`;
      result = { ok: fuera.length === 0, text: resumen, leftover: fuera };
      await onDone({ text: resumen, ok: fuera.length === 0 });
    } catch (err) {
      fail(err);
    } finally {
      busy = false;
    }
  }

  function guardar() {
    if (mode === "replace") {
      confirmReplace = true;
      return;
    }
    void save();
  }

  const total = $derived(conversion.converted.length);
  const statuses = $derived(conversion.converted.map(statusOf));
  /**
   * Si la grilla ensena que le pasa a cada fila.
   *
   * Solo cuando alguna puede pisar una que ya existe --sobrescribiendo--, que
   * es lo unico que no se deshace solo borrando lo importado: en "Añadir" todas
   * son nuevas y la columna diria lo mismo veinte veces.
   */
  const showStatus = $derived(mode === "overwrite");
  /** Cuantas columnas del archivo acaban en la tabla. */
  const mappedCount = $derived(shownPlans.filter((p) => p.target.kind !== "skip").length);
  /** Sin ninguna columna elegida, guardar solo crearia filas vacias. */
  const nothingMapped = $derived(
    !plans.some((p) => p.target.kind === "field" || p.target.kind === "create"),
  );
  /**
   * Que filas del archivo ensena la tabla, por su sitio en el.
   *
   * Antes de guardar, todas --salvo que no haya ni una columna encendida, que
   * entonces no hay nada que ensenar--. Despues, solo las que no entraron: lo
   * que ya esta en la tabla se mira en la tabla.
   *
   * La excepcion es la tabla de personas con "Solo modificar" marcado:
   * quien no tiene cuenta aqui no entra, asi que su fila se va de la tabla en
   * vez de quedarse a la vista como si fuera a guardarse. Se esperan a que el
   * servidor diga quien tiene cuenta --antes no se sabe, y esconderlas todas
   * seria mentir al reves--; cuantas se quedaron fuera y cuales, lo cuenta el
   * aviso de encima.
   */
  const hidesMissing = $derived(!result && isPeople && !crearCuentas && !!peopleReport);
  const shownRows = $derived.by(() => {
    if (result) return result.leftover;
    if (nothingMapped) return [];
    const all = (parsedTable?.rows ?? []).map((_, i) => i);
    return hidesMissing ? all.filter((i) => statuses[i] === "update") : all;
  });
  /**
   * Cuantas filas se van a guardar, que es lo que la tabla ensena.
   *
   * No es `total`: con las filas sin cuenta escondidas, decir "5 filas para
   * guardar" encima de una tabla con dos era contarlas mal.
   */
  const previewCount = $derived(result ? total : shownRows.length);
  /** Sin una sola fila que guardar, importar no haria nada. */
  const nothingToSave = $derived(!result && shownRows.length === 0);
  /**
   * Si alguna columna del archivo llega al correo de la cuenta.
   *
   * En la tabla de usuarios es la condicion para que la importacion haga algo:
   * sin correo no hay a quien reconocer ni a quien crear, y las filas se
   * cuentan todas como "sin un correo utilizable". Se dice aqui y no despues de
   * guardar.
   */
  const hasAccount = $derived(
    !isPeople || plans.some((p) => p.target.kind === "field" && p.target.field.system === "cuenta"),
  );
</script>

{#if stage === "content"}
  <Modal
    id="import-modal"
    class="modal-import-data"
    open
    {onClose}
    width="modal-import-content-width"
    title={`Importar en ${table.label}`}
    description="CSV, Excel o JSON. Arrastra un archivo o pega el contenido."
  >
    <!--
      Las dos formas de traer el contenido, una cada vez. Lo que escriben es el
      mismo `text`, asi que cambiar de pestana no pierde lo que ya hay: lo leido
      de un archivo sigue estando al pasar a pegar texto.
    -->
    <div role="tablist" class="tabs-import-source tab-list w-full">
      <button
        type="button"
        role="tab"
        aria-selected={source === "archivo"}
        class={cx("btn-tab-import-file", "tab", source === "archivo" && "active")}
        onclick={() => (source = "archivo")}
      >
        <Icon name="upload-01" size={16} /> Importar archivo
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={source === "texto"}
        class={cx("btn-tab-import-text", "tab", source === "texto" && "active")}
        onclick={() => (source = "texto")}
      >
        <Icon name="csv-02" size={16} /> Pegar CSV
      </button>
    </div>

    <div class="import-field">
      {#if source === "archivo"}
        <!--
          Sin estado "cargado": un archivo que entra bien ya no se queda aqui
          --se abre la previsualizacion-- asi que lo unico que queda por
          ensenar es el que no se puede importar, en rojo y con su motivo
          debajo.
        -->
        <label
          class={cx("csv-dropzone", "import-dropzone dropzone", fileRejected && "rejected")}
          ondragover={(e) => e.preventDefault()}
          ondrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer?.files?.[0];
            if (file) void readFile(file);
          }}
        >
          <Icon
            name={fileRejected ? "alert-circle" : "upload-01"}
            size={fileRejected ? 22 : 18}
            class="import-dropzone-icon"
          />
          {#if fileRejected}
            <span class="import-dropzone-file dropzone-lead">{fileName}</span>
            <span class="import-dropzone-text">
              Suelta otro archivo o haz clic para cambiarlo
            </span>
          {:else}
            <span class="import-dropzone-text">
              Arrastra un archivo CSV, Excel o JSON, o haz clic para elegirlo
            </span>
          {/if}
          <input
            type="file"
            accept={`.csv,.json,text/csv,application/json,${SHEET_ACCEPT}`}
            class="input-import-file dropzone-input"
            onchange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) void readFile(file);
            }}
          />
        </label>
      {:else}
        <Textarea bind:value={text} placeholder={EJEMPLO_CSV} class="import-textarea" />
      {/if}
    </div>

    <!--
      El separador se elige en la previsualizacion, que es donde se ve si era el
      que no era: aqui todavia no hay columnas que mirar.
    -->
    {#if parsed.ok && !tooMany}
      <div class="import-field import-count-row">
        <span class="import-count-text">
          {parsed.data.rows.length} filas, {parsed.data.columns.length} columnas
        </span>
      </div>
    {/if}

    <div class="import-field">
      <!--
        Lo que paso al leer el archivo --no se pudo abrir, tenia varias hojas--
        va antes que lo que se ve en el contenido: si el archivo no entro bien,
        lo demas es consecuencia.

        Con la pantalla todavia vacia no se dice nada: "pega un texto o arrastra
        un archivo" era un aviso en rojo por abrir el dialogo, y eso es
        exactamente lo que la pantalla esta pidiendo ya. Pero si lo que no trae
        nada es un archivo que SI se solto, hay que decirlo: la zona de arrastre
        se queda en rojo --el archivo no pasa a la previsualizacion-- y sin este
        renglon no diria por que.
      -->
      <Note
        kind={notice?.kind ?? "error"}
        message={notice?.text ||
          (!text.trim()
            ? fileName
              ? "El archivo no trae nada dentro."
              : ""
            : !parsed.ok
              ? parsed.error
              : tooMany
                ? `El archivo tiene ${parsed.data.rows.length} filas; el máximo es ${MAX_IMPORT_ROWS}.`
                : "")}
      />
    </div>

    {#snippet footer()}
      <Button onclick={onClose}>Cancelar</Button>
      <Button
        variant="secondary"
        disabled={!parsed.ok || tooMany}
        onclick={() => (stage = "preview")}
      >
        Previsualizar
      </Button>
    {/snippet}
  </Modal>
{:else if !parsedTable}
  <!--
    Cambiar el separador vuelve a leer el archivo, y podria dejarlo ilegible.
    Antes que hacer desaparecer el dialogo con el emparejamiento dentro, se dice
    que paso y se vuelve al texto, que es donde se arregla.
  -->
  <Modal
    id="import-preview"
    class="modal-import-no-data"
    open
    {onClose}
    title={`Importar en ${table.label}`}
  >
    <p class="import-no-data-detail">
      {parsed.ok ? "No hay datos para importar." : parsed.error}
    </p>

    {#snippet footer()}
      <Button onclick={onClose}>Cancelar</Button>
      <Button variant="secondary" onclick={() => (stage = "content")}>Volver al contenido</Button>
    {/snippet}
  </Modal>
{:else}
  <Modal
    id="import-preview"
    class="modal-import-preview"
    open
    fill
    width="modal-import-width"
    height="modal-import-height"
    {onClose}
    title={`Importar en ${table.label}`}
    description={`${previewCount} ${previewCount === 1 ? "fila" : "filas"} para guardar.`}
  >
    <div class="import-preview-body flex flex-col">
      <!--
        Las alertas van arriba del todo y no dentro de la tabla: las dos dicen
        que la importacion, tal como esta, no guardaria nada, y eso se lee antes
        de ponerse a emparejar columnas.
      -->
      {#if result}
        <!-- Lo que paso, ya escrito en la tabla. -->
        <div class={cx("alert", result.ok ? "ok" : "warn", "note-import-result")} role="status">
          <i
            class={`hgi-stroke ${result.ok ? "hgi-checkmark-circle-02" : "hgi-alert-02"}`}
            aria-hidden="true"
          ></i>
          <span>
            <strong>{result.ok ? "Importación terminada" : "Importación terminada a medias"}</strong
            >
            {result.text}
            {#if newKeys.length > 0}
              Cada persona entra con su correo; la clave se le pone desde su fila.
            {/if}
            {#if result.leftover.length > 0}
              Abajo quedan las filas que no entraron, tal como venían en el archivo.
            {/if}
          </span>
        </div>
      {:else if nothingMapped}
        <div class="alert warn note-nothing-mapped" role="status">
          <i class="hgi-stroke hgi-view-off-slash" aria-hidden="true"></i>
          <span>
            <strong>Ninguna columna se va a importar</strong>
            Están todas apagadas, así que no hay nada que guardar. Enciende con el ojo las que quieras
            traer, o pulsa "Restaurar sugerencias".
          </span>
        </div>
      {:else if !hasAccount}
        <!--
          Sin correo la importacion no puede hacer nada, asi que se dice antes y
          no como recuento de filas perdidas al final.
        -->
        <div class="alert warn note-missing-account" role="status">
          <i class="hgi-stroke hgi-alert-02" aria-hidden="true"></i>
          <span>
            <strong>Falta decir cuál columna es el correo</strong>
            Cada persona se reconoce por su correo: sin él, ni se actualiza a quien ya está ni se crea
            a quien falta, y las {total} filas se quedan fuera. Manda a "Correo", desde su encabezado,
            la columna que lo traiga.
          </span>
        </div>
      {/if}

      <!--
        Lo que la tabla exige y el archivo no trae. Va antes de las reglas y
        aparte de ellas: lo pide la columna y no quien importa, asi que no se
        arregla quitando una regla sino mandando una columna ahi --o dejando de
        exigir el dato en la tabla--. Sin esto la importacion salia con el lote
        rechazado entero y un mensaje que no nombraba la columna.
      -->
      {#if !result && requiredUnmet}
        <div class="alert danger note-import-required" role="status">
          <i class="hgi-stroke hgi-alert-02" aria-hidden="true"></i>
          <span>
            <strong>
              {requiredMissing.length > 0
                ? requiredMissing.length === 1
                  ? "Falta una columna que la tabla exige"
                  : "Faltan columnas que la tabla exige"
                : "Hay celdas vacías en una columna que la tabla exige"}
            </strong>
            {#if requiredMissing.length > 0}
              Ninguna columna del archivo va a
              <b class="import-required-strong">{requiredMissingNames}</b>,
              {requiredMissing.length === 1 ? "obligatoria" : "obligatorias"} en {table.label}: cada
              fila nueva se quedaría sin ese dato y la importación se rechaza entera. Manda ahí una
              columna desde su encabezado, o quítale lo de obligatoria a esa columna de la tabla.
            {/if}
            {#if requiredBlank.length > 0}
              {requiredBlankRows.size}
              {requiredBlankRows.size === 1 ? "fila no trae" : "filas no traen"} nada en
              <b class="import-required-strong">{[...requiredBlankColumns].join(", ")}</b>, que la
              tabla exige. Están marcadas en rojo abajo: complétalas en el archivo.
            {/if}
          </span>
        </div>
      {/if}

      <!--
        Lo que incumple lo exigido a alguna columna. Va aparte de la cadena de
        arriba y no como un caso mas: puede pasar a la vez que cualquiera de
        ellas, y es lo unico que deja el boton apagado sin que haya un solo
        error de conversion a la vista.
      -->
      {#if !result && ruleIssues.length > 0}
        <div class="alert danger note-import-rules" role="status">
          <i class="hgi-stroke hgi-alert-02" aria-hidden="true"></i>
          <span>
            <strong>
              {#if duplicateRows.size > 0 && missingRows.size > 0}
                Hay filas duplicadas y filas a las que les falta un dato obligatorio
              {:else if duplicateRows.size > 0}
                Hay filas duplicadas
              {:else}
                Hay filas a las que les falta un dato obligatorio
              {/if}
            </strong>
            {#if duplicateRows.size > 0}
              {duplicateRows.size}
              {duplicateRows.size === 1 ? "fila repite" : "filas repiten"} un valor en
              {[...duplicateColumns].join(", ")}.
            {/if}
            {#if missingRows.size > 0}
              {missingRows.size}
              {missingRows.size === 1 ? "fila no trae" : "filas no traen"} nada en
              {[...missingColumns].join(", ")}.
            {/if}
            Están marcadas en rojo abajo: corrige el archivo, o quita la regla desde el encabezado de
            la columna.
          </span>
        </div>
      {/if}

      <!--
        Como se lee el archivo y que se hace con el, encima de la tabla: el modo
        y el separador. Antes vivia en una columna a la izquierda que se llevaba
        un tercio del ancho para decir tres cosas, y la tabla --que es lo que hay
        que mirar-- se quedaba con lo que sobraba. Lo de cada columna se decide
        en su propio encabezado, y las casillas de como escribir, en el pie.
      -->
      {#if !result}
        <div class="bar-import-options inset">
          <!--
          En personas no hay modo que elegir: se reconoce por el correo y se
          actualiza a quien ya esta. Borrar todas las filas seria quitarle el
          acceso a todo el mundo de golpe, que no se hace importando.
        -->
          {#if !isPeople}
            <div class="import-option">
              <span class="import-option-label">Modo</span>
              <Select bind:value={mode} class="select-import-mode">
                <option value="add">Añadir</option>
                <option value="overwrite">Sobrescribir</option>
                <option value="replace">Reemplazar todo</option>
              </Select>
            </div>
          {/if}

          <!--
          El separador se cambia aqui y no solo en la pantalla anterior: si era
          el que no era, se ve justo aqui --una sola columna con todo el renglon
          dentro-- y volver atras a cambiarlo obligaba a rehacer el
          emparejamiento entero. Cambiarlo vuelve a leer el archivo y conserva
          las columnas que sigan existiendo con lo ya elegido.
        -->
          {#if !isJson}
            <div class="import-option">
              <span class="import-option-label">Separador</span>
              <div class="join">
                {#each SEPARATORS as sep (sep.value)}
                  <button
                    type="button"
                    onclick={() => (separator = sep.value)}
                    class={cx(
                      "btn-pick-separator",
                      "btn sm",
                      separator === sep.value && "btn-primary",
                    )}
                  >
                    {sep.label}
                  </button>
                {/each}
              </div>
              <span class="import-separator-count">
                {parsedTable.columns.length}
                {parsedTable.columns.length === 1 ? "columna" : "columnas"}
              </span>
            </div>
          {/if}

          <div class="import-option import-option-columns">
            <span class="import-mapped-count">
              {mappedCount === 0
                ? "Ninguna columna se importa"
                : `${mappedCount} de ${shownPlans.length} ${mappedCount === 1 ? "columna se importa" : "columnas se importan"}`}
            </span>
            <!--
            Un archivo de veinte columnas del que solo interesan dos se
            arreglaba apagandolas una a una. Se apagan todas y se encienden las
            dos.
          -->
            <button
              type="button"
              class="btn-ignore-all-columns btn sm"
              onclick={() => {
                overrides =
                  mappedCount === 0
                    ? {}
                    : Object.fromEntries(
                        plans.map((p) => [p.column, { kind: "skip" } as ColumnTarget]),
                      );
              }}
            >
              <Icon name={mappedCount === 0 ? "refresh" : "view-off-slash"} size={13} />
              {mappedCount === 0 ? "Restaurar sugerencias" : "Ignorar todas"}
            </button>
          </div>
        </div>
      {/if}

      <!-- Columna de datos: avisos, grilla y errores -->
      <div class="import-data-column">
        {#if isPeople && !result}
          <!--
            Lo que va a pasar, dicho antes de guardar nada.

            En amarillo en cuanto haya algo que modificar: crear filas se
            deshace borrandolas, pero pisar lo que ya esta escrito no, y eso
            merece mirarse dos veces antes de darle a Importar. Cuando solo se
            crean, el aviso es informacion y se queda en azul.
          -->
          {@const modifica = (peopleReport?.existen ?? 0) > 0}
          <div class={cx("alert", modifica ? "warn" : "info", "block-people-import")} role="status">
            <i
              class={`hgi-stroke ${modifica ? "hgi-alert-02" : "hgi-information-circle"}`}
              aria-hidden="true"
            ></i>
            <p class="import-people-report">
              {#if peopleReport}
                <!--
                  Lo que va a pasar, en numeros y sin rodeos: cuantas filas
                  nacen y cuantas se actualizan. Antes empezaba por "0 personas
                  del archivo ya tienen cuenta en esta aplicacion", que es la
                  mitad de una frase y ni siquiera la mitad que importa.

                  Cada cosa es su propia frase y trae su punto DENTRO del texto:
                  encadenarlas con un punto suelto delante dejaba el parte
                  empezando por "." en cuanto la primera no tenia nada que decir,
                  y pegarlo detras de un bloque se comia el espacio de antes
                  ("registros nuevosy se modificaran").
                -->
                {#if peopleReport.seCrearan > 0 && peopleReport.existen > 0}
                  Se {peopleReport.seCrearan === 1 ? "creará" : "crearán"}
                  <b class="import-people-strong">{peopleReport.seCrearan}</b>
                  {peopleReport.seCrearan === 1 ? "registro nuevo" : "registros nuevos"}
                  y se {peopleReport.existen === 1 ? "modificará" : "modificarán"}
                  <b class="import-people-strong">{peopleReport.existen}</b>
                  {peopleReport.existen === 1 ? "registro." : "registros."}
                {:else if peopleReport.seCrearan > 0}
                  Se {peopleReport.seCrearan === 1 ? "creará" : "crearán"}
                  <b class="import-people-strong">{peopleReport.seCrearan}</b>
                  {peopleReport.seCrearan === 1 ? "registro nuevo." : "registros nuevos."}
                {:else if peopleReport.existen > 0}
                  Se {peopleReport.existen === 1 ? "modificará" : "modificarán"}
                  <b class="import-people-strong">{peopleReport.existen}</b>
                  {peopleReport.existen === 1 ? "registro." : "registros."}
                {/if}
                {#if peopleReport.fuera > 0}
                  <b class="import-people-strong">{peopleReport.fuera}</b>
                  {peopleReport.fuera === 1
                    ? 'fila se queda fuera: esa persona no tiene cuenta aquí y está marcado "Solo modificar".'
                    : 'filas se quedan fuera: esas personas no tienen cuenta aquí y está marcado "Solo modificar".'}
                {/if}
                {#if peopleReport.sinCorreo > 0}
                  {peopleReport.sinCorreo}
                  {peopleReport.sinCorreo === 1
                    ? "fila no trae un correo utilizable."
                    : "filas no traen un correo utilizable."}
                {/if}
                <!--
                  Los roles del archivo que la aplicacion no tiene se crean al
                  importar: se dice antes, porque quedan en la aplicacion aunque
                  luego se borre la fila que los trajo.
                -->
                {#if peopleReport.rolesNuevos.length > 0}
                  Se {peopleReport.rolesNuevos.length === 1 ? "crea el rol" : "crean los roles"}
                  <b class="import-people-strong">{peopleReport.rolesNuevos.join(", ")}</b>.
                {/if}
              {:else}
                Contando lo que va a pasar…
              {/if}
              {#if peopleReport && peopleReport.fueraCorreos.length > 0}
                <span class="import-people-missing">
                  Sin cuenta: {peopleReport.fueraCorreos.slice(0, 5).join(", ")}
                  {peopleReport.fueraCorreos.length > 5 ? " y más" : ""}
                </span>
              {/if}
            </p>
          </div>
        {/if}

        {#if reports.length > 0}
          <div class="list-import-matches card import-matches-panel">
            <p class="import-matches-title">
              Columnas que apuntan a otra tabla
              {#if matching}<span class="import-matches-busy">emparejando...</span>{/if}
            </p>
            <ul class="import-matches-list">
              {#each reports as report (report.field.name)}
                {@const rows = missingRowCount(report)}
                <li class="import-match-item">
                  <span class="import-match-field">{report.field.label}</span>
                  <span class="import-match-key">por {report.key}</span>
                  <span>
                    {report.matched}
                    {report.matched === 1 ? "valor encontrado" : "valores encontrados"}
                  </span>
                  {#if report.missing.length > 0}
                    <span class="import-match-sep">·</span>
                    <span>
                      {report.missing.length} sin registro en {rows}
                      {rows === 1 ? "fila" : "filas"}
                    </span>
                    <button
                      type="button"
                      class="btn-see-missing link import-match-missing"
                      onclick={() => (seeMissing = report)}
                    >
                      Ver cuales
                    </button>
                  {/if}
                </li>
              {/each}
            </ul>
            <p class="import-matches-foot">
              Las filas sin registro se guardan igual, con su valor a la vista.
            </p>
          </div>
        {/if}

        {#if conversion.errors.length > 0}
          <Toast kind="error" duration={0}>
            <p class="import-errors-title">
              {conversion.errors.length}
              {conversion.errors.length === 1 ? "error" : "errores"} en
              {failing.length}
              {failing.length === 1 ? "fila" : "filas"}
            </p>
            {#if !continueOnError}
              <p class="import-errors-hint">
                El botón Importar queda deshabilitado hasta corregir los errores o marcar, en el
                pie, la casilla de seguir con las demás filas.
              </p>
            {/if}
            <button
              type="button"
              onclick={downloadFailed}
              class="btn-download-failed btn btn-ghost sm import-errors-download"
            >
              <Icon name="download-01" size={13} /> filas fallidas
            </button>
          </Toast>
        {/if}

        <Note kind={notice?.kind ?? "error"} message={notice?.text ?? ""} />

        <!--
          La grilla: la tabla del catalogo (`table-card` + `table-wrap` +
          `table`) dentro de su tarjeta. Lo unico que se le cambia desde aqui es
          lo que pide una previsualizacion y no una tabla de pagina: la cabeza
          fija al desplazar, el encabezado con mandos dentro --sin versalitas-- y
          las celdas mas apretadas para que quepan mas filas a la vista.
        -->
        <div class="grid-import-preview table-card card">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  {#if showStatus}
                    <th class="import-grid-status-header">Qué le pasa a la fila</th>
                  {/if}
                  <!--
                    Todas las columnas del archivo, tambien las que no entran:
                    una columna apagada que desaparecia de la tabla no se podia
                    volver a encender sin buscarla en otra lista.
                  -->
                  {#each shownPlans as plan (plan.column)}
                    <th class="import-grid-col-header">
                      <ImportColumnHead
                        {plan}
                        {table}
                        {tables}
                        {isPeople}
                        {keys}
                        {reports}
                        rule={rules[plan.column] ?? {}}
                        broken={{
                          unique: duplicateColumns.has(plan.column),
                          required: missingColumns.has(plan.column),
                        }}
                        frozen={!!result}
                        onTarget={setTarget}
                        onClear={clearTarget}
                        onKey={(field, key) => (keys = { ...keys, [field]: key })}
                        onRule={setRule}
                      />
                    </th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                <!--
                  Sin una sola columna encendida no se ensenan las filas: lo que
                  se guardaria son filas vacias, y una tabla llena de datos
                  decia justo lo contrario.
                -->
                {#if shownRows.length === 0}
                  <tr>
                    <td
                      class="import-grid-empty"
                      colspan={shownPlans.length + (showStatus ? 1 : 0)}
                    >
                      {#if result}
                        No quedó ninguna fila fuera: entró todo el archivo.
                      {:else if nothingMapped}
                        Ninguna columna está encendida: no hay nada que guardar. Enciende con el ojo
                        del encabezado las que quieras traer.
                      {:else}
                        Ninguna persona del archivo tiene cuenta aquí, así que no hay nada que
                        actualizar. Quita "Solo modificar" para darlas de alta.
                      {/if}
                    </td>
                  </tr>
                {/if}
                <!-- Filas sin id propio en la previsualizacion: el indice es su identidad. -->
                {#each shownRows as r (r)}
                  {@const raw = parsedTable.rows[r] ?? []}
                  {@const conv = conversion.converted[r]}
                  {@const failed = (conv?.errors.length ?? 0) > 0}
                  {@const broken = ruleRows.has(r)}
                  {@const updates = statuses[r] === "update"}
                  <tr
                    class={cx(
                      (failed || broken) && "import-grid-row-error",
                      !failed && !broken && updates && "import-grid-row-update",
                    )}
                    data-tip={isPeople && updates && !failed && !broken
                      ? "Esta persona ya tiene cuenta aquí: su fila se actualiza"
                      : undefined}
                  >
                    {#if showStatus}
                      <td class="import-grid-status">
                        {#if updates}
                          <Tag
                            tone="tag-warning"
                            tip={overwriteByOrder
                              ? `Pisa la fila ${r + 1} de la tabla`
                              : `Pisa la fila ${conv?.id}`}
                            class="import-grid-status-badge"
                          >
                            <Icon name="refresh" /> Sobrescribe
                          </Tag>
                        {:else}
                          <Tag tone="tag-success" class="import-grid-status-badge">
                            <Icon name="plus-sign" /> Nueva
                          </Tag>
                        {/if}
                      </td>
                    {/if}
                    {#each shownPlans as plan (plan.column)}
                      {@const err = conv?.errors.find((e) => e.column === plan.column)}
                      {@const bad = ruleCell(r, plan.column)}
                      {@const why = err
                        ? `${err.message} (fila ${err.row})`
                        : bad
                          ? `${ruleMessage(bad)} (fila ${r + 1})`
                          : undefined}
                      <td
                        class={cx(
                          "import-grid-cell",
                          plan.target.kind === "skip" && "import-grid-cell-ignored",
                          (err || bad) && "import-grid-cell-error",
                        )}
                        data-tip={why}
                        data-tip-tone={why ? "error" : undefined}
                      >
                        <!--
                          La columna apagada se queda vacia: su contenido no va
                          a ninguna parte, y dejarlo a la vista --aunque fuera
                          palido-- era seguir leyendo datos que no se guardan.
                        -->
                        {#if plan.target.kind !== "skip"}
                          {raw[plan.index] || ""}
                        {/if}
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Listado de errores -->
        {#if conversion.errors.length > 0}
          <div class="list-import-errors card">
            <p class="import-errors-list-title eyebrow">Motivo de los errores</p>
            <ul class="import-errors-list">
              {#each conversion.errors.slice(0, 50) as err (`${err.row}-${err.column}`)}
                <li>Fila {err.row} · {err.column}: {err.message}</li>
              {/each}
              {#if conversion.errors.length > 50}
                <li class="import-errors-more">...y {conversion.errors.length - 50} más.</li>
              {/if}
            </ul>
          </div>
        {/if}
      </div>
    </div>

    {#snippet footer()}
      <!--
        Ya escrito, el pie no ofrece guardar otra vez: se lleva lo que no entro
        y se cierra.
      -->
      {#if result}
        {#if result.leftover.length > 0}
          <Button onclick={() => downloadLeftover(result?.leftover ?? [])}>
            <Icon name="download-01" size={13} /> Descargar registros no importados
          </Button>
        {/if}
        <span class="import-footer-note import-footer-note-end">{result.text}</span>
        <Button variant="secondary" onclick={onClose}>Cerrar</Button>
      {:else}
        <!--
          Las tres casillas viven en el pie y no encima de la tabla: no son del
          archivo ni de sus columnas --eso se decide en la grilla-- sino de como
          se escribe, que es lo que hace el boton que tienen al lado.
        -->
        <div class="import-footer-checks">
          <!--
            La casilla de personas se marca para NO crear, y por eso lo que se
            lee cambia con ella: la etiqueta dice lo que la importacion va a
            hacer --"Solo modificar" marcada, "Modificar y crear" sin marcar--
            y no el nombre de una opcion que hay que traducir a lo que pasa.
          -->
          {#if isPeople}
            <label class="import-checkbox choice">
              <input
                type="checkbox"
                checked={!crearCuentas}
                onchange={(e) => (crearCuentas = !e.currentTarget.checked)}
                aria-label="Solo modificar: no crear las cuentas que falten"
                data-tip="Marcada, las personas sin cuenta aquí se quedan fuera"
                class="checkbox-toggle-create-accounts import-checkbox-control"
              />
              <i class="choice-box ico-nudge hgi-stroke hgi-tick-02" aria-hidden="true"></i>
              {crearCuentas ? "Modificar y crear" : "Solo modificar"}
            </label>
          {/if}
          <label class="import-checkbox choice">
            <input
              type="checkbox"
              bind:checked={continueOnError}
              aria-label="Si una fila presenta un error, continuar procesando las demas filas"
              class="checkbox-toggle-continue-on-error import-checkbox-control"
            />
            <i class="choice-box ico-nudge hgi-stroke hgi-tick-02" aria-hidden="true"></i>
            Si una fila presenta un error, continuar procesando las demás filas
          </label>
        </div>
        <span class="import-footer-note import-footer-note-end">
          {ruleIssues.length > 0
            ? duplicateRows.size > 0
              ? "Hay filas duplicadas: no se puede importar así."
              : "Faltan datos obligatorios: no se puede importar así."
            : requiredUnmet
              ? requiredMissing.length > 0
                ? `Nada va a ${requiredMissingNames}, que la tabla exige.`
                : "Hay celdas vacías en una columna obligatoria de la tabla."
              : nothingMapped
                ? "Todas las columnas están ignoradas: no hay nada que guardar."
                : !hasAccount
                  ? "Falta decir cuál columna del archivo es el correo."
                  : isPeople
                    ? "Se reconoce a cada persona por su correo y se actualiza la que ya esté."
                    : mode === "replace"
                      ? "Se borran las filas actuales."
                      : mode === "overwrite"
                        ? overwriteByOrder
                          ? "Se actualizan en el orden del archivo (fila por fila contra las existentes)."
                          : "Se actualizan las que coinciden por id y se agregan las id nuevas."
                        : "Se agregan sin tocar lo existente."}
        </span>
        <Button onclick={onClose} disabled={busy}>Cancelar</Button>
        <Button
          variant="secondary"
          loading={busy}
          disabled={(conversion.errors.length > 0 && !continueOnError) ||
            ruleIssues.length > 0 ||
            requiredUnmet ||
            total === 0 ||
            nothingToSave ||
            nothingMapped ||
            !hasAccount}
          onclick={guardar}
        >
          Importar
        </Button>
      {/if}
    {/snippet}
  </Modal>

  <ConfirmDialog
    open={confirmReplace}
    onClose={() => (confirmReplace = false)}
    title="Reemplazar todas las filas"
    message={`Se borrarán las ${existingIds.size} ${existingIds.size === 1 ? "fila" : "filas"} actuales y se cargarán las del archivo conservando sus ids, para no romper las relaciones que apuntan a ellas. Esta acción no se puede deshacer.`}
    confirmLabel="Reemplazar"
    {busy}
    onConfirm={() => {
      confirmReplace = false;
      void save();
    }}
  />

  <!--
    Agrupados por valor y no por fila: veinte filas suelen ser tres cedulas, y
    lo que hay que resolver son las tres.
  -->
  <Modal
    id="import-missing"
    open={!!seeMissing}
    onClose={() => (seeMissing = null)}
    title={`Valores sin registro en "${seeMissing?.field.label ?? ""}"`}
    description={`Se buscaron por ${seeMissing?.key ?? ""}. Estas filas se guardan igual, con su valor a la vista.`}
  >
    <ul class="import-missing-list">
      {#each seeMissing?.missing ?? [] as m (m.value)}
        <li class="import-missing-item">
          <span class="import-missing-value">{m.value}</span>
          <span class="import-missing-count">
            {m.rows}
            {m.rows === 1 ? "fila" : "filas"}
          </span>
        </li>
      {/each}
    </ul>

    {#snippet footer()}
      <Button onclick={() => (seeMissing = null)}>Cerrar</Button>
    {/snippet}
  </Modal>
{/if}

<style>
  /* El panel del modal vive en `Modal.svelte`; sus medidas se mandan desde aqui. */
  :global(.modal-import-width) {
    max-width: none;
    width: calc(100% - 2rem);
  }

  :global(.modal-import-height) {
    height: calc(100% - 2rem);
  }

  /* -------------------------------------------------- */
  /* pantalla del contenido                              */
  /* -------------------------------------------------- */

  /*
   * Medida fija, un 40% por encima de las 32rem del modal corriente: aqui se
   * mira contenido tabular --el ejemplo con sus columnas, las lineas del CSV
   * pegado-- y con el ancho corto cada fila se partia en dos.
   */
  :global(.modal-import-content-width) {
    width: 44.8rem;
    max-width: 100%;
  }

  /*
   * El hueco es `.dropzone` del catalogo, con sus dos estados finales:
   * `loaded` (leido) y `rejected` (leido pero no importable). Aqui solo lo
   * que este pide de mas: la linea de abajo, que es la instruccion mientras
   * no hay archivo y baja de tono en cuanto lo hay --entonces lo que se lee
   * primero es el nombre, que es `.dropzone-lead`--.
   */
  .import-dropzone {
    & .import-dropzone-text {
      font-size: var(--text-sm);
      line-height: var(--text-sm--line-height);
      color: var(--text-secondary);
    }

    &.rejected .import-dropzone-text {
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-muted);
    }

    /* El icono lo dibuja `Icon`: sale del ambito de la etiqueta. */
    & :global(.import-dropzone-icon) {
      color: inherit;
    }

    &.rejected :global(.import-dropzone-icon) {
      color: var(--danger);
    }
  }

  .import-field {
    margin-top: var(--sp-12);
  }

  :global(.import-textarea) {
    min-height: 11rem;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
  }

  .import-count-row {
    & .import-count-text {
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-muted);
    }
  }

  .import-no-data-detail {
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
    color: var(--text-secondary);
  }

  /* -------------------------------------------------- */
  /* la previsualizacion                                 */
  /* -------------------------------------------------- */

  .import-preview-body {
    /* Crece con el modal: la tabla se queda con todo el alto que sobre despues
       de los avisos y la barra de opciones, y se desplaza por dentro. */
    min-height: 0;
    flex: 1 1 auto;
    gap: var(--sp-12);

    & .note-missing-account,
    & .note-nothing-mapped,
    & .note-import-required,
    & .note-import-rules {
      flex-shrink: 0;
    }

    /* ---- la barra de opciones, encima de la tabla ----
       La caja es `.inset` del catalogo: se hunde dentro del modal en vez de
       levantarse sobre el. Aqui solo el reparto de sus grupos. */
    & .bar-import-options {
      display: flex;
      flex-shrink: 0;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8) var(--sp-16);
      padding: var(--sp-8) var(--sp-12);
    }

    & .import-option {
      display: flex;
      /* Cada grupo se parte por dentro antes que empujar la barra: en una
         pantalla estrecha el modal no se desplaza en horizontal, se apila. */
      min-width: 0;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8);
    }

    /* Lo ultimo de la barra se va al otro extremo: es de las columnas, no de
       como se guarda. */
    & .import-option-columns {
      margin-left: auto;
    }

    & .import-option-label {
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      font-weight: 500;
      color: var(--text-secondary);
    }

    & :global(.select-import-mode) {
      height: 2rem;
      width: auto;
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
    }

    & .import-separator-count {
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-muted);
    }

    & .import-mapped-count {
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-muted);
    }

    /* ---- lo que se cuenta de la tabla de personas ----
       Es un `.alert.info` del catalogo y nada mas: el fondo y el borde los
       ponia otra vez esta hoja, con el gris de una card, y el aviso se
       quedaba sin su tono. */
    & .block-people-import {
      flex-shrink: 0;
    }

    & .import-people-report {
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-secondary);
    }

    /* Los numeros del recuento: resaltados, pero en su renglon. El `strong` de
       `.alert` es el titulo del aviso y se dibuja en bloque. */
    & .import-people-strong {
      font-weight: 700;
      color: var(--text-primary);
    }

    /* El nombre de la columna que falta, dentro del aviso: lo mismo, y por lo
       mismo --el `strong` de `.alert` es el titulo y se dibuja en bloque--. */
    & .import-required-strong {
      font-weight: 700;
      color: var(--text-primary);
    }

    & .import-people-missing {
      display: block;
      margin-top: var(--sp-4);
      color: var(--text-muted);
    }

    & .note-import-result {
      flex-shrink: 0;
    }

    & .import-data-column {
      display: flex;
      min-height: 0;
      min-width: 0;
      flex: 1 1 0%;
      flex-direction: column;
      gap: var(--sp-12);

      /* La caja la pone `card`; el acolchado, que es de aqui. */
      & .import-matches-panel {
        flex-shrink: 0;
        padding: var(--sp-10) var(--sp-12);
      }

      & .import-matches-title {
        margin-bottom: var(--sp-6);
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        font-weight: 500;
        color: var(--text-secondary);
      }

      & :global(.import-matches-busy) {
        margin-left: var(--sp-8);
        opacity: 0.6;
      }

      & .import-matches-list {
        display: flex;
        flex-direction: column;
        gap: var(--sp-4);
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        color: var(--text-secondary);
      }

      & .import-match-item {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--sp-8);
      }

      & :global(.import-match-field) {
        font-weight: 500;
        color: var(--text-primary);
      }

      & :global(.import-match-key) {
        opacity: 0.7;
      }

      & :global(.import-match-sep) {
        color: var(--text-muted);
      }

      & :global(.import-match-missing) {
        color: var(--accent-soft-text);
      }

      & .import-matches-foot {
        margin-top: var(--sp-6);
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        color: var(--text-muted);
      }

      & .import-errors-title {
        font-weight: 500;
      }

      & .import-errors-hint {
        margin-top: var(--sp-4);
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        opacity: 0.8;
      }

      & :global(.import-errors-download) {
        margin-top: var(--sp-4);
        padding: 0 var(--sp-4);
        color: var(--danger);
      }

      /*
       * La tabla es la del catalogo; aqui solo va lo que la previsualizacion
       * necesita y una tabla de pagina no: crecer hasta el alto que sobre,
       * desplazarse por dentro con la cabeza fija, encabezados que llevan
       * mandos --y por eso ni versalitas ni mayusculas-- y celdas apretadas
       * para ver mas filas de una vez.
       */
      & .grid-import-preview {
        min-height: 0;
        min-width: 0;
        flex: 1 1 0%;
      }

      & :global(.table-wrap) {
        min-height: 0;
        flex: 1 1 0%;
        overflow: auto;
        padding-top: 0;
      }

      & :global(.table) {
        min-width: 100%;
        width: max-content;
      }

      & :global(.table thead) {
        position: sticky;
        top: 0;
        z-index: 10;
      }

      & :global(.table th) {
        padding: var(--sp-6) var(--sp-8);
        background: var(--bg-level1);
        text-transform: none;
        letter-spacing: normal;
        font-weight: 500;
      }

      & :global(.table td) {
        max-width: 14rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding: var(--sp-6) var(--sp-14);
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
      }

      & .import-grid-col-header {
        min-width: 11rem;
      }

      & .import-grid-status-header {
        white-space: nowrap;
      }

      & .import-grid-row-error {
        background: var(--danger-bg);
      }

      /* La fila que pisa una que ya existe, tenida de punta a punta: el
         distintivo de la izquierda dice cual, el fondo dice cuantas. */
      & .import-grid-row-update {
        background: color-mix(in oklab, var(--warning-bg) 30%, transparent);
        color: var(--warning);
      }

      /*
       * La columna apagada se queda: su hueco, vacio y hundido, es lo que dice
       * que sigue ahi para encenderla desde el encabezado --que se queda
       * entero-- sin ensenar ni un dato que no se va a guardar.
       */
      & .import-grid-cell-ignored {
        background: var(--bg-field);
      }

      & .import-grid-cell-error {
        color: var(--danger);
      }

      & .import-grid-empty {
        padding: 2rem 0.75rem;
        text-align: center;
        color: var(--text-muted);
      }

      & .import-grid-status {
        white-space: nowrap;
      }

      & :global(.import-grid-status-badge) {
        gap: var(--sp-4);
        white-space: nowrap;
      }

      & .list-import-errors {
        max-height: 10rem;
        flex-shrink: 0;
        overflow-y: auto;
        padding: var(--sp-10) var(--sp-12);
      }

      /* El rotulo es `.eyebrow` del catalogo; aqui solo su hueco. */
      & .import-errors-list-title {
        margin-bottom: var(--sp-6);
      }

      & .import-errors-list {
        display: flex;
        flex-direction: column;
        gap: var(--sp-4);
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        color: var(--text-secondary);
      }

      & .import-errors-more {
        color: var(--text-muted);
      }
    }
  }

  /*
   * El pie reparte en tres: las casillas a la izquierda, la nota de lo que va a
   * pasar pegada a los botones y los botones al final. El hueco lo abre el
   * `margin` automatico de cada extremo; `.modal-foot` alinea a la derecha.
   */
  .import-footer-checks {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-8) var(--sp-16);
    margin-right: auto;
  }

  .import-checkbox {
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-secondary);
  }

  .import-checkbox-control {
    flex-shrink: 0;
  }

  .import-footer-note-end {
    margin-left: auto;
  }

  .import-footer-note {
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-muted);
    text-align: right;
  }

  .import-missing-list {
    max-height: 20rem;
    overflow-y: auto;
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);

    & .import-missing-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-12);
      border-bottom: var(--border-width) solid var(--border);
      padding: var(--sp-6) 0;

      &:last-child {
        border-bottom: 0;
      }
    }

    & .import-missing-value {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    & .import-missing-count {
      flex-shrink: 0;
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-secondary);
    }
  }
</style>
