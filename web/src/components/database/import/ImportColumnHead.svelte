<!--
  El encabezado de una columna del archivo, dentro de la grilla de la
  previsualizacion.

  Aqui se decide todo lo de esa columna --si entra, a donde va, de que tipo se
  crea y por que llave empareja-- sin salir de la tabla: antes vivia en un panel
  lateral, donde había que emparejar el nombre de una lista con la columna de la
  derecha a ojo.

  El orden manda: el ojo a la izquierda, el emparejamiento en medio y los demas
  botones a la derecha.
-->
<script lang="ts">
  import { type FieldDef, isRelationField, type TableRecord } from "@shared/types";

  import { cx } from "../../../lib/cx";
  import { FIELD_TYPES } from "../../../lib/fieldTypes";
  import type { ColumnMatchReport } from "../../../lib/importParse";
  import {
    type ColumnPlan,
    type ColumnRule,
    type ColumnTarget,
    CREATE_TYPES,
    newDraft,
  } from "../../../lib/importPlan";
  import Icon from "../../Icon.svelte";
  import { Dropdown, MenuItem, MenuLabel, MenuSeparator, Tag } from "../../ui";
  import FieldIcon from "../FieldIcon.svelte";
  import KeySelect from "./KeySelect.svelte";

  let {
    plan,
    table,
    tables,
    isPeople,
    keys,
    reports,
    rule,
    broken,
    frozen = false,
    onTarget,
    onClear,
    onKey,
    onRule,
  }: {
    plan: ColumnPlan;
    table: TableRecord;
    tables: TableRecord[];
    isPeople: boolean;
    keys: Record<string, string>;
    reports: ColumnMatchReport[];
    /** Lo que se le exige a esta columna en esta importacion. */
    rule: ColumnRule;
    /** Cual de lo exigido se esta incumpliendo: la pastilla se pone en rojo. */
    broken: ColumnRule;
    /** Ya se guardo: el encabezado cuenta lo que se hizo y no deja cambiarlo. */
    frozen?: boolean;
    onTarget: (column: string, target: ColumnTarget) => void;
    /** Devolver la columna a lo sugerido. */
    onClear: (column: string) => void;
    onKey: (field: string, key: string) => void;
    onRule: (column: string, rule: ColumnRule) => void;
  } = $props();

  const target = $derived(plan.target);
  const ignored = $derived(target.kind === "skip");
  /**
   * Si esta columna nace del archivo.
   *
   * Cambia lo que se dice de lo exigido: sobre una columna que ya existe solo
   * rige esta importacion, y sobre una que nace, la columna se queda con ello
   * puesto. Ver `createColumns` en `lib/importSave.ts`.
   */
  const creating = $derived(target.kind === "create");

  /** Como se llama en la tabla lo que trae esta columna del archivo. */
  const destino = $derived.by(() => {
    if (target.kind === "field") return target.field.label;
    if (target.kind === "id") return "ID del registro";
    if (target.kind === "create") return target.draft.label || plan.column;
    return "Sin importar";
  });

  /**
   * Si hay que ensenar de donde viene.
   *
   * "Name -> Nombre" solo cuando los dos nombres no son el mismo: repetir
   * "Nombre -> Nombre" en veinte columnas es ruido, y lo que hay que mirar de
   * un vistazo es justamente donde no coinciden.
   */
  const renamed = $derived(plan.column.trim() !== destino.trim());

  const fieldOf = (t: ColumnTarget): FieldDef | null =>
    t.kind === "field" ? t.field : t.kind === "create" ? t.draft : null;
</script>

