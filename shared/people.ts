/**
 * La lista de personas de una aplicacion, tratada como una tabla mas.
 *
 * Aqui esta lo unico que la separa de las demas: que dos de sus columnas no
 * viven en su coleccion. El correo esta en la cuenta --que es de esta
 * aplicacion y de ninguna otra-- y los roles, en el enlace persona-aplicacion.
 * La coleccion propia guarda el enlace a la cuenta y las columnas que ponga el
 * constructor, y nada mas.
 *
 * Vive en `shared/` porque las dos puntas necesitan lo mismo: el servidor para
 * crear la tabla y defender lo intocable, y el panel para pintar la cuadricula
 * y decidir por que camino escribe cada celda.
 */
import {
  type AppPerson,
  type FieldDef,
  identifier,
  isRelationField,
  type SystemFieldKind,
  type TableRecord,
} from "./types.ts";

/** Nombre tecnico de la tabla de personas dentro de cada aplicacion. */
export const PEOPLE_TABLE = "personas";

/**
 * Como se lee la tabla de personas en la lista de tablas.
 *
 * Dice "y roles" porque los roles se gestionan desde ella: no hay otra pantalla
 * donde se creen. El nombre no lo cambia el constructor --la tabla de usuarios
 * no se renombra-- asi que se repone en cada arranque.
 */
export const PEOPLE_TABLE_LABEL = "Personas y roles";

/**
 * Lo minimo que puede medir la clave de una persona invitada.
 *
 * Lo dicen tres sitios --el panel al escribirla, el servidor al recibirla y la
 * coleccion de cuentas al guardarla-- y los tres leen este numero. El tercero
 * no se entera solo: se le pone al dia al arrancar. Ver `ensurePasswordMin` en
 * `server/bootstrap.ts`.
 */
export const MIN_PASSWORD = 6;

/**
 * Una clave que nadie tenga que inventar: larga y de una sola vez.
 *
 * Sale de aqui y no de cada sitio que la necesita --invitar, importar, migrar--
 * porque las tres tienen que dar claves igual de buenas, y tres copias del
 * alfabeto son tres sitios donde una puede quedarse corta sin que se note.
 */
export function newPassword(): string {
  const abc = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  // El resto de la division no reparte por igual: con 56 letras y 256 valores,
  // las 32 primeras salen una vez mas que las demas. Se descartan los valores
  // que caen en ese sobrante y se piden otros, que es lo que deja las 56
  // igual de probables.
  const limit = 256 - (256 % abc.length);
  let out = "";
  while (out.length < 12) {
    for (const n of crypto.getRandomValues(new Uint8Array(12))) {
      if (n >= limit) continue;
      out += abc[n % abc.length];
      if (out.length === 12) break;
    }
  }
  return out;
}

/**
 * La identidad con la que una persona entra en una aplicacion.
 *
 * No es el correo a secas y no puede serlo: el mismo correo puede tener cuenta
 * en varias aplicaciones, cada una con su clave, y PocketBase necesita saber
 * cual de ellas se esta abriendo antes de comparar nada. Por eso la identidad
 * lleva delante la aplicacion.
 *
 * Quien entra no la escribe ni la ve: el formulario sigue pidiendo el correo y
 * es la pantalla la que le pone delante la aplicacion en la que esta. Ver
 * `passwordAuth.identityFields` en `server/bootstrap.ts`.
 */
export function loginFor(appId: string, cuenta: string): string {
  const email = String(cuenta ?? "")
    .trim()
    .toLowerCase();
  return appId && email ? `${appId}:${email}` : "";
}

/**
 * Columna real que enlaza la fila con la cuenta.
 *
 * No es del constructor y no aparece como columna: es la identidad de la fila.
 * Por eso `member` esta entre los nombres reservados en `server/schema.ts`.
 */
export const MEMBER_FIELD = "member";

/**
 * Nombre tecnico de la columna del correo, la llave que toda persona tiene.
 *
 * Es la que una columna que apunta a personas ensena por defecto, y la unica
 * que existe desde el primer dia: las demas --un documento, un codigo-- llegan
 * cuando la aplicacion las anade.
 */
export const PEOPLE_ACCOUNT_FIELD = "cuenta";

