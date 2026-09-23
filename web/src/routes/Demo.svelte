<!--
  La demo del sistema de estilos.

  No es una pantalla del producto: es el catálogo entero de
  `styles/components.css` puesto a la vez, con la misma hoja con la que se viste
  el resto del panel. Sirve para una cosa que ninguna comprobacion automatica
  hace -- ver de un vistazo si un cambio en el catálogo rompio algo en otro
  sitio: los cuatro tonos de aviso, los estados de un botón, un campo con error,
  un modal con medida fija.

  Tiene el esqueleto del panel de referencia (`/home/projects/ia/dashboard`):
  una sidebar de verdad a la izquierda y el contenido al lado. La paleta con la
  que se mira se elige desde la sidebar --el cubo de pintura abre el selector,
  el mismo `PalettePicker` de los ajustes de una aplicación-- y va en el mismo
  elemento en el que se pinta el fondo de la página, que es lo que pide
  `palettes.css`; el tema lo cambia el botón de siempre, en <html>. Mientras el
  selector esta abierto el contenido cede el sitio en vez de quedar tapado: hay
  que ver como queda todo con cada paleta.
-->
<script lang="ts">
  import type { AppTheme } from "@shared/types";

  import DemoGallery from "../components/demo/DemoGallery.svelte";
  import DemoSidebar from "../components/demo/DemoSidebar.svelte";
  import { paletteAttrs } from "../lib/appTheme";
  import { cx } from "../lib/cx";

  /** `palette: null` es sin paleta puesta: manda la de partida de `theme.css`. */
  let palette = $state<AppTheme>({ palette: null });
  let drawerOpen = $state(false);

  // Sin tamaño de letra: la demo es cromo del panel, no una aplicación.
  const attrs = $derived(paletteAttrs(palette, { fontScale: false }));

  /* ---- Donde se estaba mirando, al recargar ---- */

  // El menu de la sidebar baja a cada sección con `scrollIntoView` y no toca la
  // URL, asi que al recargar no hay nada que diga donde se estaba. El navegador
  // tampoco lo sabe: el alto de la página lo decide el masonry de la galeria
  // midiendo, varios cuadros después de cargar, y para cuando la demo mide lo
  // que tiene que medir el navegador ya la dejo arriba. Se guarda a mano --en
  // `sessionStorage`, que es por pestaña y es lo que dura una sesión de mirar
  // la demo-- y se vuelve a poner cuando la página ya da de si.
  const SCROLL_KEY = "demo:scroll";

  // Sin almacen --ventana privada, permisos-- la demo funciona igual, solo que
  // la recarga vuelve a empezar arriba.
  function readTop(): number {
    try {
      return Number(sessionStorage.getItem(SCROLL_KEY)) || 0;
    } catch {
      return 0;
    }
  }

  function saveTop(top: number) {
    try {
      sessionStorage.setItem(SCROLL_KEY, String(top));
    } catch {
      /* se sigue mirando la demo igual */
    }
  }

  $effect(() => {
    // El navegador restauraria su propia posicion sobre una página aun sin
    // repartir --y se pelearia con esta.
    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";

    const top = readTop();
    let frame = 0;

    const save = () => {
      frame = 0;
      saveTop(Math.round(scrollY));
    };

    const onScroll = () => {
      // Una vez por cuadro: el scroll avisa mucho mas a menudo que eso.
      frame ||= requestAnimationFrame(save);
    };

    // Guardar solo cuando ya se esta donde se estaba: los cuadros de la
    // restauracion también son scroll, y guardarlos seria pisar el destino.
    const listen = () => {
      frame = 0;
      addEventListener("scroll", onScroll, { passive: true });
    };

    // Las fichas se colocan midiendo, asi que la página crece a trozos: hasta
    // que no es lo bastante alta no admite bajar hasta donde se estaba. Se
    // insiste un segundo y se deja estar --una demo mas corta que antes no
    // tiene esa posicion.
    const deadline = performance.now() + 1000;
    const restore = () => {
      scrollTo({ top });
      if (Math.abs(scrollY - top) > 1 && performance.now() < deadline) {
        frame = requestAnimationFrame(restore);
        return;
      }
      listen();
    };

    if (top > 0) restore();
    else listen();

    return () => {
      removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      history.scrollRestoration = previous;
    };
  });
</script>

<div
  id="demo-page"
  class={cx("page-demo", drawerOpen && "drawer-open")}
  data-palette={attrs["data-palette"]}
  style={attrs.style}
>
  <DemoSidebar
    {palette}
    onPalette={(next) => (palette = next)}
    onDrawer={(open) => (drawerOpen = open)}
  />

  <div class="demo-content">
    <main id="demo-main" class="main-demo">
      <div class="demo-head">
        <h1 class="demo-title">Demo</h1>
        <p class="demo-subtitle">
          Todos los componentes del sistema, con las mismas hojas de estilo que usa el panel y las
          páginas publicadas. Cambia la paleta o el tema desde la barra lateral para comprobar que
          todo se sigue leyendo.
        </p>
      </div>

      <DemoGallery />
    </main>
  </div>
</div>

<style>
  .page-demo {
    display: grid;
    grid-template-columns: 16.5rem minmax(0, 1fr);
    min-height: 100%;
    /* El fondo se pinta aqui, que es donde va el `data-palette`: asi la página
       entera se recolorea al cambiarla y no solo lo que hay dentro. */
    background: var(--bg-level1);
    color: var(--text-primary);

    @media (max-width: 61.25rem) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .demo-content {
    min-width: 0;
    transition: padding-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Con el selector de paleta abierto, el contenido cede el sitio en vez de
     quedar tapado por el drawer; sin ancho de sobra vuelve a flotar encima. */
  .page-demo.drawer-open .demo-content {
    padding-right: 26rem;

    @media (max-width: 61.25rem) {
      padding-right: 0;
    }
  }

  .main-demo {
    margin: 0 auto;
    max-width: 72rem;
    padding: 1rem 1.25rem 4rem;
    scroll-margin-top: 1rem;
  }

  .demo-head {
    padding-bottom: var(--sp-16);

    & .demo-title {
      font-size: var(--text-2xl);
      font-weight: 800;
    }

    & .demo-subtitle {
      margin-top: var(--sp-4);
      max-width: 44rem;
      font-size: var(--text-sm);
      color: var(--text-muted);
    }
  }
</style>
