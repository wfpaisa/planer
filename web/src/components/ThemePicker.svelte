<!--
  Claro u oscuro para el panel, y nada mas.

  Antes esto era una lista de treinta y cinco temas de daisyUI. La eleccion de
  color ya no vive aqui --es de cada aplicación, en sus ajustes-- asi que lo
  único que queda por elegir en el panel es sobre que papel se trabaja. El
  botón es el mismo de todas partes (`ui/ModeToggle.svelte`); lo que pone aqui
  es a quien se le cuenta: al tema del panel, guardado en este navegador.
-->
<script lang="ts">
  import { cx } from "../lib/cx";
  import { theme } from "../lib/theme.svelte";
  import ModeToggle from "./ui/ModeToggle.svelte";

  let { id, class: className }: { id?: string; class?: string } = $props();
</script>

<ModeToggle
  {id}
  dark={theme.name === "dark"}
  onToggle={(next) => theme.set(next)}
  class={cx("picker-theme", className)}
/>
