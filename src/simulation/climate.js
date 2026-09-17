import { weatherAt, WEATHER_VERSION, MAX_TEMPERATURE_ANOMALY, MAX_MOISTURE_ANOMALY } from './weather.js';

/** Provisional climate coefficients from the research summary, section 4. */
export const DAYS_PER_YEAR = 360;
const SEASONS = Array.from({ length: DAYS_PER_YEAR }, (_, day) =>
  Math.sin(2 * Math.PI * day / DAYS_PER_YEAR));

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function validateDay(day) {
  if (!Number.isSafeInteger(day) || day < 0) {
    throw new RangeError('Day must be a non-negative safe integer.');
  }
}

function landHumidity(hex, width, temperature, seasonalSignal) {
  return clamp(
    Math.exp(-hex.distanceToWater / (width / 20))
      - Math.max(0, hex.bedElevation) / 10000
      - 0.01 * Math.max(0, temperature - 20)
      - 0.1 * seasonalSignal,
    0,
    1,
  );
}

function readingsAt(world, hex, season, day, result = {}) {
  const latitude = 90 - 180 * hex.row / (world.height - 1);
  const water = hex.waterType !== 'none';
  const surfaceHeight = water ? hex.waterLevel : hex.bedElevation;
  const meanTemperature = 28 - 60 * (Math.abs(latitude) / 90) ** 2
    - 0.0065 * Math.max(0, surfaceHeight);
  const seasonalAmplitude = water ? 4 : 12;
  const annualSignal = Math.abs(latitude) / 90;
  const seasonalSignal = latitude / 90 * season;
  const variable = world.climateVariability?.version === WEATHER_VERSION;
  const weather = weatherAt(world, hex, day);
  const annualMaximumTemperature = clamp(meanTemperature + seasonalAmplitude * annualSignal
    + (variable ? MAX_TEMPERATURE_ANOMALY : 0), -40, 40);

  const temperature = clamp(meanTemperature + seasonalAmplitude * seasonalSignal + weather.temperatureAnomaly, -40, 40);
  const humidity = water ? null : clamp(landHumidity(hex, world.width, temperature, seasonalSignal)
    + weather.moistureAnomaly, 0, 1);
  // Humidity decreases monotonically as the seasonal signal increases, so
  // this is its annual minimum without sampling every day of the year.
  const annualMinimumHumidity = water ? null
    : clamp(landHumidity(hex, world.width, annualMaximumTemperature, annualSignal)
      - (variable ? MAX_MOISTURE_ANOMALY : 0), 0, 1);
  result.latitude = latitude;
  result.meanTemperature = meanTemperature;
  result.annualMaximumTemperature = annualMaximumTemperature;
  result.temperature = temperature;
  result.humidity = humidity;
  result.annualMinimumHumidity = annualMinimumHumidity;
  result.permanentIce = annualMaximumTemperature < 0;
  Object.assign(result, weather);
  result.frozen = temperature < 0;
  result.iceCover = clamp(-temperature / 5, 0, 1);
  return result;
}

/** Read one physical location without copying a world or changing its day.
 * Sparse consumers (including life models) use exactly the atlas climate rules.
 */
export function climateAt(world, hex, day) {
  validateDay(day);
  return readingsAt(world, hex, SEASONS[day % DAYS_PER_YEAR], day);
}

/** Internal builder: modifies only the newly owned generation snapshot. */
export function assignClimate(world, day = 0) {
  validateDay(day);
  const season = SEASONS[day % DAYS_PER_YEAR];
  for (const hex of world.hexes) readingsAt(world, hex, season, day, hex);

  world.day = day;
  return world;
}

function copySnapshot(value) {
  if (Array.isArray(value)) return value.map(copySnapshot);
  if (value !== null && typeof value === 'object') {
    // Copy scalar fields together; recurse only into owned nested records.
    // Avoid allocating an entry pair and callback result for every scalar.
    const copy = { ...value };
    for (const key of Object.keys(copy)) {
      if (copy[key] !== null && typeof copy[key] === 'object') copy[key] = copySnapshot(copy[key]);
    }
    return copy;
  }
  return value;
}

/** Explicit time input; neither geography nor the source snapshot is changed. */
export function setDay(world, day) {
  validateDay(day);
  return assignClimate(copySnapshot(world), day);
}
