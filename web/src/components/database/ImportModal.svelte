<!--
  Importar datos a la tabla abierta.

  Primero se pega o se arrastra un archivo CSV, Excel o JSON; después, en una
  previsualizacion a pantalla completa, se emparejan las columnas, se ven los
  errores y se elige como guardar. Un archivo que se lee bien pasa solo a la
  previsualizacion: la primera pantalla se queda unicamente para lo que hay que
  escribir o corregir.

  A donde va cada columna y como se convierte cada celda vive en
  `lib/importPlan.ts`: aqui esta lo que se ve y lo que se escribe.
-->
<script lang="ts">
  import { isPeopleTable } from "@shared/people";
  import type { Match } from "@shared/relations";
  import { isRelationField, type TableRecord } from "@shared/types";

  import type { Row } from "../../lib/cellValues";
  import { cx } from "../../lib/cx";
  import { ROW_ORDER } from "../../lib/dropFiles";
  import {
    type ColumnMatchReport,
    matchRelationColumns,
    missingRowCount,
  } from "../../lib/importParse";
  import {
    type ColumnTarget,
    type ConvertedRow,
    convertRows,
    findRequiredGaps,
    findRuleIssues,
    type ImportNote,
    type RowStatus,
    SEPARATORS,
  } from "../../lib/importPlan";
  import {
    buildRequests,
    createColumns,
    peopleLeftover,
    peopleSummary,
    resolvePlans,
    rowsSummary,
    rowStatus,
    writeBatches,
  } from "../../lib/importSave";
  import { ImportWizard } from "../../lib/importWizard.svelte";
  import { pb } from "../../lib/pb";
  import { getPeople } from "../../lib/people.svelte";
  import {
    buildPeopleRows,
    countPeopleImport,
    type PeopleImportReport,
    runPeopleImport,
  } from "../../lib/peopleGrid";
  import { panelLookup } from "../../lib/relations";
  import { downloadFile, rowsToCsv } from "../../lib/tableExport";
  import Icon from "../Icon.svelte";
  import Toast from "../Toast.svelte";
  import { Button, ConfirmDialog, Modal, Note, Select } from "../ui";
  import ImportContent from "./import/ImportContent.svelte";
  import ImportGrid from "./import/ImportGrid.svelte";

  let {
    table,
    tables,
    initialFile = null,
    onClose,
    onDone,
  }: {
    table: TableRecord;
    /** Todas las tablas de la aplicación: hacen falta para emparejar relaciones. */
    tables: TableRecord[];
    /**
     * Un archivo que llega ya soltado, cuando la importacion no empieza aqui.
     *
     * Es el caso de un archivo de personas soltado en el constructor: alli no
     * se puede importar --crear las cuentas es cosa de este diálogo-- asi que
     * el archivo viaja y esto se abre con el ya leido, en la previsualizacion.
     */
    initialFile?: File | null;
    onClose: () => void;
    /** Recarga la tabla. El resumen llega cuando el diálogo se va a cerrar. */
    onDone: (note?: ImportNote) => Promise<void> | void;
  } = $props();

  const people = getPeople();

  /**
   * En que pantalla esta, el archivo leido y como se emparejan sus columnas:
   * lo que comparten los pasos del asistente. Ver `lib/importWizard.svelte.ts`.
   */
  const wizard = new ImportWizard(() => table);

  let continueOnError = $state(false);
  let existingRows = $state<Row[]>([]);
  let confirmReplace = $state(false);
  let busy = $state(false);

  /**
   * Por que llave se empareja cada columna de relación en esta importacion.
   *
   * Es del archivo, no de la columna: el de transito trae cedulas y el de
   * nómina, correos. Cambiarla aqui no toca lo que enseña la grilla.
   */
  let keys = $state<Record<string, string>>({});
  /** Como le fue a cada columna de relación, para contarlo antes de guardar. */
  let reports = $state<ColumnMatchReport[]>([]);
  let matches = $state<Map<string, Map<string, Match>>>(new Map());
  let matching = $state(false);
  /** La columna cuya lista de valores sin registro se esta mirando. */
  let seeMissing = $state<ColumnMatchReport | null>(null);

  /**
   * La tabla de personas se importa por su propia ruta.
   *
   * Una fila suya no se puede crear escribiendo en la colección: necesita una
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
   * modificar" marcada-- en vez del nombre de una opción que hay que traducir.
   *
   * Empieza marcada: importar gente a la tabla de personas es, casi siempre,
   * darle acceso a quien todavía no lo tiene, y con la casilla apagada la
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
   * Con esto puesto el diálogo deja de ser un formulario: no hay nada mas que
   * elegir --lo que entro, entro-- asi que se apagan los mandos, el pie se
   * queda solo con Cerrar y la tabla pasa a ensenar unicamente las filas que se
   * quedaron fuera, que son las que todavía hay que hacer algo con ellas. Si no
   * se quedo ninguna, la tabla queda vacía.
   */
  let result = $state<{ ok: boolean; text: string; leftover: number[] } | null>(null);

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
    void wizard.readFile(initialFile);
  });

  // Para Sobrescribir y Reemplazar hace falta saber que ids existen y, si no
  // viene columna de id, el orden en que se exporto la tabla (created,id).
  $effect(() => {
    if (wizard.stage !== "preview") return;
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

  /*
   * Lo que incumple lo exigido a las columnas.
   *
   * No es un error de conversion --el dato se entiende perfectamente-- sino una
   * condicion que puso quien importa, asi que va por su lado: se pinta en rojo
   * en la grilla y detiene el botón hasta que se corrija el archivo o se quite
   * la regla. La casilla de seguir con las demas filas no lo salta: seguir seria
   * escribir justo lo que se pidio no escribir.
   */
  const ruleIssues = $derived(
    wizard.parsedTable ? findRuleIssues(wizard.parsedTable, wizard.plans, wizard.rules) : [],
  );

  /*
   * Lo que la tabla exige por su cuenta y esta importacion no trae.
   *
   * No lo pide quien importa --eso son las reglas de arriba-- sino la columna:
   * marcada obligatoria, la base rechaza la fila que llegue sin ella y con ella
   * el lote entero. Se mira aqui para decirlo antes de escribir nada.
   *
   * La tabla de personas se queda fuera: sus filas no se escriben en la
   * colección sino por su propia ruta, que decide aparte que hacer con cada una.
   */
  const requiredGaps = $derived(
    wizard.parsedTable && !isPeople
      ? findRequiredGaps(wizard.parsedTable, wizard.plans, table.fields)
      : { unmapped: [], blank: [] },
  );
  /**
   * Si alguna fila va a nacer, que es cuando falta una columna obligatoria
   * importa: sobrescribir una fila que ya esta no toca lo que no se manda, asi
   * que una columna obligatoria que el archivo no trae no le quita nada.
   */
  const createsRows = $derived.by(() => {
    if (result) return false;
    if (wizard.mode !== "overwrite") return wizard.conversion.converted.length > 0;
    return wizard.conversion.converted.some((conv, i) => statusOf(conv, i) !== "update");
  });
  /** Columnas obligatorias de la tabla a las que no llega ninguna del archivo. */
  const requiredMissing = $derived(createsRows ? requiredGaps.unmapped : []);
  /** Celdas vacias en una columna que la tabla exige. Detienen el guardado. */
  const requiredBlank = $derived(requiredGaps.blank);
  /** Si la tabla exige algo que no esta: el botón se queda apagado. */
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
    !isPeople || !wizard.parsedTable
      ? []
      : buildPeopleRows(
          table.fields,
          wizard.conversion.converted
            .filter((c) => c.errors.length === 0)
            .map((c) => ({ ...c.values })),
        ),
  );

  /*
   * Cuantas cuentas se van a crear, dicho antes de guardar nada.
   *
   * Se pregunta al servidor porque solo el ve la lista de cuentas de esta
   * aplicación. Con `soloContar` no escribe nada.
   */
  $effect(() => {
    const rows = peopleRows;
    const crear = crearCuentas;
    if (!isPeople || wizard.stage !== "preview" || rows.length === 0) {
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

  /** Las columnas del archivo que van a parar a una relación, con su destino. */
  const relationPlans = $derived(
    wizard.visiblePlans.filter(
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
   * descubrirlo después en la grilla.
   */
  $effect(() => {
    const source = wizard.parsedTable;
    const current = wizard.plans;
    const byKey = keys;
    const list = people.list;
    if (wizard.stage !== "preview" || !source || relationPlans.length === 0) {
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
    if (!wizard.parsedTable || rows.length === 0) return;
    const source = wizard.parsedTable;
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
      wizard.separator,
    );
    downloadFile("filas-no-importadas.csv", csv, "text/csv;charset=utf-8");
  }

  function downloadFailed() {
    if (!wizard.parsedTable) return;
    const source = wizard.parsedTable;
    const failedRows = wizard.failing.map((conv) => {
      const row = { id: "" } as Row;
      source.columns.forEach((col, i) => {
        row[col] = source.rows[conv.errors[0].row - 1]?.[i] ?? "";
      });
      return row;
    });
    const csv = rowsToCsv(
      source.columns.map((c) => ({ name: c, label: c, type: "text" })),
      failedRows,
      wizard.separator,
    );
    downloadFile("filas-fallidas.csv", csv, "text/csv;charset=utf-8");
  }

  const overwriteByOrder = $derived(
    wizard.mode === "overwrite" && !wizard.visiblePlans.some((p) => p.target.kind === "id"),
  );

  /**
   * Los correos del archivo que ya tienen cuenta aqui.
   *
   * Los dice el servidor, en el mismo recuento que se lee encima de la tabla:
   * es el único que ve las cuentas de esta aplicación. Mirarlo contra la lista
   * de invitados que el panel tiene cargada era barato, pero podia no ser la
   * misma --llega recortada, y se queda vieja en cuanto alguien entra o sale--
   * y entonces el color de las filas contaba una historia y el recuento de
   * encima, otra. Mientras el recuento no llega no hay ninguna tenida, que es
   * lo correcto: todavía no se sabe.
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
    for (const conv of wizard.conversion.converted)
      turns.push(conv.errors.length === 0 ? turn++ : -1);
    return turns;
  });

  /** Que le pasa a cada fila, con todo lo que hace falta para decidirlo. */
  const statusOf = (conv: ConvertedRow, index: number): RowStatus =>
    rowStatus(conv, index, {
      isPeople,
      accountField,
      knownEmails,
      mode: wizard.mode,
      existingIds,
      overwriteByOrder,
      orderTurns,
      existingRows,
    });

  /**
   * Importar: la cadena de pasos que escribe lo que se vio en la
   * previsualizacion. Cada paso vive en `lib/importSave.ts`; aqui esta el orden
   * y lo que el diálogo enseña entre uno y otro.
   */
  async function save() {
    busy = true;
    wizard.hush();
    try {
      const source = wizard.parsedTable;
      if (!source) return;

      // 1. Las columnas nuevas se crean antes de guardar las filas.
      let fields = table.fields;
      const toCreate = wizard.visiblePlans.filter((p) => p.target.kind === "create");
      if (toCreate.length > 0) {
        fields = await createColumns(table, toCreate, wizard.rules);
        /*
         * Las columnas ya existen: se olvida el "crear" que se había elegido a
         * mano para que no se vuelvan a crear.
         *
         * Guardar no siempre cierra el diálogo --una importacion de personas
         * con filas fuera se queda abierta para decir cuales-- y volver a darle
         * repetia la creacion. De ahi salen las columnas con `_2` y `_3` en el
         * nombre. Sin la eleccion a mano encima, la sugerencia ya empareja con
         * la columna recien creada.
         */
        const next = { ...wizard.overrides };
        for (const p of toCreate) delete next[p.column];
        wizard.overrides = next;
      }

      // 2. Conversion con los nombres ya reales (las nuevas tienen nombre).
      const resolvedPlans = resolvePlans(wizard.plans, fields);
      const resolved = convertRows(source, resolvedPlans);

      /*
       * Lo que se va a guardar, cada fila con el sitio que ocupa en el archivo.
       * El sitio hace falta después: es lo que permite decir cuales no entraron
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
        wizard.say(
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
         * columna que todavía no existe es un borrador sin nombre: sus valores
         * se amontonaban bajo la clave vacía y `buildPeopleRows` los buscaba en
         * unas columnas que aun no estaban. La gente entraba con su correo y su
         * nivel, y las columnas recien creadas se quedaban vacias.
         *
         * `valid` y `fields` son de después de crearlas, asi que aqui cada
         * valor ya sabe en que columna va.
         */
        const rows = buildPeopleRows(
          fields,
          valid.map((c) => ({ ...c.values })),
        );
        const report = await runPeopleImport(table.app, rows, crearCuentas);
        peopleReport = report;
        newKeys = report.claves;

        const cuenta = table.fields.find((f) => f.system === "cuenta")?.name ?? "";
        const leftover = peopleLeftover(resolved.converted, report, cuenta);
        const resumen = peopleSummary(report);
        const todoEntro = report.fuera === 0 && report.sinCorreo === 0;

        /*
         * Terminar de importar cierra el diálogo. La excepcion son las claves
         * recien creadas: se ven una vez y no se vuelven a sacar de ningún
         * sitio, asi que cerrar encima de ellas seria perderlas. Ahi se queda
         * abierto hasta que quien importa las descargue o las copie.
         */
        /*
         * Terminar de importar ya no cierra el diálogo: lo convierte en el
         * parte. El aviso de fuera se manda igual --lo cuenta quien abrio el
         * diálogo, y sobrevive a cerrarlo-- pero lo que hay que mirar, que son
         * las filas que no entraron, se queda aqui.
         */
        result = { ok: todoEntro && leftover.length === 0, text: resumen, leftover };
        await onDone({ text: resumen, ok: todoEntro });
        return;
      }

      // 4. Pedidos por modo de guardado.
      const requests = buildRequests({
        table,
        mode: wizard.mode,
        validPairs,
        plans: resolvedPlans,
        hasIdColumn: wizard.visiblePlans.some((p) => p.target.kind === "id"),
        existingIds,
        existingRows,
        matches,
      });

      // 5. Escrituras por lotes con la API Batch, tramo a tramo. Entra con las
      // que ni se intentaron --traian error de conversion-- y sale con esas mas
      // las que fallaron al escribir.
      const leftover = await writeBatches(requests, {
        continueOnError,
        leftover: new Set<number>(conError),
      });

      const fuera = [...leftover].sort((a, b) => a - b);
      const resumen = rowsSummary(resolved.converted.length, fuera);
      result = { ok: fuera.length === 0, text: resumen, leftover: fuera };
      await onDone({ text: resumen, ok: fuera.length === 0 });
    } catch (err) {
      wizard.fail(err);
    } finally {
      busy = false;
    }
  }

  function guardar() {
    if (wizard.mode === "replace") {
      confirmReplace = true;
      return;
    }
    void save();
  }

  const total = $derived(wizard.conversion.converted.length);
  const statuses = $derived(wizard.conversion.converted.map(statusOf));
  /**
   * Si la grilla enseña que le pasa a cada fila.
   *
   * Solo cuando alguna puede pisar una que ya existe --sobrescribiendo--, que
   * es lo único que no se deshace solo borrando lo importado: en "Añadir" todas
   * son nuevas y la columna diria lo mismo veinte veces.
   */
  const showStatus = $derived(wizard.mode === "overwrite");
  /** Cuantas columnas del archivo acaban en la tabla. */
  const mappedCount = $derived(wizard.shownPlans.filter((p) => p.target.kind !== "skip").length);
  /** Sin ninguna columna elegida, guardar solo crearia filas vacias. */
  const nothingMapped = $derived(
    !wizard.plans.some((p) => p.target.kind === "field" || p.target.kind === "create"),
  );
  /**
   * Que filas del archivo enseña la tabla, por su sitio en el.
   *
   * Antes de guardar, todas --salvo que no haya ni una columna encendida, que
   * entonces no hay nada que ensenar--. Después, solo las que no entraron: lo
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
    const all = (wizard.parsedTable?.rows ?? []).map((_, i) => i);
    return hidesMissing ? all.filter((i) => statuses[i] === "update") : all;
  });
  /**
   * Cuantas filas se van a guardar, que es lo que la tabla enseña.
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
   * cuentan todas como "sin un correo utilizable". Se dice aqui y no después de
   * guardar.
   */
  const hasAccount = $derived(
    !isPeople ||
      wizard.plans.some((p) => p.target.kind === "field" && p.target.field.system === "cuenta"),
  );
</script>

{#if wizard.stage === "content"}
  <ImportContent {wizard} label={table.label} {onClose} />
{:else if !wizard.parsedTable}
  <!--
    Cambiar el separador vuelve a leer el archivo, y podria dejarlo ilegible.
    Antes que hacer desaparecer el diálogo con el emparejamiento dentro, se dice
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
      {wizard.parsed.ok ? "No hay datos para importar." : wizard.parsed.error}
    </p>

    {#snippet footer()}
      <Button onclick={onClose}>Cancelar</Button>
      <Button variant="secondary" onclick={() => (wizard.stage = "content")}>
        Volver al contenido
      </Button>
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
            <strong>
              {result.ok ? "Importación terminada" : "Importación terminada a medias"}
            </strong>
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
            No hay columnas seleccionadas. Activa las que quieras importar o restaura las sugerencias.
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
          <!-- prettier-ignore -->
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
        ellas, y es lo único que deja el botón apagado sin que haya un solo
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
              <Select bind:value={wizard.mode} class="select-import-mode">
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
          {#if !wizard.isJson}
            <div class="import-option">
              <span class="import-option-label">Separador</span>
              <div class="join">
                {#each SEPARATORS as sep (sep.value)}
                  <button
                    type="button"
                    onclick={() => (wizard.separator = sep.value)}
                    class={cx(
                      "btn-pick-separator",
                      "btn sm",
                      wizard.separator === sep.value && "btn-primary",
                    )}
                  >
                    {sep.label}
                  </button>
                {/each}
              </div>
              <span class="import-separator-count">
                {wizard.parsedTable.columns.length}
                {wizard.parsedTable.columns.length === 1 ? "columna" : "columnas"}
              </span>
            </div>
          {/if}

          <div class="import-option import-option-columns">
            <span class="import-mapped-count">
              {mappedCount === 0
                ? "Ninguna columna se importa"
                : `${mappedCount} de ${wizard.shownPlans.length} ${mappedCount === 1 ? "columna se importa" : "columnas se importan"}`}
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
                wizard.overrides =
                  mappedCount === 0
                    ? {}
                    : Object.fromEntries(
                        wizard.plans.map((p) => [p.column, { kind: "skip" } as ColumnTarget]),
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
            <!-- prettier-ignore -->
            <p class="import-people-report">
              {#if peopleReport}
                <!--
                  Lo que va a pasar, en numeros y sin rodeos: cuantas filas
                  nacen y cuantas se actualizan. Antes empezaba por "0 personas
                  del archivo ya tienen cuenta en esta aplicación", que es la
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
                  Los roles del archivo que la aplicación no tiene se crean al
                  importar: se dice antes, porque quedan en la aplicación aunque
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

        {#if wizard.conversion.errors.length > 0}
          <Toast kind="error" duration={0}>
            <p class="import-errors-title">
              {wizard.conversion.errors.length}
              {wizard.conversion.errors.length === 1 ? "error" : "errores"} en
              {wizard.failing.length}
              {wizard.failing.length === 1 ? "fila" : "filas"}
            </p>
            {#if !continueOnError}
              <p class="import-errors-hint">
                Corrige los errores o activa la opción para importar las demás filas.
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

        <Note kind={wizard.notice?.kind ?? "error"} message={wizard.notice?.text ?? ""} />

        <ImportGrid
          {wizard}
          {table}
          {tables}
          {isPeople}
          {keys}
          {reports}
          onKey={(field, key) => (keys = { ...keys, [field]: key })}
          frozen={!!result}
          {nothingMapped}
          {showStatus}
          {overwriteByOrder}
          rows={shownRows}
          {statuses}
          marks={{
            rows: ruleRows,
            cell: ruleCell,
            duplicateColumns,
            missingColumns,
          }}
        />

        <!-- Listado de errores -->
        {#if wizard.conversion.errors.length > 0}
          <div class="list-import-errors card">
            <p class="import-errors-list-title eyebrow">Motivo de los errores</p>
            <ul class="import-errors-list">
              {#each wizard.conversion.errors.slice(0, 50) as err (`${err.row}-${err.column}`)}
                <li>Fila {err.row} · {err.column}: {err.message}</li>
              {/each}
              {#if wizard.conversion.errors.length > 50}
                <li class="import-errors-more">...y {wizard.conversion.errors.length - 50} más.</li>
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
          se escribe, que es lo que hace el botón que tienen al lado.
        -->
        <div class="import-footer-checks">
          <!--
            La casilla de personas se marca para NO crear, y por eso lo que se
            lee cambia con ella: la etiqueta dice lo que la importacion va a
            hacer --"Solo modificar" marcada, "Modificar y crear" sin marcar--
            y no el nombre de una opción que hay que traducir a lo que pasa.
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
                    : wizard.mode === "replace"
                      ? "Se borran las filas actuales."
                      : wizard.mode === "overwrite"
                        ? overwriteByOrder
                          ? "Se actualizan en el orden del archivo (fila por fila contra las existentes)."
                          : "Se actualizan las que coinciden por id y se agregan las id nuevas."
                        : "Se agregan sin tocar lo existente."}
        </span>
        <Button onclick={onClose} disabled={busy}>Cancelar</Button>
        <Button
          variant="secondary"
          loading={busy}
          disabled={(wizard.conversion.errors.length > 0 && !continueOnError) ||
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

  /*
   * La pantalla del contenido --sus medidas y su zona de arrastre-- se fue con
   * ella a `import/ImportContent.svelte`.
   */

  .import-no-data-detail {
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
    color: var(--text-secondary);
  }

  /* -------------------------------------------------- */
  /* la previsualizacion                                 */
  /* -------------------------------------------------- */

  .import-preview-body {
    /* Crece con el modal: la tabla se queda con todo el alto que sobre después
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
       La caja es `.inset` del catálogo: se hunde dentro del modal en vez de
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
       Es un `.alert.info` del catálogo y nada mas: el fondo y el borde los
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
       `.alert` es el título del aviso y se dibuja en bloque. */
    & .import-people-strong {
      font-weight: 700;
      color: var(--text-primary);
    }

    /* El nombre de la columna que falta, dentro del aviso: lo mismo, y por lo
       mismo --el `strong` de `.alert` es el título y se dibuja en bloque--. */
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

      /* La grilla se lleva su CSS a `import/ImportGrid.svelte`; de aqui sale
         solo el alto que le toca como hijo flexible de esta columna. */

      & .list-import-errors {
        max-height: 10rem;
        flex-shrink: 0;
        overflow-y: auto;
        padding: var(--sp-10) var(--sp-12);
      }

      /* El rotulo es `.eyebrow` del catálogo; aqui solo su hueco. */
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
