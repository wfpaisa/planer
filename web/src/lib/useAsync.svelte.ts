import { errorMessage } from "./pb";

export interface Async<T> {
  data: T | null;
  error: string;
  loading: boolean;
  reload: () => Promise<void>;
  set: (value: T | null) => void;
}

/**
 * Carga datos y cuenta en que va: cargando, error, y como volver a pedirlos.
 *
 * La petición se pasa como función y se vuelve a lanzar cuando cambie algo de
 * lo que esa función lea. Ahi esta la diferencia con la versión de React, que
 * pedia una lista de dependencias a mano y traia un `biome-ignore` encima para
 * callar al analizador: aquí las dependencias son lo que se lee, y no hay lista
 * que mantener.
 *
 *   const apps = useAsync(() => api<AppRecord[]>("/api/apps"));
 *   const tabla = useAsync(() => api<Row[]>(`/api/tablas/${id}`)); // vuelve con cada `id`
 */
export function useAsync<T>(fn: () => Promise<T>): Async<T> {
  let data = $state<T | null>(null);
  let error = $state("");
  let loading = $state(true);

  /** Sube con cada petición; solo contesta la ultima. */
  let turn = 0;

  async function run() {
    const mine = ++turn;
    loading = true;
    try {
      const result = await fn();
      if (mine !== turn) return;
      data = result;
      error = "";
    } catch (err) {
      if (mine !== turn) return;
      error = errorMessage(err);
    } finally {
      if (mine === turn) loading = false;
    }
  }

  $effect(() => {
    void run();
  });

  return {
    get data() {
      return data;
    },
    get error() {
      return error;
    },
    get loading() {
      return loading;
    },
    /** Vuelve a pedirlo sin que haya cambiado nada. */
    reload: run,
    set(value: T | null) {
      data = value;
    },
  };
}
