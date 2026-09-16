<!--
  Los ajustes de una pagina: como se llama, quien puede verla y si es el inicio.

  Un separador --el texto que agrupa a las paginas de alrededor-- pasa por aqui
  con menos campos, pero no con menos permiso: tambien dice quien lo ve. Es lo
  que hace que un grupo entero se pueda esconder sin tener que esconder a mano
  cada pagina de dentro, y lo que evita que a quien no le toca le quede el
  titulo de un grupo vacio.
-->
<script lang="ts">
  import { withPageAdmin } from "@shared/pages";
  import { ROLE_ICON } from "@shared/people";
  import type { AppRecord, PageRecord } from "@shared/types";
  import { untrack } from "svelte";

  import { errorMessage, pb } from "../lib/pb";
  import Icon from "./Icon.svelte";
  import IconPicker from "./IconPicker.svelte";
  import OmniPanel from "./OmniPanel.svelte";
  import PageAccessPicker from "./PageAccessPicker.svelte";
  import { Button, ConfirmDialog, ErrorNote, Field, Input, Switch } from "./ui";

  let {
    app,
    page,
    pages,
    onClose,
    onChanged,
    onDeleted,
  }: {
    app: AppRecord;
    page: PageRecord;
    pages: PageRecord[];
    onClose: () => void;
    onChanged: () => Promise<void> | void;
    onDeleted: () => void;
  } = $props();

  /*
   * Los campos son estado propio: se escriben antes de guardar. De la pagina
   * sale el valor de partida --por eso `untrack`, es lo que se quiere leer una
   * sola vez-- y cambiar de pagina los repone en el efecto de abajo.
   */
  let name = $state(untrack(() => page.name));
  let icon = $state(untrack(() => page.icon));
  /*
   * Los roles se reponen al leerlos: una pagina limitada lleva `admin` aunque
   * se guardara sin el --la escribio la inteligencia artificial, o es de antes
   * de que la pantalla lo pusiera siempre--. Se repone aqui y no al guardar
   * para que lo que se ve marcado sea exactamente lo que se va a guardar.
   */
  let roles = $state<string[]>(untrack(() => withPageAdmin(page.roles ?? [])));
  let isHome = $state(untrack(() => page.isHome));
  let busy = $state(false);
  let error = $state("");
  let deleting = $state(false);

  /** Como se nombra esto en los textos: la misma palabra en todos. */
  const thing = $derived(page.separator ? "separador" : "página");

  let last = untrack(() => page.id);
  $effect(() => {
    if (page.id === last) return;
    last = page.id;
    name = page.name;
    icon = page.icon;
    roles = withPageAdmin(page.roles ?? []);
    isHome = page.isHome;
    error = "";
  });

  async function save() {
    busy = true;
    error = "";
    try {
      // Un separador no tiene icono ni puede ser el inicio: solo nombre y
      // permiso. Lo demas no se manda, para no escribirle campos que no usa.
      if (page.separator) {
        await pb.collection("pages").update(page.id, { name: name.trim() || page.name, roles });
        await onChanged();
        onClose();
        return;
      }
      if (isHome && !page.isHome) {
        await Promise.all(
          pages
            .filter((p) => p.isHome)
            .map((p) => pb.collection("pages").update(p.id, { isHome: false })),
        );
      }
      await pb.collection("pages").update(page.id, {
        name: name.trim() || page.name,
        icon,
        roles,
        ...(isHome && !page.isHome ? { isHome: true } : {}),
      });
      await onChanged();
      onClose();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }

  async function remove() {
    busy = true;
    error = "";
    try {
      await pb.collection("pages").delete(page.id);
      await onChanged();
      deleting = false;
      onClose();
      onDeleted();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

<!--
  Quien puede abrirlo. Es la misma pregunta para una pagina y para un
  separador, asi que la hace el mismo campo; solo cambia la palabra.
-->
{#snippet access()}
  <Field
    label={`Quién puede ver ${page.separator ? "este separador" : "esta página"}`}
    icon={ROLE_ICON}
  >
    <PageAccessPicker {roles} appRoles={app.roles ?? []} onChange={(next) => (roles = next)} />
  </Field>
{/snippet}

<!--
  La zona de borrar: dice que se va a borrar y que no vuelve, y el boton al
  lado. Antes era un boton ancho y solo: lo destructivo no deberia ser lo mas
  grande del panel ni lo primero que se encuentra la mano.
-->
{#snippet dangerZone()}
  <div class="section-page-panel-delete">
    <div class="copy-page-panel-delete">
      <p class="label-page-panel-home">Borrar {thing}</p>
      <p class="hint-page-panel-home">
        {#if page.isHome}
          La página de inicio no se borra: la aplicación siempre necesita una. Marca antes otra como
          inicio.
        {:else if page.separator}
          Se borra el título del grupo. Las páginas que agrupa se quedan donde están.
        {:else}
          Se borra la página con lo que tenga escrito. No se puede deshacer.
        {/if}
      </p>
    </div>

    {#if !page.isHome}
      <Button
        variant="ghost"
        buttonClass="btn-delete-page-panel"
        class="btn-danger"
        onclick={() => (deleting = true)}
        disabled={busy}
        aria-label={`Borrar ${thing} "${page.name}"`}
      >
        <Icon name="trash" size={14} /> Borrar
      </Button>
    {/if}
  </div>
{/snippet}

<OmniPanel
  title={page.separator ? "Ajustes del separador" : "Ajustes de la página"}
  description={page.separator
    ? "Cómo se llama el grupo y quién lo ve."
    : "Cómo se llama, quién puede verla y si es el inicio."}
  {onClose}
>
  {#if page.separator}
    <div class="form-page-panel flex flex-col gap-4">
      <ErrorNote message={error} />

      <Field label="Nombre">
        <Input bind:value={name} />
      </Field>

      {@render access()}
      {@render dangerZone()}
    </div>
  {:else}
    <div class="form-page-panel flex flex-col gap-4">
      <ErrorNote message={error} />

      <div class="row-page-panel-name">
        <IconPicker value={icon} onChange={(next) => (icon = next)} />
        <div class="field-page-panel-name">
          <Field label="Nombre">
            <Input bind:value={name} />
          </Field>
        </div>
      </div>

      {@render access()}

      <div class="row-page-panel-home">
        <div>
          <p class="label-page-panel-home">Usar como inicio</p>
          <p class="hint-page-panel-home">
            {page.isHome
              ? "Esta página ya es el inicio; la aplicación siempre necesita una."
              : "Quien entre a la aplicación llegará aquí primero."}
          </p>
        </div>
        <!--
          La de inicio no se puede desmarcar: la aplicacion siempre necesita una,
          y se cambia marcando otra. El interruptor va enlazado y la correccion
          vuelve por el mismo enlace, para que lo que se ve y lo que vale sean lo
          mismo.
        -->
        <Switch
          bind:checked={isHome}
          onchange={() => {
            if (page.isHome) isHome = true;
          }}
        />
      </div>

      {@render dangerZone()}
    </div>
  {/if}

  {#snippet footer()}
    <Button onclick={onClose} disabled={busy}>Cerrar</Button>
    <Button variant="secondary" loading={busy} onclick={save}>Guardar</Button>
  {/snippet}
</OmniPanel>

<!-- Borrar es la unica pregunta que sigue interrumpiendo, a proposito. -->
<ConfirmDialog
  open={deleting}
  onClose={() => (deleting = false)}
  title={`Borrar ${thing} "${page.name}"`}
  message={page.separator
    ? `Se borrará el separador "${page.name}". Las páginas que agrupa se quedan donde están. Esta acción no se puede deshacer.`
    : `Se borrará la página "${page.name}", lo que tenga escrito y las conversaciones con la inteligencia artificial que se hicieron en ella. Esta acción no se puede deshacer.`}
  {busy}
  onConfirm={remove}
/>

<style>
  .form-page-panel {
    & .row-page-panel-name {
      display: flex;
      align-items: flex-end;
      gap: var(--sp-8);

      & .field-page-panel-name {
        min-width: 0;
        flex: 1;
      }
    }

    & .row-page-panel-home,
    & .section-page-panel-delete {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-16);
      border-top: var(--border-width) solid var(--border);
      padding-top: var(--sp-16);
    }

    & .label-page-panel-home {
      font-size: var(--text-sm);
      line-height: var(--text-sm--line-height);
      font-weight: 500;
      color: var(--text-primary);
    }

    & .hint-page-panel-home {
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-muted);
    }

    /* El texto cede el ancho y el boton se queda con el suyo: sin esto la
       explicacion lo empuja y "Borrar" sale partido en dos lineas. */
    & .copy-page-panel-delete {
      min-width: 0;
      flex: 1;
    }

    & .section-page-panel-delete :global(.btn-delete-page-panel) {
      flex-shrink: 0;
      height: 2.25rem;
      min-height: 2.25rem;
      font-size: var(--text-sm);
      line-height: var(--text-sm--line-height);
      font-weight: 500;
    }
  }
</style>
