## 1. El bisturi sobre el HTML

- [x] 1.1 Crear el modulo que localiza un bloque por su nombre y devuelve su HTML reconstruido, con el contador de profundidad y la lista de elementos vacios
- [x] 1.2 Reemplazar un bloque por otro HTML dejando intacto el resto del documento
- [x] 1.3 Insertar un bloque nuevo antes o despues de uno nombrado
- [x] 1.4 Quitar un bloque del documento
- [x] 1.5 Estampar un nombre sobre un elemento, comprobando primero que no exista ya y derivando uno libre si existe
- [x] 1.6 Reponer el nombre cuando lo que se guarda no lo trae, para que reemplazar nunca sea borrar y crear
- [x] 1.7 Fallar con un mensaje claro cuando se pide un bloque que el documento no tiene, sin tocar el documento
- [x] 1.8 Comprobar que un documento con doctype, comentarios, script y elementos vacios vuelve identico cuando no hay coincidencias

## 2. La IA usa el bisturi

- [x] 2.1 Anadir las herramientas de leer, reemplazar, insertar y quitar un bloque junto a las que ya existen
- [x] 2.2 Conservar la herramienta de reescribir la pagina entera y describir en ella cuando toca usarla
- [x] 2.3 Explicar en el contexto que es un nombre de bloque, que se le pone a lo que se edita y no a todo el documento
- [x] 2.4 Explicar en el contexto que un cambio localizado se hace con el bisturi y rehacer la pagina se reserva para cambios de estructura
- [x] 2.5 Guardar una edicion parcial como un cambio de la pagina, igual que una reescritura
- [x] 2.6 Comprobar con una pagina larga que un cambio pequeno no vuelve a generar lo que ya estaba

## 3. El cursor de seleccion

- [x] 3.1 Anadir al puente el modo cursor, que se enciende y se apaga desde el panel
- [x] 3.2 Iluminar bajo el raton el candidato que se seleccionaria, subiendo al mas cercano cuando lo apuntado no lo es
- [x] 3.3 Silenciar mientras el cursor esta activo la captura de clicks que hoy usa el puente para navegar
- [x] 3.4 Devolver al panel el elemento senalado con donde esta y su HTML, recortado si es enorme y avisando de que va recortado
- [x] 3.5 Reconocer como candidatos los elementos con entidad y los que ya llevan nombre, y no dejar al raton sin nada que señalar en un documento de contenedores genericos
- [x] 3.6 Salir del modo cursor con escape y desde el propio boton

## 4. Lo senalado en la conversacion

- [x] 4.1 Anadir al dock el boton que enciende y apaga el cursor, con la senal de si esta activo
- [x] 4.2 Dibujar cada elemento senalado como un badge con un nombre legible, reusando los badges que ya se pueden quitar
- [x] 4.3 Permitir varios elementos senalados a la vez, cada uno con su badge
- [x] 4.4 Mandar lo senalado con la peticion, y no mandarlo cuando se quita su badge
- [x] 4.5 Comprobar que quitar un badge no toca el texto ya escrito

## 5. Revision

- [x] 5.1 Señalar una tabla y pedir una columna nueva, comprobando que solo cambia esa tabla
- [x] 5.2 Señalar un elemento que contiene un enlace y comprobar que la pagina no navega
- [x] 5.3 Pedir un cambio sobre una pagina traida de fuera sin ningun nombre, y comprobar que el bloque tocado queda nombrado y el resto no
- [x] 5.4 Pedir dos cambios seguidos sobre bloques distintos y comprobar que el segundo no deshace el primero
- [x] 5.5 Comprobar que deshacer desde "Cambios" devuelve la pagina como estaba antes de una edicion parcial
- [x] 5.6 Comprobar que rehacer la pagina entera sigue siendo posible y que la IA dice cuando lo hizo asi
