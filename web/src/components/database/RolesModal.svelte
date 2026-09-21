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

  import { useBuilder } from "../../lib/builderContext";
  import { errorMessage, patch } from "../../lib/pb";
  import { getPeople } from "../../lib/people.svelte";
  import Icon from "../Icon.svelte";
  import Button from "../ui/Button.svelte";
  import ConfirmDialog from "../ui/ConfirmDialog.svelte";
  import ErrorNote from "../ui/ErrorNote.svelte";
  import Input from "../ui/Input.svelte";
  import Modal from "../ui/Modal.svelte";
  import Tag from "../ui/Tag.svelte";

  let { open, onClose }: { open: boolean; onClose: () => void } = $props();

  const builder = useBuilder();
  const people = getPeople();

  let draft = $state("");
  let busy = $state(false);
  let error = $state("");
  /** El rol que se esta quitando, mientras se pregunta si de verdad. */
  let removing = $state<string | null>(null);

  /**
   * La lista de invitados, pedida otra vez al abrir.
   *
   * De lo que diga el aviso depende algo que no tiene vuelta atras, asi que se
   * cuenta sobre la lista de ahora y no sobre la que el panel trajera de antes.
   * Se quedaba vieja de verdad: "Restablecer columnas" se lleva a todas las
   * personas de la aplicacion, y hasta recargar el sitio esta tarjeta seguia
   * contando a las que ya no estaban --y al reves, quien acababa de ser
   * invitado no contaba y el rol se iba sin preguntar nada--.
   *
   * Se guarda la promesa, no un booleano: quitar un rol la espera antes de
   * decidir, que es lo que cierra el hueco entre abrir la tarjeta y pulsar la
   * cruz.
   */
  let asking = $state<Promise<void> | null>(null);
  $effect(() => {
    if (open) asking = builder.reloadPeople();
  });

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

  /**
   * A quien y a que le afecta quitar un rol.
   *
   * Quitarlo no lo esconde: el servidor lo borra de todas las personas que lo
   * tenian y de todas las pantallas que lo exigian (`pruneRoles` en
   * `server/routes.ts`), y eso no se deshace volviendo a crearlo con el mismo
   * nombre. `sueltas` son las pantallas donde era el unico rol marcado, que es
   * el cambio que nadie espera: se quedan sin ninguno y vuelven a verlas todos.
   */
  function scope(role: string) {
    const personas = people.list.filter((p) => p.roles?.includes(role)).length;
    const marcadas = builder.pages.filter((p) => p.roles?.includes(role));
    const paginas = marcadas.filter((p) => !p.separator).length;
    return {
      personas,
      paginas,
      separadores: marcadas.length - paginas,
      sueltas: marcadas.filter((p) => (p.roles ?? []).length === 1).length,
      total: personas + marcadas.length,
    };
  }

  /**
   * Quitar un rol.
   *
   * El que no usa nadie se va sin preguntar: no hay nada que perder y una
   * pregunta por cada equivocacion al escribir seria un estorbo. El que si se
   * usa pasa por la advertencia, que es donde se ve cuanto se lleva por delante.
   */
  async function remove(role: string) {
    // Con la lista de invitados ya al dia: sin esto, pulsar la cruz nada mas
    // abrir la tarjeta decidia con la de antes.
    await asking;
    if (scope(role).total === 0) {
      void save(roles.filter((r) => r !== role));
      return;
    }
    removing = role;
  }

  async function confirmRemove() {
    const role = removing;
    if (!role) return;
    await save(roles.filter((r) => r !== role));
    removing = null;
  }

  const contar = (n: number, uno: string, varios: string): string =>
    `${n} ${n === 1 ? uno : varios}`;

  /** "12 personas, 3 paginas y 1 separador del menu". */
  const lista = (items: string[]): string =>
    items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} y ${items.at(-1)}`;

  /**
   * Lo que hay que leer antes de decidir.
   *
   * Se cuenta en cosas --personas, paginas, separadores-- y no en un "esta en
   * uso" a secas: la diferencia entre quitarle un rol a una persona y quitarselo
   * a cuarenta es justo lo que hace dudar, y sin el numero no hay con que.
   */
  const warning = $derived.by(() => {
    if (!removing) return "";
    const use = scope(removing);
    const dicho = [
      use.personas ? contar(use.personas, "persona", "personas") : "",
      use.paginas ? contar(use.paginas, "página", "páginas") : "",
      use.separadores ? contar(use.separadores, "separador del menú", "separadores del menú") : "",
    ].filter(Boolean);

    const frases = [
      `Está puesto en ${lista(dicho)}.`,
      "Al quitarlo se desmarca en todas, y volver a crearlo con el mismo nombre no devuelve las marcas.",
    ];
    if (use.sueltas === 1) {
      frases.push(
        "Una de esas pantallas se queda sin ningún rol: a partir de ahí la ve cualquiera que alcance la aplicación.",
      );
    } else if (use.sueltas > 1) {
      frases.push(
        `${use.sueltas} de esas pantallas se quedan sin ningún rol: a partir de ahí las ve cualquiera que alcance la aplicación.`,
      );
    }
    return frases.join(" ");
  });
</script>

<!--
  Con la advertencia delante, Escape la cancela a ella y no se lleva tambien la
  tarjeta de roles: los dos escuchan la tecla en la ventana, y el de aqui --que
  se puso antes-- corre primero y se aparta. El velo tampoco cierra por detras
  de lo que se esta preguntando.
-->
<Modal
  class="modal-roles"
  {open}
  onClose={() => {
    if (!removing) onClose();
  }}
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
            onRemove={role === ADMIN_ROLE ? undefined : () => void remove(role)}
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

<ConfirmDialog
  open={!!removing}
  onClose={() => (removing = null)}
  title={`Quitar el rol "${removing ?? ""}"`}
  message={warning}
  confirmLabel="Quitar el rol"
  {busy}
  onConfirm={() => void confirmRemove()}
/>

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
