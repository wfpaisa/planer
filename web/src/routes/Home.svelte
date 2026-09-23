<script lang="ts">
  import type { AppRecord } from "@shared/types";

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
  import { cx } from "../lib/cx";
  import { pb } from "../lib/pb";
  import { link, navigate } from "../lib/router.svelte";
  import { session } from "../lib/session.svelte";
  import { useAsync } from "../lib/useAsync.svelte";

  let creating = $state(false);

  const apps = useAsync(() => pb.collection("apps").getFullList<AppRecord>({ sort: "-updated" }));
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
        <MenuItem onclick={() => navigate("/ajustes")}>
          {#snippet icon()}<Icon name="settings-01" size={14} />{/snippet}
          Ajustes
        </MenuItem>
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
      <Button variant="secondary" onclick={() => (creating = true)} buttonClass="btn-new-app">
        <Icon name="sidebar-left" size={18} />
        Nueva aplicación
      </Button>
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
          <a href="/a/{app.id}/app" use:link class="card-app card card-solid block">
            <AppIcon {app} size={28} class="card-app-icon" />
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
    margin-bottom: var(--sp-24);
  }

  .home-title {
    font-size: var(--text-2xl);
    font-weight: 600;
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
     catálogo es translucida y la ficha se posa sobre el lienzo. Aqui solo
     lo de la ficha: el acolchado --no tiene cabecera ni cuerpo de card-- y
     el cerco, que en reposo va a media tinta y se cierra al apuntarla. */
  .card-app {
    border-color: color-mix(in oklab, var(--border) 50%, transparent);
    padding: var(--sp-16);
    box-shadow: var(--shadow-sm);
    transition: border-color 150ms var(--travel-fade);

    &:hover {
      border-color: var(--border);
    }

    /* El tamaño lo pone quien la dibuja: es una pastilla de otro componente. */
    & :global(.card-app-icon) {
      margin-bottom: var(--sp-12);
      width: 2.25rem;
      height: 2.25rem;
    }

    & .card-app-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--text-sm);
      font-weight: 500;
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
  }
</style>
