import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/overgreen/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        gallery: resolve(__dirname, 'gallery.html'),
        workshop: resolve(__dirname, 'workshop.html'),
      },
    },
  },
});
