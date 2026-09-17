import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWorld, setDay, WORLD_SIZES } from '../../src/simulation/world.js';

// Shared geography already enforces barriers before any life model is selected.
// Verify the physical evidence, rather than interpreting region colours as walls.
test('every accepted map retains physical barriers at all sizes and generation-control extremes', () => {
  for (const size of Object.keys(WORLD_SIZES)) {
    for (const seed of ['v2-barriers-coasts', 'v2-barriers-ridges']) {
      for (const geography of [0, 1]) {
        for (const landFraction of [0.35, 0.4]) {
          for (const waterAbundance of [0, 1]) {
            const world = generateWorld({ seed, size, geography, landFraction, waterAbundance });
            const context = JSON.stringify({ seed, size, geography, landFraction, waterAbundance });
            assert.equal(world.quality.accepted, true, context);
            assert.ok(world.quality.meaningfulRegions > 1, context);
            const costlyPasses = world.passes.filter(pass => !world.regions[pass.fromRegion].hardBarrier
              && !world.regions[pass.toRegion].hardBarrier && pass.difficulty > 0);
            assert.ok(costlyPasses.length > 0, `At least one real costly connection: ${context}`);
            assert.equal(costlyPasses.length, world.quality.costlyPasses, context);
            for (const pass of costlyPasses) {
              const first = world.hexes[pass.fromHex];
              const second = world.hexes[pass.toHex];
              assert.ok(first.neighbors.includes(second.id), context);
              assert.equal(first.regionId, pass.fromRegion, context);
              assert.equal(second.regionId, pass.toRegion, context);
              assert.ok(pass.reasons.length > 0, `Cost comes from named physical conditions: ${context}`);
            }
            const coasts = world.hexes.filter(hex => hex.waterType === 'none' && !hex.permanentIce
              && hex.neighbors.some(id => world.hexes[id].waterType !== 'none'));
            assert.ok(coasts.length > 0, `Habitat crossing away from permanent ice: ${context}`);
            const inlandBarriers = world.hexes.filter(hex => hex.waterType === 'none'
              && hex.barrierReasons.some(reason => reason === 'river crossing' || reason === 'high mountain ridge'));
            assert.ok(inlandBarriers.length > 0, `Land barriers, not only polar ocean: ${context}`);
            assert.ok(world.hexes.some(hex => hex.waterType === 'none' && hex.runoff > 0), context);
          }
        }
      }
    }
  }
});

test('physical barriers reproduce from the same inputs and retain their geography through seasons', () => {
  const settings = { seed: 'v2-barriers-repeat', size: 'small', geography: 1, waterAbundance: 0 };
  const world = generateWorld(settings);
  assert.deepEqual(generateWorld(settings), world);
  for (const day of [90, 180, 270, 360, 3600]) {
    const seasonal = setDay(world, day);
    assert.deepEqual(seasonal.regions, world.regions);
    assert.deepEqual(seasonal.passes, world.passes);
    assert.deepEqual(seasonal.hexes.map(hex => [hex.waterType, hex.bedElevation, hex.barrierReasons]),
      world.hexes.map(hex => [hex.waterType, hex.bedElevation, hex.barrierReasons]));
  }
});
