import { traceEvent } from './diagnostics.js';
import { candidateMutations, deriveGenome, founderGenome } from './genes/genome.js';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const outside = (value, range) => Math.max(range[0] - value, value - range[1], 0);
export const ECOLOGY_RULES = Object.freeze({ lightBudget: 2400, waterLightBudget: 2000,
  photosynthesisRate: 1.6, grazingFraction: 0.45, preyFraction: 0.12,
  conversion: 0.6, backgroundMortality: 0.008, starvationMortality: 0.14, reproductionRate: 0.18,
  competitionExponent: 1.2,
  huntingEffort: 3.6, captureBase: 0.5, captureSpeed: 0.14,
  stationaryForaging: 1, movementForaging: 0.7,
  sexualSparseRecruitment: 0.9, sexualDenseBenefit: 0.8, mateHalfDensity: 8 });

export const hasWater = hex => hex.waterType !== 'none' || hex.runoff > 0;
export const hasLand = hex => hex.waterType === 'none';
export const waterDepth = hex => Math.max(0, (hex.currentWaterLevel ?? hex.waterLevel ?? hex.bedElevation)
  - hex.bedElevation);

export function supportsHabitat(genome, hex, habitat) {
  return !hex.permanentIce && (habitat === 'water' ? hasWater(hex) && genome.landAdaptation <= 2
    : habitat === 'land' && hasLand(hex) && genome.landAdaptation >= 1);
}

/** Elevation represents nonthermal highland stress; depth represents pressure
 * and substrate specialization. Neither silently changes shared climate. */
export function environmentalPerformance(genome, hex, habitat, derived = deriveGenome(genome)) {
  if (!supportsHabitat(genome, hex, habitat)) return 0;
  const currentTemperature = hex.temperature ?? 20;
  const thermalDistance = outside(currentTemperature, derived.temperatureRange);
  const insulation = currentTemperature < derived.temperatureRange[0]
    ? 1 / (1 + 0.5 * genome.insulation) : 1 + 0.18 * genome.insulation;
  const shelter = habitat === 'land' ? 1 + 0.2 * genome.burrowing : 1;
  const temperature = Math.exp(-thermalDistance * insulation / (10 * shelter));
  const ice = 1 - 0.8 * clamp(hex.iceCover ?? 0);
  if (habitat === 'water') {
    const depth = Math.exp(-outside(waterDepth(hex), derived.depthRange) / 350);
    return temperature * depth * [1, 0.85, 0.55][genome.landAdaptation]
      * ice * (1 - clamp((0.8 + 0.05 * genome.buoyancy) * (hex.waterExposure ?? 0)));
  }
  const humidity = clamp((hex.humidity ?? 0.5) + (hex.runoff > 0 ? 0.2 : 0));
  const requiredMoisture = [1, 0.75, 0.45, 0.2][genome.landAdaptation]
    * (1 + 0.14 * genome.leafArea) / (1 + 0.3 * genome.deepRoots + 0.22 * genome.waxyCuticle);
  const moisture = clamp(humidity / requiredMoisture);
  const elevation = Math.exp(-outside(Math.max(0, hex.bedElevation), derived.elevationRange) / 1000);
  return temperature * moisture * elevation * ice;
}

/** Allocate one finite pool with weighted demand and individual caps. */
function allocate(entries, budget) {
  const result = entries.map(() => 0);
  const active = entries.map((entry, index) => ({ ...entry, index }))
    .filter(entry => entry.cap > 0 && entry.weight > 0)
    .sort((a, b) => a.cap / a.weight - b.cap / b.weight || a.index - b.index);
  let weight = active.reduce((sum, entry) => sum + entry.weight, 0);
  let remaining = Math.max(0, budget);
  for (const entry of active) {
    const amount = Math.min(entry.cap, weight > 0 ? remaining * entry.weight / weight : 0);
    result[entry.index] = amount;
    remaining = Math.max(0, remaining - amount);
    weight = Math.max(0, weight - entry.weight);
  }
  return result;
}

