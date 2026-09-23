<!--
  Dibuja la primera ruta que encaje.

  `pathname` se puede dar a mano, y ahi esta la gracia: el constructor abre sus
  ajustes y su vista previa como capas encima de lo que ya estaba, y para eso
  dibuja su contenido contra la ubicacion de fondo en vez de contra la de
  verdad. Ver `RouteState` en `lib/router.svelte.ts`.
-->
<script lang="ts">
  import { location, matchRoutes, navigate, type RouteDef } from "../lib/router.svelte";
  import Private from "./Private.svelte";

  let {
    routes,
    pathname,
    fallback,
  }: {
    routes: RouteDef[];
    /** Con que dirección se emparejan las rutas. Por defecto, donde se esta. */
    pathname?: string;
    /** A donde ir cuando no encaja ninguna. */
    fallback?: string;
  } = $props();

  const path = $derived(pathname ?? location.pathname);
  const hit = $derived(matchRoutes(routes, path));

  $effect(() => {
    if (hit || !fallback) return;
    // Si el respaldo tampoco encaja no se va a ninguna parte: navegar a una
    // ruta que no existe volveria a caer aqui, y la vuelta no tiene fin.
    if (!matchRoutes(routes, fallback)) return;
    navigate(fallback, { replace: true });
  });
</script>

{#if hit}
  {@const Page = hit.route.component}
  {#if hit.route.guarded}
    <Private>
      <Page params={hit.params} rest={hit.rest} />
    </Private>
  {:else}
    <Page params={hit.params} rest={hit.rest} />
  {/if}
{/if}
