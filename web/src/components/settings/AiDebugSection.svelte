<!--
  Cada página conserva el contexto de su última petición. La limpieza elimina
  estos registros de toda la instalación, no las páginas ni los chats.
-->
<script lang="ts">
  import { del, errorMessage } from "../../lib/pb";
  import Icon from "../Icon.svelte";
  import SettingsSection from "../SettingsSection.svelte";
  import { Button, ConfirmDialog, ErrorNote, SuccessNote } from "../ui";

  let asking = $state(false);
  let busy = $state(false);
  let done = $state("");
  let failed = $state("");

  async function clear(): Promise<void> {
    busy = true;
    failed = "";
    try {
      const result = await del<{ removed: number }>("/api/ai/depuracion");
      done =
        result.removed === 1
          ? "Se borró el registro de 1 página."
          : `Se borraron los registros de ${result.removed} páginas.`;
      asking = false;
    } catch (err) {
      failed = errorMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

{#snippet icon()}
  <Icon name="code-xml" />
{/snippet}

{#snippet footer()}
  <p class="foot-settings-note">Las conversaciones y las páginas no se eliminarán.</p>
  <Button variant="danger" buttonClass="btn-clear-ai-debug" onclick={() => (asking = true)}>
    <Icon name="trash" size={14} /> Borrar registros
  </Button>
{/snippet}

<SettingsSection
  id="ajustes-depuracion-ia"
  {icon}
  {footer}
  title="Registros de depuración"
  description="Consulta y elimina los datos técnicos guardados para diagnosticar problemas de IA."
  class="section-ai-debug"
>
  <p class="text-ai-debug-section">
    Solo se conserva la petición más reciente de cada página. Al borrar los registros, se eliminan
    los de todas las aplicaciones.
  </p>
  <SuccessNote message={done} />
  <ErrorNote message={failed} />
</SettingsSection>

<ConfirmDialog
  open={asking}
  onClose={() => (asking = false)}
  title="¿Borrar todos los registros de depuración?"
  message="Se borrarán los registros de todas las aplicaciones. Las conversaciones y las páginas no cambiarán."
  confirmLabel="Borrar registros"
  {busy}
  onConfirm={() => void clear()}
/>

<style>
  .text-ai-debug-section {
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
    color: var(--text-secondary);
  }
</style>
