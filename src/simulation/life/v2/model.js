import { climateAt } from '../../climate.js';
import { hashSeed } from '../../noise.js';
import { classify, acquisitionSignature } from './classification.js';
import { describeGenome, deriveGenome, founderGenome, genomeKey, mutateGenome, validateGenome, recombineGenome, mutationProbability } from './genes/genome.js';
import { canCross, chooseHabitat, crossingDifficulty, directWaterAccess, habitatFactor,
  hasLand, hasWater, temperatureFactor } from './habitat.js';
import { dispersalRoutes } from './dispersal.js';
import { grazingAccess, captureProbability, preyEligible, establishmentProbability, competitionFitness } from './ecology.js';
import { allocateGrazing } from './feeding.js';
import { allocateLight } from './light.js';
import { binomial, createRandom, uniformPartitions } from './random.js';
import { speciesName } from './names.js';

export const MODEL_ID = 'v2';
export const RULES_REVISION = 'v2-cohorts-1';
export const CONTRACT_VERSION = 'life-observations-1';
const FORMAT = 'emergence-life-v2-checkpoint-1';
// Three complete biological turns per ten physical days, independent of playback.
const TURN_CREDIT = 3;
const CREDIT_PER_TURN = 10;
const PHOTOSYNTHESIS_MULTIPLIER = 2.4;
const BACKGROUND_MORTALITY = 0.006;
const copy = (value) => JSON.parse(JSON.stringify(value));
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function worldIdentity(world) {
  const identity = { generatorVersion: world.version ?? 'fixture', seed: world.seed ?? '',
    size: world.size ?? 'custom', width: world.width, height: world.height,
    geography: world.geography ?? null, landFraction: world.landFraction ?? null,
    waterAbundance: world.waterAbundance ?? null, candidate: world.candidate ?? null, climateVariability: world.climateVariability ?? null };
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
  reproductionAttempts: 0, movements: 0, predationDeaths: 0, speciations: 0, sexualBirths: 0, barrierDepartures: 0, barrierArrivals: 0 });

/** Create one headless life run against a read-only physical world.
 * energyQuantum:0 retains exact floating-point stored-energy cohorts for comparison.
 * runId is an optional caller-owned opaque identity (e.g. a world-session token). */
