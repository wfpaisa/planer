<!--
  La primera pantalla del asistente: de donde sale el contenido.

  Un archivo que se lee bien no se queda aqui --pasa solo a la
  previsualizacion--, asi que esto es, en la practica, la pantalla de lo que hay
  que escribir o corregir: el CSV pegado a mano y el archivo que no se pudo
  leer, con su motivo debajo.

  Lo que se lee y como queda emparejado vive en `lib/importWizard.svelte.ts`;
  aqui solo esta lo que se ve.
-->
<script lang="ts">
  import { cx } from "../../../lib/cx";
  import { MAX_IMPORT_ROWS } from "../../../lib/importParse";
  import type { ImportWizard } from "../../../lib/importWizard.svelte";
  import { SHEET_ACCEPT } from "../../../lib/sheet";
  import Icon from "../../Icon.svelte";
  import { Button, Modal, Note, Textarea } from "../../ui";

  /**
   * Ejemplo que sale en el campo de pegar texto. Los saltos de linea son reales:
   * un atributo normal de Svelte no los escribe.
   */
  const EJEMPLO_CSV = `nombre,correo,ingreso
Ana,ana@example.com,2024-03-01
Bruno,bruno@example.com,2023-11-15`;

  let {
    wizard,
    label,
    onClose,
  }: {
    wizard: ImportWizard;
    /** El nombre de la tabla que recibe la importacion, para el titulo. */
    label: string;
    onClose: () => void;
  } = $props();
</script>

<Modal
  id="import-modal"
  class="modal-import-data"
  open
  {onClose}
  width="modal-import-content-width"
  title={`Importar en ${label}`}
  description="CSV, Excel o JSON. Arrastra un archivo o pega el contenido."
>
  <!--
    Las dos formas de traer el contenido, una cada vez. Lo que escriben es el
    mismo `text`, asi que cambiar de pestana no pierde lo que ya hay: lo leido
    de un archivo sigue estando al pasar a pegar texto.
  -->
  <div role="tablist" class="tabs-import-source tab-list w-full">
    <button
      type="button"
      role="tab"
      aria-selected={wizard.source === "archivo"}
      class={cx("btn-tab-import-file", "tab", wizard.source === "archivo" && "active")}
      onclick={() => (wizard.source = "archivo")}
    >
      <Icon name="upload-01" size={16} /> Importar archivo
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={wizard.source === "texto"}
      class={cx("btn-tab-import-text", "tab", wizard.source === "texto" && "active")}
      onclick={() => (wizard.source = "texto")}
    >
      <Icon name="csv-02" size={16} /> Pegar CSV
    </button>
  </div>

  <div class="import-field">
    {#if wizard.source === "archivo"}
      <!--
        Sin estado "cargado": un archivo que entra bien ya no se queda aqui
        --se abre la previsualizacion-- asi que lo unico que queda por
        ensenar es el que no se puede importar, en rojo y con su motivo
        debajo.
      -->
      <label
        class={cx("csv-dropzone", "import-dropzone dropzone", wizard.fileRejected && "rejected")}
        ondragover={(e) => e.preventDefault()}
        ondrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer?.files?.[0];
          if (file) void wizard.readFile(file);
        }}
      >
        <Icon
          name={wizard.fileRejected ? "alert-circle" : "upload-01"}
          size={wizard.fileRejected ? 22 : 18}
          class="import-dropzone-icon"
        />
        {#if wizard.fileRejected}
          <span class="import-dropzone-file dropzone-lead">{wizard.fileName}</span>
          <span class="import-dropzone-text">Suelta otro archivo o haz clic para cambiarlo</span>
        {:else}
          <span class="import-dropzone-text">
            Arrastra un archivo CSV, Excel o JSON, o haz clic para elegirlo
          </span>
        {/if}
        <input
          type="file"
          accept={`.csv,.json,text/csv,application/json,${SHEET_ACCEPT}`}
          class="input-import-file dropzone-input"
          onchange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file) void wizard.readFile(file);
          }}
        />
      </label>
    {:else}
      <Textarea bind:value={wizard.text} placeholder={EJEMPLO_CSV} class="import-textarea" />
    {/if}
  </div>

  <!--
    El separador se elige en la previsualizacion, que es donde se ve si era el
    que no era: aqui todavia no hay columnas que mirar.
  -->
  {#if wizard.parsed.ok && !wizard.tooMany}
    <div class="import-field import-count-row">
      <span class="import-count-text">
        {wizard.parsed.data.rows.length} filas, {wizard.parsed.data.columns.length} columnas
      </span>
    </div>
  {/if}

  <div class="import-field">
    <!--
      Lo que paso al leer el archivo --no se pudo abrir, tenia varias hojas--
      va antes que lo que se ve en el contenido: si el archivo no entro bien,
      lo demas es consecuencia.

      Con la pantalla todavia vacia no se dice nada: "pega un texto o arrastra
      un archivo" era un aviso en rojo por abrir el dialogo, y eso es
      exactamente lo que la pantalla esta pidiendo ya. Pero si lo que no trae
      nada es un archivo que SI se solto, hay que decirlo: la zona de arrastre
      se queda en rojo --el archivo no pasa a la previsualizacion-- y sin este
      renglon no diria por que.
    -->
    <Note
      kind={wizard.notice?.kind ?? "error"}
      message={wizard.notice?.text ||
        (!wizard.text.trim()
          ? wizard.fileName
            ? "El archivo no trae nada dentro."
            : ""
          : !wizard.parsed.ok
            ? wizard.parsed.error
            : wizard.tooMany
              ? `El archivo tiene ${wizard.parsed.data.rows.length} filas; el máximo es ${MAX_IMPORT_ROWS}.`
              : "")}
    />
  </div>

  {#snippet footer()}
    <Button onclick={onClose}>Cancelar</Button>
    <Button
      variant="secondary"
      disabled={!wizard.parsed.ok || wizard.tooMany}
      onclick={() => (wizard.stage = "preview")}
    >
      Previsualizar
    </Button>
  {/snippet}
</Modal>

<style>
  /*
   * Medida fija, un 40% por encima de las 32rem del modal corriente: aqui se
   * mira contenido tabular --el ejemplo con sus columnas, las lineas del CSV
   * pegado-- y con el ancho corto cada fila se partia en dos.
   */
  :global(.modal-import-content-width) {
    width: 44.8rem;
    max-width: 100%;
  }

  /*
   * El hueco es `.dropzone` del catalogo, con sus dos estados finales:
   * `loaded` (leido) y `rejected` (leido pero no importable). Aqui solo lo
   * que este pide de mas: la linea de abajo, que es la instruccion mientras
   * no hay archivo y baja de tono en cuanto lo hay --entonces lo que se lee
   * primero es el nombre, que es `.dropzone-lead`--.
   */
  .import-dropzone {
    & .import-dropzone-text {
      font-size: var(--text-sm);
      line-height: var(--text-sm--line-height);
      color: var(--text-secondary);
    }

    &.rejected .import-dropzone-text {
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-muted);
    }

    /* El icono lo dibuja `Icon`: sale del ambito de la etiqueta. */
    & :global(.import-dropzone-icon) {
      color: inherit;
    }

    &.rejected :global(.import-dropzone-icon) {
      color: var(--danger);
    }
  }

  .import-field {
    margin-top: var(--sp-12);
  }

  :global(.import-textarea) {
    min-height: 11rem;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
  }

  .import-count-row {
    & .import-count-text {
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-muted);
    }
  }
</style>
