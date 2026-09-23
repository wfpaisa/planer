/**
 * Crea y repara la tabla de personas de una aplicación.
 *
 * Es idempotente y se llama en dos momentos: al arrancar --para las
 * aplicaciones que ya existian, que la estrenan vacía-- y al crear una
 * aplicación nueva. Llamarla dos veces no cambia nada.
 *
 * La colección que crea guarda una sola columna suya, el enlace con la cuenta.
 * El correo, el nivel y los roles no estan ahi: viven en la cuenta --que es de
 * esta aplicación-- y en `app_access`, y se superponen al pintar. Ver
 * `shared/people.ts`.
 */
import {
  isPeopleTable,
  MEMBER_FIELD,
  PEOPLE_DEFAULT_FIELDS,
  PEOPLE_NAME_FIELD,
  PEOPLE_NAME_LABEL,
  PEOPLE_SYSTEM_FIELDS,
  PEOPLE_TABLE,
  PEOPLE_TABLE_LABEL,
  peopleInitialFields,
  reservedPersonName,
  storedFields,
} from "../shared/people.ts";
import { type AppPerson, type FieldDef, type TableRecord } from "../shared/types.ts";
import { INTERNAL } from "./config.ts";
import { quote } from "./filter.ts";
import {
  createCollection,
  createRecord,
  deleteRecord,
  firstRecord,
  getCollection,
  listRecords,
  updateRecord,
} from "./pb.ts";
import { parkReferences } from "./rowDelete.ts";
import { accessRules, dataCollectionName, SchemaError, updateDataCollection } from "./schema.ts";

/** Lo justo que hace falta de una aplicación para darle su tabla de personas. */
export interface AppForPeople {
  id: string;
  slug: string;
  visibility: "private" | "public";
}

/**
 * Deja lista la tabla de personas de una aplicación y devuelve su registro.
 *
 * Devuelve `null` si la lista de cuentas todavía no existe, que solo pasa
 * mientras el arranque va por la mitad. No se lanza: dejar una aplicación sin
 * su tabla de personas es reparable en el siguiente arranque, y tumbar el
 * arranque entero no lo es.
 */
