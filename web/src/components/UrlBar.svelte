<!--
  La barra de dirección, como la de un navegador.

  No navega: cuenta. Encima de la página abierta --y solo de ella, que el dock
  de la IA sigue teniendo su columna al lado-- se lee el enlace exacto con el
  que quedará publicada, para no tener que imaginarselo ni abrir "Compartir"
  para verlo. El candado o el globo dicen de un vistazo si hace falta permiso
  para entrar, y las dos acciones de siempre --copiar y abrir en otra pestana--
  estan a mano.

  Se ve como la de Safari, y por las mismas razones: un campo ancho y centrado
  en la fila, sin borde, apenas un tono por encima del fondo; el texto también
  centrado y en la tipografia del sistema, con el nombre de la aplicación en
  negro y el resto del enlace en gris, que es lo que deja leer de un vistazo
  "de quien es esta página". Los dos iconitos no entran en esa cuenta: van
  pegados a los lados del campo, asi que el enlace queda centrado en la fila y
  no corrido por lo que le crece al lado.

  El enlace no se escribe, se lee: el campo entero es el botón de copiar, que
  es lo que casi siempre se viene a hacer. El iconito de copiar vive dentro,
  apagado, y se enciende al pasar por encima --es la pista de que el campo se
  puede tocar--; al copiar, el campo entero se pone verde un momento.

  Mientras la aplicación no este publicada el enlace se ve apagado y lo dice
  con todas sus letras: es lo que sera, todavía no lo que es.

  A la izquierda del campo vive el único botón que trae y esconde el dock de
  la IA. Lleva un halo animado para distinguirse del resto: es la puerta a lo
  que construye la aplicación, no un mando mas, y aqui queda junto al enlace
  que la IA ayuda a armar.

  A la derecha del campo, antes de "Abrir", estan las dos cosas que se le
  hacen al HTML de la página: verlo y volver atras. Estaban enterradas en los
  ajustes de la página, a dos clics del sidebar, y son de las que se piden
  mientras se construye: aqui quedan al lado de lo que tocan.

  Delante de las dos esta con que ojos se mira la página. Lleva el rol escrito
  --no solo un icono-- porque es lo único de la barra que cambia lo que se ve
  debajo, y con que ojos se esta mirando hay que poder leerlo sin abrir nada.
  Con `admin` es un botón mas; con cualquier otro rol se queda marcado, y
  entonces la barra de la vista previa se enciende debajo.

  Traer un HTML de fuera ya no vive aqui ni en ningún botón: se suelta el
  archivo encima del editor y se elige que hacer con el.
