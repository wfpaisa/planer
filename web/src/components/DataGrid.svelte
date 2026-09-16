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
  import type { FieldDef } from "@shared/types";

  /**
   * En que formato sale la tabla.
   *
   * `csv` y `json` se descargan y se copian; `excel` solo se descarga, porque
   * un `.xlsx` es un archivo binario y no hay nada que pegar en otro sitio.
   */
  type ExportFormat = "csv" | "json" | "excel";

  const PAGE_SIZES = [25, 50, 100, 200, 300, 500] as const;
  /** Cuando `meta.pageSize` no vale, la grilla usa este tamano. */
  const DEFAULT_PAGE_SIZE = 50;

  /**
   * Columnas que PocketBase crea solas en cada tabla. Son de solo lectura: el
   * constructor solo decide si las muestra o las oculta en la grilla.
   */
  const SYSTEM_COLUMNS = ["id", "created", "updated"] as const;

  const SYSTEM_COLUMN_LABELS: Record<string, string> = {
    id: "ID",
    created: "Creado",
    updated: "Actualizado",
  };

  /** Vista de columna que usa la grilla para una columna del sistema. */
  function systemFieldDef(name: string): FieldDef {
    return {
      name,
      label: SYSTEM_COLUMN_LABELS[name] ?? name,
      type: name === "id" ? "text" : "date",
    };
  }

  const isSystem = (name: string) =>
    SYSTEM_COLUMNS.includes(name as (typeof SYSTEM_COLUMNS)[number]);
</script>

