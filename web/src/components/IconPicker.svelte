<!--
  Elegir el icono de una aplicacion o de una pagina.

  El catalogo son los seis mil nombres de la fuente, asi que no caben al lado
  del nombre ni se pueden pintar todos a la vez. Lo que se ve en el formulario
  es un solo control --el icono de ahora, delante del campo del nombre-- y al
  tocarlo se abre una ventana con el buscador. Dentro solo se dibuja la primera
  pagina de resultados; el icono elegido va siempre de primero, para que se siga
  viendo aunque la busqueda no lo alcance.

  Va con etiqueta, como el campo que tiene al lado, y es la misma pieza en la
  aplicacion y en la pagina: un boton cuadrado y mudo junto a un "Nombre"
  etiquetado se leia como un adorno del campo y no como algo que se elige.
-->
<script lang="ts">
  import { iconName } from "@shared/icons";

  import { cx } from "../lib/cx";
  import Icon from "./Icon.svelte";
  import IconPickerModal from "./IconPickerModal.svelte";
  import Field from "./ui/Field.svelte";

  let {
    value,
    onChange,
    label = "Asignar icono",
    class: className,
  }: {
    value: string;
    onChange: (next: string) => void;
    /** Lo que dice la etiqueta de encima. Igual en la aplicacion y en la pagina. */
    label?: string;
    /** Clase raiz, por si hay que alinearlo distinto. */
    class?: string;
  } = $props();

  let open = $state(false);

  /* Lo guardado puede traer el nombre del paquete de antes (`Table01Icon`): se
     traduce una vez, para que el elegido case con los de la lista. */
  const current = $derived(iconName(value));
</script>

<div class={cx("icon-picker", className)}>
  <!-- `Field` envuelve el control en su `<label>`, y un `<button>` si se
       etiqueta: tocar el texto tambien abre el buscador. -->
  <Field {label}>
    <button
      type="button"
      onclick={() => (open = true)}
      data-tip="Cambiar el icono"
      aria-label="Icono {current}. Tocar para cambiarlo."
      class="icon-picker-btn btn"
    >
      <Icon name={current} size={20} />
      <Icon name="chevron-down" size={12} class="icon-picker-caret" />
    </button>
  </Field>
</div>

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
  /* No crece: se queda con el ancho que pide su etiqueta y el nombre se lleva
     el resto de la fila. El boton se estira hasta ese ancho, asi el control y
     lo que lo nombra miden lo mismo. */
  .icon-picker {
    flex: 0 0 auto;
  }

  /* El boton es `.btn` del catalogo --misma altura que el campo de al lado--
     con el icono a un lado y la punta de flecha al otro --`chevron-down`, la
     misma que dice "aqui hay lista" en el resto del panel--. Al apuntarlo se
     tine del acento, porque lo que abre es el icono de la aplicacion y conviene
     que se lea como algo que se elige, no que se pulsa. */
  .icon-picker-btn {
    width: 100%;
    justify-content: space-between;
    padding-inline: var(--sp-10);
    color: var(--text-secondary);

    /* La punta de flecha acompana y no compite con el icono elegido. */
    & :global(.icon-picker-caret) {
      color: var(--text-muted);
    }

    &:hover {
      border-color: color-mix(in oklab, var(--accent) 50%, transparent);
      background: var(--accent-soft);
      color: var(--accent-soft-text);

      & :global(.icon-picker-caret) {
        color: inherit;
      }
    }
  }
</style>
