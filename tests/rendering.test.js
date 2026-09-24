import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { territoryContours } from '../src/rendering/territory.js';
import { createGrid } from '../src/simulation/grid.js';
import { createMapRenderer, MAP_TOKEN_NAMES } from '../src/rendering/map.js';
import { createLifeTrendSvg } from '../src/rendering/life-trend.js';
import { lifeMarkerPositions, lifeMarkerPose, drawLifeMarker } from '../src/rendering/life-marks.js';
import { drawPlantShape, drawAnimalShape } from '../src/rendering/life-shapes.js';

const style = readFileSync(new URL('../src/ui/styles/tokens.css', import.meta.url), 'utf8');
const tokenValue = (name) => {
  const value = style.match(new RegExp(`${name}: ([^;]+);`))[1];
  return value.startsWith('var(') ? tokenValue(value.slice(4, -1)) : value;
};
const tokens = Object.fromEntries(MAP_TOKEN_NAMES.map((name) => [name, tokenValue(name)]));

function fixture() {
  const width = 6;
  const height = 4;
  const hexes = Array.from({ length: width * height }, (_, id) => ({
    id, col: id % width, row: Math.floor(id / width), neighbors: [],
    bedElevation: id * 10, waterType: 'none', temperature: id - 10,
    humidity: id / (width * height), regionId: id % 2,
    traversalDifficulty: 0.4, permanentIce: false,
    runoff: 0, springDischarge: 0, downstream: null,
  }));
  for (const hex of hexes) {
    const left = hex.row * width + (hex.col + width - 1) % width;
    const right = hex.row * width + (hex.col + 1) % width;
    hex.neighbors = [left, right];
  }
  hexes[6].runoff = 1;
  hexes[6].springDischarge = 1;
  hexes[6].downstream = 11;
  const world = { width, height, hexes, passes: [{ fromHex: 6, toHex: 11 }] };
  for (const hex of hexes) {
    Object.freeze(hex.neighbors);
    Object.freeze(hex);
  }
  Object.freeze(hexes);
  return Object.freeze(world);
}

function renderer() {
  const calls = [];
  const fills = [];
  const strokes = [];
  const context = new Proxy({}, {
    get(target, name) {
      if (name === 'fill') return () => fills.push(target.fillStyle);
      if (name === 'stroke') return () => { calls.push(['stroke']); strokes.push(target.strokeStyle); };
      return target[name] ?? ((...args) => calls.push([name, ...args]));
    },
  });
  const canvas = { getContext: () => context };
  const map = createMapRenderer(canvas, { tokens });
  map.resize(900, 600, 2);
  return { map, canvas, calls, fills, strokes };
}

test('hex picking matches every cell at fitted, zoomed, and panned positions', () => {
  const { map, canvas } = renderer();
  const world = fixture();
  assert.equal(canvas.width, 1800);
  for (const camera of [map.fit(world), { zoom: 3, x: 41, y: -24 }]) {
    for (const hex of world.hexes) {
      const point = map.cellCenter(world, hex.id, camera);
      assert.equal(map.hitTest(world, camera, point.x - 1e-7, point.y), hex.id);
    }
  }
  assert.equal(map.hitTest(world, map.fit(world), 450, -1000), null);
});

test('horizontal picking wraps continuously while the poles remain finite', () => {
  const { map } = renderer();
  const world = fixture();
  const camera = map.fit(world);
  const first = map.cellCenter(world, 6, camera);
  const next = map.cellCenter(world, 7, camera);
  const spacing = next.x - first.x;
  for (const turns of [-20, -1, 0, 1, 20]) {
    const x = first.x + turns * world.width * spacing;
    assert.equal(map.hitTest(world, camera, x - spacing, first.y), 11);
    assert.equal(map.hitTest(world, camera, x, first.y), 6);
    assert.equal(map.hitTest(world, camera, x + spacing, first.y), 7);
    assert.equal(map.hitTest(world, camera, x, -1000), null);
    assert.equal(map.hitTest(world, camera, x, 1600), null);
  }
});

