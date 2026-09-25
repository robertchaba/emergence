import assert from 'node:assert/strict';
import test from 'node:test';
import { TRAITS, founderGenome, validateGenome, candidateMutations, geneticDistance,
  genomeKey, deriveGenome, describeGenome } from '../../src/simulation/life/v4/genes/genome.js';
import { founderForSite, environmentalPerformance, evaluateCommunity, scoreSpecies,
  grazingAccess, captureProbability, preyEligible, ECOLOGY_RULES } from '../../src/simulation/life/v4/ecology.js';
import { evaluateCommunity as evaluateV3 } from '../../src/simulation/life/v3/ecology.js';

const genome = changes => ({ ...founderGenome(), landAdaptation: 2, ...changes });
const land = changes => ({ id: 0, waterType: 'none', bedElevation: 500, waterLevel: 0,
  runoff: 0, temperature: 20, humidity: 0.7, permanentIce: false, neighbors: [], ...changes });
const random = seed => { let state = seed >>> 0; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; };

test('V4 mutation candidates change exactly one reversible locus, including new tolerances', () => {
  assert.equal(TRAITS.length, 40);
  assert.equal(validateGenome(genome()), true);
  assert.equal(validateGenome(genome({ photosynthesis: 0, trunk: 1 })), false);
  assert.equal(validateGenome(genome({ elevationTolerance: 5 })), false);
  let current = genome();
  const next = random(83);
  const touched = new Set();
  for (let turn = 0; turn < 1800; turn += 1) {
    const candidates = candidateMutations(current);
    const candidate = candidates[Math.floor(next() * candidates.length)];
    assert.ok(validateGenome(candidate.genome));
    assert.equal(geneticDistance(current, candidate.genome), 1);
    assert.equal(TRAITS.filter(({ key }) => current[key] !== candidate.genome[key]).length, 1);
    assert.ok(candidateMutations(candidate.genome).some(reverse => genomeKey(reverse.genome) === genomeKey(current)));
    touched.add(candidate.key);
    current = candidate.genome;
  }
  assert.equal(touched.size, 40);
  assert.ok(describeGenome(genome({ temperatureTolerance: 0 })).find(trait => trait.key === 'temperatureTolerance').active);
});

test('V4 highland and deep-water specialization have independent benefits and real lowland costs', () => {
  const lowland = genome();
  const highland = genome({ elevationTolerance: 3 });
  const lowHex = land();
  const highHex = land({ bedElevation: 4800 });
  assert.ok(environmentalPerformance(highland, highHex, 'land') > environmentalPerformance(lowland, highHex, 'land') * 5);
  assert.ok(scoreSpecies(lowland, lowHex, 'land').score > scoreSpecies(highland, lowHex, 'land').score);
  assert.deepEqual(deriveGenome(lowland).temperatureRange, deriveGenome(highland).temperatureRange);
  const shallow = genome({ landAdaptation: 0 });
  const deep = genome({ landAdaptation: 0, depthTolerance: 3 });
  const water = land({ waterType: 'sea', bedElevation: -1000, waterLevel: 0 });
  assert.ok(environmentalPerformance(deep, water, 'water') > environmentalPerformance(shallow, water, 'water') * 5);
  assert.ok(deriveGenome(deep).upkeep > deriveGenome(shallow).upkeep);
  assert.ok(deriveGenome(highland).reproductionCost > deriveGenome(lowland).reproductionCost);
});

test('V4 producers pay upkeep and construction for every additional capability', () => {
  const original = founderGenome();
  const baseline = deriveGenome(original);
  for (const trait of TRAITS.filter(({ key }) => !['size', 'photosynthesis'].includes(key))) {
    const added = deriveGenome({ ...original, [trait.key]: trait.key === 'temperatureTolerance' ? 0 : 1 });
    assert.ok(added.upkeep > baseline.upkeep, `${trait.key} upkeep`);
    assert.ok(added.reproductionCost > baseline.reproductionCost, `${trait.key} construction`);
  }
});