/** The same gross light allocation serves biology and read-only inspection.
 * Rows supply prepared populations, phenotypes and environmental performance
 * for one habitat. Exhaustion uses demand before any display rounding. */
export function allocateLight(hex, habitat, rows) {
  const riverShare = hasLand(hex) && hasWater(hex) ? habitat === 'land' ? 0.7 : 0.3 : 1;
  const budget = riverShare * (habitat === 'water' ? ECOLOGY_RULES.waterLightBudget
    / (1 + waterDepth(hex) / 180) : ECOLOGY_RULES.lightBudget);
  const demands = rows.map(row => {
    const cap = row.population * row.derived.cells * row.derived.photosynthesisShare
      * ECOLOGY_RULES.photosynthesisRate * row.environment * activity(row);
    return { cap, weight: cap * (habitat === 'land' ? row.derived.landCompetition : 1) };
  });
  const demand = demands.reduce((sum, row) => sum + (row.weight > 0 ? row.cap : 0), 0);
  const crowding = clamp(demand / Math.max(1, budget) - 1);
  for (let index = 0; index < demands.length; index += 1) {
    const genome = rows[index].genome;
    const merit = (habitat === 'land' ? rows[index].derived.landCompetition : 1)
      * (1 + 0.38 * genome.shadeTolerance * crowding)
      * (habitat === 'water' ? 1 + 0.4 * genome.buoyancy * waterDepth(hex) / (waterDepth(hex) + 15) : 1)
      / (1 + 0.1 * genome.clonalGrowth * crowding);
    demands[index].weight = demands[index].cap * merit ** ECOLOGY_RULES.competitionExponent
      * rows[index].environment ** (ECOLOGY_RULES.competitionExponent - 1);
  }
  return { budget, allocations: allocate(demands, budget), exhausted: budget > 0 && demand >= budget };
}

const activity = row => 1 / (1 + 0.55 * row.genome.dormancy * (1 - row.environment));
const socialSupport = population => Math.max(0, population - 1) / (Math.max(0, population - 1) + 12);

/** Population updates and diagnostic probes use exactly the same rate law.
 * The diagnostic caller can combine rare-resource intake with resident-density
 * predation exposure, without altering any actual food or prey allocation. */
function demographicRates(row, intake, predationLoss, openSpace) {
  const upkeep = row.derived.upkeep / (1 + 0.75 * row.genome.dormancy * (1 - row.environment));
  const starvation = clamp(1 - intake / upkeep);
  const mateDensity = Math.max(0, row.support - 1);
  const mates = mateDensity / (mateDensity + ECOLOGY_RULES.mateHalfDensity / (1 + 0.8 * row.genome.mateAttraction));
  const sexualRecruitment = row.derived.sexual ? ECOLOGY_RULES.sexualSparseRecruitment
    + ECOLOGY_RULES.sexualDenseBenefit * mates + 0.12 * (1 - row.environment) * mates : 1;
  const stress = clamp(1 - row.environment + predationLoss / ECOLOGY_RULES.preyFraction);
  const parentalCare = 1 + 0.32 * row.genome.offspringInvestment * stress;
  const clonalRecruitment = !row.derived.sexual && row.genome.photosynthesis && !row.genome.movement
    ? 1 + 0.28 * row.genome.clonalGrowth * openSpace : 1;
  const propaguleRecruitment = 1 + 0.22 * row.genome.propaguleDispersal * openSpace;
  const birthRate = clamp(Math.max(0, intake - upkeep) / row.derived.reproductionCost
    * ECOLOGY_RULES.reproductionRate * sexualRecruitment * parentalCare * clonalRecruitment * propaguleRecruitment, 0, 0.3);
  const deathRate = clamp(ECOLOGY_RULES.backgroundMortality
    + starvation * ECOLOGY_RULES.starvationMortality / (1 + 0.3 * row.genome.dormancy * starvation)
    + predationLoss, 0, 0.9);
  return { birthRate, deathRate, growthRate: birthRate - deathRate, score: birthRate - deathRate };
}

