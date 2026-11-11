// Puente temporal de la migración (fase 1).
//
// app.js era un script clásico: todo lo que declaraba arriba de todo (funciones, const, let) quedaba
// global. De eso dependen los onclick="..." del HTML, las plantillas de texto y las pruebas.
// Ahora app.js es un módulo ES que Vite empaqueta (minificado y con hash), y en un módulo nada es global.
//
// Este plugin lee las declaraciones de primer nivel de src/app.js y le agrega adelante un bloque que las
// publica en window con get/set, así todo sigue andando igual que antes:
//   - leer window.ir devuelve la función ir del módulo;
//   - asignar window.confirmar = otra (lo hacen algunas pruebas) cambia la función que usa el módulo.
// Las const se publican solo para leer. Se borra cuando la app vieja ya no exista (u30).
import { parse } from 'acorn';

export function nombresDePrimerNivel(codigo){
  const ast = parse(codigo, { ecmaVersion: 'latest', sourceType: 'module' });
  const nombres = [];
  for(const n of ast.body){
    if(n.type === 'FunctionDeclaration' && n.id) nombres.push({ nombre: n.id.name, escribible: true });
    else if(n.type === 'ClassDeclaration' && n.id) nombres.push({ nombre: n.id.name, escribible: true });
    else if(n.type === 'VariableDeclaration'){
      for(const d of n.declarations){
        if(d.id.type !== 'Identifier') throw new Error('Declaración con desestructuración en el primer nivel: agregala a mano al puente');
        nombres.push({ nombre: d.id.name, escribible: n.kind !== 'const' });
      }
    }
  }
  return nombres;
}

export function bloquePuente(codigo){
  const lineas = nombresDePrimerNivel(codigo).map(({ nombre, escribible }) =>
    `__puenteDef(${JSON.stringify(nombre)}, () => ${nombre}${escribible ? `, v => { ${nombre} = v; }` : ''});`);
  return '/* puente global temporal (herramientas/vite-puente-global.mjs) */\n' +
    '(function(){ const __puenteDef = (k, g, s) => { try{ Object.defineProperty(window, k, s ? { get: g, set: s, configurable: true, enumerable: true } : { get: g, configurable: true, enumerable: true }); } catch(e){ console.warn("puente: no se pudo publicar", k); } };\n' +
    lineas.join('\n') + '\n})();\n';
}

export default function puenteGlobal(){
  return {
    name: 'partazy-puente-global',
    enforce: 'pre',
    transform(codigo, id){
      if(!/[\\/]src[\\/]app\.js$/.test(id.split('?')[0])) return null;
      return { code: bloquePuente(codigo) + codigo, map: null };
    }
  };
}
