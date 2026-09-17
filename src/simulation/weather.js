import { coordinateHash, periodicNoise } from './noise.js';

export const WEATHER_VERSION = 'seeded-weather-1';
export const MAX_TEMPERATURE_ANOMALY = 2;
export const MAX_MOISTURE_ANOMALY = 0.1;
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => value * value * (3 - 2 * value);
const mix = (first, second, fraction) => first + (second - first) * fraction;

function temporal(seed, key, day, interval, salt) {
  const epoch = Math.floor(day / interval);
  const fraction = smooth(day % interval / interval);
  const sample = offset => coordinateHash(seed, key, epoch + offset, salt) / 4294967295 * 2 - 1;
  return mix(sample(0), sample(1), fraction);
}

function regional(world, hex, day, salt) {
  const epoch = Math.floor(day / 90);
  const longitude = (hex.col + 0.5 * (hex.row % 2)) / world.width;
  const latitude = hex.row / (world.height - 1);
  const seed = world.climateVariability.seed;
  const sample = offset => periodicNoise(seed, longitude, latitude, 4, epoch + offset + salt);
  return mix(sample(0), sample(1), smooth(day % 90 / 90));
}

/** Bounded physical variability; explicit time + world metadata fully determine it.
 * Water level is an observation around the established hydrology's static datum.
 * No basin, coastline, river flow, or adjacency is regenerated during a run. */
export function weatherAt(world, hex, day) {
  if (!Number.isSafeInteger(day) || day < 0) throw new RangeError('Day must be a non-negative safe integer.');
  const result = { temperatureAnomaly: 0, moistureAnomaly: 0, waterLevelAnomaly: 0,
    currentWaterLevel: hex.waterLevel ?? null, waterExposure: 0 };
  if (world.climateVariability?.version !== WEATHER_VERSION) return result;
  const seed = world.climateVariability.seed;
  const temperature = 0.7 * regional(world, hex, day, 491)
    + 0.3 * temporal(seed, 0, day, 1800, 521);
  const moisture = 0.7 * regional(world, hex, day, 719)
    + 0.3 * temporal(seed, 0, day, 1800, 751);
  result.temperatureAnomaly = MAX_TEMPERATURE_ANOMALY * temperature;
  result.moistureAnomaly = MAX_MOISTURE_ANOMALY * moisture;
  if (hex.waterType === 'lake') {
    // One surface per basin. Draw down only: established spill elevation remains
    // the upper bound, while shallow margins can temporarily be exposed.
    result.waterLevelAnomaly = -0.25 * (1 + temporal(seed, hex.basinId ?? hex.id, day, 180, 829));
    result.currentWaterLevel = hex.waterLevel + result.waterLevelAnomaly;
    const referenceDepth = Math.min(0.5, Math.max(0.001, hex.waterLevel - hex.bedElevation));
    result.waterExposure = 1 - clamp((result.currentWaterLevel - hex.bedElevation) / referenceDepth);
  } else if (hex.waterType === 'sea') {
    result.waterLevelAnomaly = 0.3 * temporal(seed, 0, day, 180, 853);
    result.currentWaterLevel = hex.waterLevel + result.waterLevelAnomaly;
  } else if (hex.runoff > 0) {
    // Channels have no cross-section in this physical model. Their bounded
    // exposure index describes reduced wet habitat without inventing a depth.
    result.waterExposure = 0.2 * Math.max(0, -moisture);
  }
  return result;
}
