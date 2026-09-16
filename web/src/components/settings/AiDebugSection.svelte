<!--
  La limpieza del registro de depuracion de la IA.

  Cada peticion deja guardado lo que se le mando al modelo --el contexto lleva
  el HTML entero de la pagina-- y eso se conserva hasta que alguien lo borre.
  Una fila por pagina, sobrescrita, asi que no crece con el uso; lo que se
  borra aqui es todo lo de la instalacion, no lo de una aplicacion.
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
  <p class="foot-settings-note">
    Las conversaciones y las páginas no se tocan: solo se va lo guardado para depurar.
  </p>
  <Button variant="danger" buttonClass="btn-clear-ai-debug" onclick={() => (asking = true)}>
    <Icon name="trash" size={14} /> Borrar registros
  </Button>
{/snippet}

<SettingsSection
  id="ajustes-depuracion-ia"
  {icon}
  {footer}
  title="Registros de depuración"
  description="Cada petición a la inteligencia artificial deja guardado lo que se le mandó al modelo, para poder entender después una que salió mal."
  class="section-ai-debug"
>
  <p class="text-ai-debug-section">
    Se guarda uno por página —el de su última petición— y cada petición nueva reemplaza al anterior.
    Borrarlos alcanza a toda la instalación, no a una sola aplicación.
  </p>
  <SuccessNote message={done} />
  <ErrorNote message={failed} />
</SettingsSection>

<ConfirmDialog
  open={asking}
  onClose={() => (asking = false)}
  title="Borrar los registros de depuración"
  message="Se borran los registros de depuración de todas las aplicaciones de esta instalación. Las conversaciones con la inteligencia artificial y las páginas se quedan como están."
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
