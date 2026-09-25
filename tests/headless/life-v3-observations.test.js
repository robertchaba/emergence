import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreLifeModel } from '../../src/simulation/life/v3/model.js';
import { evaluateObservationJobs } from '../../src/simulation/life/v3/observation-jobs.js';
import { workerFixture } from '../fixtures/life-workers-v3.js';

const withoutDetailMetadata = ({ detailLevel, tendencyCount, ...record }) => record;

test('compact observations retain the exact census while scoring only requested adaptation ranges', async () => {
  const { world, checkpoint } = workerFixture();
  const reference = restoreLifeModel(world, checkpoint);
  const full = reference.observe();
  let assessments = 0;
  let descriptions = 0;
  const model = restoreLifeModel(world, checkpoint, {
    'life.assess': entering => { assessments += Number(entering); },
    'genes.describe': entering => { descriptions += Number(entering); },
  });
  const before = model.exportState();
  const noJobs = () => { throw new Error('Summary/genes must not dispatch range jobs.'); };
  const summary = await model.observeAsync(noJobs, { detail: 'summary' });
  assert.equal(summary.detailLevel, 'summary');
  for (const key of ['counts', 'hexes', 'history', 'stats', 'revision', 'day']) assert.deepEqual(summary[key], full[key]);
  for (const record of summary.species) {
    const complete = full.species.find(species => species.id === record.id);
    assert.deepEqual(record.locations, complete.locations);
    assert.equal(record.population, complete.population);
    assert.equal(record.tendencyCount, complete.tendencies.length);
    assert.equal(record.traits, undefined);
    assert.equal(record.tendencies, undefined, 'omitted ranges are not represented as an empty result');
  }
  assert.equal(assessments, 0);
  const id = summary.species[0].id;
  const request = { detail: 'summary', speciesId: id };
  const genes = await model.observeAsync(noJobs, request);
  const established = genes.species.find(species => species.id === id);
  assert.deepEqual(established.traits, full.species.find(species => species.id === id).traits);
  assert.equal(established.detailLevel, 'genes');
  assert.equal(established.tendencies, undefined);
  assert.equal(assessments, 0);
  const described = descriptions;
  const originalGenes = structuredClone(genes);
  // Caller mutation cannot poison the cached projection or description cache.
  established.variants[0].traits[0].value = -1000;
  summary.species[0].summary.size.value = -1000;
  assert.deepEqual(model.observe(request), originalGenes);
  assert.notEqual(model.observe(request).species.find(species => species.id === id).variants[0].traits[0].value, -1000);
  model.advanceTo(1);
  model.observe(request);
  assert.equal(descriptions, described, 'unchanged genomes are not described again on a later day');
  reference.advanceTo(1);
  const detailed = await model.observeAsync(evaluateObservationJobs, { ...request, includeTendencies: true });
  const complete = reference.observe().species.find(species => species.id === id);
  assert.deepEqual(withoutDetailMetadata(detailed.species.find(species => species.id === id)), complete);
  assert.equal(assessments, complete.tendencies.length, 'only one selected species is assessed');
  assert.deepEqual(model.exportState(), reference.exportState());
  assert.deepEqual(before, JSON.parse(JSON.stringify(checkpoint)));
  assert.ok(JSON.stringify(summary).length < JSON.stringify(full).length / 2);
});

test('compact/full/parallel query ordering and cache invalidation preserve continuation', async () => {
  const { world, checkpoint } = workerFixture({ speciesCount: 24 });
  const model = restoreLifeModel(world, checkpoint);
  const reference = restoreLifeModel(world, checkpoint);
  let dispatched = 0;
  const request = { detail: 'summary', speciesId: 'species-1', includeTendencies: true };
  const execute = jobs => {
    dispatched += 1;
    assert.ok(jobs.every(job => job.queries.every(query => query.excludeSpeciesId === request.speciesId)));
    return evaluateObservationJobs(structuredClone(jobs).reverse());
  };
  for (const day of [1, 4, 41]) {
    model.advanceTo(day); reference.advanceTo(day);
    const detail = await model.observeAsync(execute, request);
    const full = reference.observe();
    assert.deepEqual(withoutDetailMetadata(detail.species.find(row => row.id === request.speciesId)),
      full.species.find(row => row.id === request.speciesId));
    assert.deepEqual(model.observe(), full);
    const summary = model.observe({ detail: 'summary' });
    assert.equal(summary.species[0].traits, undefined, 'a full cached result does not leak through summary mode');
    assert.deepEqual(model.exportState(), reference.exportState());
  }
  assert.ok(dispatched > 0);
  const restored = restoreLifeModel(world, model.exportState());
  restored.advanceTo(81); reference.advanceTo(81);
  assert.deepEqual(restored.exportState(), reference.exportState());
  assert.deepEqual(restored.observe(), reference.observe());
  assert.throws(() => model.observe({ detail: 'invalid' }), /Invalid observation/);
});
