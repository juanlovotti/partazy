// Arma el "paquete de prueba": src/app.js empaquetado como un script común (IIFE), con el mismo puente global
// que usa el sitio. Las pruebas jsdom lo cargan en cada ventana, igual que antes cargaban app.js.
import { build } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import puenteGlobal from '../herramientas/vite-puente-global.mjs';
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
await build({
  root: RAIZ, configFile: false, logLevel: 'error', publicDir: false,
  plugins: [puenteGlobal(), react()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: path.join(RAIZ, 'tests', '.paquete'), emptyOutDir: true, minify: false, sourcemap: false,
    // Igual que en el sitio (módulo ES), el código corre en modo estricto
    rollupOptions: { output: { banner: '"use strict";' } },
    lib: { entry: path.join(RAIZ, 'src', 'app.js'), formats: ['iife'], name: 'PartazyApp', fileName: () => 'app.js' },
  },
});
