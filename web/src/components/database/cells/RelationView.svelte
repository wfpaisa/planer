<!--
  Una celda de relación, en cualquiera de sus cuatro estados.

  Con enlace y sin enlace se distinguen de un vistazo, por color y por icono.
  Es lo único que se mira al repasar una columna de cedulas recien importada, y
  tenerlo que averiguar valor a valor era el trabajo que sobraba.

  El tercer caso va en ambar y aparte: ahi no falta el enlace, hay uno guardado
  cuyo registro ya no se alcanza. Se separa porque se arregla de otra manera.
-->
<script lang="ts">
  import type { FieldDef } from "@shared/types";

  import { colorFor } from "../../../lib/appTheme";
  import { relationCell, type Row } from "../../../lib/cellValues";
  import { getPeople } from "../../../lib/people.svelte";
  import Icon from "../../Icon.svelte";
  import { Tag } from "../../ui";

  let { field, row }: { field: FieldDef; row: Row } = $props();

  const people = getPeople();
  const cell = $derived(relationCell(row, field, people.list));
</script>

{#if cell.state === "empty"}
  <span data-cell-view={field.type} class="relation-empty">—</span>
{:else if cell.state === "broken"}
  <span
    data-cell-view={field.type}
    data-relation="roto"
    class="relation-broken inline-flex items-center"
    data-tip="El registro enlazado ya no existe o no está a tu alcance"
  >
    <Icon name="alert-circle" class="relation-icon" />
    <span class="relation-label">Enlace roto</span>
  </span>
{:else if cell.state === "orphan"}
  <span
    data-cell-view={field.type}
    data-relation="sin-enlace"
    class="relation-orphan inline-flex items-center"
    data-tip="No se encontró ninguna relación para este valor, ve a la tabla relacionada y créalo."
  >
    <Icon name="alert-circle" class="relation-icon" size={16} />
    <span class="relation-label">{cell.label}</span>
  </span>
{:else}
  <!--
    El valor que se escribio, no el nombre de quien resulto ser: la cédula es lo
    que trae el archivo y lo que se vuelve a escribir, y cambiarla por el nombre
    escondia el único dato con el que se puede corregir la celda. Quien es va
    detras, entre parentesis. Ver `detailFieldOf` en `shared/types.ts`.

    Una sola pintura para todo lo enlazado: a donde apunte la columna dejo de
    ser una diferencia que se vea, porque dejo de ser una diferencia.
  -->
  <span
    data-cell-view={field.type}
    data-relation="enlazado"
    class="relation-linked inline-flex items-center"
  >
    <Tag tone={colorFor(cell.label)}>{cell.label}</Tag>
    {#if cell.detail}<span class="relation-detail-soft">({cell.detail})</span>{/if}
  </span>
{/if}

<style>
  .relation-empty {
    color: var(--text-muted);
  }

  .relation-broken,
  .relation-orphan {
    gap: var(--sp-6);
    color: var(--warning);
  }

  /* El icono va dentro de Icon (un componente). */
  :global(.relation-icon) {
    flex-shrink: 0;
  }

  .relation-linked {
    gap: var(--sp-6);
  }

  .relation-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .relation-detail-soft {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-secondary);
  }
</style>
