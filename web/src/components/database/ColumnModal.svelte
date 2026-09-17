<!--
  Crear o cambiar una columna de una tabla.
-->
<script lang="ts" module>
  /**
   * Lo que hay que entender para elegir bien: la columna guarda el enlace al
   * registro, pero quien la mira nunca ve un id. Ve esto.
   */
  const DISPLAY_HINT =
    "Es lo que se ve en la grilla, lo que sale al exportar y lo que recibe la página publicada. " +
    "Conviene una columna que no se repita, como una cédula o una placa.";

  /**
   * Por que hay una segunda columna, y por que va detras y no en lugar de la
   * primera: la llave identifica pero no se reconoce. "1152186939" no dice quien
   * es; "1152186939 (ana@empresa.com)" si, sin esconder el dato que se escribe.
   */
  const DETAIL_HINT =
    "Va entre paréntesis, detrás de lo anterior. Sirve para reconocer a qué apunta la fila " +
    "cuando la llave por sí sola no lo dice.";

  /**
   * Que pasa con las filas de esta columna cuando se borra aquello a lo que
   * apuntan. No se pregunta al crear la columna: ahi ya se piden tres cosas, y
   * esta es sobre algo que quiza no pase nunca. Ver `design.md` D7.
   */
  const ON_DELETE_HINT =
    "Se avisa antes de borrar, con el número de filas de cada tabla que se ven afectadas.";
</script>

