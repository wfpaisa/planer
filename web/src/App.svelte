<script lang="ts">
  /*
   * Los cuatro ajustes globales --tema, tamaño de letra, sesión y router-- ya no
   * son proveedores que envuelven el árbol: son modulos con estado propio. En
   * React tenian que ser contexto porque no había otra forma de que un cambio
   * repintara a quien lo lee; con runas, importar el modulo basta. El contexto
   * se reserva para lo que si tiene varias instancias, como el constructor.
   */
  import "./lib/fontSize.svelte";
  import "./lib/panelPalette.svelte";
  import "./lib/theme.svelte";

  import GuideTour from "./components/guide/GuideTour.svelte";
  import Router from "./components/Router.svelte";
  import TooltipLayer from "./components/TooltipLayer.svelte";
  import type { RouteDef } from "./lib/router.svelte";
  import AiSettings from "./routes/AiSettings.svelte";
  import Builder from "./routes/Builder.svelte";
  import Demo from "./routes/Demo.svelte";
  import Home from "./routes/Home.svelte";
  import Login from "./routes/Login.svelte";
  import Published from "./routes/Published.svelte";

  const routes: RouteDef[] = [
    // Apps publicadas: no necesitan la sesión del panel.
    { path: "/p/:slug", component: Published },
    { path: "/p/:slug/:pageSlug", component: Published },
    { path: "/entrar", component: Login },
    { path: "/", component: Home, guarded: true },
    // Cada pestaña de los ajustes tiene su dirección (`/ajustes/general`,
    // `/ajustes/ia`…); `/ajustes` a secas abre la primera.
    { path: "/ajustes/*", component: AiSettings, guarded: true },
    // La demo del sistema de estilos: no es del producto y no ensena datos de
    // nadie --todo lo suyo es de ejemplo, el pie del sidebar incluido-- asi
    // que se entra sin sesión. Se llega desde ajustes o por la dirección.
    { path: "/demo", component: Demo },
    // El constructor se queda con todo lo que cuelgue de la aplicación: sus dos
    // mitades y las capas que se abren encima. Ver `Builder.svelte`.
    { path: "/a/:appId/*", component: Builder, guarded: true },
  ];
</script>

<Router {routes} fallback="/" />

<!-- Una sola capa para todos los globos de ayuda del panel. -->
<TooltipLayer />

<!--
  La guía de bienvenida. Va aquí y no en el constructor porque la piden dos
  sitios de rutas distintas: la primera entrada a una aplicación y los ajustes
  de la cuenta. Cerrada no dibuja nada.
-->
<GuideTour />
