import { climateAt } from '../../climate.js';
import { hashSeed } from '../../noise.js';
import { classify } from './classification.js';
import { describeGenome, deriveGenome, founderGenome, genomeKey, mutateGenome, validateGenome } from './genes/genome.js';
import { canCross, chooseHabitat, crossingDifficulty, directWaterAccess, habitatFactor,
  hasLand, hasWater, temperatureFactor } from './habitat.js';
import { allocateLight } from './light.js';
import { binomial, createRandom, uniformPartitions } from './random.js';

export const MODEL_ID = 'v1';
export const RULES_REVISION = 'v1-cohorts-1';
export const CONTRACT_VERSION = 'life-observations-1';
const FORMAT = 'emergence-life-v1-checkpoint-1';
const PHOTOSYNTHESIS_MULTIPLIER = 2.4;
const MUTATION_PROBABILITY = 0.0001;
const copy = (value) => JSON.parse(JSON.stringify(value));
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function worldIdentity(world) {
  const identity = { generatorVersion: world.version ?? 'fixture', seed: world.seed ?? '',
    size: world.size ?? 'custom', width: world.width, height: world.height,
    geography: world.geography ?? null, landFraction: world.landFraction ?? null,
    waterAbundance: world.waterAbundance ?? null, candidate: world.candidate ?? null };
  identity.terrainFingerprint = hashSeed(JSON.stringify(world.hexes.map((hex) => [hex.id,
    hex.row, hex.col, hex.bedElevation, hex.waterType, hex.waterLevel, hex.runoff,
    hex.downstream, hex.distanceToWater, hex.neighbors]))).toString(16);
  return { ...identity, id: `world-${hashSeed(JSON.stringify(identity)).toString(16)}` };
}

function validateDay(day) {
  if (!Number.isSafeInteger(day) || day < 0) throw new RangeError('Day must be a non-negative safe integer.');
}

const FOUNDER_POPULATION = 20;
const initialStats = () => ({ births: 0, deaths: 0, mutations: 0, failedEstablishments: 0,
  reproductionAttempts: 0, movements: 0, predationDeaths: 0, speciations: 0 });

/** Create one headless life run against a read-only physical world.
 * energyQuantum:0 retains exact floating-point stored-energy cohorts for comparison.
 * runId is an optional caller-owned opaque identity (e.g. a world-session token). */
export function createLifeModel(world, { seed = `${world.seed}:life-v1`,
  energyQuantum = 1 / 64, runId } = {}) {
  validateDay(world.day);
  if (typeof seed !== 'string' && (typeof seed !== 'number' || !Number.isFinite(seed))) throw new TypeError('Invalid life seed.');
  if (!Number.isFinite(energyQuantum) || energyQuantum < 0 || energyQuantum > 1 / 64) {
    throw new RangeError('Energy quantum must be between 0 and 1/64.');
  }
  const identity = worldIdentity(world);
  const state = {
    format: FORMAT, modelId: MODEL_ID, rulesRevision: RULES_REVISION,
    worldIdentity: identity, worldId: identity.id,
    runId: runId === undefined ? `${identity.id}:${hashSeed(seed).toString(16)}:${world.day}` : String(runId),
    seed: String(seed), baseSeed: String(seed), attempt: 1, previousAttempts: [],
    settings: { energyQuantum }, startDay: world.day,
    day: world.day, revision: 0, introduced: false,
    genomes: [], species: [], cohorts: [], nextGenome: 1, nextSpecies: 1, nextEstablished: 1,
    classifier: { groups: [], timers: {}, nextGroup: 1 },
    classification: { groups: 0, qualifyingPairs: 0, longestIsolation: 0 },
    stats: initialStats(),
    history: [], randomState: createRandom(seed).exportState(),
  };
  state.baseRunId = state.runId;
  return buildModel(world, state);
}

