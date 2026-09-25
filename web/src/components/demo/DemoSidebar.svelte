<!--
  La sidebar de la demo: la del panel de referencia (`components/Sidebar.svelte`
  en `/home/projects/ia/dashboard`), entera y de verdad, no una ficha más de la
  galería.

  Es una sidebar real de esta página. El menú lleva a los grupos de la galería
  y marca en cuál se está mientras se baja; el sol y la luna cambian el tema del
  panel; el pie es quien ha entrado, con su salida; y "Ajustes" e "Inicio" son
  las rutas de siempre. Lo que allá era decorado con cifras inventadas aquí es
  lo que hay: el contador de cada sección son sus fichas, contadas del DOM.

  El cubo de pintura hace lo mismo que allá: abre el panel de personalizar. Pero
  solo con la paleta --sin tipografía, radios ni sombras-- y con el
  `PalettePicker` de verdad, el mismo de los ajustes de una aplicación. Se abre
  como popover manual y sin fondo oscuro, porque hay que ver la demo
  recolorearse mientras se elige; el contenido cede el sitio en vez de quedar
  tapado, y de eso se entera la página por `onDrawer`.

  Los estilos son los de la hoja de aplicación de origen (`src/css/styles.css`),
  tal cual: el catálogo de aquí no trae sidebar.
-->
<script lang="ts">
  import type { AppTheme } from "@shared/types";

  import { cx } from "../../lib/cx";
  import { link } from "../../lib/router.svelte";
  import { type Builder, session } from "../../lib/session.svelte";
  import Logo from "../Logo.svelte";
  import PalettePicker from "../PalettePicker.svelte";
  import ThemePicker from "../ThemePicker.svelte";

  let {
    palette,
    onPalette,
    onDrawer,
  }: {
    /** La paleta con la que se está mirando la demo. */
    palette: AppTheme;
    onPalette: (next: AppTheme) => void;
    /** Abierto o cerrado el panel de la paleta, para que la página ceda el sitio. */
    onDrawer?: (open: boolean) => void;
  } = $props();

  /* ---- Secciones: los ids los ponen `routes/Demo.svelte` y `DemoGallery.svelte` ---- */
  const TOP = "demo-main";
  const CATALOG = [
    { id: "demo-formulario", label: "Formulario", icon: "note-edit" },
    { id: "demo-datos", label: "Datos", icon: "table-01" },
    { id: "demo-graficas", label: "Gráficas", icon: "analytics-up", isSafe: true },
    { id: "demo-panel", label: "Panel", icon: "layout-01" },
    { id: "demo-superposicion", label: "Superposición", icon: "layers-01" },
    { id: "demo-archivo", label: "Archivo", icon: "file-upload" },
    { id: "demo-menu", label: "Menú", icon: "menu-01" },
    { id: "demo-mensajes", label: "Mensajes", icon: "message-01" },
    { id: "demo-varios", label: "Varios", icon: "grid-view" },
  ] as const;

  let active = $state<string>(TOP);

  // Cuántas fichas tiene cada grupo, leído del DOM una vez montado todo.
  let counts = $state<Record<string, number>>({});
  $effect(() => {
    const next: Record<string, number> = {};
    for (const s of CATALOG) {
      next[s.id] = document.querySelectorAll(`#${s.id} .gallery-item`).length;
    }
    counts = next;
  });

  // La sección activa es la última cuyo borde superior ya pasó la línea de
  // lectura. Hace scroll la ventana, así que se escucha ahí.
  $effect(() => {
    const ids = [TOP, ...CATALOG.map((s) => s.id)];
    const update = () => {
      let current = TOP;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) current = id;
      }
      active = current;
    };
    update();
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    return () => {
      removeEventListener("scroll", update);
      removeEventListener("resize", update);
    };
  });

  const goTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* ---- Panel de la paleta ---- */
  let drawer = $state<HTMLElement | null>(null);
  let drawerOpen = $state(false);

  const toggleDrawer = () => {
    if (!drawer) return;
    if (drawer.matches(":popover-open")) drawer.hidePopover();
    else drawer.showPopover();
  };

  const onToggle = (e: ToggleEvent) => {
    drawerOpen = e.newState === "open";
    onDrawer?.(drawerOpen);
  };

  /* ---- Quién ha entrado ---- */
  /*
   * A la demo se entra sin sesión --ver las rutas en `App.svelte`--, asi que
   * cuando no hay nadie dentro el pie ensena una cuenta de ejemplo, como el
   * resto de la galeria. Si quien mira ha entrado de verdad sale lo suyo, y
   * con su salida: el pie es el componente de siempre, no una ficha.
   */
  const EJEMPLO: Pick<Builder, "name" | "email"> = {
    name: "Elena Vargas",
    email: "elena.vargas@empresa.com",
  };
  const dentro = $derived(!!session.me);
  const me = $derived(session.me ?? EJEMPLO);
  const displayName = $derived(me.name || me.email);
  const initials = $derived.by(() => {
    const parts = displayName.split(/[\s@.]+/).filter(Boolean);
    return (
      parts
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("") || "?"
    );
  });
