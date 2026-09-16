/**
 * El catalogo de paletas.
 *
 * Son las 46 de `web/src/styles/palettes.css`, en el mismo orden y con los
 * mismos ids: quien elige una aqui, alla encuentra sus cuatro colores. Va en
 * `shared/` porque el servidor tambien lo consulta, para validar lo que le
 * llega en el tema de una aplicacion (`sanitizeTheme` en `server/routes.ts`).
 *
 * Los grupos son tres y su orden es el del selector:
 */
export type PaletteGroup = "vivid" | "pastel" | "mono";

export interface PaletteInfo {
  /** El id que viaja en `data-palette`. */
  id: string;
  /** Como se llama en el selector. */
  name: string;
  group: PaletteGroup;
}

/** El nombre de cada grupo, tal como se lee en el selector. */
export const PALETTE_GROUPS: readonly { id: PaletteGroup; label: string }[] = [
  { id: "vivid", label: "Vivos" },
  { id: "pastel", label: "Pasteles" },
  { id: "mono", label: "Monocromos" },
];

export const PALETTES: readonly PaletteInfo[] = [
  { id: "electrico", name: "Eléctrico", group: "vivid" },
  { id: "tropico", name: "Trópico", group: "vivid" },
  { id: "frambuesa", name: "Frambuesa", group: "vivid" },
  { id: "bosque", name: "Bosque neón", group: "vivid" },
  { id: "lava", name: "Lava", group: "vivid" },
  { id: "cyberpunk", name: "Cyberpunk", group: "vivid" },
  { id: "v-solar", name: "Solar", group: "vivid" },
  { id: "v-naranja", name: "Naranja", group: "vivid" },
  { id: "v-ambar", name: "Ámbar", group: "vivid" },
  { id: "v-lima", name: "Lima", group: "vivid" },
  { id: "v-esmeralda", name: "Esmeralda", group: "vivid" },
  { id: "v-turquesa", name: "Turquesa", group: "vivid" },
  { id: "v-oceano", name: "Océano", group: "vivid" },
  { id: "v-violeta", name: "Violeta", group: "vivid" },
  { id: "v-carmin", name: "Carmín", group: "vivid" },

  { id: "algodon", name: "Algodón", group: "pastel" },
  { id: "durazno", name: "Durazno", group: "pastel" },
  { id: "cielo", name: "Cielo", group: "pastel" },
  { id: "salvia", name: "Salvia", group: "pastel" },
  { id: "lavanda", name: "Lavanda", group: "pastel" },
  { id: "vainilla", name: "Vainilla", group: "pastel" },
  { id: "p-coral", name: "Coral", group: "pastel" },
  { id: "p-limon", name: "Limón", group: "pastel" },
  { id: "p-pistacho", name: "Pistacho", group: "pastel" },
  { id: "p-menta", name: "Menta", group: "pastel" },
  { id: "p-aguamarina", name: "Aguamarina", group: "pastel" },
  { id: "p-nube", name: "Nube", group: "pastel" },
  { id: "p-lila", name: "Lila", group: "pastel" },
  { id: "p-chicle", name: "Chicle", group: "pastel" },
  { id: "p-cuarzo", name: "Cuarzo", group: "pastel" },

  { id: "mono-red", name: "Rojo", group: "mono" },
  { id: "mono-orange", name: "Naranja", group: "mono" },
  { id: "mono-amber", name: "Ámbar", group: "mono" },
  { id: "mono-yellow", name: "Amarillo", group: "mono" },
  { id: "mono-lime", name: "Lima", group: "mono" },
  { id: "mono-green", name: "Verde", group: "mono" },
  { id: "mono-emerald", name: "Esmeralda", group: "mono" },
  { id: "mono-teal", name: "Turquesa", group: "mono" },
  { id: "mono-sky", name: "Cielo", group: "mono" },
  { id: "mono-blue", name: "Azul", group: "mono" },
  { id: "mono-indigo", name: "Índigo", group: "mono" },
  { id: "mono-violet", name: "Violeta", group: "mono" },
  { id: "mono-purple", name: "Púrpura", group: "mono" },
  { id: "mono-pink", name: "Rosa", group: "mono" },
  { id: "mono-rose", name: "Carmín", group: "mono" },
  { id: "mono-slate", name: "Pizarra", group: "mono" },
] as const;

/** El id de la paleta escrita a mano. */
export const CUSTOM_PALETTE = "custom";

const IDS = new Set(PALETTES.map((p) => p.id));

/** Si es un id del catalogo (el `custom` no cuenta: va aparte). */
export function isPaletteId(id: unknown): id is string {
  return typeof id === "string" && IDS.has(id);
}
