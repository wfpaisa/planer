<!--
  La cara de Planer.

  Son los tres gestos que dibujo Inkscape (`assets/planer-icon/*.svg`) traidos
  aqui como trazados en linea, y por eso: un `<img>` no puede cambiar de color
  ni saber que paleta lleva puesta la pantalla. Al vivir en el marcado, la cara
  toma `currentColor` --el acento del tema, salvo que se le pida otro-- y
  cambia sola cuando cambia la paleta.

  `mood` es el gesto: `normal` mira de frente, `happy` sonrie con los dos ojos y
  `ok` guina uno solo.

  Todo se mide contra `size`, que es el ancho de la cara en px: el elemento de
  fuera lleva ese numero como `font-size` y lo de dentro --alto, globo, icono--
  va en `em`, de modo que una sola cifra escala la pieza entera.

  Con `icon` --un nombre de la fuente de iconos-- sale un globo por encima de
  la esquina superior derecha, al estilo del dialogo de un personaje:
  `bubble-chat` mientras habla, `bubble-chat-question` cuando pregunta. Va
  desnudo --sin pastilla detras-- y de la misma tinta que la cara, y se queda
  fuera de ella: el hueco se lo hace el relleno de arriba del elemento, para
  que el icono no tape al personaje ni se salga de la caja que la pieza ocupa.

  `color` pisa el acento y se lo lleva todo: cara e icono.
-->
<script lang="ts">
  import { cx } from "../lib/cx";
  import Icon from "./Icon.svelte";

  export type PlanerMood = "normal" | "happy" | "ok";

  let {
    mood = "normal",
    size = 40,
    icon,
    color,
    label = "Planer",
    class: className,
  }: {
    /** El gesto: de frente, sonriendo o guinando un ojo. */
    mood?: PlanerMood;
    /** Ancho de la cara en px; el resto de la pieza se mide contra el. */
    size?: number;
    /** Nombre de icono de la fuente para el globo de la esquina. */
    icon?: string;
    /** Color de la cara. Sin el, el acento del tema. */
    color?: string;
    label?: string;
    class?: string;
  } = $props();
</script>

<span
  class={cx("planer-avatar inline-flex", className)}
  style="font-size: {size}px;{color ? ` --planer-ink: ${color};` : ''}"
  role="img"
  aria-label={label}
>
  <!--
    El `viewBox` son las coordenadas del original tal cual: el dibujo venia
    dentro de una capa desplazada, y correr la ventana evita mover a mano cada
    punto de los trazados.
  -->
  <svg class="planer-face" viewBox="108.75574 94.994145 33.866667 23.8125" aria-hidden="true">
    <rect
      x="109.33965"
      y="95.784081"
      width="32.698841"
      height="22.258612"
      rx="10.902676"
      ry="10.279582"
      fill="none"
      stroke="currentColor"
      stroke-width="1.1843"
    />
    {#if mood === "happy"}
      <g fill="currentColor" transform="matrix(0.67879129,0,0,0.67879129,51.35204,-36.227573)">
        <path
          d="m 98.752245,205.2611 c -5.977201,0.32022 -8.776109,7.17918 -6.022617,8.10418 2.4168,0.5347 1.770528,-4.18251 5.91339,-4.17215 4.363142,-0.13297 3.630522,4.43568 6.137262,4.2074 2.88161,-0.32713 -0.16504,-8.45354 -6.028035,-8.13943 z"
        />
        <path
          d="m 120.23342,205.2611 c -5.9772,0.32022 -8.77611,7.17918 -6.02262,8.10418 2.4168,0.5347 1.77053,-4.18251 5.91339,-4.17215 4.36314,-0.13297 3.63053,4.43568 6.13726,4.2074 2.88161,-0.32713 -0.16504,-8.45354 -6.02803,-8.13943 z"
        />
      </g>
    {:else if mood === "ok"}
      <ellipse cx="119.17943" cy="105.28049" rx="3.2427197" ry="4.5266771" fill="currentColor" />
      <g fill="currentColor" transform="matrix(0.60717746,0,0,0.60717746,54.886464,36.502665)">
        <path
          d="m 127.18164,108.94445 c -5.9772,0.32022 -8.77611,7.17918 -6.02262,8.10418 2.4168,0.5347 1.77053,-4.18251 5.91339,-4.17215 4.36314,-0.13297 3.63053,4.43568 6.13726,4.2074 2.88161,-0.32713 -0.16504,-8.45354 -6.02803,-8.13943 z"
        />
      </g>
    {:else}
      <ellipse cx="119.17943" cy="105.28049" rx="3.2427197" ry="4.5266771" fill="currentColor" />
      <ellipse cx="132.19872" cy="105.28049" rx="3.2427197" ry="4.5266771" fill="currentColor" />
    {/if}
  </svg>

  {#if icon}
    <span class="planer-cue"><Icon name={icon} /></span>
  {/if}
</span>

<style>
  /* `--planer-ink` es el color de la pieza entera --cara e icono, que lo leen
     por `currentColor`--: lo pone el acento del tema y lo pisa la prop `color`
     desde el `style` de fuera. */
  .planer-avatar {
    position: relative;
    --planer-ink: var(--accent);
    /* Lo que mide el icono de la esquina, y por tanto el hueco que se le
       reserva encima de la cara. */
    --planer-cue-size: 0.3em;
    color: var(--planer-ink);
    line-height: 0;
    padding-top: var(--planer-cue-size);
  }

  /* El alto sale del propio `viewBox` (33.867 x 23.813): con el ancho en `1em`,
     `height: auto` deja la proporcion sin que nadie la escriba. */
  .planer-face {
    display: block;
    width: 1em;
    height: auto;
  }

  /* El globo va fuera de la cara, no sobre ella: el relleno de arriba le abre
     el hueco --de ahi que el alto de la pieza sea el de la cara mas ese
     hueco-- y el icono se alinea con el lado derecho del dibujo. */
  .planer-cue {
    position: absolute;
    top: -12%;
    right: -34%;
    line-height: 0;
    font-size: 130%;
  }

  /* El icono viene de `Icon`, que no lleva la clase de ambito de este archivo:
     `:global` es la unica forma de alcanzarlo. La medida va en `em` del
     elemento de fuera, asi que escala con `size` como todo lo demas, y el
     color lo hereda --es la misma tinta de la cara. */
  .planer-cue :global(i) {
    color: var(--accent);
    opacity: 0.7;
    font-size: var(--planer-cue-size);
    line-height: 1;
  }
</style>
