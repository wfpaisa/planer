/**
 * Las gráficas de la casa.
 *
 * Una página que pinta un panel de indicadores no deberia tener que decidir de
 * que color va cada serie, cuanto mide una barra ni como se ve una etiqueta de
 * eje: si lo decide cada página, dos paneles de la misma aplicación no se
 * parecen. Aquí esta esa decision, una sola vez, encima de Chart.js.
 *
 * Lo que se sirve en `/plane/graficas.js` es la libreria y este guion pegados,
 * en ese orden. El guion deja `plane.grafica`, `plane.colores` y `plane.paleta`
 * en el mismo sitio donde ya viven los datos, y vuelve a pintar cada gráfica
 * cuando la aplicación cambia de paleta o de modo.
 *
 * Los colores de serie salen de la paleta de la aplicación: los cuatro
 * `--chart-1..4` que trae cada paleta (`styles/palettes.css`), mas cuatro
 * fijos para cuando hacen falta mas de cuatro series. Repartir la escala del
 * acento entre varias series daria un degradado, no identidades -- por eso
 * no se usa `--color-accent-500` aquí --, pero `--chart-1..4` ya son cuatro
 * tonos pensados para distinguirse entre si, no un degradado de uno solo.
 *
 * La excepcion son las paletas monocromas (`theme-mono-*`): sus cuatro
 * `--chart-1..4` son el mismo tono en distinta luminosidad, así que una
 * gráfica de esa aplicación con varias series se ve en una sola familia de
 * color. Es la eleccion de quien uso esa paleta, no un error de la gráfica.
 *
 * El acento manda cuando hay una sola serie: ahi no hay nada que distinguir
 * y la gráfica es de la aplicación.
 */

import { CHARTS_PATH } from "../../shared/htmlContract.ts";

/**
 * Como se reconoce un documento que dibuja algo.
 *
 * El guion pesa ciento y pico kilobytes, así que no va en toda página: va en
 * las que lo nombran. Quien sirve un documento --una página o un documento
 * suelto-- pregunta con esto y pone la línea si hace falta.
 */