export function createLifeModel(world, { seed = `${world.seed}:life-v2`,
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
    day: world.day, revision: 0, introduced: false, biologicalTurns: 0, turnCredit: 0,
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
  if (!Number.isSafeInteger(state.biologicalTurns) || state.biologicalTurns < 0
    || !Number.isInteger(state.turnCredit) || state.turnCredit < 0 || state.turnCredit >= CREDIT_PER_TURN) {
    throw new TypeError('Invalid checkpoint biological clock.');
  }
  if (!Number.isFinite(state.settings.energyQuantum) || state.settings.energyQuantum < 0
    || state.settings.energyQuantum > 1 / 64) {
    throw new TypeError('Invalid checkpoint settings.');
  }
  const genomeIds = new Set(state.genomes.map((record) => record.id));
  const speciesIds = new Set(state.species.map((record) => record.id));
  if (state.genomes.some((record) => !validateGenome(record.genome))
    || state.cohorts.some((cohort) => !Number.isSafeInteger(cohort.count) || cohort.count < 1
      || !world.hexes[cohort.hexId] || !genomeIds.has(cohort.genomeId) || !speciesIds.has(cohort.speciesId)
      || !Number.isFinite(cohort.energy) || cohort.energy < 0 || !['land', 'water'].includes(cohort.habitat)
      || cohort.transit && (!world.hexes[cohort.transit.hexId] || !['land', 'water'].includes(cohort.transit.habitat)
        || !Number.isSafeInteger(cohort.transit.dueTurn) || cohort.transit.dueTurn < 0
        || !Number.isFinite(cohort.transit.probability) || cohort.transit.probability < 0 || cohort.transit.probability > 1))) {
    throw new TypeError('Invalid checkpoint population.');
  }
  return buildModel(world, state);
}

function buildModel(world, state) {
  // Older checkpoints acquire cosmetic names without changing their random state.
  for (const [index, record] of state.species.entries()) {
    record.name ??= speciesName(state.seed, index + 1);
  }
  // Geography is copied once; subsequent atlas setDay/inspection cannot mutate this run.
  const geography = { width: world.width, height: world.height, climateVariability: copy(world.climateVariability ?? null),
    hexes: world.hexes.map((hex) => ({ ...hex, neighbors: [...hex.neighbors] })) };
  let random = createRandom(state.seed, state.randomState);
  const genomes = new Map(state.genomes.map((record) => [record.id, { ...record, derived: deriveGenome(record.genome) }]));
  const genomeIds = new Map(state.genomes.map((record) => [genomeKey(record.genome), record.id]));
  const waterAccess = geography.hexes.map((hex) => directWaterAccess(hex, geography.hexes));
  const climate = new Map();
  const resources = new Map();
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
    const ordinal = state.nextSpecies++;
    const id = `species-${ordinal}`;
    state.species.push({ id, name: speciesName(state.seed, ordinal), parentId, originDay: environmentDay, extinctDay: null });
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
      const key = `${cohort.hexId}|${cohort.habitat}|${cohort.speciesId}|${cohort.genomeId}|${cohort.groupId}|${energy}|${JSON.stringify(cohort.transit ?? null)}`;
      if (merged.has(key)) merged.get(key).count += cohort.count;
      else merged.set(key, { hexId: cohort.hexId, habitat: cohort.habitat, speciesId: cohort.speciesId,
        genomeId: cohort.genomeId, groupId: cohort.groupId, count: cohort.count, energy,
        ...(cohort.transit ? { transit: { ...cohort.transit } } : {}) });
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
      if (!genome.movement || cohort.transit) { result.push(cohort); continue; }
      const source = environment(cohort.hexId);
      const choices = dispersalRoutes(genome, source, cohort.habitat, geography.hexes);
      if (hasLand(source) && hasWater(source)) choices.push({ hexId: source.id,
        habitat: cohort.habitat === 'water' ? 'land' : 'water' });
      if (!choices.length) { result.push(cohort); continue; }
      const attempts = binomial(cohort.count, Math.min(0.3, 0.06 + 0.035 * derived.speed) * performance(cohort.genomeId, cohort.hexId, cohort.habitat), random.next);
      let unchanged = cohort.count - attempts;
      const counts = uniformPartitions(attempts, choices.length, random.next);
      choices.forEach((choice, index) => {
        const count = counts[index];
        if (!count) return;
        const route = choice.delay ? choice : crossing(cohort, choice.hexId, choice.habitat);
        const cost = route ? 0.1 * derived.cells * (1 + 4 * route.difficulty) : Infinity;
        if (!route || cost > cohort.energy) { unchanged += count; return; }
        if (route.delay) {
          result.push({ ...cohort, count, energy: cohort.energy - cost, transit: { hexId: choice.hexId,
            habitat: route.habitat, dueTurn: state.biologicalTurns + route.delay, probability: route.probability } });
          state.stats.barrierDepartures += count;
          return;
        }
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
      cohort.pressure = 0;
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
      const absorbed = allocations.reduce((sum, value, index) => sum + value * local[index].count, 0);
      const producers = local.filter(cohort => genomes.get(cohort.genomeId).derived.photosynthesisShare > 0);
      for (const habitat of ['land', 'water']) {
        const residents = producers.filter(cohort => cohort.habitat === habitat);
        const population = residents.reduce((sum, cohort) => sum + cohort.count, 0);
        resources.set(`${local[0].hexId}:${habitat}`, { occupancy: absorbed / 2000, habitat,
          competition: population ? residents.reduce((sum, cohort) => sum
            + competitionFitness(genomes.get(cohort.genomeId).derived, habitat) * cohort.count, 0) / population : 0 });
      }
      local.forEach((cohort, index) => {
        cohort.production = allocations[index] * PHOTOSYNTHESIS_MULTIPLIER
          * performance(cohort.genomeId, cohort.hexId, cohort.habitat);
        cohort.acquired = cohort.production;
        const { derived } = genomes.get(cohort.genomeId);
        cohort.pressure = Math.max(0, 1 - performance(cohort.genomeId, cohort.hexId, cohort.habitat),
          derived.photosynthesisShare ? 1 - allocations[index] / (derived.cells * derived.photosynthesisShare) : 0);
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
    const producers = occupants.filter(cohort => cohort.production > 0);
    producers.forEach((cohort, index) => { cohort.producerIndex = index; });
    if (!producers.length) return occupants;
    const saturation = resources.get(`${occupants[0].hexId}:${occupants[0].habitat}`)?.occupancy ?? 0;
    // Each plant's finite accessible production is shared across every grazer.
    // At crowded, light-saturated sites only a small fraction is edible; scarce
    // uncrowded plants expose more of their growth, strengthening selection.
    const production = producers.map(cohort => cohort.production * cohort.count);
    const consumers = [];
    const result = [];
    for (const cohort of occupants) {
      const { genome, derived } = genomes.get(cohort.genomeId);
      if (!derived.grazingShare) { result.push(cohort); continue; }
      const access = producers.map(plant => grazingAccess(genome, genomes.get(plant.genomeId).genome, saturation));
      const density = producers.reduce((sum, plant, index) => sum + Math.max(0, plant.count - (plant === cohort ? 1 : 0)) * access[index], 0);
      const encounters = binomial(cohort.count, density ** 2 / (density ** 2 + (12 / derived.sensoryReach) ** 2), random.next);
      if (encounters) {
        const consumer = { ...cohort, count: encounters };
        consumers.push({ cohort: consumer, access, demand: encounters * 5 * derived.cells * derived.grazingShare });
        result.push(consumer);
      }
      if (encounters < cohort.count) result.push({ ...cohort, count: cohort.count - encounters });
    }
    const { consumed, gained } = allocateGrazing(production, consumers);
    for (const cohort of result) {
      const index = cohort.producerIndex;
      if (index !== undefined) {
        const loss = consumed[index] / producers[index].count;
        cohort.acquired -= loss;
        cohort.pressure = Math.max(cohort.pressure, cohort.production ? loss / cohort.production : 0);
      }
    }
    consumers.forEach(({ cohort }, index) => {
      const derived = genomes.get(cohort.genomeId).derived;
      cohort.acquired += gained[index] / cohort.count * derived.grazingEfficiency
        * performance(cohort.genomeId, cohort.hexId, cohort.habitat);
    });
    return result;
  }

  function hunt(occupants) {
    const hunters = occupants.filter(cohort => genomes.get(cohort.genomeId).genome.animalFeeding);
    if (!hunters.length) return;
    // Traits do not change during feeding. Build ordered prey references and
    // immutable pair rules once per hunter genotype, retaining live counts on
    // those references as individual encounters deplete the populations.
    const preyPools = new Map();
    for (const hunter of hunters) {
      if (preyPools.has(hunter.genomeId)) continue;
      const genome = genomes.get(hunter.genomeId).genome;
      const rules = new Map();
      const cohorts = [];
      for (const cohort of occupants) {
        if (!rules.has(cohort.genomeId)) {
          const preyGenome = genomes.get(cohort.genomeId).genome;
          const eligible = preyEligible(genome, preyGenome);
          rules.set(cohort.genomeId, { eligible,
            capture: eligible ? captureProbability(genome, preyGenome) : 0 });
        }
        if (rules.get(cohort.genomeId).eligible) cohorts.push(cohort);
      }
      preyPools.set(hunter.genomeId, { cohorts, rules });
    }
    let pending = 0;
    for (const cohort of hunters) { cohort.hunts = cohort.count; pending += cohort.hunts; }
    const fedStates = new Map();
    while (pending > 0) {
      let choice = Math.floor(random.next() * pending);
      const actor = hunters.find(cohort => { choice -= cohort.hunts; return choice < 0; });
      actor.hunts -= 1; pending -= 1;
      const { derived } = genomes.get(actor.genomeId);
      const { cohorts: prey, rules } = preyPools.get(actor.genomeId);
      const density = prey.reduce((sum, cohort) => cohort.count > 0
        ? sum + cohort.count - (cohort === actor ? 1 : 0) : sum, 0);
      const reach = derived.sensoryReach;
      if (!density || random.next() >= density ** 2 / (density ** 2 + (12 / reach) ** 2)) continue;
      let target = Math.floor(random.next() * density);
      const victim = prey.find(cohort => {
        if (cohort.count <= 0) return false;
        target -= cohort.count - (cohort === actor ? 1 : 0);
        return target < 0;
      });
      const preyGenome = genomes.get(victim.genomeId);
      victim.pressure = Math.max(victim.pressure, 0.8);
      const capture = rules.get(victim.genomeId).capture;
      if (random.next() >= capture) { actor.pressure = Math.max(actor.pressure, 0.6); continue; }
      if (victim.hunts && random.next() < victim.hunts / (victim.count - (victim === actor ? 1 : 0))) { victim.hunts -= 1; pending -= 1; }
      victim.count -= 1;
      const gained = derived.predationEfficiency * Math.min(5 * derived.cells * derived.predationShare,
        preyGenome.derived.cells + victim.energy) * performance(actor.genomeId, actor.hexId, actor.habitat);
      if (gained > 0) {
        actor.count -= 1;
        const acquired = actor.acquired + gained;
        const key = `${actor.speciesId}|${actor.genomeId}|${actor.groupId}|${actor.energy}|${acquired}|${JSON.stringify(actor.transit ?? null)}`;
        if (fedStates.has(key)) fedStates.get(key).count += 1;
        else {
          const predator = { ...actor, count: 1, hunts: 0, acquired };
          fedStates.set(key, predator); occupants.push(predator);
          for (const pool of preyPools.values()) {
            if (pool.rules.get(predator.genomeId).eligible) pool.cohorts.push(predator);
          }
        }
      }
      state.stats.deaths += 1; state.stats.predationDeaths += 1;
    }
  }

  function completePassages(cohorts) {
    const result = [];
    for (const cohort of cohorts) {
      if (!cohort.transit || cohort.transit.dueTurn > state.biologicalTurns) { result.push(cohort); continue; }
      const { transit, ...resident } = cohort;
      const viable = performance(cohort.genomeId, transit.hexId, transit.habitat) > 0;
      const arrivals = viable ? binomial(cohort.count, transit.probability, random.next) : 0;
      if (arrivals) result.push({ ...resident, count: arrivals, hexId: transit.hexId, habitat: transit.habitat,
        energy: Math.max(0, cohort.energy - 0.3 * genomes.get(cohort.genomeId).derived.cells) });
      // Unsuccessful survivors remain at their source; no hidden mortality or teleport.
      if (arrivals < cohort.count) result.push({ ...resident, count: cohort.count - arrivals });
      state.stats.movements += arrivals; state.stats.barrierArrivals += arrivals;
    }
    return merge(result);
  }

  function establish(parent, genomeId, count, newborns, sexual = false) {
    if (!count) return;
    const { genome, derived } = genomes.get(genomeId);
    const { transit: ignored, ...parentTemplate } = parent;
    const template = { ...parentTemplate, genomeId, energy: 0 };
    const routes = dispersalRoutes(genome, geography.hexes[parent.hexId], parent.habitat, geography.hexes);
    const dispersers = routes.length ? binomial(count, 0.045, random.next) : 0;
    const counts = [count - dispersers, ...uniformPartitions(dispersers, routes.length, random.next)];
    const localHabitat = chooseHabitat(genome, environment(parent.hexId), parent.habitat, environment(parent.hexId));
    const choices = [{ hexId: parent.hexId, habitat: localHabitat, delay: 0, probability: 1 }, ...routes];
    choices.forEach((route, index) => {
      const attempts = counts[index];
      if (!attempts) return;
      const targetId = route.delay ? parent.hexId : route.hexId;
      const habitat = route.delay ? localHabitat : route.habitat;
      const resource = resources.get(`${targetId}:${habitat}`) ?? { occupancy: 0, competition: 0, habitat };
      const competition = derived.photosynthesisShare ? establishmentProbability(derived, resource) : 1;
      const viability = 0.82 + (sexual ? 0.14 * Math.max(0, Math.min(1, parent.pressure ?? 0)) : 0);
      const probability = habitat && performance(genomeId, targetId, habitat) > 0
        ? Math.min(1, competition * viability * (route.delay ? 1 : route.probability)) : 0;
      const successes = binomial(attempts, probability, random.next);
      state.stats.failedEstablishments += attempts - successes;
      state.stats.births += successes;
      if (sexual) state.stats.sexualBirths += successes;
      if (successes) {
        established(genomeId);
        newborns.push({ ...template, count: successes, hexId: targetId, habitat,
          ...(route.delay ? { transit: { hexId: route.hexId, habitat: route.habitat,
            dueTurn: state.biologicalTurns + route.delay, probability: route.probability } } : {}) });
        if (route.delay) state.stats.barrierDepartures += successes;
      }
    });
  }

  function settle(cohorts) {
    const adults = [];
    const newborns = [];
    const survivors = [];
    // Complete everyone's mortality before offering living parents as mates.
    for (const cohort of cohorts) {
      const { derived } = genomes.get(cohort.genomeId);
      const available = Math.max(0, cohort.energy + cohort.acquired);
      const starvation = Math.max(0, 1 - available / derived.upkeep);
      const deaths = binomial(cohort.count, 1 - (1 - starvation) * (1 - BACKGROUND_MORTALITY), random.next);
      state.stats.deaths += deaths;
      if (cohort.count > deaths) survivors.push({ ...cohort, count: cohort.count - deaths,
        energy: Math.max(0, available - derived.upkeep), pressure: Math.max(cohort.pressure, starvation) });
    }
    const mates = new Map();
    for (const cohort of survivors) {
      if (!genomes.get(cohort.genomeId).genome.sexualReproduction || cohort.transit) continue;
      const key = `${cohort.hexId}|${cohort.habitat}|${cohort.speciesId}|${acquisitionSignature(genomes.get(cohort.genomeId).genome)}`;
      if (!mates.has(key)) mates.set(key, []);
      mates.get(key).push(cohort);
    }
    for (const cohort of survivors) {
      const { genome, derived } = genomes.get(cohort.genomeId);
      const count = cohort.count;
      let remainder = cohort.energy;
      const parent = cohort;
      if (!cohort.transit && remainder >= derived.reproductionCost) {
        remainder -= derived.reproductionCost;
        state.stats.reproductionAttempts += count;
        const pressure = cohort.pressure;
        const matePool = genome.sexualReproduction ? (mates.get(`${cohort.hexId}|${cohort.habitat}|${cohort.speciesId}|${acquisitionSignature(genomes.get(cohort.genomeId).genome)}`) ?? []) : [];
        const mateCount = matePool.reduce((sum, mate) => sum + mate.count - (mate === cohort ? 1 : 0), 0);
        const sexualCount = mateCount > 0 ? binomial(count, mateCount / (mateCount + 2), random.next) : 0;
        const invest = (genomeId, offspringCount, sexual) => {
          if (!offspringCount) return;
          const extra = Math.max(0, genomes.get(genomeId).derived.reproductionCost - derived.reproductionCost);
          if (extra > remainder) {
            // The base investment is lost if this parent cannot finish the larger
            // or more elaborate child. No expensive body appears for free.
            state.stats.failedEstablishments += offspringCount;
            adults.push({ ...parent, count: offspringCount, energy: remainder });
          } else {
            adults.push({ ...parent, count: offspringCount, energy: remainder - extra });
            establish(parent, genomeId, offspringCount, newborns, sexual);
          }
        };
        const produce = (offspringGenome, offspringCount, sexual) => {
          if (!offspringCount) return;
          const offspringId = registerGenome(offspringGenome, cohort.genomeId);
          const mutants = binomial(offspringCount, mutationProbability(pressure), random.next);
          state.stats.mutations += mutants;
          invest(offspringId, offspringCount - mutants, sexual);
          for (let index = 0; index < mutants; index += 1) {
            invest(registerGenome(mutateGenome(offspringGenome, random.next), offspringId), 1, sexual);
          }
        };
        produce(genome, count - sexualCount, false);
        const combinations = new Map();
        for (let index = 0; index < sexualCount; index += 1) {
          let selection = Math.floor(random.next() * mateCount);
          const mate = matePool.find(item => { selection -= item.count - (item === cohort ? 1 : 0); return selection < 0; });
          const offspring = recombineGenome(genome, genomes.get(mate.genomeId).genome, random.next);
          const key = genomeKey(offspring);
          if (combinations.has(key)) combinations.get(key).count += 1;
          else combinations.set(key, { genome: offspring, count: 1 });
        }
        for (const combination of combinations.values()) produce(combination.genome, combination.count, true);
        continue;
      }
      adults.push({ ...parent, energy: remainder });
    }
    // Newborns never act on the turn in which they were established.
    return merge([...adults, ...newborns], true);
  }

  function updateHistory() {
    const population = state.cohorts.reduce((sum, cohort) => sum + cohort.count, 0);
    const livingSpecies = new Set(state.cohorts.map((cohort) => cohort.speciesId));
    for (const record of state.species) if (!livingSpecies.has(record.id) && record.extinctDay === null) record.extinctDay = state.day;
    if (state.introduced) {
      state.history.push({ day: state.day, population, species: livingSpecies.size,
        extinctSpecies: state.species.filter(record => record.extinctDay !== null).length,
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
    const genome = founderGenome();
    const habitat = hasWater(hex) ? 'water' : 'land';
    if (habitat === 'land') {
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
    // Introduction is allowed on every physical hex. Existing habitat and energy
    // rules determine survival during subsequent turns, even on ice or high land.
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
    state.biologicalTurns = 0;
    state.turnCredit = 0;
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
      state.turnCredit += TURN_CREDIT;
      const takeTurn = state.turnCredit >= CREDIT_PER_TURN;
      if (takeTurn) {
        state.turnCredit -= CREDIT_PER_TURN;
        state.biologicalTurns += 1;
      }
      if (takeTurn && state.cohorts.length) {
        resources.clear();
        state.cohorts = settle(feed(move(completePassages(state.cohorts))));
        state.classification = classify(state.cohorts, genomes, geography.hexes,
          state.classifier, environmentDay, newSpecies);
        state.cohorts = merge(state.cohorts);
      } else if (takeTurn) {
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
      const { derived, genome } = genomes.get(cohort.genomeId);
      globalVariants.add(cohort.genomeId);
      if (!species.has(cohort.speciesId)) {
        const identity = state.species.find((record) => record.id === cohort.speciesId);
        species.set(cohort.speciesId, { ...identity, population: 0, locations: new Map(), variants: new Map() });
      }
      const record = species.get(cohort.speciesId);
      record.population += cohort.count;
      record.locations.set(cohort.hexId, (record.locations.get(cohort.hexId) ?? 0) + cohort.count);
      if (!record.variants.has(cohort.genomeId)) record.variants.set(cohort.genomeId, { population: 0, locations: new Map() });
      const variant = record.variants.get(cohort.genomeId);
      variant.population += cohort.count;
      variant.locations.set(cohort.hexId, (variant.locations.get(cohort.hexId) ?? 0) + cohort.count);
      if (!hexes.has(cohort.hexId)) hexes.set(cohort.hexId,
        { hexId: cohort.hexId, population: 0, species: new Map(), display: new Map(), variants: new Set() });
      const hex = hexes.get(cohort.hexId);
      hex.population += cohort.count;
      hex.species.set(cohort.speciesId, (hex.species.get(cohort.speciesId) ?? 0) + cohort.count);
      hex.variants.add(cohort.genomeId);
      const mobile = genome.movement > 0;
      const key = `${derived.role}|${derived.size}|${cohort.habitat}|${mobile}`;
      if (!hex.display.has(key)) hex.display.set(key, { role: derived.role, size: derived.size, mobile, habitat: cohort.habitat, population: 0 });
      hex.display.get(key).population += cohort.count;
    }
    const speciesRows = [...species.values()].map((record) => ({ ...record,
      locations: [...record.locations].map(([hexId, population]) => ({ hexId, population })).sort((a, b) => a.hexId - b.hexId),
      variants: [...record.variants].map(([id, { population, locations }]) => {
        const variant = genomes.get(id);
        return { id, population, parentId: variant.parentGenomeId, originDay: variant.originDay,
          role: variant.derived.role, size: variant.derived.size, cells: variant.derived.cells,
          temperatureRange: [...variant.derived.temperatureRange],
          habitats: [...variant.derived.habitats], traits: describeGenome(variant.genome),
          locations: [...locations].map(([hexId, count]) => ({ hexId, population: count })).sort((a, b) => a.hexId - b.hexId) };
      }).sort((a, b) => b.population - a.population || order(a.id, b.id)),
    })).sort((a, b) => b.population - a.population || order(a.id, b.id));
    for (const record of speciesRows) {
      const traits = new Map();
      for (const variant of record.variants) {
        for (const trait of variant.traits.filter(trait => trait.active)) {
          if (!traits.has(trait.key)) traits.set(trait.key, { key: trait.key, population: 0, expressions: [] });
          const summary = traits.get(trait.key);
          summary.population += variant.population;
          let expression = summary.expressions.find(item => item.value === trait.value);
          if (!expression) {
            expression = { ...trait, population: 0, cells: variant.cells, temperatureRange: variant.temperatureRange, locations: new Map() };
            summary.expressions.push(expression);
          }
          expression.population += variant.population;
          for (const { hexId, population } of variant.locations) {
            expression.locations.set(hexId, (expression.locations.get(hexId) ?? 0) + population);
          }
        }
      }
      record.traits = [...traits.values()];
      for (const trait of record.traits) for (const expression of trait.expressions) {
        expression.locations = [...expression.locations].map(([hexId, population]) => ({ hexId, population })).sort((a, b) => a.hexId - b.hexId);
      }
    }
    const hexRows = [...hexes.values()].map((hex) => ({ ...hex, speciesCount: hex.species.size, variants: hex.variants.size,
      species: [...hex.species].map(([id, population]) => ({ id, population })).sort((a, b) => b.population - a.population || order(a.id, b.id)),
      display: [...hex.display.values()] })).sort((a, b) => a.hexId - b.hexId);
    const organisms = hexRows.reduce((sum, hex) => sum + hex.population, 0);
    return {
      runId: state.runId, worldId: state.worldId, worldIdentity: state.worldIdentity,
      generatorVersion: state.worldIdentity.generatorVersion, modelId: MODEL_ID,
      rulesRevision: RULES_REVISION, contractVersion: CONTRACT_VERSION,
      day: state.day, startDay: state.startDay, revision: state.revision, biologicalTurns: state.biologicalTurns,
      attempt: state.attempt, previousAttempts: state.previousAttempts,
      status: !state.introduced ? 'not-introduced' : organisms ? 'living' : 'extinct',
      counts: { organisms, species: speciesRows.length,
        extinctSpecies: state.species.filter(record => record.extinctDay !== null).length,
        occupiedHexes: hexRows.length, variants: globalVariants.size },
      countQuality: 'exact', species: speciesRows, hexes: hexRows,
      extinctSpecies: state.species.filter((record) => record.extinctDay !== null).map((record) =>
        ({ ...record, population: 0, locations: [], variants: [] })),
      stats: { ...state.stats }, classification: { ...state.classification }, history: state.history,
      approximation: { mode: state.settings.energyQuantum ? 'energy-bins' : 'exact-energy',
        energyQuantum: state.settings.energyQuantum, maximumDailyStorageLoss: state.settings.energyQuantum,
        validation: 'experimental-uncalibrated',
        counts: 'integer-cohorts', stochasticEvents: 'binomial-geometric',
        grazing: 'trait-weighted-accessible-pools', predation: 'individual-depletion', cohortCount: state.cohorts.length },
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
