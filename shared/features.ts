/**
 * Listado oficial de funcionalidades que aparecen en el README.
 *
 * Es la unica fuente de verdad: si se anade o se quita una funcionalidad
 * se refleja aca y se regenera la seccion del README con `bun run docs`.
 *
 * El orden de los grupos y de los puntos dentro de cada grupo es el orden
 * en que aparecen en el README. Mantenerlo asi ayuda a que diffs pequenos
 * (anadir una funcionalidad) produzcan diffs pequenos en el archivo.
 */
export interface FeatureGroup {
  /** Titulo del grupo. Aparece como una subseccion dentro de "Funcionalidades". */
  titulo: string;
  /** Frase breve que explica para que sirve este grupo en lenguaje de a pie. */
  resumen: string;
  /** Items que se enumeran debajo del resumen. */
  items: string[];
}

export const FEATURES: FeatureGroup[] = [
  {
    titulo: "Crea páginas con inteligencia artificial",
    resumen:
      "Si no sabes por dónde empezar, describe lo que necesitas con tus palabras y la IA se encarga del resto.",
    items: [
      'Escribe una frase como "quiero una página para llevar el inventario del almacén" y la IA crea las tablas y las pantallas listas para usar.',
      "Antes de aplicar nada, la IA te muestra una vista previa. Tú decides si lo guardas o si prefieres ajustar algo.",
      "Puedes usar Claude (el modelo de Anthropic) o cualquier servicio compatible con ChatGPT, como Ollama, LM Studio u OpenRouter. Eliges el que prefieras desde Ajustes.",
      "La clave del modelo se guarda en tu servidor y nunca llega al navegador, así que nadie más puede verla.",
    ],
  },
  {
    titulo: "Administra tus Base de datos visualmente",
    resumen:
      "Las tablas se ven y se editan como una hoja de cálculo: agregar, borrar, buscar, importar y exportar sin tocar código.",
    items: [
      "Crea tablas nuevas, renombra las que ya tienes, cambia el orden de las columnas, ajusta su ancho o escóndelas si no las necesitas en este momento.",
      "Borra varios registros a la vez marcándolos en la grilla, sin tener que ir uno por uno.",
      "Importa datos desde un archivo (CSV o JSON) y exporta lo que tienes a un archivo para llevártelo a otro lado.",
      "Antes de importar, la herramienta te muestra un resumen de lo que va a cambiar para que nada te tome por sorpresa.",
      "Las tablas admiten 11 tipos de columna: texto corto, texto largo, números, sí/no, correos, enlaces, fechas, listas de opciones, archivos, relaciones con otras tablas y personas.",
      "Una columna de tipo persona puede marcar al dueño de cada fila: así, si quieres, cada invitado sólo ve y edita sus propios registros.",
      "Si renombras una columna, los datos que ya tenías no se pierden: el sistema recuerda la identidad interna de cada campo.",
    ],
  },
  {
    titulo: "Arma pantallas por bloques",
    resumen:
      "Las páginas se construyen apilando bloques ya hechos. No hay que programar nada, sólo elegir y configurar.",
    items: [
      "Bloques disponibles: Tabla con buscador, Tarjetas, Formulario, Ficha, Indicadores y Texto.",
      "Cada bloque se conecta a una de tus tablas y tú eliges qué columnas muestra, cómo se ordenan y qué se puede buscar.",
      "Si ninguno de los bloques te sirve, puedes escribir la página en HTML a tu medida. La plataforma te da todo lo que necesitas (datos, colores, gráficas) en un contrato cerrado. La guía completa de cómo escribir páginas en HTML está en [docs/PAGINAS-HTML.md](./docs/PAGINAS-HTML.md).",
    ],
  },
  {
    titulo: "Publica tu app y compártela",
    resumen:
      "Cuando la app está lista, la publicas con un enlace. Tú decides si la ve todo el mundo o sólo personas invitadas.",
    items: [
      "Enlace público: cualquiera con el enlace puede ver la app, pero no puede modificarla.",
      "Enlace privado: sólo entran las personas que tú invites, con una cuenta propia.",
      "Cada invitado puede tener uno de tres niveles: ver, editar o administrar.",
      "Además del nivel, puedes crear roles con nombre libre (Conductor, Supervisor, Vendedor...) y decidir, para cada página y cada bloque, qué roles pueden verlo.",
      "Tu app tiene una página de inicio y un menú lateral. Tú decides qué página abre primero y de qué lado queda el menú.",
      "Personaliza la apariencia: nombre, icono, color principal y una paleta de colores para los rótulos de las columnas. Funciona en modo claro y oscuro.",
    ],
  },
  {
    titulo: "Vuelve atrás cuando quieras",
    resumen:
      "Todos los cambios importantes dejan una versión guardada. Si algo no salió como esperabas, regresas al estado anterior en un clic.",
    items: [
      "Cada vez que publicas, queda guardada la versión que estaba en producción.",
      "También puedes guardar una versión manual en cualquier momento, por ejemplo, antes de hacer un cambio grande.",
      "El listado de versiones muestra qué cambió en cada una y te deja restaurarla para dejarla activa de nuevo.",
    ],
  },
  {
    titulo: "Instalación simple, un solo puerto",
    resumen:
      "No hay servicios externos ni piezas sueltas: Planer corre en tu propio servidor con un único comando.",
    items: [
      "Para empezar, un solo comando: bun run setup. Para arrancar cada vez, bun run dev.",
      "Todo corre en el mismo puerto (3000): el panel, las apps publicadas y la base de datos.",
      "La base de datos (PocketBase) viene incluida y se inicia sola como parte del servidor. No tienes que instalar nada aparte.",
      "Las reglas de acceso se aplican en la base de datos, no en el navegador. Eso significa que un invitado no puede, ni intentándolo, ver registros que no le corresponden.",
      "Incluye una prueba de humo (bun run smoke) que recorre todo el camino: crear app, agregar tablas, publicar e invitar a alguien. Sirve para comprobar que la instalación está sana.",
    ],
  },
];

/**
 * Devuelve el markdown de la seccion "Funcionalidades" del README.
 * Lo escribe `scripts/docs.ts` entre las marcas `<!-- generado:features -->`
 * y `<!-- fin:features -->`.
 */
export function buildFeaturesSection(): string {
  const lines: string[] = [];
  for (const grupo of FEATURES) {
    lines.push(`### ${grupo.titulo}`);
    lines.push("");
    lines.push(grupo.resumen);
    lines.push("");
    for (const item of grupo.items) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
