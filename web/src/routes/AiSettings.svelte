<!--
  Los ajustes de la cuenta: lo que vale para todo el panel, no para una
  aplicación. El tamaño de letra, el tema y los servidores de IA; y, para un
  administrador, los usuarios del panel.

  Van en pestañas por contexto --general, IA, aplicaciones, usuarios-- en vez
  de una sola columna larga. Cada una tiene su dirección (`/ajustes/general`):
  recargar no devuelve al principio y se puede enlazar a una.
-->
<script lang="ts">
  import type { AiConfigView } from "@shared/types";

  import Icon from "../components/Icon.svelte";
  import AiDebugSection from "../components/settings/AiDebugSection.svelte";
  import AiForm from "../components/settings/AiForm.svelte";
  import CleanSection from "../components/settings/CleanSection.svelte";
  import DemoSection from "../components/settings/DemoSection.svelte";
  import FontSizeSection from "../components/settings/FontSizeSection.svelte";
  import PaletteSection from "../components/settings/PaletteSection.svelte";
  import TransferSection from "../components/settings/TransferSection.svelte";
  import UsersSection from "../components/settings/UsersSection.svelte";
  import ThemePicker from "../components/ThemePicker.svelte";
  import { ErrorNote, Loading } from "../components/ui";
  import { cx } from "../lib/cx";
  import { api } from "../lib/pb";
  import { link, navigate } from "../lib/router.svelte";
  import { session } from "../lib/session.svelte";
  import { useAsync } from "../lib/useAsync.svelte";

  type Tab = "general" | "ia" | "aplicaciones" | "usuarios";

  /** Lo que queda de la dirección después de `/ajustes`: `/general`, `/ia`… */
  let { rest = "/" }: { rest?: string } = $props();

  const loaded = useAsync(() => api<AiConfigView>("/api/ai/config"));

  const tabs = $derived<{ id: Tab; label: string; icon: string }[]>([
    { id: "general", label: "General", icon: "settings-02" },
    { id: "ia", label: "Inteligencia artificial", icon: "ai-brain-01" },
    { id: "aplicaciones", label: "Aplicaciones", icon: "dashboard-square-01" },
    // Solo un administrador gestiona usuarios (el servidor lo vuelve a comprobar).
    ...(session.me?.admin
      ? [{ id: "usuarios" as const, label: "Usuarios", icon: "user-group" }]
      : []),
  ]);

  const chosen = $derived(rest.split("/")[1] ?? "");
  // Una pestaña que no existe --o que no es para esta cuenta-- abre la primera.
  const current = $derived<Tab>(tabs.find((t) => t.id === chosen)?.id ?? "general");

  function go(tab: Tab) {
    // Sin entrada nueva en el historial: cambiar de pestaña no es navegar, y
    // el botón de atrás tiene que volver al tablero.
    navigate(`/ajustes/${tab}`, { replace: true });
  }
</script>

{#if loaded.loading && !loaded.data}
  <Loading label="Cargando ajustes" />
{:else}
  <div id="ai-settings-page" class="page-ai-settings">
    <header id="ai-settings-header" class="header-ai-settings">
      <div class="ai-settings-header-inner">
        <a href="/" use:link class="btn-icon sm ai-settings-back" aria-label="Volver">
          <Icon name="arrow-left-01" size={16} />
        </a>
        <div class="ai-settings-spacer"></div>
        <ThemePicker />
      </div>
    </header>

    <main id="ai-settings-main" class="main-ai-settings">
      <div class="ai-settings-head">
        <h1 class="ai-settings-title">Ajustes</h1>
        <p class="ai-settings-subtitle">Preferencias de la cuenta.</p>
      </div>

      <div role="tablist" class="tabs-settings tab-list">
        {#each tabs as tab (tab.id)}
          <button
            type="button"
            role="tab"
            id="tab-ajustes-{tab.id}"
            aria-selected={current === tab.id}
            aria-controls="panel-ajustes"
            class={cx("btn-tab-settings", "tab", current === tab.id && "active")}
            onclick={() => go(tab.id)}
          >
            <Icon name={tab.icon} size={15} />
            <span class="label-tab-settings">{tab.label}</span>
          </button>
        {/each}
      </div>

      <div
        id="panel-ajustes"
        role="tabpanel"
        aria-labelledby="tab-ajustes-{current}"
        class="panel-settings-tab"
      >
        {#if current === "general"}
          <!-- Cómo se ve el panel para esta cuenta. -->
          <PaletteSection />
          <div class="pair-ai-settings">
            <FontSizeSection />
            <DemoSection />
          </div>
        {:else if current === "ia"}
          <ErrorNote message={loaded.error} />
          <!-- Los servidores de IA son de toda la instalación: solo un
               administrador los cambia (el servidor lo vuelve a comprobar). -->
          {#if loaded.data && session.me?.admin}
            <AiForm initial={loaded.data} />
          {/if}
          <AiDebugSection />
        {:else if current === "aplicaciones"}
          <!-- Lo que se hace con las aplicaciones enteras, y no con los
               ajustes: llevárselas primero y borrarlas al final. -->
          <TransferSection />
          <CleanSection />
        {:else if current === "usuarios"}
          <UsersSection />
        {/if}
      </div>
    </main>
  </div>
{/if}

<style>
  .page-ai-settings {
    min-height: 100%;
    background: var(--bg-level1);
  }

  .header-ai-settings {
    & .ai-settings-header-inner {
      display: flex;
      align-items: center;
      gap: var(--sp-12);
      height: 3.5rem;
      max-width: 56rem;
      margin: 0 auto;
      padding: 0 var(--sp-20);
    }

    & .ai-settings-spacer {
      flex: 1;
    }
  }

  /* El botón vive en `Button.svelte`; aqui se centra el icono como en un botón icono. */
  :global(.ai-settings-back) {
    align-items: center;
    justify-content: center;
  }

  .main-ai-settings {
    margin: 0 auto;
    max-width: 56rem;
    padding: 2rem 1.25rem;

    /* Los hijos de debajo son componentes: su raíz no es de aqui. */
    & > :global(* + *) {
      margin-top: var(--sp-20);
    }
  }

  /* Las dos caben en media página; en estrecho vuelven a la fila única. Las
     tarjetas son componentes, asi que se estiran solas hasta la altura de la
     mas alta y el pie de cada una queda contra su borde inferior. */
  .pair-ai-settings {
    display: grid;
    gap: var(--sp-20);

    @media (min-width: 48rem) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  /* Cada pestaña es tan ancha como la más larga: en estrecho se quedan los
     iconos y el nombre pasa a la lectura del lector de pantalla. */
  .tabs-settings {
    @media (width < 40rem) {
      & .label-tab-settings {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }
    }
  }

  .panel-settings-tab {
    /* Los hijos son componentes: su raíz no es de aquí. */
    & > :global(* + *) {
      margin-top: var(--sp-20);
    }
  }

  .ai-settings-head {
    & .ai-settings-title {
      font-size: var(--text-2xl);
      color: var(--text-primary);
    }

    & .ai-settings-subtitle {
      margin-top: var(--sp-4);
      font-size: var(--text-xs);
      color: var(--text-muted);
    }
  }
</style>
