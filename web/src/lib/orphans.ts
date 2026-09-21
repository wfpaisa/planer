/**
 * Los valores que no encontraron a quien apuntar.
 *
 * Una fila cuya llave no existe en la tabla destino se guarda igual: el valor
 * se queda a la vista en su columna de reserva y la celda lo ensena sin enlace.
 * Aqui se cuenta cuantas hay --la grilla lo dice en su barra y avisa de que
 * tabla no tiene esos valores-- y se recogen las que estaban esperando cuando
 * el registro que les faltaba acaba naciendo.
 *
 * Resolverlos de uno en uno desde una pantalla aparte ya no existe: lo que la
 * arreglaba de verdad era crear el registro en su tabla, y eso ya ofrece
 * enlazar las filas que lo esperaban (ver `waitingFor`).
 */
import { isPeopleTable, personKeyValue } from "@shared/people";
import { firstUnique } from "@shared/relations";
import {
  type AppPerson,
  displayFieldOf,
  type FieldDef,
  isRelationField,
  orphanFieldName,
  type TableRecord,
} from "@shared/types";

import { pb } from "./pb";

/** Un valor sin dueno, con cuantas filas dependen de el. */
export interface OrphanValue {
  field: FieldDef;
  value: string;
  rows: number;
  /** El constructor ya lo dio por bueno. */
  accepted: boolean;
}

/**
 * Cuenta las filas sin enlace de una tabla, agrupadas por valor.
 *
 * Se pregunta a la base y no a lo que hay en pantalla: la grilla ensena una
 * pagina, y el recuento es de la tabla entera.
 */
export async function loadOrphans(table: TableRecord): Promise<OrphanValue[]> {
  const relations = (table.fields ?? []).filter((f) => isRelationField(f) && f.multiple !== true);
  if (relations.length === 0) return [];

  const filter = relations.map((f) => `${orphanFieldName(f.name)} != ""`).join(" || ");
  const rows = await pb
    .collection(table.dataCollection)
    .getFullList<Record<string, unknown>>({ filter, batch: 500 });

  const out: OrphanValue[] = [];
  for (const field of relations) {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const raw = row[orphanFieldName(field.name)];
      const value = raw == null ? "" : String(raw);
      // Con enlace no cuenta: las dos columnas nunca estan llenas a la vez,
      // pero una fila recien enlazada puede traer el texto todavia.
      if (!value || row[field.name]) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    const accepted = table.acceptedOrphans?.[field.name] ?? [];
    for (const [value, count] of counts) {
      out.push({ field, value, rows: count, accepted: accepted.includes(value) });
    }
  }

  return out.sort((a, b) => b.rows - a.rows);
}

/** Lo que estaba esperando a un registro, y a que id hay que enlazarlo. */
export interface Waiting {
  field: FieldDef;
  table: TableRecord;
  value: string;
  rows: string[];
  /** El id que va en la celda: el de la fila del destino, siempre. */
  record: string;
}

/**
 * El valor de la fila recien creada por el nombre de una de sus columnas.
 *
 * La fila de personas que vuelve de guardar lleva el correo bajo `cuenta` --que
 * es donde vive, en la cuenta y no en la coleccion-- y las columnas propias con
 * su nombre. `email` se acepta porque columnas de antes de este cambio guardan
 * asi la llave. Es el mismo reparto que `personKeyValue`, visto desde la fila.
 */
function createdValue(created: Record<string, unknown>, key: string): string {
  if (key === "email") return String(created.cuenta ?? "");
  return String(created[key] ?? "");
}

/**
 * Una persona invitada, vista como la fila de la tabla de personas que es.
 *
 * Hace falta al terminar de importar personas: lo que se relee es la lista de
 * invitados, y `waitingFor` trabaja con filas. El correo se pone bajo `cuenta`
 * --que es el nombre de su columna, aunque el dato viva en la cuenta-- y las
 * columnas propias con el suyo. Ver `design.md` D10.
 */
export function personAsRow(person: AppPerson): Record<string, unknown> {
  return { ...(person.campos ?? {}), id: person.fila ?? "", cuenta: person.email ?? "" };
}

/** Cuantos valores caben en un filtro antes de partirlo en dos peticiones. */
const FILTER_CHUNK = 50;

