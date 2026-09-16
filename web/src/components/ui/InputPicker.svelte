<!--
  Un campo de texto que ademas ofrece una lista.

  El `datalist` del navegador no sirve: esconde lo que no empieza por lo ya
  escrito --con "50" adentro solo ensenaba "50" y "500"-- y su lista no se deja
  vestir, ni siquiera para marcar por donde va el raton.

  Asi que quien ofrece las opciones es un `select` de verdad, invisible y del
  tamano del campo: al pulsar la flecha se le pide que abra la suya, que es la
  del catalogo y no la del sistema. Lo elegido se copia al campo, que sigue
  admitiendo texto libre.
-->
<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  import { cx } from "../../lib/cx";
  import Icon from "../Icon.svelte";

  let {
    options,
    onPick,
    onblur,
    value = $bindable(""),
    wrapClass,
    class: className,
    ...rest
  }: Omit<HTMLInputAttributes, "class"> & {
    class?: string;
    options: readonly (string | number)[];
    /** Se eligio una opcion de la lista. */
    onPick?: (value: string) => void;
    /** Clases del contenedor, no del campo: es quien manda el ancho. */
    wrapClass?: string;
  } = $props();

  let campo = $state<HTMLInputElement | null>(null);
  let lista = $state<HTMLSelectElement | null>(null);
</script>

<div class={cx("wrap-input-picker", wrapClass)}>
  <input
    {...rest}
    bind:this={campo}
    bind:value
    autocomplete="off"
    onblur={(e) => {
      // Al abrir la lista el foco salta a la opcion marcada. Eso no es irse del
      // campo, y quien lo usa no deberia dar por cerrada la edicion.
      const hacia = e.relatedTarget as HTMLElement | null;
      if (hacia && (hacia === lista || hacia.tagName === "OPTION")) return;
      onblur?.(e);
    }}
    class={cx("input-picker", "field-control", className)}
  />
  <!--
    La lista se abre desde la flecha y no desde el campo: mientras esta abierta
    el teclado es suyo, asi que colgarla del campo dejaria sin escribir a quien
    solo queria teclear un valor.
  -->
  <button
    type="button"
    tabindex="-1"
    aria-label="Ver las opciones"
    onmousedown={(e) => e.preventDefault()}
    onclick={() => {
      // `showPicker` exige un gesto reciente: por eso cuelga del clic.
      try {
        lista?.showPicker();
      } catch {
        // Navegador que no lo permite: queda el campo de texto a secas.
      }
    }}
    class="btn-input-picker"
  >
    <Icon name="chevron-down" size={12} />
  </button>
  <!--
    Invisible y debajo del campo, no `pointer-events: none`: su lista lo
    heredaria y las opciones se verian pero no se dejarian pulsar --el clic se
    iria a lo que hubiera detras--.
  -->
  <select
    bind:this={lista}
    class="picker-select-hidden"
    tabindex="-1"
    aria-hidden="true"
    value={String(value ?? "")}
    onchange={(e) => {
      const picked = e.currentTarget.value;
      value = picked;
      onPick?.(picked);
      // Un turno despues: al cerrarse, la lista se queda con el foco, y
      // dejarselo seria un campo que ya no escribe.
      setTimeout(() => campo?.focus(), 0);
    }}
  >
    <!-- Para lo escrito a mano, que no coincide con ninguna opcion. -->
    <option value="" hidden aria-label="Sin opción"></option>
    <!--
      La llave es el sitio y no el valor: una opcion es su texto y nada mas, asi
      que no hay identidad que conservar entre dibujados. Con el valor por
      llave, una lista que trajera dos veces el mismo texto --dos personas con
      la misma cedula-- tumbaba el campo entero con `each_key_duplicate`. Quien
      pueda, que no repita; quien repita, que no rompa.
    -->
    {#each options as option, i (i)}
      <option value={option}>{option}</option>
    {/each}
  </select>
</div>

<style>
  .wrap-input-picker {
    position: relative;

    & .input-picker {
      position: relative;
      /* Por encima de la flecha cromada pero dentro del contenedor relativo. */
      z-index: 10;
      padding-right: var(--sp-28);
    }

    & .btn-input-picker {
      position: absolute;
      inset-block: 0;
      right: 0;
      /* La flecha queda por encima del campo: hay que pulsarla, no el campo. */
      z-index: 20;
      display: flex;
      width: 1.75rem;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--text-muted);
      transition: color 150ms;

      &:hover {
        color: var(--text-primary);
      }
    }

    /*
      Invisible, pero su lista no: el `opacity: 0` no la apaga porque el
      catalogo la saca a la capa de arriba, fuera de este elemento. Asi
      que aqui se abre la lista del sistema de estilos, la misma que en
      cualquier otro select.
    */
    & .picker-select-hidden {
      position: absolute;
      inset: 0;
      height: 100%;
      width: 100%;
      opacity: 0;
    }
  }
</style>
