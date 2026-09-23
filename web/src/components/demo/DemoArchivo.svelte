<!--
  Archivo: donde se sueltan los archivos.

  Uno de los grupos de la galería; la cabecera de cada ficha y el modal con su
  código los pone `DemoGallery.svelte`, que es quien los compone. Lo que se ve
  aquí no lo pinta este archivo sino `styles/components.css`, igual que en el
  resto del panel.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { head }: { head: Snippet<[string, string, Snippet?]> } = $props();
</script>

<div id="demo-archivo" class="gallery-group">
  <div class="gallery-group-head">
    <h2>Archivo</h2>
    <p>Subir y soltar archivos</p>
  </div>
  <div class="gallery-grid">
    <!-- Zona de arrastre -->
    <article class="card gallery-item wide col-span-2">
      {@render head("Carga de archivos", "Donde se sueltan archivos. Ej.: importar un CSV")}
      <div class="card-body">
        <div class="gallery-demo">
          <!-- prettier-ignore -->
          <p class="demo-note">
              Tres estados de ejemplo: vacío, archivo válido y archivo rechazado.
              <code>loaded</code> cuando se ha leído, <code>rejected</code> cuando no sirve; el
              motivo lo da el aviso de al lado.
            </p>
          <div class="demo-dropzones">
            <div class="dropzone">
              <i class="hgi-stroke hgi-upload-01" aria-hidden="true"></i>
              <span class="dropzone-hint">Estado vacío · CSV, Excel o JSON</span>
            </div>
            <div class="dropzone loaded">
              <i class="hgi-stroke hgi-checkmark-circle-02" aria-hidden="true"></i>
              <span class="dropzone-lead">pedidos-marzo.csv</span>
              <span class="dropzone-hint">Archivo listo para importar</span>
            </div>
            <div class="dropzone rejected">
              <i class="hgi-stroke hgi-alert-circle" aria-hidden="true"></i>
              <span class="dropzone-lead">informe.pdf</span>
              <span class="dropzone-hint">Formato no compatible. Usa CSV, Excel o JSON.</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  </div>
</div>
