<!--
  Datos: lo que enseña filas --la tabla de pedidos, las listas, la cronología
  y el paginado que las recorre--.

  La ficha Tabla es el OrdersTable del panel de referencia, con su filtro, su
  orden y su paginación de verdad: los datos en `./orders.ts` y el script aquí
  abajo. Lo que ocurre dentro de sus celdas --el cliente con su avatar, las
  acciones que solo asoman sobre la fila apuntada-- va al <style> del final,
  traído de la hoja de aplicación de origen; la cabecera, la cebra y el pie los
  pinta el catálogo.

  Uno de los grupos de la galería; la cabecera de cada ficha y el modal con su
  código los pone `DemoGallery.svelte`, que es quien los compone. Lo que se ve
  aquí no lo pinta este archivo sino `styles/components.css`, igual que en el
  resto del panel.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  import type { DemoOrder, OrderStatus } from "./orders.ts";
  import { BADGE, fmtAmount, fmtDate, initials, ORDERS } from "./orders.ts";

  let { head }: { head: Snippet<[string, string, Snippet?]> } = $props();

  /* ---- La ficha Tabla: el OrdersTable del panel de referencia ---- */

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

  /* ---- La ficha Paginación, que no tiene nada que ver con la tabla ---- */
  let page = $state(1);
</script>

<div id="demo-datos" class="gallery-group">
  <div class="gallery-group-head">
    <h2>Datos</h2>
    <p>Tablas, listas y paginación</p>
  </div>
  <div class="gallery-grid">
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
