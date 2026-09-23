<!--
  Permite elegir y borrar aplicaciones. El resultado queda visible en esta sección.
-->
<script lang="ts">
  import Icon from "../Icon.svelte";
  import SettingsSection from "../SettingsSection.svelte";
  import { Button, SuccessNote } from "../ui";
  import CleanAppsModal from "./CleanAppsModal.svelte";

  let cleaning = $state(false);
  let done = $state("");

  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
</script>

{#snippet icon()}
  <Icon name="delete-02" />
{/snippet}

{#snippet footer()}
  <p class="foot-settings-note">
    Los ajustes se conservan: el servidor de IA, sus claves y el tamaño de letra siguen igual.
  </p>
  <Button variant="danger" buttonClass="btn-open-clean-apps" onclick={() => (cleaning = true)}>
    <Icon name="trash" size={14} /> Limpiar aplicaciones
  </Button>
{/snippet}

<SettingsSection
  id="ajustes-limpiar"
  {icon}
  {footer}
  title="Limpiar aplicaciones"
  description="Borra aplicaciones con sus tablas, páginas y datos."
  class="section-clean-apps"
>
  <p class="text-clean-section">
    Selecciona las aplicaciones y escribe la confirmación. Esta acción no se puede deshacer.
  </p>
  <SuccessNote message={done} />
</SettingsSection>

<CleanAppsModal
  open={cleaning}
  onClose={() => (cleaning = false)}
  onCleaned={(result) => {
    done = `Se eliminaron ${count(result.apps, "aplicación", "aplicaciones")} y ${count(result.tables, "tabla", "tablas")} con sus datos.`;
  }}
/>

<style>
  .text-clean-section {
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
    color: var(--text-secondary);
  }
</style>
