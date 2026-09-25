import { createDebugProfiler } from './debugdev-profiler.js';

// Vite replaces both branches at build time. Normal dev and static builds do
// not construct a profiler, install timers, or read the debug configuration.
export const debug = import.meta.env?.DEV && import.meta.env.MODE === 'debugdev' && __DEBUGDEV_CONFIG__?.enabled
  ? createDebugProfiler(__DEBUGDEV_CONFIG__, { label: typeof document === 'undefined'
    ? globalThis.name || 'worker' : 'UI' }) : null;

if (debug) {
  debug.announce();
  setInterval(() => debug.flush(), __DEBUGDEV_CONFIG__.reportIntervalMs);
  globalThis.addEventListener?.('pagehide', () => debug.flush());
}
