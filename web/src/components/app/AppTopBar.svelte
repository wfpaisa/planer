<!--
  El encabezado del constructor.

  Es la fila de siempre, de vuelta arriba y a lo ancho de la ventana: a la
  izquierda la salida al panel y la identidad de la aplicacion --su icono, su
  nombre, que se cambia escribiendo encima, y sus ajustes--; en el centro las
  dos mitades de la aplicacion, la que se ve y la que se guarda; a la derecha lo
  que mira hacia afuera: los ajustes y publicar.

  Publicar solo acompana a las paginas. En la mitad de los datos el boton no
  esta: lo que se toca ahi --las filas-- ya esta afuera en cuanto se guarda, y
  un boton que dice "Publicada" al lado hace pensar que hay que pulsarlo para
  que los datos salgan.

  Quien entra no tiene boton aqui: las personas y sus roles son una tabla mas,
  la primera de "Base de datos, Personas y roles", y se gestionan desde ella.

  Lo de la pagina abierta no esta aqui: eso vive en el sidebar, y su enlace
  publico se copia desde la barra de direccion. Cada panel se abre en su
  tarjeta, centrada y con el documento desenfocado detras.

  Aqui no vive el boton de la IA: ese bajo a la barra de direccion, donde tiene
  sentido junto al enlace que la IA ayuda a construir.
-->
<script lang="ts" module>
  /** Las dos mitades de una aplicacion: lo que se ve y lo que se guarda. */
  export type Section = "app" | "datos";
</script>

<script lang="ts">
  import type { AppRecord } from "@shared/types";

  import { cx } from "../../lib/cx";
  import { closePublish, publishCard, togglePublish } from "../../lib/publishPanel.svelte";
  import Icon from "../Icon.svelte";
  import PanelModal from "../PanelModal.svelte";
  import Button from "../ui/Button.svelte";
  import AppIcon from "./AppIcon.svelte";
  import AppName from "./AppName.svelte";
  import PublishButton from "./PublishButton.svelte";
  import PublishPanel from "./PublishPanel.svelte";

  let {
    app,
    section,
    onGo,
    onBack,
    onOpenSettings,
    onChanged,
  }: {
    app: AppRecord;
    /** En cual de las dos mitades se esta. */
    section: Section;
    onGo: (section: Section) => void;
    onBack: () => void;
    /** Abre los ajustes de la aplicacion. */
    onOpenSettings: () => void;
    onChanged: () => Promise<void> | void;
  } = $props();

  /*
   * La tarjeta de publicar se dibuja aqui, pero su estado vive fuera (ver
   * `lib/publishPanel.svelte.ts`): tambien la abre el candado de la barra de
   * direccion, que esta en otra rama del arbol.
   */

  // Si se cambia de mitad con la tarjeta abierta --el historial del navegador
  // puede hacerlo sin tocar la fila-- se cierra sola: publicar no vive en la
  // mitad de los datos. Y al entrar en otra aplicacion tambien, que lo abierto
  // era de la anterior y el estado no se desmonta con el encabezado.
  let lastApp = "";
  $effect(() => {
    if (section !== "app" || app.id !== lastApp) closePublish();
    lastApp = app.id;
  });
</script>

