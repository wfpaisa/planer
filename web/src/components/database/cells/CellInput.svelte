<!--
  El control con el que se edita una celda, segun el tipo de su columna.
-->
<script lang="ts">
  import { type FieldDef, isRelationField, type TableRecord } from "@shared/types";
  import type PocketBase from "pocketbase";

  // `toInputValue` vive en `lib/cellValues`: el portapapeles de la grilla copia
  // con ella y no dibuja ningún control.
  import { type Row, toInputValue } from "../../../lib/cellValues";
  import { Input, Select, Textarea } from "../../ui";
  import KeyPicker from "./KeyPicker.svelte";
  import MultiSelect from "./MultiSelect.svelte";

  let {
    field,
    value,
    row,
    onChange,
    tables,
    client,
    autofocus = false,
    onDone,
    onCancel,
  }: {
    field: FieldDef;
    value: unknown;
    /**
     * La fila que se esta editando. Solo la necesita una relación: lo que se
     * escribe es la llave, y la llave de una fila ya guardada vive en el
     * registro enlazado, no en la celda.
     */
    row?: Row;
    onChange: (value: unknown) => void;
    tables: TableRecord[];
    client: PocketBase;
    autofocus?: boolean;
    onDone?: () => void;
    onCancel?: () => void;
  } = $props();

  function keys(e: KeyboardEvent) {
    if (e.key === "Enter" && field.type !== "longtext") onDone?.();
    if (e.key === "Escape") (onCancel ?? onDone)?.();
  }

  /** Enfoca el control al abrir la edicion de la celda. */
  let node = $state<HTMLElement | null>(null);
  $effect(() => {
    if (autofocus) node?.focus();
  });

  const text = $derived(toInputValue(field, value));
</script>

{#if field.type === "longtext"}
  <Textarea
    {autofocus}
    value={text}
    oninput={(e) => onChange(e.currentTarget.value)}
    onblur={onDone}
  />
{:else if field.type === "number"}
  <Input
    type="number"
    {autofocus}
    value={text}
    oninput={(e) => onChange(e.currentTarget.value === "" ? null : Number(e.currentTarget.value))}
    onblur={onDone}
    onkeydown={keys}
  />
{:else if field.type === "bool"}
  <label class="cell-edit-bool choice">
    <input
      bind:this={node}
      type="checkbox"
      checked={!!value}
      onchange={(e) => onChange(e.currentTarget.checked)}
      aria-label="Valor booleano"
      class="checkbox-toggle-bool-cell"
    />
    <i class="choice-box ico-nudge hgi-stroke hgi-tick-02" aria-hidden="true"></i>
    {value ? "Si" : "No"}
  </label>
{:else if field.type === "date"}
  <Input
    type="datetime-local"
    {autofocus}
    value={text}
    oninput={(e) => onChange(e.currentTarget.value ? `${e.currentTarget.value}:00.000Z` : "")}
    onblur={onDone}
    onkeydown={keys}
  />
{:else if field.type === "select"}
  {#if field.multiple}
    <MultiSelect
      options={field.options ?? []}
      value={Array.isArray(value) ? value.map(String) : value ? [String(value)] : []}
      {onChange}
    />
  {:else}
    <Select
      {autofocus}
      value={value ? String(value) : ""}
      onchange={(e) => {
        onChange(e.currentTarget.value);
        onDone?.();
      }}
      onblur={onDone}
    >
      <option value="">Sin valor</option>
      {#each field.options ?? [] as option (option)}
        <option value={option}>{option}</option>
      {/each}
    </Select>
  {/if}
{:else if field.type === "file"}
  <input
    bind:this={node}
    type="file"
    multiple={field.multiple}
    onchange={(e) => {
      const files = e.currentTarget.files;
      onChange(field.multiple ? Array.from(files ?? []) : (files?.[0] ?? null));
      onDone?.();
    }}
    class="cell-file-input field-control sm w-full"
  />
{:else if isRelationField(field)}
  <KeyPicker {field} {value} {row} {onChange} {tables} {client} {onDone} />
{:else}
  <Input
    type={field.type === "email" ? "email" : field.type === "url" ? "url" : "text"}
    {autofocus}
    value={text}
    oninput={(e) => onChange(e.currentTarget.value)}
    onblur={onDone}
    onkeydown={keys}
  />
{/if}

<style>
  .cell-edit-bool {
    height: 2.25rem;
    padding: 0 var(--sp-4);
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
    color: var(--text-primary);
  }

  .cell-file-input {
    height: 2.25rem;
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-secondary);
  }
</style>
