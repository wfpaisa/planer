<!--
  Traer servidores de IA de un archivo exportado.

  Se pega o se arrastra el JSON que sale de "Exportar"; antes de aplicar se
  muestran los servidores que van a entrar, los que ya estaban y los que un
  reemplazo se lleva por delante.

  Nada se guarda aqui: lo importado entra en el formulario de `AiForm`, que es
  donde se revisa --y donde se escriben las claves, que el archivo no trae--
  antes de pulsar Guardar.
-->
<script lang="ts">
  import { AI_PROVIDER_LABEL, aiProviderName } from "@shared/aiCatalog";
  import type { AiConfigView, AiProviderView } from "@shared/types";
  import { untrack } from "svelte";

  import {
    type AiImportMode,
    type AiImportPlan,
    parseAiConfigFile,
    planAiImport,
  } from "../../lib/aiConfigFile";
  import Icon from "../Icon.svelte";
  import Toast, { type ToastKind } from "../Toast.svelte";
  import { Button, Field, Modal, Note, Select, Tag, Textarea } from "../ui";

  let {
    current,
    onClose,
    onApply,
  }: {
    current: AiConfigView;
    onClose: () => void;
    /** Lo importado, para que la pantalla lo ponga en el formulario. */
    onApply: (plan: AiImportPlan) => void;
  } = $props();

  let text = $state("");
  /*
   * Con algo conectado se agrega, que es lo que no rompe nada. Sin nada que
   * conservar se restaura entero: es lo que se quiere al llegar a un panel
   * recien puesto, y ademas trae los dos interruptores --entre ellos el que
   * enciende la IA, que agregar no toca y dejaria todo apagado--.
   */
  let mode = $state<AiImportMode>(untrack(() => (current.providers.length ? "add" : "replace")));

  const parsed = $derived(parseAiConfigFile(text));
  const plan = $derived(parsed.ok ? planAiImport(parsed.file, current, mode) : null);

  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  const models = (provider: AiProviderView) =>
    provider.models.length
      ? count(provider.models.length, "modelo", "modelos")
      : "sin ningún modelo";

  /**
   * Lo que se cuenta debajo, con su tono. Que un reemplazo se lleve servidores
   * no es un fallo --es lo que se pidio, dicho antes de hacerlo-- y en rojo se
   * leia como si algo se hubiera roto.
   */
  const note = $derived<{ kind: ToastKind; text: string } | null>(
    !text.trim()
      ? null
      : !parsed.ok
        ? { kind: "error", text: parsed.error }
        : plan?.removed.length
          ? {
              kind: "warning",
              text: `${count(plan.removed.length, "servidor que ya estaba se va", "servidores que ya estaban se van")} con su clave al guardar.`,
            }
          : plan && !plan.added.length
            ? { kind: "warning", text: "Todos los servidores del archivo ya estaban aquí." }
            : null,
  );
</script>

<Modal
  id="ai-import-modal"
  class="modal-import-ai"
  open
  {onClose}
  title="Importar servidores de inteligencia artificial"
  description="Pega o arrastra el JSON de una configuración exportada. Las claves no viajan en el archivo: hay que escribirlas después."