-->
<script lang="ts">
  import { ROLE_ICON } from "@shared/people";
  import type { AppRecord, PageRecord } from "@shared/types";
  import type { Snippet } from "svelte";

  import { aiActivity } from "../lib/aiActivity.svelte";
  import type { AiDockState } from "../lib/aiDock.svelte";
  import { cx } from "../lib/cx";
  import Icon from "./Icon.svelte";
  import { Button, Dropdown, MenuItem, MenuSeparator } from "./ui";

  let {
    app,
    page,
    aiReady,
    dock,
    onOpenCode,
    onOpenChanges,
    onOpenAccess,
    previewOptions,
    previewValue,
    previewing,
    onPreviewRole,
  }: {
    app: AppRecord;
    page?: PageRecord;
    /** Si la IA esta configurada. Si no, no se trae su botón. */
    aiReady?: boolean;
    /** Estado del dock de la IA; el botón lo abre y lo cierra. */
    dock?: AiDockState;
    /** El HTML que hay escrito en la página. */
    onOpenCode?: () => void;
    /** Como estaba antes esta página. */
    onOpenChanges?: () => void;
    /**
     * Quien puede entrar en la aplicación. Lo abre el candado: es lo que el
     * candado cuenta, asi que es donde tiene que llevar al pulsarlo.
     *
     * Sin nadie que lo escuche el candado se queda en lo que era --un aviso
     * con su globito-- y no finge ser un botón.
     */
    onOpenAccess?: () => void;
    /**
     * Con quien se puede mirar la página, en el orden en que se ofrece.
     *
     * Llegan ya rotuladas y ya ordenadas en vez de en crudo porque "sin
     * sesión" no es un rol y no tiene nombre que ensenar: quien decide como se
     * llama cada salida, y en que orden van, es quien manda la lista; aqui
     * solo se pintan. `linea` pide la raya de separacion justo encima, que es
     * lo único que la lista puede decir de su propia forma.
     */
    previewOptions?: { value: string; label: string; linea?: boolean }[];
    /** Cual de esas esta puesta ahora mismo. */
    previewValue?: string;
    /** Si lo puesto no es el rol de quien construye: el botón se queda marcado. */
    previewing?: boolean;
    onPreviewRole?: (value: string) => void;
  } = $props();

  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const origin = window.location.origin;
  const base = $derived(`${origin}/p/${app.slug}`);
  const url = $derived(page && !page.isHome ? `${base}/${page.slug}` : base);
  const open = $derived(app.visibility === "public");

  /** El botón de la IA solo esta cuando hay IA y la ventana da para su columna. */
  const showAi = $derived(!!aiReady && !!dock && !dock.tooNarrow);

  /** El desplegable de la vista previa solo esta si alguien escucha lo elegido. */
  const showPreview = $derived(!!onPreviewRole && (previewOptions?.length ?? 0) > 0);
  /** Como se lee lo puesto ahora. Sin rotulo conocido, el valor a secas. */
  const previewLabel = $derived(
    previewOptions?.find((o) => o.value === previewValue)?.label ?? previewValue ?? "",
  );

  /*
   * Lo que dice el globito del candado: primero como esta --que es lo que el
   * icono ya cuenta a medias-- y, si se puede pulsar, a donde lleva.
   */
  const accessState = $derived(open ? "Pública: se alcanza sin cuenta" : "Requiere iniciar sesión");
  const accessTip = $derived(
    onOpenAccess ? `${accessState}. Cambiar quién puede entrar` : accessState,
  );

  const copy = async () => {
    clearTimeout(timer);
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      timer = setTimeout(() => {
        copied = false;
      }, 1500);
    } catch {
      copied = false;
    }
  };
</script>

<!--
  Una de las del HTML: cuadrada, apagada, y su nombre en el globito.

  Si nadie la escucha no se dibuja, que es lo que deja usar la barra también
  donde no hay página que ajustar.
