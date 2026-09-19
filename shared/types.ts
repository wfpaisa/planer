/**
 * Tipos compartidos entre el servidor y el panel.
 * Todo lo que viaja por la red esta descrito aqui.
 */
import type { AppTheme } from "./brand.ts";

/**
 * Tipos de columna que puede crear el usuario.
 *
 * Apuntar a otra tabla es una sola cosa, `relation`, se apunte a donde se
 * apunte. La tabla de personas de la aplicacion es una tabla destino mas: no
 * hay un tipo aparte para ella.
 */
export type FieldType =
  | "text"
  | "longtext"
  | "number"
  | "bool"
  | "email"
  | "url"
  | "date"
  | "select"
  | "file"
  | "relation";

/**
 * Los mismos tipos, para comprobarlos en tiempo de ejecucion.
 *
 * Hace falta donde un tipo llega de fuera --lo que propone la IA, lo que
 * contesta el dialogo de impacto-- y el tipo de TypeScript ya no esta. El
 * `satisfies` es lo que hace que anadir un tipo arriba y olvidarse de esta
 * lista no compile.
 */
export const FIELD_TYPES = [
  "text",
  "longtext",
  "number",
  "bool",
  "email",
  "url",
  "date",
  "select",
  "file",
  "relation",
] as const satisfies readonly FieldType[];

/** Si un valor cualquiera nombra un tipo de columna. */
export function isFieldType(value: unknown): value is FieldType {
  return typeof value === "string" && (FIELD_TYPES as readonly string[]).includes(value);
}

export interface FieldDef {
  /** Id interno de la columna. Lo asigna el servidor; permite renombrar sin perder datos. */
  id?: string;
  /** Nombre tecnico dentro de la tabla (sin espacios). */
  name: string;
  /** Nombre que ve el usuario. */
  label: string;
  type: FieldType;
  required?: boolean;
  /** Opciones para el tipo `select`. */
  options?: string[];
  /** Permitir varias opciones / varios archivos. */
  multiple?: boolean;
  /** Id de la tabla destino para el tipo `relation`. */
  relationTableId?: string;
  /**
   * Nombre tecnico de la columna de la tabla destino que se ensena en lugar del
   * id. Vale para la grilla, la exportacion y la pagina publicada. Solo para
   * `relation`.
   *
   * Vacio en las columnas de antes de este cambio: hasta que la migracion la
   * rellena, se cae a la primera columna unica del destino, que es lo que la
   * grilla adivinaba antes.
   */
  displayField?: string;
  /**
   * Nombre tecnico de la columna del destino que se ve entre parentesis, detras
   * de la que se ensena. Solo para `relation`.
   *
   * Existe porque la llave con la que se reconoce a alguien y la que dice quien
   * es no suelen ser la misma: la celda ensena la cedula --que es lo que trae
   * el archivo y lo que se escribe-- y el correo al lado dice de quien se
   * trata, sin obligar a elegir entre las dos.
   *
   * Vacio: no se ensena nada detras.
   */
  detailField?: string;
  /**
   * Nadie puede repetir su valor en esta tabla. Solo una columna unica sirve de
   * llave para emparejar: si dos personas se llaman igual, el nombre no
   * identifica a nadie.
   */
  unique?: boolean;
  /**
   * Que pasa con las filas de esta columna cuando se borra aquello a lo que
   * apuntan. Solo para `relation`. Vacio: `keep`.
   *
   * No se pregunta al crear la columna --ahi ya se piden tres cosas, y esta es
   * sobre algo que quiza no pase nunca-- sino en su tarjeta. Ver `design.md`
   * D7 de `relacion-automatica-con-personas`.
   */
  onDelete?: RelationOnDelete;
  /**
   * Columna del sistema: la sostiene la plataforma y no el constructor.
   *
   * Su valor no esta en la coleccion de la tabla sino en otra --la cuenta comun
   * o el enlace persona-aplicacion-- y se superpone al pintar. Marcarla es lo
   * que decide dos cosas a la vez: que no se pueda borrar, renombrar ni cambiar
   * de tipo, y por que camino escribe su celda. Ver `shared/people.ts`.
   *
   * Vacio en cualquier columna que haya puesto el constructor.
   */
  system?: SystemFieldKind;
}

/** Que dato del sistema sostiene una columna marcada. Ver `shared/people.ts`. */
export type SystemFieldKind = "cuenta" | "roles";

/**
 * Que se hace con las filas que senalaban a un registro que se borra.
 *
 * - `keep`: la fila se queda y su celda sigue ensenando lo que decia, ahora
 *   como valor sin dueno. Es lo que vale cuando la columna no dice nada.
 * - `cascade`: las filas que apuntaban se borran con el.
 *
 * No hay una tercera que vacie la celda dejando la fila, que es lo que hacia
 * PocketBase por su cuenta sin que nadie lo eligiera: pierde el dato y no da
 * nada a cambio.
 */
export type RelationOnDelete = "keep" | "cascade";

/** Que hace una columna al borrarse lo apuntado, con su respaldo. */
export function onDeleteOf(field: Pick<FieldDef, "onDelete">): RelationOnDelete {
  return field.onDelete === "cascade" ? "cascade" : "keep";
}

/**
 * Lo que se lleva por delante borrar unas filas, por tabla.
 *
 * Se pregunta al servidor antes de confirmar: quien borra tiene que poder saber
 * lo que va a pasar con numeros de verdad, no con un "no se puede deshacer".
 */