test('minimum zoom leaves no duplicate partial hexes at any pan or viewport size', () => {
  const { map } = renderer();
  const world = fixture();
  for (const [width, height] of [[900, 600], [390, 300], [320, 600], [1800, 320]]) {
    map.resize(width, height);
    const minimum = map.fit(world);
    assert.ok(minimum.zoom > 1);
    const first = map.cellCenter(world, 0, minimum);
    const next = map.cellCenter(world, 1, minimum);
    const spacing = next.x - first.x;
    const circumference = spacing * world.width;
    assert.ok(circumference - spacing >= width + 8 - 1e-8);
    for (let step = -40; step <= 40; step++) {
      const camera = map.constrain(world, { zoom: 1, x: circumference * step / 13, y: 0 });
      assert.equal(camera.zoom, minimum.zoom);
      assert.ok(Math.abs(camera.x) <= circumference / 2 + 1e-8);
      for (const hex of world.hexes) {
        const point = map.cellCenter(world, hex.id, camera);
        const copies = [-1, 0, 1].filter(turn => {
          const x = point.x + turn * circumference;
          return x + spacing / 2 + 0.35 > 0 && x - spacing / 2 - 0.35 < width;
        });
        assert.ok(copies.length <= 1, `hex ${hex.id} appears at most once`);
        assert.equal(map.hitTest(world, camera, point.x, point.y), hex.id);
      }
      // No gap at the physical longitude seam, including staggered rows.
      for (const id of [6, 12]) {
        const y = map.cellCenter(world, id, camera).y;
        for (let x = 0; x <= width; x += 7) assert.notEqual(map.hitTest(world, camera, x, y), null);
      }
    }
  }
});

test('all layers draw frozen snapshots and seam flow uses short edge segments', () => {
  const { map, calls } = renderer();
  const world = fixture();
  const before = JSON.stringify(world);
  for (const layer of ['terrain', 'elevation', 'temperature', 'humidity', 'regions']) {
    map.draw(world, { camera: map.fit(world), layer, pinnedId: 11 });
  }
  assert.equal(JSON.stringify(world), before);
  // A segment crossing the wrap must be one neighbor spacing, not the whole map.
  map.setTokens(tokens);
  calls.length = 0;
  map.draw(world, { camera: map.fit(world), layer: 'terrain' });
  const connections = calls.filter((call, index) => call[0] === 'moveTo' && calls[index + 1]?.[0] === 'bezierCurveTo' && calls[index + 2]?.[0] === 'stroke');
  assert.equal(connections.length, 2); // one visible bank and water segment; no duplicate
  const spacing = map.cellCenter(world, 7, map.fit(world)).x - map.cellCenter(world, 6, map.fit(world)).x;
  for (const move of connections) {
    const line = calls[calls.indexOf(move) + 1];
    assert.ok(Math.abs(line[5] - move[1]) < spacing * 1.2);
    for (const x of [line[1], line[3]]) assert.ok(Math.abs(x - move[1]) < spacing * 1.5);
  }
});

test('theme updates require complete token values', () => {
  const { map } = renderer();
  assert.throws(() => map.setTokens({}), /Missing map token/);
});

test('frost remains white over relief while ice and diagnostic layers stay distinct', () => {
  const { map, fills } = renderer();
  const world = fixture();
  const warm = { ...world, hexes: world.hexes.map((hex) => ({ ...hex, temperature: 5 })) };
  const paletteBlocks = [style.split(":root[data-theme='dark']")[0], style.split(":root[data-theme='dark']")[1].split('/* Follow the system')[0]];
  for (const block of paletteBlocks) {
    const palette = { ...tokens };
    for (const name of MAP_TOKEN_NAMES) {
      const value = block.match(new RegExp(`${name}: ([^;]+);`))?.[1];
      if (value && !value.startsWith('var(')) palette[name] = value;
    }
    map.setTokens(palette);
    fills.length = 0;
    map.draw(world, { layer: 'terrain' });
    const frozen = fills[0].match(/\d+/g).map(Number);
    assert.ok(frozen.every((channel) => channel >= 220), `frosted land reads as white: ${frozen}`);
    fills.length = 0;
    map.draw(warm, { layer: 'terrain' });
    const thawed = fills[0].match(/\d+/g).map(Number);
    assert.ok(frozen.every((channel, index) => channel > thawed[index] + 40), 'frost contrasts with thawed ground');
    const ice = palette['--map-ice'].slice(1).match(/../g).map((channel) => parseInt(channel, 16));
    assert.ok(frozen.some((channel, index) => Math.abs(channel - ice[index]) > 10), 'frost stays distinct from blue water ice');
    fills.length = 0;
    map.draw(world, { layer: 'elevation' });
    const elevation = fills.slice(0, world.hexes.length);
    fills.length = 0;
    map.draw(warm, { layer: 'elevation' });
    assert.deepEqual(fills.slice(0, world.hexes.length), elevation);
  }
});


