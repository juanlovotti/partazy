// Prueba: el sitio se arma con Vite en dist/ y Firebase Hosting publica dist/ sin perder nada de lo que se publicaba antes.
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const RAIZ = path.join(__dirname, '..'), DIST = path.join(RAIZ, 'dist'), PUB = path.join(RAIZ, 'public');
let f = 0; const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if(!c) f++; };
const cfg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'firebase.json'), 'utf8'));
const sitio = cfg.hosting.find(h => h.site === 'partazy'), viejo = cfg.hosting.find(h => h.site === 'partazy-5555d');
ok(sitio && sitio.public === 'dist', 'partazy.com publica dist/');
ok(sitio.cleanUrls === true, 'sigue con direcciones limpias (/privacidad, /terminos...)');
const inm = sitio.headers.find(h => h.source === 'assets/**');
ok(inm && inm.headers.some(x => x.key === 'Cache-Control' && /immutable/.test(x.value) && /max-age=31536000/.test(x.value)), 'los archivos con hash (assets/) se guardan en el celu un año');
ok(sitio.headers.find(h => h.source === '**').headers.some(x => x.key === 'Cache-Control' && x.value === 'no-cache'), 'index.html y el resto siguen sin caché');
ok(viejo && viejo.public === 'public' && viejo.redirects?.length === 1, 'el sitio partazy-5555d sigue igual (solo redirige)');
ok(!fs.existsSync(path.join(PUB, 'index.html')) && fs.existsSync(path.join(RAIZ, 'index.html')), 'index.html está en la raíz (entrada de Vite) y no en public/');
// Armar
execSync('npx vite build', { cwd: RAIZ, stdio: 'pipe' });
const lista = d => { const r = []; (function rec(x){ for(const n of fs.readdirSync(path.join(d, x))){ const p = path.join(x, n); fs.statSync(path.join(d, p)).isDirectory() ? rec(p) : r.push(p); } })(''); return r.sort(); };
const pub = lista(PUB), dist = lista(DIST);
ok(pub.every(p => dist.includes(p) && fs.readFileSync(path.join(PUB, p)).equals(fs.readFileSync(path.join(DIST, p)))), 'todo lo de public/ llega igual a dist/ (' + pub.length + ' archivos)');
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
ok(new Set(html.match(/id="pantalla-[a-z-]+"/g) || []).size === 21, 'dist/index.html tiene las 21 pantallas');
ok(/<script type="module" crossorigin src="\/assets\/[^"]+\.js"><\/script>/.test(html) && /<link rel="stylesheet" crossorigin href="\/assets\/[^"]+\.css">/.test(html), 'la app y sus estilos salen empaquetados y con hash en assets/');
ok(!/\/src\//.test(html), 'dist/index.html no apunta a src/ (todo quedó empaquetado)');
const js = dist.filter(p => /^assets[\\/].+\.js$/.test(p)).map(p => fs.readFileSync(path.join(DIST, p), 'utf8')).join('');
const css = dist.filter(p => /^assets[\\/].+\.css$/.test(p)).map(p => fs.readFileSync(path.join(DIST, p), 'utf8')).join('');
ok(/Object\.defineProperty\(window/.test(js) && /[`"']publicarEvento[`"']/.test(js) && /[`"']ir[`"']/.test(js), 'el puente publica en window las funciones de la app (para los onclick)');
ok(/-webkit-backdrop-filter/.test(css), 'se conserva -webkit-backdrop-filter para los iPhone viejos');
ok(['privacidad.html', 'terminos.html', 'soporte.html', 'eliminar-cuenta.html', 'organizadores.html', 'lanzamiento.html'].every(n => dist.includes(n)), 'las 6 páginas públicas están en dist/');
console.log(f ? '\nFALLAS: ' + f : '\nTODO OK'); process.exit(f ? 1 : 0);
