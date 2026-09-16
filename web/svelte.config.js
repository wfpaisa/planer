import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/*
 * Solo hace falta el preprocesador de Vite, que es el que entiende
 * `<script lang="ts">`. No hay `adapter` ni nada de SvelteKit: el panel es una
 * SPA y quien abre el puerto es el servidor Bun (ver `server/index.ts`).
 */
export default { preprocess: vitePreprocess() };