test('curved tributaries join, stay in their linked hexes, and remain stable across seasons and camera changes', () => {
  const { map, calls } = renderer();
  const base = fixture();
  const hexes = base.hexes.map(hex => ({ ...hex, runoff: 0, springDischarge: 0, downstream: null }));
  for (const [id, downstream, runoff] of [[8, 9, 3], [13, 14, 2], [14, 8, 3], [19, 14, 1]]) {
    Object.assign(hexes[id], { downstream, runoff });
  }
  hexes[9].waterType = 'sea';
  const world = { ...base, hexes };
  const capture = (snapshot, camera) => {
    map.setTokens(tokens); // Force a full frame when comparing geometry.
    calls.length = 0;
    map.draw(snapshot, { camera });
    return calls.flatMap((call, index) => call[0] === 'bezierCurveTo'
      ? [[calls[index - 1].slice(1), call.slice(1)]] : []);
  };
  const camera = map.fit();
  const curves = capture(world, camera);
  // Offscreen copies are culled; water follows the four visible bank paths.
  const main = curves.slice(0, 4);
  assert.deepEqual(main[1][1].slice(4), main[2][0]);
  assert.deepEqual(main[3][1].slice(4), main[2][0]);
  assert.deepEqual(main[2][1].slice(4), main[0][0]);
  const incoming = main[1][1], outgoing = main[2][1];
  const ax = incoming[4] - incoming[2], ay = incoming[5] - incoming[3];
  const bx = outgoing[0] - incoming[4], by = outgoing[1] - incoming[5];
  assert.ok(Math.abs(ax * by - ay * bx) < 1e-7, 'main channel has a continuous tangent at its junction');
  assert.ok(ax * bx + ay * by > 0);
  for (const [index, ids] of [[0, [8, 9]], [1, [13, 14]], [2, [14, 8]], [3, [19, 14]]]) {
    const [start, c] = main[index];
    for (let step = 0; step <= 40; step += 1) {
      const t = step / 40, u = 1 - t;
      const point = [0, 1].map(axis => u ** 3 * start[axis] + 3 * u ** 2 * t * c[axis]
        + 3 * u * t ** 2 * c[axis + 2] + t ** 3 * c[axis + 4]);
      assert.ok(ids.includes(map.hitTest(world, camera, ...point)), 'curve stays within the physical channel cells');
    }
  }
  assert.deepEqual(capture({ ...world, hexes: hexes.map(hex => ({ ...hex, temperature: -15 })) }, camera), curves);
  const zoomedCamera = { zoom: 1.2, x: 41, y: -24 };
  const zoomed = capture(world, zoomedCamera);
  const anchor = map.cellCenter(world, 0, camera);
  const zoomedAnchor = map.cellCenter(world, 0, zoomedCamera);
  for (let i = 0; i < curves.length; i += 1) {
    for (let part = 0; part < 2; part += 1) {
      curves[i][part].forEach((value, index) => {
        const axis = index % 2 ? 'y' : 'x';
        assert.ok(Math.abs((zoomed[i][part][index] - zoomedAnchor[axis]) / zoomedCamera.zoom - (value - anchor[axis])) < 1e-8);
      });
    }
  }
});

test('pin tint is drawn once when hovered and preserves terrain beneath it', () => {
  const { map, fills } = renderer();
  map.draw(fixture(), { pinnedId: 11, hoveredId: 11 });
  assert.equal(fills.filter(fill => fill === tokens['--map-pin-fill']).length, 1);
  fills.length = 0;
  map.draw(fixture(), { hoveredId: 11 });
  assert.equal(fills.includes(tokens['--map-pin-fill']), false);
});

test('cover fills the frame and respects the unique-hex minimum', () => {
  const { map } = renderer();
  const world = fixture();
  for (const [width, height] of [[900, 600], [390, 300], [320, 600]]) {
    map.resize(width, height);
    const camera = map.cover(world);
    assert.ok(camera.zoom > 1);
    for (const x of [0, width / 2, width]) {
      for (const y of [0, height / 2, height]) {
        assert.notEqual(map.hitTest(world, camera, x, y), null);
      }
    }
    assert.ok(camera.zoom >= map.fit(world).zoom);
  }
});

test('unchanged terrain skips raster work, with invalidation for presentation changes', () => {
  const { map, calls, fills } = renderer();
  const geography = fixture();
  const world = { ...geography, hexes: geography.hexes.map(hex => ({ ...hex, temperature: hex.temperature + 0.1 })) };
  map.draw(geography, { geography });
  calls.length = 0;
  fills.length = 0;
  map.draw(world, { geography });
  assert.equal(fills.length, 0);
  assert.equal(calls.some(([method]) => method === 'clearRect'), false);
  map.draw(world, { geography, pinnedId: 6 });
  assert.ok(fills.includes(tokens['--map-pin-fill']));
  for (const invalidate of [() => map.setTokens(tokens), () => map.resize(390, 300, 1.5)]) {
    invalidate();
    fills.length = 0;
    map.draw(world, { geography, pinnedId: 6 });
    assert.ok(fills.length >= geography.hexes.length);
  }
});

function freezeDeep(value) {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freezeDeep(child);
  return Object.freeze(value);
}

