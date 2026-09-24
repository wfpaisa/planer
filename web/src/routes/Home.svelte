<script lang="ts">
  import type { AppRecord, BuilderAccount, BuildersView } from "@shared/types";

  import AppIcon from "../components/app/AppIcon.svelte";
  import CreateAppModal from "../components/app/CreateAppModal.svelte";
  import Icon from "../components/Icon.svelte";
  import Logo from "../components/Logo.svelte";
  import ThemePicker from "../components/ThemePicker.svelte";
  import Button from "../components/ui/Button.svelte";
  import Dropdown from "../components/ui/Dropdown.svelte";
  import EmptyState from "../components/ui/EmptyState.svelte";
  import ErrorNote from "../components/ui/ErrorNote.svelte";
  import Loading from "../components/ui/Loading.svelte";
  import MenuItem from "../components/ui/MenuItem.svelte";
  import { paletteAttrs } from "../lib/appTheme";
  import { cx } from "../lib/cx";
  import { api, pb } from "../lib/pb";
  import { link, navigate } from "../lib/router.svelte";
  import { session } from "../lib/session.svelte";
  import { useAsync } from "../lib/useAsync.svelte";

  let creating = $state(false);

  const apps = useAsync(() => pb.collection("apps").getFullList<AppRecord>({ sort: "-updated" }));

  /*
   * Los usuarios del panel de cada aplicación --quien la creó y a quien se la
   * asignaron--, solo para la cuenta principal: es la única que puede leerlos
   * (el servidor lo comprueba en `/api/constructores`). Ella no sale en la
   * lista, así que una aplicación suya sin asignados no muestra a nadie.
   */
  const team = useAsync(() =>
    session.me?.admin
      ? api<BuildersView>("/api/constructores")
      : Promise.resolve<BuildersView | null>(null),
  );

  /** Usuarios por aplicación: primero quien la creó, después los asignados. */
  const usersByApp = $derived.by(() => {
    const map = new Map<string, BuilderAccount[]>();
    for (const user of team.data?.builders ?? []) {
      for (const id of [...user.owned, ...user.assigned]) {
        map.set(id, [...(map.get(id) ?? []), user]);
      }
    }
    for (const [id, users] of map) {
      map.set(
        id,
        users.toSorted((a, b) => Number(b.owned.includes(id)) - Number(a.owned.includes(id))),
      );
    }
    return map;
  });

  /** Cuántas caras se dibujan antes de resumir el resto en "+N". */
  const MAX_FACES = 4;

  function initials(user: BuilderAccount): string {
    const source = user.name.trim() || user.email;
    const words = source.split(/[\s@.]+/).filter(Boolean);
    return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
  }

  const since = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

  /** "hace 3 días", "ayer", "hace 5 minutos": cuándo se tocó por última vez. */
  function ago(iso: string): string {
    const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
    if (!Number.isFinite(seconds)) return "";
    const steps: [Intl.RelativeTimeFormatUnit, number][] = [
      ["year", 31_536_000],
      ["month", 2_592_000],
      ["week", 604_800],
      ["day", 86_400],
      ["hour", 3_600],
      ["minute", 60],
    ];
    for (const [unit, size] of steps) {
      if (Math.abs(seconds) >= size) return since.format(Math.round(seconds / size), unit);
    }
    return "ahora mismo";
  }

  const userTip = (user: BuilderAccount, appId: string) =>
    `${user.name || user.email}${user.owned.includes(appId) ? " (la creó)" : ""}`;
</script>

