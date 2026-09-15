import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWorld, WORLD_SIZES } from '../../src/simulation/world.js';
import { createGrid, distancesFrom } from '../../src/simulation/grid.js';
import { elevationNoise, hashSeed, periodicNoise } from '../../src/simulation/noise.js';
import { deriveHydrology } from '../../src/simulation/hydrology.js';

function checkDrainage(world) {
  const { hexes } = world;
  for (const start of hexes) {
    const visited = new Set();
    let current = start;
    while (current.downstream !== null) {
      assert.ok(!visited.has(current.id), `Drainage cycle from ${start.id}`);
      visited.add(current.id);
      assert.ok(current.neighbors.includes(current.downstream));
      const next = hexes[current.downstream];
      assert.ok(current.spillElevation >= next.spillElevation);
      current = next;
    }
    assert.equal(current.waterType, 'sea');
  }
  const springTotal = hexes.reduce((sum, hex) => sum + hex.springDischarge, 0);
  const mouthTotal = hexes.filter((hex) => hex.waterType === 'sea').reduce((sum, hex) => sum + hex.runoff, 0);
  assert.equal(mouthTotal, springTotal, 'Every unit of spring discharge reaches the sea exactly once');
  for (const hex of hexes) {
    if (hex.springDischarge > 0) {
      assert.equal(hex.waterType, 'none');
      assert.ok(hex.bedElevation > 300);
      assert.equal(hex.spillElevation, hex.bedElevation);
    }
    if (hex.waterType === 'lake') {
      assert.ok(hex.lakeInflow > 0);
      assert.equal(hex.waterLevel, hex.spillElevation);
      assert.ok(hex.waterLevel > hex.bedElevation);
    }
    if (hex.waterType === 'sea') {
      assert.ok(hex.bedElevation < 0);
      assert.equal(hex.waterLevel, 0);
    }
  }
  for (const basin of world.basins) {
    const expected = basin.lakeInflow > 0 && !basin.sedimentFilled ? 'lake' : 'none';
    for (const id of basin.hexIds) assert.equal(hexes[id].waterType, expected);
  }
}

test('all sizes preserve the land budget, polar ocean, drainage and useful regions', () => {
  for (const [size, dimensions] of Object.entries(WORLD_SIZES)) {
    for (const geography of [0, 0.5, 1]) {
      for (const landFraction of [0.35, 0.38, 0.4]) {
        const world = generateWorld({ seed: 'field-notebook', size, geography, landFraction });
        assert.equal(world.hexes.length, dimensions.width * dimensions.height);
        assert.ok(Math.abs(world.nonMarineLandFraction - landFraction) <= 0.5 / world.hexes.length);
        assert.ok(world.dryLandFraction <= world.nonMarineLandFraction);
        for (const hex of world.hexes) {
          if (hex.row === 0 || hex.row === world.height - 1) assert.equal(hex.waterType, 'sea');
        }
        assert.ok(world.quality.accepted);
        assert.ok(world.quality.riverHexes > 0);
        assert.ok(world.quality.meaningfulRegions > 1);
        assert.ok(world.quality.costlyPasses > 0);
        checkDrainage(world);
      }
    }
  }
});

test('a seed reproduces the complete serializable snapshot', () => {
  const settings = { seed: 'a coastline with spaces 🌱', size: 'small', geography: 0.417, landFraction: 0.37 };
  const first = generateWorld(settings);
  assert.deepEqual(generateWorld(settings), first);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
  assert.notDeepEqual(generateWorld({ ...settings, seed: 'another coastline' }).hexes, first.hexes);
});

test('tiny worlds retain a coherent landmass, a spring-fed river and regional separation across seeds', () => {
  for (const seed of ['emergence', '1', '2', '3', 'north', 'south', 'islands', 'ridges', 'tiny', 'seam']) {
    for (const geography of [0, 0.5, 1]) {
      const world = generateWorld({ seed, size: 'small', geography });
      assert.ok(world.quality.largestLandmass >= 18);
      assert.ok(world.quality.riverHexes > 0);
      assert.ok(world.quality.meaningfulRegions > 1);
      assert.ok(world.quality.costlyPasses > 0);
    }
  }
});

