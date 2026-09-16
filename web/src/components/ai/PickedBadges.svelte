<!--
  Lo senalado con el cursor, como badges dentro de la conversacion.

  Son los mismos badges que los atajos --misma forma, misma manera de
  quitarlos-- porque son la misma clase de cosa: algo anadido a la peticion que
  se puede retirar antes de enviarla sin tocar lo que se llevaba escrito.
-->
<script lang="ts">
  import type { PickedBlock } from "@shared/types";

  import Icon from "../Icon.svelte";
  import { Tag } from "../ui";

  let { picks, onRemove }: { picks: PickedBlock[]; onRemove: (id: string) => void } = $props();
</script>

{#if picks.length}
  <div class="picked-badges flex flex-wrap">
    {#each picks as pick (pick.id)}
      <Tag tone="tint-1" removeLabel={`Quitar ${pick.label}`} onRemove={() => onRemove(pick.id)}>
        <Icon name="cursor-01" />
        <span class="pick-label">{pick.label}</span>
      </Tag>
    {/each}
  </div>
{/if}

<style>
  .picked-badges {
    gap: var(--sp-6);
  }

  .pick-label {
    max-width: 10rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
