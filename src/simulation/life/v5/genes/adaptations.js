/** Revision 3's paid specializations. Coefficients are model hypotheses, not
 * measured biology. Every modifier is neutral at expression zero and consumes
 * only the environment and food already represented by V5. */
export const ADAPTATIONS = Object.freeze([
  ['waterStorage', 0.009, 0.025], ['stomatalControl', 0.006, 0.012],
  ['succulentTissue', 0.008, 0.035], ['antifreeze', 0.009, 0.014],
  ['heatShockProteins', 0.008, 0.014], ['evaporativeCooling', 0.007, 0.014],
  ['countercurrentExchange', 0.008, 0.024], ['pressureEqualization', 0.008, 0.022],
  ['holdfast', 0.007, 0.025], ['flexibleStem', 0.006, 0.018],
  ['reflectiveFoliage', 0.006, 0.012], ['submergedLeaves', 0.009, 0.020],
  ['aerialRespiration', 0.009, 0.022], ['oxygenBinding', 0.010, 0.020],
  ['basking', 0.005, 0.010], ['lowLightPigments', 0.008, 0.016],
  ['sunTracking', 0.008, 0.020], ['canopySpread', 0.009, 0.024],
  ['lightFiltering', 0.007, 0.016], ['rapidGrowth', 0.006, 0.016],
  ['webbing', 0.008, 0.018], ['articulatedLegs', 0.008, 0.022],
  ['adhesivePads', 0.006, 0.015], ['jetPropulsion', 0.012, 0.025],
  ['undulation', 0.008, 0.018], ['crushingJaws', 0.009, 0.025],
  ['piercingMouthparts', 0.007, 0.018], ['fermentation', 0.010, 0.030],
  ['nectarExtraction', 0.007, 0.018], ['venomDelivery', 0.010, 0.022],
  ['pursuitEndurance', 0.009, 0.022], ['vibrationSensing', 0.007, 0.016],
  ['electricalSensing', 0.010, 0.025], ['lureDisplay', 0.008, 0.018],
  ['mucusNet', 0.009, 0.022], ['autotomy', 0.006, 0.030],
  ['inkDefense', 0.008, 0.018], ['startleDisplay', 0.006, 0.016],
  ['mimicry', 0.007, 0.016], ['rollingDefense', 0.006, 0.018],
  ['alarmCalls', 0.007, 0.018], ['nurseryShelter', 0.007, 0.025],
  ['broodPouch', 0.007, 0.030], ['longevityRepair', 0.003, 0.016],
  ['reproductiveRestraint', 0.003, 0.010],
].map(([key, upkeep, construction]) => Object.freeze({ key, min: 0, max: 3, upkeep, construction })));

const expression = (genome, key) => genome[key] ?? 0;
const clamp = value => Math.max(0, Math.min(1, value));
const mobileConsumer = genome => genome.movement > 0 && (genome.plantFeeding || genome.animalFeeding);

export function adaptationCosts(genome) {
  let upkeep = 0;
  let construction = 0;
  for (const trait of ADAPTATIONS) {
    upkeep += expression(genome, trait.key) * trait.upkeep;
    construction += expression(genome, trait.key) * trait.construction;
  }
  return { upkeep, construction };
}

export function adaptationStructure(g) {
  return {
    photosynthesis: 1 / (1 + 0.05 * g.stomatalControl + 0.05 * g.succulentTissue
      + 0.04 * g.reflectiveFoliage + 0.025 * g.lowLightPigments + 0.025 * g.lightFiltering),
    speed: 1 / (1 + 0.04 * g.adhesivePads + 0.08 * g.rollingDefense),
    competition: 1 / (1 + 0.06 * g.flexibleStem),
    dispersal: 1 / (1 + 0.18 * g.holdfast),
  };
}

export function adaptationEnvironment(g, hex, habitat, derived) {
  const land = habitat === 'land';
  const cold = (hex.temperature ?? 20) < derived.temperatureRange[0];
  const humidity = clamp((hex.humidity ?? 0.5) + (hex.runoff > 0 ? 0.2 : 0));
  const depth = Math.max(0, (hex.currentWaterLevel ?? hex.waterLevel ?? hex.bedElevation) - hex.bedElevation);
  const consumer = mobileConsumer(g);
  const thermalProtection = cold
    ? (1 + 0.4 * g.antifreeze + (consumer ? 0.35 * g.countercurrentExchange : 0)
      + (land && consumer ? 0.3 * g.basking : 0)) / (1 + 0.04 * g.heatShockProteins)
    : (1 + 0.4 * g.heatShockProteins + (land ? 0.55 * g.evaporativeCooling * humidity
      + (g.photosynthesis ? 0.4 * g.reflectiveFoliage : 0)
      : (g.plantFeeding || g.animalFeeding ? 0.5 * g.aerialRespiration / (1 + depth / 12) : 0)
        + (g.plantFeeding || g.animalFeeding ? 0.4 * g.oxygenBinding : 0)))
      / (1 + 0.04 * g.antifreeze);
  return {
    thermalProtection,
    moistureDemand: (1 + 0.15 * g.evaporativeCooling + 0.12 * g.canopySpread)
      / (1 + 0.3 * g.waterStorage
        + (g.photosynthesis ? 0.35 * g.stomatalControl + 0.45 * g.succulentTissue : 0)),
    depthProtection: 1 + (depth > derived.depthRange[1] ? 0.4 * g.pressureEqualization
      + (g.plantFeeding || g.animalFeeding ? 0.22 * g.oxygenBinding : 0) : 0),
    exposureProtection: 1 + (!g.movement ? 0.4 * g.holdfast : 0)
      + (g.photosynthesis && g.trunk ? 0.35 * g.flexibleStem : 0),
    iceProtection: 1 + 0.35 * g.antifreeze,
  };
}

