<!--
  El punto de publicar. Se pinta distinto segun en cual de los tres estados este
  la aplicacion, para no tener que abrir nada para enterarse:

  - **Sin publicar**: el boton llama, porque falta el paso que la saca afuera.
  - **Con cambios**: se pone ambar y le late un punto en la esquina. Es un
    aviso, no un error: hay algo hecho que todavia no ve nadie.
  - **Al dia**: se apaga y deja un punto verde. Ya no hay nada que hacer.

  El punto es la unica parte que se anima, y solo en el estado que lo pide.
-->
<script lang="ts">
  import type { VersionsView } from "@shared/types";

  import { useBuilder } from "../lib/builderContext";
  import { cx } from "../lib/cx";
  import { api } from "../lib/pb";
  import { useAsync } from "../lib/useAsync.svelte";
  import Icon from "./Icon.svelte";

  let { active, onclick }: { active: boolean; onclick: () => void } = $props();

  const builder = useBuilder();

  // `touched` se lee a proposito: cada vez que algo del diseno se guarda, esta
  // peticion se vuelve a hacer y el aviso se pone al dia.
  const state = useAsync(() => {
    void builder.touched;
    return api<VersionsView>(`/api/apps/${builder.app.id}/versiones`);
  });

  const pending = $derived(state.data?.hasChanges ?? false);
  const live = $derived(builder.app.published && !pending);
</script>

<button
  type="button"
  aria-haspopup="dialog"
  {onclick}
  class={cx(
    "btn-publish btn sm",
    pending ? "badge-warning" : live ? " badge-success" : "btn-primary",
    active && "active",
  )}
  data-tip-side="left"
  data-tip={pending
    ? "Hay cambios que todavía no ve nadie"
    : builder.app.published
      ? "Publicada y al día"
      : "Publicar la aplicación"}
>
  <Icon name="zap" size={16} />

  <span class="publish-button-label">
    {#if pending || live}
      Publicada
    {:else}
      Publicar
    {/if}
  </span>
</button>

<style>
  /*
   * La etiqueta del boton: solo para lectores de pantalla en pantallas
   * pequenas, visible desde `sm`. El icono ya dice lo que es.
   */
  .publish-button-label {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;

    @media (min-width: 40rem) {
      position: static;
      width: auto;
      height: auto;
      padding: 0;
      margin: 0;
      overflow: visible;
      clip: auto;
      white-space: normal;
    }
  }

  @keyframes publish-ping {
    75%,
    100% {
      transform: scale(2);
      opacity: 0;
    }
  }
</style>
