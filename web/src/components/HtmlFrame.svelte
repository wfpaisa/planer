<!--
  La caja donde vive el HTML de una pagina.

  El documento se dibuja en un marco con permiso solo para ejecutar guiones:
  sin origen propio no alcanza la sesion de quien mira, ni sus cookies, ni el
  resto del panel. Todo lo que necesita del exterior pasa por aqui.

  Este archivo es el otro extremo del puente. Recibe las ordenes de datos,
  comprueba que el documento las tenga declaradas, las traduce a las tablas de
  verdad y responde. Una fuente que no este en el manifiesto no llega ni a
  consultarse.

  Las tres reglas que no cambian con la migracion, y que son de seguridad y no
  de framework:

  1. El manifiesto manda: `runOp` viaja siempre con `fuentes`, y el servidor es
     quien decide que alcanza quien pregunta.
  2. `MAX_RESTORES` limita las vueltas de un documento que insiste en irse.
  3. `WRITE_OPS` no pasa en ensayo: probar una pagina no deja rastro.

  Lo que si cambia es como se guarda lo que el oyente de mensajes necesita
  leer. En React era un `useRef` reescrito en cada dibujado, porque el oyente
  se registraba una sola vez y una funcion vieja habria visto props viejas.
  Aqui el oyente es un cierre dentro de un `$effect` que no depende de nada:
  se registra una vez igual, y lee las variables del componente, que siempre
  son las de ahora.
