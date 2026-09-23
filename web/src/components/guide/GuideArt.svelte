<!--
  El dibujo de cada pantalla de la guía.

  Es siempre la misma maqueta del editor --barra arriba, lista a un lado,
  documento en medio-- y lo que cambia es que se enciende en cada paso: la
  columna de la IA, la cuadricula, el botón de publicar. Repetir el marco es lo
  que hace que las ocho pantallas se lean como un recorrido por un mismo sitio
  y no como ocho dibujos sueltos.

  No es una captura ni pretende serlo: son bloques de color con los tokens del
  panel, así que sigue a la paleta y al tema sin que nadie lo repinte. Es
  decoracion, y por eso va entero bajo `aria-hidden`: lo que hay que entender
  está escrito al lado, en el texto del paso.
-->
<script lang="ts" module>
  /** Cuál de las ocho pantallas se está dibujando. */
  export type ArtKind =
    "welcome" | "drop" | "ai" | "data" | "people" | "preview" | "settings" | "publish";
</script>

<script lang="ts">
  import { ROLE_ICON } from "@shared/people";

  import { cx } from "../../lib/cx";
  import Icon from "../Icon.svelte";

  let { kind }: { kind: ArtKind } = $props();

  /** En que mitad del editor pasa la cosa: las tablas o las páginas. */
  const onData = $derived(kind === "data" || kind === "people");

  /**
   * La marca que señala el control del que habla el paso.
   *
   * Se pone sobre el elemento de la maqueta que en el editor de verdad se
   * pulsa --el botón de publicar, la pestana de las tablas, el selector de
   * rol--, y late hasta que el paso cambia. Es la mitad de lo que enseña cada
   * pantalla: primero donde se hace, después que pasa.
   */
  const spot = (mine: ArtKind | ArtKind[]) =>
    (Array.isArray(mine) ? mine.includes(kind) : mine === kind) && "is-spot";

  /** Las líneas de la lista lateral. Anchos distintos, como una lista de verdad. */
  const PAGES = ["Inicio", "Pedidos", "Clientes", "Informe"];
  const TABLES = ["Personas y roles", "Pedidos", "Productos"];

  /** Las filas de la cuadricula, con el ancho de cada celda en porcentaje. */
  const ROWS = [
    [58, 34, 70],
    [42, 62, 48],
    [66, 40, 56],
  ];
</script>

