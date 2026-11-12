# Revisión de accesibilidad (WCAG 2.1 AA)

**Fecha:** 11/11/2026, sobre la versión publicada después de la fase 1 de la migración.
**Cómo se midió:**
- axe-core 4.10, la herramienta estándar de accesibilidad, en 17 pantallas y ventanas, en celu (390 px) y compu (1280 px).
- Recorrido con Tab y Escape en las 9 ventanas.
- Medición de cada botón y link (áreas para tocar).
- Contraste de la paleta.
- Pantalla de 320 px (equivale a un zoom del 200 %).
- Lo que no se probó: un lector de pantalla real (VoiceOver o NVDA). Ver el final.

## Resumen

| | Cantidad | Estado |
|---|---|---|
| Críticos | 0 | |
| Importantes | 3 | 1 arreglado (ventanas); 2 propuestos (cambian algo a la vista) |
| Menores | 4 | 2 arreglados (áreas para tocar); 2 quedan anotados |

axe-core no encontró ningún error en la app: 0 en 17 pantallas y ventanas, en los dos tamaños. El único error que encontró está en /organizadores: el contraste del sello "✓ Verificado".

## Hallazgos

### Perceptible

| # | Problema | Criterio | Gravedad | Estado |
|---|---|---|---|---|
| 1 | Sello "✓ Verificado" de /organizadores: letra blanca sobre azul #0297DE, contraste 3,24:1 (pide 4,5:1). | 1.4.3 Contraste | 🟡 Importante | **Propuesto:** letra oscura #02070A (6,25:1) o azul más oscuro #0277B6 (4,86:1). |

### Operable

| # | Problema | Criterio | Gravedad | Estado |
|---|---|---|---|---|
| 2 | Al abrir una ventana (Sumate, Elegir zona, tutorial, mapa, menú, vista previa, colores, denunciar), el foco del teclado se quedaba en la pantalla de atrás. Con Tab había que recorrer toda la página para llegar a la ventana, y Escape no la cerraba. | 2.4.3 Orden del foco, 2.1.1 Teclado | 🟡 Importante | **Arreglado** (`src/ventanas.js`). Ver más abajo. |
| 3 | El buscador de Explorar no muestra dónde está el foco cuando se llega con Tab (`outline:none` sin reemplazo). | 2.4.7 Foco visible | 🟡 Importante | **Propuesto:** borde naranja al escribir, igual que los demás campos de la app. |
| 4 | Links y botones chicos en el celu: Seguir mirando sin cuenta, Creá una, Olvidé mi contraseña, Términos y Privacidad del ingreso, Saltar, Lista y Mapa, Persona y Organizador, Denunciar este evento, ¿Qué significa?, Cómo llegar. Medían de 14 a 36 px de alto. | 2.5.5 Tamaño del área (44 px) | 🟢 Menor | **Arreglado:** área invisible de 44 px. Se ven igual. |
| 5 | Preguntas de Ayuda: solo se podía tocar la línea del texto (16 px). | 2.5.5 | 🟢 Menor | **Arreglado:** se puede tocar toda la tarjeta (40 a 56 px). Se ve igual. |
| 6 | Encabezado de /lanzamiento y /organizadores: "Ir a Partazy" (29 px) y "Abrir la app" (39 px). | 2.5.5 | 🟢 Menor | Anotado para cuando se toquen esas páginas. |
| 7 | "Volver" (38 px), Eventos y Personas en Explorar (36 px), links del pie en la compu (14 px). Cumplen la versión 2.2 (24 px o separación suficiente). | 2.5.5 | 🟢 Menor | Anotado. |

### Comprensible y robusto
Sin problemas:
- Los campos tienen etiqueta.
- Los errores del formulario se dicen con palabras.
- Todos los botones con ícono tienen nombre.
- Las ventanas se presentan como diálogo (`role="dialog"`, `aria-modal`).

## Contraste de la paleta