test('V4 penalizes mixed feeding most strongly for photosynthetic grazing, without forbidding combinations', () => {
  const hex = land({ waterType: 'sea', bedElevation: -5, waterLevel: 0 });
  const producer = genome({ size: 1, landAdaptation: 0 });
  const prey = { ...producer, photosynthesis: 0, plantFeeding: 1 };
  for (const [photosynthesis, plantFeeding, animalFeeding] of [
    [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1],
  ]) {
    const candidate = { ...producer, photosynthesis, plantFeeding, animalFeeding,
      movement: animalFeeding ? 3 : 0, eyesight: animalFeeding ? 2 : 0 };
    const systems = photosynthesis + plantFeeding + animalFeeding;
    const photoGrazer = photosynthesis && plantFeeding;
    assert.ok(validateGenome(candidate), 'all acquisition combinations remain legal');
    const community = [{ speciesId: 'plants', genome: producer, population: 60 },
      { speciesId: 'prey', genome: prey, population: animalFeeding ? 10 : 0 }];
    const current = scoreSpecies(candidate, hex, 'water', community);
    assert.ok(current.score > 0, `a resource-rich niche can support ${photosynthesis}/${plantFeeding}/${animalFeeding}`);
    // Revision 2 counterfactual: identical resource access, body and community,
    // without revision 3's additional maintenance/construction charges.
    const derived = deriveGenome(candidate);
    const charge = 0.06 * (systems - 1) + 0.16 * photoGrazer;
    const previous = scoreSpecies(candidate, hex, 'water', community, { derived: { ...derived,
      upkeep: derived.upkeep - derived.cells * charge,
      reproductionCost: derived.reproductionCost - derived.cells * (1.3 * charge + 0.30 * (systems - 1) + 0.30 * photoGrazer),
    } });
    assert.equal(current.food, previous.food, 'penalties cannot manufacture or remove a resource pool');
    assert.equal(current.production, previous.production);
    if (systems === 1) assert.deepEqual(current, previous, 'single-system feeders retain revision 2 behavior');
    else {
      assert.ok(current.score < previous.score * (photoGrazer ? 0.4 : 0.8), 'mixed strategies earn a substantially smaller surplus');
      assert.ok(scoreSpecies(candidate, hex, 'water').score < 0, 'maintaining unused feeding machinery is not free');
    }
  }
});

test('V4 founders condition their environment and add deterministic viable random traits', () => {
  const hex = land({ bedElevation: 4500, temperature: 2 });
  const first = founderForSite(hex, 'land', random(5));
  assert.deepEqual(first, founderForSite(hex, 'land', random(5)));
  assert.equal(first.photosynthesis, 1);
  assert.ok(first.elevationTolerance >= 2);
  assert.ok(first.temperatureTolerance < 0);
  assert.ok(scoreSpecies(first, hex, 'land').score > 0);
  const genomes = new Set(Array.from({ length: 25 }, (_, seed) => genomeKey(founderForSite(hex, 'land', random(seed + 1)))));
  assert.ok(genomes.size >= 10, 'conditioned founders retain seeded differences');
});

test('V4 finite community resources respond to competitors and transfer food with conversion losses', () => {
  const hex = land();
  const plant = genome();
  const grazer = genome({ photosynthesis: 0, plantFeeding: 1 });
  const residents = [{ speciesId: 'p', genome: plant, population: 500, habitat: 'land' }];
  assert.ok(scoreSpecies(plant, hex, 'land').score > scoreSpecies(plant, hex, 'land', residents).score);
  assert.equal(scoreSpecies(grazer, hex, 'land').food, 0);
  assert.ok(scoreSpecies(grazer, hex, 'land', residents).food > 0);
  const community = [...residents, { speciesId: 'g', genome: grazer, population: 40, habitat: 'land' },
    { speciesId: 'g2', genome: grazer, population: 40, habitat: 'land' }];
  const state = structuredClone(community);
  const outputs = evaluateCommunity(hex, 'land', community);
  const prepared = community.map(row => ({ ...row, derived: deriveGenome(row.genome),
    environment: environmentalPerformance(row.genome, hex, 'land') }));
  assert.deepEqual(evaluateCommunity(hex, 'land', prepared), outputs,
    'reuse of derived traits and same-day environmental factors preserves results');
  const gross = outputs.reduce((sum, output, index) => sum + output.grossProduction * community[index].population, 0);
  const remaining = outputs.reduce((sum, output, index) => sum + output.production * community[index].population, 0);
  const food = outputs.reduce((sum, output, index) => sum + output.food * community[index].population, 0);
  assert.ok(gross <= ECOLOGY_RULES.lightBudget + 1e-8);
  assert.ok(Math.abs(food - (gross - remaining) * ECOLOGY_RULES.conversion) < 1e-8);
  assert.ok(gross - remaining <= gross * ECOLOGY_RULES.grazingFraction + 1e-8);
  assert.deepEqual(community, state);
  const mixed = genome({ plantFeeding: 1 });
  assert.ok(scoreSpecies(mixed, hex, 'land', residents, { excludeSpeciesId: 'p', independentLineage: true }).food > 0,
    'a hypothetical new consumer may exploit the unchanged producer parent');
  assert.equal(scoreSpecies(mixed, hex, 'land', residents, { excludeSpeciesId: 'p' }).food, 0,
    'ordinary replacement cannot invent a self-feeding advantage');
});