export interface DeleteImpact {
  /** Se borran con el registro: su columna esta declarada en cascada. */
  cascade: { table: string; rows: number }[];
  /** Se quedan, con el valor a la vista y sin enlace. */
  keep: { table: string; rows: number }[];
}

/**
 * Una columna de relacion ocupa dos columnas reales en la base: la relacion
 * (el id, o vacio) y el valor sin dueno (texto, o vacio). Nunca estan las dos
 * llenas a la vez.
 *
 * El texto no es una copia de lo que se ensena --eso se lee siempre del registro
 * enlazado-- sino el corralito de lo que no encontro dueno. En una tabla sana
 * esta vacio en todas las filas.
 */
export const ORPHAN_SUFFIX = "_sin_enlace";

/** Nombre real de la columna que guarda el valor sin dueno de una relacion. */
export function orphanFieldName(fieldName: string): string {
  return `${fieldName}${ORPHAN_SUFFIX}`;
}

/**
 * El nombre tecnico que sale de un titulo escrito a mano.
 *
 * Vive aqui y no en `server/schema.ts`, que es quien lo aplica, porque la
 * tarjeta de columna necesita saber en que se va a convertir lo que se esta
 * escribiendo antes de mandarlo. Con una copia en cada lado, el aviso de la
 * pantalla y el rechazo del servidor acabarian hablando de nombres distintos.
 */
export function slugify(value: string, fallback = "item"): string {
  const out = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out || fallback;
}

/** Nombre tecnico valido para una columna o tabla de PocketBase. */
export function identifier(value: string, fallback = "campo"): string {
  const out = slugify(value, fallback)
    .replace(/-/g, "_")
    .replace(/^[0-9]+/, "");
  return out || fallback;
}

/** Una columna que apunta a un registro de otra tabla. */
export function isRelationField(field: Pick<FieldDef, "type">): boolean {
  return field.type === "relation";
}

/**
 * Que columna del destino ensena una relacion.
 *
 * Vacio es "no lo declara": el respaldo no vive aqui porque depende de la tabla
 * destino --su primera columna unica-- y esta funcion no la tiene delante. Lo
 * pone `relationTarget` en `shared/relations.ts`, que si la tiene.
 */
export function displayFieldOf(field: Pick<FieldDef, "displayField">): string {
  return field.displayField ?? "";
}

/**
 * Que columna del destino va entre parentesis, si va alguna.
 *
 * La misma columna dos veces no dice nada, asi que si coincide con la que se
 * ensena no se ensena detras.
 */
export function detailFieldOf(field: Pick<FieldDef, "displayField" | "detailField">): string {
  const display = displayFieldOf(field);
  const detail = field.detailField ?? "";
  return detail && detail !== display ? detail : "";
}

/** Metadatos de presentacion de una tabla (orden y ancho de columnas). */
export interface TableMeta {
  columnOrder?: string[];
  hidden?: string[];
  widths?: Record<string, number>;
  /** Colores asignados a cada opcion de los campos `select`. */
  optionColors?: Record<string, Record<string, string>>;
  /**
   * Columnas del sistema (`id`, `created`, `updated`) que el constructor
   * pidio mostrar. Las que faltan quedan ocultas por defecto.
   */
  systemVisible?: string[];
  /** Filas por pagina en la grilla. `0` significa mostrar todas. */
  pageSize?: number;
}

export interface TableRecord {
  id: string;
  app: string;
  name: string;
  label: string;
  dataCollection: string;
  order: number;
  fields: FieldDef[];
  meta: TableMeta;
  /**
   * Valores sin dueno que el constructor dio por buenos, por nombre de columna.
   * Dejan de contar en el recuento de filas sin enlace y siguen viendose.
   *
   * Hace falta: sin esto, las cedulas de terceros que nunca van a tener registro
   * cuentan para siempre, el contador no llega a cero y se vuelve ruido que el
   * usuario aprende a ignorar.
   */
  acceptedOrphans?: Record<string, string[]>;
  /**
   * Tabla que sostiene la plataforma y no el constructor: no se puede borrar y
   * trae columnas del sistema. Hoy solo la de personas. Ver `shared/people.ts`.
   */
  system?: boolean;
}

/** Alguien con acceso a una aplicacion publicada. */
export interface AppPerson {
  /**
   * Id de su cuenta en esta aplicacion. Es con lo que llega la sesion, no con
   * lo que se enlaza: lo que guarda una columna que apunta a personas es
   * `fila`.
   */
  id: string;
  /**
   * Id de su fila en la tabla de personas de esta aplicacion.
   *
   * Es el ancla de toda columna que apunte a la tabla de personas, igual que en
   * cualquier otra relacion. Vacio solo mientras su fila todavia no existe
   * --alguien recien invitado, una aplicacion a medio arrancar--; la repone
   * `syncPersonRows`.
   */
  fila?: string;
  name: string;
  email: string;
  /** Que pantallas ve. Puede tener varios de los roles de la app. */
  roles: string[];
  /**
   * Sus columnas propias en la tabla de personas de esta aplicacion, por
   * nombre de columna. Vacio si la aplicacion no le ha puesto ninguna.
   */
  campos?: Record<string, unknown>;
}

/**
 * La apariencia con la que se pinta la aplicacion publicada: paleta y tamano
 * de letra. Es la apariencia, no el modo: claro u oscuro lo elige quien mira
 * la pagina. Ver `shared/brand.ts`.
 */
