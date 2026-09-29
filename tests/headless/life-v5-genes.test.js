import assert from 'node:assert/strict';
import test from 'node:test';
import { TRAITS, founderGenome, validateGenome, candidateMutations, genomeKey,
  deriveGenome } from '../../src/simulation/life/v5/genes/genome.js';
import { evaluateCommunity, scoreSpecies, grazingAccess,
  ECOLOGY_RULES } from '../../src/simulation/life/v5/ecology.js';

const additions = ['treeClimbing', 'fallenForaging', 'branchPulling', 'longReach'];
const genome = changes => ({ ...founderGenome(), landAdaptation: 2, ...changes });
const land = changes => ({ id: 0, waterType: 'none', bedElevation: 0, waterLevel: 0,
  runoff: 0, temperature: 20, humidity: 0.8, permanentIce: false, neighbors: [], ...changes });
const tree = genome({ size: 10, trunk: 10 });
const grazer = changes => genome({ size: 1, photosynthesis: 0, plantFeeding: 1, movement: 1, ...changes });
const plants = plant => [{ speciesId: 'plants', genome: plant, population: 100 }];
const allRoutes = { treeClimbing: 3, fallenForaging: 3, branchPulling: 3, longReach: 3 };
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-8,
  `${message}: ${actual} versus ${expected}`);

test('V5 preserves its five browsing and aquatic hunting loci within the complete 90-locus genome', () => {
  assert.equal(TRAITS.length, 90);
  assert.deepEqual(TRAITS.slice(40, 45).map(({ key }) => key), [...additions, 'streamlining']);
  for (const key of [...additions, 'streamlining']) {
    for (let value = 0; value <= 3; value += 1) {
      const original = grazer({ [key]: value });
      assert.equal(validateGenome(original), true);
      const neighbors = candidateMutations(original).filter(candidate => candidate.key === key);
      assert.equal(neighbors.length, value === 0 || value === 3 ? 1 : 2);
      for (const candidate of neighbors) {
        assert.equal(candidateMutations(candidate.genome).some(reverse => genomeKey(reverse.genome) === genomeKey(original)), true);
      }
      if (value) {
        const previous = deriveGenome({ ...original, [key]: value - 1 });
        const current = deriveGenome(original);
        assert.ok(current.upkeep > previous.upkeep, `${key} level ${value} upkeep`);
        assert.ok(current.reproductionCost > previous.reproductionCost, `${key} level ${value} construction`);
      }
    }
    assert.equal(validateGenome(grazer({ [key]: 4 })), false);
    const missing = grazer();
    delete missing[key];
    assert.equal(validateGenome(missing), false);
  }
});

test('V5 the smallest browser gets scarce real food below the tallest canopy, with no food in an empty habitat', () => {
  const small = grazer();
  const score = scoreSpecies(small, land(), 'land', plants(tree));
  const empty = scoreSpecies(small, land(), 'land');
  assert.ok(grazingAccess(small, tree) > 0 && grazingAccess(small, tree) < 0.06);
  assert.ok(score.grazingFood > 0 && score.score > 0, 'a few small browsers have time to adapt');
  const reachable = scoreSpecies(small, land(), 'land', plants(genome({ size: 1 })));
  assert.ok(score.grazingFood < reachable.grazingFood * 0.55, 'rare browsers still pay a strong collection penalty');
  assert.equal(empty.food, 0);
  assert.ok(empty.score < 0 && empty.deathRate > score.deathRate);
  const specialistsWithoutPlants = evaluateCommunity(land(), 'land', additions.map((key, index) => ({
    speciesId: `browser-${index}`, genome: grazer({ [key]: 3, biteForce: 1 }), population: 20,
  })));
  assert.ok(specialistsWithoutPlants.every(row => row.food === 0 && row.score < 0));
});