function lifeFixture({ revision = 1, runId = 'life-test', population = 800, role = 'producer', size = 0.2, hexId = 10, habitat = 'land' } = {}) {
  return freezeDeep({ revision, runId, hexes: [{ hexId, population,
    species: [{ id: 'species-1', population }], display: [{ role, size, habitat, population }],
  }] });
}

test('producer coverage at every body size tints land more than water and preserves diagnostic colors', () => {
  const { map, fills } = renderer();
  const world = fixture();
  const capture = (life, layer = 'terrain') => {
    map.setTokens(tokens);
    fills.length = 0;
    map.draw(world, { geography: world, life, layer });
    return fills[10];
  };
  const baseline = capture(null);
  const land = lifeFixture();
  const water = lifeFixture({ habitat: 'water' });
  const before = JSON.stringify([world, land, water]);
  const landColor = capture(land);
  const waterColor = capture(water);
  assert.notEqual(landColor, baseline);
  const channels = value => value.match(/\d+/g).map(Number);
  const distance = value => Math.hypot(...channels(value).map((channel, index) => channel - channels(baseline)[index]));
  assert.ok(distance(landColor) > distance(waterColor));
  for (const size of [0.5, 1]) {
    assert.equal(capture(lifeFixture({ size })), landColor, 'large plants keep the coverage tint');
    assert.ok(fills.includes(tokens['--map-life-plant']), 'large plants also retain their green dots');
    assert.equal(capture(lifeFixture({ size, habitat: 'water' })), waterColor);
  }
  assert.equal(capture(land, 'temperature'), capture(null, 'temperature'));
  for (const layer of ['temperature', 'humidity', 'regions']) {
    capture(land, layer);
    assert.ok(fills.includes(tokens['--map-life-plant']), `small plants remain visible on ${layer}`);
  }
  assert.equal(JSON.stringify([world, land, water]), before);
});

test('life revisions and extinction repaint affected hexes without stale markers', () => {
  const { map, calls, fills, strokes } = renderer();
  const world = fixture();
  const life = lifeFixture({ role: 'grazer', size: 0.7 });
  const before = JSON.stringify(life);
  map.draw(world, { geography: world, life });
  assert.ok(fills.includes(tokens['--map-life-grazer']));
  calls.length = 0;
  fills.length = 0;
  map.draw(world, { geography: world, life: lifeFixture({ revision: 2, role: 'grazer', size: 0.7 }) });
  assert.equal(fills.length, 0, 'an equivalent completed observation reuses the frame');
  map.draw(world, { geography: world, life: lifeFixture({ revision: 3, role: 'predator', size: 0.7 }) });
  assert.ok(fills.includes(tokens['--map-life-predator']));
  assert.ok(calls.some(([method]) => method === 'clearRect'));
  fills.length = 0;
  map.draw(world, { geography: world, life: freezeDeep({ runId: 'life-test', revision: 4, hexes: [] }) });
  assert.ok(fills.length > 0, 'extinction clears the former occupied tile');
  assert.equal(fills.includes(tokens['--map-life-predator']), false);
  map.draw(world, { geography: world, life, selectedSpeciesId: 'species-1', pinnedId: 10 });
  assert.ok(strokes.includes(tokens['--map-life-selected']));
  assert.deepEqual(strokes.slice(-2), [tokens['--map-pin-outline'], tokens['--map-pin']],
    'the contrasting selected hex rim stays above the species territory');
  assert.ok(fills.includes(tokens['--map-pin-fill']), 'physical selection remains above life');
  fills.length = 0;
  strokes.length = 0;
  map.draw(world, { geography: world, life, selectedSpeciesId: null });
  assert.ok(fills.includes(tokens['--map-life-grazer']));
  assert.equal(strokes.includes(tokens['--map-life-selected']), false);
  assert.equal(JSON.stringify(life), before);
});

