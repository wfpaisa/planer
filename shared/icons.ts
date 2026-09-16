/**
 * Los iconos de la plataforma.
 *
 * Son una **fuente tipografica**, no trazados. La hoja del CDN declara una
 * regla por icono (`.hgi-stroke.hgi-<nombre>::before { content: "..." }`), asi
 * que dibujar uno es escribir su nombre en una clase: ni paquete, ni arbol de
 * SVG en el bundle, ni logica que elegir. El panel la carga en su `index.html`
 * y cada pagina publicada la recibe con el resto de lo que inyecta el puente
 * (`server/htmlBridge.ts`), de modo que quien escribe una pantalla ya la tiene
 * puesta.
 *
 * Antes el catalogo era `@hugeicons/core-free-icons`: seis mil trazados
 * dentro del bundle, seis megabytes. La fuente trae los mismos seis mil y no
 * pesa nada hasta que se usa, y trae los mismos nombres, de modo que un
 * nombre se escribe tal cual: `iconName()` solo tiene que reconocer la forma
 * vieja (`TrashIcon`) de lo que ya esta guardado.
 */

import { ICON_NAME_SET } from "./iconNames.ts";

/**
 * La hoja de estilo que trae la fuente.
 *
 * Es la de `use.hugeicons.com`, no la de `cdn.`: son la misma fuente, pero la
 * de `cdn.` se quedo en cuatro mil nombres y esta trae los seis mil del
 * catalogo. En el camino Hugeicons deletreo los digitos que abrian un tramo
 * del nombre (`sorting-1-9` es ahora `sorting-one-9`), y por eso hay dos
 * nombres cambiados en `PAGE_ICONS`.
 */
export const ICON_FONT_URL = "https://use.hugeicons.com/font/icons.css";

/** Lo que se dibuja cuando el nombre guardado no esta en la fuente. */
export const DEFAULT_ICON = "sidebar-left";

/** Icono de partida de cada tabla en el editor de datos. */
export const DEFAULT_TABLE_ICON = "file-spreadsheet";

/**
 * Convierte cualquier nombre guardado en un nombre de la fuente.
 *
 * Acepta las dos formas que pueden llegar: la de la fuente (`table-01`) y la
 * del paquete de antes (`Table01Icon`), que sigue guardada en la base de datos
 * de quien creo una aplicacion antes del cambio. Lo que no exista devuelve el
 * icono por defecto, para que un nombre raro nunca deje una pantalla sin
 * icono.
 *
 * Aqui hubo una tabla de equivalencias --`check` a `tick-02`, `trash` a
 * `delete-02`-- para los alias al estilo de Lucide que traia el paquete. Ya no
 * hace falta: la hoja de `use.` trae esos nombres como suyos, asi que
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
 * peticion: serian mas palabras que todo el resto de las instrucciones
 * juntas, y el modelo elegiria peor, no mejor. Esta es la seleccion --unos
 * doscientos cuarenta-- de lo que de verdad aparece en una aplicacion de
 * empresa: personas, datos, documentos, dinero, tiempo, avisos y poco mas.
 *
 * Van agrupados a proposito, y el contrato los entrega con esos mismos
 * titulos --en ingles, como todo lo que lee el modelo--: al modelo le sirve mas saber que hay una familia de "dinero" que
 * leer doscientos nombres seguidos.
 *
 * No es un limite, es un vademecum: una pagina puede usar cualquiera de los
 * seis mil nombres de la fuente, y el buscador de iconos del panel los
 * ofrece todos (`ICON_NAMES` en `shared/iconNames.ts`). Lo que la lista
 * resuelve es otra cosa: el modelo no puede comprobar si un nombre existe, y
 * uno inventado no da error --deja un hueco en blanco--, asi que se le dan
 * doscientos y pico sobre los que no tiene que adivinar.
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
      "sidebar-left",
      "toggle-on",
      "toggle-off",
      "drag-drop",
      "move",
      "repeat",
      "loading-03",
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
      "table-01",
      "table-02",
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
    ],
  },
] as const;
