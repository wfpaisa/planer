## 1. El dock ocupa su columna

- [x] 1.1 Crear el dock como primer hijo del flex de la escena, con ancho propio y sin encogerse, dejando al documento repartirse lo que queda
- [x] 1.2 Mover la conversacion y el aviso de impacto dentro del dock, encadenados como estan hoy
- [x] 1.3 Dejar de dibujar el dock para quien no construye, en el panel y en la vista publicada
- [x] 1.4 Comprobar que el sidebar anclado, el sidebar flotante y el dock conviven sin pisarse en los dos lados

## 2. El ancho lo decide cada quien

- [x] 2.1 Guardar el ancho por aplicacion en el navegador, leido al abrir y escrito al cambiar
- [x] 2.2 Arrastrar el borde para cambiar el ancho, escribiendo la medida en el nodo durante el arrastre y confirmandola al soltar
- [x] 2.3 Sujetar el ancho entre un minimo util y un maximo calculado contra el ancho de la ventana
- [x] 2.4 Capturar el puntero durante el arrastre y evitar que se seleccione texto de la conversacion
- [x] 2.5 Comprobar que el ancho vuelve tal cual al reabrir la aplicacion, y que el limite aguanta arrastrar mas alla

## 3. Esconder y traer

- [x] 3.1 Esconder el dock por completo, devolviendo su ancho al documento, y recordar ese estado por aplicacion
- [x] 3.2 Anadir a la barra superior el boton que trae y esconde el dock, con el halo animado de daisyUI y la senal de si esta abierto
- [x] 3.3 Devolver el dock con el ancho que tenia y la conversacion tal como se dejo
- [x] 3.4 Esconder el dock por debajo del ancho de ventana en que dejaria al documento sin sitio
- [x] 3.5 Comprobar que esconder y traer no empieza una conversacion nueva ni borra lo escrito sin enviar

## 4. Se ve pensar

- [x] 4.1 Mostrar en una linea lo ultimo que la IA lleva pensado mientras trabaja, y el principio del razonamiento al terminar
- [x] 4.2 Desplazar esa linea sola hasta el final del texto mientras la peticion dura, y devolverla al principio al terminar
- [x] 4.3 Conservar el despliegue del razonamiento completo y de los pasos, abierto mientras dure la peticion una vez abierto
- [x] 4.4 Agrupar por intervalos de dibujado los redibujados de la conversacion y el seguir el final mientras llega la respuesta
- [x] 4.5 Comprobar con una respuesta larga que la conversacion sigue respondiendo al desplazamiento y a los clics
- [x] 4.6 Comprobar que un fallo a mitad deja visible lo escrito hasta ahi

## 5. Los atajos pasan a badges

- [x] 5.1 Dibujar los atajos de peticion como badges dentro de la conversacion, retirando la fila aparte
- [x] 5.2 Poder quitar un badge anadido al borrador sin perder el texto ya escrito

## 6. Se retira la pildora

- [x] 6.1 Retirar la barra flotante, su fondo oscurecido, su crecimiento a panel y su campo de texto
- [x] 6.2 Retirar de los estilos el borde giratorio y la fila de botones de la barra, que quedan sin uso
- [x] 6.3 Comprobar que no queda ninguna forma de llegar a la IA que no sea el boton de la barra superior y el campo del dock

## 7. Revision

- [x] 7.1 Recorrer abrir, ensanchar, esconder y traer el dock, comprobando que el documento se reparte bien en cada paso
- [x] 7.2 Comprobar el dock en claro y en oscuro, con una paleta cambiada
- [x] 7.3 Comprobar una pagina en blanco y una pagina con contenido: el documento se ve entero en las dos
- [x] 7.4 Comprobar la vista publicada como visitante: ni dock ni boton en ninguna parte
- [x] 7.5 Pedir un cambio largo y comprobar que se ve pensar sin desplegar nada, y que al desplegar esta el razonamiento entero
- [x] 7.6 Comprobar con el movimiento reducido activado que el halo del boton sigue siendo legible