export type { AppTheme };

export interface AppRecord {
  id: string;
  name: string;
  slug: string;
  icon: string;
  visibility: "private" | "public";
  published: boolean;
  owner: string;
  theme: AppTheme | null;
  /**
   * Roles que define esta aplicacion, con el nombre que quiera el constructor.
   * Deciden que paginas y que bloques ve cada persona invitada.
   */
  roles: string[];
  /**
   * Id de la version que ve el publico. Vacio: la app todavia no se publico
   * con el historial, y el enlace sirve el estado vivo.
   */
  liveVersion?: string;
  /**
   * Id de la conversacion con la IA que quedo abierta, en la pagina que sea.
   * Vacio: ninguna, y cada pagina del panel empieza en blanco.
   */
  openChat?: string;
  created: string;
  updated: string;
}

/* ------------------------------------------------------------------ */
/* Tablas que declara una pagina                                        */
/* ------------------------------------------------------------------ */

/**
 * Las seis ordenes de datos de una pagina publicada.
 *
 * Vive aqui porque es lo que viaja por la red: el documento nombra la orden y
 * el servidor la reparte. No queda ninguna otra decision colgada de ella --el
 * reparto de filas por rol se retiro-- salvo que las tres de escritura exigen
 * sesion iniciada.
 *
 * `contar` no trae filas: cuenta en el servidor. Existe porque `listar` tiene
 * techo, y sin ella la unica forma de saber cuantas filas cumplen algo era
 * bajarselas todas y contarlas en el navegador --que es justo lo que el techo
 * impide, asi que la cuenta salia corta y nadie se enteraba--.
 */
export type AccessOp = "listar" | "contar" | "obtener" | "crear" | "actualizar" | "borrar";

/**
 * Una tabla que usa el HTML de una pagina, con nombres propios.
 *
 * Las columnas se guardan por su identidad interna, no por su nombre: asi
 * renombrar una columna no obliga a tocar el HTML. El puente traduce en los
 * dos sentidos usando este mapa.
 */
export interface HtmlSource {
  /** Nombre con el que el HTML pide esta fuente. */
  name: string;
  tableId: string;
  /** Nombre logico de cada columna -> id interno de la columna. */
  fields: Record<string, string>;
}

/**
 * Un bloque tal como quedo guardado en una pagina de antes de que una pagina
 * fuera un documento HTML.
 *
 * Solo se lee, nunca se escribe: es lo que mira la conversion asistida para
 * poder pedirle a la IA el HTML equivalente. Por eso todo es opcional y nada
 * distingue un tipo de otro con precision: lo que se necesita es contar que
 * habia, no volver a dibujarlo.
 */
export interface LegacyBlock {
  id: string;
  type: string;
  title?: string;
  subtitle?: string;
  roles?: string[];
  fullWidth?: boolean;
  tableId?: string;
  fields?: string[];
  filter?: string;
  sort?: string;
  search?: boolean;
  pageSize?: number;
  editable?: boolean;
  columns?: number;
  titleField?: string;
  subtitleField?: string;
  bodyField?: string;
  imageField?: string;
  badgeField?: string;
  submitLabel?: string;
  successMessage?: string;
  paramName?: string;
  items?: {
    id?: string;
    label?: string;
    tableId?: string;
    agg?: string;
    field?: string;
    filter?: string;
  }[];
  content?: string;
  align?: string;
  size?: string;
  /** Huella del documento, solo en los bloques de HTML. */
  doc?: string;
  sources?: HtmlSource[];
  maxHeight?: number;
}

export interface PageRecord {
  id: string;
  app: string;
  name: string;
  slug: string;
  icon: string;
  order: number;
  isHome: boolean;
  /** No es una pagina: es un texto que agrupa a las de alrededor en el sidebar. */
  separator?: boolean;
  /**
   * Huella del documento HTML de la pagina. Vacia: la pagina todavia no tiene
   * nada escrito.
   */
  doc?: string;
  /** Tablas que puede pedir el HTML de la pagina. Nada mas esta permitido. */
  sources?: HtmlSource[];
  /**
   * Roles que pueden abrirla. Vacio: la abre cualquiera que alcance la
   * aplicacion --lo que la pantalla ensena como `Todos`--.
   *
   * Con uno o mas roles marcados la pagina exige sesion iniciada y uno de
   * ellos, aunque la aplicacion sea publica. No hay un estado guardado de
   * `Todos`: es la consecuencia de que la lista este vacia. Ver `design.md` D2.
   */
  roles?: string[];
}

/** Todo lo que necesita una app publicada para dibujarse. */
export interface AppBundle {
  app: Pick<AppRecord, "id" | "name" | "slug" | "icon" | "visibility" | "published" | "theme">;
  pages: PageRecord[];
  tables: TableRecord[];
  /**
   * Roles de quien esta mirando. El HTML de una pagina no puede tener su
   * propio padron de personas, asi que necesita esto para saber a quien tiene
   * delante. En la vista previa son todos los de la app: el constructor lo ve
   * todo.
   */
  roles?: string[];
}

/**
 * Codigo del error de intentar guardar sin cuenta iniciada.
 *
 * Viaja aparte del mensaje para que el puente lo distinga del resto de errores
 * y ponga el aviso de iniciar sesion sin que el HTML de la pagina participe.
 * Ver `design.md` D4.
 */
export const NEEDS_SESSION = "sin-sesion";

