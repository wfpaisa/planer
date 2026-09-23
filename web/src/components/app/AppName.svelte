<!--
  El nombre de la aplicación se cambia escribiendo encima, sin abrir nada.

  En reposo se lee como un título, no como un formulario: sin caja ni fondo. La
  caja aparece al pasar el ratón --ahi se descubre que se puede escribir-- y se
  marca de verdad al escribir dentro. Al guardar, el borde se pone verde un
  momento: el cambio no se anuncia en ninguna otra parte.

  Mide lo que mide el nombre y no lo que sobre en la fila. Para eso se dibuja
  una copia invisible del texto debajo, en la misma casilla de la rejilla: es
  ella la que da el ancho, y el campo se estira encima. Con un maximo de ancho
  un nombre larguisimo se para antes de comerse la fila y se desplaza por dentro.
-->
<script lang="ts">
  import type { AppRecord } from "@shared/types";

  import { useBuilder } from "../../lib/builderContext";
  import { cx } from "../../lib/cx";
  import { patch } from "../../lib/pb";

  let { app, onChanged }: { app: AppRecord; onChanged: () => Promise<void> | void } = $props();

  const builder = useBuilder();

  let field = $state<HTMLInputElement | null>(null);
  let typed = $state<string | null>(null);
  let saved = $state(false);

  // `null` quiere decir "no se esta escribiendo": el nombre que se enseña es el
  // de la aplicación, asi que cambiarlo desde otro sitio --los ajustes, la IA--
  // se ve aqui sin tener que sincronizar nada.
  const value = $derived(typed ?? app.name);

  async function rename(next: string) {
    const name = next.trim();
    typed = null;
    if (!name || name === app.name) return;
    try {
      builder.setApp(await patch<AppRecord>(`/api/apps/${app.id}`, { name }));
      await onChanged();
      saved = true;
      setTimeout(() => (saved = false), 1200);
    } catch {
      /* se descarta lo escrito y vuelve el nombre bueno */
    }
  }
</script>

<!--
  Un ancho minimo: por estrecha que se ponga la ventana siempre queda un trozo
  de nombre y algo que tocar; sin el, la casilla se cierra hasta cero. El
  recorte: la copia que mide no cabe por debajo de su texto, asi que cuando la
  fila aprieta el sobrante se recorta aqui en vez de irse por encima del botón
  de al lado.
-->
<span class="field-app-name app-name-field grid items-center">
  <span aria-hidden="true" class={cx("name-box", "copy-name")}>{value || " "}</span>
  <input
    bind:this={field}
    {value}
    data-tip="Escribe encima para cambiar el nombre"
    aria-label="Nombre de la aplicación"
    oninput={(e) => (typed = e.currentTarget.value)}
    onfocus={(e) => e.currentTarget.select()}
    onblur={(e) => void rename(e.currentTarget.value)}
    onkeydown={(e) => {
      if (e.key === "Enter") e.currentTarget.blur();
      if (e.key === "Escape") {
        typed = null;
        e.currentTarget.blur();
      }
    }}
    class={cx("field-app-name", "name-box", saved && "name-saved")}
  />
</span>

<style>
  .app-name-field {
    min-width: 4.5rem;
    max-width: 15rem;
    flex-shrink: 1;
    overflow: hidden;
  }

  /*
   * La misma caja para el campo y para la copia que lo mide: si no coinciden el
   * borde y el relleno, el ancho sale corrido. Las dos casillas de la rejilla
   * ocupan la misma celda.
   */
  .name-box {
    grid-column-start: 1;
    grid-row-start: 1;
    border: var(--border-width) solid transparent !important;
    padding: var(--sp-4) var(--sp-8);
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
    font-weight: 500;
  }

  .copy-name {
    visibility: hidden;
    white-space: pre;
  }

  input.name-box {
    width: 100%;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-primary);
    outline: none;
    transition:
      border-color 150ms,
      background-color 150ms;

    &:hover {
      border-color: var(--border);
      background: var(--bg-field);
    }

    &:focus {
      border-color: var(--accent);
      background: var(--bg-level2);
    }

    /* El visto bueno dura un momento y se va solo. */
    &.name-saved {
      border-color: color-mix(in oklab, var(--success) 60%, transparent) !important;
      background: color-mix(in oklab, var(--success) 10%, transparent);
    }
  }
</style>
