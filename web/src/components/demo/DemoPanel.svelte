<!--
  Panel: las superficies que agrupan --tarjetas, cajas interiores, la portada,
  pestañas, pasos y la línea que separa dos bloques--, y lo que ocupa una de
  ellas mientras su contenido todavía no ha llegado.

  Uno de los grupos de la galería; la cabecera de cada ficha y el modal con su
  código los pone `DemoGallery.svelte`, que es quien los compone. Lo que se ve
  aquí no lo pinta este archivo sino `styles/components.css`, igual que en el
  resto del panel.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  import Icon from "../Icon.svelte";

  let { head }: { head: Snippet<[string, string, Snippet?]> } = $props();
</script>

<div id="demo-panel" class="gallery-group">
  <div class="gallery-group-head">
    <h2>Panel</h2>
    <p>Superficies que agrupan el contenido, y la espera hasta que llega</p>
  </div>
  <div class="gallery-grid">
    <!-- Card -->
    <article class="card gallery-item wide">
      {@render head("Tarjeta", "Cabecera, cuerpo y pie. Ej.: cada bloque de los ajustes")}
      <div class="card-body">
        <div class="gallery-demo">
          <div class="gallery-cards">
            <div class="card">
              <div class="card-head">
                <div>
                  <h4 class="card-title">Plan Pro anual</h4>
                  <p class="card-sub">Renovación en 24 días</p>
                </div>
              </div>
              <div class="card-body">
                <p>
                  612 licencias activas de 700 contratadas. El importe se ajusta al consumo real en
                  la próxima factura.
                </p>
              </div>
              <div class="card-foot">
                <button class="btn">Detalles</button>
                <button class="btn btn-primary">Renovar</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
    <!-- Inset -->
    <article class="card gallery-item wide">
      {@render head("Panel interior", "Agrupa dentro de otra caja. Ej.: dentro de un modal")}
      <div class="card-body">
        <div class="gallery-demo">
          <!-- prettier-ignore -->
          <p class="demo-note">
              Dentro de una tarjeta o de un modal no puede ir otra tarjeta: se hunde en vez de
              levantarse. <code>plain</code> deja solo el borde; <code>dashed</code>, para lo que
              aún está vacío.
            </p>
          <div class="inset">
            <div class="gallery-row">
              <span class="tag tint-1">Ventas</span>
              <span class="tag tint-2">Soporte</span>
              <span class="tag tint-3">Producto</span>
              <span class="tag">Sin asignar</span>
            </div>
          </div>
          <div class="inset plain">
            <ul class="list demo-inset-list">
              <li>
                <span class="l-main">Versión 12</span>
                <span class="tag tag-success">En vivo</span>
              </li>
              <li><span class="l-main">Versión 11</span></li>
            </ul>
          </div>
          <div class="inset dashed">
            <p class="demo-note">Todavía no hay ninguna regla. Se añaden desde el botón.</p>
          </div>
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
      {@render head("Pasos", "El avance de un proceso. Ej.: proceso en curso")}
      <div class="card-body">
        <ol class="steps">
          <li class="done">Carrito</li>
          <li class="done">Envío</li>
          <li class="current" aria-current="step">Pago</li>
          <li>Confirmación</li>
        </ol>
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
    <!-- Hero -->
    <article class="card gallery-item wide col-span-2">
      {@render head(
        "Portada",
        "La banda de portada, con el color de la marca. En páginas generadas",
      )}
      <div class="card-body">
        <div class="gallery-demo">
          <!-- prettier-ignore -->
          <p class="demo-note">
              La única pieza que se pinta con el relleno pleno de la marca, y por eso la única que
              viste lo que lleva dentro: la letra va en la tinta que se lee sobre ese color, el
              <code>btn</code> se vacía y el <code>btn-primary</code> se levanta en papel. No hay
              que escribir ningún color encima —hacerlo es lo que rompe la banda al cambiar de
              paleta o de modo.
            </p>
          <div class="hero">
            <h4 class="hero-title">Chequeo preoperacional</h4>
            <p class="hero-sub">
              Revisa el vehículo antes de salir. Queda a tu nombre y se suma al resumen del turno.
            </p>
            <div class="hero-actions">
              <button class="btn btn-primary">
                <i class="hgi-stroke hgi-add-01"></i>
                Registrar chequeo
              </button>
              <button class="btn">Ver los de hoy</button>
            </div>
          </div>
        </div>
      </div>
    </article>
  </div>
</div>
