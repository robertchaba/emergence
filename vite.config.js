import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { validateDebugConfig } from './src/ui/debugdev-profiler.js';

export default defineConfig(({ command, mode }) => ({
  define: {
    __DEBUGDEV_CONFIG__: command === 'serve' && mode === 'debugdev'
      ? JSON.stringify(validateDebugConfig(JSON.parse(readFileSync(new URL('./degugdev-config.json', import.meta.url), 'utf8'))))
      : 'null',
  },
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
}));
