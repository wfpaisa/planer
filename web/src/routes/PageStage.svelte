<!--
  Una página de la aplicación, vista por quien la construye.

  Debajo del encabezado, la escena reparte lo que queda entre tres columnas: a
  la izquierda el dock de la IA --cuando esta traido--, luego el sidebar para
  ir de una página a otra --a su lado o encima, si flota-- y por ultimo el
  documento, en su marco aislado. Nada de eso vive dentro del documento, asi
  que ningún HTML puede romperlo y ningún chrome puede recortarlo.

  La barra de dirección encabeza las dos ultimas columnas --sidebar y
  documento-- en vez de cruzar la ventana entera: cuenta el enlace de la
  página, que es justo lo que hay debajo, y el dock conserva su columna de
  arriba abajo.

  El dock ocupa su columna en vez de dibujarse encima: mientras se habla con la
  IA, lo construido se sigue viendo entero.

  Debajo de la barra de dirección --y solo cuando se mira con ojos que no son
  los de quien construye-- cruza la barra de la vista previa. Cruza entera, el
  sidebar incluido, porque mirar con otro rol no cambia solo lo que la página
  enseña: cambia también que páginas hay, y el sidebar se queda con las que ese
  rol abre. Con quien mirar se elige arriba, en la barra de dirección; aqui
  solo queda con que persona concreta, y salir.

  Y cada cual con su paleta: el chrome se pinta con el tema del panel, igual
  que el resto del administrador; la zona del documento lleva el tema de la
  aplicación, que es el que el marco lee de su contenedor y le pasa al HTML.