/** Access fractions are nested portions of one plant's production. A collection
 * of poorly adapted grazers cannot expose the protected portion by multiplying
 * species labels. Higher-access consumers alone can use the additional bands. */
function allocateAccessible(entries, budget) {
  const total = entries.map(() => 0);
  const levels = [...new Set(entries.filter(entry => entry.cap > 0 && entry.weight > 0)
    .map(entry => entry.access).filter(access => access > 0))].sort((a, b) => a - b);
  let previous = 0;
  for (const level of levels) {
    const eligible = entries.map((entry, index) => ({
      cap: entry.access >= level ? Math.max(0, entry.cap - total[index]) : 0,
      weight: entry.access >= level ? entry.weight : 0,
    }));
    const allocated = allocate(eligible, budget * (level - previous));
    for (let index = 0; index < total.length; index += 1) total[index] += allocated[index];
    previous = level;
  }
  return total;
}

function grazingReachFraction(genome, consumer, plant) {
  const reach = genome.size * (2.2 + 0.3 * genome.biteForce + 0.1 * consumer.flightEfficiency);
  return Math.min(1, (reach / plant.height) ** 2);
}

export function grazingAccess(consumerGenome, plantGenome, consumer = deriveGenome(consumerGenome), plant = deriveGenome(plantGenome)) {
  if (!consumerGenome.plantFeeding || !plantGenome.photosynthesis) return 0;
  const poison = Math.max(0, plantGenome.poison - consumerGenome.detoxification);
  const spines = Math.max(0, plantGenome.spines - 0.7 * consumerGenome.biteForce - 0.2 * consumerGenome.armor);
  const warning = 0.12 * plantGenome.warningSignals * Math.min(2, poison + spines);
  return Math.min(1, grazingReachFraction(consumerGenome, consumer, plant) * (1 + 0.05 * plantGenome.leafArea)
    / (1 + 0.8 * poison + 0.6 * spines + 0.15 * plant.armorProtection + warning));
}

export function preyEligible(predatorGenome, preyGenome, predator = deriveGenome(predatorGenome), prey = deriveGenome(preyGenome), context = {}) {
  return !!predatorGenome.animalFeeding && !!(preyGenome.plantFeeding || preyGenome.animalFeeding)
    && prey.cells <= predator.cells * (1.6 + 0.6 * predatorGenome.biteForce
      + 0.7 * predatorGenome.cooperativeHunting * socialSupport(context.predatorSupport ?? 1));
}

export function captureProbability(predatorGenome, preyGenome, predator = deriveGenome(predatorGenome), prey = deriveGenome(preyGenome), context = {}) {
  if (!preyEligible(predatorGenome, preyGenome, predator, prey, context)) return 0;
  const pack = socialSupport(context.predatorSupport ?? 1);
  const herd = socialSupport(context.preySupport ?? 1);
  const camouflage = 0.11 * preyGenome.camouflage / (1 + 0.3 * prey.speed + 0.25 * predator.senses);
  const warning = 0.055 * preyGenome.warningSignals
    * (Math.min(2, Math.max(0, preyGenome.poison - predatorGenome.detoxification) + preyGenome.spines) - 0.5);
  const ambush = 0.11 * predatorGenome.ambush * (0.35 + prey.speed / (1 + prey.speed))
    * (1 + 0.1 * predatorGenome.camouflage) / (1 + 0.4 * predator.speed);
  return clamp(ECOLOGY_RULES.captureBase + ECOLOGY_RULES.captureSpeed * (predator.speed - prey.speed) + 0.06 * (predator.senses - prey.senses)
    + 0.07 * predator.handling - 0.07 * prey.defense
    - 0.07 * Math.max(0, preyGenome.poison - predatorGenome.detoxification)
    + 0.07 * (predator.flightEfficiency - prey.flightEfficiency)
    + ambush + 0.075 * predatorGenome.cooperativeHunting * pack
    - camouflage - warning - 0.065 * preyGenome.herding * herd
    - ((context.habitat ?? 'land') === 'land' ? 0.065 * preyGenome.burrowing : 0)
    - 0.025 * predatorGenome.warningSignals + 0.018 * preyGenome.mateAttraction, 0.02, 0.95);
}

