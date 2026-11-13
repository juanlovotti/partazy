# Extractable components — Partazy

## BottomNav
- Source: `index.html` líneas 990-1033 (`nav.navbar`), CSS `.navbar`, `.nav-item` en src/app.css
- Category: layout
- Description: barra de abajo del celular: Inicio, Explorar, Crear (círculo naranja al centro), Chats, Perfil
- Extractable props: activeItem (string, default: "crear")
- Hardcoded: íconos SVG de trazo, textos, colores

## CrearTopBar
- Source: `index.html` líneas 294-299 (`.topbar` de la pantalla Crear)
- Category: layout
- Description: título "CREAR" en Barlow Condensed y botón cerrar (✕) en círculo
- Extractable props: title (string, default: "Crear")
- Hardcoded: ícono de cerrar

## EventCard
- Source: `tarjetaHTML()` en src/app.js (ver .superdesign/context/tarjeta.md)
- Category: basic
- Description: tarjeta de evento: foto arriba, categoría con ícono, nombre, línea de fecha/lugar, amigos que van
- Extractable props: none (contenido)