/**
 * Filas de otras tablas que estaban esperando a un registro que acaba de nacer.
 *
 * Se mira despues de crear una fila: si su llave coincide con un valor que
 * quedo sin dueno y nadie lo acepto, esas filas se pueden enlazar de una vez.
 * Sin esto, alguien invita a la persona que faltaba y sus veinte filas siguen
 * sin enlace sin que nada lo diga.
 *
 * `created` admite varios registros porque una importacion crea muchos de golpe
 * y el barrido es el mismo: se recorren las tablas una vez y cada columna
 * pregunta por todos los valores juntos. Llamarlo por cada persona de un
 * archivo de doscientas seria repetir doscientas veces el mismo recorrido. Ver
 * `design.md` D8.
 *
 * Las que apuntan a la tabla de personas entran por la misma puerta que las
 * demas: lo que guardan es el id de la fila del destino. Lo unico suyo es que
 * un valor que tienen dos personas no enlaza a ninguna, que se comprueba
 * contra la lista de invitados.
 */
export async function waitingFor(opts: {
  /** La tabla donde acaban de nacer los registros. */
  target: TableRecord;
  created: Record<string, unknown> | Record<string, unknown>[];
  /** Todas las tablas de la aplicacion. */
  tables: TableRecord[];
  /**
   * Los invitados a la aplicacion, para no enlazar una cedula que tengan dos.
   * Puede venir sin el recien creado: aqui solo se mira quien mas la lleva.
   */
  people?: AppPerson[];
}): Promise<Waiting[]> {
  const out: Waiting[] = [];
  const intoPeople = isPeopleTable(opts.target);
  const nacidos = Array.isArray(opts.created) ? opts.created : [opts.created];
  if (nacidos.length === 0) return out;

  for (const table of opts.tables) {
    for (const field of table.fields ?? []) {
      if (!isRelationField(field) || field.multiple === true) continue;
      if (field.relationTableId !== opts.target.id) continue;

      const key = displayFieldOf(field) || firstUnique(opts.target);
      if (!key) continue;
      const accepted = table.acceptedOrphans?.[field.name] ?? [];

      /*
       * De cada valor, a que registro enlaza. Un valor que dos de los recien
       * nacidos comparten no enlaza a ninguno: es la misma regla que al
       * emparejar, y aqui aparece cuando el archivo trae la cedula repetida.
       */
      const porValor = new Map<string, string>();
      const repetidos = new Set<string>();
      for (const created of nacidos) {
        const value = createdValue(created, key);
        const record = String(created.id ?? "");
        if (!value || !record) continue;
        if (accepted.includes(value)) continue;
        if (intoPeople && otherPersonWith(opts.people ?? [], key, value, record)) continue;
        if (porValor.has(value)) repetidos.add(value);
        porValor.set(value, record);
      }
      for (const value of repetidos) porValor.delete(value);
      if (porValor.size === 0) continue;

      /*
       * Una peticion por tramo y no una por valor: doscientas personas son
       * doscientas consultas a la misma tabla, y lo que se busca es un valor de
       * una lista.
       */
      const orphan = orphanFieldName(field.name);
      const valores = [...porValor.keys()];
      const filas = new Map<string, string[]>();
      for (let i = 0; i < valores.length; i += FILTER_CHUNK) {
        const chunk = valores.slice(i, i + FILTER_CHUNK);
        const filter = chunk.map((v) => `${orphan} = ${JSON.stringify(v)}`).join(" || ");
        const rows = await pb
          .collection(table.dataCollection)
          .getFullList<Record<string, unknown>>({ filter, batch: 500 })
          .catch(() => []);
        for (const row of rows) {
          // Una fila ya enlazada no espera a nadie, aunque conserve el texto.
          if (row[field.name]) continue;
          const value = String(row[orphan] ?? "");
          const seen = filas.get(value);
          if (seen) seen.push(String(row.id ?? ""));
          else filas.set(value, [String(row.id ?? "")]);
        }
      }

      for (const [value, record] of porValor) {
        const rows = filas.get(value);
        if (rows?.length) out.push({ field, table, value, rows, record });
      }
    }
  }

  return out;
}

/** Si alguien mas, aparte del recien creado, lleva ya ese valor en esa llave. */
function otherPersonWith(people: AppPerson[], key: string, value: string, self: string): boolean {
  const lower = value.toLowerCase();
  return people.some((p) => p.fila !== self && personKeyValue(p, key).toLowerCase() === lower);
}

/** Enlaza a un registro las filas que llevaban su valor a la espera. */
export async function linkWaiting(waiting: Waiting): Promise<void> {
  const orphanColumn = orphanFieldName(waiting.field.name);
  for (const id of waiting.rows) {
    await pb
      .collection(waiting.table.dataCollection)
      .update(id, { [waiting.field.name]: waiting.record, [orphanColumn]: "" });
  }
}

/** Cuantas filas cuentan todavia: las aceptadas ya no. */
export function pendingRows(orphans: OrphanValue[]): number {
  return orphans.filter((o) => !o.accepted).reduce((sum, o) => sum + o.rows, 0);
}
