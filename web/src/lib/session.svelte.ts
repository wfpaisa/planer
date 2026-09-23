import { pb } from "./pb";

export interface Builder {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  collectionId?: string;
}

const current = () => (pb.authStore.record as unknown as Builder | null) ?? null;

let me = $state<Builder | null>(current());
/** Sin sesión guardada no hay nada que confirmar: se sabe desde el primer momento. */
let ready = $state(!pb.authStore.isValid);

pb.authStore.onChange(() => {
  me = current();
});

if (pb.authStore.isValid) {
  // Confirmamos con el servidor que la sesión guardada sigue viva.
  pb.collection("builders")
    .authRefresh()
    .catch(() => pb.authStore.clear())
    .finally(() => {
      ready = true;
    });
}

export const session = {
  /** Quien esta construyendo, o `null` si no hay nadie. */
  get me(): Builder | null {
    return me;
  },
  /** Ya se sabe si hay sesión o no. Antes de esto no se puede echar a nadie. */
  get ready(): boolean {
    return ready;
  },
  async signIn(email: string, password: string): Promise<void> {
    await pb.collection("builders").authWithPassword(email, password);
  },
  signOut(): void {
    pb.authStore.clear();
  },
};