/** Checkpoints are model-local continuation state, not an application save format. */
export function restoreLifeModel(world, checkpoint) {
  if (!checkpoint || checkpoint.format !== FORMAT || checkpoint.rulesRevision !== RULES_REVISION
    || checkpoint.worldId !== worldIdentity(world).id) throw new TypeError('Incompatible life checkpoint.');
  const state = copy(checkpoint);
  validateDay(state.day);
  if (!Number.isFinite(state.settings.energyQuantum) || state.settings.energyQuantum < 0
    || state.settings.energyQuantum > 1 / 64) {
    throw new TypeError('Invalid checkpoint settings.');
  }
  const genomeIds = new Set(state.genomes.map((record) => record.id));
  const speciesIds = new Set(state.species.map((record) => record.id));
  if (state.genomes.some((record) => !validateGenome(record.genome))
    || state.cohorts.some((cohort) => !Number.isSafeInteger(cohort.count) || cohort.count < 1
      || !world.hexes[cohort.hexId] || !genomeIds.has(cohort.genomeId) || !speciesIds.has(cohort.speciesId)
      || !Number.isFinite(cohort.energy) || cohort.energy < 0 || !['land', 'water'].includes(cohort.habitat))) {
    throw new TypeError('Invalid checkpoint population.');
  }
  return buildModel(world, state);
}

