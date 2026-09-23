<!--
  La guía de bienvenida: un globo que se va pegando al control del que habla.

  No es un modal: cada paso señala una pieza de verdad del editor --el botón de
  la IA, la pestana de las tablas, publicar-- recortandola del velo y pegandole
  al lado su explicacion. "Siguiente" lleva el globo al siguiente sitio, y el
  editor se mueve con el: si el control vive en la otra mitad de la aplicación,
  el recorrido cambia de mitad antes de senalarlo. Al terminar se vuelve a donde
  se estaba.

  Cuando el control no está en pantalla --un botón que esta aplicación no tiene
  todavía, o una ventana tan estrecha que la columna de la IA no cabe-- el mismo
  paso se cuenta en una tarjeta centrada, con un dibujo de la maqueta en vez del
  control. Ver `GuideArt.svelte`.

  Se abre sola la primera vez que se entra a una aplicación, y a mano desde el
  botón de ayuda del encabezado. Va montada una sola vez, en `App.svelte`, para
  que nada de lo que el recorrido mueve --cambiar de mitad, abrir una tabla--
  la desmonte a media explicacion.
-->
<script lang="ts" module>
  import { ROLE_ICON } from "@shared/people";

  import type { ArtKind } from "./GuideArt.svelte";

  /** Una línea corta debajo del texto: un nombre y lo que pasa con el. */
  interface Note {
    icon: string;
    label: string;
    text: string;
  }

  interface Step {
    /**
     * El control de verdad al que se pega el globo, por su clase semantica.
     *
     * Son las clases identificadoras del panel (`btn-publish`,
     * `btn-open-table`…), que no se renombran al editar. Con varias se prueban
     * en orden y manda la primera que esté en pantalla: la caja del chat solo
     * existe con la columna de la IA abierta, y con ella cerrada lo que hay es
     * el botón que la abre. Sin `target` --o sin ninguno a la vista-- el paso
     * sale centrado con su dibujo.
     */
    target?: string | string[];
    /**
     * Saca a la vista un control que solo aparece al pasar el puntero.
     *
     * El valor viaja a `data-guide-reveal` en la raíz del documento, y es la
     * pantalla dueña del control la que lo mira para dejarlo puesto mientras
     * dura el paso. Hoy solo lo usa la lista de páginas, con sus tres puntos.
     */
    reveal?: string;
    /**
     * Pinta el area señalada del color de la aplicación en vez de solo
     * rodearla. Para lo que no es un botón sino una zona entera: el editor, al
     * que se le puede soltar un archivo en cualquier parte.
     */
    fill?: boolean;
    /** En cual de las dos mitades vive ese control. El recorrido va a ella. */
    section?: "app" | "datos";
    /** El dibujo para cuando no hay control que señalar. Ver `GuideArt.svelte`. */
    art: ArtKind;
    /** Donde se hace, con nombres de la pantalla. Va antes que la explicacion. */
    spot?: { icon: string; text: string };
    title: string;
    text: string;
    notes?: Note[];
  }

  const STEPS: Step[] = [
    {
      art: "welcome",
      title: "Qué hay en una aplicación",
      text: "Una aplicación tiene páginas, tablas y personas que entran a verlas. Esta guía señala dónde está cada cosa. Puedes cerrarla cuando quieras y volver a abrirla con el botón de ayuda, arriba a la derecha.",
    },
    {
      target: "#builder-content",
      fill: true,
      art: "drop",
      spot: { icon: "cursor-pointer-01", text: "En cualquier parte del editor" },
      title: "Arrastra tus archivos",
      text: "Suelta el archivo en cualquier punto del editor. Se te pregunta qué hacer con él, y no se crea nada hasta que eliges.",
      notes: [
        {
          icon: "html-5",
          label: "HTML",
          text: "una página nueva, o el contenido de la página abierta.",
        },
        {
          icon: "csv-01",
          label: "CSV, TSV, JSON, XLSX",
          text: "una tabla nueva, o filas para una tabla que ya existe.",
        },
        {
          icon: "ai-magic",
          label: "Imágenes, CSS, JS y texto",
          text: "material para el chat de IA.",
        },
      ],
    },
    {
      target: [".chat-composer", ".btn-toggle-dock-ai"],
      section: "app",
      art: "ai",
      spot: { icon: "ai-magic", text: "Columna de la IA · caja de escribir" },
      title: "Pide la página al chat de IA",
      text: 'Escribe aquí qué quieres en la página. Por ejemplo: "una lista de pedidos con su formulario". La página se escribe con lo que pidas y se crean las tablas que falten.',
      notes: [
        {
          icon: "settings-01",
          label: "Antes de empezar",
          text: "conecta un servidor de IA en Ajustes.",
        },
        {
          icon: "bubble-chat",
          label: "Si no ves la columna",
          text: "ábrela con el botón redondo de la barra de dirección.",
        },
      ],
    },
    {
      target: ".btn-toggle-picker",
      section: "app",
      art: "ai",
      spot: { icon: "square-dashed-mouse-pointer", text: "Columna de la IA · junto a la caja" },
      title: "Señala lo que quieres cambiar",
      text: "Enciende el cursor y pulsa un elemento de la página. Lo señalado viaja con tu petición, así no tienes que describir dónde está. Las flechas ↑ y ↓ amplían la selección y Esc apaga el cursor.",
      notes: [
        {
          icon: "cursor-pointer-01",
          label: "Por ejemplo",
          text: "señala una tabla y pide que se ordene por fecha.",
        },
      ],
    },
    {
      target: ".btn-tab-data-section",
      art: "data",
      spot: { icon: "database", text: "Arriba, en el centro" },
      title: "Tus tablas están en Base de datos",
      text: "Este botón cambia entre las páginas y las tablas. Cada tabla se edita como una hoja de cálculo: añades columnas, escribes filas y todo se guarda al momento.",
      notes: [
        {
          icon: "csv-01",
          label: "Excel y CSV",
          text: "al soltar el archivo eliges si crear una tabla nueva o añadir, actualizar o reemplazar las filas de una que ya existe.",
        },
      ],
    },
    {
      target: ".btn-open-table",
      section: "datos",
      art: "people",
      spot: { icon: ROLE_ICON, text: "Base de datos · primera tabla" },
      title: "Personas y roles",
      text: "Esta tabla guarda a quienes entran a la aplicación. Cada fila es una persona, con su correo y su clave. En la columna de roles eliges qué puede ver cada una.",
      notes: [
        {
          icon: ROLE_ICON,
          label: "Roles",
          text: "se crean con el botón Roles, en la barra de esta tabla. Toda aplicación tiene el rol admin.",
        },
      ],
    },
    {
      target: ".btn-pick-preview-role",
      section: "app",
      art: "preview",
      spot: { icon: "eye", text: "Barra de dirección · selector de rol" },
      title: "Comprueba qué ve cada rol",
      text: "Elige un rol, o una persona concreta, y la página se ve tal como la vería esa persona. Así compruebas los permisos sin crear cuentas de prueba.",
      notes: [
        {
          icon: "eye",
          label: "Quién ve cada página",
          text: "se elige en los ajustes de la página. Sin ningún rol marcado, la ve todo el mundo.",
        },
      ],
    },
    {
      target: ".btn-open-app",
      section: "app",
      art: "settings",
      spot: { icon: "settings-01", text: "Arriba a la izquierda · icono y nombre" },
      title: "Ajustes de la aplicación",
      text: "El icono y el nombre abren los ajustes: cómo se llama, con qué enlace se publica, su paleta de color y el tamaño de letra.",
    },
    {
      target: [".btn-page-settings", ".sidebar-page-row"],
      section: "app",
      reveal: "page-settings",
      art: "settings",
      spot: { icon: "more-horizontal", text: "Lista de páginas · los tres puntos" },
      title: "Ajustes de la página",
      text: "Estos tres puntos salen al pasar el puntero por la línea de una página. Ahí cambias su nombre, su icono y qué roles la ven, o la borras.",
    },
    {
      target: ".btn-publish",
      section: "app",
      art: "publish",
      spot: { icon: "zap", text: "Arriba a la derecha · botón Publicar" },
      title: "Publicar la aplicación",
      text: "Publica la aplicación en su enlace /p/nombre. Antes eliges si puede entrar cualquiera o si hace falta iniciar sesión. Cuando queden cambios sin publicar, el botón se pone ámbar.",
    },
  ];

  /** El aire entre el control señalado y el globo. */
  const GAP = 12;
  /** Lo que el recorte se sale del control por cada lado. */
  const HOLE_PAD = 6;

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), Math.max(min, max));
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import { fly } from "svelte/transition";

  import { cx } from "../../lib/cx";
  import { guide } from "../../lib/guide.svelte";
  import { portal } from "../../lib/portal";
  import { location, navigate } from "../../lib/router.svelte";
  import Icon from "../Icon.svelte";
  import Button from "../ui/Button.svelte";
  import GuideArt from "./GuideArt.svelte";

  /** Donde está el control señalado, y en que ventana. */
  interface Spot {
    top: number;
    left: number;
    width: number;
    height: number;
    vw: number;
    vh: number;
  }

  let step = $state(0);
  /** Hacia donde se va: 1 adelante, -1 atras. Es lo que inclina la transicion. */
  let way = $state(1);
  let spot = $state<Spot | null>(null);
  /** Lo que mide el globo, para colocarlo sin que se salga de la ventana. */
  let popWidth = $state(0);
  let popHeight = $state(0);
  let card = $state<HTMLElement | null>(null);

  const current = $derived(STEPS[step]);
  /** Si este paso tiene un control de verdad al que pegarse. */
  const anchored = $derived(!!spot);
  const last = $derived(step === STEPS.length - 1);
  const quieto = $derived(prefersReducedMotion.current);

  /** La aplicación abierta, si se está dentro de una. */
  const appId = $derived(location.pathname.match(/^\/a\/([^/]+)/)?.[1] ?? "");
  /** En que mitad del editor se está ahora. */
  const section = $derived(location.pathname.startsWith(`/a/${appId}/datos`) ? "datos" : "app");

  /** De donde se venia al abrir la guía, para devolver el editor al terminar. */
  let cameFrom = "";

  // Abrirla empieza por el principio: es un recorrido, no un sitio donde se
  // deja el punto de lectura.
  $effect(() => {
    if (!guide.open) return;
    // La ruta se lee sin depender de ella: el recorrido cambia de mitad para
    // señalar cada control, y con esa lectura suelta el paso volveria al
    // primero en cuanto el editor se moviera.
    untrack(() => {
      step = 0;
      way = 1;
      cameFrom = location.pathname;
    });
  });

  /* Llevar el editor a la mitad donde vive el control de este paso. */
  $effect(() => {
    if (!guide.open || !appId || !current.section) return;
    if (section !== current.section) navigate(`/a/${appId}/${current.section}`, { replace: true });
  });

  /*
   * Sacar a la vista lo que solo aparece al pasar el puntero.
   *
   * La marca se pone en la raíz del documento porque quien tiene que
   * responder a ella es la pantalla dueña del control --la lista de páginas,
   * en `AppSidebar`--, que está en otra rama del árbol. Se retira al cambiar
   * de paso: fuera de su paso, un botón que no se va nunca estorba.
   */
  $effect(() => {
    const mark = guide.open ? current.reveal : undefined;
    if (!mark) return;
    document.documentElement.dataset.guideReveal = mark;
    return () => delete document.documentElement.dataset.guideReveal;
  });

  /*
   * Seguir al control por la pantalla.
   *
   * Se vuelve a medir cada poco y no una sola vez: entre un paso y el
   * siguiente el editor puede estar cambiando de mitad, el sidebar abriendose
   * o la lista de tablas todavía llegando del servidor, y el control aparece
   * --o se mueve-- después de que el paso empiece. Es una medida y una
   * comparacion, no un redibujado: solo cuando cambia de sitio se escribe.
   */
  $effect(() => {
    if (!guide.open) {
      spot = null;
      return;
    }
    const selectors = current.target
      ? Array.isArray(current.target)
        ? current.target
        : [current.target]
      : [];
    if (selectors.length === 0) {
      spot = null;
      return;
    }

    /*
     * El primero de la lista que esté dibujado en pantalla.
     *
     * Se recorren todos los que casan con cada selector y no solo el primero:
     * los tres puntos de los ajustes de una página existen en cada línea de la
     * lista, y los de un separador siguen escondidos aunque el paso los saque
     * a la vista en las páginas.
     */
    const find = () => {
      for (const selector of selectors) {
        for (const el of document.querySelectorAll(selector)) {
          const box = el.getBoundingClientRect();
          if (box.width > 0 && box.height > 0) return { el, box };
        }
      }
      return null;
    };

    let prev: Spot | null = null;
    const same = (a: Spot | null, b: Spot | null) =>
      a === b ||
      (!!a &&
        !!b &&
        Math.abs(a.top - b.top) < 0.5 &&
        Math.abs(a.left - b.left) < 0.5 &&
        Math.abs(a.width - b.width) < 0.5 &&
        Math.abs(a.height - b.height) < 0.5 &&
        a.vw === b.vw &&
        a.vh === b.vh);

    /* Traer el control a la vista, una sola vez: si el paso siguiente señala
       algo que quedo debajo del pliegue --una tabla en una lista larga-- el
       recorte se dibujaria fuera de la ventana. Una sola vez porque después
       la lista es de quien mira: bajar a la fuerza mientras se lee estorba. */
    let brought = false;

    const measure = () => {
      const hit = find();
      if (hit && !brought) {
        brought = true;
        const fuera = hit.box.top < 0 || hit.box.bottom > window.innerHeight;
        if (fuera) hit.el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      const next: Spot | null = hit
        ? {
            top: hit.box.top,
            left: hit.box.left,
            width: hit.box.width,
            height: hit.box.height,
            vw: window.innerWidth,
            vh: window.innerHeight,
          }
        : null;
      if (same(prev, next)) return;
      prev = next;
      spot = next;
    };

    measure();
    const tick = setInterval(measure, 150);
    window.addEventListener("resize", measure);
    return () => {
      clearInterval(tick);
      window.removeEventListener("resize", measure);
    };
  });

  /**
   * Donde cae el globo: debajo del control si cabe, y si no encima.
   *
   * Lo que no cabe por los lados se recuesta contra el borde de la ventana, y
   * la flecha se queda apuntando al control aunque el globo se haya corrido.
   */
  const pop = $derived.by(() => {
    if (!spot || !popWidth || !popHeight) return null;
    const under = spot.top + spot.height + GAP;
    const over = spot.top - popHeight - GAP;
    const below = under + popHeight <= spot.vh - GAP || over < GAP;
    const top = clamp(below ? under : over, GAP, spot.vh - popHeight - GAP);
    const left = clamp(spot.left + spot.width / 2 - popWidth / 2, GAP, spot.vw - popWidth - GAP);
    return {
      top,
      left,
      below,
      /** La flecha, en coordenadas del globo. */
      arrow: clamp(spot.left + spot.width / 2 - left, 18, popWidth - 18),
    };
  });

  function go(next: number): void {
    if (next < 0 || next >= STEPS.length) return;
    way = next > step ? 1 : -1;
    step = next;
  }

  const back = () => go(step - 1);

  /** Cerrar, y devolver el editor a donde estaba antes del recorrido. */
  function finish(): void {
    guide.close();
    if (cameFrom && cameFrom !== location.pathname) navigate(cameFrom, { replace: true });
  }

  const forward = () => (last ? finish() : go(step + 1));

  /* Las flechas mueven el recorrido y Escape lo cierra. */
  $effect(() => {
    if (!guide.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(step + 1);
      if (e.key === "ArrowLeft") go(step - 1);
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /*
   * El globo se lleva el foco en cada paso: es lo que hace que un lector de
   * pantalla lea el paso nuevo, y que las flechas sigan funcionando después de
   * pulsar un punto del pie.
   */
  $effect(() => {
    if (!guide.open) return;
    void step;
    untrack(() => card?.focus({ preventScroll: true }));
  });

  /** Cuanto se desplaza lo escrito al cambiar de paso. */
  const VIAJE = 20;
</script>

{#if guide.open}
  <!--
    Al final del documento: el recorrido señala piezas que viven en capas
    distintas --el encabezado, el sidebar, la barra de dirección-- y desde
    dentro de cualquiera de ellas quedaria encerrado en la suya.
  -->
  <div use:portal id="guide-tour" class="guide-tour">
    <!--
      Mientras dura el recorrido el editor se mira, no se toca: este velo se
      queda con los clics para que un botón señalado no se pulse por error. El
      recorrido se sigue con sus propios botones.
    -->
    <div class="guide-shield" role="presentation"></div>

    {#if pop && spot}
      <!-- El recorte: el control se queda a plena luz y el resto se apaga. -->
      <div
        class={cx("guide-hole", current.fill && "filled")}
        style="top: {spot.top - HOLE_PAD}px; left: {spot.left - HOLE_PAD}px; width: {spot.width +
          HOLE_PAD * 2}px; height: {spot.height + HOLE_PAD * 2}px"
      ></div>
    {:else}
      <div class="guide-dim plane-backdrop"></div>
    {/if}

    <div
      role="dialog"
      aria-label="Guía rápida"
      bind:clientWidth={popWidth}
      bind:clientHeight={popHeight}
      bind:this={card}
      tabindex="-1"
      class={cx("guide-pop", "plane-card", anchored ? "anchored" : "centered")}
      style={anchored
        ? pop
          ? `top: ${pop.top}px; left: ${pop.left}px; --guide-arrow: ${pop.arrow}px`
          : /* medido a medias: se coloca en el siguiente cuadro, no a la vista */
            "visibility: hidden"
        : undefined}
      data-side={pop ? (pop.below ? "below" : "above") : undefined}
    >
      {#if anchored}
        <span class="guide-arrow" aria-hidden="true"></span>
      {/if}

      <header class="guide-pop-head">
        <span class="guide-count">Paso {step + 1} de {STEPS.length}</span>
        <button
          type="button"
          class="btn-close-guide btn-icon sm btn-rounded"
          onclick={finish}
          aria-label="Cerrar la guía"
        >
          <Icon name="cancel-01" size={14} />
        </button>
      </header>

      <div class="guide-stage">
        {#key step}
          <div
            class="guide-slide"
            in:fly={{ x: way * VIAJE, duration: quieto ? 0 : 240, opacity: 0 }}
            out:fly={{ x: way * -VIAJE, duration: quieto ? 0 : 140, opacity: 0 }}
          >
            {#if !anchored}
              <div class="guide-art">
                <GuideArt kind={current.art} />
              </div>
            {/if}

            {#if current.spot}
              <p class="guide-spot">
                <Icon name={current.spot.icon} size={13} />
                {current.spot.text}
              </p>
            {/if}

            <h3 class="guide-title">{current.title}</h3>
            <p class="guide-text">{current.text}</p>

            {#if current.notes}
              <ul class="guide-notes">
                {#each current.notes as note (note.label)}
                  <li>
                    <span class="guide-note-icon"><Icon name={note.icon} size={14} /></span>
                    <span>
                      <b>{note.label}:</b>
                      {note.text}
                    </span>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/key}
      </div>

      <footer class="guide-foot">
        <div class="guide-dots">
          {#each STEPS as item, i (item.title)}
            <button
              type="button"
              class={cx("btn-guide-step", "guide-dot", i === step && "on")}
              aria-current={i === step ? "step" : undefined}
              aria-label="Paso {i + 1}: {item.title}"
              data-tip={item.title}
              onclick={() => go(i)}
            ></button>
          {/each}
        </div>

        <div class="guide-actions flex items-center gap-2">
          <Button size="sm" onclick={back} disabled={step === 0} buttonClass="btn-guide-back">
            Atrás
          </Button>
          <Button size="sm" variant="secondary" onclick={forward} buttonClass="btn-guide-next">
            {#if last}
              Listo
            {:else}
              Siguiente
              <Icon name="arrow-right-01" size={14} />
            {/if}
          </Button>
        </div>
      </footer>
    </div>
  </div>
{/if}

<style>
  /* El peldano de los modales: ver la escala en `styles/global.css`. */
  .guide-tour {
    position: fixed;
    inset: 0;
    z-index: 20;
  }

  /* Transparente y sin dibujo: está para quedarse con los clics. */
  .guide-shield {
    position: absolute;
    inset: 0;
  }

  /*
   * El recorte no tapa: apaga todo lo que lo rodea. La sombra sale del propio
   * hueco y se extiende hasta cubrir la ventana entera, así que el control
   * señalado se ve tal cual, sin una copia suya dibujada encima y sin que el
   * velo tenga que saber recortarse. No recibe el puntero: los clics son del
   * escudo de debajo.
   */
  .guide-hole {
    position: absolute;
    border-radius: var(--radius-md);
    box-shadow:
      0 0 0 100vmax rgb(0 0 0 / 0.28),
      0 0 0 0.125rem var(--accent);
    pointer-events: none;

    /*
     * Una zona entera, no un botón: se tine del color de la aplicación para
     * que se lea que vale toda ella --soltar un archivo no pide puntería--.
     * El tinte es flojo a propósito: debajo sigue estando lo construido, y
     * taparlo contaria peor lo que se puede hacer encima.
     */
    &.filled {
      background: color-mix(in srgb, var(--accent) 12%, transparent);
    }

    /* Que el recorte viaje de un control al siguiente es media explicacion:
       se ve de donde a donde va el recorrido. */
    transition:
      top 320ms var(--travel-curve),
      left 320ms var(--travel-curve),
      width 320ms var(--travel-curve),
      height 320ms var(--travel-curve);

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }

  /* La mitad de lo que apaga `plane-backdrop`, por lo mismo que el velo del
     recorte: el globo ya se despega con su borde de color, y quien mira tiene
     que seguir reconociendo su pantalla debajo. */
  .guide-dim {
    position: absolute;
    background: rgb(0 0 0 / 0.2);
  }

  /*
   * El globo se separa del editor a la fuerza: dos pixeles del color de la
   * aplicación y una sombra larga. Mientras dura el recorrido es lo único que
   * hay que leer, y lo de debajo --que sigue siendo una pantalla llena de
   * tarjetas-- no puede competir con el.
   */
  .guide-pop {
    position: absolute;
    display: flex;
    flex-direction: column;
    background: var(--bg-level2);
    border: 0.125rem solid var(--accent);
    box-shadow:
      0 1.5rem 3rem -0.75rem rgb(0 0 0 / 0.55),
      0 0.5rem 1rem -0.5rem rgb(0 0 0 / 0.35);

    &.anchored {
      width: min(24rem, calc(100vw - 1.5rem));

      transition:
        top 320ms var(--travel-curve),
        left 320ms var(--travel-curve);

      @media (prefers-reduced-motion: reduce) {
        transition: none;
      }
    }

    /* Sin control que señalar: la tarjeta de siempre, en medio y con el dibujo. */
    &.centered {
      top: 50%;
      left: 50%;
      translate: -50% -50%;
      width: min(40rem, calc(100vw - 2rem));
      max-height: calc(100dvh - 2rem);
      overflow-y: auto;
    }
  }

  /* La flecha: la esquina del globo girada, con las dos caras que se ven. */
  .guide-arrow {
    position: absolute;
    left: var(--guide-arrow);
    width: 0.625rem;
    height: 0.625rem;
    rotate: 45deg;
    background: var(--bg-level2);
    border: 0.125rem solid var(--accent);

    [data-side="below"] & {
      top: -0.4375rem;
      border-width: 0.125rem 0 0 0.125rem;
    }

    [data-side="above"] & {
      bottom: -0.4375rem;
      border-width: 0 0.125rem 0.125rem 0;
    }
  }

  .guide-pop-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-8);
    padding: var(--sp-12) var(--sp-14) 0;

    & .guide-count {
      font-size: var(--text-xs);
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-muted);
    }
  }

  /*
   * Los dos pasos --el que se va y el que llega-- comparten celda: se cruzan
   * en el sitio en vez de empujarse mientras dura el cruce.
   */
  .guide-stage {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    padding: var(--sp-10) var(--sp-14) var(--sp-14);
  }

  .guide-slide {
    grid-area: 1 / 1;
    min-width: 0;
  }

  /* Solo en la tarjeta centrada: donde no hay control, hay maqueta. */
  .guide-art {
    height: 12.5rem;
    margin-bottom: var(--sp-16);
    border-radius: var(--radius-lg);
    border: var(--border-width) solid var(--border);
    background: var(--bg-level1);

    @media (max-height: 44rem) {
      height: 9rem;
    }
  }

  /*
   * Donde se hace, antes que el título: lleva el color de la aplicación, el
   * mismo del anillo que rodea al control. Los dos se leen como una sola cosa.
   */
  .guide-spot {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-6);
    margin-bottom: var(--sp-8);
    padding: 0.125rem var(--sp-10);
    border-radius: 62.5rem;
    background: var(--accent-soft);
    color: var(--accent-soft-text);
    font-size: var(--text-xs);
    line-height: var(--text-xs--line-height);
    font-weight: 700;
  }

  .guide-title {
    font-size: var(--text-md);
    font-weight: 700;
    color: var(--text-primary);
    text-wrap: balance;
  }

  .guide-text {
    margin-top: var(--sp-6);
    font-size: var(--text-sm);
    line-height: 1.55;
    color: var(--text-secondary);
    text-wrap: pretty;
  }

  .guide-notes {
    display: flex;
    flex-direction: column;
    gap: var(--sp-8);
    margin-top: var(--sp-12);

    & li {
      display: flex;
      align-items: flex-start;
      gap: var(--sp-8);
      font-size: var(--text-xs);
      line-height: 1.5;
      color: var(--text-muted);
    }

    & b {
      font-weight: 700;
      color: var(--text-secondary);
    }

    & .guide-note-icon {
      display: grid;
      place-items: center;
      flex: none;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: var(--radius-sm);
      background: var(--accent-soft);
      color: var(--accent-soft-text);
    }
  }

  .guide-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-12);
    padding: var(--sp-10) var(--sp-14);
    border-top: var(--border-width) solid var(--border);
  }

  .guide-dots {
    display: flex;
    align-items: center;
    gap: var(--sp-6);
  }

  /* El punto del paso: chico y apagado, y el de ahora estirado en el color de
     la aplicación --la posicion se lee de un vistazo, sin contar puntos--. */
  .guide-dot {
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 62.5rem;
    background: var(--border-strong);
    cursor: pointer;
    transition:
      width 200ms,
      background-color 200ms;

    &:hover {
      background: var(--text-muted);
    }

    &.on {
      width: 1.125rem;
      background: var(--accent);
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }
</style>