/** Como se lee esa columna cuando hay que nombrarla en un aviso. */
export const PEOPLE_ACCOUNT_LABEL = "Correo";

/**
 * Las dos columnas del sistema de la tabla de personas.
 *
 * Se ven y se editan en la cuadricula como cualquier otra, pero no se borran,
 * no se renombran y no cambian de tipo: son las que sostienen el acceso. Si la
 * cuadricula no las ensenara habria que mantener a su lado la pantalla vieja
 * para tocarlas, que es justo lo que este cambio viene a quitar.
 *
 * No hay una tercera que diga lo que una persona puede hacer con los datos: lo
 * que puede hacer ya no se declara por persona. Guardar exige cuenta iniciada y
 * nada mas; los roles deciden que pantallas ve.
 *
 * `cuenta` es unica dentro de la aplicacion --dos invitados suyos no comparten
 * correo-- y por eso sirve de llave desde el primer dia, antes de que nadie
 * anada un documento. Fuera de ella no dice nada: el mismo correo puede estar
 * invitado en otra aplicacion, y alli es otra persona con otra clave.
 */
export const PEOPLE_SYSTEM_FIELDS: FieldDef[] = [
  {
    name: PEOPLE_ACCOUNT_FIELD,
    label: PEOPLE_ACCOUNT_LABEL,
    type: "email",
    required: true,
    unique: true,
    system: "cuenta",
  },
  {
    name: "roles",
    label: "Roles",
    type: "select",
    multiple: true,
    system: "roles",
  },
];

/**
 * Nombre tecnico de la columna que dice como se llama una persona.
 *
 * Lo preguntan sitios que no se ven a la vez --quien la repone al arrancar,
 * quien la defiende al guardar columnas, la tarjeta que las edita y
 * `personDisplayName`-- y una cadena suelta en cada uno es una forma de que
 * uno de ellos deje de hablar de la misma columna.
 */
export const PEOPLE_NAME_FIELD = "nombre";

/** Como se lee esa columna cuando hay que nombrarla en un aviso. */
export const PEOPLE_NAME_LABEL = "Nombre";

/**
 * La columna con la que nace la tabla de personas, ademas de las dos de arriba.
 *
 * Un correo no dice quien es nadie: `1037660432@ss.local` es una fila que hay
 * que descifrar. Por eso esta el primer dia y por eso no se puede borrar: es
 * de donde sale el nombre de una persona en toda la plataforma --el saludo de
 * una pagina publicada, la celda de una columna de persona, el desplegable que
 * la elige-- y sin ella no queda mas que el correo.
 *
 * No lleva marca de sistema porque su valor si vive en la coleccion de la
 * tabla, que es lo que esa marca decide (ver `storedFields`). En la cuadricula
 * se trata como la del correo: se ordena y se esconde, y su menu no ofrece
 * editarla. Lo que se rellena en cada fila es de la aplicacion, como siempre.
 */
export const PEOPLE_DEFAULT_FIELDS: FieldDef[] = [
  { name: PEOPLE_NAME_FIELD, label: PEOPLE_NAME_LABEL, type: "text" },
];

/** Las columnas con las que nace la tabla de personas, en su orden. */
export function peopleInitialFields(): FieldDef[] {
  return [...structuredClone(PEOPLE_SYSTEM_FIELDS), ...structuredClone(PEOPLE_DEFAULT_FIELDS)];
}

/**
 * Nombres que una columna propia de la tabla de personas no puede llevar, y
 * que ocupa cada uno.
 *
 * Una pagina publicada recibe a quien la mira en un solo nivel
 * --`plane.usuario.cedula`, no `plane.usuario.campos.cedula`-- porque es lo que
 * se escribe en el filtro de una pantalla de "lo mio". El precio de lo plano es
 * que una columna llamada como un dato de la plataforma lo taparia. Se paga
 * aqui: rechazar el nombre una vez es mas claro que resolver el choque cada vez
 * que se arma la sesion. Ver `design.md` D4 de
 * `relacion-automatica-con-personas`.
 *
 * `nombre` no esta en la lista. Tambien viaja en la sesion, pero no hay choque
 * que evitar: la columna que la tabla trae desde el primer dia es de donde sale
 * ese mismo dato (`PEOPLE_DEFAULT_FIELDS`, `personDisplayName`), asi que
 * prohibirla rechazaria la tabla de toda aplicacion que ya existe.
 */
