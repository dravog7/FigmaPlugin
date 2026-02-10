import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), viteSingleFile()],
    root: path.resolve(__dirname, 'src/ui'),
    build: {
      outDir: path.resolve(__dirname, 'dist'),
      emptyOutDir: false,
      minify: true,
      target: 'es2015',
      assetsInlineLimit: 100000000,
      chunkSizeWarningLimit: 100000000,
      cssCodeSplit: false,
      brotliSize: false,
      rollupOptions: {
        input: {
          ui: path.resolve(__dirname, 'src/ui/index.html'),
        },
        output: {
          entryFileNames: 'ui.js',
        },
      },
    },
  };
});
