## Context

Hoy coexisten tres mecanismos de color: `lib/theme.tsx` (claro/oscuro con clase `.dark` + escalas `--p-*` primaria/superficie inyectadas por JS antes de pintar), `lib/appTheme.tsx` (`AppTheme` con acento hexadecimal, escalas con nombre y paleta de etiquetas, aplicado como variables inline con `accentVars()`), y `palettes.css` (las escalas `--p-{nombre}-{paso}`). daisyUI 5 ya esta instalado con `@plugin "daisyui"` en `styles.css`. El kit `components/ui.tsx` es el cuello de botella por donde pasa casi todo el panel.

## Goals / Non-Goals

**Goals:**

- Un solo eje de apariencia: el nombre de un tema, compartido por panel y aplicaciones.
- Poder ampliar o recortar el catalogo de temas tocando un solo lugar (la lista compartida: el CSS ya trae todos los built-ins).
- Convertir la interfaz a clases daisyUI conservando la API del kit `ui.tsx`, para que los 27 archivos no se rompan de golpe.

**Non-Goals:**

- Partir los archivos grandes (`DatabaseEditor`, `Omnibar`, ...) ni encarpetar componentes sin CSS propio.
- Convertir la grilla tipo hoja de calculo en `table` de daisyUI: solo se recolorea.
- Migrar datos en PocketBase: los temas viejos se dejan de leer, no se reescriben.
- Cambiar iconos: se siguen usando lucide.

## Decisions

### D1: Temas built-ins de daisyUI, con una sola personalizacion

`styles.css` configura `@plugin "daisyui" { themes: all; }`: el catalogo son los 35 temas oficiales de daisyUI (los mismos de `packages/daisyui/src/themes` en su repo), en el orden de su lista. La unica personalizacion vive en `web/src/themes.css` (importado despues del plugin a proposito): un bloque `@plugin "daisyui/theme"` con nombre `"dark"` y `prefersdark: true` que se fusiona con el built-in del mismo nombre y lo pisa, mas un ajuste de `.btn` para ese tema. `light` sigue siendo el tema por defecto tal cual viene.

Decision inicial (ya revertida): definir los 7 temas como bloques propios para no depender de la version de daisyUI. Se descarto al pedir explicitamente el catalogo completo de temas: mantener 35 bloques copiados a mano es inviable y la personalizacion real es una sola (dark). El costo aceptado es que una actualizacion de daisyUI puede mover los valores de los temas no personalizados.

### D2: La lista de nombres vive en `shared/themes.ts`

`THEME_NAMES` (lista cerrada, los 35 nombres oficiales en el orden de daisyUI) y `DEFAULT_THEME = "light"`. El servidor valida con ella (`sanitizeTheme`) y el panel renderiza los selectores desde ella. Agregar o quitar un tema es tocar un solo lugar: la lista (el CSS ya trae todos).

Alternativa descartada: derivar la lista del CSS o duplicarla en web y server; ambas se desincronizan o no son importables como datos.

### D3: El panel activa el tema con `data-theme` en `<html>`

`ThemeProvider` se reduce a: leer la eleccion guardada, validarla contra `THEME_NAMES`, escribir `document.documentElement.dataset.theme` y persistirla. Desaparecen la clase `.dark`, la `@custom-variant dark`, la inyeccion del `<style id="plane-palette">` y las escalas de `lib/palettes.ts`.

La primera visita no escribe nada: sin `data-theme`, daisyUI resuelve solo con el `light` por defecto y el `dark` personalizado marcado `prefersdark`, que ya cubre el escenario del sistema en oscuro sin codigo extra. La clave de localStorage sigue siendo `plane-theme`; un valor guardado que no este en la lista se ignora.

### D4: `AppTheme` se reduce a `{ theme: string }`

`sanitizeTheme` en el servidor acepta unicamente `{ theme }` con nombre valido; cualquier otra cosa (incluido el formato viejo con acento/escalas/paleta) devuelve `null`. En el cliente, `normalizeTheme` aplica `DEFAULT_THEME` cuando no hay tema valido. Sin migracion: los registros viejos se quedan como estan y dejan de interpretarse.

