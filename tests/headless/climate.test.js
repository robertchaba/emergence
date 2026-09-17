import test from 'node:test';
import assert from 'node:assert/strict';
import { assignClimate, climateAt, setDay } from '../../src/simulation/climate.js';
import { createGrid } from '../../src/simulation/grid.js';
import { partitionRegions } from '../../src/simulation/regions.js';
import { generateWorld } from '../../src/simulation/world.js';

function fixture(width = 12, height = 9) {
  return {
    width, height, day: 0,
    hexes: createGrid(width, height).map((hex) => ({
      ...hex,
      bedElevation: 100,
      waterType: 'none',
      waterLevel: null,
      distanceToWater: 1,
      runoff: 0,
      downstream: null,
    })),
  };
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} is not close to ${expected}`);
}

test('sparse climate readings match complete atlas seasons without changing inputs', () => {
  const world = freeze(generateWorld({ seed: 'sparse-climate', size: 'small' }));
  const before = JSON.stringify(world);
  for (const day of [0, 1, 90, 270, 359, 360, 721]) {
    const full = setDay(world, day);
    for (const hex of world.hexes) {
      const readings = climateAt(world, hex, day);
      for (const [key, value] of Object.entries(readings)) {
        assert.equal(value, full.hexes[hex.id][key], `${key} at ${hex.id}, day ${day}`);
      }
    }
  }
  assert.equal(JSON.stringify(world), before);
  for (const day of [-1, 0.5, NaN, Infinity]) {
    assert.throws(() => climateAt(world, world.hexes[0], day), RangeError);
  }
});

test('seasons are annual and opposite across mirrored hemispheres', () => {
  const spring = assignClimate(fixture(), 0);
  const summer = setDay(spring, 90);
  const winter = setDay(spring, 270);
  for (const north of summer.hexes) {
    const opposite = (summer.height - 1 - north.row) * summer.width + north.col;
    near(north.temperature, winter.hexes[opposite].temperature);
    near(north.humidity, winter.hexes[opposite].humidity);
    near(spring.hexes[north.id].temperature, spring.hexes[opposite].temperature);
  }
  const northId = 2 * spring.width;
  assert.ok(summer.hexes[northId].temperature > spring.hexes[northId].temperature);
  assert.ok(winter.hexes[northId].temperature < spring.hexes[northId].temperature);
  const nextYear = setDay(spring, 450);
  assert.deepEqual(nextYear.hexes, summer.hexes);
});

test('climate uses surface elevation and smaller seasonal swings over water', () => {
  const world = fixture();
  const land = world.hexes[2 * world.width];
  const upland = world.hexes[land.id + 1];
  const sea = world.hexes[land.id + 2];
  const lake = world.hexes[land.id + 3];
  land.bedElevation = 0;
  upland.bedElevation = 1000;
  Object.assign(sea, { waterType: 'sea', bedElevation: -5000, waterLevel: 0 });
  Object.assign(lake, { waterType: 'lake', bedElevation: -500, waterLevel: 1000 });
  assignClimate(world, 0);
  near(land.temperature - upland.temperature, 6.5);
  near(sea.temperature, land.temperature);
  near(sea.temperature - lake.temperature, 6.5);
  const summer = setDay(world, 90);
  const winter = setDay(world, 270);
  near(summer.hexes[land.id].temperature - winter.hexes[land.id].temperature,
    3 * (summer.hexes[sea.id].temperature - winter.hexes[sea.id].temperature));
  assert.equal(sea.humidity, null);
  assert.equal(lake.humidity, null);
});

test('setDay owns its complete snapshot and preserves physical geography and region graph', () => {
  const original = freeze(generateWorld({ seed: 'season-purity', size: 'small' }));
  const before = JSON.stringify(original);
  const later = setDay(original, 123);
  assert.equal(JSON.stringify(original), before);
  assert.equal(later.day, 123);
  assert.notEqual(later.hexes, original.hexes);
  assert.notEqual(later.hexes[0].neighbors, original.hexes[0].neighbors);
  assert.notEqual(later.regions, original.regions);
  assert.notEqual(later.randomState, original.randomState);
  assert.deepEqual(later.regions, original.regions);
  assert.deepEqual(later.passes, original.passes);
  assert.deepEqual(later.regionConnections, original.regionConnections);
  assert.ok(later.hexes.some((hex, id) => hex.temperature !== original.hexes[id].temperature));
  const changingClimate = new Set(['temperature', 'humidity', 'temperatureAnomaly', 'moistureAnomaly',
    'waterLevelAnomaly', 'currentWaterLevel', 'waterExposure', 'frozen', 'iceCover']);
  const physicalFacts = hex => Object.fromEntries(Object.entries(hex).filter(([key]) => !changingClimate.has(key)));
  for (const hex of later.hexes) {
    assert.deepEqual(physicalFacts(hex), physicalFacts(original.hexes[hex.id]));
  }
  for (const day of [-1, 1.5, Infinity, NaN, '1', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => setDay(original, day), RangeError);
  }
});

test('humidity stays bounded, belongs only to land, and annual minima bound all seasons', () => {
  const world = generateWorld({ seed: 'season-bounds', size: 'small' });
  for (const day of [0, 45, 90, 135, 180, 225, 270, 315]) {
    const snapshot = setDay(world, day);
    for (const hex of snapshot.hexes) {
      assert.ok(hex.temperature >= -40 && hex.temperature <= 40);
      if (hex.waterType !== 'none') {
        assert.equal(hex.humidity, null);
        assert.equal(hex.annualMinimumHumidity, null);
      } else {
        assert.ok(Number.isFinite(hex.humidity) && hex.humidity >= 0 && hex.humidity <= 1);
        assert.ok(hex.humidity + 1e-12 >= hex.annualMinimumHumidity);
      }
      assert.equal(hex.permanentIce, hex.annualMaximumTemperature < 0);
      if (hex.permanentIce) assert.ok(hex.temperature < 0);
    }
  }
});

test('generated geographic regions are deterministic, connected and explained by physical passes', () => {
  const settings = { seed: 'regional-geography', size: 'small', geography: 0.4 };
  const first = generateWorld(settings);
  const second = generateWorld(settings);
  assert.deepEqual(first.regions, second.regions);
  assert.deepEqual(first.passes, second.passes);
  const claimed = new Set();
  for (const region of first.regions) {
    const members = new Set(region.hexIds);
    const visited = new Set([region.hexIds[0]]);
    const queue = [region.hexIds[0]];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      for (const id of first.hexes[queue[cursor]].neighbors) {
        if (members.has(id) && !visited.has(id)) {
          visited.add(id);
          queue.push(id);
        }
      }
    }
    assert.equal(visited.size, members.size, `Region ${region.id} must be connected`);
    for (const id of members) {
      assert.ok(!claimed.has(id));
      claimed.add(id);
      assert.equal(first.hexes[id].regionId, region.id);
    }
  }
  assert.equal(claimed.size, first.hexes.length);
  assert.ok(first.quality.meaningfulRegions > 1);
  assert.ok(first.passes.length > 0);
  for (const pass of first.passes) {
    const from = first.hexes[pass.fromHex];
    const to = first.hexes[pass.toHex];
    assert.ok(from.neighbors.includes(to.id));
    assert.equal(from.regionId, pass.fromRegion);
    assert.equal(to.regionId, pass.toRegion);
    assert.ok(pass.reasons.length > 0);
    assert.ok(pass.difficulty > 0 && pass.difficulty <= 1);
    assert.equal(pass.hardBarrier, false);
    assert.equal(from.permanentIce || to.permanentIce, false);
  }
  const winter = setDay(first, 270);
  const winterPartition = partitionRegions(winter);
  assert.deepEqual(winterPartition.regions, first.regions);
  assert.deepEqual(winterPartition.passes, first.passes);
});

test('ridges, wide deep ocean and polar ice form hard zones; an isthmus remains costly', () => {
  const world = fixture();
  for (const hex of world.hexes) {
    Object.assign(hex, { waterType: 'sea', bedElevation: -4000, waterLevel: 0 });
    if (hex.row >= 2 && hex.row <= 6 && hex.col <= 2) {
      Object.assign(hex, { waterType: 'none', bedElevation: 100, waterLevel: null });
    }
    if (hex.row === 4 && hex.col >= 3 && hex.col <= 5) {
      Object.assign(hex, { waterType: 'none', bedElevation: 100, waterLevel: null });
    }
  }
  const ridge = world.hexes[3 * world.width + 1];
  ridge.bedElevation = 3500;
  partitionRegions(assignClimate(world, 0));
  const neck = world.hexes[4 * world.width + 4];
  const deepSea = world.hexes[4 * world.width + 8];
  assert.ok(ridge.barrierReasons.includes('high mountain ridge'));
  assert.equal(world.regions[ridge.regionId].hardBarrier, true);
  assert.ok(deepSea.barrierReasons.includes('wide deep ocean'));
  assert.equal(world.regions[deepSea.regionId].hardBarrier, true);
  assert.ok(world.hexes[0].barrierReasons.includes('permanent ice'));
  assert.ok(neck.barrierReasons.includes('narrow land connection'));
  assert.equal(world.regions[neck.regionId].hardBarrier, false);
  assert.ok(neck.traversalDifficulty > 0.5 && neck.traversalDifficulty < 1);
  for (const pass of world.passes) {
    assert.ok(pass.fromHex !== ridge.id && pass.toHex !== ridge.id);
    assert.ok(pass.fromHex !== deepSea.id && pass.toHex !== deepSea.id);
  }
});