export const PEOPLE_RESERVED_NAMES: Record<string, string> = {
  id: "el identificador de la persona",
  correo: "el correo con el que entra",
  roles: "los roles que tiene en la aplicacion",
};

/**
 * Que ocupa ese nombre en la tabla de personas, o vacio si se puede usar.
 *
 * Se compara el nombre tecnico y no lo que se escribio: "Correo" y "correo"
 * acaban siendo la misma columna. Fuera de la tabla de personas no hay nada
 * que tapar y siempre se puede.
 */
export function reservedPersonName(
  table: Pick<TableRecord, "system" | "name"> | null,
  name: string,
): string {
  if (!isPeopleTable(table)) return "";
  return PEOPLE_RESERVED_NAMES[identifier(name)] ?? "";
}

/**
 * El icono con el que se reconoce un rol en toda la plataforma.
 *
 * Los roles se nombran en sitios que no se ven a la vez --la columna de la
 * tabla de personas, la tarjeta que los crea, las opciones de cada pagina, la
 * vista previa-- y sin una marca comun cada uno parecia una cosa distinta. Es
 * un nombre de la fuente de iconos (ver `shared/icons.ts`), asi que se pasa tal
 * cual a `Icon`.
 */
export const ROLE_ICON = "user-account";

/**
 * Cuantos roles puede tener una aplicacion y cuanto mide el nombre de uno.
 *
 * El tope existe porque los roles se pintan como opciones de una celda y como
 * renglones marcables en las opciones de cada pagina: una lista sin fondo no se
 * puede repasar, y quien la mira ya no sabe a quien esta abriendo la pantalla.
 */
export const MAX_ROLES = 24;
export const MAX_ROLE_LENGTH = 40;

/**
 * El rol que toda aplicacion define desde que nace, sin que nadie lo escriba.
 *
 * Es el de quien construye cuando mira sus propias paginas, y es donde arranca
 * la vista previa. No se puede quitar desde la pantalla de roles: quitarlo
 * dejaria a `pruneRoles` borrandolo de las paginas que lo tuvieran marcado.
 *
 * Darselo a una persona invitada no le da nada del panel: el poder de quien
 * construye viene de ser dueno de la aplicacion, no del nombre del rol. Ver
 * `design.md` D7.
 */
export const ADMIN_ROLE = "admin";

/**
 * El nombre de un rol, en la forma en que se guarda.
 *
 * Minusculas, sin tildes ni signos, los espacios convertidos en guiones y los
 * guiones repetidos colapsados. Se aplica en los tres sitios por los que entra
 * un rol --el campo donde se escribe, el saneado del servidor y la importacion
 * de personas-- y en el campo se aplica en cada pulsacion, para que quien lo
 * escribe vea el nombre tal como va a quedar.
 *
 * Se guarda una sola forma y no la pareja "escrito / normalizado": el HTML de
 * una pagina compara contra el nombre guardado, y tener dos formas obligaria a
 * saber cual se usa en cada sitio. Ver `design.md` D6.
 */
export function normalizeRole(name: unknown): string {
  // El guion del final se quita despues de cortar por el tope: cortar puede
  // dejar uno donde no lo habia.
  return roleDraft(name).replace(/-+$/g, "");
}

/**
 * El nombre de un rol mientras se escribe.
 *
 * Es `normalizeRole` sin quitar el guion del final. Hace falta para el campo:
 * quien escribe "jefe de zona" pasa por "jefe-" en cuanto pulsa el espacio, y
 * recortarlo en ese momento le impediria escribir la segunda palabra.
 *
 * Lo que se guarda es siempre `normalizeRole`, aqui y en el servidor.
 */
export function roleDraft(name: unknown): string {
  return (
    String(name ?? "")
      .normalize("NFD")
      // Las marcas diacriticas que NFD separo de su letra. La ene queda en `n`.
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+/g, "")
      .slice(0, MAX_ROLE_LENGTH)
  );
}

/**
 * Normaliza una lista de roles conservando el orden y fundiendo los que
 * colisionen. Lo que se normaliza a vacio se descarta.
 */
