<!--
  El constructor de una aplicacion.

  Es el dueno de todo lo que las dos mitades --la aplicacion y sus tablas--
  comparten: la aplicacion misma, sus tablas, sus paginas, quien esta invitado
  y la columna de la IA. Lo presta hacia abajo con `setBuilder` en vez de
  pasarlo prop a prop, porque lo leen seis pantallas y ninguna es hija directa.

  Tambien es el que recoge los archivos que se sueltan. Eso vive aqui y no en
  cada pantalla por una razon: soltar vale en cualquier parte del editor, y los
  oyentes tienen que estar en la ventana entera para que el navegador no se
  quede el archivo y lo abra por su cuenta.

  Ajustes y vista previa se abren como capas encima de lo que ya estaba: el
  contenido de fondo se dibuja contra la ubicacion guardada en el historial
  (ver `RouteState` en `lib/router.svelte`), asi "volver" no pierde nada.
-->
<script lang="ts" module>
  import type { ImportMode } from "../lib/dropFiles";

  /**
   * Que se puede hacer con un archivo de datos cuya tabla ya existe.
   *
   * Las tres son la misma importacion con distinto trato para lo que ya estaba:
   * ponerlo al dia, dejarlo donde esta, o retirarlo. Cada una se cuenta con las
   * palabras de lo que va a pasar, no con las del programa, porque lo que se
   * decide aqui no se deshace.
   */
  const IMPORT_MODES: Record<
    ImportMode,
    { label: string; hint: string; busy: string; done: string; ask: (table: string) => string }
  > = {
    update: {
      label: "Actualizar la tabla",
      hint: "Cada fila del archivo pisa a la que ocupa su mismo sitio: la primera a la primera. Las que sobren se crean al final.",
      busy: "Actualizando la tabla...",
      done: "Se actualizó",
      ask: (table) =>
        `La fila 1 de "${table}" pasará a decir lo que dice la fila 1 del archivo, la 2 lo de la 2, y así. Si el archivo trae más filas, se crean; si trae menos, las que sobran en la tabla se quedan como están.`,
    },
    add: {
      label: "Añadir las filas",
      hint: "La tabla se queda tal cual y las filas del archivo entran detrás, al final.",
      busy: "Añadiendo las filas...",
      done: "Se añadieron filas a",
      ask: (table) =>
        `Las filas del archivo se sumarán al final de "${table}", sin tocar ninguna de las que ya están. Si el archivo repite algo que ya estaba, quedará dos veces.`,
    },
    replace: {
      label: "Eliminar y crear con lo nuevo",
      hint: "Se borran todas las filas y entran las del archivo. Las columnas y el nombre de la tabla siguen igual.",
      busy: "Reemplazando las filas...",
      done: "Se reemplazo el contenido de",
      ask: (table) =>
        `Se borrarán todas las filas de "${table}" y quedarán solo las del archivo. Lo borrado no se puede recuperar.`,
    },
  };

  const MODE_KEYS = Object.keys(IMPORT_MODES) as ImportMode[];
</script>

