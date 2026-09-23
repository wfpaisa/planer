<!--
  Contenido: lo que enseña datos --tarjetas, listas, la tabla de pedidos, la
  escala tipográfica, avatares, chips y etiquetas--.

  La ficha Table es el OrdersTable del panel de referencia, con su filtro, su
  orden y su paginación de verdad: los datos en `./orders.ts` y el script aquí
  abajo. Lo que ocurre dentro de sus celdas --el cliente con su avatar, las
  acciones que solo asoman sobre la fila apuntada-- va al <style> del final,
  traído de la hoja de aplicación de origen; la cabecera, la cebra y el pie los
  pinta el catálogo.

  Una de las cinco secciones de la galería; la cabecera de cada ficha y el modal
  con su código los pone `DemoGallery.svelte`, que es quien las compone.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  import PlanerAvatar from "../PlanerAvatar.svelte";
  import type { DemoOrder, OrderStatus } from "./orders.ts";
  import { BADGE, fmtAmount, fmtDate, initials, ORDERS } from "./orders.ts";

  let { head }: { head: Snippet<[string, string, Snippet?]> } = $props();

  /* ---- La ficha Table: el OrdersTable del panel de referencia ---- */

  type OrderFilter = "all" | OrderStatus;
  type OrderSortKey = "client" | "date" | "amount";

  const STATUS_OPTS: { st: OrderFilter; label: string }[] = [
    { st: "all", label: "Todos" },
    { st: "ok", label: "Pagados" },
    { st: "wait", label: "Pendientes" },
    { st: "fail", label: "Fallidos" },
  ];

  let tagVisible = $state(true);

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
</script>

<div id="demo-contenido" class="gallery-group">
  <div class="gallery-group-head">
    <h2>Contenido</h2>
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
    <!-- Stat -->
    <article class="card gallery-item">
      {@render head("Estadística", "Un número con su etiqueta. En páginas generadas")}
      <div class="card-body">
        <div class="gallery-demo">
          <div class="stat">
            <span class="s-label">Ingresos netos</span>
            <span class="s-val number">
              $184.320 <span class="tag tag-success">
                <i class="hgi-stroke hgi-arrow-up-right-01"></i>
                12,4 %
              </span>
            </span>
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
            aria-pressed={orderFilter === s.st}
            onclick={() => setOrderFilter(s.st)}
          >
            {s.label}
          </button>
        {/each}
      </div>
    {/snippet}
    <article class="card gallery-item col-span-2 table-card">
      {@render head(
        "Tabla",
        "Datos con filtro, orden y páginas. Ej.: la rejilla de una tabla",
        tableFilters,
      )}
      <div class="table-wrap">
        <table class="table table-striped" aria-label="Pedidos de ejemplo">
          <thead>
            <tr>
              <th
                class="sortable"
                class:sorted={orderSort.key === "client"}
                class:asc={orderSort.dir === "asc"}
                aria-sort={orderSortAria("client")}
              >
                <button class="btn-demo-sort" type="button" onclick={() => sortOrders("client")}>
                  Cliente
                  <span class="arrow" aria-hidden="true"></span>
                </button>
              </th>
              <th>Pedido</th>
              <th
                class="sortable"
                class:sorted={orderSort.key === "date"}
                class:asc={orderSort.dir === "asc"}
                aria-sort={orderSortAria("date")}
              >
                <button class="btn-demo-sort" type="button" onclick={() => sortOrders("date")}>
                  Fecha
                  <span class="arrow" aria-hidden="true"></span>
                </button>
              </th>
              <th>Estado</th>
              <th
                class="sortable"
                class:sorted={orderSort.key === "amount"}
                class:asc={orderSort.dir === "asc"}
                aria-sort={orderSortAria("amount")}
                style="text-align: right"
              >
                <button class="btn-demo-sort" type="button" onclick={() => sortOrders("amount")}>
                  Importe
                  <span class="arrow" aria-hidden="true"></span>
                </button>
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
                      <button class="mini-btn" aria-label="Ver">
                        <i class="hgi-stroke hgi-eye"></i>
                      </button>
                      <button class="mini-btn" aria-label="Editar">
                        <i class="hgi-stroke hgi-pencil-edit-02"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            {:else}
              <tr>
                <td
                  colspan="6"
                  style="text-align:center;color:var(--text-muted);padding:2.375rem 0"
                >
                  Sin pedidos en este estado
                </td>
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
            <span class="t-time">
              <b>09:14</b>
              <span>Hoy</span>
            </span>
            <div class="t-body">
              <span class="t-title">Pedido recibido</span>
              <span class="t-desc">Orden #AR-4821 · 3 artículos</span>
            </div>
          </li>
          <li class="done">
            <span class="t-time">
              <b>09:20</b>
              <span>Hoy</span>
            </span>
            <div class="t-body">
              <span class="t-title">Pago confirmado</span>
              <span class="t-desc">Visa ···4192 · 184,20 €</span>
            </div>
          </li>
          <li>
            <span class="t-time">
              <b>08:00</b>
              <span>Mañana</span>
            </span>
            <div class="t-body">
              <span class="t-title">Preparando envío</span>
              <span class="t-desc">Almacén de Madrid</span>
            </div>
          </li>
          <li>
            <span class="t-time">
              <b>—</b>
              <span>Sin fecha</span>
            </span>
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
              <i class="hgi-stroke hgi-checkmark-circle-02"></i>
              Correcto
            </span>
            <span class="tag tag-warning">
              <i class="hgi-stroke hgi-alert-02"></i>
              Aviso
            </span>
            <span class="tag tag-error">
              <i class="hgi-stroke hgi-cancel-circle"></i>
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
                  <i class="hgi-stroke hgi-cancel-01"></i>
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
    <!-- Button -->
    <article class="card gallery-item wide">
      {@render head("Botones", "Variantes, tamaños y estados")}
      <div class="card-body">
        <div class="gallery-demo">
          <p class="demo-variant-label">Principal, secundario y deshabilitado</p>
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
          <p class="demo-variant-label">Sin fondo</p>
          <div class="gallery-row">
            <button class="btn btn-ghost">Sin fondo</button>
            <button class="btn btn-ghost" disabled>Deshabilitado</button>
          </div>
          <p class="demo-variant-label">Acciones destructivas</p>
          <div class="gallery-row">
            <button class="btn btn-danger">
              <i class="hgi-stroke hgi-delete-02"></i>
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
              <i class="hgi-stroke hgi-logout-03"></i>
            </button>
          </div>
          <p class="demo-variant-label">Solo icono</p>
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
          <p class="demo-variant-label">Durante una operación</p>
          <div class="gallery-row">
            <button class="btn btn-primary is-loading" disabled aria-busy="true">
              <i class="hgi-stroke hgi-loading-03" aria-hidden="true"></i>
              Guardando…
            </button>
            <button class="btn is-loading" disabled aria-busy="true">
              <i class="hgi-stroke hgi-loading-03" aria-hidden="true"></i>
              Procesando…
            </button>
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
  </div>
</div>

<style>
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

  tbody tr {
    &:hover .row-act,
    &:focus-within .row-act {
      opacity: 1;
    }
  }

  .btn-demo-sort {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-8);
    font: inherit;
    color: inherit;
    text-transform: inherit;
    cursor: pointer;

    &:focus-visible {
      outline: var(--border-width) solid var(--accent);
      outline-offset: var(--sp-4);
    }
  }

  @media (hover: none) {
    .row-act {
      opacity: 1;
    }
  }
</style>
