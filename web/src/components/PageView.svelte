<!--
  Una pagina dibujada por su HTML.

  Ocupa todo el espacio que le dan y vive dentro del marco aislado. Lo que
  rodea a la pagina --el sidebar y la barra-- se dibuja fuera, para que el
  peor HTML posible solo se rompa a si mismo.
-->
<script lang="ts">
  import type { AppPerson, PageRecord, PickedBlock } from "@shared/types";
  import type PocketBase from "pocketbase";

  import type { DocLoader } from "../lib/htmlDocs";
  import HtmlFrame from "./HtmlFrame.svelte";
  import { WarnNote } from "./ui";

  let {
    page,
    appId,
    client,
    loadDoc,
    roles,
    previewRole,
    previewPerson,
    previewAnon = false,
    previewNoRole = false,
    themeKey,
    showIssues = false,
    picking = false,
    onPick,
    onPickerOff,
  }: {
    page: PageRecord;
    /** Aplicacion a la que pertenece: la pagina pide sus datos al servidor por ella. */
    appId: string;
    client: PocketBase;
    /** De donde sale el HTML de esta pagina. Cambia segun quien mire. */
    loadDoc: DocLoader;
    /** Roles de quien esta mirando, para que la pagina sepa a quien tiene delante. */
    roles?: string[];
    /** Ver la pagina como la veria este rol. Solo para el dueno de la aplicacion. */
    previewRole?: string;
    /**
     * Y como la veria esta persona concreta, de entre las que tienen ese rol.
     * Entera, no solo su identificador: el documento tambien la necesita para
     * saber a quien tiene delante. Ver `HtmlFrame`.
     */
    previewPerson?: AppPerson | null;
    /** O como la veria alguien que llega sin cuenta. */
    previewAnon?: boolean;
    /** O como la veria alguien que entro y no tiene ningun rol de la aplicacion. */
    previewNoRole?: boolean;
    /** Cambia con la paleta de la aplicacion, para repintar la pagina. */
    themeKey?: string;
    /** Contar lo que el documento hace mal. Solo para quien construye. */
    showIssues?: boolean;
    /** El cursor de seleccion esta encendido. Solo para quien construye. */
    picking?: boolean;
    /** Se senalo un elemento del documento. */
    onPick?: (block: PickedBlock) => void;
    /** El documento salio del cursor con escape. */
    onPickerOff?: () => void;
  } = $props();

  let savesToBrowser = $state(false);
  /** Vacio: la pagina nunca intento salir. `stuck`: se quedo quieta. */
  let leaves = $state<"" | "tried" | "stuck">("");
</script>

<div id="view-page" class="view-page h-full">
  <HtmlFrame
    fill
    doc={page.doc}
    sources={page.sources}
    {themeKey}
    {appId}
    pageId={page.id}
    {previewRole}
    {previewPerson}
    {previewAnon}
    {previewNoRole}
    {client}
    {loadDoc}
    title={page.name}
    {roles}
    onStorage={() => (savesToBrowser = true)}
    onNavigate={({ stuck }) => (leaves = stuck ? "stuck" : leaves || "tried")}
    {picking}
    {onPick}
    {onPickerOff}
  />

  {#if showIssues && savesToBrowser}
    <WarnNote>
      Esta pagina guarda datos en el navegador, y aqui dentro ese almacenamiento es de mentira: se
      pierde al salir. Guarda lo que tenga que durar en una tabla.
    </WarnNote>
  {/if}
  {#if showIssues && leaves}
    <WarnNote>
      {leaves === "stuck"
        ? "Esta página se va a otra dirección cada vez que se carga, seguramente por tener su propio inicio de sesión. La sesión, las personas y los roles ya los pone Planer."
        : "Esta página intentó ir a otra dirección. Se la devolvió a su sitio: la navegación la dibuja Planer alrededor."}
    </WarnNote>
  {/if}
</div>

<style>
  .view-page {
    position: relative;
  }
</style>
