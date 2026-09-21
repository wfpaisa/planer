/**
 * Las personas invitadas a una aplicacion.
 *
 * Cada aplicacion tiene sus propias cuentas; aqui viajan las suyas, para poder
 * pintar las columnas que apuntan a la tabla de personas.
 *
 * Es de las pocas cosas que siguen siendo contexto y no un modulo con estado:
 * hay una lista por aplicacion, no una sola para todo el panel.
 */
import type { AppPerson } from "@shared/types";
import { getContext, setContext } from "svelte";

import { api, pbApp } from "./pb";

/** Lo que se guarda en el contexto: un objeto que sabe leer su propia lista. */
export interface PeopleSource {
  readonly list: AppPerson[];
}

const KEY = Symbol("plane:personas");

export function setPeople(source: PeopleSource): void {
  setContext(KEY, source);
}

/**
 * Quien esta invitado, para quien lo necesite mas abajo.
 *
 * Devuelve la fuente, no la lista: `personas.list` se lee cuando se dibuja, y
 * asi el cambio llega. Sacar el array aqui lo congelaria en el valor que
 * tuviera al montar.
 */
export function getPeople(): PeopleSource {
  return getContext<PeopleSource | undefined>(KEY) ?? { list: [] };
}

/**
 * Lista para el panel: quien construye ve a los invitados de su app.
 *
 * Devuelve tambien como volver a pedirla. Hace falta: invitar a alguien no pasa
 * por aqui --pasa por la tabla de personas-- y sin releer, las celdas que
 * acaban de enlazarse con esa persona la buscarian en una lista donde todavia
 * no esta y se pintarian como enlaces rotos.
 */
export function appPeople(appId: () => string | undefined): PeopleSource & {
  reload: () => Promise<void>;
} {
  let list = $state<AppPerson[]>([]);

  /**
   * Trae la lista. `keep` dice que hacer si la peticion falla.
   *
   * Refrescando se queda la que ya estaba: de esta lista sale el aviso de a
   * cuantas personas afecta quitar un rol, y el rol que no usa nadie se quita
   * sin preguntar (ver `RolesModal`), asi que una lista vaciada por un corte de
   * red diria que no lo usa nadie y se lo llevaria en silencio. Vieja avisa de
   * mas, que es el lado bueno por el que equivocarse.
   *
   * Al cambiar de aplicacion no: los invitados de la de antes no son los de
   * esta, y ensenarlos seria peor que no ensenar a nadie.
   */
  async function load(keep = false) {
    const id = appId();
    if (!id) return;
    try {
      list = await api<AppPerson[]>(`/api/apps/${id}/personas`);
    } catch {
      if (!keep) list = [];
    }
  }

  $effect(() => {
    void appId();
    void load();
  });

  return {
    get list() {
      return list;
    },
    reload: () => load(true),
  };
}

/** Lista para la app publicada: solo llega con una sesion valida. */
export function publishedPeople(slug: () => string, signedIn: () => boolean): PeopleSource {
  let list = $state<AppPerson[]>([]);

  $effect(() => {
    const name = slug();
    if (!name || !signedIn()) {
      list = [];
      return;
    }
    let alive = true;
    fetch(`/api/public/${encodeURIComponent(name)}/personas`, {
      headers: { authorization: pbApp.authStore.token },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => {
        if (alive) list = Array.isArray(rows) ? rows : [];
      })
      .catch(() => {
        if (alive) list = [];
      });
    return () => {
      alive = false;
    };
  });

  return {
    get list() {
      return list;
    },
  };
}
