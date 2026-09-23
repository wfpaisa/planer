<!--
  La grilla de la previsualizacion: el archivo tal como entraria.

  Es también donde se emparejan las columnas --cada encabezado es un
  `ImportColumnHead` con su destino, su llave y su regla-- porque lo que se
  elige ahi se ve en la misma columna, fila por fila, sin salir a otra lista.

  Solo pinta: lo que se elige sube al `ImportWizard`, y lo que esta mal lo
  calcula quien la usa y llega en `marks`.
-->
<script lang="ts">
  import type { TableRecord } from "@shared/types";

  import { cx } from "../../../lib/cx";
  import type { ColumnMatchReport } from "../../../lib/importParse";
  import { type RowStatus, type RuleIssue, ruleMessage } from "../../../lib/importPlan";
  import type { ImportWizard } from "../../../lib/importWizard.svelte";
  import Icon from "../../Icon.svelte";
  import { Tag } from "../../ui";
  import ImportColumnHead from "./ImportColumnHead.svelte";

  let {
    wizard,
    table,
    tables,
    isPeople,
    keys,
    reports,
    onKey,
    frozen,
    nothingMapped,
    showStatus,
    overwriteByOrder,
    rows,
    statuses,
    marks,
  }: {
    wizard: ImportWizard;
    table: TableRecord;
    tables: TableRecord[];
    isPeople: boolean;
    /** Por que llave se empareja cada columna de relación. */
    keys: Record<string, string>;
    reports: ColumnMatchReport[];
    onKey: (field: string, key: string) => void;
    /** Ya se importo: no hay nada mas que elegir, los mandos se apagan. */
    frozen: boolean;
    nothingMapped: boolean;
    /** Si se enseña la columna de que le pasa a cada fila. */
    showStatus: boolean;
    overwriteByOrder: boolean;
    /** Que filas del archivo se ensenan, por su sitio en el (desde 0). */
    rows: number[];
    statuses: RowStatus[];
    /** Lo que esta mal, para pintarlo: por fila, por celda y por columna. */
    marks: {
      rows: Set<number>;
      cell: (row: number, column: string) => RuleIssue["kind"] | undefined;
      duplicateColumns: Set<string>;
      missingColumns: Set<string>;
    };
  } = $props();
</script>

<!--
  La tabla del catálogo (`table-card` + `table-wrap` + `table`) dentro de su
  tarjeta. Lo único que se le cambia desde aqui es lo que pide una
  previsualizacion y no una tabla de página: la cabeza fija al desplazar, el
  encabezado con mandos dentro --sin versalitas-- y las celdas mas apretadas
  para que quepan mas filas a la vista.
