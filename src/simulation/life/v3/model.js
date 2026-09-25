import { climateAt } from '../../climate.js';
import { hashSeed } from '../../noise.js';
import { candidateMutations, deriveGenome, describeGenome, geneticDistance,
  genomeKey, validateGenome } from './genes/genome.js';
import { allocateLight, environmentalPerformance, evaluateCommunity, founderForSite, scoreSpecies, supportsHabitat, waterDepth } from './ecology.js';
import { createRandom, roundedExpectation } from './random.js';
import { speciesName } from './names.js';
import { recordGenome, validateLineage, observeTree, inspectGeneHistory } from './lineage.js';
import { detachObservationJobs } from './observation-jobs.js';
import { traceCalls } from './diagnostics.js';

export const MODEL_ID = 'v3';
export const RULES_REVISION = 'v3-populations-5';
export const CONTRACT_VERSION = 'life-observations-1';
const FORMAT = 'emergence-life-v3-checkpoint-1';
export const EVOLUTION_RULES = Object.freeze({ maximumCandidates: 3, assessmentTurns: 12,
  sampleLocations: 12, trialMutations: 8, minimumAdvantage: 0.005,
  preliminaryAdvantage: 0.001, persistenceAssessments: 4, minimumPopulation: 20,
  broadSupport: 0.8, minimumProfileDifference: 0.03, minimumDietDifference: 0.35 });
const copy = value => JSON.parse(JSON.stringify(value));
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const populationOrder = (a, b) => a.hexId - b.hexId || order(a.habitat, b.habitat) || order(a.speciesId, b.speciesId);
const populationKey = row => `${row.hexId}|${row.habitat}|${row.speciesId}`;
const habitatKey = row => `${row.hexId}|${row.habitat}`;
const hasWater = hex => hex.waterType !== 'none' || hex.runoff > 0;
const hasLand = hex => hex.waterType === 'none';
const rolesDiffer = (a, b) => a.photosynthesis !== b.photosynthesis
  || a.plantFeeding !== b.plantFeeding || a.animalFeeding !== b.animalFeeding;
const initialStats = () => ({ births: 0, deaths: 0, reproductionAttempts: 0, failedEstablishments: 0,
  movements: 0, predationDeaths: 0, mutations: 0, speciations: 0, adaptations: 0,
  candidateEvaluations: 0, barrierDepartures: 0, barrierArrivals: 0, sexualBirths: 0 });

function validateDay(day) {
  if (!Number.isSafeInteger(day) || day < 0) throw new RangeError('Day must be a non-negative safe integer.');
}

function worldIdentity(world) {
  const identity = { generatorVersion: world.version ?? 'fixture', seed: world.seed ?? '',
    size: world.size ?? 'custom', width: world.width, height: world.height,
    geography: world.geography ?? null, landFraction: world.landFraction ?? null,
    waterAbundance: world.waterAbundance ?? null, candidate: world.candidate ?? null,
    climateVariability: world.climateVariability ?? null };
  identity.terrainFingerprint = hashSeed(JSON.stringify(world.hexes.map(hex => [hex.id,
    hex.row, hex.col, hex.bedElevation, hex.waterType, hex.waterLevel, hex.runoff,
    hex.downstream, hex.distanceToWater, hex.permanentIce, hex.neighbors]))).toString(16);
  return { ...identity, id: `world-${hashSeed(JSON.stringify(identity)).toString(16)}` };
}

/** Sparse population model. A species has one expressed genome; candidates are
 * hypotheses about adaptation, never additional organisms or carrier cohorts. */
export function createLifeModel(world, { seed = `${world.seed}:life-v3`, runId } = {}, diagnostics = {}) {
  validateDay(world.day);
  if (typeof seed !== 'string' && (typeof seed !== 'number' || !Number.isFinite(seed))) throw new TypeError('Invalid life seed.');
  const identity = worldIdentity(world);
  const id = runId === undefined ? `${identity.id}:${hashSeed(seed).toString(16)}:${world.day}` : String(runId);
  return buildModel(world, { format: FORMAT, modelId: MODEL_ID, rulesRevision: RULES_REVISION,
    worldIdentity: identity, worldId: identity.id, runId: id, baseRunId: id,
    seed: String(seed), baseSeed: String(seed), attempt: 1, previousAttempts: [],
    day: world.day, startDay: world.day, revision: 0, introduced: false,
    biologicalTurns: 0, turnCredit: 0, species: [], populations: [],
    nextSpecies: 1, nextCandidate: 1, stats: initialStats(), history: [],
    randomState: createRandom(seed).exportState() }, diagnostics);
}

