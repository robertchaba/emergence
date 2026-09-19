// Browser execution boundary. The life model itself never reads browser services.
import { createLifeModel } from '../simulation/life/v3/model.js';

let model = null;
self.onmessage = ({ data }) => {
  try {
    let result = null;
    if (data.command === 'initialize') model = createLifeModel(data.world, data.options);
    else if (!model) throw new Error('Life model is not initialized.');
    else if (data.command === 'introduce') result = model.introduce(data.hexId);
    else if (data.command === 'advance') model.advanceTo(data.day);
    else throw new Error('Unknown life command.');
    self.postMessage({ command: data.command, observation: model.observe(), result });
  } catch (error) {
    self.postMessage({ command: data.command, error: String(error.message || error) });
  }
};
