<!--
  El panel lateral donde se escribe una fila, entera y de una vez.

  La grilla quedo para mirar: es ancha, se desplaza y una celda no da sitio
  para un selector de personas o un archivo. Aqui cada columna tiene su
  etiqueta y su espacio, y la fila se guarda cuando se dice, no a medias.

  Sirve igual para una fila que todavia no existe y para una que ya esta: lo
  unico que cambia es de donde salen los valores iniciales y si al guardar se
  crea o se actualiza.
-->
<script lang="ts" module>
  import { isPeopleTable } from "@shared/people";
  import { type AppPerson, isRelationField, type TableRecord } from "@shared/types";

  import { relationCell, type Row } from "../../lib/cellValues";

  /** Vacio a efectos de "obligatoria": tambien la lista sin nada dentro. */
  const isEmpty = (value: unknown) =>
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && !value.length);

  /**
   * Los valores con los que abre el panel: los de la fila, o ninguno.
   *
   * En una relacion lo que se escribe es la llave, no el id, asi que lo que
   * abre el campo es lo que la celda ensena: la llave del registro enlazado, o
   * el valor que se quedo sin dueno.
   */
  function initialValues(
    table: TableRecord,
    row: Row | null,
    people: AppPerson[],
  ): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const field of table.fields) {
      if (isRelationField(field) && field.multiple !== true) {
        values[field.name] = row ? relationCell(row, field, people).label : "";
        continue;
      }
      values[field.name] = row ? (row[field.name] ?? "") : "";
    }
    return values;
  }
</script>

<script lang="ts">
  import type { FieldDef } from "@shared/types";
  import { type Snippet, untrack } from "svelte";

  import { cx } from "../../lib/cx";
  import { errorMessage, pb } from "../../lib/pb";
  import { getPeople } from "../../lib/people.svelte";
  import { portal } from "../../lib/portal";
  import { resolveRowValues, uniqueClashMessage } from "../../lib/relations";
  import Icon from "../Icon.svelte";
  import type { ToastKind } from "../Toast.svelte";
  import { Button, Note, surface } from "../ui";
  import { CellInput } from "./cells";
  import DrawerField from "./DrawerField.svelte";

  let {
    open,
    table,
    tables,
    row,
    onClose,
    onSaved,
    saveRow,
    extra,
  }: {
    open: boolean;
    table: TableRecord;
    tables: TableRecord[];
    /** La fila que se edita, o nada para una que se esta creando. */
    row: Row | null;
    onClose: () => void;
    /** Avisa a la grilla con la fila ya guardada y si acaba de nacer. */
    onSaved: (saved: Row, created: boolean) => void;
    /**
     * Quien guarda, cuando no basta con escribir en la coleccion de la tabla.
     *
     * Lo usa la tabla de personas, donde tres columnas viven en otras dos
     * colecciones y hay que repartir. Sin esto, escribir es lo de siempre.
     */
    saveRow?: (opts: { row: Row | null; values: Record<string, unknown> }) => Promise<Row>;
    /**
     * Lo que esta tabla tiene y no cabe en una columna. Hoy solo la clave de
     * una persona: se pone y se ensena una vez, y no se puede leer despues.
     *
     * Se dibuja tanto en una fila que ya existe como en una que esta naciendo
     * --a una persona se le elige la clave al darla de alta, no solo despues--
     * y es quien lo pasa el que decide que ensena en cada caso.
     *
     * Recibe lo que hay escrito ahora mismo, no lo que traia la fila: la clave
     * se cambia en el mismo panel donde se corrige el correo, y decir "clave
     * nueva para" el correo viejo es decir otra persona.
     */
    extra?: Snippet<[Record<string, unknown>]>;
  } = $props();

  /**
   * Los invitados a esta aplicacion. Van antes que los valores porque una
   * columna de persona los necesita para saber que ensena su celda.
   */
  const people = getPeople();

  let values = $state<Record<string, unknown>>(
    untrack(() => initialValues(table, row, people.list)),
  );
  let saving = $state(false);
  /**
   * El aviso del cajon, con su tono. Que falte una columna por llenar no es un
   * fallo del guardado: es lo que hay que hacer antes, y en rojo se leia como
   * si algo se hubiera roto.
   */
  let notice = $state<{ kind: ToastKind; text: string } | null>(null);
  const say = (kind: ToastKind, text: string) => (notice = { kind, text });
  const hush = () => (notice = null);

  /*
   * Las columnas que se han escrito en esta edicion. Una relacion que no se
   * toca no se vuelve a emparejar: una fila cuyo enlace ya venia roto se puede
   * seguir editando por lo demas.
   */
  let touched = new Set<string>();

  /*
   * Los valores se rehacen solo al abrir. Mientras el panel se va cerrando
   * sigue en pantalla un momento, y vaciarlo antes de tiempo lo dejaria en
   * blanco justo durante la animacion.
   *
   * `people` se lee con `untrack` a proposito: llega de la red y puede
   * aparecer con el panel ya abierto, y rehacer los valores entonces borraria
   * lo escrito. De ese hueco se encarga el efecto de abajo.
   */
  $effect(() => {
    if (!open) return;
    const t = table;
    const r = row;
    values = untrack(() => initialValues(t, r, people.list));
    hush();
    saving = false;
    touched = new Set();
  });

  /*
   * Las columnas que apuntan a personas, cuando la lista de invitados llega
   * tarde.
   *
   * Esa lista viene de la red: en el primer dibujado suele estar vacia, y una
   * celda que apunta a alguien no tiene entonces con que ensenar su correo. Se
   * rellena en cuanto llega, y solo en los campos que nadie ha tocado todavia.
   */
  $effect(() => {
    const list = people.list;
    if (!open || !row || list.length === 0) return;
    untrack(() => {
      const next = { ...values };
      let changed = false;
      for (const field of table.fields) {
        if (!isRelationField(field) || field.multiple === true) continue;
        if (!isPeopleTable(tables.find((t) => t.id === field.relationTableId) ?? null)) continue;
        if (touched.has(field.name) || next[field.name]) continue;
        const label = relationCell(row, field, list).label;
        if (!label) continue;
        next[field.name] = label;
        changed = true;
      }
      if (changed) values = next;
    });
  });

  $effect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const missing = $derived(table.fields.filter((f) => f.required && isEmpty(values[f.name])));

  function set(field: FieldDef, value: unknown) {
    touched.add(field.name);
    values = { ...values, [field.name]: value };
  }

  async function save() {
    if (missing.length) {
      say("warning", `Falta completar: ${missing.map((f) => f.label).join(", ")}.`);
      return;
    }
    saving = true;
    hush();
    try {
      // Lo que se escribio en una relacion es la llave: aqui se empareja con el
      // registro al que pertenece y se decide cual de sus dos columnas reales
      // se llena.
      const resolved = await resolveRowValues({
        table,
        tables,
        values,
        touched,
        people: people.list,
      });

      const expand = table.fields
        .filter((f) => isRelationField(f) && f.multiple !== true)
        .map((f) => f.name)
        .join(",");
      const saved = saveRow
        ? await saveRow({ row, values: resolved })
        : row
          ? await pb.collection(table.dataCollection).update<Row>(row.id, resolved, { expand })
          : await pb.collection(table.dataCollection).create<Row>(resolved, { expand });
      onSaved(saved, !row);
      onClose();
    } catch (err) {
      // Un valor repetido en una columna que no los admite se explica diciendo
      // con que fila choca: sin eso no hay forma de saber que arreglar.
      const clash = await uniqueClashMessage(table, values, err, row?.id).catch(() => "");
      say("error", clash || errorMessage(err));
    } finally {
      saving = false;
    }
  }