test('life markers use a bounded population-independent budget and fixed world positions', () => {
  const { map, calls, fills } = renderer();
  const world = fixture();
  const life = freezeDeep({ runId: 'many', revision: 1, hexes: [{ hexId: 10, population: 1e12,
    species: [{ id: 'many', population: 1e12 }],
    display: Array.from({ length: 200 }, (_, index) => ({
      role: ['producer', 'grazer', 'predator', 'mixed', 'other'][index % 5],
      habitat: index % 2 ? 'water' : 'land', size: 0.6, population: 5e9,
    })),
  }] });
  const capture = camera => {
    map.setTokens(tokens);
    calls.length = 0;
    fills.length = 0;
    map.draw(world, { geography: world, life, camera });
    const markerColors = ['plant', 'grazer', 'predator', 'mixed', 'other'].map(role => tokens[`--map-life-${role}`]);
    const markerCount = fills.filter(fill => markerColors.includes(fill)).length;
    assert.ok(markerCount > 0 && markerCount <= 54, `marker budget ${markerCount}`);
    assert.ok(fills.filter(fill => fill === tokens['--map-life-plant']).length <= 24);
    assert.ok(fills.filter(fill => markerColors.slice(1).includes(fill)).length <= 30);
    return calls.filter(([method]) => method === 'translate').slice(-markerCount);
  };
  const camera = map.fit();
  const markers = capture(camera);
  const movedCamera = { zoom: 1.2, x: 5, y: -3 };
  const moved = capture(movedCamera);
  assert.equal(markers.length, moved.length);
  const origin = map.cellCenter(world, 10, camera);
  const movedOrigin = map.cellCenter(world, 10, movedCamera);
  for (let index = 0; index < markers.length; index += 1) {
    for (const [axis, coordinate] of [['x', 1], ['y', 2]]) {
      assert.ok(Math.abs((moved[index][coordinate] - movedOrigin[axis]) / movedCamera.zoom
        - (markers[index][coordinate] - origin[axis])) < 1e-8);
    }
  }
});

test('population poses stay bounded, deterministic and smoothly oriented, while all stationary marks stay still', () => {
  const positions = lifeMarkerPositions(10);
  const plant = { role: 'producer', mobile: false };
  const animal = { role: 'grazer', mobile: true };
  const stationary = { role: 'grazer', mobile: false };
  for (const slot of positions) {
    const rooted = lifeMarkerPose(plant, slot, 0);
    assert.deepEqual(lifeMarkerPose(plant, slot, 0), rooted);
    assert.deepEqual(lifeMarkerPose(plant, slot, 12), rooted);
    assert.equal(rooted.opacity, 1);
    assert.deepEqual(lifeMarkerPose(stationary, slot, 20), lifeMarkerPose(stationary, slot, 0));
    for (let time = 0; time < 50; time += 0.125) {
      const pose = lifeMarkerPose(animal, slot, time);
      const next = lifeMarkerPose(animal, slot, time + 0.00001);
      assert.ok(Math.hypot(pose.x, pose.y) <= 0.66);
      assert.ok(Math.hypot(next.x - pose.x, next.y - pose.y) < 0.00001);
      const tangent = Math.atan2(next.y - pose.y, next.x - pose.x);
      assert.ok(Math.cos(tangent - pose.heading) > 0.999, 'body faces its path');
    }
    const boundary = 35 - slot.offset;
    const before = lifeMarkerPose(animal, slot, boundary - 0.00001);
    const after = lifeMarkerPose(animal, slot, boundary + 0.00001);
    assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < 0.00001);
    assert.ok(Math.cos(after.heading - before.heading) > 0.999, 'turns join smoothly');
  }
});

test('large stationary plants survive tiny-plant aggregation and need no cosmetic repaints', () => {
  const { map, calls, fills } = renderer();
  const world = fixture();
  const life = freezeDeep({ runId: 'canopy', revision: 1, hexes: [{ hexId: 10, population: 1000001,
    species: [], display: [
      { role: 'producer', habitat: 'land', size: 0, population: 1000000 },
      { role: 'producer', habitat: 'land', size: 1, population: 1 },
    ],
  }] });
  map.draw(world, { geography: world, life });
  assert.ok(calls.some(([key]) => key === 'ellipse'), 'a rare large plant retains its canopy silhouette');
  assert.equal(calls.filter(([key]) => key === 'ellipse').length, 3, 'one large plant gives one rosette');
  assert.ok(calls.some(([key]) => key === 'arc'), 'tiny plants keep their smaller dots');
  assert.ok(fills.filter(fill => fill === tokens['--map-life-plant']).length > 10, 'static plants gain extra samples');
  calls.length = 0;
  fills.length = 0;
  map.draw(world, { geography: world, life, motionTime: 24 });
  assert.equal(fills.length, 0, 'plant-only hexes reuse their frame during playback');
  assert.equal(calls.some(([key]) => key === 'clearRect'), false);
  map.draw(world, { geography: world, life: { ...life, revision: 2, hexes: [] }, motionTime: 24 });
  assert.ok(fills.length > 0, 'real biological changes still erase the former plants');
});

