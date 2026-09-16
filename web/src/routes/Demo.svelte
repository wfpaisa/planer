<!--
  La demo del sistema de estilos.

  No es una pantalla del producto: es el catalogo entero de
  `styles/components.css` puesto a la vez, con la misma hoja con la que se viste
  el resto del panel. Sirve para una cosa que ninguna comprobacion automatica
  hace -- ver de un vistazo si un cambio en el catalogo rompio algo en otro
  sitio: los cuatro tonos de aviso, los estados de un boton, un campo con error,
  un modal con medida fija.

  Tiene el esqueleto del panel de referencia (`/home/projects/ia/dashboard`):
  una sidebar de verdad a la izquierda y el contenido al lado. La paleta con la
  que se mira se elige desde la sidebar --el cubo de pintura abre el selector,
  el mismo `PalettePicker` de los ajustes de una aplicacion-- y va en el mismo
  elemento en el que se pinta el fondo de la pagina, que es lo que pide
  `palettes.css`; el tema lo cambia el boton de siempre, en <html>. Mientras el
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

  // Sin tamano de letra: la demo es cromo del panel, no una aplicacion.
  const attrs = $derived(paletteAttrs(palette, { fontScale: false }));
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
    /* El fondo se pinta aqui, que es donde va el `data-palette`: asi la pagina
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
