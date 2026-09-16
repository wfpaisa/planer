<!--
  La prueba de dibujado que pide la IA.

  El servidor no tiene navegador. Cuando la IA quiere saber si la pagina que
  acaba de escribir se dibuja sin errores, manda la huella del documento y esto
  lo monta en un marco escondido, deja que corra un momento, recoge lo que la
  consola solto y lo devuelve.

  El marco es el mismo de siempre, con su puente y sus colores: lo que se ve
  aqui es lo que veria quien abriera la pagina. Con una diferencia a proposito
  --el ensayo-- para que una pagina que guarda algo al cargarse no deje ese
  rastro solo por haberla probado.

  Escondido, no ausente: un marco con `display:none` no dibuja, no mide y no
  corre lo que dependa de estar visible. Se aparta de la vista sin sacarlo del
  flujo, para que el documento se ejecute como si alguien lo estuviera mirando.
-->
<script lang="ts" module>
  /**
   * Lo que se deja correr al documento despues de que el puente diga que esta.
   *
   * Lo que se rompe al dibujar salta casi siempre en el mismo instante, pero lo
   * que espera datos tarda lo que tarde la primera consulta. Dos segundos
   * cubren eso sin que la IA se quede esperando de mas.
   */
  const GRACE_MS = 2000;

  /** Tope duro: un documento que nunca dice estar listo no puede colgar la prueba. */
  const MAX_WAIT_MS = 12_000;

  export interface ProbeRequest {
    probeId: string;
    /** Huella del documento a dibujar. */
    hash: string;
  }
</script>

<script lang="ts">
  import type { HtmlSource, PageIssue } from "@shared/types";
  import type PocketBase from "pocketbase";
  import { untrack } from "svelte";

  import type { DocLoader } from "../lib/htmlDocs";
  import HtmlFrame from "./HtmlFrame.svelte";

  let {
    request,
    appId,
    pageId,
    sources,
    client,
    loadDoc,
    onDone,
  }: {
    /** La prueba que hay que hacer. Sin ella no se monta nada. */
    request: ProbeRequest | null;
    appId: string;
    pageId: string;
    /** Las fuentes que declara la pagina, para que las lecturas funcionen. */
    sources?: HtmlSource[];
    client: PocketBase;
    loadDoc: DocLoader;
    onDone: (report: { probeId: string; issues: PageIssue[]; warnings: string[] }) => void;
  } = $props();

  let issues: PageIssue[] = [];
  let warnings: string[] = [];
  /** Ya se contesto esta prueba: lo que llegue despues se ignora. */
  let sent = "";
  /** Se retira el marco en cuanto se contesta, para no dejarlo corriendo. */
  let mounted = $state(false);
  let grace: ReturnType<typeof setTimeout> | undefined;

  function finish(probeId: string) {
    if (sent === probeId) return;
    sent = probeId;
    clearTimeout(grace);
    mounted = false;
    untrack(() => onDone)({ probeId, issues, warnings });
  }

  $effect(() => {
    const asked = request;
    if (!asked) return;
    issues = [];
    warnings = [];
    mounted = true;

    // El tope corre desde el principio: si el documento nunca llega a estar
    // listo, la prueba se cierra igual con lo que se haya recogido.
    const hard = setTimeout(() => finish(asked.probeId), MAX_WAIT_MS);
    return () => {
      clearTimeout(hard);
      clearTimeout(grace);
    };
  });

  /* El puente ya esta en pie: se le da su rato de gracia y se cierra. */
  function onReady() {
    const asked = request;
    if (!asked) return;
    clearTimeout(grace);
    grace = setTimeout(() => finish(asked.probeId), GRACE_MS);
  }

  function onIssue(issue: PageIssue | { tipo: "aviso"; mensaje: string }) {
    if (issue.tipo === "aviso") {
      if (warnings.length < 20) warnings.push(issue.mensaje);
      return;
    }
    if (issues.length < 50) issues.push(issue);
  }
</script>

{#if request && mounted}
  <!--
    Fuera de la vista pero dibujandose: el documento corre igual que si alguien
    lo tuviera delante.
  -->
  <div
    aria-hidden="true"
    style="position: fixed; left: -10000px; top: 0; width: 1200px; height: 800px; pointer-events: none; opacity: 0;"
  >
    {#key request.probeId}
      <HtmlFrame
        doc={request.hash}
        {sources}
        {appId}
        {pageId}
        {client}
        {loadDoc}
        title="Prueba de la página"
        fill
        dryRun
        {onIssue}
        {onReady}
      />
    {/key}
  </div>
{/if}