test('life silhouettes distinguish habitat and role, reveal detail on zoom, and keep bounded drawing work', () => {
  const palette = Object.fromEntries(Object.entries(tokens).map(([key, value]) => [key.slice(6), value]));
  const slot = lifeMarkerPositions(10)[0];
  const capture = (marker, scale = 60, time = 1) => {
    const calls = [];
    const context = new Proxy({}, { get: (target, key) => target[key] ?? ((...args) => calls.push([key, ...args])) });
    drawLifeMarker(context, marker, slot, time, 0, 0, scale, palette);
    assert.ok(calls.length < 65, 'fixed work per representative, regardless of population');
    return calls;
  };
  const land = { role: 'grazer', size: 0.8, mobile: true, habitat: 'land' };
  const water = { ...land, habitat: 'water' };
  assert.ok(capture(land).some(([key]) => key === 'lineTo'), 'stepping limbs');
  assert.ok(capture(water).some(([key]) => key === 'bezierCurveTo'), 'flowing tail');
  assert.notDeepEqual(capture(land), capture(water));
  assert.notDeepEqual(capture(land), capture({ ...land, role: 'predator' }));
  assert.notDeepEqual(capture(land), capture(land, 60, 1.125));
  assert.deepEqual(capture(land), capture(land), 'frozen cosmetic time freezes pose');
  assert.equal(capture(land, 8).filter(([key]) => key === 'arc').length, 1);
  assert.equal(capture({ ...land, role: 'producer', mobile: false }).filter(([key]) => key === 'ellipse').length, 3);
  const plant = { ...land, role: 'producer', mobile: false };
  const radius = size => capture({ ...plant, size }).find(([key]) => key === 'scale')[1];
  assert.ok(radius(1) > radius(0.4) * 1.7, 'large canopies remain visibly larger at close zoom');
  assert.ok(capture({ ...plant, size: 1 }, 500).find(([key]) => key === 'scale')[1]
    > capture({ ...plant, size: 0.5 }, 500).find(([key]) => key === 'scale')[1] * 1.5,
  'size-dependent caps preserve the distinction at maximum zoom');
  assert.ok(radius(1) > 3.5, 'the former plant radius cap no longer hides large sizes');
  assert.deepEqual(capture(plant, 60, 0), capture(plant, 60, 120));
});

test('land and water have 28 distinct bounded silhouette families', () => {
  const silhouettes = new Set();
  for (const water of [false, true]) {
    for (const plant of [false, true]) {
      for (let variant = 0; variant < (plant ? 6 : 8); variant += 1) {
        const calls = [];
        const context = new Proxy({}, { get: (target, key) => target[key] ?? ((...args) => calls.push([key, ...args])) });
        const draw = () => plant ? drawPlantShape(context, variant, water, 'detail')
          : drawAnimalShape(context, variant, water, { role: 'grazer', size: 1, mobile: true }, 0.8, 'detail');
        draw();
        assert.ok(calls.length < 85, 'bounded path work for every silhouette');
        assert.equal(calls.filter(([key]) => key === 'fill').length, 1, 'one population fill per mark');
        silhouettes.add(JSON.stringify(calls));
        const first = JSON.stringify(calls);
        calls.length = 0;
        draw();
        assert.equal(JSON.stringify(calls), first);
        for (const [method, ...args] of calls) {
          if (['moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo'].includes(method)) {
            for (let i = 0; i < args.length; i += 2) {
              assert.ok(Math.hypot(args[i], args[i + 1]) <= (plant ? 1.25 : 2));
            }
          } else if (method === 'ellipse') {
            const [x, y, rx, ry, angle] = args;
            for (let i = 0; i < 40; i += 1) {
              const a = i * Math.PI / 20, dx = rx * Math.cos(a), dy = ry * Math.sin(a);
              assert.ok(Math.hypot(x + dx * Math.cos(angle) - dy * Math.sin(angle),
                y + dx * Math.sin(angle) + dy * Math.cos(angle)) <= (plant ? 1.25 : 2));
            }
          }
        }
      }
    }
  }
  assert.equal(silhouettes.size, 28);
});

test('large consumers stay visible beside tiny ones and move with a slower cosmetic gait', () => {
  const { map, calls } = renderer();
  const life = freezeDeep({ runId: 'sizes', revision: 1, hexes: [{ hexId: 10, population: 1000001,
    species: [], display: [
      { role: 'grazer', size: 0, habitat: 'land', mobile: true, population: 1000000 },
      { role: 'grazer', size: 1, habitat: 'land', mobile: true, population: 1 },
    ],
  }] });
  const world = fixture(), camera = { zoom: 5, x: 0, y: 0 };
  const center = map.cellCenter(world, 10, camera);
  camera.x = 450 - center.x; camera.y = 300 - center.y;
  map.draw(world, { life, camera });
  const radii = calls.filter(([method]) => method === 'scale').map(([, radius]) => radius);
  assert.ok(Math.max(...radii) > Math.min(...radii) * 3, 'rare large consumers retain their own size band');
  const slot = lifeMarkerPositions(10)[0];
  const small = { role: 'grazer', size: 0, mobile: true };
  const large = { ...small, size: 1 };
  const distance = marker => {
    const start = lifeMarkerPose(marker, slot, 0), end = lifeMarkerPose(marker, slot, 0.001);
    return Math.hypot(end.x - start.x, end.y - start.y);
  };
  assert.ok(distance(large) < distance(small) / 3);
  const beat = marker => lifeMarkerPose(marker, slot, 1).phase - lifeMarkerPose(marker, slot, 0).phase;
  assert.ok(beat(large) < beat(small) / 3);
  for (const size of [0, 0.5, 1]) {
    const still = { ...large, size, mobile: false };
    assert.deepEqual(lifeMarkerPose(still, slot, 0), lifeMarkerPose(still, slot, 200));
  }
});

