/**
 * El puente que acompana a cada documento HTML de un bloque.
 *
 * El documento se dibuja en un marco aislado, sin origen propio: no alcanza
 * la sesion de quien mira ni el resto de la pagina. Todo lo que necesita del
 * exterior le llega por mensajes, y este guion es quien los traduce a algo
 * comodo de usar: `window.plane`.
 *
 * Los colores no se incrustan aqui. Llegan por mensaje al cargar y cada vez
 * que cambian, para que el documento guardado dependa solo de su huella y la
 * cache siga valiendo aunque la aplicacion cambie de paleta.
 */

import { STYLES_PATH } from "../../shared/htmlContract.ts";
import { ICON_FONT_URL } from "../../shared/icons.ts";
import { PAGE_STYLES } from "../page/pageStyles.ts";
import { CHARTS_REF, USES_CHARTS } from "./htmlCharts.ts";

/** Nombres de las ordenes que el HTML puede pedir. */
export const HTML_OPS = ["listar", "contar", "obtener", "crear", "actualizar", "borrar"] as const;
export type HtmlOp = (typeof HTML_OPS)[number];

export const BRIDGE_SCRIPT = `(function () {
  "use strict";

  var pendientes = {};
  var siguiente = 0;
  var oyentes = [];

  function enviar(mensaje) {
    parent.postMessage(mensaje, "*");
  }

  function pedir(op, args) {
    return new Promise(function (resolve, reject) {
      var id = "p" + ++siguiente;
      pendientes[id] = { resolve: resolve, reject: reject };
      enviar({ plane: "call", id: id, op: op, args: args });
    });
  }

  /* --- Lo que se rompe ---------------------------------------------------- */
  /*
   * Lo mismo que sale en la consola al inspeccionar la pagina, repetido hacia
   * el panel. Se engancha aqui arriba, antes que nada, para no perderse lo que
   * falle mientras el resto de este guion se esta montando.
   *
   * Hay tope: un fallo dentro de un bucle de dibujo se repite miles de veces y
   * no aporta nada despues de las primeras. La consola de verdad los sigue
   * viendo todos --nunca se traga nada--, el tope es solo para lo que sale.
   */
  var MAX_FALLOS = 50;
  var fallos = 0;

  function avisarFallo(fallo) {
    if (fallos >= MAX_FALLOS) return;
    fallos++;
    enviar({ plane: "fallo", fallo: fallo });
  }

  function texto(valor) {
    if (valor instanceof Error) return String(valor.message || valor);
    if (typeof valor === "string") return valor;
    try { return JSON.stringify(valor); } catch (e) { return String(valor); }
  }

  /*
   * En captura, no en burbuja: asi tambien llegan los recursos que no cargan
   * --una imagen, un guion de fuera--, cuyo evento no burbujea hasta window.
   */
  window.addEventListener("error", function (evento) {
    var objetivo = evento.target;
    if (objetivo && objetivo !== window && (objetivo.src || objetivo.href)) {
      avisarFallo({
        tipo: "recurso",
        mensaje: "No cargo " + String(objetivo.src || objetivo.href).slice(0, 300),
      });
      return;
    }
    avisarFallo({
      tipo: "js",
      mensaje: texto(evento.message || (evento.error && evento.error.message)),
      linea: evento.lineno || undefined,
      columna: evento.colno || undefined,
      pila: evento.error && evento.error.stack ? String(evento.error.stack).slice(0, 2000) : undefined,
    });
  }, true);

  window.addEventListener("unhandledrejection", function (evento) {
    var razon = evento.reason;
    avisarFallo({
      tipo: "promesa",
      mensaje: texto(razon),
      pila: razon && razon.stack ? String(razon.stack).slice(0, 2000) : undefined,
    });
  });

  /*
   * Un documento puede recoger su propio fallo y solo escribirlo. Ahi no hay
   * excepcion que atrapar, pero sigue siendo lo que se ve al inspeccionar.
   * El original se llama siempre: la consola de verdad no se toca.
   */
  (function () {
    if (!window.console) return;
    var original = { error: console.error, warn: console.warn };
    ["error", "warn"].forEach(function (nivel) {
      var antes = original[nivel];
      if (typeof antes !== "function") return;
      console[nivel] = function () {
        try {
          avisarFallo({
            tipo: nivel === "warn" ? "aviso" : "consola",
            mensaje: Array.prototype.map.call(arguments, texto).join(" ").slice(0, 1000),
          });
        } catch (e) { /* avisar no puede romper al que avisa */ }
        return antes.apply(console, arguments);
      };
    });
  })();

  /* --- Almacenamiento del navegador ------------------------------------ */
  /*
   * Aqui dentro no hay almacenamiento propio: leerlo lanza y se lleva por
   * delante el resto del guion del documento. Se pone uno de mentira, en
   * memoria, para que el contenido al menos funcione y se pueda ver. No
   * guarda nada de verdad, y en cuanto se usa se avisa al panel para que lo
   * diga claro en vez de dejar creer que si.
   */
  var avisado = false;

  function enMemoria() {
    var datos = {};
    return {
      getItem: function (k) {
        return Object.prototype.hasOwnProperty.call(datos, k) ? datos[k] : null;
      },
      setItem: function (k, v) {
        datos[k] = String(v);
        if (!avisado) { avisado = true; enviar({ plane: "storage" }); }
      },
      removeItem: function (k) { delete datos[k]; },
      clear: function () { datos = {}; },
      key: function (i) { return Object.keys(datos)[i] || null; },
      get length() { return Object.keys(datos).length; }
    };
  }

  var almacenes = ["localStorage", "sessionStorage"];
  for (var i = 0; i < almacenes.length; i++) {
    var alcanzable = false;
    try { alcanzable = !!window[almacenes[i]]; } catch (e) { alcanzable = false; }
    if (alcanzable) continue;
    try {
      Object.defineProperty(window, almacenes[i], {
        value: enMemoria(), configurable: true, writable: true
      });
    } catch (e) { /* si no se deja, el documento fallara como antes */ }
  }

  var plane = {
    tema: {},
    usuario: null,
    modo: "light",
    // El nombre de la paleta activa, para el atributo data-palette. No es
    // plane.paleta: ese nombre ya es de graficas.js, los colores resueltos
    // (estados, series, acento...) que documenta el contrato. Repetirlo aqui
    // lo pisaria en cada mensaje de tema, y todo lo que se pinta a mano -- el
    // semaforo de un donut, una insignia -- se quedaria sin color.
    paletaId: null,
    listar: function (fuente, opciones) { return pedir("listar", [fuente, opciones || {}]); },
    contar: function (fuente, opciones) { return pedir("contar", [fuente, opciones || {}]); },
    obtener: function (fuente, id) { return pedir("obtener", [fuente, id]); },
    crear: function (fuente, valores) { return pedir("crear", [fuente, valores]); },
    actualizar: function (fuente, id, valores) { return pedir("actualizar", [fuente, id, valores]); },
    borrar: function (fuente, id) { return pedir("borrar", [fuente, id]); },
    alCambiarTema: function (fn) { oyentes.push(fn); if (plane.listo) fn(plane.tema); }
  };
  plane.listo = false;

  /*
   * Puede que algo haya llegado antes y ya haya dejado cosas en window.plane
   * --las graficas, sin ir mas lejos, que se cargan de otro archivo y no
   * pueden saber cual de los dos guiones corre primero--. Se conservan: pisar
   * el objeto entero se llevaria por delante lo que dejo el otro, y la pagina
   * fallaria diciendo que una funcion que si existia no es una funcion.
   */
  var previo = window.plane;
  if (previo) {
    for (var clave in previo) {
      if (!(clave in plane)) plane[clave] = previo[clave];
    }
  }
  window.plane = plane;

  /* --- Colores y modo ------------------------------------------------- */

  function pintar(datos) {
    var raiz = document.documentElement;
    for (var nombre in datos.vars) {
      if (Object.prototype.hasOwnProperty.call(datos.vars, nombre)) {
        raiz.style.setProperty(nombre, datos.vars[nombre]);
      }
    }
    plane.tema = datos.vars || {};
    plane.modo = datos.modo || "light";
    plane.paletaId = datos.paleta || null;
    plane.usuario = datos.usuario || null;
    raiz.setAttribute("data-plane-tema", plane.modo);
    raiz.style.colorScheme = plane.modo;

    /*
     * El tema y la paleta, en la raiz. De aqui derivan las hojas de la casa
     * --las mismas que viste el panel, ver server/page/pageStyles.ts--: sin el
     * atributo, el catalogo saldria con los colores de partida y no con los
     * de la aplicacion. Los nombres son los de siempre (data-theme,
     * data-palette); data-plane-tema se queda porque el contrato lo nombra.
     */
    raiz.setAttribute("data-theme", plane.modo);
    if (plane.paletaId) raiz.setAttribute("data-palette", plane.paletaId);
    else raiz.removeAttribute("data-palette");

    var primera = !plane.listo;
    plane.listo = true;
    for (var i = 0; i < oyentes.length; i++) {
      try { oyentes[i](plane.tema); } catch (e) { /* un oyente roto no para al resto */ }
    }
    if (primera) anunciar();
  }

  /*
   * El aviso de arranque no sale hasta que el documento esta entero.
   *
   * El puente va arriba del todo y el guion de la pagina, al final. Entre los
   * dos el parser se para en cada <script src> a esperar el archivo, y en esa
   * pausa cabe de sobra el mensaje del contenedor: se anunciaria el arranque
   * antes de que nadie se hubiera puesto a escuchar. La pagina saldria
   * dibujada pero vacia, y solo unas veces --las que la pausa fuera larga--,
   * que es la peor forma de fallar.
   */
  function anunciar() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        window.dispatchEvent(new CustomEvent("plane:listo", { detail: plane }));
      });
      return;
    }
    window.dispatchEvent(new CustomEvent("plane:listo", { detail: plane }));
  }

  /* --- Salidas ---------------------------------------------------------- */
  /*
   * Aqui dentro no hay a donde ir: el marco solo tiene este documento. Un
   * archivo hecho para vivir suelto no lo sabe, y en cuanto no reconoce una
   * sesion se manda a su pantalla de acceso. Si lo consigue, el bloque acaba
   * mostrando la pagina de error del navegador y el puente muere con el.
   *
   * Lo que se puede interceptar se para aqui. Lo que no --una asignacion
   * directa de la direccion-- se avisa al salir, y el panel vuelve a poner el
   * documento en su sitio.
   */
  function avisarSalida(modo, destino) {
    enviar({ plane: "nav", modo: modo, destino: String(destino || "").slice(0, 300) });
  }

  /* Se escucha al final, no al capturar: si el documento ya lo paro por su
     cuenta no hay nada que bloquear ni nada que avisar. */
  document.addEventListener("click", function (evento) {
    if (evento.defaultPrevented || evento.button !== 0) return;
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;

    var nodo = evento.target;
    while (nodo && nodo !== document && nodo.tagName !== "A") nodo = nodo.parentNode;
    if (!nodo || nodo.tagName !== "A") return;

    var href = nodo.getAttribute("href") || "";
    // Un salto dentro del propio documento no sale de ningun sitio.
    if (!href || href.charAt(0) === "#" || /^javascript:/i.test(href)) return;

    evento.preventDefault();
    avisarSalida("bloqueado", href);
  });

  document.addEventListener("submit", function (evento) {
    // Enviar un formulario recarga el marco y se lleva el documento por
    // delante. Lo que haya que guardar se guarda con las ordenes de datos.
    if (evento.defaultPrevented) return;
    evento.preventDefault();
    avisarSalida("bloqueado", "");
  });

  window.addEventListener("pagehide", function () { avisarSalida("saliendo", ""); });
  window.addEventListener("beforeunload", function () { avisarSalida("saliendo", ""); });

  /* --- Archivos que se sueltan encima ----------------------------------- */
  /*
   * Un archivo que se suelta sobre el marco no lo ve el panel: los eventos de
   * arrastre no salen del documento. Sin nadie que los pare, el navegador se
   * queda con el archivo y lo abre en otra ventana, que es justo lo contrario
   * de lo que queria quien lo arrastro.
   *
   * Se paran aqui y se avisa al panel, que asi puede sacar su cartel y
   * quedarse con el archivo como si lo hubieran soltado en cualquier otro
   * sitio del editor.
   */
  function traeArchivos(evento) {
    var tipos = evento.dataTransfer && evento.dataTransfer.types;
    if (!tipos) return false;
    for (var i = 0; i < tipos.length; i++) if (tipos[i] === "Files") return true;
    return false;
  }

  /* El aviso se repite mientras dure el arrastre, pero no en cada pixel. */
  var ultimoAviso = 0;

  window.addEventListener("dragover", function (evento) {
    if (!traeArchivos(evento)) return;
    evento.preventDefault();
    try { evento.dataTransfer.dropEffect = "copy"; } catch (e) { /* da igual */ }
    var ahora = Date.now();
    if (ahora - ultimoAviso < 100) return;
    ultimoAviso = ahora;
    enviar({ plane: "arrastre" });
  });

  window.addEventListener("drop", function (evento) {
    if (!traeArchivos(evento)) return;
    evento.preventDefault();
    var lista = evento.dataTransfer.files;
    var archivos = [];
    for (var i = 0; i < lista.length; i++) archivos.push(lista[i]);
    enviar({ plane: "soltar", archivos: archivos });
  });

  /* --- Alto ------------------------------------------------------------ */

  var ultimo = 0;

  /*
   * Se mide el cuerpo, nunca el elemento raiz: la raiz siempre ocupa al menos
   * lo que mide el marco, asi que un contenido corto nunca podria encoger y
   * quedaria un hueco vacio debajo.
   */
  function medir() {
    var cuerpo = document.body;
    if (!cuerpo) return;
    var estilo = getComputedStyle(cuerpo);
    var margenes =
      (parseFloat(estilo.marginTop) || 0) + (parseFloat(estilo.marginBottom) || 0);
    var alto = Math.ceil(Math.max(cuerpo.scrollHeight, cuerpo.offsetHeight) + margenes);
    if (alto < 8 || Math.abs(alto - ultimo) < 2) return;
    ultimo = alto;
    enviar({ plane: "height", value: alto });
  }

  function observarAlto() {
    medir();
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(medir);
      ro.observe(document.documentElement);
      if (document.body) ro.observe(document.body);
    }
    if (window.MutationObserver && document.body) {
      new MutationObserver(medir).observe(document.body, {
        childList: true, subtree: true, attributes: true, characterData: true
      });
    }
    window.addEventListener("load", medir);
    window.addEventListener("resize", medir);
    // Las tipografias y los iconos que vienen de fuera llegan tarde y mueven
    // el diseno cuando ya nadie estaba mirando.
    setTimeout(medir, 300);
    setTimeout(medir, 1500);
  }

  /* --- El cursor de seleccion ------------------------------------------ */
  /*
   * El documento vive dentro del marco, asi que el panel no puede escuchar el
   * raton aqui dentro: lo hace este guion, que ya tiene el canal montado en
   * las dos direcciones. El panel enciende el modo, aqui se ilumina lo que se
   * seleccionaria, y al hacer clic vuelve el elemento senalado.
   *
   * Mientras el modo esta encendido el clic se consume: no navega, no envia
   * formularios y no llega a ningun manejador del documento.
   */

  /*
   * Se senala lo que hay debajo del raton, sea lo que sea: un titulo, una
   * celda, una palabra suelta dentro de un parrafo. Antes solo contaban unos
   * pocos elementos con entidad --secciones, tablas, formularios-- y todo lo
   * demas subia al mas cercano de esa lista; en un documento hecho de
   * contenedores genericos eso acababa senalando la pagina entera cuando lo
   * que se estaba apuntando era un parrafo.
   *
   * Para lo que el raton no alcanza --el contenedor de algo, la seccion que
   * rodea al titulo-- estan las flechas: arriba ensancha al padre, abajo
   * vuelve. El recuadro va ensenando en cada paso lo que se llevaria.
   */

  /* Tope de HTML que viaja de un elemento senalado. */
  var TOPE_HTML = 12000;

  var NOMBRES = {
    section: "sección", article: "artículo", table: "tabla", form: "formulario",
    nav: "navegación", header: "encabezado", footer: "pie", aside: "lateral",
    ul: "lista", ol: "lista", figure: "figura", main: "contenido", div: "bloque",
    input: "campo", select: "selector", textarea: "campo de texto",
    button: "botón", fieldset: "grupo",
    h1: "título", h2: "título", h3: "título", h4: "título", h5: "título",
    h6: "título", p: "párrafo", li: "punto", a: "enlace", img: "imagen",
    svg: "gráfico", canvas: "lienzo", video: "video", picture: "imagen",
    span: "texto", strong: "texto", em: "texto", small: "texto", label: "rótulo",
    td: "celda", th: "celda", tr: "fila", thead: "cabecera", tbody: "cuerpo",
    tfoot: "pie de tabla",
    caption: "título de tabla", blockquote: "cita", pre: "código", code: "código",
    hr: "separador", iframe: "marco", details: "desplegable", summary: "resumen",
    dl: "lista", dt: "término", dd: "definición", legend: "título de grupo",
    option: "opción", optgroup: "grupo de opciones", figcaption: "pie de figura"
  };

  /* Los que no tienen texto propio del que sacar un nombre. */
  var MANDOS = { INPUT: 1, SELECT: 1, TEXTAREA: 1 };

  /* El color de la casa, tal como llega al documento con el tema. El valor de
     repuesto es por si el recuadro se dibuja antes del primer tema. */
  var ACENTO = "var(--color-accent-500, #6366f1)";

  var cursor = false;
  var marco = null;
  var rotulo = null;

  /* Lo ultimo que toco el raton, y cuantos padres se ha subido desde ahi. */
  var apuntado = null;
  var subidas = 0;

  /* Donde esta el raton, que es donde va el rotulo. Se guarda porque tambien
     se redibuja sin que el raton se mueva: al ensanchar con las flechas. */
  var ratonX = 0;
  var ratonY = 0;

  /* El recuadro que ilumina. Cuelga de la raiz y no del cuerpo: dentro del
     cuerpo despertaria al observador que mide el alto en cada movimiento. */
  function recuadro() {
    if (marco) return marco;
    marco = document.createElement("div");
    marco.setAttribute("data-plane-cursor", "");
    var s = marco.style;
    s.position = "fixed";
    s.pointerEvents = "none";
    s.zIndex = "2147483647";
    s.border = "1px solid " + ACENTO;
    s.background = "color-mix(in srgb, " + ACENTO + " 12%, transparent)";
    s.borderRadius = "3px";
    s.display = "none";
    document.documentElement.appendChild(marco);
    return marco;
  }

  /* El rotulo que dice que etiqueta se esta senalando: "div", "span". Va junto
     al raton y no pegado al recuadro, porque lo que se quiere saber es que hay
     debajo del cursor, y en un contenedor grande el borde queda lejos de donde
     se esta mirando. Lleva sus medidas escritas una a una para que las hojas
     del documento no se lo lleven por delante. */
  function letrero() {
    if (rotulo) return rotulo;
    rotulo = document.createElement("div");
    rotulo.setAttribute("data-plane-cursor-rotulo", "");
    var s = rotulo.style;
    s.position = "fixed";
    s.pointerEvents = "none";
    s.zIndex = "2147483647";
    s.background = ACENTO;
    s.color = "#fff";
    s.font = "500 11px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif";
    s.letterSpacing = "0";
    s.textTransform = "none";
    s.boxSizing = "content-box";
    s.padding = "1px 6px";
    s.borderRadius = "4px";
    s.whiteSpace = "nowrap";
    s.boxShadow = "0 1px 4px rgba(0, 0, 0, 0.25)";
    s.display = "none";
    document.documentElement.appendChild(rotulo);
    return rotulo;
  }

  function rotular(el) {
    var tag = letrero();
    if (!el) { tag.style.display = "none"; return; }
    tag.textContent = el.tagName.toLowerCase();
    /* Se ensena antes de medirlo: escondido no tiene ancho, y sin el ancho no
       se sabe si cabe a la derecha del raton o hay que pasarlo al otro lado. */
    tag.style.display = "block";
    var ancho = tag.offsetWidth;
    var alto = tag.offsetHeight;
    var x = ratonX + 14;
    var y = ratonY + 16;
    if (x + ancho > window.innerWidth - 4) x = ratonX - ancho - 10;
    if (y + alto > window.innerHeight - 4) y = ratonY - alto - 10;
    tag.style.left = (x < 4 ? 4 : x) + "px";
    tag.style.top = (y < 4 ? 4 : y) + "px";
  }

  function iluminar(el) {
    var caja = recuadro();
    rotular(el);
    if (!el) { caja.style.display = "none"; return; }
    var r = el.getBoundingClientRect();
    caja.style.display = "block";
    caja.style.left = r.left + "px";
    caja.style.top = r.top + "px";
    caja.style.width = r.width + "px";
    caja.style.height = r.height + "px";
  }

  /* Un elemento de verdad del documento, no el recuadro ni la raiz. */
  function valido(nodo) {
    return !!nodo && nodo.nodeType === 1 &&
      nodo !== document.documentElement && nodo !== marco && nodo !== rotulo;
  }

  /*
   * El elemento senalado: lo que hay bajo el raton, subido tantos padres como
   * flechas se hayan pulsado. El cuerpo entra tambien --a veces lo que se
   * quiere cambiar es la pagina entera-- pero solo si se llega a el subiendo,
   * nunca por apuntar a un hueco vacio.
   */
  function candidato() {
    var el = apuntado;
    if (!valido(el)) return null;
    for (var i = 0; i < subidas; i++) {
      var padre = el.parentNode;
      if (!valido(padre)) break;
      el = padre;
    }
    return el;
  }

  /* Cuantos padres se puede subir todavia desde donde esta el raton. */
  function cabeSubir() {
    var el = candidato();
    return !!el && valido(el.parentNode);
  }

  /* Como se le llama en la conversacion: "tabla Clientes", "seccion Precios". */
  /*
   * Un mando no tiene texto dentro del que sacar un nombre: lo que lo nombra
   * esta fuera --su etiqueta-- o en sus atributos. Sin esto, tres campos
   * seguidos darian tres badges que dicen "campo" y no se distinguirian.
   */
  function nombreDeMando(el) {
    var id = el.getAttribute("id");
    if (id) {
      try {
        var puesta = document.querySelector('label[for="' + id.replace(/"/g, '\\\\"') + '"]');
        if (puesta && (puesta.textContent || "").trim()) return puesta.textContent.trim();
      } catch (e) { /* un id raro no rompe el nombre */ }
    }
    var cerca = el.closest ? el.closest("label") : null;
    if (cerca && (cerca.textContent || "").trim()) return cerca.textContent.trim();

    return (el.getAttribute("placeholder") || el.getAttribute("name") ||
      el.getAttribute("type") || "").trim();
  }

  function etiqueta(el) {
    var base = NOMBRES[el.tagName.toLowerCase()] || el.tagName.toLowerCase();
    var texto = "";

    if (MANDOS[el.tagName] === 1) {
      texto = nombreDeMando(el);
    } else {
      var titulo = el.querySelector("h1,h2,h3,h4,h5,h6,caption,legend,summary");
      texto = titulo ? (titulo.textContent || "").trim() : "";
    }

    if (!texto) texto = (el.getAttribute("aria-label") || "").trim();
    /*
     * El texto que tiene dentro, aunque sea largo: se recorta mas abajo. Un
     * parrafo o una celda no llevan titulo del que sacar el nombre, y sin sus
     * primeras palabras tres parrafos seguidos darian tres badges iguales.
     */
    if (!texto) texto = (el.textContent || "").trim().replace(/\\s+/g, " ");
    if (!texto) texto = (el.getAttribute("alt") || el.getAttribute("title") || "").trim();
    texto = texto.replace(/\\s+/g, " ");
    if (texto.length > 32) texto = texto.slice(0, 32) + "...";
    return texto ? base + " " + texto : base;
  }

  function indice(el) {
    var n = 1;
    var hermano = el;
    while ((hermano = hermano.previousElementSibling)) {
      if (hermano.tagName === el.tagName) n++;
    }
    return n;
  }

  /*
   * Donde esta, en forma de selector que el servidor pueda resolver sobre el
   * documento guardado. Un ancla estable --un nombre de bloque, un id unico--
   * corta la ruta ahi mismo: mas corta y mas resistente a lo que se inserte
   * por encima. Todo lo inyectado al servir la pagina va en la cabeza, asi que
   * una ruta anclada en el cuerpo vale igual aqui que alli.
   */
  function ruta(el) {
    var partes = [];
    var nodo = el;
    while (nodo && nodo.nodeType === 1 && nodo !== document.documentElement) {
      var nombre = nodo.getAttribute("data-plane");
      if (nombre) {
        partes.unshift('[data-plane="' + nombre + '"]');
        return partes.join(" > ");
      }
      if (nodo === document.body) {
        partes.unshift("body");
        return partes.join(" > ");
      }
      var id = nodo.getAttribute("id");
      if (id && /^[A-Za-z][\\w-]*$/.test(id) && document.querySelectorAll("#" + id).length === 1) {
        partes.unshift("#" + id);
        return partes.join(" > ");
      }
      partes.unshift(nodo.tagName.toLowerCase() + ":nth-of-type(" + indice(nodo) + ")");
      nodo = nodo.parentNode;
    }
    return partes.join(" > ");
  }

  /*
   * Lo senalado, con donde esta y lo que tiene ahora. El HTML sale del DOM ya
   * parseado: exacto y gratis, sin que el servidor tenga que reconstruirlo.
   * Si es enorme va recortado, y se dice que va recortado.
   */
  function señalar(el) {
    var html = el.outerHTML || "";
    var recortado = html.length > TOPE_HTML;
    enviar({
      plane: "picked",
      nombre: el.getAttribute("data-plane") || "",
      etiqueta: etiqueta(el),
      tag: el.tagName.toLowerCase(),
      ruta: ruta(el),
      html: recortado ? html.slice(0, TOPE_HTML) : html,
      recortado: recortado
    });
  }

  function alMover(evento) {
    if (!cursor) return;
    ratonX = evento.clientX;
    ratonY = evento.clientY;
    var destino = evento.target;
    /* El hueco vacio de la pagina no senala nada: para llevarse el cuerpo
       entero se apunta a algo y se sube con las flechas. */
    if (destino === document.body || destino === document.documentElement) {
      apuntado = null;
      subidas = 0;
      iluminar(null);
      return;
    }
    /* Al cambiar de elemento se vuelve a lo mas hondo: lo ensanchado valia
       para lo que se estaba mirando, no para lo siguiente. */
    if (destino !== apuntado) {
      apuntado = destino;
      subidas = 0;
    }
    iluminar(candidato());
  }

  /* Se para en la captura: asi no llega ni al documento ni al manejador de
     enlaces de mas abajo, que es el que hoy convierte un clic en navegacion. */
  function tragar(evento) {
    if (!cursor) return;
    evento.preventDefault();
    evento.stopPropagation();
    if (evento.stopImmediatePropagation) evento.stopImmediatePropagation();
  }

  /*
   * Un clic, un elemento: en cuanto algo queda senalado el cursor se apaga
   * solo. Quien quiera senalar otro vuelve a encender el boton, y asi el
   * documento no se queda en modo cursor sin que nadie lo haya pedido.
   */
  function alElegir(evento) {
    if (!cursor) return;
    tragar(evento);
    /* El clic manda sobre lo ensanchado solo si es el mismo elemento: si el
       raton se movio despues, lo que vale es donde esta ahora. */
    if (evento.target !== apuntado) {
      apuntado = evento.target;
      subidas = 0;
    }
    var el = candidato();
    if (!el) return;
    señalar(el);
    modoCursor(false);
    enviar({ plane: "picker-off" });
  }

  /*
   * Las flechas ensanchan y estrechan lo senalado sin mover el raton. Es lo
   * unico que el raton no puede hacer solo: apuntar a un contenedor cuando
   * todo su interior esta ocupado por sus hijos.
   */
  function alTeclear(evento) {
    if (!cursor) return;

    if (evento.key === "Escape" || evento.keyCode === 27) {
      evento.preventDefault();
      evento.stopPropagation();
      modoCursor(false);
      enviar({ plane: "picker-off" });
      return;
    }

    var arriba = evento.key === "ArrowUp" || evento.keyCode === 38;
    var abajo = evento.key === "ArrowDown" || evento.keyCode === 40;
    if (!arriba && !abajo) return;
    if (!apuntado) return;

    evento.preventDefault();
    evento.stopPropagation();

    nivel(arriba ? 1 : -1);
  }

  function nivel(paso) {
    if (!cursor || !apuntado) return;
    if (paso > 0) {
      if (!cabeSubir()) return;
      subidas++;
    } else {
      if (subidas === 0) return;
      subidas--;
    }
    iluminar(candidato());
  }

  function alSalir() {
    if (!cursor) return;
    apuntado = null;
    subidas = 0;
    iluminar(null);
  }

  function modoCursor(activo) {
    if (cursor === activo) return;
    cursor = activo;

    var manera = activo ? "addEventListener" : "removeEventListener";
    document[manera]("mousemove", alMover, true);
    document[manera]("click", alElegir, true);
    document[manera]("mousedown", tragar, true);
    document[manera]("mouseup", tragar, true);
    document[manera]("keydown", alTeclear, true);
    document[manera]("mouseleave", alSalir, true);
    window[manera]("scroll", alSalir, true);

    document.documentElement.style.cursor = activo ? "crosshair" : "";
    if (!activo) {
      apuntado = null;
      subidas = 0;
      iluminar(null);
    }
  }

  /* --- Mensajes del panel ---------------------------------------------- */

  window.addEventListener("message", function (evento) {
    /*
     * Solo se atiende lo que manda quien dibuja este documento. Lo que llegue
     * de cualquier otra ventana no es del panel: contestar a un "result" ajeno
     * seria dejar que alguien de fuera resuelva una peticion de datos con lo
     * que quiera.
     */
    if (evento.source !== parent) return;

    var datos = evento.data;
    if (!datos || typeof datos !== "object") return;

    if (datos.plane === "theme") { pintar(datos); return; }

    if (datos.plane === "cursor") { modoCursor(datos.activo === true); return; }

    /* Las flechas pulsadas fuera del marco, donde suele estar el foco. */
    if (datos.plane === "cursor-nivel") { nivel(datos.paso > 0 ? 1 : -1); return; }

    if (datos.plane === "result") {
      var espera = pendientes[datos.id];
      if (!espera) return;
      delete pendientes[datos.id];
      if (datos.ok) espera.resolve(datos.data);
      else {
        /*
         * El codigo va colgado del error y no dentro del texto: la pagina que
         * quiera distinguir un caso --guardar sin sesion, por ejemplo-- lo
         * mira por su nombre y no leyendo el mensaje, que es lo unico que se
         * puede traducir sin romper a nadie.
         */
        var fallo = new Error(datos.error || "No se pudo completar la operacion");
        if (datos.codigo) fallo.codigo = datos.codigo;
        espera.reject(fallo);
      }
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observarAlto);
  } else {
    observarAlto();
  }
  enviar({ plane: "ready" });
})();`;

