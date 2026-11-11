# u06: base de React

- **Qué cambió:**
  - Se agregaron React 19.3, react-dom, TypeScript 7 (con `tsconfig.json`) y Vitest + Testing Library.
  - `src/react/interruptores.ts`: `PUBLICADAS`, `DISPONIBLES` y `?react=` (solo fuera de producción). Carga React con `import()` dinámico solo si hay alguna pantalla prendida.
  - `src/react/arranque.tsx`: monta cada pantalla en un contenedor display:contents dentro de `#pantalla-X` (el pie legal queda de la app vieja).
  - `src/react/legado.ts`: acceso tipado a la app vieja.
- **Peso:** el archivo principal no cambia (React va en un archivo aparte de 69 KB gzip, que se baja solo si hay pantallas prendidas). No se precarga.
- **Volver atrás:** vaciar `PUBLICADAS`.
- **Tailwind:** instalado, pero todavía sin uso. Cuando se use, irá con prefijo y sin preflight, para no chocar con app.css.
