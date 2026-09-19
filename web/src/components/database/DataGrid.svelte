<!--
  La cuadricula de una tabla: sus filas, lo que se les hace y por donde se
  escriben.

  La grilla es de lectura. Escribir es siempre el cajon lateral, que da sitio a
  cada columna con su etiqueta; aqui una celda no cabria un selector de personas
  ni un archivo.

  No virtualiza: pinta la tabla entera y pagina en el servidor. En React eso
  obligaba a memoizar media pantalla; con runas cada celda se vuelve a calcular
  sola y esas memorias sobran.
-->
<script lang="ts" module>
  /**
   * Lo que se espera desde la ultima tecla antes de volver a leer la tabla.
   *
   * Suficiente para que una palabra escrita de seguido sea una sola consulta, y
   * poco para que corregir una letra no se sienta parado.
   */
  const SEARCH_DELAY = 250;

  /**
   * Lo minimo que el giro se queda a la vista, aunque las filas ya esten.
   *
   * Una lectura corta vuelve en menos de lo que tarda en verse: sin este suelo,
   * el icono cambia y vuelve en el mismo parpadeo y lo unico que se percibe es
   * un tiron. Se mide desde que empezo a girar, no desde que termino de leer.
   */
  const SPIN_MIN = 400;

  const PAGE_SIZES = [25, 50, 100, 200, 300, 500] as const;
  /** Cuando `meta.pageSize` no vale, la grilla usa este tamano. */
  const DEFAULT_PAGE_SIZE = 50;
</script>