<script lang="ts">
  import {
    isPeopleNameField,
    isPeopleTable,
    MEMBER_FIELD,
    removeWarning,
    ROLE_ICON,
  } from "@shared/people";
  import { deleteRowsWarning } from "@shared/relations";
  import {
    type DeleteImpact,
    isRelationField,
    ORPHAN_SUFFIX,
    type TableRecord,
  } from "@shared/types";
  import { untrack } from "svelte";

  import { useBuilder } from "../lib/builderContext";
  import type { Row } from "../lib/cellValues";
  import { cx } from "../lib/cx";
  import { ROW_ORDER } from "../lib/dropFiles";
  import { type ImportNote, peopleImportNote } from "../lib/importPlan";
  import {
    linkWaiting,
    loadOrphans,
    type OrphanValue,
    pendingRows,
    personAsRow,
    type Waiting,
    waitingFor,
  } from "../lib/orphans";
  import { errorMessage, patch, pb, post } from "../lib/pb";
  import { takeImport } from "../lib/pendingImport.svelte";
  import { getPeople } from "../lib/people.svelte";
  import {
    loadPeopleOverlay,
    mergeOverlay,
    type PersonOverlay,
    removePersonRow,
    savePersonRow,
  } from "../lib/peopleGrid";
  import { guessPersonFields, type PersonTextColumn } from "../lib/personGuess";
  import { linkParkedValues } from "../lib/relations";
  import {
    brokenLinkWarning,
    copyText,
    downloadBlob,
    downloadFile,
    exportName,
    rowsToCsv,
    rowsToJson,
    rowsToMatrix,
  } from "../lib/tableExport";
  import { CellView } from "./cells";
  import ColumnHead, { type Sort } from "./ColumnHead.svelte";
  import ColumnModal from "./ColumnModal.svelte";
  import FieldIcon from "./FieldIcon.svelte";
  import Icon from "./Icon.svelte";
  import ImportModal from "./ImportModal.svelte";
  import OrphanPanel from "./OrphanPanel.svelte";
  import PasswordBlock from "./PasswordBlock.svelte";
  import PersonColumnOffer from "./PersonColumnOffer.svelte";
  import RolesModal from "./RolesModal.svelte";
  import RowDrawer from "./RowDrawer.svelte";
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
    Spinner,
    SuccessNote,
    WarnNote,
  } from "./ui";

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
  let search = $state("");
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

  /** Abre el panel lateral en blanco, para una fila que todavia no existe. */
  const addRow = () => {
    openRow = { row: null };
  };

  /** Mete en la grilla lo que el panel acaba de guardar. */
  function rowSaved(saved: Row, created: boolean) {
    error = "";
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

  /** Descarga o copia las filas pasadas en el formato elegido. */
  async function exportTable(kind: "download" | "copy", format: ExportFormat, items: Row[]) {
    error = "";
    // Un enlace que ya no resuelve sale como celda vacia. Se dice antes, no
    // despues de que alguien abra el archivo y eche en falta una columna.
    exportWarning = brokenLinkWarning(table.fields, items, people.list);
    try {
      // Una hoja de calculo no se copia al portapapeles: es un archivo binario,
      // asi que solo se ofrece descargarla y aqui solo llega ese camino.
      if (format === "excel") {
        const { header, body } = rowsToMatrix(table.fields, items, people.list);
        const { sheetBlob } = await import("../lib/sheet");
        downloadBlob(exportName(table, "xlsx"), await sheetBlob(header, body, table.label));
      } else if (format === "csv") {
        const csv = rowsToCsv(table.fields, items, csvSeparator, people.list);
        if (kind === "download")
          downloadFile(exportName(table, "csv"), csv, "text/csv;charset=utf-8");
        else await copyText(csv);
      } else {
        const json = rowsToJson(table.fields, items, people.list);
        if (kind === "download") downloadFile(exportName(table, "json"), json, "application/json");
        else await copyText(json);
      }
    } catch (err) {
      error = errorMessage(err);
    }
  }

  /** Descarga o copia toda la tabla (las filas se piden en el momento). */
  async function exportAll(kind: "download" | "copy", format: ExportFormat) {
    error = "";
    try {
      // Por antiguedad: el archivo que sale de aqui puede volver a entrar
      // arrastrandolo, y alli cada fila cae sobre la que ocupa su mismo sitio.
      //
      // Con las relaciones resueltas: una columna de relacion se exporta por el
      // valor que ensena, y ese valor vive en el registro enlazado.
      const all = await pb
        .collection(table.dataCollection)
        .getFullList<Row>({ sort: ROW_ORDER, expand: relationFields.join(",") });
      // Las filas recien pedidas vienen sin las columnas del sistema, que no
      // estan en la coleccion. Sin esto el archivo saldria con la cuenta, el
      // nivel y los roles en blanco.
      await exportTable(kind, format, isPeople ? mergeOverlay(all, overlay) : all);
    } catch (err) {
      error = errorMessage(err);
    }
  }

  const exportSelected = (kind: "download" | "copy", format: ExportFormat) =>
    void exportTable(
      kind,
      format,
      rows.filter((r) => selected.has(r.id)),
    );

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

  async function toggleHidden(name: string) {
    const next = hidden.includes(name) ? hidden.filter((h) => h !== name) : [...hidden, name];
    await patch(`/api/tables/${table.id}`, { meta: { ...table.meta, hidden: next } });
    await onSchemaChange();
  }

  /** Muestra u oculta una columna del sistema (id, created, updated). */
  async function toggleSystemVisible(name: string) {
    const current = table.meta?.systemVisible ?? [];
    const next = current.includes(name) ? current.filter((c) => c !== name) : [...current, name];
    await patch(`/api/tables/${table.id}`, { meta: { ...table.meta, systemVisible: next } });
    await onSchemaChange();
  }

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

  function clearSearch() {
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
      {#if loading && rows.length > 0}<Spinner class="grid-db-spinner" />{/if}
    </div>

    <span aria-hidden="true" class="grid-db-divider"></span>

    <div class="grid-db-search">
      <Icon name="search-01" size={13} class="grid-db-search-icon" />
      <input
        value={search}
        oninput={(e) => {
          page = 1;
          search = e.currentTarget.value;
        }}
        placeholder="Buscar"
        aria-label="Buscar en la tabla"
        class="input-search-table field-control sm grid-db-search-input"
      />
      {#if search}
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
      dueno. Va sin etiqueta --el icono se lee solo, y la barra ya aprieta-- y
      mientras trabaja gira, que es lo que hace `is-loading` en el sistema.
    -->
    <Button
      size="sm"
      variant="ghost"
      buttonClass="btn-refresh-table"
      onclick={refresh}
      disabled={refreshing}
      tip="Refrescar los datos"
      aria-label="Refrescar los datos"
      class={cx("grid-db-tool-action", refreshing && "is-loading")}
    >
      <Icon name="arrow-reload-horizontal" size={16} />
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
      <table class="grid-db-table table">
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
            {#each visible as field (field.name)}
              <ColumnHead
                {field}
                {sort}
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
          {#each rows as row (row.id)}
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
                La grilla es de lectura: cualquier celda abre la fila en el
                panel, y el boton ocupa la celda entera para que el cursor de
                mano no prometa mas de lo que cumple.
              -->
              {#each visible as field (field.name)}
                <td class={cx(cell, "grid-db-read-cell")}>
                  <button
                    type="button"
                    onclick={() => (openRow = { row })}
                    aria-label={`Abrir la fila (${field.label})`}
                    class="btn-open-row grid-db-cell-btn"
                  >
                    <CellView {field} {row} />
                  </button>
                </td>
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
        <Button size="sm" disabled={page >= pageCount} onclick={() => (page += 1)}>Siguiente</Button
        >
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

    & :global(.grid-db-spinner) {
      flex-shrink: 0;
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
    & :global(.grid-db-roles-label),
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

    & .grid-db-data-cell {
      height: 2.25rem;
      vertical-align: middle;

      &.grid-db-data-cell-marked {
        background: color-mix(in oklab, var(--text-primary) 4%, transparent);
      }

      &.grid-db-data-cell-idle {
        &:global(.group:hover) & {
          background: var(--bg-hover);
        }
      }
    }

    & .grid-db-checkbox-data {
      position: sticky;
      left: 0;
      z-index: 10;
      padding: 0 var(--sp-8);
      text-align: center;
    }

    & .grid-db-read-cell {
      padding: 0;

      & .grid-db-cell-btn {
        display: flex;
        height: 2.25rem;
        width: 100%;
        cursor: pointer;
        align-items: center;
        padding: 0 var(--sp-12);
        text-align: left;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
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
