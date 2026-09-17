/**
 * Las conversaciones con la inteligencia artificial.
 *
 * Pertenecen a la pagina donde se hicieron, no a la aplicacion: la lista de
 * una pagina ensena solo las suyas, asi que ninguna entrada necesita decir en
 * que pagina se hizo, y no hay forma de abrir una hecha en otra --seguir
 * escribiendo ahi cambiaria una pagina distinta de la que el hilo nombra--.
 *
 * Borrar la pagina se las lleva: lo hace la cascada de la relacion `page`.
 *
 * Guardadas hay muchas, pero **abierta hay una sola en toda la aplicacion**: la
 * ultima en la que se hablo, apuntada en la aplicacion. La pagina que la tiene
 * la repone al abrirse; las demas empiezan en blanco, aunque tengan
 * conversaciones suyas guardadas. Vive en la base de datos y no en el navegador
 * porque quien sigue desde otro equipo tiene que encontrarse delante la misma
 * que dejo, y solo esa.
 */
import type {
  AiChat,
  AiChatFile,
  AiChatSummary,
  AiMessage,
  AiOpenChat,
  AppRecord,
  PageRecord,
} from "../shared/types.ts";
import { pruneAiFiles } from "./aiFiles.ts";
import { HttpError } from "./auth.ts";
import { INTERNAL } from "./config.ts";
import { quote } from "./filter.ts";
import { createRecord, deleteRecord, firstRecord, listRecords, updateRecord } from "./pb.ts";

/** Cuantas conversaciones se conservan por aplicacion. */
const MAX_CHATS = 50;

/** Cuantos mensajes se conservan dentro de una conversacion. */
const MAX_MESSAGES = 60;

const title = (text: string) => text.trim().replace(/\s+/g, " ").slice(0, 120) || "Sin título";

/**
 * Los nombres que acompanaban a una peticion --los elementos senalados-- tal
 * como se guardan: texto corto y nada mas. Lo que no sea texto se descarta en
 * vez de viajar deformado.
 */
function readNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string" && item.trim() !== "")
    .map((item) => (item as string).slice(0, 200))
    .slice(0, 40);
}

/**
 * Los adjuntos que nombraba una peticion.
 *
 * Una conversacion de antes del almacen de adjuntos guarda solo el nombre, en
 * una lista de textos. Se lee igual --la burbuja sigue diciendo con que se
 * pidio-- pero sin referencia: ese contenido no se guardo nunca y no hay forma
 * de recuperarlo.
 */
function readFiles(value: unknown): AiChatFile[] {
  if (!Array.isArray(value)) return [];
  const out: AiChatFile[] = [];
  for (const item of value.slice(0, 40)) {
    if (typeof item === "string") {
      const name = item.trim().slice(0, 200);
      if (name) out.push({ ref: "", name, kind: "text", size: 0 });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const file = item as Record<string, unknown>;
    const name = String(file.name ?? "")
      .trim()
      .slice(0, 200);
    if (!name) continue;
    out.push({
      ref: String(file.ref ?? "").slice(0, 60),
      name,
      kind: (String(file.kind ?? "text") || "text") as AiChatFile["kind"],
      size: Number(file.size ?? 0) || 0,
    });
  }
  return out;
}

function readMessages(value: unknown): AiMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const raw = item as Partial<AiMessage>;
      if (raw.from !== "yo" && raw.from !== "ia") return null;
      const files = readFiles(raw.files);
      const picked = readNames(raw.picked);
      return {
        from: raw.from,
        text: String(raw.text ?? ""),
        ...(Array.isArray(raw.steps) ? { steps: raw.steps } : {}),
        ...(raw.question && Array.isArray(raw.question.options) ? { question: raw.question } : {}),
        ...(typeof raw.reasoning === "string" && raw.reasoning ? { reasoning: raw.reasoning } : {}),
        ...(files.length ? { files } : {}),
        ...(picked.length ? { picked } : {}),
      } satisfies AiMessage;
    })
    .filter((m) => m !== null);
}

