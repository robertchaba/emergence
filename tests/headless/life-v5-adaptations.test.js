import assert from 'node:assert/strict';
import test from 'node:test';
import { TRAITS, founderGenome, deriveGenome, validateGenome, candidateMutations, genomeKey }
  from '../../src/simulation/life/v5/genes/genome.js';
import { ADAPTATIONS } from '../../src/simulation/life/v5/genes/adaptations.js';
import { ECOLOGY_RULES, scoreSpecies, evaluateCommunity, captureProbability, grazingAccess,
  environmentalPerformance } from '../../src/simulation/life/v5/ecology.js';

const genome = changes => ({ ...founderGenome(), landAdaptation: 2, ...changes });
const land = { id: 0, waterType: 'none', bedElevation: 0, waterLevel: 0,
  runoff: 0, temperature: 20, humidity: 0.8, permanentIce: false };
const water = { ...land, waterType: 'sea', bedElevation: -3 };
const site = (habitat, changes = {}) => ({ ...(habitat === 'land' ? land : water), ...changes });
const adapted = (habitat, changes = {}) => genome({ landAdaptation: habitat === 'land' ? 2 : 0, ...changes });
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected)
  <= 1e-8 * Math.max(1, Math.abs(actual), Math.abs(expected)), `${message}: ${actual} versus ${expected}`);

function producer(habitat = 'land', changes = {}, { trunk = 0, residents = 0 } = {}) {
  const g = adapted(habitat, { trunk });
  return { g, habitat, hex: site(habitat, changes), rows: residents
    ? [{ speciesId: 'resident', genome: g, population: residents }] : [] };
}

function grazer(habitat = 'land', changes = {}) {
  const g = adapted(habitat, { photosynthesis: 0, plantFeeding: 1, movement: 1 });
  return { g, habitat, hex: site(habitat, changes), rows: [{ speciesId: 'plant', population: 1000,
    genome: adapted(habitat, { size: 1 }) }] };
}

function hunt(habitat = 'water', { size = 1, movement = 0, preySize = 1, preyMovement = 3, armor = 2 } = {}) {
  const g = adapted(habitat, { size, photosynthesis: 0, animalFeeding: 1, movement, biteForce: 2 });
  return { g, habitat, hex: site(habitat), rows: [{ speciesId: 'prey', population: 10000,
    genome: adapted(habitat, { size: preySize, photosynthesis: 0, plantFeeding: 1,
      movement: preyMovement, armor, armorType: armor ? 2 : 0 }) }] };
}

function browse(habitat = 'land', { size = 1, trunk = 0, spines = 0 } = {}) {
  const g = adapted(habitat, { size: 1, photosynthesis: 0, plantFeeding: 1, movement: 1 });
  return { g, habitat, hex: site(habitat), rows: [{ speciesId: 'plant', population: 10000,
    genome: adapted(habitat, { size, trunk, spines }) }] };
}

function defense(habitat, { temperature = 20, population = 100, predators = 3, armor = 1 } = {}) {
  const g = adapted(habitat, { size: 2, photosynthesis: 0, plantFeeding: 1, movement: 3, armor });
  return { g, habitat, hex: site(habitat, { temperature }), options: { excludeSpeciesId: 'self' },
    rows: [{ speciesId: 'plants', population: 5000, genome: adapted(habitat, { size: 1 }) },
      { speciesId: 'self', population, genome: g },
      { speciesId: 'hunter', population: predators, genome: adapted(habitat,
        { size: 3, photosynthesis: 0, animalFeeding: 1, movement: 2, eyesight: 3 }) }] };
}