test('mixed feeding colours survive aggregation, low zoom, revision changes and legacy observations', () => {
  const { map, fills } = renderer();
  const world = fixture();
  const combinations = [
    [['plantFeeding', 'animalFeeding'], 'omnivore'],
    [['photosynthesis', 'plantFeeding'], 'photo-grazer'],
    [['photosynthesis', 'animalFeeding'], 'photo-predator'],
    [['photosynthesis', 'plantFeeding', 'animalFeeding'], 'mixed'],
  ];
  const life = freezeDeep({ runId: 'feeding', revision: 1, hexes: [{ hexId: 10, population: 400,
    species: [], display: combinations.map(([energySources]) => ({ role: 'mixed',
      energySources, size: 0.7, mobile: false, habitat: 'water', population: 100 })),
  }] });
  for (const zoom of [0.1, 1, 3]) {
    fills.length = 0;
    const camera = { zoom, x: 0, y: 0 }, center = map.cellCenter(world, 10, camera);
    camera.x = 450 - center.x; camera.y = 300 - center.y;
    map.draw(world, { life, camera });
    for (const [, colour] of combinations) assert.ok(fills.includes(tokens[`--map-life-${colour}`]));
  }
  for (const [index, [energySources, colour]] of combinations.entries()) {
    fills.length = 0;
    map.draw(world, { life: { ...life, revision: index + 2, hexes: [{ ...life.hexes[0],
      display: [{ ...life.hexes[0].display[0], energySources }],
    }] } });
    assert.ok(fills.includes(tokens[`--map-life-${colour}`]), 'feeding-only changes repaint');
  }
  fills.length = 0;
  map.draw(world, { life: lifeFixture({ role: 'mixed', size: 0.7 }) });
  assert.ok(fills.includes(tokens['--map-life-mixed']), 'older models retain their supplied role');
});

test('independent trend scales retain small living counts alongside large extinct counts and occupied areas', () => {
  const samples = freezeDeep([{ day: 2, species: 0, extinctSpecies: 0, occupiedHexes: 0 },
    { day: 3, species: 2, extinctSpecies: 400, occupiedHexes: 1000 },
    { day: 6, species: 1, extinctSpecies: 900, occupiedHexes: 2000 }]);
  const before = JSON.stringify(samples);
  const svg = createLifeTrendSvg(samples, { label: 'Species "history"' });
  assert.match(svg, /d="M48 38C81 38 81 8 114 8C213 8 213 23 312 23"/);
  assert.match(svg, /aria-label="Species &quot;history&quot;"/);
  assert.match(svg, />2<\/text>/);
  assert.match(createLifeTrendSvg(samples, { metric: 'extinctSpecies' }), />900<\/text>/);
  assert.match(createLifeTrendSvg(samples, { metric: 'occupiedHexes' }), />2000<\/text>/);
  assert.equal(JSON.stringify(samples), before);
  const long = Array.from({ length: 1000 }, (_, day) => ({ day, species: day % 100 }));
  assert.equal(createLifeTrendSvg(long), createLifeTrendSvg(long.slice(-180)));
  assert.match(createLifeTrendSvg([{ day: 1, species: 0 }]), /cx="48" cy="38"/);
  assert.equal(/NaN|Infinity|undefined/.test(createLifeTrendSvg([{ day: NaN, species: Infinity }])), false);
});

test('territory contours remove internal edges, preserve holes and islands, and close the map cut', () => {
  const world = freezeDeep({ width: 7, height: 7, hexes: createGrid(7, 7) });
  const contours = ids => territoryContours(world, ids);
  assert.deepEqual(contours([]), []);
  assert.equal(contours([24])[0].length, 6);
  assert.equal(contours([24, 25])[0].length, 10, 'adjacent hexes lose their two shared edges');
  for (const neighbor of world.hexes[24].neighbors) {
    assert.equal(contours([24, neighbor])[0].length, 10, 'every hex direction joins');
  }
  const ring = contours(world.hexes[24].neighbors);
  assert.equal(ring.length, 2, 'an unoccupied hole has its own inner boundary');
  assert.deepEqual(ring.map(loop => loop.length).sort((a, b) => a - b), [6, 18]);
  const disk = contours([24, ...world.hexes[24].neighbors]);
  assert.equal(disk.length, 1);
  assert.equal(disk[0].length, 18);
  assert.equal(contours([0, 48]).length, 2, 'separate patches stay separate');
  assert.equal(contours([21, 27]).length, 2, 'longitude seam is closed on each side of the atlas');
  assert.deepEqual(contours([24, 24, -1]), contours([24]));
  const joined = territoryContours(world, [21, 27], 0);
  assert.equal(joined.length, 1, 'wrapped seam neighbors share one territory');
  assert.equal(joined[0].length, 10, 'no internal boundary at the physical seam');
});

