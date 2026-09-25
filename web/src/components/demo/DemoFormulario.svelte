<!--
  Formulario: todo lo que se rellena y se pulsa antes de guardar --campos,
  selectores, casillas, interruptores y los botones que cierran la faena--, y
  las marcas con las que un campo o una fila contestan: etiquetas, indicadores
  y la barra de lo que va hecho.

  Uno de los grupos de la galería; la cabecera de cada ficha y el modal con su
  código los pone `DemoGallery.svelte`, que es quien los compone. Lo que se ve
  aquí no lo pinta este archivo sino `styles/components.css`, igual que en el
  resto del panel.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  let amount = $state(1200);
  let rating = $state(4);
  let visibility = $state("publica");
  let color = $state("Azul");
  let tagVisible = $state(true);

  let { head }: { head: Snippet<[string, string, Snippet?]> } = $props();
</script>

<div id="demo-formulario" class="gallery-group">
  <div class="gallery-group-head">
    <h2>Formulario</h2>
    <p>Entradas, controles de selección, botones y marcas de estado</p>
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
              <i class="icon icon-alert-circle" aria-hidden="true"></i>
              Introduce un dominio completo, por ejemplo, empresa.com.
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
      {@render head("Campo con acción", "Entrada y botón pegados. Ej.: el enlace al publicar")}
      <div class="card-body">
        <div class="gallery-demo">
          <div class="field">
            <label for="demoJoinSearch">Buscar pedido</label>
            <div class="join">
              <input type="search" id="demoJoinSearch" placeholder="#AR-4821" />
              <button class="btn btn-primary">
                <i class="icon icon-search-01" aria-hidden="true"></i>
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
                <i class="icon icon-copy-01" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
    <!-- Textarea -->
    <article class="card gallery-item">
      {@render head(
        "Texto multilínea",
        "Texto largo en varias líneas. Ej.: pegar un CSV al importar",
      )}
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
        "Lista de opciones",
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
          <label class="label-demo-amount field-label" for="demoAmount">
            Importe máximo
            <output class="value-demo-amount range-val" for="demoAmount">
              ${amount.toLocaleString("es-CO")}
            </output>
          </label>
          <input
            class="input-demo-amount"
            id="demoAmount"
            type="range"
            min="0"
            max="2000"
            step="50"
            bind:value={amount}
          />
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
            <i class="choice-box ico-nudge icon icon-tick-02" aria-hidden="true"></i>
            <span>Pedidos pagados</span>
          </label>
          <label class="choice">
            <input type="checkbox" />
            <i class="choice-box ico-nudge icon icon-tick-02" aria-hidden="true"></i>
            <span>Pedidos pendientes</span>
          </label>
          <label class="choice">
            <input type="checkbox" disabled />
            <i class="choice-box ico-nudge icon icon-tick-02" aria-hidden="true"></i>
            <span>Archivados</span>
          </label>
        </div>
      </div>
    </article>
    <!-- Radio -->
    <article class="card gallery-item">
      {@render head("Selección única", "Una sola opción del grupo. En páginas generadas")}
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
      {@render head("Interruptores", "Encender o apagar al momento. Ej.: la IA en los ajustes")}
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
            <input
              type="radio"
              name="demoRate"
              id="demoRate5"
              value={5}
              bind:group={rating}
              aria-label="5 estrellas"
            />
            <label for="demoRate5" data-tip="5 estrellas">
              <i class="icon icon-star"></i>
            </label>
            <input
              type="radio"
              name="demoRate"
              id="demoRate4"
              value={4}
              bind:group={rating}
              aria-label="4 estrellas"
            />
            <label for="demoRate4" data-tip="4 estrellas">
              <i class="icon icon-star"></i>
            </label>
            <input
              type="radio"
              name="demoRate"
              id="demoRate3"
              value={3}
              bind:group={rating}
              aria-label="3 estrellas"
            />
            <label for="demoRate3" data-tip="3 estrellas">
              <i class="icon icon-star"></i>
            </label>
            <input
              type="radio"
              name="demoRate"
              id="demoRate2"
              value={2}
              bind:group={rating}
              aria-label="2 estrellas"
            />
            <label for="demoRate2" data-tip="2 estrellas">
              <i class="icon icon-star"></i>
            </label>
            <input
              type="radio"
              name="demoRate"
              id="demoRate1"
              value={1}
              bind:group={rating}
              aria-label="1 estrella"
            />
            <label for="demoRate1" data-tip="1 estrella">
              <i class="icon icon-star"></i>
            </label>
          </div>
          <p class="demo-feedback" aria-live="polite">Tu valoración: {rating} de 5 estrellas</p>
        </div>
      </div>
    </article>
    <!-- Cuadros de color -->
    <article class="card gallery-item">
      {@render head(
        "Muestras de color",
        "Rejilla de colores para elegir. Ej.: la paleta de una aplicación",
      )}
      <div class="card-body">
        <div class="gallery-demo">
          <p class="demo-note">
            No pinta el color: lo pone quien la usa. Lo suyo es el cerco y el halo de elegido,
            porque el fondo ya es el color.
          </p>
          <div>
            <p class="eyebrow">Color principal: {color}</p>
            <div class="gallery-row demo-tiles">
              <button
                type="button"
                class="btn-demo-color opt-tile swatch-color"
                class:selected={color === "Azul"}
                aria-pressed={color === "Azul"}
                onclick={() => (color = "Azul")}
                aria-label="Usar Azul"
                data-tip="Azul"
                style="background: #2b7fff"
              ></button>
              <button
                type="button"
                class="btn-demo-color opt-tile swatch-color"
                class:selected={color === "Esmeralda"}
                aria-pressed={color === "Esmeralda"}
                onclick={() => (color = "Esmeralda")}
                aria-label="Usar Esmeralda"
                data-tip="Esmeralda"
                style="background: #00bc7d"
              ></button>
              <button
                type="button"
                class="btn-demo-color opt-tile swatch-color"
                class:selected={color === "Ámbar"}
                aria-pressed={color === "Ámbar"}
                onclick={() => (color = "Ámbar")}
                aria-label="Usar Ámbar"
                data-tip="Ámbar"
                style="background: #fe9a00"
              ></button>
              <button
                type="button"
                class="btn-demo-color opt-tile swatch-color"
                class:selected={color === "Violeta"}
                aria-pressed={color === "Violeta"}
                onclick={() => (color = "Violeta")}
                aria-label="Usar Violeta"
                data-tip="Violeta"
                style="background: #8e51ff"
              ></button>
              <button
                type="button"
                class="btn-demo-color opt-tile swatch-color"
                class:selected={color === "Pizarra"}
                aria-pressed={color === "Pizarra"}
                onclick={() => (color = "Pizarra")}
                aria-label="Usar Pizarra"
                data-tip="Pizarra"
                style="background: #62748e"
              ></button>
            </div>
          </div>
        </div>
      </div>
    </article>
    <!-- Fieldset -->
    <article class="card gallery-item">
      {@render head("Grupo de opciones", "Controles bajo una leyenda. En páginas generadas")}
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
    <!-- Button -->
    <article class="card gallery-item wide">
      {@render head("Botones", "Variantes, tamaños y estados")}
      <div class="card-body">
        <div class="gallery-demo">
          <p class="demo-variant-label">Principal, secundario y deshabilitado</p>
          <div class="gallery-row">
            <button class="btn btn-primary">
              <i class="icon icon-checkmark-circle-02"></i>
              Guardar cambios
            </button>
            <button class="btn">
              Cancelar
              <i class="icon icon-arrow-right-01"></i>
            </button>
            <button class="btn" disabled>Deshabilitado</button>
          </div>
          <p class="demo-variant-label">Sin fondo</p>
          <div class="gallery-row">
            <button class="btn btn-ghost">Sin fondo</button>
            <button class="btn btn-ghost" disabled>Deshabilitado</button>
          </div>
          <p class="demo-variant-label">Acciones destructivas</p>
          <div class="gallery-row">
            <button class="btn btn-danger">
              <i class="icon icon-delete-02"></i>
              Eliminar
            </button>
            <button class="btn btn-danger" disabled>Eliminar</button>
            <button class="btn btn-ghost btn-danger">Quitar del equipo</button>
          </div>
          <!--
              `btn-danger-quiet` no grita en reposo: se lee como cualquier otro
              botón de la fila y solo avisa cuando el cursor ya está encima, que
              es el instante en que importa. Para lo que sale de una barra o un pie.
            -->
          <p class="demo-variant-label">Acciones discretas</p>
          <div class="gallery-row">
            <button class="btn btn-danger-quiet">Cerrar sesión</button>
            <button class="btn-icon sm btn-danger-quiet" aria-label="Cerrar sesión">
              <i class="icon icon-logout-03"></i>
            </button>
          </div>
          <p class="demo-variant-label">Solo icono</p>
          <div class="gallery-row">
            <button class="btn-icon btn-rounded" aria-label="Más opciones">
              <i class="icon icon-settings-04"></i>
            </button>
            <button class="btn-icon btn-ghost btn-rounded" aria-label="Más opciones">
              <i class="icon icon-settings-04"></i>
            </button>
            <button class="btn-icon" aria-label="Más opciones">
              <i class="icon icon-settings-04"></i>
            </button>
            <button class="btn-icon btn-ghost" aria-label="Más opciones">
              <i class="icon icon-settings-04"></i>
            </button>
          </div>
          <p class="demo-variant-label">Durante una operación</p>
          <div class="gallery-row">
            <button class="btn btn-primary is-loading" disabled aria-busy="true">
              <i class="icon icon-loading-03" aria-hidden="true"></i>
              Guardando…
            </button>
            <button class="btn is-loading" disabled aria-busy="true">
              <i class="icon icon-loading-03" aria-hidden="true"></i>
              Procesando…
            </button>
            <button class="btn-icon is-loading" disabled aria-busy="true" aria-label="Cargando">
              <i class="icon icon-loading-03"></i>
            </button>
          </div>
        </div>
      </div>
    </article>
    <!-- Tag -->
    <article class="card gallery-item">
      {@render head("Etiquetas", "Categoría o estado. Ej.: una versión de solo lectura")}
      <div class="card-body">
        <div class="gallery-demo">
          <div class="gallery-row">
            <span class="tag tint-1">Azul</span>
            <span class="tag tint-2">Violeta</span>
            <span class="tag tint-3">Ciruela</span>
            <span class="tag tint-4">Rojo</span>
            <span class="tag tint-5">Teja</span>
          </div>
          <div class="gallery-row">
            <span class="tag tint-6">Ámbar</span>
            <span class="tag tint-7">Oliva</span>
            <span class="tag tint-8">Verde</span>
            <span class="tag tint-9">Turquesa</span>
            <span class="tag tint-10">Pizarra</span>
          </div>
          <div class="gallery-row">
            <span class="tag tag-success">
              <i class="icon icon-checkmark-circle-02"></i>
              Correcto
            </span>
            <span class="tag tag-warning">
              <i class="icon icon-alert-02"></i>
              Aviso
            </span>
            <span class="tag tag-error">
              <i class="icon icon-cancel-circle"></i>
              Error
            </span>
          </div>
          <div class="gallery-row">
            {#if tagVisible}
              <span class="tag tint-1">
                Filtro
                <button
                  type="button"
                  class="tag-remove"
                  onclick={() => (tagVisible = false)}
                  aria-label="Quitar Filtro"
                  data-tip="Quitar"
                >
                  <i class="icon icon-cancel-01"></i>
                </button>
              </span>
            {:else}
              <button class="btn-restore-demo-tag btn sm" onclick={() => (tagVisible = true)}>
                Restablecer etiqueta
              </button>
            {/if}
            <span class="tag">Sin asignar</span>
          </div>
        </div>
      </div>
    </article>
    <!-- Badge -->
    <article class="card gallery-item">
      {@render head("Indicadores", "Aviso sobre un elemento. Ej.: un archivo en el chat")}
      <div class="card-body">
        <div class="gallery-demo">
          <div class="gallery-row">
            <button class="btn badge-success" data-tip="Todo correcto">Sincronizado</button>
            <button class="btn badge-warning" data-tip="Requiere atención">Atención</button>
            <button class="btn badge-error" data-tip="Con incidencias">Error</button>
          </div>
        </div>
      </div>
    </article>
    <!-- Progress -->
    <article class="card gallery-item">
      {@render head("Progreso", "Cuánto falta. Ej.: proceso en curso")}
      <div class="card-body">
        <div class="gallery-demo">
          <div class="progress-label">
            <span>Eventos del plan</span>
            <span class="number">74 %</span>
          </div>
          <progress class="progress" max="100" value="74" aria-label="Eventos del plan"></progress>
          <div class="progress-label">
            <span>Almacenamiento</span>
            <span class="number">31 %</span>
          </div>
          <progress class="progress" max="100" value="31" aria-label="Almacenamiento"></progress>
        </div>
      </div>
    </article>
    <!-- Opciones -->
    <article class="card gallery-item wide col-span-2">
      {@render head("Tarjetas de selección", "Tarjetas de selección. Ej.: el tipo de una columna")}
      <div class="card-body">
        <div class="gallery-demo">
          <!-- prettier-ignore -->
          <p class="demo-note">
              Cada tarjeta lleva su nombre y una línea que lo explica, y se tiñe al elegirla.
              <code>opt-row</code> es la misma caja sin nada que elegir, con su mando a la derecha.
            </p>

          <div class="demo-opt-grid">
            <button
              type="button"
              class="btn-demo-public opt"
              class:active={visibility === "publica"}
              aria-pressed={visibility === "publica"}
              onclick={() => (visibility = "publica")}
            >
              <i class="icon icon-globe-02" aria-hidden="true"></i>
              <span class="opt-body">
                <span class="opt-label">Pública</span>
                <span class="opt-hint">Cualquiera con el enlace entra</span>
              </span>
            </button>
            <button
              type="button"
              class="btn-demo-private opt"
              class:active={visibility === "privada"}
              aria-pressed={visibility === "privada"}
              onclick={() => (visibility = "privada")}
            >
              <i class="icon icon-user-lock-01" aria-hidden="true"></i>
              <span class="opt-body">
                <span class="opt-label">Requiere iniciar sesión</span>
                <span class="opt-hint">Solo las personas invitadas</span>
              </span>
            </button>
            <button type="button" class="opt" disabled>
              <i class="icon icon-building-03" aria-hidden="true"></i>
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
  </div>
</div>