/** Open habitat can raise demand, never the finite light budget. */
export function adaptationLight(g, habitat, depth, crowding) {
  const land = habitat === 'land';
  const dim = Math.max(crowding, land ? 0 : depth / (depth + 25));
  return {
    collection: (land ? (1 + 0.13 * g.sunTracking) / (1 + 0.16 * g.submergedLeaves)
      : 1 + 0.14 * g.submergedLeaves + 0.17 * g.lowLightPigments * dim),
    competition: (1 + 0.42 * g.lowLightPigments * dim
      + (land ? 0.38 * g.canopySpread * crowding : 0.48 * g.lightFiltering * crowding))
      / (1 + (land ? 0.13 * g.sunTracking * crowding : 0)),
  };
}

/** Habitat-dependent local pursuit and collection; geographic migration keeps
 * its existing shared route meanings and the model's ordinary speed. */
export function habitatSpeed(g, derived, habitat) {
  if (!g.movement) return 0;
  return derived.speed * (habitat === 'water'
    ? (1 + 0.22 * g.webbing + 0.18 * g.undulation) / (1 + 0.15 * g.articulatedLegs)
    : (1 + 0.22 * g.articulatedLegs) / (1 + 0.15 * g.webbing + 0.12 * g.undulation));
}

export function adaptationBrowsing(g, plant, habitat) {
  const woody = plant.trunk > 0;
  const defenses = Math.min(3, plant.spines + plant.armor);
  return {
    access: habitat === 'land' && g.movement && woody ? 0.18 * g.adhesivePads / 3 : 0,
    collection: (1 + (woody ? 0.25 : -0.12) * g.fermentation)
      * (1 + 0.12 * g.piercingMouthparts * defenses) / (1 + 0.08 * g.piercingMouthparts)
      * (1 + (!woody && (plant.size <= 3 || plant.leafArea > 0) ? 0.22 : -0.12) * g.nectarExtraction),
  };
}

export function adaptationCapture(hunter, prey, hunterDerived, preyDerived, context) {
  const water = context.habitat === 'water';
  const hunterSpeed = habitatSpeed(hunter, hunterDerived, context.habitat);
  const preySpeed = habitatSpeed(prey, preyDerived, context.habitat);
  const mobility = preySpeed / (1 + preySpeed);
  const visual = hunter.eyesight / (1 + hunter.eyesight);
  const group = Math.max(0, (context.predatorSupport ?? 1) - 1)
    / (Math.max(0, (context.predatorSupport ?? 1) - 1) + 12);
  const herd = Math.max(0, (context.preySupport ?? 1) - 1)
    / (Math.max(0, (context.preySupport ?? 1) - 1) + 12);
  const larger = Math.max(0, prey.size - hunter.size) / 9;
  return 0.09 * hunter.crushingJaws * Math.min(2, preyDerived.armorProtection)
    + 0.12 * hunter.venomDelivery * (0.25 + larger) / (1 + prey.detoxification)
    + (hunter.movement ? 0.12 * hunter.pursuitEndurance * mobility : 0)
    + (water && hunter.movement ? 0.15 * hunter.jetPropulsion * mobility : 0)
    + (water ? 0.12 * hunter.electricalSensing : 0.1 * hunter.vibrationSensing) * mobility
    + (water ? 0.035 * hunter.vibrationSensing * mobility : 0)
    + 0.14 * hunter.lureDisplay * mobility / (1 + hunterSpeed)
    - 0.08 * prey.autotomy * Math.min(1, hunter.size / prey.size)
    - (water ? 0.15 * prey.inkDefense * visual : 0)
    - 0.14 * prey.startleDisplay * visual * (1 - group)
    - 0.14 * prey.mimicry * visual / (1 + hunter.echolocation + hunter.thermalSensing
      + (water ? hunter.electricalSensing : 0))
    - (!water ? 0.085 * prey.rollingDefense * Math.min(2, prey.armor) + 0.1 * prey.alarmCalls * herd : 0)
    + 0.025 * prey.lureDisplay + (!water && mobileConsumer(prey) ? 0.025 * prey.basking : 0)
    - 0.025 * hunter.alarmCalls;
}

export function adaptationHunting(g, prey, habitat, speed) {
  return habitat === 'water' && prey.size < g.size
    ? (1 + 0.35 * g.mucusNet / (1 + speed)) / (1 + 0.06 * g.mucusNet * speed)
    : 1 / (1 + 0.08 * g.mucusNet);
}

export function adaptationDemography(g, habitat, stress, starvation, support, openSpace) {
  const social = Math.max(0, support - 1) / (Math.max(0, support - 1) + 12);
  return {
    recruitment: (1 + 0.24 * g.rapidGrowth * openSpace)
      * (1 + (habitat === 'land' ? 0.5 * g.nurseryShelter * stress * social
        : 0.42 * g.broodPouch * stress))
      / (1 + 0.055 * g.autotomy + 0.05 * g.longevityRepair + 0.08 * g.reproductiveRestraint),
    backgroundMortality: (1 + 0.08 * g.rapidGrowth) / (1 + 0.3 * g.longevityRepair),
    starvationMortality: 1 / (1 + 0.28 * g.longevityRepair * starvation
      + 0.5 * g.reproductiveRestraint * stress),
  };
}
