/**
 * Con que ojos se esta mirando una página mientras se construye.
 *
 * Se recuerda en el navegador, y por aplicación: los roles y las personas son
 * de cada una, y quien esta probando una pantalla con otros ojos no la mira una
 * sola vez --la mira, toca el HTML, recarga y vuelve a mirar--. Perder la
 * eleccion en cada refresco obligaba a rehacerla cada vez.
 *
 * Vive aparte del componente por lo mismo que `sidebarPin`: es una preferencia
 * de quien mira, no un dato de la aplicación, y la escena solo recibe el
 * resultado.
 *
 * Guarda lo elegido en crudo, sin saber si todavía existe: los roles que la
 * aplicación define y las personas que estan invitadas cambian, y quien sabe
 * eso es quien pinta el selector. Ver `PageStage.svelte`.
 */
import { ADMIN_ROLE } from "@shared/people";

const asKey = (appId: string) => `plane_preview_as_${appId}`;

export interface PreviewAs {
  /** El rol --o la salida que no es un rol-- con el que se mira. */
  role: string;
  /** La persona concreta con la que mirar. Vacío: ninguna en concreto. */
  person: string;
  /** Cambiar de rol suelta a la persona: era de la lista del rol anterior. */
  pick: (role: string) => void;
}

export function previewAs(appId: () => string): PreviewAs {
  const first = remembered(appId());
  let role = $state(first.role);
  let person = $state(first.person);

  // Cambiar de aplicación trae lo suyo, no lo de la anterior.
  let last = appId();
  $effect(() => {
    const id = appId();
    if (id === last) return;
    last = id;
    const saved = remembered(id);
    role = saved.role;
    person = saved.person;
  });

  $effect(() => {
    const id = appId();
    try {
      // Mirar como quien construye es lo normal: eso no es una eleccion que
      // haya que recordar, y borrarlo deja el navegador sin rastro de la
      // aplicación en cuanto se sale de la vista previa.
      if (role === ADMIN_ROLE && !person) localStorage.removeItem(asKey(id));
      else localStorage.setItem(asKey(id), JSON.stringify({ role, person }));
    } catch {
      /* sin memoria del navegador, cada refresco vuelve a empezar en admin */
    }
  });

  return {
    get role() {
      return role;
    },
    set role(next: string) {
      role = next;
    },
    get person() {
      return person;
    },
    set person(next: string) {
      person = next;
    },
    pick(next: string) {
      role = next;
      person = "";
    },
  };
}

/** Lo guardado para esta aplicación. Sin nada --o con basura--, `admin` y nadie. */
function remembered(appId: string): { role: string; person: string } {
  try {
    const raw = localStorage.getItem(asKey(appId));
    const saved = raw ? (JSON.parse(raw) as { role?: unknown; person?: unknown }) : null;
    return {
      role: typeof saved?.role === "string" && saved.role ? saved.role : ADMIN_ROLE,
      person: typeof saved?.person === "string" ? saved.person : "",
    };
  } catch {
    return { role: ADMIN_ROLE, person: "" };
  }
}
