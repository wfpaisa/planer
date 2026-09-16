import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Lo que no es nuestro: dependencias, el build del panel y PocketBase.
  { ignores: ["node_modules", "web/node_modules", "web/dist", "pb"] },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs["flat/recommended"],

  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      // Heredado de Biome: los "any" se señalan pero no cortan el lint.
      "@typescript-eslint/no-explicit-any": "warn",
      // TypeScript ya revisa nombres no definidos; no-undef se confunde
      // con los tipos del DOM dentro de los componentes.
      "no-undef": "off",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          caughtErrors: "all",
          // `const { campos, ...rest } = x` descarta "campos" a proposito.
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },

  // Este codigo actualiza Sets creando una copia nueva (`selected = new Set(...)`)
  // en vez de mutarlos; exigir SvelteSet cambiaria el patron de todo el panel.
  {
    rules: {
      "svelte/prefer-svelte-reactivity": "off",
      // Un literal con escapes (`{"\u00a0"}`) no se puede escribir como texto
      // plano: el componente recortaria el espacio.
      "svelte/no-useless-mustaches": ["error", { ignoreStringEscape: true }],
    },
  },

  // El script de un .svelte (y los módulos .svelte.ts) los parsea
  // typescript-eslint, no el parser de JavaScript.
  {
    files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".svelte"],
      },
    },
  },

  // Prettier formatea; ESLint solo busca problemas, nunca discute el estilo.
  prettier,
  ...svelte.configs["flat/prettier"],
);
