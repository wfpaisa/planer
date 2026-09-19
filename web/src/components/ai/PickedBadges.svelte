<!--
  Lo senalado con el cursor, como badges dentro de la conversacion.

  Son los mismos badges que los atajos --misma forma, misma manera de
  quitarlos-- porque son la misma clase de cosa: algo anadido a la peticion que
  se puede retirar antes de enviarla sin tocar lo que se llevaba escrito.

  Lo que dice cada badge depende de lo que se haya senalado. Un titulo o un
  parrafo se nombran por su etiqueta --`h1`, `p`--, porque ahi lo que importa
  es de que rango es el texto y no lo que dice, que ya se esta viendo en la
  pagina. Cualquier otra cosa se nombra como se llama en la conversacion
  ("tabla Clientes"), que es lo unico que la distingue de las de al lado.
-->
<script lang="ts">
  import type { PickedBlock } from "@shared/types";

  import Icon from "../Icon.svelte";
  import { Tag } from "../ui";

  let { picks, onRemove }: { picks: PickedBlock[]; onRemove: (id: string) => void } = $props();

  /** Las etiquetas que son texto con rango propio. */
  const TEXTO = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p"]);

  const esTexto = (pick: PickedBlock) => TEXTO.has(pick.tag);
</script>

{#if picks.length}
  <div class="picked-badges flex flex-wrap">
    {#each picks as pick (pick.id)}
      <Tag tone="tint-1" removeLabel={`Quitar ${pick.label}`} onRemove={() => onRemove(pick.id)}>
        <Icon name={esTexto(pick) ? "text-square" : "square-dashed"} />
        <span class="pick-label">{esTexto(pick) ? pick.tag : pick.label}</span>
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
