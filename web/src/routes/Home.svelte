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
  import Tag from "../components/ui/Tag.svelte";
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
            class="card-app card card-solid"
            {...paletteAttrs(app.theme, { fontScale: false })}
          >
            <div class="card-app-cover">
              <AppIcon {app} size={22} class="card-app-icon" />
              <!-- Los cuatro colores de la paleta, tal cual: es la marca de la
                   aplicación en pequeño, no un adorno. -->
              <span class="card-app-swatches" aria-hidden="true">
                <i></i>
                <i></i>
                <i></i>
                <i></i>
              </span>
            </div>

            <div class="card-app-body">
              <h3 class="card-app-name">{app.name}</h3>
              <p class="card-app-slug">/{app.slug}</p>

              <div class="card-app-meta">
                <!-- Borrador es la pastilla apagada: todavía no hay nada publicado. -->
                <Tag
                  tone={app.published ? "tag-success" : "off"}
                  class={cx("card-badge", app.published ? "card-badge-on" : "card-badge-off")}
                >
                  <span
                    class={cx("status-dot", app.published ? "status-dot-on" : "status-dot-off")}
                  ></span>
                  {app.published ? "Publicada" : "Borrador"}
                </Tag>
                <span class="card-app-vis">
                  {app.visibility === "public" ? "Pública" : "Requiere iniciar sesión"}
                </span>
              </div>

              {#if team.data}
                {@const users = usersByApp.get(app.id) ?? []}
                <div class="card-app-users">
                  {#if users.length === 0}
                    <span class="card-app-users-none">Sin usuarios asignados</span>
                  {:else}
                    <span
                      class="card-app-faces"
                      aria-label={`Usuarios: ${users.map((u) => u.name || u.email).join(", ")}`}
                    >
                      {#each users.slice(0, MAX_FACES) as user (user.id)}
                        <span class="avatar card-app-face" data-tip={userTip(user, app.id)}>
                          {initials(user)}
                        </span>
                      {/each}
                      {#if users.length > MAX_FACES}
                        <span
                          class="avatar card-app-face card-app-face-more"
                          data-tip={users
                            .slice(MAX_FACES)
                            .map((u) => userTip(u, app.id))
                            .join(", ")}
                        >
                          +{users.length - MAX_FACES}
                        </span>
                      {/if}
                    </span>
                    <span class="card-app-users-count">
                      {users.length === 1 ? "1 usuario" : `${users.length} usuarios`}
                    </span>
                  {/if}
                </div>
              {/if}
            </div>
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

  /* La caja es `.card` del catálogo; `card-solid` porque en oscuro la del
     catálogo es translucida y la ficha se posa sobre el lienzo. Lo propio de
     la ficha es la portada: una franja en el tono suave de la paleta de la
     aplicación, con su icono relleno del acento y sus cuatro colores. Es lo
     que hace que seis fichas dejen de ser seis rectangulos grises iguales:
     cada una se reconoce por su color antes que por su nombre. */
  .card-app {
    overflow: hidden;
    border-color: color-mix(in oklab, var(--border) 50%, transparent);
    box-shadow: var(--shadow-sm);
    transition:
      border-color 150ms var(--travel-fade),
      box-shadow 150ms var(--travel-fade);

    &:hover {
      border-color: color-mix(in oklab, var(--accent) 45%, var(--border));
      box-shadow: var(--shadow-md);

      & .card-app-cover {
        background: color-mix(in oklab, var(--accent) 12%, var(--accent-soft));
      }
    }

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    & .card-app-cover {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 4.5rem;
      padding: 0 var(--sp-16);
      /* El suave de la paleta y no una mezcla a mano: cada paleta lo deriva
         para cada modo, y en oscuro una mezcla del acento con el papel se
         quedaba en un pardo sin color. */
      background: var(--accent-soft);
      transition: background-color 150ms var(--travel-fade);
    }

    /* El icono, relleno del acento: sobre la portada tenida el lavado de
       `AppIcon` se perdia contra el fondo. Va entero dentro de la franja y
       centrado en ella; asomarlo por el borde lo dejaba a medio salir, y el
       anillo del color de la tarjeta le dibujaba un marco oscuro encima del
       color. */
    & :global(.card-app-icon) {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: var(--radius-md);
      background: var(--accent);
      color: var(--accent-text);
      box-shadow: 0 0.5rem 1.25rem -0.625rem var(--accent);
    }

    /* La muestra sube a la esquina: el icono manda en la franja. */
    & .card-app-swatches {
      align-self: flex-start;
      margin-top: var(--sp-14);
      display: flex;
      gap: 0.1875rem;

      & i {
        width: 0.5rem;
        height: 0.875rem;
        border-radius: 0.125rem;
        box-shadow: inset 0 0 0 1px oklch(0 0 0 / 0.08);
      }

      /* Sin `data-palette` --la paleta de partida-- no hay colores crudos:
         se cae en el acento y en las series del tema, que son los suyos. */
      & i:nth-child(1) {
        background: var(--palette-1, var(--accent));
      }
      & i:nth-child(2) {
        background: var(--palette-2, var(--chart-2));
      }
      & i:nth-child(3) {
        background: var(--palette-3, var(--chart-3));
      }
      & i:nth-child(4) {
        background: var(--palette-4, var(--chart-4));
      }
    }

    & .card-app-body {
      padding: var(--sp-14) var(--sp-16) var(--sp-16);
    }

    & .card-app-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--text-md);
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--text-primary);
    }

    & .card-app-slug {
      margin-top: 0.125rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--text-xs);
      color: var(--text-muted);
    }

    & .card-app-meta {
      display: flex;
      align-items: center;
      gap: var(--sp-8);
      margin-top: var(--sp-12);
    }

    /* La pastilla la dibuja `Tag`, asi que su clase sale del ambito de aqui.
       Lo único que cambia aqui es el peso: en una tarjeta acompana al nombre
       de la app, no lo compite. */
    & :global(.card-badge) {
      font-weight: 500;
    }

    /* El punto va dentro de la etiqueta, que la dibuja `Tag`: fuera del ambito. */
    & :global(.card-badge .status-dot) {
      width: 0.375rem;
      height: 0.375rem;
      border-radius: 62.5rem;
    }

    & :global(.card-badge .status-dot-on) {
      background: var(--success);
    }

    & :global(.card-badge .status-dot-off) {
      background: var(--text-muted);
    }

    & .card-app-vis {
      font-size: var(--text-xs);
      color: var(--text-muted);
    }

    /* Quién trabaja en ella: solo lo ve la cuenta principal. Las caras se
       montan un poco unas sobre otras, con el borde del color de la tarjeta
       para que se lean separadas. */
    & .card-app-users {
      display: flex;
      align-items: center;
      gap: var(--sp-8);
      margin-top: var(--sp-12);
      padding-top: var(--sp-12);
      border-top: var(--border-width) solid color-mix(in oklab, var(--border) 50%, transparent);
    }

    & .card-app-faces {
      display: flex;
    }

    & .card-app-face {
      width: 1.5rem;
      height: 1.5rem;
      font-size: var(--text-xs);
      border: 2px solid var(--bg-level2);

      & + .card-app-face {
        margin-left: calc(var(--sp-6) * -1);
      }
    }

    & .card-app-face-more {
      background: var(--bg-field);
      color: var(--text-secondary);
    }

    & .card-app-users-count,
    & .card-app-users-none {
      font-size: var(--text-xs);
      color: var(--text-muted);
    }
  }
</style>