test('V4 splitting vulnerable grazers into more species cannot unlock protected tissue', () => {
  const plant = { speciesId: 'plant', genome: genome({ size: 8, trunk: 3, poison: 3, spines: 3 }), population: 200, habitat: 'land' };
  const grazer = genome({ photosynthesis: 0, plantFeeding: 1 });
  const one = [plant, { speciesId: 'one', genome: grazer, population: 1000, habitat: 'land' }];
  const many = [plant, ...Array.from({ length: 10 }, (_, index) => ({
    speciesId: `split-${index}`, genome: grazer, population: 100, habitat: 'land',
  }))];
  const singleOutput = evaluateCommunity(land(), 'land', one);
  const splitOutput = evaluateCommunity(land(), 'land', many);
  const intake = (output, rows) => output.reduce((sum, row, index) => sum + row.food * rows[index].population, 0);
  assert.ok(Math.abs(intake(singleOutput, one) - intake(splitOutput, many)) < 1e-8);
  const accessible = singleOutput[0].grossProduction * plant.population * ECOLOGY_RULES.grazingFraction
    * grazingAccess(grazer, plant.genome) * ECOLOGY_RULES.conversion;
  assert.ok(intake(splitOutput, many) <= accessible + 1e-8);
});

test('V4 taller plants reward larger browsers while tiny food keeps smaller grazers competitive', () => {
  const tall = genome({ size: 10, trunk: 6 });
  const small = genome({ size: 1 });
  const grazer = genome({ size: 5, photosynthesis: 0, plantFeeding: 1, movement: 1 });
  const larger = { ...grazer, size: 6 };
  const community = plant => [{ speciesId: 'plants', genome: plant, population: 100 }];
  const score = (consumer, plant) => scoreSpecies(consumer, land(), 'land', community(plant));
  assert.ok(grazingAccess(grazer, tall) > 0, 'short browsers can reach a limited lower canopy');
  assert.ok(grazingAccess(larger, tall) > grazingAccess(grazer, tall));
  assert.ok(score(grazer, tall).score > 0);
  assert.ok(score(larger, tall).score > score(grazer, tall).score + 0.005,
    'a single size step earns a selectable benefit after paying the larger body costs');
  assert.ok(score({ ...grazer, size: 2 }, small).score > score({ ...grazer, size: 3 }, small).score);
  assert.ok(grazingAccess({ ...grazer, biteForce: 1 }, tall) > grazingAccess(grazer, tall));
  assert.equal(scoreSpecies(larger, land(), 'land').food, 0);
  const water = land({ waterType: 'sea', bedElevation: -5, waterLevel: 0 });
  const aquatic = { ...grazer, size: 1, landAdaptation: 0 };
  const aquaticPlants = [{ speciesId: 'plankton', genome: { ...small, landAdaptation: 0 }, population: 1000 }];
  assert.ok(scoreSpecies(aquatic, water, 'water', aquaticPlants).score
    > scoreSpecies({ ...aquatic, size: 2 }, water, 'water', aquaticPlants).score);
});

test('V4 splitting tall plant sources cannot give short browsers repeated free foraging effort', () => {
  const plant = genome({ size: 10, trunk: 6 });
  const grazer = { speciesId: 'browser', genome: genome({ photosynthesis: 0, plantFeeding: 1 }), population: 1 };
  const one = evaluateCommunity(land(), 'land', [{ speciesId: 'plant', genome: plant, population: 100 }, grazer]);
  const many = evaluateCommunity(land(), 'land', [...Array.from({ length: 10 }, (_, index) => ({
    speciesId: `plant-${index}`, genome: plant, population: 10,
  })), grazer]);
  assert.ok(one.at(-1).grazingFood > 0);
  assert.ok(Math.abs(one.at(-1).grazingFood - many.at(-1).grazingFood) < 1e-8);
});

test('V4 modest hunting help still needs prey and larger prey can reward a larger predator', () => {
  const hunter = genome({ photosynthesis: 0, animalFeeding: 1, movement: 1 });
  const prey = { speciesId: 'prey', genome: genome({ photosynthesis: 0, plantFeeding: 1 }), population: 100 };
  const derived = deriveGenome(hunter);
  const current = scoreSpecies(hunter, land(), 'land', [prey]);
  const previousEffort = scoreSpecies(hunter, land(), 'land', [prey], { derived: {
    ...derived, predationShare: derived.predationShare * 3.2 / 3.6,
  } });
  assert.ok(current.score > previousEffort.score + 0.005);
  assert.ok(current.food > previousEffort.food && current.food <= previousEffort.food * 1.126);
  const largePrey = { ...prey, genome: { ...prey.genome, size: 8 } };
  const tooSmall = { ...hunter, size: 6 };
  const larger = { ...hunter, size: 7 };
  assert.equal(scoreSpecies(tooSmall, land(), 'land', [largePrey]).predationFood, 0);
  assert.ok(scoreSpecies(larger, land(), 'land', [largePrey]).score > 0);
  assert.equal(scoreSpecies(larger, land(), 'land').predationFood, 0);
  assert.ok(scoreSpecies(larger, land(), 'land').score < 0);
  assert.ok(scoreSpecies({ ...hunter, size: 3 }, land(), 'land', [prey]).score
    > scoreSpecies({ ...hunter, size: 4 }, land(), 'land', [prey]).score,
  'extra predator size still costs more when smaller prey already meets demand');
});

