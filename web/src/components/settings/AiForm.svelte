<!--
  Los servidores de IA conectados, sus modelos y lo que se usa por defecto.

  A la izquierda estan los servidores y a la derecha el que se este mirando.
  Es la única forma en la que caben varios sin que la pantalla se vuelva una
  lista infinita de formularios abiertos a la vez.

  Todo se guarda de una vez, con el botón del pie: mientras tanto lo escrito
  vive aqui, y por eso se puede probar la conexion de algo que todavía no se
  ha guardado.
-->
<script lang="ts" module>
  /** Como se nombra una eleccion en el desplegable de lo que va por defecto. */
  const choiceValue = (providerId: string, modelId: string) => `${providerId} ${modelId}`;

  const newId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
</script>

<script lang="ts">
  import {
    aiModelLabel,
    aiNewProvider,
    aiProviderName,
    aiThinkingHint,
    aiThinkingLabel,
    aiThinkingLevels,
    aiThinkingRank,
  } from "@shared/aiCatalog";
  import {
    AI_THINKING_DEFAULT,
    AI_THINKING_OFF,
    type AiConfigView,
    type AiProvider,
    type AiProviderView,
  } from "@shared/types";
  import { untrack } from "svelte";

  import { AI_CONFIG_FILE, aiConfigToJson, type AiImportPlan } from "../../lib/aiConfigFile";
  import { api, errorMessage } from "../../lib/pb";
  import { downloadFile } from "../../lib/tableExport";
  import Icon from "../Icon.svelte";
  import SettingsSection from "../SettingsSection.svelte";
  import type { ToastKind } from "../Toast.svelte";
  import { Button, Field, Input, Note, Select, Switch } from "../ui";
  import AiImportModal from "./AiImportModal.svelte";
  import ProviderDetail from "./ProviderDetail.svelte";
  import ProviderRail from "./ProviderRail.svelte";

  let { initial }: { initial: AiConfigView } = $props();

  // Lo cargado es el punto de partida; a partir de aqui manda lo escrito aqui,
  // hasta que guardar traiga de vuelta lo que quedo en el servidor.
  let config = $state<AiConfigView>(untrack(() => initial));
  /** Las claves escritas en esta visita. Las guardadas no vuelven nunca. */
  let keys = $state<Record<string, string>>({});
  let openId = $state(untrack(() => initial.providers[0]?.id ?? ""));
  let busy = $state(false);
  let saved = $state(false);
  let importing = $state(false);
  /**
   * Lo que se cuenta de esta pantalla, con su tono. Era un aviso por tono --uno
   * rojo y otro verde-- y solo se enseña uno a la vez; juntarlos evita que un
   * "falta el nombre tecnico", que es lo que hay que hacer antes de guardar,
   * saliera del lado de lo que se rompio.
   */
  let notice = $state<{ kind: ToastKind; text: string } | null>(null);
  const say = (kind: ToastKind, text: string) => (notice = { kind, text });
  const fail = (err: unknown) => say("error", errorMessage(err));
  const hush = () => (notice = null);

  const open = $derived(
    config.providers.find((p) => p.id === openId) ?? config.providers[0] ?? null,
  );

  /* Solo se puede dejar por defecto un modelo al que se pueda llamar. */
  const usable = $derived(config.providers.filter((p) => p.enabled && p.models.length > 0));

  /*
   * Los niveles del modelo que este puesto por defecto. Si el elegido ya no
   * esta entre ellos se muestra igual, para que se vea que hay que cambiarlo.
   */
  const defaultLevels = $derived.by(() => {
    const chosen = usable
      .find((p) => p.id === config.fallback.provider)
      ?.models.find((m) => m.id === config.fallback.model);
    return [
      ...new Set([
        ...(chosen ? aiThinkingLevels(chosen) : AI_THINKING_DEFAULT),
        config.fallback.thinking,
      ]),
    ].sort((a, b) => aiThinkingRank(a) - aiThinkingRank(b));
  });

  const set = (patch: Partial<AiConfigView>) => {
    config = { ...config, ...patch };
  };

  const setProvider = (id: string, patch: Partial<AiProviderView>) =>
    set({ providers: config.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  function addProvider(kind: AiProvider): void {
    const next: AiProviderView = { ...aiNewProvider(kind, newId()), hasKey: false };
    config = {
      ...config,
      providers: [...config.providers, next],
      // El primero que se conecta es también el que se va a usar: no hay nada
      // mas entre lo que elegir.
      fallback: config.fallback.model
        ? config.fallback
        : {
            provider: next.id,
            model: next.models[0]?.id ?? "",
            thinking: config.fallback.thinking,
          },
    };
    openId = next.id;
    hush();
  }

  function removeProvider(id: string): void {
    const rest = config.providers.filter((p) => p.id !== id);
    set({ providers: rest });
    if (openId === id) openId = rest[0]?.id ?? "";
  }

  /** Lo que se le manda al servidor para hablar con un proveedor sin guardarlo. */
  const wireProvider = (provider: AiProviderView) => ({
    ...provider,
    apiKey: keys[provider.id] ?? "",
  });

  /**
   * Se lleva lo que hay delante, no lo ultimo guardado: en esta pantalla lo
   * escrito vive aqui hasta que se guarda, y exportar otra cosa daria un
   * archivo que no se parece a lo que se esta viendo.
   *
   * Las claves no van dentro. No hace falta quitarlas: nunca llegaron al
   * panel, que solo recibe si cada servidor tiene una. Ver `aiConfigFile.ts`.
   */
  function exportConfig(): void {
    hush();
    downloadFile(AI_CONFIG_FILE, aiConfigToJson(config), "application/json");
  }

  /**
   * Lo importado entra en el formulario, no en el servidor: asi se revisa --y
   * se escriben las claves que falten-- antes de que nada cambie.
   */
  function applyImport(plan: AiImportPlan): void {
    config = plan.next;
    // Las claves escritas y todavía sin guardar siguen siendo suyas mientras su
    // servidor siga estando; las de los que se fueron no valen para nadie.
    const alive = new Set(plan.next.providers.map((p) => p.id));
    keys = Object.fromEntries(Object.entries(keys).filter(([id]) => alive.has(id)));
    openId = plan.added[0]?.id ?? plan.next.providers[0]?.id ?? "";
    importing = false;

    const missing = plan.added.filter((p) => !p.hasKey).length;
    const entered =
      plan.added.length === 1 ? "Entró 1 servidor" : `Entraron ${plan.added.length} servidores`;
    const gone = plan.removed.length
      ? plan.removed.length === 1
        ? " y se quitó 1 de los que estaban"
        : ` y se quitaron ${plan.removed.length} de los que estaban`
      : "";
    const keysNote = missing
      ? missing === 1
        ? " Falta escribir 1 clave."
        : ` Faltan ${missing} claves por escribir.`
      : "";
    say("warning", `${entered}${gone}.${keysNote} Pulsa Guardar para que quede.`);
  }

  async function save(): Promise<void> {
    const blank = config.providers.find((p) => p.models.some((m) => !m.id.trim()));
    if (blank) {
      openId = blank.id;
      say("warning", "Hay un modelo sin nombre técnico. Escríbelo o quítalo antes de guardar.");
      return;
    }
    busy = true;
    hush();
    try {
      const next = await api<AiConfigView>("/api/ai/config", {
        method: "PUT",
        body: JSON.stringify({ ...config, providers: config.providers.map(wireProvider) }),
      });
      config = next;
      keys = {};
      saved = true;
      setTimeout(() => (saved = false), 2500);
    } catch (err) {
      fail(err);
    } finally {
      busy = false;
    }
  }

  async function check(provider: AiProviderView, modelId: string): Promise<void> {
    hush();
    try {
      await api("/api/ai/check", {
        method: "POST",
        body: JSON.stringify({ provider: wireProvider(provider), model: modelId }),
      });
      say("success", `La conexión con ${aiProviderName(provider)} funciona.`);
    } catch (err) {
      fail(err);
    }
  }
</script>

{#snippet icon()}
  <Icon name="robotic" />
{/snippet}

{#snippet footer()}
  <!-- Llevarse los servidores y traerlos se quedan a la izquierda: no son la
       accion de la pantalla, que es guardar, y esa manda en el extremo. -->
  <div class="group-ai-config-files">
    <Button
      buttonClass="btn-open-import-ai-config"
      tip="Traer servidores de un archivo exportado"
      onclick={() => (importing = true)}
    >
      <Icon name="upload-01" size={14} />
      Importar servidores
    </Button>
    <Button
      buttonClass="btn-export-ai-config"
      tip="Descargar esta configuración como JSON. Las claves no salen en el archivo"
      disabled={!config.providers.length}
      onclick={exportConfig}
    >
      <Icon name="download-01" size={14} />
      Exportar servidores
    </Button>
  </div>
  <Button variant="secondary" loading={busy} onclick={() => void save()}>
    {#if saved}
      <Icon name="check" size={18} />
    {/if}
    Guardar
  </Button>
{/snippet}

<SettingsSection
  id="ai-settings-provider-section"
  {icon}
  {footer}
  title="Servidores de inteligencia artificial"
  description="Conecta servidores y configura los modelos disponibles."
  class="section-ai-server"
>
  <div class="row-ai-toggle opt-row">
    <div class="opt-body">
      <p class="opt-label">Activar generación con IA</p>
      <p class="opt-hint">Muestra el panel de IA en el constructor.</p>
    </div>
    <Switch checked={config.enabled} onchange={(v) => set({ enabled: v })} />
  </div>

  <div class="row-ai-toggle opt-row">
    <div class="opt-body">
      <p class="opt-label">Mostrar el contexto enviado al modelo</p>
      <p class="opt-hint">
        Muestra el sistema, las herramientas y los mensajes enviados en cada respuesta.
      </p>
    </div>
    <Switch checked={config.debugButton} onchange={(v) => set({ debugButton: v })} />
  </div>

  <div class="row-ai-toggle opt-row">
    <div class="opt-body">
      <p class="opt-label">Tiempo máximo por petición</p>
      <p class="opt-hint">
        Detiene las peticiones que superen este límite. Usa 0 para no aplicar un límite.
      </p>
    </div>
    <Input
      type="number"
      min={0}
      step={1}
      value={config.runTimeoutMinutes}
      oninput={(e) => set({ runTimeoutMinutes: Number(e.currentTarget.value) })}
      class="input-ai-run-timeout"
    />
  </div>

  <div class="grid-ai-layout grid gap-4">
    <ProviderRail
      providers={config.providers}
      openId={open?.id ?? ""}
      onOpen={(id) => (openId = id)}
      onAdd={addProvider}
    />

    {#if open}
      {@const current = open}
      {#key current.id}
        <ProviderDetail
          provider={current}
          apiKey={keys[current.id] ?? ""}
          onKey={(value) => (keys = { ...keys, [current.id]: value })}
          onChange={(patch) => setProvider(current.id, patch)}
          onRemove={() => removeProvider(current.id)}
          onCheck={(modelId) => check(current, modelId)}
          wire={() => wireProvider(current)}
        />
      {/key}
    {:else}
      <div
        class="empty-ai-providers inset dashed flex flex-col items-center justify-center gap-2 text-center"
      >
        <Icon name="robotic" size={20} class="icon-ai-empty" />
        <p class="empty-ai-title">No hay servidores conectados.</p>
        <p class="empty-ai-hint">Añade uno desde la lista.</p>
      </div>
    {/if}
  </div>

  <!--
    Selección inicial de cada petición; puede cambiarse desde el chat.
  -->
  <div class="grid-ai-fallback inset plain grid gap-4">
    <Field label="Modelo por defecto" hint="Se usa mientras no elijas otro modelo en el chat.">
      <Select
        value={choiceValue(config.fallback.provider, config.fallback.model)}
        disabled={!usable.length}
        onchange={(e) => {
          const [provider, model] = e.currentTarget.value.split(" ");
          set({ fallback: { ...config.fallback, provider, model } });
        }}
      >
        {#if !usable.length}
          <option value="">No hay modelos disponibles</option>
        {/if}
        {#each usable as provider (provider.id)}
          <optgroup label={aiProviderName(provider)}>
            {#each provider.models as model (model.id)}
              <option value={choiceValue(provider.id, model.id)}>{aiModelLabel(model)}</option>
            {/each}
          </optgroup>
        {/each}
      </Select>
    </Field>

    <!--
      Los niveles son los que ofrece el modelo elegido, no una lista inventada:
      cada servidor tiene los suyos y son los que va a aceptar.
    -->
    <Field label="Cuánto piensa por defecto" hint={aiThinkingHint(config.fallback.thinking)}>
      <Select
        value={config.fallback.thinking}
        onchange={(e) => set({ fallback: { ...config.fallback, thinking: e.currentTarget.value } })}
      >
        {#each defaultLevels as level (level)}
          <option value={level}>{aiThinkingLabel(level)}</option>
        {/each}
      </Select>
    </Field>

    <!--
      Modelo usado para resumir las reglas de la página. Si no se elige uno,
      se usa el modelo de la petición.
    -->
    <Field
      label="Modelo para las memorias de página"
      hint="Resume las reglas de la página al terminar cada petición."
    >
      <Select
        value={config.memoryChoice
          ? choiceValue(config.memoryChoice.provider, config.memoryChoice.model)
          : ""}
        onchange={(e) => {
          const raw = e.currentTarget.value;
          if (!raw) return set({ memoryChoice: null });
          const [provider, model] = raw.split(" ");
          set({
            memoryChoice: {
              provider,
              model,
              thinking: config.memoryChoice?.thinking ?? AI_THINKING_OFF,
            },
          });
        }}
      >
        <option value="">Usar el modelo de la petición</option>
        {#each usable as provider (provider.id)}
          <optgroup label={aiProviderName(provider)}>
            {#each provider.models as model (model.id)}
              <option value={choiceValue(provider.id, model.id)}>{aiModelLabel(model)}</option>
            {/each}
          </optgroup>
        {/each}
      </Select>
    </Field>
  </div>

  <Note kind={notice?.kind ?? "error"} message={notice?.text ?? ""} />
</SettingsSection>

{#if importing}
  <AiImportModal current={config} onClose={() => (importing = false)} onApply={applyImport} />
{/if}

<style>
  /* Las tres filas son `.opt-row` del catálogo, con `.opt-label` y
     `.opt-hint`: aqui no queda nada propio que decir de esa parte. */
  :global(.input-ai-run-timeout) {
    width: 5rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  /* El `card-foot` empuja todo a la derecha; el auto devuelve este par al
     lado contrario y deja Guardar solo en el extremo. */
  .group-ai-config-files {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-8);
    margin-right: auto;
  }

  .grid-ai-layout {
    @media (min-width: 40rem) {
      grid-template-columns: 11rem 1fr;
    }

    /* El hueco es `.inset.dashed`; aqui solo su respiro, que es el de una
       columna vacía y no el de una caja de contenido. */
    & .empty-ai-providers {
      padding: var(--sp-40) var(--sp-16);

      & :global(.icon-ai-empty) {
        color: var(--text-muted);
      }

      & .empty-ai-title {
        font-size: var(--text-sm);
        line-height: var(--text-sm--line-height);
        color: var(--text-secondary);
      }

      & .empty-ai-hint {
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        color: var(--text-muted);
      }
    }
  }

  /* La caja es `.inset.plain` --el cerco sin fondo, que ya lo pone la card
     de la sección--; aqui solo el reparto en dos columnas. */
  .grid-ai-fallback {
    padding: var(--sp-14);

    @media (min-width: 40rem) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
