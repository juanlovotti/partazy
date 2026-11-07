// Prueba: partazy-5555d.firebaseapp.com / .web.app mandan todo a partazy.com MENOS las direcciones internas
// de Firebase (/__/...). Si /__/firebase/init.json se redirige, se rompen el ingreso con Google y los links
// de "Olvidé mi contraseña" (la página de Firebase muestra "Error encountered").
const fs = require('fs'), path = require('path');
let f = 0; const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if(!c) f++; };
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firebase.json'), 'utf8'));
const sitio = cfg.hosting.find(h => h.site === 'partazy-5555d');
const reglas = sitio.redirects || [];
ok(!reglas.some(r => r.source === '**' || r.source === '/**'), 'no hay una redirección que agarre absolutamente todo');
const re = reglas.filter(r => r.regex).map(r => new RegExp(r.regex));
const redirige = p => re.some(x => x.test(p));
['/', '/lanzamiento', '/organizadores', '/_algo', '/__', '/__x', '/index.html', '/img/logo.png'].forEach(p =>
  ok(redirige(p), 'redirige ' + p + ' a partazy.com'));
['/__/firebase/init.json', '/__/auth/action', '/__/auth/handler', '/__/auth/iframe', '/__/auth/iframe.js'].forEach(p =>
  ok(!redirige(p), 'deja pasar ' + p + ' (lo usa Firebase para Google y los mails)'));
// RE2 (el motor de Firebase) no acepta "mirar adelante" como (?! ) ni (?= )
ok(reglas.every(r => !r.regex || !/\(\?[=!<]/.test(r.regex)), 'la expresión es compatible con Firebase Hosting (sin lookahead)');
console.log(f ? '\nFALLAS: ' + f : '\nTODO OK'); process.exit(f ? 1 : 0);