test('species highlighting covers every occupied hex and cosmetic movement leaves observations intact', () => {
  const { map, calls, fills, strokes } = renderer();
  const world = fixture();
  const one = lifeFixture({ role: 'grazer', size: 0.7 }).hexes[0];
  const life = freezeDeep({ runId: 'moving', revision: 1, hexes: [
    { ...one, display: one.display.map(group => ({ ...group, mobile: true })) },
    { ...one, hexId: 11 },
    { ...one, hexId: 12, species: [{ id: 'other', population: 800 }] },
  ] });
  const before = JSON.stringify(life);
  const camera = map.fit();
  map.draw(world, { geography: world, life, camera, selectedSpeciesId: 'species-1' });
  assert.equal(strokes.filter(color => color === tokens['--map-life-selected']).length, 1);
  assert.ok(strokes.includes(tokens['--map-life-grazer']), 'legs use the body colour');
  const first = calls.filter(([method]) => method === 'translate');
  calls.length = 0;
  fills.length = 0;
  map.draw(world, { geography: world, life, camera, selectedSpeciesId: 'species-1', motionTime: 0.5 });
  assert.ok(fills.length > 0, 'motion repaints the affected area even at the same biological day');
  assert.notDeepEqual(calls.filter(([method]) => method === 'translate'), first);
  calls.length = 0;
  map.draw(world, { geography: world, life, camera, selectedSpeciesId: 'species-1', motionTime: 0.5 });
  assert.equal(calls.some(([method]) => method === 'translate'), false, 'paused motion reuses the frame');
  assert.equal(JSON.stringify(life), before);
});

test('carrier overlay adds to the species outline and repaints when carriers move or clear', () => {
  const { map, calls, fills, strokes } = renderer();
  const world = fixture();
  const one = lifeFixture().hexes[0];
  const life = freezeDeep({ runId: 'carriers', revision: 1, hexes: [one, { ...one, hexId: 11 }] });
  const options = { geography: world, life, selectedSpeciesId: 'species-1', selectedVariantHexIds: [10] };
  map.draw(world, options);
  assert.ok(strokes.includes(tokens['--map-life-selected']));
  assert.ok(strokes.includes(tokens['--map-life-variant']));
  assert.ok(fills.includes(tokens['--map-life-variant-fill']));
  assert.ok(calls.some(([method, dash]) => method === 'setLineDash' && dash.length === 2));
  calls.length = 0;
  map.draw(world, { ...options, selectedVariantHexIds: [11] });
  assert.ok(calls.some(([method]) => method === 'clearRect'), 'carrier movements repaint even when the species range stays the same');
  strokes.length = 0;
  map.draw(world, { ...options, selectedVariantHexIds: [] });
  assert.ok(strokes.includes(tokens['--map-life-selected']));
  assert.equal(strokes.includes(tokens['--map-life-variant']), false);
});


test('stacked energy trends use disjoint counts and share smooth lower boundaries without end markers', () => {
  const series = ['photosynthesis', 'plantFeeding', 'animalFeeding', 'other'];
  const samples = freezeDeep([
    { day: 1, photosynthesis: 1, plantFeeding: 1, animalFeeding: 0, other: 0 },
    { day: 2, photosynthesis: 2, plantFeeding: 0, animalFeeding: 1, other: 1 },
  ]);
  const svg = createLifeTrendSvg(samples, { series, label: 'Energy source' });
  assert.match(svg, /life-trend-stacked/);
  assert.match(svg, />4<\/text>/);
  assert.match(svg, /data-energy="photosynthesis" d="M48 53C180 53 180 38 312 38L312 68C180 68 180 68 48 68Z"/);
  assert.match(svg, /data-energy="plantFeeding" d="M48 38C180 38 180 38 312 38L312 38C180 38 180 53 48 53Z"/);
  assert.equal((svg.match(/data-energy=/g) ?? []).length, 8, 'only fills and top outlines, with no vertical end markers');
  assert.equal(/NaN|Infinity|undefined/.test(createLifeTrendSvg([], { series })), false);
});
