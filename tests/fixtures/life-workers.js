import { generateWorld } from '../../src/simulation/world.js';
import { createLifeModel } from '../../src/simulation/life/v3/model.js';

// A busy mixed-community execution fixture, not an evolved/balanced ecosystem.
export function workerFixture() {
  const world = generateWorld({ seed: 'life-worker-pool', size: 'small' });
  const sites = world.hexes.filter(hex => hex.waterType !== 'none' && !hex.permanentIce);
  const life = createLifeModel(world);
  life.introduce(sites[0].id);
  const checkpoint = life.exportState();
  const original = checkpoint.species[0];
  checkpoint.species = Array.from({ length: 12 }, (_, index) => {
    const genome = { ...original.genome, size: index % 10 + 1, plantFeeding: index % 2,
      animalFeeding: Number(index > 3), movement: 1 };
    return { ...original, id: `species-${index + 1}`, name: `Fixture ${index + 1}`,
      genomeHistory: undefined, genome, candidates: [
        { genome: { ...genome, landAdaptation: 1 } },
        { genome: { ...genome, animalFeeding: 1 - genome.animalFeeding } },
      ].map((candidate, variant) => ({ ...candidate, id: `direction-${index * 2 + variant + 1}`,
        originDay: world.day, lastEvaluation: world.day, support: 0, advantage: 0, age: 0, steps: 1 })) };
  });
  checkpoint.populations = sites.flatMap(hex => checkpoint.species.map(record => ({
    speciesId: record.id, hexId: hex.id, habitat: 'water', count: 20, reserve: 1 })));
  checkpoint.nextSpecies = 13; checkpoint.nextCandidate = 25;
  return { world, checkpoint };
}
