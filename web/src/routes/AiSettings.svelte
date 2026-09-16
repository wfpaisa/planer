<!--
  Los ajustes de la cuenta: lo que vale para todo el panel, no para una
  aplicacion. El tamano de letra, el tema y los servidores de IA.
-->
<script lang="ts">
  import type { AiConfigView } from "@shared/types";

  import Icon from "../components/Icon.svelte";
  import AiDebugSection from "../components/settings/AiDebugSection.svelte";
  import AiForm from "../components/settings/AiForm.svelte";
  import CleanSection from "../components/settings/CleanSection.svelte";
  import DemoSection from "../components/settings/DemoSection.svelte";
  import FontSizeSection from "../components/settings/FontSizeSection.svelte";
  import ThemePicker from "../components/ThemePicker.svelte";
  import { ErrorNote, Loading } from "../components/ui";
  import { api } from "../lib/pb";
  import { link } from "../lib/router.svelte";
  import { useAsync } from "../lib/useAsync.svelte";

  const loaded = useAsync(() => api<AiConfigView>("/api/ai/config"));
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
        <p class="ai-settings-subtitle">Configuraciones globales.</p>
      </div>

      <!-- Lo primero es la IA: es lo unico que hay que configurar para que el
           panel sirva de algo. -->
      <ErrorNote message={loaded.error} />
      {#if loaded.data}
        <AiForm initial={loaded.data} />
      {/if}

      <!-- Dos secciones cortas, una al lado de la otra. -->
      <div class="pair-ai-settings">
        <FontSizeSection />
        <DemoSection />
      </div>

      <AiDebugSection />

      <CleanSection />
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

  /* El boton vive en `Button.svelte`; aqui se centra el icono como en un boton icono. */
  :global(.ai-settings-back) {
    align-items: center;
    justify-content: center;
  }

  .main-ai-settings {
    margin: 0 auto;
    max-width: 56rem;
    padding: 2rem 1.25rem;

    /* Los hijos de debajo son componentes: su raiz no es de aqui. */
    & > :global(* + *) {
      margin-top: var(--sp-20);
    }
  }

  /* Las dos caben en media pagina; en estrecho vuelven a la fila unica. Las
     tarjetas son componentes, asi que se estiran solas hasta la altura de la
     mas alta y el pie de cada una queda contra su borde inferior. */
  .pair-ai-settings {
    display: grid;
    gap: var(--sp-20);

    @media (min-width: 48rem) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
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
