/**
 * El valor de una celda, sin dibujarla.
 *
 * Aparte de `components/cells` porque no es marcado: lo usan la exportacion a
 * Excel y la rejilla de personas, que no pintan nada. Antes vivia dentro del
 * componente y arrastraba React a dos archivos de logica pura.
 */
import { MEMBER_FIELD, personKeyValue } from "@shared/people";
import {
  type AppPerson,
  detailFieldOf,
  displayFieldOf,
  type FieldDef,
  isRelationField,
  orphanFieldName,
} from "@shared/types";

export type Row = Record<string, unknown> & { id: string; collectionId?: string };

/* ------------------------------------------------------------------ */
/* Formato de lectura                                                   */
/* ------------------------------------------------------------------ */

const dateFmt = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDate(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? "" : dateFmt.format(date);
}

/** Texto plano de una celda, para busquedas y exportaciones. */
export function cellText(field: FieldDef, row: Row): string {
  if (isRelationField(field)) return relationCell(row, field).label;
  const value = row[field.name];
  if (value === null || value === undefined || value === "") return "";
  if (field.type === "date") return formatDate(value);
  if (field.type === "bool") return value ? "Si" : "No";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

/**
 * En que estado esta una celda de relacion.
 *
 * `orphan` no es una averia: el exceso de velocidad ocurrio aunque esa cedula
 * no este en la lista. Se marca en neutro. `broken` si es un aviso: hay un id
 * guardado cuyo registro ya no existe o no esta al alcance.
 */
export type RelationState = "empty" | "linked" | "orphan" | "broken";

export interface RelationCell {
  state: RelationState;
  /** Lo que se ve. Con enlace o sin el, siempre es la llave, nunca el id. */
  label: string;
  /**
   * Lo que va entre parentesis detras de la llave. Vacio: no va nada.
   *
   * La llave sola no siempre dice de quien se trata --una cedula no se
   * reconoce-- y cambiarla por el nombre esconderia justo el dato que se
   * escribe y se importa. Van los dos. Ver `detailFieldOf`.
   */
  detail: string;
}

/**
 * Lo que ensena una celda de relacion.
 *
 * Ya no se adivina: se lee la columna que la propia definicion declara. Antes
 * se cogia la primera columna de texto del registro expandido, asi que anadir
 * una columna a la tabla destino cambiaba lo que veia todo el mundo.
 */
export function relationCell(row: Row, field: FieldDef, people: AppPerson[] = []): RelationCell {
  const id = row[field.name];
  const single = Array.isArray(id) ? id[0] : id;

  if (!single) {
    const orphan = row[orphanFieldName(field.name)];
    const value = orphan == null ? "" : String(orphan);
    return value
      ? { state: "orphan", label: value, detail: "" }
      : { state: "empty", label: "", detail: "" };
  }

  const display = displayFieldOf(field);
  const detail = detailFieldOf(field);

  const expand = (row as { expand?: Record<string, unknown> }).expand?.[field.name];
  const one = Array.isArray(expand) ? expand[0] : expand;

  /*
   * Una fila de la tabla de personas llega sin su correo ni sus roles: no estan
   * en su coleccion, viven en la cuenta y en el enlace con la aplicacion. Quien
   * los tiene es la lista de invitados, que llega por su propia ruta. Se
   * reconoce por el enlace con la cuenta, que solo esa tabla tiene.
   *
   * Vale tambien sin registro expandido, que no significa que la celda este
   * rota: la lista de invitados sola basta para decir de quien se trata.
   */
  const member = one && typeof one === "object" ? (one as Row)[MEMBER_FIELD] : undefined;
  const invited = people.find(
    (p) => p.fila === String(single) || (member !== undefined && p.id === String(member)),
  );
  if (invited) {
    // Sin valor en la columna elegida queda el correo: la celda esta enlazada,
    // y dejarla en blanco la haria pasar por vacia.
    const label = personKeyValue(invited, display) || invited.email || invited.name;
    const aside = detail ? personKeyValue(invited, detail) : "";
    return { state: "linked", label, detail: aside === label ? "" : aside };
  }

  if (!one || typeof one !== "object") {
    // El registro no vino con la fila: se borro o quedo fuera del alcance. No
    // se vacia la celda en silencio.
    return { state: "broken", label: "", detail: "" };
  }

  const record = one as Record<string, unknown>;
  const raw = detail && record[detail] != null ? String(record[detail]) : "";
  if (display && record[display] != null) {
    const label = String(record[display]);
    return { state: "linked", label, detail: raw === label ? "" : raw };
  }
  const aside = raw;

  // Respaldo de las columnas de antes de este cambio, que todavia no declaran
  // que ensenan: lo mismo que se venia adivinando. La migracion lo retira.
  const key = Object.keys(record).find(
    (k) => typeof record[k] === "string" && !["id", "collectionId", "collectionName"].includes(k),
  );
  return {
    state: "linked",
    label: key ? String(record[key]) : String(record.id ?? ""),
    detail: aside,
  };
}