-->
<script lang="ts" module>
  import { SPACE_VARS, TEXT_VARS, THEME_VARS } from "@shared/htmlContract";
  import { SourceError } from "@shared/htmlSources";
  import type { AppPerson, HtmlSource } from "@shared/types";
  import type PocketBase from "pocketbase";

  /** Alto de partida. Pequeno a proposito: el documento crece hasta el suyo. */
  const START_HEIGHT = 160;

  /**
   * Vueltas seguidas que se le consienten a un documento que se va.
   *
   * Devolverlo a su sitio arregla al que se va por accidente. Al que se va
   * siempre --un guardia de sesion que nunca encuentra su token-- no: volveria
   * a irse en cada vuelta, y ese ciclo se lo come el navegador de quien mira.
   */
  const MAX_RESTORES = 3;

  /** Tiempo que ha de aguantar un documento para que las vueltas no cuenten. */
  const SETTLED_MS = 5000;

  /** Las ordenes que dejan rastro. En ensayo no se dejan pasar. */
  const WRITE_OPS = new Set(["crear", "actualizar", "borrar"]);

  interface OpContext {
    sources: HtmlSource[];
    client: PocketBase;
    appId: string;
    pageId: string;
    /** Rol con el que mirar la pagina, para la vista previa del constructor. */
    previewRole?: string;
    /** Persona concreta con la que mirar, de entre las que tienen ese rol. */
    previewPerson?: AppPerson | null;
    /** Mirar la pagina como quien llega sin cuenta. */
    previewAnon?: boolean;
    /** Mirar la pagina como quien entro y no tiene ningun rol. */
    previewNoRole?: boolean;
  }

  /**
   * Un error del servidor que trae su codigo, para poder distinguirlo.
   *
   * El puente ya lo cuelga del error que le entrega al documento; aqui hace
   * falta el mismo dato para poner el aviso desde la plataforma.
   */
  class OpError extends SourceError {
    codigo: string;

    constructor(message: string, codigo: string) {
      super(message);
      this.codigo = codigo;
    }
  }

  /**
   * Resuelve una orden del HTML pasandola al servidor.
   *
   * Antes se resolvia aqui mismo, contra la base y con la sesion de quien mira.
   * Ya no: con varios roles alcanzando cosas distintas, lo que se filtrara en
   * este lado ya habria llegado al navegador de quien mira. El servidor sabe
   * quien pregunta, con que roles, y entrega solo lo que esa persona alcanza.
   *
   * Lo unico que sigue viajando desde aqui es el manifiesto del documento, y
   * solo porque el constructor prueba paginas que aun no ha guardado: al
   * servidor le vale unicamente si quien pregunta es el dueno de la aplicacion.
   */
  async function runOp(op: string, args: unknown[], ctx: OpContext): Promise<unknown> {
    if (!ctx.appId || !ctx.pageId) {
      throw new SourceError("Esta vista previa no está conectada a ninguna página guardada.");
    }

    const headers = new Headers({ "content-type": "application/json" });
    if (ctx.client.authStore.token) headers.set("authorization", ctx.client.authStore.token);

    const res = await fetch(`/api/apps/${ctx.appId}/paginas/${ctx.pageId}/datos`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        op,
        args,
        rol: ctx.previewRole || undefined,
        persona: ctx.previewPerson?.id || undefined,
        sinSesion: ctx.previewAnon || undefined,
        sinRol: ctx.previewNoRole || undefined,
        fuentes: ctx.sources,
      }),
    });

    const data = jsonBody(await res.text());
    if (!res.ok) {
      const message = data?.error ?? `El servidor respondio ${res.status}`;
      throw data?.codigo ? new OpError(message, String(data.codigo)) : new SourceError(message);
    }
    return data;
  }

  /**
   * El tema tal como queda resuelto aqui, listo para el documento: los colores
   * de la aplicacion y las medidas de la casa. Van juntos a proposito, para que
   * una pagina se dibuje con el mismo aspecto que el panel sin copiar valores.
   */
  function readTheme(element: Element): {
    vars: Record<string, string>;
    modo: "light" | "dark";
    paleta: string | null;
  } {
    const computed = getComputedStyle(element);
    const vars: Record<string, string> = {};
    for (const name of [...THEME_VARS, ...SPACE_VARS, ...TEXT_VARS]) {
      const value = computed.getPropertyValue(name).trim();
      if (value) vars[name] = value;
    }
    /*
     * Los que no son color ni medida, y que el documento necesita para
     * derivar por su cuenta: el color crudo de una paleta a mano --que no
     * esta en ningun `[data-palette]` de la hoja-- y el tamano de letra que
     * aqui resuelve el contenedor --el de la aplicacion sobre el del panel--,
     * que alli tiene que llevarlo la raiz para que el rem valga lo mismo. Va
     * en pixeles medidos, no en porcentaje: es lo que vale un rem aqui, y el
     * documento no puede adivinarlo desde dentro.
     */
    const palette1 = computed.getPropertyValue("--palette-1").trim();
    if (palette1) vars["--palette-1"] = palette1;
    vars["font-size"] = computed.fontSize;
    // El esquema de color lo fija el tema activo (el del panel o el del
    // contenedor de la aplicacion, segun donde viva este marco).
    return {
      vars,
      modo: computed.colorScheme === "dark" ? "dark" : "light",
      // La paleta de la aplicacion, para que el documento la ponga en su raiz
      // y las hojas deriven ahi dentro. Ver `server/pageStyles.ts`.
      paleta:
        (element as HTMLElement).closest("[data-palette]")?.getAttribute("data-palette") ?? null,
    };
  }
</script>

