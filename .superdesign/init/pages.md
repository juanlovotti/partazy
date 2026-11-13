# Pages — dependencias por pantalla

## Crear evento (#/crear) — objetivo de este diseño
Entry: index.html líneas 293-459 (`#pantalla-crear`), lógica en src/app.js (`irAPasoCrear`, `pintarResumenPasos`, `elegirTipo`, `toggleSwitchPago`, `publicarEvento`).
Dependencies:
- .superdesign/context/crear.html (markup real completo de la pantalla + barra de abajo)
- .superdesign/context/crear.css (reglas reales de src/app.css que usa)
- .superdesign/init/theme.md (tokens)
Pasos hoy: 1 Lo básico (nombre, fecha, horario, hora de cierre, foto, descripción) · 2 Tipo de evento (grilla de 13 tipos) · 3 Dónde y detalles (lugar + mapa, capacidad, edad mínima, dress code, estilo de música, line-up, entrada paga, precio, quién recibe la plata, cómo se paga, cobrar con comprobante, link de venta externo, lista VIP, anotarse hasta, reglas, preguntas frecuentes) + Publicar.

## Inicio (tarjetas de evento)
Entry: index.html 160-233 (`#pantalla-home`), tarjetas con `tarjetaHTML()` en src/app.js.
Dependencies:
- .superdesign/context/tarjeta.md (función de la tarjeta + CSS real)
- .superdesign/init/theme.md