-->
<script lang="ts">
  import { canOpenPage, DEFAULT_PAGE_ICON, defaultPageName } from "@shared/pages";
  import { ADMIN_ROLE, ROLE_ICON } from "@shared/people";
  import type { AppPerson, PageRecord } from "@shared/types";
  import { untrack } from "svelte";

  import AiDock from "../components/AiDock.svelte";
  import AppSidebar from "../components/app/AppSidebar.svelte";
  import ConvertDialog, { legacyBlockCount } from "../components/ConvertDialog.svelte";
  import Icon from "../components/Icon.svelte";
  import PageSettings, { type Panel } from "../components/PageSettings.svelte";
  import PageView from "../components/PageView.svelte";
  import type { ToastKind } from "../components/Toast.svelte";
  import { Button, Note } from "../components/ui";
  import UrlBar from "../components/UrlBar.svelte";
  import { seedAiActivity } from "../lib/aiActivity.svelte";
  import { paletteAttrs } from "../lib/appTheme";
  import { useBuilder } from "../lib/builderContext";
  import { appPageLoader } from "../lib/htmlDocs";
  import { emitPicked, picker, setPickerActive } from "../lib/pagePicker.svelte";
  import { errorMessage, pb } from "../lib/pb";
  import { getPeople } from "../lib/people.svelte";
  import { previewAs } from "../lib/previewAs.svelte";
  import { openPublish } from "../lib/publishPanel.svelte";
  import { navigate } from "../lib/router.svelte";
  import { sidebarPin } from "../lib/sidebarPin.svelte";
  import { theme } from "../lib/theme.svelte";

  /**
   * El valor con el que el selector dice "sin sesión".
   *
   * No es un rol y no puede chocar con uno: los nombres de rol se normalizan a
   * minusculas, letras, numeros y guiones. Ver `normalizeRole`.
   */
  const ANON = "__sin_sesion__";

  /**
   * El valor con el que el selector dice "sin rol".
   *
   * Tampoco es un rol, y por lo mismo no puede chocar con uno. No es lo mismo
   * que `ANON`: aqui hay sesión --alguien entro-- y no tiene ningún rol de la
   * aplicación, que es lo que le pasa a quien acaba de ser invitado y todavía
   * no le nombraron ninguno. Es la única salida que enseña las pantallas
   * abiertas a `Todos` tal como las ve un invitado cualquiera.
   */
  const NO_ROLE = "__sin_rol__";

  let { page }: { page: PageRecord } = $props();

  const builder = useBuilder();
  const app = $derived(builder.app);

  /* Que página se esta ajustando y por donde se entro: los del HTML se piden
     desde la barra de dirección y abren la tarjeta derecho en su panel. */
  let settingsFor = $state<PageRecord | null>(null);
  let settingsPanel = $state<Panel>("page");
  let converting = $state(false);
  /*
   * Con quien se esta mirando la página.
   *
   * `ANON` no es un rol: es mirar como quien llega sin cuenta, que es lo único
   * que enseña de verdad la pantalla de entrar de una aplicación que la exige.
   * `NO_ROLE` tampoco: es mirar con sesión y sin ningún rol, que es como entra
   * quien acaba de ser invitado. Por eso viajan en el mismo selector y no en
   * interruptores aparte: son salidas de la misma pregunta, y varios controles
   * dejarian estados imposibles --un rol y sin sesión a la vez--.
   *
   * Arranca en `admin`, que es el rol de quien construye. No hay opción de
   * mirar con los ojos propios: mirar la propia página siendo el dueno no
   * enseña lo que ve nadie mas.
   *
   * Lo elegido --el rol y la persona-- se recuerda en el navegador por
   * aplicación: probar una pantalla con otros ojos es mirarla, tocar el HTML y
   * recargar, y empezar de cero en cada refresco obligaba a rehacerlo. Lo
   * recordado puede haber dejado de existir, y eso se depura mas abajo.
   */
  const preview = previewAs(() => builder.app.id);
  /**
   * El aviso de la página, con su tono. Por aqui pasa tanto lo que se rompio
   * como lo que se acaba de hacer --convertir la página, resolver un impacto--
   * y contar en rojo algo que salio bien hacia dudar de que hubiera salido.
   */
  let notice = $state<{ kind: ToastKind; text: string } | null>(null);
  const say = (kind: ToastKind, text: string) => (notice = { kind, text });
  const fail = (err: unknown) => say("error", errorMessage(err));
  const hush = () => (notice = null);

  const pin = sidebarPin(() => builder.app.id);

  /*
   * Que páginas de la aplicación tienen a la IA trabajando.
   *
   * Se pregunta una sola vez por aplicación, al entrar: a partir de ahi lo
   * mantiene al dia el hilo de avisos de cada petición, que cuenta el cambio en
   * el momento exacto en que pasa. La página abierta se salta porque de esa se
   * encarga el panel, que ademas la enseña avanzando.
   *
   * La comparacion con la anterior no sobra: `app` se vuelve a leer entero
   * cada vez que la IA da un paso --el lienzo se refresca-- y sin esto cada
   * paso lanzaria otra pregunta al servidor y volveria a escribir la senal,
   * redibujando el sidebar y el panel a media respuesta.
   */
  let seeded = "";
  $effect(() => {
    const id = app.id;
    if (id === seeded) return;
    seeded = id;
    // La página abierta se lee sin depender de ella: cambiar de página no es
    // volver a entrar en la aplicación.
    void seedAiActivity(
      id,
      untrack(() => page.id),
    );
  });

  function openPanel(p: Panel) {
    settingsPanel = p;
    settingsFor = page;
  }

  const loadDoc = $derived(appPageLoader(app.id, page.id));
  const empty = $derived(!page.doc);
  /** Una página de las de antes: guarda bloques y todavía no tiene HTML. */
  const blocks = $derived(empty ? legacyBlockCount(page) : 0);
  /*
   * Un rol que la aplicación ya no define se suelta aqui. Si no, cada orden de
   * datos fallaria con un error sobre un rol que el constructor no recuerda
   * haber elegido, y la pantalla se veria rota sin decir por que.
   */
  const previewAnon = $derived(preview.role === ANON);
  /** Mirando con sesión y sin ningún rol de la aplicación. */
  const previewNoRole = $derived(preview.role === NO_ROLE);
  /**
   * Los roles con los que se puede mirar, `admin` delante.
   *
   * El servidor ya lo guarda asi --ver `withAdminRole` en `server/routes.ts`--
   * pero el orden se repone aqui igualmente: es el primero de la lista que se
   * ofrece y el sitio al que se vuelve al cerrar la barra, y una aplicación
   * vieja que no lo nombrara dejaria el desplegable sin salida.
   */
  const previewRoles = $derived([ADMIN_ROLE, ...(app.roles ?? []).filter((r) => r !== ADMIN_ROLE)]);
  const previewRole = $derived(previewRoles.includes(preview.role) ? preview.role : "");

  /**
   * Lo que ofrece el desplegable de la barra de dirección, en dos grupos.
   *
   * Arriba las tres salidas que no dependen de como se llame nada en esta
   * aplicación: quien construye, quien llega sin haber entrado y quien entro
   * pero todavía no es nada. Son las que se piden a cada rato --se mira la
   * página, se comprueba que un desconocido no la ve, se vuelve-- y las tres
   * estan siempre, tenga la aplicación los roles que tenga.
   *
   * Debajo de la raya, los roles propios. Son los que cambian de una
   * aplicación a otra, y los que pueden ser muchos.
   *
   * Las dos primeras van rotuladas desde aqui porque no salen de ninguna
   * lista: no son un rol y no tienen nombre que ensenar.
   */
  const otherRoles = $derived(previewRoles.filter((r) => r !== ADMIN_ROLE));
  const previewOptions = $derived([
    { value: ADMIN_ROLE, label: ADMIN_ROLE },
    { value: ANON, label: "Sin un inicio de sesión" },
    { value: NO_ROLE, label: "Sin un rol" },
    // La raya la pide el primero de los roles propios, no la lista: asi una
    // aplicación que no tenga ninguno no acaba el menu en una línea suelta.
    ...otherRoles.map((role, i) => ({ value: role, label: role, linea: i === 0 })),
  ]);

  /**
   * Si se esta mirando con ojos ajenos.
   *
   * Mirar como `admin` es mirar como quien construye, que es lo normal: por eso
   * no enciende la barra. Cualquier otra salida --otro rol, o sin sesión-- si,
   * porque entonces lo que se ve no es lo que se tiene.
   */
  const previewing = $derived(preview.role !== ADMIN_ROLE);

  /*
   * Las personas con las que se puede mirar.
   *
   * Con un rol elegido, las que lo tienen. Sin rol, las que no tienen ninguno
   * --las invitadas a las que todavía no les nombraron uno--, que son
   * exactamente las que ven la aplicación asi. Sin sesión no hay ninguna que
   * ofrecer: quien llega sin cuenta no es nadie.
   */
  const people = getPeople();
  const candidates = $derived(
    previewRole
      ? people.list.filter((p) => p.roles.includes(previewRole))
      : previewNoRole
        ? people.list.filter((p) => p.roles.length === 0)
        : [],
  );

  /*
   * Lo recordado que ya no existe se suelta al llegar.
   *
   * Un rol se puede quitar de la aplicación --y se puede quitar mientras se
   * esta mirando con el--: sin esto, la barra se quedaria encendida diciendo
   * que se mira con un rol que no se llama de ninguna manera. Se vuelve a los
   * ojos de quien construye, que es de donde se salio.
   */
  $effect(() => {
    if (previewAnon || previewNoRole || previewRoles.includes(preview.role)) return;
    preview.pick(ADMIN_ROLE);
  });

  /*
   * Y la persona que ya no esta en la lista del rol elegido: se fue de la
   * aplicación, o le quitaron ese rol.
   *
   * Se espera a que el padron llegue --se pide al servidor, y hasta entonces
   * esta vacío-- porque si no, la persona recordada se soltaria siempre en el
   * primer dibujado, antes de que hubiera lista donde buscarla.
   */
  $effect(() => {
    if (!preview.person || !people.list.length) return;
    if (candidates.some((p) => p.id === preview.person)) return;
    preview.person = "";
  });

  /*
   * La persona con la que se mira, buscada entre las que ese rol ofrece: una
   * que ya no este ahi no vale, y hasta que el efecto de arriba la suelte esto
   * ya mira con el rol a secas.
   *
   * Viaja la persona entera y no su identificador: al servidor le basta el id,
   * pero el documento necesita ademas su nombre, su correo, sus roles y sus
   * columnas propias --su cédula, su cargo-- para que `plane.usuario` sea ella
   * entera. Con dos datos --el id por un lado y la ficha por otro-- cabria que
   * discreparan.
   */
  const previewPerson = $derived(candidates.find((p) => p.id === preview.person) ?? null);

  /**
   * Quien esta mirando, en lo que le hace falta saber a una página para decidir
   * si se abre. `null` es sin sesión, que es lo que ve quien llega sin cuenta.
   */
  const previewViewer = $derived(
    previewAnon
      ? null
      : previewPerson
        ? { roles: previewPerson.roles }
        : { roles: previewRole ? [previewRole] : [] },
  );

  /**
   * Las páginas que el sidebar enseña mientras se mira con ojos ajenos.
   *
   * Esconder --y no apagar-- lo que ese rol no abre es lo único que enseña la
   * navegacion que va a ver de verdad: en la aplicación publicada la lista
   * llega ya filtrada por el servidor, asi que una página apagada seria una
   * línea que alli no existe. Con `admin` no se filtra nada: quien construye
   * tiene que poder llegar a todas sus páginas.
   */
  const visiblePages = $derived(
    previewing ? builder.pages.filter((p) => canOpenPage(p, previewViewer)) : builder.pages,
  );

  /**
   * Como se nombra a una persona en este selector: por su correo entero.
   *
   * No por su nombre. El nombre de una persona invitada es el que traiga su
   * cuenta --en muchas aplicaciones, la cédula, o un apodo que no es el de su
   * correo--, y dos personas distintas pueden leerse igual. El correo es lo
   * único que no se repite, y es también lo que la página compara cuando
   * enseña "lo mio", asi que es lo que hay que poder reconocer aqui. Sin
   * cortar: medio correo no distingue a nadie.
   */
  const personLabel = (person: AppPerson) => person.email || person.name || "esa persona";

  const themeKey = $derived(JSON.stringify(app.theme));

  async function reload() {
    await builder.reloadPages();
    await builder.reloadApp();
  }

  /** Después de la IA hay que releerlo todo: pudo tocar tablas y página. */
  async function reloadAll() {
    await Promise.all([builder.reloadPages(), builder.reloadTables()]);
    await builder.reloadApp();
  }

  /**
   * El orden nuevo después de arrastrar una página en el sidebar.
   *
   * Solo se guardan las que cambiaron de sitio: mover la ultima arriba no tiene
   * por que escribir toda la lista. La lista se relee al terminar, que es lo
   * que la deja en el orden que ya se esta viendo.
   */
  async function reorderPages(ids: string[]) {
    hush();
    try {
      await Promise.all(
        ids.map((id, order) => {
          const before = builder.pages.find((p) => p.id === id);
          if (!before || before.order === order) return null;
          return pb.collection("pages").update(id, { order });
        }),
      );
      await builder.reloadPages();
    } catch (err) {
      fail(err);
      await builder.reloadPages();
    }
  }

  async function createPage() {
    hush();
    try {
      const count = builder.pages.length;
      const created = await pb.collection("pages").create<PageRecord>({
        app: app.id,
        name: defaultPageName(count),
        slug: `pagina-${Math.random().toString(36).slice(2, 8)}`,
        icon: DEFAULT_PAGE_ICON,
        order: count,
        isHome: count === 0,
      });
      await builder.reloadPages();
      navigate(`/a/${app.id}/app/${created.id}`);
    } catch (err) {
      fail(err);
    }
  }

  /** Un texto que agrupa a las páginas de alrededor. No se abre, asi que no navega. */
  async function createSeparator() {
    hush();
    try {
      const count = builder.pages.length;
      await pb.collection("pages").create<PageRecord>({
        app: app.id,
        name: "Nuevo grupo",
        slug: `separador-${Math.random().toString(36).slice(2, 8)}`,
        order: count,
        isHome: false,
        separator: true,
      });
      await builder.reloadPages();
    } catch (err) {
      fail(err);
    }
  }
