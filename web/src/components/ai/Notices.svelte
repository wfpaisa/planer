<!-- Un solo boton: ya esta hecho, solo hay que enterarse. -->
<script lang="ts">
  let { notices }: { notices: string[] } = $props();

  let seen = $state(false);
</script>

{#if !seen}
  <div role="status" class="notices-ai alert info">
    <!--
      Los avisos de un turno son fijos; dos iguales son posibles y el texto
      solo no distingue, asi que la posicion entra en la clave.
    -->
    <ul class="notices-ai-list flex flex-col">
      {#each notices as notice, i (`${i}-${notice}`)}
        <li>{notice}</li>
      {/each}
    </ul>
    <button
      type="button"
      onclick={() => (seen = true)}
      class="btn-dismiss-notices btn btn-ghost sm"
    >
      Entendido
    </button>
  </div>
{/if}

<style>
  /* La caja es `.alert.info` del catalogo --el mismo azul y el mismo borde
     que el resto de avisos--; aqui solo el hueco que la separa del turno. */
  .notices-ai {
    margin-top: var(--sp-8);
  }

  .notices-ai-list {
    min-width: 0;
    flex: 1;
    gap: 0.125rem;
  }

  /* El boton hereda la tinta del aviso, que ya es la del acento. */
  .btn-dismiss-notices {
    margin-left: auto;
    color: inherit;
  }
</style>