<script lang="ts">
  import {
    isOverlayField,
    isPeopleNameField,
    isPeopleTable,
    MEMBER_FIELD,
    removeWarning,
    ROLE_ICON,
  } from "@shared/people";
  import { deleteRowsWarning } from "@shared/relations";
  import {
    type DeleteImpact,
    type FieldDef,
    isRelationField,
    ORPHAN_SUFFIX,
    type TableRecord,
  } from "@shared/types";
  import { untrack } from "svelte";

  import { useBuilder } from "../../lib/builderContext";
  import type { Row } from "../../lib/cellValues";
  import { cx } from "../../lib/cx";
  import { rangeToText, textToRange } from "../../lib/dataGridClipboard";
  import {
    isSystem,
    SYSTEM_COLUMN_LABELS,
    SYSTEM_COLUMNS,
    systemFieldDef,
    toggleHidden as toggleColumnHidden,
    toggleSystemVisible as toggleColumnSystemVisible,
  } from "../../lib/dataGridColumns";
  import {
    clearRange,
    inlineEditable,
    notEditableReason,
    type PasteFit,
    pasteFit,
    pasteRange,
    rangeSummary,
    writeCell,
  } from "../../lib/dataGridEdit";
  import {
    exportAll as exportAllRows,
    type ExportFormat,
    exportSelected as exportSelectedRows,
  } from "../../lib/dataGridExport";
  import { type GridUndo, revertGrid, undoFits, undoSummary } from "../../lib/dataGridUndo";
  import { ROW_ORDER } from "../../lib/dropFiles";
  import { type CellRef, createSelection } from "../../lib/gridSelection.svelte";
  import { DEFAULT_TABLE_ICON } from "../../lib/icons";
  import { type ImportNote, peopleImportNote } from "../../lib/importPlan";
  import {
    linkWaiting,
    loadOrphans,
    type OrphanValue,
    pendingRows,
    personAsRow,
    type Waiting,
    waitingFor,
  } from "../../lib/orphans";
  import { errorMessage, patch, pb, post } from "../../lib/pb";
  import { takeImport } from "../../lib/pendingImport.svelte";
  import { getPeople } from "../../lib/people.svelte";
  import {
    loadPeopleOverlay,
    mergeOverlay,
    type PersonOverlay,
    removePersonRow,
    savePersonRow,
  } from "../../lib/peopleGrid";
  import { guessPersonFields, type PersonTextColumn } from "../../lib/personGuess";
  import { linkParkedValues, uniqueClashMessage } from "../../lib/relations";
  import Icon from "../Icon.svelte";
  import {
    Button,
    ConfirmDialog,
    Dropdown,
    EmptyState,
    ErrorNote,
    InputPicker,
    Loading,
    MenuItem,
    MenuLabel,
    MenuSeparator,
    Modal,
    SuccessNote,
    WarnNote,
  } from "../ui";
  import ColumnHead, { type Sort } from "./ColumnHead.svelte";
  import ColumnModal from "./ColumnModal.svelte";
  import FieldIcon from "./FieldIcon.svelte";
  import GridCell from "./GridCell.svelte";
  import ImportModal from "./ImportModal.svelte";
  import OrphanPanel from "./OrphanPanel.svelte";
  import PasswordBlock from "./PasswordBlock.svelte";
  import PersonColumnOffer from "./PersonColumnOffer.svelte";
  import RolesModal from "./RolesModal.svelte";
  import RowDrawer from "./RowDrawer.svelte";

  let {
    table,
    tables,
    onSchemaChange,
  }: {
    /** Ya viene con la columna de roles rellena: la rellena `Builder` al leer. */
    table: TableRecord;
    tables: TableRecord[];
    onSchemaChange: () => Promise<void>;
  } = $props();

  /**
   * La tabla de personas se pinta distinto en una sola cosa: dos de sus
   * columnas no estan en su coleccion. Se marca aqui una vez y de ahi salen las
   * tres diferencias --de donde se leen, por donde se escriben y que se puede
   * tocar de ellas--. Ver `web/src/lib/peopleGrid.ts`.
   */
  const isPeople = $derived(isPeopleTable(table));
  /**
   * Como se llama la columna del correo en esta tabla. Es la del sistema, no la
   * que se llame "cuenta": el constructor puede anadir una suya con ese nombre.
   */
  const emailColumn = $derived(table.fields.find((f) => f.system === "cuenta")?.name ?? "cuenta");

  let rows = $state<Row[]>([]);
  /** Lo que se sabe de cada persona fuera de la coleccion. Vacio si no es personas. */
  let overlay = $state<Map<string, PersonOverlay>>(new Map());
  let total = $state(0);
  let page = $state(1);
  /** Filas marcadas con la casilla. Vacias al cambiar de pagina o filtro. */
  let selected = $state<Set<string>>(new Set());
  /** Filas por pagina; el valor "all" carga todas de una sola vez. */
  let pageSize = $state<number | "all">(
    untrack(() =>
      table.meta?.pageSize === 0 ? "all" : (table.meta?.pageSize ?? DEFAULT_PAGE_SIZE),
    ),
  );
  /** Lo que hay escrito en el campo "Filas por pagina": se aplica solo al dar Enter. */
  let pageSizeText = $derived(String(pageSize));
  let loading = $state(true);
  /** Mientras se vuelve a pedir todo a mano, desde el boton de refrescar. */
  let refreshing = $state(false);
  let error = $state("");
  /** Lo que hay que saber de la ultima exportacion. No es un error. */
  let exportWarning = $state("");
  /** Filas que no se dejaron borrar. Se cuenta aparte de los fallos de lectura. */
  let deleteWarning = $state("");

  /**
   * Los invitados a esta aplicacion. Son quienes ensenan una columna de
   * persona: la lista de cuentas no se puede leer entera desde el panel.
   */
  const people = getPeople();
  /** Vuelve a pedirla cuando esta pantalla cambia quien esta invitado. */
  const builder = useBuilder();

  /** Filas de esta tabla cuyo valor no encontro a quien apuntar. */
  let orphans = $state<OrphanValue[]>([]);
  /** La pantalla de valores sin dueno esta abierta. */
  let seeOrphans = $state(false);
  /** La grilla ensena solo las filas cuyo valor no encontro registro. */
  let onlyOrphans = $state(false);
  /** Filas de otras tablas que estaban esperando al registro recien creado. */
  let waiting = $state<Waiting[] | null>(null);
  /**
   * Lo que se busca, ya aplicado. Cambiarlo es pedir las filas otra vez.
   *
   * Va aparte de lo que hay escrito --`searchText`-- porque no se aplica en el
   * momento: ver `typeSearch`.
   */
  let search = $state("");
  /** Lo que hay escrito en el buscador ahora mismo. Es lo que se ve teclear. */
  let searchText = $state("");
  /** La tecla que todavia no se ha aplicado, si queda alguna esperando. */
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  let sort = $state<Sort | null>(null);
  let columnModal = $state<{ field?: FieldDef } | null>(null);
  /**
   * La fila abierta en el panel lateral, o nada si esta cerrado.
   *
   * Es el unico sitio donde se escriben datos: la grilla solo se lee. `row` a
   * nulo es una fila que todavia no existe; con fila es la que se esta
   * editando.
   */
  let openRow = $state<{ row: Row | null } | null>(null);
  /** Separador del CSV exportado; el punto y coma es el que mejor lee Excel. */
  let csvSeparator = $state(";");
  /** Cuando esta abierto, el dialogo de importar de esta tabla. */
  let importing = $state(false);
  /**
   * El archivo que llega ya soltado, cuando la importacion no empieza aqui.
   *
   * Un archivo de personas soltado en el constructor no se puede importar
   * desde alli --crear las cuentas es cosa de este dialogo-- asi que viaja
   * hasta aqui y el dialogo se abre con el dentro. Ver `lib/pendingImport`.
   */
  let importFile = $state<File | null>(null);
  /**
   * Las columnas de texto de otras tablas que resultan nombrar personas.
   *
   * Se busca al terminar de importar personas, que es cuando lo que llevaba
   * meses guardado empieza a coincidir. Ver `design.md` D9.
   */
  let personColumns = $state<PersonTextColumn[] | null>(null);
  let convertingColumns = $state(false);
  /**
   * Como le fue a la ultima importacion.
   *
   * Se cuenta aqui y no dentro del dialogo porque el dialogo se cierra al
   * terminar: un aviso dibujado dentro se iria con el en el mismo instante en
   * que habria que leerlo.
   */
  let importNote = $state<ImportNote | null>(null);
  /** Cuando esta abierto, el dialogo que confirma el borrado masivo. */
  let confirmDelete = $state(false);
  /**
   * Lo que se lleva por delante el borrado, para decirlo antes de confirmar.
   *
   * Se pide al abrir el dialogo y no al marcar cada fila: marcar veinte filas
   * son veinte preguntas a la base para un aviso que quiza no se llegue a leer.
   * `null` mientras se pide, para no ensenar un recuento en cero que despues
   * cambia. Ver `design.md` D7.
   */
  let deleteImpact = $state<DeleteImpact | null>(null);
  /** Mientras se borran las filas seleccionadas de verdad. */
  let deleting = $state(false);
  /**
   * La tarjeta de los roles. Se pide desde dos sitios --la columna de roles y
   * la barra de la tabla de personas-- y las dos abren esta misma.
   */
  let rolesOpen = $state(false);

  const hidden = $derived(table.meta?.hidden ?? []);
  /** Columnas del sistema visibles: se piden por nombre y faltan por defecto. */
  const systemVisible = $derived(
    SYSTEM_COLUMNS.filter((c) => (table.meta?.systemVisible ?? []).includes(c)),
  );

  /*
   * Esconder una columna solo la quita de la grilla. El panel lateral las
   * muestra todas igual, asi que ninguna fila se queda sin poder escribirse.
   */
  const visibleFields = $derived(table.fields.filter((f) => !hidden.includes(f.name)));

  const visible = $derived.by(() => {
    // id y el resto de columnas de sistema van al principio; "actualizado" y
    // "creado" se piden al final de la grilla, de modo que las de negocio
    // queden delante de ellas.
    const iniciales = SYSTEM_COLUMNS.filter((c) => c !== "created" && c !== "updated");
    const finales: (typeof SYSTEM_COLUMNS)[number][] = ["updated", "created"];
    const activas = (lista: readonly (typeof SYSTEM_COLUMNS)[number][]) =>
      lista.filter((c) => systemVisible.includes(c)).map(systemFieldDef);
    return [...activas(iniciales), ...visibleFields, ...activas(finales)];
  });

  /**
   * Las relaciones se traen resueltas: la celda ensena la columna declarada del
   * registro enlazado, no el id. Las de persona tambien, para poder distinguir
   * un enlace roto de una celda que nunca se lleno.
   */
  const relationFields = $derived(
    table.fields.filter((f) => isRelationField(f) && f.multiple !== true).map((f) => f.name),
  );

  /*
   * El recuento de filas sin enlace es de la tabla entera, no de la pagina que
   * se ve: por eso se pregunta aparte y no sale de las filas cargadas.
   */
  $effect(() => {
    const t = table;
    let alive = true;
    loadOrphans(t)
      .then((list) => {
        if (alive) orphans = list;
      })
      .catch(() => {
        if (alive) orphans = [];
      });
    return () => {
      alive = false;
    };
  });

  /**
   * Las personas, juntando las dos fuentes.
   *
   * Se traen todas y se busca, se ordena y se pagina aqui, en vez de pedirselo
   * a la base como en cualquier otra tabla. No es una preferencia: el correo,
   * el nivel y los roles no estan en la coleccion, asi que la base no puede
   * filtrar ni ordenar por ellos. Y se puede: los invitados de una aplicacion
   * son cientos, no millones.
   */
  async function loadPeople() {
    const found = await loadPeopleOverlay(table.app);
    overlay = found;

    const all = mergeOverlay(
      await pb.collection(table.dataCollection).getFullList<Row>({ sort: ROW_ORDER }),
      found,
    );

    const query = search.trim().toLowerCase();
    const matched = query
      ? all.filter((row) =>
          table.fields.some((f) => {
            const value = row[f.name];
            const text = Array.isArray(value) ? value.join(" ") : String(value ?? "");
            return text.toLowerCase().includes(query);
          }),
        )
      : all;

    const by = sort;
    if (by) {
      const dir = by.dir === "desc" ? -1 : 1;
      matched.sort((a, b) => {
        const left = String(a[by.field] ?? "");
        const right = String(b[by.field] ?? "");
        return left.localeCompare(right, "es") * dir;
      });
    }

    total = matched.length;
    rows = pageSize === "all" ? matched : matched.slice((page - 1) * pageSize, page * pageSize);
  }

  async function load() {
    loading = true;
    // Cambiar de pagina o de filtro vacia la seleccion de filas.
    selected = new Set();
    try {
      if (isPeople) {
        await loadPeople();
        error = "";
        return;
      }
      const searchable = table.fields.filter((f) =>
        ["text", "longtext", "email", "url", "select"].includes(f.type),
      );
      const clauses: string[] = [];
      if (search.trim() && searchable.length) {
        clauses.push(
          `(${searchable.map((f) => `${f.name} ~ ${JSON.stringify(search.trim())}`).join(" || ")})`,
        );
      }
      // Ensenar solo lo que falta por enlazar, para poder trabajarlo de seguido.
      if (onlyOrphans && relationFields.length) {
        clauses.push(`(${relationFields.map((n) => `${n}${ORPHAN_SUFFIX} != ""`).join(" || ")})`);
      }
      const options = {
        // Sin columna elegida, por antiguedad: la primera fila creada arriba.
        sort: sort ? `${sort.dir === "desc" ? "-" : ""}${sort.field}` : ROW_ORDER,
        filter: clauses.join(" && "),
        expand: relationFields.join(","),
      };

      if (pageSize === "all") {
        const all = await pb.collection(table.dataCollection).getFullList<Row>(options);
        rows = all;
        total = all.length;
      } else {
        const res = await pb.collection(table.dataCollection).getList<Row>(page, pageSize, options);
        rows = res.items;
        total = res.totalItems;
      }
      error = "";
    } catch (err) {
      error = errorMessage(err);
    } finally {
      loading = false;
    }
  }

  /*
   * Lo que hace volver a pedir las filas se lee aqui, y no en una lista de
   * dependencias escrita a mano: la busqueda, el orden, la pagina, su tamano y
   * el filtro de lo que falta por enlazar.
   */
  $effect(() => {
    void table.id;
    void search;
    void sort;
    void page;
    void pageSize;
    void onlyOrphans;
    /*
     * El cursor se suelta aqui y no dentro de `load`: el rango se elige por
     * sitio, asi que sobrevive a una relectura de la misma pagina --la de
     * despues de pegar-- pero no a un orden, un filtro o una pagina distintos,
     * donde esas mismas coordenadas serian ya otras filas.
     */
    selection.clear();
    editing = null;
    /*
     * Y con el cursor se va lo que se podia deshacer: la escritura anterior se
     * hizo sobre otras filas de las que ahora se van a ver, y aunque la vuelta
     * atras vaya por id, ofrecerla sobre una pantalla que ya no es la suya seria
     * mentir sobre lo que va a cambiar.
     */
    undoable = null;
    void load();
  });

  /**
   * Vuelve a pedir todo lo que esta pantalla ensena de la tabla.
   *
   * La grilla se pide sola cuando cambia algo de aqui --la busqueda, el orden,
   * la pagina--, pero no se entera de lo que pasa fuera: una columna que la IA
   * acaba de anadir, una fila que alguien escribio desde su navegador. Eso se
   * arreglaba recargando el sitio entero, que es volver a entrar en la
   * aplicacion para leer una tabla.
   *
   * Va en este orden: primero las columnas, porque las filas se leen contra
   * ellas --una columna nueva llegaria sin sitio donde pintarse--, y al final
   * los enlaces sin dueno, que se cuentan sobre la tabla entera.
   */
  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    // Se vuelve a pedir todo porque algo cambio fuera de esta pantalla: lo que
    // se recordaba para deshacer se escribio sobre lo de antes.
    undoable = null;
    try {
      await onSchemaChange();
      // Las celdas de persona de cualquier tabla leen esta lista; quien acaba
      // de ser invitado no esta en ella y su enlace se pinta como roto.
      if (isPeople) await builder.reloadPeople();
      await load();
      orphans = await loadOrphans(table).catch(() => []);
    } catch (err) {
      error = errorMessage(err);
    } finally {
      refreshing = false;
    }
  }

  /**
   * Si el icono de la tabla esta girando.
   *
   * No es `loading` a secas: se enciende con el y se apaga un poco despues, lo
   * justo para que el relevo se vea. Entre lectura y lectura seguidas no se
   * reinicia --el suelo se cuenta desde la primera-- asi que teclear deprisa da
   * un giro continuo y no una sucesion de arranques.
   */
  let spinning = $state(false);
  /*
   * Estas dos no son estado de pantalla y por eso no son runas: si lo fueran,
   * el efecto de abajo dependeria de lo que el mismo escribe y volveria a
   * lanzarse solo.
   */
  let spinStart = 0;
  let spinTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if (loading) {
      if (!spinStart) spinStart = Date.now();
      spinning = true;
      return;
    }
    if (!spinStart) return;

    const left = SPIN_MIN - (Date.now() - spinStart);
    const stop = () => {
      spinStart = 0;
      spinning = false;
    };
    if (left <= 0) {
      stop();
      return;
    }
    spinTimer = setTimeout(() => {
      spinTimer = null;
      stop();
    }, left);
    // Corre antes de la siguiente vuelta y al irse la pantalla: una lectura que
    // empieza mientras el giro se esta apagando lo hereda en vez de cortarlo.
    return () => {
      if (spinTimer) clearTimeout(spinTimer);
      spinTimer = null;
    };
  });

  /**
   * El estado intermedio de la casilla "todos" no es un atributo: se pone sobre
   * el nodo. La casilla se marca cuando estan todas, y queda a medias cuando
   * hay algunas.
   */
  let selectAll = $state<HTMLInputElement | null>(null);
  $effect(() => {
    if (selectAll) selectAll.indeterminate = selected.size > 0 && selected.size < rows.length;
  });

  function toggleRow(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  }

  function toggleAll() {
    selected = selected.size === rows.length ? new Set() : new Set(rows.map((r) => r.id));
  }

  /* ------------------------------------------------------------------ */
  /* La edicion en vivo: el cursor, el rango y el portapapeles            */
  /* ------------------------------------------------------------------ */

  /**
   * El cursor y el rango elegido, por sitio y nunca por id.
   *
   * La grilla se ordena, se filtra y se repagina, y una seleccion guardada por
   * id tendria que sobrevivir a todo eso senalando filas que ya no estan donde
   * estaban. Se suelta cuando cambia lo que se ve --es lo que hace cualquier
   * hoja de calculo al reordenar-- y por eso aqui basta con fila y columna.
   */
  const selection = createSelection(() => ({ rows: rows.length, cols: visible.length }));

  /**
   * La celda que se esta escribiendo, y con que empezo.
   *
   * `seed` es la tecla que abrio la edicion cuando se empezo a teclear sobre la
   * celda: sin ella, la primera letra de lo que se escribe se perderia.
   */
  let editing = $state<{ row: number; col: number; seed?: string } | null>(null);
  /** Mientras una celda o un bloque de ellas se estan guardando. */
  let writing = $state(false);
  /** Como le fue a la ultima escritura en bloque. */
  let editNote = $state<ImportNote | null>(null);
  /** Lo pegado que no cabe, esperando a que se diga que hacer con ello. */
  let pasteAsk = $state<{ start: CellRef; matrix: string[][]; fit: PasteFit } | null>(null);
  /**
   * El inverso de la ultima escritura hecha desde aqui, mientras se pueda usar.
   *
   * Un solo paso: cada escritura reemplaza al anterior y deshacer lo gasta. Lo
   * que lo tira esta en el efecto que vuelve a pedir las filas --otra pagina,
   * otro orden, otro filtro, otra tabla-- y en lo que escribe por otra puerta
   * --importar, borrar filas--. Ver `dataGridUndo.ts`.
   */
  let undoable = $state<GridUndo | null>(null);
  /**
   * Si lo recordado todavia se puede escribir: es de esta tabla y sus columnas
   * siguen siendo las de entonces. Cambiar una columna no hace falta vigilarlo
   * aparte, la firma ya no coincide.
   */
  const canUndo = $derived(undoFits(table, undoable));
  /**
   * Donde se escuchan las teclas y el portapapeles.
   *
   * En la caja de la cuadricula y no en la ventana: con el cajon lateral o un
   * dialogo abiertos, las flechas y el pegado son suyos, y un escucha global
   * habria que apagarlo desde cada uno de ellos.
   */
  let gridBox = $state<HTMLTableElement | null>(null);

  /* ------------------------------------------------------------------ */
  /* El ancho de las columnas                                             */
  /* ------------------------------------------------------------------ */

  /**
   * El ancho que se esta arrastrando, antes de guardarlo.
   *
   * Mientras dura el tiron el ancho vive aqui y no en la tabla: guardar en cada
   * pixel serian cien peticiones por un arrastre, y la tabla entera se volveria
   * a leer con cada una.
   */
  let dragWidth = $state<{ name: string; width: number } | null>(null);

  const widths = $derived(table.meta?.widths ?? {});

  /** Lo que mide una columna ahora: lo arrastrado, lo guardado, o nada. */
  function widthOf(name: string): number | undefined {
    if (dragWidth?.name === name) return dragWidth.width;
    const saved = widths[name];
    return saved && saved > 0 ? saved : undefined;
  }

  /**
   * Recoge el arrastre del borde de una columna.
   *
   * Un ancho de cero es "que vuelva a medirse solo": es lo que deja el doble
   * clic sobre el tirador, y por eso se borra de los guardados en vez de
   * guardarse como cero.
   */
  async function resizeColumn(name: string, width: number, done: boolean) {
    if (!done) {
      dragWidth = { name, width };
      return;
    }
    const next = { ...widths };
    if (width > 0) next[name] = width;
    else delete next[name];
    if (next[name] === widths[name]) {
      dragWidth = null;
      return;
    }
    /*
     * El ancho arrastrado se sostiene hasta que la tabla recargada ya lo trae.
     * Soltarlo aqui devolvia la columna al ancho viejo durante lo que tarda el
     * guardado, y se veia un brinco al soltar el raton.
     */
    dragWidth = { name, width };
    try {
      await patch(`/api/tables/${table.id}`, { meta: { ...table.meta, widths: next } });
      await onSchemaChange();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      dragWidth = null;
    }
  }

  /** Si la columna que ocupa ese sitio se escribe desde la celda. */
  function editableAt(col: number): boolean {
    const field = visible[col];
    return !!field && inlineEditable(table, field);
  }

  /**
   * La celda que se pulso estando ya elegida, a la espera de soltar el boton.
   *
   * Es lo que convierte el segundo clic en una edicion: el primero elige y el
   * segundo escribe, sin pedir un doble clic. No es una runa porque no se
   * dibuja con ella --solo vive entre apretar y soltar-- y como estado haria
   * redibujar la cuadricula entera en cada pulsacion.
   */
  let clickedActive: CellRef | null = null;

  function cellDown(row: number, col: number, e: MouseEvent) {
    if (e.button !== 0) return;
    // Lo que se estaba escribiendo no se pierde: el control pierde el foco y
    // eso ya lo guarda.
    if (editing && (editing.row !== row || editing.col !== col)) editing = null;
    if (e.shiftKey) {
      selection.focus({ row, col }, true);
      gridBox?.focus();
      return;
    }

    /*
     * Se anota, pero no se abre todavia: abrir aqui dejaria sin arrastre a la
     * celda que tiene el cursor --el editor se comeria el gesto-- asi que la
     * decision se toma al soltar, cuando ya se sabe si hubo arrastre.
     */
    const at = selection.active;
    clickedActive =
      !editing && at?.row === row && at?.col === col && selection.size === 1 ? { row, col } : null;

    selection.beginDrag({ row, col });
    gridBox?.focus();
  }

  const cellOver = (row: number, col: number) => selection.dragTo({ row, col });

  /*
   * Se suelta el arrastre aunque el raton se levante fuera de la cuadricula, y
   * ahi se decide si aquel clic sobre la celda ya elegida era para escribirla:
   * lo es solo si no se arrastro a ninguna otra.
   */
  $effect(() => {
    const stop = () => {
      const again = clickedActive;
      clickedActive = null;
      selection.endDrag();
      const at = selection.active;
      if (again && at?.row === again.row && at?.col === again.col && selection.size === 1) {
        void startEdit(again);
      }
    };
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  });

  /**
   * Abre una celda para escribirla.
   *
   * Una casilla de si/no no abre nada: la tecla la da la vuelta y se guarda. Un
   * editor para elegir entre dos valores es un paso de mas en la unica columna
   * donde el valor cabe entero en la celda.
   */
  async function startEdit(at: CellRef, seed?: string) {
    if (!editableAt(at.col)) return;
    const field = visible[at.col];
    const row = rows[at.row];
    if (!field || !row) return;
    selection.focus(at);
    if (field.type === "bool") {
      await saveCell(row, field, !row[field.name]);
      return;
    }
    editing = { row: at.row, col: at.col, seed };
  }

  /** Guarda una celda y deja la fila en la grilla como quedo. */
  async function saveCell(row: Row, field: FieldDef, value: unknown) {
    writing = true;
    error = "";
    try {
      const { row: saved, undo } = await writeCell({
        table,
        tables,
        people: people.list,
        row,
        field,
        value,
        overlay,
      });
      undoable = undo;
      /*
       * En personas, el correo, el nivel y los roles no vuelven con la fila: no
       * estan en la coleccion. Sin reponerlos, guardar una columna propia
       * dejaria esas tres en blanco hasta la siguiente lectura.
       */
      const next = isPeople ? (mergeOverlay([saved], overlay)[0] ?? saved) : saved;
      rows = rows.map((r) => (r.id === next.id ? next : r));
      /*
       * Cambiar el correo o los roles cambia la cuenta, no la fila: lo que hay
       * que releer es la lista de invitados, que es de donde salen esas dos
       * columnas aqui y las celdas de persona de las demas tablas.
       */
      if (isPeople && isOverlayField(table, field.name)) {
        overlay = await loadPeopleOverlay(table.app);
        rows = mergeOverlay(rows, overlay);
        await builder.reloadPeople();
      }
    } catch (err) {
      const clash = await uniqueClashMessage(table, { [field.name]: value }, err, row.id).catch(
        () => "",
      );
      error = clash || errorMessage(err);
    } finally {
      writing = false;
    }
  }

  /**
   * Cierra la celda abierta y devuelve el foco a la cuadricula.
   *
   * El foco vuelve a mano porque el control que lo tenia deja de existir: sin
   * esto se quedaba en el documento y las flechas no movian nada.
   */
  function closeEdit() {
    editing = null;
    gridBox?.focus();
  }

  /** Cierra la celda que se estaba escribiendo y guarda si cambio algo. */
  async function commitCell(value: unknown) {
    const at = editing;
    closeEdit();
    if (!at) return;
    const field = visible[at.col];
    const row = rows[at.row];
    if (!field || !row) return;
    // `undefined` es una relacion que no se llego a tocar: su campo arranca sin
    // valor porque la llave vive en el registro enlazado, no en la celda.
    if (value === undefined) return;
    if (!isRelationField(field) && value === row[field.name]) return;
    await saveCell(row, field, value);
  }

  /** Vacia las celdas del rango. */
  async function clearCells() {
    const range = selection.range;
    if (!range) return;
    writing = true;
    error = "";
    editNote = null;
    try {
      const report = await clearRange({ table, rows, fields: visible, range });
      editNote = rangeSummary(report, "vaciaron");
      await load();
      // Despues de recargar y no antes: la recarga no toca lo recordado, pero
      // el efecto que la dispara si, y el orden deja claro cual manda.
      undoable = report.undo ?? null;
    } catch (err) {
      error = errorMessage(err);
    } finally {
      writing = false;
    }
  }

  /** Escribe lo pegado y vuelve a leer: lo guardado no es lo que se pego. */
  async function runPaste(start: CellRef, matrix: string[][], createMissing: boolean) {
    pasteAsk = null;
    writing = true;
    error = "";
    editNote = null;
    try {
      const report = await pasteRange({
        table,
        tables,
        people: people.list,
        rows,
        fields: visible,
        start,
        matrix,
        createMissing,
      });
      editNote = rangeSummary(report, "pegaron");
      const undo = report.undo ?? null;
      /*
       * Se vuelve a leer y no se remienda la grilla a mano: una relacion se
       * guarda como el id del registro que encontro y una fecha como la
       * normalizo la base, asi que lo que hay que ensenar no es lo que se pego.
       */
      await load();
      undoable = undo;
    } catch (err) {
      error = errorMessage(err);
    } finally {
      writing = false;
    }
  }

  /**
   * Deshace la ultima escritura hecha desde la cuadricula.
   *
   * Es una escritura mas, no una vuelta atras de la base: se manda el valor que
   * habia. Por eso se gasta al usarla --volver a mandarla escribiria otra vez
   * lo mismo sobre lo que ya se repuso-- y por eso se vuelve a leer la tabla al
   * terminar, igual que despues de pegar.
   */
  async function undoLast() {
    const undo = undoable;
    if (!undoFits(table, undo)) return;
    writing = true;
    error = "";
    editNote = null;
    try {
      const report = await revertGrid(undo);
      editNote = undoSummary(report);
      await load();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      undoable = null;
      writing = false;
    }
  }

  function copyRange(e: ClipboardEvent) {
    const range = selection.range;
    if (!range || editing) return;
    e.clipboardData?.setData(
      "text/plain",
      rangeToText({ rows, fields: visible, range, people: people.list }),
    );
    e.preventDefault();
  }

  function pasteIntoGrid(e: ClipboardEvent) {
    if (editing) return;
    /*
     * Se pega desde la esquina de arriba a la izquierda del rango, no desde
     * donde quedo el cursor: extender la seleccion con mayusculas deja el
     * cursor en el extremo contrario, y pegar ahi metia lo copiado en la
     * columna equivocada aunque lo marcado fuera justo lo que se queria llenar.
     */
    const range = selection.range;
    const at = range ? { row: range.top, col: range.left } : null;
    const text = e.clipboardData?.getData("text/plain") ?? "";
    if (!at || !text.trim()) return;
    e.preventDefault();
    const matrix = textToRange(text);
    if (matrix.length === 0) return;

    const fit = pasteFit({ table, rows, fields: visible, start: at, matrix });
    // Con filas de sobra se pregunta antes de escribir nada: crear veinte filas
    // por un pegado en el sitio equivocado no tiene vuelta atras.
    if (fit.extra > 0 && fit.canCreate) {
      pasteAsk = { start: at, matrix, fit };
      return;
    }
    void runPaste(at, matrix, false);
  }

  /**
   * Las teclas de la cuadricula.
   *
   * Mientras se escribe una celda no se atiende ninguna: las suyas --Enter,
   * Escape-- las maneja el propio control, y el tabulador lo mueve el navegador
   * como en cualquier formulario, guardando de paso al salir.
   */
  function gridKeys(e: KeyboardEvent) {
    if (editing) return;
    const meta = e.ctrlKey || e.metaKey;

    if (meta && e.key.toLowerCase() === "a") {
      selection.all();
      e.preventDefault();
      return;
    }

    /*
     * Deshacer. Con una celda abierta no se llega hasta aqui --la salida de
     * arriba-- y ahi el atajo es el del propio campo de texto, que es lo que se
     * espera mientras se escribe. Con Mayusculas no se hace nada: eso es
     * rehacer, y todavia no existe.
     */
    if (meta && !e.shiftKey && e.key.toLowerCase() === "z") {
      if (!canUndo) return;
      e.preventDefault();
      void undoLast();
      return;
    }

    const at = selection.active;
    if (!at) return;

    switch (e.key) {
      case "ArrowUp":
        selection.move(-1, 0, e.shiftKey);
        break;
      case "ArrowDown":
        selection.move(1, 0, e.shiftKey);
        break;
      case "ArrowLeft":
        selection.move(0, -1, e.shiftKey);
        break;
      case "ArrowRight":
        selection.move(0, 1, e.shiftKey);
        break;
      case "Tab":
        selection.move(0, e.shiftKey ? -1 : 1, false);
        break;
      case "Home":
        selection.edge(meta ? "col-start" : "row-start", e.shiftKey);
        break;
      case "End":
        selection.edge(meta ? "col-end" : "row-end", e.shiftKey);
        break;
      case "Enter":
      case "F2":
        void startEdit(at);
        break;
      case "Escape":
        selection.clear();
        break;
      case "Delete":
      case "Backspace":
        void clearCells();
        break;
      default:
        // Empezar a teclear sobre una celda la abre y esa tecla es lo primero
        // que lleva escrito, como en cualquier hoja de calculo.
        if (meta || e.altKey || e.key.length !== 1) return;
        void startEdit(at, e.key);
    }
    e.preventDefault();
  }

  /** Abre el panel lateral en blanco, para una fila que todavia no existe. */
  const addRow = () => {
    openRow = { row: null };
  };

  /** Mete en la grilla lo que el panel acaba de guardar. */
  function rowSaved(saved: Row, created: boolean) {
    error = "";
    // El cajon lateral escribe la fila entera por su cuenta: lo que se
    // recordaba para deshacer puede ser de esa misma fila, y reponerlo borraria
    // tambien lo que se acaba de guardar ahi.
    undoable = null;
    /*
     * En personas, el correo, el nivel y los roles no estan en la fila que
     * vuelve: viven en la cuenta y en el enlace con la aplicacion, y de ahi los
     * saca el overlay. Sin volver a pedirlo, todo lo que lo lee --exportar, la
     * clave, el aviso de quitar el acceso-- seguiria diciendo el correo viejo.
     */
    if (isPeople) {
      void loadPeopleOverlay(table.app).then((found) => (overlay = found));
      // La lista de invitados la leen las celdas de persona de las demas
      // tablas. Sin releerla, la que acaba de nacer no esta en ella y su enlace
      // se pinta como roto.
      void builder.reloadPeople();
    }
    if (created) {
      // Al final y no al principio: la grilla ensena por antiguedad, y la fila
      // recien nacida es la ultima.
      rows = [...rows, saved];
      total += 1;
      // Puede que otras filas llevaran tiempo esperando justo a este registro.
      void checkWaiting(saved);
      return;
    }
    rows = rows.map((r) => (r.id === saved.id ? saved : r));
  }

  /**
   * Filas de otras tablas que esperaban al registro que acaba de nacer.
   *
   * Se ofrece enlazarlas, no se hace solo: son filas de otra tabla y quien
   * acaba de crear un registro no tiene por que estar pensando en ellas.
   */
  async function checkWaiting(saved: Row) {
    const found = await waitingFor({
      target: table,
      created: saved,
      tables,
      people: people.list,
    }).catch(() => []);
    if (found.length) waiting = found;
  }

  /*
   * Un archivo que se solto en el constructor y venia para esta tabla.
   *
   * Se recoge al pintarse y no al montarse: soltar un archivo de personas
   * estando ya en la tabla de personas no vuelve a montar nada, y el dialogo
   * tiene que abrirse igual.
   */
  $effect(() => {
    const file = takeImport(table.id);
    if (!file) return;
    importNote = null;
    importFile = file;
    importing = true;
  });

  /** Cuantas filas de otra tabla se miran para adivinar si nombran personas. */
  const GUESS_ROWS = 500;

  /**
   * Lo que se hace despues de importar personas.
   *
   * Tres cosas, en este orden: releer la lista de invitados, enlazar las filas
   * de otras tablas que llevaban esperando su valor, y mirar si alguna columna
   * de texto resulta estar nombrando personas.
   *
   * El enlazado va aqui y no dentro de la importacion, y de una sola pasada:
   * un archivo de doscientas personas haria doscientos barridos sobre las
   * mismas tablas. Y no se pregunta --a diferencia de crear una fila suelta--
   * porque una pregunta por valor convertiria una importacion en doscientos
   * dialogos. Ver `design.md` D8.
   */
  async function afterPeopleImport(note: ImportNote | undefined) {
    await builder.reloadPeople();
    const invited = people.list;
    const otras = tables.filter((t) => t.id !== table.id);

    const found = await waitingFor({
      target: table,
      created: invited.map(personAsRow),
      tables: otras,
      people: invited,
    }).catch(() => []);

    const linked = new Map<string, number>();
    for (const item of found) {
      await linkWaiting(item).catch(() => {});
      linked.set(item.table.label, (linked.get(item.table.label) ?? 0) + item.rows.length);
    }

    // Lo que sigue sin enlace se cuenta despues de enlazar, no antes: lo que se
    // dice es lo que queda por resolver, no lo que habia al empezar.
    const pending = new Map<string, number>();
    for (const other of otras) {
      const orphans = await loadOrphans(other).catch(() => []);
      const rows = pendingRows(orphans.filter((o) => o.field.relationTableId === table.id));
      if (rows > 0) pending.set(other.label, rows);
    }

    const entries = (counts: Map<string, number>) =>
      [...counts].map(([label, rows]) => ({ table: label, rows }));
    importNote = {
      ok: note?.ok ?? true,
      text: peopleImportNote({
        saved: note?.text ?? "",
        linked: entries(linked),
        pending: entries(pending),
      }),
    };

    /*
     * Y por ultimo, las columnas de texto que resultan nombrar personas. Se
     * miran despues de enlazar: una columna que ya es relacion no se propone, y
     * lo que se acaba de enlazar no cuenta como coincidencia pendiente.
     */
    const sample = new Map<string, Record<string, unknown>[]>();
    for (const other of otras) {
      const rows = await pb
        .collection(other.dataCollection)
        .getList<Record<string, unknown>>(1, GUESS_ROWS, { skipTotal: true })
        .catch(() => null);
      if (rows?.items.length) sample.set(other.id, rows.items);
    }
    const found2 = guessPersonFields({ tables: otras, all: tables, rows: sample, people: invited });
    if (found2.length) personColumns = found2;
  }

  /**
   * Convierte en relacion las columnas de texto que se aceptaron, y enlaza.
   *
   * Cambiar el tipo deja los valores en el corralito y la relacion vacia --el
   * servidor que cambia el tipo no sabe contra que emparejar una cedula escrita
   * a mano-- asi que enseguida se resuelven con la llave que ya declara la
   * columna. Ver `linkParkedValues`.
   */
  async function convertTextColumns(chosen: { column: PersonTextColumn; key: string }[]) {
    convertingColumns = true;
    error = "";
    try {
      let linked = 0;
      for (const { column, key } of chosen) {
        const fields = (column.table.fields ?? []).map((f) =>
          f.name === column.field.name
            ? { ...f, type: "relation" as const, relationTableId: table.id, displayField: key }
            : f,
        );
        const saved = await patch<TableRecord>(`/api/tables/${column.table.id}`, { fields });
        const field = saved.fields.find((f) => f.name === column.field.name);
        if (!field) continue;
        linked += await linkParkedValues({
          table: saved,
          tables,
          field,
          people: people.list,
        }).catch(() => 0);
      }
      personColumns = null;
      await onSchemaChange();
      const columnas = chosen.length === 1 ? "1 columna" : `${chosen.length} columnas`;
      importNote = {
        ok: true,
        text: `${columnas} ahora apunta${chosen.length === 1 ? "" : "n"} a "${table.label}". Quedaron enlazadas ${linked} fila${linked === 1 ? "" : "s"}.`,
      };
    } catch (err) {
      error = errorMessage(err);
    } finally {
      convertingColumns = false;
    }
  }

  /**
   * Abre el dialogo de borrado, con lo que se lleva por delante ya contado.
   *
   * En personas no se pregunta: quitar el acceso tiene su propio aviso, que
   * habla de la cuenta y no de las filas que la senalan.
   */
  async function askDelete() {
    deleteImpact = null;
    confirmDelete = true;
    if (isPeople) return;
    const ids = [...selected];
    deleteImpact = await post<DeleteImpact>(`/api/tables/${table.id}/filas/impacto`, {
      ids,
    }).catch(() => ({ cascade: [], keep: [] }));
  }

  /** Borra las filas seleccionadas y avisa si alguna falla. */
  async function confirmDeleteRows() {
    deleting = true;
    error = "";
    // Borrar no se deshace, y lo que se recordaba puede ser de una fila que se
    // va con el borrado.
    undoable = null;
    try {
      const ids = [...selected];
      let failed = 0;
      if (isPeople) {
        // Borrar la fila de alguien es borrarle la cuenta de esta aplicacion.
        // Lo que sepan de ella otras aplicaciones sigue en pie: alli tiene su
        // propia cuenta, que esta no toca.
        for (const id of ids) {
          try {
            const row = rows.find((r) => r.id === id);
            if (row) await removePersonRow(row, overlay);
          } catch {
            failed += 1;
          }
        }
      } else {
        /*
         * Por el servidor y no directo a la base: es lo que hace que la
         * conducta declarada en cada columna --conservar el valor o borrar
         * tambien-- sea una regla y no una costumbre de esta pantalla. Los
         * identificadores van juntos: un borrado en bloque es una peticion.
         */
        const res = await post<{ borradas: number; fallidas: number }>(
          `/api/tables/${table.id}/filas/borrar`,
          { ids },
        ).catch(() => null);
        failed = res ? res.fallidas : ids.length;
      }
      confirmDelete = false;
      const gone = ids.length - failed;
      selected = new Set();
      if (isPeople) await builder.reloadPeople();
      /*
       * Lo que fallo se cuenta aparte y no en `error`: la cuadricula se vuelve
       * a pedir igual --antes se salia con el aviso puesto y las filas que si
       * se borraron seguian a la vista, dando error a la siguiente orden-- y
       * volver a pedirlas limpia `error`, que es de la lectura.
       */
      deleteWarning = failed
        ? `No se pudieron borrar ${failed} fila${failed === 1 ? "" : "s"}.`
        : "";
      // Si la pagina quedo vacia, se vuelve a la anterior; el cambio de pagina
      // pide las filas por su cuenta.
      if (gone > 0 && rows.length - gone <= 0 && page > 1) page -= 1;
      else void load();
    } finally {
      deleting = false;
    }
  }

  /** Descarga o copia toda la tabla (las filas se piden en el momento). */
  async function exportAll(kind: "download" | "copy", format: ExportFormat) {
    error = "";
    const result = await exportAllRows({
      table,
      relationFields,
      isPeople,
      overlay,
      people: people.list,
      csvSeparator,
      kind,
      format,
    });
    if (result.warning !== undefined) exportWarning = result.warning;
    error = result.error;
  }

  const exportSelected = (kind: "download" | "copy", format: ExportFormat) =>
    void (async () => {
      error = "";
      const result = await exportSelectedRows({
        table,
        rows,
        selected,
        people: people.list,
        csvSeparator,
        kind,
        format,
      });
      if (result.warning !== undefined) exportWarning = result.warning;
      error = result.error;
    })();

  /** Cambia cuantas filas se muestran por pagina y lo recuerda en la tabla. */
  async function changePageSize(size: number | "all") {
    pageSize = size;
    page = 1;
    if (size === table.meta?.pageSize || (size === "all" && table.meta?.pageSize === 0)) return;
    try {
      await patch(`/api/tables/${table.id}`, {
        meta: { ...table.meta, pageSize: size === "all" ? 0 : size },
      });
      await onSchemaChange();
    } catch (err) {
      error = errorMessage(err);
    }
  }

  /** Aplica la cantidad escrita solo al dar Enter; mientras se escribe no recarga. */
  function commitPageSize() {
    const n = Math.round(Number(pageSizeText));
    if (Number.isFinite(n) && n > 0 && n !== pageSize) void changePageSize(n);
    else pageSizeText = String(pageSize);
  }

  const toggleHidden = (name: string) => toggleColumnHidden(table, name, onSchemaChange);

  /** Muestra u oculta una columna del sistema (id, created, updated). */
  const toggleSystemVisible = (name: string) =>
    toggleColumnSystemVisible(table, name, onSchemaChange);

  /** Como queda repartido el total. Con "todas" no hay paginas que contar. */
  const perPage = $derived(pageSize === "all" ? total : pageSize);
  const pageCount = $derived(perPage > 0 ? Math.ceil(total / perPage) : 1);
  const paged = $derived(pageSize !== "all" && total > pageSize);
  const pending = $derived(pendingRows(orphans));

  /** Por que columna se esta ordenando, dicho en el boton de la barra. */
  const sortLabel = $derived.by(() => {
    const by = sort;
    if (!by) return "Ordenar";
    return (
      table.fields.find((f) => f.name === by.field)?.label ??
      SYSTEM_COLUMN_LABELS[by.field] ??
      "Ordenar"
    );
  });

  /** Ordenar siempre devuelve a la primera pagina: lo de arriba cambio. */
  function applySort(next: Sort | null) {
    sort = next;
    page = 1;
  }

  /** Cambia el orden por esta columna, o le da la vuelta si ya era la suya. */
  const toggleSort = (name: string) =>
    applySort(
      sort?.field === name && sort.dir === "asc"
        ? { field: name, dir: "desc" }
        : { field: name, dir: "asc" },
    );

  /**
   * Una tecla en el buscador.
   *
   * Lo escrito se ve al momento; lo que espera es la consulta. Sin esta espera,
   * escribir "clientes" son ocho lecturas de la tabla --siete de ellas de algo
   * que ya no se esta buscando-- y ocho parpadeos del indicador de carga.
   */
  function typeSearch(value: string) {
    searchText = value;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchTimer = null;
      if (value === search) return;
      page = 1;
      search = value;
    }, SEARCH_DELAY);
  }

  /* Al irse la pantalla no queda ninguna tecla esperando a aplicarse. */
  $effect(() => () => {
    if (searchTimer) clearTimeout(searchTimer);
  });

  function clearSearch() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = null;
    searchText = "";
    search = "";
    page = 1;
  }

  /** La persona de la unica fila marcada, para el aviso de quitarle el acceso. */
  const removingName = $derived(
    selected.size === 1
      ? (overlay.get(String(rows.find((r) => selected.has(r.id))?.[MEMBER_FIELD] ?? ""))?.cuenta ??
          "Esta persona")
      : `${selected.size} personas`,
  );
