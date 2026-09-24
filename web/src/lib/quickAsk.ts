/**
 * Los atajos y los ejemplos del panel de la IA.
 *
 * Es texto, no pantalla: vive aparte del componente porque lo lee mas de un
 * sitio --la portada y el menu del compositor-- y porque el pedido en ingles
 * es largo y se revisa solo, sin nada de dibujado alrededor.
 */

/*
 * Peticiones ya redactadas, a un clic: mandan de una vez, sin pasar por el
 * campo de texto ni por el botón de enviar. Cada una es un atajo, y la IA
 * recibe el mismo pedido bien dicho cada vez.
 *
 * El rotulo es lo único que se ve en la burbuja del turno: va en espanol. El
 * pedido en si no se enseña nunca --viaja como el texto de la petición, pero
 * la burbuja muestra el rotulo en su lugar-- y va en ingles, como el resto de
 * lo que lee el modelo.
 *
 * El de la apariencia no enseña nada nuevo: el contrato entero
 * (`shared/htmlContract.ts`) viaja de sistema en cada petición, así que el
 * modelo ya tiene delante como se ve una pantalla de la casa. Lo que hace la
 * lista es otra cosa: obligar a recorrer punto por punto lo que en un repaso
 * suelto se mira por encima. Por eso sigue el orden de las secciones del
 * contrato, y por eso hay que anadirle el punto cuando al contrato le entra
 * una regla nueva: una regla que no esta en la lista es una regla que este
 * atajo no repasa.
 */
export const QUICK_ASK = {
  apariencia: {
    label: "Mejorar apariencia",
    /** Nombre de Hugeicons: el rasgo que distingue a este atajo de los demás. */
    icon: "brush-cleaning",
    prompt:
      'First read consultar_guia with tema colores, then medidas, then oficio (one call each). Leave this screen looking like the rest of the house, following the "Colours", "Spacing and type" and "What a Planer screen looks like" sections. ' +
      "Do not change the content, the data or what it does: only how it looks. " +
      "Go through these one by one and fix the ones that fail: " +
      "(1) colours and measurements only through the platform variables, no hard-coded values and no variables outside the closed list; " +
      "(2) a clear hierarchy, with the header and the main figure ahead of the rest; " +
      "(3) more air between sections and inside the cards; " +
      "(4) fewer boxes: group with space and type, and take out the cards inside cards; " +
      "(5) `--color-secondary` for the buttons, the links and anything that gets clicked, `--color-primary` only for what identifies, and the colour spent on one thing per screen with everything else in ink; " +
      '(6) the emojis replaced by icons from the platform font (`<i class="hgi-stroke hgi-name"></i>`), with names taken from the safe list, never SVG paths and never an icon library; ' +
      '(7) the table with no vertical rules and a row hover, its figures in `class="number"` (never `class="num"`, which does not exist) with your own `style="text-align: right"` on the numeric column since the catalogue does not align it for you, and its row actions as `.mini-btn`; ' +
      "(8) the three states resolved: loading placeholder, empty and error; " +
      "(9) the screen holding up narrow: grids with `auto-fit`, no fixed `px` on a container, a wide table wrapped in `overflow-x: auto`; " +
      "(10) short transitions on named properties, never on `all`, `prefers-reduced-motion` respected, and a visible `:focus-visible` on everything focusable; " +
      "(11) nothing left from what is not done: decorative gradients, coloured shadows, thick borders, more than two typefaces, faint text on a faint background. " +
      "If the screen has charts, leave the series colours alone --no hex values and no variables in the configuration-- and keep the text around them in ink, not in the colour of a series. " +
      "It has to hold up in both modes, light and dark: the colours already come resolved for the mode being viewed, so check that nothing is hard-coded that would break in the other one. " +
      "Keep any colours of its own that already mean something (a traffic light, a status, a group). " +
      "Finish with one line, in Spanish, saying what you changed and what you left alone.",
  },
} as const;

export type QuickAskId = keyof typeof QUICK_ASK;

export const QUICK_ASK_IDS = Object.keys(QUICK_ASK) as QuickAskId[];

/*
 * Ejemplos para la portada. No se envian solos: llenan el campo de texto para
 * que se lean, se corrijan y se manden --o se borren-- como cualquier otra
 * petición. Ensenan de que tamaño es un pedido que la IA entiende bien.
 */
export const SAMPLES = [
  "Una pantalla con la lista de clientes y un buscador",
  "Añade un formulario para registrar un pedido",
  "Pon arriba tres tarjetas con los totales del mes",
];