export function restoreLifeModel(world, checkpoint, diagnostics = {}) {
  if (!checkpoint || checkpoint.format !== FORMAT || checkpoint.modelId !== MODEL_ID
    || checkpoint.rulesRevision !== RULES_REVISION || checkpoint.worldId !== worldIdentity(world).id) {
    throw new TypeError('Incompatible life checkpoint.');
  }
  const state = copy(checkpoint);
  validateDay(state.day);
  const count = value => Number.isSafeInteger(value) && value >= 0;
  const text = value => typeof value === 'string';
  const statsValid = stats => stats && Object.keys(initialStats()).every(key => count(stats[key]));
  if (!['runId', 'baseRunId', 'seed', 'baseSeed'].every(key => text(state[key]))
    || typeof state.introduced !== 'boolean' || !count(state.revision)
    || !count(state.startDay) || state.startDay > state.day
    || !count(state.attempt) || state.attempt < 1
    || !count(state.nextSpecies) || state.nextSpecies < 1
    || !count(state.nextCandidate) || state.nextCandidate < 1
    || !statsValid(state.stats) || !Array.isArray(state.randomState)
    || JSON.stringify(state.worldIdentity) !== JSON.stringify(worldIdentity(world))
    || !Array.isArray(state.history) || state.history.length > 180
    || state.history.some((row, index) => !row || !['day', 'population', 'species', 'extinctSpecies', 'variants', 'occupiedHexes'].every(key => count(row[key]))
      || row.speciesByEnergy !== undefined && (!row.speciesByEnergy
        || !['photosynthesis', 'plantFeeding', 'animalFeeding', 'other'].every(key => count(row.speciesByEnergy[key]))
        || Object.values(row.speciesByEnergy).reduce((sum, value) => sum + value, 0) !== row.species)
      || row.day > state.day || index > 0 && row.day <= state.history[index - 1].day)
    || !Array.isArray(state.previousAttempts)
    || state.previousAttempts.some(attempt => !attempt || !text(attempt.runId)
      || !count(attempt.startDay) || !count(attempt.endDay) || attempt.startDay > attempt.endDay
      || !statsValid(attempt.stats) || !Array.isArray(attempt.species))) {
    throw new TypeError('Invalid checkpoint metadata.');
  }
  if (!Number.isSafeInteger(state.biologicalTurns) || state.biologicalTurns < 0
    || !Number.isInteger(state.turnCredit) || state.turnCredit < 0 || state.turnCredit >= 10
    || !Array.isArray(state.species) || !Array.isArray(state.populations)) throw new TypeError('Invalid checkpoint state.');
  const ids = new Set();
  for (const record of state.species) {
    if (!text(record.id) || !record.id || ids.has(record.id) || !text(record.name)
      || !(record.parentId === null || text(record.parentId))
      || !count(record.originDay) || record.originDay > state.day
      || !(record.extinctDay === null || count(record.extinctDay) && record.extinctDay <= state.day)
      || !count(record.genomeRevision) || record.genomeRevision < 1 || !validateGenome(record.genome)
      || !Array.isArray(record.candidates) || record.candidates.length > EVOLUTION_RULES.maximumCandidates
      || record.candidates.some(candidate => !text(candidate.id) || !candidate.id || !validateGenome(candidate.genome)
        || !count(candidate.originDay) || candidate.originDay > state.day
        || !count(candidate.lastEvaluation) || candidate.lastEvaluation > state.day
        || !Number.isFinite(candidate.support) || candidate.support < 0 || candidate.support > 1
        || !Number.isFinite(candidate.advantage)
        || !Number.isSafeInteger(candidate.age) || candidate.age < 0
        || !Number.isSafeInteger(candidate.steps) || candidate.steps < 1)) throw new TypeError('Invalid checkpoint species or candidates.');
    ids.add(record.id);
  }
  const pools = new Set();
  validateLineage(state.species, state.day);
  for (const attempt of state.previousAttempts) validateLineage(attempt.species, attempt.endDay);
  for (const row of state.populations) {
    const key = populationKey(row);
    if (!ids.has(row.speciesId) || !count(row.hexId) || !world.hexes[row.hexId]
      || !Number.isSafeInteger(row.count) || row.count < 1
      || !['land', 'water'].includes(row.habitat) || pools.has(key)
      || !Number.isFinite(row.reserve) || row.reserve < 0) throw new TypeError('Invalid checkpoint population.');
    pools.add(key);
  }
  createRandom(state.seed, state.randomState);
  return buildModel(world, state, diagnostics);
}

