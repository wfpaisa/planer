<!--
  Previsualizaciones del catálogo: cada sección conserva el marcado real de
  los componentes. Aquí se comparten las cabeceras, el visor de código y el
  reparto adaptable. El CSS de presentación vive en gallery.css y solo afecta
  a esta galería; los ejemplos siguen usando las hojas del panel.
-->
<script lang="ts">
  import "./gallery.css";

  import type { Snippet } from "svelte";

  import { loadMonaco } from "../../lib/monaco";
  import CodeEditor from "../CodeEditor.svelte";
  import DemoArchivo from "./DemoArchivo.svelte";
  import DemoDatos from "./DemoDatos.svelte";
  import DemoFormulario from "./DemoFormulario.svelte";
  import DemoGraficas from "./DemoGraficas.svelte";
  import DemoMensajes from "./DemoMensajes.svelte";
  import DemoMenu from "./DemoMenu.svelte";
  import DemoPanel from "./DemoPanel.svelte";
  import DemoSuperposicion from "./DemoSuperposicion.svelte";
  import DemoVarios from "./DemoVarios.svelte";
  import { loadCardSource } from "./source.ts";

  /* ---- El código de cada ficha ---- */

  // Un solo modal para las cuarenta y tantas fichas, y ningún ejemplo escrito
  // dos veces: el código sale del propio archivo de la galeria --el `card-body`
  // de la ficha que abrio el modal, buscado por su título (ver `./source.ts`)--
  // asi que tocar una ficha basta para que cambie también lo que se enseña
  // aqui, y lo que se enseña es lo que hay escrito, componentes incluidos.
  let codeTitle = $state("");
  let codeMarkup = $state("");
  let codeCopied = $state(false);

  async function showCode(e: MouseEvent) {
    const card = (e.currentTarget as HTMLElement).closest(".gallery-item");
    const title = card?.querySelector(".card-title")?.textContent?.trim() ?? "Código";
    codeTitle = title;
    codeMarkup = "";
    codeCopied = false;

    const cards = await loadCardSource();
    // Con el archivo ya traido esto es el mismo cuadro; si tardo y por el
    // camino se pidio otra ficha, manda la ultima.
    if (codeTitle === title) codeMarkup = cards.get(title) ?? "";
  }

  // Monaco y el archivo de la galeria tardan lo suyo la primera vez y se piden
  // al apuntar el botón, no al pulsarlo: asi el modal se abre con el código ya
  // puesto.
  function warmCode() {
    void loadMonaco();
    void loadCardSource();
  }

  async function copyCode() {
    // Sin portapapeles --permiso denegado, sitio sin https-- el botón se queda
    // como estaba: el código sigue a la vista para copiarlo a mano.
    try {
      await navigator.clipboard.writeText(codeMarkup);
      codeCopied = true;
    } catch {
      codeCopied = false;
    }
  }

  // Masonry por script: el nativo de CSS (`grid-template-rows: masonry`) aún
  // no está en todos los motores, así que el reparto se hace midiendo. Cada
  // ficha se coloca en la columna más corta y las `col-span-2` cruzan las dos,
  // apoyadas en la que esté más baja. Un ResizeObserver en los grids y en las
  // fichas reacomoda cuando cambia el ancho (ventana, cajón de paletas) o el
  // alto del contenido (gráficas, fuentes); sin script manda el grid de la
  // hoja de estilos, que es el mismo comportamiento de siempre.
  //
  // Por eso las fichas `col-span-2` van las últimas de su grupo: una ficha ancha
  // se apoya en la columna más baja y deja plantada a la otra, así que puesta en
  // medio abre un hueco. Al final no corta nada.
  let gallery = $state<HTMLElement | null>(null);

  $effect.pre(() => {
    const rootEl = gallery;
    if (!rootEl) return;
    const grids = Array.from(rootEl.querySelectorAll<HTMLElement>(".gallery-grid"));
    let frame = 0;

    const pack = () => {
      for (const grid of grids) {
        const items = Array.from(grid.children) as HTMLElement[];
        if (items.length === 0) continue;
        const styles = getComputedStyle(grid);
        const gapY = Number.parseFloat(styles.rowGap) || 0;
        const gapX = Number.parseFloat(styles.columnGap) || 0;
        const width = grid.clientWidth;
        const columnCount = Number(styles.getPropertyValue("--gallery-columns")) || 1;
        const colWidth = (width - gapX * (columnCount - 1)) / columnCount;
        const cols = [0, 0];

        for (const item of items) {
          const full = columnCount === 1 || item.classList.contains("col-span-2");
          const w = full ? width : colWidth;
          if (item.style.width !== `${w}px`) item.style.width = `${w}px`;
          const h = item.offsetHeight;
          if (full) {
            const y = Math.max(cols[0], cols[1]);
            item.style.transform = `translate(0px, ${y}px)`;
            cols[0] = cols[1] = y + h + gapY;
          } else {
            const col = cols[0] <= cols[1] ? 0 : 1;
            item.style.transform = `translate(${col * (colWidth + gapX)}px, ${cols[col]}px)`;
            cols[col] += h + gapY;
          }
        }
        grid.style.height = `${Math.max(cols[0], cols[1]) - gapY}px`;
      }
    };

    // Una medición por cuadro: la transición del cajón de paletas avisa al
    // observer en cada paso, y sobran los reacomodos intermedios.
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(pack);
    };

    const observer = new ResizeObserver(schedule);
    for (const grid of grids) {
      grid.classList.add("masonry");
      observer.observe(grid);
      for (const item of Array.from(grid.children)) observer.observe(item);
    }
    pack();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  });