>
  <label
    class="dropzone-ai-config drop-filter dropzone"
    ondragover={(e) => e.preventDefault()}
    ondrop={(e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) void file.text().then((content) => (text = content));
    }}
  >
    <Icon name="upload-01" size={18} class="drop-filter-icon" />
    <span class="drop-filter-text">Arrastra un archivo JSON, o haz clic para elegirlo</span>
    <input
      type="file"
      accept=".json,application/json"
      class="input-drop-filter dropzone-input"
      onchange={(e) => {
        const file = e.currentTarget.files?.[0];
        if (file) void file.text().then((content) => (text = content));
      }}
    />
  </label>

  <div class="import-ai-field">
    <Textarea
      bind:value={text}
      placeholder={'{"formato":"plane-servidores-ia","servidores":[…]}'}
      class="import-ai-textarea"
    />
  </div>

  <div class="import-ai-field">
    <Field
      label="Modo"
      hint={mode === "add"
        ? "Los que ya estén aquí se quedan como están."
        : "Se restaura la sección entera: los servidores, el modelo por defecto y los dos interruptores."}
    >
      <Select bind:value={mode}>
        <option value="add">Agregar los servidores que faltan</option>
        <option value="replace">Reemplazar toda la configuración</option>
      </Select>
    </Field>
  </div>

  {#if plan}
    <div class="list-import-ai inset">
      <p class="list-import-ai-title eyebrow">
        {plan.added.length
          ? `${count(plan.added.length, "servidor entra", "servidores entran")}`
          : "No entra ningún servidor"}
      </p>

      {#each plan.added as provider (provider.id)}
        <div class="row-import-ai">
          <Icon name="robotic" size={14} class="icon-import-ai" />
          <span class="name-import-ai">{aiProviderName(provider)}</span>
          <Tag tone="tint-3">{AI_PROVIDER_LABEL[provider.provider]}</Tag>
          <span class="detail-import-ai">{models(provider)}</span>
          {#if !provider.enabled}
            <span class="detail-import-ai">apagado</span>
          {/if}
        </div>
      {/each}

      {#each plan.skipped as provider (provider.id)}
        <div class="row-import-ai row-import-ai-skipped">
          <Icon name="robotic" size={14} class="icon-import-ai" />
          <span class="name-import-ai">{aiProviderName(provider)}</span>
          <span class="detail-import-ai">ya estaba</span>
        </div>
      {/each}

      {#if parsed.ok && parsed.invalid.length}
        <Toast kind="error" duration={0}>
          <p class="title-import-ai-invalid">
            {count(
              parsed.invalid.length,
              "servidor no se puede traer",
              "servidores no se pueden traer",
            )}
          </p>
          <ul class="list-import-ai-invalid">
            {#each parsed.invalid as inv (inv.index)}
              <li>Servidor {inv.index + 1}: {inv.message}</li>
            {/each}
          </ul>
        </Toast>
      {/if}
    </div>
  {/if}

  <div class="import-ai-field">
    <Note kind={note?.kind ?? "error"} message={note?.text ?? ""} />
  </div>

  {#snippet footer()}
    <p class="foot-import-ai">Se aplica al formulario; nada cambia hasta que guardes.</p>
    <Button buttonClass="btn-cancel-import-ai" onclick={onClose}>Cancelar</Button>
    <Button
      variant="secondary"
      buttonClass="btn-apply-import-ai"
      disabled={!plan || (!plan.added.length && mode === "add")}
      onclick={() => {
        if (plan) onApply(plan);
      }}
    >
      {mode === "replace" ? "Reemplazar" : "Agregar"}
    </Button>
  {/snippet}
</Modal>

<style>
  /* El hueco es `.dropzone` del catalogo; aqui solo lo que este pide de mas:
     el respiro, mas corto porque debajo va el textarea con lo mismo escrito a
     mano, y la letra de la instruccion. */
  .drop-filter {
    padding: var(--sp-20) var(--sp-16);

    & .drop-filter-text {
      font-size: var(--text-sm);
      line-height: var(--text-sm--line-height);
      color: var(--text-secondary);
    }
  }

  .import-ai-field {
    margin-top: var(--sp-12);
  }

  :global(.import-ai-textarea) {
    min-height: 8rem;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
  }

  /* La caja es `.inset` del catalogo: lo que se lista dentro del modal se
     hunde, no se levanta. Aqui solo su hueco y su tope de alto. */
  .list-import-ai {
    margin-top: var(--sp-12);
    max-height: 16rem;
    overflow-y: auto;
    padding: var(--sp-8);

    /* El rotulo es `.eyebrow` del catalogo; aqui solo su hueco. */
    & .list-import-ai-title {
      padding: var(--sp-4) var(--sp-6) var(--sp-6);
    }

    & .row-import-ai {
      display: flex;
      align-items: center;
      gap: var(--sp-8);
      border-radius: var(--radius-sm);
      padding: var(--sp-4) var(--sp-6);
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-primary);

      &:hover {
        background: var(--bg-level2);
      }

      /* El que no entra se lee, pero no compite con los que si. */
      &.row-import-ai-skipped {
        opacity: 0.6;
      }

      & :global(.icon-import-ai) {
        flex-shrink: 0;
        color: var(--text-muted);
      }

      & .name-import-ai {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      & .detail-import-ai {
        color: var(--text-muted);
      }
    }

    & .title-import-ai-invalid {
      font-weight: 500;
    }

    & .list-import-ai-invalid {
      margin-top: var(--sp-4);

      & li {
        margin-bottom: 0.125rem;
      }
    }
  }

  /* La nota del pie se queda a la izquierda; las acciones las empuja
     `.modal-foot` a la derecha. */
  .foot-import-ai {
    margin-right: auto;
    max-width: 22rem;
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-muted);
  }
</style>