<script lang="ts">
  import { aiUsable } from "@shared/aiCatalog";
  import { isPeopleTable, withRoleOptions } from "@shared/people";
  import type { AiConfigView, AppRecord, PageRecord, TableRecord } from "@shared/types";

  import AppTopBar, { type Section } from "../components/app/AppTopBar.svelte";
  import DropChoice from "../components/DropChoice.svelte";
  import Icon from "../components/Icon.svelte";
  import PersonLinkModal from "../components/PersonLinkModal.svelte";
  import Router from "../components/Router.svelte";
  import type { ToastKind } from "../components/Toast.svelte";
  import { Button, ConfirmDialog, ErrorNote, Loading, Modal, Note } from "../components/ui";
  import { aiDock } from "../lib/aiDock.svelte";
  import { canAttachToAi, sendFilesToAi } from "../lib/aiFiles";
  import { setBuilder } from "../lib/builderContext";
  import { cx } from "../lib/cx";
  import {
    type DataFilePlan,
    dropKind,
    htmlIntoPage,
    importIntoTable,
    matchingTable,
    pageFromHtmlFile,
    planDataFile,
    tableFromPlan,
  } from "../lib/dropFiles";
  import { FRAME_DRAG, FRAME_DROP } from "../lib/frameEvents";
  import { api, errorMessage, pb } from "../lib/pb";
  import { askImport } from "../lib/pendingImport.svelte";
  import { appPeople, setPeople } from "../lib/people.svelte";
  import { guessPersonColumns, type PersonColumnGuess, type PersonLink } from "../lib/personGuess";
  import { setPreviewSource } from "../lib/previewPanel.svelte";
  import { link, location, navigate, type RouteDef, type RouteParams } from "../lib/router.svelte";
  import { isLegacySheetFile, legacySheetMessage } from "../lib/sheet";
  import { useAsync } from "../lib/useAsync.svelte";
  import AppEditor from "./AppEditor.svelte";
  import DatabaseEditor from "./DatabaseEditor.svelte";
  import Preview from "./Preview.svelte";
  import Settings from "./Settings.svelte";

  let { params }: { params: RouteParams } = $props();

  const appId = $derived(params.appId ?? "");

  const ajustesOpen = $derived(location.pathname.endsWith("/ajustes"));
  const vistaMatch = $derived(location.pathname.match(/\/vista\/([^/]+)$/));
  /** Que se esta mirando en la vista previa, si es que hay alguna abierta. */
  const previewSource = $derived(vistaMatch?.[1] ?? "");
  const backgroundLocation = $derived(location.state?.background);

  let app = $state<AppRecord | null>(null);
  let rawTables = $state<TableRecord[]>([]);
  let pages = $state<PageRecord[]>([]);
  let touched = $state(0);
  /**
   * Cuantas veces algo de fuera cambio las filas de una tabla.
   *
   * Va aparte de `touched` a proposito: ver `dataTouched` en
   * `lib/builderContext.ts`.
   */
  let dataTouched = $state(0);
  /**
   * El aviso del constructor. Es uno solo para todo lo que pasa aqui --soltar
   * un archivo, crear una tabla, escribir una pagina-- y por eso lleva su tono
   * al lado del texto: antes todo iba por la via del error y lo que salia bien
   * se contaba en rojo, como si hubiera fallado.
   */
  let notice = $state<{ kind: ToastKind; text: string } | null>(null);
  /** Contar algo con su tono. */
  const say = (kind: ToastKind, text: string) => (notice = { kind, text });
  /** Lo que se rompio, con el texto que traiga. */
  const fail = (err: unknown) => say("error", errorMessage(err));
  /** Quitar lo anterior antes de empezar algo nuevo. */
  const hush = () => (notice = null);
  let loading = $state(true);
  let dropping = $state(false);
  let busyDrop = $state("");
  /**
   * El archivo que se acaba de soltar, esperando a que se diga que hacer con
   * el. Hasta que no se responda no se toca nada.
   */
  let drop = $state<{ file: File; kind: "html" | "data" } | null>(null);
  /** Lo elegido en esa pregunta, a la espera de que se confirme. */
  let mode = $state<ImportMode | null>(null);
  /** Un HTML que va a pisar lo que la pagina abierta ya tiene escrito. */
  let overwrite = $state<{ file: File; page: PageRecord } | null>(null);
  /**
   * Una tabla nueva cuyo archivo trae una columna que nombra usuarios: se
   * pregunta si relacionarla antes de crear nada. Ver `guessPersonColumns`.
   */
  let linking = $state<{
    fileName: string;
    plan: DataFilePlan;
    guesses: PersonColumnGuess[];
  } | null>(null);
  /** La ultima pagina que se estaba viendo, para volver a ella desde las tablas. */
  let lastAppPath = "";

  const people = appPeople(() => appId);
  const dock = aiDock(() => appId);
  const ai = useAsync(() => api<AiConfigView>("/api/ai/config"));
  const aiReady = $derived(aiUsable(ai.data));

  /**
   * Las tablas, con la columna de roles ya rellena.
   *
   * Los roles no se guardan en la tabla: viven en la aplicacion y se ponen aqui
   * al leer, para que una copia guardada no se quede vieja en cuanto alguien
   * anada un rol. Se hace en este sitio y no en la cuadricula porque quien lee
   * las tablas es mas de uno --la cuadricula, exportar la estructura, la tarjeta
   * de una columna, la IA-- y con la lista sin rellenar la columna de roles
   * parece un desplegable sin opciones.
   */
  const tables = $derived(
    rawTables.map((t) =>
      isPeopleTable(t) ? { ...t, fields: withRoleOptions(t.fields, app?.roles ?? []) } : t,
    ),
  );

  const bump = () => {
    touched += 1;
  };

  const touchData = () => {
    dataTouched += 1;
  };

  const setApp = (next: AppRecord) => {
    app = next;
    bump();
  };

  const reloadTables = async () => {
    rawTables = await pb.collection("tables").getFullList<TableRecord>({
      filter: `app = "${appId}"`,
      sort: "order,created",
    });
    bump();
  };

  const reloadApp = async () => {
    app = await pb.collection("apps").getOne<AppRecord>(appId);
    bump();
  };

  const reloadPages = async () => {
    pages = await pb.collection("pages").getFullList<PageRecord>({
      filter: `app = "${appId}"`,
      sort: "order,created",
    });
    bump();
  };

  setPeople(people);
  setBuilder({
    // La aplicacion se lee cuando ya llego: nadie que use este contexto se
    // dibuja antes, porque hasta entonces aqui solo hay un cartel de "cargando".
    get app() {
      return app as AppRecord;
    },
    get tables() {
      return tables;
    },
    get pages() {
      return pages;
    },
    reloadTables,
    reloadPages,
    reloadPeople: people.reload,
    reloadApp,
    setApp,
    get dataTouched() {
      return dataTouched;
    },
    touchData,
    get touched() {
      return touched;
    },
    get aiReady() {
      return aiReady;
    },
    dock,
  });

  /*
   * Lo que se esta mirando se apunta fuera del arbol: la lista de versiones se
   * dibuja debajo de la capa y ahi la ruta que ve es la del fondo. Este es el
   * unico sitio que ve la de verdad, y de la capa se sale por varios lados: el
   * boton, la tecla de volver, o un enlace.
   */
  $effect(() => {
    setPreviewSource(previewSource);
  });

  $effect(() => {
    const id = appId;
    let alive = true;
    loading = true;
    (async () => {
      try {
        const record = await pb.collection("apps").getOne<AppRecord>(id);
        if (!alive) return;
        app = record;
        await Promise.all([reloadTables(), reloadPages()]);
      } catch (err) {
        if (alive) fail(err);
      } finally {
        if (alive) loading = false;
      }
    })();
    return () => {
      alive = false;
    };
  });

  /*
   * Soltar vale en cualquier parte del editor. Los oyentes van en la ventana
   * entera y no en la plantilla: un archivo que se suelte fuera de la zona --en
   * el encabezado, en el sidebar-- se lo queda el navegador y lo abre en otra
   * ventana. Parandolo aqui eso no pasa en ningun sitio.
   *
   * Solo se despierta con archivos: dentro del editor tambien se arrastran
   * cosas --una pagina del sidebar a otro sitio de la lista, un trozo de
   * texto-- y ninguna de esas es un archivo que traer.
   *
   * El cartel no se apaga por si solo pasado un rato: con el puntero quieto el
   * navegador deja de mandar avisos --no repite `dragover` si nada se mueve--
   * y cualquier espera lo apagaria con el archivo todavia encima. Se apaga
   * cuando el arrastre acaba: al soltar, al cancelarse, o al salir del borde
   * de la ventana. Nada mas.
   */
  $effect(() => {
    /** Lo que se esta ensenando ahora, para no repetir el mismo dibujado. */
    let activo = false;

    const encender = () => {
      if (activo) return;
      activo = true;
      dropping = true;
    };
    const apagar = () => {
      if (!activo) return;
      activo = false;
      dropping = false;
    };

    const guardar = (files: FileList | File[] | null) => {
      apagar();
      if (files?.length) handleFiles(files);
    };

    /** Si lo que viene arrastrado son archivos y no algo de la propia pagina. */
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");

    /*
     * Una tarjeta con su propia zona de soltar --importar una tabla, traer un
     * HTML-- ya paro el evento por su cuenta. Ahi manda ella: ni sale el cartel
     * ni se cuela una pagina nueva encima de lo que se estaba haciendo.
     */
    const over = (e: DragEvent) => {
      if (!hasFiles(e) || e.defaultPrevented) return;
      // Sin esto el navegador se queda el archivo y lo abre por su cuenta.
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      encender();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e) || e.defaultPrevented) return;
      e.preventDefault();
      guardar(e.dataTransfer?.files ?? null);
    };
    /*
     * El archivo salio de la ventana por un borde. `dragleave` salta tambien al
     * cruzar de un elemento al de al lado --y al entrar en el marco de una
     * pagina, que es otro documento-- asi que solo cuenta el que no deja nada
     * detras y ademas ocurre en el borde: ese si es una salida de verdad.
     */
    const leave = (e: DragEvent) => {
      const fuera =
        e.clientX <= 0 ||
        e.clientY <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight;
      if (e.relatedTarget || !fuera) return;
      apagar();
    };
    /* El arrastre se cancelo: con escape, o soltandolo donde no valia. */
    const end = () => apagar();
    /* Lo mismo que `over`, pero cuando el arrastre pasa por encima del marco de
       una pagina: alli dentro vive otro documento y el puente es su voz. */
    const fromFrame = () => encender();
    const frameDrop = (e: Event) => {
      const detail = (e as CustomEvent<{ archivos?: File[] }>).detail;
      guardar(detail?.archivos ?? null);
    };

    window.addEventListener("dragover", over);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragend", end);
    window.addEventListener(FRAME_DRAG, fromFrame);
    window.addEventListener(FRAME_DROP, frameDrop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragend", end);
      window.removeEventListener(FRAME_DRAG, fromFrame);
      window.removeEventListener(FRAME_DROP, frameDrop);
    };
  });

  /* ---------------------------------------------------------------- */
  /* Donde se esta                                                     */
  /* ---------------------------------------------------------------- */

  // Cuando /ajustes se visita directamente (sin estado de fondo), mostramos la
  // seccion "app" detras del modal en lugar de perder la URL de ajustes. Si ya
  // hay paginas cargadas, apuntamos a la pagina de inicio para que AppEditor no
  // redirija la URL real al agregar el id de pagina.
  const homePage = $derived(pages.find((p) => p.isHome) ?? pages.find((p) => !p.separator));
  const defaultContentPath = $derived(
    homePage ? `/a/${appId}/app/${homePage.id}` : `/a/${appId}/app`,
  );
  // Ajustes y vista previa son capas encima del editor: el contenido de fondo
  // sigue siendo el que habia antes de abrirlas, para que "volver" no pierda
  // nada de lo que estaba abierto. La base de datos no: es la otra mitad de la
  // aplicacion y ocupa el contenido, con el mismo encabezado arriba.
  const overlayOpen = $derived(ajustesOpen || !!vistaMatch);
  const contentPath = $derived(
    overlayOpen ? (backgroundLocation?.pathname ?? defaultContentPath) : location.pathname,
  );
  const contentSearch = $derived(
    overlayOpen ? (backgroundLocation?.search ?? "") : location.search,
  );

  const closeOverlay = () =>
    navigate(
      backgroundLocation
        ? `${backgroundLocation.pathname}${backgroundLocation.search}`
        : defaultContentPath,
    );

  const openSettings = () =>
    navigate(`/a/${appId}/ajustes`, {
      state: { background: { pathname: contentPath, search: contentSearch } },
    });

  /*
   * Cambiar de mitad. Volver a la aplicacion vuelve a la pagina que estaba
   * abierta, no a la de inicio: se fue a mirar las tablas un momento, no a
   * empezar de nuevo.
   */
  // Se mira el contenido de fondo y no la URL: con los ajustes abiertos encima
  // la pestana marcada sigue siendo la de lo que se ve detras.
  const section = $derived<Section>(/\/datos(\/[^/]+)?$/.test(contentPath) ? "datos" : "app");

  $effect(() => {
    if (section === "app") lastAppPath = `${contentPath}${contentSearch}`;
  });

  const go = (next: Section) =>
    navigate(next === "datos" ? `/a/${appId}/datos` : lastAppPath || defaultContentPath);

  /**
   * La pagina que se esta viendo, si es que se esta viendo alguna.
   *
   * Sale de la URL del contenido y no de un estado propio: la ruta es la que
   * manda sobre que pagina esta abierta, y con los ajustes encima sigue siendo
   * la de detras. En la mitad de las tablas no hay ninguna, y ahi "usar la
   * pagina actual" no se ofrece.
   */
  const openPage = $derived(
    section === "app"
      ? (pages.find((p) => p.id === contentPath.match(/\/app\/([^/]+)$/)?.[1]) ?? homePage)
      : undefined,
  );

  /**
   * Las dos mitades del constructor.
   *
   * Se emparejan contra la ubicacion de fondo, no contra la de verdad: con una
   * capa abierta encima, lo de detras sigue siendo lo que estaba.
   */
  const inner: RouteDef[] = [
    { path: "/a/:appId/app", component: AppEditor },
    { path: "/a/:appId/app/:pageId", component: AppEditor },
    { path: "/a/:appId/datos", component: DatabaseEditor },
    { path: "/a/:appId/datos/:tableId", component: DatabaseEditor },
  ];

  /* ---------------------------------------------------------------- */
  /* Lo que se hace con un archivo soltado                             */
  /* ---------------------------------------------------------------- */

  /*
   * Si se le puede dar un archivo a la IA ahora mismo.
   *
   * Hace falta un servidor conectado y una ventana que de para la columna: sin
   * una de las dos, el archivo se quedaria esperando en una conversacion que no
   * se puede abrir, y es mejor no ofrecerlo que ofrecerlo y no cumplir.
   */
  const canUseAi = $derived(aiReady && !dock.tooNarrow);

  /**
   * La tabla que ya guarda lo que trae el archivo soltado, si es que hay
   * alguna. Es lo que decide si la pregunta ofrece ademas los tres modos de
   * importar sobre una tabla que ya existe.
   *
   * Se resuelve aparte y no al vuelo porque las dos primeras capas de
   * `matchingTable` leen el archivo y preguntan a la base. Mientras tanto la
   * pregunta ya esta abierta, diciendo que lo esta comprobando: abrirla al
   * final dejaba el archivo soltado sin respuesta durante ese rato.
   */
  let existing = $state<TableRecord | null>(null);
  let matching = $state(false);

  $effect(() => {
    const file = drop?.kind === "data" ? drop.file : null;
    existing = null;
    if (!file) return;

    let alive = true;
    matching = true;
    void matchingTable(tables, file)
      .then((found) => {
        if (alive) existing = found;
      })
      .catch(() => {})
      .finally(() => {
        if (alive) matching = false;
      });
    return () => {
      alive = false;
    };
  });

  /** Un archivo de personas no crea una tabla: entra por donde se crean cuentas. */
  const intoPeople = $derived(isPeopleTable(existing) ? existing : null);

  /**
   * Llevar el archivo a la tabla de personas y abrir alli el dialogo de
   * importar.
   *
   * No se importa desde aqui: meter filas en la tabla de personas sin crear las
   * cuentas deja unas filas que no son de nadie. El dialogo de la cuadricula es
   * el unico camino que crea la cuenta, dice cuantas se van a crear y pide que
   * se marque expresamente.
   */
  const toPeopleImport = (table: TableRecord, file: File) => {
    drop = null;
    hush();
    askImport(table.id, file);
    navigate(`/a/${appId}/datos/${table.id}`);
  };

  /**
   * Crea la tabla del archivo ya leido, con la relacion que se haya aceptado o
   * sin ninguna. Es el final de los dos caminos de la pregunta, asi que se
   * ocupa de sus propios errores: al llegar desde el dialogo no hay nadie
   * detras que los recoja.
   */
  const createTable = async (plan: DataFilePlan, personLink: PersonLink | null) => {
    busyDrop = "Creando la tabla...";
    try {
      const { table, rows, linked } = await tableFromPlan(appId, plan, personLink, {
        tables,
        people: people.list,
      });
      await reloadTables();
      say(
        "success",
        `Se creó la tabla "${table.label}" con ${rows} filas` +
          (personLink ? `, ${linked} enlazadas con un usuario.` : "."),
      );
      navigate(`/a/${appId}/datos/${table.id}`);
    } catch (err) {
      fail(err);
    } finally {
      busyDrop = "";
    }
  };

  /**
   * Cerrar la pregunta de la relacion y crear con lo que se respondio.
   *
   * El plan se lee antes de cerrar: `linking` es estado, y las dos salidas del
   * dialogo lo vacian. Leerlo despues --que es lo que se hacia con un `@const`
   * dentro del `{#if}`-- devolvia el valor ya vaciado, y la tabla no llegaba a
   * crearse: el dialogo se cerraba y no pasaba nada.
   */
  const closeLinking = (personLink: PersonLink | null) => {
    const pending = linking;
    if (!pending) return;
    linking = null;
    void createTable(pending.plan, personLink);
  };

  /**
   * Llevar los archivos a la conversacion de la IA.
   *
   * Se pasa antes a la mitad de la aplicacion --la conversacion vive encima de
   * una pagina, no de las tablas-- y se trae la columna. Los archivos esperan
   * en su cola hasta que el panel se monte, asi que el orden de estas tres
   * cosas no importa.
   */
  const toAi = (files: File[]) => {
    drop = null;
    if (section !== "app") navigate(lastAppPath || defaultContentPath);
    dock.show();
    sendFilesToAi(files);
  };

  /** El HTML del archivo se vuelve una pagina nueva al final de la lista. */
  const newPageFromHtml = async (file: File) => {
    drop = null;
    hush();
    busyDrop = "Creando la página...";
    try {
      const created = await pageFromHtmlFile(appId, file, pages.length);
      await reloadPages();
      navigate(`/a/${appId}/app/${created.id}`);
    } catch (err) {
      fail(err);
    } finally {
      busyDrop = "";
    }
  };

  /** El HTML del archivo pasa a ser el de la pagina que esta abierta. */
  const htmlIntoOpenPage = async (file: File, page: PageRecord) => {
    drop = null;
    overwrite = null;
    hush();
    busyDrop = "Escribiendo la página...";
    try {
      await htmlIntoPage(appId, page.id, file);
      await reloadPages();
      await reloadApp();
      say("success", `El HTML de "${file.name}" ya es el de "${page.name}".`);
      navigate(`/a/${appId}/app/${page.id}`);
    } catch (err) {
      fail(err);
    } finally {
      busyDrop = "";
    }
  };

  /**
   * Leer el archivo de datos y crear con el una tabla nueva.
   *
   * Si alguna columna esta nombrando usuarios se pregunta antes de crear nada:
   * la columna nace de tipo persona y las filas entran ya enlazadas.
   * Convertirla despues vaciaria la columna.
   */
  const newTableFromData = async (file: File) => {
    drop = null;
    hush();
    busyDrop = "Leyendo el archivo...";
    try {
      const plan = await planDataFile(file);
      const guesses = guessPersonColumns({
        columns: plan.columns,
        rows: plan.rows,
        kept: plan.kept,
        tables,
        people: people.list,
      });
      if (guesses.length > 0) {
        busyDrop = "";
        linking = { fileName: file.name, plan, guesses };
        return;
      }
      await createTable(plan, null);
    } catch (err) {
      fail(err);
    } finally {
      busyDrop = "";
    }
  };

  /*
   * Soltar un archivo vale en cualquier parte del constructor, y soltarlo no
   * decide nada: se pregunta que hacer con el.
   *
   * Un HTML puede ser una pagina nueva, el contenido de la que esta abierta, o
   * material para pedirle algo a la IA. Un archivo de datos puede ser una tabla
   * nueva, filas de una que ya existe, o tambien material. Lo demas que se sepa
   * leer --una hoja de estilos, un script, una imagen-- no crea nada en la
   * aplicacion, asi que va derecho a la conversacion sin preguntar.
   */
  function handleFiles(files: FileList | File[] | null) {
    const list = Array.from(files ?? []);
    const file = list[0];
    if (!file) return;
    hush();

    // Una hoja en formato viejo se reconoce antes que nada: no se lee, pero se
    // sabe que es y que hacer con ella, y eso vale mas que "no se sabe leer".
    if (isLegacySheetFile(file)) {
      say("warning", legacySheetMessage(file));
      return;
    }

    const kind = dropKind(file);
    if (kind === "html" || kind === "data") {
      // La pregunta es por un archivo: crear dos paginas o dos tablas de una
      // vez son dos decisiones, no una. Los demas se dicen y se quedan fuera.
      if (list.length > 1) {
        say(
          "warning",
          `Se soltó más de un archivo; se usa "${file.name}" y los demás se quedan fuera.`,
        );
      }
      drop = { file, kind };
      return;
    }
    if (kind === "ia") {
      if (!canUseAi) {
        say(
          "warning",
          aiReady
            ? "Ese archivo solo sirve como material para la inteligencia artificial, y la ventana no da para su columna. Ensanchala e intenta otra vez."
            : "Ese archivo solo sirve como material para la inteligencia artificial, y no hay ninguna conectada.",
        );
        return;
      }
      // Estos si entran todos, y con ellos cualquier otro del mismo lote que se
      // sepa leer: quien suelta un CSS junto a un HTML los quiere los dos
      // delante, no uno y una pregunta por el otro.
      toAi(list.filter(canAttachToAi));
      return;
    }
    say("warning", `No se sabe que hacer con "${file.name}".`);
  }

  /* Se respondio la pregunta y se confirmo: ahora si se escribe en la tabla. */
  const runImport = async () => {
    const chosen = mode;
    const table = existing;
    if (!drop || !table || !chosen) return;
    const { file } = drop;
    hush();
    busyDrop = IMPORT_MODES[chosen].busy;
    mode = null;
    drop = null;
    try {
      const done = await importIntoTable(table, file, chosen, { tables, people: people.list });
      await reloadTables();
      /*
       * La lista de invitados se vuelve a pedir aunque el archivo no fuera de
       * personas: una importacion puede haber enlazado filas con ellas, y el
       * siguiente archivo que se suelte empareja contra esta lista. Es lo mismo
       * que ya hace la cuadricula cuando la importacion va por su dialogo.
       */
      await people.reload();
      // A medias no es un exito: las filas que se quedaron fuera son lo que hay
      // que mirar, y en verde no las mira nadie.
      say(
        done.failed > 0 ? "warning" : "success",
        `${IMPORT_MODES[chosen].done} "${table.label}": ${done.rows} filas` +
          (done.failed > 0 ? `, ${done.failed} no entraron.` : "."),
      );
      navigate(`/a/${appId}/datos/${table.id}`);
    } catch (err) {
      fail(err);
    } finally {
      busyDrop = "";
    }
  };
