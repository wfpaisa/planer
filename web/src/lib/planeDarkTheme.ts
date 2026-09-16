import type * as monacoNs from "monaco-editor";

/**
 * El esquema de color resuelto del documento, que el tema activo fija con color-scheme.
 *
 * Al dia lo mantiene `lib/colorScheme.svelte.ts`: esto es la lectura de una
 * vez, sin nada que vigilar.
 */
export function resolvedScheme(): "light" | "dark" {
  return getComputedStyle(document.documentElement).colorScheme === "dark" ? "dark" : "light";
}

/** El nombre del tema de Monaco que corresponde al esquema resuelto. */
export function monacoTheme(scheme: "light" | "dark"): string {
  return scheme === "dark" ? "plane-dark" : "vs";
}

export function definePlaneTheme(instance: typeof monacoNs): void {
  instance.editor.defineTheme("plane-dark", {
    base: "vs-dark",
    inherit: true,

    colors: {
      "editor.background": "#0d0d0e",
      "editor.foreground": "#E6E8EF",
      "editorCursor.foreground": "#AEAFAD",
      "editor.lineHighlightBackground": "#FFFFFF08",
      "editor.selectionBackground": "#E8F2F334",
      "editor.inactiveSelectionBackground": "#C7D3FF11",
      "editor.findMatchBackground": "#FFF07C51",
      "editor.findMatchHighlightBackground": "#E6E8EF40",
      "editorBracketMatch.background": "#FDF90027",
      "editorLineNumber.foreground": "#E6E8EF1B",
      "editorLineNumber.activeForeground": "#E6E8EF5E",

      // 👇 GUÍAS DE INDENTACIÓN - INACTIVAS (casi transparentes ~8%)
      "editorIndentGuide.background": "#FFFFFF0D",
      "editorIndentGuide.background1": "#B486FF14", // 8% opacidad
      "editorIndentGuide.background2": "#22DDCC14",
      "editorIndentGuide.background3": "#6BD5FE14",
      "editorIndentGuide.background4": "#FFF1CC14",
      "editorIndentGuide.background5": "#B486FF14",
      "editorIndentGuide.background6": "#22DDCC14",

      // 👇 GUÍAS DE INDENTACIÓN - ACTIVAS (~20%, alfa si se respeta)
      "editorIndentGuide.activeBackground": "#FFFFFF33",
      "editorIndentGuide.activeBackground1": "#B486FF33",
      "editorIndentGuide.activeBackground2": "#22DDCC33",
      "editorIndentGuide.activeBackground3": "#6BD5FE33",
      "editorIndentGuide.activeBackground4": "#FFF1CC33",
      "editorIndentGuide.activeBackground5": "#B486FF33",
      "editorIndentGuide.activeBackground6": "#22DDCC33",

      // 👇 GUÍAS DE PARES DE BRACKETS
      // Son otras claves (editorBracketPairGuide.*), no las de indentacion.
      // La activa se pinta opaca si no se define; con alfa se ve semi transparente.
      "editorBracketPairGuide.background1": "#B486FF2E",
      "editorBracketPairGuide.background2": "#22DDCC2E",
      "editorBracketPairGuide.background3": "#6BD5FE2E",
      "editorBracketPairGuide.background4": "#B486FF2E",
      "editorBracketPairGuide.background5": "#22DDCC2E",
      "editorBracketPairGuide.background6": "#6BD5FE2E",
      "editorBracketPairGuide.activeBackground1": "#B486FF59",
      "editorBracketPairGuide.activeBackground2": "#22DDCC59",
      "editorBracketPairGuide.activeBackground3": "#6BD5FE59",
      "editorBracketPairGuide.activeBackground4": "#B486FF59",
      "editorBracketPairGuide.activeBackground5": "#22DDCC59",
      "editorBracketPairGuide.activeBackground6": "#6BD5FE59",

      "editorSuggestWidget.background": "#2B2B2B",
      "editorSuggestWidget.foreground": "#E6E8EF",
      "editorSuggestWidget.selectedBackground": "#226CFF63",
      "editorHoverWidget.background": "#2B2B2B",
      "editorHoverWidget.foreground": "#CCCCCC",
      "editorWidget.background": "#2B2B2B",
      "editorWidget.border": "#FFFFFF20",
      "editorGutter.background": "#0d0d0e",
    },

    rules: [
      { token: "tag", foreground: "B486FF" },
      { token: "tag.name", foreground: "B486FF" },
      { token: "delimiter.html", foreground: "E6E8EF" },
      { token: "attribute.name", foreground: "22DDCC" },
      { token: "attribute.value", foreground: "E6E8EF" },
      { token: "string", foreground: "FFF1CC" },
      { token: "string.js", foreground: "FFF1CC" },
      { token: "string.javascript", foreground: "FFF1CC" },
      { token: "keyword", foreground: "B486FF" },
      { token: "keyword.js", foreground: "B486FF" },
      { token: "identifier", foreground: "E6E8EF" },
      { token: "variable", foreground: "E6E8EF" },
      { token: "variable.js", foreground: "E6E8EF" },
      { token: "variable.javascript", foreground: "E6E8EF" },
      { token: "function", foreground: "6BD5FE" },
      { token: "function.js", foreground: "6BD5FE" },
      { token: "function.javascript", foreground: "6BD5FE" },
      { token: "variable.other.property", foreground: "E6E8EF" },
      { token: "type", foreground: "6BD5FE" },
      { token: "number", foreground: "FFFFFF" },
      { token: "constant.numeric", foreground: "FFFFFF" },
      { token: "attribute.value.number.css", foreground: "FFFFFF" },
      { token: "attribute.value.unit.css", foreground: "FFFFFF" },
      { token: "operator", foreground: "E6E8EF" },
      { token: "comment", foreground: "7F8796", fontStyle: "italic" },
    ],
  });
}