</script>

<div id="page-stage" class="stage-page flex h-full">
  {#if builder.aiReady}
    <AiDock
      {app}
      {page}
      dock={builder.dock}
      onChangedAll={reloadAll}
      onNote={(text) => say("success", text)}
    />
  {/if}

  <!--
    El sidebar flotante se dibuja encima del documento, no del dock: por eso los
    dos comparten este envoltorio y el dock se queda fuera.

    La barra de dirección encabeza este envoltorio, no la ventana: cuenta el
    enlace de la página, asi que se queda encima de lo que se esta viendo
    --sidebar y documento-- y deja al dock su columna entera.
  -->
  <div id="page-stage-body" class="body-stage-page flex flex-col flex-1">
    <UrlBar
      {app}
      {page}
      aiReady={builder.aiReady}
      dock={builder.dock}
      onOpenCode={() => openPanel("code")}
      onOpenChanges={() => openPanel("changes")}
      onOpenAccess={openPublish}
      {previewOptions}
      previewValue={preview.role}
      {previewing}
      onPreviewRole={(value) => preview.pick(value)}
    />

    <!--
      Con quien se esta mirando la página. No simula nada: el servidor resuelve
      las ordenes de datos como si quien preguntara fuera ese rol, esa persona
      o nadie, porque una vista previa que demuestra que la pantalla se dibuja
      --y no que el permiso funciona-- es peor que no tenerla.

      Cruza la ventana entera, sidebar incluido, y no solo el documento: lo que
      cambia al mirar con otros ojos no es solo lo que la página enseña, es
      también que páginas hay. Una barra que tapara solo el documento diria que
      la navegacion de al lado sigue siendo la propia.

      Con `admin` no se dibuja: mirar como quien construye es lo normal, y una
      barra encendida siempre no avisa de nada.
    -->
    {#if previewing}
      <div class="bar-preview-role bar-preview-active flex items-center gap-2 shrink-0">
        <Icon name={ROLE_ICON} size={16} />
        <span class="text-preview-role">
          {#if previewAnon}
            Previsualizar <b>sin sesión</b>
          {:else if previewNoRole}
            Previsualizar <b>sin rol</b>
          {:else}
            Previsualizar con el rol: <b>"{previewRole}"</b>
          {/if}
        </span>

        <!--
          La persona es opcional y arranca vacía: sin ella se mira con ese rol
          y sin ser nadie en concreto, que es lo que basta para casi todo.
          Elegirla es lo que deja probar una pantalla que enseña "lo mio".

          El rol ya no se elige aqui: se elige en la barra de dirección, que es
          desde donde se entra a mirar. Tenerlo en los dos sitios dejaba dos
          mandos para la misma pregunta.
        -->
        <span class="side-preview-role flex items-center gap-2">
          {#if candidates.length}
            <select
              aria-label="Ver la página como una persona concreta"
              class="select-preview-person field-control sm"
              bind:value={preview.person}
            >
              <option value="">Sin persona</option>
              {#each candidates as person (person.id)}
                <option value={person.id}>{personLabel(person)}</option>
              {/each}
            </select>
          {/if}

          <Button
            size="sm"
            aria-label="Dejar de previsualizar"
            tip="Dejar de previsualizar"
            tipSide="bottom"
            onclick={() => preview.pick(ADMIN_ROLE)}
            buttonClass="btn-stop-preview-role"
            class="btn-ghost btn-icon sm"
          >
            <Icon name="cancel-01" size={16} />
          </Button>
        </span>
      </div>
    {/if}

    <div class="stage-layout flex flex-1">
      <AppSidebar
        {app}
        pages={visiblePages}
        activeId={page.id}
        onOpen={(p) => navigate(`/a/${app.id}/app/${p.id}`)}
        pinned={pin.pinned}
        onTogglePin={pin.toggle}
        builder={{
          onCreate: () => void createPage(),
          onCreateSeparator: () => void createSeparator(),
          onOpenPageSettings: (p) => {
            // Un separador no tiene documento que abrir: solo sus ajustes.
            if (!p.separator && p.id !== page.id) navigate(`/a/${app.id}/app/${p.id}`);
            settingsPanel = "page";
            settingsFor = p;
          },
          // Mientras se previsualiza la lista viene filtrada, asi que el orden
          // que llegaria de arrastrar seria el de un trozo: se retira.
          onReorder: previewing ? undefined : (ids) => void reorderPages(ids),
        }}
      />

      <main id="page-stage-main" class="main-stage-page flex-1 h-full">
        <!--
          La zona del documento es lo único que lleva el tema de la aplicación.
          El marco aislado lee de aqui los colores que le pasa al HTML; lo que
          queda fuera --dock, sidebar, avisos-- se ve con el tema del panel.
        -->
        <div data-theme={theme.name} class="doc-theme-surface h-full" {...paletteAttrs(app.theme)}>
          {#if empty}
            <div class="empty-doc flex h-full items-center justify-center">
              {#if blocks > 0}
                <div class="empty-doc-card flex flex-col items-center gap-3 text-center">
                  <p class="empty-doc-copy">
                    Esta página usa {blocks}
                    {blocks === 1 ? "bloque antiguo" : "bloques antiguos"}. Conviértela a HTML para
                    volver a mostrarla; podrás revisar el resultado antes de guardarlo.
                  </p>
                  <Button variant="secondary" size="sm" onclick={() => (converting = true)}>
                    <Icon name="magic-wand-01" size={13} /> Convertir a HTML
                  </Button>
                </div>
              {:else if builder.aiReady}
                <!--
                  Este estado usa la paleta de la aplicación. El botón abre el
                  chat y enfoca el campo de entrada.
                -->
                <div class="empty-blank-hero flex flex-col items-center text-center">
                  <p class="empty-blank-title">Página en blanco</p>
                  <p class="empty-blank-desc">
                    Describe la página que necesitas o suelta un archivo HTML para usarlo como base.
                  </p>
                  {#if !builder.dock.tooNarrow}
                    <div class="empty-blank-go">
                      <Button
                        variant="secondary"
                        size="sm"
                        buttonClass="btn-start-ai-chat"
                        onclick={() => builder.dock.askFocus()}
                      >
                        <Icon name="message-01" size={14} /> Abrir chat
                      </Button>
                    </div>
                  {/if}
                </div>
              {:else}
                <p class="empty-blank-copy text-center">
                  Suelta un archivo HTML o activa la inteligencia artificial en los ajustes.
                </p>
              {/if}
            </div>
          {:else}
            <div class="doc-layout flex flex-col h-full">
              <div class="doc-view flex-1">
                <!--
                  Cambiar con quien se mira vuelve a montar el marco: el
                  documento ya pidio sus datos al cargar y no los vuelve a
                  pedir solo.
                -->
                {#key `${previewRole}/${previewPerson?.id ?? ""}/${previewAnon}/${previewNoRole}`}
                  <PageView
                    {page}
                    appId={app.id}
                    client={pb}
                    {loadDoc}
                    roles={previewPerson ? previewPerson.roles : previewRole ? [previewRole] : []}
                    {previewRole}
                    {previewPerson}
                    {previewAnon}
                    {previewNoRole}
                    {themeKey}
                    showIssues
                    picking={picker.active}
                    onPick={emitPicked}
                    onPickerOff={() => setPickerActive(false)}
                  />
                {/key}
              </div>
            </div>
          {/if}
        </div>

        <!--
          `Note` se pinta en la capa de avisos, no aqui: ni el hueco
          posicionado ni el botón que lo envolvia llegaban a verse, y lo único
          que hacia el botón era cerrar el aviso al arrastrar sobre su texto en
          vez de dejarlo seleccionar.
        -->
        <Note kind={notice?.kind ?? "error"} message={notice?.text ?? ""} />
      </main>
    </div>
  </div>
</div>

<PageSettings
  open={!!settingsFor}
  initial={settingsPanel}
  {app}
  page={settingsFor ?? page}
  pages={builder.pages}
  onClose={() => (settingsFor = null)}
  onChanged={reload}
  onDeleted={() => navigate(`/a/${app.id}/app`)}
/>

<ConvertDialog
  open={converting}
  appId={app.id}
  {page}
  client={pb}
  appTheme={app.theme}
  {themeKey}
  onClose={() => (converting = false)}
  onDone={async (message) => {
    await builder.reloadPages();
    say("success", message);
  }}
/>

<style>
  .body-stage-page {
    min-width: 0;
  }

  /* El envoltorio que reparte entre sidebar y documento. */
  .stage-layout {
    position: relative;
    min-height: 0;
  }

  .main-stage-page {
    position: relative;
    min-width: 0;
  }

  /* La superficie del documento: lo único que lleva el tema de la aplicación. */
  .doc-theme-surface {
    background: var(--bg-level1);
  }

  .empty-doc {
    padding: 0 var(--sp-24);
  }

  /* La separacion va por `gap` y no por un margen entre hermanos: el segundo
     hijo es un componente, y una regla de hermanos no alcanza su raíz. */
  .empty-doc-card {
    max-width: 24rem;
  }

  .empty-doc-copy {
    font-size: var(--text-sm);
    color: var(--text-muted);
  }

  .empty-blank-copy {
    max-width: 24rem;
    font-size: var(--text-sm);
    color: var(--text-muted);
    text-align: center;
  }

  /*
   * El saludo de la página en blanco con la IA conectada: un título, la copia
   * y la salida. Es el mismo gesto de la portada de la conversación --ver
   * `.chat-hero` en AiPanel--, contado sobre el lienzo del documento.
   */
  .empty-blank-hero {
    max-width: 24rem;
  }

  .empty-blank-title {
    font-size: var(--text-base);
    line-height: var(--text-base--line-height);
    font-weight: 600;
    color: var(--text-primary);
  }

  .empty-blank-desc {
    margin-top: var(--sp-4);
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
    color: var(--text-secondary);
  }

  /* La salida, separada de la copia lo que se separaba la línea de espera:
     es lo único que hay que tocar en esta pantalla. */
  .empty-blank-go {
    margin-top: var(--sp-16);
  }

  .doc-layout {
    min-height: 0;
  }

  /*
   * Un quinto mas grande que el resto del chrome: es lo único de la pantalla
   * que avisa de que lo de abajo no es lo que se tiene, y con la medida de una
   * fila cualquiera se leia como un adorno mas de la barra de dirección.
   */
  .bar-preview-role {
    padding: var(--sp-6) var(--sp-12);
    font-size: calc(var(--text-xs) * 1.2);
  }

  .bar-preview-active {
    background: var(--warning);
    color: var(--bg-level1);
  }

  .text-preview-role {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Lo que se toca se va a la derecha, junto: elegir persona y salir de aqui. */
  .side-preview-role {
    margin-left: auto;
  }

  /*
   * Se ancha con lo que lleve dentro, en vez de una medida fija: un correo
   * cortado a la mitad no dice con quien se esta mirando, que es lo único que
   * este selector tiene que contar. El tope es para que una cuenta larguisima
   * no se coma la barra entera.
   */
  .select-preview-person {
    background-color: var(--bg-level2);
    width: auto;
    min-width: 11rem;
    max-width: 22rem;
    /* La misma subida del 20% que el resto de la barra: `field-control.sm` la
       fija en `--text-xs` y no se hereda. */
    font-size: calc(var(--text-xs) * 1.2);
  }

  /* La cruz se pinta con la tinta del aviso, no con la del panel: va sobre el
     amarillo, y el gris de un botón fantasma ahi no se lee. */
  .bar-preview-role :global(.btn-stop-preview-role) {
    color: inherit;
  }

  .doc-view {
    min-height: 0;
  }
</style>