export interface ApiError {
  error: string;
  /** Que clase de error es, cuando el mensaje no basta para distinguirlo. */
  codigo?: string;
}

/* ------------------------------------------------------------------ */
/* Historial de versiones                                               */
/* ------------------------------------------------------------------ */

/**
 * Una pagina tal como quedo guardada en una version.
 *
 * El HTML no se copia: se nombra por la huella de su contenido, igual que en
 * el borrador.
 */
export type SnapshotPage = Pick<
  PageRecord,
  "id" | "name" | "slug" | "icon" | "order" | "isHome" | "separator" | "roles"
> & {
  doc?: string;
  sources?: HtmlSource[];
  /**
   * Solo en las versiones creadas antes de que una pagina fuera un documento.
   * Se lee para saber que esa version es de las de antes; nunca se escribe.
   */
  blocks?: LegacyBlock[];
};

/**
 * Presentacion de una tabla dentro de una version.
 * Nunca guarda columnas ni tipos: la estructura real vive en la base y se
 * resuelve al momento de servir, para que restaurar no pueda perder datos.
 */
export interface SnapshotTable {
  id: string;
  label: string;
  order: number;
  meta: TableMeta;
  /** Etiqueta visible de cada columna, por su id interno. */
  fieldLabels: Record<string, string>;
}

/** Todo el diseno de una aplicacion en un momento dado. */
export interface DesignSnapshot {
  name: string;
  icon: string;
  theme: AppTheme | null;
  roles: string[];
  pages: SnapshotPage[];
  tables: SnapshotTable[];
}

/** Como nacio una version. */
export type VersionKind = "publish" | "manual";

export interface AppVersion {
  id: string;
  app: string;
  /** Numero correlativo dentro de la app, para nombrarla sin ambiguedad. */
  number: number;
  label: string;
  kind: VersionKind;
  /** Huella del contenido; sirve para saber si el borrador cambio. */
  hash: string;
  /** Protegida del recorte automatico. */
  pinned: boolean;
  author: string;
  snapshot: DesignSnapshot;
  created: string;
  updated: string;
}

/** Lo que se manda al panel: la lista sin el peso de cada fotografia. */
export type AppVersionSummary = Omit<AppVersion, "snapshot"> & {
  /** Nombre de quien la creo, ya resuelto. */
  authorName: string;
  live: boolean;
  /**
   * Guarda paginas de bloques, de antes de que una pagina fuera un documento.
   * Se puede mirar, no se puede restaurar.
   */
  legacy: boolean;
};

export interface VersionsView {
  versions: AppVersionSummary[];
  /** Huella del borrador actual. */
  draftHash: string;
  /** El borrador es distinto de la version en vivo. */
  hasChanges: boolean;
  liveVersion: string;
}

/* ------------------------------------------------------------------ */
/* Servidor de inteligencia artificial                                  */
/* ------------------------------------------------------------------ */

/**
 * Que clase de servidor de IA es.
 *
 * Decide dos cosas: con que formato se le habla y de donde salen los datos de
 * sus modelos. `openrouter` habla el formato de ChatGPT, pero ademas tiene un
 * catalogo publico, asi que sus modelos no hay que describirlos a mano.
 */
export type AiProvider = "anthropic" | "openai" | "openrouter" | "llamacpp";

/**
 * Cuanto se le pide pensar antes de responder, con el nombre que le da su
 * propio servidor: `low`, `high`, `max`...
 *
 * No es una escala cerrada porque no lo es en ningun sitio: cada modelo dice
 * cuales ofrece --OpenRouter lo publica en su catalogo-- y ahi aparecen niveles
 * que la plataforma no puede conocer de antemano. Lo unico fijo es `off`, que
 * significa no pedir nada y lo entienden todos porque no se manda.
 */
export type AiThinking = string;

/** No pensar. Es lo unico que vale igual en todos los servidores. */
export const AI_THINKING_OFF = "off";

/**
 * Los niveles que se ofrecen cuando el servidor no dice cuales tiene. Es el
 * caso de Claude y de los compatibles con ChatGPT, que no publican catalogo.
 */
export const AI_THINKING_DEFAULT: AiThinking[] = ["off", "low", "medium", "high"];

/** Un modelo de los que ofrece un proveedor. */
export interface AiModel {
  /** El nombre con el que lo conoce su servidor: `claude-opus-5`, `gpt-5`. */
  id: string;
  /** Como se le llama en el panel. Vacio: se le llama por su nombre tecnico. */
  label: string;
  /** Tope de lo que puede escribir en una respuesta. */
  maxTokens: number;
  /** Cuanto le cabe delante, peticion y respuesta juntas. 0: no se sabe. */
  contextWindow: number;
  /** Si sabe pensar antes de responder. */
  thinking: boolean;
  /**
   * Los niveles de pensamiento que este modelo ofrece, tal y como los nombra
   * su servidor. Vacio: no los declara, y se ofrecen los de siempre.
   *
   * Se guardan con su nombre de verdad --y no traducidos a una escala
   * propia-- porque es lo que hay que mandarle luego: un modelo que ofrece
   * `max` no entiende otra cosa. Si "sin pensar" no esta en la lista, es que
   * este modelo piensa siempre.
   */
  efforts: AiThinking[];
  /** Si sabe mirar imagenes. Solo se muestra; todavia no se le manda ninguna. */
  vision: boolean;
  /**
   * Si piensa se le pide con un tope de tokens, no con un nombre de nivel.
   * Es como lo hace la propia interfaz de llama.cpp: sirve en cualquier
   * modelo con bloque `<think>`, declare o no sus propios niveles. Con esto
   * encendido, `efforts` siempre trae los niveles fijos de llama.cpp.
   */
  thinkingBudget?: boolean;
}

