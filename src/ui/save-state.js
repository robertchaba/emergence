// Save-file composition uses public engine APIs; biology owns its checkpoint.
import { generateWorld, GENERATOR_VERSION, WORLD_SIZES, setDay } from '../simulation/world.js';
import { WEATHER_VERSION } from '../simulation/weather.js';
import { restoreLifeModel } from '../simulation/life/v4/model.js';

export const SAVE_FORMAT = 'emergence-save-1';
const layers = ['terrain', 'elevation', 'temperature', 'humidity', 'regions'];

export function createSave(world, checkpoint, view) {
  const { seed, size, geography, landFraction, waterAbundance } = world;
  return { format: SAVE_FORMAT, generatorVersion: world.version,
    weatherVersion: world.climateVariability.version,
    settings: { seed, size, geography, landFraction, waterAbundance },
    life: checkpoint, view };
}

export function restoreSave(saved, diagnostics, observationOptions) {
  if (!saved || saved.format !== SAVE_FORMAT || saved.generatorVersion !== GENERATOR_VERSION
    || saved.weatherVersion !== WEATHER_VERSION) throw new TypeError('Incompatible save file.');
  const { settings, view } = saved;
  if (!settings || typeof settings.seed !== 'string' || !settings.seed.length || settings.seed.length > 100
    || !Object.hasOwn(WORLD_SIZES, settings.size)
    || !['geography', 'landFraction', 'waterAbundance'].every(key => Number.isFinite(settings[key]))) {
    throw new TypeError('Invalid world settings.');
  }
  if (!view || !layers.includes(view.layer) || !view.camera
    || !['x', 'y', 'zoom'].every(key => Number.isFinite(view.camera[key]))
    || view.camera.zoom < 1 || view.camera.zoom > 32
    || !Number.isInteger(view.speed) || view.speed < 1 || view.speed > 10
    || !(view.pinnedId === null || Number.isSafeInteger(view.pinnedId) && view.pinnedId >= 0)) {
    throw new TypeError('Invalid saved view.');
  }
  const geography = generateWorld(settings);
  if (view.pinnedId !== null && !geography.hexes[view.pinnedId]) throw new TypeError('Invalid saved hex.');
  const model = restoreLifeModel(geography, saved.life, diagnostics);
  const observation = model.observe(observationOptions);
  return { model, world: setDay(geography, observation.day), observation, view };
}
