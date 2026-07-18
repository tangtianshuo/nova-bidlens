import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      external: [
        'fs/promises',
        'crypto',
        'path',
        'os',
        'fs',
        'child_process',
        'docx4js',
        'pdf-parse'
      ]
    }
  },
  resolve: {
    alias: {
      // 确保Node.js模块在浏览器中被正确处理
    }
  }
});
