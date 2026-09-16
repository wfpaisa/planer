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

  async function load() {
    const id = appId();
    if (!id) return;
    list = await api<AppPerson[]>(`/api/apps/${id}/personas`).catch(() => [] as AppPerson[]);
  }

  $effect(() => {
    void appId();
    void load();
  });

  return {
    get list() {
      return list;
    },
    reload: load,
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
