import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createMapRenderer, MAP_TOKEN_NAMES } from '../src/rendering/map.js';

const style = readFileSync(new URL('../src/ui/styles/tokens.css', import.meta.url), 'utf8');
const tokens = Object.fromEntries(MAP_TOKEN_NAMES.map((name) => [name, style.match(new RegExp(`${name}: ([^;]+);`))[1]]));

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
  const context = new Proxy({}, {
    get(target, name) {
      return target[name] ?? ((...args) => calls.push([name, ...args]));
    },
  });
  const canvas = { getContext: () => context };
  const map = createMapRenderer(canvas, { tokens });
  map.resize(900, 600, 2);
  return { map, canvas, calls };
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

test('both visible halves of a cylindrical seam hex pick the same cell', () => {
  const { map } = renderer();
  const world = fixture();
  const camera = map.fit(world);
  const last = map.cellCenter(world, 11, camera);
  const first = map.cellCenter(world, 6, camera);
  const spacing = (last.x - first.x) / (world.width - 1);
  const leftEdge = last.x - spacing * world.width;
  assert.equal(map.hitTest(world, camera, last.x - 1, last.y), 11);
  assert.equal(map.hitTest(world, camera, leftEdge + 1, last.y), 11);
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