test('V4 defenses and sensing act through paid predator/prey interactions', () => {
  const grazer = genome({ photosynthesis: 0, plantFeeding: 1 });
  const predator = genome({ photosynthesis: 0, animalFeeding: 1 });
  assert.ok(grazingAccess(grazer, genome({ poison: 3 })) < grazingAccess(grazer, genome()));
  assert.ok(grazingAccess({ ...grazer, detoxification: 3 }, genome({ poison: 3 })) > grazingAccess(grazer, genome({ poison: 3 })));
  assert.ok(captureProbability({ ...predator, eyesight: 3 }, grazer) > captureProbability(predator, grazer));
  assert.ok(captureProbability(predator, { ...grazer, armor: 3 }) < captureProbability(predator, grazer));
  const rows = [{ speciesId: 'g', genome: grazer, population: 100, habitat: 'land' },
    { speciesId: 'a', genome: predator, population: 500, habitat: 'land' },
    { speciesId: 'b', genome: predator, population: 500, habitat: 'land' }];
  const outputs = evaluateCommunity(land(), 'land', rows);
  assert.ok(outputs[0].predationLoss > 0);
  assert.ok(outputs.every(output => output.predationLoss <= ECOLOGY_RULES.preyFraction + 1e-8));
});

test('V4 consumers gain basic movement without extra construction and earn further movement through food', () => {
  const producer = genome();
  const grazer = genome({ photosynthesis: 0, plantFeeding: 1 });
  const hunter = genome({ photosynthesis: 0, animalFeeding: 1 });
  const movingHunter = { ...hunter, movement: 1 };
  const community = [{ speciesId: 'plant', genome: producer, population: 100 },
    { speciesId: 'prey', genome: grazer, population: 60 }];
  const stationary = scoreSpecies(hunter, land(), 'land', community);
  const moving = scoreSpecies(movingHunter, land(), 'land', community);
  assert.ok(stationary.score > 0, 'a rare carnivore can live on actual consumer prey');
  assert.ok(moving.score > stationary.score + 0.005, 'pursuit can fund a selectable movement advantage');
  assert.equal(deriveGenome(movingHunter).upkeep, deriveGenome(hunter).upkeep);
  assert.equal(deriveGenome(movingHunter).reproductionCost, deriveGenome(hunter).reproductionCost);
  assert.ok(deriveGenome({ ...hunter, movement: 2 }).upkeep > deriveGenome(hunter).upkeep);
  assert.ok(deriveGenome({ ...hunter, movement: 2 }).reproductionCost > deriveGenome(hunter).reproductionCost);
  assert.ok(deriveGenome({ ...producer, movement: 1 }).upkeep > deriveGenome(producer).upkeep,
    'retaining photosynthesis also retains the cost of basic movement');
  const stationaryGrazer = scoreSpecies(grazer, land(), 'land', community.slice(0, 1));
  const movingGrazer = scoreSpecies({ ...grazer, movement: 1 }, land(), 'land', community.slice(0, 1));
  assert.ok(movingGrazer.score > stationaryGrazer.score + 0.005,
    'movement improves access to real plant production even before predators evolve');
  assert.equal(scoreSpecies({ ...grazer, movement: 1 }, land(), 'land').food, 0);
  for (const genome of [hunter, movingHunter]) {
    const noPrey = scoreSpecies(genome, land(), 'land', community.slice(0, 1));
    assert.equal(noPrey.predationFood, 0, 'producers alone cannot feed a carnivore');
    assert.ok(noPrey.score < 0);
  }
  assert.ok(captureProbability(hunter, { ...grazer, movement: 1 }) < captureProbability(hunter, grazer),
    'movement also improves prey escape');
});