</script>

<aside id="demo-sidebar" class="sidebar-demo sidebar" aria-label="Menú de la demo">
  <div class="brand">
    <Logo id="demo-brand-logo" class="brand-logo-demo" height="1.5rem" />
    <div class="brand-actions">
      <button
        type="button"
        class={cx("btn-open-palette", "btn-icon sm", drawerOpen && "active")}
        aria-label="Elegir paleta"
        aria-pressed={drawerOpen}
        data-tip="Elegir paleta"
        onclick={toggleDrawer}
      >
        <i class="icon icon-paint-bucket"></i>
      </button>
      <ThemePicker class="btn-toggle-theme" />
    </div>
  </div>

  <nav class="nav-demo nav" aria-label="Secciones de la demo">
    <p class="nav-label eyebrow">Cuenta</p>
    <a class="nav-item" href="/" use:link data-tip="Inicio">
      <i class="icon icon-home-01"></i>
      <span>Inicio</span>
    </a>
    <a class="nav-item" href="/ajustes" use:link data-tip="Ajustes">
      <i class="icon icon-settings-04"></i>
      <span>Ajustes</span>
    </a>

    <p class="nav-label eyebrow">General</p>
    <button
      type="button"
      class={cx("nav-item", active === TOP && "active")}
      aria-current={active === TOP ? "true" : undefined}
      data-tip="Resumen"
      onclick={() => goTo(TOP)}
    >
      <i class="icon icon-dashboard-square-01"></i>
      <span>Resumen</span>
      <i class="icon icon-home-01 nav-end"></i>
    </button>

    <p class="nav-label eyebrow">Catálogo</p>
    {#each CATALOG as s (s.id)}
      <button
        type="button"
        class={cx("nav-item", active === s.id && "active")}
        aria-current={active === s.id ? "true" : undefined}
        data-tip={s.label}
        onclick={() => goTo(s.id)}
      >
        <i class="icon icon-{s.icon}"></i>
        <span>{s.label}</span>

        <span class="nav-badge">{counts[s.id] ?? 0}</span>
        {#if "isSafe" in s && s.isSafe}
          <i class="icon icon-security nav-end"></i>
        {/if}
      </button>
    {/each}
  </nav>

  <div class="side-foot">
    <span class="avatar">{initials}</span>
    <div class="user-meta identity">
      <strong>{displayName}</strong>
      {#if me.email && me.email !== displayName}
        <span>{me.email}</span>
      {/if}
    </div>
    {#if dentro}
      <button
        type="button"
        class="btn-sign-out btn-icon sm btn-danger-quiet"
        aria-label="Cerrar sesión"
        data-tip="Cerrar sesión"
        onclick={() => session.signOut()}
      >
        <i class="icon icon-logout-03"></i>
      </button>
    {:else}
      <!-- Sin sesión no hay nada que cerrar, y un botón que no hace nada
           miente: el mismo hueco ofrece la puerta de entrada. -->
      <a
        class="btn-sign-in btn-icon sm"
        href="/entrar"
        use:link
        aria-label="Entrar"
        data-tip="Entrar"
      >
        <i class="icon icon-login-03"></i>
      </a>
    {/if}
  </div>
</aside>

<!-- El panel de personalizar, solo con la paleta -->
<div
  id="demo-palette-drawer"
  class="drawer-palette drawer right"
  popover="manual"
  aria-labelledby="demo-palette-title"
  style="--drawer-w: 26rem"
  bind:this={drawer}
  ontoggle={onToggle}
>
  <div class="modal-head">
    <div>
      <h2 id="demo-palette-title">Paleta de colores</h2>
      <p>La demo se pinta con la que elijas. Es solo para mirar: no se guarda en ningún sitio.</p>
    </div>
    <button
      type="button"
      class="btn-icon sm btn-rounded"
      popovertarget="demo-palette-drawer"
      popovertargetaction="hide"
      aria-label="Cerrar"
    >
      <i class="icon icon-cancel-01"></i>
    </button>
  </div>
  <div class="modal-body">
    <PalettePicker value={palette} onChange={onPalette} />
  </div>
</div>

<style>
  /* ---- Sidebar ---- */
  .sidebar {
    position: sticky;
    top: 0;
    height: 100vh;
    z-index: 60;
    display: flex;
    flex-direction: column;
    gap: var(--sp-16);
    padding: var(--sp-20) var(--sp-14);
    background: var(--bg-sidebar);
    border-right: var(--border-width) solid var(--border);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--sp-11);
    padding: 0.125rem 0.375rem;

    /* El logotipo se lee solo, asi que no lleva nada al lado: donde había
       pastilla mas nombre y bajada, va el dibujo y ya. Se mide por alto, y el
       `margin-right: auto` es quien empuja los botones al otro extremo --antes
       lo hacia el `flex: 1` del texto--. */
    & :global(.brand-logo-demo) {
      flex: none;
      margin-right: auto;
    }

    /* Los dos botones van juntos, con su propio hueco: el gap de .brand los
       separaría demasiado. */
    & .brand-actions {
      flex: none;
      display: flex;
      align-items: center;
      gap: var(--sp-4);
    }
  }

  /* ---- Menú lateral ---- */
  .nav {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    overflow-y: auto;
    /* Se sale del acolchado del sidebar para que el foco no se recorte */
    margin: 0 -0.25rem;
    padding: 0 var(--sp-4);
  }

  /* El rotulo es `.eyebrow` del catálogo; aqui solo su hueco. */
  .nav-label {
    padding: var(--sp-14) var(--sp-10) var(--sp-6);
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: var(--sp-11);
    width: 100%;
    padding: var(--sp-9) var(--sp-10);
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: var(--text-secondary);
    font-family: inherit;
    font-size: var(--text-sm);
    font-weight: 500;
    text-align: left;
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s;

    & i {
      font-size: var(--text-base);
      color: var(--text-muted);
      transition: color 0.15s;
    }

    & span:first-of-type {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    &:hover {
      background: var(--bg-field);
      color: var(--text-primary);

      & i {
        color: var(--text-secondary);
      }
    }

    &.active {
      background: var(--accent-soft);
      color: var(--accent-soft-text);
      font-weight: 600;

      & i {
        color: var(--accent-soft-text);
      }
    }

    /* Icono de apoyo al final del item: informa, no se pulsa. */
    & .nav-end {
      margin-left: auto;
      font-size: var(--text-base);
      opacity: 0.75;
    }
  }

  /* Contador al final del item */
  .nav-badge {
    margin-left: auto;
    padding: 0.0625rem 0.4375rem;
    border-radius: 62.5rem;
    border: var(--border-width) solid var(--border);
    background: var(--bg-level2);
    color: var(--text-muted);
    font-size: var(--text-xs);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  /* ---- Pie del sidebar ---- */
  .side-foot {
    display: flex;
    align-items: center;
    gap: var(--sp-8);
    padding-top: 0.8125rem;
    border-top: var(--border-width) solid var(--border);

    /* El nombre y la cuenta son `.identity` del catálogo, y cerrar sesión es
       `.btn-icon.sm` con `.btn-danger-quiet` --avisa en rojo solo cuando el
       cursor ya esta encima--: aqui no queda nada propio que decir. */
  }

  /* En estrecho el sidebar deja de ser columna y encabeza la página. */
  @media (max-width: 61.25rem) {
    .sidebar {
      position: static;
      height: auto;
      border-right: 0;
      border-bottom: var(--border-width) solid var(--border);
    }
  }

  /* ---- Panel de la paleta ---- */
  /* Sin oscurecer ni desenfocar: hay que ver la demo tal cual queda con cada
     paleta mientras se elige. */
  .drawer-palette::backdrop {
    background: transparent;
    backdrop-filter: none;
  }
</style>
