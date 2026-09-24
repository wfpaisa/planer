<!--
  Los usuarios del panel: quién entra a construir y en qué aplicaciones.

  Solo la ve la cuenta principal, que es la única que entra a los ajustes (el
  servidor lo vuelve a comprobar en cada ruta) y no sale en la lista. Cada
  fila abre el mismo modal con que se crea un usuario, ya relleno: ahí se le
  cambian los datos y las aplicaciones asignadas.

  Las aplicaciones que un usuario creó son suyas y no se asignan: se cuentan
  aparte, como "propias".
-->
<script lang="ts">
  import type { BuilderAccount, BuildersView } from "@shared/types";

  import { api } from "../../lib/pb";
  import { useAsync } from "../../lib/useAsync.svelte";
  import Icon from "../Icon.svelte";
  import SettingsSection from "../SettingsSection.svelte";
  import { Button, ErrorNote, Loading } from "../ui";
  import UserModal from "./UserModal.svelte";

  const loaded = useAsync(() => api<BuildersView>("/api/constructores"));

  /** El modal abierto: `null` cerrado, `"nuevo"` para crear, o el usuario a editar. */
  let editing = $state<BuilderAccount | "nuevo" | null>(null);
  /** Lo que devolvió la última escritura, que ya trae la lista entera al día. */
  let fresh = $state<BuildersView | null>(null);

  const data = $derived(fresh ?? loaded.data);
  const builders = $derived(data?.builders ?? []);

  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  function initials(user: BuilderAccount): string {
    const source = user.name.trim() || user.email;
    const words = source.split(/[\s@.]+/).filter(Boolean);
    return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
  }
</script>

{#snippet icon()}
  <Icon name="user-group" />
{/snippet}

{#snippet footer()}
  <p class="foot-settings-note">
    Cada usuario puede editar las aplicaciones asignadas, pero solo su creador puede eliminarlas.
  </p>
  <Button variant="secondary" buttonClass="btn-new-user" onclick={() => (editing = "nuevo")}>
    <Icon name="user-add-01" size={14} /> Nuevo usuario
  </Button>
{/snippet}

<SettingsSection
  id="ajustes-usuarios"
  {icon}
  {footer}
  title="Usuarios"
  description="Gestiona el acceso al panel y las aplicaciones asignadas a cada usuario."
  class="section-users"
>
  <ErrorNote message={loaded.error} />

  {#if loaded.loading && !data}
    <Loading label="Cargando usuarios" />
  {:else if builders.length === 0}
    <p class="empty-users">Todavía no hay usuarios. Crea uno para darle acceso al panel.</p>
  {:else}
    <ul class="list-users flex flex-col">
      {#each builders as user (user.id)}
        <li>
          <button type="button" class="row-user" onclick={() => (editing = user)}>
            <span class="avatar">{initials(user)}</span>
            <span class="copy-user flex flex-col">
              <span class="name-user">{user.name || user.email}</span>
              <span class="email-user">{user.email}</span>
            </span>
            <span class="meta-user flex items-center gap-2">
              <span class="apps-user">
                {count(user.owned.length, "propia", "propias")} · {count(
                  user.assigned.length,
                  "asignada",
                  "asignadas",
                )}
              </span>
              <Icon name="arrow-right-01" size={14} />
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</SettingsSection>

{#if data && editing}
  <UserModal
    open
    user={editing === "nuevo" ? null : editing}
    apps={data.apps}
    onClose={() => (editing = null)}
    onSaved={(next) => {
      fresh = next;
      editing = null;
    }}
  />
{/if}

<style>
  .list-users {
    list-style: none;
  }

  .row-user {
    display: flex;
    align-items: center;
    gap: var(--sp-12);
    width: 100%;
    padding: var(--sp-8);
    border-radius: var(--radius-md);
    text-align: left;
    color: var(--text-secondary);
    cursor: pointer;

    &:hover {
      background: var(--bg-field);
    }
  }

  .copy-user {
    flex: 1;
    min-width: 0;
  }

  .name-user,
  .email-user {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name-user {
    color: var(--text-primary);
    font-weight: 500;
  }

  .empty-users,
  .email-user,
  .apps-user {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .apps-user {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* En un teléfono las cuentas bajan a la línea del nombre y ceden la fila. */
  @media (width < 36rem) {
    .row-user {
      flex-wrap: wrap;
    }

    .meta-user {
      width: 100%;
      padding-left: calc(2rem + var(--sp-12));
    }
  }
</style>
