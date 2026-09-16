<!--
  Una aplicacion abierta por su enlace publico.

  No pasa por la sesion del panel: quien entra aqui es alguien invitado a esta
  aplicacion, con su propia cuenta (ver `loginFor` en `shared/people.ts`), o
  cualquiera si la aplicacion esta abierta.
-->
<script lang="ts">
  import { personDisplayName } from "@shared/people";
  import type { AppBundle } from "@shared/types";

  import AppView from "../components/AppView.svelte";
  import Icon from "../components/Icon.svelte";
  import MemberLogin from "../components/MemberLogin.svelte";
  import PublishedError from "../components/PublishedError.svelte";
  import { Loading } from "../components/ui";
  import { publicPageLoader } from "../lib/htmlDocs";
  import { errorMessage, jsonBody, pbApp } from "../lib/pb";
  import { publishedPeople, setPeople } from "../lib/people.svelte";
  import { navigate, type RouteParams } from "../lib/router.svelte";

  type Bundle = AppBundle & { requiresAuth?: boolean };

  let { params }: { params: RouteParams } = $props();

  const slug = $derived(params.slug ?? "");
  const pageSlug = $derived(params.pageSlug);

  let bundle = $state<Bundle | null>(null);
  let error = $state("");
  let loading = $state(true);
  /** Sube al entrar o al salir: es lo que hace releer al padron de la app. */
  let session = $state(0);

  const people = publishedPeople(
    () => slug,
    () => {
      void session;
      return pbApp.authStore.isValid;
    },
  );
  setPeople(people);

  /*
   * Quien entro a esta aplicacion (la coleccion `members`, no la sesion del
   * panel). `cuenta` es el correo real -- `email` se deja vacio a proposito,
   * ver `server/bootstrap.ts` -- y `login` es solo lo que se compara al
   * entrar, no algo que mostrar.
   */
  const member = $derived.by(() => {
    void session;
    if (!pbApp.authStore.isValid) return null;
    return pbApp.authStore.record as { id?: string; name?: string; cuenta?: string } | null;
  });
  /*
   * Como se llama, no como se llama su cuenta: el `name` de la cuenta es el
   * correo sin el dominio, y para quien entro con `1037660432@ss.local` eso es
   * su cedula. El nombre esta en su fila de la tabla de personas, que llega en
   * el padron. Ver `personDisplayName`.
   */
  const memberName = $derived.by(() => {
    const mine = people.list.find((p) => p.id === member?.id) ?? null;
    return (mine ? personDisplayName(mine) : "") || member?.name || member?.cuenta || "";
  });
  const memberInitials = $derived.by(() => {
    const parts = memberName.split(/[\s@.]+/).filter(Boolean);
    return (
      parts
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("") || "?"
    );
  });

  /*
   * El cargador depende solo del enlace y de la pagina. El marco vuelve a
   * cargar el documento --y a empezar de cero-- cada vez que le cambia, asi que
   * uno nuevo por dibujado dejaba la pagina reiniciandose sin parar: nunca
   * llegaba a estar lista, y el tema que se le manda al cambiar de modo se
   * perdia por el camino.
   */
  const makePageLoader = $derived((pageId: string) => publicPageLoader(slug, pageId));

  async function load() {
    loading = true;
    try {
      const headers: Record<string, string> = {};
      if (pbApp.authStore.token) headers.authorization = pbApp.authStore.token;
      const res = await fetch(`/api/public/${encodeURIComponent(slug)}`, { headers });
      const data = jsonBody(await res.text());
      if (!res.ok || !data) throw new Error(data?.error ?? "No se pudo abrir la aplicación");
      bundle = data as Bundle;
      error = "";
    } catch (err) {
      error = errorMessage(err);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void slug;
    void load();
  });

  function logOut() {
    pbApp.authStore.clear();
    window.location.reload();
  }

  async function signedIn() {
    session += 1;
    await load();
  }

  async function signOut() {
    pbApp.authStore.clear();
    session += 1;
    await load();
  }
</script>

{#if loading && !bundle}
  <Loading label="Abriendo" />
{:else if error}
  <PublishedError message={error} onLogout={logOut} />
{:else if bundle?.requiresAuth}
  <MemberLogin {bundle} onSignedIn={signedIn} />
{:else if bundle}
  <AppView
    {bundle}
    client={pbApp}
    {makePageLoader}
    {pageSlug}
    onOpenPage={(p) => navigate(`/p/${slug}${p.isHome ? "" : `/${p.slug}`}`)}
  >
    <!--
      El pie usa tres piezas del catalogo tal cual: `.avatar` para las
      iniciales, `.identity` para el nombre y la cuenta, y `.btn-icon.sm` con
      `.btn-danger-quiet` para cerrar sesion --que solo avisa en rojo cuando el
      cursor ya esta encima--. Por eso este archivo no tiene <style> propio.
    -->
    {#snippet footer()}
      {#if member}
        <span class="member-avatar avatar">{memberInitials}</span>
        <div class="member-meta identity">
          <strong>{memberName}</strong>
          {#if member.cuenta && member.cuenta !== memberName}
            <span>{member.cuenta}</span>
          {/if}
        </div>
        <button
          type="button"
          onclick={signOut}
          aria-label="Cerrar la sesión"
          class="btn-sign-out btn-icon sm btn-danger-quiet"
        >
          <Icon name="log-out" size={18} />
        </button>
      {/if}
    {/snippet}
  </AppView>
{/if}
