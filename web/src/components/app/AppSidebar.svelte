<!--
  El sidebar de una aplicación: la lista de sus páginas y como se va de una a
  otra.

  Lo ve todo el mundo. Lo que cambia es quien lo mira: a quien construye se le
  ofrecen ademas los ajustes de cada página --en los punticos de su línea--,
  cambiarlas de orden arrastrandolas y crear una nueva, que es el ultimo
  elemento de la lista; un visitante solo navega. La lista que llega ya viene
  filtrada por el servidor, asi que aqui no se esconde nada: lo que no se puede
  abrir no esta.

  Vive fuera del marco de la página, para que el HTML de la página no pueda
  romper la navegacion por mucho que se equivoque.

  La línea es siempre la misma caja, este o no el ratón encima: el hueco de los
  punticos esta reservado desde el principio, asi que nada se mueve al pasar
  por encima. La página abierta se marca con el color del acento, que a un
  golpe de vista dice donde se esta.

  Puede quedarse de dos maneras --del mismo ancho las dos, para que fijar no
  cambie de sitio lo que ya se estaba leyendo--, y se recuerda por aplicación:

  - **Flotante**: es un menu. Se abre con su icono, se dibuja encima del
    documento y se cierra solo en cuanto deja de hacer falta: al elegir página,
    al tocar fuera de el --el documento incluido-- o con Escape. Por eso no
    lleva botón de cerrar: cerrarlo es lo que pasa por si solo.
  - **Fijado**: ocupa su propia columna al lado del documento y se queda ahi,
    para saltar entre páginas sin abrirlo y cerrarlo cada vez.

  Las dos valen igual para quien construye y para quien visita la aplicación
  publicada: es una preferencia de quien mira, no del que la hizo. Quien la
  guarda es `lib/sidebarPin`; aqui solo llega el resultado.

  Ni el nombre ni el icono de la aplicación se repiten aqui cuando se esta
  construyendo: ya estan en el encabezado.
-->
<script lang="ts" module>
  import { pageIsLimited } from "@shared/pages";
  import { ADMIN_ROLE } from "@shared/people";
  import type { PageRecord } from "@shared/types";

  /**
   * A quien se le abrio una página, en una línea.
   *
   * No se lee con el ratón: es el nombre del sello para quien no lo ve. En
   * pantalla el icono se explica solo, y un globo aqui no cabe --a la derecha
   * tapa el botón de los ajustes, y arriba o abajo, las filas vecinas--.
   *
   * `admin` no entra en la cuenta: lo lleva toda página limitada --se lo pone
   * `withPageAdmin`-- asi que nombrarlo no distingue una página de otra. Sin el
   * no queda nadie en la página que solo ve quien construye, y esa se cuenta
   * con palabras: el nombre `admin` no significaria nada para quien lo lea. La
   * página de todos no llega hasta aqui: no lleva sello.
   */
  export function accessLabel(page: PageRecord): string {
    const roles = (page.roles ?? []).filter((r) => r !== ADMIN_ROLE);
    if (!roles.length) return "Solo quien construye la aplicación";
    return `Pueden ver: ${roles.join(", ")}`;
  }

  export interface SidebarBuilder {
    onCreate: () => void;
    /** Crea un separador: un texto que agrupa a las páginas de alrededor. */
    onCreateSeparator?: () => void;
    onOpenPageSettings: (page: PageRecord) => void;
    /** Los ids en el orden nuevo, después de arrastrar una página a otro sitio. */
    onReorder?: (ids: string[]) => void;
  }

  const storageKey = (appId: string) => `plane_sidebar_${appId}`;

  /**
   * Plegado salvo que quien mira lo haya dejado abierto. Empezar plegado es lo
   * que hace que el documento se vea entero la primera vez.
   */
  /**
   * Por debajo del punto de corte `md` del sistema (48rem) no se fija: una
   * columna de 18rem al lado del documento lo dejaba, en un telefono, en una
   * tira de un par de palabras. Ahi el sidebar es siempre el cajon flotante,
   * empieza plegado y la chincheta no se ofrece.
   */
  const NARROW_QUERY = "(max-width: 47.99rem)";

  function remembered(appId: string): boolean {
    try {
      return localStorage.getItem(storageKey(appId)) !== "0";
    } catch {
      return true;
    }
  }
