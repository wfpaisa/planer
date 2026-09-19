/**
 * Escribir lo importado: de las filas ya convertidas a la tabla.
 *
 * Los pasos que `ImportModal.svelte` encadena al darle a Importar --crear las
 * columnas nuevas, armar los pedidos segun el modo, mandarlos por lotes y
 * contar lo que quedo fuera--. El orquestador se queda en el componente, que es
 * quien enciende el reloj y ensena el parte; aqui esta lo que hace el trabajo.
 *
 * A donde va cada columna y como se convierte cada celda vive en
 * `importPlan.ts`; lo que comparten los pasos del asistente, en
 * `importWizard.svelte.ts`.
 */
import { IMPORT_BATCH_CHUNK } from "@shared/importBatch";
import { type Match, relationCellValues } from "@shared/relations";
import { type FieldType, isRelationField, type TableRecord } from "@shared/types";

import type { Row } from "./cellValues";
import type { ColumnPlan, ColumnTarget, ConvertedRow, RowStatus, SaveMode } from "./importPlan";
import { errorMessage, isRateLimited, patch, pb } from "./pb";
import type { PeopleImportReport } from "./peopleGrid";

/**
 * Lo que hace falta para saber que le pasa a una fila.
 *
 * Llega entero y no por partes porque se pregunta una vez por fila del archivo:
 * es lo que pinta la columna "Que le pasa a la fila" de la previsualizacion.
 */
export interface StatusContext {
  isPeople: boolean;
  /** Donde guarda el correo esta tabla de personas. */
  accountField: string;
  /** Los correos del archivo que ya tienen cuenta aqui, segun el servidor. */
  knownEmails: Set<string>;
  mode: SaveMode;
  /** Las ids que ya estan en la tabla. */
  existingIds: Set<string>;
  /** Si se sobrescribe por orden, porque el archivo no trae columna de id. */
  overwriteByOrder: boolean;
  /** Que turno ocupa cada fila al sobrescribir por orden, o -1 si no gasta uno. */
  orderTurns: number[];
  existingRows: Row[];
}

export function rowStatus(conv: ConvertedRow, index: number, ctx: StatusContext): RowStatus {
  /*
   * En personas no hay modo que elegir: cada fila se reconoce por su correo.
   * La de quien ya tiene cuenta aqui se actualiza --con lo que traiga el
   * archivo-- y la de quien no, nace. Cuales son unas y cuales otras lo dice
   * el servidor en `knownEmails`, que es lo mismo que cuenta el aviso de
   * encima de la tabla: asi el color y el numero no pueden discrepar.
   */
  if (ctx.isPeople) {
    const email = String(conv.values[ctx.accountField] ?? "")
      .trim()
      .toLowerCase();
    return email && ctx.knownEmails.has(email) ? "update" : "new";
  }
  if (ctx.mode === "add") return "add";
  if (ctx.mode === "replace") return "replace";
  if (conv.id && ctx.existingIds.has(conv.id)) return "update";
  if (ctx.overwriteByOrder) {
    const turn = ctx.orderTurns[index] ?? -1;
    return turn >= 0 && ctx.existingRows[turn] ? "update" : "new";
  }
  return "new";
}

/**
 * La fila que se manda a guardar.
 *
 * Los planes llegan de fuera y no se leen del asistente a proposito: al
 * guardar, las columnas recien creadas ya existen y tienen nombre, pero los
 * planes del asistente salen de `table.fields`, que es la tabla tal como estaba
 * al abrir el dialogo. Con los planes de antes, el valor de una columna nueva
 * se guardaba bajo la clave vacia --el borrador aun no tenia nombre-- y la
 * columna quedaba creada y vacia.
 *
 * La celda vacia manda igual que la escrita: deja la columna vacia. El
 * archivo es lo que queda, y no una mezcla de lo que trae con lo que hubiera
 * antes; solo se tocan las columnas que entran --las que se recorren aqui--,
 * asi que lo que el archivo ni menciona se queda como estaba. Era una casilla
 * ("Las celdas vacias borran el valor guardado") y no lo es: al importar
 * apagada, corregir un dato quitandolo no hacia nada y no se veia por que.
 */