test('V5 body growth steadily improves actual intake and fitness until canopy reach removes the penalty', () => {
  const scores = Array.from({ length: 10 }, (_, index) => {
    const consumer = grazer({ size: index + 1 });
    return { size: index + 1, access: grazingAccess(consumer, tree),
      ...scoreSpecies(consumer, land(), 'land', plants(tree)), cells: deriveGenome(consumer).cells };
  });
  for (let index = 1; index < scores.length; index += 1) {
    assert.ok(scores[index].access > scores[index - 1].access);
    assert.ok(scores[index].food / scores[index].cells > scores[index - 1].food / scores[index - 1].cells);
    assert.ok(scores[index].score > scores[index - 1].score);
    if (index <= 5) assert.ok(scores[index].score > scores[index - 1].score + 0.005,
      `size ${index} to ${index + 1} clears ordinary selection support`);
  }
  const large = grazer({ size: 10 });
  assert.equal(grazingAccess(large, tree), 1);
  const shortFood = plants(genome({ size: 1 }));
  shortFood[0].population = 10000;
  close(scores.at(-1).food, scoreSpecies(large, land(), 'land', shortFood).food, 'full reach removes foraging penalty');
  const specialist = grazer({ biteForce: 1, ...allRoutes });
  assert.ok(scores.at(-1).score > scoreSpecies(specialist, land(), 'land', plants(tree)).score + 0.02,
    'even maximum bypass expression keeps growing to full reach advantageous');
});

test('V5 each alternative can be selected under real canopy competition but loses its benefit on short plants', () => {
  const parent = grazer({ size: 2, biteForce: 1 });
  const community = [...plants(tree), { speciesId: 'self', genome: parent, population: 20 }];
  const before = structuredClone(community);
  const baseline = scoreSpecies(parent, land(), 'land', community, { excludeSpeciesId: 'self' });
  const larger = scoreSpecies({ ...parent, size: 3 }, land(), 'land', community, { excludeSpeciesId: 'self' });
  for (const key of additions) {
    const candidate = { ...parent, [key]: 1 };
    const adapted = scoreSpecies(candidate, land(), 'land', community, { excludeSpeciesId: 'self' });
    assert.ok(adapted.score > baseline.score + 0.005, `${key} has a selectable use`);
    assert.ok(larger.score > adapted.score, `growth stays the stronger one-step response than ${key}`);
    const shortPlants = plants(genome({ size: 1 }));
    const ordinary = scoreSpecies(parent, land(), 'land', shortPlants);
    const unnecessary = scoreSpecies(candidate, land(), 'land', shortPlants);
    close(unnecessary.food, ordinary.food, `${key} cannot improve fully reachable intake`);
    assert.ok(unnecessary.score < ordinary.score, `${key} pays its cost when unnecessary`);
  }
  assert.deepEqual(community, before, 'candidate scoring cannot mutate accepted genomes or the census');
});

test('V5 climbing exposes at most 15% of the inaccessible food and all bypasses share a 25% ceiling', () => {
  const baseline = grazer({ biteForce: 1 });
  const consumers = [baseline, { ...baseline, treeClimbing: 3 }, { ...baseline, ...allRoutes }];
  const withdrawals = consumers.map(consumer => {
    const rows = [...plants(tree), { speciesId: 'browser', genome: consumer, population: 10000 }];
    const result = evaluateCommunity(land(), 'land', rows);
    const gross = result[0].grossProduction * rows[0].population;
    const removed = (result[0].grossProduction - result[0].production) * rows[0].population;
    close(result[1].grazingFood * rows[1].population, removed * ECOLOGY_RULES.conversion,
      'consumer food comes out of the plant budget');
    return removed / (gross * ECOLOGY_RULES.grazingFraction);
  });
  close((withdrawals[1] - withdrawals[0]) / (1 - withdrawals[0]), 0.15, 'maximum climbing route');
  close((withdrawals[2] - withdrawals[0]) / (1 - withdrawals[0]), 0.25, 'combined alternative ceiling');
  assert.ok(withdrawals[2] < 0.31, 'most of the tall canopy remains protected from a tiny specialist');
  const leafyTree = { ...tree, leafArea: 3 };
  close(grazingAccess(consumers[2], leafyTree), grazingAccess(consumers[2], tree),
    'leaf area cannot magnify the canopy bypass caps');
  assert.ok(grazingAccess(consumers[2], { ...leafyTree, poison: 3, spines: 3 }) < withdrawals[2],
    'canopy alternatives do not bypass chemical and physical defenses');
});

