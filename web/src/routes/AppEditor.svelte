<!--
  La seccion "Aplicacion" del constructor.

  Ya no arma nada por su cuenta: elige que pagina esta abierta y deja que la
  escena la dibuje con su sidebar y su barra alrededor. Todo lo demas --crear,
  borrar, ajustar, pedirle algo a la IA-- vive en esa escena.
-->
<script lang="ts">
  import { EmptyState } from "../components/ui";
  import { useBuilder } from "../lib/builderContext";
  import type { RouteParams } from "../lib/router.svelte";
  import { navigate } from "../lib/router.svelte";
  import PageStage from "./PageStage.svelte";

  let { params }: { params: RouteParams } = $props();

  const builder = useBuilder();
  const pageId = $derived(params.pageId);
  const page = $derived(
    builder.pages.find((p) => p.id === pageId) ??
      builder.pages.find((p) => p.isHome) ??
      builder.pages.find((p) => !p.separator),
  );

  // La URL termina siempre nombrando la pagina abierta: se llego sin id, o con
  // uno que ya no existe, y la direccion se corrige sin dejar rastro atras.
  $effect(() => {
    if (page && page.id !== pageId) {
      navigate(`/a/${builder.app.id}/app/${page.id}`, { replace: true });
    }
  });
</script>

{#if page}
  <PageStage {page} />
{:else}
  <div class="placeholder-empty-app flex h-full items-center justify-center">
    <EmptyState title="Esta aplicación no tiene páginas" />
  </div>
{/if}