/** Un servidor de IA conectado, con los modelos que se le van a pedir. */
export interface AiProviderConfig {
  /** Nombre interno, para poder renombrar el visible sin perder la eleccion. */
  id: string;
  /** Como se le llama en el panel: "Claude del trabajo", "Ollama de casa". */
  name: string;
  provider: AiProvider;
  /** Direccion del servidor. Vacio usa la oficial del proveedor. */
  baseUrl: string;
  models: AiModel[];
  /**
   * Si se puede usar. Apagarlo lo esconde del chat sin borrarlo ni perder su
   * clave: sirve para dejar preparado un servidor que hoy no se quiere pagar.
   */
  enabled: boolean;
}

/** Con que se atiende una peticion: de que servidor, que modelo y cuanto piensa. */
export interface AiChoice {
  /** El `id` del proveedor. */
  provider: string;
  /** El `id` del modelo dentro de ese proveedor. */
  model: string;
  thinking: AiThinking;
}

/**
 * La intencion de modo Plan que manda el boton del composer con la siguiente
 * peticion. Quien decide el estado real es el servidor, a partir del hilo: ver
 * `design.md` D1 de `ia-modo-plan`.
 *
 * - `activar`: empezar --o seguir en-- modo Plan para esta peticion.
 * - `cortar`: orden de implementar a mitad de conversacion (D4): no manda
 *   texto nuevo al modelo, cierra el plan con lo que la IA tenia hasta ahora y
 *   lo deja listo para construir.
 * - `implementar`: pasar de un plan ya cerrado a modo Implementador.
 */
export type AiPlanIntent = "activar" | "cortar" | "implementar";

export interface AiConfig {
  providers: AiProviderConfig[];
  /** Lo que se usa cuando quien pide no elige otra cosa. */
  fallback: AiChoice;
  enabled: boolean;
  /** Ofrece en el chat el boton para ver el contexto que se le manda al modelo. */
  debugButton: boolean;
  /**
   * Minutos que se deja correr una peticion antes de cortarla sola, como si
   * quien la pidio hubiera apretado "detener". Protege contra un proveedor
   * colgado o una conversacion que no cierra sola. 0: sin tope.
   */
  runTimeoutMinutes: number;
}

/** Un proveedor tal y como se le muestra al panel: nunca incluye la clave. */
export interface AiProviderView extends AiProviderConfig {
  hasKey: boolean;
}

/** Lo que se le muestra al panel: nunca incluye ninguna clave. */
export interface AiConfigView extends Omit<AiConfig, "providers"> {
  providers: AiProviderView[];
}

/**
 * Cuanto contexto lleva gastado la peticion.
 *
 * `input` es todo lo que el modelo tuvo delante en el ultimo turno --el
 * sistema, la conversacion entera y lo que devolvieron las herramientas--, asi
 * que es lo que de verdad ocupa. Contra `window` se ve cuanto queda libre.
 */
export interface AiUsage {
  input: number;
  output: number;
  /** Lo que le cabe al modelo. 0: no esta declarado y no hay contra que medir. */
  window: number;
  /** El modelo que atendio, para poder decirlo aunque se cambie despues. */
  model: string;
}

/** Una accion que la IA realizo. */
export interface AiStep {
  tool: string;
  summary: string;
  ok: boolean;
}

export interface AiResult {
  message: string;
  steps: AiStep[];
}

/* ------------------------------------------------------------------ */
/* Conversaciones con la inteligencia artificial                        */
/* ------------------------------------------------------------------ */

export interface AiMessage {
  from: "yo" | "ia";
  text: string;
  steps?: AiStep[];
  /**
   * La pregunta que la IA dejo abierta en este mensaje, si pregunto. Se guarda
   * para que al volver a la conversacion se lea que se pregunto, no solo la
   * respuesta que vino despues.
   */
  question?: AiQuestion;
  /**
   * El plan con el que este mensaje cerro el modo Plan, si lo cerro. Mismo
   * patron que `question`: un campo opcional que distingue este turno de una
   * respuesta normal. `implementado` empieza en falso y pasa a verdadero
   * cuando quien construye elige pasar a modo Implementador; desde entonces el
   * plan sigue visible pero no se edita ni se reabre. Ver `design.md` D2 de
   * `ia-modo-plan`.
   */
  plan?: { texto: string; implementado: boolean };
  /**
   * El razonamiento que el modelo dejo escrito antes de responder, si el
   * servidor de IA lo envio. No siempre existe: depende del modelo.
   */
  reasoning?: string;
  /**
   * Los archivos que se adjuntaron a la peticion: su nombre y la referencia de
   * lo guardado. El contenido no se guarda aqui --vive en el almacen de
   * adjuntos-- pero la referencia si, y es lo que hace que la IA los siga
   * teniendo delante en los turnos siguientes.
   */
  files?: AiChatFile[];
  /**
   * Como se llamaba cada elemento senalado con el cursor (`PickedBlock.label`).
   * El HTML del elemento no se guarda, por lo mismo que el de los archivos.
   */
  picked?: string[];
}