</script>

<script lang="ts">
  import { ROLE_ICON } from "@shared/people";
  import type { AppTheme } from "@shared/types";
  import { type Snippet, untrack } from "svelte";

  import { aiActivity } from "../../lib/aiActivity.svelte";
  import { cx } from "../../lib/cx";
  import Icon from "../Icon.svelte";
  import { Button } from "../ui";
  import AppIcon from "./AppIcon.svelte";

  let {
    app,
    pages,
    activeId,
    onOpen,
    builder,
    headerActions,
    footer,
    pinned = false,
    onTogglePin,
  }: {
    app: { id: string; name: string; icon: string; theme?: AppTheme | null };
    pages: PageRecord[];
    activeId?: string;
    onOpen: (page: PageRecord) => void;
    /** Lo que solo se le ofrece a quien construye. Sin esto, es un visitante. */
    builder?: SidebarBuilder;
    /** Junto al nombre de la aplicación, arriba. Solo se ve sin `builder`. */
    headerActions?: Snippet;
    footer?: Snippet;
    /** Fijado: ocupa su columna al lado del documento en vez de taparlo. */
    pinned?: boolean;
    onTogglePin?: () => void;
  } = $props();

  /** La ventana es de telefono: no hay columna fija, solo el cajon. */
  let narrow = $state(matchMedia(NARROW_QUERY).matches);

  /** Fijado de verdad: se pidio fijar y la ventana da para una columna. */
  const docked = $derived(pinned && !narrow);

  // `untrack` porque leer la aplicación aqui es a propósito: es el valor de
  // partida, y lo que pase después lo recoge el efecto de abajo. En una
  // ventana estrecha se empieza plegado siempre: abierto taparia la página.
  let collapsed = $state(untrack(() => narrow || remembered(app.id)));

  // Cruzar el punto de corte: al estrecharse se pliega; al ensanchar vuelve lo
  // que quien mira tenia guardado para esta aplicación.
  $effect(() => {
    const query = matchMedia(NARROW_QUERY);
    const change = () => {
      narrow = query.matches;
      collapsed = narrow || remembered(untrack(() => app.id));
    };
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  });

  // Cambiar de aplicación trae la preferencia de la nueva, no la de la vieja.
  let lastApp = untrack(() => app.id);
  $effect(() => {
    if (app.id === lastApp) return;
    lastApp = app.id;
    collapsed = remembered(app.id);
  });

  // Plegado y desplegado es cosa de cada quien, y se recuerda por aplicación.
  // Lo que se hace en una ventana estrecha no cuenta: alli se pliega solo, y
  // guardarlo dejaria plegado el sidebar de escritorio sin que nadie lo pidiera.
  $effect(() => {
    if (narrow) return;
    try {
      localStorage.setItem(storageKey(app.id), collapsed ? "1" : "0");
    } catch {
      /* sin memoria del navegador, el sidebar simplemente vuelve a empezar plegado */
    }
  });

  /* ---------------------------------------------------------------- */
  /* Cambiar el orden arrastrando                                      */
  /* ---------------------------------------------------------------- */

  /**
   * Arrastrar una página a otro sitio de la lista.
   *
   * El orden es un campo de la página, asi que hasta ahora había que abrir algo
   * para cambiarlo; aqui se hace donde se ve. `at` es el hueco donde caeria
   * --el índice al que iria, contando los huecos y no las líneas--, y lo decide
   * de que mitad de la línea esta el puntero.
   *
   * Los eventos se paran aqui a propósito: el editor entero es zona de soltar
   * archivos HTML, y arrastrar una página no es traer un archivo.
   */
  let draggingId = $state<string | null>(null);
  let at = $state<number | null>(null);

  const canDrag = $derived(!!builder?.onReorder && pages.length > 1);

  /**
   * El hueco donde se dibuja la línea, que no es siempre `at`: soltar en el
   * hueco de antes o el de después de la propia página la deja donde estaba.
   * Esos dos no se marcan, para que la línea signifique siempre lo mismo --se
   * va a mover ahi-- y no prometa un cambio que no va a pasar.
   */
  const dropAt = $derived.by(() => {
    if (draggingId === null || at === null) return null;
    const from = pages.findIndex((p) => p.id === draggingId);
    if (from < 0 || at === from || at === from + 1) return null;
    return at;
  });

  const endDrag = () => {
    draggingId = null;
    at = null;
  };

  const startDrag = (id: string, e: DragEvent) => {
    e.stopPropagation();
    if (!e.dataTransfer) return;
    e.dataTransfer.effectAllowed = "move";
    // Firefox no empieza a arrastrar si no viaja algo en el evento.
    e.dataTransfer.setData("text/plain", id);
    draggingId = id;
  };

  const overDrag = (index: number, e: DragEvent & { currentTarget: HTMLElement }) => {
    if (!draggingId) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    const box = e.currentTarget.getBoundingClientRect();
    at = e.clientY < box.top + box.height / 2 ? index : index + 1;
  };

  const dropDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const from = pages.findIndex((p) => p.id === draggingId);
    const to = at;
    endDrag();
    if (from < 0 || to === null || to === from || to === from + 1) return;
    const ids = pages.map((p) => p.id);
    const [moved] = ids.splice(from, 1);
    if (!moved) return;
    ids.splice(to > from ? to - 1 : to, 0, moved);
    builder?.onReorder?.(ids);
  };

  /**
   * Elegir página lo pliega mientras flota: esta encima del documento y ya
   * cumplio su único trabajo. Fijado no se mueve, que para eso se fijo.
   */
  const open = (page: PageRecord) => {
    if (!docked) collapsed = true;
    onOpen(page);
  };

  /* ---------------------------------------------------------------- */
  /* Flotante: se comporta como un menu                                */
  /* ---------------------------------------------------------------- */

  /**
   * Abierto encima del documento, se cierra en cuanto se atiende a otra cosa:
   * tocar fuera, Escape, o llevarse el foco al marco de la página --que es un
   * documento aparte y no manda su click aqui, asi que se lee por el foco--.
   *
   * Solo escucha mientras flota y esta abierto: fijado no se cierra por tocar
   * el documento, que para eso se fijo.
   */
  let box = $state<HTMLElement | null>(null);

  $effect(() => {
    if (docked || collapsed || !box) return;
    const el = box;

    const outside = (e: PointerEvent) => {
      const target = e.target;
      if (target instanceof Node && el.contains(target)) return;
      collapsed = true;
    };

    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      collapsed = true;
    };

    // El foco se fue al marco de la página: por dentro el click no se ve.
    const away = () => {
      if (document.activeElement?.tagName === "IFRAME") collapsed = true;
    };

    // En captura, para que nada de lo de abajo se lo trague antes.
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape, true);
    window.addEventListener("blur", away);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("blur", away);
    };
  });

  /**
   * Soltarlo deja a la vista lo que estaba fijado, ya como menu abierto: si se
   * plegara de golpe, la lista desapareceria justo donde se acaba de tocar.
   */
  const togglePin = () => {
    if (pinned) collapsed = false;
    onTogglePin?.();
  };
