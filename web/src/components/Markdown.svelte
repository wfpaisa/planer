<!--
  El Markdown de la IA, dibujado.

  Cada pieza sale como un nodo del árbol, nunca como HTML crudo: aqui no hay
  ningún `{@html}`, y por eso un `<script>` que venga en la respuesta se ve como
  texto y no como una etiqueta. Lo que hay que reconocer del texto lo hace
  `lib/markdown.ts`; esto solo pone las clases.
-->
<script lang="ts">
  import { parseMarkdown, type Piece } from "../lib/markdown";

  let { text }: { text: string } = $props();

  const blocks = $derived(parseMarkdown(text));
</script>

{#snippet inline(pieces: Piece[])}
  {#each pieces as piece, i (i)}
    {#if piece.kind === "code"}
      <code class="code-markdown-inline">{piece.text}</code>
    {:else if piece.kind === "link"}
      <!-- prettier-ignore -->
      <a href={piece.href} target="_blank" rel="noreferrer noopener" class="link-markdown">{piece.text}</a>
    {:else if piece.kind === "strong"}
      <strong class="bold-markdown">{piece.text}</strong>
    {:else if piece.kind === "em"}
      <em>{piece.text}</em>
    {:else}{piece.text}{/if}
  {/each}
{/snippet}

<div class="content-markdown flex flex-col gap-2">
  {#each blocks as block (block.id)}
    {#if block.kind === "paragraph"}
      <p class="paragraph-markdown">{@render inline(block.pieces)}</p>
    {:else if block.kind === "heading"}
      <p class="heading-markdown">{@render inline(block.pieces)}</p>
    {:else if block.kind === "code"}
      <pre class="code-markdown-block inset">{block.text}</pre>
    {:else if block.ordered}
      <ol class="list-markdown-ordered">
        {#each block.items as item (item.id)}
          <li>{@render inline(item.pieces)}</li>
        {/each}
      </ol>
    {:else}
      <ul class="list-markdown">
        {#each block.items as item (item.id)}
          <li>{@render inline(item.pieces)}</li>
        {/each}
      </ul>
    {/if}
  {/each}
</div>

<style>
  .content-markdown {
    & .paragraph-markdown {
      white-space: pre-wrap;
    }

    & .heading-markdown {
      font-weight: 600;
      color: var(--text-primary);
    }

    & .code-markdown-inline {
      padding: 0.125rem 0.25rem;
      border-radius: var(--radius-md);
      background: color-mix(in srgb, var(--text-primary) 14%, transparent);
      font-family: var(--font-mono);
      font-size: 0.92em;
    }

    & .link-markdown {
      text-decoration: underline dotted;
      text-underline-offset: 2px;
    }

    & .bold-markdown {
      font-weight: 600;
      color: var(--text-primary);
    }

    /* El bloque es `.inset` del catálogo; aqui solo su letra y que se
       desplace por dentro en vez de estirar el turno. */
    & .code-markdown-block {
      overflow-x: auto;
      padding: var(--sp-8) var(--sp-10);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
    }

    & .list-markdown,
    & .list-markdown-ordered {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      padding-left: var(--sp-20);
    }

    & .list-markdown {
      list-style: disc;
    }

    & .list-markdown-ordered {
      list-style: decimal;
    }
  }
</style>