const context = {
  waterStorage: grazer('land', { humidity: 0.3 }),
  stomatalControl: producer('land', { humidity: 0.3 }),
  succulentTissue: producer('land', { humidity: 0.3 }),
  antifreeze: grazer('water', { temperature: -10 }),
  heatShockProteins: grazer('water', { temperature: 45 }),
  evaporativeCooling: grazer('land', { temperature: 45 }),
  countercurrentExchange: grazer('water', { temperature: -10 }),
  pressureEqualization: producer('water', { bedElevation: -600 }),
  holdfast: producer('water', { waterExposure: 0.8 }, { trunk: 3, residents: 300 }),
  flexibleStem: producer('water', { waterExposure: 0.8 }, { trunk: 3, residents: 300 }),
  reflectiveFoliage: producer('land', { temperature: 45 }),
  submergedLeaves: producer('water'),
  aerialRespiration: grazer('water', { temperature: 45 }),
  oxygenBinding: grazer('water', { temperature: 45 }),
  basking: grazer('land', { temperature: -10 }),
  lowLightPigments: producer('water', {}, { trunk: 3, residents: 300 }),
  sunTracking: producer('land'),
  canopySpread: producer('land', {}, { trunk: 3, residents: 300 }),
  lightFiltering: producer('water', {}, { trunk: 3, residents: 300 }),
  rapidGrowth: producer('water'),
  webbing: hunt('water', { movement: 3 }),
  articulatedLegs: hunt('land', { movement: 3 }),
  adhesivePads: browse('land', { size: 10, trunk: 10 }),
  jetPropulsion: hunt('water', { movement: 1, armor: 0 }),
  undulation: hunt('water', { movement: 3 }),
  crushingJaws: hunt(),
  piercingMouthparts: browse('land', { spines: 3 }),
  fermentation: browse('water', { trunk: 10 }),
  nectarExtraction: browse('water'),
  venomDelivery: hunt(),
  pursuitEndurance: hunt('water', { movement: 1, armor: 0 }),
  vibrationSensing: hunt('land', { size: 3 }),
  electricalSensing: hunt('water', { size: 7 }),
  lureDisplay: hunt('land', { size: 7 }),
  mucusNet: hunt('water', { size: 3, preyMovement: 0, armor: 0 }),
  autotomy: defense('land', { temperature: 5, predators: 8 }),
  inkDefense: defense('water'),
  startleDisplay: defense('water'),
  mimicry: defense('water'),
  rollingDefense: defense('land', { temperature: 5, predators: 8 }),
  alarmCalls: defense('land', { temperature: 5, predators: 8 }),
  nurseryShelter: defense('land', { population: 20, predators: 1, armor: 0 }),
  broodPouch: defense('water', { population: 20, predators: 1, armor: 0 }),
  longevityRepair: hunt('land', { preySize: 3, preyMovement: 0, armor: 0 }),
  reproductiveRestraint: producer('water', { temperature: -10, bedElevation: -600, waterExposure: 0.8 }, { trunk: 3 }),
};

const score = (fixture, changes = {}) => scoreSpecies({ ...fixture.g, ...changes }, fixture.hex,
  fixture.habitat, fixture.rows, fixture.options);

test('V5 revision 3 adds exactly 45 paid, bounded, reversible loci to its 90-coordinate genome', () => {
  assert.equal(TRAITS.length, 90);
  assert.equal(ADAPTATIONS.length, 45);
  assert.equal(new Set(TRAITS.map(trait => trait.key)).size, 90);
  assert.deepEqual(Object.keys(context), ADAPTATIONS.map(trait => trait.key));
  for (const { key } of ADAPTATIONS) {
    for (let value = 0; value <= 3; value += 1) {
      const g = genome({ [key]: value });
      assert.ok(validateGenome(g));
      const neighbors = candidateMutations(g).filter(change => change.key === key);
      assert.equal(neighbors.length, value === 0 || value === 3 ? 1 : 2, key);
      for (const candidate of neighbors) {
        assert.ok(candidateMutations(candidate.genome).some(reverse => genomeKey(reverse.genome) === genomeKey(g)), key);
      }
      if (value) {
        const before = deriveGenome(genome({ [key]: value - 1 }));
        const after = deriveGenome(g);
        assert.ok(after.upkeep > before.upkeep, `${key} always pays maintenance`);
        assert.ok(after.reproductionCost > before.reproductionCost, `${key} always pays construction`);
      }
    }
    assert.equal(validateGenome(genome({ [key]: 4 })), false);
    const missing = genome();
    delete missing[key];
    assert.equal(validateGenome(missing), false);
  }
});