export function normalizeRoles(names: unknown): string[] {
  const list = Array.isArray(names) ? names : [];
  const out: string[] = [];
  for (const raw of list) {
    const role = normalizeRole(raw);
    if (role && !out.includes(role)) out.push(role);
  }
  return out;
}

/** Una columna que sostiene la plataforma: ni se borra, ni se renombra, ni cambia de tipo. */
export function isSystemField(field: Pick<FieldDef, "system">): boolean {
  return field.system !== undefined;
}

/** Las columnas que si viven en la coleccion de la tabla. */
export function storedFields(fields: FieldDef[]): FieldDef[] {
  return fields.filter((f) => !isSystemField(f));
}

/**
 * Si una columna de la tabla de personas hay que superponerla al pintar.
 *
 * Es la unica asimetria que le queda a esta tabla frente a las demas: dos de
 * sus columnas --el correo y los roles-- no estan en su coleccion, asi que una
 * relacion que apunte a ella no las trae con el expand de la base ni las puede
 * buscar con un filtro corriente. Quien las tiene es la lista de invitados.
 *
 * Se pregunta por la tabla y no solo por el nombre: "cuenta" es una columna
 * cualquiera en cualquier otra tabla, y alli vive en su coleccion como todas.
 */
export function isOverlayField(
  table: Pick<TableRecord, "system" | "name" | "fields"> | null,
  name: string,
): boolean {
  if (!isPeopleTable(table)) return false;
  const field = (table?.fields ?? []).find((f) => f.name === name);
  return field !== undefined && isSystemField(field);
}

/** La tabla de personas de una aplicacion, si ya existe. */
export function peopleTableOf(tables: TableRecord[]): TableRecord | null {
  return tables.find((t) => t.system === true && t.name === PEOPLE_TABLE) ?? null;
}

/** Si esta tabla es la de personas. */
export function isPeopleTable(table: Pick<TableRecord, "system" | "name"> | null): boolean {
  return table?.system === true && table.name === PEOPLE_TABLE;
}

/**
 * Si esta columna es la del nombre de la tabla de personas: la que no se borra.
 *
 * Se pregunta por la tabla y no solo por el nombre porque "nombre" es una
 * columna cualquiera en cualquier otra tabla, y alli se borra como todas.
 * Ver `PEOPLE_DEFAULT_FIELDS`.
 */
export function isPeopleNameField(
  table: Pick<TableRecord, "system" | "name"> | null,
  field: Pick<FieldDef, "name">,
): boolean {
  return isPeopleTable(table) && field.name === PEOPLE_NAME_FIELD;
}

/**
 * Los roles de la aplicacion, como opciones de la columna de roles.
 *
 * Se rellenan al leer y no al guardar: los roles se anaden y se quitan desde la
 * tarjeta de roles, y una copia guardada en la tabla se quedaria vieja en cuanto
 * alguien tocara aquello. Quien las rellena es `Builder` al traer las tablas,
 * asi que todo el que las lea --la cuadricula, exportar la estructura, la
 * tarjeta de una columna-- las ve ya puestas.
 */
export function withRoleOptions(fields: FieldDef[], roles: string[]): FieldDef[] {
  return fields.map((f) => (f.system === "roles" ? { ...f, options: [...roles] } : f));
}

/**
 * El aviso de que quitar a alguien se lleva por delante su cuenta aqui.
 *
 * Se dice antes de confirmar porque no tiene vuelta atras. Nombra la cuenta
 * --que es de esta aplicacion, y borrarla es dejar a esa persona sin entrada--
 * y nombra tambien lo que no se toca: si esta invitada en otra aplicacion,
 * alli tiene su propia cuenta y esta no la roza.
 */
export function removeWarning(label: string, ownColumns: number): string {
  const who = label || "esta persona";
  const resto = "Si está invitada en otra aplicación, allí no cambia nada.";
  if (ownColumns === 0) {
    return `${who} pierde su cuenta en esta aplicación y deja de poder entrar. ${resto}`;
  }
  const columnas = ownColumns === 1 ? "columna propia" : "columnas propias";
  return `${who} pierde su cuenta en esta aplicación y deja de poder entrar, y se pierde lo que esta aplicación sabía de ella: ${ownColumns} ${columnas}. No tiene vuelta atrás. ${resto}`;
}

