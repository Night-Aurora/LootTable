import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const sourcemap = mode === 'sourcemap';

  return {
    plugins: [react()],
    base: '/LootTable/',
    build: {
      sourcemap: sourcemap,
    },
  };
});
