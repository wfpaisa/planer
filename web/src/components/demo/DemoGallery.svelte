<!--
  La galeria de componentes, copiada del panel de referencia
  (`/home/projects/ia/dashboard`) tal cual: el mismo marcado, sin nada propio.

  Es lo que la hace util. Estas piezas no las pinta nadie de aqui --las pinta
  `styles/components.css`, la misma hoja que viste el resto del panel-- asi que
  cualquier cambio en el catalogo se ve aqui en todos sus casos a la vez: los
  cuatro tonos de aviso, los estados de un boton, un campo con error, un modal
  con medida fija. Si algo se rompe al tocar la hoja, se rompe a la vista.

  Tres cosas cambian respecto del original, y ninguna es de estilo: los iconos
  van con las dos clases de la casa (`hgi-stroke hgi-<nombre>`, ver
  `shared/icons.ts`) en vez de las cuatro del original; la muestra de la escala
  tipografica usa `ty-sample`, que es la clase que de verdad esta escrita abajo
  --en el original decia `ty-body`, que no existe en ninguna hoja--; y el globo
  de ayuda es el del panel y no el `.tip` del catalogo, por lo que se explica
  en su ficha.

  La disposicion vive en el <style> del final: en el proyecto de origen esta
  en su hoja de aplicacion, que aqui no se copio. La excepcion es el reparto
  en columnas de las fichas, que va por script --el masonry nativo de CSS aun
  no esta en todos los motores--; esta explicado donde ocurre.

  La ficha Table es el OrdersTable del panel de referencia, con su filtro, su
  orden y su paginación de verdad (el script de abajo, los datos en
  `./orders.ts`); la disposición de sus celdas --el cliente con su avatar,
  las acciones que solo asoman sobre la fila apuntada-- se trajo al <style>
  del final desde la hoja de aplicación de origen, igual que la de las
  gráficas.

  Las **gráficas** también vienen del panel de referencia (`lib/charts.svelte.js`
  de origen, aquí `./charts.ts`) pero no son del catálogo: son canvas de
  Chart.js, y un canvas no lee variables CSS. Cada color se resuelve en el
  momento y se vuelve a pintar todo al cambiar la paleta de la demo o el tema.
  La disposición de sus figuras (leyenda, donut, reparto) va al <style> de
  abajo, copiada de la hoja de aplicación de origen.

  La sidebar del panel de referencia y su selector de paleta no están aquí: son
  la página entera de la demo, en `DemoSidebar.svelte` y `routes/Demo.svelte`.

  La ficha Tab lleva `fit`, variante del catálogo que no existía en el original:
  cada pestaña a su ancho natural, con la pastilla anclada a la marcada.

  La ficha Breadcrumbs enseña dos rutas: la de siempre, ahora con el icono de
  cada nivel delante del texto, y debajo la misma solo con iconos (`icons`,
  otra variante que no estaba en el original). Las dos las viste el catálogo.

  Y cada ficha lleva en su cabecera el botón que enseña su código. Lo que se
  ve ahí no está escrito en ninguna parte: es el `card-body` de la propia ficha,
  sacado de este archivo al abrir el modal (ver `./source.ts`), que es lo que
  evita tener cada ejemplo escrito dos veces. Al venir del archivo y no de lo
  pintado, una ficha que use un componente enseña la línea con la que se pide
  --`<PlanerAvatar mood="ok" size={24} />`-- y no el `<svg>` que salió.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  import { loadMonaco } from "../../lib/monaco";
  import CodeEditor from "../CodeEditor.svelte";
  import Icon from "../Icon.svelte";
  import PlanerAvatar from "../PlanerAvatar.svelte";
  import { buildDemoCharts, CHANNELS, destroyDemoCharts, KPIS } from "./charts.ts";
  import type { DemoOrder, OrderStatus } from "./orders.ts";
  import { BADGE, fmtAmount, fmtDate, initials, ORDERS } from "./orders.ts";
  import { loadCardSource } from "./source.ts";

  let spark = $state<HTMLCanvasElement | null>(null);
  let main = $state<HTMLCanvasElement | null>(null);
  let donut = $state<HTMLCanvasElement | null>(null);
  let category = $state<HTMLCanvasElement | null>(null);
  let kpiSparks = $state<(HTMLCanvasElement | null)[]>([]);

  const RANGES = [
    { days: 7, label: "7 D" },
    { days: 30, label: "30 D" },
    { days: 90, label: "90 D" },
  ] as const;
  let range = $state<number>(30);

  // La paleta de la demo va en `#demo-page` (el color a mano, como `--palette-1`
  // en su `style`) y el tema en `<html>`; un canvas no se entera de ninguno de
  // los dos, así que hay que avisarle a mano.
  let repaint = $state(0);
  $effect(() => {
    const bump = () => {
      repaint += 1;
    };
    const targets: [Element, string[]][] = [[document.documentElement, ["data-theme"]]];
    const page = document.getElementById("demo-page");
    if (page) targets.push([page, ["data-palette", "style"]]);
    const observers = targets.map(([el, attributeFilter]) => {
      const o = new MutationObserver(bump);
      o.observe(el, { attributes: true, attributeFilter });
      return o;
    });
    return () => {
      for (const o of observers) o.disconnect();
    };
  });

  $effect(() => {
    void repaint;
    buildDemoCharts({ spark, main, donut, category, kpiSparks }, range);
  });

  $effect(() => () => destroyDemoCharts());

  const channelsTotal = CHANNELS.reduce((sum, c) => sum + c.val, 0);

  /* ---- La ficha Table: el OrdersTable del panel de referencia ---- */

  type OrderFilter = "all" | OrderStatus;
  type OrderSortKey = "client" | "date" | "amount";

  const STATUS_OPTS: { st: OrderFilter; label: string }[] = [
    { st: "all", label: "Todos" },
    { st: "ok", label: "Pagados" },
    { st: "wait", label: "Pendientes" },
    { st: "fail", label: "Fallidos" },
  ];

  let orderFilter = $state<OrderFilter>("all");
  let orderSort = $state<{ key: OrderSortKey; dir: "asc" | "desc" }>({
    key: "date",
    dir: "desc",
  });
  let orderPage = $state(1);
  const ORDERS_PER_PAGE = 6;

  const orderRows = $derived.by(() => {
    const list = ORDERS.filter((o) => orderFilter === "all" || o.st === orderFilter);
    const valueOf = (o: DemoOrder) =>
      orderSort.key === "client" ? o.n : orderSort.key === "amount" ? o.amount : o.ts;
    return list.slice().sort((a, b) => {
      const c = valueOf(a) < valueOf(b) ? -1 : valueOf(a) > valueOf(b) ? 1 : 0;
      return orderSort.dir === "asc" ? c : -c;
    });
  });
  const orderPages = $derived(Math.max(1, Math.ceil(orderRows.length / ORDERS_PER_PAGE)));
  const orderSafePage = $derived(Math.min(orderPage, orderPages));
  const orderSlice = $derived(
    orderRows.slice(
      (orderSafePage - 1) * ORDERS_PER_PAGE,
      (orderSafePage - 1) * ORDERS_PER_PAGE + ORDERS_PER_PAGE,
    ),
  );
  const orderPageInfo = $derived(
    orderRows.length
      ? `Mostrando ${(orderSafePage - 1) * ORDERS_PER_PAGE + 1}–${
          (orderSafePage - 1) * ORDERS_PER_PAGE + orderSlice.length
        } de ${orderRows.length} pedidos`
      : "Sin pedidos en este estado",
  );

  function setOrderFilter(st: OrderFilter) {
    orderFilter = st;
    orderPage = 1;
  }

  function sortOrders(key: OrderSortKey) {
    orderSort =
      orderSort.key === key
        ? { key, dir: orderSort.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "client" ? "asc" : "desc" };
    orderPage = 1;
  }

  function orderSortAria(key: OrderSortKey): "ascending" | "descending" | undefined {
    if (orderSort.key !== key) return undefined;
    return orderSort.dir === "asc" ? "ascending" : "descending";
  }

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

  <div id="demo-navegacion" class="gallery-group">
    <div class="gallery-group-head">
      <h3>Navegación</h3>
      <p>Cómo se mueve la gente por el panel</p>
    </div>
    <div class="gallery-grid">
      <!-- Breadcrumbs -->
      <article class="card gallery-item">
        {@render head("Migas de ruta", "La ruta hasta donde estás. En páginas generadas")}
        <div class="card-body">
          <div class="gallery-demo">
            <nav class="crumbs" aria-label="Ruta">
              <ol>
                <li><a href="/"><i class="hgi-stroke hgi-dashboard-square-01"></i>Panel</a></li>
                <li><a href="/"><i class="hgi-stroke hgi-store-01"></i>Comercio</a></li>
                <li><a href="/"><i class="hgi-stroke hgi-shopping-bag-01"></i>Pedidos</a></li>
                <li aria-current="page"><i class="hgi-stroke hgi-invoice-01"></i>#AR-4821</li>
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
                  <a href="/" aria-label="Panel" data-tip="Panel">
                    <i class="hgi-stroke hgi-dashboard-square-01"></i>
                  </a>
                </li>
                <li>
                  <a href="/" aria-label="Comercio" data-tip="Comercio">
                    <i class="hgi-stroke hgi-store-01"></i>
                  </a>
                </li>
                <li>
                  <a href="/" aria-label="Pedidos" data-tip="Pedidos">
                    <i class="hgi-stroke hgi-shopping-bag-01"></i>
                  </a>
                </li>
                <li aria-current="page" aria-label="Pedido #AR-4821" data-tip="#AR-4821">
                  <i class="hgi-stroke hgi-invoice-01"></i>
                </li>
              </ol>
            </nav>
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
              <label class="tab" for="demoTab1"><Icon name="sidebar-left" size={16} />Resumen</label
              >
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
            <li class="current">Pago</li>
            <li>Confirmación</li>
          </ol>
        </div>
      </article>
      <!-- Pagination -->
      <article class="card gallery-item">
        {@render head("Paginación", "Saltar entre páginas. Ej.: la rejilla de datos")}
        <div class="card-body">
          <nav class="pager" aria-label="Paginación">
            <button disabled aria-label="Anterior">
              <i class="hgi-stroke hgi-arrow-left-01"></i>
            </button>
            <button aria-current="page">1</button>
            <button>2</button>
            <button>3</button>
            <span class="gap">…</span>
            <button>12</button>
            <button aria-label="Siguiente">
              <i class="hgi-stroke hgi-arrow-right-01"></i>
            </button>
          </nav>
        </div>
      </article>
      <!-- Menu -->
      <article class="card gallery-item">
        {@render head("Menú", "Acciones en un desplegable. Ej.: la cabecera de una columna")}
        <div class="card-body">
          <div class="gallery-row">
            <button class="btn menu-btn" popovertarget="demoMenu"
              >Acciones<i class="caret hgi-stroke hgi-arrow-down-01"></i></button
            >
          </div>
          <div class="menu" id="demoMenu" popover>
            <button type="button"><i class="hgi-stroke hgi-pencil-edit-02"></i>Editar</button>
            <button type="button"><i class="hgi-stroke hgi-copy-01"></i>Duplicar</button>
            <button type="button"><i class="hgi-stroke hgi-download-04"></i>Exportar</button>
            <div class="menu-sep"></div>
            <button type="button" class="danger"
              ><i class="hgi-stroke hgi-delete-02"></i>Eliminar</button
            >
          </div>
        </div>
      </article>
      <!-- Quiet trigger -->
      <article class="card gallery-item">
        {@render head("Botón discreto", "Abre un menú sin pintar caja. Ej.: columnas al importar")}
        <div class="card-body">
          <div class="gallery-demo">
            <p class="demo-note">
              En reposo no lleva ni fondo ni borde; la línea solo asoma bajo el cursor. Para
              cabeceras de tabla, que con caja parecen mandos.
            </p>
            <div class="gallery-row">
              <button type="button" class="trigger-quiet">
                <span class="trigger-quiet-soft">correo_cliente</span>
                <i class="hgi-stroke hgi-arrow-right-01" aria-hidden="true"></i>
                <span>Correo</span>
                <i class="hgi-stroke hgi-arrow-down-01" aria-hidden="true"></i>
              </button>
              <button type="button" class="trigger-quiet">
                <span>Texto</span>
                <i class="hgi-stroke hgi-arrow-down-01" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </div>
      </article>
      <!-- Divider -->
      <article class="card gallery-item">
        {@render head("Separador", "Línea entre bloques. Ej.: la barra superior")}
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
  <div id="demo-contenido" class="gallery-group">
    <div class="gallery-group-head">
      <h3>Contenido</h3>
      <p>Superficies y piezas para mostrar datos</p>
    </div>
    <div class="gallery-grid">
      <!-- Typography -->
      <article class="card gallery-item wide">
        {@render head("Tipografía", "Los tamaños de letra del sistema")}
        <div class="card-body">
          <div class="type-scale">
            <div class="ty-row">
              <p class="title">Ingresos y sesiones</p>
              <span class="ty-meta">TÍTULO<b>1.125rem</b></span>
            </div>
            <div class="ty-row">
              <p class="ty-sample">
                El panel resume los ingresos, las sesiones y la conversión del periodo seleccionado.
              </p>
              <span class="ty-meta">TEXTO NORMAL<b>1rem</b></span>
            </div>
            <div class="ty-row">
              <small> Comparado con el periodo anterior · datos provisionales </small>
              <span class="ty-meta">SMALL<b>0.875rem</b></span>
            </div>
          </div>
        </div>
      </article>
      <!-- Card -->
      <article class="card gallery-item wide">
        {@render head("Tarjeta", "Cabecera, cuerpo y pie. Ej.: cada bloque de los ajustes")}
        <div class="card-body">
          <div class="gallery-demo">
            <div class="gallery-cards">
              <div class="card">
                <div class="card-head">
                  <div>
                    <h1 class="card-title">Plan Pro anual</h1>
                    <p class="card-sub">Renovación en 24 días</p>
                  </div>
                </div>
                <div class="card-body">
                  <p>
                    612 licencias activas de 700 contratadas. El importe se ajusta al consumo real
                    en la próxima factura.
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
        {@render head("Caja interior", "Agrupa dentro de otra caja. Ej.: dentro de un modal")}
        <div class="card-body">
          <div class="gallery-demo">
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
                  <span class="l-main">Versión 12</span><span class="tag tag-success">En vivo</span>
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
      <!-- Eyebrow -->
      <article class="card gallery-item">
        {@render head("Rótulo de grupo", "Encabeza un grupo, en versalitas. Ej.: sobre una lista")}
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
        {@render head(
          "Identidad",
          "Quién ha entrado. Ej.: los ajustes, los miembros de una página",
        )}
        <div class="card-body">
          <div class="gallery-demo">
            <p class="demo-note">
              Nombre encima, cuenta debajo. Los dos se recortan antes que empujar al avatar o al
              botón de al lado.
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
      <!-- Insight -->
      <article class="card gallery-item wide col-span-2">
        {@render head("Sugerencia", "Un apunte destacado. En páginas generadas")}
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
      <!-- Stat -->
      <article class="card gallery-item">
        {@render head("Cifra", "Un número con su etiqueta. En páginas generadas")}
        <div class="card-body">
          <div class="gallery-demo">
            <div class="stat">
              <span class="s-label">Ingresos netos</span>
              <span class="s-val number"
                >$184.320 <span class="tag tag-success"
                  ><i class="hgi-stroke hgi-arrow-up-right-01"></i>12.4 %</span
                ></span
              >
              <span class="s-foot">vs. $163.980 del periodo anterior</span>
            </div>
          </div>
        </div>
      </article>
      <!-- List -->
      <article class="card gallery-item">
        {@render head("Lista", "Filas con avatar, texto y estado. Ej.: las tablas huérfanas")}
        <div class="card-body">
          <ul class="list">
            <li>
              <span class="avatar">LM</span>
              <span class="l-main">
                <span class="l-title">Lucía Marín</span>
                <span class="l-sub">lucia@northwind.co</span>
              </span>
              <span class="tag tint-2">Pagado</span>
            </li>
            <li>
              <span class="avatar">DR</span>
              <span class="l-main">
                <span class="l-title">Diego Rivas</span>
                <span class="l-sub">diego@lumen.io</span>
              </span>
              <span class="tag tint-3">Pendiente</span>
            </li>
            <li>
              <span class="avatar">SN</span>
              <span class="l-main">
                <span class="l-title">Sara Núñez</span>
                <span class="l-sub">sara@vertex.es</span>
              </span>
              <span class="tag tint-4">Enviado</span>
            </li>
          </ul>
        </div>
      </article>
      <!--
        Table: el OrdersTable del panel de referencia. El resto de la ficha lo
        pinta el catálogo (.table, .chips, .table-foot dentro del <tfoot>); las clases de las
        celdas (cliente, acciones de fila) van al <style> del final.
      -->
      {#snippet tableFilters()}
        <div class="chips">
          {#each STATUS_OPTS as s (s.st)}
            <button
              type="button"
              class="chip"
              class:active={orderFilter === s.st}
              onclick={() => setOrderFilter(s.st)}>{s.label}</button
            >
          {/each}
        </div>
        <button class="btn hide-sm-btn"><i class="hgi-stroke hgi-filter"></i>Filtrar</button>
      {/snippet}
      <article class="card gallery-item col-span-2 table-card">
        {@render head(
          "Tabla",
          "Datos con filtro, orden y páginas. Ej.: la rejilla de una tabla",
          tableFilters,
        )}
        <div class="table-wrap">
          <table class="table table-striped">
            <thead>
              <tr>
                <th
                  class="sortable"
                  class:sorted={orderSort.key === "client"}
                  class:asc={orderSort.dir === "asc"}
                  aria-sort={orderSortAria("client")}
                  onclick={() => sortOrders("client")}
                >
                  Cliente<span class="arrow"></span>
                </th>
                <th>Pedido</th>
                <th
                  class="sortable"
                  class:sorted={orderSort.key === "date"}
                  class:asc={orderSort.dir === "asc"}
                  aria-sort={orderSortAria("date")}
                  onclick={() => sortOrders("date")}
                >
                  Fecha<span class="arrow"></span>
                </th>
                <th>Estado</th>
                <th
                  class="sortable"
                  class:sorted={orderSort.key === "amount"}
                  class:asc={orderSort.dir === "asc"}
                  aria-sort={orderSortAria("amount")}
                  style="text-align: right"
                  onclick={() => sortOrders("amount")}
                >
                  Importe<span class="arrow"></span>
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#if orderSlice.length}
                {#each orderSlice as o (o.id)}
                  <tr>
                    <td>
                      <div class="client">
                        <span class="avatar">{initials(o.n)}</span>
                        <span>
                          <div class="c-name">{o.n}</div>
                          <div class="c-mail">{o.m}</div>
                        </span>
                      </div>
                    </td>
                    <td class="number" style="color:var(--text-secondary)">{o.id}</td>
                    <td class="number" style="color:var(--text-secondary)">{fmtDate(o.ts)}</td>
                    <td><span class="tag {BADGE[o.st][0]}">{BADGE[o.st][1]}</span></td>
                    <td class="amt number">{fmtAmount(o.amount)}</td>
                    <td>
                      <div class="row-act">
                        <button class="mini-btn" aria-label="Ver"
                          ><i class="hgi-stroke hgi-eye"></i></button
                        >
                        <button class="mini-btn" aria-label="Editar"
                          ><i class="hgi-stroke hgi-pencil-edit-02"></i></button
                        >
                      </div>
                    </td>
                  </tr>
                {/each}
              {:else}
                <tr>
                  <td
                    colspan="6"
                    style="text-align:center;color:var(--text-muted);padding:2.375rem 0"
                    >Sin pedidos en este estado</td
                  >
                </tr>
              {/if}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="6">
                  <div class="table-foot">
                    <span class="pg-info">{orderPageInfo}</span>
                    <div class="pg">
                      <button
                        class="btn-icon sm"
                        aria-label="Página anterior"
                        disabled={orderSafePage <= 1}
                        onclick={() => orderPage--}
                      >
                        <i class="hgi-stroke hgi-arrow-left-01"></i>
                      </button>
                      <button
                        class="btn-icon sm"
                        aria-label="Página siguiente"
                        disabled={orderSafePage >= orderPages}
                        onclick={() => orderPage++}
                      >
                        <i class="hgi-stroke hgi-arrow-right-01"></i>
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </article>
      <!-- Timeline -->
      <article class="card gallery-item wide">
        {@render head("Cronología", "Eventos en orden. Ej.: los pasos de la IA")}
        <div class="card-body">
          <ol class="timeline">
            <li class="done">
              <span class="t-time"><b>09:14</b><span>Hoy</span></span>
              <div class="t-body">
                <span class="t-title">Pedido recibido</span>
                <span class="t-desc">Orden #AR-4821 · 3 artículos</span>
              </div>
            </li>
            <li class="done">
              <span class="t-time"><b>09:20</b><span>Hoy</span></span>
              <div class="t-body">
                <span class="t-title">Pago confirmado</span>
                <span class="t-desc">Visa ···4192 · 184,20 €</span>
              </div>
            </li>
            <li>
              <span class="t-time"><b>08:00</b><span>Mañana</span></span>
              <div class="t-body">
                <span class="t-title">Preparando envío</span>
                <span class="t-desc">Almacén de Madrid</span>
              </div>
            </li>
            <li>
              <span class="t-time"><b>—</b><span>Sin fecha</span></span>
              <div class="t-body">
                <span class="t-title">Entregado</span>
                <span class="t-desc">Se avisará al destinatario</span>
              </div>
            </li>
          </ol>
        </div>
      </article>
      <!-- Tag -->
      <article class="card gallery-item">
        {@render head("Etiqueta", "Categoría o estado. Ej.: una versión de solo lectura")}
        <div class="card-body">
          <div class="gallery-demo">
            <div class="gallery-row">
              <span class="tag tint-1">Tint-1</span>
              <span class="tag tint-2">Tint-2</span>
              <span class="tag tint-3">Tint-3</span>
              <span class="tag tint-4">Tint-4</span>
            </div>
            <div class="gallery-row">
              <span class="tag tag-success">
                <i class="hgi-stroke hgi-checkmark-circle-02"></i>Correcto
              </span>
              <span class="tag tag-warning"> <i class="hgi-stroke hgi-alert-02"></i>Aviso </span>
              <span class="tag tag-error"> <i class="hgi-stroke hgi-cancel-circle"></i>Error </span>
            </div>
            <div class="gallery-row">
              <span class="tag tint-1">
                Filtro
                <button
                  type="button"
                  class="tag-remove"
                  aria-label="Quitar Filtro"
                  data-tip="Quitar"
                >
                  <i class="hgi-stroke hgi-cancel-01"></i>
                </button>
              </span>
              <span class="tag">Along</span>
            </div>
          </div>
        </div>
      </article>
      <!-- Badge -->
      <article class="card gallery-item">
        {@render head("Distintivo", "Aviso sobre un elemento. Ej.: un archivo en el chat")}
        <div class="card-body">
          <div class="gallery-demo">
            <div class="gallery-row">
              <button class="btn badge-success" data-tip="Todo correcto">Sync</button>
              <button class="btn badge-warning" data-tip="Requiere atención">Warn</button>
              <button class="btn badge-error" data-tip="Con incidencias">Error</button>
            </div>
          </div>
        </div>
      </article>
      <!-- Button -->
      <article class="card gallery-item wide">
        {@render head("Botones", "Variantes, tamaños y estados")}
        <div class="card-body">
          <div class="gallery-demo">
            <div class="gallery-row">
              <button class="btn btn-primary">
                <i class="hgi-stroke hgi-checkmark-circle-02"></i>
                Guardar cambios
              </button>
              <button class="btn">
                Cancelar
                <i class="hgi-stroke hgi-arrow-right-01"></i>
              </button>
              <button class="btn" disabled>Deshabilitado</button>
            </div>
            <div class="gallery-row">
              <button class="btn btn-ghost">Sin fondo</button>
              <button class="btn btn-ghost" disabled>Deshabilitado</button>
            </div>
            <div class="gallery-row">
              <button class="btn btn-danger"
                ><i class="hgi-stroke hgi-delete-02"></i>Eliminar</button
              >
              <button class="btn btn-danger" disabled>Eliminar</button>
              <button class="btn btn-ghost btn-danger">Quitar del equipo</button>
            </div>
            <!--
              `btn-danger-quiet` no grita en reposo: se lee como cualquier otro
              botón de la fila y solo avisa cuando el cursor ya está encima, que
              es el instante en que importa. Para lo que sale de una barra o un pie.
            -->
            <div class="gallery-row">
              <button class="btn btn-danger-quiet">Cerrar sesión</button>
              <button class="btn-icon sm btn-danger-quiet" aria-label="Cerrar sesión">
                <i class="hgi-stroke hgi-logout-03"></i>
              </button>
            </div>
            <div class="gallery-row">
              <button class="btn-icon btn-rounded" aria-label="Más opciones">
                <i class="hgi hgi-stroke hgi-rounded hgi-settings-04"></i>
              </button>
              <button class="btn-icon btn-ghost btn-rounded" aria-label="Más opciones">
                <i class="hgi hgi-stroke hgi-rounded hgi-settings-04"></i>
              </button>
              <button class="btn-icon" aria-label="Más opciones">
                <i class="hgi hgi-stroke hgi-rounded hgi-settings-04"></i>
              </button>
              <button class="btn-icon btn-ghost" aria-label="Más opciones">
                <i class="hgi hgi-stroke hgi-rounded hgi-settings-04"></i>
              </button>
            </div>
            <div class="gallery-row">
              <button class="btn btn-primary is-loading" disabled aria-busy="true">
                <i class="hgi-stroke hgi-loading-03" aria-hidden="true"></i>Guardando…
              </button>
              <button class="btn is-loading" disabled aria-busy="true"
                ><i class="hgi-stroke hgi-loading-03" aria-hidden="true"></i>Procesando…</button
              >
              <button class="btn-icon is-loading" disabled aria-busy="true" aria-label="Cargando">
                <i class="hgi-stroke hgi-loading-03"></i>
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
            <a class="link" href="/"
              >Abrir en pestaña nueva<i class="hgi-stroke hgi-link-square-02"></i></a
            >
          </div>
        </div>
      </article>

      <!-- Planer -->
      <article class="card gallery-item wide">
        {@render head("Planer", "La cara del asistente. Ej.: la cabecera del chat")}
        <div class="card-body">
          <div class="gallery-demo">
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
    </div>
  </div>
  <div id="demo-graficas" class="gallery-group">
    <div class="gallery-group-head">
      <h3>Gráficas</h3>
      <p>Canvas de Chart.js pintados con los colores del sistema</p>
    </div>
    <div class="gallery-grid">
      <!-- Line -->
      {#snippet lineRanges()}
        <div class="chips">
          {#each RANGES as r (r.days)}
            <button
              type="button"
              class="chip"
              class:active={range === r.days}
              onclick={() => (range = r.days)}>{r.label}</button
            >
          {/each}
        </div>
      {/snippet}
      <article class="card gallery-item wide col-span-2">
        {@render head(
          "Gráfica de líneas",
          "Dos series y el periodo anterior. En páginas generadas",
          lineRanges,
        )}
        <div class="card-body">
          <div class="chart-figure"><canvas bind:this={main}></canvas></div>
          <div class="legend">
            <span class="legend-item">
              <i class="swatch" style="background: var(--chart-1)"></i>Ingresos
              <b class="number">$184.320</b>
            </span>
            <span class="legend-item">
              <i class="swatch" style="background: var(--chart-2)"></i>Sesiones
              <b class="number">96.480</b>
            </span>
            <span class="legend-item">
              <i class="swatch" style="background: var(--text-muted); opacity: 0.5"></i>Periodo
              anterior
            </span>
          </div>
        </div>
      </article>
      <!-- Donut -->
      <article class="card gallery-item">
        {@render head(
          "Gráfica de anillo",
          "Reparto con el total en el centro. En páginas generadas",
        )}
        <div class="card-body">
          <div class="donut-wrap">
            <canvas bind:this={donut}></canvas>
            <div class="donut-center">
              <b class="number">96,4 K</b>
              <span>sesiones totales</span>
            </div>
          </div>
          <div class="dist-list">
            {#each CHANNELS as c (c.name)}
              <div class="dist">
                <i class="swatch" style="background: var({c.c})"></i>
                <span class="dist-name">{c.name}</span>
                <span class="dist-val number">{c.val.toLocaleString("es-CO")}</span>
                <span class="dist-pct number">{((c.val / channelsTotal) * 100).toFixed(1)} %</span>
              </div>
            {/each}
          </div>
        </div>
      </article>
      <!-- Bar -->
      <article class="card gallery-item col-span-2">
        {@render head("Gráfica de barras", "Una barra por categoría. En páginas generadas")}
        <div class="card-body">
          <div class="bar-figure"><canvas bind:this={category}></canvas></div>
        </div>
      </article>
      <!-- KPI -->
      <article class="card gallery-item wide col-span-2">
        {@render head("Indicador", "Cifra con tendencia y minigráfica. En páginas generadas")}
        <div class="card-body">
          <div class="kpis">
            {#each KPIS as k, i (k.label)}
              <article class="card kpi">
                <div class="kpi-head">
                  <span class="kpi-ico"><i class="hgi-stroke {k.ico}"></i></span>
                  <span class="kpi-label">{k.label}</span>
                </div>
                <div>
                  <div class="kpi-row">
                    <span class="kpi-val number">{k.val}</span>
                    <span class="tag {k.up ? 'tag-success' : 'tag-error'}">
                      <i class="hgi-stroke hgi-arrow-{k.up ? 'up' : 'down'}-right-01"></i>{k.d}
                    </span>
                  </div>
                  <div class="kpi-foot number">{k.foot}</div>
                </div>
                <div class="spark"><canvas bind:this={kpiSparks[i]}></canvas></div>
              </article>
            {/each}
          </div>
        </div>
      </article>
      <!-- Sparkline -->
      <article class="card gallery-item">
        {@render head("Minigráfica", "La tendencia debajo de una cifra. En páginas generadas")}
        <div class="card-body">
          <div class="stat">
            <span class="s-label">Ingresos netos</span>
            <span class="s-val number"
              >$184.320 <span class="tag tag-success"
                ><i class="hgi-stroke hgi-arrow-up-right-01"></i>12.4 %</span
              ></span
            >
            <span class="s-foot">vs. $163.980 del periodo anterior</span>
          </div>
          <div class="spark"><canvas bind:this={spark}></canvas></div>
        </div>
      </article>
    </div>
  </div>
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
        {@render head(
          "Área de texto",
          "Texto largo en varias líneas. Ej.: pegar un CSV al importar",
        )}
        <div class="card-body">
          <div class="field">
            <label for="demoTextarea">Nota interna</label>
            <textarea id="demoTextarea" rows="3" placeholder="Contexto para el equipo de soporte…"
            ></textarea>
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
            <span class="field-label">Importe máximo<b class="range-val">$1.200</b></span>
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
              <label for="demoRate5" data-tip="5 estrellas"
                ><i class="hgi-stroke hgi-star"></i></label
              >
              <input type="radio" name="demoRate" id="demoRate4" checked />
              <label for="demoRate4" data-tip="4 estrellas"
                ><i class="hgi-stroke hgi-star"></i></label
              >
              <input type="radio" name="demoRate" id="demoRate3" />
              <label for="demoRate3" data-tip="3 estrellas"
                ><i class="hgi-stroke hgi-star"></i></label
              >
              <input type="radio" name="demoRate" id="demoRate2" />
              <label for="demoRate2" data-tip="2 estrellas"
                ><i class="hgi-stroke hgi-star"></i></label
              >
              <input type="radio" name="demoRate" id="demoRate1" />
              <label for="demoRate1" data-tip="1 estrellas"
                ><i class="hgi-stroke hgi-star"></i></label
              >
            </div>
            <span style="font-size: 0.71875rem; color: var(--text-muted)">4 de 5 · 128 reseñas</span
            >
          </div>
        </div>
      </article>
      <!-- Opciones -->
      <article class="card gallery-item wide col-span-2">
        {@render head("Opciones", "Tarjetas de selección. Ej.: el tipo de una columna")}
        <div class="card-body">
          <div class="gallery-demo">
            <p class="demo-note">
              Cada tarjeta lleva su nombre y una línea que lo explica, y se tiñe al elegirla. <code
                >opt-row</code
              > es la misma caja sin nada que elegir, con su mando a la derecha.
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
            <p class="demo-note">
              Acepta el archivo arrastrado encima, o abre el explorador al pulsarla. <code
                >loaded</code
              >
              cuando se ha leído, <code>rejected</code> cuando no sirve; el motivo lo da el aviso de al
              lado.
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
              <span
                ><strong>Sincronización programada</strong>Los datos se actualizarán esta noche a
                las 03:00.</span
              >
            </div>
            <div class="alert ok" role="status">
              <i class="hgi-stroke hgi-checkmark-circle-02"></i>
              <span><strong>Todo correcto</strong>El informe se exportó sin incidencias.</span>
            </div>
            <div class="alert warn" role="status">
              <i class="hgi-stroke hgi-alert-02"></i>
              <span><strong>Cuota al 74 %</strong>Quedan 258 K eventos en el plan de este mes.</span
              >
            </div>
            <div class="alert danger" role="alert">
              <i class="hgi-stroke hgi-cancel-circle"></i>
              <span><strong>Pago rechazado</strong>Revisa el método de pago del cliente.</span>
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
              <span class="t-text"
                ><span>Cambios guardados</span><span class="t-sub"
                  >El informe se actualizó correctamente.</span
                ></span
              >
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
              <span class="t-text"
                ><span>Sincronización en curso</span><span class="t-sub"
                  >Terminará en menos de un minuto.</span
                ></span
              >
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
              <span class="t-text"
                ><span>Cuota casi agotada</span><span class="t-sub"
                  >Quedan 258 K eventos este mes.</span
                ></span
              >
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
              <span class="t-text"
                ><span>No se pudo exportar</span><span class="t-sub"
                  >Revisa la conexión e inténtalo de nuevo.</span
                ></span
              >
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
                  Se devolverá el importe al método de pago original. La acción no se puede
                  deshacer.
                </p>
              </div>
              <div class="modal-foot">
                <button class="btn" popovertarget="demoModal" popovertargetaction="hide"
                  >Volver</button
                >
                <button class="btn btn-primary" popovertarget="demoModal" popovertargetaction="hide"
                  >Cancelar pedido</button
                >
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
                    <span class="t-time"><b>09:14</b><span>12 mar</span></span>
                    <div class="t-body">
                      <span class="t-title">Pedido creado</span>
                      <span class="t-desc">Orden #AR-4821 · 3 artículos</span>
                    </div>
                  </li>
                  <li class="done">
                    <span class="t-time"><b>09:16</b><span>12 mar</span></span>
                    <div class="t-body">
                      <span class="t-title">Pago confirmado</span>
                      <span class="t-desc">Visa ···4192 · 184,20 €</span>
                    </div>
                  </li>
                  <li class="done">
                    <span class="t-time"><b>15:02</b><span>12 mar</span></span>
                    <div class="t-body">
                      <span class="t-title">Preparando el envío</span>
                      <span class="t-desc">Almacén de Madrid</span>
                    </div>
                  </li>
                  <li class="done">
                    <span class="t-time"><b>08:40</b><span>13 mar</span></span>
                    <div class="t-body">
                      <span class="t-title">Entregado al transportista</span>
                      <span class="t-desc">SEUR · guía 884-201-77</span>
                    </div>
                  </li>
                  <li class="done">
                    <span class="t-time"><b>07:25</b><span>14 mar</span></span>
                    <div class="t-body">
                      <span class="t-title">En reparto</span>
                      <span class="t-desc">Vehículo 14 · ruta centro</span>
                    </div>
                  </li>
                  <li class="done">
                    <span class="t-time"><b>12:10</b><span>14 mar</span></span>
                    <div class="t-body">
                      <span class="t-title">Primer intento fallido</span>
                      <span class="t-desc">Nadie en el domicilio</span>
                    </div>
                  </li>
                  <li class="done">
                    <span class="t-time"><b>09:05</b><span>15 mar</span></span>
                    <div class="t-body">
                      <span class="t-title">Segundo reparto</span>
                      <span class="t-desc">Reprogramado por el cliente</span>
                    </div>
                  </li>
                  <li class="done">
                    <span class="t-time"><b>11:48</b><span>15 mar</span></span>
                    <div class="t-body">
                      <span class="t-title">Entregado</span>
                      <span class="t-desc">Firmado por E. Vargas</span>
                    </div>
                  </li>
                  <li>
                    <span class="t-time"><b>16:30</b><span>18 mar</span></span>
                    <div class="t-body">
                      <span class="t-title">Devolución solicitada</span>
                      <span class="t-desc">Motivo: talla incorrecta</span>
                    </div>
                  </li>
                  <li>
                    <span class="t-time"><b>10:02</b><span>19 mar</span></span>
                    <div class="t-body">
                      <span class="t-title">Reembolso emitido</span>
                      <span class="t-desc">184,20 € al método original</span>
                    </div>
                  </li>
                </ol>
              </div>
              <div class="modal-foot">
                <button class="btn" popovertarget="demoModalLg" popovertargetaction="hide"
                  >Cerrar</button
                >
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
              <button class="btn" popovertarget="demoDrawerL"
                ><i class="hgi-stroke hgi-sidebar-left"></i>Izquierda</button
              >
              <button class="btn" popovertarget="demoDrawerR"
                ><i class="hgi-stroke hgi-sidebar-right"></i>Derecha</button
              >
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
                <button class="btn" popovertarget="demoDrawerL" popovertargetaction="hide"
                  >Limpiar</button
                >
                <button
                  class="btn btn-primary"
                  popovertarget="demoDrawerL"
                  popovertargetaction="hide">Aplicar</button
                >
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
                  El panel llena el alto de la ventana y el scroll vive en el cuerpo, igual que en
                  el modal.
                </p>
                <ol class="timeline">
                  <li class="done">
                    <span class="t-time"><b>09:14</b><span>12 mar</span></span>
                    <div class="t-body">
                      <span class="t-title">Pedido creado</span>
                      <span class="t-desc">3 artículos · 184,20 €</span>
                    </div>
                  </li>
                  <li class="done">
                    <span class="t-time"><b>09:16</b><span>12 mar</span></span>
                    <div class="t-body">
                      <span class="t-title">Pago confirmado</span>
                      <span class="t-desc">Visa ···4192</span>
                    </div>
                  </li>
                  <li class="done">
                    <span class="t-time"><b>08:40</b><span>13 mar</span></span>
                    <div class="t-body">
                      <span class="t-title">En reparto</span>
                      <span class="t-desc">SEUR · guía 884-201-77</span>
                    </div>
                  </li>
                  <li>
                    <span class="t-time"><b>—</b><span>Previsto</span></span>
                    <div class="t-body">
                      <span class="t-title">Entrega</span>
                      <span class="t-desc">14 de marzo, mañana</span>
                    </div>
                  </li>
                </ol>
              </div>
              <div class="modal-foot">
                <button class="btn" popovertarget="demoDrawerR" popovertargetaction="hide"
                  >Cerrar</button
                >
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
              <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
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
              <span>Eventos del plan</span><span class="number">74 %</span>
            </div>
            <progress class="progress" max="100" value="74"></progress>
            <div class="progress-label">
              <span>Almacenamiento</span><span class="number">31 %</span>
            </div>
            <progress class="progress" max="100" value="31"></progress>
          </div>
        </div>
      </article>
    </div>
  </div>

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

<style>
  /*
   * Galeria de componentes: solo disposicion. Las piezas que muestra se
   * pintan solas con lo que define `styles/components.css`.
   */
  .gallery {
    display: flex;
    flex-direction: column;
    gap: var(--card-gap);
  }

  .gallery-group {
    scroll-margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: var(--sp-14);
    margin-bottom: 2rem;

    & .gallery-group-head {
      padding: var(--sp-20) 0;
      border-radius: var(--radius-lg);

      & h3 {
        margin: 0;
        font-size: var(--text-md);
        font-weight: 800;
      }

      & p {
        margin: 0.125rem 0 0;
        font-size: var(--text-sm);
        color: var(--text-muted);
      }
    }
  }

  /* `dense` rellena los huecos que dejan las fichas de doble ancho */
  .gallery-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-flow: dense;
    gap: var(--card-gap);
    align-items: start;
  }

  /* La superficie la pone `.card`; aqui solo la disposicion interna. El aire
     interno viene de los paddings de `card-head` y `card-body`. */
  .gallery-item {
    min-width: 0;
    height: 100%;

    &.wide {
      @media (max-width: 43.75rem) {
        grid-column: span 1;
      }
    }
  }

  /* Masonry por script: con la clase que pone el efecto, el grid deja de
     posicionar; las fichas van absolutas y el script reparte, mide y fija el
     alto del contenedor. La clase va por `:global` porque solo existe en
     marcha. Sin script manda el grid de arriba. */
  .gallery-grid:global(.masonry) {
    position: relative;
    display: block;
  }

  .gallery-grid:global(.masonry) .gallery-item {
    position: absolute;
    top: 0;
    left: 0;
    /* El `100%` de arriba emparejaria las fichas con el alto del contenedor. */
    height: auto;
  }

  .gallery-demo {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: calc(var(--spacing) * 6);
  }

  .gallery-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-16);
  }

  /* Una linea de por que existe la pieza, cuando el nombre no basta. Va en
     las fichas de lo que este repo anadio al catalogo. */
  .demo-note {
    margin: 0;
    font-size: var(--text-xs);
    line-height: 1.5;
    color: var(--text-muted);
  }

  /* Dentro de un `.inset.plain` el cerco ya lo pone la caja: la lista de
     dentro solo aporta las lineas que separan una fila de la siguiente. */
  .demo-inset-list {
    border: 0;
    border-radius: 0;
  }

  /* Las tres opciones a lo ancho mientras quepan; en estrecho se apilan. */
  .demo-opt-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: var(--sp-8);
  }

  /* Las muestras de color no llevan texto: se les da medida a mano. */
  .demo-dropzones {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: var(--sp-12);
  }

  /* Cards a la par: se estiran a la misma altura para que se vea que los pies
     quedan alineados solos. */
  .gallery-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12.5rem, 1fr));
    gap: var(--sp-12);
  }

  /* La muestra de la escala tipografica, con su medida al lado. */
  .type-scale {
    display: flex;
    flex-direction: column;

    & .ty-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) max-content;
      align-items: baseline;
      gap: var(--sp-14);
      padding: var(--sp-12) 0;
      border-bottom: var(--border-width) solid var(--border);

      &:first-child {
        padding-top: 0;
      }

      &:last-child {
        padding-bottom: 0;
        border-bottom: 0;
      }
    }

    & .ty-sample {
      margin: 0;
      min-width: 0;
    }

    & .ty-meta {
      flex: none;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.125rem;
      text-align: right;
      font-size: var(--text-xs);
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--text-muted);

      & b {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        font-weight: 500;
        letter-spacing: 0;
        text-transform: none;
        color: var(--text-secondary);
      }
    }
  }

  /* ==========================================================
     Gráficas: la disposición de las figuras, de la hoja de aplicación de
     origen. Chart.js redimensiona el canvas por atributo, así que el alto lo
     fija la figura y el ancho lo manda el CSS.
     ========================================================== */
  .chart-figure {
    height: 16rem;
    padding: var(--sp-10) 0 var(--sp-4);
  }

  .bar-figure {
    height: 14rem;
    padding: var(--sp-10) var(--sp-8) var(--sp-6);
  }

  .chart-figure canvas,
  .bar-figure canvas {
    width: 100% !important;
  }

  /* Leyenda de una gráfica: cuadro de color + texto. Es del catálogo de
     origen; el de aquí no la trae. */
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-18);
    padding-top: var(--sp-12);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.4375rem;
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--text-secondary);

    & b {
      color: var(--text-primary);
      font-weight: 700;
    }
  }

  .swatch {
    width: 0.5625rem;
    height: 0.5625rem;
    flex: none;
    border-radius: 0.1875rem;
  }

  /* Donut: el total va en el centro del agujero */
  .donut-wrap {
    position: relative;
    height: 12rem;
    padding: var(--sp-8) var(--sp-6) 0;

    & .donut-center {
      position: absolute;
      /* Mismo recuadro que el canvas, menos su acolchado */
      inset: var(--sp-8) var(--sp-6) 0;
      display: grid;
      place-content: center;
      text-align: center;
      /* No debe robarle el hover a los segmentos */
      pointer-events: none;

      & b {
        display: block;
        font-size: var(--text-xl);
        font-weight: 800;
        letter-spacing: -0.025em;
      }

      & span {
        font-size: var(--text-xs);
        font-weight: 600;
        color: var(--text-muted);
      }
    }
  }

  /* Reparto por canal: la leyenda con cifras del donut */
  .dist-list {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding-top: var(--sp-12);

    & .dist {
      display: flex;
      align-items: center;
      gap: var(--sp-10);
      padding: var(--sp-8);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      transition: background 0.15s;

      &:hover {
        background: var(--bg-field);
      }
    }

    & .dist-name {
      font-weight: 600;
    }

    & .dist-val {
      margin-left: auto;
      font-weight: 700;
    }

    & .dist-pct {
      width: 2.75rem;
      text-align: right;
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--text-muted);
    }
  }

  /* La sparkline se sale del acolchado del cuerpo para tocar los bordes de la
     card, como en el panel de origen. */
  .spark {
    height: 2.75rem;
    margin: var(--sp-12) calc(var(--sp-20) * -1) calc(var(--sp-18) * -1);
  }

  /* ==========================================================
     Tabla de pedidos: solo lo que ocurre dentro de las celdas, de la
     hoja de aplicación de origen (`css/styles.css`); la cabecera, la
     cebra y el pie los pinta el catálogo.
     ========================================================== */
  .client {
    display: flex;
    align-items: center;
    gap: var(--sp-11);
  }

  .c-name {
    font-weight: 600;
    line-height: 1.45;
  }

  .c-mail {
    margin-top: 0.0625rem;
    font-size: var(--text-xs);
    line-height: 1.6;
    color: var(--text-muted);
  }

  .amt {
    text-align: right;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  /* Las acciones de fila solo aparecen sobre la fila apuntada */
  .row-act {
    display: flex;
    justify-content: flex-end;
    gap: var(--sp-4);
    opacity: 0;
    transition: opacity 0.15s;
  }

  tbody tr:hover .row-act {
    opacity: 1;
  }

  /* Acciones que se pueden dejar fuera cuando no hay sitio */
  @media (max-width: 38.75rem) {
    .hide-sm-btn {
      display: none;
    }
  }

  /* ---- El modal con el codigo de la ficha ---- */

  /* El boton no se encoge aunque los mandos de al lado pidan sitio, y se
     apaga hasta que se apunta la ficha: mira, no manda. */
  .btn-show-code {
    flex: none;
    color: var(--text-muted);
  }

  .card:hover .btn-show-code,
  .btn-show-code:focus-visible {
    color: var(--text-secondary);
  }

  /* El editor no tiene medida propia: la pone el hueco. El alto sale de la
     ventana --`--modal-h` es `fit-content`-- para que la tarjeta se pare antes
     de llegar al borde, y la esquina redonda pide recortar lo de dentro. */
  .code-box {
    height: min(60vh, 30rem);
    /* Sin relleno: el editor pinta su propio fondo hasta el cerco. */
    padding: 0;
    overflow: hidden;
  }
</style>