test('V4 splitting the same hunting effort cannot increase target-prey kills or transferred food', () => {
  const preyGenome = genome({ photosynthesis: 0, plantFeeding: 1 });
  const predatorGenome = genome({ photosynthesis: 0, animalFeeding: 1 });
  const prey = { speciesId: 'prey', genome: preyGenome, population: 1000, habitat: 'land' };
  const single = [prey, { speciesId: 'hunter', genome: predatorGenome, population: 100, habitat: 'land' }];
  const split = [prey, ...Array.from({ length: 10 }, (_, index) => ({
    speciesId: `hunter-${index}`, genome: predatorGenome, population: 10, habitat: 'land',
  }))];
  const one = evaluateCommunity(land(), 'land', single);
  const many = evaluateCommunity(land(), 'land', split);
  assert.ok(one[0].predationLoss > 0);
  assert.ok(Math.abs(one[0].predationLoss - many[0].predationLoss) < 1e-12);
  const targetFood = (outputs, rows) => {
    const totalFood = outputs.reduce((sum, output, index) => sum + output.predationFood * rows[index].population, 0);
    // Distinct predator species may also hunt one another. Remove those real
    // extra prey-source transfers to compare only food from the fixed target.
    const predatorTissue = deriveGenome(predatorGenome).cells * 1.4;
    const hunterFood = outputs.slice(1).reduce((sum, output, index) => sum
      + output.predationLoss * rows[index + 1].population * predatorTissue * ECOLOGY_RULES.conversion, 0);
    return totalFood - hunterFood;
  };
  assert.ok(Math.abs(targetFood(one, single) - targetFood(many, split)) < 1e-8);
  const targetTissue = deriveGenome(preyGenome).cells * 1.4;
  assert.ok(Math.abs(targetFood(many, split)
    - many[0].predationLoss * prey.population * targetTissue * ECOLOGY_RULES.conversion) < 1e-8);
});

test('V4 splitting identical prey sources does not offer free repeated hunting effort', () => {
  const preyGenome = genome({ photosynthesis: 0, plantFeeding: 1 });
  const predatorGenome = genome({ photosynthesis: 0, animalFeeding: 1 });
  const predator = { speciesId: 'hunter', genome: predatorGenome, population: 100, habitat: 'land' };
  const single = [{ speciesId: 'prey', genome: preyGenome, population: 1000, habitat: 'land' }, predator];
  const split = [...Array.from({ length: 10 }, (_, index) => ({
    speciesId: `prey-${index}`, genome: preyGenome, population: 100, habitat: 'land',
  })), predator];
  const one = evaluateCommunity(land(), 'land', single);
  const many = evaluateCommunity(land(), 'land', split);
  const kills = (outputs, rows) => outputs.reduce((sum, output, index) => sum + output.predationLoss * rows[index].population, 0);
  assert.ok(kills(one, single) > 0);
  assert.ok(Math.abs(kills(one, single) - kills(many, split)) < 1e-8);
  assert.ok(Math.abs(one.at(-1).predationFood - many.at(-1).predationFood) < 1e-8);
});

test('V4 competition displaces an inferior light competitor sooner without harsher empty-world conditions', () => {
  const hex = land({ humidity: 0.8, bedElevation: 0 });
  const pair = population => [
    { speciesId: 'canopy', genome: genome({ landAdaptation: 1, trunk: 4 }), population },
    { speciesId: 'short', genome: genome({ landAdaptation: 1 }), population },
  ];
  const before = evaluateV3(hex, 'land', pair(60));
  const after = evaluateCommunity(hex, 'land', pair(60));
  assert.ok(before[1].score > 0 && after[1].score < 0);
  assert.ok(after[0].score > before[0].score);
  assert.deepEqual(evaluateCommunity(hex, 'land', pair(30)), evaluateV3(hex, 'land', pair(30)),
    'uncontested intake, mortality, and recruitment stay identical to V3');
});

test('V4 leaf, shade, root, and cuticle strategies exchange open-site growth for drought or canopy access', () => {
  const base = genome({ size: 2 });
  const score = (g, hex = land(), community = []) => scoreSpecies(g, hex, 'land', community).score;
  const dry = land({ humidity: 0.3 });
  const crowd = [{ speciesId: 'canopy', genome: base, population: 500 }];
  assert.ok(score({ ...base, leafArea: 1 }) > score(base));
  assert.ok(environmentalPerformance({ ...base, leafArea: 1 }, dry, 'land') < environmentalPerformance(base, dry, 'land'));
  assert.ok(score({ ...base, shadeTolerance: 1 }, land(), crowd) > score(base, land(), crowd));
  assert.ok(score({ ...base, shadeTolerance: 1 }) < score(base));
  for (const key of ['deepRoots', 'waxyCuticle']) {
    assert.ok(score({ ...base, [key]: 1 }, dry) > score(base, dry), `${key} helps with drought`);
    assert.ok(score({ ...base, [key]: 1 }) < score(base), `${key} costs at wet sites`);
  }
  assert.ok(deriveGenome({ ...base, deepRoots: 1 }).dispersalMultiplier < deriveGenome(base).dispersalMultiplier);
});

test('V4 buoyancy competes for existing water light and pays in exposed or uncrowded water', () => {
  const base = genome({ size: 2, landAdaptation: 0 });
  const floating = { ...base, buoyancy: 1 };
  const hex = land({ waterType: 'sea', bedElevation: -30, waterLevel: 0 });
  const residents = [{ speciesId: 'waterplants', genome: base, population: 500 }];
  assert.ok(scoreSpecies(floating, hex, 'water', residents).score > scoreSpecies(base, hex, 'water', residents).score);
  assert.ok(scoreSpecies(floating, hex, 'water').score < scoreSpecies(base, hex, 'water').score);
  assert.ok(environmentalPerformance(floating, { ...hex, waterExposure: 0.5 }, 'water')
    < environmentalPerformance(base, { ...hex, waterExposure: 0.5 }, 'water'));
  const rows = [...residents, { speciesId: 'floater', genome: floating, population: 500 }];
  const outputs = evaluateCommunity(hex, 'water', rows);
  assert.ok(outputs.reduce((total, row, index) => total + row.grossProduction * rows[index].population, 0)
    <= ECOLOGY_RULES.waterLightBudget / (1 + 30 / 180) + 1e-8);
});