/** La lista de una pagina, de la mas reciente a la mas vieja. */
export async function listChats(appId: string, pageId: string): Promise<AiChatSummary[]> {
  const res = await listRecords<AiChat>(INTERNAL.chats, {
    filter: `app = "${quote(appId)}" && page = "${quote(pageId)}"`,
    sort: "-updated",
    perPage: MAX_CHATS,
    skipTotal: 1,
  });
  return res.items.map(({ messages, ...rest }) => ({
    ...rest,
    count: readMessages(messages).length,
  }));
}

export async function getChat(appId: string, id: string): Promise<AiChat> {
  const chat = await firstRecord<AiChat>(
    INTERNAL.chats,
    `app = "${quote(appId)}" && id = "${quote(id)}"`,
  );
  if (!chat) throw new HttpError(404, "Esa conversacion ya no existe");
  return { ...chat, messages: readMessages(chat.messages) };
}

/**
 * Guarda la peticion y la respuesta. Sin `chatId` abre una conversacion nueva;
 * con el, sigue la que estaba, que es lo que hace que abrir una nueva no
 * pierda la anterior.
 */
export async function appendToChat(opts: {
  appId: string;
  chatId?: string;
  page: PageRecord;
  authorId: string;
  messages: AiMessage[];
}): Promise<AiChat> {
  const existing = opts.chatId ? await getChat(opts.appId, opts.chatId).catch(() => null) : null;
  const messages = [...(existing?.messages ?? []), ...opts.messages].slice(-MAX_MESSAGES);

  if (existing) {
    const saved = await updateRecord<AiChat>(INTERNAL.chats, existing.id, { messages });
    // Pedir algo es dejarla abierta: la de otra pagina deja de estarlo.
    await setOpenChat(opts.appId, existing.id);
    return { ...saved, messages };
  }

  const created = await createRecord<AiChat>(INTERNAL.chats, {
    app: opts.appId,
    page: opts.page.id,
    title: title(opts.messages[0]?.text ?? ""),
    messages,
    author: opts.authorId,
  });

  await setOpenChat(opts.appId, created.id);
  await pruneChats(opts.appId);
  // El tope se pudo llevar la ultima conversacion que nombraba algun adjunto:
  // es el unico momento en que uno puede quedarse sin nadie que lo nombre.
  await pruneAiFiles(opts.appId).catch(() => 0);
  return { ...created, messages };
}

/**
 * La que quedo abierta, si sigue existiendo.
 *
 * Se comprueba contra las conversaciones de la aplicacion: el tope se lleva las
 * mas viejas y borrar una pagina se lleva las suyas, asi que lo apuntado puede
 * apuntar a algo que ya no esta. Eso se lee como que no hay ninguna abierta, no
 * como un error: lo que toca entonces es empezar en blanco.
 */
export async function readOpenChat(app: AppRecord): Promise<AiOpenChat | null> {
  if (!app.openChat) return null;
  const chat = await firstRecord<AiChat>(
    INTERNAL.chats,
    `app = "${quote(app.id)}" && id = "${quote(app.openChat)}"`,
    { fields: "id,page" },
  );
  return chat ? { chat: chat.id, page: chat.page } : null;
}

/** Deja abierta esta y ninguna otra. Vacio: la aplicacion se queda sin ninguna. */
export async function setOpenChat(appId: string, chatId: string): Promise<void> {
  await updateRecord(INTERNAL.apps, appId, { openChat: chatId });
}

/** Deja la aplicacion en el tope, quitando las mas viejas. */
async function pruneChats(appId: string): Promise<void> {
  const res = await listRecords<{ id: string }>(INTERNAL.chats, {
    filter: `app = "${quote(appId)}"`,
    sort: "-updated",
    perPage: 200,
    skipTotal: 1,
    fields: "id",
  });
  for (const chat of res.items.slice(MAX_CHATS)) {
    await deleteRecord(INTERNAL.chats, chat.id).catch(() => {});
  }
}
