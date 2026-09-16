# Escenarios de empresa

Veinte aplicaciones típicas de una empresa, revisadas contra el sistema tal como estaba antes de este cambio. Es la evidencia que justifica el alcance de `permisos-por-rol` y el mapa de lo que queda pendiente.

No es un artefacto de OpenSpec. Se conserva junto al cambio para poder retomar la exploración cuando esté implementado.

## Qué hace falta en cada escenario

Abreviaturas: **Rol** = alcance por rol en una tabla (este cambio) · **Lista** = poder pedir la lista de colaboradores filtrada por rol · **Jefe** = saber de quién depende cada persona · **Aprobar** = permisos que dependen del estado de la fila · **Empate** = conectar por cédula o correo en vez de por relación directa · **Columnas** = permiso a nivel de columna.

### Solicitar y aprobar

| Escenario | Falta |
|---|---|
| Vacaciones y permisos | Jefe · Aprobar · Rol |
| Solicitudes de compra | Jefe · Aprobar · Rol |
| Gastos de viaje y reembolsos | Jefe · Aprobar · Rol |
| Capacitaciones y certificados | Aprobar · Rol |

### Personas

| Escenario | Falta |
|---|---|
| Directorio de empleados | Lista · Columnas |
| Recibos de nómina | Empate · Rol · Columnas |
| Evaluaciones de desempeño | Jefe · Rol · Columnas |
| Control de asistencia | Rol |
| Llamados de atención | Rol |
| Encuesta de clima laboral | Anonimato |

### Operación

| Escenario | Falta |
|---|---|
| Agenda domiciliaria | Lista · Rol |
| Tickets de soporte interno | Lista · Rol |
| Reserva de salas | Rol, con lectura y escritura distintas |
| Mantenimiento preventivo | Lista · Rol |
| Cartera de clientes por vendedor | Rol |

### Activos y terceros

| Escenario | Falta |
|---|---|
| Inventario de equipo médico | Lista |
| Flota de vehículos | Empate · Lista · Rol |
| Excesos de velocidad | Empate · Rol |
| Pedidos a proveedores | Rol |
| Registro de visitantes | Nada, ya se arma |

También se arma sin cambios: base de conocimiento y procedimientos internos.

## Frecuencia

| Carencia | Escenarios |
|---|---|
| Alcance por rol | 16 de 20 |
| Lista de colaboradores filtrada por rol | 6 de 20 |
| Jefe y equipo | 4 de 20 |
| Solicitar y aprobar | 4 de 20 |
| Datos propios del colaborador y empate | 3 de 20 |
| Permiso por columna | 3 de 20 |

## Cambios que siguen a este

En el orden en que desbloquean más escenarios.

1. **Lista de colaboradores filtrada por rol.** Hoy el HTML de una página sólo recibe `plane.usuario`, quien mira, y sólo puede consultar las tablas declaradas. No hay forma de dibujar un selector de odontólogos. Verificado en `web/src/components/HtmlFrame.tsx` y `server/htmlBridge.ts`.

2. **Datos propios del colaborador y empate por valor.** Un colaborador guarda hoy correo, nombre y foto, y nada más. Falta que cada aplicación pueda añadirle columnas propias (cédula, área, cargo), que esos datos no se filtren entre aplicaciones que comparten a la misma persona, y que un alcance pueda conectarse por el valor de una columna en vez de por relación directa. Incluye la detección automática al importar: comparar los valores de cada columna que llega contra los que ya se conocen, descartando antes las columnas con pocos valores distintos, y proponer la que coincida.

3. **Jefe y equipo, con el alcance "las filas de mi gente".** Es un cuarto tipo de alcance, más una relación entre colaboradores.

4. **Solicitar y aprobar.** Los permisos de una fila dependen del paso en que esté. Es la familia más común de aplicaciones de empresa y ninguna se arma hoy.

5. **Permiso por columna.** En el directorio todos ven la extensión y sólo recursos humanos ve el sueldo.

## Sin decidir

- **Respuestas anónimas.** Todo en Planer está atado a quien entró. Una encuesta anónima pide saber que alguien ya respondió sin saber qué respondió. Va contra el diseño; hay que decidir a propósito si se soporta o se descarta.
- **Historial de cambios.** Quién cambió qué y cuándo. No ha aparecido como requisito, pero pocas aplicaciones de empresa lo tienen opcional.
- **Avisos al aprobar o rechazar.** Exige enviar correo, y eso choca con el principio de no depender de servicios externos.

## Ya resuelto, no hace falta cambio

- Una persona con varios roles a la vez.
- Páginas que sólo abren ciertos roles, aplicado en el servidor.
- Un formulario que queda firmado por quien lo llenó: la base rechaza firmar con el nombre de otro.
- Quién administra la aplicación crea filas para otras personas.
- La hora real de una fila: `created` y `updated` los pone la base, no el navegador.
