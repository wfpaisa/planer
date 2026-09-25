<!--
  Superposición: lo que se abre encima de la página --modales, paneles
  laterales y el texto que asoma al pasar el cursor--.

  Uno de los grupos de la galería; la cabecera de cada ficha y el modal con su
  código los pone `DemoGallery.svelte`, que es quien los compone. Lo que se ve
  aquí no lo pinta este archivo sino `styles/components.css`, igual que en el
  resto del panel.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { head }: { head: Snippet<[string, string, Snippet?]> } = $props();
</script>

<div id="demo-superposicion" class="gallery-group">
  <div class="gallery-group-head">
    <h2>Superposición</h2>
    <p>Lo que se abre encima de la página</p>
  </div>
  <div class="gallery-grid">
    <!-- Modal -->
    <article class="card gallery-item">
      {@render head("Ventana emergente", "Pide una decisión. Ej.: crear una columna")}
      <div class="card-body">
        <div class="gallery-demo">
          <div class="gallery-row">
            <button class="btn btn-primary" popovertarget="demoModal">Abrir modal</button>
            <button class="btn" popovertarget="demoModalLg">Con medida fija</button>
          </div>
          <div
            class="modal"
            id="demoModal"
            role="dialog"
            aria-label="Cancelar pedido de ejemplo"
            popover
          >
            <div class="modal-head">
              <div>
                <h3>¿Cancelar el pedido #AR-4821?</h3>
                <p>Creado el 12 de marzo · Elena Vargas</p>
              </div>
              <button
                class="btn-icon sm btn-rounded"
                popovertarget="demoModal"
                popovertargetaction="hide"
                aria-label="Cerrar"
              >
                <i class="icon icon-cancel-01"></i>
              </button>
            </div>
            <div class="modal-body">
              <p>
                Se devolverá el importe al método de pago original. La acción no se puede deshacer.
              </p>
            </div>
            <div class="modal-foot">
              <button class="btn" popovertarget="demoModal" popovertargetaction="hide">
                Volver
              </button>
              <button
                class="btn-demo-cancel-order btn btn-danger"
                popovertarget="demoModal"
                popovertargetaction="hide"
              >
                Cancelar pedido
              </button>
            </div>
          </div>

          <div
            class="modal"
            id="demoModalLg"
            role="dialog"
            aria-label="Historial del pedido de ejemplo"
            popover
            style="--modal-w: 38.75rem; --modal-h: 28.75rem"
          >
            <div class="modal-head">
              <div>
                <h3>Historial del pedido</h3>
                <p>620 × 460 px · el scroll vive en el cuerpo</p>
              </div>
              <button
                class="btn-icon sm btn-rounded"
                popovertarget="demoModalLg"
                popovertargetaction="hide"
                aria-label="Cerrar"
              >
                <i class="icon icon-cancel-01"></i>
              </button>
            </div>
            <div class="modal-body">
              <ol class="timeline">
                <li class="done">
                  <span class="t-time">
                    <b>09:14</b>
                    <span>12 mar</span>
                  </span>
                  <div class="t-body">
                    <span class="t-title">Pedido creado</span>
                    <span class="t-desc">Orden #AR-4821 · 3 artículos</span>
                  </div>
                </li>
                <li class="done">
                  <span class="t-time">
                    <b>09:16</b>
                    <span>12 mar</span>
                  </span>
                  <div class="t-body">
                    <span class="t-title">Pago confirmado</span>
                    <span class="t-desc">Visa ···4192 · 184,20 €</span>
                  </div>
                </li>
                <li class="done">
                  <span class="t-time">
                    <b>15:02</b>
                    <span>12 mar</span>
                  </span>
                  <div class="t-body">
                    <span class="t-title">Preparando el envío</span>
                    <span class="t-desc">Almacén de Madrid</span>
                  </div>
                </li>
                <li class="done">
                  <span class="t-time">
                    <b>08:40</b>
                    <span>13 mar</span>
                  </span>
                  <div class="t-body">
                    <span class="t-title">Entregado al transportista</span>
                    <span class="t-desc">SEUR · guía 884-201-77</span>
                  </div>
                </li>
                <li class="done">
                  <span class="t-time">
                    <b>07:25</b>
                    <span>14 mar</span>
                  </span>
                  <div class="t-body">
                    <span class="t-title">En reparto</span>
                    <span class="t-desc">Vehículo 14 · ruta centro</span>
                  </div>
                </li>
                <li class="done">
                  <span class="t-time">
                    <b>12:10</b>
                    <span>14 mar</span>
                  </span>
                  <div class="t-body">
                    <span class="t-title">Primer intento fallido</span>
                    <span class="t-desc">Nadie en el domicilio</span>
                  </div>
                </li>
                <li class="done">
                  <span class="t-time">
                    <b>09:05</b>
                    <span>15 mar</span>
                  </span>
                  <div class="t-body">
                    <span class="t-title">Segundo reparto</span>
                    <span class="t-desc">Reprogramado por el cliente</span>
                  </div>
                </li>
                <li class="done">
                  <span class="t-time">
                    <b>11:48</b>
                    <span>15 mar</span>
                  </span>
                  <div class="t-body">
                    <span class="t-title">Entregado</span>
                    <span class="t-desc">Firmado por E. Vargas</span>
                  </div>
                </li>
                <li>
                  <span class="t-time">
                    <b>16:30</b>
                    <span>18 mar</span>
                  </span>
                  <div class="t-body">
                    <span class="t-title">Devolución solicitada</span>
                    <span class="t-desc">Motivo: talla incorrecta</span>
                  </div>
                </li>
                <li>
                  <span class="t-time">
                    <b>10:02</b>
                    <span>19 mar</span>
                  </span>
                  <div class="t-body">
                    <span class="t-title">Reembolso emitido</span>
                    <span class="t-desc">184,20 € al método original</span>
                  </div>
                </li>
              </ol>
            </div>
            <div class="modal-foot">
              <button class="btn" popovertarget="demoModalLg" popovertargetaction="hide">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
    <!-- Drawer -->
    <article class="card gallery-item">
      {@render head("Panel lateral", "Entra desde un lado. Ej.: editar una fila")}
      <div class="card-body">
        <div class="gallery-demo">
          <div class="gallery-row">
            <button class="btn" popovertarget="demoDrawerL">
              <i class="icon icon-sidebar-left"></i>
              Izquierda
            </button>
            <button class="btn" popovertarget="demoDrawerR">
              <i class="icon icon-sidebar-right"></i>
              Derecha
            </button>
          </div>

          <div
            class="drawer left"
            id="demoDrawerL"
            role="dialog"
            aria-label="Filtros de ejemplo"
            popover
          >
            <div class="modal-head">
              <div>
                <h3>Filtros</h3>
                <p>248 pedidos en el periodo</p>
              </div>
              <button
                class="btn-icon sm btn-rounded"
                popovertarget="demoDrawerL"
                popovertargetaction="hide"
                aria-label="Cerrar"
              >
                <i class="icon icon-cancel-01"></i>
              </button>
            </div>
            <div class="modal-body">
              <div class="field">
                <label for="drwSearch">Buscar</label>
                <div class="join">
                  <input type="search" id="drwSearch" placeholder="Cliente o referencia" />
                  <button class="btn btn-primary" type="button" aria-label="Buscar">
                    <i class="icon icon-search-01"></i>
                  </button>
                </div>
              </div>
              <div class="field">
                <label for="drwState">Estado</label>
                <select id="drwState">
                  <option>Todos</option>
                  <option>Pagado</option>
                  <option>Pendiente</option>
                  <option>Fallido</option>
                </select>
              </div>
              <div class="field">
                <label for="drwFrom">Desde</label>
                <input type="date" id="drwFrom" />
              </div>
              <label class="choice">
                <input type="checkbox" checked />
                <i class="choice-box ico-nudge icon icon-tick-02" aria-hidden="true"></i>
                <span>Solo pedidos con incidencia</span>
              </label>
              <label class="choice">
                <input type="checkbox" />
                <i class="choice-box ico-nudge icon icon-tick-02" aria-hidden="true"></i>
                <span>Incluir archivados</span>
              </label>
            </div>
            <div class="modal-foot">
              <button class="btn" popovertarget="demoDrawerL" popovertargetaction="hide">
                Limpiar
              </button>
              <button
                class="btn btn-primary"
                popovertarget="demoDrawerL"
                popovertargetaction="hide"
              >
                Aplicar
              </button>
            </div>
          </div>

          <div
            class="drawer right"
            id="demoDrawerR"
            role="dialog"
            aria-label="Pedido de ejemplo"
            popover
            style="--drawer-w: 23rem"
          >
            <div class="modal-head">
              <div>
                <h3>Pedido #AR-4821</h3>
                <p>Elena Vargas · 12 de marzo</p>
              </div>
              <button
                class="btn-icon sm btn-rounded"
                popovertarget="demoDrawerR"
                popovertargetaction="hide"
                aria-label="Cerrar"
              >
                <i class="icon icon-cancel-01"></i>
              </button>
            </div>
            <div class="modal-body">
              <p>
                El panel llena el alto de la ventana y el scroll vive en el cuerpo, igual que en el
                modal.
              </p>
              <ol class="timeline">
                <li class="done">
                  <span class="t-time">
                    <b>09:14</b>
                    <span>12 mar</span>
                  </span>
                  <div class="t-body">
                    <span class="t-title">Pedido creado</span>
                    <span class="t-desc">3 artículos · 184,20 €</span>
                  </div>
                </li>
                <li class="done">
                  <span class="t-time">
                    <b>09:16</b>
                    <span>12 mar</span>
                  </span>
                  <div class="t-body">
                    <span class="t-title">Pago confirmado</span>
                    <span class="t-desc">Visa ···4192</span>
                  </div>
                </li>
                <li class="done">
                  <span class="t-time">
                    <b>08:40</b>
                    <span>13 mar</span>
                  </span>
                  <div class="t-body">
                    <span class="t-title">En reparto</span>
                    <span class="t-desc">SEUR · guía 884-201-77</span>
                  </div>
                </li>
                <li>
                  <span class="t-time">
                    <b>—</b>
                    <span>Previsto</span>
                  </span>
                  <div class="t-body">
                    <span class="t-title">Entrega</span>
                    <span class="t-desc">14 de marzo, mañana</span>
                  </div>
                </li>
              </ol>
            </div>
            <div class="modal-foot">
              <button class="btn" popovertarget="demoDrawerR" popovertargetaction="hide">
                Cerrar
              </button>
              <button class="btn btn-primary" type="button">Ver factura</button>
            </div>
          </div>
        </div>
      </div>
    </article>
    <!--
        Tooltip: aqui SI se cambia el marcado del original, y a propósito.

        El globo del catálogo es `.tip`, un ::after del propio botón. El panel
        no lo usa: cualquier antepasado con desplazamiento lo cortaba, asi que
        lo dibuja `components/TooltipLayer.svelte` en una capa suya al final del
        documento. Las dos formas leen el mismo `data-tip`, asi que un botón con
        las dos cosas sacaria dos globos a la vez. Se queda el del panel, que es
        el que se ve en el resto de la pantalla.
      -->
    <article class="card gallery-item">
      {@render head(
        "Ayuda contextual",
        "Texto corto al pasar el cursor. Ej.: los iconos de la barra",
      )}
      <div class="card-body">
        <div class="gallery-row">
          <button class="btn" data-tip="Se aplica al periodo actual">Pasa el cursor</button>
          <button class="btn-icon" data-tip="Descargar CSV" aria-label="Descargar CSV">
            <i class="icon icon-download-04"></i>
          </button>
          <button class="btn" data-tip="No cabe arriba" data-tip-side="bottom">Debajo</button>
          <button class="btn btn-danger" data-tip="Algo no cuadra" data-tip-tone="error">
            Aviso
          </button>
        </div>
      </div>
    </article>
  </div>
</div>
