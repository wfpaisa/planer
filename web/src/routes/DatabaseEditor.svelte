<!--
  Las tablas de la aplicacion, la otra mitad de lo que se construye.

  Vive debajo del mismo encabezado que la aplicacion y se llega con su pestana,
  asi que no tapa nada ni hay que cerrarla: se vuelve cambiando de pestana,
  igual que se vino.
-->
<script lang="ts">
  import DataGrid from "../components/database/DataGrid.svelte";
  import TableSidebar from "../components/database/TableSidebar.svelte";
  import Icon from "../components/Icon.svelte";
  import { EmptyState } from "../components/ui";
  import { useBuilder } from "../lib/builderContext";
  import { navigate, type RouteParams } from "../lib/router.svelte";

  let { params }: { params: RouteParams } = $props();

  const builder = useBuilder();
  const tableId = $derived(params.tableId);
  const table = $derived(builder.tables.find((t) => t.id === tableId) ?? builder.tables[0]);

  // La URL termina siempre nombrando la tabla abierta: se llego sin id, o con
  // uno que ya no existe, y la direccion se corrige sin dejar rastro atras.
  $effect(() => {
    if (table && table.id !== tableId) {
      navigate(`/a/${builder.app.id}/datos/${table.id}`, { replace: true });
    }
  });
</script>

<!--
  La grilla desplaza lo suyo por dentro: aqui se recorta para que no empuje la
  ventana entera hacia el lado.
-->
<div id="database-editor" class="editor-db flex h-full">
  <TableSidebar
    tables={builder.tables}
    activeId={table?.id}
    appId={builder.app.id}
    onChanged={builder.reloadTables}
  />
  <div id="database-editor-content" class="editor-db-content flex-1">
    {#if table}
      <!-- Cambiar de tabla empieza de cero: filtros, paginado y seleccion son suyos. -->
      {#key table.id}
        <DataGrid {table} tables={builder.tables} onSchemaChange={builder.reloadTables} />
      {/key}
    {:else}
      <EmptyState
        title="Esta aplicación no tiene tablas"
        description="Crea la primera tabla para empezar a guardar información."
      >
        {#snippet icon()}<Icon name="Database01Iconx" size={24} />{/snippet}
      </EmptyState>
    {/if}
  </div>
</div>

<style>
  .editor-db {
    overflow: hidden;
    background: var(--bg-level2);
  }

  .editor-db-content {
    position: relative;
    min-width: 0;
  }
</style>
