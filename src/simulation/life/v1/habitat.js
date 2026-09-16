const clamp = (value) => Math.min(1, Math.max(0, value));
export const hasWater = (hex) => hex.waterType !== 'none' || hex.runoff > 0;
export const hasLand = (hex) => hex.waterType === 'none';
const surface = (hex) => hex.waterType === 'none' ? hex.bedElevation : hex.waterLevel;

export function temperatureFactor(derived, temperature) {
  return Math.max(0, 1 - Math.max(derived.temperatureRange[0] - temperature,
    temperature - derived.temperatureRange[1], 0) / 10);
}

export function supportsHabitat(genome, hex, habitat) {
  if (hex.permanentIce) return false;
  return habitat === 'water' ? genome.landAdaptation <= 1 && hasWater(hex)
    : genome.landAdaptation >= 1 && hasLand(hex) && hex.bedElevation < 3500;
}

export function directWaterAccess(hex, hexes) {
  if (hex.runoff > 0 && !hex.permanentIce) return true;
  return hex.neighbors.some((id) => {
    const neighbor = hexes[id];
    return neighbor.waterType !== 'none' && !neighbor.permanentIce
      && Math.abs(surface(hex) - surface(neighbor)) < 1000 && hex.bedElevation < 3500;
  });
}

export function habitatFactor(genome, hex, habitat, directWater) {
  if (!supportsHabitat(genome, hex, habitat)) return 0;
  if (habitat === 'water') return genome.landAdaptation === 0 ? 1 : 0.9;
  const moisture = Math.max(hex.humidity ?? 0, directWater ? 0.85 : 0);
  return clamp(moisture / [0, 0.85, 0.5, 0.25][genome.landAdaptation]);
}

export function waterConnected(source, destination) {
  if (!hasWater(source) || !hasWater(destination)) return false;
  if (source.waterType !== 'none' && destination.waterType !== 'none') return true;
  return source.downstream === destination.id || destination.downstream === source.id;
}

/** Hard connection only: soft conditions never cut a classification edge. */
export function canCross(genome, source, sourceHabitat, destination, destinationHabitat) {
  if (source.permanentIce || !supportsHabitat(genome, destination, destinationHabitat)) return false;
  if (source.id === destination.id) return true;
  if (!source.neighbors.includes(destination.id)) return false;
  if (sourceHabitat === 'water' && destinationHabitat === 'water') return waterConnected(source, destination);
  if ((sourceHabitat === 'land' && source.bedElevation >= 3500)
    || (destinationHabitat === 'land' && destination.bedElevation >= 3500)) return false;
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
      : Math.max(Math.max(0, hex.bedElevation) / 3500, Math.min(0.5, 0.1 * Math.log2(1 + hex.runoff)));
    terrain = Math.max(difficulty(source, sourceHabitat), difficulty(destination, destinationHabitat),
      Math.abs(surface(source) - surface(destination)) / 1000);
  }
  return clamp(Math.max(terrain, 1 - temperatureFactor(derived, destination.temperature),
    1 - habitatFactor(genome, destination, destinationHabitat, directWater)));
}