-->
{#snippet action(
  tip: string,
  onclick: (() => void) | undefined,
  buttonClass: string,
  body: Snippet,
)}
  {#if onclick}
    <Button
      size="sm"
      {buttonClass}
      aria-label={tip}
      {tip}
      tipSide="bottom"
      {onclick}
      class="btn-ghost btn-icon action-urlbar"
    >
      {@render body()}
    </Button>
  {/if}
{/snippet}

{#snippet historyIcon()}<Icon name="history" size={18} />{/snippet}
{#snippet codeIcon()}<Icon name="source-code" size={18} />{/snippet}

<!-- Los dos lados piden el mismo ancho (`flex-1 basis-0`), asi que el campo
     cae en el centro de la fila y no se corre segun lo que mida el botón de al
     lado, que es como se lee en Safari. -->
<div id="builder-urlbar" class="bar-address flex shrink-0 items-center gap-2">
  <span
    aria-hidden="true"
    class={cx("side-urlbar-left", showAi ? "side-urlbar-left-with-ai" : "side-urlbar-left-empty")}
  >
    {#if showAi && dock && !dock.open}
      <!-- El botón que abre el dock cuando esta cerrado. Que la IA este
           trabajando se dice en el globo de ayuda y nada mas: el halo de
           color que lo rodeaba se retiro. El envoltorio existe para que el
           botón no se encoja; cuando la ventana no da para la columna, se
           retira con ella. -->
      <span class="dock-ai-wrap">
        <Button
          size="sm"
          tip={aiActivity.busy
            ? "La inteligencia artificial está trabajando"
            : "Pedir a la inteligencia artificial"}
          aria-label="Inteligencia artificial"
          aria-pressed={false}
          onclick={dock.toggle}
          tipSide="bottom"
          buttonClass="btn-toggle-dock-ai"
          class="btn-rounded btn-primary"
        >
          <Icon name="bubble-chat" size={20} /> Abrir chat
        </Button>
      </span>
    {/if}
  </span>

  <!-- `group`: el iconito de copiar se entera de que el ratón esta sobre el
       campo entero, no solo sobre el. El relleno de los lados es el hueco de
       los dos iconitos, que van encima; sin el, el enlace largo pasaria por
       debajo. -->
  <div
    class={cx(
      "btn-copy-public-link",
      "field-public-link",
      copied ? "field-public-link-copied" : "field-public-link-idle",
      !app.published && !copied && "field-public-link-unpublished",
    )}
  >
    <!-- Quien entra. Lo abierto se dibuja apagado y lo restringido encendido:
         en una fila de siempre, lo que hay que cazar de un vistazo es la
         excepcion, no la norma. Es el mismo criterio del sidebar.

         Y se pulsa: lleva a la tarjeta de publicar, que es donde se cambia
         quien puede entrar. Enterarse de que hace falta cuenta y querer
         cambiarlo son el mismo momento, y el globito ya lo estaba contando. -->
    {#if onOpenAccess}
      <Button
        size="sm"
        onclick={onOpenAccess}
        aria-label={accessTip}
        tip={accessTip}
        tipSide="bottom"
        buttonClass="btn-open-publish-access"
        class={cx(
          "btn-icon btn-ghost btn-rounded sm lock-public-link",
          open ? "lock-public-link-open" : "lock-public-link-closed",
        )}
      >
        <Icon name={open ? "globe-02" : "key-round"} size={16} />
      </Button>
    {:else}
      <span
        class={cx(
          "btn-icon btn-ghost btn-rounded sm lock-public-link",
          open ? "lock-public-link-open" : "lock-public-link-closed",
        )}
        data-tip={accessTip}
        data-tip-side="bottom"
      >
        <Icon name={open ? "globe-02" : "key-round"} size={16} />
      </span>
    {/if}

    <!-- Gris lo que situa --el dominio, las barras-- y negro lo que nombra: el
         enlace se lee por el nombre, no por el resto. -->
    <span class="text-public-link">
      <span>{origin}/p/</span>
      <span class="text-public-link-name">{app.slug}</span>
      {#if page && !page.isHome}
        <span>/</span>
        <span class="text-public-link-name">{page.slug}</span>
      {/if}
    </span>

    <dir class="public-right-links">
      <!-- El globito lee lo copiado igual que el icono, pero solo lo cuenta a
           quien vuelve a pasar por encima: la capa de globos se queda con el
           texto que había al asomar (ver `TooltipLayer`). No hace falta mas,
           que el campo entero poniendose verde ya lo dice en el momento. -->
      <span
        onclick={copy}
        aria-hidden="true"
        data-tip={copied ? "Enlace copiado" : "Copiar el enlace"}
        data-tip-side="bottom"
        class={cx(
          "btn-icon btn-ghost btn-rounded sm",
          copied ? "copy-icon-public-link-copied" : "copy-icon-public-link-idle",
        )}
      >
        <Icon name={copied ? "checkmark-circle-02" : "copy-01"} size={16} />
      </span>

      <span
        onclick={() => window.open(url, "_blank", "noopener")}
        aria-hidden="true"
        data-tip="Abrir en otra pestaña"
        data-tip-side="bottom"
        class="btn-icon btn-ghost btn-rounded sm"
      >
        <Icon name="external-link" size={16} />
      </span>
    </dir>
  </div>

  <!-- Las del HTML van sueltas, solo el icono y su globito: ponerles nombre
       volveria la fila un menu. Abrir si lleva el suyo: es la única que saca de
       aqui, y una flecha sola no dice a donde. Copiar ya vive en el campo. -->
  <span class="group-html-actions">
    <!--
      Con que ojos se esta mirando la página. Va aqui y no dentro del
      documento porque no es del documento: es de quien lo mira, y se cambia
      tantas veces como haga falta mientras se construye. El botón dice
      siempre con quien se esta mirando, asi que no hace falta abrirlo para
      saberlo.
    -->
    {#if showPreview}
      <Dropdown align="right" class="menu-preview-role">
        {#snippet trigger({ open, toggle })}
          <Button
            size="sm"
            onclick={toggle}
            aria-expanded={open}
            aria-label="Previsualizar la página con otro rol"
            tip="Previsualizar la página con otro rol"
            tipSide="bottom"
            buttonClass="btn-pick-preview-role"
            class={cx("btn-ghost action-urlbar", previewing && "active")}
          >
            <Icon name={ROLE_ICON} size={16} />
            <span class="label-preview-role">
              Previsualizar como: <b>{previewLabel}</b>
            </span>
          </Button>
        {/snippet}

        {#snippet children(close: () => void)}
          {#each previewOptions ?? [] as option (option.value)}
            {#if option.linea}
              <MenuSeparator />
            {/if}
            {#snippet icon()}
              {#if option.value === previewValue}
                <Icon name="check" />
              {:else}
                <span class="hole-preview-role" aria-hidden="true"></span>
              {/if}
            {/snippet}
            <MenuItem
              {icon}
              onclick={() => {
                onPreviewRole?.(option.value);
                close();
              }}
            >
              {option.label}
            </MenuItem>
          {/each}
        {/snippet}
      </Dropdown>
    {/if}

    {@render action("Histórico de cambios", onOpenChanges, "btn-open-changes", historyIcon)}
    {@render action("Código HTML", onOpenCode, "btn-open-html-code", codeIcon)}
  </span>
</div>

<style>
  .bar-address {
    height: 2.5rem;
    overflow-x: clip;
    border-bottom: var(--border-width) solid var(--border);
    background: var(--bg-level2);
    padding-inline: var(--sp-10);

    & :global(.action-urlbar) {
      flex-shrink: 0;
      color: var(--text-secondary);
    }

    & .side-urlbar-left {
      display: flex;
      flex: 1 1 0%;
      align-items: center;
    }

    & .side-urlbar-left-with-ai {
      gap: var(--sp-4);
    }

    & .side-urlbar-left-empty {
      justify-content: flex-end;
    }

    & .dock-ai-wrap {
      flex-shrink: 0;
    }

    & .field-public-link {
      position: relative;
      display: inline-flex;
      width: 100%;
      min-width: 0;
      max-width: 36rem;
      height: 80%;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-8);
      border-radius: var(--radius-lg);
      padding-inline: var(--sp-4);
      transition:
        background-color 0.15s,
        color 0.15s;
      border: var(--border-width) solid var(--border);

      & > span {
        display: inline-flex;
      }
    }

    .btn-icon {
      height: 1.5rem;
      width: 1.5rem;
    }

    & .field-public-link-copied {
      background: color-mix(in oklab, var(--success) 15%, transparent);
      color: var(--success);
    }

    & .field-public-link-idle {
      background: var(--bg-field);

      &:hover,
      &:focus-visible {
        background: var(--bg-level1);
      }
    }

    & .text-public-link {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: center;
      font-size: var(--text-sm);
      color: var(--text-muted);

      & .text-public-link-name {
        font-weight: 500;
        color: var(--text-primary);
      }
    }

    /* Right */
    .public-right-links {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-4);

      span {
        display: inline-flex;
      }

      & .copy-icon-public-link-copied {
        color: var(--success);
      }
    }

    & .group-html-actions {
      display: flex;
      flex: 1 1 0%;
      align-items: center;
      justify-content: flex-end;
      gap: 0.125rem;

      /* El rotulo se recorta antes que empujar a las del HTML fuera de la
         barra: el nombre del rol puede medir lo que quiera. */
      & .label-preview-role {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: var(--text-xs);
        line-height: var(--text-xs--line-height);
      }

      & :global(.btn-pick-preview-role) {
        min-width: 0;
        gap: var(--sp-6);
      }
    }
  }

  /* El hueco del que no esta marcado mide lo mismo que el visto bueno: sin el,
     los rotulos del menu bailarian de línea en línea. */
  .hole-preview-role {
    display: inline-block;
    width: 13px;
    flex-shrink: 0;
  }
</style>
