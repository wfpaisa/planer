/**
 * Lo que dice PocketBase, dicho en espanol.
 *
 * La base contesta en ingles y sus frases llegaban enteras a la pantalla: un
 * "cédula: Value must be unique." con un "Batch transaction failed." debajo era
 * el único sitio del panel donde algo no estaba en el idioma de la casa, y
 * ademas el peor momento para no entenderlo --se acaba de importar un archivo y
 * hay que decidir que hacer con las filas que no entraron--.
 *
 * Aquí se traducen las frases que de verdad se ven construyendo tablas y
 * llenandolas. Lo que no este traducido pasa en ingles tal cual: una frase que
 * nadie previo dice mas que esa misma frase escondida detras de un "algo salio
 * mal". El código (`validation_not_unique`) no se toca nunca: es el nombre
 * tecnico del fallo, lo que sirve para buscarlo fuera, y viaja aparte en el
 * renglon de detalle.
 *
 * Nadie decide nada mirando estos textos --no hay código que compare mensajes--
 * así que traducirlos no cambia el comportamiento de nada.
 */

/** Para buscar sin tropezar con la mayuscula inicial ni el punto final. */
const clave = (text: string): string =>
  text.trim().toLowerCase().replace(/\s+/g, " ").replace(/\.+$/, "");

/**
 * Las frases que llevan un número dentro: el limite viaja a la traduccion.
 *
 * Van antes que todo lo demás porque el código solo no lo dice --dos columnas
 * con el mismo código se quejan de largos distintos-- y perder el número seria
 * dejar el aviso sin lo único que hay que corregir.
 */
const CON_DATO: [RegExp, string][] = [
  [/^the length must be between (\d+) and (\d+)$/, "Tiene que medir entre $1 y $2 caracteres"],
  [/^the length must be no less than (\d+)$/, "Tiene que tener al menos $1 caracteres"],
  [/^the length must be no more than (\d+)$/, "No puede pasar de $1 caracteres"],
  [/^the length must be exactly (\d+)$/, "Tiene que medir exactamente $1 caracteres"],
  [/^must be at least (\d+) character\(s\)$/, "Tiene que tener al menos $1 caracteres"],
  [/^must be no more than (\d+) character\(s\)$/, "No puede pasar de $1 caracteres"],
  [/^must be no less than (-?[\d.]+)$/, "No puede ser menor que $1"],
  [/^must be no greater than (-?[\d.]+)$/, "No puede ser mayor que $1"],
  [/^must be larger than (-?[\d.]+)$/, "Tiene que ser mayor que $1"],
  [/^must be less than or equal to (-?[\d.]+)$/, "No puede ser mayor que $1"],
];

/**
 * Por el nombre tecnico del fallo, que es lo que no cambia.
 *
 * PocketBase reescribe sus frases entre versiones; el código no. Cuando viene
 * --y en lo que se objeta a una columna viene casi siempre-- manda el.
 */
const POR_CODIGO: Record<string, string> = {
  validation_required: "Hace falta un valor: esta columna no puede quedar vacía",
  validation_not_unique: "Ya hay otra fila con este valor y la columna no admite repetidos",
  validation_invalid_value: "Ese valor no le sirve a la columna",
  validation_invalid_format: "El valor no tiene la forma que pide la columna",
  validation_not_a_number: "Tiene que ser un número",
  validation_date_invalid: "Tiene que ser una fecha",
  validation_date_out_of_range: "La fecha se sale de lo que admite la columna",
  validation_is_email: "Tiene que ser un correo",
  validation_invalid_email: "Tiene que ser un correo",
  validation_invalid_new_email: "Tiene que ser un correo",
  validation_email_domain_not_allowed: "Ese dominio de correo no se admite",
  validation_is_url: "Tiene que ser un enlace",
  validation_invalid_json: "El contenido no es un JSON válido",
  validation_in_invalid: "Ese valor no está entre las opciones de la columna",
  validation_missing_rel_records: "No se encontró la fila con la que enlazar",
  validation_invalid_relation: "La relación apunta a una fila que no existe",
  validation_too_many_files: "Son más archivos de los que admite la columna",
  validation_invalid_file: "El archivo no se pudo leer",
  validation_invalid_mime_type: "Ese tipo de archivo no se admite en la columna",
  validation_file_size_limit: "El archivo pesa más de lo que admite la columna",
  validation_values_mismatch: "Los dos valores no coinciden",
  validation_invalid_password: "La contraseña no es correcta",
  validation_invalid_old_password: "La contraseña de antes no es correcta",
  validation_invalid_token: "El enlace o el código ya no vale",
  validation_invalid_record: "La fila no vale tal como está",
  validation_not_found: "No se encontró",
  validation_duplicated_field_name: "Ya hay otra columna con ese nombre",
  validation_reserved_field_name: "Ese nombre de columna está reservado",
  validation_collection_name_exists: "Ya hay otra tabla con ese nombre",
};

