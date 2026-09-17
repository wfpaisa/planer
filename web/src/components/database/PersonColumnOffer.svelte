<!--
  La oferta de convertir en relacion una columna de texto que nombra personas.

  Sale despues de importar personas, que es cuando lo que ya estaba guardado
  empieza a coincidir: la tabla de chequeos llevaba meses con una columna de
  cedulas escritas a mano, y la nomina que se acaba de importar les acaba de dar
  dueno.

  No convierte nada por su cuenta. Cambiar el tipo de una columna es cambiar la
  estructura de la tabla, asi que aqui solo se pone delante lo que coincide y
  con cuanto; lo que se marque es lo que se convierte.
-->
<script lang="ts">
  import { PEOPLE_TABLE_LABEL } from "@shared/people";

  import type { PersonTextColumn } from "../../lib/personGuess";
  import Icon from "../Icon.svelte";
  import { Button, Modal, Select, Switch } from "../ui";

  let {
    columns,
    busy = false,
    onCancel,
    onConfirm,
  }: {
    /** Las columnas que nombran personas, la mas clara primero. */
    columns: PersonTextColumn[];
    busy?: boolean;
    onCancel: () => void;
    /** Las columnas marcadas, cada una con la llave por la que empareja. */
    onConfirm: (chosen: { column: PersonTextColumn; key: string }[]) => void;
  } = $props();

  /** Que columna esta marcada, por tabla y columna. Todas lo estan de entrada. */
  const idOf = (c: PersonTextColumn) => `${c.table.id}:${c.field.name}`;
  let off = $state<Record<string, boolean>>({});
  /** La llave elegida a mano; vacia quiere decir la que mas casa. */
  let keys = $state<Record<string, string>>({});

  const keyOf = (c: PersonTextColumn) => keys[idOf(c)] || c.keys[0].key;
  const chosen = $derived(
    columns.filter((c) => !off[idOf(c)]).map((c) => ({ column: c, key: keyOf(c) })),
  );
</script>

<Modal
  id="person-column-offer"
  class="modal-person-columns"
  open
  onClose={onCancel}
  title="Hay columnas que están nombrando personas"
  description={`Sus valores son los que tienen las personas invitadas. Convertirlas en columnas que apuntan a "${PEOPLE_TABLE_LABEL}" deja cada fila enlazada con la suya.`}
>
  <div class="list-person-columns flex flex-col gap-3">
    {#each columns as candidate (idOf(candidate))}
      {@const id = idOf(candidate)}
      {@const match = candidate.keys.find((k) => k.key === keyOf(candidate)) ?? candidate.keys[0]}
      <div class="row-person-column">
        <div class="head-person-column">
          <Switch
            checked={!off[id]}
            label={`"${candidate.field.label || candidate.field.name}" en "${candidate.table.label}"`}
            onchange={(value) => (off = { ...off, [id]: !value })}
          />
        </div>

        <p class="count-person-column">
          <Icon name="checkmark-circle-02" size={14} class="icon-person-column" />
          <span>
            {match.matched} de {candidate.values}
            {candidate.values === 1 ? "valor corresponde" : "valores corresponden"} a una sola persona
            invitada.
            {#if match.ambiguous > 0}
              Otros {match.ambiguous} los llevan dos o más, así que esos no se enlazan.
            {/if}
          </span>
        </p>

        {#if candidate.keys.length > 1}
          <Select
            value={keyOf(candidate)}
            onchange={(e) => (keys = { ...keys, [id]: e.currentTarget.value })}
          >
            {#each candidate.keys as k (k.key)}
              <option value={k.key}>{k.keyLabel} ({k.matched} de {candidate.values})</option>
            {/each}
          </Select>
        {/if}
      </div>
    {/each}
  </div>

  <p class="alert info note-person-columns">
    Lo que no corresponda a nadie se guarda a la vista, sin enlace, y se puede resolver después
    desde la tabla. La columna no cambia hasta que se acepte.
  </p>

  {#snippet footer()}
    <Button buttonClass="btn-skip-person-columns" onclick={onCancel} disabled={busy}>
      Dejarlas como están
    </Button>
    <Button
      variant="secondary"
      buttonClass="btn-confirm-person-columns"
      disabled={busy || chosen.length === 0}
      onclick={() => onConfirm(chosen)}
    >
      {busy ? "Convirtiendo..." : "Convertir y enlazar"}
    </Button>
  {/snippet}
</Modal>

<style>
  .list-person-columns {
    & .row-person-column {
      display: flex;
      flex-direction: column;
      gap: var(--sp-8);
      border-radius: var(--radius-lg);
      border: var(--border-width) solid var(--border);
      background: var(--bg-level2);
      padding: var(--sp-12);
    }

    & .head-person-column {
      font-size: var(--text-sm);
      color: var(--text-primary);
    }

    & .count-person-column {
      display: flex;
      align-items: flex-start;
      gap: var(--sp-8);
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-secondary);

      & :global(.icon-person-column) {
        margin-top: 0.0625rem;
        flex-shrink: 0;
      }
    }
  }

  .note-person-columns {
    margin-top: var(--sp-12);
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
  }
</style>
