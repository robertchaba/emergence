import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createMapRenderer, MAP_TOKEN_NAMES } from '../src/rendering/map.js';
import { createSpecimenSvg, createPopulationTrendSvg } from '../src/rendering/specimen.js';

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
  assert.equal(map.hitTest(world, map.fit(world), -1, -1), null);
});

test('seam cells stay whole and the empty staggered edge cannot pick a duplicate', () => {
  const { map } = renderer();
  const world = fixture();
  const camera = map.fit(world);
  const last = map.cellCenter(world, 11, camera);
  const first = map.cellCenter(world, 6, camera);
  const spacing = (last.x - first.x) / (world.width - 1);
  const leftEdge = last.x - spacing * world.width;
  assert.equal(map.hitTest(world, camera, last.x + spacing * 0.45, last.y), 11);
  assert.equal(map.hitTest(world, camera, leftEdge + 1, last.y), null);
});

test('fit contains every hex corner and fills one available dimension', () => {
  const { map, calls } = renderer();
  const world = fixture();
  for (const [width, height] of [[900, 600], [390, 300], [320, 600]]) {
    map.resize(width, height);
    const camera = map.fit(world);
    const first = map.cellCenter(world, 0, camera);
    const next = map.cellCenter(world, 1, camera);
    const radius = (next.x - first.x) / Math.sqrt(3);
    const xs = [];
    const ys = [];
    for (const hex of world.hexes) {
      const point = map.cellCenter(world, hex.id, camera);
      for (let corner = 0; corner < 6; corner += 1) {
        const angle = (corner * 60 - 30) * Math.PI / 180;
        xs.push(point.x + Math.cos(angle) * radius);
        ys.push(point.y + Math.sin(angle) * radius);
      }
    }
    assert.ok(Math.min(...xs) > 0 && Math.max(...xs) < width);
    assert.ok(Math.min(...ys) > 0 && Math.max(...ys) < height);
    assert.ok(Math.max((Math.max(...xs) - Math.min(...xs)) / width,
      (Math.max(...ys) - Math.min(...ys)) / height) > 0.94);
    map.draw(world, { camera });
    assert.equal(calls.some(([method]) => method === 'strokeRect'), false);
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
  assert.equal(connections.length, 4); // bank and water at both visible seam ends
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

test('cover fills the frame while fit keeps the full hex outline available', () => {
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
    assert.deepEqual(map.fit(), { zoom: 1, x: 0, y: 0 });
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

test('small producer coverage tints land more than water and preserves diagnostic colors', () => {
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
  assert.equal(capture(land, 'temperature'), capture(null, 'temperature'));
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
  assert.ok(fills.includes(tokens['--map-pin-fill']), 'physical selection remains above life');
  fills.length = 0;
  strokes.length = 0;
  map.draw(world, { geography: world, life, showLife: false, selectedSpeciesId: 'species-1' });
  assert.equal(fills.includes(tokens['--map-life-grazer']), false);
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
    const markerColors = ['producer', 'grazer', 'predator', 'mixed', 'other'].map(role => tokens[`--map-life-${role}`]);
    const markerCount = fills.filter(fill => markerColors.includes(fill)).length;
    assert.ok(markerCount > 0 && markerCount <= 12, `marker budget ${markerCount}`);
    return calls.filter(([method]) => method === 'arc').slice(-markerCount);
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

test('specimen illustrations are deterministic, read-only, and escape accessible labels', () => {
  const traits = freezeDeep([
    { key: 'size', value: 4, min: 1, max: 10, active: true },
    { key: 'photosynthesis', value: 8, min: 0, max: 10, active: true },
    { key: 'movement', value: 3, min: 0, max: 10, active: true },
  ]);
  const before = JSON.stringify(traits);
  const svg = createSpecimenSvg(traits);
  assert.equal(svg, createSpecimenSvg(traits));
  assert.match(svg, /aria-hidden="true"/);
  assert.notEqual(svg, createSpecimenSvg([]));
  assert.match(createSpecimenSvg(traits, { label: '<Specimen "A">' }), /aria-label="&lt;Specimen &quot;A&quot;&gt;"/);
  assert.equal(/(?:#[a-f\d]{3,8}|rgb\(|NaN|undefined)/i.test(svg), false);
  assert.equal(JSON.stringify(traits), before);
});

test('population plots use recorded day spacing, preserve zero and bound retained samples', () => {
  const samples = freezeDeep([{ day: 2, population: 0 }, { day: 3, population: 50 }, { day: 6, population: 100 }]);
  const before = JSON.stringify(samples);
  const svg = createPopulationTrendSvg(samples, { label: 'Population "history"' });
  assert.match(svg, /d="M6 64L83 36L314 8"/);
  assert.match(svg, /aria-label="Population &quot;history&quot;"/);
  assert.equal(JSON.stringify(samples), before);
  const long = Array.from({ length: 1000 }, (_, day) => ({ day, population: day % 100 }));
  assert.equal(createPopulationTrendSvg(long), createPopulationTrendSvg(long.slice(-120)));
  assert.match(createPopulationTrendSvg([{ day: 0, population: 0 }]), /cx="6" cy="64"/);
  assert.equal(/NaN|Infinity|undefined/.test(createPopulationTrendSvg([{ day: NaN, population: Infinity }])), false);
});
