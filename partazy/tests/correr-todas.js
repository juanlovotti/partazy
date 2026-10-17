// Corre todas las pruebas, una por una, y muestra un resumen.
// Uso (desde la carpeta del proyecto):  npm test        o una sola:  node tests/test_calif.js
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const archivos = fs.readdirSync(__dirname).filter(f => /^test_.*\.js$/.test(f)).sort();
let fallaron = [];
for(const f of archivos){
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', timeout: 120000 });
  const salida = (r.stdout || '') + (r.stderr || '');
  const ok = (salida.match(/✔/g) || []).length, mal = (salida.match(/✘/g) || []).length;
  const bien = r.status === 0 && !mal && !/ERROR JS/.test(salida);
  console.log(`${bien ? '✔' : '✘'} ${f.padEnd(22)} ${ok} comprobaciones${mal ? ` · ${mal} fallaron` : ''}`);
  if(!bien){ fallaron.push(f); console.log(salida.split('\n').filter(l => /✘|ERROR|Error/.test(l)).slice(0, 8).map(l => '    ' + l).join('\n')); }
}
console.log(fallaron.length ? `\n${fallaron.length} archivo(s) con fallas: ${fallaron.join(', ')}` : `\nTodo OK (${archivos.length} archivos de prueba)`);
process.exit(fallaron.length ? 1 : 0);