<script lang="ts">
  import { reservedPersonName } from "@shared/people";
  import {
    detailFieldOf,
    displayFieldOf,
    type FieldDef,
    type FieldType,
    isRelationField,
    onDeleteOf,
    type RelationOnDelete,
    type TableRecord,
  } from "@shared/types";
  import { untrack } from "svelte";

  import { cx } from "../../lib/cx";
  import { FIELD_TYPE_KEYS, FIELD_TYPES } from "../../lib/fieldTypes";
  import { errorMessage, patch } from "../../lib/pb";
  import { getPeople } from "../../lib/people.svelte";
  import { linkParkedValues } from "../../lib/relations";
  import Icon from "../Icon.svelte";
  import { Button, ConfirmDialog, ErrorNote, Field, Input, Modal, Select, Switch } from "../ui";
  import FieldIcon from "./FieldIcon.svelte";

  let {
    table,
    tables,
    field,
    onClose,
    onSaved,
  }: {
    table: TableRecord;
    tables: TableRecord[];
    field?: FieldDef;
    onClose: () => void;
    onSaved: () => Promise<void> | void;
  } = $props();

  /*
   * La tarjeta se monta de nuevo cada vez que se abre, asi que la columna que
   * llega no cambia mientras dura. `untrack` dice eso: se lee una sola vez y a
   * proposito, y lo que se edita a partir de ahi es el borrador de aqui.
   */
  const isNew = untrack(() => !field);
  const people = getPeople();

  let draft = $state<FieldDef>(
    untrack(() => (field ? { ...field } : { name: "", label: "", type: "text", required: false })),
  );
  let busy = $state(false);
  let error = $state("");
  /** Pide confirmacion antes de borrar la columna. */
  let confirming = $state(false);

  const set = (next: Partial<FieldDef>) => {
    draft = { ...draft, ...next };
  };

  async function save() {
    busy = true;
    error = "";
    try {
      const next = isNew
        ? [...table.fields, { ...draft, name: draft.name || draft.label }]
        : table.fields.map((f) => (f.id === field?.id ? draft : f));
      await patch(`/api/tables/${table.id}`, { fields: next });

      /*
       * Convertir una columna en relacion deja sus valores esperando en el
       * corralito, y desde aqui ya se sabe contra que emparejarlos. Se hace
       * antes de refrescar para que la grilla salga con los enlaces puestos:
       * ver trece "sin enlace" que se resuelven solos al recargar seria peor
       * que no verlos nunca.
       *
       * Una columna nueva no tiene filas, y lo que falle aqui no puede tumbar
       * un cambio de columna que la base ya acepto.
       */
      if (!isNew && isRelationField(draft) && draft.multiple !== true) {
        await linkParkedValues({ table, tables, field: draft, people: people.list }).catch(() => 0);
      }

      await onSaved();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }

  async function confirmRemove() {
    busy = true;
    error = "";
    try {
      await patch(`/api/tables/${table.id}`, {
        fields: table.fields.filter((f) => f.id !== field?.id),
      });
      await onSaved();
    } catch (err) {
      error = errorMessage(err);
      busy = false;
    }
  }

  const options = $derived(draft.options ?? []);
  const otherTables = $derived(tables.filter((t) => t.id !== table.id));

  /**
   * Por que este nombre no vale en la tabla de personas, mientras se escribe.
   *
   * El servidor lo rechaza igual (`guardSystemFields`): esto es para que el
   * aviso llegue antes de guardar y no despues, que es cuando ya se escribio
   * todo lo demas. Fuera de esa tabla no salta nunca.
   *
   * Se mira el titulo solo en una columna nueva, que es de donde sale su nombre
   * tecnico. En una que ya existe se mira el nombre que tiene: renombrarla
   * cambia el titulo y deja el nombre quieto, asi que llamar "Correo" a una
   * columna que se llama `departamento` no tapa nada.
   */
  const nameTaken = $derived(reservedPersonName(table, isNew ? draft.label : (field?.name ?? "")));

  /**
   * Columnas de la tabla destino que se pueden ensenar en lugar del id.
   *
   * Las que admiten varios valores quedan fuera: una celda ensena un dato, y
   * una lista de roles no dice quien es nadie.
   */
  const targetFields = $derived<{ name: string; label: string }[]>(
    otherTables
      .find((t) => t.id === draft.relationTableId)
      ?.fields.filter((f) => !isRelationField(f) && f.type !== "file" && f.multiple !== true)
      .map((f) => ({ name: f.name, label: f.label })) ?? [],
  );

  /** Una columna que se ensena a si misma no tiene sentido. */
  const canBeUnique = $derived(
    !isRelationField(draft) && draft.type !== "file" && draft.type !== "bool",
  );
</script>

<Modal
  id="column-modal"
  class="modal-column"
  width="modal-panel-width-lg"
  open
  {onClose}
  title={isNew ? "Nueva columna" : "Editar columna"}
  description={isNew ? undefined : "Cambiar el tipo puede convertir o vaciar los datos."}
>
  <div class="column-modal-fields flex flex-col gap-4">
    <Field label="Nombre">
      <Input
        autofocus
        value={draft.label}
        oninput={(e) => set({ label: e.currentTarget.value })}
        placeholder="Departamento"
      />
    </Field>

    {#if nameTaken}
      <ErrorNote
        message={`En la tabla de personas ninguna columna puede llamarse así: ese nombre lo ocupa ${nameTaken}, que es como llega a una página publicada.`}
      />
    {/if}

    <Field label="Tipo">
      <div class="field-type-grid grid">
        {#each FIELD_TYPE_KEYS as type (type)}
          <button
            type="button"
            onclick={() => set({ type: type as FieldType })}
            class={cx(
              "btn-pick-field-type",
              "field-type-cell opt",
              draft.type === type && "active",
            )}
          >
            <FieldIcon {type} size={20} class="field-type-icon" />
            <span class="field-type-text opt-body">
              <span class="field-type-name opt-label">{FIELD_TYPES[type].label}</span>
              <span class="field-type-hint opt-hint">{FIELD_TYPES[type].hint}</span>
            </span>
          </button>
        {/each}
      </div>
    </Field>

    {#if draft.type === "select"}
      <Field label="Opciones">
        <div class="option-list flex flex-col">
          <!-- Opciones sin id propio: el indice es su identidad. -->
          {#each options as option, index (index)}
            <div class="option-row">
              <Input
                value={option}
                oninput={(e) =>
                  set({
                    options: options.map((o, i) => (i === index ? e.currentTarget.value : o)),
                  })}
                placeholder="Ventas"
              />
              <button
                type="button"
                onclick={() => set({ options: options.filter((_, i) => i !== index) })}
                class="btn-remove-option"
                aria-label="Quitar"
              >
                <Icon name="cancel-01" size={15} />
              </button>
            </div>
          {/each}
          <Button size="sm" onclick={() => set({ options: [...options, ""] })}>
            <Icon name="plus" size={13} /> Añadir opción
          </Button>
        </div>
      </Field>
    {/if}

    {#if draft.type === "relation"}
      <Field label="Tabla relacionada">
        <Select
          value={draft.relationTableId ?? ""}
          onchange={(e) =>
            // Cambiar de tabla deja sin sentido las columnas que se ensenaban.
            set({ relationTableId: e.currentTarget.value, displayField: "", detailField: "" })}
        >
          <option value="">Elige una tabla</option>
          {#each otherTables as t (t.id)}
            <option value={t.id}>{t.label}</option>
          {/each}
        </Select>
      </Field>
    {/if}

    {#if isRelationField(draft)}
      <Field label="Qué se ve de esa tabla" hint={DISPLAY_HINT}>
        <Select
          value={displayFieldOf(draft)}
          onchange={(e) => set({ displayField: e.currentTarget.value })}
          disabled={targetFields.length === 0}
        >
          {#if targetFields.length === 0}
            <option value="">Elige antes la tabla relacionada</option>
          {:else}
            {#each targetFields as f (f.name)}
              <option value={f.name}>{f.label}</option>
            {/each}
          {/if}
        </Select>
      </Field>

      <Field label="Qué se ve entre paréntesis" hint={DETAIL_HINT}>
        <Select
          value={detailFieldOf(draft)}
          onchange={(e) => set({ detailField: e.currentTarget.value })}
          disabled={targetFields.length === 0}
        >
          <option value="">Nada</option>
          <!-- La misma columna dos veces no anade nada, asi que no se ofrece. -->
          {#each targetFields.filter((f) => f.name !== displayFieldOf(draft)) as f (f.name)}
            <option value={f.name}>{f.label}</option>
          {/each}
        </Select>
      </Field>

      <!-- Solo en una columna que ya existe: al crearla no se pregunta. -->
      {#if !isNew}
        <Field label="Si se borra aquello a lo que apunta" hint={ON_DELETE_HINT}>
          <Select
            value={onDeleteOf(draft)}
            onchange={(e) => set({ onDelete: e.currentTarget.value as RelationOnDelete })}
          >
            <option value="keep">Conservar el valor a la vista, sin enlace</option>
            <option value="cascade">Borrar también estas filas</option>
          </Select>
        </Field>
      {/if}
    {/if}

    <div class="column-modal-switches flex flex-wrap gap-6">
      <Switch
        checked={draft.required === true}
        onchange={(v) => set({ required: v })}
        label="Obligatoria"
      />
      {#if draft.type === "select" || draft.type === "file" || draft.type === "relation"}
        <Switch
          checked={draft.multiple === true}
          onchange={(v) => set({ multiple: v })}
          label="Permitir varios"
        />
      {/if}
      {#if canBeUnique}
        <Switch
          checked={draft.unique === true}
          onchange={(v) => set({ unique: v })}
          label="No se repite"
        />
      {/if}
    </div>

    {#if canBeUnique && draft.unique === true}
      <p class="alert info note-column-modal">
        Dos filas no podrán tener el mismo valor aquí. Solo una columna así sirve de llave para
        traer datos de un archivo: si el valor se repite, no identifica a nadie.
      </p>
    {/if}

    <ErrorNote message={error} />
  </div>

  {#snippet footer()}
    {#if !isNew}
      <Button variant="ghost" class="column-delete-btn" onclick={() => (confirming = true)}>
        <Icon name="trash" size={14} /> Borrar
      </Button>
    {/if}
    <Button onclick={onClose}>Cancelar</Button>
    <Button
      variant="secondary"
      loading={busy}
      disabled={!draft.label.trim() || !!nameTaken}
      onclick={save}
    >
      Guardar
    </Button>
  {/snippet}
</Modal>

<ConfirmDialog
  open={confirming}
  onClose={() => (confirming = false)}
  title={`Borrar columna "${field?.label ?? ""}"`}
  message="Se borrará la columna y el contenido que contenga. Esta acción no se puede deshacer."
  {busy}
  onConfirm={() => {
    confirming = false;
    void confirmRemove();
  }}
/>

<style>
  .note-column-modal {
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
  }

  .field-type-grid {
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-6);

    @media (min-width: 40rem) {
      grid-template-columns: 1fr 1fr 1fr;
    }

    /*
     * La celda es `.opt` del catalogo --borde, radio, tinte al elegirla y su
     * par `.opt-label` / `.opt-hint`--. Aqui solo lo que esta rejilla pide
     * distinto: el icono arriba en vez de centrado, porque la celda lleva dos
     * renglones, y la letra un escalon mas chica para que quepan doce tipos.
     */
    & .field-type-cell {
      align-items: flex-start;
      padding: var(--sp-8) var(--sp-10);

      /* El icono del tipo va dentro de FieldIcon (un componente). El color lo
         hereda de la celda, que ya sabe si esta elegida o no. */
      & :global(.field-type-icon) {
        margin-top: 0.125rem;
        flex-shrink: 0;
        color: inherit;
      }

      & .field-type-name,
      & .field-type-hint {
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
      }

      & .field-type-hint {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }

  .option-list {
    gap: var(--sp-6);

    & .option-row {
      display: flex;
      gap: var(--sp-8);

      & .btn-remove-option {
        padding: 0 var(--sp-4);
        color: var(--text-muted);
        transition: color 150ms;

        &:hover {
          color: var(--danger);
        }
      }
    }
  }

  .column-modal-switches {
    padding-top: var(--sp-4);
  }

  /* El boton de borrar llega al Button (un componente): margin y tinta. */
  :global(.column-delete-btn) {
    margin-right: auto;
    color: var(--danger);
  }
</style>
