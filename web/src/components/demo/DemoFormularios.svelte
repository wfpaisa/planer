<!--
  Formularios: campos de texto, selectores, casillas, interruptores y todo lo
  que se rellena antes de guardar.

  Una de las cinco secciones de la galería; la cabecera de cada ficha y el modal
  con su código los pone `DemoGallery.svelte`, que es quien las compone. Lo que
  se ve aquí no lo pinta este archivo sino `styles/components.css`, igual que en
  el resto del panel.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { head }: { head: Snippet<[string, string, Snippet?]> } = $props();
</script>

<div id="demo-formulario" class="gallery-group">
  <div class="gallery-group-head">
    <h3>Formularios</h3>
    <p>Entradas y controles de selección</p>
  </div>
  <div class="gallery-grid">
    <!-- Input field -->
    <article class="card gallery-item wide">
      {@render head(
        "Campos de texto",
        "Con etiqueta, ayuda y error. Ej.: el nombre de una aplicación",
      )}
      <div class="card-body">
        <div class="gallery-demo">
          <div class="field">
            <label for="demoInput">Correo del cliente</label>
            <input type="email" id="demoInput" placeholder="nombre@empresa.com" />
            <span class="field-hint">Le enviaremos la factura a esta dirección.</span>
          </div>

          <div class="field error">
            <label for="demoInputErr">Correo del cliente</label>
            <input
              type="email"
              id="demoInputErr"
              value="elena@plane"
              aria-invalid="true"
              aria-describedby="demoInputErrMsg"
            />
            <span class="field-hint" id="demoInputErrMsg">
              <i class="hgi-stroke hgi-alert-circle" aria-hidden="true"></i>
              Falta el dominio después de la arroba.
            </span>
          </div>

          <div class="field">
            <label for="demoInputDis">Identificador de cuenta</label>
            <input type="text" id="demoInputDis" value="ACC-90412" disabled />
            <span class="field-hint">Se asigna al crear la cuenta.</span>
          </div>

          <div class="field">
            <label for="demoInputDate">Fecha de facturación</label>
            <input type="date" id="demoInputDate" value="2026-03-12" />
            <span class="field-hint">Se cobrará ese día a las 09:00.</span>
          </div>
        </div>
      </div>
    </article>
    <!-- Field stack / field row -->
    <article class="card gallery-item wide">
      {@render head(
        "Grupo de campos",
        "Varios campos juntos, apilados o en fila. Ej.: los datos de un paciente",
      )}
      <div class="card-body">
        <div class="field-stack">
          <div class="field">
            <label for="demoStackNombre">Nombre</label>
            <input type="text" id="demoStackNombre" value="Ana Restrepo" />
          </div>
          <div class="field-row">
            <div class="field">
              <label for="demoStackCedula">Cédula</label>
              <input type="text" id="demoStackCedula" value="71543298" />
            </div>
            <div class="field">
              <label for="demoStackTel">Teléfono</label>
              <input type="tel" id="demoStackTel" value="300 555 1234" />
            </div>
          </div>
          <div class="field">
            <label for="demoStackNota">Nota</label>
            <textarea id="demoStackNota" rows="2">Viene remitida por su EPS.</textarea>
            <span class="field-hint">La ve quien atiende la cita.</span>
          </div>
        </div>
      </div>
    </article>
    <!-- Join -->
    <article class="card gallery-item wide">
      {@render head("Campo con botón", "Entrada y botón pegados. Ej.: el enlace al publicar")}
      <div class="card-body">
        <div class="gallery-demo">
          <div class="field">
            <label for="demoJoinSearch">Buscar pedido</label>
            <div class="join">
              <input type="search" id="demoJoinSearch" placeholder="#AR-4821" />
              <button class="btn btn-primary">
                <i class="hgi-stroke hgi-search-01" aria-hidden="true"></i>
                Buscar
              </button>
            </div>
          </div>

          <div class="field">
            <label for="demoJoinMail">Invitar al espacio</label>
            <div class="join">
              <select id="demoJoinRole" aria-label="Rol">
                <option>Editor</option>
                <option>Lector</option>
                <option>Admin</option>
              </select>
              <input type="email" id="demoJoinMail" placeholder="nombre@empresa.com" />
              <button class="btn">Enviar</button>
            </div>
          </div>

          <div class="field">
            <label for="demoJoinUrl">Enlace público</label>
            <div class="join">
              <input type="text" id="demoJoinUrl" value="plane.io/p/AR-4821" readonly />
              <button class="btn" aria-label="Copiar enlace">
                <i class="hgi-stroke hgi-copy-01" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
    <!-- Textarea -->
    <article class="card gallery-item">
      {@render head("Área de texto", "Texto largo en varias líneas. Ej.: pegar un CSV al importar")}
      <div class="card-body">
        <div class="field">
          <label for="demoTextarea">Nota interna</label>
          <textarea
            id="demoTextarea"
            rows="3"
            placeholder="Contexto para el equipo de soporte…"></textarea>
        </div>
      </div>
    </article>
    <!-- Select -->
    <article class="card gallery-item">
      {@render head(
        "Desplegable",
        "Una opción de una lista cerrada. Ej.: ver la página como otra persona",
      )}
      <div class="card-body">
        <div class="gallery-demo">
          <div class="field">
            <label for="demoSelect">Estado del pedido</label>
            <select id="demoSelect">
              <option>Todos</option>
              <option selected>Pagados</option>
              <option>Pendientes</option>
              <option disabled>Fallidos (sin permiso)</option>
            </select>
          </div>

          <!--
              Con grupos: hay que abrirlo para ver el rotulo y la marca de lo
              elegido, que es lo que la lista del sistema no dejaba vestir.
            -->
          <div class="field">
            <label for="demoSelectGroups">Asignar a</label>
            <select id="demoSelectGroups">
              <optgroup label="Soporte">
                <option selected>Marta Ruiz</option>
                <option>Jon Aguirre</option>
              </optgroup>
              <optgroup label="Facturación">
                <option>Clara Peña</option>
                <option>Luis Mendoza</option>
              </optgroup>
            </select>
          </div>
        </div>
      </div>
    </article>
    <!-- Range -->
    <article class="card gallery-item">
      {@render head("Deslizador", "Un número dentro de un rango. Ej.: el tamaño de letra")}
      <div class="card-body">
        <div class="field">
          <span class="field-label">
            Importe máximo
            <b class="range-val">$1.200</b>
          </span>
          <input type="range" min="0" max="2000" step="50" value="1200" />
        </div>
      </div>
    </article>
    <!-- Checkbox -->
    <article class="card gallery-item">
      {@render head("Casillas", "Varias opciones a la vez. Ej.: las opciones al importar")}
      <div class="card-body">
        <div class="gallery-demo">
          <label class="choice">
            <input type="checkbox" checked />
            <i class="choice-box ico-nudge hgi-stroke hgi-tick-02" aria-hidden="true"></i>
            <span>Pedidos pagados</span>
          </label>
          <label class="choice">
            <input type="checkbox" />
            <i class="choice-box ico-nudge hgi-stroke hgi-tick-02" aria-hidden="true"></i>
            <span>Pedidos pendientes</span>
          </label>
          <label class="choice">
            <input type="checkbox" disabled />
            <i class="choice-box ico-nudge hgi-stroke hgi-tick-02" aria-hidden="true"></i>
            <span>Archivados</span>
          </label>
        </div>
      </div>
    </article>
    <!-- Radio -->
    <article class="card gallery-item">
      {@render head("Opción única", "Una sola opción del grupo. En páginas generadas")}
      <div class="card-body">
        <div class="gallery-demo">
          <label class="choice">
            <input type="radio" name="demoRadio" checked />
            <i class="choice-box round" aria-hidden="true"></i>
            <span>Envío estándar</span>
          </label>
          <label class="choice">
            <input type="radio" name="demoRadio" />
            <i class="choice-box round" aria-hidden="true"></i>
            <span>Envío exprés</span>
          </label>
          <label class="choice">
            <input type="radio" name="demoRadio" disabled />
            <i class="choice-box round" aria-hidden="true"></i>
            <span>Recogida en tienda</span>
          </label>
        </div>
      </div>
    </article>
    <!-- Toggle -->
    <article class="card gallery-item">
      {@render head("Interruptor", "Encender o apagar al momento. Ej.: la IA en los ajustes")}
      <div class="card-body">
        <div class="gallery-demo">
          <label class="choice switch">
            <input type="checkbox" checked />
            <span>Informe semanal por correo</span>
          </label>
          <label class="choice switch">
            <input type="checkbox" disabled />
            <span>Panel público (no disponible)</span>
          </label>
        </div>
      </div>
    </article>
    <!-- Rating -->
    <article class="card gallery-item">
      {@render head("Valoración", "Estrellas. En páginas generadas")}
      <div class="card-body">
        <div class="gallery-demo">
          <div class="rating" role="radiogroup" aria-label="Valoración">
            <input type="radio" name="demoRate" id="demoRate5" />
            <label for="demoRate5" data-tip="5 estrellas">
              <i class="hgi-stroke hgi-star"></i>
            </label>
            <input type="radio" name="demoRate" id="demoRate4" checked />
            <label for="demoRate4" data-tip="4 estrellas">
              <i class="hgi-stroke hgi-star"></i>
            </label>
            <input type="radio" name="demoRate" id="demoRate3" />
            <label for="demoRate3" data-tip="3 estrellas">
              <i class="hgi-stroke hgi-star"></i>
            </label>
            <input type="radio" name="demoRate" id="demoRate2" />
            <label for="demoRate2" data-tip="2 estrellas">
              <i class="hgi-stroke hgi-star"></i>
            </label>
            <input type="radio" name="demoRate" id="demoRate1" />
            <label for="demoRate1" data-tip="1 estrellas">
              <i class="hgi-stroke hgi-star"></i>
            </label>
          </div>
          <span style="font-size: 0.71875rem; color: var(--text-muted)">4 de 5 · 128 reseñas</span>
        </div>
      </div>
    </article>
    <!-- Opciones -->
    <article class="card gallery-item wide col-span-2">
      {@render head("Opciones", "Tarjetas de selección. Ej.: el tipo de una columna")}
      <div class="card-body">
        <div class="gallery-demo">
          <!-- prettier-ignore -->
          <p class="demo-note">
              Cada tarjeta lleva su nombre y una línea que lo explica, y se tiñe al elegirla.
              <code>opt-row</code> es la misma caja sin nada que elegir, con su mando a la derecha.
            </p>

          <div class="demo-opt-grid">
            <button type="button" class="opt active" aria-pressed="true">
              <i class="hgi-stroke hgi-globe-02" aria-hidden="true"></i>
              <span class="opt-body">
                <span class="opt-label">Pública</span>
                <span class="opt-hint">Cualquiera con el enlace entra</span>
              </span>
            </button>
            <button type="button" class="opt" aria-pressed="false">
              <i class="hgi-stroke hgi-user-lock-01" aria-hidden="true"></i>
              <span class="opt-body">
                <span class="opt-label">Requiere iniciar sesión</span>
                <span class="opt-hint">Solo las personas invitadas</span>
              </span>
            </button>
            <button type="button" class="opt" disabled>
              <i class="hgi-stroke hgi-building-03" aria-hidden="true"></i>
              <span class="opt-body">
                <span class="opt-label">Solo mi organización</span>
                <span class="opt-hint">Todavía no disponible</span>
              </span>
            </button>
          </div>

          <div class="opt-row">
            <div class="opt-body">
              <span class="opt-label">Generación con IA activa</span>
              <span class="opt-hint">
                Mientras esté apagado, el panel de IA no aparece en el constructor.
              </span>
            </div>
            <label class="switch">
              <input type="checkbox" checked aria-label="Generación con IA activa" />
            </label>
          </div>
        </div>
      </div>
    </article>
    <!-- Cuadros de color -->
    <article class="card gallery-item">
      {@render head(
        "Cuadros de color",
        "Rejilla de colores para elegir. Ej.: la paleta de una aplicación",
      )}
      <div class="card-body">
        <div class="gallery-demo">
          <p class="demo-note">
            No pinta el color: lo pone quien la usa. Lo suyo es el cerco y el halo de elegido,
            porque el fondo ya es el color.
          </p>
          <div>
            <p class="eyebrow">Color principal</p>
            <div class="gallery-row demo-tiles">
              <button
                type="button"
                class="opt-tile swatch-color selected"
                aria-pressed="true"
                aria-label="Usar Azul"
                data-tip="Azul"
                style="background: #2b7fff"
              ></button>
              <button
                type="button"
                class="opt-tile swatch-color"
                aria-pressed="false"
                aria-label="Usar Esmeralda"
                data-tip="Esmeralda"
                style="background: #00bc7d"
              ></button>
              <button
                type="button"
                class="opt-tile swatch-color"
                aria-pressed="false"
                aria-label="Usar Ámbar"
                data-tip="Ámbar"
                style="background: #fe9a00"
              ></button>
              <button
                type="button"
                class="opt-tile swatch-color"
                aria-pressed="false"
                aria-label="Usar Violeta"
                data-tip="Violeta"
                style="background: #8e51ff"
              ></button>
              <button
                type="button"
                class="opt-tile swatch-color"
                aria-pressed="false"
                aria-label="Usar Pizarra"
                data-tip="Pizarra"
                style="background: #62748e"
              ></button>
            </div>
          </div>
        </div>
      </div>
    </article>
    <!-- Zona de arrastre -->
    <article class="card gallery-item wide col-span-2">
      {@render head("Zona de arrastre", "Donde se sueltan archivos. Ej.: importar un CSV")}
      <div class="card-body">
        <div class="gallery-demo">
          <!-- prettier-ignore -->
          <p class="demo-note">
              Acepta el archivo arrastrado encima, o abre el explorador al pulsarla.
              <code>loaded</code> cuando se ha leído, <code>rejected</code> cuando no sirve; el
              motivo lo da el aviso de al lado.
            </p>
          <div class="demo-dropzones">
            <div class="dropzone">
              <i class="hgi-stroke hgi-upload-01" aria-hidden="true"></i>
              <span class="dropzone-hint">
                Arrastra un archivo CSV, Excel o JSON, o haz clic para elegirlo
              </span>
            </div>
            <div class="dropzone loaded">
              <i class="hgi-stroke hgi-checkmark-circle-02" aria-hidden="true"></i>
              <span class="dropzone-lead">pedidos-marzo.csv</span>
              <span class="dropzone-hint">Suelta otro archivo o haz clic para cambiarlo</span>
            </div>
            <div class="dropzone rejected">
              <i class="hgi-stroke hgi-alert-circle" aria-hidden="true"></i>
              <span class="dropzone-lead">informe.pdf</span>
              <span class="dropzone-hint">Suelta otro archivo o haz clic para cambiarlo</span>
            </div>
          </div>
        </div>
      </div>
    </article>
    <!-- Fieldset -->
    <article class="card gallery-item">
      {@render head("Grupo de campos", "Controles bajo una leyenda. En páginas generadas")}
      <div class="card-body">
        <fieldset class="fieldset">
          <legend>Visibilidad del panel</legend>
          <label class="choice">
            <input type="radio" name="demoVis" checked />
            <i class="choice-box round" aria-hidden="true"></i>
            <span>Solo yo</span>
          </label>
          <label class="choice">
            <input type="radio" name="demoVis" />
            <i class="choice-box round" aria-hidden="true"></i>
            <span>Mi equipo</span>
          </label>
          <label class="choice">
            <input type="radio" name="demoVis" />
            <i class="choice-box round" aria-hidden="true"></i>
            <span>Cualquiera con el enlace</span>
          </label>
        </fieldset>
      </div>
    </article>
  </div>
</div>
