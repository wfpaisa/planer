<!--
  Llevarse una aplicación: duplicarla, guardarla en un archivo `.planer` o
  traer una desde otro Planer.

  Vive en los ajustes de la cuenta y no en los de cada aplicación porque las
  tres miran a la lista entera y no a una sola: importar llega sin ninguna
  abierta, y quien duplica suele venir a comparar cuál copia. Aqui se elige
  sobre cuál se trabaja y se hace todo desde el mismo sitio.

  El interruptor de los datos manda sobre duplicar y sobre exportar por igual:
  es la misma decision --si viaja lo que hay dentro de las tablas o solo las
  tablas-- y preguntarla dos veces seria preguntar dos veces lo mismo.

  Por dentro las tres son el mismo camino: ver `server/appTransfer.ts`.
-->
<script lang="ts">
  import type { TransferResult } from "@shared/transfer";
  import type { AppRecord } from "@shared/types";

  import {
    duplicateApp,
    exportApp,
    importApp,
    PLANER_ACCEPT,
    transferSummary,
  } from "../../lib/appTransfer";
  import { errorMessage, pb } from "../../lib/pb";
  import { navigate } from "../../lib/router.svelte";
  import { useAsync } from "../../lib/useAsync.svelte";
  import Icon from "../Icon.svelte";
  import SettingsSection from "../SettingsSection.svelte";
  import { Button, ErrorNote, Field, Loading, Select, Switch } from "../ui";
  import DuplicateAppModal from "./DuplicateAppModal.svelte";
  import ImportAppModal from "./ImportAppModal.svelte";

  const apps = useAsync(() => pb.collection("apps").getFullList<AppRecord>({ sort: "-updated" }));

  /** Cual de las tres esta en marcha. Vacío: ninguna. */
  let busy = $state<"" | "duplicar" | "exportar" | "importar">("");
  let datos = $state(true);
  let error = $state("");
  let done = $state<TransferResult | null>(null);

  let chosenId = $state("");
  let picker = $state<HTMLInputElement | null>(null);
  let naming = $state(false);
  let arriving = $state<File | null>(null);

  const list = $derived(apps.data ?? []);
  const chosen = $derived(list.find((app) => app.id === chosenId));

  /*
   * La primera de la lista queda elegida en cuanto llega --viene por fecha,
   * asi que es la de ultima hora-- y se escribe en `chosenId` en vez de
   * resolverse al vuelo por dos razones. Una: el `<select>` con un valor que
   * no es ninguna de sus opciones se dibuja vacio. Otra: despues de duplicar,
   * la copia pasa a ser la mas reciente, y una eleccion al vuelo saltaria sola
   * a ella. Tambien repone si la elegida ya no esta.
   */
  $effect(() => {
    if (list.length > 0 && !list.some((app) => app.id === chosenId)) chosenId = list[0].id;
  });

  /** Corre una de las tres, dejando el aviso de antes fuera de la pantalla. */
  async function run(what: "duplicar" | "exportar" | "importar", job: () => Promise<unknown>) {
    busy = what;
    error = "";
    done = null;
    try {
      const result = await job();
      // Exportar no crea nada: lo que devuelve es el archivo, no una
      // aplicación, y no hay ningún resumen que enseñar.
      done = (result as TransferResult | undefined)?.appId ? (result as TransferResult) : null;
      // La copia y la importada son aplicaciones nuevas: la lista de arriba se
      // queda corta si no se vuelve a pedir.
      if (done) void apps.reload();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = "";
    }
  }

  /** Hace la copia con el nombre que se acaba de escribir. */
  async function duplicate(nombre: string) {
    if (!chosen) return;
    await run("duplicar", () => duplicateApp(chosen.id, { datos, nombre }));
    // El modal se queda abierto si fallo, para poder corregir el nombre sin
    // volver a escribirlo entero.
    if (!error) naming = false;
  }

  /**
   * El archivo primero y el nombre despues.
   *
   * Se pregunta en ese orden porque elegir el archivo es lo que decide si hay
   * algo que importar: preguntar el nombre antes seria pedirle un nombre a una
   * aplicación que todavía no se sabe si va a llegar.
   */
  function pick(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    // El valor se suelta siempre: sin esto, elegir dos veces el mismo archivo
    // no vuelve a disparar el evento y parece que no pasa nada.
    input.value = "";
    if (!file) return;
    error = "";
    arriving = file;
  }

  async function bringIn(nombre: string) {
    const file = arriving;
    if (!file) return;
    await run("importar", () => importApp(file, nombre));
    if (!error) arriving = null;
  }
