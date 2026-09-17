<!--
  Avisos y estado: lo que el panel dice de vuelta --notas, toasts, modales,
  cajones, cargando, vacío y el resto de estados--.

  Una de las cinco secciones de la galería; la cabecera de cada ficha y el modal
  con su código los pone `DemoGallery.svelte`, que es quien las compone. Lo que
  se ve aquí no lo pinta este archivo sino `styles/components.css`, igual que en
  el resto del panel.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { head }: { head: Snippet<[string, string, Snippet?]> } = $props();
</script>

<div id="demo-retro" class="gallery-group">
  <div class="gallery-group-head">
    <h3>Avisos y estado</h3>
    <p>Estado del sistema y respuestas a una acción</p>
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
      {@render head("Notificación", "Aviso que se va solo. Ej.: al guardar una fila")}
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
    <!-- Modal -->
    <article class="card gallery-item">
      {@render head("Ventana modal", "Pide una decisión. Ej.: crear una columna")}
      <div class="card-body">
        <div class="gallery-demo">
          <div class="gallery-row">
            <button class="btn btn-primary" popovertarget="demoModal">Abrir modal</button>
            <button class="btn" popovertarget="demoModalLg">Con medida fija</button>
          </div>
          <div class="modal" id="demoModal" popover>
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
                <i class="hgi-stroke hgi-cancel-01"></i>
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
              <button class="btn btn-primary" popovertarget="demoModal" popovertargetaction="hide">
                Cancelar pedido
              </button>
            </div>
          </div>

          <div
            class="modal"
            id="demoModalLg"
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
                <i class="hgi-stroke hgi-cancel-01"></i>
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
              <i class="hgi-stroke hgi-sidebar-left"></i>
              Izquierda
            </button>
            <button class="btn" popovertarget="demoDrawerR">
              <i class="hgi-stroke hgi-sidebar-right"></i>
              Derecha
            </button>
          </div>

          <div class="drawer left" id="demoDrawerL" popover>
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
                <i class="hgi-stroke hgi-cancel-01"></i>
              </button>
            </div>
            <div class="modal-body">
              <div class="field">
                <label for="drwSearch">Buscar</label>
                <div class="join">
                  <input type="search" id="drwSearch" placeholder="Cliente o referencia" />
                  <button class="btn btn-primary" type="button" aria-label="Buscar">
                    <i class="hgi-stroke hgi-search-01"></i>
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
                <i class="choice-box ico-nudge hgi-stroke hgi-tick-02" aria-hidden="true"></i>
                <span>Solo pedidos con incidencia</span>
              </label>
              <label class="choice">
                <input type="checkbox" />
                <i class="choice-box ico-nudge hgi-stroke hgi-tick-02" aria-hidden="true"></i>
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

          <div class="drawer right" id="demoDrawerR" popover style="--drawer-w: 23rem">
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
                <i class="hgi-stroke hgi-cancel-01"></i>
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
        Tooltip: aqui SI se cambia el marcado del original, y a proposito.

        El globo del catalogo es `.tip`, un ::after del propio boton. El panel
        no lo usa: cualquier antepasado con desplazamiento lo cortaba, asi que
        lo dibuja `components/TooltipLayer.svelte` en una capa suya al final del
        documento. Las dos formas leen el mismo `data-tip`, asi que un boton con
        las dos cosas sacaria dos globos a la vez. Se queda el del panel, que es
        el que se ve en el resto de la pantalla.
      -->
    <article class="card gallery-item">
      {@render head(
        "Ayuda al apuntar",
        "Texto corto al pasar el cursor. Ej.: los iconos de la barra",
      )}
      <div class="card-body">
        <div class="gallery-row">
          <button class="btn" data-tip="Se aplica al periodo actual">Pasa el cursor</button>
          <button class="btn-icon" data-tip="Descargar CSV" aria-label="Descargar CSV">
            <i class="hgi-stroke hgi-download-04"></i>
          </button>
          <button class="btn" data-tip="No cabe arriba" data-tip-side="bottom">Debajo</button>
          <button class="btn btn-danger" data-tip="Algo no cuadra" data-tip-tone="error">
            Aviso
          </button>
        </div>
      </div>
    </article>
    <!-- Loading -->
    <article class="card gallery-item">
      {@render head("Carga", "Actividad en curso. Ej.: mientras llega una tabla")}
      <div class="card-body">
        <div class="gallery-demo">
          <div class="gallery-row">
            <span class="spinner" role="status" aria-label="Cargando"></span>
            <span class="dots" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
            </span>
            <span style="font-size: 0.78125rem; color: var(--text-muted)">Cargando…</span>
          </div>
          <div class="skeleton" style="width: 100%"></div>
          <div class="skeleton" style="width: 72%"></div>
          <div class="skeleton" style="width: 45%"></div>
        </div>
      </div>
    </article>
    <!-- Progress -->
    <article class="card gallery-item">
      {@render head("Progreso", "Cuánto falta. Ej.: la IA trabajando")}
      <div class="card-body">
        <div class="gallery-demo">
          <div class="progress-label">
            <span>Eventos del plan</span>
            <span class="number">74 %</span>
          </div>
          <progress class="progress" max="100" value="74"></progress>
          <div class="progress-label">
            <span>Almacenamiento</span>
            <span class="number">31 %</span>
          </div>
          <progress class="progress" max="100" value="31"></progress>
        </div>
      </div>
    </article>
  </div>
</div>
