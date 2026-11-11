// Vite arma el sitio de partazy.com en dist/ (lo que publica Firebase Hosting).
// - index.html (la app) está en la raíz del proyecto; src/app.js y src/app.css se empaquetan minificados y con hash.
// - public/ se copia tal cual: páginas públicas generadas, imágenes, video, sw.js y manifest.
// - puenteGlobal: mientras exista la app vieja, publica en window lo que app.js declara arriba de todo (ver el archivo).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import puenteGlobal from './herramientas/vite-puente-global.mjs';

// Navegadores que tienen que seguir andando (iPhone desde iOS 14): así no se sacan prefijos como -webkit-backdrop-filter.
export const NAVEGADORES = ['es2020', 'safari14', 'chrome87', 'firefox78', 'edge88'];

export default defineConfig({
  publicDir: 'public',
  plugins: [puenteGlobal(), react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    modulePreload: { polyfill: false },   // no hay módulos para precargar: se ahorra el código del polyfill
    target: NAVEGADORES,
    cssTarget: ['safari14', 'chrome87', 'firefox78', 'edge88'],
  },
  server: { port: 5173 },
});
