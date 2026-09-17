<!--
  La lista de tablas de la aplicacion.

  El encabezado es el mismo que el de las paginas: las dos mitades de la
  aplicacion se listan igual, asi que se leen igual.
-->
<script lang="ts" module>
  /**
   * A partir de cuantas tablas la lista deja de leerse de un vistazo y aparece
   * el campo para filtrarla. Por debajo de esto, buscar cuesta mas que mirar.
   */
  const FILTER_FROM = 8;
</script>

<script lang="ts">
  import { isPeopleTable, peopleInitialFields } from "@shared/people";
  import type { TableRecord } from "@shared/types";

  import { cx } from "../../lib/cx";
  import { DEFAULT_TABLE_ICON } from "../../lib/icons";
  import { del, errorMessage, patch, post } from "../../lib/pb";
  import { loadPeopleOverlay } from "../../lib/peopleGrid";
  import { navigate } from "../../lib/router.svelte";
  import { downloadFile, exportName } from "../../lib/tableExport";
  import { structureToJson } from "../../lib/tableStructure";
  import Icon from "../Icon.svelte";
  import {
    Button,
    ConfirmDialog,
    Dropdown,
    ErrorNote,
    Input,
    MenuItem,
    MenuSeparator,
    Modal,
  } from "../ui";
  import ImportStructureModal from "./ImportStructureModal.svelte";

  let {
    tables,
    activeId,
    appId,
    onChanged,
  }: {
    tables: TableRecord[];
    activeId?: string;
    appId: string;
    onChanged: () => Promise<void>;
  } = $props();

  /**
   * El dialogo del nombre. Con `table` a nulo es una tabla que todavia no
   * existe; con tabla es cambiarle el nombre a una que ya esta.
   */
  let naming = $state<{ table: TableRecord | null } | null>(null);
  let name = $state("");
  let busy = $state(false);
  let error = $state("");
  /** Lo que se escribio para acortar la lista cuando ya no cabe de un vistazo. */
  let filter = $state("");
  /** Tabla sobre la que se esta importando estructura. */
  let structureTarget = $state<TableRecord | null>(null);
  /** Tabla pendiente de confirmar su borrado. */
  let deleting = $state<TableRecord | null>(null);
  /** Tabla de usuarios pendiente de confirmar que vuelve a como nacio. */
  let resetting = $state<TableRecord | null>(null);

  // Filtrar solo aparece cuando la lista ya se desplaza: con pocas tablas
  // estorba mas de lo que ayuda.
  const canFilter = $derived(tables.length >= FILTER_FROM);
  const shown = $derived.by(() => {
    const query = filter.trim().toLowerCase();
    const list =
      canFilter && query ? tables.filter((t) => t.label.toLowerCase().includes(query)) : tables;
    // Personas encabeza la lista: es de donde sale quien entra a la aplicacion
    // y donde se nombran los roles, asi que se busca antes que ninguna otra.
    return [...list].sort((a, b) => Number(isPeopleTable(b)) - Number(isPeopleTable(a)));
  });

  function openCreate() {
    name = "";
    error = "";
    naming = { table: null };
  }

  function openRename(table: TableRecord) {
    name = table.label;
    error = "";
    naming = { table };
  }

  /** Guarda el nombre escrito: crea la tabla o le cambia el nombre a la suya. */
  async function saveName() {
    const label = name.trim();
    if (!naming || !label) return;
    busy = true;
    error = "";
    try {
      if (naming.table) {
        await patch(`/api/tables/${naming.table.id}`, { label });
        await onChanged();
      } else {
        const created = await post<TableRecord>(`/api/apps/${appId}/tables`, { label });
        await onChanged();
        navigate(`/a/${appId}/datos/${created.id}`);
      }
      naming = null;
      name = "";
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }

  async function confirmDeleteTable() {
    if (!deleting) return;
    busy = true;
    error = "";
    try {
      await del(`/api/tables/${deleting.id}`);
      await onChanged();
      deleting = null;
      navigate(`/a/${appId}/datos`);
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }

  /**
   * Deja la tabla de usuarios como el dia que nacio: vacia y con sus columnas
   * de siempre.
   *
   * Existe porque una importacion que no encuentra a donde mandar sus columnas
   * las crea, y de un archivo exportado de otro sistema salen diez de golpe
   * --`avatar`, `verified`, `emailVisibility`-- que no sirven para nada aqui.
   * Quitarlas de una en una es media tarde.
   *
   * Se lleva las columnas propias con lo que tuvieran dentro y tambien a la
   * gente: quien la restablece esta deshaciendo una importacion entera, y
   * dejarla con las personas dentro obligaba a borrarlas aparte para volver de
   * verdad al principio. Las cuentas no se tocan --son comunes a todas las
   * aplicaciones-- solo su acceso a esta. Ver `shared/people.ts`.
   */
  async function confirmReset() {
    if (!resetting) return;
    const target = resetting;
    busy = true;
    error = "";
    try {
      /*
       * Las personas primero. Cada acceso que se quita se lleva la cuenta con
       * la que esa persona entraba aqui, su fila y lo que esta aplicacion
       * supiera de ella; si algo falla a mitad, la tabla conserva sus columnas
       * y con ellas lo que queda por revisar.
       */
      const people = await loadPeopleOverlay(target.app);
      for (const person of people.values()) await del(`/api/members/${person.accessId}`);

      const fields = peopleInitialFields();
      await patch(`/api/tables/${target.id}`, {
        fields,
        // El mismo `meta` con el que la crea `ensurePeopleTable`: sin anchos ni
        // escondidas de columnas que ya no existen.
        meta: { columnOrder: fields.map((f) => f.name), hidden: [], widths: {} },
      });
      await onChanged();
      resetting = null;
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }

  async function duplicate(table: TableRecord) {
    error = "";
    try {
      const copy = await post<TableRecord>(`/api/tables/${table.id}/duplicar`);
      await onChanged();
      navigate(`/a/${appId}/datos/${copy.id}`);
    } catch (err) {
      error = errorMessage(err);
    }
  }

  /**
   * El archivo de la estructura sigue la misma regla que el de los datos: se
   * nombra con la etiqueta, que es la que el constructor ve.
   *
   * La cola `-columnas` se queda. Son dos archivos distintos de la misma tabla
   * --uno trae las filas y otro la forma-- y sin ella el navegador los guardaria
   * como `personas-y-roles.json` y `personas-y-roles (1).json`. Ademas es lo
   * que impide que soltarlo de vuelta lo reconozca como el archivo de datos de
   * esa tabla: la capa del nombre compara el nombre entero, no su principio.
   */
  const exportStructure = (table: TableRecord) =>
    downloadFile(
      exportName(table, "json", "-columnas"),
      structureToJson(table),
      "application/json",
    );
</script>

<aside id="database-table-sidebar" class="sidebar-tables flex shrink-0 flex-col">
  <div class="header-tables">
    <span class="title-tables">
      <span class="title-tables-label eyebrow">Tablas</span>
      {#if tables.length > 0}
        <span class="title-tables-count">{tables.length}</span>
      {/if}
    </span>
  </div>

  <!-- Acortar la lista cuando ya no cabe de un vistazo. -->
  {#if canFilter}
    <div class="filter-tables">
      <Icon name="search-01" size={13} class="icon-filter-tables" />
      <input
        bind:value={filter}
        placeholder="Filtrar tablas"
        aria-label="Filtrar tablas"
        class="input-filter-tables field-control sm"
      />
      {#if filter}
        <button
          type="button"
          onclick={() => (filter = "")}
          aria-label="Quitar el filtro"
          class="btn-clear-tables-filter"
        >
          <Icon name="cancel-01" size={16} />
        </button>
      {/if}
    </div>
  {/if}

  <ul id="database-table-list" class="list-tables">
    {#each shown as table (table.id)}
      <li class="row-table-sidebar">
        <button
          type="button"
          onclick={() => navigate(`/a/${appId}/datos/${table.id}`)}
          aria-current={table.id === activeId ? "page" : undefined}
          class={cx(
            "btn btn-ghost btn-open-table",
            table.id === activeId ? "btn-open-table-active" : "btn-open-table-idle",
          )}
        >
          <Icon
            name={isPeopleTable(table) ? "user-multiple" : DEFAULT_TABLE_ICON}
            size={20}
            class="icon-table-sidebar"
          />
          <span class="name-table-sidebar">
            {table.label}
          </span>
        </button>
        <!--
          El hueco de los punticos esta reservado desde el principio: el nombre
          de la tabla no se encoge al pasar el raton, y lo que se tapaba antes
          ahora tiene su sitio.
        -->
        <div class="options-table-sidebar">
          <Dropdown align="right">
            {#snippet trigger({ toggle })}
              <Button
                aria-label={`Opciones de "${table.label}"`}
                onclick={toggle}
                class="btn-ghost btn-icon btn-table-options"
              >
                <Icon name="ellipsis-vertical" size={18} />
              </Button>
            {/snippet}

            {#snippet children(close)}
              <!--
                La tabla de personas no se renombra, no se duplica y no se
                borra: es la que sostiene quien entra. Lo que si tiene
                --exportar e importar-- se queda.
              -->
              {#if isPeopleTable(table)}
                <!-- Vacia a proposito: mantiene el aire de arriba del menu. -->
                <!-- <MenuLabel>{"\u00a0"}</MenuLabel> -->
              {:else}
                <MenuItem
                  onclick={() => {
                    close();
                    openRename(table);
                  }}
                >
                  {#snippet icon()}<Icon name="edit-03" size={14} />{/snippet}
                  Cambiar nombre
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  onclick={() => {
                    close();
                    void duplicate(table);
                  }}
                >
                  {#snippet icon()}<Icon name="copy-01" size={14} />{/snippet}
                  Duplicar tabla
                </MenuItem>
              {/if}
              <MenuItem
                onclick={() => {
                  close();
                  exportStructure(table);
                }}
              >
                {#snippet icon()}<Icon name="download-01" size={14} />{/snippet}
                Exportar estructura
              </MenuItem>
              <MenuItem
                onclick={() => {
                  close();
                  structureTarget = table;
                }}
              >
                {#snippet icon()}<Icon name="upload-01" size={14} />{/snippet}
                Importar estructura
              </MenuItem>
              {#if !isPeopleTable(table)}
                <MenuSeparator />
                <MenuItem
                  danger
                  onclick={() => {
                    close();
                    deleting = table;
                  }}
                >
                  {#snippet icon()}<Icon name="trash" size={14} />{/snippet}
                  Borrar tabla
                </MenuItem>
              {:else}
                <!--
                  La de usuarios no se borra, pero si se puede dejar como nacio:
                  es la salida cuando una importacion la llena de columnas que
                  no eran.
                -->
                <MenuSeparator />
                <MenuItem
                  danger
                  onclick={() => {
                    close();
                    resetting = table;
                  }}
                >
                  {#snippet icon()}<Icon name="database-restore" size={14} />{/snippet}
                  Restablecer columnas
                </MenuItem>
              {/if}
            {/snippet}
          </Dropdown>
        </div>
      </li>
    {/each}

    {#if tables.length === 0}
      <li class="empty-tables">Todavía no hay tablas.</li>
    {:else if shown.length === 0}
      <li class="empty-tables">Ninguna tabla se llama así.</li>
    {/if}

    <!--
      Crear una tabla es el siguiente elemento de la lista, no un boton aparte:
      se pide donde terminan las que ya hay.
    -->
    {#if !filter}
      <li>
        <button type="button" onclick={openCreate} class="btn-new-table-link btn btn-ghost">
          <Icon name="add-square" size={18} class="icon-new-table-link" />
          <span>Nueva tabla</span>
        </button>
      </li>
    {/if}
  </ul>

  {#if error && !naming}
    <div class="error-tables"><ErrorNote message={error} /></div>
  {/if}

  <Modal
    id="database-modal-new-table"
    class="modal-new-table"
    open={!!naming}
    onClose={() => (naming = null)}
    title={naming?.table ? "Cambiar el nombre de la tabla" : "Nueva tabla"}
    description={naming?.table
      ? "Solo cambia cómo se llama aquí; las columnas y las filas se quedan como están."
      : "Empieza con dos columnas; después agregas las que necesites."}
  >
    <Input
      autofocus
      placeholder="Empleados"
      aria-label="Nombre de la tabla"
      bind:value={name}
      onkeydown={(e) => e.key === "Enter" && name.trim() && saveName()}
    />
    <div class="error-new-table"><ErrorNote message={error} /></div>

    {#snippet footer()}
      <Button onclick={() => (naming = null)} disabled={busy}>Cancelar</Button>
      <Button variant="secondary" loading={busy} disabled={!name.trim()} onclick={saveName}>
        {naming?.table ? "Guardar" : "Crear tabla"}
      </Button>
    {/snippet}
  </Modal>

  {#if structureTarget}
    <ImportStructureModal
      table={structureTarget}
      {tables}
      onClose={() => (structureTarget = null)}
      onDone={onChanged}
    />
  {/if}

  <ConfirmDialog
    open={!!deleting}
    onClose={() => (deleting = null)}
    title={`Borrar tabla "${deleting?.label ?? ""}"`}
    message={`Se borrará la tabla "${deleting?.label ?? ""}" con todas sus filas. Esta acción no se puede deshacer.`}
    {busy}
    onConfirm={() => void confirmDeleteTable()}
  />

  <ConfirmDialog
    open={!!resetting}
    onClose={() => (resetting = null)}
    title="Restablecer"
    confirmLabel="Eliminar"
    {busy}
    onConfirm={() => void confirmReset()}
  >
    {#snippet message()}
      Esta acción eliminará columnas y datos a su estado inicial, ¿deseas continuar?
      <span class="reset-table-warning block">
        Se borran las cuentas de esta aplicación: quien entraba con ellas deja de poder hacerlo, y
        se va también su fila con sus columnas propias. Si alguna de esas personas está invitada en
        otra aplicación, allí no cambia nada. No tiene vuelta atrás.
      </span>
    {/snippet}
  </ConfirmDialog>
</aside>

<style>
  .sidebar-tables {
    width: 16rem;
    border-right: var(--border-width) solid var(--border);
    background: var(--bg-level2);

    & .header-tables {
      display: flex;
      height: 2.25rem;
      flex-shrink: 0;
      align-items: center;
      gap: 0.125rem;
      padding-inline: var(--sp-12);

      & .title-tables {
        display: flex;
        min-width: 0;
        flex: 1;
        align-items: baseline;
        gap: var(--sp-6);

        /* El rotulo es `.eyebrow` del catalogo; aqui solo el peso, que en
           una barra estrecha manda un punto mas que en una lista. */
        & .title-tables-label {
          font-weight: 600;
        }

        & .title-tables-count {
          font-size: var(--text-xs);
          font-variant-numeric: tabular-nums;
          color: var(--text-muted);
        }
      }
    }

    & .filter-tables {
      position: relative;
      flex-shrink: 0;
      padding: 0 var(--sp-8) var(--sp-6);

      & :global(.icon-filter-tables) {
        position: absolute;
        left: 1rem;
        top: 50%;
        z-index: 10;
        transform: translateY(-50%);
        pointer-events: none;
        color: var(--text-muted);
      }

      & .input-filter-tables {
        width: 100%;
        height: 1.75rem;
        padding: var(--sp-4) var(--sp-28);
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
      }

      & .btn-clear-tables-filter {
        position: absolute;
        right: 0.75rem;
        top: 50%;
        z-index: 10;
        transform: translateY(-50%);
        padding: 0.125rem;
        border-radius: calc(var(--radius-sm) / 2);
        color: var(--text-muted);
        transition: color 0.15s;

        &:hover {
          color: var(--text-primary);
        }
      }
    }

    & .list-tables {
      display: flex;
      min-height: 0;
      flex: 1;
      flex-direction: column;
      gap: 0.125rem;
      overflow-y: auto;
      padding: 0 var(--sp-8) var(--sp-8);
      font-size: var(--text-sm);
      line-height: var(--text-sm--line-height);

      & .row-table-sidebar {
        position: relative;
        display: flex;
        align-items: center;
        gap: var(--sp-4);
        border-radius: var(--radius-sm);
        transition: background-color 0.15s;

        & .btn-open-table {
          flex-grow: 1;
          text-align: left;

          & .name-table-sidebar {
            flex: 1 1 auto;
            min-width: 0;
            white-space: normal;
            overflow-wrap: anywhere;
          }
        }

        .btn-table-options {
          display: none;
        }

        & .btn-open-table-active {
          background: var(--accent-soft);
          color: var(--accent-soft-text);
        }

        & .btn-open-table-idle {
          color: var(--text-secondary);

          &:hover {
            background: color-mix(in oklab, var(--accent-text) 10%, transparent);
            color: var(--accent-text);
          }
        }

        & .options-table-sidebar {
          opacity: 0.2;
          transition: opacity 0.15s;
          min-width: 2.75rem;

          &:focus-within {
            opacity: 1;
          }
        }

        &:hover .options-table-sidebar {
          display: inline-flex;
          opacity: 1;
          width: auto;
          overflow: auto;
        }
      }

      & .empty-tables {
        padding: var(--sp-24) var(--sp-8);
        text-align: center;
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        color: var(--text-muted);
      }

      & .btn-new-table-link {
        width: 100%;
        color: var(--text-muted);
      }
    }

    & .error-tables {
      padding: 0 var(--sp-8) var(--sp-8);
    }
  }
  .error-new-table {
    margin-top: var(--sp-12);
  }

  .reset-table-warning {
    margin-top: var(--sp-8);
  }
</style>