test('V5 all 45 new loci exceed the ordinary one-step selection advantage in a relevant context and lose elsewhere', () => {
  for (const { key } of ADAPTATIONS) {
    const fixture = context[key];
    const saved = structuredClone(fixture);
    const before = score(fixture);
    const after = score(fixture, { [key]: 1 });
    assert.ok(after.score > before.score + 0.005,
      `${key} meaningful contextual advantage: ${after.score - before.score}`);
    // Negative growth may become less negative; this checks a selection
    // direction, not successful establishment or guaranteed evolutionary reach.
    const wrong = key === 'sunTracking' ? producer('water')
      : key === 'rapidGrowth' ? producer('land', {}, { trunk: 3, residents: 300 }) : producer();
    assert.ok(score(wrong, { [key]: 1 }).score < score(wrong).score,
      `${key} must cost fitness outside its favorable context`);
    assert.deepEqual(fixture, saved, `${key} query must not mutate its community`);
  }
});

test('V5 specializations keep their anatomical, habitat, density and opponent gates', () => {
  const cold = { ...land, temperature: -10 };
  const plain = adapted('land', { photosynthesis: 0, plantFeeding: 1 });
  close(environmentalPerformance({ ...plain, countercurrentExchange: 3 }, cold, 'land'),
    environmentalPerformance(plain, cold, 'land'), 'stationary exchange has no thermal benefit');
  for (const key of ['stomatalControl', 'succulentTissue']) close(
    environmentalPerformance({ ...plain, [key]: 3 }, { ...land, humidity: 0.1 }, 'land'),
    environmentalPerformance(plain, { ...land, humidity: 0.1 }, 'land'), `${key} requires photosynthetic anatomy`);
  const prey = { ...plain, movement: 2, size: 1 };
  const hunter = { ...plain, animalFeeding: 1, plantFeeding: 0, size: 2, movement: 1 };
  const capture = (g, p, habitat, extra = {}) => captureProbability(g, p, undefined, undefined, { habitat, ...extra });
  close(capture({ ...hunter, electricalSensing: 3 }, prey, 'land'), capture(hunter, prey, 'land'), 'electrical sensing requires water');
  const visualHunter = { ...hunter, eyesight: 2 };
  const mimic = { ...prey, mimicry: 2 };
  close(capture({ ...visualHunter, electricalSensing: 3 }, mimic, 'land'),
    capture(visualHunter, mimic, 'land'), 'electrical sensing cannot defeat mimicry on land');
  assert.ok(capture({ ...visualHunter, electricalSensing: 3 }, mimic, 'water')
    > capture(visualHunter, mimic, 'water'), 'water electrical sensing can defeat mimicry');
  close(capture({ ...hunter, jetPropulsion: 3 }, { ...prey, movement: 0 }, 'water'),
    capture(hunter, { ...prey, movement: 0 }, 'water'), 'jets help interception of moving prey');
  close(capture({ ...hunter, crushingJaws: 3 }, prey, 'land'), capture(hunter, prey, 'land'), 'crushers need armored prey');
  close(capture(hunter, { ...prey, inkDefense: 3 }, 'water'), capture(hunter, prey, 'water'), 'ink needs visual hunters');
  close(capture(hunter, { ...prey, alarmCalls: 3 }, 'land'), capture(hunter, prey, 'land'), 'alarms need social support');
  const trunk = adapted('land', { size: 10, trunk: 10 });
  const browser = { ...prey, movement: 1 };
  assert.ok(grazingAccess({ ...browser, adhesivePads: 3 }, trunk) > grazingAccess(browser, trunk));
  close(grazingAccess({ ...browser, adhesivePads: 3 }, trunk, undefined, undefined, 'water'),
    grazingAccess(browser, trunk, undefined, undefined, 'water'), 'pads require land trunks');
  const exposed = { ...hunter, lureDisplay: 3 };
  assert.ok(capture(hunter, exposed, 'land') > capture(hunter, { ...exposed, lureDisplay: 0 }, 'land'),
    'lures also expose their bearer to predators');
});

