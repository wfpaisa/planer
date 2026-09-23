<!--
  Marca los roles de una página o de una persona.
  Sin ninguno marcado, lo ve cualquiera que entre a la aplicación.

  Cada rol es una etiqueta del catálogo que se enciende y se apaga: `tint-1`
  cuando esta marcado y `off` --la pastilla sin fondo, solo su línea-- cuando
  no. Es el mismo gesto, y la misma pieza, que en el resto del panel.
-->
<script lang="ts">
  import { Tag } from "./ui";

  let {
    roles,
    value,
    onChange,
    hint = "Sin marcar ninguno, lo ve cualquiera.",
  }: {
    roles: string[];
    value: string[] | undefined;
    onChange: (next: string[]) => void;
    hint?: string;
  } = $props();

  const marked = $derived(value ?? []);

  const toggle = (role: string) =>
    onChange(marked.includes(role) ? marked.filter((r) => r !== role) : [...marked, role]);
</script>

{#if !roles.length}
  <p class="empty-roles-hint">
    Esta aplicación no tiene roles. Créalos en la tabla "Personas y roles".
  </p>
{:else}
  <div class="picker-roles">
    <div class="list-roles">
      {#each roles as role (role)}
        <Tag
          class="btn-toggle-role"
          tone={marked.includes(role) ? "tint-1" : "off"}
          pressed={marked.includes(role)}
          onclick={() => toggle(role)}
        >
          {role}
        </Tag>
      {/each}
    </div>
    {#if !marked.length}
      <p class="hint-roles">{hint}</p>
    {/if}
  </div>
{/if}

<style>
  .empty-roles-hint {
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-muted);
  }

  .picker-roles {
    /* Las pastillas las dibuja `Tag`: aqui solo como se reparten. */
    & .list-roles {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-6);
    }

    & .hint-roles {
      margin-top: var(--sp-6);
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-muted);
    }
  }
</style>
