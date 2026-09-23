<!--
  Navegación: lo que lleva de un sitio a otro --pestañas, menú, migas, paginado
  y el resto de mandos que no escriben nada--.

  Una de las cinco secciones de la galería; la cabecera de cada ficha y el modal
  con su código los pone `DemoGallery.svelte`, que es quien las compone. Lo que
  se ve aquí no lo pinta este archivo sino `styles/components.css`, igual que en
  el resto del panel.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  import Icon from "../Icon.svelte";

  let page = $state(1);
  let destination = $state("");
  let action = $state("");
  let columnType = $state("Texto");

  let { head }: { head: Snippet<[string, string, Snippet?]> } = $props();
</script>

<div id="demo-navegacion" class="gallery-group">
  <div class="gallery-group-head">
    <h2>Navegación</h2>
    <p>Cómo se mueve la gente por el panel</p>
  </div>
  <div class="gallery-grid">
    <!-- Breadcrumbs -->
    <article class="card gallery-item">
      {@render head("Ruta de navegación", "La ruta hasta donde estás. En páginas generadas")}
      <div class="card-body">
        <div class="gallery-demo">
          <nav class="crumbs" aria-label="Ruta">
            <ol>
              <li>
                <a
                  href="#demo-navegacion"
                  onclick={(event) => {
                    event.preventDefault();
                    destination =
                      event.currentTarget.getAttribute("aria-label") ??
                      event.currentTarget.textContent?.trim() ??
                      "";
                  }}
                >
                  <i class="hgi-stroke hgi-dashboard-square-01"></i>
                  Panel
                </a>
              </li>
              <li>
                <a
                  href="#demo-navegacion"
                  onclick={(event) => {
                    event.preventDefault();
                    destination =
                      event.currentTarget.getAttribute("aria-label") ??
                      event.currentTarget.textContent?.trim() ??
                      "";
                  }}
                >
                  <i class="hgi-stroke hgi-store-01"></i>
                  Comercio
                </a>
              </li>
              <li>
                <a
                  href="#demo-navegacion"
                  onclick={(event) => {
                    event.preventDefault();
                    destination =
                      event.currentTarget.getAttribute("aria-label") ??
                      event.currentTarget.textContent?.trim() ??
                      "";
                  }}
                >
                  <i class="hgi-stroke hgi-shopping-bag-01"></i>
                  Pedidos
                </a>
              </li>
              <li aria-current="page">
                <i class="hgi-stroke hgi-invoice-01"></i>
                #AR-4821
              </li>
            </ol>
          </nav>
          <!--
              Solo iconos: sin texto, el nombre de cada escalon lo lleva
              `aria-label` --que es lo que lee el lector de pantalla-- y
              `data-tip`, que lo enseña al pasar el cursor.
            -->
          <nav class="crumbs icons" aria-label="Ruta, solo iconos">
            <ol>
              <li>
                <a
                  href="#demo-navegacion"
                  onclick={(event) => {
                    event.preventDefault();
                    destination =
                      event.currentTarget.getAttribute("aria-label") ??
                      event.currentTarget.textContent?.trim() ??
                      "";
                  }}
                  aria-label="Panel"
                  data-tip="Panel"
                >
                  <i class="hgi-stroke hgi-dashboard-square-01"></i>
                </a>
              </li>
              <li>
                <a
                  href="#demo-navegacion"
                  onclick={(event) => {
                    event.preventDefault();
                    destination =
                      event.currentTarget.getAttribute("aria-label") ??
                      event.currentTarget.textContent?.trim() ??
                      "";
                  }}
                  aria-label="Comercio"
                  data-tip="Comercio"
                >
                  <i class="hgi-stroke hgi-store-01"></i>
                </a>
              </li>
              <li>
                <a
                  href="#demo-navegacion"
                  onclick={(event) => {
                    event.preventDefault();
                    destination =
                      event.currentTarget.getAttribute("aria-label") ??
                      event.currentTarget.textContent?.trim() ??
                      "";
                  }}
                  aria-label="Pedidos"
                  data-tip="Pedidos"
                >
                  <i class="hgi-stroke hgi-shopping-bag-01"></i>
                </a>
              </li>
              <li aria-current="page" aria-label="Pedido #AR-4821" data-tip="#AR-4821">
                <i class="hgi-stroke hgi-invoice-01"></i>
              </li>
            </ol>
          </nav>
          <p class="demo-feedback" aria-live="polite">
            {destination
              ? `Destino de ejemplo: ${destination}`
              : "Prueba una ruta sin salir de la galería."}
          </p>
        </div>
      </div>
    </article>
    <!-- Tab -->
    <article class="card gallery-item wide">
      {@render head("Pestañas", "Cambiar de vista sin salir. Ej.: los ajustes, importar")}
      <div class="card-body">
        <div class="tabs">
          <!-- `fit`: cada pestaña a su ancho (la pastilla va anclada, no
                 calcula). Sin anclas en el navegador, el `--n` de abajo deja
                 el reparto igual de la base como respaldo. -->
          <div class="tab-list fit" style="--n: 3">
            <input type="radio" name="demoTabs" id="demoTab1" checked />
            <label class="tab" for="demoTab1">
              <Icon name="sidebar-left" size={16} />Resumen
            </label>
            <input type="radio" name="demoTabs" id="demoTab2" />
            <label class="tab" for="demoTab2">Actividad</label>
            <input type="radio" name="demoTabs" id="demoTab3" />
            <label class="tab" for="demoTab3">Ajustes</label>
          </div>
          <div class="tab-panels">
            <p>
              El panel resume los ingresos, las sesiones y la conversión del periodo seleccionado.
            </p>
            <p>Últimos movimientos del equipo, ordenados del más reciente al más antiguo.</p>
            <p>Preferencias de notificación, miembros del espacio y claves de la API.</p>
          </div>
        </div>
      </div>
    </article>
    <!-- Steps -->
    <article class="card gallery-item wide">
      {@render head("Pasos", "El avance de un proceso. Ej.: la IA trabajando")}
      <div class="card-body">
        <ol class="steps">
          <li class="done">Carrito</li>
          <li class="done">Envío</li>
          <li class="current" aria-current="step">Pago</li>
          <li>Confirmación</li>
        </ol>
      </div>
    </article>
    <!-- Pagination -->
    <article class="card gallery-item">
      {@render head("Paginación", "Saltar entre páginas. Ej.: la rejilla de datos")}
      <div class="card-body">
        <nav class="nav-demo-pagination pager" aria-label="Paginación de ejemplo">
          <button
            class="btn-demo-previous"
            disabled={page === 1}
            aria-label="Anterior"
            onclick={() => page--}
          >
            <i class="hgi-stroke hgi-arrow-left-01" aria-hidden="true"></i>
          </button>
          {#each [1, 2, 3, 4, 5] as number (number)}
            <button
              aria-label={`Página ${number}`}
              aria-current={page === number ? "page" : undefined}
              onclick={() => (page = number)}
            >
              {number}
            </button>
          {/each}
          <button
            class="btn-demo-next"
            disabled={page === 5}
            aria-label="Siguiente"
            onclick={() => page++}
          >
            <i class="hgi-stroke hgi-arrow-right-01" aria-hidden="true"></i>
          </button>
        </nav>
        <p class="demo-feedback" aria-live="polite">
          Página {page} de 5 · Resultados {(page - 1) * 10 + 1}–{page * 10} de 50
        </p>
      </div>
    </article>
    <!-- Menu -->
    <article class="card gallery-item">
      {@render head(
        "Menú de acciones",
        "Acciones en un desplegable. Ej.: la cabecera de una columna",
      )}
      <div class="card-body">
        <div class="gallery-row">
          <button class="btn menu-btn" popovertarget="demoMenu">
            Acciones
            <i class="caret hgi-stroke hgi-arrow-down-01"></i>
          </button>
        </div>
        <p class="demo-feedback" aria-live="polite">
          {action ? `Acción de ejemplo: ${action}.` : "Abre el menú y elige una acción."}
        </p>
        <div class="menu" id="demoMenu" popover>
          <button
            type="button"
            popovertarget="demoMenu"
            popovertargetaction="hide"
            onclick={() => (action = "Editar")}
          >
            <i class="hgi-stroke hgi-pencil-edit-02"></i>
            Editar
          </button>
          <button
            type="button"
            popovertarget="demoMenu"
            popovertargetaction="hide"
            onclick={() => (action = "Duplicar")}
          >
            <i class="hgi-stroke hgi-copy-01"></i>
            Duplicar
          </button>
          <button
            type="button"
            popovertarget="demoMenu"
            popovertargetaction="hide"
            onclick={() => (action = "Exportar")}
          >
            <i class="hgi-stroke hgi-download-04"></i>
            Exportar
          </button>
          <div class="menu-sep"></div>
          <button
            type="button"
            class="danger"
            popovertarget="demoMenu"
            popovertargetaction="hide"
            onclick={() => (action = "Eliminar")}
          >
            <i class="hgi-stroke hgi-delete-02"></i>
            Eliminar
          </button>
        </div>
      </div>
    </article>
    <!-- Quiet trigger -->
    <article class="card gallery-item">
      {@render head("Selector discreto", "Abre un menú sin pintar caja. Ej.: columnas al importar")}
      <div class="card-body">
        <div class="gallery-demo">
          <p class="demo-note">
            En reposo no lleva ni fondo ni borde; la línea solo asoma bajo el cursor. Para cabeceras
            de tabla, que con caja parecen mandos.
          </p>
          <div class="gallery-row">
            <button type="button" class="trigger-quiet menu-btn" popovertarget="demoQuietMenu">
              <span class="trigger-quiet-soft">correo_cliente</span>
              <i class="hgi-stroke hgi-arrow-right-01" aria-hidden="true"></i>
              <span>Correo</span>
              <i class="hgi-stroke hgi-arrow-down-01" aria-hidden="true"></i>
            </button>
            <button type="button" class="trigger-quiet menu-btn" popovertarget="demoQuietMenu">
              <span>{columnType}</span>
              <i class="hgi-stroke hgi-arrow-down-01" aria-hidden="true"></i>
            </button>
          </div>
          <div class="menu" id="demoQuietMenu" popover>
            {#each ["Texto", "Número", "Correo"] as type (type)}
              <button
                type="button"
                popovertarget="demoQuietMenu"
                popovertargetaction="hide"
                onclick={() => (columnType = type)}
              >
                {type}
              </button>
            {/each}
          </div>
          <p class="demo-feedback" aria-live="polite">Tipo seleccionado: {columnType}</p>
        </div>
      </div>
    </article>
    <!-- Divider -->
    <article class="card gallery-item">
      {@render head("Separadores", "Línea entre bloques. Ej.: la barra superior")}
      <div class="card-body">
        <div class="gallery-demo">
          <hr class="divider" />
          <div class="divider-text">o continúa con</div>
          <hr class="divider" />
        </div>
      </div>
    </article>
  </div>
</div>
