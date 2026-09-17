<!--
  Una columna dentro del cajon de una fila: su nombre arriba y el control
  debajo.

  No es una etiqueta de formulario porque varios controles --las listas de
  opciones, el selector de personas-- son en realidad un grupo de botones, y
  envolverlos en una etiqueta ata el nombre al primero de ellos.
-->
<script lang="ts">
  import type { FieldDef } from "@shared/types";
  import type { Snippet } from "svelte";

  import FieldIcon from "./FieldIcon.svelte";

  let {
    field,
    children,
  }: {
    field: FieldDef;
    children: Snippet;
  } = $props();
</script>

<div class="field-drawer flex-col flex">
  <span class="drawer-field-label">
    <FieldIcon type={field.type} system={field.system} class="drawer-field-icon" />
    {field.label}
    {#if field.required}<span class="drawer-required">*</span>{/if}
  </span>
  {@render children()}
</div>

<style>
  .field-drawer {
    & .drawer-field-label {
      display: flex;
      align-items: center;
      gap: var(--sp-6);
      margin-bottom: var(--sp-6);
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      font-weight: 500;
      color: var(--text-secondary);

      /* El icono pinta el color del rol: un gris tenue entre la etiqueta y el texto. */
      & :global(.drawer-field-icon) {
        color: var(--text-muted);
      }

      & .drawer-required {
        color: var(--accent-soft-text);
      }
    }
  }
</style>
