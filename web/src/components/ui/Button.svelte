<!--
  El boton de la casa.

  Por dentro es el del sistema (`components.css`), y el color es de la casa,
  no de cada pantalla:

    default    lo normal. Solo `.btn`: papel del tema y nada mas. La mayoria de
               los botones son este.
    secondary  el que destaca: la accion principal de una pantalla, un enlace,
               lo que hay que pulsar. Es el acento de la paleta puesta (ver
               `shared/brand.ts`).
    neutral    la tinta plena para cuando `secondary` ya esta ocupado al lado
               y hacen falta dos pesos distintos.

  El resto son estados, no jerarquia, y los tres vienen del sistema
  (`components.css`): `ghost` (sin fondo ni borde), `danger` (borra, expulsa o
  no se puede deshacer) y `warning` (algo esta a medias, y eso no es un error).
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  import { cx } from "../../lib/cx";

  export type Variant =
    "default" | "secondary" | "neutral" | "ghost" | "danger" | "warning" | "success" | "soft";
  export type Size = "xs" | "sm" | "md" | "lg" | "xl";

  const VARIANTS: Record<Variant, string> = {
    default: "",
    secondary: "btn-primary",
    // El sistema no tiene relleno de tinta: el normal ya es neutro.
    neutral: "",
    ghost: "btn-ghost",
    danger: "btn-danger",
    // Para avisar sin alarmar: algo esta pendiente, no roto.
    warning: "btn-warning",
    // Sin uso hoy; si alguien lo pide, que salga neutro y no disfrazado de
    // acento ni de peligro.
    success: "",
    // El lavado tenue de antes: aqui lo cubre el boton normal.
    soft: "",
  };

  const SIZES: Record<Size, string> = {
    // El corto del sistema (`.btn.sm`); md y los grandes son el normal.
    xs: "sm",
    sm: "sm",
    md: "",
    lg: "",
    xl: "",
  };

  let {
    variant = "default",
    size = "md",
    loading = false,
    buttonClass,
    class: className,
    tip,
    tipSide,
    children,
    ...rest
  }: Omit<HTMLButtonAttributes, "class"> & {
    class?: string;
    variant?: Variant;
    size?: Size;
    /** El globo de ayuda. Lo dibuja `TooltipLayer`, no el boton. */
    tip?: string;
    /** De que lado del boton sale el globo. Por defecto, arriba. */
    tipSide?: "top" | "bottom" | "left" | "right";
    loading?: boolean;
    /** Clase semantica que identifica al boton en la UI. Va al inicio de class. */
    buttonClass?: string;
    children?: Snippet;
  } = $props();
</script>

<button
  {...rest}
  disabled={rest.disabled || loading}
  class={cx(buttonClass, "btn", VARIANTS[variant], SIZES[size], className)}
  data-tip={tip}
  data-tip-side={tip ? tipSide : undefined}
>
  {#if loading}
    <span class="spinner"></span>
  {/if}
  {@render children?.()}
</button>