/**
 * Una conversacion pertenece a la pagina donde se hizo: la lista de una pagina
 * ensena solo las suyas, y no se puede abrir una hecha en otra. Borrar la
 * pagina se lleva sus conversaciones.
 */
export interface AiChat {
  id: string;
  app: string;
  /** Id de la pagina donde se abrio. */
  page: string;
  /** Lo primero que se pidio, recortado. */
  title: string;
  messages: AiMessage[];
  created: string;
  updated: string;
}

/** La lista de conversaciones: sin el peso de los mensajes. */
export type AiChatSummary = Omit<AiChat, "messages"> & { count: number };

/**
 * La conversacion que quedo abierta, que es una sola en toda la aplicacion: la
 * ultima en la que se hablo, en cualquiera de sus paginas.
 *
 * Solo hace falta saber cual es y de que pagina: con eso, la pagina que la
 * tiene la repone al abrirse y las demas empiezan en blanco.
 */
export interface AiOpenChat {
  /** Id de la conversacion. */
  chat: string;
  /** Id de la pagina donde se tuvo. */
  page: string;
}

/* ------------------------------------------------------------------ */
/* Impacto de un cambio en la base de datos                             */
/* ------------------------------------------------------------------ */

/**
 * Los cambios de estructura con riesgo. Los que no lo tienen --crear una
 * tabla, anadir una columna, renombrar una columna-- se aplican solos y no
 * llegan hasta aqui.
 */
export type ChangeKind = "borrar_columna" | "cambiar_tipo" | "borrar_tabla";

export interface StructureChange {
  kind: ChangeKind;
  tableId: string;
  tableLabel: string;
  /** Nombre tecnico de la columna, cuando el cambio es de columna. */
  field?: string;
  fieldLabel?: string;
  /** Id interno de la columna: es lo que declaran las paginas. */
  fieldId?: string;
  /** Tipo pedido, solo para el cambio de tipo. */
  newType?: FieldType;
  /** El cambio contado en una linea. */
  what: string;
}

/** Una pagina que declara lo que se va a cambiar. */
export interface ImpactedPage {
  id: string;
  name: string;
}

/**
 * `conservar`: se hace la variante que no destruye nada.
 * `aplicar`: se hace el cambio y las paginas afectadas quedan como estan.
 * `aplicar_y_arreglar`: ademas la IA reescribe esas paginas.
 * `no_tocar`: la tabla se queda igual.
 */
export type ImpactChoice = "conservar" | "aplicar" | "aplicar_y_arreglar" | "no_tocar";

export interface ImpactOption {
  id: ImpactChoice;
  label: string;
  hint: string;
}

export interface DataImpact {
  /** La peticion que motiva el cambio: el "para que" del dialogo. */
  request: string;
  changes: StructureChange[];
  pages: ImpactedPage[];
  /** La primera es siempre la que no rompe nada. */
  options: ImpactOption[];
}

/* ------------------------------------------------------------------ */
/* Cambios de acceso                                                    */
/* ------------------------------------------------------------------ */

/**
 * Hacia donde va un cambio de acceso.
 *
 * Es lo unico que decide cuanta friccion lleva. Dar acceso nuevo no se puede
 * deshacer --lo que alguien vio, lo vio-- y por eso siempre pasa por una
 * confirmacion que nombra la consecuencia. Quitarlo se resuelve directo:
 * como mucho corrige algo que sobraba, y el punto de vuelta atras sigue ahi.
 */
export type AccessDirection = "dar" | "quitar";

/**
 * Un cambio de roles sobre una persona invitada, pedido por la IA.
 *
 * No es un `StructureChange`: no tiene tabla, y las cuatro salidas del dialogo
 * de impacto --conservar, aplicar, aplicar y arreglar, no tocar-- no
 * significan nada para un permiso. Va por su lado, con su aviso propio.
 */
export interface AccessChange {
  /** Id de la cuenta de la persona dentro de esta aplicacion. */
  personId: string;
  /** Como se le llama en el aviso. */
  personName: string;
  personEmail: string;
  direction: AccessDirection;
  /** Los roles con los que queda. Es la lista entera, no lo que se anade. */
  roles: string[];
  /**
   * Lo que pasa a poder hacer --o a no poder hacer-- esa persona, dicho en una
   * frase y en lenguaje llano: "Ana podra ver los pedidos de todos los
   * clientes, no solo los suyos". No un boton generico de autorizar.
   */
  consequence: string;
}

/* ------------------------------------------------------------------ */
/* Lo senalado con el cursor                                            */
/* ------------------------------------------------------------------ */

/**
 * Un elemento del documento senalado con el cursor de seleccion.
 *
 * Nace en el puente --que es quien puede escuchar dentro del marco-- viaja al
 * panel como badge de la conversacion, y de ahi al servidor con la peticion.
 *
 * Lleva donde esta y el HTML que tiene ahora, para que la IA no necesite
 * releer la pagina entera para saber que se le senalo. Si el elemento es
 * enorme, el HTML va recortado y se dice.
 */
export interface PickedBlock {
  /** Identidad del badge en el panel. No significa nada fuera de el. */
  id: string;
  /** El nombre de bloque que ya lleva, si alguna edicion se lo puso. */
  name: string;
  /** Como se le llama en la conversacion: "tabla Clientes", "seccion Precios". */
  label: string;
  /** La etiqueta HTML que es, en minuscula: "h1", "div", "span". */
  tag: string;
  /** Donde esta dentro del documento, en forma de selector. */
  path: string;
  /** El HTML que tiene ahora. */
  html: string;
  /** El HTML va recortado: no es todo lo que hay dentro. */
  truncated: boolean;
}

