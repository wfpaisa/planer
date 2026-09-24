/**
 * Los iconos de la plataforma.
 *
 * Son una **fuente tipografica**, no trazados. La hoja declara una
 * regla por icono (`.hgi-stroke.hgi-<nombre>::before { content: "..." }`), así
 * que dibujar uno es escribir su nombre en una clase: ni paquete, ni árbol de
 * SVG en el bundle, ni logica que elegir. El panel la carga en su `index.html`
 * y cada página publicada la recibe con el resto de lo que inyecta el puente
 * (`server/html/htmlBridge.ts`), de modo que quien escribe una pantalla ya la tiene
 * puesta.
 *
 * Antes el catálogo era `@hugeicons/core-free-icons`: seis mil trazados
 * dentro del bundle, seis megabytes. La fuente trae los mismos seis mil y no
 * pesa nada hasta que se usa, y trae los mismos nombres, de modo que un
 * nombre se escribe tal cual: `iconName()` solo tiene que reconocer la forma
 * vieja (`TrashIcon`) de lo que ya esta guardado.
 */

import { ICON_NAME_SET } from "./iconNames.ts";

/**
 * La hoja de estilo que trae la fuente.
 *
 * Los dos archivos --la hoja y el woff2-- viven en `web/public/iconos/` y los
 * sirve Planer, no un CDN: una página publicada no puede depender de que
 * responda el servidor de otro, ni de que le cambien la fuente debajo, y hay
 * servidores sin salida a internet.
 *
 * La copia es la de `use.hugeicons.com`, no la de `cdn.`: son la misma fuente,
 * pero la de `cdn.` se quedo en cuatro mil nombres y esta trae los seis mil del
 * catálogo. En el camino Hugeicons deletreo los digitos que abrian un tramo
 * del nombre (`sorting-1-9` es ahora `sorting-one-9`), y por eso hay dos
 * nombres cambiados en `PAGE_ICONS`.
 */
export const ICON_FONT_URL = "/iconos/iconos.css";

/** Lo que se dibuja cuando el nombre guardado no esta en la fuente. */
export const DEFAULT_ICON = "sidebar-left";

/** Icono de partida de cada tabla en el editor de datos. */
export const DEFAULT_TABLE_ICON = "file-spreadsheet";

/**
 * Convierte cualquier nombre guardado en un nombre de la fuente.
 *
 * Acepta las dos formas que pueden llegar: la de la fuente (`file-spreadsheet`) y la
 * del paquete de antes (`FileSpreadsheet`), que sigue guardada en la base de datos
 * de quien creo una aplicación antes del cambio. Lo que no exista devuelve el
 * icono por defecto, para que un nombre raro nunca deje una pantalla sin
 * icono.
 *
 * Aquí hubo una tabla de equivalencias --`check` a `tick-02`, `trash` a
 * `delete-02`-- para los alias al estilo de Lucide que traia el paquete. Ya no
 * hace falta: la hoja de `use.` trae esos nombres como suyos, así que
 * `check` es un icono de la fuente y no una traduccion. Los nombres se
 * escriben como son.
 */
export function iconName(raw?: string | null): string {
  if (!raw) return DEFAULT_ICON;
  /* Primero tal cual: hay setenta y pico nombres con el digito pegado a la
     letra (`clock2`, `building2`, `axis3d`) que la conversion de abajo
     partiria en dos, dejandolos sin icono. Un nombre de la fuente no se
     toca. */
  if (ICON_NAME_SET.has(raw)) return raw;

  const kebab = raw
    .replace(/Icon$/, "")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Za-z])([0-9])/g, "$1-$2")
    .toLowerCase();

  return ICON_NAME_SET.has(kebab) ? kebab : DEFAULT_ICON;
}

/** Las clases con las que se dibuja un icono ya normalizado. */
export const iconClass = (name: string) => `hgi-stroke hgi-${name}`;

