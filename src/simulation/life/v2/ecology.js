import { deriveGenome } from './genes/genome.js';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

/** Fraction of a plant's current production accessible to one consumer kind.
 * The caller must cap the combined loss from every grazer at the source pool. */
export function grazingAccess(consumerGenome, plantGenome, lightSaturation = 0) {
  if (!consumerGenome.plantFeeding || !plantGenome.photosynthesis) return 0;
  const consumer = deriveGenome(consumerGenome);
  const plant = deriveGenome(plantGenome);
  const reach = consumerGenome.size * (2.2 + 0.25 * consumerGenome.biteForce + 0.10 * consumer.flightEfficiency);
  if (plant.height > reach) return 0;
  const poison = Math.max(0, plantGenome.poison - 0.9 * consumerGenome.detoxification);
  const spines = Math.max(0, plantGenome.spines - 0.6 * consumerGenome.biteForce - 0.25 * consumerGenome.armor);
  const exposedProduction = 0.44 - 0.24 * clamp(lightSaturation);
  return exposedProduction / (1 + 0.65 * poison + 0.45 * spines + 0.16 * plant.armorProtection);
}

export function preyEligible(predatorGenome, preyGenome) {
  if (!predatorGenome.animalFeeding || !(preyGenome.plantFeeding || preyGenome.animalFeeding)) return false;
  const predator = deriveGenome(predatorGenome);
  const prey = deriveGenome(preyGenome);
  const handlingLimit = 1.6 + 0.55 * predatorGenome.biteForce + 0.25 * predator.handling;
  return prey.cells <= predator.cells * handlingLimit;
}

/** Conditional on an encounter. All races have countertraits and energy costs. */
export function captureProbability(predatorGenome, preyGenome) {
  if (!preyEligible(predatorGenome, preyGenome)) return 0;
  const predator = deriveGenome(predatorGenome);
  const prey = deriveGenome(preyGenome);
  const poison = Math.max(0, preyGenome.poison - 0.9 * predatorGenome.detoxification);
  const sizeAdvantage = clamp(Math.log2(predator.cells / prey.cells), -2, 2);
  return clamp(0.53 + 0.085 * (predator.speed - prey.speed)
    + 0.055 * (predator.senses - prey.senses) + 0.085 * predator.handling
    - 0.075 * prey.defense - 0.055 * poison + 0.045 * sizeAdvantage
    + 0.09 * (predator.flightEfficiency - prey.flightEfficiency), 0.04, 0.94);
}

/** Relative recruitment under otherwise equal productive conditions. This is a
 * local comparison score, not energy awarded to an organism. Including growth
 * costs lets economical small bodies compete with expensive light monopolists. */
export function competitionFitness(derived, habitat = 'land') {
  const productionSurplus = Math.max(0.02, 2.4 * derived.photosynthesisShare - derived.upkeep / derived.cells);
  const lightWeight = habitat === 'land' ? derived.landCompetition : 1;
  return lightWeight * productionSurplus / (derived.reproductionCost / derived.cells);
}

/** Established residents retain scarce recruitment sites; advantage is local.
 * residentCompetition is { occupancy: 0..1, competition: mean fitness score,
 * habitat: 'land' | 'water' }. Land remains the default for isolated helper use.
 * Small neutral establishment remains possible, preserving demographic drift. */
export function establishmentProbability(candidateDerived, residentCompetition = {}) {
  const occupancy = clamp(residentCompetition.occupancy ?? 0);
  const candidateWeight = competitionFitness(candidateDerived, residentCompetition.habitat);
  const residentWeight = residentCompetition.competition ?? candidateWeight;
  if (residentWeight <= 0) return 1;
  const advantage = candidateWeight / residentWeight;
  const competitiveRecruitment = 0.06 + 0.94 * clamp((advantage - 1.08) / 0.50);
  return 1 - occupancy + occupancy * competitiveRecruitment;
}
