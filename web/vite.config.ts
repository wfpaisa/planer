import { fileURLToPath } from "node:url";

import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const target = `http://127.0.0.1:${process.env.PORT ?? 3000}`;

export default defineConfig({
  root: here("."),
  // En desarrollo, que el navegador senale el CSS original en vez de la
  // etiqueta <style> inyectada sin origen.
  css: { devSourcemap: true },
  plugins: [svelte()],
  resolve: {
    alias: {
      "@": here("./src"),
      "@shared": here("../shared"),
    },
  },
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    // La pagina puede llegar por el puerto del servidor; la recarga en vivo
    // se conecta siempre al puerto de Vite.
    hmr: { clientPort: Number(process.env.WEB_PORT ?? 5173) },
    proxy: {
      "/api": { target, changeOrigin: true },
      "/pb": { target, changeOrigin: true },
    },
  },
  build: {
    outDir: here("./dist"),
    emptyOutDir: true,
    // Mapas de fuentes del bundle compilado: el servidor de estaticos los
    // entrega desde /assets/ y el navegador apunta al codigo real.
    sourcemap: true,
  },
});
