<!--
  Elegir el icono de una aplicacion o de una pagina.

  El catalogo son los seis mil nombres de la fuente, asi que no caben al lado
  del nombre ni se pueden pintar todos a la vez. Lo que se ve en el formulario
  es un solo boton --el icono de ahora, delante del campo del nombre-- y al
  tocarlo se abre una ventana con el buscador. Dentro solo se dibuja la primera
  pagina de resultados; el icono elegido va siempre de primero, para que se siga
  viendo aunque la busqueda no lo alcance.
-->
<script lang="ts">
  import { iconName } from "@shared/icons";

  import { cx } from "../lib/cx";
  import Icon from "./Icon.svelte";
  import IconPickerModal from "./IconPickerModal.svelte";

  let {
    value,
    onChange,
    class: className,
  }: {
    value: string;
    onChange: (next: string) => void;
    /** Clase raiz del boton, por si hay que alinearlo distinto. */
    class?: string;
  } = $props();

  let open = $state(false);

  /* Lo guardado puede traer el nombre del paquete de antes (`Table01Icon`): se
     traduce una vez, para que el elegido case con los de la lista. */
  const current = $derived(iconName(value));
</script>

<button
  type="button"
  onclick={() => (open = true)}
  data-tip="Cambiar el icono"
  aria-label="Icono {current}. Tocar para cambiarlo."
  class={cx("icon-picker-btn", "btn-icon", className)}
>
  <Icon name={current} size={20} />
</button>

<IconPickerModal
  {open}
  value={current}
  onClose={() => (open = false)}
  onPick={(name) => {
    onChange(name);
    open = false;
  }}
/>

<style>
  /* El boton es `.btn-icon` del catalogo; aqui solo lo que este pide de mas:
     al apuntarlo se tine del acento, porque lo que abre es el icono de la
     aplicacion y conviene que se lea como algo que se elige, no que se pulsa. */
  .icon-picker-btn {
    &:hover {
      border-color: color-mix(in oklab, var(--accent) 50%, transparent);
      background: var(--accent-soft);
      color: var(--accent-soft-text);
    }
  }
</style>