test('odd-row topology is reciprocal, wraps longitude and stops at the poles', () => {
  const width = 24;
  const height = 16;
  const hexes = createGrid(width, height);
  for (const hex of hexes) {
    assert.equal(hex.neighbors.length, hex.row === 0 || hex.row === height - 1 ? 4 : 6);
    for (const id of hex.neighbors) {
      assert.ok(hexes[id].neighbors.includes(hex.id));
      assert.ok(Math.abs(hexes[id].row - hex.row) <= 1);
    }
    if (hex.col === 0) assert.ok(hex.neighbors.includes(hex.row * width + width - 1));
  }
  assert.equal(distancesFrom(hexes, [width * 8])[width * 8 + width - 1], 1);
  assert.equal(distancesFrom(hexes, [0])[width * (height - 1)], height - 1);
});

test('noise is periodic at the seam and continuous between frequency settings', () => {
  const seed = hashSeed('seam');
  for (const frequency of [4, 7, 10, 20, 160]) {
    for (const longitude of [0, 0.17, 0.9]) {
      assert.ok(Math.abs(periodicNoise(seed, longitude, 0.41, frequency)
        - periodicNoise(seed, longitude + 1, 0.41, frequency)) < 1e-12);
    }
  }
  const middle = 0.5;
  const before = elevationNoise(seed, 0.31, 0.43, middle - 1e-8, 24);
  const after = elevationNoise(seed, 0.31, 0.43, middle + 1e-8, 24);
  assert.ok(Math.abs(before - after) < 1e-6);
});

function basinFixture(depth = 400) {
  // Two upstream branches share a submerged basin; cell 4 is an untraversed
  // side pocket. Both springs must overflow via 2→1→0 after the whole fill.
  const neighbors = [[1], [0, 2], [1, 3, 4], [2, 5, 6], [2], [3], [3]];
  const beds = [-100, 500, 500 - depth, 500 - depth / 2, 500 - depth / 3, 800, 900];
  return { hexes: beds.map((bedElevation, id) => ({
    id, col: id, row: 0, neighbors: neighbors[id], bedElevation,
    waterType: id === 0 ? 'sea' : 'none',
  })) };
}

test('spring-fed basins fill side pockets and carry summed tributaries through one overflow', () => {
  const world = deriveHydrology(basinFixture(), hashSeed('basin'), { springIds: [5, 6] });
  assert.equal(world.basins.length, 1);
  assert.deepEqual(world.basins[0].hexIds, [2, 3, 4]);
  assert.equal(world.basins[0].lakeInflow, 2);
  assert.equal(world.hexes[4].runoff, 0);
  assert.equal(world.hexes[4].waterType, 'lake');
  assert.equal(world.hexes[4].waterLevel, 500);
  assert.equal(world.hexes[1].runoff, 2);
  checkDrainage(world);
});

test('unfed depressions remain dry and shallow basins sediment-fill as a whole', () => {
  const dry = deriveHydrology(basinFixture(), 7, { springIds: [] });
  for (const id of [2, 3, 4]) {
    assert.equal(dry.hexes[id].waterType, 'none');
    assert.equal(dry.hexes[id].waterLevel, null);
  }
  const shallow = deriveHydrology(basinFixture(4), 7, { springIds: [5] });
  assert.equal(shallow.basins[0].sedimentFilled, true);
  for (const id of [2, 3, 4]) {
    assert.equal(shallow.hexes[id].bedElevation, 500);
    assert.equal(shallow.hexes[id].waterType, 'none');
  }
  checkDrainage(shallow);
});

test('same-spill side pockets join across a zero-depth saddle without flooding the saddle', () => {
  const world = basinFixture();
  // Branches 3 and 4 are separate low pockets touching saddle 2 at the spill.
  world.hexes[2].bedElevation = 500;
  deriveHydrology(world, 7, { springIds: [5] });
  assert.equal(world.basins.length, 1);
  assert.deepEqual(world.basins[0].hexIds, [3, 4]);
  assert.deepEqual(world.basins[0].connectorHexIds, [1, 2]);
  assert.equal(world.hexes[4].waterType, 'lake');
  assert.equal(world.hexes[4].waterLevel, 500);
  assert.equal(world.hexes[2].waterType, 'none');
  assert.equal(world.hexes[2].waterLevel, 500);
  assert.equal(world.basins[0].lakeInflow, 1);
  checkDrainage(world);
});

