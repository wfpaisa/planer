<!--
  El globo de ayuda del panel.

  Antes lo dibujaba daisyUI con pseudo-elementos dentro del propio botón, asi
  que cualquier antepasado con desplazamiento o con `overflow-hidden` lo
  cortaba: el sidebar, la grilla de la base de datos, la lista de versiones.
  Ahora hay una sola capa, montada al final del documento, que escucha a
  cualquier elemento con `data-tip` y lo coloca en coordenadas de ventana. Nada
  lo puede recortar y, si no cabe de un lado, se voltea al contrario.

  El contrato para quien lo usa es una sola cosa: `data-tip="texto"`. De forma
  opcional, `data-tip-side="top|bottom|left|right"` (por defecto arriba) y
  `data-tip-tone="error"` para el globo de aviso.
-->
<script lang="ts">
  import { portal } from "../lib/portal";

  type Side = "top" | "bottom" | "left" | "right";

  /** Lo que se esta mostrando: el texto y de donde cuelga. */
  type Shown = { text: string; rect: DOMRect; side: Side; error: boolean };

  /** Hueco entre el globo y lo que lo pide. */
  const GAP = 8;
  /** Margen minimo contra el borde de la ventana. */
  const EDGE = 8;
  /** Lo que se espera con el ratón encima antes de asomarlo. */
  const DELAY = 140;

  const OPPOSITE: Record<Side, Side> = {
    top: "bottom",
    bottom: "top",
    left: "right",
    right: "left",
  };

  const sideOf = (el: HTMLElement): Side => {
    const raw = el.dataset.tipSide;
    return raw === "bottom" || raw === "left" || raw === "right" ? raw : "top";
  };

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), Math.max(min, max));

  let shown = $state<Shown | null>(null);
  // Nulo mientras no se ha medido: hasta entonces el globo va invisible, para
  // que no se vea saltar de la esquina a su sitio. El lado es el de verdad
  // --el que quedo despues de comprobar si cabia-- y viaja al marcado: es de
  // donde se asoma el globo (ver `.plane-tip` en `styles/animations.css`).
  let pos = $state<{ left: number; top: number; side: Side } | null>(null);
  let tip = $state<HTMLDivElement | null>(null);

  let timer: number | null = null;
  let target: HTMLElement | null = null;
  /** Sube con cada orden de asomar o de esconder; solo obedece la ultima. */
  let turn = 0;

  /*
   * Esconderlo no se hace en el acto.
   *
   * Los avisos que lo piden --`focusout`, `pointerout`-- los manda el navegador
   * en el mismo instante en que el elemento sale del documento, y eso ocurre
   * mientras Svelte esta desmontando lo que había: ahi el estado no se puede
   * tocar. Un microtask lo deja para cuando el dibujado ya termino, que es
   * antes del siguiente cuadro y nadie lo nota. El turno es lo que evita que
   * una orden vieja apague un globo que acaba de asomar.
   */
  function hide() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    target = null;
    if (shown === null && pos === null) return;
    const mine = ++turn;
    queueMicrotask(() => {
      if (mine !== turn) return;
      shown = null;
      pos = null;
    });
  }

  function show(el: HTMLElement, now: boolean) {
    turn++;
    const text = el.dataset.tip?.trim();
    if (!text) return hide();
    if (target === el) return;
    if (timer !== null) clearTimeout(timer);
    target = el;
    const open = () => {
      timer = null;
      // El elemento se pudo ir mientras esperabamos (una lista que cambia).
      if (target !== el || !el.isConnected) return;
      pos = null;
      shown = {
        text,
        rect: el.getBoundingClientRect(),
        side: sideOf(el),
        error: el.dataset.tipTone === "error",
      };
    };
    if (now) open();
    else timer = window.setTimeout(open, DELAY);
  }

  $effect(() => {
    const pick = (e: Event) => {
      const from = e.target as Element | null;
      return from?.closest?.("[data-tip]") as HTMLElement | null;
    };

    const onOver = (e: PointerEvent) => {
      const el = pick(e);
      if (!el) return hide();
      show(el, false);
    };
    const onOut = (e: PointerEvent) => {
      // Salir hacia un hijo del mismo elemento no cuenta como salir.
      const to = e.relatedTarget as Node | null;
      if (to && target?.contains(to)) return;
      hide();
    };
    const onFocus = (e: FocusEvent) => {
      const el = pick(e);
      // Solo con el teclado: al hacer clic el globo ya sobra, y quedarse pegado
      // al botón pulsado tapa lo que acaba de pasar.
      if (!el?.matches(":focus-visible")) return hide();
      show(el, true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("pointerdown", hide);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", hide);
    document.addEventListener("keydown", onKey);
    // En captura: lo que desplaza suele ser un contenedor, no la ventana, y
    // esos avisos no burbujean.
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", hide);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      window.removeEventListener("blur", hide);
      if (timer !== null) clearTimeout(timer);
    };
  });

  /*
   * Medir y colocar. Va en `$effect.pre` --antes de que el navegador pinte--
   * para que el globo nunca llegue a verse en el sitio equivocado. Es el
   * `useLayoutEffect` de antes.
   */
  $effect.pre(() => {
    const current = shown;
    const node = tip;
    if (!current || !node) return;

    const box = node.getBoundingClientRect();
    const r = current.rect;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const fits = (side: Side) => {
      if (side === "top") return r.top - GAP - box.height >= EDGE;
      if (side === "bottom") return r.bottom + GAP + box.height <= vh - EDGE;
      if (side === "left") return r.left - GAP - box.width >= EDGE;
      return r.right + GAP + box.width <= vw - EDGE;
    };

    const side =
      fits(current.side) || !fits(OPPOSITE[current.side]) ? current.side : OPPOSITE[current.side];

    let left: number;
    let top: number;
    if (side === "top" || side === "bottom") {
      left = r.left + r.width / 2 - box.width / 2;
      top = side === "top" ? r.top - GAP - box.height : r.bottom + GAP;
    } else {
      left = side === "left" ? r.left - GAP - box.width : r.right + GAP;
      top = r.top + r.height / 2 - box.height / 2;
    }

    pos = {
      left: clamp(left, EDGE, vw - EDGE - box.width),
      top: clamp(top, EDGE, vh - EDGE - box.height),
      side,
    };
  });
</script>

{#if shown}
  <div
    use:portal
    bind:this={tip}
    role="tooltip"
    data-side={pos?.side ?? shown.side}
    class="plane-tip{shown.error ? ' plane-tip-error' : ''}"
    style="left: {pos?.left ?? 0}px; top: {pos?.top ?? 0}px; visibility: {pos
      ? 'visible'
      : 'hidden'};"
  >
    {shown.text}
  </div>
{/if}
