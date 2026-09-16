/**
 * Monaco, traido solo cuando hace falta.
 *
 * Un panel autoalojado no puede cargar el editor de una CDN --eso hacia el
 * envoltorio de React que habia antes-- asi que se usa la copia local de
 * `monaco-editor` y sus trabajadores los empaqueta Vite.
 *
 * Y se trae con `import()`, no de entrada: Monaco pesa mas de cuatro megas con
 * todos sus lenguajes, y la mayoria de quien abre el panel no toca el codigo de
 * ninguna pagina. Puesto arriba del todo se lo tragaria cualquiera que entre a
 * la pantalla de inicio. Asi el peso lo paga quien abre el editor de codigo, y
 * la primera vez nada mas: la promesa se guarda.
 *
 * Quien quiera dibujar un editor no llama a esto: usa
 * `components/CodeEditor.svelte`, que ya lo espera.
 */
import type * as monacoNs from "monaco-editor";

let pending: Promise<typeof monacoNs> | null = null;

export function loadMonaco(): Promise<typeof monacoNs> {
  pending ??= (async () => {
    const [monaco, { default: EditorWorker }, { default: HtmlWorker }] = await Promise.all([
      import("monaco-editor"),
      import("monaco-editor/editor/editor.worker.js?worker"),
      import("monaco-editor/language/html/html.worker.js?worker"),
    ]);

    self.MonacoEnvironment = {
      getWorker(_workerId: string, label: string): Worker {
        switch (label) {
          case "html":
          case "handlebars":
          case "razor":
            return new HtmlWorker();
          default:
            return new EditorWorker();
        }
      },
    };

    return monaco;
  })();
  return pending;
}
