// Arma la página como la ve el navegador, pero sin las librerías de internet (Firebase, QR, etc.):
// las pruebas usan una base de datos falsa en memoria (fakefb.js).
// La app (src/app.js) entra como "paquete de prueba" (tests/.paquete/app.js), que arma Vite con el mismo
// puente global que el sitio. Si el paquete falta o está viejo, se vuelve a armar.
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const RAIZ = path.join(__dirname, '..');
const PAQUETE = path.join(__dirname, '.paquete', 'app.js');
// Todo lo que entra al paquete: lo de src/ (app.js, ventanas.js, React), el puente y el armador
function fuentes(){
  const lista = [path.join(RAIZ, 'herramientas', 'vite-puente-global.mjs'), path.join(__dirname, 'armar-paquete.mjs')];
  (function rec(d){ for(const n of fs.readdirSync(d)){ const p = path.join(d, n); fs.statSync(p).isDirectory() ? rec(p) : lista.push(p); } })(path.join(RAIZ, 'src'));
  return lista;
}
function paqueteAlDia(){
  if(!fs.existsSync(PAQUETE)) return false;
  const t = fs.statSync(PAQUETE).mtimeMs;
  return fuentes().every(f => fs.statSync(f).mtimeMs <= t);
}
function armarSiHaceFalta(){
  if(paqueteAlDia()) return;
  // Si varias pruebas arrancan juntas, que una sola lo arme
  const lock = PAQUETE + '.armando';
  try{ fs.mkdirSync(path.dirname(PAQUETE), { recursive: true }); fs.mkdirSync(lock); }
  catch(e){ const hasta = Date.now() + 60000; while(!paqueteAlDia() && Date.now() < hasta) execSync('sleep 0.2'); return; }
  try{ execSync('node ' + JSON.stringify(path.join(__dirname, 'armar-paquete.mjs')), { cwd: RAIZ, stdio: 'pipe' }); }
  finally{ try{ fs.rmdirSync(lock); } catch(e){} }
}
module.exports = function cargarHTML(){
  armarSiHaceFalta();
  const css = fs.readFileSync(path.join(RAIZ, 'src', 'app.css'), 'utf8');
  const js = fs.readFileSync(PAQUETE, 'utf8');
  return fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8')   // index.html está en la raíz (entrada de Vite)
    .replace(/<script src="https?:[^>]+><\/script>/g, '')
    .replace('<link rel="stylesheet" href="/src/app.css">', () => '<style>' + css + '</style>')
    // El cartel "Sos Fundador" (una vez por cuenta) taparía las pantallas de las demás pruebas:
    // se da por visto, salvo en test_fundador.js (que pone window.__probarFundador = true).
    .replace('<script type="module" src="/src/app.js"></script>', () => '<script>if(!window.__probarFundador){ try{ const g = Storage.prototype.getItem; Storage.prototype.getItem = function(k){ return String(k).startsWith("partazy_fundador_") ? "1" : g.call(this, k); }; } catch(e){} }</script><script>' + js + '</script>');
};
