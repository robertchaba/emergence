import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWorld, setDay } from '../../src/simulation/world.js';
import { climateAt } from '../../src/simulation/climate.js';
import { weatherAt, WEATHER_VERSION } from '../../src/simulation/weather.js';

test('seeded weather is bounded, slowly changing, reproducible and shared by sparse/atlas readings', () => {
  const world = generateWorld({ seed: 'weather-v2', size: 'small', waterAbundance: 1 });
  assert.equal(world.climateVariability.version, WEATHER_VERSION);
  const before = JSON.stringify(world);
  let sawYearVariation = false;
  for (const day of [0, 1, 89, 90, 91, 180, 359, 360, 721, 1800, 3600, 5400]) {
    const atlas = setDay(world, day);
    const surfaces = new Map();
    for (const hex of world.hexes) {
      const weather = weatherAt(world, hex, day);
      const later = weatherAt(world, hex, day + 1);
      assert.deepEqual(weatherAt(world, hex, day), weather);
      assert.ok(Math.abs(weather.temperatureAnomaly) <= 2);
      assert.ok(Math.abs(weather.moistureAnomaly) <= 0.1);
      assert.ok(Math.abs(later.temperatureAnomaly - weather.temperatureAnomaly) < 0.07);
      assert.ok(Math.abs(later.moistureAnomaly - weather.moistureAnomaly) < 0.004);
      assert.ok(weather.waterExposure >= 0 && weather.waterExposure <= 1);
      if (hex.waterType === 'lake') {
        assert.ok(weather.waterLevelAnomaly <= 0 && weather.waterLevelAnomaly >= -0.5);
        if (surfaces.has(hex.basinId)) assert.equal(weather.currentWaterLevel, surfaces.get(hex.basinId));
        surfaces.set(hex.basinId, weather.currentWaterLevel);
      }
      if (hex.waterType === 'sea') assert.ok(Math.abs(weather.waterLevelAnomaly) <= 0.3);
      if (hex.waterType === 'none') assert.equal(weather.currentWaterLevel, hex.waterLevel);
      const readings = climateAt(world, hex, day);
      for (const [key, value] of Object.entries(readings)) assert.equal(atlas.hexes[hex.id][key], value);
      assert.equal(readings.frozen, readings.temperature < 0);
      assert.ok(readings.iceCover >= 0 && readings.iceCover <= 1);
      if (readings.permanentIce) assert.ok(readings.temperature < 0);
      sawYearVariation ||= weather.temperatureAnomaly !== weatherAt(world, hex, day + 360).temperatureAnomaly;
    }
  }
  assert.ok(sawYearVariation, 'Different years share seasons but do not repeat the weather');
  assert.equal(JSON.stringify(world), before);
  assert.deepEqual(setDay(setDay(world, 100), 720), setDay(world, 720));
  assert.deepEqual(JSON.parse(JSON.stringify(world)), generateWorld({ seed: 'weather-v2', size: 'small', waterAbundance: 1 }));
});

test('weather metadata controls variation and shallow basin margins can become exposed without rewriting geography', () => {
  const world = { width: 12, height: 9, climateVariability: { version: WEATHER_VERSION, seed: 42 } };
  const hex = { id: 40, col: 4, row: 3, basinId: 1, waterType: 'lake', waterLevel: 100,
    bedElevation: 99.9, distanceToWater: 0, runoff: 1 };
  const shallow = Array.from({ length: 30 }, (_, index) => weatherAt(world, hex, index * 90));
  assert.ok(shallow.some(reading => reading.waterExposure > 0.5));
  assert.equal(hex.waterType, 'lake');
  assert.equal(hex.waterLevel, 100);
  const legacy = weatherAt({ ...world, climateVariability: undefined }, hex, 100);
  assert.deepEqual(legacy, { temperatureAnomaly: 0, moistureAnomaly: 0, waterLevelAnomaly: 0,
    currentWaterLevel: 100, waterExposure: 0 });
  assert.notDeepEqual(weatherAt(world, hex, 100), weatherAt({ ...world,
    climateVariability: { version: WEATHER_VERSION, seed: 43 } }, hex, 100));
  for (const day of [-1, 0.5, Infinity, NaN]) assert.throws(() => weatherAt(world, hex, day), RangeError);
});
