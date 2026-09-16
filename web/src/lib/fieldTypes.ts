import type { FieldType } from "@shared/types";

export const FIELD_TYPES: Record<FieldType, { label: string; hint: string; icon: string }> = {
  text: { label: "Texto", hint: "Una línea", icon: "type" },
  longtext: { label: "Texto largo", hint: "Varias líneas", icon: "align-left" },
  number: { label: "Número", hint: "Cantidades y precios", icon: "hash" },
  bool: { label: "Sí / No", hint: "Casilla marcable", icon: "tick-02" },
  email: { label: "Correo", hint: "Valida el formato", icon: "mail-01" },
  url: { label: "Enlace", hint: "Dirección web", icon: "link-01" },
  date: { label: "Fecha", hint: "Día y hora", icon: "calendar-01" },
  select: { label: "Lista", hint: "Opciones de colores", icon: "list" },
  file: { label: "Archivo", hint: "Imágenes y documentos", icon: "paperclip" },
  relation: { label: "Relación", hint: "Apunta a otra tabla", icon: "waypoints" },
};

export const FIELD_TYPE_KEYS = Object.keys(FIELD_TYPES) as FieldType[];
