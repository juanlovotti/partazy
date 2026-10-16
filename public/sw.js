// PARTAZY · service worker mínimo: muestra los avisos y abre la app al tocarlos.
// No guarda nada en caché (la app siempre se carga fresca).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const destino = e.notification.data && e.notification.data.destino;
  e.waitUntil((async () => {
    const lista = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const abierta = lista.find(c => c.url.startsWith(self.registration.scope));
    if(abierta){
      await abierta.focus();
      if(destino) abierta.postMessage({ tipo: 'abrir', destino });
    } else {
      const url = destino && destino.startsWith('evento:') ? './#/evento/' + destino.slice(7) : './';
      await self.clients.openWindow(url);
    }
  })());
});
