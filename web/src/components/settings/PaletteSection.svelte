<!--
  La paleta con la que se ve el panel, de esta cuenta.

  Elegir la pinta ya en todo el panel, para verla puesta; guardar la deja en
  la cuenta. Salir de los ajustes sin guardar vuelve a la que había. Las
  aplicaciones no cambian: cada una tiene su paleta en sus propios ajustes.
-->
<script lang="ts">
  import type { AppTheme } from "@shared/types";

  import { panelPalette } from "../../lib/panelPalette.svelte";
  import { errorMessage } from "../../lib/pb";
  import Icon from "../Icon.svelte";
  import PalettePicker from "../PalettePicker.svelte";
  import SettingsSection from "../SettingsSection.svelte";
  import { Button, ErrorNote } from "../ui";

  let pending = $state<AppTheme>(panelPalette.value);
  let busy = $state(false);
  let error = $state("");

  const same = (a: AppTheme, b: AppTheme) => a.palette === b.palette && a.color === b.color;
  const dirty = $derived(!same(pending, panelPalette.value));

  $effect(() => {
    panelPalette.preview(dirty ? pending : null);
  });

  // Lo probado y no guardado no sobrevive a irse de la pestaña.
  $effect(() => () => panelPalette.preview(null));

  async function save() {
    busy = true;
    error = "";
    try {
      await panelPalette.save(pending);
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

{#snippet icon()}
  <Icon name="paint-board" />
{/snippet}

{#snippet footer()}
  <p class="foot-settings-note">Se guarda en tu cuenta: la verás igual en cualquier navegador.</p>
  <Button
    buttonClass="btn-discard-panel-palette"
    disabled={!dirty || busy}
    onclick={() => (pending = panelPalette.value)}
  >
    Descartar
  </Button>
  <Button
    variant="secondary"
    buttonClass="btn-save-panel-palette"
    loading={busy}
    disabled={!dirty}
    onclick={() => void save()}
  >
    Guardar
  </Button>
{/snippet}

<SettingsSection
  id="ajustes-paleta"
  {icon}
  {footer}
  title="Paleta de colores"
  description="El color del panel para tu cuenta. Las aplicaciones conservan la suya."
  class="section-panel-palette"
>
  <ErrorNote message={error} />
  <PalettePicker value={pending} onChange={(next) => (pending = next)} />
</SettingsSection>