| Elemento | Letra | Fondo | Contraste | Pide | ¿Pasa? |
|---|---|---|---|---|---|
| Texto principal | #EDF1F4 | #02070A | 17,8:1 | 4,5:1 | ✅ |
| Texto secundario | #8E9BA5 | #02070A | 7,1:1 | 4,5:1 | ✅ |
| Texto secundario en tarjeta | #8E9BA5 | #121B22 | 6,1:1 | 4,5:1 | ✅ |
| Naranja (links, acentos) | #FC734D | #02070A | 7,4:1 | 4,5:1 | ✅ |
| Azul | #0297DE | #02070A | 6,3:1 | 4,5:1 | ✅ |
| Botón naranja | #02070A | #FC734D | 7,4:1 | 4,5:1 | ✅ |
| Respuestas de Ayuda | #C2CBD2 | #0A1116 | 11,6:1 | 4,5:1 | ✅ |
| Sello Verificado (/organizadores) | #FFFFFF | #0297DE | 3,2:1 | 4,5:1 | ❌ (propuesto) |

## Teclado (después del arreglo)

| Ventana | Al abrir | Tab | Escape | Al cerrar |
|---|---|---|---|---|
| Sumate (hoja de cuenta) | El foco entra | Recorre solo la ventana | Cierra | El foco vuelve al botón que la abrió |
| Elegir zona, y el mapa encima | Entra | Solo la ventana | Cierra la de arriba | Vuelve a la de abajo |
| Tutorial, guía de colores, vista previa, menú, denunciar | Entra | Solo la ventana | Cierra | Vuelve |
| Confirmar y pedir un texto | Ya iba a "Aceptar" (se respeta) | Solo la ventana | Cancela (una sola vez) | Vuelve |

El resto también se revisó:
- Las pantallas se recorren en orden.
- Las tarjetas y los chips se pueden usar con Enter.
- Todo lo que tiene foco muestra el recuadro naranja, salvo el buscador de Explorar (punto 3).

## Lector de pantalla

| Elemento | Cómo se anuncia | Problema |
|---|---|---|
| Ventanas | "Sumate, diálogo" y similares | Antes no se anunciaban al abrirse porque el foco no entraba. Arreglado. |
| Botones con ícono (cerrar, menú, avisos) | Por su nombre ("Cerrar", "Menú") | Ninguno. |
| Tarjetas de eventos | Por el nombre del evento | Ninguno. |

## Además, verificado
- Idioma de la página: `es` y `es-AR`.
- El zoom está permitido.
- A 320 px no hay desplazamiento horizontal.
- Si el celu tiene "Reducir movimiento" activado, las animaciones se apagan.
- Ninguna imagen con contenido le falta su descripción.

## Cómo se hicieron los arreglos sin cambiar nada a la vista
- **`src/ventanas.js`:** vigila las 4 clases de ventana (`.hoja-bg`, `.modal-bg`, `.tuto-bg`, `.mapa-bg`).
  - Al abrir una, pone el foco en ella (sin mover la pantalla).
  - Mantiene Tab adentro.
  - Escape usa el mismo cierre que el "atrás" del celular (`cerrarModalAbierto`).
  - Al cerrar, devuelve el foco a donde estaba.
  - Las ventanas que ya tenían su propio Escape (confirmar, pedir un texto, elegir amigos) no se tocan.
- **`src/app.css`, al final:**
  - La ventana enfocada no muestra recuadro.
  - En Ayuda, la pregunta ocupa toda la tarjeta, compensando el relleno con margen negativo.
  - Los links chicos tienen un `::after` transparente de 44 px.
- **Comprobado:**
  - Capturas de 21 estados en celu y compu, antes contra después: 0 píxeles distintos. La única diferencia fue el carrusel de chips, que también varía entre dos capturas de la versión vieja.
  - Ningún área nueva tapa a otro botón.
  - Prueba nueva: `tests/test_ventanas_foco.js`.

## Pendiente: probar con un lector de pantalla real
En el iPhone: Ajustes → Accesibilidad → VoiceOver. Abrir partazy.com, tocar "Entrar" y escuchar que diga "Sumate". Cinco minutos alcanzan para detectar algo raro.