/* ------------------------------------------------------------------ */
/* Archivos como contexto de la IA                                      */
/* ------------------------------------------------------------------ */

/**
 * De que clase es un archivo que se le adjunta a la IA.
 *
 * No es su extension ni su MIME: es como hay que contarselo al modelo. Todo lo
 * que se lee como texto viaja dentro del contexto, en un bloque de codigo con
 * su lenguaje puesto; una imagen no, y por eso es la unica clase aparte.
 *
 * Una hoja de calculo entra como `sheet` aunque llegue en `.xlsx`: lo que
 * viaja es su contenido convertido a CSV, que es lo que un modelo lee bien.
 */
export type AiFileKind = "html" | "css" | "js" | "json" | "csv" | "sheet" | "text" | "image";

/**
 * Un archivo adjunto a una peticion a la IA.
 *
 * Nace en el navegador --se suelta encima del editor-- se sube al almacen de
 * adjuntos en cuanto se suelta, y vive como badge en la conversacion mientras
 * se escribe la peticion.
 *
 * Lleva la referencia de lo guardado, no el contenido: el contenido se guarda
 * una sola vez (`server/ai/aiFiles.ts`) y de ahi lo leen tanto la muestra que se
 * le cuenta al modelo como las ordenes que lo abren entero. Asi un archivo de
 * varios megabytes no engorda ninguna peticion, y sigue estando en los turnos
 * siguientes de la conversacion.
 */
export interface AiFile {
  /** Identidad del badge en el panel. No significa nada fuera de el. */
  id: string;
  /**
   * El adjunto guardado. Vacio mientras la subida va en camino: un badge sin
   * referencia todavia no se puede mandar con una peticion.
   */
  ref: string;
  /** El nombre del archivo, tal como venia. */
  name: string;
  kind: AiFileKind;
  /** El tipo que declaro el navegador. Puede venir vacio. */
  mime: string;
  /** Lo que ocupa el original, en bytes. */
  size: number;
}

/**
 * Un adjunto tal y como queda nombrado dentro de una conversacion guardada.
 *
 * Es lo que hace que preguntar por un archivo dos turnos despues no obligue a
 * adjuntarlo otra vez: la conversacion recuerda que adjuntos nombro cada
 * peticion, y el contexto de la siguiente los vuelve a poner delante.
 *
 * Tambien es lo que decide cuanto vive un adjunto: uno que ninguna conversacion
 * nombra se puede borrar.
 */
export interface AiChatFile {
  /** El adjunto guardado. */
  ref: string;
  name: string;
  kind: AiFileKind;
  /** Lo que ocupa, en bytes. Se lee en la burbuja de la peticion. */
  size: number;
}

/* ------------------------------------------------------------------ */
/* Lo que la IA pregunta antes de construir                             */
/* ------------------------------------------------------------------ */

/** Una de las salidas de una pregunta: lo que se lee en el boton. */
export interface AiQuestionOption {
  /** El texto del boton. Corto: es lo que se elige de un vistazo. */
  label: string;
  /** Que significa elegirlo, si el rotulo solo no basta. */
  description?: string;
}

/**
 * Lo que la IA pregunta cuando no puede seguir sin saberlo.
 *
 * Solo cabe aqui una eleccion entre cosas que ya existen en la aplicacion
 * --que tabla, que fuente--: una pregunta de diseno abierto no tiene opciones
 * que ofrecer y se resuelve construyendo algo y dejando corregir.
 *
 * Preguntar cierra el turno: la IA no sigue escribiendo despues de preguntar.
 * Elegir una opcion manda una peticion nueva.
 */
export interface AiQuestion {
  /** Lo que se pregunta, en una linea. */
  question: string;
  /** De que va, en dos o tres palabras. Rotula el bloque en la conversacion. */
  header: string;
  options: AiQuestionOption[];
}

/** Lo que responde la IA cuando escribe una pagina. */
export interface AiPageResult {
  message: string;
  steps: AiStep[];
  /** Avisos cortos de lo que se aplico solo por no tener riesgo. */
  notices: string[];
  /** La pagina cambio: hay que volver a leerla. */
  changed: boolean;
  /** Cambios con riesgo esperando decision. Vacio: no hay nada que preguntar. */
  impact: DataImpact | null;
  /**
   * La IA cerro el turno preguntando en vez de construir. `null` es lo normal:
   * preguntar esta acotado a elegir entre cosas que ya existen.
   */
  question: AiQuestion | null;
  /**
   * El plan con el que se cerro el turno, si se cerro uno. `null` es lo
   * normal, igual que `question`.
   */
  plan: { texto: string; implementado: boolean } | null;
  /**
   * Accesos que la IA quiere dar y todavia no ha dado: cada uno se confirma
   * por separado, con su consecuencia delante. Los que quitan no llegan aqui,
   * se aplican solos.
   */
  access: AccessChange[];
  /** Conversacion donde quedo guardada la peticion. */
  chatId: string;
  /** El razonamiento del modelo, si lo envio. */
  reasoning?: string;
  /** Se detuvo a media peticion porque se pidio pararla. */
  stopped: boolean;
  /** Cuanto contexto se gasto, si el servidor lo conto. */
  usage?: AiUsage;
}

