import assert from 'node:assert/strict';
import test from 'node:test';
import { lifeMarkerPositions, lifeMarkerPose } from '../../src/rendering/life-marks.js';
import { drawPlantShape, drawAnimalShape } from '../../src/rendering/life-shapes.js';

const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const marker = { role: 'grazer', mobile: true, size: 0.6 };

test('land representatives take grounded strides and turn at rest while water glides', () => {
  const slot = { seed: 23, offset: 0 };
  const land = { ...marker, habitat: 'land' }, water = { ...marker, habitat: 'water' };
  const duration = (0.85 + 2.2 * marker.size ** 2) * 3.5;
  const landAt = part => lifeMarkerPose(land, slot, part * duration);
  const waterAt = part => lifeMarkerPose(water, slot, part * duration);
  const planted = landAt(0.03), turning = landAt(0.19);
  assert.equal(distance(planted, turning), 0, 'feet stay in one place during a turn');
  assert.equal(planted.phase, turning.phase, 'limbs stop during the planted turn');
  assert.notEqual(planted.heading, turning.heading);
  assert.ok(distance(waterAt(0.03), waterAt(0.19)) > 0.001, 'water keeps gliding');
  for (let stride = 0; stride < 6; stride += 1) {
    const at = fraction => landAt(0.22 + (stride + fraction) / 6 * 0.78);
    assert.deepEqual(at(0.03), at(0.16), 'each land stride has a brief planted rest');
    assert.ok(distance(at(0.25), at(0.9)) > 0.001, 'each stride makes actual progress');
  }
  assert.notDeepEqual(landAt(0.5), waterAt(0.5), 'habitat changes the path itself');
  for (const habitat of ['land', 'water']) {
    const still = { ...marker, mobile: false, habitat };
    assert.deepEqual(lifeMarkerPose(still, slot, 0), lifeMarkerPose(still, slot, 500));
  }
});

test('both habitat paths are deterministic, continuous and bounded at every stride and turn', () => {
  const slots = lifeMarkerPositions(10);
  for (const habitat of ['land', 'water']) for (const size of [0, 0.5, 1]) {
    const duration = (0.85 + 2.2 * size ** 2) * 3.5;
    for (const social of ['solitary', 'clustered']) for (const slot of slots) {
      const animal = { ...marker, habitat, size, morphology: { social } };
      for (let time = 0; time < 80; time += 0.31) {
        const pose = lifeMarkerPose(animal, slot, time);
        assert.ok(Math.hypot(pose.x, pose.y) <= 0.66);
        assert.deepEqual(pose, lifeMarkerPose(animal, slot, time));
      }
      for (let step = 4; step < 7; step += 1) {
        for (const progress of [0, 0.22, ...Array.from({ length: 6 }, (_, i) => 0.22 + (i + 0.2) / 6 * 0.78)]) {
          const time = (step + progress - slot.offset / 3.5) * duration;
          const before = lifeMarkerPose(animal, slot, time - 1e-7);
          const after = lifeMarkerPose(animal, slot, time + 1e-7);
          assert.ok(distance(before, after) < 1e-6, 'no position jump');
          assert.ok(Math.cos(after.heading - before.heading) > 0.999999, 'no heading snap');
          assert.ok(Math.abs(after.phase - before.phase) < 1e-4, 'limb phase stays continuous');
        }
      }
    }
  }
});

test('new morphology forms are distinct and stay within existing shape and draw budgets', () => {
  for (const water of [false, true]) for (const plant of [false, true]) {
    const forms = plant ? ['succulent', 'ribbon'] : ['plated', 'tentacled', 'paddle', 'jet'];
    const pictures = new Set();
    for (const form of forms) for (const pattern of ['plain', 'mottled', 'banded']) {
      for (const phase of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const calls = [];
        const context = new Proxy({}, { get: (target, key) => target[key] ?? ((...args) => calls.push([key, ...args])) });
        const morphology = { form, pattern, social: 'solitary' };
        if (plant) drawPlantShape(context, 0, water, 'detail', morphology);
        else drawAnimalShape(context, 0, water, { ...marker, size: 1, morphology }, phase, 'detail');
        assert.ok(calls.length < 85, `${form} retains bounded work`);
        assert.equal(calls.filter(([method]) => method === 'fill').length, 1);
        if (phase === 0) pictures.add(JSON.stringify(calls));
        const limit = plant ? 1.25 : 2;
        for (const [method, ...args] of calls) {
          if (['moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo'].includes(method)) {
            for (let i = 0; i < args.length; i += 2) {
              assert.ok(Math.hypot(args[i], args[i + 1]) <= limit, `${form} path hull`);
            }
          } else if (method === 'ellipse') {
            const [x, y, rx, ry, angle] = args;
            for (let i = 0; i < 64; i += 1) {
              const a = i * Math.PI / 32, dx = rx * Math.cos(a), dy = ry * Math.sin(a);
              assert.ok(Math.hypot(x + dx * Math.cos(angle) - dy * Math.sin(angle),
                y + dx * Math.sin(angle) + dy * Math.cos(angle)) <= limit, `${form} body bounds`);
            }
          }
        }
      }
    }
    assert.equal(pictures.size, forms.length * 3, 'forms and patterns remain visibly distinct');
  }
});
