/**
 * Valores dentro de un filtro de PocketBase.
 *
 * Un filtro se escribe como texto (`app = "abc123"`), asi que todo valor que
 * venga de fuera --un id que manda una pagina, un correo que se escribe en el
 * panel-- tiene que entrar escapado. Se escapan las dos cosas que PocketBase
 * lee como sintaxis dentro de una cadena: la barra invertida, que escapa al
 * caracter siguiente, y la comilla, que la cierra.
 *
 * La barra va primero, y no es un detalle: escapando solo la comilla, un valor
 * como `ab\"` sale como `ab\\"` --barra escapada mas comilla-- y la cadena se
 * cierra donde el valor todavia seguia. A partir de ahi lo que quedaba del
 * valor se lee como filtro: en el mejor caso la consulta no compila, y en el
 * peor dice algo que nadie escribio.
 *
 * Vive aqui y no copiado en cada archivo porque antes habia nueve copias de
 * media linea, y las nueve escapaban de menos.
 */
export const quote = (value: string): string =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
