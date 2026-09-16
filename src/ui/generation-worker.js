import { generateWorld } from '../simulation/world.js';

// Browser adapter only. Generation still receives explicit deterministic inputs.
self.onmessage = ({ data }) => {
  try {
    self.postMessage({ world: generateWorld(data) });
  } catch {
    self.postMessage({ world: null });
  }
};
