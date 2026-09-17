<!--
  El encabezado de una columna de la grilla.

  Todo lo que se le puede hacer a una columna se pide desde su propio titulo
  --ordenar, esconderla, cambiarla-- y no solo desde los menus de la barra: es
  donde se esta mirando cuando se quiere. La flecha del orden vive en el titulo
  de la columna ordenada, asi que se ve por que estan las filas asi.
-->
<script lang="ts" module>
  export interface Sort {
    field: string;
    dir: "asc" | "desc";
  }
</script>

<script lang="ts">
  import { ROLE_ICON } from "@shared/people";
  import type { FieldDef } from "@shared/types";

  import { cx } from "../../lib/cx";
  import Icon from "../Icon.svelte";
  import { Dropdown, MenuItem, MenuSeparator } from "../ui";
  import FieldIcon from "./FieldIcon.svelte";

  let {
    field,
    sort,
    onSort,
    onEdit,
    onHide,
    onRoles,
  }: {
    field: FieldDef;
    sort: Sort | null;
    onSort: (next: Sort | null) => void;
    /** Las columnas fijas no se cambian: solo se ordenan, se muestran o se esconden. */
    onEdit?: () => void;
    onHide: () => void;
    /**
     * Abre la gestion de roles. Solo lo trae la columna de roles: sus opciones
     * no se editan como las de un desplegable normal, se nombran ahi.
     */
    onRoles?: () => void;
  } = $props();

  const sorted = $derived(sort?.field === field.name ? sort.dir : null);
</script>

<th
  aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}
  class="column-head text-left"
>
  <!--
    Sin relleno: quien manda dentro es el boton, que ocupa la celda entera
    --igual que en las filas-- para que pinchar en cualquier punto del titulo
    abra su menu.
  -->
  <Dropdown class="menu-column-head" wrapClass="wrap-column-head" align="right">
    {#snippet trigger({ open, toggle })}
      <button
        type="button"
        onclick={toggle}
        class={cx(
          "btn-column-menu",
          "column-head-btn",
          sorted || open ? "column-head-active" : "column-head-quiet",
        )}
      >
        <FieldIcon
          type={field.type}
          system={field.system}
          class={cx(
            "column-head-icon",
            onEdit ? "column-head-icon-editable" : "column-head-icon-fixed",
          )}
        />
        <span class="column-head-label">{field.label}</span>
        {#if field.required}<span class="column-head-required">*</span>{/if}
        {#if sorted === "asc"}
          <Icon name="arrow-up-az" class="column-head-sort-asc" size={42} />
        {:else if sorted === "desc"}
          <Icon name="arrow-down-az" class="column-head-sort-desc" size={16} />
        {/if}

        <Icon name="ellipsis-vertical" class={cx("column-menu")} size={16} />
      </button>
    {/snippet}

    {#snippet children(close)}
      <MenuItem
        onclick={() => {
          onSort({ field: field.name, dir: "asc" });
          close();
        }}
      >
        {#snippet icon()}<Icon name="arrow-up-az" size={14} />{/snippet}
        Ordenar de menor a mayor
      </MenuItem>
      <MenuItem
        onclick={() => {
          onSort({ field: field.name, dir: "desc" });
          close();
        }}
      >
        {#snippet icon()}<Icon name="arrow-down-az" size={14} />{/snippet}
        Ordenar de mayor a menor
      </MenuItem>
      {#if sorted}
        <MenuItem
          onclick={() => {
            onSort(null);
            close();
          }}
        >
          {#snippet icon()}<Icon name="cancel-01" size={14} />{/snippet}
          Quitar orden
        </MenuItem>
      {/if}
      <MenuSeparator />
      {#if onRoles}
        <MenuItem
          onclick={() => {
            close();
            onRoles();
          }}
        >
          {#snippet icon()}<Icon name={ROLE_ICON} size={14} />{/snippet}
          Gestionar roles
        </MenuItem>
      {/if}
      {#if onEdit}
        <MenuItem
          onclick={() => {
            close();
            onEdit();
          }}
        >
          {#snippet icon()}<Icon name="edit-03" size={14} />{/snippet}
          Editar columna
        </MenuItem>
      {/if}
      <MenuItem
        onclick={() => {
          close();
          onHide();
        }}
      >
        {#snippet icon()}<Icon name="eye-off" size={14} />{/snippet}
        Esconder la columna
      </MenuItem>
    {/snippet}
  </Dropdown>
</th>

<style>
  .column-head {
    min-width: 11rem;
    padding: 0;
    font-weight: 500;
    border-right: var(--border-width) solid var(--border);
    background-color: color-mix(in srgb, var(--bg-level1) 97%, var(--text-primary));

    & .column-head-btn {
      display: flex;
      height: 2.25rem;
      width: 100%;
      align-items: center;
      gap: var(--sp-6);
      padding: 0 var(--sp-12);
      cursor: pointer;
      transition:
        background-color 150ms,
        color 150ms;

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary) !important;
      }

      &.column-head-active {
        color: var(--text-primary);
      }

      &.column-head-quiet {
        color: var(--text-secondary);
      }

      /* El icono del tipo de la columna va dentro de FieldIcon (un componente). */
      & :global(.column-head-icon) {
        flex-shrink: 0;
      }

      & :global(.column-head-icon-editable) {
        color: var(--text-muted);
      }

      & :global(.column-head-icon-fixed) {
        color: var(--text-muted);
      }

      & .column-head-required {
        color: var(--accent-soft-text);
      }

      & .column-head-label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Las flechas de orden van dentro de Icon (un componente). */
      & :global(.column-head-sort-asc),
      & :global(.column-head-sort-desc) {
        flex-shrink: 0;
        color: var(--accent-soft-text);
      }

      & :global(.column-menu) {
        margin-left: auto;
        flex-shrink: 0;
        color: var(--text-muted);
        transition: opacity 150ms;
      }
    }
  }

  /* El contenedor y el menu del desplegable viven dentro de Dropdown. */
  .column-head :global(.wrap-column-head) {
    width: 100%;
  }

  .column-head :global(.menu-column-head) {
    width: 15rem;
  }
</style>
