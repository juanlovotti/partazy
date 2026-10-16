# Pendientes y próximos pasos

## Configuración pendiente (dueño)

- [ ] **App Check → Enforce:** activarlo recién cuando el gráfico de *App Check → APIs → Cloud Firestore* muestre casi todo como verificado. Mirar el uso de Fraud Defense (10.000/mes gratis) antes.
- [ ] **Login con Facebook:** crear la app en Meta y cambiar `LOGIN_FACEBOOK` a `true`.

## Ideas para más adelante

- [ ] Dominio propio (ej. partazy.com.ar) en Firebase Hosting + mail con la marca reenviado a partazycontacto@gmail.com.
- [ ] Plan Blaze + Cloud Functions: avisos push con la app cerrada, vista previa por evento al compartir el link, aviso automático a la lista de espera cuando se libera un lugar, limpieza programada.
- [ ] Pruebas de `firestore.rules` con el emulador de Firebase.
- [ ] Partir `js/app.js` en módulos más chicos si el equipo crece (hoy es un solo script global a propósito).
- [ ] Revisión de código por un desarrollador humano.
