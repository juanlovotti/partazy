// Prueba: crear cuenta con email y "Olvidé mi contraseña" (mensajes claros, mail en castellano, link de vuelta)
const { JSDOM } = require('jsdom');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
let f = 0; const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if(!c) f++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const llamadas = [];
  const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://partazy.com/',
    beforeParse(w){ const fb = makeFirebase(crearStore(), () => null); const authOrig = fb.auth;
      fb.auth = () => { const a = authOrig(); a.sendPasswordResetEmail = async (e, o) => { llamadas.push(['reset', e, o]); if(o) throw { code: 'auth/unauthorized-continue-uri' }; };
        a.createUserWithEmailAndPassword = async () => { throw { code: 'auth/admin-restricted-operation' }; }; return a; };
      w.firebase = fb; w.navigator.geolocation = undefined; } }).window;
  await sleep(400);
  const $ = id => w.document.getElementById(id);
  ok(w.eval('auth').languageCode === 'es', 'los mails de Firebase salen en castellano');
  $('auth-email').value = 'juan@gmail'; await w.olvideContrasena();
  ok(/le falta algo/.test($('auth-error').textContent) && !llamadas.length, 'email incompleto: avisa y no manda nada');
  $('auth-email').value = ' Juan@Gmail.com '; await w.olvideContrasena();
  ok(llamadas.length === 2 && llamadas[0][2]?.url === 'https://partazy.com/' && llamadas[1][2] === undefined && llamadas[1][1] === 'juan@gmail.com', 'manda el mail con link de vuelta a partazy.com (y sin él si el dominio no está autorizado)');
  ok(/Revisá también Spam/.test($('auth-error').textContent) && $('auth-error').classList.contains('ok'), 'confirma en pantalla y sugiere revisar Spam');
  w.setModoAuth('crear'); $('auth-email').value = 'nuevo@gmail.com'; $('auth-pass').value = '123456'; await w.ingresarConEmail();
  ok(/no se pueden crear cuentas con email/.test($('auth-error').textContent), 'si en Firebase está apagado crear cuentas, lo dice claro');
  ok(/\(algo-raro\)/.test(w.mensajeAuth({ code: 'auth/algo-raro' })), 'un error desconocido muestra su código para poder diagnosticarlo');
  console.log(f ? '\nFALLAS: ' + f : '\nTODO OK'); process.exit(f ? 1 : 0);
})();
