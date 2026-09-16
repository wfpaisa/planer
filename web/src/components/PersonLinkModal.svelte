<!--
  La pregunta que sale cuando una columna del archivo esta nombrando usuarios.

  Sale antes de crear nada, y por eso no pide confirmar ningun destrozo: las dos
  salidas construyen la tabla, con la relacion o sin ella. Lo que se decide es
  si el dato queda suelto --una cedula repetida en cada fila-- o enlazado con la
  persona que ya esta invitada.

  Las dos listas se pueden cambiar porque la coincidencia no siempre es una
  sola: un archivo de nomina trae la cedula y el correo, y los dos casan. Viene
  marcada la que mas casa, que es la que acierta casi siempre, y las demas
  quedan a un clic con su recuento al lado para poder compararlas.
-->
<script lang="ts">
  import { PEOPLE_TABLE_LABEL } from "@shared/people";

  import type { PersonColumnGuess, PersonLink } from "../lib/personGuess";
  import Icon from "./Icon.svelte";
  import Button from "./ui/Button.svelte";
  import Field from "./ui/Field.svelte";
  import Modal from "./ui/Modal.svelte";
  import Select from "./ui/Select.svelte";

  let {
    fileName,
    tableLabel,
    guesses,
    onCancel,
    onSkip,
    onConfirm,
  }: {
    /** El archivo que se solto, para que se sepa de donde sale la pregunta. */
    fileName: string;
    /** Como se va a llamar la tabla que esta a punto de nacer. */
    tableLabel: string;
    /** Las columnas que nombran usuarios, la mas clara primero. */
    guesses: PersonColumnGuess[];
    /** Cerrar el dialogo: no se crea nada, como en la otra pregunta al soltar. */
    onCancel: () => void;
    /** Crear la tabla dejando la columna como texto. */
    onSkip: () => void;
    onConfirm: (link: PersonLink) => void;
  } = $props();

  /* Vacios quiere decir "lo que mas casa": `guess` y `chosen` caen al primero,
     que es el que la conjetura dejo de primero. Asi el valor de partida no se
     copia de la prop, que puede cambiar. */
  let column = $state("");
  let key = $state("");

  const guess = $derived(guesses.find((g) => g.column === column) ?? guesses[0]);
  const chosen = $derived(guess?.keys.find((k) => k.key === key) ?? guess?.keys[0]);

  // Cambiar de columna cambia lo que casa: la llave marcada pasa a ser la que
  // mas casa en la columna nueva, no la que quedo de la anterior.
  function pickColumn(next: string) {
    column = next;
    const other = guesses.find((g) => g.column === next);
    if (other) key = other.keys[0].key;
  }

  const count = $derived(
    guess && chosen
      ? `${chosen.matched} de ${guess.values} ${
          guess.values === 1 ? "valor corresponde" : "valores corresponden"
        } a un usuario invitado.`
      : "",
  );

  /*
   * Un valor que tienen dos usuarios no se enlaza: no hay forma de saber a
   * cual. Se dice aqui y no despues porque lo que hay que arreglar esta en la
   * tabla de usuarios --dos personas con la misma cedula-- y quien esta creando
   * esta tabla es quien puede arreglarlo.
   */
  const repetidos = $derived(
    chosen && chosen.ambiguous > 0
      ? `${chosen.ambiguous} ${
          chosen.ambiguous === 1
            ? "valor lo tienen dos usuarios o más, así que no se enlaza"
            : "valores los tienen dos usuarios o más, así que no se enlazan"
        }: revisa "${chosen.keyLabel.toLowerCase()}" en "${PEOPLE_TABLE_LABEL}".`
      : "",
  );
</script>

{#if guess && chosen}
  <Modal
    id="person-link-modal"
    class="modal-person-link"
    open
    onClose={onCancel}
    title={`Relacionar con "${PEOPLE_TABLE_LABEL}"`}
    description={`En "${fileName}" hay una columna cuyos valores ya son de usuarios invitados a esta aplicación.`}
  >
    <div class="body-person-link-modal flex flex-col gap-4">
      <div class="grid-person-link">
        <Field label="Columna del archivo">
          <Select
            value={guess.column}
            onchange={(e) => pickColumn(e.currentTarget.value)}
            disabled={guesses.length === 1}
          >
            {#each guesses as g (g.column)}
              <option value={g.column}>{g.column}</option>
            {/each}
          </Select>
        </Field>

        <Field label={`Columna de "${PEOPLE_TABLE_LABEL}"`}>
          <Select
            value={chosen.key}
            onchange={(e) => (key = e.currentTarget.value)}
            disabled={guess.keys.length === 1}
          >
            {#each guess.keys as k (k.key)}
              <option value={k.key}>{k.keyLabel} ({k.matched} de {guess.values})</option>
            {/each}
          </Select>
        </Field>
      </div>

      <p class="note-person-link-count">
        <Icon name="checkmark-circle-02" size={14} class="icon-note-person-link" />
        <span>
          {count} Los que no correspondan a nadie se guardan a la vista, sin enlace, y se pueden resolver
          despues desde la tabla.
        </span>
      </p>

      {#if repetidos}
        <p class="note-person-link-ambiguous">
          <Icon name="alert-02" size={14} class="icon-note-person-link" />
          <span>{repetidos}</span>
        </p>
      {/if}

      <p class="alert info note-person-link-effect">
        Cada usuario quedara relacionado con sus filas de "{tableLabel}". Con una columna asi, la
        tabla puede mostrarle a cada quien solo lo suyo, y la celda ensena
        {chosen.keyLabel.toLowerCase()} en vez de un dato suelto.
      </p>
    </div>

    {#snippet footer()}
      <Button buttonClass="btn-skip-person-link" onclick={onSkip}>Crear sin relacionar</Button>
      <Button
        variant="secondary"
        buttonClass="btn-confirm-person-link"
        onclick={() => onConfirm({ column: guess.column, key: chosen.key })}
      >
        Relacionar y crear
      </Button>
    {/snippet}
  </Modal>
{/if}

<style>
  .body-person-link-modal {
    & .grid-person-link {
      display: grid;
      gap: var(--sp-12);

      @media (min-width: 40rem) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    & .note-person-link-count {
      display: flex;
      align-items: flex-start;
      gap: var(--sp-8);
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-secondary);

      & :global(.icon-note-person-link) {
        margin-top: 0.0625rem;
        flex-shrink: 0;
      }
    }

    & .note-person-link-ambiguous {
      display: flex;
      align-items: flex-start;
      gap: var(--sp-8);
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--warning);

      & :global(.icon-note-person-link) {
        margin-top: 0.0625rem;
        flex-shrink: 0;
      }
    }

    & .note-person-link-effect {
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
    }
  }
</style>
