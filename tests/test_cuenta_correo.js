// Prueba: los links de los mails (contraseña nueva, verificar email) se resuelven en partazy.com con el diseño
// de la app, y en el navegador de Instagram/TikTok se avisa que hay que abrir Safari o Chrome para entrar con Google.
const { JSDOM } = require('jsdom');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
let f = 0; const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if(!c) f++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function abrir(url, ajustes = {}){
  const llamadas = [];
  const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url,
    beforeParse(w){
      if(ajustes.ua) Object.defineProperty(w.navigator, 'userAgent', { get: () => ajustes.ua });
      const fb = makeFirebase(crearStore(), () => null); const authOrig = fb.auth;
      fb.auth = Object.assign(() => { const a = authOrig();
        a.verifyPasswordResetCode = async c => { llamadas.push(['verificar', c]); if(ajustes.vencido) throw { code: 'auth/expired-action-code' }; return 'lu@gmail.com'; };
        a.confirmPasswordReset = async (c, p) => { llamadas.push(['confirmar', c, p]); };
        a.signInWithEmailAndPassword = async (e, p) => { llamadas.push(['ingresar', e, p]); };
        a.applyActionCode = async c => { llamadas.push(['aplicar', c]); };
        a.signInWithPopup = async () => { llamadas.push(['popup']); };
        return a; }, authOrig);
      w.firebase = fb; w.navigator.geolocation = undefined; } }).window;
  return { w, llamadas };
}
(async () => {
  // 1) Contraseña nueva
  let { w, llamadas } = abrir('https://partazy.com/?mode=resetPassword&oobCode=ABC123&apiKey=x&continueUrl=https%3A%2F%2Fpartazy.com%2F&lang=es');
  await sleep(500);
  let $ = id => w.document.getElementById(id);
  ok(w.eval('firebaseConfig.authDomain') === 'partazy.com', 'en partazy.com el ingreso con Google usa nuestro propio dominio');
  ok(!$('accion-correo').hidden && /Elegí tu contraseña nueva/.test($('accion-correo').textContent) && /lu@gmail\.com/.test($('accion-correo').textContent), 'el link del mail abre "Elegí tu contraseña nueva" con el email de la cuenta');
  ok(llamadas.some(l => l[0] === 'verificar' && l[1] === 'ABC123'), 'revisa el código del link antes de pedir la contraseña');
  $('cc-pass').value = 'secreto1'; $('cc-pass2').value = 'secreto2'; $('cc-guardar').click(); await sleep(50);
  ok(/no coinciden/.test($('cc-error').textContent) && !llamadas.some(l => l[0] === 'confirmar'), 'si las dos contraseñas no coinciden, avisa y no guarda');
  $('cc-pass').value = 'abc'; $('cc-pass2').value = 'abc'; $('cc-guardar').click(); await sleep(50);
  ok(/al menos 6/.test($('cc-error').textContent), 'pide al menos 6 caracteres');
  $('cc-pass').value = 'secreto1'; $('cc-pass2').value = 'secreto1'; $('cc-guardar').click(); await sleep(80);
  ok(llamadas.some(l => l[0] === 'confirmar' && l[1] === 'ABC123' && l[2] === 'secreto1') && llamadas.some(l => l[0] === 'ingresar' && l[1] === 'lu@gmail.com'), 'guarda la contraseña nueva y entra directo');
  ok(/¡Listo!/.test($('accion-correo').textContent), 'confirma que quedó guardada');
  $('cc-cerrar').click(); await sleep(20);
  ok($('accion-correo').hidden && w.location.search === '', 'al cerrar, la dirección queda limpia (sin el código largo)');

  // 2) Link vencido o ya usado
  ({ w, llamadas } = abrir('https://partazy.com/?mode=resetPassword&oobCode=VIEJO', { vencido: true }));
  await sleep(500); $ = id => w.document.getElementById(id);
  ok(/Este link ya no sirve/.test($('accion-correo').textContent) && /venció/.test($('accion-correo').textContent), 'link vencido: lo explica y dice cómo pedir uno nuevo');

  // 3) Verificar email
  ({ w, llamadas } = abrir('https://partazy.com/?mode=verifyEmail&oobCode=VERIF'));
  await sleep(500); $ = id => w.document.getElementById(id);
  ok(llamadas.some(l => l[0] === 'aplicar' && l[1] === 'VERIF') && /Email confirmado/.test($('accion-correo').textContent), 'el link para verificar el email confirma la cuenta en partazy.com');

  // 4) Sin link: no aparece nada
  ({ w, llamadas } = abrir('https://partazy.com/'));
  await sleep(400); $ = id => w.document.getElementById(id);
  ok($('accion-correo').hidden && $('aviso-app').hidden, 'entrando normal no aparece ningún cartel');
  ok(/si tu cuenta es de Google/i.test(w.mensajeAuth({ code: 'auth/invalid-credential' })), 'contraseña incorrecta: sugiere entrar con Google si la cuenta es de Google');

  // 5) Navegador de Instagram: Google no deja entrar ahí
  ({ w, llamadas } = abrir('https://partazy.com/', { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0' }));
  await sleep(400); $ = id => w.document.getElementById(id);
  ok(!$('aviso-app').hidden && /Instagram/.test($('aviso-app').textContent), 'en el navegador de Instagram avisa que hay que abrir Safari o Chrome');
  await w.ingresarConGoogle();
  ok(!llamadas.some(l => l[0] === 'popup') && /Safari/.test($('auth-error').textContent), 'no intenta Google ahí adentro (daría error) y explica qué hacer');
  ok(w.eval('firebaseConfig.authDomain') === 'partazy.com', 'el dominio de ingreso sigue siendo partazy.com');

  // 6) Si el contenido no entra (el navegador de Instagram es más bajo), la pantalla de ingreso tiene que scrollear
  const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'app.css'), 'utf8');
  const regla = sel => (css.match(new RegExp('(^|\\n)\\s*' + sel.replace(/[.#]/g, '\\$&') + '\\{([^}]*)\\}')) || [])[2] || '';
  ok(/overflow-y:auto/.test(regla('#pantalla-bienvenida')) && !/(^|;)\s*overflow:hidden/.test(regla('#pantalla-bienvenida')), 'la pantalla de ingreso se puede scrollear (no corta lo de abajo)');
  ok(/overflow-y:auto/.test(regla('.accion-correo')), 'la pantalla de contraseña nueva también scrollea si no entra');
  console.log(f ? '\nFALLAS: ' + f : '\nTODO OK'); process.exit(f ? 1 : 0);
})();
