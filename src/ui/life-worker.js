// Browser execution boundary. The life model itself never reads browser services.
import { createLifeModel } from '../simulation/life/v4/model.js';
import { createSave, restoreSave } from './save-state.js';
import { createLifeWorkerPool } from './life-worker-pool.js';
import { debug } from './debugdev.js';

let model = null;
let world = null;
const pool = createLifeWorkerPool({ debug });
const post = debug?.wrap('worker.post', data => self.postMessage(data)) ?? (data => self.postMessage(data));
let commands = Promise.resolve();
// Awaiting helper replies must not let export/tree/advance overtake a command.
self.onmessage = ({ data }) => { commands = commands.then(() => handleCommand(data)); };
async function handleCommand(data) {
  const timing = debug?.start('worker.command');
  try {
    let result = null;
    if (data.command === 'restore') {
      const restore = async () => restoreSave(JSON.parse(await data.file.text()), debug?.listeners, data.observationOptions);
      const restored = debug ? await debug.measureAsync('worker.restore', restore) : await restore();
      model = restored.model;
      world = restored.world;
      debug?.workload(restored.observation, data.command);
      post({ command: data.command, world, observation: restored.observation, view: restored.view });
      return;
    }
    if (data.command === 'initialize') {
      world = data.world;
      model = createLifeModel(world, data.options, debug?.listeners);
    }
    else if (!model) throw new Error('Life model is not initialized.');
    else if (data.command === 'tree') {
      const query = debug?.wrap('worker.tree', model.observeTree) ?? model.observeTree;
      post({ command: data.command, requestId: data.requestId, tree: query() });
      return;
    }
    else if (data.command === 'gene-history') {
      const query = debug?.wrap('worker.tree', model.inspectGeneHistory) ?? model.inspectGeneHistory;
      post({ command: data.command, requestId: data.requestId,
        trace: query(data.runId, data.speciesId, data.key) });
      return;
    }
    else if (data.command === 'export') {
      const encode = () => {
        const saved = createSave(world, model.exportState(), data.view);
        return { command: data.command, day: saved.life.day, json: JSON.stringify(saved) };
      };
      post(debug ? debug.wrap('worker.export', encode)() : encode());
      return;
    }
    else if (data.command === 'introduce') result = model.introduce(data.hexId);
    else if (data.command === 'advance') model.advanceTo(data.day);
    else if (data.command === 'observe') { /* Read-only inspection at the completed revision. */ }
    else throw new Error('Unknown life command.');
    const observe = () => pool.enabled ? model.observeAsync(pool.evaluate, data.observationOptions) : model.observe(data.observationOptions);
    const observation = debug ? await debug.measureAsync('observation.total', observe) : await observe();
    debug?.workload(observation, data.command);
    post({ command: data.command, observation, result });
  } catch (error) {
    post({ command: data.command, requestId: data.requestId, error: String(error.message || error) });
  } finally {
    debug?.end(timing);
  }
}
