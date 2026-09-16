## 1. Fundacion de temas

- [x] 1.1 Crear `shared/themes.ts` con la lista cerrada `THEME_NAMES` (light, night, retro, valentine, pastel, luxury, coffee) y `DEFAULT_THEME = "light"`
- [x] 1.2 Crear `web/src/themes.css` con los 7 bloques `@plugin "daisyui/theme"` con los valores fijados del cambio (light `default`, night `prefersdark`), importarlo desde `styles.css` y configurar `@plugin "daisyui" { themes: false; }`
- [x] 1.3 Reescribir `lib/theme.tsx`: validar el nombre guardado contra `THEME_NAMES` (traducir "dark" a "night"), aplicar `data-theme` en `<html>` y eliminar la clase `.dark` y el `<style>` de paleta inyectado
- [x] 1.4 Reemplazar el interruptor claro/oscuro del sidebar por un selector de tema alimentado por `THEME_NAMES`
- [x] 1.5 Eliminar `@custom-variant dark` de `styles.css` migrando los usos `dark:` que queden a colores semanticos

## 2. Tema de la aplicacion

- [x] 2.1 Reducir `AppTheme` en `shared/types.ts` a `{ theme: string }`
- [x] 2.2 Reescribir `sanitizeTheme` en `server/routes.ts`: aceptar solo `{ theme }` con nombre en `THEME_NAMES`; eliminar la validacion de hexadecimales y escalas con nombre
- [x] 2.3 Simplificar `lib/appTheme.tsx`: `normalizeTheme` con default `light`, eliminar `accentVars`, `surfaceClass`, `PALETTE_PRESETS` y `PaletteProvider`; nueva constante `TAG_COLORS` con los 8 semanticos (`var(--color-primary)` ... `var(--color-error)`) y `colorFor` sobre ella
- [x] 2.4 Ajustes de la aplicacion (`routes/Settings.tsx`): selector unico de tema desde `THEME_NAMES`; fuera muestras de color, acento a mano y escalas
- [x] 2.5 Envolver preview y vista publicada en un contenedor con `data-theme` del tema de la app y quitar `accentVars` de `Published.tsx`
- [x] 2.6 Migrar los usos de paleta de etiquetas (`cells.tsx`, `TagBadge`, bloques) a `colorFor` con `TAG_COLORS`

## 3. Kit de interfaz

- [x] 3.1 Convertir por dentro `Button` y `IconButton` a clases `btn` manteniendo variantes, tamanos y `loading`
- [x] 3.2 Convertir `Input`, `Textarea`, `Select`, `Switch` y `Field` a las clases de campo de daisyUI
- [x] 3.3 Convertir `Modal` y `ConfirmDialog` al `modal`/`dialog` de daisyUI conservando cierre por fondo y Escape
- [x] 3.4 Convertir `Dropdown`, `MenuItem`, `MenuLabel` y `MenuSeparator` al `dropdown` de daisyUI
- [x] 3.5 Convertir `Badge`, `Spinner`, `Loading`, `EmptyState` y `ErrorNote` a semanticas daisyUI

## 4. Vistas

- [x] 4.1 Convertir `routes/Home.tsx`
- [x] 4.2 Convertir `routes/Login.tsx`
- [x] 4.3 Convertir `routes/Builder.tsx`, `routes/Preview.tsx` y `routes/PageStage.tsx`
- [x] 4.4 Convertir `routes/AiSettings.tsx`
- [x] 4.5 Convertir `routes/Settings.tsx` (lo que quede fuera del selector de tema)
- [x] 4.6 Recolorear `routes/DatabaseEditor.tsx` con semanticas, conservando la grilla propia

## 5. Componentes

- [x] 5.1 Convertir `components/Omnibar.tsx`
- [x] 5.2 Convertir `components/AppSidebar.tsx`
- [x] 5.3 Convertir `components/ImportModal.tsx` y `components/ImportStructureModal.tsx`
- [x] 5.4 Convertir `components/HtmlImportPanel.tsx`, `components/HtmlFrame.tsx` y `components/PageCodePanel.ts`, ligando el tema de Monaco al esquema de color resuelto del documento
- [x] 5.5 Convertir `components/AiPanel.tsx`, `components/HistoryPanel.tsx` y `components/ImpactPanel.tsx`
- [x] 5.6 Convertir `components/cells.tsx`, `components/ColumnModal.tsx`, `components/ConvertDialog.tsx`, `components/PageAccessPicker.tsx` y `components/PageView.tsx`
- [x] 5.7 Convertir `lib/markdown.tsx` y revisar el resto de `lib/` en busca de clases de color propias

## 6. Limpieza

- [x] 6.1 Eliminar `palettes.css`, `lib/palettes.ts`, el bloque `@theme` de `--color-accent-*`, las `@utility` sustituidas (`surface`, `text-ink`, `text-soft`, `text-faint`, `border-line`) y las variables `--p-*`, `--surface-*`, `--ink*` y `--line*` que queden huerfanas; conservar `shadow-card` y lo que siga en uso — `--surface-*`/`--ink*`/`--line*` se conservan a proposito: viajan al HTML de las paginas (htmlContract)
- [x] 6.2 Auditoria sin resultados: `accent-[0-9]`, `surface `, `text-ink`, `text-soft`, `text-faint`, `border-line`, `--p-`, `dark:` en `web/src`
- [x] 6.3 Si algun componente quedo con CSS en archivo propio, moverlo a carpeta con su `.css`; si no hubo, dejarlo anotado — no hubo: nada quedo con CSS en archivo propio

## 7. Revision

- [x] 7.1 `bun run typecheck`, `bun run lint` y `bun run build` limpios, y comparar el tamanio del CSS final
- [x] 7.2 Recorrer el panel con los 7 temas: dashboard, builder, base de datos, ajustes y omnibar
- [x] 7.3 Publicar una app con cada tema y verla como visitante, probando pares panel-tema / app-tema distintos
- [x] 7.4 Comprobar etiquetas: el mismo valor conserva su color y se recolorean al cambiar de tema
- [x] 7.5 Abrir una app con tema guardado en formato viejo (acento hexadecimal) y verificar que se muestra con light sin errores
- [x] 7.6 Correr `bun run smoke` contra el servidor levantado