</script>

{#if loading}
  <Loading label="Abriendo la aplicación" />
{:else if !app}
  <!-- Un error con la aplicacion cargada es un aviso de algo que se intento
       (soltar un archivo, por ejemplo) y se cuenta dentro, sin tumbar el
       editor. Sin aplicacion no hay editor que sostener. -->
  <div class="builder-error">
    <ErrorNote message={notice?.text || "No se encontró la aplicación"} />
    <a href="/" use:link class="builder-error-home inline-block">Volver al inicio</a>
  </div>
{:else}
  <!--
    El encabezado manda a lo ancho; debajo, la escena reparte lo que queda
    entre el dock, el sidebar y el documento. La barra de direccion ya no cruza
    la ventana entera: vive dentro de la escena, encima del documento y sin
    pasar por delante del dock.
  -->
  <div id="builder" class="builder flex flex-col h-full">
    <AppTopBar
      {app}
      {section}
      onGo={go}
      onBack={() => navigate("/")}
      onOpenSettings={openSettings}
      onChanged={reloadApp}
    />
    <!--
      `Note` se pinta en la capa de avisos, no aqui: envolverlo en un boton
      solo conseguia que arrastrar sobre su texto lo cerrara en vez de
      seleccionarlo. El aviso ya trae su propia equis y su reloj.
    -->
    <Note kind={notice?.kind ?? "info"} message={notice?.text ?? ""} />

    <div id="builder-content" class="content-builder flex-1">
      <Router routes={inner} pathname={contentPath} fallback={defaultContentPath} />
    </div>
  </div>

  <!--
    El cartel tapa la ventana entera, no solo la zona del documento: es lo unico
    que se puede leer mientras dura el arrastre, y de paso hace de escudo sobre
    el marco de la pagina, que al ser otro documento se quedaria el archivo por
    su cuenta.
  -->
  {#if dropping || busyDrop}
    <div
      class={cx(
        "overlay-drop flex items-center justify-center",
        "drop-veil",
        !dropping && "overlay-drop-inert",
      )}
    >
      <p class="overlay-drop-copy flex items-center gap-2" role={busyDrop ? "status" : undefined}>
        <!--
          Mientras se escribe, el giro es la unica senal de que la espera
          avanza: un cartel quieto no distingue trabajando de colgado.
        -->
        <span class="overlay-drop-icon" aria-hidden="true">
          {#if busyDrop}
            <span class="spinner overlay-drop-spinner"></span>
          {:else}
            <Icon name="file-upload" size={16} />
          {/if}
        </span>
        {busyDrop || "Suelta el archivo y elige que hacer con el."}
      </p>
    </div>
  {/if}

  <!--
    Se solto un HTML. Se pregunta antes de escribir nada: puede ser una pagina
    nueva, el contenido de la que esta abierta, o material para pedirle algo a
    la IA.
  -->
  {#if drop?.kind === "html"}
    {@const file = drop.file}
    <Modal
      class="modal-drop-html"
      open
      onClose={() => {
        drop = null;
      }}
      title="¿Qué deseas hacer?"
      description={`Soltaste "${file.name}".`}
    >
      <div class="drop-modal-list flex flex-col gap-2">
        {#if canUseAi}
          <DropChoice
            buttonClass="btn-drop-html-to-ai"
            label="Usar en el chat de IA"
            hint="El archivo se adjunta a la conversación. Ahí le pides lo que quieras: que lo tome de referencia, que lo adapte, que saque de él una pantalla."
            onclick={() => toAi([file])}
          />
        {/if}
        {#if openPage}
          {@const page = openPage}
          <DropChoice
            buttonClass="btn-drop-html-into-page"
            label={`Usar la página "${page.name}"`}
            hint={page.doc
              ? "Lo que esa página tiene escrito ahora se reemplaza por este HTML."
              : "Esa página está en blanco: este HTML pasa a ser el suyo."}
            onclick={() => {
              // Una pagina en blanco no tiene nada que perder; una escrita si,
              // y eso se pregunta antes con todas las letras.
              if (page.doc) overwrite = { file, page };
              else void htmlIntoOpenPage(file, page);
            }}
          />
        {/if}
        <DropChoice
          buttonClass="btn-drop-html-new-page"
          label="Crear una página nueva"
          hint="Nace una página al final de la lista, con el nombre del archivo y este HTML dentro."
          onclick={() => void newPageFromHtml(file)}
        />
      </div>
      {#snippet footer()}
        <Button
          onclick={() => {
            drop = null;
          }}
        >
          Cancelar
        </Button>
      {/snippet}
    </Modal>
  {/if}

  <!--
    Se solto un archivo de datos. Los tres modos de importar solo se ofrecen
    cuando ya hay una tabla que se llama igual; la respuesta todavia no hace
    nada, porque cada uno pasa por su confirmacion, que es donde se cuenta con
    todas las letras lo que va a ocurrir.
  -->
  {#if drop?.kind === "data"}
    {@const file = drop.file}
    <Modal
      class="modal-drop-data"
      open
      onClose={() => {
        drop = null;
      }}
      title="¿Qué deseas hacer?"
      description={matching
        ? `Soltaste "${file.name}". Comprobando si es de una tabla que ya existe...`
        : existing
          ? `"${file.name}" es el archivo de "${existing.label}".`
          : `Soltaste "${file.name}".`}
    >
      <div class="drop-modal-list flex flex-col gap-2">
        {#if canUseAi}
          <DropChoice
            buttonClass="btn-drop-data-to-ai"
            label="Usar en el chat de IA"
            hint="El archivo se adjunta a la conversación. Ahí le pides lo que quieras: que lo resuma, que arme una pantalla con esos datos, que diga qué columnas convienen."
            onclick={() => toAi([file])}
          />
        {/if}
        <!-- Un archivo de personas no ofrece crear una tabla: la aplicacion
             tiene una sola tabla de personas y una copia suya al lado no seria
             la misma gente, seria unas filas sin cuenta detras. -->
        {#if !intoPeople}
          <DropChoice
            buttonClass="btn-drop-data-new-table"
            label="Crear una base de datos nueva"
            hint="Nace una tabla con el nombre del archivo, una columna por cada columna y todas sus filas dentro."
            onclick={() => void newTableFromData(file)}
          />
        {/if}
        {#if intoPeople}
          {@const people = intoPeople}
          <DropChoice
            buttonClass="btn-drop-data-into-people"
            label={`Importar en "${people.label}"`}
            hint="Se abre la importación de personas: dice cuántas ya tienen cuenta y cuántas se crearían, y no crea ninguna sin que lo marques."
            onclick={() => toPeopleImport(people, file)}
          />
        {:else if existing}
          {#each MODE_KEYS as key (key)}
            <DropChoice
              buttonClass="btn-choose-import-mode"
              label={IMPORT_MODES[key].label}
              hint={IMPORT_MODES[key].hint}
              onclick={() => {
                mode = key;
              }}
            />
          {/each}
        {/if}
      </div>
      {#snippet footer()}
        <Button
          onclick={() => {
            drop = null;
          }}
        >
          Cancelar
        </Button>
      {/snippet}
    </Modal>
  {/if}

  {#if linking}
    <PersonLinkModal
      fileName={linking.fileName}
      tableLabel={linking.plan.label}
      guesses={linking.guesses}
      onCancel={() => {
        linking = null;
      }}
      onSkip={() => closeLinking(null)}
      onConfirm={(personLink) => closeLinking(personLink)}
    />
  {/if}

  <ConfirmDialog
    open={!!existing && !!mode}
    onClose={() => {
      mode = null;
    }}
    title={mode ? IMPORT_MODES[mode].label : ""}
    message={mode && existing ? IMPORT_MODES[mode].ask(existing.label) : ""}
    confirmLabel={mode === "replace" ? "Eliminar y crear" : "Continuar"}
    onConfirm={() => void runImport()}
  />

  <!-- Reemplazar lo que una pagina ya tiene escrito no se deshace desde aqui:
       se dice antes, y con el nombre de la pagina delante. -->
  <ConfirmDialog
    open={!!overwrite}
    onClose={() => {
      overwrite = null;
    }}
    title="Reemplazar el contenido de la página"
    message={overwrite
      ? `Lo que "${overwrite.page.name}" tiene escrito ahora se reemplazará por el HTML de "${overwrite.file.name}". Queda un punto de vuelta atrás en los cambios de la página.`
      : ""}
    confirmLabel="Reemplazar"
    onConfirm={() => {
      if (overwrite) void htmlIntoOpenPage(overwrite.file, overwrite.page);
    }}
  />

  {#if ajustesOpen}
    <Settings onClose={closeOverlay} />
  {/if}
  {#if previewSource}
    <Preview {appId} source={previewSource} onClose={closeOverlay} />
  {/if}
{/if}

<style>
  .builder-error {
    margin: 0 auto;
    max-width: 28rem;
    padding: var(--sp-40);
  }

  .builder-error-home {
    margin-top: var(--sp-16);
    font-size: var(--text-sm);
    color: var(--text-secondary);
    text-decoration: underline;
  }

  .content-builder {
    position: relative;
    min-height: 0;
  }

  .overlay-drop {
    /* El peldano de los modales: tapa la ventana entera. */
    position: fixed;
    inset: 0;
    z-index: 20;
  }

  .overlay-drop-inert {
    pointer-events: none;
  }

  /*
   * El hueco del icono es fijo y no lo decide lo que hay dentro: icono y giro
   * miden lo mismo, asi que el relevo no corre ni un pixel del cartel.
   */
  .overlay-drop-icon {
    display: grid;
    height: 1rem;
    width: 1rem;
    flex-shrink: 0;
    place-items: center;
  }

  .overlay-drop-spinner {
    height: 0.875rem;
    width: 0.875rem;
    border-width: 2px;
    /* Entero del color de la aplicacion: el aro tenue y la cabeza plena. */
    border-color: color-mix(in srgb, var(--accent) 25%, transparent);
    border-top-color: var(--accent);
  }

  .overlay-drop-copy {
    border-radius: var(--radius-lg);
    border: var(--border-width) dashed var(--accent);
    background: var(--bg-level2);
    padding: var(--sp-16) var(--sp-20);
    color: var(--text-primary);
    font-size: var(--text-sm);
    box-shadow: 0 0.25rem 1rem rgb(0 0 0 / 0.18);
  }
</style>