</script>

<!--
  La cabecera de cada ficha, en un sitio solo.

  Ademas del título trae el botón que enseña el código del ejemplo; escrita una
  vez, el botón esta en las cuarenta y tantas fichas sin repetirlo en ninguna.
  `actions` es para las dos que ya llevaban mandos propios (el filtro de la
  tabla, el periodo de la gráfica): entran antes del botón, en la misma fila.
-->
{#snippet head(title: string, sub: string, actions?: Snippet)}
  <div class="head-demo-preview card-head">
    <div>
      <h3 class="title-demo-preview card-title">{title}</h3>
      <p class="card-sub">{sub}</p>
    </div>
    <div class="card-head-actions">
      {#if actions}{@render actions()}{/if}
      <button
        type="button"
        class="btn-show-code btn-icon sm btn-rounded"
        popovertarget="demoCode"
        onclick={showCode}
        onpointerenter={warmCode}
        onfocus={warmCode}
        data-tip="Ver el código"
        aria-label={`Ver el código de ${title}`}
      >
        <i class="icon icon-source-code"></i>
      </button>
    </div>
  </div>
{/snippet}
<section class="gallery" bind:this={gallery}>
  <!-- Solo una línea separa el panel de la galeria -->
  <p class="note-demo-preview demo-note">
    Explora las variantes y prueba los controles. Todas las muestras usan datos de ejemplo.
  </p>

  <DemoFormulario {head} />
  <DemoDatos {head} />
  <DemoGraficas {head} />
  <DemoPanel {head} />
  <DemoSuperposicion {head} />
  <DemoArchivo {head} />
  <DemoMenu {head} />
  <DemoMensajes {head} />
  <DemoVarios {head} />

  <!--
    El código de la ficha que se pidio. Es el `.modal` del catálogo con
    `popover`: en la capa superior la pone el navegador, y al quedarse donde
    esta escrito sigue dentro de `#demo-page`, que es quien lleva la paleta de
    la demo --un modal llevado al final del documento saldria con la del panel.
  -->
  <div class="modal modal-demo-code" id="demoCode" popover style="--modal-w: 44rem">
    <div class="modal-head">
      <div>
        <h3>{codeTitle}</h3>
        <p>El marcado de la ficha tal como está escrito</p>
      </div>
      <button
        class="btn-icon sm btn-rounded"
        popovertarget="demoCode"
        popovertargetaction="hide"
        aria-label="Cerrar"
      >
        <i class="icon icon-cancel-01"></i>
      </button>
    </div>
    <div class="modal-body">
      <!--
        Monaco, el mismo editor del panel, de solo lectura. Va dentro de un
        `{#if}` para que no se monte hasta que se pide el primer código: pesa
        cuatro megas y la demo se abre para mirar componentes, no para leerlos.
      -->
      <div class="code-box inset plain">
        {#if codeMarkup}
          <CodeEditor value={codeMarkup} language="html" readOnly />
        {/if}
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" popovertarget="demoCode" popovertargetaction="hide">Cerrar</button>
      <button class="btn btn-primary" onclick={copyCode}>
        <i class="icon icon-{codeCopied ? 'tick-02' : 'copy-01'}"></i>
        {codeCopied ? "Copiado" : "Copiar"}
      </button>
    </div>
  </div>
</section>
