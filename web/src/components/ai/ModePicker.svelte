<!--
  Con que animo se va a pedir: cambiar la pagina ya, o conversar el plan antes.

  Es lo mismo que decidia el item "Activar modo Plan" del menu de adjuntar,
  pero a la vista y con las dos salidas juntas: el modo se mira justo antes de
  enviar, como el modelo, y en un menu escondido no se sabia en cual se estaba.
-->
<script lang="ts">
  import Icon from "../Icon.svelte";
  import { Dropdown, MenuItem } from "../ui";

  let {
    status,
    onPick,
  }: {
    /** Como esta el modo Plan: apagado, activo, o cerrado esperando decision. */
    status: "off" | "active" | "closed";
    onPick: (plan: boolean) => void;
  } = $props();

  const plan = $derived(status !== "off");
  /*
   * Un plan cerrado sin implementar no se toca desde aqui: la decision que
   * falta es la de su tarjeta, no la del modo (D5 de `ia-modo-plan`).
   */
  const locked = $derived(status === "closed");
</script>

<!--
  El hueco del que no esta marcado mide lo mismo que el visto bueno, para que
  los dos rotulos empiecen en la misma columna.
-->
{#snippet mark(on: boolean)}
  {#if on}
    <Icon name="check" size={13} class="mode-mark" />
  {:else}
    <span class="mode-hole shrink-0"></span>
  {/if}
{/snippet}

<Dropdown up class="menu-ai-mode">
  {#snippet trigger({ toggle })}
    <button
      type="button"
      disabled={locked}
      onclick={toggle}
      data-tip={locked
        ? "Plan cerrado: decide en la tarjeta del plan"
        : "Elegir como trabaja la IA"}
      aria-label="Elegir como trabaja la IA"
      class="btn-pick-ai-mode flex items-center gap-1"
      class:on={plan}
    >
      <Icon name={plan ? "route-01" : "ai-magic"} size={15} class="mode-icon" />
      <span class="mode-name">{plan ? "Plan" : "Crear"}</span>
      <Icon name="chevron-down" size={12} class="mode-chevron" />
    </button>
  {/snippet}

  {#snippet children(close: () => void)}
    {#snippet createIcon()}
      {@render mark(!plan)}
    {/snippet}
    <MenuItem
      icon={createIcon}
      description="Haz cambios directamente"
      onclick={() => {
        close();
        onPick(false);
      }}
    >
      Crear
    </MenuItem>

    {#snippet planIcon()}
      {@render mark(plan)}
    {/snippet}
    <MenuItem
      icon={planIcon}
      description="Spec detallada para proyectos complejos"
      onclick={() => {
        close();
        onPick(true);
      }}
    >
      Plan
    </MenuItem>
  {/snippet}
</Dropdown>

<style>
  /* La clase la lleva el menu de Dropdown (un componente): sale del ambito. */
  :global(.menu-ai-mode) {
    min-width: 16rem;
  }

  .btn-pick-ai-mode {
    min-width: 0;
    cursor: pointer;
    border-radius: 62.5rem;
    padding: var(--sp-4) var(--sp-8);
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-secondary);
    transition:
      background-color 150ms,
      color 150ms;

    &:hover:not(:disabled) {
      background: var(--bg-field);
      color: var(--text-primary);
    }

    /* En Plan el boton se queda encendido: es un modo, no un clic suelto. */
    &.on {
      background: var(--accent-soft);
      color: var(--accent-soft-text);
    }

    &:disabled {
      cursor: default;
      opacity: 0.6;
    }

    & .mode-name {
      max-width: 6rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  /* Los iconos los dibuja `Icon`, con la clase que le pasamos: fuera del ambito. */
  :global(.mode-icon) {
    flex-shrink: 0;
  }

  :global(.mode-chevron) {
    flex-shrink: 0;
    opacity: 0.6;
  }

  /* El visto bueno va dentro de Icon (un componente): sale del ambito. */
  :global(.mode-mark) {
    flex-shrink: 0;
    margin-top: 0.125rem;
    color: var(--accent);
  }

  /* Mide lo mismo que el visto bueno: los dos rotulos empiezan igual. */
  .mode-hole {
    width: 13px;
  }
</style>
