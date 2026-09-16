<!--
  Una version en la lista de cambios.

  Dos senales que no compiten: el filo verde dice cual es la publicada --una
  propiedad de la fila, siempre ahi-- y el fondo con la pastilla dicen cual se
  esta mirando, que va y viene. Una fila puede ser las dos cosas.
-->
<script lang="ts" module>
  /** Cuando se guardo, en corto: nadie necesita el ano de una version de ayer. */
  const when = (value: string) =>
    new Date(value).toLocaleString("es", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
</script>

<script lang="ts">
  import type { AppVersionSummary } from "@shared/types";

  import { cx } from "../lib/cx";
  import Icon from "./Icon.svelte";
  import { Input, Tag } from "./ui";
  import WatchingBadge from "./WatchingBadge.svelte";

  let {
    version,
    busy,
    watching,
    onPreview,
    onRestore,
    onRemove,
    onRename,
    onPin,
  }: {
    version: AppVersionSummary;
    busy: boolean;
    /** Es la que se esta mirando ahora mismo en la vista previa. */
    watching: boolean;
    onPreview: () => void;
    onRestore: () => void;
    onRemove: () => void;
    onRename: (label: string) => void;
    onPin: () => void;
  } = $props();

  let confirming = $state(false);
</script>

<div
  class={cx(
    "row-version",
    version.live ? "row-version-live" : "row-version-not-live",
    watching && "row-version-watching",
    busy && "row-version-busy",
  )}
>
  <div class="head-version">
    <span class="number-version">#{version.number}</span>

    <Input
      value={version.label}
      placeholder={version.kind === "publish" ? "Publicación" : "Punto de guardado"}
      onblur={(e) => e.currentTarget.value !== version.label && onRename(e.currentTarget.value)}
      onkeydown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      class="name-version-input"
    />

    {#if version.live}
      <Tag
        tone="tag-success"
        class="live-version-badge shrink-0"
        tip="Es la que ve la gente en el enlace público"
      >
        En vivo
      </Tag>
    {/if}

    {#if watching}<WatchingBadge />{/if}

    <!-- Guarda paginas de bloques: se puede mirar, no volver a ella. -->
    {#if version.legacy}
      <Tag tone="tint-3" class="legacy-version-badge shrink-0">Solo lectura</Tag>
    {/if}

    <button
      type="button"
      onclick={onPin}
      data-tip={version.pinned ? "Dejar de fijar" : "Fijar para que no se borre sola"}
      aria-label="Fijar"
      class={cx("btn-pin-version", version.pinned ? "btn-pin-version-on" : "btn-pin-version-off")}
    >
      <Icon name="pin" size={14} />
    </button>
    <button
      type="button"
      onclick={onPreview}
      data-tip={watching ? "Ya la estas mirando" : "Previsualizar"}
      aria-label="Previsualizar"
      aria-pressed={watching}
      class={cx(
        "btn-preview-version",
        watching ? "btn-preview-version-on" : "btn-preview-version-off",
      )}
    >
      <Icon name="eye" size={14} />
    </button>
    <!--
      Apagado con `aria-disabled` y no con `disabled`: el globo explica por que
      no se puede, y un boton deshabilitado de verdad no recibe al raton ni al
      teclado, asi que la explicacion no llegaria nunca.
    -->
    <button
      type="button"
      onclick={() => !version.legacy && onRestore()}
      aria-disabled={version.legacy || undefined}
      data-tip={version.legacy
        ? "Esta versión guarda páginas de bloques: se puede mirar, pero no volver a ella"
        : "Volver a esta versión"}
      aria-label="Volver a esta versión"
      class={cx(
        "btn-restore-version",
        version.legacy ? "btn-restore-version-disabled" : "btn-restore-version-enabled",
      )}
    >
      <Icon name="rotate-ccw" size={14} />
    </button>
    <button
      type="button"
      onclick={() => {
        if (version.live) return;
        if (confirming) onRemove();
        else confirming = true;
      }}
      onblur={() => (confirming = false)}
      data-tip={version.live ? "La versión publicada no se puede borrar" : "Eliminar"}
      aria-label="Eliminar"
      aria-disabled={version.live || undefined}
      class={cx(
        "btn-remove-version",
        version.live ? "btn-remove-version-disabled" : "btn-remove-version-active",
        confirming && "btn-remove-version-confirming",
      )}
    >
      <Icon name="trash" size={14} />
    </button>
  </div>

  <p class="meta-version">
    {version.kind === "publish" ? "Publicada" : "Guardada"} el {when(version.created)} por
    {version.authorName}
    {#if confirming && !version.live}
      <span class="confirm-version">Toca otra vez para borrarla.</span>
    {/if}
  </p>
</div>

<style>
  .row-version {
    padding: var(--sp-10) var(--sp-12);
    border-left-width: 2px;

    /* Solo el filo izquierdo: `border-success` a secas tenia el color de la
       linea que separa las filas. */
    & .head-version {
      display: flex;
      align-items: center;
      gap: var(--sp-8);

      & .number-version {
        width: 2rem;
        flex-shrink: 0;
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
        font-variant-numeric: tabular-nums;
        color: var(--text-muted);
      }

      & :global(.name-version-input) {
        min-width: 0;
        flex: 1;
      }

      & .btn-pin-version,
      & .btn-preview-version,
      & .btn-restore-version,
      & .btn-remove-version {
        flex-shrink: 0;
        padding: var(--sp-4);
        border-radius: calc(var(--radius-sm) / 2);
      }

      & .btn-pin-version-on,
      & .btn-preview-version-on {
        color: var(--accent-soft-text);
      }

      & .btn-pin-version-off,
      & .btn-preview-version-off {
        color: var(--text-muted);

        &:hover {
          color: var(--text-secondary);
        }
      }

      & .btn-restore-version,
      & .btn-remove-version {
        color: var(--text-muted);
      }

      & .btn-restore-version-enabled {
        &:hover {
          color: var(--text-primary);
        }
      }

      & .btn-restore-version-disabled {
        opacity: 0.4;
      }

      & .btn-remove-version-active {
        &:hover {
          color: var(--danger);
        }
      }

      & .btn-remove-version-disabled {
        opacity: 0.4;
      }

      & .btn-remove-version-confirming {
        color: var(--danger);
      }
    }

    & .meta-version {
      margin-top: var(--sp-4);
      padding-left: 2rem;
      font-size: var(--text-xs);
      line-height: var(--text-xs--line-height);
      color: var(--text-muted);

      & .confirm-version {
        margin-left: var(--sp-8);
        color: var(--danger);
      }
    }
  }

  .row-version-live {
    border-left-color: var(--success);
  }

  /* Las dos pastillas las dibuja `Tag`: sus clases salen del ambito de aqui. */
  :global(.live-version-badge) {
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
  }

  :global(.legacy-version-badge) {
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-muted);
  }

  .row-version-not-live {
    border-left-color: transparent;
  }

  .row-version-watching {
    background: var(--bg-field);
  }

  .row-version-busy {
    opacity: 0.6;
  }
</style>
