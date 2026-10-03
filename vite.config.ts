import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// La web se publica en GitHub Pages bajo /cerrucho-comida-anual-2026/.
// Si algún día se mueve a un dominio propio, cambiar `base` a '/'.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/cerrucho-comida-anual-2026/',
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0])