/**
 * Los iconos que se le ofrecen a la inteligencia artificial.
 *
 * La fuente trae seis mil nombres y no caben en el contexto de cada
 * petición: serian mas palabras que todo el resto de las instrucciones
 * juntas, y el modelo elegiria peor, no mejor. Esta es la seleccion --unos
 * trescientos-- de lo que de verdad aparece en una aplicación de empresa:
 * personas, datos, documentos, dinero, tiempo, avisos y poco mas.
 *
 * Van agrupados a propósito, y el contrato los entrega con esos mismos
 * titulos --en ingles, como todo lo que lee el modelo--: al modelo le sirve
 * mas saber que hay una familia de "dinero" que leer trescientos nombres
 * seguidos.
 *
 * Un nombre esta aquí cuando **dibuja algo que los demás no dibujan**. Los
 * nombres llanos que la fuente también trae --`check` junto a `tick-01`,
 * `trash` junto a `delete-02`-- se quedan fuera a propósito: darle dos
 * nombres para el mismo dibujo solo consigue que una pantalla salga con uno
 * en un botón y con el otro en el de al lado. Existen igual, y el marco sabe
 * dibujarlos: estan en `COMMON_ICONS`.
 *
 * No es un limite, es un vademecum: una página puede usar cualquiera de los
 * seis mil nombres de la fuente, y el buscador de iconos del panel los
 * ofrece todos (`ICON_NAMES` en `shared/iconNames.ts`). Lo que la lista
 * resuelve ahora es qué se dibuja al instante: son los nombres del subconjunto
 * pegado en cada marco (`SUBSET_ICONS`). Al modelo ya no se le pasa: busca
 * los nombres con la herramienta `buscar_iconos` (`searchIcons`), sobre los
 * seis mil, y los que quedan fuera del subconjunto los dibuja la fuente
 * completa que el panel le pasa al marco (ver `web/src/lib/planeAssets.ts`).
 *
 * `bun run harness` comprueba que todos existan y que ninguno este dos veces.
 */
