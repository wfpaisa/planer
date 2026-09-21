<!--
  El logotipo de la marca: la palabra "Planer" y su punto, en horizontal.

  Se lee solo, asi que va sin texto al lado: donde antes habia icono cuadrado
  mas `<span>Planer</span>`, ahora va esta pieza y nada mas.

  Son dos archivos, uno por tema (la letra en negro y la letra en blanco), y no
  uno con `currentColor`: el dibujo entra por `<img>`, que lo pinta aparte de
  la pagina y no ve ni su color ni sus fuentes. Por eso tambien la palabra va
  en trazo y no en `<text>`.

  Cual de los dos se pide lo decide `theme`, el modo del panel. Se mide por
  alto --`--logo-height`--, que la anchura la pone la proporcion del dibujo.
-->
<script lang="ts">
  import logoLight from "../assets/planer-logo.svg";
  import logoDark from "../assets/planer-logo-white.svg";
  import { cx } from "../lib/cx";
  import { theme } from "../lib/theme.svelte";

  let {
    height = "1.25rem",
    id,
    class: className,
  }: {
    /** Lo alto que se dibuja; la anchura sale sola. */
    height?: string;
    id?: string;
    class?: string;
  } = $props();

  const src = $derived(theme.name === "dark" ? logoDark : logoLight);
</script>

<img {id} {src} alt="Planer" class={cx("brand-logo", className)} style="--logo-height: {height}" />

<style>
  .brand-logo {
    display: block;
    width: auto;
    height: var(--logo-height);
  }
</style>