/**
 * Una peticion a la IA que el servidor tiene en marcha.
 *
 * La peticion no vive en la conexion que la pidio: recargar o cerrar el
 * navegador no la corta. Esto es lo que hace falta para reconocerla al volver.
 */
export interface AiRunInfo {
  id: string;
  /** Lo que se pidio, para poder reponerlo en la conversacion al volver. */
  prompt: string;
  /** Cuando empezo. */
  started: string;
  /** Ya termino y solo esta esperando a que alguien recoja el resultado. */
  done: boolean;
}

/**
 * Las paginas de una aplicacion donde la IA esta trabajando ahora mismo.
 *
 * Es la fuente de verdad de la senal: se pregunta al entrar en la aplicacion,
 * y a partir de ahi la mantiene al dia el hilo de avisos de cada peticion. Una
 * peticion terminada que solo espera a que recojan su resultado no esta aqui:
 * no es trabajo en curso.
 */
export interface AiActiveRun {
  /** La pagina donde trabaja. */
  page: string;
  /** Cuando empezo. */
  started: string;
}

/* ------------------------------------------------------------------ */
/* Registro de depuracion de la IA                                      */
/* ------------------------------------------------------------------ */

/**
 * La constancia de la ultima peticion de una pagina.
 *
 * Una por pagina, sobrescrita en cada peticion: no es un historial. Existe
 * para poder entender despues un fallo que no se puede reproducir, asi que se
 * guarda siempre, haya terminado bien o mal, y sin depender de haber encendido
 * nada antes.
 */
export interface AiDebugEntry {
  id: string;
  app: string;
  page: string;
  /** Lo que se pidio. */
  prompt: string;
  /** El contexto que se le mando al modelo, tal cual. */
  context: string;
  /** El razonamiento que dejo escrito, si lo envio. */
  reasoning: string;
  /** Lo que respondio, o el fallo si fallo. */
  answer: string;
  /** El modelo que atendio. */
  model: string;
  /** Cuanto tardo, en milisegundos. */
  ms: number;
  /** El contexto no cabia entero y va recortado. */
  truncated: boolean;
  created: string;
  updated: string;
}

/** Lo que se lee del registro de una pagina. `null`: no hay nada guardado. */
export type AiDebugRead = AiDebugEntry | null;

/**
 * Lo que el servidor va contando mientras la IA trabaja.
 *
 * Es para mirar, no para decidir: quien construye puede desplegarlo y ver por
 * donde va, pero nada de esto es el resultado. El resultado llega una sola vez,
 * en `fin`, y es el mismo `AiPageResult` de siempre.
 *
 * Lo mismo se cuenta a quien pidio la peticion y a quien se engancha despues de
 * recargar: el que llega tarde recibe primero, de golpe, lo que ya habia.
 */
export type AiProgress =
  /** Lo primero de toda conexion: a que peticion se acaba de enganchar. */
  | { tipo: "inicio"; runId: string }
  | { tipo: "texto"; texto: string }
  | { tipo: "paso"; paso: AiStep }
  | { tipo: "razonamiento"; texto: string }
  /** Lo que se le mando al modelo en esta ronda. Solo llega en modo debug. */
  | { tipo: "contexto"; texto: string }
  /** Cuanto contexto lleva gastado. Llega al cerrar cada turno del modelo. */
  | { tipo: "uso"; uso: AiUsage }
  /**
   * La IA quiere ver si el HTML que acaba de escribir se dibuja sin errores.
   *
   * Esto no es para mirar, es lo unico que pide algo de vuelta: quien lo reciba
   * dibuja ese documento en un marco escondido y responde con lo que la consola
   * haya soltado. Si nadie lo atiende, la IA sigue sin saberlo.
   */
  | { tipo: "probar"; probeId: string; hash: string }
  /**
   * La IA pregunto y con eso cerro el turno. Llega antes del `fin` para que el
   * panel pueda pintarla en cuanto se sabe, sin esperar al resultado.
   */
  | { tipo: "pregunta"; pregunta: AiQuestion }
  /**
   * El modo Plan se cerro con este plan. Llega antes del `fin`, por lo mismo
   * que "pregunta": para que la tarjeta se pinte en cuanto se sabe.
   */
  | { tipo: "plan"; plan: { texto: string; implementado: boolean } }
  | { tipo: "fin"; resultado: AiPageResult }
  | { tipo: "error"; mensaje: string };

/**
 * Un fallo que solto un documento al dibujarse.
 *
 * Es lo que se veria en la consola del navegador al inspeccionar la pagina,
 * recogido por el puente y traido hasta aqui.
 */
export interface PageIssue {
  /**
   * `js`: una excepcion sin recoger. `promesa`: una promesa rechazada que nadie
   * atrapo. `recurso`: algo que la pagina pidio y no cargo. `consola`: lo que el
   * propio documento escribio con `console.error`.
   */
  tipo: "js" | "promesa" | "recurso" | "consola";
  mensaje: string;
  linea?: number;
  columna?: number;
  pila?: string;
}

/** Lo que el panel devuelve cuando termina de probar un documento. */
export interface PageProbeReport {
  probeId: string;
  issues: PageIssue[];
  /** Avisos de `console.warn`. Van aparte: casi nunca son un fallo. */
  warnings: string[];
}

/** Lo que responde el dialogo de impacto una vez decidido. */
export interface ImpactResult {
  message: string;
  steps: AiStep[];
  /** Paginas que la IA reescribio, si se autorizo. */
  fixed: string[];
}