export const PAGE_ICONS: readonly { group: string; names: readonly string[] }[] = [
  {
    group: "Navigation and actions",
    names: [
      "home-01",
      "dashboard-square-01",
      "sidebar-left",
      "menu-01",
      "more-horizontal",
      "more-vertical",
      "arrow-left-01",
      "arrow-right-01",
      "arrow-up-01",
      "arrow-down-01",
      "arrow-up-right-01",
      "arrow-expand",
      "arrow-shrink",
      "cancel-01",
      "cancel-circle",
      "tick-01",
      "tick-02",
      "tick-double-01",
      "checkmark-circle-01",
      "add-01",
      "add-circle",
      "minus-sign",
      "remove-circle",
      "search-01",
      "search-remove",
      "filter",
      "filter-reset",
      "sorting-a-z-01",
      "sorting-z-a-01",
      "sorting-one-9",
      "sorting-nine-1",
      "refresh",
      "reload",
      "settings-01",
      "settings-02",
      "preference-horizontal",
      "login-01",
      "logout-01",
      "link-01",
      "link-square-02",
      "unlink-01",
      "share-01",
      "copy-01",
      "clipboard",
      "view",
      "view-off",
      "grid-view",
      "list-view",
      "layout-01",
      "toggle-on",
      "toggle-off",
      "drag-drop",
      "move",
      "repeat",
      "loading-03",
      "chevron-up",
      "chevron-down",
      "chevron-left",
      "chevron-right",
      "expand",
      "collapse",
      "zoom-in",
      "zoom-out",
      "undo",
      "redo",
      "archive",
    ],
  },
  {
    group: "Data and charts",
    names: [
      "database",
      "database-01",
      "database-add",
      "database-export",
      "database-import",
      "file-spreadsheet",
      "csv-01",
      "xls-01",
      "google-sheet",
      "grid-table",
      "chart",
      "chart-bar-line",
      "chart-line-data-01",
      "chart-column",
      "pie-chart",
      "analytics-01",
      "analytics-up",
      "presentation-bar-chart-01",
      "percent",
      "calculator",
      "abacus",
      "layers-01",
      "divide",
      "equal",
      "greater-than",
      "less-than",
    ],
  },
  {
    group: "Documents and files",
    names: [
      "file-01",
      "file-02",
      "file-add",
      "file-edit",
      "file-remove",
      "file-validation",
      "file-attachment",
      "file-export",
      "file-import",
      "file-search",
      "file-upload",
      "folder-01",
      "folder-02",
      "folder-add",
      "folder-open",
      "document-validation",
      "note",
      "note-edit",
      "task-01",
      "task-done-01",
      "checkmark-badge-01",
      "pdf-01",
      "printer",
      "floppy-disk",
      "download-01",
      "upload-01",
      "cloud-upload",
      "cloud-download",
      "delete-02",
      "delete-put-back",
      "edit-02",
      "pencil-edit-02",
      "text-font",
      "paragraph",
      "attachment-01",
      "inbox",
      "text",
      "bold",
      "italic",
      "underline",
      "align-left",
      "align-right",
      "quote",
    ],
  },
  {
    group: "People",
    names: [
      "user",
      "user-account",
      "user-circle",
      "user-multiple",
      "user-group",
      "user-add-01",
      "user-remove-01",
      "user-settings-01",
      "user-search-01",
      "user-lock-01",
      "user-star-01",
      "user-switch",
      "manager",
      "contact-01",
      "id-verified",
      "profile",
      "teacher",
      "permanent-job",
      "customer-service-01",
      "customer-support",
    ],
  },
  {
    group: "Communication",
    names: [
      "mail-01",
      "mail-02",
      "mail-open",
      "mail-send-01",
      "mail-add-01",
      "bubble-chat",
      "bubble-chat-add",
      "message-01",
      "comment-01",
      "notification-01",
      "notification-off-01",
      "call",
      "telephone",
      "smart-phone-01",
      "whatsapp-business",
      "translate",
    ],
  },
  {
    group: "Time",
    names: [
      "calendar-01",
      "calendar-02",
      "calendar-03",
      "calendar-add-01",
      "calendar-check-in-01",
      "calendar-remove-01",
      "clock-01",
      "clock-02",
      "alarm-clock",
      "time-schedule",
      "timer-01",
      "time-half-pass",
      "work-history",
    ],
  },
  {
    group: "Alerts and status",
    names: [
      "alert-01",
      "alert-02",
      "alert-circle",
      "alert-diamond",
      "information-circle",
      "help-circle",
      "question",
      "star",
      "favourite",
      "bookmark-01",
      "flag-01",
      "pin",
      "pin-off",
      "idea-01",
      "target-01",
      "zap",
      "circle",
      "square",
      "triangle",
      "trophy",
      "thumbs-up",
      "thumbs-down",
      "fire",
      "droplet",
    ],
  },
  {
    group: "Security",
    names: [
      "lock",
      "lock-key",
      "square-lock-01",
      "security",
      "security-check",
      "shield-01",
      "shield-key",
      "key-01",
      "key-02",
      "password-validation",
      "fingerprint-scan",
      "qr-code",
      "bar-code-01",
    ],
  },
  {
    group: "Money and commerce",
    names: [
      "shopping-cart-01",
      "shopping-bag-01",
      "package",
      "package-delivered",
      "package-open",
      "delivery-truck-01",
      "delivery-box-01",
      "delivery-tracking-01",
      "invoice-01",
      "invoice-02",
      "money-bag-01",
      "dollar-circle",
      "dollar-square",
      "coins-01",
      "credit-card",
      "wallet-01",
      "payment-success-01",
      "tag-01",
      "discount",
      "discount-tag-01",
      "label",
      "store-01",
      "shop-sign",
      "euro",
      "gift",
      "bank",
    ],
  },
  {
    group: "Places and organisation",
    names: [
      "building-01",
      "building-02",
      "building-03",
      "office",
      "factory-01",
      "hospital-01",
      "school",
      "warehouse",
      "location-01",
      "location-04",
      "maps",
      "location-user-01",
      "route-01",
      "navigation-03",
      "global",
      "globe-02",
      "briefcase-01",
      "job-search",
      "workflow-square-01",
      "hierarchy-square-01",
      "strategy",
    ],
  },
  {
    group: "Media and system",
    names: [
      "image-01",
      "camera-01",
      "video-01",
      "play",
      "mic-01",
      "headphones",
      "code",
      "source-code",
      "code-square",
      "bug-01",
      "command",
      "computer",
      "laptop",
      "cloud",
      "wifi-01",
      "connect",
      "rocket-01",
      "ai-magic",
      "magic-wand-01",
      "artificial-intelligence-04",
      "robotic",
      "ai-brain-01",
      "sun-01",
      "moon-02",
      "book-01",
      "book-open-01",
      "notebook-01",
      "leaf-01",
      "recycle-01",
      "medicine-01",
      "stethoscope",
      "thermometer",
      "pause",
      "stop",
      "volume",
      "music",
      "keyboard",
      "terminal",
      "server",
      "cpu",
      "palette",
      "brush",
      "battery",
      "power",
    ],
  },
] as const;

/**
 * Los nombres llanos, que la fuente también trae.
 *
 * `check`, `trash`, `plus`, `x`: los nombres cortos al estilo de Lucide que
 * Hugeicons declara como suyos, ademas de los numerados (`tick-01`,
 * `delete-02`, `add-01`). No están en `PAGE_ICONS` --serían dos nombres para
 * el mismo dibujo-- pero sí tienen que **existir en el subconjunto**: una página escrita a mano, o por
 * un modelo de antes de que la lista se curara, puede nombrarlos, y en el
 * marco quedaria el hueco en blanco.
 *
 * Lo que el marco dibuja al instante es la unión de las dos listas
 * (`SUBSET_ICONS`); el resto llega con la fuente completa.
 */
