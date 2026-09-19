import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

export default defineConfig({
  // Keep pages, CSS, artwork and worker chunks portable to /emergence/ or any static subdirectory.
  base: './',
  build: {
    rolldownOptions: { input: { landing: 'index.html', world: 'world.html' } },
  },
  plugins: [{
    name: 'project-license',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'LICENSE',
        source: readFileSync(new URL('./LICENSE', import.meta.url), 'utf8'),
      });
    },
  }],
});
