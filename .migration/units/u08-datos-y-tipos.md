# u08: datos y tipos (hecha, 13/11)

- **Servicio de direcciones** `src/geo.js` (+ `geo.d.ts`): `buscarDireccion`, `direccionDePunto`, `cajaCerca`. Los 6 pedidos a Nominatim que estaban armados a mano en app.js (ubicar un lugar, sugerencias, ciudad desde coordenadas, ubicación manual del rango, dirección del punto del mapa y buscador del mapa) pasan por acá. Mismas direcciones (el buscador del mapa cambió solo el orden de los parámetros), mismo idioma y país, mismo manejo de errores (quien llama tiene su try/catch). Sin memoria: cada búsqueda va a Nominatim, como antes (las pruebas cuentan pedidos).
- **Tipos** `src/react/datos/tipos.ts`: Perfil, Privado, Evento, Asistencia (con sus 10 estados), Amistad, Notificación, Verificación. Salen de lo que guarda y lee app.js.
- **Capa de datos** `src/react/datos/api.ts`: `datos.*` tipado sobre DataService. Las pantallas React leen de acá, nunca de window.DataService; cuando se haga u03 (SDK modular) se cambia esta capa sola.
- **Hooks** `src/react/datos/hooks.ts`: `useCarga` (descarta respuestas viejas y las que llegan después de desmontar) y `useEscucha` (corta la escucha de Firestore al desmontar o al cambiar de cuenta).
- **Sin cambios a la vista.**
- **Validación:** 54 archivos de la app completa (incluye test_ubicacion, test_ubicar_evento, test_rango y test_crear_react, que usan las direcciones) y 46 pruebas de Vitest (8 nuevas en `src/react/datos/datos.test.tsx`).
- **Quedó para después:** pasar al repo las pruebas en navegador real (Playwright + axe) que hoy corren desde la carpeta de trabajo de Claude.
