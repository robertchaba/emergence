const clamp = (value) => Math.min(1, Math.max(0, value));
export const hasWater = (hex) => hex.waterType !== 'none' || hex.runoff > 0;
export const hasLand = (hex) => hex.waterType === 'none';
export const surface = (hex) => hex.waterType === 'none' ? hex.bedElevation : hex.waterLevel;

export function temperatureFactor(derived, temperature) {
  return Math.max(0, 1 - Math.max(derived.temperatureRange[0] - temperature,
    temperature - derived.temperatureRange[1], 0) / 12);
}

/** Adaptation states 1 and 2 overlap: reversals need no uninhabitable intermediate. */
export function supportsHabitat(genome, hex, habitat) {
  if (hex.permanentIce) return false;
  if (habitat === 'water') return genome.landAdaptation <= 2 && hasWater(hex);
  return habitat === 'land' && genome.landAdaptation >= 1 && hasLand(hex)
    && hex.bedElevation < 5500;
}

export function directWaterAccess(hex, hexes) {
  if (hex.runoff > 0 && !hex.permanentIce) return true;
  return hex.neighbors.some((id) => {
    const neighbor = hexes[id];
    return hasWater(neighbor) && !neighbor.permanentIce
      && Math.abs(surface(hex) - surface(neighbor)) < 1000;
  });
}

export function habitatFactor(genome, hex, habitat, directWater) {
  if (!supportsHabitat(genome, hex, habitat)) return 0;
  // Shared climate describes current ice and exposed shallows; this model owns
  // their biological cost. Neither signal changes the physical habitat datum.
  const ice = 1 - 0.65 * clamp(hex.iceCover ?? 0);
  if (habitat === 'water') return [1, 0.92, 0.58][genome.landAdaptation]
    * ice * (1 - 0.8 * clamp(hex.waterExposure ?? 0));
  const moisture = Math.max(hex.humidity ?? 0, directWater ? 0.85 : 0);
  return clamp(moisture / [0, 0.8, 0.5, 0.25][genome.landAdaptation]) * ice;
}

export function waterConnected(source, destination) {
  if (!hasWater(source) || !hasWater(destination)) return false;
  if (source.waterType !== 'none' && destination.waterType !== 'none') return true;
  return source.downstream === destination.id || destination.downstream === source.id;
}

/** A normal one-turn connection. False may still permit delayed dispersal. */
export function canCross(genome, source, sourceHabitat, destination, destinationHabitat) {
  if (!supportsHabitat(genome, source, sourceHabitat)
    || !supportsHabitat(genome, destination, destinationHabitat)) return false;
  if (source.id === destination.id) return true;
  if (!source.neighbors.includes(destination.id)) return false;
  if (sourceHabitat === 'water' && destinationHabitat === 'water') return waterConnected(source, destination);
  if (Math.max(source.bedElevation, destination.bedElevation) >= 3500) return false;
  return Math.abs(surface(source) - surface(destination)) < 1000;
}

export function chooseHabitat(genome, source, sourceHabitat, destination) {
  for (const habitat of [sourceHabitat, sourceHabitat === 'water' ? 'land' : 'water']) {
    if (canCross(genome, source, sourceHabitat, destination, habitat)) return habitat;
  }
  return null;
}

export function crossingDifficulty(genome, derived, source, sourceHabitat, destination,
  destinationHabitat, directWater) {
  let terrain = 0;
  if (!(sourceHabitat === 'water' && destinationHabitat === 'water') && source.id !== destination.id) {
    const difficulty = (hex, habitat) => habitat === 'water' ? 0
      : Math.max(Math.max(0, hex.bedElevation) / 5500, Math.min(0.5, 0.1 * Math.log2(1 + hex.runoff)));
    terrain = Math.max(difficulty(source, sourceHabitat), difficulty(destination, destinationHabitat),
      Math.abs(surface(source) - surface(destination)) / 1500);
  }
  return clamp(Math.max(terrain, 1 - temperatureFactor(derived, destination.temperature),
    1 - habitatFactor(genome, destination, destinationHabitat, directWater)));
}
