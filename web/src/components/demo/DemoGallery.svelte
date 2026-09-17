<!--
  La galeria de componentes, copiada del panel de referencia
  (`/home/projects/ia/dashboard`) tal cual: el mismo marcado, sin nada propio.

  Es lo que la hace util. Estas piezas no las pinta nadie de aqui --las pinta
  `styles/components.css`, la misma hoja que viste el resto del panel-- asi que
  cualquier cambio en el catalogo se ve aqui en todos sus casos a la vez: los
  cuatro tonos de aviso, los estados de un boton, un campo con error, un modal
  con medida fija. Si algo se rompe al tocar la hoja, se rompe a la vista.

  Este archivo es el armazon; las fichas viven en las cinco secciones que
  compone, las mismas cinco que lista `DemoSidebar.svelte`:

    DemoNavegacion   pestañas, menu, migas, paginado
    DemoContenido    tarjetas, listas, la tabla de pedidos, tipografia, avatares
    DemoGraficas     las figuras de Chart.js (no son del catalogo)
    DemoFormularios  campos, selectores, casillas, interruptores
    DemoAvisos       notas, toasts, modales, cajones, cargando, vacio

  Lo que se queda aqui es lo que es de todas: la cabecera de ficha (`head()`,
  con el boton que enseña su codigo), el modal del codigo, y el reparto en
  columnas de las fichas --el masonry, que va por script porque el nativo de
  CSS aun no esta en todos los motores; esta explicado donde ocurre--.

  La disposicion compartida vive en `gallery.css` y no en el <style> de aqui:
  el marcado que la usa esta en las secciones, y el CSS con ambito de Svelte no
  cruza de un archivo a otro. Lo de cada seccion se queda en su componente.

  Tres cosas cambian respecto del original, y ninguna es de estilo: los iconos
  van con las dos clases de la casa (`hgi-stroke hgi-<nombre>`, ver
  `shared/icons.ts`) en vez de las cuatro del original; la muestra de la escala
  tipografica usa `ty-sample`, que es la clase que de verdad esta escrita en
  `gallery.css` --en el original decia `ty-body`, que no existe en ninguna
  hoja--; y el globo de ayuda es el del panel y no el `.tip` del catalogo, por
  lo que se explica en su ficha.

  La sidebar del panel de referencia y su selector de paleta no estan aqui: son
  la pagina entera de la demo, en `DemoSidebar.svelte` y `routes/Demo.svelte`.

  Y cada ficha lleva en su cabecera el boton que enseña su codigo. Lo que se
  ve ahi no esta escrito en ninguna parte: es el `card-body` de la propia ficha,
  sacado de los archivos de la galeria al abrir el modal (ver `./source.ts`),
  que es lo que evita tener cada ejemplo escrito dos veces. Al venir del archivo
  y no de lo pintado, una ficha que use un componente enseña la linea con la que
  se pide --`<PlanerAvatar mood="ok" size={24} />`-- y no el `<svg>` que salio.
-->
<script lang="ts">
  import "./gallery.css";

  import type { Snippet } from "svelte";

  import { loadMonaco } from "../../lib/monaco";
  import CodeEditor from "../CodeEditor.svelte";
  import DemoAvisos from "./DemoAvisos.svelte";
  import DemoContenido from "./DemoContenido.svelte";
  import DemoFormularios from "./DemoFormularios.svelte";
  import DemoGraficas from "./DemoGraficas.svelte";
  import DemoNavegacion from "./DemoNavegacion.svelte";
  import { loadCardSource } from "./source.ts";

  /* ---- El codigo de cada ficha ---- */

  // Un solo modal para las cuarenta y tantas fichas, y ningun ejemplo escrito
  // dos veces: el codigo sale del propio archivo de la galeria --el `card-body`
  // de la ficha que abrio el modal, buscado por su titulo (ver `./source.ts`)--
  // asi que tocar una ficha basta para que cambie tambien lo que se enseña
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
  // al apuntar el boton, no al pulsarlo: asi el modal se abre con el codigo ya
  // puesto.
  function warmCode() {
    void loadMonaco();
    void loadCardSource();
  }

  async function copyCode() {
    // Sin portapapeles --permiso denegado, sitio sin https-- el boton se queda
    // como estaba: el codigo sigue a la vista para copiarlo a mano.
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
        const colWidth = (width - gapX) / 2;
        const cols = [0, 0];

        for (const item of items) {
          const full = item.classList.contains("col-span-2");
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

  Ademas del titulo trae el boton que enseña el codigo del ejemplo; escrita una
  vez, el boton esta en las cuarenta y tantas fichas sin repetirlo en ninguna.
  `actions` es para las dos que ya llevaban mandos propios (el filtro de la
  tabla, el periodo de la grafica): entran antes del boton, en la misma fila.
-->
{#snippet head(title: string, sub: string, actions?: Snippet)}
  <div class="card-head">
    <div>
      <h1 class="card-title">{title}</h1>
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
        aria-label="Ver el código"
      >
        <i class="hgi-stroke hgi-source-code"></i>
      </button>
    </div>
  </div>
{/snippet}
<section class="gallery" bind:this={gallery}>
  <!-- Solo una linea separa el panel de la galeria -->
  <hr class="divider" />

  <DemoNavegacion {head} />
  <DemoContenido {head} />
  <DemoGraficas {head} />
  <DemoFormularios {head} />
  <DemoAvisos {head} />

  <!--
    El codigo de la ficha que se pidio. Es el `.modal` del catalogo con
    `popover`: en la capa superior la pone el navegador, y al quedarse donde
    esta escrito sigue dentro de `#demo-page`, que es quien lleva la paleta de
    la demo --un modal llevado al final del documento saldria con la del panel.
  -->
  <div class="modal modal-demo-code" id="demoCode" popover style="--modal-w: 44rem">
    <div class="modal-head">
      <div>
        <h3>{codeTitle}</h3>
        <p>El marcado de la ficha, tal y como esta escrito</p>
      </div>
      <button
        class="btn-icon sm btn-rounded"
        popovertarget="demoCode"
        popovertargetaction="hide"
        aria-label="Cerrar"
      >
        <i class="hgi-stroke hgi-cancel-01"></i>
      </button>
    </div>
    <div class="modal-body">
      <!--
        Monaco, el mismo editor del panel, de solo lectura. Va dentro de un
        `{#if}` para que no se monte hasta que se pide el primer codigo: pesa
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
        <i class="hgi-stroke hgi-{codeCopied ? 'tick-02' : 'copy-01'}"></i>
        {codeCopied ? "Copiado" : "Copiar"}
      </button>
    </div>
  </div>
</section>