<div class={cx("art-guide", `art-${kind}`)} aria-hidden="true">
  <div class="art-window">
    <div class="art-bar">
      <span class={cx("art-identity", spot("settings"))}>
        <span class="art-app-icon"></span>
        <span class="art-app-name">Mi aplicación</span>
      </span>

      <span class="art-tabs">
        <span class={cx("art-tab", !onData && "on")}>Páginas</span>
        <span class={cx("art-tab", onData && "on", spot("data"))}>Base de datos</span>
      </span>

      <span class={cx("art-publish", kind === "publish" && "on", spot("publish"))}>
        <Icon name="zap" size={11} />
        Publicar
      </span>
    </div>

    <div class="art-main">
      {#if kind === "ai" || kind === "welcome"}
        <div class="art-dock">
          <span class="art-bubble"></span>
          <span class="art-bubble art-bubble-mine"></span>
          <span class="art-bubble"></span>
          {#if kind === "ai"}
            <span class="art-composer">
              <span class="art-caret"></span>
            </span>
          {/if}
        </div>
      {/if}

      <div class="art-rail">
        {#each onData ? TABLES : PAGES as name, i (name)}
          <span class={cx("art-rail-item", onData && i === 0 && "on", i === 0 && spot("people"))}>
            <Icon name={onData ? (i === 0 ? ROLE_ICON : "table-01") : "file-02"} size={11} />
            <span class="art-rail-name">{name}</span>
          </span>
        {/each}
      </div>

      <div class="art-canvas">
        {#if kind === "drop"}
          <span class={cx("art-dropzone", spot("drop"))}>
            <Icon name="file-upload" size={20} />
            Suelta el archivo
          </span>
          <span class="art-file">
            <Icon name="csv-01" size={14} />
            clientes.csv
          </span>
        {:else if kind === "data"}
          <div class="art-grid">
            <span class="art-grid-head">
              <span></span>
              <span></span>
              <span></span>
            </span>
            {#each ROWS as row, i (i)}
              <span class="art-grid-row">
                {#each row as width, j (j)}
                  <span class="art-cell" style="width: {width}%"></span>
                {/each}
              </span>
            {/each}
          </div>
          <span class="art-file">
            <Icon name="csv-01" size={14} />
            pedidos.xlsx
          </span>
        {:else if kind === "people"}
          <span class="art-tool">
            <Icon name={ROLE_ICON} size={11} />
            Roles
          </span>
          <div class="art-people">
            <span class="art-person">
              <span class="art-avatar tint-1"></span>
              <span class="art-person-name"></span>
              <span class="tag tint-1">admin</span>
            </span>
            <span class="art-person">
              <span class="art-avatar tint-2"></span>
              <span class="art-person-name short"></span>
              <span class="tag tint-2">ventas</span>
            </span>
            <span class="art-person">
              <span class="art-avatar tint-3"></span>
              <span class="art-person-name"></span>
              <span class="tag tint-3">bodega</span>
            </span>
          </div>
        {:else if kind === "ai"}
          <!-- La barra de dirección con su botón de la IA, que es por donde se
               trae y se esconde la columna de la conversación. -->
          <span class="art-url">
            <span class={cx("art-ai-btn", spot("ai"))}>
              <Icon name="ai-magic" size={11} />
            </span>
            <span class="art-url-text">/p/mi-aplicacion</span>
          </span>
          <div class="art-page">
            <span class="art-block w-70"></span>
            <span class="art-block w-100 tall"></span>
            <span class="art-block w-45"></span>
          </div>
        {:else if kind === "preview"}
          <span class="art-url">
            <Icon name="lock" size={11} />
            <span class="art-url-text">/p/mi-aplicacion</span>
            <span class={cx("art-role", spot("preview"))}>
              <Icon name="eye" size={11} />
              ventas
            </span>
          </span>
          <div class="art-page">
            <span class="art-block w-70"></span>
            <span class="art-block w-100 tall"></span>
            <span class="art-block w-45 hidden-block"></span>
          </div>
        {:else if kind === "settings"}
          <div class="art-cards">
            <span class="art-mini-card">
              <span class="art-mini-head">
                <span class="art-app-icon"></span>
                <span class="art-block w-60"></span>
              </span>
              <span class="art-swatches">
                <i class="tint-1"></i>
                <i class="tint-2"></i>
                <i class="tint-3"></i>
                <i class="tint-4"></i>
              </span>
            </span>
            <span class="art-mini-card">
              <span class="art-mini-head">
                <span class={cx("art-dots-btn", spot("settings"))}>
                  <Icon name="more-horizontal" size={12} />
                </span>
                <span class="art-block w-45"></span>
              </span>
              <span class="art-block w-100"></span>
              <span class="art-block w-70"></span>
            </span>
          </div>
        {:else if kind === "publish"}
          <span class="art-card-publish">
            <span class="art-switch"><i></i></span>
            <span class="art-link">
              <Icon name="globe" size={11} />
              /p/mi-aplicacion
            </span>
          </span>
          <div class="art-page">
            <span class="art-block w-70"></span>
            <span class="art-block w-100 tall"></span>
          </div>
        {:else}
          <div class="art-page">
            <span class="art-block w-60"></span>
            <span class="art-block w-100 tall"></span>
            <span class="art-block w-45"></span>
            <span class="art-block w-80"></span>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  /*
   * La maqueta: una ventana del editor a escala, dibujada con los tokens del
   * panel. Todo lo de aquí es de este dibujo y de ningún otro sitio, así que
   * vive en este `<style>` y no en el catálogo.
   */
  .art-guide {
    display: grid;
    place-items: center;
    height: 100%;
    padding: var(--sp-10);
  }

  .art-window {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 30rem;
    height: 100%;
    overflow: hidden;
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--bg-level2);
    box-shadow: var(--shadow-md);
  }

  .art-bar {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--sp-10);
    padding: var(--sp-8) var(--sp-10);
    border-bottom: var(--border-width) solid var(--border);

    & .art-identity {
      display: flex;
      align-items: center;
      gap: var(--sp-6);
      min-width: 0;
    }

    & .art-app-name {
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--text-secondary);
      white-space: nowrap;
    }

    & .art-tabs {
      display: flex;
      gap: 0.125rem;
      margin-inline: auto;
      padding: 0.125rem;
      border-radius: 62.5rem;
      background: var(--bg-field);
    }

    & .art-tab {
      padding: 0.125rem var(--sp-8);
      border-radius: 62.5rem;
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--text-muted);
      white-space: nowrap;

      &.on {
        background: var(--bg-level2);
        color: var(--text-primary);
        box-shadow: var(--shadow-sm);
      }
    }

    & .art-publish {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      padding: 0.125rem var(--sp-8);
      border-radius: var(--radius-sm);
      border: var(--border-width) solid var(--border);
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--text-muted);
      white-space: nowrap;

      /* El paso de publicar: el botón se enciende y el resto se queda quieto. */
      &.on {
        border-color: transparent;
        background: var(--accent);
        color: var(--accent-text);
        box-shadow: 0 0.5rem 1.25rem -0.625rem var(--accent);
      }
    }
  }

  /* El cuadradito de la marca, que en el panel lleva el color de la aplicación. */
  .art-app-icon {
    flex: none;
    width: 1rem;
    height: 1rem;
    border-radius: var(--radius-sm);
    background: var(--accent);
  }

  .art-main {
    flex: 1;
    display: flex;
    min-height: 0;
  }

  /* La columna de la IA, a la izquierda de la escena, como en el editor. */
  .art-dock {
    flex: none;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: var(--sp-6);
    width: 6.5rem;
    padding: var(--sp-10) var(--sp-8);
    border-right: var(--border-width) solid var(--border);
    background: var(--bg-sidebar);

    & .art-bubble {
      height: 1.5rem;
      border-radius: var(--radius-sm);
      background: var(--bg-field);
    }

    & .art-bubble-mine {
      margin-left: var(--sp-10);
      height: 1rem;
      background: var(--accent-soft);
    }

    & .art-composer {
      display: flex;
      align-items: center;
      height: 1.25rem;
      margin-top: var(--sp-4);
      padding-inline: var(--sp-6);
      border-radius: var(--radius-sm);
      border: var(--border-width) solid var(--accent);
      background: var(--bg-level2);
      box-shadow: 0 0 0 0.1875rem var(--focus-ring);
    }

    & .art-caret {
      width: 0.0625rem;
      height: 0.625rem;
      background: var(--accent);
    }
  }

  .art-rail {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    width: 8.5rem;
    padding: var(--sp-10) var(--sp-8);
    border-right: var(--border-width) solid var(--border);
    background: var(--bg-sidebar);

    & .art-rail-item {
      display: flex;
      align-items: center;
      gap: var(--sp-6);
      padding: 0.1875rem var(--sp-6);
      border-radius: var(--radius-sm);
      font-size: var(--text-xs);
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;

      &.on {
        background: var(--accent-soft);
        color: var(--accent-soft-text);
        font-weight: 600;
      }
    }

    & .art-rail-name {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .art-canvas {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--sp-8);
    min-width: 0;
    padding: var(--sp-12);
    background: var(--bg-level1);
  }

  /* El documento: bloques de una página cualquiera. */
  .art-page {
    display: flex;
    flex-direction: column;
    gap: var(--sp-8);
  }

  .art-block {
    height: 0.5rem;
    border-radius: 62.5rem;
    background: var(--bg-field);

    &.tall {
      height: 2.25rem;
      border-radius: var(--radius-sm);
    }

    /* Lo que un rol no puede ver: sigue ahí, pero no se lee. */
    &.hidden-block {
      background: repeating-linear-gradient(
        45deg,
        var(--bg-field),
        var(--bg-field) 0.25rem,
        transparent 0.25rem,
        transparent 0.5rem
      );
      opacity: 0.7;
    }
  }

  .w-45 {
    width: 45%;
  }
  .w-60 {
    width: 60%;
  }
  .w-70 {
    width: 70%;
  }
  .w-80 {
    width: 80%;
  }
  .w-100 {
    width: 100%;
  }

  /* ---- Soltar un archivo ---- */

  .art-dropzone {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--sp-8);
    border: 0.125rem dashed var(--accent);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--accent) 5%, var(--bg-level1));
    color: var(--accent-soft-text);
    font-size: var(--text-xs);
    font-weight: 600;
  }

  /* El archivo que llega: flota sobre el documento, como el puntero al soltar. */
  .art-file {
    position: absolute;
    top: var(--sp-10);
    right: var(--sp-10);
    display: flex;
    align-items: center;
    gap: var(--sp-6);
    padding: var(--sp-6) var(--sp-10);
    border-radius: var(--radius-md);
    border: var(--border-width) solid var(--border-strong);
    background: var(--bg-level2);
    box-shadow: var(--shadow-lg);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-primary);
    rotate: -4deg;
  }

  /* ---- La cuadricula ---- */

  .art-grid {
    display: flex;
    flex-direction: column;
    gap: 0.1875rem;
    overflow: hidden;
    border: var(--border-width) solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-level2);

    & .art-grid-head {
      display: flex;
      gap: var(--sp-8);
      padding: var(--sp-6) var(--sp-8);
      border-bottom: var(--border-width) solid var(--border);
      background: var(--bg-field);

      & span {
        flex: 1;
        height: 0.375rem;
        border-radius: 62.5rem;
        background: var(--border-strong);
      }
    }

    & .art-grid-row {
      display: flex;
      align-items: center;
      gap: var(--sp-8);
      padding: var(--sp-6) var(--sp-8);

      & + .art-grid-row {
        border-top: var(--border-width) solid var(--border);
      }
    }

    & .art-cell {
      flex: 1;
      height: 0.375rem;
      border-radius: 62.5rem;
      background: var(--bg-field);
    }
  }

  /* ---- Personas y roles ---- */

  .art-tool {
    align-self: flex-start;
    display: flex;
    align-items: center;
    gap: var(--sp-4);
    padding: 0.125rem var(--sp-8);
    border-radius: var(--radius-sm);
    background: var(--accent-soft);
    color: var(--accent-soft-text);
    font-size: var(--text-xs);
    font-weight: 700;
  }

  .art-people {
    display: flex;
    flex-direction: column;
    gap: var(--sp-6);

    & .art-person {
      display: flex;
      align-items: center;
      gap: var(--sp-8);
      padding: var(--sp-6) var(--sp-8);
      border-radius: var(--radius-sm);
      border: var(--border-width) solid var(--border);
      background: var(--bg-level2);
    }

    & .art-avatar {
      flex: none;
      width: 1.125rem;
      height: 1.125rem;
      border-radius: 62.5rem;
    }

    & .art-person-name {
      flex: 1;
      height: 0.375rem;
      border-radius: 62.5rem;
      background: var(--bg-field);

      &.short {
        flex: 0 1 60%;
      }
    }

    /* La pastilla es la del catálogo; aquí solo se acorta a la medida del dibujo. */
    & .tag {
      flex: none;
      padding: 0 var(--sp-8);
      font-size: var(--text-xs);
    }
  }

  /* ---- Ver la página como un rol ---- */

  .art-url {
    display: flex;
    align-items: center;
    gap: var(--sp-6);
    padding: var(--sp-4) var(--sp-8);
    border-radius: 62.5rem;
    background: var(--bg-field);
    color: var(--text-muted);
    font-size: var(--text-xs);

    & .art-url-text {
      flex: 1;
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    & .art-role {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      padding: 0 var(--sp-8);
      border-radius: 62.5rem;
      background: var(--accent);
      color: var(--accent-text);
      font-weight: 700;
    }

    /* El botón que trae y esconde la columna de la IA, redondo y del color de
       la aplicación, como en la barra de verdad. */
    & .art-ai-btn {
      display: grid;
      place-items: center;
      flex: none;
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 62.5rem;
      background: var(--accent);
      color: var(--accent-text);
    }
  }

  /* ---- Ajustes ---- */

  .art-cards {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--sp-10);

    & .art-mini-card {
      display: flex;
      flex-direction: column;
      gap: var(--sp-8);
      padding: var(--sp-10);
      border-radius: var(--radius-md);
      border: var(--border-width) solid var(--border);
      background: var(--bg-level2);
      color: var(--text-muted);
    }

    /* Los tres punticos de una página en la lista: por ahí se abren sus ajustes. */
    & .art-dots-btn {
      display: grid;
      place-items: center;
      width: 1.125rem;
      height: 1.125rem;
      border-radius: var(--radius-sm);
      background: var(--bg-field);
      color: var(--text-secondary);
    }

    & .art-mini-head {
      display: flex;
      align-items: center;
      gap: var(--sp-6);
    }

    & .art-swatches {
      display: flex;
      gap: var(--sp-4);

      & i {
        width: 0.875rem;
        height: 0.875rem;
        border-radius: 62.5rem;
      }
    }
  }

  /* ---- Publicar ---- */

  .art-card-publish {
    display: flex;
    align-items: center;
    gap: var(--sp-10);
    padding: var(--sp-8) var(--sp-10);
    border-radius: var(--radius-md);
    border: var(--border-width) solid var(--border);
    background: var(--bg-level2);

    & .art-switch {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      width: 1.75rem;
      height: 1rem;
      padding: 0.125rem;
      border-radius: 62.5rem;
      background: var(--accent);

      & i {
        width: 0.75rem;
        height: 0.75rem;
        border-radius: 62.5rem;
        background: var(--accent-text);
      }
    }

    & .art-link {
      display: flex;
      align-items: center;
      gap: var(--sp-6);
      flex: 1;
      min-width: 0;
      padding: 0.125rem var(--sp-8);
      border-radius: 62.5rem;
      background: var(--bg-field);
      color: var(--text-secondary);
      font-size: var(--text-xs);
      font-weight: 600;
    }
  }

  /*
   * LA MARCA
   *
   * El control del que habla el paso, rodeado por un anillo del color de la
   * aplicación que late hasta que se pasa de pantalla. Es lo primero que se
   * mira --por eso el texto del paso entra un poco después, ver
   * `GuideTour.svelte`-- y responde a la pregunta que va antes que cualquier
   * explicacion: donde se hace esto.
   *
   * El radio no se toca: lo pone el elemento marcado, y el contorno lo sigue.
   */
  .is-spot {
    position: relative;
    outline: 0.125rem solid var(--accent);
    outline-offset: 0.1875rem;
  }

  /* La zona de soltar ya viene con su propio borde de trazos: dos contornos
     uno dentro de otro no señalan mejor. Se queda con el latido. */
  .art-dropzone.is-spot {
    outline: none;
  }

  /*
   * El dibujo se arma a la vista: primero la ventana, luego lo que el paso
   * viene a contar. Es lo único que se mueve, y solo la primera vez que cada
   * pantalla aparece --el dibujo se monta de nuevo en cada paso--.
   */
  @media (prefers-reduced-motion: no-preference) {
    .art-window {
      animation: art-window 420ms var(--travel-curve) both;
    }

    .art-file {
      animation: art-drop 520ms var(--travel-curve) both 160ms;
    }

    .art-dropzone,
    .art-tool,
    .art-role,
    .art-publish.on,
    .art-composer {
      animation: art-pop 420ms var(--travel-curve) both 200ms;
    }

    /*
     * La marca es lo ultimo que llega y lo único que no para: el dibujo ya
     * está puesto cuando el anillo aparece, así que la vista va derecha al
     * control. El selector lleva delante `.art-guide` a propósito --sin el,
     * una pieza que ya trae su propia animacion (el botón de publicar
     * encendido) gana por especificidad y el latido no llega a correr.
     */
    .art-guide .is-spot {
      animation:
        art-pop 420ms var(--travel-curve) both 260ms,
        art-spot 2.2s ease-out infinite 720ms;
    }

    .art-person,
    .art-grid-row,
    .art-mini-card {
      animation: art-rise 380ms var(--travel-curve) both;

      &:nth-child(2) {
        animation-delay: 80ms;
      }
      &:nth-child(3) {
        animation-delay: 160ms;
      }
      &:nth-child(4) {
        animation-delay: 240ms;
      }
    }
  }

  @keyframes art-window {
    from {
      opacity: 0;
      scale: 0.98;
    }
    to {
      opacity: 1;
      scale: 1;
    }
  }

  /* El archivo entra desde fuera del marco y se posa girado. */
  @keyframes art-drop {
    from {
      opacity: 0;
      translate: 1.25rem -2rem;
      rotate: 6deg;
    }
    to {
      opacity: 1;
      translate: 0 0;
      rotate: -4deg;
    }
  }

  /* El latido de la marca: un halo que sale del control y se deshace. */
  @keyframes art-spot {
    0% {
      box-shadow: 0 0 0 0 color-mix(in oklab, var(--accent) 45%, transparent);
    }
    70% {
      box-shadow: 0 0 0 0.5rem transparent;
    }
    100% {
      box-shadow: 0 0 0 0 transparent;
    }
  }

  @keyframes art-pop {
    from {
      opacity: 0;
      scale: 0.9;
    }
    to {
      opacity: 1;
      scale: 1;
    }
  }

  @keyframes art-rise {
    from {
      opacity: 0;
      translate: 0 0.5rem;
    }
    to {
      opacity: 1;
      translate: 0 0;
    }
  }
</style>