/** Que dato del sistema sostiene una columna, para repartir la escritura. */
export function systemKindOf(field: Pick<FieldDef, "system">): SystemFieldKind | null {
  return field.system ?? null;
}

/**
 * Las columnas de la tabla de personas por las que una columna de persona de
 * otra tabla puede mostrar y emparejar.
 *
 * Son todas las que pueden nombrar a alguien, y no solo las declaradas sin
 * repetidos. La marca de "sin repetidos" la pone el constructor a mano, y la
 * columna con la que de verdad se reconoce a la gente --"cedula", "documento",
 * "codigo"-- casi siempre llega importando la nomina y nace como texto
 * corriente, sin marca. Exigirla dejaba fuera justo esa, que es la que todo el
 * mundo usa.
 *
 * Que un valor identifique o no se decide mirando el dato y no la marca: el que
 * senala a dos personas no enlaza a ninguna. Ver `guessPersonColumns` en
 * `web/src/lib/personGuess.ts` y `matchValues` en `shared/relations.ts`.
 *
 * Sin la tabla de personas a mano --una aplicacion muy vieja, a medio
 * arrancar-- se cae a la cuenta, que es la unica que siempre existe.
 */
export function personKeyFields(tables: TableRecord[]): { name: string; label: string }[] {
  const people = peopleTableOf(tables);
  if (!people) return [{ name: "cuenta", label: "Correo" }];
  return people.fields
    .filter((f) => !isRelationField(f) && f.type !== "file" && f.multiple !== true)
    .map((f) => ({ name: f.name, label: f.label || f.name }));
}

/**
 * El valor de una persona por el nombre de una columna de su tabla.
 *
 * `cuenta` y `email` son el mismo dato --la cuenta vive en la lista de cuentas
 * de la aplicacion, no en la coleccion propia-- y las dos formas se aceptan
 * porque columnas de antes de este cambio guardan la segunda.
 *
 * Lo demas sale de `campos`, y sale de ahi aunque coincida con un dato de la
 * cuenta. "nombre" es la trampa: es una columna de la tabla de personas desde
 * el primer dia --la que pone `PEOPLE_DEFAULT_FIELDS`-- y la cuenta trae ademas
 * un `name` que no es un nombre, es el correo sin el dominio. Preguntar antes
 * por la cuenta hacia que una columna llamada "Nombre" ensenara "71797534" para
 * quien entra con `71797534@ss.local` y "ana" para quien entra con
 * `ana@empresa.com`: nunca lo que el constructor escribio en su tabla.
 *
 * La cuenta solo responde cuando esta aplicacion no tiene esa columna, que es
 * lo que pasa mientras su tabla de personas todavia no se ha leido.
 */
export function personKeyValue(person: AppPerson, key: string): string {
  if (key === "cuenta" || key === "email") return person.email ?? "";
  if (person.campos && key in person.campos) return String(person.campos[key] ?? "");
  if (key === "name" || key === "nombre") return person.name ?? "";
  return "";
}

/**
 * Como se llama una persona cuando hay que saludarla.
 *
 * `AppPerson.name` no es un nombre: es el correo sin el dominio, que es lo que
 * la cuenta guarda --ver `peopleOf` en `server/access.ts` y la importacion, que
 * la crea con `email.split("@")[0]`--. Para quien entra con `1037660432@ss.local`
 * eso es su cedula, y una pagina que la ensenara estaria diciendo el documento
 * de alguien donde prometio decir su nombre.
 *
 * El nombre de verdad esta en la columna `nombre` de la tabla de personas, la
 * que `PEOPLE_DEFAULT_FIELDS` pone el primer dia justamente para esto. Se
 * pregunta por ella igual que `personKeyValue`, que ya sabe que la columna
 * manda sobre la cuenta.
 *
 * Esa columna no se puede borrar, asi que la aplicacion siempre la tiene. El
 * respaldo a la cuenta sigue aqui para la fila que todavia no la ha rellenado
 * --invitar a alguien no pide su nombre-- y para lo que se pinte antes de que
 * la tabla de personas se haya leido.
 */
export function personDisplayName(person: AppPerson): string {
  return personKeyValue(person, "nombre") || person.email || "";
}