</script>

<!--
  El armazon del cajon. La hoja se queda montada aunque este cerrado para que
  la animacion de salida tenga algo que animar; es `drawer-toggle` (la casilla
  escondida de arriba) quien la ensena y la esconde, con el CSS de abajo.
-->
<div use:portal class="drawer-outer-row">
  <input
    type="checkbox"
    class="drawer-toggle"
    checked={open}
    readonly
    tabindex="-1"
    aria-hidden="true"
  />
  <!--
    Por encima de los modales (20) y no a su misma altura.

    El cajon se monta con la grilla y se queda montado --escondido por
    `drawer-toggle`-- asi que en el documento va antes que cualquier dialogo que
    se abra despues. Con la misma capa ganaria el dialogo, y editar una fila
    desde la cuadricula de personas dibujaria el cajon por debajo. Sigue por
    debajo de los avisos (40), que son lo ultimo que se tapa. Ver la escala en
    `styles/global.css`.
  -->
  <div class="drawer-side-row">
    <button
      type="button"
      aria-label="Cerrar el panel"
      onclick={onClose}
      class="btn-close-drawer veil-drawer-row"
    ></button>
    <aside class="drawer-row flex h-full flex-col" aria-label={row ? "Editar fila" : "Nueva fila"}>
      <header
        class={cx("header-drawer-row", surface.head, "header-drawer-row-center items-center")}
      >
        <h2 class={surface.title}>{row ? "Editar fila" : "Nueva fila"}</h2>
        <span class="label-drawer-row">{table.label}</span>
        <button
          type="button"
          aria-label="Cerrar el panel"
          class="btn-close-drawer-row btn-icon sm btn-rounded btn-close-drawer-row-end"
          onclick={onClose}
        >
          <Icon name="cancel-01" size={15} />
        </button>
      </header>

      <div class={cx("body-drawer-row", "body-drawer-row-scrollable flex-1", surface.body)}>
        <!--
          Debajo del titulo y no al final: es lo que se copia para nombrar esta
          fila desde fuera --un enlace, una consulta-- y buscarlo obligaba a
          bajar por delante de todas las columnas.
        -->
        {#if row}
          <dl class="id-drawer-row flex gap-2">
            <dt>ID</dt>
            <dd class="id-drawer-row-value">{row.id}</dd>
          </dl>
        {/if}

        {#if table.fields.length === 0}
          <p class="empty-drawer-fields">
            Esta tabla todavia no tiene columnas. Anade una para poder escribir filas.
          </p>
        {:else}
          <div class="list-drawer-fields flex flex-col gap-4">
            {#each table.fields as field (field.name)}
              <DrawerField {field}>
                <CellInput
                  {field}
                  value={values[field.name]}
                  row={row ?? undefined}
                  client={pb}
                  {tables}
                  onChange={(value) => set(field, value)}
                />
              </DrawerField>
            {/each}
          </div>
        {/if}

        {#if extra}
          <div class="extra-drawer-row">{@render extra(values)}</div>
        {/if}
      </div>

      <footer class="footer-drawer-row flex shrink-0 flex-col gap-2">
        <Note kind={notice?.kind ?? "error"} message={notice?.text ?? ""} />
        <div class="actions-drawer-row flex items-center gap-2">
          <!-- El aviso de arriba ya lo dice; no hace falta repetirlo aqui. -->
          {#if !notice && missing.length > 0}
            <span class="missing-drawer-fields">
              Falta {missing.map((f) => f.label).join(", ")}
            </span>
          {/if}
          <Button
            size="sm"
            buttonClass="btn-cancel-row"
            class="btn-cancel-row-end"
            onclick={onClose}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            variant="secondary"
            buttonClass="btn-save-row"
            loading={saving}
            disabled={table.fields.length === 0}
            onclick={() => void save()}
          >
            Guardar
          </Button>
        </div>
      </footer>
    </aside>
  </div>
</div>

<style>
  /* La casilla que manda: escondida, sin foco y sin clic. */
  .drawer-toggle {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  /*
   * El velo y la hoja entran y salen deslizandose. Cerrado, el conjunto no
   * recibe el puntero ni se ve: `visibility` si transiciona hacia oculto (se
   * aguanta visible hasta el final), que es lo que da salida a la hoja.
   */
  .drawer-side-row {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: flex;
    justify-content: flex-end;
    visibility: hidden;
    pointer-events: none;
    transition: visibility 0.3s;
  }

  .drawer-toggle:checked ~ .drawer-side-row {
    visibility: visible;
    pointer-events: auto;
  }

  .veil-drawer-row {
    position: absolute;
    inset: 0;
    border: 0;
    padding: 0;
    background: rgb(0 0 0 / 0.4);
    backdrop-filter: blur(1.5px);
    -webkit-backdrop-filter: blur(1.5px);
    opacity: 0;
    cursor: default;
    transition: opacity 0.3s;
  }

  .drawer-toggle:checked ~ .drawer-side-row .veil-drawer-row {
    opacity: 1;
  }

  .drawer-row {
    width: 45rem;
    max-width: 100%;
    /* Encima del velo a la fuerza: el velo pinta por delante de lo estatico. */
    position: relative;
    z-index: 1;
    border-left: var(--border-width) solid var(--border);
    background: var(--bg-level2);
    box-shadow: var(--shadow-sm);
    translate: 100% 0;
    transition: translate 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .drawer-toggle:checked ~ .drawer-side-row .drawer-row {
    translate: 0 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .drawer-row,
    .veil-drawer-row,
    .drawer-side-row {
      transition: none;
    }
  }

  .label-drawer-row {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-muted);
  }

  .btn-close-drawer-row-end {
    margin-left: auto;
  }

  .body-drawer-row-scrollable {
    min-height: 0;
    overflow-y: auto;
  }

  .id-drawer-row {
    border-bottom: var(--border-width) solid var(--border);
    padding-bottom: var(--sp-12);
    margin-bottom: var(--sp-16);
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-muted);

    & .id-drawer-row-value {
      font-family: var(--font-mono);
    }
  }

  .empty-drawer-fields {
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
    color: var(--text-muted);
  }

  .extra-drawer-row {
    margin-top: var(--sp-24);
    border-top: var(--border-width) solid var(--border);
    padding-top: var(--sp-16);

    /*
      Quien lo pasa decide si tiene algo que poner --la clave solo sale en la
      tabla de personas-- y cuando no lo tiene aqui quedaba una raya suelta
      cerrando el formulario por debajo. Se mira si hay algun elemento dentro y
      no `:empty`, que cuentan los espacios en blanco del propio fragmento.
    */
    &:not(:has(*)) {
      display: none;
    }
  }

  .footer-drawer-row {
    border-top: var(--border-width) solid var(--border);
    padding-inline: var(--sp-16);
    padding-block: var(--sp-12);
  }

  .missing-drawer-fields {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-muted);
  }

  .btn-cancel-row-end {
    margin-left: auto;
  }
</style>
