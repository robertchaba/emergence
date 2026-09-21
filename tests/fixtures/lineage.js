import { generateWorld, setDay } from '../../src/simulation/world.js';
import { createLifeModel } from '../../src/simulation/life/v3/model.js';
import { founderGenome } from '../../src/simulation/life/v3/genes/genome.js';
import { recordGenome } from '../../src/simulation/life/v3/lineage.js';

// Explicit historical fixture, not a claim that these lineages evolved naturally.
export function lineageFixture() {
  const world = setDay(generateWorld({ seed: 'tree-of-life', size: 'small' }), 1);
  const model = createLifeModel(world, { runId: 'tree-fixture' });
  const state = model.exportState();
  const plant = founderGenome();
  function species(id, name, genome, day, parentId = null, parentRevision = null) {
    const record = { id, name, genome: { ...genome }, originDay: day, parentId,
      extinctDay: null, genomeRevision: 1, candidates: [] };
    recordGenome(record, day, 'origin', parentRevision);
    return record;
  }
  function adapt(record, day, changes) {
    record.genome = { ...record.genome, ...changes }; record.genomeRevision += 1;
    recordGenome(record, day, 'adaptation');
  }
  const root = species('species-1', 'Primora viridis', plant, 1);
  adapt(root, 10, { movement: 1 });
  const grazer = species('species-2', 'Veladora silvatica', { ...root.genome, photosynthesis: 0, plantFeeding: 1 }, 20, root.id, 2);
  adapt(grazer, 30, { movement: 0 }); adapt(grazer, 40, { movement: 1 });
  const hunter = species('species-3', 'Acutora nocturna', { ...grazer.genome, plantFeeding: 0, animalFeeding: 1 }, 50, grazer.id, 3);
  adapt(root, 60, { movement: 2 });
  const canopy = species('species-4', 'Arborea lucida', { ...root.genome, trunk: 2, size: 6 }, 80, root.id, 3);
  root.extinctDay = 100; grazer.extinctDay = 70;
  const old = species('species-1', 'Antiqua prima', plant, 0); old.extinctDay = 1;
  Object.assign(state, { introduced: true, day: 150, revision: 150, nextSpecies: 5,
    species: [root, grazer, hunter, canopy], populations: [hunter, canopy].map((row, index) => ({
      speciesId: row.id, hexId: 18 + index, habitat: 'water', count: 200 + index * 300, reserve: 1,
    })), previousAttempts: [{ runId: 'earlier-run', startDay: 0, endDay: 1, stats: { ...state.stats }, species: [old] }] });
  return { world, state };
}
