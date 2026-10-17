// Arma la página como la ve el navegador, pero sin las librerías de internet (Firebase, QR, etc.):
// las pruebas usan una base de datos falsa en memoria (fakefb.js).
const fs = require('fs'), path = require('path');
const PUBLIC = path.join(__dirname, '..', 'public');
module.exports = function cargarHTML(){
  const css = fs.readFileSync(path.join(PUBLIC, 'css', 'app.css'), 'utf8');
  const js = fs.readFileSync(path.join(PUBLIC, 'js', 'app.js'), 'utf8');
  return fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8')
    .replace(/<script src="https?:[^>]+><\/script>/g, '')
    .replace('<link rel="stylesheet" href="/css/app.css">', () => '<style>' + css + '</style>')
    // El cartel "Sos Fundador" (una vez por cuenta) taparía las pantallas de las demás pruebas:
    // se da por visto, salvo en test_fundador.js (que pone window.__probarFundador = true).
    .replace('<script src="/js/app.js"></script>', () => '<script>if(!window.__probarFundador){ try{ const g = Storage.prototype.getItem; Storage.prototype.getItem = function(k){ return String(k).startsWith("partazy_fundador_") ? "1" : g.call(this, k); }; } catch(e){} }</script><script>' + js + '</script>');
};