</script>

<!-- La línea que dice donde caeria la página que se esta arrastrando. -->
{#snippet dropLine()}
  <span aria-hidden="true" class="drop-line"></span>
{/snippet}

<!--
  El icono con el que se resume quien abre una página.

  Solo se dibuja la excepcion --tener roles marcados--, y con el icono con el
  que los roles se reconocen en todas partes. La página que abre cualquiera es
  la norma y no lleva sello: en una lista, un icono repetido en todas las
  líneas no dice nada y le quita fuerza al que si.

  Sin globo: el sello se retira al pasar el ratón --le deja el hueco al botón
  de los ajustes-- asi que ir a senalarlo es justo lo que lo hace desaparecer,
  y colgarlo de la fila entera tapa lo de al lado. Los roles se leen donde se
  marcan, en los ajustes de la página.
-->
{#snippet accessMark(page: PageRecord)}
  {#if pageIsLimited(page)}
    <span role="img" aria-label={accessLabel(page)}>
      <Icon name={ROLE_ICON} size={18} />
    </span>
  {/if}
{/snippet}

{#if collapsed && !docked}
  <div id="app-sidebar-collapsed" class="sidebar-app-collapsed flex flex-col items-center gap-2">
    <Button
      tip="Desplegar la navegación"
      aria-label="Desplegar la navegación"
      size="sm"
      onclick={() => {
        collapsed = false;
      }}
      buttonClass="btn-expand-sidebar"
      class="btn-icon btn-expand-sidebar-look"
    >
      <Icon name="panel-left" size={16} />
    </Button>
  </div>
{:else}
  <aside
    id="app-sidebar"
    bind:this={box}
    class={cx("sidebar-app flex flex-col", docked ? "pinned" : "floating", narrow && "is-narrow")}
  >
    <!-- Quien visita la aplicación publicada no tiene encabezado arriba: aqui
         es donde se entera de en que aplicación esta. -->
    {#if !builder}
      <div class="sidebar-head">
        <AppIcon {app} />
        <span class="app-name">{app.name}</span>
        {#if headerActions}
          <div class="sidebar-head-actions">
            {@render headerActions()}
          </div>
        {/if}
      </div>
    {/if}

    <nav aria-label="Páginas de la aplicación" class="nav-pages">
      <!-- La lista se explica sola: el nombre de cada página y los separadores
           que las agrupan dicen mas que un título encima. Fijar es lo único
           que queda en la fila, porque mientras flota se cierra solo. -->
      {#if onTogglePin && !narrow}
        <div class="nav-pages-head">
          <Button
            tip={pinned ? "Dejar flotando" : "Fijar la navegación"}
            aria-label={pinned ? "Dejar flotando" : "Fijar la navegación"}
            aria-pressed={pinned}
            size="sm"
            onclick={togglePin}
            tipSide="bottom"
            buttonClass="btn-toggle-pin-sidebar"
            class="btn-ghost btn-icon"
          >
            <Icon name={pinned ? "pin-off" : "pin"} size={14} />
          </Button>
        </div>
      {/if}

      <ul id="app-sidebar-pages" class="list-pages">
        {#each pages as page, index (page.id)}
          {#if page.separator}
            <!-- No es una página: solo un texto que agrupa a las de alrededor.
                 Se arrastra igual que cualquier fila, pero no se abre ni marca
                 "activa". -->
            <li
              class={cx(
                "sidebar-page-row",
                "sidebar-separator-row",
                draggingId === page.id && "sidebar-page-dragging",
              )}
              draggable={canDrag}
              ondragstart={canDrag ? (e) => startDrag(page.id, e) : undefined}
              ondragover={canDrag ? (e) => overDrag(index, e) : undefined}
              ondrop={canDrag ? dropDrag : undefined}
              ondragend={canDrag ? endDrag : undefined}
            >
              {#if dropAt === index}
                {@render dropLine()}
              {/if}

              <span class="sidebar-separator-label eyebrow">{page.name}</span>

              <!-- El mismo sello que en una página: dice que el grupo esta
                   limitado a unos roles, y se retira al pasar el ratón para
                   dejarle el hueco al botón de los ajustes. -->
              {#if builder}
                <div class="btn-right">{@render accessMark(page)}</div>
                <Button
                  aria-label={`Ajustes del separador "${page.name}"`}
                  onclick={() => builder.onOpenPageSettings(page)}
                  class="btn btn-ghost btn-icon btn-page-settings btn-settings-separator"
                >
                  <Icon name="more-vertical" size={20} />
                </Button>
              {/if}
            </li>
          {:else}
            {@const active = page.id === activeId}
            <li
              class={cx(
                "sidebar-page-row",
                active ? "sidebar-page-active" : "sidebar-page-idle",
                draggingId === page.id && "sidebar-page-dragging",
              )}
              draggable={canDrag}
              ondragstart={canDrag ? (e) => startDrag(page.id, e) : undefined}
              ondragover={canDrag ? (e) => overDrag(index, e) : undefined}
              ondrop={canDrag ? dropDrag : undefined}
              ondragend={canDrag ? endDrag : undefined}
            >
              <!-- Donde caeria la página que se arrastra. -->
              {#if dropAt === index}
                {@render dropLine()}
              {/if}

              <button
                type="button"
                onclick={() => open(page)}
                aria-current={active ? "page" : undefined}
                class="btn btn-ghost btn-open-page sidebar-page-btn"
              >
                <Icon name={page.icon} size={20} class="sidebar-page-icon" />
                <span class="sidebar-page-name">{page.name}</span>

                <div class="btn-right">
                  <!-- La IA esta trabajando en esta página. Es la única senal que
                     queda desde otra página: la fila dice en cual trabaja, y
                     abrirla es el clic que la fila ya hacia. Va fuera de los
                     sellos permanentes porque esos se retiran al pasar el
                     ratón, y esta no puede apagarse justo al ir a pulsarla. -->
                  {#if builder && aiActivity.has(page.id)}
                    <span
                      role="img"
                      data-tip="Se está trabajando aquí"
                      data-tip-side="right"
                      aria-label="Se está trabajando aquí"
                      class="sidebar-page-ai"
                    >
                      <Icon name="ai-magic" size={18} />
                    </span>
                  {/if}

                  {#if page.isHome}
                    <span role="img" aria-label="Página de inicio">
                      <Icon name="home-11" size={18} />
                    </span>
                  {/if}
                  {#if builder}
                    {@render accessMark(page)}
                  {/if}
                </div>
              </button>

              {#if builder}
                <div>
                  <Button
                    aria-label={`Ajustes de "${page.name}"`}
                    onclick={() => builder.onOpenPageSettings(page)}
                    class="btn btn-ghost btn-icon btn-page-settings"
                  >
                    <Icon name="more-vertical" size={20} />
                  </Button>
                </div>
              {/if}
            </li>
          {/if}
        {/each}

        <!-- La ultima posicion: soltar debajo de todo manda la página al final. -->
        {#if dropAt === pages.length}
          <li aria-hidden="true" class="drop-target-end">{@render dropLine()}</li>
        {/if}

        {#if pages.length === 0}
          <li class="sidebar-empty">
            {builder ? "Todavía no hay ninguna página." : "No hay páginas que puedas abrir."}
          </li>
        {/if}

        <!-- Crear una página es el siguiente elemento de la lista, no un botón
             aparte: se pide donde terminan las que ya hay. El separador va al
             lado, mas chico: se crea mucho menos seguido. -->
        {#if builder}
          <li class="sidebar-new-row flex items-center gap-1">
            <button
              type="button"
              onclick={builder.onCreate}
              class="btn btn-ghost btn-new-page sidebar-new-page-btn"
            >
              <Icon name="file-add" size={18} class="sidebar-new-page-icon" />
              <span class="sidebar-new-page-label">Nueva página</span>
            </button>
            {#if builder.onCreateSeparator}
              <Button
                tip="Nuevo separador"
                aria-label="Nuevo separador"
                size="sm"
                onclick={builder.onCreateSeparator}
                tipSide="top"
                class="btn btn-ghost btn-icon btn-new-separator"
              >
                <Icon name="separator-horizontal" size={14} />
              </Button>
            {/if}
          </li>
        {/if}
      </ul>
    </nav>

    {#if footer}
      <div class="sidebar-foot">
        {@render footer()}
      </div>
    {/if}
  </aside>
{/if}

<style>
  /* ------------------------------------------------ */
  /* Plegado: el botoncito que devuelve la navegacion  */
  /* ------------------------------------------------ */

  /* Absoluto dentro de la escena, no fijo en la ventana: asi cae al borde del
     documento y nunca sobre lo que haya a su izquierda, como el dock. La tira
     baja hasta el fondo y el botón vive arriba, donde siempre se lo busco. */
  .sidebar-app-collapsed {
    position: absolute;
    top: var(--sp-8);
    bottom: 0;
    left: var(--sp-12);
    z-index: 10;
    padding: var(--sp-10) 0;

    & :global(.btn-expand-sidebar-look) {
      border-radius: 62.5rem;
      box-shadow: var(--shadow-sm);
    }
  }

  /* ------------------------------------------------ */
  /* El sidebar abierto                                 */
  /* ------------------------------------------------ */

  .sidebar-app {
    /* El mismo ancho de las dos maneras: fijarlo o soltarlo cambia donde se
       dibuja, no cuanto mide, asi que la lista no se recompone al hacerlo. */
    --sidebar-width: 18rem;

    background: var(--bg-sidebar);
    width: var(--sidebar-width);

    /* El borde cae del lado por el que se toca el documento: el sidebar vive a
       la izquierda, asi que el borde va a su derecha. */
    border-right: var(--border-width) solid var(--border);

    &.pinned {
      position: relative;
      flex-shrink: 0;
      z-index: 10;
    }

    &.floating {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      z-index: 10;
      box-shadow: var(--shadow-sm);
    }

    /* En el telefono el cajon tapa casi todo: se levanta como lo que flota
       --modal, cajon-- y deja siempre una franja del documento a la vista,
       que es donde se toca para cerrarlo. */
    &.is-narrow {
      max-width: calc(100vw - 3rem);
      box-shadow: var(--shadow-lg);
    }

    /* Quien visita no tiene encabezado arriba: se le presenta la aplicación. */
    & .sidebar-head {
      display: flex;
      align-items: center;
      gap: var(--sp-8);
      padding: var(--sp-8) var(--sp-14);
      border-bottom: var(--border-width) solid var(--border);

      & .app-name {
        min-width: 0;
        flex: 1 1 0%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 600;
        font-size: var(--text-sm);
        line-height: var(--text-sm--line-height);
      }

      & .sidebar-head-actions {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        gap: var(--sp-4);
      }
    }

    & .nav-pages {
      display: flex;
      flex-direction: column;
      flex: 1 1 0%;
      min-height: 0;

      /* Sin título que la acompane, la fila es solo el sitio de fijar: se queda
         al final para no cambiar de lado al soltar el sidebar. */
      & .nav-pages-head {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding: var(--sp-6) var(--sp-8);
      }

      & .list-pages {
        display: flex;
        min-height: 0;
        flex: 1 1 0%;
        flex-direction: column;
        gap: 0.125rem;
        overflow-y: auto;
        padding: 0 var(--sp-14) var(--sp-8);

        & .sidebar-page-row {
          --page-icon-size: 1.25rem;
          --page-seal-size: 1.125rem;
          --page-settings-size: 1.75rem;

          display: flex;
          position: relative;
          align-items: center;
          gap: var(--sp-4);
          color: var(--text-secondary);
          border-radius: var(--radius-md);
          transition:
            background-color 150ms,
            color 150ms;

          /* Un tinte del acento, no el acento entero: el nombre en negrita
             acompana al color y con eso se sabe cual esta abierta. */
          &.sidebar-page-active {
            .sidebar-page-btn {
              background: var(--accent-soft);
              color: var(--accent-soft-text);
            }
          }

          &.sidebar-page-dragging {
            opacity: 0.4;
          }

          /* La senal de la IA: lo único de la fila que cambia solo, asi que
               late en vez de quedarse quieta. */
          & .sidebar-page-ai {
            display: flex;
            flex: none;
            align-items: center;
            justify-content: center;
            width: var(--page-seal-size);
            height: var(--page-seal-size);
            line-height: 0;
            color: var(--accent);
            animation: sidebar-ai-pulse 1.6s ease-in-out infinite;
          }

          /* Separador */
          &.sidebar-separator-row {
            min-height: 2.5rem;

            /* Separador de texto */
            /* El rotulo es `.eyebrow` del catálogo; aqui solo su sitio en la
               fila y el recorte, que el nombre lo escribe quien construye. */
            & .sidebar-separator-label {
              padding-left: var(--sp-10);
              min-width: 0;
              flex: 1 1 0%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            /* Los sellos de la derecha: `.btn-right` viste los de una página
               dentro de su botón, y un separador no tiene botón. */
            & .btn-right {
              display: inline-flex;
              flex: none;
              transition: opacity 150ms;
            }

            /* botón seetings */
            :global(.btn-settings-separator) {
              height: 100%;
              min-height: auto;
            }
          }

          /* Botón de cada página*/
          & .sidebar-page-btn {
            width: 100%;
            text-align: left;
            color: inherit;
            font-weight: 500;
            padding-right: 0px;
            transition:
              background-color 150ms,
              color 150ms;

            .sidebar-page-active &.btn-open-page {
              padding-right: var(--sp-14);
            }

            /* Icono de la página */
            & :global(.sidebar-page-icon) {
              display: flex;
              flex: none;
              align-items: center;
              justify-content: center;
              width: var(--page-icon-size);
              height: var(--page-icon-size);
              line-height: 0;
              color: inherit;
              transition: color 150ms;
            }

            /* Nombre de la página */
            & .sidebar-page-name {
              flex: 1 1 auto;
              min-width: 0;
              white-space: normal;
              overflow-wrap: anywhere;
            }

            /* Iconos de la derecha */
            & .btn-right {
              display: inline-flex;
              gap: var(--sp-4);

              span {
                display: inline-flex;
              }
            }
          }

          /* Botón settings pero de los speradores */
          & :global(.btn-page-settings) {
            display: none;
          }

          &:hover {
            & .btn-right {
              opacity: 0;
            }

            & :global(.btn-page-settings) {
              display: inline-flex;
            }
          }

          /* La guía de bienvenida señala este botón en uno de sus pasos, y ahí
             tiene que verse sin el puntero encima. La marca la pone el propio
             recorrido en la raíz del documento; ver `guide/GuideTour.svelte`.
             Los separadores se quedan fuera: el paso habla de una página. */
          :global(html[data-guide-reveal="page-settings"]) &:not(.sidebar-separator-row) {
            & :global(.btn-page-settings) {
              display: inline-flex;
            }
          }
        }

        /* El hueco donde caeria la página arrastrada.

           Absoluta sobre la fila --que es `position: relative`-- y no un hijo
           mas: dentro del flujo la fila es una caja flex y la línea se quedaba
           sin ancho, o sea invisible. Asi cruza la fila entera y se dibuja
           justo en el hueco de arriba, que es el sitio al que iria. */
        & .drop-line {
          pointer-events: none;
          position: absolute;
          top: -0.125rem;
          right: 0;
          left: 0;
          z-index: 1;
          height: 0.125rem;
          border-radius: 62.5rem;
          background: var(--accent);
        }

        /* La ultima posicion no ocupa alto: solo sostiene a la línea. */
        & .drop-target-end {
          position: relative;
          height: 0;

          & .drop-line {
            top: 0;
          }
        }

        & .sidebar-empty {
          padding: 0 var(--sp-8) var(--sp-24);
          text-align: center;
          font-size: var(--text-xs);
          line-height: var(--text-xs--line-height);
          color: var(--text-muted);
        }

        & .sidebar-new-row {
          width: 100%;
        }

        & .sidebar-new-page-btn {
          flex: 1 1 0%;
          gap: var(--sp-11);
          text-align: left;
          font-weight: 500;
          color: var(--text-muted);

          &:hover {
            color: var(--text-primary);
          }

          &:focus-visible {
            outline: 2px solid var(--accent);
            outline-offset: 1px;
          }

          & :global(.sidebar-new-page-icon) {
            flex-shrink: 0;
          }

          & .sidebar-new-page-label {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      }
    }

    & .sidebar-foot {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      gap: var(--sp-8);
      border-top: var(--border-width) solid var(--border);
      padding: var(--sp-10) var(--sp-14);
    }
  }

  /* Quien prefiere que nada se mueva no recibe el latido: el color basta. */
  @keyframes sidebar-ai-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sidebar-page-ai {
      animation: none;
    }
  }
</style>