export const COMMON_ICONS: readonly string[] = [
  "anchor",
  "at",
  "bell",
  "bluetooth",
  "bolt",
  "box",
  "building",
  "cancel-square",
  "chat",
  "check",
  "cloud-server",
  "copy",
  "cross",
  "crown",
  "dot",
  "eye",
  "eye-off",
  "flower",
  "frown",
  "globe",
  "grid",
  "hammer",
  "hash",
  "heart",
  "info",
  "layers",
  "link",
  "list",
  "magnet",
  "map",
  "menu",
  "minimize",
  "minus",
  "moon",
  "more",
  "pencil",
  "phone",
  "pi",
  "plus",
  "plus-sign",
  "rain",
  "reply",
  "rocket",
  "ruler",
  "save",
  "scissors",
  "send",
  "sigma",
  "smile",
  "table",
  "trash",
  "truck",
  "users",
  "x",
];

/**
 * Los iconos que lleva dentro el subconjunto de la fuente.
 *
 * Es lo que `scripts/iconos-subconjunto.ts` recorta del woff2 completo y lo
 * que el marco de una página sabe dibujar (ver `SUBSET_FONT_URL`). La union
 * de las dos listas: lo que se le sugiere al modelo y los nombres llanos que
 * puede traer una página ya escrita.
 */
export const SUBSET_ICONS: readonly string[] = [
  ...new Set([...PAGE_ICONS.flatMap((g) => g.names), ...COMMON_ICONS]),
];

/**
 * La hoja del subconjunto: las mismas reglas, con la fuente pegada dentro.
 *
 * El marco de una página es un `srcdoc` sin `allow-same-origin`, y desde un
 * origen opaco el navegador no alcanza el servidor: la hoja de `/iconos/`
 * ni se llega a pedir y la página sale con los iconos en blanco. Antes no se
 * notaba porque la hoja era la del CDN --una dirección publica con CORS, que
 * si pasa--; al traerla a casa dejo de pasar.
 *
 * Así que al marco la fuente le entra pegada, igual que los estilos y el
 * puente (ver `web/src/lib/planeAssets.ts`). Pegar las seis mil serian 1,2 MB
 * de texto en cada `srcdoc`; recortada a los nombres de `SUBSET_ICONS` son
 * unas setenta veces menos. Un icono fuera del subconjunto no se queda en
 * blanco: el panel pega sus reglas y le pasa al marco la fuente completa por
 * mensaje (`FULL_FONT_FILE`). Fuera del marco --una página abierta en su
 * dirección-- sigue valiendo la hoja completa de `ICON_FONT_URL`.
 *
 * Se regenera con `bun run iconos:subconjunto`.
 */
export const SUBSET_FONT_URL = "/iconos/comunes.css";

/**
 * La fuente entera, en binario. El marco no la alcanza por su cuenta (origen
 * opaco), así que se la pasa el panel por mensaje, ya cargada, solo cuando la
 * página nombra un icono que el subconjunto no dibuja. Ver `planeAssets.ts`.
 */
export const FULL_FONT_FILE = "/iconos/iconos.woff2";

/**
 * Buscar iconos por palabras, sobre los 6228 nombres de la fuente.
 *
 * Es lo que usa la IA en lugar de recibir una lista: cada palabra de la
 * consulta puntúa por separado --nombre exacto, una parte del nombre igual,
 * una parte que empieza así, o la palabra en cualquier sitio-- y se suman. Un
 * nombre corto gana a uno largo con la misma coincidencia: `user` antes que
 * `user-account-circle-02`.
 */
export function searchIcons(query: string, limit = 24): string[] {
  const words = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1);
  if (!words.length) return [];

  const scored: { name: string; score: number }[] = [];
  for (const name of ICON_NAME_SET) {
    const parts = name.split("-");
    let score = 0;
    for (const word of words) {
      if (name === word) score += 100;
      else if (parts.includes(word)) score += 40;
      else if (
        parts.some((part) => part.startsWith(word) || (word.startsWith(part) && part.length > 3))
      )
        score += 20;
      else if (name.includes(word)) score += 8;
    }
    if (score) scored.push({ name, score: score - parts.length });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.name.length - b.name.length)
    .slice(0, Math.max(1, Math.min(limit, 60)))
    .map((item) => item.name);
}