function buildModel(world, state, diagnostics) {
  const ecologyDiagnostics = Object.keys(diagnostics).some(key => key.startsWith('ecology.')) ? diagnostics : undefined;
  const readClimate = traceCalls(climateAt, diagnostics['life.climate']);
  const describeUncached = traceCalls(describeGenome, diagnostics['genes.describe']);
  const descriptions = new WeakMap();
  const describe = genome => {
    if (!descriptions.has(genome)) descriptions.set(genome, describeUncached(genome));
    return descriptions.get(genome);
  };
  const derive = traceCalls(deriveGenome, diagnostics['genes.derive']);
  const cloneObservation = traceCalls(copy, diagnostics['observation.copy']);
  const geography = { width: world.width, height: world.height,
    climateVariability: copy(world.climateVariability ?? null),
    hexes: world.hexes.map(hex => ({ ...hex, neighbors: [...hex.neighbors] })) };
  const speciesById = new Map(state.species.map(record => [record.id, record]));
  let random = createRandom(state.seed, state.randomState);
  let environmentDay = state.day;
  let cachedObservation = null;
  let cachedCompact = null;
  const climates = new Map();
  const phenotypes = new WeakMap();
  const geneticKeys = new WeakMap();
  const scoreCaches = new WeakMap();
  const phenotype = genome => {
    if (!phenotypes.has(genome)) phenotypes.set(genome, derive(genome));
    return phenotypes.get(genome);
  };

  // Population arrays are replaced after demographic/dispersal/branching work.
  // Keep references and iteration order; live count/reserve edits remain visible.
  let indexedPopulations = null;
  let populationIndex;
  function rowsForSpecies(id) {
    if (indexedPopulations !== state.populations) {
      populationIndex = new Map();
      for (const row of state.populations) {
        if (!populationIndex.has(row.speciesId)) populationIndex.set(row.speciesId, []);
        populationIndex.get(row.speciesId).push(row);
      }
      indexedPopulations = state.populations;
    }
    return populationIndex.get(id) ?? [];
  }

  function environment(hexId) {
    if (!climates.has(hexId)) {
      const hex = geography.hexes[hexId];
      climates.set(hexId, { ...hex, ...readClimate(geography, hex, environmentDay) });
    }
    return climates.get(hexId);
  }

  function newSpecies(genome, parentId = null) {
    const parent = speciesById.get(parentId);
    if (parent && !parent.genomeHistory) recordGenome(parent, environmentDay, 'snapshot');
    const ordinal = state.nextSpecies++;
    const record = { id: `species-${ordinal}`, name: speciesName(state.seed, ordinal),
      parentId, originDay: environmentDay, extinctDay: null, genome: { ...genome },
      genomeRevision: 1, candidates: [] };
    recordGenome(record, environmentDay, 'origin', parentId ? speciesById.get(parentId).genomeRevision : null);
    state.species.push(record); speciesById.set(record.id, record);
    if (parentId) state.stats.speciations += 1;
    return record;
  }

  function merge(rows) {
    const merged = new Map();
    for (const row of rows) {
      if (row.count <= 0) continue;
      const key = populationKey(row);
      const existing = merged.get(key);
      if (existing) {
        existing.reserve = (existing.reserve * existing.count + row.reserve * row.count) / (existing.count + row.count);
        existing.count += row.count;
      } else merged.set(key, { speciesId: row.speciesId, hexId: row.hexId,
        habitat: row.habitat, count: row.count, reserve: row.reserve });
    }
    return [...merged.values()].sort(populationOrder);
  }

  function communities() {
    const result = new Map();
    for (const row of state.populations) {
      const key = habitatKey(row);
      if (!result.has(key)) result.set(key, []);
      result.get(key).push({ speciesId: row.speciesId, genome: speciesById.get(row.speciesId).genome,
        derived: phenotype(speciesById.get(row.speciesId).genome),
        environment: environmentalPerformance(speciesById.get(row.speciesId).genome,
          environment(row.hexId), row.habitat, phenotype(speciesById.get(row.speciesId).genome)),
        population: row.count, habitat: row.habitat });
    }
    return result;
  }

  function scoreKey(genome, row, excludedSpeciesId, independentLineage) {
    if (!geneticKeys.has(genome)) geneticKeys.set(genome, genomeKey(genome));
    return `${habitatKey(row)}|${excludedSpeciesId}|${independentLineage}|${geneticKeys.get(genome)}`;
  }

  function scoreAt(genome, row, community, excludedSpeciesId, independentLineage = false) {
    // The community object is a frozen census for one assessment/observation.
    // Rebuilding it after accepted evolution invalidates every score together.
    if (!scoreCaches.has(community)) scoreCaches.set(community, new Map());
    const cache = scoreCaches.get(community);
    const key = scoreKey(genome, row, excludedSpeciesId, independentLineage);
    if (!cache.has(key)) cache.set(key, scoreSpecies(genome, environment(row.hexId), row.habitat,
      community.get(habitatKey(row)) ?? [], { population: 1, excludeSpeciesId: excludedSpeciesId,
        independentLineage, derived: phenotype(genome), diagnostics: ecologyDiagnostics }));
    return cache.get(key);
  }

  function demography() {
    const local = new Map();
    for (const row of state.populations) {
      const key = habitatKey(row);
      if (!local.has(key)) local.set(key, []);
      local.get(key).push(row);
    }
    const result = [];
    for (const residents of local.values()) {
      const first = residents[0];
      const rows = residents.map(row => ({ speciesId: row.speciesId, population: row.count,
        habitat: row.habitat, genome: speciesById.get(row.speciesId).genome,
        derived: phenotype(speciesById.get(row.speciesId).genome) }));
      const scores = evaluateCommunity(environment(first.hexId), first.habitat, rows, ecologyDiagnostics);
      residents.forEach((row, index) => {
        const score = scores[index];
        const deaths = Math.min(row.count, roundedExpectation(row.count * clamp(score.deathRate), random.next));
        // Rates come from one finite-resource allocation. Newborns do not feed,
        // reproduce or disperse until the next biological turn.
        const births = roundedExpectation((row.count - deaths) * clamp(score.birthRate), random.next);
        state.stats.deaths += deaths;
        state.stats.predationDeaths += Math.min(deaths,
          Math.floor(row.count * clamp(score.predationLoss ?? 0)));
        state.stats.births += births; state.stats.reproductionAttempts += births;
        const count = row.count - deaths + births;
        if (!count) return;
        const derived = phenotype(rows[index].genome);
        // A coarse mean reserve is bookkeeping, not a source of extra food or
        // individual energy cohorts; demographic rates already charge upkeep.
        const surplus = (score.production ?? 0) + (score.food ?? 0) - derived.upkeep;
        const reserve = clamp(row.reserve + surplus - (births / Math.max(1, row.count)) * derived.reproductionCost,
          0, derived.cells);
        result.push({ ...row, count, reserve, newborns: births });
      });
    }
    return result;
  }

  function routes(row, genome) {
    const source = geography.hexes[row.hexId];
    const derived = phenotype(genome);
    const result = new Map();
    const mobility = genome.movement ?? 0;
    const normalRate = 0.004 + 0.003 * mobility;
    const add = (hexId, habitat, conductance, barrier) => {
      if (hexId === row.hexId && habitat === row.habitat) return;
      const hex = environment(hexId);
      if ((habitat === 'water' ? !hasWater(hex) : !hasLand(hex))
        || environmentalPerformance(genome, hex, habitat, derived) <= 0) return;
      const key = `${hexId}|${habitat}`;
      const item = { hexId, habitat, conductance, barrier };
      if (!result.has(key) || result.get(key).conductance < conductance) result.set(key, item);
    };
    if (hasWater(source) && hasLand(source)) add(row.hexId,
      row.habitat === 'land' ? 'water' : 'land', normalRate * 0.5, false);
    for (const hexId of source.neighbors) {
      const destination = geography.hexes[hexId];
      for (const habitat of ['land', 'water']) {
        const waterRoute = row.habitat === 'water' && habitat === 'water';
        const channel = source.waterType !== 'none' && destination.waterType !== 'none'
          || source.downstream === destination.id || destination.downstream === source.id;
        const surface = hex => hex.waterType === 'none' ? hex.bedElevation : hex.waterLevel;
        const barrier = source.permanentIce || destination.permanentIce
          || (waterRoute ? !channel : Math.abs(surface(source) - surface(destination)) >= 1000
            || Math.max(surface(source), surface(destination)) >= 3500);
        const conductance = barrier ? normalRate * 0.006 * (1 + 0.25 * (genome.flight ?? 0)) : normalRate;
        add(hexId, habitat, conductance, barrier);
      }
      // Rare aggregate transport across one unsuitable intermediate cell.
      if (environmentalPerformance(genome, environment(hexId), row.habitat, derived) <= 0) {
        for (const farId of destination.neighbors) add(farId, row.habitat,
          normalRate * 0.001 * (1 + 0.25 * (genome.flight ?? 0)), true);
      }
    }
    return [...result.values()].sort((a, b) => a.hexId - b.hexId || order(a.habitat, b.habitat));
  }

  function disperse(rows) {
    const result = [];
    const community = communities();
    for (const row of rows) {
      const genome = speciesById.get(row.speciesId).genome;
      const choices = routes(row, genome);
      if (genome.movement > 0 && !genome.photosynthesis && (genome.plantFeeding || genome.animalFeeding)) {
        for (const choice of choices) {
          // Active foragers favour destinations that actually feed them. A
          // small exploratory flow remains; barriers keep their route penalty.
          const score = scoreAt(genome, choice, community, row.speciesId);
          choice.conductance *= 0.15 + 2.85 * clamp((score.score + 0.008) / 0.12);
        }
      }
      const available = row.count - (row.newborns ?? 0);
      let left = available;
      const total = choices.reduce((sum, choice) => sum + choice.conductance, 0);
      const scale = total > 0.12 ? 0.12 / total : 1;
      for (const choice of choices) {
        const count = Math.min(left, roundedExpectation(available * choice.conductance * scale, random.next));
        if (!count) continue;
        result.push({ speciesId: row.speciesId, hexId: choice.hexId, habitat: choice.habitat,
          count, reserve: row.reserve * (choice.barrier ? 0.75 : 0.95) });
        left -= count; state.stats.movements += count;
        if (choice.barrier) { state.stats.barrierDepartures += count; state.stats.barrierArrivals += count; }
      }
      result.push({ ...row, count: left + (row.newborns ?? 0) });
    }
    return merge(result);
  }

  function sampleRows(rows) {
    if (rows.length <= EVOLUTION_RULES.sampleLocations) return rows;
    // Extremes retain small environmental refuges; evenly spaced stable IDs
    // supplement them. No random query or population-weighted resampling.
    const selected = new Map();
    // Retain a shoreline/river source even if it is not a climate extreme.
    for (const habitat of ['land', 'water']) {
      const edge = rows.find(row => row.habitat !== habitat
        && [row.hexId, ...geography.hexes[row.hexId].neighbors].some(id => habitat === 'land'
          ? hasLand(geography.hexes[id]) : hasWater(geography.hexes[id])));
      if (edge) selected.set(populationKey(edge), edge);
    }
    for (const reading of [hex => hex.temperature ?? 0, hex => hex.humidity ?? 0,
      hex => hex.bedElevation ?? 0, waterDepth]) {
      const ranked = [...rows].sort((a, b) => reading(environment(a.hexId))
        - reading(environment(b.hexId)) || populationOrder(a, b));
      selected.set(populationKey(ranked[0]), ranked[0]);
      selected.set(populationKey(ranked.at(-1)), ranked.at(-1));
    }
    for (let index = 0; selected.size < EVOLUTION_RULES.sampleLocations && index < rows.length; index += 1) {
      const row = rows[Math.floor(index * rows.length / EVOLUTION_RULES.sampleLocations) % rows.length];
      selected.set(populationKey(row), row);
    }
    return [...selected.values()].sort(populationOrder);
  }

  function frontierRows(parentGenome, genome, rows) {
    if (parentGenome.landAdaptation === genome.landAdaptation) return [];
    return rows.flatMap(sourceRow => routes(sourceRow, genome)
      .filter(route => !supportsHabitat(parentGenome, environment(route.hexId), route.habitat))
      .map(route => ({ ...sourceRow, hexId: route.hexId, habitat: route.habitat,
        // At most a quarter of a source supports a prospective settlement.
        // River switching and difficult crossings retain their lower rates.
        count: sourceRow.count * Math.min(0.25, route.conductance / 0.004 * 0.25), sourceRow })));
  }

  function assess(record, genome, rows, community, baseline) {
    let weight = 0; let supported = 0; let gain = 0; let viableScore = 0; let opposing = 0;
    const evaluations = [...rows, ...frontierRows(record.genome, genome, rows)].map((row, index) => {
      const resident = baseline?.[index] ?? scoreAt(record.genome, row, community, record.id);
      const candidate = scoreAt(genome, row, community, record.id, rolesDiffer(record.genome, genome));
      const difference = candidate.score - resident.score;
      weight += row.count;
      gain += row.count * difference;
      viableScore += row.count * candidate.score;
      if (candidate.score > 0 && difference >= EVOLUTION_RULES.minimumAdvantage) supported += row.count;
      if (difference <= -EVOLUTION_RULES.minimumAdvantage) opposing += row.count;
      return { row, resident, candidate, difference, sourceRow: row.sourceRow ?? row };
    });
    return { evaluations, support: weight ? supported / weight : 0,
      opposing: weight ? opposing / weight : 0, advantage: weight ? gain / weight : 0,
      score: weight ? viableScore / weight : -1,
      maximumAdvantage: Math.max(-1, ...evaluations.filter(item => item.candidate.score > 0).map(item => item.difference)) };
  }

  function novel(record, genome, community, branching = false) {
    const parentRows = rowsForSpecies(record.id);
    for (const other of state.species) {
      if (other.extinctDay !== null || (!branching && other.id === record.id)) continue;
      if (genomeKey(other.genome) === genomeKey(genome)) return false;
      const occupied = new Map();
      for (const row of [...parentRows, ...rowsForSpecies(other.id)]) {
        const key = habitatKey(row);
        if (!occupied.has(key)) occupied.set(key, { ...row });
        else occupied.get(key).count += row.count;
      }
      const residentSamples = sampleRows([...occupied.values()].sort(populationOrder));
      const samples = [...residentSamples, ...frontierRows(other.genome, genome, residentSamples),
        ...frontierRows(genome, other.genome, residentSamples)];
      let sum = 0; let squared = 0; let dietDifference = 0; let weight = 0;
      let bestDifference = -Infinity; let worstDifference = Infinity;
      for (const row of samples) {
        // Compare both phenotypes as the same independent rare lineage. Labels
        // and existing conspecific food exclusions cannot manufacture novelty.
        const candidate = scoreAt(genome, row, community, record.id, true);
        const alternative = scoreAt(other.genome, row, community, record.id, true);
        const difference = candidate.score - alternative.score;
        sum += row.count * difference; squared += row.count * difference * difference;
        bestDifference = Math.max(bestDifference, difference);
        worstDifference = Math.min(worstDifference, difference);
        const sourceShares = score => {
          const sources = [score.production ?? 0, score.grazingFood ?? score.food ?? 0, score.predationFood ?? 0];
          const total = Math.max(1e-9, sources.reduce((value, source) => value + source, 0));
          return sources.map(source => source / total);
        };
        const first = sourceShares(candidate); const second = sourceShares(alternative);
        dietDifference += row.count * first.reduce((value, share, index) => value + Math.abs(share - second[index]), 0) / 2;
        weight += row.count;
      }
      const shapeDifference = weight ? Math.sqrt(Math.max(0, squared / weight - (sum / weight) ** 2)) : 0;
      const complementary = bestDifference >= EVOLUTION_RULES.minimumAdvantage
        && worstDifference <= -EVOLUTION_RULES.minimumAdvantage;
      if (weight && dietDifference / weight < EVOLUTION_RULES.minimumDietDifference
        && !(complementary && shapeDifference >= EVOLUTION_RULES.minimumProfileDifference)) return false;
    }
    return true;
  }

  function randomTrials(genome) {
    const options = candidateMutations(genome);
    const result = [];
    for (let index = 0; index < EVOLUTION_RULES.trialMutations && options.length; index += 1) {
      // Encounter and locomotion changes get more search opportunities; they
      // still have to pay their costs and pass the same ecological gates.
      const weight = trial => ['animalFeeding', 'movement'].includes(trial.key) ? 2 : 1;
      let ticket = random.next() * options.reduce((sum, trial) => sum + weight(trial), 0);
      let selected = 0;
      while (selected < options.length - 1 && ticket >= weight(options[selected])) {
        ticket -= weight(options[selected]); selected += 1;
      }
      result.push(options.splice(selected, 1)[0]);
    }
    return result;
  }

  function evolve() {
    let community = communities();
    // Newly named species wait until the next assessment before evolving.
    for (const record of [...state.species]) {
      const rows = rowsForSpecies(record.id);
      if (!rows.length) { record.candidates = []; continue; }
      const population = rows.reduce((sum, row) => sum + row.count, 0);
      const samples = sampleRows(rows);
      const baseline = samples.map(row => scoreAt(record.genome, row, community, record.id));
      const evaluated = [];
      for (const candidate of record.candidates) {
        let analysis = assess(record, candidate.genome, samples, community, baseline);
        state.stats.candidateEvaluations += 1;
        const qualifies = analysis.maximumAdvantage >= EVOLUTION_RULES.minimumAdvantage
          && analysis.support * population >= EVOLUTION_RULES.minimumPopulation;
        candidate.age = qualifies ? candidate.age + 1 : 0;
        candidate.support = analysis.support; candidate.advantage = analysis.advantage;
        candidate.lastEvaluation = environmentDay;
        if (analysis.maximumAdvantage <= EVOLUTION_RULES.preliminaryAdvantage) continue;
        // Extend a promising direction one legal locus at a time, only before
        // it has begun accumulating stable qualification evidence.
        if (candidate.age === 0 || candidate.age === 1 && candidate.steps < 2
          || candidate.age > EVOLUTION_RULES.persistenceAssessments) {
          const trials = randomTrials(candidate.genome).map(trial => ({ trial,
            analysis: assess(record, trial.genome, samples, community, baseline) }));
          state.stats.candidateEvaluations += trials.length;
          trials.sort((a, b) => b.analysis.maximumAdvantage - a.analysis.maximumAdvantage
            || order(genomeKey(a.trial.genome), genomeKey(b.trial.genome)));
          const improvement = trials[0];
          if (improvement && improvement.analysis.maximumAdvantage > analysis.maximumAdvantage + EVOLUTION_RULES.preliminaryAdvantage) {
            candidate.genome = { ...improvement.trial.genome }; candidate.steps += 1;
            candidate.age = 0; analysis = improvement.analysis; state.stats.mutations += 1;
          }
        }
        evaluated.push({ candidate, analysis });
      }
      const used = new Set([genomeKey(record.genome), ...evaluated.map(item => genomeKey(item.candidate.genome))]);
      {
        const proposals = randomTrials(record.genome).filter(trial => !used.has(genomeKey(trial.genome)))
          .map(trial => ({ trial, analysis: assess(record, trial.genome, samples, community, baseline) }))
          .filter(item => item.analysis.maximumAdvantage > EVOLUTION_RULES.preliminaryAdvantage);
        state.stats.candidateEvaluations += proposals.length;
        proposals.sort((a, b) => b.analysis.maximumAdvantage - a.analysis.maximumAdvantage
          || order(genomeKey(a.trial.genome), genomeKey(b.trial.genome)));
        for (const { trial, analysis } of proposals) {
          if (evaluated.length >= EVOLUTION_RULES.maximumCandidates * 2) break;
          const key = genomeKey(trial.genome);
          if (used.has(key)) continue;
          used.add(key);
          const candidate = { id: `direction-${state.nextCandidate++}`, genome: { ...trial.genome },
            originDay: environmentDay, lastEvaluation: environmentDay, age: 0, steps: 1,
            support: analysis.support, advantage: analysis.advantage };
          evaluated.push({ candidate, analysis }); state.stats.mutations += 1;
        }
      }
      evaluated.sort((a, b) => b.analysis.maximumAdvantage - a.analysis.maximumAdvantage || order(a.candidate.id, b.candidate.id));
      evaluated.length = Math.min(evaluated.length, EVOLUTION_RULES.maximumCandidates);
      record.candidates = evaluated.map(item => item.candidate);
      for (const { candidate, analysis } of evaluated) {
        if (candidate.age < EVOLUTION_RULES.persistenceAssessments) continue;
        const roleChange = rolesDiffer(record.genome, candidate.genome);
        if (!roleChange && analysis.support >= EVOLUTION_RULES.broadSupport
          && analysis.advantage >= EVOLUTION_RULES.minimumAdvantage
          && novel(record, candidate.genome, community)) {
          if (!record.genomeHistory) recordGenome(record, environmentDay, 'snapshot');
          record.genome = { ...candidate.genome }; record.genomeRevision += 1;
          recordGenome(record, environmentDay, 'adaptation');
          record.candidates = []; state.stats.adaptations += 1;
          for (const row of rows) row.reserve = Math.min(row.reserve, phenotype(record.genome).cells);
          community = communities();
          break;
        }
        const specialized = analysis.support < EVOLUTION_RULES.broadSupport && analysis.opposing > 0;
        const habitatExpansion = analysis.evaluations.some(item => item.row.sourceRow
          && item.candidate.score > 0 && item.difference >= EVOLUTION_RULES.minimumAdvantage);
        if ((!roleChange && (!specialized || (!habitatExpansion && geneticDistance(record.genome, candidate.genome) < 2)))
          || !novel(record, candidate.genome, community, true)) continue;
        const actual = assess(record, candidate.genome, rows, community);
        const targets = actual.evaluations.filter(item => {
          if (item.candidate.score <= 0 || item.difference < EVOLUTION_RULES.minimumAdvantage) return false;
          // An occupied feeding niche requires an advantage over its actual
          // incumbent, not merely over the candidate's less-suited parent.
          return (community.get(habitatKey(item.row)) ?? []).every(incumbent => {
            if (incumbent.speciesId === record.id || rolesDiffer(candidate.genome, incumbent.genome)) return true;
            const comparison = scoreAt(incumbent.genome, item.row, community, incumbent.speciesId);
            return item.candidate.score >= comparison.score + EVOLUTION_RULES.minimumAdvantage;
          });
        });
        const transfers = [];
        const sources = new Set();
        const projectedPools = new Map();
        targets.sort((a, b) => b.difference - a.difference || populationOrder(a.row, b.row));
        for (const { row, sourceRow } of targets) {
          if (sources.has(sourceRow)) continue;
          const key = habitatKey(row);
          const previous = projectedPools.get(key) ?? (community.get(key) ?? []);
          // Predators cannot start at the same density as their prey. Back off
          // only when the larger split fails its real finite-food check.
          const fractions = candidate.genome.animalFeeding ? [0.25, 0.125, 0.0625, 0.03125] : [0.25];
          for (const fraction of fractions) {
            const count = Math.floor((row.sourceRow ? row.count / 0.25 : row.count) * fraction);
            if (!count) continue;
            const projected = previous.filter(resident => resident.speciesId !== '__prospective_branch__')
              .map(resident => ({ ...resident, population: resident.population
                - (habitatKey(sourceRow) === key && resident.speciesId === record.id ? count : 0) }));
            const established = previous.find(resident => resident.speciesId === '__prospective_branch__')?.population ?? 0;
            projected.push({ speciesId: '__prospective_branch__', genome: candidate.genome,
              derived: phenotype(candidate.genome), population: count + established, habitat: row.habitat });
            if (evaluateCommunity(environment(row.hexId), row.habitat, projected, ecologyDiagnostics).at(-1).score <= 0) continue;
            transfers.push({ row: sourceRow, destination: row, count });
            sources.add(sourceRow); projectedPools.set(key, projected);
            break;
          }
        }
        const supportPopulation = transfers.reduce((sum, item) => sum + item.row.count, 0);
        const transferPopulation = transfers.reduce((sum, item) => sum + item.count, 0);
        if (supportPopulation < EVOLUTION_RULES.minimumPopulation
          || transferPopulation < EVOLUTION_RULES.minimumPopulation) continue;
        // A new lineage starts from existing parent population. No candidate
        // body, food or demographic activity existed before this acceptance.
        const child = newSpecies(candidate.genome, record.id);
        const childRows = [];
        for (const { row, destination, count } of transfers) {
          row.count -= count;
          childRows.push({ ...row, hexId: destination.hexId, habitat: destination.habitat, speciesId: child.id, count,
            reserve: Math.min(row.reserve, phenotype(child.genome).cells) });
        }
        state.populations = merge([...state.populations, ...childRows]);
        record.candidates = record.candidates.filter(item => item.id !== candidate.id);
        community = communities();
        break;
      }
    }
  }

  // Count established living identities once, regardless of occupied hexes.
  function speciesByEnergy(ids) {
    const counts = { photosynthesis: 0, plantFeeding: 0, animalFeeding: 0, other: 0 };
    const roles = { producer: 'photosynthesis', grazer: 'plantFeeding', predator: 'animalFeeding' };
    for (const id of ids) counts[roles[phenotype(speciesById.get(id).genome).role] ?? 'other'] += 1;
    return counts;
  }

  function updateHistory() {
    const population = state.populations.reduce((sum, row) => sum + row.count, 0);
    const living = new Set(state.populations.map(row => row.speciesId));
    for (const record of state.species) {
      if (!living.has(record.id) && record.extinctDay === null) {
        record.extinctDay = state.day; record.candidates = [];
      }
    }
    if (state.introduced) {
      state.history.push({ day: state.day, population, species: living.size, speciesByEnergy: speciesByEnergy(living),
        extinctSpecies: state.species.filter(record => record.extinctDay !== null).length,
        variants: living.size, occupiedHexes: new Set(state.populations.map(row => row.hexId)).size });
      if (state.history.length > 180) state.history.splice(0, state.history.length - 180);
    }
    cachedObservation = null; cachedCompact = null;
  }

  function introduce(hexId) {
    if (state.introduced && state.populations.length) return { ok: false, reason: 'already-introduced' };
    if (!Number.isInteger(hexId) || !geography.hexes[hexId]) return { ok: false, reason: 'unknown-hex' };
    if (state.introduced) {
      state.previousAttempts.push({ runId: state.runId, startDay: state.startDay, endDay: state.day,
        stats: copy(state.stats), species: copy(state.species) });
      state.attempt += 1; state.runId = `${state.baseRunId}:attempt-${state.attempt}`;
      state.seed = `${state.baseSeed}:attempt-${state.attempt}`;
      random = createRandom(state.seed);
      state.species = []; state.populations = []; state.history = []; speciesById.clear();
      state.nextSpecies = 1; state.nextCandidate = 1; state.stats = initialStats(); state.revision = 0;
    }
    const hex = environment(hexId);
    const habitat = hasWater(hex) ? 'water' : 'land';
    const genome = founderForSite(hex, habitat, random.next);
    const record = newSpecies(genome);
    state.populations = [{ speciesId: record.id, hexId, habitat, count: 20, reserve: phenotype(genome).cells }];
    state.startDay = state.day; state.biologicalTurns = 0; state.turnCredit = 0;
    state.introduced = true; state.revision += 1;
    updateHistory();
    return { ok: true, runId: state.runId, revision: state.revision };
  }

  function advanceTo(day) {
    validateDay(day);
    if (day < state.day) throw new RangeError('Life cannot advance backwards.');
    if (!state.introduced && day > state.day) {
      state.revision += day - state.day; state.day = day; environmentDay = day;
      climates.clear(); cachedObservation = null; cachedCompact = null; return;
    }
    while (state.day < day) {
      environmentDay = state.day + 1; climates.clear(); state.turnCredit += 3;
      if (state.turnCredit >= 10) {
        state.turnCredit -= 10; state.biologicalTurns += 1;
        if (state.populations.length) {
          state.populations = disperse(demography());
          if (state.biologicalTurns % EVOLUTION_RULES.assessmentTurns === 0) evolve();
        }
      }
      state.day = environmentDay; state.revision += 1; updateHistory();
    }
  }

  function observationOptions(options = {}) {
    if (options.detail === undefined || options.detail === 'full') return { detail: 'full' };
    if (options.detail !== 'summary' || options.speciesId != null && typeof options.speciesId !== 'string'
      || options.includeTendencies !== undefined && typeof options.includeTendencies !== 'boolean') {
      throw new TypeError('Invalid observation detail request.');
    }
    return { detail: 'summary', speciesId: options.speciesId ?? null,
      includeTendencies: options.includeTendencies ?? false };
  }

  function rangeRecords(options) {
    if (options.detail === 'full') return state.species;
    const record = options.includeTendencies && speciesById.get(options.speciesId);
    return record ? [record] : [];
  }

  function cachedFor(options) {
    return options.detail === 'full' ? cachedObservation
      : cachedCompact?.key === JSON.stringify(options) ? cachedCompact.value : null;
  }

  function cacheResult(options, value) {
    if (options.detail === 'full') cachedObservation = value;
    else cachedCompact = { key: JSON.stringify(options), value };
    return value;
  }

  function buildObservation(options, community) {
    const compact = options.detail === 'summary';
    const ranges = new Set(rangeRecords(options).map(record => record.id));
    // A collapsed notebook only allocates light; it never scores candidates.
    if (!community && ranges.size) community = communities();
    const speciesRows = [];
    const hexes = new Map();
    for (const record of state.species) {
      const rows = rowsForSpecies(record.id);
      if (!rows.length) continue;
      const derived = phenotype(record.genome);
      const locationCounts = new Map();
      const energySources = ['photosynthesis', 'plantFeeding', 'animalFeeding']
        .filter(key => record.genome[key] > 0);
      for (const row of rows) locationCounts.set(row.hexId, (locationCounts.get(row.hexId) ?? 0) + row.count);
      const locations = [...locationCounts].map(([hexId, population]) => ({ hexId, population })).sort((a, b) => a.hexId - b.hexId);
      const population = rows.reduce((sum, row) => sum + row.count, 0);
      const described = describe(record.genome);
      if (compact && record.id !== options.speciesId) {
        speciesRows.push({ id: record.id, name: record.name, parentId: record.parentId,
          originDay: record.originDay, extinctDay: null, population, locations,
          detailLevel: 'summary', tendencyCount: record.candidates.length,
          summary: { size: described.find(trait => trait.key === 'size'), energySources } });
      } else {
        const variant = { id: `${record.id}-phenotype-${record.genomeRevision}`, population,
          originDay: record.originDay, parentId: record.parentId, role: derived.role,
          size: derived.size, cells: derived.cells, temperatureRange: [...derived.temperatureRange],
          habitats: [...derived.habitats], traits: described, locations };
        const traits = described.filter(trait => trait.active).map(trait => ({ key: trait.key, population,
          expressions: [{ ...trait, population, cells: derived.cells, temperatureRange: [...derived.temperatureRange],
            ...(derived.elevationRange ? { elevationRange: [...derived.elevationRange] } : {}),
            ...(derived.depthRange ? { depthRange: [...derived.depthRange] } : {}), locations }] }));
        const tendencies = ranges.has(record.id) ? record.candidates.map(candidate => {
          const analysis = assess(record, candidate.genome, rows, community);
          const favorable = [...new Set(analysis.evaluations.filter(item => item.candidate.score > 0
            && item.difference >= EVOLUTION_RULES.minimumAdvantage).map(item => item.sourceRow.hexId))].sort((a, b) => a - b);
          const candidateTraits = describe(candidate.genome);
          return { id: candidate.id, traits: candidateTraits,
            changes: candidateTraits.filter(trait => trait.value !== record.genome[trait.key])
              .map(trait => ({ ...trait, from: record.genome[trait.key], to: trait.value })),
            strength: clamp(analysis.support), rangeQuality: 'estimated',
            locations: favorable.map(hexId => ({ hexId })), roleChange: rolesDiffer(record.genome, candidate.genome),
            advantage: analysis.maximumAdvantage, originDay: candidate.originDay };
        }) : undefined;
        speciesRows.push({ id: record.id, name: record.name, parentId: record.parentId,
          originDay: record.originDay, extinctDay: null, population, locations, variants: [variant], traits, ...(tendencies ? { tendencies } : {}),
          ...(compact ? { detailLevel: ranges.has(record.id) ? 'full' : 'genes', tendencyCount: record.candidates.length } : {}) });
      }
      for (const row of rows) {
        if (!hexes.has(row.hexId)) hexes.set(row.hexId, { hexId: row.hexId, population: 0,
          species: new Map(), display: new Map(), producers: [] });
        const hex = hexes.get(row.hexId);
        hex.population += row.count;
        hex.species.set(row.speciesId, (hex.species.get(row.speciesId) ?? 0) + row.count);
        if (record.genome.photosynthesis) hex.producers.push({ speciesId: record.id,
          habitat: row.habitat, population: row.count, genome: record.genome, derived });
        const mobile = record.genome.movement > 0;
        const key = `${derived.role}|${energySources.join(',')}|${derived.size}|${row.habitat}|${mobile}`;
        if (!hex.display.has(key)) hex.display.set(key, { role: derived.role, size: derived.size,
          energySources: [...energySources], mobile, habitat: row.habitat, population: 0 });
        hex.display.get(key).population += row.count;
      }
    }
    speciesRows.sort((a, b) => b.population - a.population || order(a.id, b.id));
    const hexRows = [...hexes.values()].map(hex => {
      const shares = lightShares(hex.hexId, hex.producers);
      return { hexId: hex.hexId, population: hex.population,
        speciesCount: hex.species.size, variants: hex.species.size,
        species: [...hex.species].map(([id, population]) => ({ id, population,
          ...(shares?.has(id) ? { lightShare: shares.get(id) } : {}) }))
          .sort((a, b) => b.population - a.population || order(a.id, b.id)),
        display: [...hex.display.values()] };
    }).sort((a, b) => a.hexId - b.hexId);
    const organisms = hexRows.reduce((sum, row) => sum + row.population, 0);
    return { ...(compact ? { detailLevel: 'summary', inspection: { speciesId: options.speciesId, includeTendencies: options.includeTendencies } } : {}),
      runId: state.runId, worldId: state.worldId, worldIdentity: state.worldIdentity,
      generatorVersion: state.worldIdentity.generatorVersion, modelId: MODEL_ID, rulesRevision: RULES_REVISION,
      contractVersion: CONTRACT_VERSION, day: state.day, startDay: state.startDay, revision: state.revision,
      biologicalTurns: state.biologicalTurns, attempt: state.attempt,
      // Full accepted-genome logs are queried on demand, not retransmitted at playback cadence.
      previousAttempts: state.previousAttempts.map(attempt => compact
        ? { runId: attempt.runId, startDay: attempt.startDay, endDay: attempt.endDay }
        : { ...attempt, species: attempt.species.map(({ genomeHistory, ...record }) => record) }),
      status: !state.introduced ? 'not-introduced' : organisms ? 'living' : 'extinct',
      counts: { organisms, species: speciesRows.length, speciesByEnergy: speciesByEnergy(speciesRows.map(row => row.id)), occupiedHexes: hexRows.length,
        variants: speciesRows.length, extinctSpecies: state.species.filter(record => record.extinctDay !== null).length },
      countQuality: 'exact', species: speciesRows, hexes: hexRows,
      extinctSpecies: state.species.filter(record => record.extinctDay !== null).map(record => ({
        id: record.id, name: record.name, parentId: record.parentId, originDay: record.originDay,
        extinctDay: record.extinctDay, population: 0, locations: [], variants: [], traits: [], tendencies: [] })),
      stats: { ...state.stats }, history: state.history,
      classification: { groups: state.populations.length,
        qualifyingPairs: state.species.reduce((sum, record) => sum + record.candidates.length, 0),
        longestIsolation: 0 },
      approximation: { mode: 'species-populations', counts: 'integer-population-pools',
        populationPools: state.populations.length, variants: 'species-wide-pressure-directions',
        maximumCandidatesPerSpecies: EVOLUTION_RULES.maximumCandidates,
        candidateRanges: 'estimated-favorable-conditions', candidateFrequencies: 'unavailable',
        stochasticEvents: 'stochastic-rounded-expectations',
        predation: 'finite-aggregate-withdrawals', dispersal: 'aggregate-conductance',
        validation: 'experimental-uncalibrated' } };
  }

  function lightShares(hexId, producers) {
    if (!producers.length) return null;
    const hex = environment(hexId);
    const shares = new Map();
    let budget = 0;
    // Include unused habitat pools: one crowded river bank is not a fully
    // utilized hex when its water still has spare light (or vice versa).
    for (const habitat of ['land', 'water']) {
      if (!(habitat === 'land' ? hasLand(hex) : hasWater(hex))) continue;
      const rows = producers.filter(row => row.habitat === habitat)
        .sort((a, b) => order(a.speciesId, b.speciesId))
        .map(row => ({ ...row, environment: environmentalPerformance(row.genome, hex, habitat, row.derived) }));
      const light = allocateLight(hex, habitat, rows);
      if (!light.exhausted) return null;
      budget += light.budget;
      rows.forEach((row, index) => shares.set(row.speciesId,
        (shares.get(row.speciesId) ?? 0) + light.allocations[index]));
    }
    return new Map([...shares].map(([id, amount]) => [id, amount / budget]));
  }

  function observe(request) {
    const options = observationOptions(request);
    return cloneObservation(cachedFor(options) ?? cacheResult(options, buildObservation(options)));
  }

  function prepareObservationJobs(community, records) {
    const jobs = new Map();
    const keys = new Set();
    const add = (genome, row, excludedSpeciesId, independentLineage = false) => {
      const key = scoreKey(genome, row, excludedSpeciesId, independentLineage);
      if (keys.has(key)) return;
      keys.add(key);
      const location = habitatKey(row);
      if (!jobs.has(location)) jobs.set(location, { hex: environment(row.hexId), habitat: row.habitat,
        community: community.get(location) ?? [], queries: [] });
      jobs.get(location).queries.push({ key, genome, derived: phenotype(genome),
        excludeSpeciesId: excludedSpeciesId, independentLineage });
    };
    for (const record of records) {
      if (!record.candidates.length) continue;
      const rows = rowsForSpecies(record.id);
      if (!rows.length) continue;
      for (const candidate of record.candidates) {
        for (const row of [...rows, ...frontierRows(record.genome, candidate.genome, rows)]) {
          add(record.genome, row, record.id);
          add(candidate.genome, row, record.id, rolesDiffer(record.genome, candidate.genome));
        }
      }
    }
    return { jobs, keys };
  }

  /** Optional execution of independent, read-only range scores. The browser
   * transports opaque jobs; all partition contents and ecology stay in V3.
   * No commands may overlap this query. Results never enter saved state. */
  async function observeAsync(execute, request) {
    const options = observationOptions(request);
    const records = rangeRecords(options);
    if (cachedFor(options) || state.populations.length < 64
      || !records.some(record => record.candidates.length)) return observe(options);
    const requestedIds = new Set(records.map(record => record.id));
    const residents = new Map();
    for (const row of state.populations) {
      const key = habitatKey(row);
      residents.set(key, (residents.get(key) ?? 0) + 1);
    }
    const work = state.populations.reduce((sum, row) => {
      const candidates = requestedIds.has(row.speciesId) ? speciesById.get(row.speciesId).candidates.length : 0;
      return sum + (candidates ? candidates + 1 : 0) * (residents.get(habitatKey(row)) + 1) ** 2;
    }, 0);
    // Sparse communities were faster locally in browser measurements. Estimate
    // before constructing/detaching jobs; this changes execution only.
    if (work < 100000) return observe(options);
    const revision = state.revision;
    const runId = state.runId;
    const community = communities();
    const { jobs, keys } = prepareObservationJobs(community, records);
    // The executor receives detached values, including genomes and geography.
    const detach = traceCalls(detachObservationJobs, diagnostics['observation.detach']);
    const results = await execute(detach([...jobs.values()]));
    if (state.revision !== revision || state.runId !== runId) throw new Error('Observation superseded by a life command.');
    const scores = new Map(results);
    if (scores.size !== keys.size || [...keys].some(key => !scores.has(key))) throw new Error('Incomplete observation scores.');
    scoreCaches.set(community, scores);
    return cloneObservation(cacheResult(options, buildObservation(options, community)));
  }

  function inspectHex(hexId) {
    if (!Number.isInteger(hexId) || !geography.hexes[hexId]) throw new RangeError('Unknown hex ID.');
    const observation = observe();
    return { runId: state.runId, revision: state.revision, day: state.day,
      ...(observation.hexes.find(row => row.hexId === hexId)
        ?? { hexId, population: 0, species: [], speciesCount: 0, variants: 0, display: [] }) };
  }

  function inspectSpecies(id) {
    const observation = observe();
    const record = [...observation.species, ...observation.extinctSpecies].find(row => row.id === id);
    if (!record) throw new RangeError('Unknown species ID.');
    return { runId: state.runId, revision: state.revision, day: state.day, ...record };
  }

  // Wrap only enabled phases, once per model. Timing remains in the caller.
  advanceTo = traceCalls(advanceTo, diagnostics['life.advance']);
  demography = traceCalls(demography, diagnostics['life.demography']);
  disperse = traceCalls(disperse, diagnostics['life.dispersal']);
  evolve = traceCalls(evolve, diagnostics['life.evolution']);
  updateHistory = traceCalls(updateHistory, diagnostics['life.history']);
  communities = traceCalls(communities, diagnostics['life.communities']);
  environment = traceCalls(environment, diagnostics['life.environment']);
  routes = traceCalls(routes, diagnostics['life.routes']);
  assess = traceCalls(assess, diagnostics['life.assess']);
  scoreAt = traceCalls(scoreAt, diagnostics['life.score']);
  randomTrials = traceCalls(randomTrials, diagnostics['life.mutations']);
  novel = traceCalls(novel, diagnostics['life.novelty']);
  prepareObservationJobs = traceCalls(prepareObservationJobs, diagnostics['observation.prepare']);
  buildObservation = traceCalls(buildObservation, diagnostics['observation.assemble']);

  const exportState = () => copy({ ...state, randomState: random.exportState() });
  return { introduce, advanceTo, observe, observeAsync, inspectHex, inspectSpecies, exportState,
    observeTree: () => observeTree(state),
    inspectGeneHistory: (runId, speciesId, key) => inspectGeneHistory(state, runId, speciesId, key) };
}
