<!--
  Mensajes: lo que el panel dice de vuelta --el aviso que se queda y el que
  pasa--.

  Uno de los grupos de la galería; la cabecera de cada ficha y el modal con su
  código los pone `DemoGallery.svelte`, que es quien los compone. Lo que se ve
  aquí no lo pinta este archivo sino `styles/components.css`, igual que en el
  resto del panel.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { head }: { head: Snippet<[string, string, Snippet?]> } = $props();
</script>

<div id="demo-mensajes" class="gallery-group">
  <div class="gallery-group-head">
    <h2>Mensajes</h2>
    <p>Avisos fijos y notificaciones</p>
  </div>
  <div class="gallery-grid">
    <!-- Alert -->
    <article class="card gallery-item wide">
      {@render head("Avisos", "Mensajes de estado. Ej.: el aviso de vista previa")}
      <div class="card-body">
        <div class="gallery-demo">
          <div class="alert info" role="status">
            <i class="hgi-stroke hgi-information-circle"></i>
            <span>
              <strong>Sincronización programada</strong>
              Los datos se actualizarán esta noche a las 03:00.
            </span>
          </div>
          <div class="alert ok" role="status">
            <i class="hgi-stroke hgi-checkmark-circle-02"></i>
            <span>
              <strong>Todo correcto</strong>
              El informe se exportó sin incidencias.
            </span>
          </div>
          <div class="alert warn" role="status">
            <i class="hgi-stroke hgi-alert-02"></i>
            <span>
              <strong>Cuota al 74 %</strong>
              Quedan 258 K eventos en el plan de este mes.
            </span>
          </div>
          <div class="alert danger" role="alert">
            <i class="hgi-stroke hgi-cancel-circle"></i>
            <span>
              <strong>Pago rechazado</strong>
              Revisa el método de pago del cliente.
            </span>
          </div>
        </div>
      </div>
    </article>
    <!-- Toast -->
    <article class="card gallery-item">
      {@render head("Notificación", "Abre un aviso y ciérralo con la cruz o con Escape.")}
      <div class="card-body">
        <div class="gallery-demo">
          <div class="gallery-row">
            <button class="btn" popovertarget="demoToast-ok">Éxito</button>
            <button class="btn" popovertarget="demoToast-info">Info</button>
            <button class="btn" popovertarget="demoToast-warn">Aviso</button>
            <button class="btn" popovertarget="demoToast-danger">Error</button>
          </div>
          <div class="toast ok" id="demoToast-ok" popover>
            <i class="ico hgi-stroke hgi-checkmark-circle-02"></i>
            <span class="t-text">
              <span>Cambios guardados</span>
              <span class="t-sub">El informe se actualizó correctamente.</span>
            </span>
            <button
              class="close"
              popovertarget="demoToast-ok"
              popovertargetaction="hide"
              aria-label="Cerrar"
            >
              <i class="hgi-stroke hgi-cancel-01"></i>
            </button>
          </div>
          <div class="toast info" id="demoToast-info" popover>
            <i class="ico hgi-stroke hgi-information-circle"></i>
            <span class="t-text">
              <span>Sincronización en curso</span>
              <span class="t-sub">Terminará en menos de un minuto.</span>
            </span>
            <button
              class="close"
              popovertarget="demoToast-info"
              popovertargetaction="hide"
              aria-label="Cerrar"
            >
              <i class="hgi-stroke hgi-cancel-01"></i>
            </button>
          </div>
          <div class="toast warn" id="demoToast-warn" popover>
            <i class="ico hgi-stroke hgi-alert-02"></i>
            <span class="t-text">
              <span>Cuota casi agotada</span>
              <span class="t-sub">Quedan 258 K eventos este mes.</span>
            </span>
            <button
              class="close"
              popovertarget="demoToast-warn"
              popovertargetaction="hide"
              aria-label="Cerrar"
            >
              <i class="hgi-stroke hgi-cancel-01"></i>
            </button>
          </div>
          <div class="toast danger" id="demoToast-danger" popover>
            <i class="ico hgi-stroke hgi-cancel-circle"></i>
            <span class="t-text">
              <span>No se pudo exportar</span>
              <span class="t-sub">Revisa la conexión e inténtalo de nuevo.</span>
            </span>
            <button
              class="close"
              popovertarget="demoToast-danger"
              popovertargetaction="hide"
              aria-label="Cerrar"
            >
              <i class="hgi-stroke hgi-cancel-01"></i>
            </button>
          </div>
        </div>
      </div>
    </article>
  </div>
</div>