export function buildBody(
  conv: ConvertedRow,
  plansToUse: ColumnPlan[],
  matches: Map<string, Map<string, Match>>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const plan of plansToUse) {
    const target = plan.target;
    if (target.kind !== "field" && target.kind !== "create") continue;
    const field = target.kind === "create" ? target.draft : target.field;

    // Una relacion se guarda por el registro que encontro, no por el texto:
    // el id si lo encontro, y el corralito del valor sin dueno si no. Una
    // fila sin enlace entra igual; no es un error de importacion.
    if (isRelationField(field) && field.multiple !== true) {
      const raw = conv.values[field.name];
      if (raw === undefined) {
        Object.assign(body, relationCellValues(field, { id: "", value: "" }));
        continue;
      }
      const value = String(raw);
      const match = matches.get(field.name)?.get(value) ?? { id: "", value };
      Object.assign(body, relationCellValues(field, match));
      continue;
    }

    const value = conv.values[field.name];
    body[field.name] = value === undefined ? null : value;
  }
  return body;
}

/**
 * Crea en la tabla las columnas nuevas que trae el archivo y devuelve las
 * columnas ya reales. Va antes de guardar las filas: sin ellas, sus valores no
 * tendrian donde caer.
 */
export async function createColumns(
  table: TableRecord,
  toCreate: ColumnPlan[],
): Promise<TableRecord["fields"]> {
  const updated = await patch<TableRecord>(`/api/tables/${table.id}`, {
    fields: [
      ...table.fields,
      /*
       * Con el nombre que se leyo en la previsualizacion, no con el del
       * archivo: el borrador ya trae la mayuscula puesta y el tipo
       * adivinado, y crearla por `p.column` dejaba en la tabla una
       * columna llamada "contacto mail" despues de haber ensenado
       * "Contacto mail" en el encabezado.
       */
      ...toCreate.map((p) => {
        const draft = p.target.kind === "create" ? p.target.draft : null;
        return {
          name: "",
          label: draft?.label || p.column,
          type: draft?.type ?? ("text" as FieldType),
        };
      }),
    ],
  });
  return updated.fields;
}

/**
 * Los planes con los nombres ya reales: el borrador de una columna recien
 * creada se cambia por la columna, y el que no llego a crearse se apaga.
 */
export function resolvePlans(plans: ColumnPlan[], fields: TableRecord["fields"]): ColumnPlan[] {
  return plans.map((plan) => {
    if (plan.target.kind !== "create") return plan;
    const label = plan.target.draft.label || plan.column;
    const created = fields.find((f) => f.label === label);
    const target: ColumnTarget = created ? { kind: "field", field: created } : { kind: "skip" };
    return { ...plan, target };
  });
}

/** Un pedido de escritura, con el sitio que ocupa en el archivo la fila que lo trae. */
export interface ImportRequest {
  method: string;
  url: string;
  body: Record<string, unknown>;
  /** La fila del archivo (desde 0), o -1 si no sale de ninguna. */
  row: number;
}

/**
 * Los pedidos de escritura, por modo de guardado. Los borrados de "Reemplazar
 * todo" no salen de ninguna fila del archivo, y por eso van con `row: -1`.
 */
