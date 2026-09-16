<script lang="ts">
  import { cx } from "../lib/cx";
  import { ICON_NAMES } from "../lib/icons";
  import Icon from "./Icon.svelte";
  import Input from "./ui/Input.svelte";
  import Modal from "./ui/Modal.svelte";

  /** Cuantos iconos se dibujan por busqueda. Mas que esto no cabe ni se lee. */
  const LIMIT = 120;
  /** El tamano de los iconos dentro del buscador. */
  const SIZE = 32;

  let {
    open,
    value,
    onClose,
    onPick,
  }: {
    open: boolean;
    value: string;
    onClose: () => void;
    onPick: (name: string) => void;
  } = $props();

  let query = $state("");
  let search = $state<HTMLInputElement | null>(null);

  /* Cada apertura empieza con la busqueda en blanco y el foco en el campo: es
     lo unico que se va a hacer nada mas abrir. */
  $effect(() => {
    if (!open) return;
    query = "";
    search?.focus();
  });

  const shown = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const matches = q ? ICON_NAMES.filter((n) => n.toLowerCase().includes(q)) : ICON_NAMES;
    const page = matches.slice(0, LIMIT).filter((n) => n !== value);
    return { total: matches.length, names: value ? [value, ...page] : page };
  });
</script>

<Modal
  id="icon-picker-modal"
  class="modal-icon-picker"
  {open}
  {onClose}
  title="Elegir un icono"
  description="Busca por nombre; los nombres están en inglés."
  width="modal-icon-picker-width"
>
  <div>
    <Input
      bind:ref={search}
      bind:value={query}
      placeholder="calendar, user, chart, table..."
      aria-label="Buscar icono"
    />

    <div class="picker-icon flex flex-wrap">
      {#each shown.names as name (name)}
        <button
          type="button"
          onclick={() => onPick(name)}
          data-tip={name}
          aria-label="Icono {name}"
          class={cx("btn-pick-panel-icon", "panel-icon-cell opt", value === name && "active")}
        >
          <Icon {name} size={SIZE} />
        </button>
      {/each}
    </div>

    <p class="icon-picker-note block">
      {#if shown.total === 0}
        Ningun icono con ese nombre.
      {:else if shown.total > LIMIT}
        {LIMIT} de {shown.total} iconos. Afina la busqueda para ver el resto.
      {:else}
        {shown.total}
        {shown.total === 1 ? "icono" : "iconos"}.
      {/if}
    </p>
  </div>
</Modal>

<style>
  /* El panel del modal vive en `Modal.svelte`; su ancho se manda desde aqui. */
  :global(.modal-icon-picker-width) {
    max-width: 42rem;
  }

  .picker-icon {
    gap: var(--sp-6);
    max-height: 24rem;
    overflow-y: auto;
    margin-top: var(--sp-12);

    /* La celda es `.opt` del catalogo; aqui solo su medida, que es cuadrada
       y sin texto: lo unico que lleva dentro es el glifo, centrado. */
    & .panel-icon-cell {
      width: 3rem;
      height: 3rem;
      justify-content: center;
      padding: 0;
    }
  }

  .icon-picker-note {
    margin-top: var(--sp-8);
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-muted);
  }
</style>
