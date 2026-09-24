<!--
  Los archivos adjuntos, como badges dentro de la conversación.

  Son los mismos badges que lo senalado y que los atajos, y por lo mismo: algo
  anadido a la petición que se puede retirar antes de enviarla sin tocar lo que
  se llevaba escrito. Cambia el icono, que dice de que clase es cada uno.
-->
<script lang="ts" module>
  /** El tamaño de un archivo, dicho en la unidad que se lee de un vistazo. */
  export function weigh(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
</script>

<script lang="ts">
  import { AI_FILE_ICON, type DraftFile } from "../../lib/aiFiles";
  import Icon from "../Icon.svelte";
  import { Spinner, Tag } from "../ui";

  let { files, onRemove }: { files: DraftFile[]; onRemove: (id: string) => void } = $props();
</script>

{#if files.length}
  <div class="file-badges flex flex-wrap">
    {#each files as file (file.id)}
      <!--
        Mientras se guarda, el badge lo dice: el archivo va en camino y todavía
        no se puede mandar con una petición. Quitarlo ahi corta la subida, que
        es lo que hace que adjuntar algo grande no sea un compromiso.
      -->
      <Tag
        tone="tint-2"
        tip={`${file.name} · ${weigh(file.size)}${file.uploading ? " · guardándose" : ""}`}
        removeLabel={file.uploading ? `Cancelar ${file.name}` : `Quitar ${file.name}`}
        onRemove={() => onRemove(file.id)}
      >
        {#if file.uploading}
          <Spinner />
        {:else}
          <Icon name={AI_FILE_ICON[file.kind]} />
        {/if}
        <span class="file-name">{file.name}</span>
        {#if file.uploading}
          <span class="file-uploading">Subiendo</span>
        {/if}
      </Tag>
    {/each}
  </div>
{/if}

<style>
  .file-badges {
    gap: var(--sp-6);
  }

  .file-uploading {
    color: var(--text-muted);
  }

  .file-name {
    max-width: 10rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