test('V4 sexual recruitment wins at normal densities in producers and consumers while isolation retains an asexual niche', () => {
  const producer = genome({ size: 2 });
  const grazer = genome({ size: 2, photosynthesis: 0, plantFeeding: 1 });
  for (const base of [producer, grazer]) {
    const food = base.plantFeeding ? [{ speciesId: 'plants', genome: producer, population: 100 }] : [];
    const dense = [...food, { speciesId: 'self', genome: base, population: 20 }];
    const options = { excludeSpeciesId: 'self' };
    const sexual = { ...base, sexualReproduction: 1 };
    const ordinary = scoreSpecies(base, land(), 'land', dense, options);
    const mated = scoreSpecies(sexual, land(), 'land', dense, options);
    assert.ok(mated.score > ordinary.score + 0.005);
    assert.equal(mated.food, ordinary.food);
    assert.equal(mated.production, ordinary.production, 'replacement uses the unchanged represented population');
    assert.ok(scoreSpecies(sexual, land(), 'land', food).score < scoreSpecies(base, land(), 'land', food).score);
    const independent = scoreSpecies(sexual, land(), 'land', dense, { ...options, independentLineage: true });
    const projectedSocial = evaluateCommunity(land(), 'land', [...dense, {
      speciesId: '__candidate__:self', genome: sexual, population: 1, conspecificPopulation: 5,
    }]).at(-1);
    assert.deepEqual(independent, projectedSocial, 'a rare lineage projects only the quarter-transfer social setting');
    const withoutMates = scoreSpecies(sexual, land(), 'land', dense, { excludeSpeciesId: 'unrelated' });
    assert.equal(independent.food, withoutMates.food);
    assert.equal(independent.production, withoutMates.production, 'projected companions never supply extra food');
  }
});

test('V4 defense scoring uses actual-density exposure while preserving rare finite-resource intake', () => {
  const plant = genome();
  const grazer = genome({ photosynthesis: 0, plantFeeding: 1 });
  const hunter = genome({ photosynthesis: 0, animalFeeding: 1 });
  const community = [{ speciesId: 'plant', genome: plant, population: 500 },
    { speciesId: 'prey', genome: grazer, population: 30 },
    { speciesId: 'hunter', genome: hunter, population: 2 }];
  const snapshot = structuredClone(community);
  const hidden = { ...grazer, camouflage: 1 };
  const resident = scoreSpecies(grazer, land(), 'land', community, { excludeSpeciesId: 'prey' });
  const candidate = scoreSpecies(hidden, land(), 'land', community, { excludeSpeciesId: 'prey' });
  assert.ok(candidate.score > resident.score + 0.005);
  assert.ok(candidate.score > 0 && candidate.predationLoss < resident.predationLoss);
  const replaced = community.map(row => row.speciesId === 'prey' ? { ...row, genome: hidden } : row);
  const exposure = evaluateCommunity(land(), 'land', replaced)[1];
  assert.equal(candidate.predationLoss, exposure.predationLoss);
  const rare = evaluateCommunity(land(), 'land', [...community, {
    speciesId: 'prey', genome: hidden, population: 1, conspecificPopulation: 30,
  }]).at(-1);
  assert.equal(candidate.food, rare.food);
  assert.equal(candidate.grazingFood, rare.grazingFood);
  assert.equal(candidate.production, rare.production);
  assert.notEqual(candidate.food, exposure.food, 'counterfactual food cannot enter rare intake');
  const caring = { ...hidden, offspringInvestment: 1 };
  const caringScore = scoreSpecies(caring, land(), 'land', community, { excludeSpeciesId: 'prey' });
  const caringRare = evaluateCommunity(land(), 'land', [...community, {
    speciesId: 'prey', genome: caring, population: 1, conspecificPopulation: 30,
  }]).at(-1);
  assert.ok(caringScore.predationLoss > caringRare.predationLoss);
  assert.ok(caringScore.birthRate > caringRare.birthRate,
    'offspring-care recruitment uses the same corrected exposure as mortality');
  assert.ok(caringScore.deathRate > caringRare.deathRate);
  assert.equal(caringScore.food, caringRare.food);
  assert.deepEqual(community, snapshot, 'a hypothesis does not change the census or parent genome');
});

