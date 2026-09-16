<!--
  El campo con el que se rellena una celda de relacion.

  Se escribe la llave --una cedula, un correo-- y nunca el id: el id es
  derivado. La lista de al lado es una comodidad para no tener que recordar el
  valor exacto, pero un valor que no esta en la lista tambien vale: se guarda
  como valor sin dueno, que es un estado valido.

  Lo que sale de aqui es siempre el texto de la llave. Quien guarda la fila lo
  resuelve contra la tabla destino y decide si se llena el id o el corralito.
-->
<script lang="ts">
  import { isOverlayField, personKeyValue } from "@shared/people";
  import { firstUnique } from "@shared/relations";
  import { displayFieldOf, type FieldDef, type TableRecord } from "@shared/types";
  import type PocketBase from "pocketbase";

  import { relationCell, type Row } from "../../lib/cellValues";
  import { getPeople } from "../../lib/people.svelte";
  import { InputPicker } from "../ui";

  let {
    field,
    value,
    row,
    onChange,
    tables,
    client,
    onDone,
  }: {
    field: FieldDef;
    /**
     * Lo que hay escrito ahora. Manda quien dibuja el campo y no un estado de
     * aqui: la lista de invitados llega de la red, y con una copia propia este
     * campo no se enteraria de que su celda ya sabe que ensenar.
     */
    value: unknown;
    row: Row | undefined;
    onChange: (v: unknown) => void;
    tables: TableRecord[];
    client: PocketBase;
    onDone?: () => void;
  } = $props();

  const people = getPeople();
  const target = $derived(tables.find((t) => t.id === field.relationTableId));
  const key = $derived(displayFieldOf(field) || (target ? firstUnique(target) : ""));

  let options = $state<string[]>([]);

  /*
   * Lo que se ve en el campo: lo que le llega, y si no le llega nada, lo que la
   * celda ensena. Al editar una celda suelta en la grilla no hay valor previo
   * que pasar, y ahi es la fila la que lo dice.
   */
  const text = $derived(
    value === undefined
      ? row
        ? relationCell(row, field, people.list).label
        : ""
      : String(value ?? ""),
  );

  /*
   * La lista se ofrece sin repetidos. Un mismo texto dos veces no da a elegir
   * nada --escribir "43928693" es lo mismo se pulse el de arriba o el de
   * abajo-- y la llave repetida no la resuelve este campo: lo que hay que
   * arreglar son dos personas con la misma cedula, y eso se arregla en su
   * tabla.
   */
  const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

  $effect(() => {
    const table = target;
    const column = key;
    if (!table || !column) return;
    // El correo y los roles no estan en la coleccion de la tabla de personas:
    // quien los tiene es la lista de invitados. Ver `isOverlayField`.
    if (isOverlayField(table, column)) {
      options = unique(people.list.map((p) => personKeyValue(p, column)));
      return;
    }
    let alive = true;
    client
      .collection(table.dataCollection)
      .getList(1, 200, { sort: "created,id" })
      .then((res) => {
        if (!alive) return;
        options = unique(
          res.items.map((item) => String((item as Record<string, unknown>)[column] ?? "")),
        );
      })
      .catch(() => {
        if (alive) options = [];
      });
    return () => {
      alive = false;
    };
  });
</script>

{#if !target}
  <span class="key-picker-missing">Tabla no encontrada</span>
{:else}
  <InputPicker
    {options}
    value={text}
    placeholder={key ? `Escribe ${key}` : "Escribe el valor"}
    onPick={(v) => {
      onChange(v);
      onDone?.();
    }}
    oninput={(e) => onChange(e.currentTarget.value)}
    onblur={onDone}
    onkeydown={(e) => {
      if (e.key === "Enter") onDone?.();
      if (e.key === "Escape") onDone?.();
    }}
    class="field-control key-picker-input"
  />
{/if}

<style>
  .key-picker-missing {
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-muted);
  }

  /* El tamano del campo de llave llega al campo de `InputPicker`. */
  :global(.key-picker-input) {
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
  }
</style>
