<!-- Un servidor abierto: sus datos, su clave y sus modelos. -->
<script lang="ts">
  import {
    AI_PROVIDER_BASE,
    AI_PROVIDER_HINT,
    AI_PROVIDER_LABEL,
    aiHasCatalog,
    aiProviderName,
  } from "@shared/aiCatalog";
  import type { AiModel, AiProviderView } from "@shared/types";

  import Icon from "../Icon.svelte";
  import { Button, ConfirmDialog, Field, Input, Switch, Tag } from "../ui";
  import AddModel from "./AddModel.svelte";
  import ModelRow from "./ModelRow.svelte";

  let {
    provider,
    apiKey,
    onKey,
    onChange,
    onRemove,
    onCheck,
    wire,
  }: {
    provider: AiProviderView;
    apiKey: string;
    onKey: (value: string) => void;
    onChange: (patch: Partial<AiProviderView>) => void;
    onRemove: () => void;
    onCheck: (modelId: string) => Promise<void>;
    /** El proveedor con su clave, para lo que hay que preguntarle al servidor. */
    wire: () => AiProviderView & { apiKey: string };
  } = $props();

  let checking = $state(false);
  let showKey = $state(false);
  let confirmRemove = $state(false);

  const hint = $derived(AI_PROVIDER_HINT[provider.provider]);

  const setModel = (index: number, patch: Partial<AiModel>) =>
    onChange({ models: provider.models.map((m, i) => (i === index ? { ...m, ...patch } : m)) });

  async function check(): Promise<void> {
    checking = true;
    await onCheck(provider.models[0]?.id ?? "");
    checking = false;
  }
</script>