export async function ensurePeopleTable(app: AppForPeople): Promise<TableRecord | null> {
  const members = await getCollection(INTERNAL.members);
  if (!members) return null;

  const existing = await firstRecord<TableRecord>(
    INTERNAL.tables,
    `app = "${quote(app.id)}" && name = "${quote(PEOPLE_TABLE)}"`,
  );

  // El enlace sale del nombre y cambia cuando la aplicación se renombra, así
  // que el nombre de la colección solo vale para bautizarla: la que ya existe
  // se busca por la tabla, que se lo guardo. Derivandolo del enlace de ahora,
  // el primer arranque tras un renombrado creaba una colección vacía al lado
  // de la que tiene las personas.
  const dataCollection = existing?.dataCollection ?? dataCollectionName(app.slug, PEOPLE_TABLE);

  if (!(await getCollection(dataCollection))) {
    await createCollection({
      name: dataCollection,
      type: "base",
      fields: [
        {
          // Quien es esta fila. Borrar la cuenta se lleva la fila por delante:
          // sin cuenta no hay persona a la que estos datos pertenezcan.
          name: MEMBER_FIELD,
          type: "relation",
          required: true,
          collectionId: members.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      // Una persona, una fila. Sin esto una importacion torpe deja a la misma
      // persona dos veces y las dos filas dicen cosas distintas de ella.
      indexes: [
        `CREATE UNIQUE INDEX \`idx_unico_${dataCollection}_${MEMBER_FIELD}\` ON \`${dataCollection}\` (\`${MEMBER_FIELD}\`)`,
      ],
      ...accessRules(app.id),
    });
    console.log(`  + coleccion "${dataCollection}"`);
  }

  if (existing) {
    await syncPersonRows(app.id, existing.dataCollection);
    return await repair(existing);
  }

  const count = await listRecords(INTERNAL.tables, {
    filter: `app = "${quote(app.id)}"`,
    perPage: 1,
  });
  // Las dos del sistema y la de siempre, "Nombre". Ver `peopleInitialFields`.
  const fields = peopleInitialFields();

  const table = await createRecord<TableRecord>(INTERNAL.tables, {
    app: app.id,
    name: PEOPLE_TABLE,
    label: PEOPLE_TABLE_LABEL,
    dataCollection,
    order: count.totalItems,
    fields,
    meta: { columnOrder: fields.map((f) => f.name), hidden: [], widths: {} },
    system: true,
  });
  console.log(`  + tabla de personas en la aplicacion ${app.id}`);
  // La colección nacio solo con el enlace a la cuenta: aquí se le abren las
  // columnas propias con las que nace la tabla, que es el mismo camino por el
  // que se añade cualquier otra después.
  await updateDataCollection({ dataCollection, fields });
  await syncPersonRows(app.id, dataCollection);
  return table;
}

/**
 * Una fila por persona invitada, ni una mas.
 *
 * La cuadricula lee la colección de la aplicación como la de cualquier tabla,
 * así que quien no tenga fila no aparece. Las personas invitadas antes de este
 * cambio no la tienen: se les crea aquí, vacía. Y al reves, una fila cuya
 * persona ya no esta invitada sobra --se la habria llevado `dropPersonData`--
 * así que también se recoge, para que la cuadricula no ensene a nadie que no
 * tenga acceso.
 */
export async function syncPersonRows(appId: string, dataCollection: string): Promise<void> {
  const access = await listRecords<{ member: string }>(INTERNAL.access, {
    filter: `app = "${quote(appId)}"`,
    perPage: 500,
    skipTotal: 1,
  }).catch(() => null);
  if (!access) return;

  const rows = await listRecords<{ id: string; [MEMBER_FIELD]: string }>(dataCollection, {
    perPage: 500,
    skipTotal: 1,
  }).catch(() => null);
  if (!rows) return;

  const invited = new Set(access.items.map((a) => a.member));
  const withRow = new Set(rows.items.map((r) => r[MEMBER_FIELD]));

  for (const member of invited) {
    if (withRow.has(member)) continue;
    await createRecord(dataCollection, { [MEMBER_FIELD]: member }).catch(() => {});
  }
  for (const row of rows.items) {
    if (invited.has(row[MEMBER_FIELD])) continue;
    await deleteRecord(dataCollection, row.id).catch(() => {});
  }
}

/**
 * Le da fila propia a alguien que acaba de ser invitado.
 *
 * `campos` son sus columnas propias, tal como se escribieron en el mismo
 * formulario que la invito. Nacen con la fila y no en un segundo viaje: una
 * tabla de personas con una columna obligatoria --una cédula, un legajo--
 * rechaza la fila vacía, y entonces la persona se quedaba con cuenta y sin
 * fila, invisible en su propia tabla.
 *
 * Y si aun así no se puede crear, se dice. Antes el fallo se tragaba aquí y lo
 * único que llegaba a la pantalla era el 404 de mas adelante, al ir a buscar
 * una fila que nunca existio.
 *
 * Lo que no sea una columna suya de verdad se ignora: el correo y los roles
 * viven en otras colecciones y llegan por su propia puerta.
 */
export async function ensurePersonRow(
  appId: string,
  memberId: string,
  campos: Record<string, unknown> = {},
): Promise<void> {
  const table = await peopleTableFor(appId);
  if (!table) return;
  const existing = await firstRecord(
    table.dataCollection,
    `${MEMBER_FIELD} = "${quote(memberId)}"`,
  ).catch(() => null);
  if (existing) return;

  const own: Record<string, unknown> = {};
  for (const field of storedFields(table.fields)) {
    if (field.name in campos) own[field.name] = campos[field.name];
  }
  await createRecord(table.dataCollection, { [MEMBER_FIELD]: memberId, ...own });
}

/** La tabla de personas de una aplicación, si ya la tiene. */
export async function peopleTableFor(appId: string): Promise<TableRecord | null> {
  return await firstRecord<TableRecord>(
    INTERNAL.tables,
    `app = "${quote(appId)}" && name = "${quote(PEOPLE_TABLE)}"`,
  ).catch(() => null);
}

/**
 * Añade a cada persona sus columnas propias en esta aplicación.
 *
 * Es lo que permite que una columna de persona de otra tabla enseñe y
 * empareje por una columna única de personas --un documento, no solo el
 * correo--: el emparejado busca en esta lista y no en la cuenta comun, que
 * nunca tuvo esas columnas.
 */
export async function withOwnColumns(appId: string, people: AppPerson[]): Promise<AppPerson[]> {
  if (!people.length) return people;
  const table = await peopleTableFor(appId);
  if (!table) return people;
  const own = storedFields(table.fields);

  const rows = await listRecords<Record<string, unknown>>(table.dataCollection, {
    perPage: 500,
    skipTotal: 1,
  }).catch(() => null);
  if (!rows) return people;

  const byMember = new Map(rows.items.map((r) => [String(r[MEMBER_FIELD] ?? ""), r]));
  return people.map((p) => {
    const row = byMember.get(p.id);
    if (!row) return p;
    const campos: Record<string, unknown> = {};
    for (const f of own) campos[f.name] = row[f.name];
    // El id de su fila viaja aunque la aplicación no le haya puesto ninguna
    // columna propia: es el ancla de toda columna que apunte a personas, y sin
    // el no habria con que enlazar. Ver `AppPerson.fila`.
    return { ...p, fila: String(row.id ?? ""), campos };
  });
}

/**
 * Deja a la vista lo que las filas de otras tablas decian de alguien, antes de
 * que deje de estar invitado.
 *
 * Es la regla general de `server/rowDelete.ts` aplicada a un caso: quitarle el
 * acceso a una persona borra su fila de la tabla de personas, y borrar una fila
 * es lo mismo se borre por donde se borre. Lo único propio de aquí es llegar a
 * esa fila desde la cuenta, que es lo que se sabe al quitar el acceso.
 *
 * Se llama antes de `dropPersonData`: el valor que se guarda sale justamente de
 * la fila que aquella borra.
 */
export async function parkPersonReferences(appId: string, memberId: string): Promise<void> {
  const table = await peopleTableFor(appId);
  if (!table) return;

  const row = await firstRecord<{ id: string }>(
    table.dataCollection,
    `${MEMBER_FIELD} = "${quote(memberId)}"`,
  ).catch(() => null);
  // Sin fila no hay a que apuntar, así que no hay nada que conservar.
  if (!row?.id) return;

  await parkReferences(appId, table, [row.id]);
}

/**
 * Borra lo que una aplicación sabia de una persona, y solo esa aplicación.
 *
 * Se llama al quitarle el acceso, justo antes de borrarle la cuenta de esta
 * aplicación. Lo que sepan de ella otras aplicaciones vive en sus propias
 * colecciones, que aquí no se miran siquiera. Es el borrado y a la vez la
 * prueba de que la separacion es de modelo: no hay nada que filtrar porque no
 * hay nada junto.
 */
export async function dropPersonData(appId: string, memberId: string): Promise<void> {
  const table = await peopleTableFor(appId);
  if (!table) return;
  const row = await firstRecord<{ id: string }>(
    table.dataCollection,
    `${MEMBER_FIELD} = "${quote(memberId)}"`,
  ).catch(() => null);
  if (row) await deleteRecord(table.dataCollection, row.id).catch(() => {});
}

/**
 * La tabla de personas no se borra ni se duplica.
 *
 * Se comprueba aquí y no solo en la pantalla: la pantalla es una cortesia, y
 * quien llame a la API por su cuenta se encuentra lo mismo. Una aplicación sin
 * su tabla de personas no tiene por donde invitar a nadie, y una copia de ella
 * seria una tabla con tres columnas que no sostiene nada.
 */
export function guardSystemTable(table: TableRecord, action: "borrar" | "duplicar") {
  if (!isPeopleTable(table)) return;
  const why =
    action === "borrar"
      ? "es la que sostiene quien entra a la aplicación"
      : "una copia suya no tendría a nadie detrás";
  throw new SchemaError(`La tabla de personas no se puede ${action}: ${why}.`);
}

/**
 * Devuelve las columnas que se van a guardar, con las del sistema intactas.
 *
 * Las dos del sistema van siempre delante y tal como las define
 * `shared/people.ts`: no se borran, no se renombran y no cambian de tipo. Lo
 * que el constructor mande de ellas se compara y se rechaza si difiere, en vez
 * de aceptarse a medias. Detras van sus columnas propias, en el orden que traiga.
 *
 * Entre esas propias hay una que tampoco se puede quitar: la del nombre. No se
 * compara como las del sistema --de ella solo se exige que siga ahi-- porque
 * nada la cambia: la cuadricula no ofrece editarla. Ver `PEOPLE_DEFAULT_FIELDS`.
 *
 * En cualquier otra tabla no hay nada que defender y pasa de largo.
 */
export function guardSystemFields(table: TableRecord, incoming: FieldDef[]): FieldDef[] {
  if (!isPeopleTable(table)) return incoming;

  const kept: FieldDef[] = [];
  for (const def of PEOPLE_SYSTEM_FIELDS) {
    const sent = incoming.filter((f) => f.system === def.system);
    if (sent.length === 0) {
      throw new SchemaError(
        `La columna "${def.label}" no se puede borrar: es una de las que sostienen el acceso a la aplicación.`,
      );
    }
    if (sent.length > 1) {
      throw new SchemaError(`La columna "${def.label}" no puede estar dos veces.`);
    }
    const one = sent[0];
    if ((one.label ?? "").trim() !== def.label || one.name !== def.name) {
      throw new SchemaError(
        `La columna "${def.label}" no se puede renombrar: es una de las que sostienen el acceso a la aplicación.`,
      );
    }
    if (one.type !== def.type) {
      throw new SchemaError(
        `La columna "${def.label}" no puede cambiar de tipo: es una de las que sostienen el acceso a la aplicación.`,
      );
    }
    // Se guarda la definicion de siempre y no la que llego: así lo demás que
    // venga colado --única, obligatoria, opciones-- tampoco cuela.
    kept.push(structuredClone(def));
  }

  const own = incoming.filter((f) => f.system === undefined);
  const invented = incoming.length - kept.length - own.length;
  if (invented > 0) {
    throw new SchemaError("Una columna nueva no puede declararse como columna del sistema.");
  }

  /*
   * Ninguna columna propia puede llamarse como un dato que la sesión ya manda:
   * una página publicada los recibe en un solo nivel, y la columna lo taparia.
   * Se compara el nombre tecnico, que es en lo que se convierte el título al
   * guardar. Ver `PEOPLE_RESERVED_NAMES`.
   */
  for (const f of own) {
    const taken = reservedPersonName(table, f.name || f.label || "");
    if (taken) {
      throw new SchemaError(
        `En la tabla de personas ninguna columna puede llamarse "${f.label || f.name}": ese nombre lo ocupa ${taken}, que es como llega a una página publicada.`,
      );
    }
  }

  // La del nombre se mira por su nombre tecnico, que es lo único que el panel
  // nunca cambia de una columna que ya existe: renombrar cambia el título y
  // deja el nombre y el id quietos. Así, lo que llega sin ella es que se la
  // quitaron.
  if (!own.some((f) => f.name === PEOPLE_NAME_FIELD)) {
    throw new SchemaError(
      `La columna "${PEOPLE_NAME_LABEL}" no se puede borrar: es de donde sale el nombre de cada persona en toda la aplicación. Se puede esconder en la cuadrícula.`,
    );
  }

  return [...kept, ...own];
}

/**
 * Repone lo que le falte a una tabla de personas que ya existia.
 *
 * Las columnas propias no se tocan: solo se asegura que las dos del sistema
 * esten, con su marca y en cabeza. Si alguien las borro llamando a la API por
 * su cuenta, aquí vuelven. Con ellas vuelve la del nombre, que dejo de poder
 * borrarse después de que algunas aplicaciones ya la hubieran perdido: vuelve
 * vacía, porque lo que tuviera dentro se fue con la columna. El nombre de la
 * tabla también se repone: las aplicaciones de antes la llamaban "Personas", y
 * los roles se gestionan ahora desde ella. Ver `PEOPLE_TABLE_LABEL`.
 */
async function repair(table: TableRecord): Promise<TableRecord> {
  const own = (table.fields ?? []).filter((f) => f.system === undefined);
  const noName = !own.some((f) => f.name === PEOPLE_NAME_FIELD);
  // En cabeza de las propias, que es donde nace.
  if (noName) own.unshift(...structuredClone(PEOPLE_DEFAULT_FIELDS));
  let fields: FieldDef[] = [...structuredClone(PEOPLE_SYSTEM_FIELDS), ...own];

  const same =
    (table.fields ?? []).length === fields.length &&
    (table.fields ?? []).every(
      (f, i) =>
        f.name === fields[i].name && f.system === fields[i].system && f.label === fields[i].label,
    );
  if (same && table.system === true && table.label === PEOPLE_TABLE_LABEL) return table;

  // Ponerla en la ficha de la tabla no abre la columna real: esa se fue con
  // ella. Se abre por el mismo camino que cualquier otra, y de vuelta trae el
  // id que le puso PocketBase.
  if (noName) {
    fields = (await updateDataCollection({ dataCollection: table.dataCollection, fields })).fields;
  }

  return await updateRecord<TableRecord>(INTERNAL.tables, table.id, {
    fields,
    system: true,
    label: PEOPLE_TABLE_LABEL,
  });
}