<script lang="ts">
  import { personDisplayName } from "@shared/people";
  import { NEEDS_SESSION, type PageIssue, type PickedBlock } from "@shared/types";
  import { untrack } from "svelte";

  import { cx } from "../lib/cx";
  import { fontSize } from "../lib/fontSize.svelte";
  import { FRAME_DRAG, FRAME_DROP } from "../lib/frameEvents";
  import type { DocLoader } from "../lib/htmlDocs";
  import { nextPickId } from "../lib/pagePicker.svelte";
  import { errorMessage, jsonBody } from "../lib/pb";
  import { getPeople } from "../lib/people.svelte";
  import { theme } from "../lib/theme.svelte";
  import Toast from "./Toast.svelte";

  let {
    doc: docHash,
    sources: declared,
    maxHeight,
    fill = false,
    themeKey,
    appId,
    pageId,
    previewRole,
    previewPerson,
    previewAnon = false,
    previewNoRole = false,
    client,
    loadDoc,
    title,
    roles,
    onStorage,
    onNavigate,
    picking = false,
    onPick,
    onPickerOff,
    onIssue,
    onReady,
    dryRun = false,
  }: {
    /** Huella del documento que hay que dibujar. Vacia: no hay nada que dibujar. */
    doc?: string;
    /** Tablas que ese documento puede pedir. Nada mas esta permitido. */
    sources?: HtmlSource[];
    /** Tope de alto en pixeles. Solo cuenta cuando el marco crece con su contenido. */
    maxHeight?: number;
    /**
     * El marco ocupa todo el alto de donde vive, en vez de crecer con su
     * contenido. Es lo que necesita una pagina entera.
     */
    fill?: boolean;
    /**
     * Cambia cuando cambia la paleta de la aplicacion. Sirve para volver a
     * mandar los colores sin que el marco tenga que saber de donde salen.
     */
    themeKey?: string;
    /** Aplicacion y pagina a las que el documento pide datos. */
    appId: string;
    pageId: string;
    /**
     * Mirar la pagina como lo haria alguien con este rol. Solo lo atiende el
     * servidor si quien lo pide es el dueno de la aplicacion, y nunca amplia lo
     * que ese dueno ya alcanza.
     */
    previewRole?: string;
    /**
     * Persona concreta con la que mirar, de entre las que tienen ese rol. Es lo
     * que permite probar una pantalla que ensena "lo mio".
     *
     * Viaja entera y no solo su identificador: al servidor le basta el id, pero
     * el documento necesita tambien el nombre, el correo, sus roles de verdad y
     * sus columnas propias para que `plane.usuario` sea esa persona y no quien
     * construye.
     */
    previewPerson?: AppPerson | null;
    /** Mirar la pagina como la veria alguien que llega sin cuenta. */
    previewAnon?: boolean;
    /**
     * Mirar la pagina como la veria alguien que entro y no tiene ningun rol de
     * la aplicacion. Hay sesion, y no hay rol: no es lo mismo que `previewAnon`
     * ni que un rol vacio, y por eso viaja aparte hasta el servidor.
     */
    previewNoRole?: boolean;
    client: PocketBase;
    loadDoc?: DocLoader;
    title?: string;
    /** Roles de quien esta mirando, para que el contenido sepa a quien tiene delante. */
    roles?: string[];
    /** El contenido guardo algo en el almacenamiento de mentira del marco. */
    onStorage?: () => void;
    /**
     * El contenido intento irse a otra pagina. `stuck` cuando ya agoto las
     * vueltas y el marco se quedo quieto.
     */
    onNavigate?: (info: { stuck: boolean }) => void;
    /**
     * El cursor de seleccion esta encendido: pasar el raton por dentro del
     * documento ilumina lo que se seleccionaria, y el clic se consume.
     */
    picking?: boolean;
    /** Se senalo un elemento del documento. */
    onPick?: (block: PickedBlock) => void;
    /** El documento apago el cursor por su cuenta, con escape. */
    onPickerOff?: () => void;
    /**
     * El documento solto un fallo: lo mismo que se veria en la consola del
     * navegador. Llega tal cual, sin filtrar y sin agrupar.
     */
    onIssue?: (issue: PageIssue | { tipo: "aviso"; mensaje: string }) => void;
    /** El puente ya esta en pie dentro del marco. */
    onReady?: () => void;
    /**
     * Ensayo: las ordenes que escriben --crear, actualizar, borrar-- se
     * responden con un `ok` de mentira, sin llegar al servidor. Solo pasan las
     * de lectura.
     *
     * Es para probar una pagina recien escrita: si su codigo guarda algo al
     * cargarse, la prueba no puede dejar ese rastro en los datos de verdad.
     */
    dryRun?: boolean;
  } = $props();

  /*
   * El padron de la aplicacion, para poder decir el nombre de quien mira.
   * La cuenta no lo sabe --guarda el correo sin el dominio-- y la fila de esa
   * persona en la tabla de personas si. Ver `viewer`.
   *
   * Se coge del contexto, que lo pone la pantalla que abre la aplicacion: el
   * panel con la lista del constructor y la aplicacion publicada con la suya.
   * Donde no lo haya --el marco de una conversion, la sonda-- llega vacio y el
   * nombre se cae a la cuenta, que es lo que se hacia antes.
   */
  const people = getPeople();

  let frame = $state<HTMLIFrameElement | null>(null);
  let holder = $state<HTMLDivElement | null>(null);
  let doc = $state("");
  let height = $state(START_HEIGHT);
  let ready = $state(false);
  let error = $state("");
  /**
   * El aviso de que hace falta iniciar sesion para guardar.
   *
   * Lo pone la plataforma y no el HTML de la pagina: asi no se puede saltar y
   * no depende de que quien escribio la pagina se acordara. Ver `design.md` D4.
   */
  let sessionNotice = $state({ text: "", turno: 0 });
  /** Cambia para volver a montar el marco cuando el documento se va. */
  let turn = $state(0);
  /** El documento agoto sus vueltas: se retira el marco y se deja quieto. */
  let stuck = $state(false);

  const sources = $derived(declared ?? []);

  /** Vueltas gastadas por un documento que insiste en irse. */
  let vueltas = 0;
  let asentado: ReturnType<typeof setTimeout> | undefined;

  /* Traer el documento. Depende de la huella y de quien lo sepa cargar. */
  $effect(() => {
    const hash = docHash;
    const load = loadDoc;
    ready = false;
    doc = "";
    height = START_HEIGHT;
    // Otro contenido empieza de cero: las vueltas que gasto el anterior no
    // cuentan contra el.
    stuck = false;
    vueltas = 0;
    if (!hash || !load) return;

    let alive = true;
    load(hash)
      .then((html) => {
        if (!alive) return;
        doc = html;
        error = "";
      })
      .catch((err) => {
        if (alive) error = errorMessage(err);
      });
    return () => {
      alive = false;
    };
  });

  /**
   * Quien esta mirando, tal como lo llama el documento: los cuatro datos de la
   * plataforma y, al mismo nivel, las columnas que la aplicacion le haya puesto
   * en su tabla de personas. Ver `design.md` D4 de
   * `relacion-automatica-con-personas`.
   */
  type Viewer = Record<string, unknown> & {
    id: string;
    nombre: string;
    correo: string;
    roles: string[];
  };

  /**
   * Las columnas propias de una persona, listas para viajar.
   *
   * Van planas --`plane.usuario.cedula`, no `plane.usuario.campos.cedula`--
   * porque es lo que se escribe en el filtro de una pantalla de "lo mio".
   *
   * Se esparcen **antes** que los cuatro de la plataforma a proposito: una
   * aplicacion de antes de que el nombre se reservara puede tener una columna
   * llamada `correo`, y taparia el correo de la cuenta. Y la columna `nombre`,
   * que toda tabla de personas trae, dice lo mismo que `nombre` pero sin su
   * respaldo al correo cuando esta vacia.
   *
   * `$state.snapshot` deja un objeto plano: lo que llega de la lista viene
   * envuelto en el proxy de las runas y `postMessage` no sabe copiarlo.
   */
  function ownColumns(person: AppPerson | null): Record<string, unknown> {
    if (!person?.campos) return {};
    return $state.snapshot(person.campos) as Record<string, unknown>;
  }

  /**
   * Quien esta mirando, tal como lo ve el documento.
   *
   * Es la copia de este lado de lo que el servidor compone en `asViewer`, y
   * tiene que decir lo mismo: si no, el documento recibe filas resueltas para
   * una persona y un `plane.usuario` que es otra, y una pantalla de "lo mio"
   * se ve vacia en la vista previa aunque publicada funcione. Ver `design.md`
   * D5 de `permisos-simples-por-rol`.
   *
   * - Sin sesion: nadie, igual que quien llega sin cuenta.
   * - Sin rol y sin persona: hay sesion y no hay ningun rol, que es como entra
   *   quien acaba de ser invitado y todavia no le nombraron uno.
   * - Con persona: esa persona, con su identificador, su nombre, su correo y
   *   sus roles de verdad --no solo el del selector, que es uno de los suyos--.
   * - Con rol y sin persona: hay sesion y no hay identidad concreta. Quien
   *   construye no esta en la tabla de personas, asi que una pantalla de "lo
   *   mio" se ve vacia; es lo que de verdad pasa, y lo que arregla elegir
   *   persona.
   * - Sin nada de eso --la aplicacion publicada--: quien tiene la sesion.
   *
   * Los arrays se copian a mano: llegan envueltos en el proxy de las runas y
   * `postMessage` no sabe copiar un proxy --revienta con `DataCloneError` y el
   * documento se queda sin tema y sin usuario--.
   */
  function viewer(): Viewer | null {
    if (previewAnon) return null;
    if (previewPerson) {
      return {
        ...ownColumns(previewPerson),
        id: previewPerson.id,
        nombre: personDisplayName(previewPerson),
        correo: previewPerson.email ?? "",
        roles: [...previewPerson.roles],
      };
    }
    if (previewRole) return { id: "", nombre: "", correo: "", roles: [previewRole] };
    if (previewNoRole) return { id: "", nombre: "", correo: "", roles: [] };
    // El correo de una cuenta de aplicacion esta en `cuenta`; el constructor
    // probando su propia pagina lo tiene donde siempre. Ver `loginFor`.
    const record = client.authStore.record as {
      id: string;
      name?: string;
      cuenta?: string;
      email?: string;
    } | null;
    if (!record) return null;
    /*
     * Y su fila en la tabla de personas, que es donde esta su nombre. El
     * `name` de la cuenta no lo es: es el correo sin el dominio, asi que quien
     * entra con `1037660432@ss.local` se veria saludado por su cedula. Ver
     * `personDisplayName`.
     *
     * Quien construye no esta en ese padron --no esta invitado a su propia
     * aplicacion-- y ahi el `name` de la cuenta si es un nombre: es el que se
     * escribio al crearla.
     */
    const mine = people.list.find((p) => p.id === record.id) ?? null;
    return {
      ...ownColumns(mine),
      id: record.id,
      nombre: mine ? personDisplayName(mine) : (record.name ?? ""),
      correo: record.cuenta || record.email || "",
      /*
       * Sin esto, un contenido al que se le prohibe tener su propio padron se
       * queda sin distinguir a un administrador.
       */
      roles: $state.snapshot(roles) ?? [],
    };
  }

  /** Los colores y quien esta mirando, tal como los ve el documento. */
  function sendTheme() {
    const target = frame?.contentWindow;
    if (!target || !holder) return;
    const { vars, modo, paleta } = readTheme(holder);
    target.postMessage({ plane: "theme", vars, modo, paleta, usuario: viewer() }, "*");
  }

  /*
   * El tema del panel y el de la aplicacion se leen aqui a proposito, aunque
   * `sendTheme` no los use como argumentos: los saca del DOM al llamarse, asi
   * que sin leerlos el marco no se enteraria de un cambio de ninguno de los
   * dos. Es el mismo motivo por el que en React hacia falta un `biome-ignore`
   * sobre la lista de dependencias; aqui basta con leerlos.
   *
   * Y se espera al cuadro siguiente: quien activa el tema lo hace en efectos
   * de mas arriba, que corren despues de este. Leer aqui mismo daria los
   * colores de antes, y el marco se quedaria siempre un cambio por detras.
   */
  $effect(() => {
    void theme.name;
    void themeKey;
    void roles;
    /*
     * Y con quien se mira, que tambien entra en el mensaje. Cambiarlo vuelve a
     * montar el marco desde la escena, asi que hoy el tema se reenvia de todos
     * modos; leerlo aqui es lo que hace que `sendTheme` siga diciendo la verdad
     * si algun dia deja de remontarse.
     */
    void previewRole;
    void previewPerson;
    void previewAnon;
    void previewNoRole;
    /*
     * El padron llega despues del primer dibujado --se pide al servidor-- y con
     * el llega el nombre de quien mira. Sin leerlo aqui, el documento se
     * quedaria con el que se compuso antes de que existiera: el de la cuenta.
     */
    void people.list;
    // El tamano de letra del panel tambien entra en lo que mide `sendTheme`:
    // sin leerlo aqui, cambiarlo no reenviaria el tema y el marco se quedaria
    // con el rem viejo.
    void fontSize.percent;
    if (!ready) return;
    const raf = requestAnimationFrame(sendTheme);
    return () => cancelAnimationFrame(raf);
  });

  /*
   * El modo cursor. Se manda tambien cuando el marco vuelve a estar listo: un
   * documento recien cargado no sabe nada de lo que se pidio antes de existir.
   */
  $effect(() => {
    const activo = picking;
    if (!ready) return;
    frame?.contentWindow?.postMessage({ plane: "cursor", activo }, "*");
  });

  /*
   * Las flechas que ensanchan lo senalado. El puente ya las escucha dentro del
   * documento, pero el teclado casi nunca esta ahi: quien enciende el cursor lo
   * hace desde el panel y sigue con el foco en lo que estaba escribiendo, asi
   * que las pulsaciones se quedan de este lado. Se recogen aqui y se pasan.
   */
  $effect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      frame?.contentWindow?.postMessage(
        { plane: "cursor-nivel", paso: e.key === "ArrowUp" ? 1 : -1 },
        "*",
      );
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  /*
   * El oyente de mensajes se registra una sola vez. Si se quitara y se volviera
   * a poner con cada cambio, un mensaje que llegara justo en ese hueco se
   * perderia, y el puente no repite un valor que ya mando.
   *
   * Todo lo que lee de fuera va dentro de `untrack`: son las variables vivas
   * del componente --el cierre siempre ve las de ahora-- y leerlas aqui de
   * forma rastreada volveria a montar el oyente con cada cambio, que es justo
   * lo que se quiere evitar.
   */
  $effect(() => {
    const onMessage = (event: MessageEvent) => {
      // Un marco sin origen propio se anuncia como "null": la unica forma
      // fiable de reconocerlo es por su ventana.
      const node = untrack(() => frame);
      if (!node || event.source !== node.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.plane === "ready") {
        ready = true;
        untrack(() => onReady)?.();
        return;
      }

      /* Lo que el documento rompio, tal como saldria en la consola. */
      if (data.plane === "fallo") {
        const fallo = data.fallo;
        if (!fallo || typeof fallo !== "object") return;
        untrack(() => onIssue)?.({
          tipo: fallo.tipo,
          mensaje: String(fallo.mensaje ?? "").slice(0, 1000),
          ...(fallo.linea ? { linea: Number(fallo.linea) } : {}),
          ...(fallo.columna ? { columna: Number(fallo.columna) } : {}),
          ...(fallo.pila ? { pila: String(fallo.pila) } : {}),
        });
        return;
      }

      if (data.plane === "storage") {
        untrack(() => onStorage)?.();
        return;
      }

      /*
       * Alguien arrastra un archivo por encima del documento. El marco no sabe
       * que hacer con el --eso lo decide el editor-- asi que solo repite el
       * aviso en la ventana: quien tenga la zona de soltar lo recogera.
       */
      if (data.plane === "arrastre") {
        window.dispatchEvent(new CustomEvent(FRAME_DRAG));
        return;
      }

      if (data.plane === "soltar") {
        const archivos = Array.isArray(data.archivos) ? (data.archivos as File[]) : [];
        window.dispatchEvent(new CustomEvent(FRAME_DROP, { detail: { archivos } }));
        return;
      }

      /* Lo senalado con el cursor: donde esta y lo que tiene ahora. */
      if (data.plane === "picked") {
        untrack(() => onPick)?.({
          id: nextPickId(),
          name: String(data.nombre ?? ""),
          label: String(data.etiqueta ?? "") || "un elemento",
          path: String(data.ruta ?? ""),
          html: String(data.html ?? ""),
          truncated: data.recortado === true,
        });
        return;
      }

      /* Se salio del cursor desde dentro del documento, con escape. */
      if (data.plane === "picker-off") {
        untrack(() => onPickerOff)?.();
        return;
      }

      /*
       * El contenido intenta salir de la pagina. Los enlaces y los formularios
       * los para el puente; una asignacion directa de la direccion no se
       * puede parar, solo deshacer: el documento vuelve a su sitio.
       */
      if (data.plane === "nav") {
        const saliendo = data.modo === "saliendo";
        const agotado = saliendo && vueltas >= MAX_RESTORES;
        untrack(() => onNavigate)?.({ stuck: agotado });
        if (!saliendo) return;

        /*
         * Agotadas las vueltas se quita el marco. Dejarlo seria dejar dentro
         * la pagina a la que se fue, que es justo lo que no puede verse: la
         * pagina de error del navegador.
         */
        if (agotado) {
          stuck = true;
          height = START_HEIGHT;
          return;
        }

        vueltas += 1;
        clearTimeout(asentado);
        // Un documento que aguanta un rato deja de arrastrar sus vueltas: el
        // tope es para el que se va siempre, no para el que se fue una vez.
        asentado = setTimeout(() => {
          vueltas = 0;
        }, SETTLED_MS);

        ready = false;
        height = START_HEIGHT;
        turn += 1;
        return;
      }

      if (data.plane === "height") {
        const wanted = Number(data.value) || START_HEIGHT;
        const tope = untrack(() => maxHeight);
        height = tope ? Math.min(wanted, tope) : wanted;
        return;
      }

      if (data.plane === "call") {
        const reply = (payload: Record<string, unknown>) =>
          untrack(() => frame)?.contentWindow?.postMessage(
            { plane: "result", id: data.id, ...payload },
            "*",
          );

        void (async () => {
          try {
            /*
             * En ensayo, lo que escribe no llega a escribir. Se contesta que
             * salio bien para que la pagina siga su curso y se pueda ver como
             * se comporta entera, pero no se toca ni un dato.
             */
            if (untrack(() => dryRun) && WRITE_OPS.has(String(data.op))) {
              reply({ ok: true, data: { id: "ensayo", ensayo: true } });
              return;
            }
            reply({
              ok: true,
              data: await runOp(String(data.op), data.args ?? [], {
                sources: untrack(() => sources),
                client: untrack(() => client),
                appId: untrack(() => appId),
                pageId: untrack(() => pageId),
                previewRole: untrack(() => previewRole),
                previewPerson: untrack(() => previewPerson),
                previewAnon: untrack(() => previewAnon),
                previewNoRole: untrack(() => previewNoRole),
              }),
            });
          } catch (err) {
            const codigo = err instanceof OpError ? err.codigo : "";
            // El aviso lo pone la plataforma; la orden se rechaza igual, para
            // que la pagina pueda capturarla si quiere hacer algo mejor.
            // El turno hace que dos intentos seguidos vuelvan a asomar el
            // aviso aunque el mensaje sea el mismo.
            if (codigo === NEEDS_SESSION) {
              sessionNotice = { text: errorMessage(err), turno: sessionNotice.turno + 1 };
            }
            reply({ ok: false, error: errorMessage(err), codigo: codigo || undefined });
          }
        })();
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(asentado);
    };
  });
</script>

<!--
  El aviso de que hace falta iniciar sesion para guardar. Va fuera del `if` de
  abajo porque la orden que lo dispara sale del marco, que solo existe en la
  otra rama, y porque el aviso vive en su propia capa. Ver `Toast`.
-->
{#if sessionNotice.text}
  <Toast kind="warning" key={String(sessionNotice.turno)}>{sessionNotice.text}</Toast>
{/if}

{#if error}
  <div
    bind:this={holder}
    class={cx(
      "error-frame-html flex items-center justify-center text-center",
      fill && "frame-error-fill",
    )}
  >
    {error}
  </div>
{:else}
  <div bind:this={holder} class={cx("holder-frame-html", fill && "frame-holder-fill")}>
    {#if doc && !stuck}
      <!--
        La clave vuelve a montar el marco: asi se deshace la salida del
        documento y vuelve a cargarse el contenido de verdad.
      -->
      {#key turn}
        <iframe
          bind:this={frame}
          title={title || "Contenido de HTML"}
          srcdoc={doc}
          sandbox="allow-scripts"
          style={fill ? undefined : `height: ${height}px;`}
          class={cx("frame-html block w-full", fill && "frame-fill")}
        ></iframe>
      {/key}
    {/if}
  </div>
{/if}

<style>
  .error-frame-html {
    background: transparent;
    border: var(--border-width) dashed var(--border);
    border-radius: var(--radius-sm);
    padding: var(--sp-16) var(--sp-24);
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
    color: var(--text-muted);

    &.frame-error-fill {
      height: 100%;
    }
  }

  .holder-frame-html {
    &.frame-holder-fill {
      height: 100%;
    }
  }

  .frame-html {
    border: 0;

    &.frame-fill {
      height: 100%;
    }
  }
</style>