<div class="card-ai-provider inset plain">
  <div class="head-ai-provider">
    <input
      value={provider.name}
      oninput={(e) => onChange({ name: e.currentTarget.value })}
      placeholder={AI_PROVIDER_LABEL[provider.provider]}
      aria-label="Nombre del servidor"
      name={`ai-provider-name-${provider.id}`}
      autocomplete="off"
      class="input-ai-provider-name"
    />
    <!--
      De que clase es se elige al crearlo y ya no se toca: cambiarla después
      deja el resto de sus datos --clave, modelos, dirección-- pensados para
      otra forma de hablar, y arreglarlo a mano confunde mas de lo que ahorra.
      Quien quiera otra clase crea un servidor nuevo.
    -->
    <Tag tone="tint-1" class="provider-kind-badge">
      {AI_PROVIDER_LABEL[provider.provider]}
    </Tag>
    <Switch
      checked={provider.enabled}
      onchange={(v) => onChange({ enabled: v })}
      label={provider.enabled ? "Servidor activo" : "Servidor inactivo"}
    />
    <Button
      variant="ghost"
      size="sm"
      tip="Eliminar este servidor"
      buttonClass="btn-remove-ai-provider"
      class="btn-icon btn-remove-ai-provider-tone"
      onclick={() => (confirmRemove = true)}
    >
      <Icon name="delete-02" size={15} />
    </Button>
  </div>

  <div class="grid-ai-provider-fields">
    <Field label="Dirección del servidor (URL)" hint={hint.base}>
      <Input
        value={provider.baseUrl}
        oninput={(e) => onChange({ baseUrl: e.currentTarget.value })}
        placeholder={AI_PROVIDER_BASE[provider.provider] || "(oficial)"}
        name={`ai-base-url-${provider.id}`}
        autocomplete="off"
        spellcheck={false}
      />
    </Field>

    <Field
      label="Clave de acceso"
      hint={provider.hasKey && !apiKey
        ? "Ya hay una clave guardada. Escribe otra solo para reemplazarla."
        : hint.key}
    >
      <div class="row-ai-provider-key join">
        <label class="row-ai-provider-key-input field-control">
          <Icon name="lock-password" size={16} class="icon-ai-key" />
          <!--
            Lo escrito ahora se puede mirar; lo guardado no vuelve nunca, asi
            que ahi no hay nada que mostrar. Y "new-password" evita que el
            gestor de contrasenas del navegador rellene este campo y el de al
            lado.
          -->
          <input
            type={showKey ? "text" : "password"}
            autocomplete="new-password"
            name={`ai-api-key-${provider.id}`}
            value={apiKey}
            oninput={(e) => onKey(e.currentTarget.value)}
            placeholder={provider.hasKey ? "Hay una clave guardada" : "Pega aquí la clave"}
            class="input-ai-api-key"
          />
          {#if apiKey}
            <button
              type="button"
              onclick={() => (showKey = !showKey)}
              aria-label={showKey ? "Ocultar la clave" : "Ver la clave"}
              class="btn-toggle-ai-key"
            >
              <Icon name={showKey ? "view-off-slash" : "view"} size={15} />
            </button>
          {/if}
        </label>
        <Button
          class="btn-try-ai-key"
          loading={checking}
          disabled={(!provider.hasKey && !apiKey.trim()) || !provider.models.length}
          onclick={() => void check()}
        >
          Probar conexión
        </Button>
      </div>
    </Field>
  </div>

  <div class="models-ai-provider">
    <span class="models-ai-provider-label eyebrow">Modelos</span>

    {#if provider.models.length === 0}
      <p class="models-ai-provider-empty">
        Añade al menos un modelo para poder usar este servidor.
      </p>
    {/if}

    <div class="list-ai-provider-models">
      <!--
        El nombre se escribe a mano y cambia letra a letra; la posicion es lo
        único estable mientras se edita.
      -->
      {#each provider.models as model, index (index)}
        <ModelRow
          {model}
          catalog={aiHasCatalog(provider.provider)}
          {wire}
          onChange={(patch) => setModel(index, patch)}
          onRemove={() => onChange({ models: provider.models.filter((_, i) => i !== index) })}
        />
      {/each}
    </div>

    <AddModel
      {provider}
      {wire}
      onAdd={(model) => onChange({ models: [...provider.models, model] })}
    />
  </div>

  <ConfirmDialog
    open={confirmRemove}
    onClose={() => (confirmRemove = false)}
    title={`¿Eliminar ${aiProviderName(provider)}?`}
    message="Se eliminarán este servidor, sus modelos y su clave. Las conversaciones existentes se conservarán."
    confirmLabel="Eliminar servidor"
    onConfirm={() => {
      confirmRemove = false;
      onRemove();
    }}
  />
</div>

<style>
  /* La caja es `.inset.plain` del catálogo --el cerco sin fondo, porque
     ya esta dentro de la card de la sección--; aqui solo el acolchado. */
  .card-ai-provider {
    min-width: 0;
    padding: var(--sp-14);

    & .head-ai-provider {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-8);

      /* El botón de quitar vive en `Button`; no debe encogerse. */
      & :global(.btn-remove-ai-provider) {
        flex-shrink: 0;
      }

      /* Quitar es peligroso: el tinte rojo lo dice sin gritar. */
      & :global(.btn-remove-ai-provider-tone) {
        color: var(--danger);

        &:hover {
          background: color-mix(in oklab, var(--danger) 10%, transparent);
        }
      }

      & .input-ai-provider-name {
        min-width: 0;
        flex: 1;
        border: none;
        background: transparent;
        outline: none;
        font-size: var(--text-base);
        line-height: var(--text-base--line-height);
        font-weight: 500;
        color: var(--text-primary);

        &::placeholder {
          color: var(--text-muted);
        }
      }
    }

    & .grid-ai-provider-fields {
      display: grid;
      gap: var(--sp-16);
      margin-top: var(--sp-12);

      @media (min-width: 40rem) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      & .row-ai-provider-key {
        display: flex;
        width: 100%;

        /*
         * La caja es `.field-control` del catálogo, el vestido de un control
         * suelto: la misma medida, el mismo radio y el mismo foco que los
         * campos de al lado. Lo que va dentro --el icono de la llave, lo
         * escrito y el ojo-- se reparte aqui.
         */
        & .row-ai-provider-key-input {
          display: flex;
          align-items: center;
          gap: var(--sp-8);
          flex: 1;
          padding: 0 var(--sp-8) 0 var(--sp-12);
        }

        & :global(.icon-ai-key) {
          flex-shrink: 0;
          opacity: 0.7;
        }

        /* Dentro de la caja, lo escrito va desnudo: la caja ya es el campo, y
           `.field input` del catálogo le ponia un segundo borde dentro. */
        & .input-ai-api-key {
          flex-grow: 1;
          height: auto;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;

          &:focus {
            box-shadow: none;
          }
        }

        & .btn-toggle-ai-key {
          cursor: pointer;
          color: var(--text-muted);
          transition: color 0.15s;

          &:hover {
            color: var(--text-primary);
          }
        }
      }
    }

    & .models-ai-provider {
      margin-top: var(--sp-16);

      /* El rotulo es `.eyebrow` del catálogo; aqui solo su hueco. */
      & .models-ai-provider-label {
        display: block;
        margin-bottom: var(--sp-6);
      }

      & .models-ai-provider-empty {
        margin-bottom: var(--sp-8);
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        color: var(--text-muted);
      }

      & .list-ai-provider-models {
        display: flex;
        flex-direction: column;
        gap: var(--sp-6);
      }
    }
  }
</style>
