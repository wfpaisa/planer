/**
 * Mover un elemento al final del documento.
 *
 * Sustituye a `createPortal`. Hace falta por lo mismo que hacia falta alli: un
 * modal abierto desde dentro de una cuadricula que se aisla quedaria encerrado
 * en su capa, y un aviso dibujado dentro de una columna estrecha se recorta.
 *
 * El elemento se saca del sitio donde esta escrito, pero sigue siendo suyo:
 * Svelte lo sigue actualizando y lo destruye cuando toque.
 */
export function portal(node: HTMLElement, target: HTMLElement | string = document.body) {
  let host: HTMLElement | null = null;

  const attach = (to: HTMLElement | string) => {
    host = typeof to === "string" ? document.querySelector<HTMLElement>(to) : to;
    host?.appendChild(node);
  };

  attach(target);

  return {
    update(to: HTMLElement | string) {
      attach(to);
    },
    destroy() {
      if (node.parentNode === host) host?.removeChild(node);
    },
  };
}
