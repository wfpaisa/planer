<!--
  Acceso al catálogo visual del panel. Es una herramienta interna y no forma
  parte del producto.
-->
<script lang="ts">
  import { link } from "../../lib/router.svelte";
  import Icon from "../Icon.svelte";
  import SettingsSection from "../SettingsSection.svelte";
</script>

{#snippet icon()}
  <Icon name="grid-view" />
{/snippet}

{#snippet footer()}
  <a href="/demo" use:link class="link-open-demo btn btn-primary">
    Abrir la demo
    <Icon name="arrow-right-01" size={14} />
  </a>
{/snippet}

<SettingsSection
  id="ajustes-demo"
  {icon}
  {footer}
  title="Catálogo de componentes"
  description="Consulta los controles y estilos disponibles en el panel."
  class="section-demo"
>
  <p class="text-demo-section">
    Prueba cada componente con distintas paletas y en modo claro u oscuro.
  </p>
</SettingsSection>

<style>
  .text-demo-section {
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
    color: var(--text-secondary);
  }

  /* El enlace reutiliza el aspecto de botón; el icono se centra aquí. */
  :global(.link-open-demo) {
    justify-content: center;
    text-decoration: none;
  }
</style>
