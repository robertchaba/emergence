import { workerFixture } from './life-workers.js';

// Deliberately crowded and sparse communities, not an evolved ecosystem.
export function lightCompetitionFixture() {
  const { world, checkpoint } = workerFixture({ speciesCount: 3 });
  const genome = checkpoint.species[0].genome;
  checkpoint.species.forEach((record, index) => {
    record.genome = { ...genome, size: 3, movement: 0,
      photosynthesis: Number(index < 2), plantFeeding: Number(index > 0), animalFeeding: 0 };
    record.candidates = [];
  });
  const hexIds = [...new Set(checkpoint.populations.map(row => row.hexId))].slice(0, 2);
  checkpoint.populations = hexIds.flatMap((hexId, site) => checkpoint.species.map((record, index) => ({
    speciesId: record.id, hexId, habitat: 'water', count: site ? 1 : [20000, 10000, 400][index], reserve: 1,
  })));
  return { world, checkpoint, hexIds };
}