{#if frozen}
  <div class={cx("head-import-column", "is-frozen", ignored && "is-ignored")}>
    {#if renamed}
      <span class="import-col-from trigger-quiet-soft">{plan.column}</span>
      <Icon name="arrow-right-01" size={12} class="import-col-arrow" />
    {/if}
    <span class="import-col-to">{destino}</span>
  </div>
{:else}
  <div class={cx("head-import-column", ignored && "is-ignored")}>
    <!-- El ojo, a la izquierda: es lo que se busca cuando sobra una columna. -->
    <button
      type="button"
      aria-label={ignored ? `Importar ${plan.column}` : `Ignorar ${plan.column}`}
      aria-pressed={ignored}
      data-tip={ignored ? "Esta columna no se importa" : "Quitar esta columna de la importacion"}
      class={cx("btn-toggle-import-column", "btn-icon sm", ignored && "is-off")}
      onclick={() => (ignored ? onClear(plan.column) : onTarget(plan.column, { kind: "skip" }))}
    >
      <Icon name={ignored ? "view-off-slash" : "view"} size={14} />
    </button>

    <!--
    El emparejamiento, que es a la vez la etiqueta y el botón de cambiarlo: lo
    que se lee ("Name -> Nombre") es lo mismo que se toca para corregirlo.
  -->
    <Dropdown wrapClass="import-col-target-wrap" class="menu-import-target">
      {#snippet trigger({ toggle })}
        <button
          type="button"
          class="btn-pick-import-target import-col-target trigger-quiet"
          aria-label={`Destino de ${plan.column}`}
          data-tip={`${plan.column} se guarda en "${destino}"`}
          onclick={toggle}
        >
          {#if renamed}
            <span class="import-col-from trigger-quiet-soft">{plan.column}</span>
            <Icon name="arrow-right-01" size={12} class="import-col-arrow" />
          {/if}
          {#if fieldOf(target)}
            {@const f = fieldOf(target)}
            {#if f}<FieldIcon type={f.type} system={f.system} size={12} />{/if}
          {/if}
          <span class="import-col-to">{destino}</span>
          <Icon name="arrow-down-01" size={12} class="import-col-caret" />
        </button>
      {/snippet}

      {#snippet children(close)}
        {#if table.fields.length > 0}
          <MenuLabel>Selecciona la columna de destino</MenuLabel>
          {#each table.fields as f (f.name)}
            <MenuItem
              onclick={() => {
                close();
                onTarget(plan.column, { kind: "field", field: f });
              }}
            >
              {#snippet icon()}<FieldIcon type={f.type} system={f.system} size={14} />{/snippet}
              {f.label}
            </MenuItem>
          {/each}
          <MenuSeparator />
        {/if}
        <MenuItem
          onclick={() => {
            close();
            onTarget(plan.column, { kind: "create", draft: newDraft(plan.column) });
          }}
        >
          {#snippet icon()}<Icon name="plus-sign" size={14} />{/snippet}
          Crear columna nueva
        </MenuItem>
        <!--
        En personas el id no sirve de nada: cada fila se reconoce por su correo,
        no por el id del archivo.
      -->
        {#if !isPeople}
          <MenuItem
            onclick={() => {
              close();
              onTarget(plan.column, { kind: "id" });
            }}
          >
            {#snippet icon()}<Icon name="id" size={14} />{/snippet}
            ID del registro
          </MenuItem>
        {/if}
        <!--
        Lo que se le exige a la columna, en el mismo menu que su destino: es de
        esta columna, y buscarlo en otro sitio seria volver al panel lateral.
        Marcarlo no cierra el menu --se suelen poner las dos a la vez-- y solo
        se ofrece si la columna entra: a una apagada no hay nada que exigirle.
      -->
        {#if !ignored}
          <MenuSeparator />
          <MenuLabel>
            {creating ? "La columna nueva nace así" : "Al importar, esta columna"}
          </MenuLabel>
          <MenuItem
            class="menu-item-rule-unique"
            onclick={() => onRule(plan.column, { ...rule, unique: !rule.unique })}
          >
            {#snippet icon()}
              <Icon name={rule.unique ? "tick-02" : "fingerprint-pattern"} size={14} />
            {/snippet}
            No se repite
          </MenuItem>
          <MenuItem
            class="menu-item-rule-required"
            onclick={() => onRule(plan.column, { ...rule, required: !rule.required })}
          >
            {#snippet icon()}
              <Icon name={rule.required ? "tick-02" : "square-asterisk"} size={14} />
            {/snippet}
            Es obligatoria
          </MenuItem>
        {/if}
        <MenuSeparator />
        <MenuItem
          onclick={() => {
            close();
            onClear(plan.column);
          }}
        >
          {#snippet icon()}<Icon name="refresh" size={14} />{/snippet}
          Volver a lo sugerido
        </MenuItem>
      {/snippet}
    </Dropdown>

    <!-- Lo demas, a la derecha. -->
    <div class="import-col-actions">
      <!--
        Lo exigido, dicho en el propio encabezado: si la columna no cuenta que
        no se repite, las filas en rojo de abajo no se explican. La cruz lo
        quita, que es donde se busca para deshacerlo.

        El color es el que cada exigencia lleva en el título de una columna de
        la tabla --obligatoria en rojo, sin repetidos en ambar; ver
        `ColumnHead.svelte`-- para que sea la misma marca antes y después de
        importar, y no una que hay que volver a aprender. Lo que se esta
        incumpliendo se senala con el triangulo y el borde entero y no con otro
        tinte: en su color ya estaba, y pintar las dos del mismo rojo al fallar
        borraba justo la diferencia entre una y otra.
      -->
      {#if !ignored && rule.unique}
        <Tag
          tone="tag-warning"
          tip={broken.unique
            ? "Hay filas que repiten este valor"
            : creating
              ? "Dos filas con el mismo valor no entran, y la columna nace sin repetidos"
              : "Dos filas con el mismo valor no entran"}
          class={cx("badge-rule-unique", "import-col-rule", broken.unique && "is-broken")}
          removeLabel={`Dejar que ${plan.column} se repita`}
          onRemove={() => onRule(plan.column, { ...rule, unique: false })}
        >
          <Icon name={broken.unique ? "triangle-alert" : "fingerprint-pattern"} /> No se repite
        </Tag>
      {/if}
      {#if !ignored && rule.required}
        <Tag
          tone="tag-error"
          tip={broken.required
            ? "Hay filas que no traen este dato"
            : creating
              ? "Una fila sin este dato no entra, y la columna nace obligatoria"
              : "Una fila sin este dato no entra"}
          class={cx("badge-rule-required", "import-col-rule", broken.required && "is-broken")}
          removeLabel={`Dejar ${plan.column} en blanco`}
          onRemove={() => onRule(plan.column, { ...rule, required: false })}
        >
          <Icon name={broken.required ? "triangle-alert" : "square-asterisk"} /> Obligatoria
        </Tag>
      {/if}

      {#if target.kind === "create"}
        {@const draft = target.draft}
        <Tag
          tone="tag-success"
          tip="Columna nueva: se crea al guardar"
          class="badge-new-column import-col-new"
        >
          <Icon name="plus-sign" /> nueva
        </Tag>

        <!-- El tipo con el que nace la columna, en un botón y no en una lista. -->
        <Dropdown align="right" class="menu-import-type">
          {#snippet trigger({ toggle })}
            <button
              type="button"
              class="btn-pick-import-type import-col-type trigger-quiet"
              aria-label={`Tipo de la columna nueva ${plan.column}`}
              data-tip="Tipo de la columna nueva"
              onclick={toggle}
            >
              <FieldIcon type={draft.type} size={12} />
              <span>{FIELD_TYPES[draft.type].label}</span>
              <Icon name="arrow-down-01" size={12} class="import-col-caret" />
            </button>
          {/snippet}

          {#snippet children(close)}
            <MenuLabel>Tipo de columna</MenuLabel>
            {#each CREATE_TYPES as t (t)}
              <MenuItem
                onclick={() => {
                  close();
                  onTarget(plan.column, { kind: "create", draft: { ...draft, type: t } });
                }}
              >
                {#snippet icon()}<FieldIcon type={t} size={14} />{/snippet}
                {FIELD_TYPES[t].label}
              </MenuItem>
            {/each}
          {/snippet}
        </Dropdown>
      {/if}

      {#if target.kind === "field" && isRelationField(target.field) && target.field.multiple !== true}
        {@const relation = target.field}
        <KeySelect
          field={relation}
          {tables}
          value={keys[relation.name] ?? ""}
          report={reports.find((r) => r.field.name === relation.name)}
          onChange={(key) => onKey(relation.name, key)}
        />
      {/if}
    </div>
  </div>
{/if}

<style>
  .head-import-column {
    display: flex;
    align-items: center;
    gap: var(--sp-4);

    /* Congelado: el mismo renglon, con el acolchado que ponian los botones. */
    &.is-frozen {
      padding: 0.3125rem 0.25rem;
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
    }

    /*
     * La columna apagada se dice en su encabezado --que se queda entero a la
     * vista-- y no solo en las celdas: el ojo tachado se pinta en rojo y el
     * nombre se cruza, para que no haga falta seguir la columna hasta abajo
     * para saber que no entra.
     */
    &.is-ignored {
      & .import-col-from,
      & .import-col-to {
        color: var(--text-muted);
        text-decoration: line-through;
      }
    }

    & .btn-toggle-import-column {
      flex-shrink: 0;

      /* Pulsado aqui no es "puesto" sino "no se importa", asi que va en rojo
         y no en el acento que el catálogo da a `aria-pressed`. El borde se
         nombra también: sin el, el del acento se colaria sobre este rojo. */
      &.is-off {
        color: var(--danger);
        background: var(--danger-bg);
        border-color: color-mix(in oklab, var(--danger) 50%, transparent);

        &:hover {
          color: var(--danger);
          background: var(--danger-bg);
          border-color: var(--danger);
        }
      }
    }

    /* El disparador se encoge con la celda; el menu se ancla a el. */
    & :global(.import-col-target-wrap) {
      min-width: 0;
      flex: 1 1 auto;
    }

    & .import-col-actions {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      gap: var(--sp-4);
    }

    /* Las pastillas las dibuja `Tag`: sus clases salen del ambito de aqui. Van
       en el mismo renglon que la de "nueva" y con su misma medida. */
    & :global(.import-col-rule) {
      flex-shrink: 0;
      gap: var(--sp-4);
      padding: 0 var(--sp-6);
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
    }

    /* La exigencia que no se esta cumpliendo: su mismo color, pero con el
       borde entero en vez del tercio que el catálogo le pone en reposo. El
       color ya dice cual de las dos es, asi que lo que falla no puede decirse
       también con color; se dice con el borde y con el triangulo del icono.
       Va en su propia regla y no anidada como un estado porque la pastilla la
       dibuja `Tag`: desde aqui solo se alcanza con `:global`. */
    & :global(.import-col-rule.is-broken) {
      box-shadow: inset 0 0 0 var(--border-width) currentColor;
    }

    /* La pastilla la dibuja `Tag`: su clase sale del ambito de aqui. */
    & :global(.import-col-new) {
      flex-shrink: 0;
      gap: var(--sp-4);
      padding: 0 var(--sp-6);
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
    }
  }

  /*
   * Los dos botones que abren menu --el del destino y el del tipo-- son
   * `.trigger-quiet` del catálogo: la línea solo asoma al apuntarlos, para que
   * el encabezado no parezca una barra de herramientas. De donde viene el dato
   * va en `.trigger-quiet-soft`, el tono accesorio del disparador: lo que
   * importa es adonde va.
   */
  .import-col-target {
    width: 100%;
  }

  .import-col-from {
    max-width: 8rem;
  }

  .import-col-to {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.import-col-arrow),
  :global(.import-col-caret) {
    flex-shrink: 0;
    color: var(--text-muted);
  }
</style>