</script>

{#snippet icon()}
  <Icon name="package-moving" />
{/snippet}

{#snippet footer()}
  <p class="foot-settings-note">
    El archivo es un <code>.planer</code>
    : dentro va todo lo que la aplicación es.
  </p>
  <Button
    buttonClass="btn-duplicate-app"
    loading={busy === "duplicar"}
    disabled={!!busy || !chosen}
    onclick={() => {
      error = "";
      naming = true;
    }}
  >
    <Icon name="copy-01" size={14} /> Duplicar
  </Button>
  <Button
    buttonClass="btn-export-app"
    loading={busy === "exportar"}
    disabled={!!busy || !chosen}
    onclick={() => chosen && void run("exportar", () => exportApp(chosen, { datos }))}
  >
    <Icon name="download-01" size={14} /> Exportar
  </Button>
  <Button
    variant="secondary"
    buttonClass="btn-import-app"
    loading={busy === "importar"}
    disabled={!!busy}
    onclick={() => picker?.click()}
  >
    <Icon name="upload-01" size={14} /> Importar
  </Button>
{/snippet}

<SettingsSection
  id="ajustes-traslados"
  {icon}
  {footer}
  title="Copias y traslados"
  description="Duplica una aplicación, guárdala en un archivo para llevártela a otro servidor, o trae una de vuelta."
  class="section-app-transfer"
>
  <ErrorNote message={apps.error} />
  <ErrorNote message={error} />

  {#if apps.loading && !apps.data}
    <Loading label="Cargando aplicaciones" />
  {:else}
    {#if list.length === 0}
      <p class="empty-transfer">
        Todavía no hay ninguna aplicación que duplicar o guardar. Importar sí funciona: es la forma
        de traer la primera.
      </p>
    {:else}
      <Field label="Aplicación" hint="Sobre la que trabajan Duplicar y Exportar.">
        <Select bind:value={chosenId} class="select-transfer-app" disabled={!!busy}>
          {#each list as app (app.id)}
            <option value={app.id}>{app.name} — /{app.slug}</option>
          {/each}
        </Select>
      </Field>
    {/if}

    <Switch bind:checked={datos} label="Llevar también los datos" />
    <p class="transfer-hint">
      Las filas de cada tabla y los archivos adjuntos. Sin marcar sale sólo la estructura: las
      mismas tablas y las mismas pantallas, vacías.
    </p>

    <p class="transfer-hint">
      Las personas invitadas no viajan nunca: su cuenta es de esa aplicación y de ninguna otra. Lo
      que cada fila decía de ellas sí se conserva, a la vista y sin enlace.
    </p>
  {/if}

  <!-- El selector de verdad: se abre desde el botón del pie, que es el que
       lleva el vestido del sistema. -->
  <input
    bind:this={picker}
    class="input-planer-file"
    type="file"
    accept={PLANER_ACCEPT}
    onchange={pick}
    hidden
  />

  {#if done}
    <div class="transfer-result inset flex flex-col gap-2">
      <p class="transfer-summary">{transferSummary(done)}</p>
      {#if done.avisos.length}
        <ul class="transfer-warnings">
          {#each done.avisos as aviso, i (i)}
            <li>{aviso}</li>
          {/each}
        </ul>
      {/if}
      <div class="transfer-result-actions flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          buttonClass="btn-open-transferred-app"
          onclick={() => navigate(`/a/${done?.appId}/app`)}
        >
          Abrir
        </Button>
      </div>
    </div>
  {/if}
</SettingsSection>

{#if chosen}
  <DuplicateAppModal
    open={naming}
    name={chosen.name}
    {datos}
    busy={busy === "duplicar"}
    onClose={() => (naming = false)}
    onConfirm={(nombre) => void duplicate(nombre)}
  />
{/if}

<ImportAppModal
  open={!!arriving}
  file={arriving}
  busy={busy === "importar"}
  onClose={() => (arriving = null)}
  onConfirm={(nombre) => void bringIn(nombre)}
/>

<style>
  .transfer-hint,
  .empty-transfer {
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--text-muted);
  }

  .transfer-summary {
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
    color: var(--text-primary);
  }

  /* Lo que no se pudo traer tal cual. Va en tono de aviso y no de error: la
     aplicación entro, y esto es lo que hay que ir a mirar. */
  .transfer-warnings {
    margin: 0;
    padding-left: var(--sp-16);
    list-style: disc;
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    color: var(--warning);

    & li + li {
      margin-top: var(--sp-4);
    }
  }
</style>
