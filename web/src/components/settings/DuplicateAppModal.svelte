<!--
  El nombre de la copia, antes de hacerla.

  Se pregunta y no se pone solo porque el nombre es lo único que distingue a
  dos aplicaciones iguales en el tablero: con "(copia)" detras, duplicar dos
  veces deja "Inventario (copia)" e "Inventario (copia) 2" y hay que entrar en
  cada una para saber cual es cual. Se propone ese nombre igualmente, así que
  quien solo quiera una copia rápida pulsa Enter y ya.

  El enlace no se pregunta: sale del nombre, como en cualquier aplicación. Lo
  que se enseña debajo es a donde va a ir a parar, con la salvedad de que si ya
  lo tiene otra, el servidor le pone un número detras.
-->
<script lang="ts">
  import { slugify } from "@shared/types";

  import { Button, Field, Input, Modal } from "../ui";

  let {
    open,
    name: original,
    datos,
    busy = false,
    onClose,
    onConfirm,
  }: {
    open: boolean;
    /** Nombre de la aplicación que se va a copiar. */
    name: string;
    /** La copia se lleva las filas. Solo para contarlo aquí. */
    datos: boolean;
    busy?: boolean;
    onClose: () => void;
    onConfirm: (name: string) => void;
  } = $props();

  let name = $state("");

  /*
   * El nombre propuesto se repone cada vez que el modal se abre, y no una sola
   * vez al montarlo: el modal vive en la pantalla aunque este cerrado, así que
   * sin esto la segunda vez se abriria con lo que se escribio la primera.
   */
  $effect(() => {
    if (open) name = `${original} (copia)`;
  });

  const link = $derived(slugify(name, "..."));
  const ready = $derived(name.trim().length > 0 && !busy);
</script>

<Modal
  id="duplicate-app-modal"
  class="modal-duplicate-app"
  {open}
  {onClose}
  title="Duplicar aplicación"
  description={datos
    ? "La copia se lleva las tablas, las pantallas, todo lo que hay dentro y las personas invitadas con sus roles."
    : "La copia se lleva las tablas y las pantallas, vacías: sin las filas, sin los adjuntos y sin nadie invitado."}
>
  <!-- Lo que falle se dice en el aviso de la pantalla, que se dibuja por
       encima del modal: repetirlo aquí dentro sacaria el mismo texto dos
       veces. Ver `Note.svelte`. -->
  <Field label="Nombre de la copia" hint="Se abrirá en /p/{link}">
    <Input
      autofocus
      bind:value={name}
      placeholder="{original} (copia)"
      onkeydown={(e) => e.key === "Enter" && ready && onConfirm(name)}
    />
  </Field>

  {#snippet footer()}
    <Button onclick={onClose} disabled={busy}>Cancelar</Button>
    <Button
      variant="secondary"
      buttonClass="btn-confirm-duplicate-app"
      loading={busy}
      disabled={!ready}
      onclick={() => onConfirm(name)}
    >
      Duplicar
    </Button>
  {/snippet}
</Modal>