/** The rows are same-hex species populations, not variants. Output remains in
 * input order. production/food are per-organism energy; predationLoss is the
 * fraction of the represented population withdrawn per biological turn.
 * Both habitat pools receive fixed portions on river hexes, so their separate
 * evaluations cannot double the hex's photosynthetic resource budget. */
export function evaluateCommunity(hex, habitat, community = [], diagnostics) {
  if (diagnostics) traceEvent(diagnostics['ecology.prepare'], true);
  const rows = community.map(row => {
    const matches = (row.habitat ?? habitat) === habitat;
    const population = matches ? Math.max(0, row.population ?? row.count ?? 0) : 0;
    const derived = row.derived ?? deriveGenome(row.genome);
    return { ...row, population, derived,
      environment: matches ? row.environment ?? environmentalPerformance(row.genome, hex, habitat, derived) : 0 };
  });
  const localSupport = new Map();
  for (const row of rows) if (row.speciesId != null) {
    localSupport.set(row.speciesId, (localSupport.get(row.speciesId) ?? 0) + row.population);
  }
  for (const row of rows) row.support = row.conspecificPopulation
    ?? (row.speciesId != null ? localSupport.get(row.speciesId) : row.population);
  if (diagnostics) traceEvent(diagnostics['ecology.prepare'], false);
  if (diagnostics) traceEvent(diagnostics['ecology.light'], true);
  const { budget, allocations: photo } = allocateLight(hex, habitat, rows);
  if (diagnostics) traceEvent(diagnostics['ecology.light'], false);
  if (diagnostics) traceEvent(diagnostics['ecology.feedingSetup'], true);
  const remainingPhoto = [...photo];
  const food = rows.map(() => 0);
  const grazingFood = rows.map(() => 0);
  const predationFood = rows.map(() => 0);
  const preyLoss = rows.map(() => 0);
  const grazingDemand = rows.map(row => row.population * row.derived.cells * row.derived.grazingShare
    * row.environment * activity(row) * 2.2 * (ECOLOGY_RULES.stationaryForaging
      + ECOLOGY_RULES.movementForaging * row.derived.speed / (1 + row.derived.speed)));
  const predationDemand = rows.map(row => row.population * row.derived.cells * row.derived.predationShare
    * row.environment * activity(row) * ECOLOGY_RULES.huntingEffort);

  if (diagnostics) traceEvent(diagnostics['ecology.feedingSetup'], false);
  if (diagnostics) traceEvent(diagnostics['ecology.grazing'], true);
  for (let source = 0; source < rows.length && grazingDemand.some(demand => demand > 0); source += 1) {
    if (!(photo[source] > 0)) continue;
    const available = photo[source] * ECOLOGY_RULES.grazingFraction;
    const demands = rows.map((consumer, index) => {
      if (!(grazingDemand[index] > 0) || consumer.speciesId != null && consumer.speciesId === rows[source].speciesId) return { cap: 0, weight: 0, access: 0 };
      const access = grazingAccess(consumer.genome, rows[source].genome, consumer.derived, rows[source].derived);
      const filtering = habitat === 'water' && rows[source].genome.size <= 3
        ? 1 + 0.5 * consumer.genome.filterFeeding / (1 + 0.4 * consumer.derived.speed)
        : 1 / (1 + 0.25 * consumer.genome.filterFeeding);
      const reach = grazingReachFraction(consumer.genome, consumer.derived, rows[source].derived) * filtering;
      // Short browsers reach only part of a canopy per unit of foraging effort,
      // even when rare. Defenses still protect nested portions of that food.
      return { cap: grazingDemand[index] * reach,
        weight: grazingDemand[index] * (access * filtering) ** ECOLOGY_RULES.competitionExponent, access, reach };
    });
    const eaten = allocateAccessible(demands, available);
    for (let consumer = 0; consumer < rows.length; consumer += 1) {
      remainingPhoto[source] -= eaten[consumer];
      const effort = demands[consumer].reach > 0 ? eaten[consumer] / demands[consumer].reach : 0;
      grazingDemand[consumer] = Math.max(0, grazingDemand[consumer] - effort);
      food[consumer] += ECOLOGY_RULES.conversion * eaten[consumer];
      grazingFood[consumer] += ECOLOGY_RULES.conversion * eaten[consumer];
    }
  }

  if (diagnostics) traceEvent(diagnostics['ecology.grazing'], false);
  if (diagnostics) traceEvent(diagnostics['ecology.hunting'], true);
  for (let source = 0; source < rows.length && predationDemand.some(demand => demand > 0); source += 1) {
    const prey = rows[source];
    if (!(prey.population > 0) || !(prey.genome.plantFeeding || prey.genome.animalFeeding)) continue;
    const tissue = prey.derived.cells * 1.4;
    const available = prey.population * ECOLOGY_RULES.preyFraction;
    const demands = rows.map((predator, index) => {
      if (!(predationDemand[index] > 0) || index === source || (predator.speciesId != null && predator.speciesId === prey.speciesId)) return { cap: 0, weight: 0, capture: 0 };
      const capture = captureProbability(predator.genome, prey.genome, predator.derived, prey.derived,
        { habitat, predatorSupport: predator.support, preySupport: prey.support });
      // Successful effort is extensive in hunter population. A per-species
      // available*capture cap would create extra kills merely by adding names.
      return { cap: predationDemand[index] / tissue * capture,
        weight: predationDemand[index] * capture ** ECOLOGY_RULES.competitionExponent, capture };
    });
    const eaten = allocate(demands, available);
    for (let predator = 0; predator < rows.length; predator += 1) {
      preyLoss[source] += eaten[predator];
      // Charge attempted effort, including failed captures. Otherwise identical
      // prey split into more source labels would offer repeated free attempts.
      const effort = demands[predator].capture > 0 ? eaten[predator] * tissue / demands[predator].capture : 0;
      predationDemand[predator] = Math.max(0, predationDemand[predator] - effort);
      food[predator] += eaten[predator] * tissue * ECOLOGY_RULES.conversion;
      predationFood[predator] += eaten[predator] * tissue * ECOLOGY_RULES.conversion;
    }
  }

  if (diagnostics) traceEvent(diagnostics['ecology.hunting'], false);
  if (diagnostics) traceEvent(diagnostics['ecology.rates'], true);
  const localBiomass = rows.reduce((total, row) => total + row.population * row.derived.cells, 0);
  const openSpace = 1 / (1 + localBiomass / Math.max(1, budget));
  const result = rows.map((row, index) => {
    const population = row.population || 1;
    const production = Math.max(0, remainingPhoto[index]) / population;
    const intake = production + food[index] / population;
    const predationLoss = preyLoss[index] / population;
    return { ...demographicRates(row, intake, predationLoss, openSpace),
      environment: row.environment, production, food: food[index] / population,
      grazingFood: grazingFood[index] / population, predationFood: predationFood[index] / population, predationLoss,
      grossProduction: photo[index] / population, role: row.derived.role,
      capacity: budget / Math.max(1, row.derived.upkeep),
      resourceBudget: budget };
  });
  if (diagnostics) traceEvent(diagnostics['ecology.rates'], false);
  return result;
}