test('V4 rare-resource scoring preserves selectable larger bodies in crowded canopy competition', () => {
  const hex = land({ bedElevation: 0, humidity: 0.8 });
  const parent = genome({ size: 2, trunk: 4, landAdaptation: 1 });
  const larger = { ...parent, size: 3 };
  const community = [{ speciesId: 'self', genome: parent, population: 100 },
    { speciesId: 'rival', genome: { ...parent, size: 3 }, population: 100 }];
  const resident = scoreSpecies(parent, hex, 'land', community, { excludeSpeciesId: 'self' });
  const candidate = scoreSpecies(larger, hex, 'land', community, { excludeSpeciesId: 'self' });
  assert.ok(candidate.score > resident.score + 0.005 && candidate.score > 0);
  assert.deepEqual(candidate, evaluateCommunity(hex, 'land', [...community, {
    speciesId: 'self', genome: larger, population: 1, conspecificPopulation: 100,
  }]).at(-1), 'growing one hypothetical body must not inflate every resident body before selection');
});

test('V4 attraction helps a small mating group but costs a well-connected group and increases exposure', () => {
  const base = genome({ size: 2, sexualReproduction: 1 });
  const attractive = { ...base, mateAttraction: 1 };
  const score = (g, population) => scoreSpecies(g, land(), 'land', [
    { speciesId: 'self', genome: base, population },
  ], { excludeSpeciesId: 'self' }).score;
  assert.ok(score(attractive, 5) > score(base, 5));
  assert.ok(score(attractive, 150) < score(base, 150));
  const prey = genome({ photosynthesis: 0, plantFeeding: 1 });
  const hunter = genome({ photosynthesis: 0, animalFeeding: 1 });
  assert.ok(captureProbability(hunter, { ...prey, mateAttraction: 1 }) > captureProbability(hunter, prey));
});

test('V4 propagules and clonal growth profit from open space and exchange dispersal for local persistence', () => {
  const base = genome({ size: 2 });
  const crowded = [{ speciesId: 'resident', genome: base, population: 500 }];
  for (const key of ['propaguleDispersal', 'clonalGrowth']) {
    assert.ok(scoreSpecies({ ...base, [key]: 1 }, land(), 'land').score > scoreSpecies(base, land(), 'land').score);
    assert.ok(deriveGenome({ ...base, [key]: 1 }).reproductionCost > deriveGenome(base).reproductionCost);
  }
  assert.ok(scoreSpecies({ ...base, clonalGrowth: 1 }, land(), 'land', crowded).score < scoreSpecies(base, land(), 'land', crowded).score);
  assert.ok(deriveGenome({ ...base, propaguleDispersal: 1 }).crossingMultiplier > deriveGenome(base).crossingMultiplier);
  assert.ok(deriveGenome({ ...base, propaguleDispersal: 1 }).dispersalMultiplier > deriveGenome(base).dispersalMultiplier);
  assert.ok(deriveGenome({ ...base, clonalGrowth: 1 }).dispersalMultiplier < deriveGenome(base).dispersalMultiplier);
  const sexual = { ...base, sexualReproduction: 1 };
  assert.ok(scoreSpecies({ ...sexual, clonalGrowth: 1 }, land(), 'land').score < scoreSpecies(sexual, land(), 'land').score);
});

test('V4 camouflage, warnings, ambush, herding, and packs alter real capture opportunities contextually', () => {
  const prey = genome({ size: 3, photosynthesis: 0, plantFeeding: 1 });
  const hunter = genome({ size: 3, photosynthesis: 0, animalFeeding: 1 });
  assert.ok(captureProbability(hunter, { ...prey, camouflage: 1 }) < captureProbability(hunter, prey));
  assert.ok(captureProbability(hunter, { ...prey, warningSignals: 1 }) > captureProbability(hunter, prey), 'undefended warnings expose the prey');
  assert.ok(captureProbability(hunter, { ...prey, poison: 2, warningSignals: 1 }) < captureProbability(hunter, { ...prey, poison: 2 }));
  assert.ok(captureProbability({ ...hunter, ambush: 1 }, { ...prey, movement: 1 }) > captureProbability(hunter, { ...prey, movement: 1 }));
  assert.ok(deriveGenome({ ...hunter, movement: 1, ambush: 1 }).speed < deriveGenome({ ...hunter, movement: 1 }).speed);
  const capture = (predator, target, predatorSupport, preySupport) => captureProbability(predator, target,
    deriveGenome(predator), deriveGenome(target), { predatorSupport, preySupport });
  assert.equal(capture(hunter, { ...prey, herding: 1 }, 1, 1), capture(hunter, prey, 1, 1));
  assert.ok(capture(hunter, { ...prey, herding: 1 }, 1, 30) < capture(hunter, prey, 1, 30));
  assert.equal(capture({ ...hunter, cooperativeHunting: 1 }, prey, 1, 1), capture(hunter, prey, 1, 1));
  assert.ok(capture({ ...hunter, cooperativeHunting: 1 }, prey, 30, 1) > capture(hunter, prey, 30, 1));
  const larger = { ...prey, size: 4 };
  const pack = { ...hunter, cooperativeHunting: 1 };
  assert.equal(preyEligible(hunter, larger), false);
  assert.equal(preyEligible(pack, larger, deriveGenome(pack), deriveGenome(larger), { predatorSupport: 30 }), true);
});

