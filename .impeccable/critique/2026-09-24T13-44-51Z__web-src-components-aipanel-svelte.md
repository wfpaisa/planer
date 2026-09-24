---
target: panel de IA
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:/home/projects/planer/web/src/components/AiPanel.svelte"
target_fingerprint: "sha256:0c2b63ebda7e825c80049423dc26d91d3cd4cf5a9c4318e5736fbb82d0d1e461"
target_path: /home/projects/planer/web/src/components/AiPanel.svelte
timestamp: 2026-09-24T13-44-51Z
slug: web-src-components-aipanel-svelte
---
# Crítica: panel de IA (AiPanel.svelte + components/ai/)
Método: dual-agent (revisión de diseño + detector)

## Puntaje: 23/40
1 Visibilidad 3 · 2 Mundo real 2 · 3 Control 2 · 4 Coherencia 2 · 5 Prevención 3 · 6 Reconocer 2 · 7 Eficiencia 3 · 8 Estética 3 · 9 Errores 1 · 10 Ayuda 2

## Especificidad
Chat genérico por fuera, propio en la mecánica (cursor, velo, cola, AccessGrant, PlanCard). No dice qué página se construye. Rompe DESIGN.md: #000 literal en la burbuja; --text-subtle es un cuarto gris.
Detector: CLI limpio, 6 avisos (5 font-size 0.6875/0.625rem en .chat-hint, ContextMeter:378/406/426, DebugContext:113; 1 radius falso positivo AiPanel:1744). Navegador: 6 low-contrast (timeline-step, chat-hint, 2.4:1) reales; 8 bounce-easing (--travel-curve, del sistema); 6 thin-border-wide-shadow (menús, falso positivo).

## Problemas prioritarios
- [P0] Burbuja del usuario ilegible en claro (AiPanel.svelte:1900: color-mix con #000 + --text-primary, ~1.5:1). Fix: --accent-soft / --accent-soft-text.
- [P1] Botones de solo icono sin nombre accesible (+, cursor, enviar/detener, X): tip → aria-label en ui/Button.
- [P1] --text-subtle 2.4:1 en oscuro (chat-hint, process-line, En cola · quitar) y tamaños 10–11px fuera de escala. Fix: --text-muted, --text-xs mínimo.
- [P1] Errores con la voz de un éxito (say() AiPanel.svelte:385); sin Ver cambios/Deshacer tras reescribir; resumen del proceso en inglés.
- [P2] <900px la IA desaparece sin aviso (NARROW=900 en lib/aiDock.svelte.ts:31).

## Personas
Primera vez: jerga (Autocomandos, Razonamiento Low, ids de modelo), razonamiento en inglés, no sabe qué página cambia. Experto: modelo a 3 clics y oculto; chats sin búsqueda/página/renombrar. Teclado/baja visión: botones sin nombre, texto < AA, campo sin foco visible tras 2.1s, adjunto con all:unset sin anillo (AiPanel.svelte:2137).

## Menores
CSS sin uso (.chat-hero-glyph, .header-ai-label); text-wrap: balance + padding-right 2rem; copiar solo al hover; cabecera sin jerarquía; voces mezcladas en ModePicker; enviar deshabilitado parece activo en claro; --text-subtle sin documentar.

## Preguntas
¿Por qué el panel abre con «Chats anteriores» y no con la página? ¿Modelo/razonamiento a Ajustes con Rápido/Cuidadoso? ¿Tarjeta Antes/Después con Deshacer por turno?
