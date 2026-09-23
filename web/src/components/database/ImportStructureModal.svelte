<!--
  Importar la estructura --las columnas-- de otra tabla a esta.

  Se pega o se arrastra el JSON que sale de "Exportar estructura"; antes de
  aplicar se muestran las columnas que se van a crear y las que no se pueden,
  por tipo desconocido o por una relación sin destino en esta aplicación.
-->
<script lang="ts" module>
  import type { FieldDef } from "@shared/types";

  import type { StructureColumn } from "../../lib/tableStructure";

  /** Convierte una columna leida a la forma que entiende el servidor. */
  function toFieldDef(column: StructureColumn): FieldDef {
    const field: FieldDef = { name: column.name, label: column.label, type: column.type };
    if (column.required) field.required = true;
    if (column.multiple) field.multiple = true;
    if (column.options?.length) field.options = column.options;
    if (column.relationTableId) field.relationTableId = column.relationTableId;
    return field;
  }
</script>

<script lang="ts">
  import type { TableRecord } from "@shared/types";

  import { errorMessage, patch } from "../../lib/pb";
  import { parseStructure } from "../../lib/tableStructure";
  import Icon from "../Icon.svelte";
  import Toast, { type ToastKind } from "../Toast.svelte";
  import { Button, ConfirmDialog, Field, Modal, Note, Select, Textarea } from "../ui";
  import FieldIcon from "./FieldIcon.svelte";

  let {
    table,
    tables,
    onClose,
    onDone,
  }: {
    table: TableRecord;
    tables: TableRecord[];
    onClose: () => void;
    onDone: () => Promise<void> | void;
  } = $props();

  let text = $state("");
  let mode = $state<"add" | "replace">("add");
  let confirmReplace = $state(false);
  let busy = $state(false);
  let error = $state("");

  const parsed = $derived(parseStructure(text, tables));
  const hasInvalid = $derived(parsed.ok && parsed.invalid.length > 0);

  /**
   * Lo que se cuenta debajo del archivo, con su tono. Avisar de que se van a
   * reemplazar las columnas no es un fallo --es lo que se pidio, dicho antes de
   * hacerlo-- y en rojo se leia como si algo hubiera salido mal.
   */
  const note = $derived<{ kind: ToastKind; text: string } | null>(
    error
      ? { kind: "error", text: error }
      : !parsed.ok
        ? { kind: "error", text: parsed.error }
        : mode === "replace"
          ? {
              kind: "warning",
              text: "Se reemplazaran las columnas actuales por las del archivo.",
            }
          : null,
  );

  async function readFile(file: File) {
    text = await file.text();
  }

  async function apply() {
    if (!parsed.ok) return;
    busy = true;
    error = "";
    try {
      let next: FieldDef[];
      if (mode === "add") {
        const taken = new Set<string>();
        for (const f of table.fields) {
          taken.add(f.name);
          taken.add(f.label);
        }
        const fresh = parsed.columns
          .filter((c) => !taken.has(c.name) && !taken.has(c.label))
          .map(toFieldDef);
        next = [...table.fields, ...fresh];
      } else {
        next = parsed.columns.map(toFieldDef);
      }

      await patch(`/api/tables/${table.id}`, { fields: next });
      await onDone();
      onClose();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }

  function guardar() {
    if (mode === "replace" && parsed.ok) {
      confirmReplace = true;
      return;
    }
    void apply();
  }
</script>

<Modal
  id="import-structure-modal"
  class="modal-import-structure"
  open
  {onClose}
  title={`Importar columnas en ${table.label}`}
  description="Pega o arrastra el JSON de una estructura exportada. Las columnas nuevas se agregan sin tocar los datos."
>
  <label
    class="dropzone-structure drop-filter dropzone"
    ondragover={(e) => e.preventDefault()}
    ondrop={(e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) void readFile(file);
    }}
  >
    <Icon name="upload-01" size={18} class="drop-filter-icon" />
    <span class="drop-filter-text">Arrastra un archivo JSON, o haz clic para elegirlo</span>
    <input
      type="file"
      accept=".json,application/json"
      class="input-drop-filter dropzone-input"
      onchange={(e) => {
        const file = e.currentTarget.files?.[0];
        if (file) void readFile(file);
      }}
    />
  </label>

  <div class="import-structure-field">
    <Textarea
      bind:value={text}
      placeholder={'[{"name":"nombre","label":"Nombre","type":"text"}]'}
      class="import-structure-textarea"
    />
  </div>

  <div class="import-structure-field">
    <Field label="Modo">
      <Select bind:value={mode}>
        <option value="add">Agregar las columnas que no existen</option>
        <option value="replace">Reemplazar todas las columnas</option>
      </Select>
    </Field>
  </div>

  {#if parsed.ok}
    <div class="list-new-columns inset">
      <p class="list-new-columns-title eyebrow">
        {parsed.columns.length} columnas para crear
      </p>
      {#each parsed.columns as c (`${c.name}-${c.label}`)}
        <div class="list-column-row">
          <FieldIcon type={c.type} class="list-column-icon" />
          <span class="list-column-name">{c.label}</span>
          {#if c.required}<span class="list-column-required">*</span>{/if}
        </div>
      {/each}
      {#if hasInvalid}
        <Toast kind="error" duration={0}>
          <p class="list-columns-invalid-title">
            {parsed.invalid.length} columnas no se pueden crear
          </p>
          <ul class="list-columns-invalid">
            {#each parsed.invalid as inv (inv.index)}
              <li>Columna {inv.index + 1}: {inv.message}</li>
            {/each}
          </ul>
        </Toast>
      {/if}
    </div>
  {/if}

  <div class="import-structure-field">
    <Note kind={note?.kind ?? "error"} message={note?.text ?? ""} />
  </div>

  {#snippet footer()}
    <Button onclick={onClose}>Cancelar</Button>
    <Button
      variant="secondary"
      loading={busy}
      disabled={!parsed.ok || parsed.columns.length === 0}
      onclick={guardar}
    >
      {mode === "replace" ? "Reemplazar" : "Aplicar"}
    </Button>
  {/snippet}
</Modal>

<ConfirmDialog
  open={confirmReplace}
  onClose={() => (confirmReplace = false)}
  title="Reemplazar todas las columnas"
  message={`Las columnas actuales de "${table.label}" se cambiarán por las del archivo. Los datos de las columnas que no se conserven se borrarán. Esta acción no se puede deshacer.`}
  confirmLabel="Reemplazar"
  {busy}
  onConfirm={() => {
    confirmReplace = false;
    void apply();
  }}
/>

<style>
  /* El hueco es `.dropzone` del catálogo; aqui solo lo que este pide de mas:
     el respiro, que es mas corto --el modal es chico y debajo va el textarea
     con lo mismo escrito a mano-- y la letra de la instruccion. */
  .drop-filter {
    padding: var(--sp-20) var(--sp-16);

    & .drop-filter-text {
      font-size: var(--text-sm);
      line-height: var(--text-sm--line-height);
      color: var(--text-secondary);
    }
  }

  .import-structure-field {
    margin-top: var(--sp-12);
  }

  :global(.import-structure-textarea) {
    min-height: 9rem;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
  }

  /* La caja es `.inset` del catálogo: lo que se lista dentro del modal se
     hunde, no se levanta. Aqui solo su hueco y su tope de alto. */
  .list-new-columns {
    margin-top: var(--sp-12);
    max-height: 16rem;
    overflow-y: auto;
    padding: var(--sp-8);

    /* El rotulo es `.eyebrow` del catálogo; aqui solo su hueco. */
    & .list-new-columns-title {
      padding: var(--sp-4) var(--sp-6) var(--sp-6);
    }

    & .list-column-row {
      display: flex;
      align-items: center;
      gap: var(--sp-8);
      border-radius: var(--radius-sm);
      padding: var(--sp-4) var(--sp-6);
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-primary);

      &:hover {
        background: var(--bg-level2);
      }
    }

    & :global(.list-column-icon) {
      flex-shrink: 0;
      color: var(--text-muted);
    }

    & .list-column-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    & .list-column-required {
      color: var(--accent-soft-text);
    }

    & .list-columns-invalid-title {
      font-weight: 500;
    }

    & .list-columns-invalid {
      margin-top: var(--sp-4);

      & li {
        margin-bottom: 0.125rem;
      }
    }
  }
</style>