</script>

<!--
  `@container`: los botones de la barra se quedan en iconos cuando la grilla es
  angosta, que es lo que pasa con el dock de la IA abierto. Se mide el ancho de
  la grilla, no el de la ventana.
-->
<div id="database-grid" class="grid-db @container flex h-full flex-col">
  <!-- Barra de herramientas -->
  <div id="database-grid-toolbar" class="toolbar-grid-db flex shrink-0 items-center gap-1">
    <div class="grid-db-table-id">
      <!--
        El icono de la tabla es tambien el indicador de carga: mientras llegan
        las filas lo releva un giro con el acento de la aplicacion, en su mismo
        hueco. Antes el indicador era un circulo que aparecia entre el contador
        y el buscador, y encenderlo empujaba la barra entera hacia la derecha a
        cada tecla. Esto no mueve nada: el hueco esta puesto y solo cambia lo
        que hay dentro.

        Es el mismo icono que la tabla tiene en el lateral, y por eso dice "la
        tabla" y no "la busqueda": el giro sale igual al ordenar, al paginar o
        al refrescar.
      -->
      <span class="grid-db-table-icon" aria-hidden="true">
        {#if spinning}
          <span class="spinner grid-db-table-spinner"></span>
        {:else}
          <Icon name={isPeople ? "user-multiple" : DEFAULT_TABLE_ICON} size={15} />
        {/if}
      </span>
      <!--
        El nombre es lo unico que cede espacio cuando la barra aprieta, pero
        nunca hasta desaparecer.
      -->
      <span class="grid-db-title" data-tip={table.label}>{table.label}</span>
      <!--
        Con filas marcadas, el contador cuenta la seleccion: es lo que esta
        pasando, y tocarlo la suelta.
      -->
      {#if selected.size > 0}
        <button
          type="button"
          onclick={() => (selected = new Set())}
          class="btn-clear-selection grid-db-selected-count"
        >
          {selected.size} seleccionada{selected.size === 1 ? "" : "s"}
          <Icon name="cancel-01" size={11} />
        </button>
      {:else}
        <!-- El total tambien esta en el pie: cuando la barra aprieta, se cuenta una vez. -->
        <span class="grid-db-total">
          {total}
          {total === 1 ? "fila" : "filas"}
        </span>
      {/if}
    </div>

    <span aria-hidden="true" class="grid-db-divider"></span>

    <div class="grid-db-search">
      <Icon name="search-01" size={13} class="grid-db-search-icon" />
      <input
        value={searchText}
        oninput={(e) => typeSearch(e.currentTarget.value)}
        placeholder="Buscar"
        aria-label="Buscar en la tabla"
        class="input-search-table field-control sm grid-db-search-input"
      />
      {#if searchText}
        <button
          type="button"
          onclick={clearSearch}
          aria-label="Quitar la busqueda"
          class="btn-clear-table-search grid-db-search-clear"
        >
          <Icon name="cancel-01" size={16} />
        </button>
      {/if}
    </div>

    <Dropdown>
      {#snippet trigger({ toggle })}
        <Button
          size="sm"
          variant="ghost"
          buttonClass="btn-open-sort-menu"
          onclick={toggle}
          tip={sort ? "Cambiar el orden" : "Ordenar"}
          class={cx("grid-db-sort-btn", sort && "grid-db-sort-active")}
        >
          <Icon name={sort?.dir === "desc" ? "arrow-down-az" : "arrow-up-az"} size={16} />
          <span class="grid-db-sort-label">{sortLabel}</span>
        </Button>
      {/snippet}
      {#snippet children(close)}
        <MenuLabel>Ordenar por</MenuLabel>
        {#each table.fields as f (f.name)}
          <MenuItem
            onclick={() => {
              toggleSort(f.name);
              close();
            }}
          >
            {#snippet icon()}<FieldIcon type={f.type} system={f.system} />{/snippet}
            {f.label}
          </MenuItem>
        {/each}
        {#if sort}
          <MenuSeparator />
          <MenuItem
            onclick={() => {
              applySort(null);
              close();
            }}
          >
            {#snippet icon()}<Icon name="cancel-01" size={14} />{/snippet}
            Quitar orden
          </MenuItem>
        {/if}
      {/snippet}
    </Dropdown>

    <Dropdown>
      {#snippet trigger({ toggle })}
        <Button
          size="sm"
          variant="ghost"
          buttonClass="btn-open-columns-menu"
          onclick={toggle}
          tip="Mostrar u ocultar columnas"
          class="grid-db-tool-action"
        >
          <Icon name="eye-off" size={16} />
          <span class="grid-db-columns-label">
            {hidden.length ? `${hidden.length} ocultas` : "Columnas"}
          </span>
        </Button>
      {/snippet}
      {#snippet children(_close)}
        <MenuLabel>Mostrar columnas</MenuLabel>
        {#each SYSTEM_COLUMNS as name (name)}
          <button
            type="button"
            onclick={() => toggleSystemVisible(name)}
            class="btn-toggle-system-column grid-db-toggle-column choice flex w-full items-center text-left"
          >
            <input
              type="checkbox"
              readonly
              checked={(table.meta?.systemVisible ?? []).includes(name)}
              class="checkbox-toggle-system-column-visible"
            />
            <i class="choice-box ico-nudge hgi-stroke hgi-tick-02" aria-hidden="true"></i>
            <span class="grid-db-toggle-label">{SYSTEM_COLUMN_LABELS[name]}</span>
          </button>
        {/each}
        <MenuSeparator />
        {#each table.fields as f (f.name)}
          <button
            type="button"
            onclick={() => toggleHidden(f.name)}
            class="btn-toggle-column-visibility grid-db-toggle-column choice flex w-full items-center text-left"
          >
            <input
              type="checkbox"
              readonly
              checked={!hidden.includes(f.name)}
              class="checkbox-toggle-column-visibility"
            />
            <i class="choice-box ico-nudge hgi-stroke hgi-tick-02" aria-hidden="true"></i>
            <FieldIcon type={f.type} system={f.system} class="grid-db-toggle-field-icon" />
            <span class="grid-db-toggle-name">{f.label}</span>
            {#if f.required}<span class="grid-db-toggle-required">*</span>{/if}
          </button>
        {/each}
      {/snippet}
    </Dropdown>

    <Button
      size="sm"
      variant="ghost"
      buttonClass="btn-add-column"
      onclick={() => (columnModal = {})}
      tip="Añadir una columna"
      class="grid-db-tool-action"
    >
      <Icon name="plus" size={16} />
      <span class="grid-db-add-column-label">Añadir columna</span>
    </Button>

    <!--
      Traer lo de fuera sin recargar el sitio: columnas, filas y enlaces sin
      dueno. La etiqueta se esconde cuando la barra aprieta, como las demas, y
      mientras trabaja gira, que es lo que hace `loading` en el sistema.
    -->
    <Button
      size="sm"
      variant="ghost"
      buttonClass="btn-refresh-table"
      onclick={refresh}
      loading={refreshing}
      tip="Refrescar los datos"
      aria-label="Refrescar los datos"
      class="grid-db-tool-action"
    >
      <Icon name="arrow-reload-horizontal" size={16} />
      <span class="grid-db-refresh-label">Refrescar</span>
    </Button>

    <!--
      La puerta a los roles. Solo desde la tabla de personas: es la unica que
      tiene algo que decir sobre los nombres, y no hay otra pantalla donde se
      creen.
    -->
    {#if isPeople}
      <Button
        size="sm"
        variant="ghost"
        buttonClass="btn-open-roles"
        onclick={() => (rolesOpen = true)}
        tip="Gestionar los roles"
        class="grid-db-tool-action"
      >
        <Icon name={ROLE_ICON} size={16} />
        <span class="grid-db-roles-label">Roles</span>
      </Button>
    {/if}

    <!--
      Deshacer la ultima escritura hecha desde la cuadricula. Solo esta cuando
      hay algo que deshacer: es la unica accion de la barra que aparece por algo
      que se acaba de hacer, y verla salir es parte de decir que se puede.
    -->
    {#if canUndo}
      <Button
        size="sm"
        variant="ghost"
        buttonClass="btn-undo-write"
        disabled={writing}
        onclick={() => void undoLast()}
        tip="Deshacer lo último que se escribió"
        aria-label="Deshacer lo último que se escribió"
        class="grid-db-tool-action"
      >
        <Icon name="undo-02" size={16} />
        <span class="grid-db-undo-label">Deshacer</span>
      </Button>
    {/if}

    <div class="grid-db-spacer"></div>

    <Dropdown align="right">
      {#snippet trigger({ toggle })}
        <Button
          size="sm"
          variant="ghost"
          buttonClass="btn-open-export-menu"
          onclick={toggle}
          tip="Exportar la tabla"
          class="grid-db-tool-action"
        >
          <Icon name="upload-01" size={16} />
          <span class="grid-db-export-label">Exportar</span>
        </Button>
      {/snippet}
      {#snippet children(close)}
        <MenuLabel>Separador del CSV</MenuLabel>
        <div class="item-csv-separator">
          <div class="join group-csv-separator">
            {#each [";", ","] as sep (sep)}
              <button
                type="button"
                onclick={() => (csvSeparator = sep)}
                class={cx("btn-pick-csv-separator", "btn", csvSeparator === sep && "btn-primary")}
              >
                {sep === ";" ? "Punto y coma" : "Coma"}
              </button>
            {/each}
          </div>
        </div>
        <MenuSeparator />
        <MenuItem
          onclick={() => {
            close();
            void exportAll("download", "csv");
          }}
        >
          {#snippet icon()}<Icon name="download-01" size={14} />{/snippet}
          Descargar CSV
        </MenuItem>
        <MenuItem
          onclick={() => {
            close();
            void exportAll("copy", "csv");
          }}
        >
          {#snippet icon()}<Icon name="clipboard-copy" size={14} />{/snippet}
          Copiar CSV
        </MenuItem>
        <MenuItem
          onclick={() => {
            close();
            void exportAll("download", "excel");
          }}
        >
          {#snippet icon()}<Icon name="download-01" size={14} />{/snippet}
          Descargar Excel
        </MenuItem>
        <MenuItem
          onclick={() => {
            close();
            void exportAll("download", "json");
          }}
        >
          {#snippet icon()}<Icon name="download-01" size={14} />{/snippet}
          Descargar JSON
        </MenuItem>
        <MenuItem
          onclick={() => {
            close();
            void exportAll("copy", "json");
          }}
        >
          {#snippet icon()}<Icon name="clipboard-copy" size={14} />{/snippet}
          Copiar JSON
        </MenuItem>

        {#if selected.size > 0}
          <MenuSeparator />
          <MenuLabel>
            Seleccionadas ({selected.size} fila{selected.size === 1 ? "" : "s"})
          </MenuLabel>
          <MenuItem
            onclick={() => {
              close();
              exportSelected("download", "csv");
            }}
          >
            {#snippet icon()}<Icon name="download-01" size={14} />{/snippet}
            Descargar CSV
          </MenuItem>
          <MenuItem
            onclick={() => {
              close();
              exportSelected("copy", "csv");
            }}
          >
            {#snippet icon()}<Icon name="clipboard-copy" size={14} />{/snippet}
            Copiar CSV
          </MenuItem>
          <MenuItem
            onclick={() => {
              close();
              exportSelected("download", "excel");
            }}
          >
            {#snippet icon()}<Icon name="download-01" size={14} />{/snippet}
            Descargar Excel
          </MenuItem>
          <MenuItem
            onclick={() => {
              close();
              exportSelected("download", "json");
            }}
          >
            {#snippet icon()}<Icon name="download-01" size={14} />{/snippet}
            Descargar JSON
          </MenuItem>
          <MenuItem
            onclick={() => {
              close();
              exportSelected("copy", "json");
            }}
          >
            {#snippet icon()}<Icon name="clipboard-copy" size={14} />{/snippet}
            Copiar JSON
          </MenuItem>
        {/if}
      {/snippet}
    </Dropdown>

    <Button
      size="sm"
      variant="ghost"
      buttonClass="btn-import-rows"
      onclick={() => {
        // El resumen anterior estorba: quien vuelve a importar lo leeria como
        // si fuera el de la importacion que esta empezando.
        importNote = null;
        importing = true;
      }}
      tip="Importar filas"
      class="grid-db-tool-action"
    >
      <Icon name="download-01" size={16} />
      <span class="grid-db-import-label">Importar</span>
    </Button>

    {#if selected.size > 0}
      <Button
        size="sm"
        variant="danger"
        onclick={() => void askDelete()}
        tip={`Borrar ${selected.size} fila${selected.size === 1 ? "" : "s"}`}
        class="grid-db-tool-action"
      >
        <Icon name="trash" size={16} />
        <span class="grid-db-delete-label">Borrar ({selected.size})</span>
      </Button>
    {/if}

    <!--
      El recuento de lo que falta por enlazar. Se ensena solo cuando hay algo que
      resolver, y en neutro: no es una averia.
    -->
    {#if pending > 0}
      <Button
        size="sm"
        buttonClass="btn-orphans-toolbar"
        variant={onlyOrphans ? "secondary" : undefined}
        onclick={() => {
          onlyOrphans = !onlyOrphans;
          page = 1;
        }}
        tip={onlyOrphans
          ? "Volver a ver todas las filas"
          : "Ver solo las filas cuyo valor no encontro registro"}
        class="grid-db-tool-action"
      >
        <Icon name="unlink-01" size={16} />
        <span class="grid-db-orphans-long">Sin enlace ({pending})</span>
        <span class="grid-db-orphans-short">{pending}</span>
      </Button>
    {/if}

    <Button
      size="sm"
      variant="secondary"
      buttonClass="btn-add-row-toolbar"
      onclick={addRow}
      tip="Añadir una fila"
      class="grid-db-tool-action"
    >
      <Icon name="plus" size={16} />
      <span class="grid-db-new-row-label">Nueva fila</span>
    </Button>
  </div>

  <!--
    Los avisos no se dibujan aqui: `Note` los manda a la capa de `Toast`, arriba
    a la derecha. Lo que quedaba en su sitio era la caja vacia que los envolvia,
    con su acolchado empujando la cuadricula hacia abajo sin nada dentro.
  -->
  {#if error}
    <ErrorNote message={error} />
  {/if}

  {#if deleteWarning}
    <WarnNote message={deleteWarning} />
  {/if}

  {#if exportWarning}
    <WarnNote message={exportWarning} />
  {/if}

  {#if importNote}
    {#if importNote.ok}
      <SuccessNote message={importNote.text} />
    {:else}
      <WarnNote message={importNote.text} />
    {/if}
  {/if}

  {#if editNote}
    {#if editNote.ok}
      <SuccessNote message={editNote.text} />
    {:else}
      <WarnNote message={editNote.text} />
    {/if}
  {/if}

  {#if onlyOrphans}
    <div class="grid-db-orphans-banner flex items-center gap-2">
      <span>Solo las filas cuyo valor todavía no encontró registro.</span>
      <button
        type="button"
        class="btn-open-orphans link grid-db-orphans-link"
        onclick={() => (seeOrphans = true)}
      >
        Ver los valores y resolverlos
      </button>
    </div>
  {/if}

  <!-- Grilla -->
  <div
    id="database-grid-table-wrap"
    aria-busy={loading}
    class={cx(
      "table-grid-db flex-1",
      /*
       * `isolate`: la cuadricula apila tres cosas por dentro --celda fija,
       * cabecera y esquina-- y sus numeros no tienen por que discutir con los de
       * fuera. Aislada, ese orden es asunto suyo y la cuadricula entera ocupa un
       * solo peldano. Ver la escala en `styles/global.css`.
       */
      "isolate",
      loading && rows.length > 0 && "grid-db-grid-loading",
    )}
  >
    {#if loading && rows.length === 0}
      <Loading />
    {:else}
      <!--
        `role="grid"` y `tabindex`: la tabla recibe el foco al pulsar una celda,
        y con el le llegan las teclas y el portapapeles. Sin foco propio, copiar
        y pegar irian al documento y habria que escucharlos en la ventana,
        quitandoselos al cajon lateral y a los dialogos.
      -->
      <table
        bind:this={gridBox}
        role="grid"
        tabindex="-1"
        onkeydown={gridKeys}
        oncopy={copyRange}
        onpaste={pasteIntoGrid}
        class="grid-db-table table"
      >
        <!--
          Por encima de las celdas pegajosas del cuerpo (z-10): los menus de cada
          columna se abren sobre las filas, no debajo.
        -->
        <thead class="grid-db-head">
          <tr>
            <th class="grid-db-checkbox-cell">
              <label class="choice grid-db-choice">
                <input
                  bind:this={selectAll}
                  type="checkbox"
                  checked={selected.size > 0 && selected.size === rows.length}
                  onchange={toggleAll}
                  aria-label="Seleccionar todas las filas visibles"
                  class="checkbox-select-all-rows"
                />
                <i class="choice-box ico-nudge hgi-stroke hgi-tick-02" aria-hidden="true"></i>
              </label>
            </th>
            <th class="grid-db-expand-cell"><span class="sr-only">Abrir la fila</span></th>
            {#each visible as field (field.name)}
              <ColumnHead
                {field}
                {sort}
                width={widthOf(field.name)}
                onResize={(w, done) => void resizeColumn(field.name, w, done)}
                onSort={applySort}
                onEdit={isSystem(field.name) ||
                field.system !== undefined ||
                isPeopleNameField(table, field)
                  ? undefined
                  : () => (columnModal = { field })}
                onHide={() =>
                  isSystem(field.name) ? toggleSystemVisible(field.name) : toggleHidden(field.name)}
                onRoles={field.system === "roles" ? () => (rolesOpen = true) : undefined}
              />
            {/each}
          </tr>
        </thead>

        <tbody>
          {#each rows as row, rowIndex (row.id)}
            <!--
              La fila marcada se pinta con el lavado opaco: las celdas pegajosas
              se desplazan por encima de las otras y con un color translucido se
              veria lo que pasa por debajo.
            -->
            {@const marked = selected.has(row.id)}
            {@const cell = cx(
              "grid-db-data-cell",
              marked ? "grid-db-data-cell-marked" : "grid-db-data-cell-idle",
            )}
            <tr class="group">
              <td class={cx(cell, "grid-db-checkbox-data")}>
                <label class="choice grid-db-choice">
                  <input
                    type="checkbox"
                    checked={marked}
                    onchange={() => toggleRow(row.id)}
                    aria-label="Seleccionar fila"
                    class="checkbox-select-row"
                  />
                  <i class="choice-box ico-nudge hgi-stroke hgi-tick-02" aria-hidden="true"></i>
                </label>
              </td>

              <!--
                La fila se abre desde su propia columna y no desde cualquier
                celda: el clic sobre una celda ahora la elige, que es lo que
                hace falta para escribir, copiar y pegar por rangos.
              -->
              <td class={cx(cell, "grid-db-expand-data")}>
                <button
                  type="button"
                  onclick={() => (openRow = { row })}
                  data-tip="Abrir la fila"
                  aria-label="Abrir la fila"
                  class="btn-open-row grid-db-expand-btn btn-icon btn-ghost btn-rounded"
                >
                  <Icon name="edit-03" size={18} />
                </button>
              </td>

              {#each visible as field, col (field.name)}
                <GridCell
                  {field}
                  {row}
                  {tables}
                  {marked}
                  selected={selection.has(rowIndex, col)}
                  active={selection.active?.row === rowIndex && selection.active?.col === col}
                  edges={selection.edges(rowIndex, col)}
                  editing={editing?.row === rowIndex && editing?.col === col}
                  seed={editing?.row === rowIndex && editing?.col === col
                    ? editing.seed
                    : undefined}
                  width={widthOf(field.name)}
                  editable={inlineEditable(table, field)}
                  reason={notEditableReason(table, field)}
                  saving={writing &&
                    selection.active?.row === rowIndex &&
                    selection.active?.col === col}
                  onDown={(e) => cellDown(rowIndex, col, e)}
                  onOver={() => cellOver(rowIndex, col)}
                  onEdit={() => void startEdit({ row: rowIndex, col })}
                  onCommit={(value) => void commitCell(value)}
                  onCancel={closeEdit}
                />
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    {#if !loading && rows.length === 0}
      {#if search}
        <EmptyState
          title="Ninguna fila coincide"
          description={`No hay filas que digan "${search.trim()}" en esta tabla.`}
        >
          {#snippet icon()}<Icon name="search-x" size={20} />{/snippet}
          {#snippet action()}
            <Button size="sm" onclick={clearSearch}>Quitar la busqueda</Button>
          {/snippet}
        </EmptyState>
      {:else if table.fields.length === 0}
        <!--
          Una tabla recien creada no tiene ni una columna, asi que lo primero no
          es una fila --seria una fila sin nada que escribir-- sino decir que
          guarda la tabla. El mismo dialogo que abre "Añadir columna" de la
          barra, puesto donde se esta mirando.
        -->
        <EmptyState
          title="Esta tabla no tiene columnas"
          description="Di qué guarda: crea la primera columna, o importa un archivo y se crean con él."
        >
          {#snippet icon()}<Icon name="table" size={20} />{/snippet}
          {#snippet action()}
            <Button size="sm" variant="secondary" onclick={() => (columnModal = {})}>
              <Icon name="plus" size={14} /> Primera columna
            </Button>
          {/snippet}
        </EmptyState>
      {:else}
        <EmptyState
          title="La tabla está vacía"
          description="Añade la primera fila o crea las columnas que necesites."
        >
          {#snippet icon()}<Icon name="list-filter" size={20} />{/snippet}
          {#snippet action()}
            <Button size="sm" variant="secondary" onclick={addRow}>
              <Icon name="plus" size={14} /> Nueva fila
            </Button>
          {/snippet}
        </EmptyState>
      {/if}
    {/if}
  </div>

  <!-- Pie de la grilla: paginado y filas por pagina -->
  {#if total > 0}
    <div id="database-grid-pagination" class="pagination-grid-db flex shrink-0 items-center gap-2">
      <!-- Que se esta viendo, a la izquierda: se lee antes de mover nada. -->
      <span class="grid-db-page-text">
        {paged
          ? `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} de ${total}`
          : `${total} ${total === 1 ? "fila" : "filas"}`}
      </span>

      <div class="grid-db-spacer"></div>

      {#if paged}
        <Button size="sm" disabled={page === 1} onclick={() => (page -= 1)}>Anterior</Button>
        <span class="grid-db-page-current">{page} / {pageCount}</span>
        <Button size="sm" disabled={page >= pageCount} onclick={() => (page += 1)}>
          Siguiente
        </Button>
        <span aria-hidden="true" class="grid-db-page-divider"></span>
      {/if}

      <span class="grid-db-page-size-label">Filas por página</span>
      {#if pageSize === "all"}
        <Button
          size="sm"
          variant="secondary"
          buttonClass="btn-reset-page-size"
          onclick={() => void changePageSize(DEFAULT_PAGE_SIZE)}
        >
          Todas · volver a {DEFAULT_PAGE_SIZE}
        </Button>
      {:else}
        <InputPicker
          type="number"
          min="1"
          value={pageSizeText}
          options={PAGE_SIZES}
          onPick={(v) => {
            pageSizeText = v;
            void changePageSize(Number(v));
          }}
          oninput={(e) => (pageSizeText = e.currentTarget.value)}
          onkeydown={(e) => {
            if (e.key === "Enter") commitPageSize();
          }}
          onblur={() => (pageSizeText = String(pageSize))}
          aria-label="Filas por página"
          wrapClass="grid-db-page-size-wrap"
          class="input-page-size sm grid-db-page-size-input"
        />
        <Button
          size="sm"
          variant="ghost"
          buttonClass="btn-show-all-rows"
          onclick={() => void changePageSize("all")}
        >
          Todas
        </Button>
      {/if}
    </div>
  {/if}

  <RolesModal open={rolesOpen} onClose={() => (rolesOpen = false)} />

  <!--
    Lo pegado trae mas filas de las que hay. Se pregunta antes de escribir nada:
    crear filas no tiene vuelta atras, y recortar en silencio perderia datos que
    quien pega da por puestos. La tabla de personas no llega hasta aqui --una
    fila suya es una cuenta invitada, y eso lo hace el servidor--.
  -->
  <Modal
    open={!!pasteAsk}
    onClose={() => (pasteAsk = null)}
    title="Lo pegado no cabe"
    class="modal-paste-overflow"
  >
    {#if pasteAsk}
      <p class="grid-db-paste-message">
        Se pegan {pasteAsk.matrix.length} filas y desde aquí hay {pasteAsk.fit.fits}.
        {pasteAsk.fit.extra === 1 ? "Sobra 1 fila" : `Sobran ${pasteAsk.fit.extra} filas`}.
      </p>
    {/if}
    {#snippet footer()}
      <Button onclick={() => (pasteAsk = null)}>Cancelar</Button>
      <Button onclick={() => pasteAsk && void runPaste(pasteAsk.start, pasteAsk.matrix, false)}>
        Solo las que caben
      </Button>
      <Button
        variant="secondary"
        onclick={() => pasteAsk && void runPaste(pasteAsk.start, pasteAsk.matrix, true)}
      >
        Crear {pasteAsk?.fit.extra ?? 0} filas
      </Button>
    {/snippet}
  </Modal>

  {#if columnModal}
    <ColumnModal
      {table}
      {tables}
      field={columnModal.field}
      onClose={() => (columnModal = null)}
      onSaved={async () => {
        columnModal = null;
        await onSchemaChange();
        await load();
      }}
    />
  {/if}

  {#if waiting}
    {@const pendingWaiting = waiting}
    <ConfirmDialog
      open
      onClose={() => (waiting = null)}
      title="Habia filas esperando este registro"
      confirmLabel="Enlazarlas"
      onConfirm={() => {
        // La lista se copia antes de cerrar: `pendingWaiting` sale de `waiting`,
        // que es estado, y vaciarlo la dejaria en nada antes de recorrerla.
        const items = pendingWaiting;
        waiting = null;
        void (async () => {
          for (const item of items) await linkWaiting(item);
          await load();
          orphans = await loadOrphans(table);
        })();
      }}
    >
      {#snippet message()}
        {#each pendingWaiting as item (`${item.table.id}:${item.field.name}`)}
          <span class="confirm-waiting-line block">
            {item.rows.length}
            {item.rows.length === 1 ? "fila" : "filas"} de "{item.table.label}" llevan "{item.value}"
            en {item.field.label} sin enlazar.
          </span>
        {/each}
        <span class="confirm-waiting-ask block">Enlazarlas a este registro ahora?</span>
      {/snippet}
    </ConfirmDialog>
  {/if}

  {#if seeOrphans}
    <OrphanPanel
      {table}
      {tables}
      people={people.list}
      onClose={() => (seeOrphans = false)}
      onChanged={async () => {
        // Enlazar valores sueltos escribe filas por otra puerta.
        undoable = null;
        await load();
        await onSchemaChange();
        orphans = await loadOrphans(table);
      }}
    />
  {/if}

  {#if importing}
    <ImportModal
      {table}
      {tables}
      initialFile={importFile}
      onClose={() => {
        importing = false;
        importFile = null;
      }}
      onDone={async (note) => {
        page = 1;
        // Una importacion no se deshace desde aqui, y puede haber escrito sobre
        // las mismas filas.
        undoable = null;
        await load();
        await onSchemaChange();
        // Importar personas no termina al guardarlas: hay filas de otras tablas
        // esperando justo a esa gente, y ese parte va en el mismo aviso.
        if (isPeople) await afterPeopleImport(note);
        else if (note) importNote = note;
      }}
    />
  {/if}

  {#if personColumns}
    <PersonColumnOffer
      columns={personColumns}
      busy={convertingColumns}
      onCancel={() => (personColumns = null)}
      onConfirm={(chosen) => void convertTextColumns(chosen)}
    />
  {/if}

  <ConfirmDialog
    open={confirmDelete}
    onClose={() => {
      if (!deleting) confirmDelete = false;
    }}
    title={isPeople ? "Quitar el acceso" : "Borrar filas"}
    message={isPeople
      ? // Se dice antes de confirmar y no despues: con la cuenta no pasa nada,
        // pero lo que esta aplicacion supiera de esa persona se va y no vuelve.
        removeWarning(removingName, table.fields.filter((f) => f.system === undefined).length)
      : // Mientras se cuenta se dice lo minimo cierto: el recuento llega en un
        // parpadeo, y ensenar ceros que despues cambian es peor que esperar.
        deleteImpact
        ? deleteRowsWarning(selected.size, deleteImpact)
        : `Se van a borrar ${selected.size} fila${selected.size === 1 ? "" : "s"}.`}
    busy={deleting}
    onConfirm={() => void confirmDeleteRows()}
  />

  <RowDrawer
    open={openRow !== null}
    {table}
    {tables}
    row={openRow?.row ?? null}
    onClose={() => (openRow = null)}
    onSaved={rowSaved}
    saveRow={isPeople
      ? // En personas cada dato va por su camino: el correo a la cuenta comun,
        // el nivel y los roles al enlace con la aplicacion, y lo demas a la
        // coleccion de la aplicacion como en cualquier tabla.
        (opts) =>
          savePersonRow({
            appId: table.app,
            table,
            overlay,
            row: opts.row,
            values: opts.values,
          })
      : undefined}
  >
    <!--
      La clave no es una columna: se pone desde la fila de la persona, se ensena
      una vez y no se puede volver a leer.
    -->
    {#snippet extra(values)}
      {#if isPeople && openRow?.row}
        {@const person = overlay.get(String(openRow.row[MEMBER_FIELD] ?? ""))}
        {#if person}
          <!--
            El correo que hay escrito ahora mismo, aunque todavia no se haya
            guardado: es la persona a la que se le va a dar la clave.
          -->
          {@const written = String(values[emailColumn] ?? "").trim()}
          <PasswordBlock accessId={person.accessId} email={written || person.cuenta} />
        {/if}
      {/if}
    {/snippet}
  </RowDrawer>
</div>

<style>
  /* -------------------------------------------------- */
  /* la cuadricula entera                                */
  /* -------------------------------------------------- */

  .grid-db {
    container-type: inline-size;
  }

  /* -------------------------------------------------- */
  /* la barra de herramientas                           */
  /* -------------------------------------------------- */

  .toolbar-grid-db {
    height: 2.75rem;
    padding: 0 var(--sp-12);

    & .grid-db-table-id {
      display: flex;
      min-width: 0;
      align-items: center;
      gap: var(--sp-8);

      & .grid-db-title {
        min-width: 4rem;
        flex-shrink: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: var(--text-sm);
        line-height: var(--text-sm--line-height);
        font-weight: 500;
        color: var(--text-primary);
      }

      & .grid-db-selected-count {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        gap: var(--sp-4);
        border: 0;
        border-radius: var(--radius-sm);
        padding: 0.125rem 0.375rem;
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        color: var(--accent-soft-text);
        background: color-mix(in oklab, var(--accent) 10%, var(--bg-level2));
        transition: background-color 150ms;

        &:hover {
          background: color-mix(in oklab, var(--accent) 20%, var(--bg-level2));
        }
      }

      & .grid-db-total {
        flex-shrink: 0;
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        font-variant-numeric: tabular-nums;
        color: var(--text-muted);
      }
    }

    /*
     * El hueco del icono es fijo y no lo decide lo que hay dentro: icono y giro
     * miden lo mismo, asi que el relevo no corre ni un pixel de la barra.
     */
    & .grid-db-table-icon {
      display: grid;
      height: 1rem;
      width: 1rem;
      flex-shrink: 0;
      place-items: center;
      color: var(--text-muted);
    }

    & .grid-db-table-spinner {
      height: 0.875rem;
      width: 0.875rem;
      border-width: 2px;
      /* Entero del color de la aplicacion: el aro tenue y la cabeza plena. */
      border-color: color-mix(in srgb, var(--accent) 25%, transparent);
      border-top-color: var(--accent);
    }

    & .grid-db-divider {
      height: 1rem;
      width: 1px;
      flex-shrink: 0;
      margin: 0 var(--sp-6);
      background: var(--border);
    }

    & .grid-db-search {
      position: relative;
      flex-shrink: 0;

      & :global(.grid-db-search-icon) {
        position: absolute;
        left: 0.5rem;
        top: 50%;
        z-index: 10;
        translate: 0 -50%;
        pointer-events: none;
        color: var(--text-muted);
      }

      & .grid-db-search-input {
        height: 1.75rem;
        width: 6rem;
        padding: var(--sp-4) var(--sp-24) var(--sp-4) var(--sp-28);
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);

        @container (min-width: 50rem) {
          width: 8rem;
        }
        @container (min-width: 144rem) {
          width: 11rem;
        }
      }

      & :global(.grid-db-search-clear) {
        position: absolute;
        right: 0.25rem;
        top: 50%;
        z-index: 10;
        translate: 0 -50%;
        border-radius: calc(var(--radius-sm) / 2);
        padding: 0.125rem;
        color: var(--text-muted);
        transition: color 150ms;

        &:hover {
          color: var(--text-primary);
        }
      }
    }

    /* Los botones de la barra llegan al Button (un componente). */
    & :global(.grid-db-tool-action) {
      flex-shrink: 0;
    }

    & :global(.grid-db-sort-btn) {
      flex-shrink: 0;

      &:global(.grid-db-sort-active) {
        color: var(--accent-soft-text);
      }
    }

    & :global(.grid-db-sort-label),
    & :global(.grid-db-columns-label),
    & :global(.grid-db-add-column-label),
    & :global(.grid-db-refresh-label),
    & :global(.grid-db-roles-label),
    & :global(.grid-db-undo-label),
    & :global(.grid-db-export-label),
    & :global(.grid-db-import-label),
    & :global(.grid-db-delete-label),
    & :global(.grid-db-orphans-long),
    & :global(.grid-db-new-row-label) {
      display: none;

      @container (min-width: 64rem) {
        display: inline;
      }
    }

    & :global(.grid-db-orphans-long) {
      @container (min-width: 32rem) {
        display: inline;
      }
    }

    & :global(.grid-db-orphans-short) {
      display: inline;

      @container (min-width: 32rem) {
        display: none;
      }
    }

    & .grid-db-spacer {
      min-width: 0.5rem;
      flex: 1 1 0%;
    }
  }

  /* Las opciones de mostrar columnas dentro del menu. */
  .grid-db-toggle-column {
    gap: var(--sp-10);
    border-radius: var(--radius-sm);
    padding: var(--sp-6) var(--sp-10);
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
    color: var(--text-primary);

    & :global(.grid-db-toggle-field-icon) {
      color: var(--text-muted);
    }

    & .grid-db-toggle-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    & .grid-db-toggle-required {
      color: var(--accent-soft-text);
    }

    & .grid-db-toggle-label {
      color: var(--text-muted);
    }
  }

  .grid-db-orphans-banner {
    padding: var(--sp-12);
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-secondary);

    & .grid-db-orphans-link {
      color: var(--accent-soft-text);
    }
  }

  /* -------------------------------------------------- */
  /* la cuadricula                                       */
  /* -------------------------------------------------- */

  .table-grid-db {
    min-height: 0;
    overflow: auto;
    background: var(--bg-level1);
    transition: opacity 150ms;

    &.grid-db-grid-loading {
      opacity: 0.5;
    }

    & .grid-db-table {
      width: max-content;
      min-width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: var(--text-sm);
      line-height: var(--text-sm--line-height);
      background-color: var(--bg-card);

      &:focus-visible {
        outline: 0px solid transparent;
      }
    }

    & .grid-db-head {
      position: sticky;
      top: 0;
      z-index: 20;
    }

    & .grid-db-checkbox-cell {
      position: sticky;
      left: 0;
      z-index: 30;
      width: 2.5rem;
      padding: var(--sp-8);
      text-align: center;
      background-color: color-mix(in srgb, var(--bg-level1) 97%, var(--text-primary));
    }

    /*
      Solo viste las dos columnas fijas: las de datos las dibuja `GridCell`, que
      lleva las mismas medidas en su propia hoja porque el CSS de un componente
      no alcanza al marcado de otro.
    */
    & .grid-db-data-cell {
      height: 2.25rem;
      vertical-align: middle;

      &.grid-db-data-cell-marked {
        background: color-mix(in oklab, var(--text-primary) 4%, transparent);
      }
    }

    & tr:hover > .grid-db-data-cell-idle {
      background: var(--bg-hover);
    }

    & .grid-db-checkbox-data {
      position: sticky;
      left: 0;
      z-index: 10;
      padding: 0 var(--sp-8);
      text-align: center;
    }

    /*
      La columna que abre la fila. Va fija junto a la casilla: es lo que
      sustituye al clic sobre cualquier celda, que ahora elige en vez de abrir,
      y desplazandose a lo ancho tiene que seguir estando donde se la busca.
    */
    & .grid-db-expand-cell {
      position: sticky;
      left: 2.5rem;
      z-index: 30;
      width: 2rem;
      background-color: color-mix(in srgb, var(--bg-level1) 97%, var(--text-primary));
    }

    & .grid-db-expand-data {
      position: sticky;
      left: 2.5rem;
      z-index: 10;
      width: 2rem;
      padding: 0;
      text-align: center;
    }

    & .grid-db-expand-btn {
      display: inline-flex;
      height: 1.5rem;
      width: 1.5rem;
      cursor: pointer;
      align-items: center;
      justify-content: center;
      background-color: transparent;

      /* Se ve al pasar por la fila; con el teclado, siempre que reciba el foco. */
      opacity: 0;

      &:focus-visible {
        opacity: 1;
      }

      &:hover {
        color: var(--text-primary);
      }
    }

    & .group:hover .grid-db-expand-btn {
      opacity: 1;
    }
  }

  .grid-db-paste-message {
    color: var(--text-secondary);
  }

  /* -------------------------------------------------- */
  /* el pie de pagina                                    */
  /* -------------------------------------------------- */

  .pagination-grid-db {
    height: 2.5rem;
    border-top: var(--border-width) solid var(--border);

    padding: 0 var(--sp-12);
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-secondary);

    & .grid-db-page-text,
    & .grid-db-page-current {
      font-variant-numeric: tabular-nums;
    }

    & .grid-db-spacer {
      min-width: 0.5rem;
      flex: 1 1 0%;
    }

    & .grid-db-page-divider {
      height: 1rem;
      width: 1px;
      margin: 0 var(--sp-4);
      background: var(--border);
    }

    & .grid-db-page-size-label {
      display: none;

      @container (min-width: 32rem) {
        display: inline;
      }
    }

    & :global(.grid-db-page-size-wrap) {
      width: 6rem;
    }

    & :global(.grid-db-page-size-input) {
      height: 1.75rem;
      width: 100%;
      padding-left: var(--sp-8);
      padding-top: var(--sp-4);
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      font-variant-numeric: tabular-nums;
    }
  }

  /* -------------------------------------------------- */
  /* el menu de exportar: elegir separador del CSV       */
  /* -------------------------------------------------- */

  .item-csv-separator {
    padding: var(--sp-6) var(--sp-10);
  }

  .group-csv-separator {
    gap: 0;
    padding-left: 0;

    &:hover {
      background-color: transparent;
    }
  }

  .btn-pick-csv-separator {
    height: 1.75rem;
    min-height: 1.75rem;
    padding-inline: var(--sp-10);
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
  }

  /* -------------------------------------------------- */
  /* el dialogo de filas que esperaban este registro     */
  /* -------------------------------------------------- */

  .confirm-waiting-ask {
    margin-top: var(--sp-8);
  }

  :global(.btn-orphans-toolbar) {
    color: var(--warning);
    background: var(--warning-bg);
  }
</style>