export function buildRequests(opts: {
  table: TableRecord;
  mode: SaveMode;
  /** Lo que se va a guardar, cada fila con su sitio en el archivo. */
  validPairs: { conv: ConvertedRow; row: number }[];
  plans: ColumnPlan[];
  /** Si alguna columna del archivo va al id: decide como se sobrescribe. */
  hasIdColumn: boolean;
  existingIds: Set<string>;
  existingRows: Row[];
  matches: Map<string, Map<string, Match>>;
}): ImportRequest[] {
  const { table, mode, validPairs, plans, hasIdColumn, existingIds, existingRows, matches } = opts;
  const requests: ImportRequest[] = [];
  const records = (id: string) =>
    `/api/collections/${table.dataCollection}/records${id ? `/${id}` : ""}`;

  if (mode === "replace") {
    for (const id of existingIds) {
      requests.push({ method: "DELETE", url: records(id), body: {}, row: -1 });
    }
    for (const { conv, row } of validPairs) {
      requests.push({
        method: "POST",
        url: records(""),
        body: { ...buildBody(conv, plans, matches), id: conv.id ?? undefined },
        row,
      });
    }
  } else if (mode === "overwrite") {
    for (const [n, { conv, row }] of validPairs.entries()) {
      const body = buildBody(conv, plans, matches);
      if (conv.id && existingIds.has(conv.id)) {
        requests.push({ method: "PATCH", url: records(conv.id), body, row });
      } else if (hasIdColumn) {
        // Con columna de id se conserva el id aunque sea nuevo, para no
        // romper relaciones que ya apunten a el.
        requests.push({
          method: "POST",
          url: records(""),
          body: { ...body, id: conv.id ?? undefined },
          row,
        });
      } else {
        // Sin columna de id: se actualiza por orden contra la fila
        // existente que toca; las que sobran se crean como nuevas.
        const target = existingRows[n]?.id;
        if (target) requests.push({ method: "PATCH", url: records(target), body, row });
        else requests.push({ method: "POST", url: records(""), body, row });
      }
    }
  } else {
    // Anadir: las ids del archivo se ignoran.
    for (const { conv, row } of validPairs) {
      requests.push({
        method: "POST",
        url: records(""),
        body: buildBody(conv, plans, matches),
        row,
      });
    }
  }

  return requests;
}

/**
 * Manda los pedidos por lotes con la API Batch, tramo a tramo, y devuelve las
 * filas del archivo que no llegaron a la tabla.
 *
 * `leftover` entra con las que ni se intentaron --traian error de conversion--
 * y sale con esas mas las que fallaron al escribir.
 *
 * `created` es opcional y se llena aqui, igual que `leftover`: por cada fila
 * que nacio, el id que le puso la base. Solo lo pide quien tenga que volver
 * sobre ella --deshacer un pegado que creo filas es borrarlas-- y por eso la
 * importacion no lo pasa.
 */
export async function writeBatches(
  requests: ImportRequest[],
  opts: { continueOnError: boolean; leftover: Set<number>; created?: Map<number, string> },
): Promise<Set<number>> {
  const { continueOnError, leftover, created } = opts;
  let failures = 0;
  let parado = -1;

  for (let i = 0; i < requests.length; i += IMPORT_BATCH_CHUNK) {
    const chunk = requests.slice(i, i + IMPORT_BATCH_CHUNK);
    const enviar = () =>
      fetch("/pb/api/batch", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: pb.authStore.token },
        // `row` es solo nuestro --dice de que fila del archivo sale cada
        // pedido-- y la API de lote rechaza lo que no conoce: se queda aqui.
        body: JSON.stringify({
          requests: chunk.map(({ method, url, body }) => ({ method, url, body })),
        }),
      });

    /*
     * Un tramo que se paso de rapido se vuelve a intentar entero.
     *
     * Se puede porque el lote es una transaccion: del tramo que fallo no
     * entro ni una fila, asi que repetirlo no duplica nada. El limite lo
     * pone PocketBase por ventana de segundos (ver `IMPORT_RATE_FLOOR` en
     * `shared/importBatch.ts`), de modo que esperar es todo lo que hay que
     * hacer; se espera un poco mas en cada intento y se abandona al tercero
     * para no quedarse dando vueltas en una instalacion con el limite muy
     * abajo.
     */
    let res = await enviar();
    let fallo = res.ok ? null : await res.json().catch(() => null);
    for (let intento = 1; intento <= 2 && isRateLimited(fallo); intento++) {
      await new Promise((listo) => setTimeout(listo, intento * 2000));
      res = await enviar();
      fallo = res.ok ? null : await res.json().catch(() => null);
    }
    if (!res.ok) {
      throw new Error(
        errorMessage({ message: `La API de lote respondio ${res.status}`, response: fallo }),
      );
    }
    const data = (await res.json()) as Record<string, { status: number; body?: { id?: string } }>;
    // La respuesta viene en el orden del tramo, asi que la posicion dice de
    // que pedido --y de que fila del archivo-- habla cada resultado.
    for (const [key, r] of Object.entries(data)) {
      const pedido = chunk[Number(key)];
      if (r.status < 400) {
        // El id de una fila recien nacida no esta en ningun otro sitio: el
        // pedido lo mando sin el y la base se lo puso al guardarla.
        if (created && pedido?.method === "POST" && pedido.row >= 0 && r.body?.id) {
          created.set(pedido.row, r.body.id);
        }
        continue;
      }
      failures++;
      const row = pedido?.row ?? -1;
      if (row >= 0) leftover.add(row);
    }
    if (failures > 0 && !continueOnError) {
      parado = i + chunk.length;
      break;
    }
  }
  // Lo que quedo sin intentar cuando se paro en el primer fallo tampoco
  // esta en la tabla: cuenta como fuera.
  if (parado >= 0) {
    for (const r of requests.slice(parado)) if (r.row >= 0) leftover.add(r.row);
  }

  return leftover;
}

