<!--
  Menú: lo que despliega opciones o dice dónde se está --la ruta, el menú de
  acciones y el selector sin caja--.

  Uno de los grupos de la galería; la cabecera de cada ficha y el modal con su
  código los pone `DemoGallery.svelte`, que es quien los compone. Lo que se ve
  aquí no lo pinta este archivo sino `styles/components.css`, igual que en el
  resto del panel.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  let destination = $state("");
  let action = $state("");
  let columnType = $state("Texto");

  let { head }: { head: Snippet<[string, string, Snippet?]> } = $props();
</script>

<div id="demo-menu" class="gallery-group">
  <div class="gallery-group-head">
    <h2>Menú</h2>
    <p>Menús, rutas y desplegables</p>
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
                  href="#demo-menu"
                  onclick={(event) => {
                    event.preventDefault();
                    destination =
                      event.currentTarget.getAttribute("aria-label") ??
                      event.currentTarget.textContent?.trim() ??
                      "";
                  }}
                >
                  <i class="icon icon-dashboard-square-01"></i>
                  Panel
                </a>
              </li>
              <li>
                <a
                  href="#demo-menu"
                  onclick={(event) => {
                    event.preventDefault();
                    destination =
                      event.currentTarget.getAttribute("aria-label") ??
                      event.currentTarget.textContent?.trim() ??
                      "";
                  }}
                >
                  <i class="icon icon-store-01"></i>
                  Comercio
                </a>
              </li>
              <li>
                <a
                  href="#demo-menu"
                  onclick={(event) => {
                    event.preventDefault();
                    destination =
                      event.currentTarget.getAttribute("aria-label") ??
                      event.currentTarget.textContent?.trim() ??
                      "";
                  }}
                >
                  <i class="icon icon-shopping-bag-01"></i>
                  Pedidos
                </a>
              </li>
              <li aria-current="page">
                <i class="icon icon-invoice-01"></i>
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
                  href="#demo-menu"
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
                  <i class="icon icon-dashboard-square-01"></i>
                </a>
              </li>
              <li>
                <a
                  href="#demo-menu"
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
                  <i class="icon icon-store-01"></i>
                </a>
              </li>
              <li>
                <a
                  href="#demo-menu"
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
                  <i class="icon icon-shopping-bag-01"></i>
                </a>
              </li>
              <li aria-current="page" aria-label="Pedido #AR-4821" data-tip="#AR-4821">
                <i class="icon icon-invoice-01"></i>
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
            <i class="caret icon icon-arrow-down-01"></i>
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
            <i class="icon icon-pencil-edit-02"></i>
            Editar
          </button>
          <button
            type="button"
            popovertarget="demoMenu"
            popovertargetaction="hide"
            onclick={() => (action = "Duplicar")}
          >
            <i class="icon icon-copy-01"></i>
            Duplicar
          </button>
          <button
            type="button"
            popovertarget="demoMenu"
            popovertargetaction="hide"
            onclick={() => (action = "Exportar")}
          >
            <i class="icon icon-download-04"></i>
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
            <i class="icon icon-delete-02"></i>
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
              <i class="icon icon-arrow-right-01" aria-hidden="true"></i>
              <span>Correo</span>
              <i class="icon icon-arrow-down-01" aria-hidden="true"></i>
            </button>
            <button type="button" class="trigger-quiet menu-btn" popovertarget="demoQuietMenu">
              <span>{columnType}</span>
              <i class="icon icon-arrow-down-01" aria-hidden="true"></i>
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
  </div>
</div>
