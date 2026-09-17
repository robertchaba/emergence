import { canCross, chooseHabitat, habitatFactor, supportsHabitat, surface } from './habitat.js';
import { deriveGenome } from './genes/genome.js';

const habitats = (preferred) => [preferred, preferred === 'land' ? 'water' : 'land'];
const terrainDifficulty = (source, destination) => Math.min(1,
  Math.max(Math.abs(surface(source) - surface(destination)) / 1500,
    Math.max(0, source.bedElevation, destination.bedElevation) / 5500));

/** Pure route descriptions, not arrivals. Delays are complete biological turns.
 * A caller must preserve waiting carriers, elapsed time and one arrival roll in
 * its checkpoint. An unsupported intermediate hex never acquires residents. */
export function dispersalRoutes(genome, source, sourceHabitat, hexes) {
  const routes = new Map();
  const flight = genome.flight && genome.movement
    ? Math.min(2, Math.max(0, deriveGenome(genome).flightEfficiency)) : 0;
  const add = (destination, habitat, delay, probability, difficulty) => {
    const key = `${destination.id}:${habitat}`;
    const route = { hexId: destination.id, habitat, delay: Math.ceil(delay), probability, difficulty };
    const previous = routes.get(key);
    if (!previous || route.delay < previous.delay
      || route.delay === previous.delay && route.probability > previous.probability) routes.set(key, route);
  };
  for (const neighborId of [...source.neighbors].sort((a, b) => a - b)) {
    const neighbor = hexes[neighborId];
    const normalHabitat = chooseHabitat(genome, source, sourceHabitat, neighbor);
    if (normalHabitat) {
      const difficulty = normalHabitat === 'water' && sourceHabitat === 'water' ? 0
        : terrainDifficulty(source, neighbor);
      add(neighbor, normalHabitat, 0, 1 / (1 + 4 * difficulty), difficulty);
    } else {
      const habitat = habitats(sourceHabitat).find((candidate) => supportsHabitat(genome, neighbor, candidate));
      if (habitat) {
        const difficulty = Math.max(0.65, terrainDifficulty(source, neighbor));
        add(neighbor, habitat, (90 + 90 * difficulty) / (1 + flight * 0.35),
          Math.min(0.65, 0.25 + 0.08 * flight), difficulty);
      }
    }
    // Only a single hostile intermediate cell can be crossed. Ordinary habitat
    // must be colonized normally; there is no free two-cell jump across plains.
    if (normalHabitat) continue;
    for (const destinationId of [...neighbor.neighbors].sort((a, b) => a - b)) {
      if (destinationId === source.id || source.neighbors.includes(destinationId)) continue;
      const destination = hexes[destinationId];
      const habitat = habitats(sourceHabitat).find((candidate) => supportsHabitat(genome, destination, candidate));
      if (!habitat) continue;
      // A rare one-cell corridor must really interrupt an ordinary route.
      if (habitats(sourceHabitat).some((middleHabitat) => canCross(genome, source, sourceHabitat,
        neighbor, middleHabitat) && canCross(genome, neighbor, middleHabitat, destination, habitat))) continue;
      const difficulty = Math.max(0.75, terrainDifficulty(source, neighbor), terrainDifficulty(neighbor, destination));
      const baseDelay = neighbor.permanentIce ? 240 : 180;
      const waterAvailable = destination.runoff > 0;
      const suitability = habitatFactor(genome, destination, habitat, waterAvailable);
      add(destination, habitat, baseDelay / (1 + flight * 0.35),
        Math.min(0.55, (0.16 + 0.06 * flight) * (0.5 + 0.5 * suitability)), difficulty);
    }
  }
  return [...routes.values()].sort((a, b) => a.hexId - b.hexId || (a.habitat < b.habitat ? -1 : 1));
}