/**
 * Por la frase, para lo que llega sin código.
 *
 * Es el caso de los niveles de fuera de un lote --"Batch transaction failed",
 * "Failed to update record"--, que son mensajes de la API y no quejas contra
 * una columna. Las claves van como las deja `clave()`: en minusculas y sin el
 * punto del final.
 */
const POR_FRASE: Record<string, string> = {
  "batch transaction failed": "No entró nada: el lote se deshizo entero",
  "failed to create record": "No se pudo crear la fila",
  "failed to update record": "No se pudo guardar la fila",
  "failed to delete record": "No se pudo borrar la fila",
  "failed to delete record. make sure that the record is not part of a required relation reference":
    "No se pudo borrar la fila: otra la tiene enlazada y no puede quedarse sin ella",
  "failed to authenticate": "No se pudo entrar: revise el correo y la contraseña",
  "failed to load the submitted data due to invalid formatting":
    "No se pudo leer lo que se envió: el formato no es válido",
  "an error occurred while validating the submitted data": "Hay algo que no cuadra en lo enviado",
  "something went wrong while processing your request": "Algo salió mal al atender la petición",
  "you are not allowed to perform this request": "No tiene permiso para hacer esto",
  "the request requires valid record authorization token": "Hay que volver a iniciar sesión",
  "the requested resource wasn't found": "No se encontró lo que se pidió",
  "missing required record id": "Falta decir de qué fila se habla",
  "too many requests": "Demasiadas peticiones seguidas: espere un momento",
  // Lo que se ve al cambiar una tabla; ver `recreateChanged` en `server/schema.ts`.
  "failed to create collection": "No se pudo crear la tabla",
  "failed to update collection": "No se pudo cambiar la tabla",
  "failed to delete collection": "No se pudo borrar la tabla",
  "field type cannot be changed": "PocketBase no le cambia el tipo a una columna que ya existe",
  "the relation collection cannot be changed": "Una relación no cambia de tabla una vez creada",
  // Las mismas quejas de arriba, por si alguna llega sin su código.
  "value must be unique": "Ya hay otra fila con este valor y la columna no admite repetidos",
  "cannot be blank": "Hace falta un valor: esta columna no puede quedar vacía",
  "missing required value": "Hace falta un valor: esta columna no puede quedar vacía",
  "invalid value": "Ese valor no le sirve a la columna",
  "must be a valid value": "Ese valor no le sirve a la columna",
  "must be a valid email address": "Tiene que ser un correo",
  "must be a valid url": "Tiene que ser un enlace",
  "must be a valid date": "Tiene que ser una fecha",
  "must be a number": "Tiene que ser un número",
  "must be in a valid format": "El valor no tiene la forma que pide la columna",
};

/**
 * La frase de PocketBase en espanol, o la suya propia si no esta traducida.
 *
 * `code` es el nombre tecnico que acompana a lo que se le objeta a una columna,
 * cuando lo hay.
 */
export function enEspanol(message: string, code?: string): string {
  const text = message.trim();
  if (!text) return text;

  const key = clave(text);
  for (const [patron, dicho] of CON_DATO) {
    const found = key.match(patron);
    if (found) return dicho.replace(/\$(\d)/g, (_, n: string) => found[Number(n)] ?? "");
  }

  return (code ? POR_CODIGO[code] : undefined) ?? POR_FRASE[key] ?? text;
}
