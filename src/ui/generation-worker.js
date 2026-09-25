import { generateWorld } from '../simulation/world.js';
import { debug } from './debugdev.js';

const generate = debug?.wrap('generation.total', generateWorld) ?? generateWorld;

// Browser adapter only. Generation still receives explicit deterministic inputs.
self.onmessage = ({ data }) => {
  try {
    const world = generate(data);
    debug?.flush(); // This temporary worker is terminated immediately after its reply.
    self.postMessage({ world });
  } catch {
    self.postMessage({ world: null });
  }
};
