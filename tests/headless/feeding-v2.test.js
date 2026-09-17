import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateGrazing } from '../../src/simulation/life/v2/feeding.js';

const sum = values => values.reduce((total, value) => total + value, 0);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} differs from ${expected}`);

test('all grazers share finite source bands and consumption exactly accounts for acquired energy', () => {
  const production = [100, 80, 0];
  const consumers = [
    { demand: 1000, access: [0.2, 0.3, 1] },
    { demand: 1000, access: [0.5, 0.1, 1] },
    { demand: 1000, access: [0.1, 0.8, 1] },
  ];
  const allocation = allocateGrazing(production, consumers);
  near(allocation.consumed[0], 50);
  near(allocation.consumed[1], 64);
  assert.equal(allocation.consumed[2], 0);
  near(sum(allocation.consumed), sum(allocation.gained));
  allocation.gained.forEach((value, index) => assert.ok(value <= consumers[index].demand));
});

test('one resistant grazer cannot unlock protected plant tissue for vulnerable grazers', () => {
  const vulnerable = { demand: 1000, access: [0.1] };
  const resistant = { demand: 1, access: [0.8] };
  const allocation = allocateGrazing([100], [vulnerable, resistant]);
  assert.ok(allocation.gained[0] <= 10);
  near(allocation.gained[1], 1);
  assert.ok(allocation.consumed[0] <= 11);
  near(allocation.consumed[0], sum(allocation.gained));
  near(allocateGrazing([100], [vulnerable]).gained[0], 10);
  near(allocateGrazing([100], [{ ...resistant, demand: 1000 }]).gained[0], 80);
});

test('splitting an equivalent consumer cohort or changing consumer order does not give food priority', () => {
  const production = [100, 80];
  const a = { demand: 100, access: [0.2, 0.7] };
  const b = { demand: 60, access: [0.8, 0.1] };
  const unsplit = allocateGrazing(production, [a, b]);
  const split = allocateGrazing(production, [{ ...a, demand: 30 }, { ...a, demand: 70 }, b]);
  near(split.gained[0] + split.gained[1], unsplit.gained[0]);
  near(split.gained[2], unsplit.gained[1]);
  unsplit.consumed.forEach((value, index) => near(value, split.consumed[index]));
  const reversed = allocateGrazing(production, [b, a]);
  near(reversed.gained[0], unsplit.gained[1]);
  near(reversed.gained[1], unsplit.gained[0]);
});

test('small demand leaves surplus plant production and inaccessible food unconsumed', () => {
  const allocation = allocateGrazing([100, 80], [
    { demand: 5, access: [0.4, 0.5] },
    { demand: 3, access: [0.8, 0] },
    { demand: 100, access: [0, 0] },
  ]);
  near(allocation.gained[0], 5);
  near(allocation.gained[1], 3);
  assert.equal(allocation.gained[2], 0);
  near(sum(allocation.consumed), 8);
  assert.deepEqual(allocateGrazing([100], []), { consumed: [0], gained: [] });
  assert.deepEqual(allocateGrazing([], [{ demand: 5, access: [] }]), { consumed: [], gained: [0] });
});