test('V4 burrowing, dormancy, insulation and care trade productive weather against survival under stress', () => {
  const base = genome({ size: 2 });
  const cold = land({ temperature: 0 });
  assert.ok(environmentalPerformance({ ...base, burrowing: 1 }, cold, 'land') > environmentalPerformance(base, cold, 'land'));
  assert.ok(scoreSpecies({ ...base, burrowing: 1 }, land(), 'land').score < scoreSpecies(base, land(), 'land').score);
  assert.ok(scoreSpecies({ ...base, dormancy: 1 }, cold, 'land').deathRate < scoreSpecies(base, cold, 'land').deathRate);
  assert.ok(scoreSpecies({ ...base, dormancy: 1 }, land(), 'land').score < scoreSpecies(base, land(), 'land').score);
  assert.ok(scoreSpecies({ ...base, insulation: 1 }, cold, 'land').score > scoreSpecies(base, cold, 'land').score);
  const hot = land({ temperature: 40 });
  assert.ok(scoreSpecies({ ...base, insulation: 1 }, hot, 'land').score < scoreSpecies(base, hot, 'land').score);
  const grazer = { ...base, photosynthesis: 0, plantFeeding: 1 };
  const hunter = { ...base, photosynthesis: 0, animalFeeding: 1, movement: 1 };
  const community = [{ speciesId: 'plants', genome: base, population: 500 },
    { speciesId: 'hunter', genome: hunter, population: 15 },
    { speciesId: 'grazer', genome: grazer, population: 1 }];
  assert.ok(scoreSpecies({ ...grazer, offspringInvestment: 1 }, land(), 'land', community).birthRate
    > scoreSpecies(grazer, land(), 'land', community).birthRate);
  assert.ok(scoreSpecies({ ...base, offspringInvestment: 1 }, land(), 'land').score < scoreSpecies(base, land(), 'land').score);
});

test('V4 filtering consumes existing small water plants and pays when its preferred food is unavailable', () => {
  const grazer = genome({ size: 2, landAdaptation: 0, photosynthesis: 0, plantFeeding: 1 });
  const filter = { ...grazer, filterFeeding: 1 };
  const hex = land({ waterType: 'sea', bedElevation: -5, waterLevel: 0 });
  const food = size => [{ speciesId: 'plants', genome: genome({ size, landAdaptation: 0 }), population: 500 }];
  assert.ok(scoreSpecies(filter, hex, 'water', food(2)).score > scoreSpecies(grazer, hex, 'water', food(2)).score);
  assert.ok(scoreSpecies(filter, hex, 'water', food(5)).score < scoreSpecies(grazer, hex, 'water', food(5)).score);
  assert.equal(scoreSpecies(filter, hex, 'water').food, 0);
  assert.ok(scoreSpecies(filter, hex, 'water').score < 0);
  const plants = food(2)[0];
  const feeder = { speciesId: 'filter', genome: filter, population: 5 };
  const whole = evaluateCommunity(hex, 'water', [plants, feeder]);
  const divided = evaluateCommunity(hex, 'water', [...Array.from({ length: 10 }, (_, index) => ({
    ...plants, speciesId: `plants-${index}`, population: plants.population / 10,
  })), feeder]);
  assert.ok(Math.abs(whole.at(-1).grazingFood - divided.at(-1).grazingFood) < 1e-8,
    'additional plant labels do not give a filter feeder free repeated effort');
});

test('V4 social support comes from actual conspecific population and is invariant to row partitioning', () => {
  const prey = genome({ photosynthesis: 0, plantFeeding: 1, herding: 2 });
  const hunter = genome({ photosynthesis: 0, animalFeeding: 1, cooperativeHunting: 2 });
  const rows = [{ speciesId: 'prey', genome: prey, population: 100 },
    { speciesId: 'pack', genome: hunter, population: 10 }];
  const whole = evaluateCommunity(land(), 'land', rows);
  const divided = evaluateCommunity(land(), 'land', [rows[0],
    { ...rows[1], population: 5 }, { ...rows[1], population: 5 }]);
  assert.ok(Math.abs(whole[0].predationLoss - divided[0].predationLoss) < 1e-8);
  assert.ok(Math.abs(whole[1].predationFood - divided[1].predationFood) < 1e-8);
  assert.equal(divided[1].birthRate, divided[2].birthRate);
});
