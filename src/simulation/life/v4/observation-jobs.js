import { scoreSpecies } from './ecology.js';

/** Pure V4 calculations over a detached completed census. Neither worker count
 * nor completion order changes the arithmetic within any ecological score. */
export function evaluateObservationJobs(jobs, diagnostics) {
  const ecologyDiagnostics = diagnostics && Object.keys(diagnostics).some(key => key.startsWith('ecology.')) ? diagnostics : undefined;
  return jobs.flatMap(({ hex, habitat, community, queries }) => queries.map(query => [query.key,
    { score: scoreSpecies(query.genome, hex, habitat, community, { population: 1,
      excludeSpeciesId: query.excludeSpeciesId, independentLineage: query.independentLineage,
      derived: query.derived, diagnostics: ecologyDiagnostics }).score }]));
}

/** Preserve shared immutable genome/phenotype references in the detached job
 * graph. JSON copying would duplicate them at every hex and every query. */
export function detachObservationJobs(jobs) {
  const seen = new Map();
  function detach(value) {
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    const result = Array.isArray(value) ? [] : {};
    seen.set(value, result);
    for (const key of Object.keys(value)) result[key] = detach(value[key]);
    return result;
  }
  return detach(jobs);
}

// A presentation-work estimate, never a biological coefficient. Keep each
// community together so its census crosses the execution boundary just once.
export function observationJobCost(job) {
  return job.queries.length * (job.community.length + 1) ** 2;
}