<div id="home-page" class="home-page">
  <header id="home-header" class="home-header">
    <div class="home-header-inner">
      <Logo id="home-brand-logo" class="home-brand-logo" height="1.25rem" />
      <div class="home-spacer"></div>
      <ThemePicker />
      <Dropdown align="right">
        {#snippet trigger({ toggle })}
          <div>
            <button
              type="button"
              onclick={toggle}
              aria-label="Ajustes de la cuenta"
              class="btn-open-account-menu btn-icon sm"
            >
              <Icon name="settings-01" size={14} />
            </button>
          </div>
        {/snippet}
        <div class="menu-email">{session.me?.email}</div>
        <!-- Los ajustes son solo de la cuenta principal. -->
        {#if session.me?.admin}
          <MenuItem onclick={() => navigate("/ajustes")}>
            {#snippet icon()}<Icon name="settings-01" size={14} />{/snippet}
            Ajustes
          </MenuItem>
        {/if}
        <MenuItem onclick={() => session.signOut()}>
          {#snippet icon()}<Icon name="log-out" size={14} />{/snippet}
          Cerrar sesión
        </MenuItem>
      </Dropdown>
    </div>
  </header>

  <main id="home-main" class="main-home">
    <div class="home-action-row flex items-end justify-between gap-4">
      <div>
        <h1 class="home-title">Tus aplicaciones</h1>
        <p class="home-subtitle">Administra tus aplicaciones, tablas y páginas.</p>
      </div>
      <div class="home-actions flex items-center gap-2">
        <Button variant="secondary" onclick={() => (creating = true)} buttonClass="btn-new-app">
          <Icon name="sidebar-left" size={18} />
          Nueva aplicación
        </Button>
      </div>
    </div>

    <ErrorNote message={apps.error} />

    {#if apps.loading && !apps.data}
      <Loading />
    {:else if apps.data?.length === 0}
      <div class="home-empty inset dashed">
        <EmptyState title="No hay aplicaciones" description="Crea una aplicación para empezar.">
          {#snippet icon()}<Icon name="sidebar-left" size={20} />{/snippet}
        </EmptyState>
      </div>
    {:else}
      <div id="home-app-grid" class="grid-apps grid gap-3">
        {#each apps.data ?? [] as app (app.id)}
          <!--
            La ficha lleva la paleta de SU aplicación, no la del panel: en el
            tablero lo único con color es lo que cada quien construye. El modo
            (claro u oscuro) sigue siendo el de quien mira: la ficha no lleva
            `data-theme` y lo hereda, igual que `AppIcon`.
          -->
          <a
            href="/a/{app.id}/app"
            use:link
            class="card-app"
            {...paletteAttrs(app.theme, { fontScale: false })}
          >
            <div class="card-app-top">
              <AppIcon {app} size={34} class="card-app-icon" />
              <!-- Borrador es la pastilla apagada: todavía no hay nada publicado. -->
              <span class={cx("card-app-status", app.published && "is-live")}>
                <span class="card-app-dot"></span>
                {app.published ? "Publicada" : "Borrador"}
              </span>
            </div>

            <div class="card-app-text">
              <h3 class="card-app-name">{app.name}</h3>
              <p class="card-app-slug">/{app.slug}</p>
            </div>

            <div class="card-app-foot">
              <span class="card-app-fact">
                <Icon name={app.visibility === "public" ? "globe-02" : "lock-password"} size={16} />
                {app.visibility === "public" ? "Pública" : "Con sesión"}
              </span>
              <span class="card-app-fact" title={new Date(app.updated).toLocaleString("es")}>
                <Icon name="clock-01" size={16} />
                {ago(app.updated)}
              </span>

              {#if team.data}
                {@const users = usersByApp.get(app.id) ?? []}
                {#if users.length === 0}
                  <span
                    class="card-app-faces card-app-faces-none"
                    data-tip="Sin usuarios asignados"
                  >
                    <Icon name="user-group" size={13} />
                  </span>
                {:else}
                  <span
                    class="card-app-faces"
                    aria-label={`Usuarios: ${users.map((u) => u.name || u.email).join(", ")}`}
                  >
                    {#each users.slice(0, MAX_FACES) as user (user.id)}
                      <span class="card-app-face" data-tip={userTip(user, app.id)}>
                        {initials(user)}
                      </span>
                    {/each}
                    {#if users.length > MAX_FACES}
                      <span
                        class="card-app-face card-app-face-more"
                        data-tip={users
                          .slice(MAX_FACES)
                          .map((u) => userTip(u, app.id))
                          .join(", ")}
                      >
                        +{users.length - MAX_FACES}
                      </span>
                    {/if}
                  </span>
                {/if}
              {/if}
            </div>

            <Icon name="arrow-up-right-01" size={16} class="card-app-go" />
          </a>
        {/each}
      </div>
    {/if}
  </main>

  <CreateAppModal
    open={creating}
    onClose={() => (creating = false)}
    onCreated={(app) => navigate(`/a/${app.id}/app`)}
  />
</div>

<style>
  .home-page {
    min-height: 100%;
  }

  .home-header {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--bg-level1);

    & .home-header-inner {
      display: flex;
      align-items: center;
      gap: var(--sp-12);
      height: 3.5rem;
      max-width: 72rem;
      margin: 0 auto;
      padding: 0 var(--sp-20);
    }

    /* El logotipo ya dice el nombre; por eso a su lado no va ningún texto.
       `Logo` se mide por alto y se estira a lo ancho lo que pida el dibujo. */
    & :global(.home-brand-logo) {
      flex: none;
    }

    & .home-spacer {
      flex: 1;
    }
  }

  /* El correo que abre el menu de cuenta; vive dentro del menu de `Dropdown`. */
  .menu-email {
    padding: var(--sp-6) var(--sp-10);
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .main-home {
    margin: 0 auto;
    max-width: 72rem;
    padding: var(--sp-40) var(--sp-20);
  }

  .home-action-row {
    /* En un telefono los botones bajan debajo del título en vez de salirse
       por la derecha: "Nueva aplicación" es la acción principal y quedaba
       cortada. */
    flex-wrap: wrap;
    margin-bottom: var(--sp-24);
  }

  .home-title {
    font-size: var(--text-2xl);
    font-weight: 700;
    letter-spacing: -0.025em;
    color: var(--text-primary);
  }

  .home-subtitle {
    margin-top: var(--sp-4);
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  /* El hueco es `.inset.dashed` del catálogo; el estado vacío de dentro lo
     dibuja `EmptyState`, que ya trae su propio respiro. */
  .home-empty {
    padding: 0;
  }

  .grid-apps {
    @media (min-width: 40rem) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (min-width: 64rem) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  /* La ficha lleva la paleta de SU aplicación: el resplandor de la esquina,
     el icono y el anillo al pasar el ratón salen de su acento, así cada
     tarjeta se reconoce por su color antes que por su nombre. El resto es
     del panel, para que seis fichas no compitan entre sí. */
  .card-app {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--sp-16);
    min-height: 11.5rem;
    padding: var(--sp-20);
    overflow: hidden;
    isolation: isolate;
    border: var(--border-width) solid color-mix(in oklab, var(--border) 70%, transparent);
    border-radius: var(--radius-xl);
    background: var(--bg-level2);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm);
    transition:
      transform 200ms var(--travel-fade),
      border-color 200ms var(--travel-fade),
      box-shadow 200ms var(--travel-fade);

    /* El resplandor: un halo del acento que nace detrás del icono. */
    &::before {
      content: "";
      position: absolute;
      inset: -40% 30% 45% -30%;
      z-index: -1;
      background: radial-gradient(
        closest-side,
        color-mix(in oklab, var(--accent) 22%, transparent),
        transparent
      );
      opacity: 0.7;
      transition: opacity 200ms var(--travel-fade);
      pointer-events: none;
    }

    &:hover {
      transform: translateY(-2px);
      border-color: color-mix(in oklab, var(--accent) 40%, var(--border));
      box-shadow:
        var(--shadow-md),
        0 0 0 3px color-mix(in oklab, var(--accent) 10%, transparent);

      &::before {
        opacity: 1;
      }

      & :global(.card-app-go) {
        opacity: 1;
        transform: translate(0, 0);
      }
    }

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;

      &:hover {
        transform: none;
      }
    }

    & .card-app-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--sp-12);
    }

    /* El icono va suelto, sin caja: grande y del color de la aplicación. */
    & :global(.card-app-icon) {
      width: auto;
      height: auto;
      border-radius: 0;
      background: none;
      box-shadow: none;
      color: var(--accent);
    }

    /* Publicada lleva su punto encendido; Borrador se queda apagada. */
    & .card-app-status {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-6);
      padding: var(--sp-4) var(--sp-10);
      border-radius: 62.5rem;
      background: var(--bg-field);
      font-size: var(--text-xs);
      font-weight: 500;
      color: var(--text-secondary);

      &.is-live {
        background: var(--success-bg);
        color: var(--success);

        & .card-app-dot {
          background: var(--success);
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--success) 20%, transparent);
        }
      }
    }

    & .card-app-dot {
      width: 0.375rem;
      height: 0.375rem;
      border-radius: 62.5rem;
      background: var(--text-muted);
    }

    & .card-app-text {
      min-width: 0;
      /* Empuja el pie abajo: las fichas de una fila acaban a la misma altura. */
      flex: 1;
    }

    & .card-app-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--text-lg);
      font-weight: 650;
      letter-spacing: -0.015em;
      color: var(--text-primary);
    }

    & .card-app-slug {
      margin-top: var(--sp-4);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--text-muted);
    }

    & .card-app-foot {
      display: flex;
      align-items: center;
      gap: var(--sp-12);
      padding-top: var(--sp-14);
      border-top: var(--border-width) solid color-mix(in oklab, var(--border) 60%, transparent);
    }

    & .card-app-fact {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-4);
      min-width: 0;
      white-space: nowrap;
      font-size: var(--text-xs);
      color: var(--text-muted);
    }

    /* Quién trabaja en ella: solo lo ve la cuenta principal. Van a la derecha,
       un poco montadas, con el borde del color de la tarjeta para separarlas. */
    & .card-app-faces {
      display: flex;
      margin-left: auto;
    }

    & .card-app-faces-none {
      color: var(--text-muted);
      opacity: 0.6;
    }

    & .card-app-face {
      display: grid;
      place-items: center;
      width: 1.625rem;
      height: 1.625rem;
      border: 2px solid var(--bg-level2);
      border-radius: 62.5rem;
      background: var(--accent-soft);
      color: var(--accent-soft-text);
      font-size: calc(var(--text-xs) * 0.85);
      font-weight: 700;

      & + .card-app-face {
        margin-left: calc(var(--sp-8) * -1);
      }
    }

    & .card-app-face-more {
      background: var(--bg-field);
      color: var(--text-secondary);
    }

    /* La flecha: aparece al pasar el ratón, diciendo que la ficha se abre. */
    & :global(.card-app-go) {
      position: absolute;
      top: var(--sp-20);
      right: var(--sp-20);
      opacity: 0;
      transform: translate(-4px, 4px);
      color: var(--text-secondary);
      transition:
        opacity 200ms var(--travel-fade),
        transform 200ms var(--travel-fade);
    }

    /* Con la flecha a la vista, el estado se aparta para no quedar debajo. */
    &:hover .card-app-status {
      margin-right: var(--sp-24);
    }
  }
</style>
