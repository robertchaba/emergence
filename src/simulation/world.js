import { WORLD_SIZES, createGrid } from './grid.js';
import { coordinateHash, elevationNoise, hashSeed } from './noise.js';
import { deriveHydrology } from './hydrology.js';
import { assignClimate } from './climate.js';
import { partitionRegions } from './regions.js';

export { WORLD_SIZES } from './grid.js';
export { setDay } from './climate.js';
export const GENERATOR_VERSION = 'physical-world-2';
const MAX_CANDIDATES = 12;

function applyElevation(world, seed) {
  const { hexes, width, height, geography, landFraction } = world;
  const values = hexes.map((hex) => elevationNoise(seed,
    (hex.col + 0.5 * (hex.row % 2)) / width, hex.row / (height - 1), geography, width));
  // The reserved polar ocean is excluded before the whole-grid land budget.
  const eligible = hexes.filter((hex) => hex.row !== 0 && hex.row !== height - 1);
  eligible.sort((a, b) => values[b.id] - values[a.id] || a.id - b.id);
  const landCount = Math.round(hexes.length * landFraction);
  const seaLevel = (values[eligible[landCount - 1].id] + values[eligible[landCount].id]) / 2;
  const landIds = new Set(eligible.slice(0, landCount).map((hex) => hex.id));
  const highest = Math.max(...values);
  const lowest = Math.min(...values);
  for (const hex of hexes) {
    if (landIds.has(hex.id)) {
      const heightFraction = Math.max(0, (values[hex.id] - seaLevel) / (highest - seaLevel));
      hex.bedElevation = 1 + Math.round(4999 * heightFraction ** 1.25);
      hex.waterType = 'none';
    } else {
      const polarMinimum = hex.row === 0 || hex.row === height - 1 ? 0.03 : 0;
      const depthFraction = Math.max(polarMinimum, (seaLevel - values[hex.id]) / (seaLevel - lowest));
      hex.bedElevation = -1 - Math.round(5999 * Math.min(1, depthFraction) ** 0.9);
      hex.waterType = 'sea';
    }
  }
  world.nonMarineLandFraction = landCount / hexes.length;
}

function qualityOf(world) {
  const land = world.hexes.filter((hex) => hex.waterType !== 'sea');
  const visited = new Set();
  let largestLandmass = 0;
  for (const start of land) {
    if (visited.has(start.id)) continue;
    const queue = [start.id];
    visited.add(start.id);
    for (let index = 0; index < queue.length; index += 1) {
      for (const id of world.hexes[queue[index]].neighbors) {
        if (visited.has(id) || world.hexes[id].waterType === 'sea') continue;
        visited.add(id);
        queue.push(id);
      }
    }
    largestLandmass = Math.max(largestLandmass, queue.length);
  }
  const meaningfulRegions = world.regions.filter((region) => !region.hardBarrier && region.hexIds.length >= 3).length;
  const costlyPasses = world.passes.filter((pass) => !world.regions[pass.fromRegion].hardBarrier
    && !world.regions[pass.toRegion].hardBarrier && pass.difficulty > 0).length;
  const riverHexes = world.hexes.filter((hex) => hex.waterType === 'none' && hex.runoff > 0).length;
  return { largestLandmass, meaningfulRegions, costlyPasses, riverHexes,
    accepted: largestLandmass >= Math.max(6, Math.ceil(land.length * 0.12))
      && meaningfulRegions > 1 && costlyPasses > 0 && riverHexes > 0 };
}

/** Serializable physical geography only; no ecology, organism state or time loop. */
export function generateWorld({ seed = 'emergence', size = 'medium', geography = 0.5, landFraction = 0.38, waterAbundance = 0.5 } = {}) {
  if (!Object.hasOwn(WORLD_SIZES, size)) throw new RangeError('Choose small, medium or large world size.');
  if (typeof seed !== 'string' && (typeof seed !== 'number' || !Number.isFinite(seed))) throw new TypeError('Seed must be a string or finite number.');
  if (!Number.isFinite(geography) || geography < 0 || geography > 1) throw new RangeError('Geography must be between zero and one.');
  if (!Number.isFinite(landFraction) || landFraction < 0.35 || landFraction > 0.4) throw new RangeError('Land fraction must be between 0.35 and 0.40.');
  if (!Number.isFinite(waterAbundance) || waterAbundance < 0 || waterAbundance > 1) throw new RangeError('Water abundance must be between zero and one.');
  const dimensions = WORLD_SIZES[size];
  const seedHash = hashSeed(seed);
  let quality;
  for (let candidate = 0; candidate < MAX_CANDIDATES; candidate += 1) {
    const candidateSeed = coordinateHash(seedHash, candidate, 0, 173);
    const world = {
      version: GENERATOR_VERSION, seed: String(seed), size, ...dimensions,
      geography, landFraction, waterAbundance, day: 0, candidate,
      randomState: { algorithm: 'coordinate-hash-v1', seedHash, candidateSeed },
      hexes: createGrid(dimensions.width, dimensions.height),
      regions: [], passes: [],
    };
    applyElevation(world, candidateSeed);
    deriveHydrology(world, candidateSeed);
    assignClimate(world, 0);
    partitionRegions(world);
    quality = qualityOf(world);
    world.quality = quality;
    if (quality.accepted) return world;
  }
  throw new Error(`No suitable world found in ${MAX_CANDIDATES} deterministic candidates (${JSON.stringify(quality)}). Try another seed or geography setting.`);
}