/** Food is probed at rare density, preserving V3's body-size selection semantics.
 * A conspecific probe inherits actual resident social support and, when hunted,
 * estimates exposure with an actual-density phenotype replacement. Only that
 * hazard enters the rare-resource rate calculation; no counterfactual food does.
 * Independent lineages project quarter-parent founding social support and must
 * later pass the actual finite-community transfer test at their true density. */
export function scoreSpecies(genome, hex, habitat, community = [], options = {}) {
  const identity = options.excludeSpeciesId ?? options.speciesId;
  const population = options.population ?? 1;
  const belongs = row => identity != null && row.speciesId === identity && (row.habitat ?? habitat) === habitat;
  const parentPopulation = community.reduce((total, row) => total + (belongs(row)
    ? Math.max(0, row.population ?? row.count ?? 0) : 0), 0);
  const derived = options.derived ?? deriveGenome(genome);
  const conspecificPopulation = parentPopulation > 0
    ? options.independentLineage ? Math.max(population, Math.floor(parentPopulation * 0.25)) : parentPopulation
    : population;
  const result = evaluateCommunity(hex, habitat, [...community, { genome, derived,
    speciesId: options.excludeSpeciesId != null && !options.independentLineage ? options.excludeSpeciesId
      : `__candidate__:${options.excludeSpeciesId ?? options.speciesId ?? ''}`,
    population, conspecificPopulation, habitat }], options.diagnostics).at(-1);
  if (!(parentPopulation > 0) || options.independentLineage || !(genome.plantFeeding || genome.animalFeeding)
    || !community.some(row => row.speciesId !== identity && (row.habitat ?? habitat) === habitat
      && (row.population ?? row.count ?? 0) > 0 && row.genome.animalFeeding)) return result;
  const replacement = community.map(row => belongs(row)
    ? { ...row, genome, derived, environment: result.environment } : row);
  const exposed = evaluateCommunity(hex, habitat, replacement, options.diagnostics);
  const predationLoss = community.reduce((total, row, index) => total + (belongs(row)
    ? exposed[index].predationLoss * Math.max(0, row.population ?? row.count ?? 0) : 0), 0) / parentPopulation;
  const biomass = population * derived.cells + community.reduce((total, row) => total
    + ((row.habitat ?? habitat) === habitat ? Math.max(0, row.population ?? row.count ?? 0)
      * (row.derived ?? deriveGenome(row.genome)).cells : 0), 0);
  const openSpace = 1 / (1 + biomass / Math.max(1, result.resourceBudget));
  return { ...result, ...demographicRates({ genome, derived, environment: result.environment,
    support: conspecificPopulation }, result.production + result.food, predationLoss, openSpace), predationLoss };
}

