<!--
  La puerta a `/demo`: el catalogo de componentes al completo, con las mismas
  hojas que viste el panel. No es del producto, y por eso vive aqui y no en el
  menu.
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
  title="Demo del sistema de estilos"
  description="El catalogo de componentes al completo, con las mismas hojas que viste el panel."
  class="section-demo"
>
  <p class="text-demo-section">
    Sirve para comprobar de un vistazo que un cambio en el catalogo no rompio nada en otro sitio. Se
    puede mirar bajo cualquiera de las paletas y en los dos temas.
  </p>
</SettingsSection>

<style>
  .text-demo-section {
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
    color: var(--text-secondary);
  }

  /* El boton vive en `components.css` y cuenta con un <button>; esto es un
     enlace, asi que el icono se centra a mano. */
  :global(.link-open-demo) {
    justify-content: center;
    text-decoration: none;
  }
</style>
