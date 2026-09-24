// Browser execution boundary. The life model itself never reads browser services.
import { createLifeModel } from '../simulation/life/v3/model.js';
import { createSave, restoreSave } from './save-state.js';
import { createLifeWorkerPool } from './life-worker-pool.js';

let model = null;
let world = null;
const pool = createLifeWorkerPool();
let commands = Promise.resolve();
// Awaiting helper replies must not let export/tree/advance overtake a command.
self.onmessage = ({ data }) => { commands = commands.then(() => handleCommand(data)); };
async function handleCommand(data) {
  try {
    let result = null;
    if (data.command === 'restore') {
      const restored = restoreSave(JSON.parse(await data.file.text()));
      model = restored.model;
      world = restored.world;
      self.postMessage({ command: data.command, world, observation: restored.observation, view: restored.view });
      return;
    }
    if (data.command === 'initialize') {
      world = data.world;
      model = createLifeModel(world, data.options);
    }
    else if (!model) throw new Error('Life model is not initialized.');
    else if (data.command === 'tree') {
      self.postMessage({ command: data.command, requestId: data.requestId, tree: model.observeTree() });
      return;
    }
    else if (data.command === 'gene-history') {
      self.postMessage({ command: data.command, requestId: data.requestId,
        trace: model.inspectGeneHistory(data.runId, data.speciesId, data.key) });
      return;
    }
    else if (data.command === 'export') {
      const saved = createSave(world, model.exportState(), data.view);
      self.postMessage({ command: data.command, day: model.observe().day, json: JSON.stringify(saved) });
      return;
    }
    else if (data.command === 'introduce') result = model.introduce(data.hexId);
    else if (data.command === 'advance') model.advanceTo(data.day);
    else throw new Error('Unknown life command.');
    const observation = pool.enabled ? await model.observeAsync(pool.evaluate) : model.observe();
    self.postMessage({ command: data.command, observation, result });
  } catch (error) {
    self.postMessage({ command: data.command, requestId: data.requestId, error: String(error.message || error) });
  }
}
