<!--
  El editor de codigo del panel.

  Monaco, montado a mano. El envoltorio de React que habia antes hacia tres
  cosas: cargar el modulo, crear la instancia y mantenerla al dia con lo que
  llegaba por props. Las tres caben aqui en menos de cien lineas, y a cambio
  desaparece una dependencia que traia su propia forma de cargar el editor
  desde una CDN.

  Lo que no es negociable es el orden: el tema se define antes de crear la
  instancia, porque crearla con un tema que todavia no existe deja el editor en
  blanco hasta el primer cambio.
-->
<script lang="ts">
  import type { editor } from "monaco-editor";
  import { untrack } from "svelte";

  import { colorScheme } from "../lib/colorScheme.svelte";
  import { loadMonaco } from "../lib/monaco";
  import { definePlaneTheme, monacoTheme } from "../lib/planeDarkTheme";

  let {
    value,
    language = "html",
    readOnly = false,
    onChange,
  }: {
    value: string;
    language?: string;
    readOnly?: boolean;
    /** Lo escrito, con cada pulsacion. Sin esto el editor es de solo lectura. */
    onChange?: (next: string) => void;
  } = $props();

  let host = $state<HTMLDivElement | null>(null);
  let instance: editor.IStandaloneCodeEditor | null = null;
  /**
   * Lo ultimo que salio de aqui.
   *
   * Quien nos usa guarda lo escrito en su propio estado y nos lo devuelve por
   * `value`. Sin esta marca, esa vuelta se leeria como un valor de fuera y se
   * escribiria en el modelo, que mueve el cursor al final en cada tecla.
   */
  let mine = "";

  /*
   * Crear el editor depende solo del hueco donde vive. Todo lo demas se lee
   * con `untrack` a proposito: son los valores de partida, y mantenerlos al
   * dia es cosa de los dos efectos de abajo. Sin eso, escribir una letra
   * volveria a montar el editor entero.
   */
  $effect(() => {
    if (!host) return;
    const where = host;
    /*
     * Monaco llega por `import()`, asi que entre pedirlo y tenerlo puede pasar
     * cualquier cosa --cerrar el panel, cambiar de pagina--. `alive` es lo que
     * evita crear un editor dentro de un hueco que ya no esta en el documento.
     */
    let alive = true;
    let created: editor.IStandaloneCodeEditor | null = null;
    let sub: { dispose: () => void } | null = null;

    void loadMonaco().then((monaco) => {
      if (!alive) return;
      definePlaneTheme(monaco);
      created = monaco.editor.create(where, {
        value: untrack(() => value),
        language: untrack(() => language),
        readOnly: untrack(() => readOnly),
        theme: monacoTheme(untrack(() => colorScheme.value)),
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 12.5,
        tabSize: 2,
        wordWrap: "on",
        scrollBeyondLastLine: false,
      });
      instance = created;
      sub = created.onDidChangeModelContent(() => {
        mine = created?.getValue() ?? "";
        onChange?.(mine);
      });
    });

    return () => {
      alive = false;
      sub?.dispose();
      created?.getModel()?.dispose();
      created?.dispose();
      instance = null;
    };
  });

  // Un valor que viene de fuera --se cargo el documento, se volvio a generar--
  // se escribe entero. Lo que acaba de salir de aqui, no: ver `mine`.
  $effect(() => {
    const next = value;
    if (!instance || next === mine) return;
    if (instance.getValue() === next) return;
    instance.setValue(next);
  });

  $effect(() => {
    instance?.updateOptions({ theme: monacoTheme(colorScheme.value), readOnly });
  });
</script>

<div class="editor-code h-full w-full" bind:this={host}></div>
