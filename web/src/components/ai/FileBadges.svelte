<!--
  Los archivos adjuntos, como badges dentro de la conversacion.

  Son los mismos badges que lo senalado y que los atajos, y por lo mismo: algo
  anadido a la peticion que se puede retirar antes de enviarla sin tocar lo que
  se llevaba escrito. Cambia el icono, que dice de que clase es cada uno.
-->
<script lang="ts" module>
  /** El tamano de un archivo, dicho en la unidad que se lee de un vistazo. */
  export function weigh(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
</script>

<script lang="ts">
  import type { AiFile } from "@shared/types";

  import { AI_FILE_ICON } from "../../lib/aiFiles";
  import Icon from "../Icon.svelte";
  import { Tag } from "../ui";

  let { files, onRemove }: { files: AiFile[]; onRemove: (id: string) => void } = $props();
</script>

{#if files.length}
  <div class="file-badges flex flex-wrap">
    {#each files as file (file.id)}
      <Tag
        tone="tint-2"
        tip={`${file.name} · ${weigh(file.size)}${file.truncated ? " · va recortado" : ""}`}
        removeLabel={`Quitar ${file.name}`}
        onRemove={() => onRemove(file.id)}
      >
        <Icon name={AI_FILE_ICON[file.kind]} />
        <span class="file-name">{file.name}</span>
      </Tag>
    {/each}
  </div>
{/if}

<style>
  .file-badges {
    gap: var(--sp-6);
  }

  .file-name {
    max-width: 10rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