export const USES_CHARTS = /\bplane\s*\.\s*grafica\s*\(|\bnew\s+Chart\s*\(/;

/** La línea que lo trae, con el comentario que dice para que sirve. */
export const CHARTS_REF =
  `<!-- Gráficas de Planer: Chart.js usa los colores de la aplicación mediante plane.grafica -->\n` +
  `<script src="${CHARTS_PATH}"></script>`;

/** Los cuatro de mas, para cuando una gráfica trae mas series que la paleta. */
const SERIES_EXTRA = [
  "oklch(0.789 0.185 152)",
  "oklch(0.719 0.177 16.8)",
  "oklch(0.8 0.15 75)",
  "oklch(65.717% 0.1888 301.434)",
];

/** Los colores de estado. Son fijos: no se reparten como series. */
const ESTADOS = {
  bien: "#0ca30c",
  aviso: "#fab219",
  serio: "#ec835a",
  critico: "#d03b3b",
};

export const CHART_ADAPTER = `(function () {
  "use strict";

  if (!window.Chart) return;
  var Chart = window.Chart;

  var SERIE_EXTRA = ${JSON.stringify(SERIES_EXTRA)};
  var ESTADOS = ${JSON.stringify(ESTADOS)};

  /*
   * De donde cuelga todo.
   *
   * Este archivo y el del puente son dos, y cual de los dos corre primero no
   * lo decide ninguno: depende de en que orden quedaron las líneas en el
   * documento. Por eso aqui no se guarda una referencia al objeto --el puente
   * puede reemplazarlo después y dejarnos hablando con uno muerto--, sino que
   * se pregunta por el cada vez. Si todavía no hay ninguno, se crea: una
   * gráfica sin datos de la plataforma sigue siendo una gráfica que se puede
   * pintar.
   */
  function P() {
    return window.plane || (window.plane = {});
  }

  /* ------------------------------------------------------------------ */
  /* Colores                                                             */
  /* ------------------------------------------------------------------ */

  /*
   * El lienzo no entiende \`var(--ink)\` ni \`color-mix(...)\`: hay que darle un
   * color ya resuelto. Se resuelve pintando un pixel y leyendolo, que es lo
   * único que funciona igual con \`oklch\`, con \`hsl\` y con un nombre suelto.
   */
  var sonda = null;
  var resueltos = {};

  function componentes(valor) {
    if (resueltos[valor]) return resueltos[valor];
    var salida = [0, 0, 0];
    try {
      if (!sonda) {
        var lienzo = document.createElement("canvas");
        lienzo.width = 1;
        lienzo.height = 1;
        sonda = lienzo.getContext("2d", { willReadFrequently: true });
      }
      sonda.clearRect(0, 0, 1, 1);
      sonda.fillStyle = "#000000";
      sonda.fillStyle = valor;
      sonda.fillRect(0, 0, 1, 1);
      var d = sonda.getImageData(0, 0, 1, 1).data;
      salida = [d[0], d[1], d[2]];
    } catch (e) { /* un color que no se entiende se queda en negro */ }
    resueltos[valor] = salida;
    return salida;
  }

  /** El mismo color, con transparencia. Nunca un \`rgba\` inventado a mano. */
  function conAlfa(valor, alfa) {
    var c = componentes(valor);
    return "rgba(" + c[0] + ", " + c[1] + ", " + c[2] + ", " + alfa + ")";
  }

  /*
   * Cualquier color válido, pasado a un \`rgb()\` de toda la vida.
   *
   * Chart.js trae su propio interprete de colores -- lo usa, por ejemplo, para
   * resolver el color de un arco cuando el mouse pasa por encima -- y ese
   * interprete no entiende \`oklch(...)\`: es justo lo que devuelve el
   * navegador al leer una variable de la paleta, porque las paletas de la casa
   * estan escritas en ese formato. Sin poder leerlo, Chart.js no pinta nada, y
   * el trozo se ve negro. El lienzo si entiende \`oklch(...)\` siempre, asi que
   * el color se pinta ahi y se lee el pixel de vuelta.
   */
  function comoRgb(valor) {
    var c = componentes(valor);
    return "rgb(" + c[0] + ", " + c[1] + ", " + c[2] + ")";
  }

  /*
   * El relleno de una línea: del color de la serie a transparente, de arriba a
   * abajo. Un color plano debajo de la línea se ve como una banda de tinta
   * pareja; el degradado se lee como una sombra que cae desde el trazo, que es
   * lo que trae la galeria de demostracion.
   *
   * Va como función -- lo que Chart.js llama una opción "scriptable" -- porque
   * el gradiente necesita el alto real del lienzo, y ese alto no se conoce
   * hasta que la gráfica mide su area por primera vez.
   */
  function relleno(color) {
    return function (contexto) {
      var area = contexto.chart.chartArea;
      if (!area) return "transparent";
      var g = contexto.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
      g.addColorStop(0, conAlfa(color, 0.24));
      g.addColorStop(1, conAlfa(color, 0));
      return g;
    };
  }

  /** Los cuatro de mas, normalizados una sola vez: ver \`comoRgb\`. */
  var SERIE_EXTRA_RGB = SERIE_EXTRA.map(comoRgb);

  /** Una variable del tema, ya resuelta, con su respaldo si todavía no llego. */
  function variable(nombre, respaldo) {
    var valor = "";
    try {
      valor = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
    } catch (e) { /* da igual: queda el respaldo */ }
    return valor || respaldo;
  }

  /*
   * Una variable de *color*, resuelta de verdad.
   *
   * \`getComputedStyle(raiz).getPropertyValue("--algo")\` devuelve el valor tal
   * como se escribio, no el que se usa: una paleta con \`light-dark()\` o
   * \`color-mix()\` --las que trae cualquier app con color propio, en
   * css/palettes.css-- vuelve como ese texto sin resolver, y ni el lienzo ni
   * Chart.js saben pintar con \`"light-dark(...)"\`. Se calla, y la barra sale
   * negra. La única forma de que el navegador SI lo resuelva es ponerlo en una
   * propiedad de verdad --\`color\`-- de un elemento de verdad, y leer ahi.
   */
  var sondaColor = null;

  function colorVariable(nombre, respaldo) {
    var valor = "";
    try {
      if (!sondaColor) {
        sondaColor = document.createElement("span");
        sondaColor.style.cssText = "position:absolute;left:-9999px;top:-9999px;visibility:hidden;";
        document.documentElement.appendChild(sondaColor);
      }
      sondaColor.style.color = "";
      sondaColor.style.color = "var(" + nombre + ")";
      valor = getComputedStyle(sondaColor).color;
    } catch (e) { /* da igual: queda el respaldo */ }
    // Normalizado a rgb(): ver \`comoRgb\`, aqui al lado, para el porque.
    return valor ? comoRgb(valor) : respaldo;
  }

  /** Una medida en \`rem\` pasada a pixeles, que es lo que pide el lienzo. */
  function pixeles(valor, respaldo) {
    var n = parseFloat(valor);
    if (!isFinite(n)) return respaldo;
    if (/rem\\s*$/.test(valor)) {
      var raiz = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      return Math.round(n * raiz);
    }
    return Math.round(n);
  }

  /** Todo lo que una gráfica necesita saber del tema, resuelto de una vez. */
  function leerPaleta() {
    var oscuro = P().modo === "dark";
    var series = [
      colorVariable("--chart-1", oscuro ? "#3987e5" : "#2a78d6"),
      colorVariable("--chart-2", oscuro ? "#d95926" : "#eb6834"),
      colorVariable("--chart-3", oscuro ? "#199e70" : "#1baf7a"),
      colorVariable("--chart-4", oscuro ? "#c98500" : "#eda100")
    ].concat(SERIE_EXTRA_RGB);
    return {
      modo: oscuro ? "dark" : "light",
      series: series,
      estados: ESTADOS,
      acento: colorVariable("--color-accent-500", oscuro ? "#3987e5" : "#2a78d6"),
      superficie: colorVariable("--surface-card", oscuro ? "#1a1a19" : "#fcfcfb"),
      tinta: colorVariable("--ink", oscuro ? "#ffffff" : "#0b0b0b"),
      tintaSuave: colorVariable("--ink-soft", oscuro ? "#c3c2b7" : "#52514e"),
      tintaTenue: colorVariable("--ink-faint", oscuro ? "#898781" : "#898781"),
      linea: colorVariable("--line", oscuro ? "#2c2c2a" : "#e1e0d9"),
      borde: colorVariable("--line", oscuro ? "#383835" : "#c3c2b7"),
      letra: variable("--font-sans", "system-ui, -apple-system, sans-serif"),
      cuerpo: pixeles(variable("--type-sm", "0.8125rem"), 13),
      menuda: pixeles(variable("--type-xs", "0.75rem"), 12),
      radio: pixeles(variable("--radius-card", "0.75rem"), 12)
    };
  }

  var paleta = leerPaleta();

  /**
   * Los colores de \`n\` series.
   *
   * Una sola serie va del color de la aplicación: no hay nada de que
   * distinguirla y asi la gráfica se ve de la casa. Dos o mas van de la paleta
   * fija, siempre en el mismo orden, para que un filtro que deje fuera una
   * serie no repinte las que quedan.
   */
  function colores(n) {
    var cuantos = Math.max(1, n || 1);
    if (cuantos === 1) return [paleta.acento];
    var salida = [];
    for (var i = 0; i < cuantos; i++) salida.push(paleta.series[i % paleta.series.length]);
    if (cuantos > paleta.series.length && window.console) {
      console.warn(
        "plane.grafica: " + cuantos + " series es mas de lo que se puede distinguir por color. " +
        "Junta la cola en \\"Otros\\" o parte la grafica en varias."
      );
    }
    return salida;
  }

  /* ------------------------------------------------------------------ */
  /* Numeros                                                             */
  /* ------------------------------------------------------------------ */

  var quieto = false;
  try {
    quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) { /* si no se puede preguntar, se anima */ }

  function formato(valor, opciones) {
    if (valor === null || valor === undefined || valor === "") return "";
    var n = Number(valor);
    if (!isFinite(n)) return String(valor);
    try {
      return new Intl.NumberFormat("es", opciones).format(n);
    } catch (e) {
      return String(n);
    }
  }

  function numero(valor) { return formato(valor, { maximumFractionDigits: 2 }); }

  /** En un eje los numeros largos estorban: a partir de diez mil van cortos. */
  function enEje(valor) {
    var n = Number(valor);
    if (!isFinite(n)) return String(valor);
    return Math.abs(n) >= 10000
      ? formato(n, { notation: "compact", maximumFractionDigits: 1 })
      : formato(n, { maximumFractionDigits: 2 });
  }

  /* ------------------------------------------------------------------ */
  /* El aspecto de la casa                                               */
  /* ------------------------------------------------------------------ */

  function aplicarDefaults() {
    var p = paleta;

    Chart.defaults.font.family = p.letra;
    Chart.defaults.font.size = p.cuerpo;
    Chart.defaults.color = p.tintaSuave;
    Chart.defaults.borderColor = p.linea;
    Chart.defaults.responsive = true;
    Chart.defaults.animation.duration = quieto ? 0 : 260;
    Chart.defaults.animation.easing = "easeOutQuart";
    Chart.defaults.animations.colors = false;

    /* La leyenda: puntos pequenos, texto de la casa, alineada a la izquierda
       con el título de la sección, y aire por debajo. */
    var leyenda = Chart.defaults.plugins.legend;
    leyenda.position = "top";
    leyenda.align = "start";
    leyenda.labels.color = p.tintaSuave;
    leyenda.labels.usePointStyle = true;
    leyenda.labels.pointStyle = "circle";
    leyenda.labels.boxWidth = 8;
    leyenda.labels.boxHeight = 8;
    leyenda.labels.padding = 16;
    leyenda.labels.font = { size: p.menuda };

    /* El cartel: una tarjeta como las demas, no una caja negra. */
    var cartel = Chart.defaults.plugins.tooltip;
    cartel.backgroundColor = p.superficie;
    cartel.titleColor = p.tintaTenue;
    cartel.bodyColor = p.tinta;
    cartel.borderColor = p.borde;
    cartel.borderWidth = 1;
    cartel.cornerRadius = p.radio;
    cartel.padding = { top: 10, right: 12, bottom: 10, left: 12 };
    cartel.titleFont = { size: p.menuda, weight: "500" };
    cartel.bodyFont = { size: p.cuerpo, weight: "500" };
    cartel.usePointStyle = true;
    cartel.boxWidth = 8;
    cartel.boxHeight = 8;
    cartel.boxPadding = 6;
    cartel.displayColors = true;

    Chart.defaults.plugins.title.display = false;

    /* Las líneas del fondo se ven poco a propósito: son una referencia, no
       parte del dibujo. Y solo las del eje de los valores. */
    Chart.defaults.scale.grid.color = p.linea;
    Chart.defaults.scale.grid.drawTicks = false;
    Chart.defaults.scale.grid.lineWidth = 1;
    Chart.defaults.scale.border.display = false;
    Chart.defaults.scale.ticks.color = p.tintaTenue;
    Chart.defaults.scale.ticks.padding = 8;
    Chart.defaults.scale.ticks.font = { size: p.menuda };
    // El eje de las categorias no trae \`grid\` de fabrica: hay que poner el
    // objeto entero, no una propiedad dentro de el.
    Chart.defaults.scales.category.grid = { display: false };
    Chart.defaults.scales.linear.ticks.callback = function (valor) { return enEje(valor); };
    Chart.defaults.scales.logarithmic.ticks.callback = function (valor) { return enEje(valor); };

    Chart.defaults.elements.line.capBezierPoints = true;
    Chart.defaults.elements.point.hoverBorderWidth = 2;
    Chart.defaults.elements.arc.borderWidth = 2;
    Chart.defaults.elements.arc.borderColor = p.superficie;
  }

  /* ------------------------------------------------------------------ */
  /* Dos anadidos                                                        */
  /* ------------------------------------------------------------------ */

  /*
   * La guia vertical. Quien mira apunta a una fecha, no a una línea de 2px:
   * la guia dice a que punto del eje corresponde lo que esta leyendo.
   */
  var GUIA = {
    id: "planeGuia",
    beforeDatasetsDraw: function (chart) {
      if (chart.config.type !== "line") return;
      var activos = chart.tooltip && chart.tooltip.getActiveElements
        ? chart.tooltip.getActiveElements()
        : [];
      if (!activos.length) return;
      var x = activos[0].element.x;
      var area = chart.chartArea;
      var ctx = chart.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.strokeStyle = paleta.borde;
      ctx.moveTo(x, area.top);
      ctx.lineTo(x, area.bottom);
      ctx.stroke();
      ctx.restore();
    }
  };

  /*
   * El hueco vacío. Una gráfica sin datos que dibuja los ejes y nada mas
   * parece rota; con una frase en medio se entiende que no hay nada que
   * ensenar todavía.
   */
  function sinDatos(chart) {
    var datos = chart.data.datasets || [];
    for (var i = 0; i < datos.length; i++) {
      if ((datos[i].data || []).length) return false;
    }
    return true;
  }

  var VACIO = {
    id: "planeVacio",
    /* Unos ejes dibujados alrededor de nada --y encima con una escala de
       mentira, de 0 a 1-- se leen como una gráfica rota. Se quitan mientras no
       haya datos y vuelven solos en cuanto llegan. */
    beforeUpdate: function (chart) {
      var ejes = chart.options.scales;
      if (!ejes) return;
      var fuera = sinDatos(chart);
      for (var nombre in ejes) {
        var eje = ejes[nombre];
        if (!eje) continue;
        if (fuera) {
          // Se guarda lo que dijo la página para devolverselo tal cual.
          if (!("planeVisible" in eje)) eje.planeVisible = eje.display;
          eje.display = false;
        } else if ("planeVisible" in eje) {
          eje.display = eje.planeVisible;
          delete eje.planeVisible;
        }
      }
    },
    afterDraw: function (chart, args, opciones) {
      if (!sinDatos(chart)) return;
      var area = chart.chartArea;
      if (!area) return;
      var ctx = chart.ctx;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = paleta.tintaSuave;
      ctx.font = "500 " + paleta.cuerpo + "px " + paleta.letra;
      ctx.fillText(
        (opciones && opciones.texto) || "Todavía no hay datos que enseñar.",
        (area.left + area.right) / 2,
        (area.top + area.bottom) / 2
      );
      ctx.restore();
    }
  };

  /*
   * Recolorea en cada \`chart.update()\`, no solo al crear la gráfica.
   *
   * Una página casi siempre crea la gráfica vacía y la llena después, cuando
   * llega la respuesta de \`plane.listar\`: entre una cosa y otra cambia
   * CUANTAS categorias hay, y una barra categorica o un pie necesitan tantos
   * colores como categorias, no los que había cuando no había ninguna.
   * \`colorear\` ya sabe cuales colores son de la casa (\`planeCasa_*\`) y deja
   * intactos los que la página puso por su cuenta, asi que repintar en cada
   * \`update()\` es seguro: a quien coloreo sus barras a mano --como el
   * semaforo de gravedad-- no le toca nada.
   */
  var RECOLOR = {
    id: "planeRecolor",
    beforeUpdate: function (chart) { repintar(chart); }
  };

  Chart.register(GUIA, VACIO, RECOLOR);

  /* ------------------------------------------------------------------ */
  /* Mezclar lo que se pide con lo de la casa                            */
  /* ------------------------------------------------------------------ */

  var esObjeto = function (v) {
    return v && typeof v === "object" && !Array.isArray(v);
  };

  /** Une dos objetos hondos. Lo que pidio quien escribe la página manda. */
  function unir(casa, pedido) {
    var salida = {};
    var nombre;
    for (nombre in casa) {
      if (Object.prototype.hasOwnProperty.call(casa, nombre)) salida[nombre] = casa[nombre];
    }
    for (nombre in pedido) {
      if (!Object.prototype.hasOwnProperty.call(pedido, nombre)) continue;
      salida[nombre] = esObjeto(salida[nombre]) && esObjeto(pedido[nombre])
        ? unir(salida[nombre], pedido[nombre])
        : pedido[nombre];
    }
    return salida;
  }

  var REDONDOS = { pie: 1, doughnut: 1, polarArea: 1 };

  /** Si la gráfica lleva las series apiladas, que es lo que abre el hueco. */
  function apilada(config) {
    var ejes = (config.options && config.options.scales) || {};
    for (var nombre in ejes) {
      if (ejes[nombre] && ejes[nombre].stacked) return true;
    }
    return false;
  }

  /**
   * Pinta un conjunto de datos con su color.
   *
   * Solo pone lo que no venga puesto: si la página eligio un color para una
   * serie --el color de un equipo, el de un semaforo-- se respeta.
   */
  /** Pone una medida solo si la página no la trae puesta. */
  function medida(serie, nombre, valor) {
    if (serie[nombre] === undefined) serie[nombre] = valor;
  }

  function pintarSerie(serie, tipo, color, hueco, unica) {
    var suyo = serie.type || tipo;
    serie.planeColor = color;

    if (REDONDOS[suyo]) {
      // Aqui cada punto es una categoria, no la serie entera.
      if (!serie.backgroundColor) {
        var cuantos = (serie.data || []).length;
        serie.backgroundColor = colores(Math.max(cuantos, 2)).slice(0, cuantos);
      }
      if (!serie.borderColor) serie.borderColor = paleta.superficie;
      return;
    }

    if (suyo === "line" || suyo === "radar") {
      /* Una línea de 2px, curvada solo lo justo --\`monotone\` no se pasa de
         largo, asi que nunca dibuja un valle donde no lo hay-- y sin puntos
         hasta que se senalan, con sitio de sobra para acertarles. */
      medida(serie, "borderWidth", 2);
      medida(serie, "cubicInterpolationMode", "monotone");
      medida(serie, "pointRadius", 0);
      medida(serie, "pointHoverRadius", 4);
      medida(serie, "pointHitRadius", 24);
      if (!serie.borderColor) serie.borderColor = color;
      if (!serie.backgroundColor) {
        serie.backgroundColor = suyo === "line" ? relleno(color) : conAlfa(color, 0.1);
      }
      medida(serie, "fill", true);
      if (!serie.pointBackgroundColor) serie.pointBackgroundColor = color;
      // El anillo del color del fondo separa el punto de la línea que cruza.
      if (!serie.pointBorderColor) serie.pointBorderColor = paleta.superficie;
      if (!serie.pointHoverBackgroundColor) serie.pointHoverBackgroundColor = color;
      if (!serie.pointHoverBorderColor) serie.pointHoverBorderColor = paleta.superficie;
      return;
    }

    /* Una barra fina con la punta redondeada y el pie recto. El tope es lo que
       deja aire entre una y otra: una barra que llena su hueco se ve tosca. */
    medida(serie, "maxBarThickness", 24);
    medida(serie, "borderRadius", 4);
    if (!serie.backgroundColor) {
      var puntos = (serie.data || []).length;
      /* Sin otra serie con la que compararla, cada barra es su propia
         categoria (un conductor, un producto): el color es lo que las separa
         a golpe de vista, igual que en un pie. Con dos o mas series el color
         ya distingue series, y una barra sola --o apilada-- no tiene
         categorias que separar. */
      serie.backgroundColor = (unica && puntos > 1) ? colores(puntos) : color;
    }
    if (!serie.hoverBackgroundColor) {
      serie.hoverBackgroundColor = Array.isArray(serie.backgroundColor)
        ? serie.backgroundColor.map(function (c) { return conAlfa(c, 0.82); })
        : conAlfa(serie.backgroundColor, 0.82);
    }
    // El hueco entre dos trozos que se tocan es del color del fondo: se ve
    // como aire, no como un borde dibujado alrededor de cada barra.
    if (hueco && !serie.borderColor) {
      serie.borderColor = paleta.superficie;
      serie.borderWidth = serie.borderWidth === undefined ? 2 : serie.borderWidth;
    }
  }

  /** Las propiedades de color que puede poner la casa. */
  var COLORES_SERIE = [
    "backgroundColor", "hoverBackgroundColor", "borderColor",
    "pointBackgroundColor", "pointBorderColor",
    "pointHoverBackgroundColor", "pointHoverBorderColor"
  ];

  /*
   * Colorear deja apuntado **el color que puso la casa**, no solo que lo puso.
   * Al cambiar de tema, un color que sigue siendo el que dejamos es de la
   * paleta vieja y hay que rehacerlo; uno distinto lo cambio la página por su
   * cuenta --el color de un equipo, el de un semaforo-- y no se toca.
   */
  function colorear(serie, tipo, color, hueco, unica) {
    var nombre;
    var i;
    for (i = 0; i < COLORES_SERIE.length; i++) {
      nombre = COLORES_SERIE[i];
      var nuestro = serie["planeCasa_" + nombre];
      if (nuestro !== undefined && serie[nombre] === nuestro) serie[nombre] = undefined;
    }

    var traia = {};
    for (i = 0; i < COLORES_SERIE.length; i++) {
      traia[COLORES_SERIE[i]] = serie[COLORES_SERIE[i]] !== undefined;
    }

    pintarSerie(serie, tipo, color, hueco, unica);

    for (i = 0; i < COLORES_SERIE.length; i++) {
      nombre = COLORES_SERIE[i];
      if (!traia[nombre] && serie[nombre] !== undefined) {
        serie["planeCasa_" + nombre] = serie[nombre];
      }
    }
  }

  /** Vuelve a pintar las series que coloreamos nosotros, con el tema de ahora. */
  function repintar(chart) {
    var series = chart.data.datasets || [];
    var hueco = apilada(chart.config);
    var tonos = colores(series.length);
    var unica = series.length === 1;
    for (var i = 0; i < series.length; i++) {
      if (!series[i].planeColor) continue;
      colorear(series[i], chart.config.type, tonos[i % tonos.length], hueco, unica);
    }
  }

  /* ------------------------------------------------------------------ */
  /* La orden                                                            */
  /* ------------------------------------------------------------------ */

  var vivas = [];

  /** Donde se dibuja: un lienzo, un selector, o una caja donde ponerle uno. */
  function lienzoDe(destino) {
    var nodo = typeof destino === "string" ? document.querySelector(destino) : destino;
    if (!nodo) throw new Error("plane.grafica: no encuentro donde dibujar.");
    if (nodo.tagName === "CANVAS") return nodo;
    var dentro = nodo.querySelector("canvas");
    if (dentro) return dentro;
    var lienzo = document.createElement("canvas");
    nodo.appendChild(lienzo);
    return lienzo;
  }

  /**
   * Una gráfica con el aspecto de la casa.
   *
   * Se le pasa donde va y la misma configuración de Chart.js de siempre. Lo
   * que no diga lo pone la casa: los colores, las medidas, la leyenda, el
   * cartel y el hueco vacío. Lo que si diga, manda.
   */
  function grafica(destino, config) {
    var lienzo = lienzoDe(destino);
    var previa = Chart.getChart ? Chart.getChart(lienzo) : null;
    // Volver a pintar encima de una gráfica viva deja dos dibujos peleandose
    // por el mismo lienzo. Para cambiar los datos esta \`chart.update()\`.
    if (previa) previa.destroy();

    var tipo = (config && config.type) || "bar";
    var datos = (config && config.data) || { labels: [], datasets: [] };
    var series = datos.datasets || [];
    var hueco = apilada(config || {});
    var tonos = colores(series.length);
    var unica = series.length === 1;

    for (var i = 0; i < series.length; i++) {
      colorear(series[i], tipo, tonos[i % tonos.length], hueco, unica);
    }

    /*
     * El alto. Si la caja donde vive ya tiene uno, la gráfica lo llena; si no
     * lo tiene, se le da una proporcion, porque una gráfica que mide el alto
     * de su contenedor y ademas lo estira crece sin parar en cada vuelta.
     */
    var caja = lienzo.parentNode;
    var alto = caja && caja.clientHeight ? caja.clientHeight : 0;
    var conAlto = alto > 60;

    var redonda = !!REDONDOS[tipo];
    var trozos = series.length && series[0].data ? series[0].data.length : 0;

    var casa = {
      responsive: true,
      maintainAspectRatio: !conAlto,
      aspectRatio: redonda ? 1.4 : 1.9,
      layout: { padding: redonda ? 4 : 0 },
      interaction: redonda
        ? { mode: "nearest", intersect: true }
        : { mode: "index", intersect: false },
      plugins: {
        // Con una sola serie la leyenda repite el título y ocupa sitio; con
        // dos o mas es lo único que dice cual es cual sin fiarlo al color. En
        // una tarta cada trozo es uno, asi que ahi se cuentan los trozos.
        legend: { display: redonda ? trozos > 1 : series.length > 1 },
        tooltip: {
          callbacks: {
            // Primero el número, que es lo que se vino a buscar; el nombre
            // de la serie va detras y mas discreto.
            label: function (ctx) {
              var valor = ctx.parsed;
              if (valor && typeof valor === "object") {
                valor = valor.y !== undefined ? valor.y : valor.r !== undefined ? valor.r : valor.x;
              }
              var nombre = (ctx.dataset && ctx.dataset.label) || ctx.label || "";
              var texto = numero(valor);
              return nombre ? texto + "  ·  " + nombre : texto;
            }
          }
        }
      }
    };

    if (!redonda) {
      casa.scales = {
        x: {
          grid: { display: false },
          /* Las etiquetas no se giran nunca: un nombre en diagonal cuesta de
             leer. Si no caben todas, se saltan las que sobran, que es lo que
             hace cualquier eje de tiempo decente. */
          ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 12 }
        },
        y: {
          beginAtZero: true,
          grid: { color: paleta.linea },
          // Media docena de referencias bastan. Un eje con quince líneas se
          // lee peor y ademas compite con lo que hay dibujado encima.
          ticks: { maxTicksLimit: 6 }
        }
      };
    }
    if (tipo === "doughnut") casa.cutout = "62%";

    var opciones = unir(casa, (config && config.options) || {});
    var chart = new Chart(lienzo, { type: tipo, data: datos, options: opciones });

    // Las que ya no existen se caen de la lista aqui también, y no solo al
    // cambiar de tema: una página que rehace sus gráficas al filtrar las
    // acumularia todas.
    var quedan = [];
    for (var v = 0; v < vivas.length; v++) {
      if (vivas[v].canvas && vivas[v].ctx) quedan.push(vivas[v]);
    }
    quedan.push(chart);
    vivas = quedan;
    return chart;
  }

  /* ------------------------------------------------------------------ */
  /* Ponerlo en su sitio                                                 */
  /* ------------------------------------------------------------------ */

  /*
   * Se vuelve a colgar cada vez que hay motivo para sospechar que el objeto
   * cambio de manos --al cargar, al llegar el puente, al cambiar el tema--.
   * Es barato y es lo que hace que el orden de los dos guiones de igual.
   */
  function exponer() {
    var api = P();
    api.grafica = grafica;
    api.colores = colores;
    api.numero = numero;
    api.paleta = paleta;
  }

  /* ------------------------------------------------------------------ */
  /* Cuando cambia el tema                                               */
  /* ------------------------------------------------------------------ */

  function alCambiar() {
    resueltos = {};
    paleta = leerPaleta();
    exponer();
    aplicarDefaults();

    var quedan = [];
    for (var i = 0; i < vivas.length; i++) {
      var chart = vivas[i];
      // Una gráfica destruida deja de tener lienzo: se cae sola de la lista.
      if (!chart.canvas || !chart.ctx) continue;
      quedan.push(chart);
      try {
        repintar(chart);
        chart.update("none");
      } catch (e) { /* una gráfica rota no puede parar a las demas */ }
    }
    vivas = quedan;
  }

  exponer();
  aplicarDefaults();

  /*
   * Quedar suscrito al tema.
   *
   * Si el puente ya esta, se hace ahora. Si todavía no --porque este archivo
   * quedo antes en el documento-- se espera a que avise de que esta listo: en
   * ese momento se vuelve a colgar todo (el puente pudo haber puesto su propio
   * objeto) y se repinta con los colores que acaban de llegar.
   */
  var suscrito = false;

  function suscribir() {
    if (suscrito) return true;
    if (typeof P().alCambiarTema !== "function") return false;
    suscrito = true;
    P().alCambiarTema(alCambiar);
    return true;
  }

  if (!suscribir()) {
    window.addEventListener("plane:listo", function () {
      exponer();
      if (!suscribir()) alCambiar();
    });
  }
})();
`;
