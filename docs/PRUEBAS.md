# Estrategia de pruebas para la migración (11/11/2026)

## Qué hay hoy

| Nivel | Qué | Cuánto | Dónde corre |
|---|---|---|---|
| Unidad (componentes React) | Vitest + Testing Library: Ayuda, el montaje con interruptores, el puente de estado y el Crear por pasos (`src/react/crear/borrador.test.ts` y `CrearPasos.test.tsx`) | 38 pruebas | `npm run test:react` |
| Tipos | TypeScript estricto en `src/react` | 1 chequeo | `npm run test:react` |
| Integración (la app entera en memoria) | jsdom con la app empaquetada igual que en el sitio y Firebase falso (`tests/fakefb.js`) | 51 archivos, más de 650 comprobaciones | `npm test` |
| Armado y publicación | `test_vite.js` (dist/, hashes, puente), `test_redireccion_hosting.js`, `test_paginas.js` | 3 archivos | `npm test` |
| Navegador real (capturas antes y después, axe, teclado) | Playwright + axe-core | Se corrió a mano en cada paso, **no está en el repo** | (scripts en la sesión de Claude) |
| Reglas de Firestore | — | **0** | bloqueado: el emulador no se puede descargar desde acá |

**Sumadas el 12/11:**
- `tests/test_tarjetas.js` (29): fecha sobre la foto, hora, lugar, sellos "Últimos N lugares" y "Agotado", venta externa sin sello, previas privadas sin dirección (ni en la etiqueta para lectores de pantalla), tarjeta horizontal y guía de colores.
- `tests/test_crear_react.js` (44): el Crear por pasos con la app completa. Sin interruptor sigue el de siempre; cada paso frena con su mensaje y lleva el foco al campo; previa privada (la dirección va aparte, nunca en el evento público); fiesta paga con comprobante, estilo y VIP; un error que encuentra la app vieja al publicar vuelve al paso justo; un lugar elegido de las sugerencias se borra si después escribís otro (aunque vayas y vuelvas de paso); editar sigue en el formulario de siempre.
- Recorrido en Chromium real con capturas y axe-core en los 7 pasos, a 390 y 1280 px: 0 problemas de accesibilidad.

**Lo fuerte:** los recorridos de negocio tienen pruebas de punta a punta en memoria:
- anotarse, reservar y pagar con comprobante (P2P), pasar la entrada a un amigo;
- QR y puerta, previas privadas (la dirección solo la ven los aprobados), moderación, chats, sin cuenta.

**Los huecos, por riesgo:**
1. **Reglas de Firestore sin pruebas.** Es la frontera de seguridad real: qué puede leer o escribir cada persona. Hoy un error recién aparece al publicar. `fakefb.js` tiene un enganche simple (`store.reglas`), pero no ejecuta `firestore.rules`.
2. **Navegador real fuera del repo.** Las comparaciones de capturas y axe se hicieron, pero no las puede repetir nadie más.
3. **jsdom no calcula el diseño.** No detecta cosas como la pantalla negra del iPhone del 11/11 ni un botón tapado.
4. **La paridad de cada pantalla React se prueba duplicando casos a mano** (`test_react_ayuda.js` repite `test_contacto.js`).

## Plan por unidad

### u07: puente de estado (React lee `state` y se entera de los cambios)
| Qué probar | Tipo | Casos de ejemplo |
|---|---|---|
| Suscripción a cambios | Unidad (Vitest) | Cambia `state.usuario`: el hook devuelve el nuevo valor. Al desmontar, deja de escuchar (sin escuchas colgadas). |
| No duplicar lecturas | Integración (jsdom) | Abrir y cerrar 5 veces una pantalla React no suma lecturas de Firestore (contar en `fakefb`). |
| La app vieja no se entera de React | Integración | Con el interruptor apagado, el `state` y las lecturas son idénticos a hoy (comparar contadores). |

### u08: tipos y datos (`DataService` tipado)
| Qué probar | Tipo | Casos de ejemplo |
|---|---|---|
| Tipos de documentos | `tsc` | `Evento`, `Usuario` y `Asistente` con los campos reales. Un campo mal escrito no compila. |
| Contratos de `DataService` | Unidad | Cada método que use React devuelve lo que dice su tipo, con datos de `fakefb`: evento sin foto, sin precio, privado sin dirección. |
| Datos viejos | Unidad | Eventos sin `cobroComprobante`, sin `ocasion` o con `hora` vacía no rompen el tipo ni la pantalla. |

### Fase 3: cada pantalla que pasa a React
Antes de prenderla en partazy.com, la pantalla tiene que pasar por todo esto:

| Qué probar | Tipo | Meta |
|---|---|---|
| Comportamiento | La misma prueba jsdom de la pantalla, corrida **dos veces**: vieja y con `?react=nombre` | Mismos resultados. Se arma un ayudante `conAmbas(nombre, prueba)` para no duplicar casos a mano. |
| Componente | Vitest | Estados vacíos, error de red, textos de la gente con `<script>` (se ven como texto). |
| Aspecto | Capturas antes y después, a 390, 768 y 1280 px | 0 píxeles distintos si es la versión idéntica; si es un diseño nuevo elegido, captura aprobada por Juan. |
| Accesibilidad | axe-core | 0 errores WCAG 2.1 AA. Tab y Escape como en `docs/ACCESIBILIDAD.md`. |
| Paridad | Agente revisor de paridad | Sin hallazgos altos ni medios abiertos. |
| Peso | `test_vite.js` | La primera visita no sube (el chunk de React solo baja con la pantalla prendida). |

## Cobertura que se busca
- **Recorridos críticos** (entrar, anotarse, pagar con comprobante, entrada con QR, puerta, previa privada): 100 % con prueba de integración. Hoy ya se cumple.
- **Cada pantalla React:** comportamiento en las dos versiones, más capturas, más axe.
- **Reglas de Firestore:** una prueba por colección sensible: `users/privado`, `events/private`, `comprobantes`, `attendees`, `dms`, `reports` y `admins`. Para cada una, quién puede y quién no.
- **No se prueba:** estilos sueltos, textos que no tienen lógica, scripts de una sola vez.

## Próximos pasos (en orden)
1. **Al arrancar u07:** pasar al repo las pruebas de navegador real (`tests/navegador/`, con Playwright y axe-core) y un comando `npm run test:navegador`. Lo corre Claude en la nube, porque en la compu de Juan no hay Playwright, y no hace falta instalarlo.
2. **Ayudante `conAmbas()`** para correr cada prueba de pantalla con la versión vieja y con la React.
3. **Pruebas de reglas (u05).** Hacen falta Java en la compu de Juan o habilitar `storage.googleapis.com` en la configuración de Claude. Mientras tanto, cada cambio de reglas se revisa a mano con el revisor de código.
4. **Prueba de humo en el link de prueba** antes de cada publicación: los recorridos del checklist de `docs/MIGRACION.md`, en el celu.
