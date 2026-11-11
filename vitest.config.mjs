// Pruebas de los componentes React (Vitest + Testing Library). Las pruebas de la app completa siguen en tests/.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', include: ['src/react/**/*.test.tsx'], restoreMocks: true },
});