### D5: La app pinta su tema en un contenedor, no en `<html>`

El preview del builder y la vista publicada envuelven su contenido con `data-theme={tema}`. daisyUI 5 admite temas por elemento: las variables del tema caen dentro del contenedor y ademas le pone su fondo base, que es el efecto buscado (el area de la app toma el color del tema elegido, aunque el panel tenga otro).

### D6: Etiquetas con los 8 semanticos del tema

`colorFor(valor, paleta)` se conserva pero la paleta pasa a ser una constante: `var(--color-primary)`, `var(--color-secondary)`, `var(--color-accent)`, `var(--color-neutral)`, `var(--color-info)`, `var(--color-success)`, `var(--color-warning)` y `var(--color-error)`. Como son variables CSS, se resuelven contra el tema del contenedor y se recolorean solas al cambiarlo. Desaparecen `AppTheme.palette` y el `PaletteProvider`.

### D7: El kit primero, misma API

`ui.tsx` se reescribe por dentro con clases daisyUI sin cambiar sus props: mapa orientativo de variantes `primary → btn-neutral` (fondo tinta con texto claro), `accent → btn-primary`, `default → btn`, `ghost → btn-ghost`, `danger → btn-error`, `warning → btn-warning`; `Input`/`Textarea`/`Select` a `input`/`textarea`/`select` de daisyUI; `Modal` a `dialog`/`modal`; `Dropdown` a `dropdown`; `Badge` a `badge`. El matiz fino se ajusta en implementacion con los temas reales puestos.

### D8: Reemplazo de utilidades propias por semanticas

| Hoy | Paso a |
|---|---|
| `surface` | `bg-base-100` |
| `surface-soft` | `bg-base-200` |
| `surface-page` | `bg-base-200` |
| `text-ink` | `text-base-content` |
| `text-soft` | `text-base-content/70` |
| `text-faint` | `text-base-content/50` |
| `border-line` | `border-base-300` |
| `accent-{paso}` | semanticos del tema (`primary`, `accent`, ...) segun contexto |
| `shadow-card` | se conserva: daisyUI no tiene equivalente suave |

`palettes.css`, `--p-*`, el bloque `@theme` de `--color-accent-*` y las `@utility` sustituidas se eliminan al final (tarea de limpieza), no antes: convertir archivo por archivo requiere que lo viejo siga existiendo mientras tanto.

### D9: Carpetas solo con CSS real

Un componente pasa a carpeta con su `.css` unicamente cuando necesite estilos que no quepan en utilidades. Hoy ninguno los necesita; la regla queda escrita para lo que aparezca.

### D10: Monaco sigue al esquema de color del tema

El editor (usado por `HtmlFrame`/`PageCodePanel`) elige su tema claro/oscuro leyendo el `color-scheme` resuelto del documento (daisyUI lo fija por tema), en vez de la clase `.dark`.

## Risks / Trade-offs

- [Regression visual en 27 archivos] → Convertir por capas: fundacion de temas y kit primero (con eso cambia la mayor parte del look), despues archivo por archivo con revision visual y `bun run smoke` al cerrar cada bloque.
- [Clases muertas que no fallan en build] (p. ej. `accent-300` sin su `@theme`) → Grep de auditoria como tarea de cierre: `accent-[0-9]`, `surface`, `text-ink`, `border-line`, `--p-`, `dark:` sin usos vivos.
- [CSS mas grande con los 35 temas] → Aceptado: los temas son variables, no reglas por componente. El CSS del panel completo queda en ~334 kB minificado.
- [Panel y app con temas distintos conviviendo] → Probar el contraste sidebar (tema del panel) contra documento (tema de la app) en varios pares.

## Migration Plan

Orden: fundacion de temas (D1-D3) → tema de aplicacion (D4-D6) → kit (D7) → vistas → componentes → limpieza (D8) → revision por tema y smoke. No hay pasos de despliegue especiales. Rollback: revert del branch; los datos de PocketBase no se modifican, solo dejan de interpretarse los campos viejos.
