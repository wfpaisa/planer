<!--
  La aplicacion dibujada.

  La misma vista sirve para el enlace publico y para la previsualizacion del
  panel. Lo unico que cambia es de donde sale el HTML de cada pagina y si se
  cuenta lo que el documento hace mal: un visitante nunca debe ver eso.
-->
<script lang="ts">
  import type { AppBundle } from "@shared/types";
  import type PocketBase from "pocketbase";
  import type { Snippet } from "svelte";

  import { paletteAttrs } from "../lib/appTheme";
  import type { DocLoader } from "../lib/htmlDocs";
  import { pageMode } from "../lib/pageMode.svelte";
  import { sidebarPin } from "../lib/sidebarPin.svelte";
  import AppSidebar from "./AppSidebar.svelte";
  import PageView from "./PageView.svelte";
  import ModeToggle from "./ui/ModeToggle.svelte";

  let {
    bundle,
    client,
    makePageLoader,
    pageSlug,
    onOpenPage,
    showIssues = false,
    banner,
    footer: extra,
  }: {
    bundle: AppBundle;
    client: PocketBase;
    /** De donde sale el HTML de una pagina. */
    makePageLoader?: (pageId: string) => DocLoader;
    pageSlug?: string;
    onOpenPage: (page: AppBundle["pages"][number]) => void;
    showIssues?: boolean;
    banner?: Snippet;
    /** Lo que cada quien anade al pie del sidebar: quien entro, y su salida. */
    footer?: Snippet;
  } = $props();

  const pages = $derived(bundle.pages);
  const page = $derived(
    pages.find((p) => p.slug === pageSlug) ??
      pages.find((p) => p.isHome) ??
      pages.find((p) => !p.separator),
  );

  // Fijado o flotante es de quien mira, y se recuerda igual que en el panel.
  const pin = sidebarPin(() => bundle.app.id);
  /*
   * Claro u oscuro lo elige quien mira, no quien construye. Lo que si es de la
   * aplicacion son sus dos colores, y van en este mismo elemento a proposito:
   * ver `lib/appTheme.ts`.
   */
  const mode = pageMode(() => bundle.app.id);

  /*
   * El cargador del documento tiene que durar lo que dure la pagina: uno nuevo
   * por dibujado reiniciaria el marco sin parar. Por eso depende solo del id.
   */
  const loadDoc = $derived((makePageLoader ?? (() => async () => ""))(page?.id ?? ""));
</script>

<div
  id="published-app"
  data-theme={mode.mode}
  class="app-published flex h-full flex-col"
  {...paletteAttrs(bundle.app.theme)}
>
  {@render banner?.()}
  <!--
    Una sola caja con el documento dentro. El sidebar se pone encima mientras
    flota, y a su lado en cuanto se fija.
  -->
  <div class="app-published-frame">
    <AppSidebar
      app={bundle.app}
      {pages}
      activeId={page?.id}
      onOpen={onOpenPage}
      pinned={pin.pinned}
      onTogglePin={pin.toggle}
      footer={extra}
    >
      {#snippet headerActions()}
        <!--
          Claro u oscuro en una aplicacion publicada, junto al nombre de la
          aplicacion arriba: es un ajuste de quien mira, no de la aplicacion.
          Lo elegido se recuerda para esta aplicacion en este navegador;
          mientras nadie elija, manda lo que pida el sistema.
        -->
        <ModeToggle
          dark={mode.mode === "dark"}
          onToggle={(next) => mode.set(next)}
          tipLight="Fondo claro"
          tipDark="Fondo oscuro"
          class="btn-page-mode"
        />
      {/snippet}
    </AppSidebar>

    <main id="published-main" class="main-published">
      {#if page?.doc}
        <PageView
          {page}
          appId={bundle.app.id}
          {client}
          {loadDoc}
          roles={bundle.roles ?? []}
          themeKey={`${JSON.stringify(bundle.app.theme)}:${mode.mode}`}
          {showIssues}
        />
      {:else}
        <p class="app-published-empty text-center">Esta pagina esta vacia.</p>
      {/if}
    </main>
  </div>
</div>

<style>
  .app-published {
    & .app-published-frame {
      position: relative;
      display: flex;
      min-height: 0;
      flex: 1 1 0%;

      & .main-published {
        height: 100%;
        min-width: 0;
        flex: 1 1 0%;
        background: var(--bg-level1);
      }
    }
  }

  /* La pagina vacia se anuncia sobria, centrada. */
  .app-published-empty {
    padding: 4rem 0;
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
    color: var(--text-muted);
  }
</style>
