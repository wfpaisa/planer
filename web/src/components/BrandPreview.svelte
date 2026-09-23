<!--
  La misma pantalla en los dos fondos, una al lado de la otra. Es la única forma
  honesta de ensenar la paleta: lo que se dibuja aqui pasa por `palettes.css`
  y el puente de `compat.css` igual que lo hara en la aplicación publicada.
-->
<script lang="ts">
  import type { AppTheme } from "@shared/types";

  import { paletteAttrs } from "../lib/appTheme";
  import Icon from "./Icon.svelte";

  let { theme }: { theme: AppTheme } = $props();

  const cards = [
    { mode: "light", label: "Fondo claro" },
    { mode: "dark", label: "Fondo oscuro" },
  ] as const;
</script>

<div class="preview-brand grid gap-3">
  {#each cards as card (card.mode)}
    <div data-theme={card.mode} class="preview-brand-card inset" {...paletteAttrs(theme)}>
      <p class="preview-brand-tag eyebrow">{card.label}</p>

      <!--
        Una pantalla en pequeno, con los trabajos del color: la banda de
        marca (relleno, tinta derivada), el titular, el botón y el enlace.
      -->
      <div class="preview-brand-screen card card-solid">
        <div class="preview-brand-band">
          <Icon name="sidebar-left" size={16} />
          <span class="preview-brand-name">Mi aplicación</span>
        </div>
        <div class="preview-brand-body">
          <p class="preview-brand-title">Clientes del mes</p>
          <p class="preview-brand-note">Texto de muestra para comprobar el contraste.</p>
          <div class="preview-brand-actions">
            <button type="button" class="btn btn-primary sm">Guardar</button>
            <button type="button" class="btn sm">Cancelar</button>
            <a href="#brand" class="preview-brand-link">Un enlace</a>
          </div>
        </div>
      </div>
    </div>
  {/each}
</div>

<style>
  .preview-brand {
    grid-template-columns: 1fr;

    @media (min-width: 40rem) {
      grid-template-columns: 1fr 1fr;
    }

    /* Las dos cajas son del catálogo: la de fuera `.inset` --el papel sobre
       el que se posa la muestra-- y la de dentro `.card.card-solid`, que es
       la pantalla en pequeno. Cada una lleva su `data-theme`, asi que las dos
       tienen que reponer su fondo: una variable se resuelve donde se declara,
       pero el fondo lo pinta quien lo dibuja. */
    & .preview-brand-card {
      padding: var(--sp-16);

      /* El rotulo es `.eyebrow` del catálogo; aqui solo su hueco. */
      & .preview-brand-tag {
        margin-bottom: var(--sp-12);
      }

      & .preview-brand-screen {
        overflow: hidden;

        & .preview-brand-band {
          display: flex;
          align-items: center;
          gap: var(--sp-8);
          background: var(--accent);
          padding: var(--sp-8) var(--sp-12);
          color: var(--accent-text);

          & .preview-brand-name {
            font-size: var(--text-sm);
            line-height: var(--text-sm--line-height);
            font-weight: 600;
          }
        }

        & .preview-brand-body {
          display: flex;
          flex-direction: column;
          gap: var(--sp-8);
          padding: var(--sp-12);

          & .preview-brand-title {
            font-size: var(--text-sm);
            line-height: var(--text-sm--line-height);
            font-weight: 600;
            color: var(--accent-soft-text);
          }

          & .preview-brand-note {
            font-size: var(--text-xs);
            line-height: var(--text-xs--line-height);
            color: var(--text-secondary);
          }

          & .preview-brand-actions {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: var(--sp-8);
            padding-top: var(--sp-4);

            & .preview-brand-link {
              font-size: var(--text-sm);
              line-height: var(--text-sm--line-height);
              color: var(--accent-soft-text);
              text-decoration-line: underline;
              text-underline-offset: 2px;

              &:hover {
                text-decoration-line: underline;
              }
            }
          }
        }
      }
    }
  }
</style>
