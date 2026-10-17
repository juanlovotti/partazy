// Página /organizadores: el formulario "Quiero que me contacten".
// Guarda el pedido en la colección "consultas" (motivo "organizacion"), la misma del formulario de Ayuda:
// el equipo lo ve en Moderación → Consultas, dentro de la app. No hace falta tener cuenta.
(function(){
  const firebaseConfig = {
    apiKey: "AIzaSyBPp2zWegA2Zb7zk69Y0s49WDkjhkUAheY",
    authDomain: "partazy-5555d.firebaseapp.com",
    projectId: "partazy-5555d",
    storageBucket: "partazy-5555d.firebasestorage.app",
    messagingSenderId: "368869218217",
    appId: "1:368869218217:web:28644477f4c2395ce996b8"
  };
  const APP_CHECK_CLAVE = '6LeoQfEtAAAAADoqMsmN55Yb2GUSTvCktkil5TCi';
  const MAIL = 'partazycontacto@gmail.com';
  const form = document.getElementById('form-org');
  if(!form) return;
  const estado = document.getElementById('o-estado');
  const btn = document.getElementById('o-enviar');
  const val = id => (document.getElementById(id).value || '').trim();
  const avisar = (txt, ok) => { estado.textContent = txt; estado.className = 'estado ' + (ok ? 'ok' : 'error'); };

  let db = null;
  try{
    firebase.initializeApp(firebaseConfig);
    try{ if(firebase.appCheck) firebase.appCheck().activate(new firebase.appCheck.ReCaptchaEnterpriseProvider(APP_CHECK_CLAVE), true); } catch(e){}
    db = firebase.firestore();
  } catch(e){ console.warn('firebase', e); }

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const nombre = val('o-nombre'), email = val('o-email');
    if(nombre.length < 2){ avisar('Escribí tu nombre.'); return; }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ avisar('Revisá tu mail.'); return; }
    const partes = [
      'Organizador (desde partazy.com/organizadores)',
      val('o-org') && 'Organización: ' + val('o-org'),
      'Organiza: ' + val('o-tipo'),
      val('o-ciudad') && 'Ciudad: ' + val('o-ciudad'),
      val('o-wa') && 'WhatsApp: ' + val('o-wa'),
      val('o-msg') && 'Mensaje: ' + val('o-msg')
    ].filter(Boolean);
    if(!db){ avisar('No se pudo enviar. Escribinos a ' + MAIL); return; }
    btn.disabled = true; btn.textContent = 'Enviando...';
    try{
      await db.collection('consultas').add({
        nombre: nombre.slice(0, 60), email: email.slice(0, 100), motivo: 'organizacion',
        mensaje: partes.join(' · ').slice(0, 1000), uid: '', ts: Date.now()
      });
      form.reset();
      avisar('¡Listo! Te escribimos en breve para ayudarte con tu primer evento.', true);
    } catch(e){
      console.error(e);
      avisar('No se pudo enviar. Escribinos a ' + MAIL);
    } finally { btn.disabled = false; btn.textContent = 'Quiero que me contacten'; }
  });
})();