test('V5 finite accessible food and foraging effort survive splitting plants and browsers into many species', () => {
  const consumer = grazer({ size: 2, biteForce: 1, ...allRoutes });
  for (const population of [1, 50, 10000]) {
    const wholeRows = [...plants(tree), { speciesId: 'browser', genome: consumer, population }];
    const splitPlants = [...Array.from({ length: 10 }, (_, index) => ({
      ...wholeRows[0], speciesId: `plant-${index}`, population: 10,
    })), wholeRows[1]];
    const splitBrowsers = [wholeRows[0], ...Array.from({ length: 10 }, (_, index) => ({
      ...wholeRows[1], speciesId: `browser-${index}`, population: population / 10,
    }))];
    const whole = evaluateCommunity(land(), 'land', wholeRows);
    const sources = evaluateCommunity(land(), 'land', splitPlants);
    const labels = evaluateCommunity(land(), 'land', splitBrowsers);
    close(sources.at(-1).grazingFood, whole[1].grazingFood, 'plant partition cannot give free retry effort');
    close(labels[0].production, whole[0].production, 'consumer labels cannot unlock protected food');
    close(labels.slice(1).reduce((sum, row, index) => sum + row.grazingFood * splitBrowsers[index + 1].population, 0),
      whole[1].grazingFood * population, 'consumer partition conserves transferred food');
    const removed = (whole[0].grossProduction - whole[0].production) * wholeRows[0].population;
    assert.ok(removed <= whole[0].grossProduction * wholeRows[0].population
      * ECOLOGY_RULES.grazingFraction * grazingAccess(consumer, tree) + 1e-8);
  }
});

test('V5 canopy strategies respect land, mobility, wood and bite context; long reach also works in water', () => {
  const base = grazer({ size: 2, biteForce: 1 });
  for (const key of ['treeClimbing', 'fallenForaging', 'branchPulling']) {
    for (const [hex, habitat, consumer, plant] of [
      [land(), 'land', { ...base, movement: 0 }, tree],
      [land({ waterType: 'sea', bedElevation: -3 }), 'water', base, tree],
      ...(key === 'fallenForaging' ? [] : [[land(), 'land', base, { ...tree, trunk: 0 }]]),
      ...(key === 'branchPulling' ? [[land(), 'land', { ...base, biteForce: 0 }, tree]] : []),
    ]) {
      const plain = scoreSpecies(consumer, hex, habitat, plants(plant));
      const adapted = scoreSpecies({ ...consumer, [key]: 3 }, hex, habitat, plants(plant));
      close(adapted.food, plain.food, `${key} has no misplaced ecological benefit`);
      assert.ok(adapted.score < plain.score, `${key} still pays its maintenance`);
    }
  }
  const water = land({ waterType: 'sea', bedElevation: -3 });
  assert.ok(scoreSpecies({ ...base, longReach: 3 }, water, 'water', plants(tree)).food
    > scoreSpecies(base, water, 'water', plants(tree)).food);
  const unwoody = plants({ ...tree, trunk: 0 });
  assert.ok(scoreSpecies({ ...base, fallenForaging: 3 }, land(), 'land', unwoody).food
    > scoreSpecies(base, land(), 'land', unwoody).food);
});

// A controlled expectation experiment uses the actual ecological rates without
// mutation, dispersal or stochastic rounding. Biomass/food measure resource
// dominance; smaller bodies can naturally outnumber larger bodies.
function settle(consumers) {
  let rows = [{ speciesId: 'plants', genome: tree, population: 10 }, ...consumers.map((consumer, index) => ({
    speciesId: `browser-${index}`, genome: consumer, population: 1,
  }))];
  for (let turn = 0; turn < 1500; turn += 1) {
    const outputs = evaluateCommunity(land(), 'land', rows);
    rows = rows.map((row, index) => ({ ...row,
      population: row.population * (1 - outputs[index].deathRate) * (1 + outputs[index].birthRate) }));
  }
  const outputs = evaluateCommunity(land(), 'land', rows);
  return rows.slice(1).map((row, index) => ({ population: row.population,
    biomass: row.population * deriveGenome(row.genome).cells,
    food: row.population * outputs[index + 1].food }));
}

test('V5 controlled canopy communities support small alternatives while reachable browsers dominate resource competition', () => {
  const small = grazer();
  const climbing = { ...small, treeClimbing: 3 };
  const alternative = { ...small, biteForce: 1, ...allRoutes };
  const large = grazer({ size: 10 });
  const largeAlone = settle([large])[0];
  for (const consumer of [small, climbing, alternative]) {
    const alone = settle([consumer])[0];
    assert.ok(alone.population > 1, 'scarce accessible food supports an established small-browser niche');
    assert.ok(alone.biomass < largeAlone.biomass * 0.4, 'small alternatives have much lower carrying biomass');
    assert.ok(alone.food < largeAlone.food * 0.4, 'small alternatives consume a minority of potential food');
    const together = settle([consumer, large]);
    assert.ok(together[1].biomass > together[0].biomass * 20);
    assert.ok(together[1].food > together[0].food * 20);
  }
});
