<!--
  Varios: las piezas sueltas que no encabezan un grupo propio --la escala
  tipográfica, el rótulo de un grupo, la identidad de quien ha entrado, los
  enlaces y la cara del asistente--.

  Uno de los grupos de la galería; la cabecera de cada ficha y el modal con su
  código los pone `DemoGallery.svelte`, que es quien los compone. Lo que se ve
  aquí no lo pinta este archivo sino `styles/components.css`, igual que en el
  resto del panel.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  import PlanerAvatar from "../PlanerAvatar.svelte";

  let { head }: { head: Snippet<[string, string, Snippet?]> } = $props();
</script>

<div id="demo-varios" class="gallery-group">
  <div class="gallery-group-head">
    <h2>Varios</h2>
    <p>Tipografía, rótulos, identidad y la cara del asistente</p>
  </div>
  <div class="gallery-grid">
    <!-- Typography -->
    <article class="card gallery-item wide">
      {@render head("Tipografía", "Los tamaños de letra del sistema")}
      <div class="card-body">
        <div class="type-scale">
          <div class="ty-row">
            <p class="title">Ingresos y sesiones</p>
            <span class="ty-meta">
              TÍTULO
              <b>1.125rem</b>
            </span>
          </div>
          <div class="ty-row">
            <p class="ty-sample">
              El panel resume los ingresos, las sesiones y la conversión del periodo seleccionado.
            </p>
            <span class="ty-meta">
              TEXTO NORMAL
              <b>1rem</b>
            </span>
          </div>
          <div class="ty-row">
            <small>Comparado con el periodo anterior · datos provisionales</small>
            <span class="ty-meta">
              PEQUEÑO
              <b>0.875rem</b>
            </span>
          </div>
        </div>
      </div>
    </article>
    <!-- Eyebrow -->
    <article class="card gallery-item">
      {@render head("Etiqueta de grupo", "Encabeza un grupo, en versalitas. Ej.: sobre una lista")}
      <div class="card-body">
        <div class="gallery-demo">
          <p class="demo-note">
            No es un título: va en tono accesorio y sin negrita, para no competir con lo que
            encabeza.
          </p>
          <div>
            <p class="eyebrow">Qué se quiere hacer</p>
            <ul class="list">
              <li><span class="l-main">Borrar la columna «Teléfono»</span></li>
              <li><span class="l-main">Cambiar «Importe» a número</span></li>
            </ul>
          </div>
        </div>
      </div>
    </article>
    <!-- Identity -->
    <article class="card gallery-item">
      {@render head("Identidad", "Quién ha entrado. Ej.: los ajustes, los miembros de una página")}
      <div class="card-body">
        <div class="gallery-demo">
          <p class="demo-note">
            Nombre encima, cuenta debajo. Los dos se recortan antes que empujar al avatar o al botón
            de al lado.
          </p>
          <div class="gallery-row">
            <span class="avatar">EM</span>
            <div class="identity">
              <strong>Elena Márquez</strong>
              <span>elena.marquez@empresa.com</span>
            </div>
            <button
              type="button"
              class="btn-icon sm btn-danger-quiet"
              aria-label="Cerrar sesión"
              data-tip="Cerrar sesión"
            >
              <i class="hgi-stroke hgi-logout-03"></i>
            </button>
          </div>
        </div>
      </div>
    </article>

    <!-- Link -->
    <article class="card gallery-item">
      {@render head("Enlace", "Con icono de salida. Ej.: abrir la página publicada")}
      <div class="card-body">
        <div class="gallery-demo">
          <a class="link" href="/demo" target="_blank" rel="noopener noreferrer">
            Abrir en pestaña nueva
            <i class="hgi-stroke hgi-link-square-02"></i>
          </a>
        </div>
      </div>
    </article>

    <!-- Planer -->
    <article class="card gallery-item wide">
      {@render head("Planer", "La cara del asistente. Ej.: la cabecera del chat")}
      <div class="card-body">
        <div class="gallery-demo">
          <!-- prettier-ignore -->
          <p class="demo-note">
              No es CSS: es el componente <code>PlanerAvatar</code>. Toma el acento de la paleta
              puesta y todo lo suyo se mide contra <code>size</code>.
            </p>
          <div class="gallery-row">
            <PlanerAvatar mood="normal" size={56} />
            <PlanerAvatar mood="happy" size={56} />
            <PlanerAvatar mood="ok" size={56} />
            <PlanerAvatar mood="happy" size={56} icon="bubble-chat" />
            <PlanerAvatar mood="normal" size={56} icon="bubble-chat-question" />
          </div>
          <div class="gallery-row">
            <PlanerAvatar mood="ok" size={24} icon="bubble-chat" />
            <PlanerAvatar mood="ok" size={40} icon="bubble-chat" />
            <PlanerAvatar mood="ok" size={88} icon="bubble-chat" />
          </div>
        </div>
      </div>
    </article>
    <!-- Insight -->
    <article class="card gallery-item wide col-span-2">
      {@render head("Recomendaciones", "Un apunte destacado. En páginas generadas")}
      <div class="card-body">
        <div class="insights">
          <article class="insight a">
            <i class="deco hgi-stroke hgi-ai-magic"></i>
            <h3>Predecir la demanda del próximo trimestre</h3>
            <p>El modelo detectó estacionalidad estable en 4 categorías.</p>
          </article>
          <article class="insight b">
            <i class="deco hgi-stroke hgi-target-02"></i>
            <h3>Recuperar 312 carritos abandonados</h3>
            <p>Valor potencial estimado de 18 400 € en 7 días.</p>
          </article>
          <article class="insight c">
            <i class="deco hgi-stroke hgi-rocket-01"></i>
            <h3>Optimizar el embudo de registro</h3>
            <p>La caída principal ocurre en el paso de verificación.</p>
          </article>
        </div>
      </div>
    </article>
  </div>
</div>
