<!--
  Un icono por nombre.

  Los iconos son una fuente tipografica (ver `shared/icons.ts`): un icono es un
  `<i>` con dos clases y el tamaño de letra que se le pida. Al ser letra toma
  `currentColor` solo, hereda el color de quien lo rodea y escala con el resto
  del texto sin que nadie lo calcule.

  `size` es opcional a propósito: **sin `size` el icono mide lo que el texto que
  lo acompana** (`font-size: 1em`), que es lo que se quiere siempre que el icono
  vaya al lado de una etiqueta. Solo se le pone medida cuando tiene que salirse
  de esa línea --un icono deliberadamente mas grande que su texto, o uno que va
  solo y no tiene texto del que copiarse.

  Lo que no exista en la fuente cae al icono por defecto --un nombre raro nunca
  deja la pantalla sin icono, solo le cambia la pinta-- y los nombres guardados
  con el formato del paquete de antes (`TrashIcon`) se traducen sobre la marcha.
-->
<script lang="ts">
  import { iconClass, iconName } from "@shared/icons";

  import { cx } from "../lib/cx";

  let {
    name,
    size,
    class: className,
    color,
  }: {
    name?: string;
    /** Medida en px. Sin ella, el icono mide lo que el texto que lo rodea. */
    size?: number;
    class?: string;
    color?: string;
  } = $props();
</script>

<i
  aria-hidden="true"
  class={cx(iconClass(iconName(name)), "icon-glyph inline-flex", className)}
  style="{size === undefined ? '' : `font-size: ${size}px;`}{color ? ` color: ${color};` : ''}"
></i>

<style>
  /* Al ser letra hereda `currentColor` y escala con el texto que la rodea: sin
     `size`, `1em` la deja exactamente de la medida de ese texto. Le gana al
     tamaño de partida de `theme.css` (`i[class*="hgi-"]`) a propósito; los
     pocos sitios del catálogo que agrandan el icono con dos clases --`.btn.sm i`,
     `.btn-icon.sm i`-- siguen mandando, y son botones sin texto. */
  .icon-glyph {
    line-height: 1;
    font-weight: normal;
  }
</style>
