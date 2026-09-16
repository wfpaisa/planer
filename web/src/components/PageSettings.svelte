<!--
  Los ajustes de una pagina, pedidos desde los punticos de su linea en el
  sidebar.

  Es el mismo panel de siempre --nombre, icono, quien la ve y el borrado--,
  pedido desde la lista de paginas.

  Lo del HTML --su codigo y sus cambios-- ya no cuelga de aqui: se pide desde
  la barra de direccion, que esta encima de la pagina que tocan. Esta tarjeta
  les sigue poniendo el marco, y por eso se puede abrir directamente en
  cualquiera de ellos; cuando se entra asi, cerrar sale del todo en vez de caer
  en unos ajustes que nadie pidio.
-->
<script lang="ts" module>
  /** Lo que se esta ajustando de la pagina. */
  export type Panel = "page" | "code" | "changes";

  /** Hasta donde crece cada cosa. El codigo pide casi toda la ventana. */
  const SIZE: Record<Panel, { width: string; height: string }> = {
    page: { width: "42rem", height: "34rem" },
    changes: { width: "52rem", height: "34rem" },
    code: { width: "70rem", height: "calc(100vh - 3rem)" },
  };
</script>

<script lang="ts">
  import type { AppRecord, PageRecord } from "@shared/types";
  import { untrack } from "svelte";

  import { preview, setPanelAside } from "../lib/previewPanel.svelte";
  import HistoryPanel from "./HistoryPanel.svelte";
  import PageCodePanel from "./PageCodePanel.svelte";
  import PagePanel from "./PagePanel.svelte";
  import PanelModal from "./PanelModal.svelte";

  let {
    open,
    initial = "page",
    app,
    page,
    pages,
    onClose,
    onChanged,
    onDeleted,
  }: {
    open: boolean;
    /** Con que se abre. Los ajustes, salvo que se pida uno de los del HTML. */
    initial?: Panel;
    app: AppRecord;
    page: PageRecord;
    pages: PageRecord[];
    onClose: () => void;
    onChanged: () => Promise<void> | void;
    onDeleted: () => void;
  } = $props();

  // Con lo que se pidio; `untrack` porque es el valor de partida y lo que venga
  // despues lo recoge el efecto de abajo, solo al abrirse.
  let panel = $state<Panel>(untrack(() => initial));

  // Cada vez que se abre, se empieza por lo que se pidio.
  $effect(() => {
    if (open) panel = initial;
  });

  // Cerrada no hay nada que apartar: dejarlo puesto haria que la cinta
  // ofreciera traer una tarjeta que ya no existe.
  $effect(() => {
    if (!open) setPanelAside(false);
  });

  /*
   * Los cambios abren la vista previa encima del editor, y esta tarjeta se
   * dibuja delante de todo: mientras dure, se aparta para no tapar justo lo que
   * se pidio mirar. Sigue montada, con su lista cargada, y vuelve desde la
   * cinta de la vista previa.
   */
  const hidden = $derived(preview.aside);
  const size = $derived(SIZE[panel]);

  /* Cerrar uno de los del HTML: si se llego por los ajustes se vuelve a ellos,
     y si se pidio derecho desde la barra se sale del todo. */
  const back = () => {
    if (initial === "page") panel = "page";
    else onClose();
  };
</script>

<PanelModal {open} {onClose} width={size.width} height={size.height} {hidden}>
  {#if panel === "page"}
    <PagePanel {app} {page} {pages} {onClose} {onChanged} {onDeleted} />
  {:else if panel === "code"}
    <PageCodePanel appId={app.id} {page} onClose={back} onSaved={() => void onChanged()} />
  {:else}
    <HistoryPanel onClose={back} />
  {/if}
</PanelModal>
