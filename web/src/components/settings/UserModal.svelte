<!--
  Crear o editar un usuario del panel.

  Es el mismo modal para las dos cosas: sin `user` crea, con `user` edita. Lo
  que cambia es la contraseña --obligatoria al crear, opcional al editar, donde
  vacía quiere decir "la de siempre"-- y que al editar se puede borrar.

  La lista de aplicaciones es la de toda la instalación. Las que el usuario
  creó salen marcadas y quietas: son suyas, no se le asignan ni se le quitan.

  La cuenta principal (la del `.env`) no llega nunca aquí: no sale en la
  lista y se cambia en el archivo `.env`.
-->
<script lang="ts">
  import { type BuilderAccount, type BuildersView, MIN_BUILDER_PASSWORD } from "@shared/types";

  import { del, errorMessage, patch, post } from "../../lib/pb";
  import AppIcon from "../app/AppIcon.svelte";
  import Icon from "../Icon.svelte";
  import { Button, ConfirmDialog, ErrorNote, Field, Input, Modal } from "../ui";

  let {
    open,
    user,
    apps,
    onClose,
    onSaved,
  }: {
    open: boolean;
    /** El usuario a editar, o `null` para crear uno nuevo. */
    user: BuilderAccount | null;
    apps: BuildersView["apps"];
    onClose: () => void;
    /** La lista entera, ya al día, tal como la devuelve el servidor. */
    onSaved: (view: BuildersView) => void;
  } = $props();

  /* El modal se monta cada vez que se abre (ver `UsersSection`), así que leer
     `user` una sola vez aquí es lo que se quiere: el formulario arranca con lo
     que había y no se pisa mientras se escribe. */
  const initial = (() => user)();
  let name = $state(initial?.name ?? "");
  let email = $state(initial?.email ?? "");
  let password = $state("");
  let assigned = $state<string[]>(initial?.assigned ?? []);

  let busy = $state(false);
  let error = $state("");
  let confirmDelete = $state(false);

  const creating = $derived(!user);
  const owned = $derived(new Set(user?.owned ?? []));

  const passwordOk = $derived(
    creating
      ? password.length >= MIN_BUILDER_PASSWORD
      : password.length === 0 || password.length >= MIN_BUILDER_PASSWORD,
  );
  const ready = $derived(email.trim().includes("@") && passwordOk && !busy);

  function toggle(id: string) {
    assigned = assigned.includes(id) ? assigned.filter((x) => x !== id) : [...assigned, id];
  }

  async function save() {
    busy = true;
    error = "";
    try {
      const payload = {
        name,
        email,
        apps: assigned,
        ...(password ? { password } : {}),
      };
      const view = user
        ? await patch<BuildersView>(`/api/constructores/${user.id}`, payload)
        : await post<BuildersView>("/api/constructores", payload);
      onSaved(view);
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }

  async function remove() {
    if (!user) return;
    busy = true;
    error = "";
    try {
      onSaved(await del<BuildersView>(`/api/constructores/${user.id}`));
    } catch (err) {
      confirmDelete = false;
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

<Modal
  id="user-modal"
  class="modal-user"
  {open}
  onClose={busy ? () => {} : onClose}
  title={creating ? "Nuevo usuario" : "Editar usuario"}
  description={creating
    ? "Crea una cuenta para entrar al panel y asígnale las aplicaciones que podrá editar."
    : "Cambia sus datos y las aplicaciones que puede editar."}
  width="modal-user-width"
>
  <div class="body-user flex flex-col gap-4">
    <ErrorNote message={error} />

    <div class="grid-user-fields">
      <Field label="Nombre">
        <Input bind:value={name} placeholder="Nombre y apellido" autofocus={creating} />
      </Field>
      <Field label="Correo">
        <Input type="email" bind:value={email} autocomplete="off" />
      </Field>
    </div>

    <Field
      label={creating ? "Contraseña" : "Nueva contraseña"}
      hint={creating
        ? `Escribe al menos ${MIN_BUILDER_PASSWORD} caracteres y comparte la contraseña con esta persona.`
        : `Déjala vacía para conservar la contraseña actual. Si la cambias, usa al menos ${MIN_BUILDER_PASSWORD} caracteres.`}
    >
      <Input type="password" bind:value={password} autocomplete="new-password" />
    </Field>

    <div class="apps-user-modal flex flex-col gap-2">
      <p class="label-user-apps">Aplicaciones que puede editar</p>
      {#if apps.length === 0}
        <p class="empty-user-apps">Todavía no hay ninguna aplicación.</p>
      {:else}
        <ul class="list-user-apps flex flex-col gap-1">
          {#each apps as app (app.id)}
            {@const own = owned.has(app.id)}
            <li>
              <label class="choice row-user-app" class:is-own={own}>
                <input
                  type="checkbox"
                  checked={own || assigned.includes(app.id)}
                  disabled={own}
                  onchange={() => toggle(app.id)}
                />
                <i class="choice-box ico-nudge hgi-stroke hgi-tick-02" aria-hidden="true"></i>
                <AppIcon {app} size={16} class="icon-user-app" />
                <span class="name-user-app">{app.name}</span>
                <span class="note-user-app">{own ? "La creó" : `/${app.slug}`}</span>
              </label>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>

  {#snippet footer()}
    {#if user}
      <Button
        variant="ghost"
        buttonClass="btn-delete-user"
        class="btn-danger"
        disabled={busy}
        onclick={() => (confirmDelete = true)}
      >
        <Icon name="trash" size={14} /> Eliminar usuario
      </Button>
      <span class="spacer-user-footer"></span>
    {/if}
    <Button onclick={onClose} disabled={busy}>Cancelar</Button>
    <Button
      variant="secondary"
      buttonClass="btn-save-user"
      loading={busy}
      disabled={!ready}
      onclick={() => void save()}
    >
      {creating ? "Crear usuario" : "Guardar"}
    </Button>
  {/snippet}
</Modal>

{#if user}
  <ConfirmDialog
    open={confirmDelete}
    onClose={() => (confirmDelete = false)}
    title="Eliminar usuario"
    message={user.owned.length
      ? `${user.name || user.email} perderá el acceso al panel. Sus ${user.owned.length} aplicaciones, con todo su contenido, pasarán a ser tuyas.`
      : `${user.name || user.email} perderá el acceso al panel. Esta acción no se puede deshacer.`}
    confirmLabel="Eliminar usuario"
    {busy}
    onConfirm={() => void remove()}
  />
{/if}

<style>
  :global(.modal-user-width) {
    max-width: 36rem;
  }

  .grid-user-fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: var(--sp-12);
  }

  .label-user-apps {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-primary);
  }

  .empty-user-apps {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  /* La lista puede ser larga; el modal no crece con ella. */
  .list-user-apps {
    max-height: 16rem;
    overflow-y: auto;
    list-style: none;
  }

  .row-user-app {
    width: 100%;
    padding: var(--sp-6) var(--sp-8);
    border-radius: var(--radius-sm);

    &:hover {
      background: var(--bg-field);
    }

    &.is-own {
      cursor: default;
    }
  }

  .name-user-app {
    color: var(--text-primary);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .note-user-app {
    margin-left: auto;
    flex: none;
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .spacer-user-footer {
    flex: 1;
  }
</style>