/**
 * Huella de lo que se inyecta. El documento guardado no cambia, pero el
 * puente y las hojas si: sin esto, una correccion del puente --o del
 * catalogo de componentes-- se quedaria fuera de todo bloque que el
 * navegador ya tuviera guardado.
 */
export const BRIDGE_TAG = new Bun.CryptoHasher("sha256")
  .update(BRIDGE_SCRIPT + PAGE_STYLES + ICON_FONT_URL)
  .digest("hex")
  .slice(0, 12);

const escapeAttr = (value: string) => value.replace(/"/g, "&quot;");

/**
 * Lo que se inyecta al principio del documento.
 *
 * Casi todo va siempre. Las graficas no: son ciento y pico kilobytes que solo
 * hacen falta donde hay algo que dibujar, asi que esa linea solo entra si el
 * documento la nombra.
 */
const head = (origin: string, content: string) =>
  `<base href="${escapeAttr(origin)}/">\n` +
  `<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
  `<link data-plane="iconos" rel="stylesheet" href="${ICON_FONT_URL}">\n` +
  `<link data-plane="base" rel="stylesheet" href="${STYLES_PATH}">\n` +
  `<script data-plane="puente">${BRIDGE_SCRIPT}<` +
  `/script>\n` +
  (USES_CHARTS.test(content)
    ? `${CHARTS_REF.replace("<script ", '<script data-plane="graficas" ')}\n`
    : "");

/**
 * Envuelve el documento guardado con el puente.
 *
 * No toca nada mas: lo que escribio el constructor se conserva tal cual, y
 * lo inyectado va delante para que su estilo pueda sobreescribirlo.
 *
 * Es idempotente: si el documento ya lleva una inyeccion anterior (por un
 * error que la guardo), se reemplaza en lugar de acumular. Envolver un
 * documento ya envuelto duplicaria la hoja base y el puente y engordaria el
 * bloque con cada ciclo.
 */
function stripInjected(content: string): string {
  return (
    content
      // La forma vieja era un <style> con la hoja pegada dentro; la de ahora
      // es un <link>. Se quitan las dos: hay documentos guardados con cada una.
      .replace(/<style\s[^>]*data-plane="base"[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<link\s[^>]*data-plane="base"[^>]*>/gi, "")
      .replace(/<script\s[^>]*data-plane="puente"[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<script\s[^>]*data-plane="graficas"[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<link\s[^>]*data-plane="iconos"[^>]*>/gi, "")
  );
}

export function wrapDocument(content: string, origin: string): string {
  const clean = stripInjected(content);
  const inject = head(origin, clean);

  const headOpen = /<head[^>]*>/i.exec(clean);
  if (headOpen) {
    const at = headOpen.index + headOpen[0].length;
    return `${clean.slice(0, at)}\n${inject}${clean.slice(at)}`;
  }

  const htmlOpen = /<html[^>]*>/i.exec(clean);
  if (htmlOpen) {
    const at = htmlOpen.index + htmlOpen[0].length;
    return `${clean.slice(0, at)}\n<head>\n${inject}</head>${clean.slice(at)}`;
  }

  // Un trozo suelto de HTML: se le arma el documento alrededor.
  return `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n${inject}</head>\n<body>\n${clean}\n</body>\n</html>`;
}