/** Condition the founder first, then pay for 1–3 random viable one-gene changes.
 * Randomness only chooses among viable options, never grants free capabilities. */
export function founderForSite(hex, habitat, random) {
  let genome = founderGenome();
  genome.landAdaptation = habitat === 'water' ? 0 : (hex.humidity ?? 0.5) >= 0.75 ? 1
    : (hex.humidity ?? 0.5) >= 0.4 ? 2 : 3;
  const bestExpression = (key, values) => values.reduce((best, value) => {
    const trial = { ...genome, [key]: value };
    const score = environmentalPerformance(trial, hex, habitat) / deriveGenome(trial).upkeep;
    return score > best.score ? { value, score } : best;
  }, { value: genome[key], score: -Infinity }).value;
  genome.temperatureTolerance = bestExpression('temperatureTolerance', [null, -2, -1, 0, 1, 2]);
  if (habitat === 'land') genome.elevationTolerance = bestExpression('elevationTolerance', [0, 1, 2, 3, 4]);
  else genome.depthTolerance = bestExpression('depthTolerance', [0, 1, 2, 3, 4]);
  const count = 1 + Math.min(2, Math.floor(random() * 3));
  const changed = new Set();
  for (let index = 0; index < count; index += 1) {
    const options = candidateMutations(genome).filter(candidate => candidate.genome.photosynthesis
      && !changed.has(candidate.key) && scoreSpecies(candidate.genome, hex, habitat).score > 0);
    if (!options.length) break;
    const candidate = options[Math.min(options.length - 1, Math.floor(random() * options.length))];
    genome = candidate.genome;
    changed.add(candidate.key);
  }
  return genome;
}