test('V5 combinations of all 90 loci retain finite light, tissue, conversion, rates and empty-habitat limits', () => {
  const maximal = Object.fromEntries(TRAITS.map(({ key, max }) => [key, max]));
  for (const habitat of ['land', 'water']) for (const temperature of [-30, 20, 55]) {
    const hex = site(habitat, { temperature, humidity: 0.1, waterExposure: 0.9, iceCover: 0.7 });
    const active = { ...maximal, landAdaptation: habitat === 'water' ? 0 : 2 };
    const rows = [
      { speciesId: 'plant', population: 100, genome: { ...active, plantFeeding: 0, animalFeeding: 0, movement: 0 } },
      { speciesId: 'grazer', population: 40, genome: { ...active, trunk: 0, photosynthesis: 0, animalFeeding: 0, size: 3 } },
      { speciesId: 'hunter', population: 15, genome: { ...active, trunk: 0, photosynthesis: 0, plantFeeding: 0 } },
      { speciesId: 'mixed', population: 50, genome: { ...active, size: 4 } },
    ];
    assert.ok(rows.every(row => validateGenome(row.genome)));
    const saved = structuredClone(rows);
    const result = evaluateCommunity(hex, habitat, rows);
    let gross = 0;
    let withdrawn = 0;
    let grazing = 0;
    let predation = 0;
    let tissue = 0;
    for (const [index, row] of result.entries()) {
      assert.ok(Object.values(row).filter(value => typeof value === 'number').every(Number.isFinite));
      assert.ok(row.environment >= 0 && row.environment <= 1);
      assert.ok(row.birthRate >= 0 && row.birthRate <= 0.3);
      assert.ok(row.deathRate >= 0 && row.deathRate <= 0.9);
      assert.ok(row.predationLoss >= 0 && row.predationLoss <= ECOLOGY_RULES.preyFraction + 1e-12);
      const count = rows[index].population;
      gross += row.grossProduction * count;
      withdrawn += (row.grossProduction - row.production) * count;
      grazing += row.grazingFood * count;
      predation += row.predationFood * count;
      tissue += row.predationLoss * count * deriveGenome(rows[index].genome).cells * 1.4;
    }
    assert.ok(gross <= result[0].resourceBudget + 1e-8);
    assert.ok(withdrawn <= gross * ECOLOGY_RULES.grazingFraction + 1e-8);
    close(grazing, withdrawn * ECOLOGY_RULES.conversion, 'plant tissue transferred once');
    close(predation, tissue * ECOLOGY_RULES.conversion, 'prey tissue transferred once');
    assert.deepEqual(rows, saved);
    for (const row of rows.slice(1, 3)) assert.equal(scoreSpecies(row.genome, hex, habitat).food, 0);
  }
});

test('V5 mucus-net and specialized browsing effort cannot be refreshed by splitting source identities', () => {
  for (const [fixture, changes, foodKey] of [
    [hunt('water', { size: 3, preyMovement: 0, armor: 0 }), { mucusNet: 3, lureDisplay: 2 }, 'predationFood'],
    [browse('land', { size: 10, trunk: 10, spines: 3 }),
      { adhesivePads: 3, fermentation: 3, piercingMouthparts: 3 }, 'grazingFood'],
  ]) {
    for (const population of [1, 10000]) {
      const g = { ...fixture.g, ...changes };
      const source = fixture.rows[0];
      const whole = [...fixture.rows, { speciesId: 'self', genome: g, population }];
      const split = [...Array.from({ length: 10 }, (_, index) => ({ ...source,
        speciesId: `source-${index}`, population: source.population / 10 })), whole.at(-1)];
      close(evaluateCommunity(fixture.hex, fixture.habitat, whole).at(-1)[foodKey],
        evaluateCommunity(fixture.hex, fixture.habitat, split).at(-1)[foodKey], 'finite attempted effort');
    }
  }
});