test('an upper lake overflows into a lower basin without counting its flow twice', () => {
  const neighbors = [[1], [0, 2], [1, 3, 7], [2, 4], [3, 5, 6], [4], [4], [2]];
  const beds = [-100, 500, 100, 900, 600, 1200, 700, 200];
  const world = { hexes: beds.map((bedElevation, id) => ({
    id, col: id, row: 0, neighbors: neighbors[id], bedElevation,
    waterType: id === 0 ? 'sea' : 'none',
  })) };
  deriveHydrology(world, 8, { springIds: [5] });
  assert.equal(world.basins.length, 2);
  assert.deepEqual(world.basins.map((basin) => basin.lakeInflow), [1, 1]);
  assert.equal(world.hexes[4].waterLevel, 900);
  assert.equal(world.hexes[2].waterLevel, 500);
  assert.equal(world.hexes[0].runoff, 1);
  checkDrainage(world);
});

test('feeding a lower basin does not fill an unfed depression above its spill level', () => {
  // Spring 7 enters the lower lake. The upper basin behind saddle 4 has no
  // source, so connected drainage alone must not manufacture an upper lake.
  const neighbors = [[1], [0, 2], [1, 3, 4, 7], [2], [2, 5], [4, 6, 8], [5], [2], [5]];
  const beds = [-100, 500, 100, 200, 800, 600, 1200, 900, 650];
  const world = { hexes: beds.map((bedElevation, id) => ({
    id, col: id, row: 0, neighbors: neighbors[id], bedElevation,
    waterType: id === 0 ? 'sea' : 'none',
  })) };
  deriveHydrology(world, 8, { springIds: [7] });
  assert.equal(world.basins.length, 2);
  assert.deepEqual(world.basins.map((basin) => basin.lakeInflow), [1, 0]);
  assert.equal(world.hexes[2].waterType, 'lake');
  assert.equal(world.hexes[3].waterType, 'lake');
  assert.equal(world.hexes[2].waterLevel, 500);
  for (const id of [5, 8]) {
    assert.equal(world.hexes[id].waterType, 'none');
    assert.equal(world.hexes[id].waterLevel, null);
    assert.equal(world.hexes[id].runoff, 0);
  }
  assert.equal(world.hexes[0].runoff, 1);
  checkDrainage(world);
});

test('drainage, flow and distance can all cross the horizontal seam', () => {
  const width = 6;
  const height = 5;
  const world = { hexes: createGrid(width, height) };
  for (const hex of world.hexes) {
    hex.bedElevation = 1500;
    hex.waterType = 'none';
  }
  const mouth = 2 * width;
  const spring = 2 * width + width - 1;
  world.hexes[mouth].bedElevation = -100;
  world.hexes[mouth].waterType = 'sea';
  world.hexes[spring].bedElevation = 600;
  deriveHydrology(world, 8, { springIds: [spring] });
  assert.equal(world.hexes[spring].downstream, mouth);
  assert.equal(world.hexes[mouth].runoff, 1);
  assert.equal(world.hexes[spring].distanceToWater, 0);
  assert.equal(world.hexes[spring - 1].distanceToWater, 1);
  checkDrainage(world);
});

test('invalid generation parameters fail explicitly', () => {
  for (const options of [{ size: 'huge' }, { geography: -1 }, { geography: NaN }, { landFraction: 0.2 }, { seed: {} }]) {
    assert.throws(() => generateWorld(options));
  }
});


test('water abundance is validated, reproducible, and conserves drainage at every size', () => {
  for (const waterAbundance of [-0.1, 1.1, NaN, Infinity]) {
    assert.throws(() => generateWorld({ waterAbundance }), /Water abundance/);
  }
  for (const size of Object.keys(WORLD_SIZES)) {
    const worlds = [0, 0.5, 1].map((waterAbundance) => {
      const settings = { seed: 'water-control', size, waterAbundance };
      const world = generateWorld(settings);
      assert.deepEqual(generateWorld(settings), world);
      assert.equal(world.waterAbundance, waterAbundance);
      checkDrainage(world);
      return world;
    });
    const springs = worlds.map((world) => world.hexes.reduce((sum, hex) => sum + hex.springDischarge, 0));
    assert.ok(springs[0] < springs[1] && springs[1] < springs[2]);
    // For a fixed candidate, adding sources preserves all existing wet cells.
    if (worlds.every((world) => world.candidate === worlds[0].candidate)) {
      worlds[0].hexes.forEach((hex, id) => {
        if (hex.waterType === 'lake') assert.equal(worlds[2].hexes[id].waterType, 'lake');
        if (hex.runoff > 0) assert.ok(worlds[2].hexes[id].runoff >= hex.runoff);
      });
    }
  }
});