/**
 * Las filas que no entraron en una importacion de personas, por su sitio en el
 * archivo: las que ya traian error, las que no tienen un correo utilizable y
 * las de quien no tiene cuenta cuando no se pidio crearlas. El servidor las
 * cuenta y dice sus correos; aqui se vuelven a encontrar en el archivo para
 * poder ensenarlas y descargarlas tal como venian.
 */
export function peopleLeftover(
  converted: ConvertedRow[],
  report: PeopleImportReport,
  accountField: string,
): number[] {
  const sinCuenta = new Set(report.fueraCorreos.map((c) => c.trim().toLowerCase()));
  const leftover: number[] = [];
  converted.forEach((c, i) => {
    if (c.errors.length > 0) {
      leftover.push(i);
      return;
    }
    const correo = String(c.values[accountField] ?? "")
      .trim()
      .toLowerCase();
    if (!correo || sinCuenta.has(correo)) leftover.push(i);
  });
  return leftover;
}

/**
 * El resumen de una importacion de personas.
 *
 * Una frase por cifra, y cada una nombrando su sujeto: aqui se cuentan
 * personas, y quien recoge esto cuenta ademas filas de otras tablas --las que
 * quedaron enlazadas y las que no--. Con todo en una frase no se sabria cual de
 * los tres numeros cuenta que. Ver `peopleImportNote`.
 */
export function peopleSummary(report: PeopleImportReport): string {
  const guardadas = report.existen + report.seCrearan;
  const partes: string[] = [
    `Se ${guardadas === 1 ? "importó 1 persona" : `importaron ${guardadas} personas`}${
      report.seCrearan > 0 ? `, ${report.seCrearan} con cuenta nueva` : ""
    }.`,
  ];
  if (report.fuera > 0) {
    partes.push(
      `${report.fuera} ${report.fuera === 1 ? "fila se quedó fuera" : "filas se quedaron fuera"} porque ${report.fuera === 1 ? "esa persona no tiene" : "esas personas no tienen"} cuenta y no se pidió crearlas.`,
    );
  }
  if (report.sinCorreo > 0) {
    partes.push(
      `${report.sinCorreo} ${report.sinCorreo === 1 ? "quedó fuera" : "quedaron fuera"} sin un correo utilizable.`,
    );
  }
  if (report.rolesNuevos.length > 0) {
    partes.push(
      `${report.rolesNuevos.length === 1 ? "Nació 1 rol nuevo" : `Nacieron ${report.rolesNuevos.length} roles nuevos`}: ${report.rolesNuevos.join(", ")}.`,
    );
  }
  return partes.join(" ");
}

/** El resumen de una importacion corriente, por filas. */
export function rowsSummary(total: number, fuera: number[]): string {
  const guardadas = total - fuera.length;
  return fuera.length === 0
    ? `${guardadas} ${guardadas === 1 ? "fila guardada" : "filas guardadas"}.`
    : `${guardadas} ${guardadas === 1 ? "fila guardada" : "filas guardadas"}, ${fuera.length} ${
        fuera.length === 1 ? "se quedo fuera" : "se quedaron fuera"
      }.`;
}
