<!--
  Los valores que no encontraron a quien apuntar, y como resolverlos.

  Se agrupan por valor y no por fila: veinte filas suelen ser tres cedulas, y
  lo que hay que resolver son las tres. Cada una se arregla creando el registro
  que le falta --y sus filas se enlazan de una vez-- o aceptandola, con lo que
  deja de contar.

  "Aceptar" hace falta: sin el, las cedulas de terceros que nunca van a tener
  ficha cuentan para siempre, el contador no llega a cero y se convierte en
  ruido que el usuario aprende a ignorar.

  Lo que se cuenta y como se enlaza vive en `lib/orphans.ts`: la grilla lo
  necesita sin abrir esta tarjeta.
-->
<script lang="ts">
  import { isPeopleTable } from "@shared/people";
  import { relationTarget } from "@shared/relations";
  import { type AppPerson, orphanFieldName, type TableRecord } from "@shared/types";

  import { invitedFor, loadOrphans, type OrphanValue } from "../../lib/orphans";
  import { errorMessage, patch, pb } from "../../lib/pb";
  import { Button, ErrorNote, Modal, Spinner } from "../ui";

  let {
    table,
    tables,
    people,
    onClose,
    onChanged,
  }: {
    table: TableRecord;
    tables: TableRecord[];
    /** Los invitados a la aplicacion, para resolver las columnas de persona. */
    people: AppPerson[];
    onClose: () => void;
    /** Las filas cambiaron: hay que recargar la grilla y la tabla. */
    onChanged: () => Promise<void> | void;
  } = $props();

  let orphans = $state<OrphanValue[] | null>(null);
  let busy = $state("");
  let error = $state("");

  async function reload() {
    try {
      orphans = await loadOrphans(table);
    } catch (err) {
      error = errorMessage(err);
      orphans = [];
    }
  }

  $effect(() => {
    void table.id;
    void reload();
  });

  /** Enlaza a un registro todas las filas que llevaban ese valor esperando. */
  async function linkAll(orphan: OrphanValue, recordId: string) {
    const orphanColumn = orphanFieldName(orphan.field.name);
    const rows = await pb.collection(table.dataCollection).getFullList<{ id: string }>({
      filter: `${orphanColumn} = ${JSON.stringify(orphan.value)}`,
    });
    for (const row of rows) {
      await pb
        .collection(table.dataCollection)
        .update(row.id, { [orphan.field.name]: recordId, [orphanColumn]: "" });
    }
  }

  /**
   * Crea el registro que faltaba y enlaza de una vez todas las filas que
   * llevaban ese valor. De una vez porque el usuario resolvio el valor, no la
   * fila: hacerlo fila a fila seria pedirle veinte veces lo mismo.
   */
  async function createAndLink(orphan: OrphanValue) {
    const target = relationTarget(orphan.field, tables);
    if (!target?.table || !target.key) {
      error = "Esta columna no tiene una llave con la que crear el registro.";
      return;
    }
    busy = `${orphan.field.name}:${orphan.value}`;
    error = "";
    try {
      const created = await pb
        .collection(target.table.dataCollection)
        .create<{ id: string }>({ [target.key]: orphan.value });

      await linkAll(orphan, created.id);
      await reload();
      await onChanged();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = "";
    }
  }

  /**
   * Enlaza el valor con la persona que ya esta invitada y lo lleva.
   *
   * Es la salida de una columna de persona: aqui no se crea a nadie --una
   * persona nace con su cuenta, desde "Personas y roles"-- pero en cuanto
   * existe, sus filas se pueden recoger de una vez.
   */
  async function linkPerson(orphan: OrphanValue, personId: string) {
    busy = `${orphan.field.name}:${orphan.value}`;
    error = "";
    try {
      await linkAll(orphan, personId);
      await reload();
      await onChanged();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = "";
    }
  }

  /** Da el valor por bueno: deja de contar y sigue viendose en su celda. */
  async function accept(orphan: OrphanValue, accepted: boolean) {
    busy = `${orphan.field.name}:${orphan.value}`;
    error = "";
    try {
      const current = table.acceptedOrphans ?? {};
      const list = new Set(current[orphan.field.name] ?? []);
      if (accepted) list.add(orphan.value);
      else list.delete(orphan.value);

      await patch(`/api/tables/${table.id}`, {
        acceptedOrphans: { ...current, [orphan.field.name]: [...list] },
      });
      await onChanged();
      await reload();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = "";
    }
  }
</script>

<Modal
  id="orphan-panel"
  open
  {onClose}
  title="Valores sin registro"
  description={`En "${table.label}". Estas filas están guardadas y su valor se ve; lo que falta es a quien apunta.`}
>
  <ErrorNote message={error} />

  {#if orphans === null}
    <Spinner />
  {:else if orphans.length === 0}
    <p class="empty-orphan-panel">Todas las filas de esta tabla apuntan a un registro.</p>
  {:else}
    <ul class="list-orphan-panel flex flex-col gap-2">
      {#each orphans as orphan (`${orphan.field.name}:${orphan.value}`)}
        {@const key = `${orphan.field.name}:${orphan.value}`}
        {@const working = busy === key}
        {@const person = isPeopleTable(
          tables.find((t) => t.id === orphan.field.relationTableId) ?? null,
        )}
        {@const invited = person ? invitedFor(orphan, people, tables) : null}
        <li class="row-orphan-panel inset plain flex flex-wrap items-center gap-2">
          <span class="value-orphan-panel">
            <span class="name-orphan-panel">{orphan.value}</span>
            <span class="meta-orphan-panel">
              {orphan.field.label} · {orphan.rows}
              {orphan.rows === 1 ? "fila" : "filas"}
              {orphan.accepted ? " · aceptado" : ""}
              <!--
                Una columna que apunta a personas no se resuelve creando nada
                desde aqui: quien falta es alguien con cuenta, y eso se hace
                invitandolo. Se dice en la fila para no dejar un boton que solo
                sabe fallar.
              -->
              {!orphan.accepted && person && !invited ? " · nadie invitado lo lleva" : ""}
            </span>
          </span>

          {#if !orphan.accepted}
            {#if person}
              {#if invited}
                <Button
                  size="sm"
                  variant="secondary"
                  loading={working}
                  onclick={() => void linkPerson(orphan, invited.id)}
                >
                  Enlazar con {invited.label}
                </Button>
              {/if}
            {:else}
              <Button
                size="sm"
                variant="secondary"
                loading={working}
                onclick={() => void createAndLink(orphan)}
              >
                Crear y enlazar
              </Button>
            {/if}
            <Button size="sm" loading={working} onclick={() => void accept(orphan, true)}>
              Dejar asi
            </Button>
          {:else}
            <Button size="sm" loading={working} onclick={() => void accept(orphan, false)}>
              Volver a contarlo
            </Button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#snippet footer()}
    <Button onclick={onClose}>Cerrar</Button>
  {/snippet}
</Modal>

<style>
  .empty-orphan-panel {
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
    color: var(--text-secondary);
  }

  /* La caja es `.inset.plain` del catalogo --el cerco sin fondo--; aqui
     solo el acolchado de la fila. */
  .row-orphan-panel {
    padding: var(--sp-10);

    & .value-orphan-panel {
      min-width: 0;
      flex: 1;

      & .name-orphan-panel {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: var(--text-sm);
        line-height: var(--text-sm--line-height);
        font-weight: 500;
      }

      & .meta-orphan-panel {
        display: block;
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        color: var(--text-secondary);
      }
    }
  }
</style>
