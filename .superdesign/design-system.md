# Partazy: sistema de diseño (para Superdesign)

## Producto
Partazy (partazy.com) es una red social de eventos de Córdoba, Argentina, para mayores de 18. Tagline: "Todo lo que pasa cerca tuyo".
- Quien asiste: descubre fiestas, previas, peñas, recitales, talleres, ferias y partidos; ve qué amigos van; se anota o reserva; recibe su entrada con QR.
- Quien organiza (persona, productora u organización): crea el evento, cobra la entrada directo a su alias o CBU con "cobro con comprobante" (peer to peer: la plata no pasa por Partazy), revisa los pagos ("Me llegó" o "No me llegó") y controla la puerta con QR.
- Es una app web para el celular (PWA). En la compu, la barra de abajo pasa a ser una barra lateral.
- Idioma: español rioplatense, de vos ("Creá", "Elegí", "Contanos").

## Identidad (no se cambia: se mejora lo que hay)
- Fondo oscuro Midnight Black `#02070A`. Superficies `#0A1116`, `#121B22` y `#1A252D`. Líneas `#1F2C35`.
- Texto claro `#EDF1F4` (crema) o `#FFFFFF`; secundario `#8E9BA5`.
- Color principal: naranja Cantaloupe `#FC734D` (botones, acentos, paso actual). Secundario: azul Electric `#0297DE` (verificado, confirmaciones, insignias). Durazno `#FFA98C` solo en degradés de marca (naranja → durazno → azul).
- Botones naranjas con letra OSCURA `#02070A`, peso 800, en píldora.
- Títulos en Barlow Condensed 800 en MAYÚSCULAS; texto en Inter; etiquetas chicas en JetBrains Mono, en mayúsculas, con letter-spacing; el logo usa Unbounded.
- Radios: tarjetas 18px, campos 12px, botones y chips en píldora.
- Íconos de trazo de 1.8 a 2 px, puntas redondeadas, sin relleno. Sin emojis como íconos.
- Mínimo 44px para tocar; letra mínima 12px; contraste AA.

## Reglas del dueño (Juan)
- No cambiar la identidad: ya rechazó un rediseño completo ("Tornasol").
- Sin separadores "·" ni "•" en ningún texto.
- "Taller" en lugar de "charla".
- La marca se escribe "Partazy".
- Persona de ejemplo: Lu Ferreyra. Organizador de ejemplo: Vortex Club.
- Sin muñequitos 3D en la app.
- Evitar caja naranja con letra negra en piezas de marca (en la app, el botón principal sí la usa).
- Sin fechas de lanzamiento.

## Problema a resolver en "Crear evento"
Hoy son 3 pasos, y el tercero ("Dónde y detalles") junta 16 campos en una sola pantalla larga. Abruma a quien crea su primer evento. La referencia que le gustó a Juan es Passline:
- un tema por paso, con título grande y una pregunta ("Fecha del evento", "¿Cuándo se realizará tu evento?");
- pocos campos por pantalla;
- inicio y fin agrupados;
- especificaciones y consecuencias explicadas antes (tamaño de la foto, qué pasa si no subís una);
- las entradas como paso propio;
- "Anterior" y "Siguiente" fijos;
- aceptar términos antes de publicar.

### Contenido que tiene que entrar (todo existe hoy)
- **Tipo** (13): Fiesta, Previa, After, Peña, Egresados, Cumpleaños, Música en vivo, Gastronomía, Taller / Curso, Arte y cultura, Deporte / Aire libre, Feria / Mercado, Charla / Seminario.
- **Básico**: nombre (Ej.: "Noche Vortex"), foto real (subir, con consejo), descripción.
- **Cuándo**: fecha, hora de inicio, hora de cierre (opcional).
- **Dónde**: dirección o barrio, con "Elegir en el mapa". Las previas privadas ocultan la dirección exacta hasta aprobar.
- **Entradas y cobro**:
  - gratis o paga, y precio;
  - capacidad y edad mínima (18 = ATP no aplica, mayores de 18);
  - ¿quién recibe la plata? (Yo / mi organización, u Otra persona, con titular);
  - cómo se paga (alias o CBU);
  - interruptor "Cobrar con comprobante", con su explicación: cada persona reserva, te transfiere y te manda la captura; vos confirmás que te llegó y recién ahí recibe su entrada; el lugar se guarda 30 minutos;
  - link de venta externo (opcional);
  - lista VIP;
  - anotarse hasta (fecha límite);
  - nota: "El dinero va directo a vos. Partazy no cobra ni devuelve dinero".
- **Detalles opcionales**: dress code, estilo de música, line-up, reglas, preguntas frecuentes (chips con sugerencias: "¿Hay guardarropa?", "¿Se puede reingresar?").
- **Revisar y publicar**: vista previa de la tarjeta y "Publicar evento".

## Tarjeta de evento (Inicio y Explorar)
Hoy: foto arriba, categoría con ícono, nombre y una línea de meta (fecha, hora, lugar), amigos que van. Pedido: fecha y hora bien grandes y legibles (estilo "21 Nov | 21 hrs", con número grande en Barlow Condensed), lugar con ícono de pin, y estados como "Agotado" o "Últimos lugares" sin perder el estilo oscuro.

## Movimiento
Corto y con sentido: entrada de pantalla con fade, botón principal con brillo naranja, barra de pasos que se llena. Sin animaciones en formularios más allá de transiciones de 180 ms.
