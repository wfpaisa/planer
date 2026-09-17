<!--
  Con que llave se empareja esta columna en esta importacion.

  De una tabla corriente se ofrecen sus columnas unicas; de la de usuarios, las
  que puedan nombrar a alguien, esten marcadas o no --la cedula de una nomina
  importada nunca lo esta--. En las dos, un valor que senala a dos registros no
  enlaza a ninguno: eso lo decide `matchValues` mirando el dato, no la marca.

  Elegir aqui no cambia lo que ensena la grilla, que lo decide la definicion de
  la columna.

  Vive en el encabezado de su columna, junto a los otros botones, y por eso es
  un boton con menu y no una lista desplegable del navegador.
-->
<script lang="ts">
  import { keyCandidates, relationTarget } from "@shared/relations";
  import type { FieldDef, TableRecord } from "@shared/types";

  import type { ColumnMatchReport } from "../../../lib/importParse";
  import Icon from "../../Icon.svelte";
  import { Dropdown, MenuItem, MenuLabel } from "../../ui";

  let {
    field,
    tables,
    value,
    report,
    onChange,
  }: {
    field: FieldDef;
    tables: TableRecord[];
    value: string;
    report?: ColumnMatchReport;
    onChange: (key: string) => void;
  } = $props();

  const target = $derived(relationTarget(field, tables));
  const candidates = $derived(keyCandidates(target?.table ?? null));
  const current = $derived(value || report?.key || target?.key || "");
  const currentLabel = $derived(candidates.find((c) => c.name === current)?.label ?? "llave");
</script>

{#if candidates.length === 0}
  <span class="key-select-empty" data-tip="La tabla destino no tiene ninguna columna sin repetidos">
    sin llave
  </span>
{:else}
  <Dropdown align="right" class="menu-import-key">
    {#snippet trigger({ toggle })}
      <button
        type="button"
        class="btn-pick-import-key key-select-trigger trigger-quiet"
        aria-label={`Llave de ${field.label}`}
        data-tip={`Empareja por "${currentLabel}"`}
        onclick={toggle}
      >
        <Icon name="key-01" size={12} />
        <span class="key-select-label">{currentLabel}</span>
        <Icon name="arrow-down-01" size={12} class="key-select-caret" />
      </button>
    {/snippet}

    {#snippet children(close)}
      <MenuLabel>Emparejar por</MenuLabel>
      {#each candidates as c (c.name)}
        <MenuItem
          onclick={() => {
            close();
            onChange(c.name);
          }}
        >
          {#snippet icon()}
            <Icon name={c.name === current ? "tick-02" : "key-01"} size={14} />
          {/snippet}
          {c.label}
        </MenuItem>
      {/each}
    {/snippet}
  </Dropdown>
{/if}

<style>
  .key-select-empty {
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-muted);
  }

  /* El disparador es `.trigger-quiet` del catalogo --el mismo del encabezado
     de una columna importada--; aqui solo su tope de ancho y su tinta, que es
     la de un dato de apoyo y no la del nombre de la columna. */
  .key-select-trigger {
    max-width: 9rem;
    color: var(--text-secondary);
  }

  .key-select-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.key-select-caret) {
    flex-shrink: 0;
    color: var(--text-muted);
  }
</style>
