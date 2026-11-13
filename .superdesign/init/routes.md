# Routes — Partazy (una sola página con pantallas)

No hay router: `ir(nombre)` muestra `#pantalla-<nombre>` y suma un paso al historial. Rutas por hash: `#/crear`, `#/evento/{id}`, `#/u/{uid}`.

| Pantalla | id | Qué muestra |
|---|---|---|
| Inicio | pantalla-home | buscador, chips de filtro, filas de tarjetas (Hoy, En tendencia, Esta semana, Próximos) |
| Explorar | pantalla-explorar | buscador, Eventos/Personas, lista o mapa |
| Crear evento | pantalla-crear | formulario en 3 pasos (Lo básico, Tipo, Dónde y detalles) |
| Confirmación | pantalla-confirmacion | evento publicado |
| Detalle | pantalla-detalle | portada, datos, anotarse / reservar |
| Entrada | pantalla-ticket | entrada con QR, pago con comprobante |
| Perfil, Amigos, Usuario, Chats, Chat, Avisos, Verificación, Puerta, Ayuda, Privacidad, Términos, Moderación, Suspendido, Bienvenida, Registro | pantalla-* | |

Páginas aparte: /lanzamiento, /organizadores, /privacidad, /terminos, /soporte, /eliminar-cuenta.
