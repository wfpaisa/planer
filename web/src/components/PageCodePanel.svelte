<!--
  Ver y editar a mano el codigo HTML de una pagina.

  Lo que se edita es lo guardado, no lo servido: si se editara lo servido, lo
  que Planer anade al dibujar entraria en el documento y se duplicaria en cada
  vuelta. Al guardar, el servidor repone las dos referencias si faltan y lo
  dice; ese aviso se muestra aqui.
-->
<script lang="ts" module>
  /** Con lo que nace una pagina que todavia no tiene nada escrito. */
  const EMPTY_PAGE = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Página</title>
</head>
<body>
  <h1>Página nueva</h1>
</body>
</html>
`;
</script>

<script lang="ts">
  import type { PageRecord } from "@shared/types";

  import { rawPageLoader } from "../lib/htmlDocs";
  import { errorMessage, put } from "../lib/pb";
  import CodeEditor from "./CodeEditor.svelte";
  import Icon from "./Icon.svelte";
  import OmniPanel from "./OmniPanel.svelte";
  import { Button, ErrorNote, WarnNote } from "./ui";

  let {
    appId,
    page,
    onClose,
    onSaved,
  }: {
    appId: string;
    page: PageRecord;
    onClose: () => void;
    /** Se avisa con la huella nueva y lo que el servidor tuvo que reponer. */
    onSaved: (result: { doc: string; aviso: string }) => void;
  } = $props();

  let code = $state("");
  let busy = $state(false);
  let saved = $state(false);
  let error = $state("");
  let note = $state("");

  const loadDoc = $derived(rawPageLoader(appId, page.id));

  $effect(() => {
    const hash = page.doc;
    const load = loadDoc;
    saved = false;
    error = "";
    note = "";
    if (!hash) {
      code = EMPTY_PAGE;
      return;
    }
    let alive = true;
    busy = true;
    load(hash)
      .then((html) => {
        if (alive) code = html;
      })
      .catch((err) => {
        if (alive) error = errorMessage(err);
      })
      .finally(() => {
        if (alive) busy = false;
      });
    return () => {
      alive = false;
    };
  });

  async function save() {
    busy = true;
    error = "";
    try {
      const res = await put<{ doc: string; aviso: string }>(
        `/api/apps/${appId}/paginas/${page.id}/html`,
        { content: code },
      );
      note = res.aviso ?? "";
      saved = true;
      onSaved(res);
      if (!res.aviso) onClose();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

<OmniPanel
  title={`Código de "${page.name}"`}
  description="El HTML de esta página, tal como se guarda."
  {onClose}
>
  <div class="body-page-code flex h-full flex-col gap-3">
    <WarnNote message={note} />
    <ErrorNote message={error} />

    <div class="frame-page-code inset plain">
      <CodeEditor value={code} language="html" onChange={(next) => (code = next)} />
    </div>
  </div>

  {#snippet footer()}
    <Button onclick={onClose} disabled={busy}>Cerrar</Button>
    <Button variant="secondary" loading={busy} onclick={save}>
      {#if saved}
        <Icon name="check" size={14} /> Guardado
      {:else}
        Guardar
      {/if}
    </Button>
  {/snippet}
</OmniPanel>

<style>
  .body-page-code {
    min-height: 0;

    /* El marco es `.inset.plain` del catalogo --el cerco sin fondo, que lo
       pinta el editor de dentro--; aqui solo que crezca con el panel. */
    & .frame-page-code {
      min-height: 0;
      flex: 1;
      overflow: hidden;
      padding: 0;
    }
  }
</style>