<header id="builder-topbar" class="topbar-builder flex items-center gap-2">
  <!--
    Los tres grupos se reparten la fila: los dos de los lados piden el mismo
    ancho (`flex-1 basis-0`), asi que el del medio cae justo en el centro de la
    ventana. A proposito ninguno lleva `min-w-0`: asi ningun grupo puede quedar
    mas estrecho que lo que hay dentro. En una ventana muy pequena el del medio
    se corre de su sitio, que es un centro perdido, en vez de que un boton acabe
    dibujado encima de otro.
  -->
  <div class="topbar-group-left">
    <!--
      El `aria-label` no sobra aunque se lea "Aplicaciones": ese texto se
      esconde en ventanas estrechas y el boton se queda en una flecha muda.
    -->
    <Button
      size="sm"
      onclick={onBack}
      aria-label="Volver a tus aplicaciones"
      buttonClass="btn-back-to-apps"
      class="btn-ghost topbar-back-btn"
    >
      <Icon name="arrow-left-01" size={16} />
      <span class="topbar-back-apps">Aplicaciones</span>
    </Button>

    <span aria-hidden="true" class="topbar-divider"></span>

    <!--
      El icono, el nombre y los ajustes son una sola cosa --la identidad de la
      aplicacion-- y se dibujan pegados. Tocarle al icono abre los ajustes: la
      marca es la pista mas visible de que se puede entrar a afinarla.
    -->
    <AppIcon
      {app}
      onclick={onOpenSettings}
      tip="Ajustes de la aplicación"
      ariaLabel="Ajustes de la aplicación"
    />

    <AppName {app} {onChanged} />
  </div>

  <!--
    Las dos mitades de la aplicacion, en el centro y a la misma altura: ninguna
    manda sobre la otra. En ventanas estrechas los nombres se van y quedan los
    dos iconos; el nombre no se pierde, pasa al globo de ayuda.
  -->

  <div role="tablist" class="tabs-app-data tab-list fit">
    <button
      type="button"
      role="tab"
      data-tip="Aplicación"
      aria-selected={section === "app"}
      onclick={() => onGo("app")}
      class={cx("btn-tab-app-section", "tab", "topbar-tab", section === "app" && "active")}
    >
      <Icon name="sidebar-left" size={16} />
      <span class="tab-app-label">Páginas</span>
    </button>
    <button
      type="button"
      role="tab"
      data-tip="Base de datos, Personas y roles"
      aria-selected={section === "datos"}
      onclick={() => onGo("datos")}
      class={cx("btn-tab-data-section", "tab", "topbar-tab", section === "datos" && "active")}
    >
      <Icon name="database-01" size={16} />
      <span class="tab-data-label">Base de datos, Personas y roles</span>
    </button>
  </div>
  <!--
    A la derecha, lo que mira hacia afuera. Publicar cierra la fila porque es el
    final del camino: se construye y se publica, y por eso solo esta mientras se
    construye --en las paginas--. En los datos se guarda y ya esta afuera.
  -->
  <div class="topbar-group-right">
    <Button
      size="sm"
      tip="Ajustes de la aplicación"
      aria-label="Ajustes de la aplicación"
      tipSide="bottom"
      buttonClass="btn-open-settings"
      class="btn-ghost btn-icon topbar-settings-btn"
      onclick={onOpenSettings}
    >
      <Icon name="settings-01" size={16} />
    </Button>

    {#if section === "app"}
      <span aria-hidden="true" class="topbar-divider"></span>

      <PublishButton active={publishCard.open} onclick={togglePublish} />
    {/if}
  </div>
</header>

<PanelModal open={publishCard.open} onClose={closePublish} height="34rem">
  <PublishPanel onClose={closePublish} />
</PanelModal>

<style>
  .topbar-builder {
    height: 3rem;
    padding: 0 var(--sp-10);
    margin: 0;
    overflow-x: clip;
    border-bottom: var(--border-width) solid var(--border);
    background: var(--bg-level2);
    position: sticky;
    top: 0;

    & .topbar-group-left,
    & .topbar-group-right {
      display: flex;
      flex: 1 1 0%;
      align-items: center;
      gap: var(--sp-4);
    }

    & .topbar-group-right {
      justify-content: flex-end;
    }

    & .topbar-divider {
      margin: 0 var(--sp-4);
      height: 1.25rem;
      width: 1px;
      flex-shrink: 0;
      background: var(--border);
    }

    /* Los botones de los lados llegan al Button (un componente). */
    & :global(.topbar-back-btn) {
      flex-shrink: 0;
      gap: var(--sp-6);
      padding: 0 var(--sp-8);
      color: var(--text-secondary);
    }

    & :global(.topbar-settings-btn) {
      flex-shrink: 0;
      color: var(--text-secondary);
    }

    & :global(.topbar-back-apps) {
      display: none;

      @media (min-width: 64rem) {
        display: inline;
      }
    }
  }
</style>
