<!--
  Convertir una pagina de bloques en una pagina de HTML.

  Se le pide a la IA el documento equivalente a los bloques que tenia, y se
  muestra antes de tocar nada: dibujado, para ver que hace lo mismo, y en
  codigo, para ver que dice. La pagina no cambia hasta que se acepta.
-->
<script lang="ts" module>
  import type { PageRecord } from "@shared/types";

  /**
   * Cuantos bloques guarda una pagina de las de antes. Es lo unico que se mira
   * de ellos en el panel: dibujarlos ya no sabe nadie, solo convertirlos.
   */
  export const legacyBlockCount = (page: PageRecord): number => {
    const raw = (page as { blocks?: unknown }).blocks;
    return Array.isArray(raw) ? raw.length : 0;
  };

  interface Conversion {
    html: string;
    sources: HtmlSource[];
    resumen: string;
    /** El mismo documento, listo para dibujarse sin haberlo guardado. */
    vista: string;
  }
</script>

<script lang="ts">
  import type { AppTheme, HtmlSource } from "@shared/types";
  import type PocketBase from "pocketbase";

  import { paletteAttrs } from "../lib/appTheme";
  import { cx } from "../lib/cx";
  import { errorMessage, post, put } from "../lib/pb";
  import { theme } from "../lib/theme.svelte";
  import CodeEditor from "./CodeEditor.svelte";
  import HtmlFrame from "./HtmlFrame.svelte";
  import Icon from "./Icon.svelte";
  import { Button, ErrorNote, Loading, Modal } from "./ui";

  let {
    open,
    appId,
    page,
    client,
    appTheme,
    themeKey,
    onClose,
    onDone,
  }: {
    open: boolean;
    appId: string;
    page: PageRecord;
    client: PocketBase;
    /** Los colores de la aplicacion: la vista previa se pinta como vivira la pagina. */
    appTheme: AppTheme | null;
    themeKey?: string;
    onClose: () => void;
    /** La pagina ya se reemplazo: hay que volver a leerla. */
    onDone: (message: string) => void;
  } = $props();

  let result = $state<Conversion | null>(null);
  let view = $state<"vista" | "codigo">("vista");
  let busy = $state(false);
  let saving = $state(false);
  let error = $state("");

  async function generate() {
    busy = true;
    error = "";
    result = null;
    try {
      result = await post<Conversion>(`/api/apps/${appId}/paginas/${page.id}/convertir`, {});
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }

  $effect(() => {
    if (!open) return;
    view = "vista";
    void generate();
  });

  /*
   * Lo propuesto todavia no esta guardado, asi que no tiene huella: el marco lo
   * recibe directamente. La clave cambia con el documento para que volver a
   * generar vuelva a dibujar.
   */
  const key = $derived(`propuesta-${result?.html.length ?? 0}`);
  const loadDoc = $derived.by(() => {
    const html = result?.vista ?? "";
    return async () => html;
  });

  async function replace() {
    if (!result) return;
    saving = true;
    error = "";
    try {
      await put(`/api/apps/${appId}/paginas/${page.id}/html`, {
        content: result.html,
        sources: result.sources,
      });
      onDone(`La página "${page.name}" ya es un documento HTML. ${result.resumen}`);
      onClose();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      saving = false;
    }
  }
</script>

<Modal
  id="convert-dialog"
  class="modal-convert-html"
  {open}
  {onClose}
  title={`Convertir "${page.name}" a HTML`}
  description="La IA escribe el documento equivalente a los bloques de esta página. Revísalo antes de reemplazarla."
  width="modal-convert-width"
  fill
>
  <div class="convert-dialog-body flex h-full flex-col gap-3">
    <div class="convert-dialog-toolbar">
      <div role="tablist" class="tabs-view-code tab-list">
        <button
          type="button"
          role="tab"
          aria-selected={view === "vista"}
          class={cx("btn-tab-view", "tab", view === "vista" && "active")}
          onclick={() => (view = "vista")}
        >
          <Icon name="eye" size={13} /> Como queda
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "codigo"}
          class={cx("btn-tab-code", "tab", view === "codigo" && "active")}
          onclick={() => (view = "codigo")}
        >
          <Icon name="code" size={13} /> Código
        </button>
      </div>
      {#if result}
        <span class="convert-dialog-summary">{result.resumen}</span>
      {/if}
    </div>

    <ErrorNote message={error} />

    <!--
      El recuadro lleva los colores de la aplicacion: el marco lee de su
      contenedor los que le pasa al HTML, igual que en la escena. El modo es el
      del panel, que es sobre lo que se esta revisando.
    -->
    <div
      data-theme={theme.name}
      class="convert-dialog-frame inset plain"
      {...paletteAttrs(appTheme)}
    >
      {#if busy}
        <Loading label="Escribiendo la página" />
      {:else if !result}
        <div class="convert-dialog-empty">Todavía no hay nada que revisar.</div>
      {:else if view === "vista"}
        {#key key}
          <HtmlFrame
            fill
            doc={key}
            sources={result.sources}
            {appId}
            pageId={page.id}
            {client}
            {loadDoc}
            {themeKey}
            title={page.name}
          />
        {/key}
      {:else}
        <CodeEditor value={result.html} language="html" readOnly />
      {/if}
    </div>
  </div>

  {#snippet footer()}
    <Button onclick={onClose} disabled={saving}>Cancelar</Button>
    <Button onclick={() => void generate()} disabled={busy || saving}>
      <Icon name="refresh-cw" /> Volver a generar
    </Button>
    <Button variant="secondary" loading={saving} disabled={!result || busy} onclick={replace}>
      Reemplazar la página
    </Button>
  {/snippet}
</Modal>

<style>
  /* El panel del modal vive en `Modal.svelte`; su ancho se manda desde aqui. */
  :global(.modal-convert-width) {
    max-width: 64rem;
  }

  .convert-dialog-body {
    min-height: 0;

    & .convert-dialog-toolbar {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      gap: var(--sp-8);

      & .convert-dialog-summary {
        margin-left: auto;
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        color: var(--text-muted);
      }
    }

    /* El marco es `.inset.plain` del catalogo --el cerco sin fondo: el que se
       ve dentro es el de la pagina, con su propio tema--; aqui solo que
       crezca con el dialogo. El fondo lo repone el bloque de tema, porque un
       contenedor con `data-theme` propio no hereda el de debajo. */
    & .convert-dialog-frame {
      min-height: 0;
      flex: 1 1 0%;
      overflow: hidden;
      padding: 0;
      background: var(--bg-level2);
    }

    & .convert-dialog-empty {
      display: flex;
      height: 100%;
      align-items: center;
      justify-content: center;
      padding: 0 var(--sp-24);
      text-align: center;
      font-size: var(--text-sm);
      line-height: var(--text-sm--line-height);
      color: var(--text-muted);
    }
  }
</style>
