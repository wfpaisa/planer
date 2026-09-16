<!--
  Los roles de la aplicacion, en su propia tarjeta.

  Los roles ya no tienen pantalla propia: la gestion de quien entra vive en la
  tabla de personas, como cualquier otra tabla. Lo unico que una tabla no sabe
  hacer es inventar los nombres con los que se reparte lo que se ve, asi que eso
  se pide desde donde ya se estan usando --la columna de roles y la barra de la
  tabla de personas-- y las dos puertas abren esta misma tarjeta.
-->
<script lang="ts">
  import { ADMIN_ROLE, normalizeRole, ROLE_ICON, roleDraft } from "@shared/people";
  import type { AppRecord } from "@shared/types";

  import { useBuilder } from "../lib/builderContext";
  import { errorMessage, patch } from "../lib/pb";
  import Icon from "./Icon.svelte";
  import Button from "./ui/Button.svelte";
  import ErrorNote from "./ui/ErrorNote.svelte";
  import Input from "./ui/Input.svelte";
  import Modal from "./ui/Modal.svelte";
  import Tag from "./ui/Tag.svelte";

  let { open, onClose }: { open: boolean; onClose: () => void } = $props();

  const builder = useBuilder();

  let draft = $state("");
  let busy = $state(false);
  let error = $state("");

  const roles = $derived(builder.app.roles ?? []);
  /*
   * El nombre tal como va a quedar. El campo se normaliza en cada pulsacion
   * --con `roleDraft`, que deja el guion del final para poder seguir
   * escribiendo-- y esto es lo que de verdad se guarda. Quien lo escribe ve el
   * resultado antes de decidir, en vez de encontrarselo cambiado despues.
   */
  const value = $derived(normalizeRole(draft));
  // Repetido se mide sobre el nombre normalizado: "JEFE DE ZONA" y
  // "Jefe de Zona" son el mismo rol, y el segundo se rechaza.
  const repeated = $derived(value !== "" && roles.includes(value));

  async function save(next: string[]) {
    busy = true;
    error = "";
    try {
      builder.setApp(await patch<AppRecord>(`/api/apps/${builder.app.id}`, { roles: next }));
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }

  async function add() {
    if (!value || repeated) return;
    const next = [...roles, value];
    draft = "";
    await save(next);
  }
</script>

<Modal
  class="modal-roles"
  {open}
  {onClose}
  title="Roles"
  icon={ROLE_ICON}
  description="Nombra los tipos de persona que usan la aplicación: conductor, auditor, taller. Se guardan en minúsculas y con guiones. Luego se marcan en cada página para decidir quién la abre, y en cada persona de esta tabla."
>
  <div class="body-roles flex flex-col gap-3">
    <div class="row-roles-add join">
      <Input
        bind:value={draft}
        oninput={(e) => (draft = roleDraft(e.currentTarget.value))}
        onkeydown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void add();
          }
        }}
        placeholder="conductor"
        aria-label="Nombre del rol"
      />
      <Button
        class="btn-roles-add"
        loading={busy}
        disabled={!value || repeated}
        onclick={() => void add()}
      >
        <Icon name="plus" /> Añadir
      </Button>
    </div>

    {#if repeated}
      <p class="note-roles">El rol "{value}" ya existe en esta aplicación.</p>
    {/if}
    <ErrorNote message={error} />

    {#if roles.length === 0}
      <p class="empty-roles inset dashed">
        Sin roles, todas las personas invitadas ven las mismas pantallas.
      </p>
    {:else}
      <div class="list-roles">
        {#each roles as role (role)}
          <!--
            `admin` no se quita: es el rol de quien construye, la vista previa
            arranca en el, y quitarlo lo borraria de las paginas que lo tengan
            marcado. Ver `design.md` D7.
          -->
          <Tag
            class="tag-roles"
            removeLabel={role === ADMIN_ROLE ? undefined : `Quitar ${role}`}
            onRemove={role === ADMIN_ROLE
              ? undefined
              : () => void save(roles.filter((r) => r !== role))}
          >
            {role}
          </Tag>
        {/each}
      </div>

      <p class="note-roles">
        Al quitar un rol se desmarca en las páginas y en las personas. Los roles deciden qué se
        muestra a quién; "{ADMIN_ROLE}" es el de quien construye y no se puede quitar.
      </p>
    {/if}
  </div>

  {#snippet footer()}
    <Button onclick={onClose}>Cerrar</Button>
  {/snippet}
</Modal>

<style>
  .body-roles {
    & .row-roles-add {
      display: flex;

      & :global(.btn-roles-add) {
        flex-shrink: 0;
      }
    }

    & .note-roles {
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-muted);
    }

    /* El hueco es `.inset.dashed` del catalogo; aqui solo su letra. */
    & .empty-roles {
      padding: var(--sp-12);
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-muted);
    }

    & .list-roles {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-6);
    }
  }
</style>
