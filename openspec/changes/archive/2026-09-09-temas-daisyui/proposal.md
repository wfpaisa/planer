## Why

El panel mantiene tres mecanismos de color propios: claro/oscuro con una clase `.dark`, paletas con nombre en `--p-*` y un acento por aplicacion con escala sintetizada con `color-mix`. daisyUI ya esta instalado y trae un sistema de temas completo; migrar a el deja una sola eleccion (el tema), borra CSS propio y unifica panel y aplicaciones publicadas bajo el mismo lenguaje visual.

## What Changes

- **BREAKING** `AppTheme` pasa de `{ accent, primary, surface, palette }` a solo `{ theme }` con el nombre de un tema. Lo guardado con el formato viejo se ignora sin error y cae en el tema por defecto.
- Se adoptan 7 temas de daisyUI (light, night, retro, valentine, pastel, luxury, coffee) definidos como bloques propios en el CSS del panel, para poder ajustarlos y ampliarlos sin depender de los valores de fabrica.
- El constructor elige **un** tema para el panel, guardado en localStorage y activado con `data-theme` en `<html>`. Desaparecen el interruptor claro/oscuro, las paletas con nombre y la clase `.dark`.
- Cada aplicacion elige **un** tema en Ajustes, con un selector unico. Se quita la opcion de asignar un color a mano: solo se escoge el tema. El preview del builder y la vista publicada se pintan con ese tema.
- Los colores de las etiquetas (columnas de lista) salen de los 8 colores semanticos del tema activo (primary, secondary, accent, neutral, info, success, warning, error); la paleta configurable por aplicacion desaparece.
- La lista de temas vive en un unico lugar compartido: agregar un tema despues es sumar un bloque CSS y un nombre, y aparece en todos los selectores.
- Toda la interfaz se convierte a clases daisyUI, empezando por el kit `ui.tsx` (que conserva su API para no romper a quien lo usa). Las utilidades propias solo sobreviven donde daisyUI no alcanza. Los iconos siguen siendo lucide.
- Solo los componentes que necesiten estilos en archivo propio pasan a carpeta con su `.css`; el resto no se encarpetan.

## Capabilities

### New Capabilities

- `theming`: seleccion unica de tema daisyUI para el panel y por aplicacion, colores de etiqueta derivados del tema, y forma de ampliar la lista de temas.

### Modified Capabilities

(ninguna: ninguna spec existente describe el tema actual)

## Impact

- **web**: `styles.css` (bloques de tema daisyUI, salida de los tokens `--p-*`), `palettes.css` y `lib/palettes.ts` se eliminan, `lib/theme.tsx` se reescribe, `lib/appTheme.tsx` se simplifica, `routes/Settings.tsx` (selector unico, sin eleccion de color), `components/ui.tsx` por dentro, y las 27 vistas/componentes (652 usos de `className`).
- **shared**: `types.ts` (`AppTheme`), nuevo `themes.ts` con la lista de temas, `palettes.ts` fuera.
- **server**: `routes.ts` (`sanitizeTheme` valida nombre de tema contra la lista compartida).
- Riesgo principal: regression visual masiva; se mitiga convirtiendo primero el kit y revisando cada tema al final.
