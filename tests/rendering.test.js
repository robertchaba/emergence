import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createMapRenderer, MAP_TOKEN_NAMES } from '../src/rendering/map.js';

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
  const context = new Proxy({}, {
    get(target, name) {
      if (name === 'fill') return () => fills.push(target.fillStyle);
      return target[name] ?? ((...args) => calls.push([name, ...args]));
    },
  });
  const canvas = { getContext: () => context };
  const map = createMapRenderer(canvas, { tokens });
  map.resize(900, 600, 2);
  return { map, canvas, calls, fills };
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
  calls.length = 0;
  map.draw(world, { camera: map.fit(world), layer: 'terrain' });
  const connections = calls.filter((call, index) => call[0] === 'moveTo' && calls[index + 1]?.[0] === 'lineTo' && calls[index + 2]?.[0] === 'stroke');
  assert.equal(connections.length, 3);
  const spacing = map.cellCenter(world, 7, map.fit(world)).x - map.cellCenter(world, 6, map.fit(world)).x;
  for (const move of connections) {
    const line = calls[calls.indexOf(move) + 1];
    assert.ok(Math.abs(Math.abs(line[1] - move[1]) - spacing) < 1e-8);
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