function buildModel(world, state) {
  // Geography is copied once; subsequent atlas setDay/inspection cannot mutate this run.
  const geography = { width: world.width, height: world.height,
    hexes: world.hexes.map((hex) => ({ ...hex, neighbors: [...hex.neighbors] })) };
  let random = createRandom(state.seed, state.randomState);
  const genomes = new Map(state.genomes.map((record) => [record.id, { ...record, derived: deriveGenome(record.genome) }]));
  const genomeIds = new Map(state.genomes.map((record) => [genomeKey(record.genome), record.id]));
  const waterAccess = geography.hexes.map((hex) => directWaterAccess(hex, geography.hexes));
  const climate = new Map();
  let environmentDay = state.day;
  let cachedObservation = null;

  function environment(hexId) {
    if (!climate.has(hexId)) {
      const hex = geography.hexes[hexId];
      climate.set(hexId, { ...hex, ...climateAt(geography, hex, environmentDay) });
    }
    return climate.get(hexId);
  }

  function performance(genomeId, hexId, habitat) {
    const record = genomes.get(genomeId);
    const hex = environment(hexId);
    return temperatureFactor(record.derived, hex.temperature)
      * habitatFactor(record.genome, hex, habitat, waterAccess[hexId]);
  }

  function registerGenome(genome, parentGenomeId = null) {
    const key = genomeKey(genome);
    if (genomeIds.has(key)) return genomeIds.get(key);
    const id = `variant-${state.nextGenome++}`;
    const record = { id, genome: { ...genome }, parentGenomeId,
      originDay: environmentDay, establishedOrder: null };
    state.genomes.push(record);
    genomes.set(id, { ...record, derived: deriveGenome(genome) });
    genomeIds.set(key, id);
    return id;
  }

  function established(genomeId) {
    const record = genomes.get(genomeId);
    if (record.establishedOrder === null) {
      record.establishedOrder = state.nextEstablished++;
      state.genomes.find((item) => item.id === genomeId).establishedOrder = record.establishedOrder;
    }
  }

  function newSpecies(parentId = null) {
    const id = `species-${state.nextSpecies++}`;
    state.species.push({ id, parentId, originDay: environmentDay, extinctDay: null });
    if (parentId) state.stats.speciations += 1;
    return id;
  }

  function quantum(energy, capacity) {
    const capped = Math.min(capacity, Math.max(0, energy));
    return state.settings.energyQuantum ? Math.floor(capped / state.settings.energyQuantum) * state.settings.energyQuantum : capped;
  }

  function merge(cohorts, roundEnergy = false) {
    const merged = new Map();
    for (const cohort of cohorts) {
      if (cohort.count <= 0) continue;
      const energy = roundEnergy ? quantum(cohort.energy, genomes.get(cohort.genomeId).derived.cells) : cohort.energy;
      const key = `${cohort.hexId}|${cohort.habitat}|${cohort.speciesId}|${cohort.genomeId}|${cohort.groupId}|${energy}`;
      if (merged.has(key)) merged.get(key).count += cohort.count;
      else merged.set(key, { hexId: cohort.hexId, habitat: cohort.habitat, speciesId: cohort.speciesId,
        genomeId: cohort.genomeId, groupId: cohort.groupId, count: cohort.count, energy });
    }
    return [...merged.values()].sort((a, b) => a.hexId - b.hexId || order(a.habitat, b.habitat)
      || order(a.speciesId, b.speciesId) || order(a.genomeId, b.genomeId)
      || order(a.groupId, b.groupId) || a.energy - b.energy);
  }

  function crossing(cohort, destinationId, specifiedHabitat) {
    const record = genomes.get(cohort.genomeId);
    const source = environment(cohort.hexId);
    const destination = environment(destinationId);
    const habitat = specifiedHabitat ?? chooseHabitat(record.genome, source, cohort.habitat, destination);
    if (!habitat || !canCross(record.genome, source, cohort.habitat, destination, habitat)) return null;
    const difficulty = crossingDifficulty(record.genome, record.derived, source, cohort.habitat,
      destination, habitat, waterAccess[destinationId]);
    return { habitat, difficulty, probability: 1 / (1 + 4 * difficulty) };
  }

  function move(cohorts) {
    const result = [];
    for (const cohort of cohorts) {
      const { genome, derived } = genomes.get(cohort.genomeId);
      if (!genome.movement || genome.trunk) { result.push(cohort); continue; }
      const source = environment(cohort.hexId);
      const choices = source.neighbors.map((hexId) => ({ hexId }));
      if (hasLand(source) && hasWater(source)) choices.push({ hexId: source.id,
        habitat: cohort.habitat === 'water' ? 'land' : 'water' });
      if (!choices.length) { result.push(cohort); continue; }
      const attempts = binomial(cohort.count, 0.1 * performance(cohort.genomeId, cohort.hexId, cohort.habitat), random.next);
      let unchanged = cohort.count - attempts;
      const counts = uniformPartitions(attempts, choices.length, random.next);
      choices.forEach((choice, index) => {
        const count = counts[index];
        if (!count) return;
        const route = crossing(cohort, choice.hexId, choice.habitat);
        const cost = route ? 0.1 * derived.cells * (1 + 4 * route.difficulty) : Infinity;
        if (!route || cost > cohort.energy) { unchanged += count; return; }
        const moved = binomial(count, route.probability, random.next);
        if (moved) result.push({ ...cohort, count: moved, hexId: choice.hexId,
          habitat: route.habitat, energy: cohort.energy - cost });
        if (count > moved) result.push({ ...cohort, count: count - moved, energy: cohort.energy - cost });
        state.stats.movements += moved;
      });
      if (unchanged) result.push({ ...cohort, count: unchanged });
    }
    return merge(result);
  }

  function feed(cohorts) {
    const hexes = new Map();
    for (const cohort of cohorts) {
      cohort.acquired = 0;
      cohort.production = 0;
      if (!hexes.has(cohort.hexId)) hexes.set(cohort.hexId, []);
      hexes.get(cohort.hexId).push(cohort);
    }
    const result = [];
    for (const local of hexes.values()) {
      const allocations = allocateLight(local.map((cohort) => {
        const derived = genomes.get(cohort.genomeId).derived;
        const cap = derived.cells * derived.photosynthesisShare;
        return { count: cohort.count, cap, weight: cap * (cohort.habitat === 'land' ? derived.landCompetition : 1) };
      }));
      local.forEach((cohort, index) => {
        cohort.production = allocations[index] * PHOTOSYNTHESIS_MULTIPLIER
          * performance(cohort.genomeId, cohort.hexId, cohort.habitat);
        cohort.acquired = cohort.production;
      });
      for (const habitat of ['water', 'land']) {
        let occupants = local.filter((cohort) => cohort.habitat === habitat);
        if (!occupants.length) continue;
        occupants = graze(occupants);
        hunt(occupants);
        result.push(...occupants.filter((cohort) => cohort.count > 0));
      }
    }
    return result;
  }

  function graze(occupants) {
    const producers = occupants.filter((cohort) => cohort.production > 0);
    const producerCount = producers.reduce((sum, cohort) => sum + cohort.count, 0);
    const pool = producers.reduce((sum, cohort) => sum + cohort.production * cohort.count * 0.2, 0);
    if (!pool) return occupants;
    const consumers = [];
    const result = [];
    for (const cohort of occupants) {
      const derived = genomes.get(cohort.genomeId).derived;
      if (!derived.grazingShare) { result.push(cohort); continue; }
      const density = Math.max(0, producerCount - (cohort.production > 0 ? 1 : 0));
      const encounters = binomial(cohort.count, density ** 2 / (density ** 2 + 20 ** 2), random.next);
      if (encounters) {
        const consumer = { ...cohort, count: encounters, capacity: 4 * derived.cells * derived.grazingShare };
        consumers.push(consumer); result.push(consumer);
      }
      if (encounters < cohort.count) result.push({ ...cohort, count: cohort.count - encounters });
    }
    const demand = consumers.reduce((sum, cohort) => sum + cohort.count * cohort.capacity, 0);
    const consumed = Math.min(pool, demand);
    if (!consumed) return result;
    const fraction = consumed / pool;
    for (const cohort of result) cohort.acquired -= cohort.production * 0.2 * fraction;
    for (const cohort of consumers) cohort.acquired += cohort.capacity * consumed / demand * 0.6
      * performance(cohort.genomeId, cohort.hexId, cohort.habitat);
    return result;
  }

  function hunt(occupants) {
    const preyBySize = Array.from({ length: 11 }, () => []);
    const preyCounts = Array(11).fill(0);
    const hunters = [];
    let pending = 0;
    let largestHunter = 0;
    for (const cohort of occupants) {
      const { genome } = genomes.get(cohort.genomeId);
      cohort.hunts = genome.animalFeeding ? cohort.count : 0;
      if (cohort.hunts) {
        hunters.push(cohort); pending += cohort.hunts;
        largestHunter = Math.max(largestHunter, genome.size);
      }
      if (genome.plantFeeding || genome.animalFeeding) {
        preyBySize[genome.size].push(cohort);
        preyCounts[genome.size] += cohort.count;
      }
    }
    if (!pending || !preyCounts.slice(1, largestHunter).some(Boolean)) return;
    const fedStates = new Map();
    // Exact depletion-aware hunts, indexed by ten body sizes. Failed hunters retain
    // their cohort; successful identical feeding outcomes recombine immediately.
    while (pending > 0) {
      let choice = Math.floor(random.next() * pending);
      const actor = hunters.find((cohort) => { choice -= cohort.hunts; return choice < 0; });
      actor.hunts -= 1; pending -= 1;
      const { genome, derived } = genomes.get(actor.genomeId);
      let density = 0;
      for (let size = 1; size < genome.size; size += 1) density += preyCounts[size];
      if (!density || random.next() >= density ** 2 / (density ** 2 + 20 ** 2)) continue;
      let target = Math.floor(random.next() * density);
      let victimSize = 1;
      while (target >= preyCounts[victimSize]) { target -= preyCounts[victimSize]; victimSize += 1; }
      const victim = preyBySize[victimSize].find((cohort) => { target -= cohort.count; return target < 0; });
      const preyGenome = genomes.get(victim.genomeId);
      const activeMovement = genome.movement && !genome.trunk ? 1 : 0;
      const preyMovement = preyGenome.genome.movement && !preyGenome.genome.trunk ? 1 : 0;
      const capture = Math.max(0.1, Math.min(0.9, 0.6 + 0.2 * (activeMovement - preyMovement)));
      if (random.next() >= capture) continue;
      if (victim.hunts && random.next() < victim.hunts / victim.count) { victim.hunts -= 1; pending -= 1; }
      victim.count -= 1; preyCounts[victimSize] -= 1;
      const gained = 0.6 * Math.min(4 * derived.cells * derived.predationShare,
        preyGenome.derived.cells + victim.energy) * performance(actor.genomeId, actor.hexId, actor.habitat);
      if (gained > 0) {
        actor.count -= 1;
        const acquired = actor.acquired + gained;
        const key = `${actor.speciesId}|${actor.genomeId}|${actor.groupId}|${actor.energy}|${acquired}`;
        if (fedStates.has(key)) fedStates.get(key).count += 1;
        else {
          const predator = { ...actor, count: 1, hunts: 0, acquired };
          fedStates.set(key, predator);
          occupants.push(predator);
          preyBySize[genome.size].push(predator);
        }
      }
      state.stats.deaths += 1; state.stats.predationDeaths += 1;
      // Once the smallest potential food is gone, no pending hunter can succeed.
      if (!preyCounts.slice(1, largestHunter).some(Boolean)) break;
    }
  }

  function establish(parent, genomeId, count, newborns) {
    if (!count) return;
    const template = { ...parent, genomeId, energy: 0 };
    const neighbors = geography.hexes[parent.hexId].neighbors;
    const dispersers = neighbors.length ? binomial(count, 0.05, random.next) : 0;
    const counts = [count - dispersers, ...uniformPartitions(dispersers, neighbors.length, random.next)];
    [parent.hexId, ...neighbors].forEach((hexId, index) => {
      const attempts = counts[index];
      if (!attempts) return;
      const route = crossing(template, hexId);
      const successes = route ? (index === 0 ? attempts : binomial(attempts, route.probability, random.next)) : 0;
      state.stats.failedEstablishments += attempts - successes;
      state.stats.births += successes;
      if (successes) {
        established(genomeId);
        newborns.push({ ...template, count: successes, hexId, habitat: route.habitat });
      }
    });
  }

  function settle(cohorts) {
    const adults = [];
    const newborns = [];
    for (const cohort of cohorts) {
      const { genome, derived } = genomes.get(cohort.genomeId);
      const available = cohort.energy + cohort.acquired;
      if (available < derived.upkeep) {
        const deaths = binomial(cohort.count, Math.max(0, 1 - available / derived.upkeep), random.next);
        state.stats.deaths += deaths;
        if (cohort.count > deaths) adults.push({ ...cohort, count: cohort.count - deaths, energy: 0 });
        continue;
      }
      let remainder = available - derived.upkeep;
      if (remainder >= derived.reproductionCost) {
        remainder -= derived.reproductionCost;
        state.stats.reproductionAttempts += cohort.count;
        const mutants = binomial(cohort.count, MUTATION_PROBABILITY, random.next);
        state.stats.mutations += mutants;
        establish(cohort, cohort.genomeId, cohort.count - mutants, newborns);
        for (let index = 0; index < mutants; index += 1) {
          const mutant = mutateGenome(genome, random.next);
          establish(cohort, registerGenome(mutant, cohort.genomeId), 1, newborns);
        }
      }
      adults.push({ ...cohort, energy: remainder });
    }
    // Newborns join only after all adult actions; their first active turn is tomorrow.
    return merge([...adults, ...newborns], true);
  }

  function updateHistory() {
    const population = state.cohorts.reduce((sum, cohort) => sum + cohort.count, 0);
    const livingSpecies = new Set(state.cohorts.map((cohort) => cohort.speciesId));
    for (const record of state.species) if (!livingSpecies.has(record.id) && record.extinctDay === null) record.extinctDay = state.day;
    if (state.introduced) {
      state.history.push({ day: state.day, population, species: livingSpecies.size,
        variants: new Set(state.cohorts.map((cohort) => cohort.genomeId)).size,
        occupiedHexes: new Set(state.cohorts.map((cohort) => cohort.hexId)).size });
      if (state.history.length > 180) state.history.splice(0, state.history.length - 180);
    }
    cachedObservation = null;
  }

  function introduce(hexId) {
    if (state.introduced && state.cohorts.length) return { ok: false, reason: 'already-introduced' };
    if (!Number.isInteger(hexId) || !geography.hexes[hexId]) return { ok: false, reason: 'unknown-hex' };
    const hex = environment(hexId);
    if (hex.permanentIce) return { ok: false, reason: 'permanent-ice' };
    const genome = founderGenome();
    const habitat = hasWater(hex) ? 'water' : 'land';
    if (habitat === 'land') {
      if (!hasLand(hex) || hex.bedElevation >= 3500) return { ok: false, reason: 'unsuitable-habitat' };
      const moisture = Math.max(hex.humidity ?? 0, waterAccess[hexId] ? 0.85 : 0);
      genome.landAdaptation = moisture >= 0.85 ? 1 : moisture >= 0.5 ? 2 : 3;
    }
    let bestEfficiency = -1;
    // Introduction is a deliberate site-matched plant selection. Descendant
    // mutation remains entirely undirected; no living genome is later adjusted.
    for (const temperatureTolerance of [null, 0, -1, 1, -2, 2]) {
      const candidate = { ...genome, temperatureTolerance };
      const efficiency = temperatureFactor(deriveGenome(candidate), hex.temperature);
      if (efficiency > bestEfficiency) {
        bestEfficiency = efficiency;
        genome.temperatureTolerance = temperatureTolerance;
      }
    }
    const derived = deriveGenome(genome);
    if (derived.cells * PHOTOSYNTHESIS_MULTIPLIER * bestEfficiency
      * habitatFactor(genome, hex, habitat, waterAccess[hexId]) <= derived.upkeep) {
      return { ok: false, reason: 'unsuitable-conditions' };
    }
    if (state.introduced) {
      const previous = { runId: state.runId, startDay: state.startDay, endDay: state.day,
        stats: copy(state.stats), species: copy(state.species) };
      state.previousAttempts.push(previous);
      state.attempt += 1;
      state.runId = `${state.baseRunId}:attempt-${state.attempt}`;
      state.seed = `${state.baseSeed}:attempt-${state.attempt}`;
      random = createRandom(state.seed);
      state.randomState = random.exportState();
      state.startDay = state.day;
      state.revision = 0;
      state.genomes = []; state.species = []; state.history = [];
      state.nextGenome = 1; state.nextSpecies = 1; state.nextEstablished = 1;
      state.classifier = { groups: [], timers: {}, nextGroup: 1 };
      state.classification = { groups: 0, qualifyingPairs: 0, longestIsolation: 0 };
      state.stats = initialStats();
      genomes.clear(); genomeIds.clear();
    }
    state.startDay = state.day;
    const genomeId = registerGenome(genome);
    established(genomeId);
    const speciesId = newSpecies();
    state.cohorts = [{ hexId, habitat, genomeId, speciesId, groupId: 'group-1', count: FOUNDER_POPULATION, energy: derived.cells }];
    state.classifier.groups = [{ id: 'group-1', speciesId, foundedDay: state.day }];
    state.classifier.nextGroup = 2;
    state.classification.groups = 1;
    state.introduced = true;
    state.revision += 1;
    updateHistory();
    return { ok: true, runId: state.runId, revision: state.revision };
  }

  function advanceTo(day) {
    validateDay(day);
    if (day < state.day) throw new RangeError('Life cannot advance backwards.');
    if (!state.introduced && day > state.day) {
      state.revision += day - state.day;
      state.day = day; environmentDay = day; climate.clear(); cachedObservation = null;
      return;
    }
    while (state.day < day) {
      environmentDay = state.day + 1;
      climate.clear();
      if (state.cohorts.length) {
        state.cohorts = settle(feed(move(state.cohorts)));
        state.classification = classify(state.cohorts, genomes, geography.hexes,
          state.classifier, environmentDay, newSpecies);
        state.cohorts = merge(state.cohorts);
      } else {
        state.classifier.groups = []; state.classifier.timers = {};
        state.classification = { groups: 0, qualifyingPairs: 0, longestIsolation: 0 };
      }
      state.day = environmentDay;
      state.revision += 1;
      updateHistory();
    }
  }

  function buildObservation() {
    const species = new Map();
    const hexes = new Map();
    const globalVariants = new Set();
    for (const cohort of state.cohorts) {
      const { derived } = genomes.get(cohort.genomeId);
      globalVariants.add(cohort.genomeId);
      if (!species.has(cohort.speciesId)) {
        const identity = state.species.find((record) => record.id === cohort.speciesId);
        species.set(cohort.speciesId, { ...identity, population: 0, locations: new Map(), variants: new Map() });
      }
      const record = species.get(cohort.speciesId);
      record.population += cohort.count;
      record.locations.set(cohort.hexId, (record.locations.get(cohort.hexId) ?? 0) + cohort.count);
      record.variants.set(cohort.genomeId, (record.variants.get(cohort.genomeId) ?? 0) + cohort.count);
      if (!hexes.has(cohort.hexId)) hexes.set(cohort.hexId,
        { hexId: cohort.hexId, population: 0, species: new Map(), display: new Map(), variants: new Set() });
      const hex = hexes.get(cohort.hexId);
      hex.population += cohort.count;
      hex.species.set(cohort.speciesId, (hex.species.get(cohort.speciesId) ?? 0) + cohort.count);
      hex.variants.add(cohort.genomeId);
      const key = `${derived.role}|${derived.size}|${cohort.habitat}`;
      if (!hex.display.has(key)) hex.display.set(key, { role: derived.role, size: derived.size, habitat: cohort.habitat, population: 0 });
      hex.display.get(key).population += cohort.count;
    }
    const speciesRows = [...species.values()].map((record) => ({ ...record,
      locations: [...record.locations].map(([hexId, population]) => ({ hexId, population })).sort((a, b) => a.hexId - b.hexId),
      variants: [...record.variants].map(([id, population]) => {
        const variant = genomes.get(id);
        return { id, population, parentId: variant.parentGenomeId, originDay: variant.originDay,
          role: variant.derived.role, size: variant.derived.size, cells: variant.derived.cells,
          temperatureRange: [...variant.derived.temperatureRange],
          habitats: [...variant.derived.habitats], traits: describeGenome(variant.genome) };
      }).sort((a, b) => b.population - a.population || order(a.id, b.id)),
    })).sort((a, b) => b.population - a.population || order(a.id, b.id));
    const hexRows = [...hexes.values()].map((hex) => ({ ...hex, speciesCount: hex.species.size, variants: hex.variants.size,
      species: [...hex.species].map(([id, population]) => ({ id, population })).sort((a, b) => b.population - a.population || order(a.id, b.id)),
      display: [...hex.display.values()] })).sort((a, b) => a.hexId - b.hexId);
    const organisms = hexRows.reduce((sum, hex) => sum + hex.population, 0);
    return {
      runId: state.runId, worldId: state.worldId, worldIdentity: state.worldIdentity,
      generatorVersion: state.worldIdentity.generatorVersion, modelId: MODEL_ID,
      rulesRevision: RULES_REVISION, contractVersion: CONTRACT_VERSION,
      day: state.day, startDay: state.startDay, revision: state.revision,
      attempt: state.attempt, previousAttempts: state.previousAttempts,
      status: !state.introduced ? 'not-introduced' : organisms ? 'living' : 'extinct',
      counts: { organisms, species: speciesRows.length, occupiedHexes: hexRows.length, variants: globalVariants.size },
      countQuality: 'exact', species: speciesRows, hexes: hexRows,
      extinctSpecies: state.species.filter((record) => record.extinctDay !== null).map((record) =>
        ({ ...record, population: 0, locations: [], variants: [] })),
      stats: { ...state.stats }, classification: { ...state.classification }, history: state.history,
      approximation: { mode: state.settings.energyQuantum ? 'energy-bins' : 'exact-energy',
        energyQuantum: state.settings.energyQuantum, maximumDailyStorageLoss: state.settings.energyQuantum,
        validation: 'experimental-uncalibrated',
        counts: 'integer-cohorts', stochasticEvents: 'binomial-geometric',
        grazing: 'shared-local-pool', predation: 'individual-depletion', cohortCount: state.cohorts.length },
    };
  }

  function observe() {
    if (!cachedObservation) cachedObservation = buildObservation();
    return copy(cachedObservation);
  }

  function inspectHex(hexId) {
    if (!Number.isInteger(hexId) || !geography.hexes[hexId]) throw new RangeError('Unknown hex ID.');
    const snapshot = observe();
    return { runId: state.runId, revision: state.revision, day: state.day,
      ...(snapshot.hexes.find((hex) => hex.hexId === hexId)
        ?? { hexId, population: 0, species: [], speciesCount: 0, variants: 0, display: [] }) };
  }

  function inspectSpecies(id) {
    const snapshot = observe();
    const record = [...snapshot.species, ...snapshot.extinctSpecies].find((species) => species.id === id);
    if (!record) throw new RangeError('Unknown species ID.');
    return { runId: state.runId, revision: state.revision, day: state.day, ...record };
  }

  function exportState() {
    return copy({ ...state, randomState: random.exportState() });
  }

  return { introduce, advanceTo, observe, inspectHex, inspectSpecies, exportState };
}
