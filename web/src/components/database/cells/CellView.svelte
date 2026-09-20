<!--
  Una celda en modo lectura.

  Cada tipo de columna se ensena a su manera; lo unico que no es una linea de
  texto es la relacion, que tiene su propio componente porque una celda de
  relacion vacia no siempre esta vacia.
-->
<script lang="ts">
  import { type FieldDef, isRelationField } from "@shared/types";

  import { colorFor } from "../../../lib/appTheme";
  import { formatDate, type Row } from "../../../lib/cellValues";
  import { fileUrl } from "../../../lib/pb";
  import Icon from "../../Icon.svelte";
  import { Tag } from "../../ui";
  import RelationView from "./RelationView.svelte";

  let { field, row }: { field: FieldDef; row: Row } = $props();

  const value = $derived(row[field.name]);
  const empty = $derived(value === null || value === undefined || value === "");
  /* Una relacion se pinta aparte: sin enlace la celda no esta vacia, lleva el
     valor que se escribio y no encontro dueno. */
  const relation = $derived(isRelationField(field) && field.multiple !== true);
  const list = $derived(Array.isArray(value) ? value : [value]);
</script>

{#if relation}
  <RelationView {field} {row} />
{:else if empty}
  <span class="cell-view-empty">—</span>
{:else if field.type === "bool"}
  {#if value}
    <span data-cell-view="bool" class="cell-view-bool inline-flex items-center justify-center">
      <Icon name="check" size={11} />
    </span>
  {:else}
    <span data-cell-view="bool" class="cell-view-bool-empty inline-block"></span>
  {/if}
{:else if field.type === "select"}
  <!--
    Los roles son todos la misma cosa --quien entra y con que nombre-- asi que
    van siempre del mismo color en vez de uno por texto.
  -->
  <span data-cell-view="select" class="cell-view-select flex flex-wrap gap-1">
    {#each list.filter(Boolean) as v (String(v))}
      <Tag tone={field.system === "roles" ? "tint-1" : colorFor(String(v))}>{String(v)}</Tag>
    {/each}
  </span>
{:else if field.type === "date"}
  <span data-cell-view="date" class="cell-view-date">{formatDate(value)}</span>
{:else if field.type === "number"}
  <span data-cell-view="number" class="cell-view-number">{String(value)}</span>
{:else if field.type === "url"}
  <a
    data-cell-view="url"
    href={String(value)}
    target="_blank"
    rel="noreferrer"
    class="cell-view-url inline-flex items-center gap-1"
  >
    {String(value)}
    <Icon name="external-link" />
  </a>
{:else if field.type === "email"}
  <a data-cell-view="email" href={`mailto:${value}`} class="cell-view-email">{String(value)}</a>
{:else if field.type === "file"}
  <span data-cell-view="file" class="cell-view-file flex items-center">
    {#each list.filter(Boolean).map(String) as name (name)}
      <a href={fileUrl(row, name)} target="_blank" rel="noreferrer" class="cell-file-link">
        <Icon name="paperclip" />
        <span class="cell-file-name">{name}</span>
      </a>
    {/each}
  </span>
{:else}
  <span data-cell-view={field.type} class="cell-view-text">{String(value)}</span>
{/if}

<style>
  .cell-view-empty {
    color: var(--text-muted);
  }

  .cell-view-bool {
    height: 1rem;
    width: 1rem;
    background: var(--accent);
    border: var(--border-width) solid var(--accent);
    border-radius: calc(var(--radius-sm) / 2);
    color: var(--accent-text);
  }

  .cell-view-bool-empty {
    height: 1rem;
    width: 1rem;
    background: transparent;
    border: var(--border-width) solid var(--border);
    border-radius: calc(var(--radius-sm) / 2);
  }

  .cell-view-date,
  .cell-view-number {
    font-variant-numeric: tabular-nums;
    font-family: var(--font-mono);
  }

  .cell-view-url {
    color: var(--accent-soft-text);
    text-decoration-line: underline;

    &:hover {
      text-decoration-line: underline;
    }
  }

  .cell-view-email {
    text-decoration-line: underline;

    &:hover {
      text-decoration-line: underline;
    }
  }

  .cell-view-file {
    gap: var(--sp-6);

    & .cell-file-link {
      display: inline-flex;
      max-width: 10rem;
      align-items: center;
      gap: var(--sp-4);
      color: var(--text-secondary);

      &:hover {
        color: var(--text-primary);
      }
    }

    & .cell-file-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .cell-view-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