-->
<div class="grid-import-preview table-card card">
  <div class="table-wrap">
    <table class="table">
      <thead>
        <tr>
          {#if showStatus}
            <th class="import-grid-status-header">Estado</th>
          {/if}
          <!--
            Todas las columnas del archivo, también las que no entran:
            una columna apagada que desaparecia de la tabla no se podia
            volver a encender sin buscarla en otra lista.
          -->
          {#each wizard.shownPlans as plan (plan.column)}
            <th class="import-grid-col-header">
              <ImportColumnHead
                {plan}
                {table}
                {tables}
                {isPeople}
                {keys}
                {reports}
                rule={wizard.rules[plan.column] ?? {}}
                broken={{
                  unique: marks.duplicateColumns.has(plan.column),
                  required: marks.missingColumns.has(plan.column),
                }}
                {frozen}
                onTarget={wizard.setTarget}
                onClear={wizard.clearTarget}
                {onKey}
                onRule={wizard.setRule}
              />
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        <!--
          Sin una sola columna encendida no se ensenan las filas: lo que
          se guardaria son filas vacias, y una tabla llena de datos
          decia justo lo contrario.
        -->
        {#if rows.length === 0}
          <tr>
            <td class="import-grid-empty" colspan={wizard.shownPlans.length + (showStatus ? 1 : 0)}>
              {#if frozen}
                No quedó ninguna fila fuera: entró todo el archivo.
              {:else if nothingMapped}
                No hay columnas seleccionadas. Activa desde el encabezado las que quieras importar.
              {:else}
                Ninguna persona del archivo tiene cuenta. Desactiva "Solo modificar" para crear las
                cuentas.
              {/if}
            </td>
          </tr>
        {/if}
        <!-- Filas sin id propio en la previsualizacion: el índice es su identidad. -->
        {#each rows as r (r)}
          {@const raw = wizard.parsedTable?.rows[r] ?? []}
          {@const conv = wizard.conversion.converted[r]}
          {@const failed = (conv?.errors.length ?? 0) > 0}
          {@const broken = marks.rows.has(r)}
          {@const updates = statuses[r] === "update"}
          <tr
            class={cx(
              (failed || broken) && "import-grid-row-error",
              !failed && !broken && updates && "import-grid-row-update",
            )}
            data-tip={isPeople && updates && !failed && !broken
              ? "Esta persona ya tiene cuenta aquí: su fila se actualiza"
              : undefined}
          >
            {#if showStatus}
              <td class="import-grid-status">
                {#if updates}
                  <Tag
                    tone="tag-warning"
                    tip={overwriteByOrder
                      ? `Pisa la fila ${r + 1} de la tabla`
                      : `Pisa la fila ${conv?.id}`}
                    class="import-grid-status-badge"
                  >
                    <Icon name="refresh" /> Sobrescribe
                  </Tag>
                {:else}
                  <Tag tone="tag-success" class="import-grid-status-badge">
                    <Icon name="plus-sign" /> Nueva
                  </Tag>
                {/if}
              </td>
            {/if}
            {#each wizard.shownPlans as plan (plan.column)}
              {@const err = conv?.errors.find((e) => e.column === plan.column)}
              {@const bad = marks.cell(r, plan.column)}
              {@const why = err
                ? `${err.message} (fila ${err.row})`
                : bad
                  ? `${ruleMessage(bad)} (fila ${r + 1})`
                  : undefined}
              <td
                class={cx(
                  "import-grid-cell",
                  plan.target.kind === "skip" && "import-grid-cell-ignored",
                  (err || bad) && "import-grid-cell-error",
                )}
                data-tip={why}
                data-tip-tone={why ? "error" : undefined}
              >
                <!--
                  La columna apagada se queda vacía: su contenido no va
                  a ninguna parte, y dejarlo a la vista --aunque fuera
                  palido-- era seguir leyendo datos que no se guardan.
                -->
                {#if plan.target.kind !== "skip"}
                  {raw[plan.index] || ""}
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  /*
   * La tabla es la del catálogo; aqui solo va lo que la previsualizacion
   * necesita y una tabla de página no: crecer hasta el alto que sobre,
   * desplazarse por dentro con la cabeza fija, encabezados que llevan
   * mandos --y por eso ni versalitas ni mayusculas-- y celdas apretadas
   * para ver mas filas de una vez.
   *
   * El alto sale de fuera: es un hijo flexible de `.import-data-column`.
   */
  .grid-import-preview {
    min-height: 0;
    min-width: 0;
    flex: 1 1 0%;

    & :global(.table-wrap) {
      min-height: 0;
      flex: 1 1 0%;
      overflow: auto;
      padding-top: 0;
    }

    & :global(.table) {
      min-width: 100%;
      width: max-content;
    }

    & :global(.table thead) {
      position: sticky;
      top: 0;
      z-index: 10;
    }

    & :global(.table th) {
      padding: var(--sp-6) var(--sp-8);
      background: var(--bg-level1);
      text-transform: none;
      letter-spacing: normal;
      font-weight: 500;
    }

    & :global(.table td) {
      max-width: 14rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: var(--sp-6) var(--sp-14);
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
    }

    & .import-grid-col-header {
      min-width: 11rem;
    }

    & .import-grid-status-header {
      white-space: nowrap;
    }

    & .import-grid-row-error {
      background: var(--danger-bg);
    }

    /* La fila que pisa una que ya existe, tenida de punta a punta: el
       distintivo de la izquierda dice cual, el fondo dice cuantas. */
    & .import-grid-row-update {
      background: color-mix(in oklab, var(--warning-bg) 30%, transparent);
      color: var(--warning);
    }

    /*
     * La columna apagada se queda: su hueco, vacío y hundido, es lo que dice
     * que sigue ahi para encenderla desde el encabezado --que se queda
     * entero-- sin ensenar ni un dato que no se va a guardar.
     */
    & .import-grid-cell-ignored {
      background: var(--bg-field);
    }

    & .import-grid-cell-error {
      color: var(--danger);
    }

    & .import-grid-empty {
      padding: 2rem 0.75rem;
      text-align: center;
      color: var(--text-muted);
    }

    & .import-grid-status {
      white-space: nowrap;
    }

    & :global(.import-grid-status-badge) {
      gap: var(--sp-4);
      white-space: nowrap;
    }
  }
</style>
