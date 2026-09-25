// Browser/tooling diagnostics only. Inclusive timings overlap and are never
// consulted by the simulation. Keep aggregates bounded, even with output off.
export const PHASES = {
  'worker.command': ['worker', 'Whole command: calculation, observation, waiting for helpers and posting the reply.'],
  'worker.post': ['worker', 'Synchronous postMessage call: sender-side clone/enqueue, not full delivery latency.'],
  'worker.roundTrip': ['worker', 'UI request to reply: queueing, calculation, helper waits, cloning and delivery.'],
  'worker.restore': ['worker', 'Read/validate save, regenerate geography and build the first observation.'],
  'worker.export': ['worker', 'Copy checkpoint and encode downloadable save JSON.'],
  'worker.tree': ['worker', 'Build detached ancestry or gene-history query.'],
  'life.advance': ['simulation', 'Complete requested days; contains demography, dispersal, evolution and daily history.'],
  'life.demography': ['simulation', 'Group local populations, allocate finite food/light, calculate deaths, births and reserves.'],
  'life.dispersal': ['simulation', 'Find routes, score food-directed consumer destinations, move adults and merge populations.'],
  'life.evolution': ['simulation', 'Mutation trials, candidate assessments, novelty checks and accepted adaptations/branches. Runs every 12 biological turns.'],
  'life.history': ['simulation', 'Daily population/species census, extinction bookkeeping and bounded chart history.'],
  'life.communities': ['simulation', 'Build hex/habitat resident lists and environmental performance for ecological scores.'],
  'life.climate': ['climate', 'Compute physical climate on a cache miss; cached separately for each explicit day.'],
  'life.environment': ['detail', 'All environment lookups, including cache hits; compare calls with life.climate.'],
  'life.routes': ['detail', 'Check neighbouring habitats, barriers and rare dispersal routes for one population record.'],
  'life.assess': ['detail', 'Compare established/candidate genomes at occupied sources and reachable habitats.'],
  'life.score': ['detail', 'Score lookup including cache hits; cache misses recalculate the local community.'],
  'life.mutations': ['genes', 'Enumerate legal one-gene mutations and choose weighted trial directions.'],
  'life.novelty': ['detail', 'Compare prospective genomes with existing species for ecological distinctness.'],
  'genes.derive': ['genes', 'Derive phenotype on a genome cache miss: body size, costs, ranges and acquisition shares.'],
  'genes.describe': ['genes', 'Describe a genome on a cache miss; unchanged established/candidate genomes reuse their descriptions.'],
  'ecology.prepare': ['ecology', 'Prepare resident phenotypes and environmental suitability for a community evaluation.'],
  'ecology.light': ['ecology', 'Allocate finite photosynthetic resources among resident demands.'],
  'ecology.feedingSetup': ['ecology', 'Allocate feeding arrays and compute remaining grazing/hunting demands.'],
  'ecology.grazing': ['ecology', 'Plant-source × consumer comparisons, canopy/defence access and finite food allocation.'],
  'ecology.hunting': ['ecology', 'Prey-source × predator comparisons, capture, effort, finite kills and food transfer.'],
  'ecology.rates': ['ecology', 'Convert intake/upkeep into birth, death, starvation and growth scores.'],
  'observation.total': ['observations', 'Requested detached observation: compact census plus opened details, or explicit full query; includes helper waits and copying.'],
  'observation.assemble': ['observations', 'Build species census, per-hex counts/display groups and only requested traits/adaptation ranges.'],
  'observation.copy': ['observations', 'JSON-copy completed observation to protect model ownership.'],
  'observation.prepare': ['observations', 'Construct and deduplicate candidate/parent scoring jobs across occupied and reachable habitats.'],
  'observation.detach': ['observations', 'Detach helper job graph while retaining shared genome/phenotype references.'],
  'pool.total': ['helpers', 'Schedule read-only jobs, coordinator share and helper wait; includes transport, not just compute.'],
  'pool.local': ['helpers', 'Evaluate the coordinator share, small serial workload or failure fallback.'],
  'pool.helper': ['helpers', 'Evaluate one helper batch; each helper reports independently.'],
  'ui.accept': ['ui', 'Accept a completed revision: atlas climate, notebook DOM, readouts and interaction state.'],
  'ui.climate': ['climate', 'Refresh climate for the entire atlas at a completed day.'],
  'ui.notebook': ['ui', 'Update notebook counts, species/gene DOM, candidate details and history chart.'],
  'ui.draw': ['rendering', 'Canvas draw plus camera/readout updates; excludes deferred browser layout/compositing.'],
  'generation.total': ['generation', 'Generate physical world, drainage, climate and geographic regions.'],
};

export function validateDebugConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Expected a JSON object.');
  const allowed = ['enabled', 'reportIntervalMs', 'measure', 'output'];
  for (const key of Object.keys(config)) if (!allowed.includes(key)) throw new Error(`Unknown debug setting: ${key}`);
  if (typeof config.enabled !== 'boolean') throw new Error('enabled must be boolean.');
  if (!Number.isFinite(config.reportIntervalMs) || config.reportIntervalMs < 250) throw new Error('reportIntervalMs must be at least 250.');
  const groups = new Set([...Object.values(PHASES).map(([group]) => group), ...Object.keys(PHASES), 'workload']);
  for (const field of ['measure', 'output']) {
    if (!config[field] || typeof config[field] !== 'object' || Array.isArray(config[field])) throw new Error(`${field} must be an object.`);
    const keys = field === 'measure' ? groups : new Set([...groups, 'startup', 'descriptions', 'collapsed']);
    for (const [key, value] of Object.entries(config[field])) {
      if (!keys.has(key) || typeof value !== 'boolean') throw new Error(`Invalid ${field}.${key}; expected a known boolean switch.`);
    }
  }
  return config;
}

export function createDebugProfiler(config, { label = 'UI', now = () => performance.now(), logger = console } = {}) {
  validateDebugConfig(config);
  const totals = new Map();
  const listeners = {};
  let context = null;
  let completedCommands = 0;
  let completedDays = 0;
  let intervalStart = null;
  const enabled = id => config.enabled && (config.measure[id] ?? config.measure[PHASES[id]?.[0]]) === true;
  const printed = id => (config.output[id] ?? config.output[PHASES[id][0]]) === true;
  function record(id, elapsed) {
    const row = totals.get(id) ?? { calls: 0, totalMs: 0, maxMs: 0 };
    row.calls += 1; row.totalMs += elapsed; row.maxMs = Math.max(row.maxMs, elapsed);
    totals.set(id, row);
  }
  function start(id) {
    if (!enabled(id)) return null;
    const time = now();
    intervalStart ??= time;
    return { id, time };
  }
  function end(token) { if (token) record(token.id, Math.max(0, now() - token.time)); }
  for (const id of Object.keys(PHASES)) {
    if (!enabled(id)) continue;
    const stack = [];
    listeners[id] = entering => { if (entering) stack.push(start(id)); else end(stack.pop()); };
  }
  function wrap(id, fn) {
    if (!enabled(id)) return fn;
    return function (...args) {
      const token = start(id);
      try { return fn.apply(this, args); } finally { end(token); }
    };
  }
  async function measureAsync(id, fn) {
    const token = start(id);
    try { return await fn(); } finally { end(token); }
  }
  function workload(observation, command) {
    if (!config.enabled || !config.measure.workload) return;
    intervalStart ??= now();
    if (command === 'advance' && context?.runId === observation.runId) completedDays += Math.max(0, observation.day - context.day);
    completedCommands += 1;
    context = { command, runId: observation.runId, day: observation.day, revision: observation.revision,
      biologicalTurns: observation.biologicalTurns, organisms: observation.counts.organisms,
      livingSpecies: observation.counts.species, extinctSpecies: observation.counts.extinctSpecies,
      occupiedHexes: observation.counts.occupiedHexes, populationPools: observation.approximation.populationPools,
      candidateDirections: observation.classification.qualifyingPairs };
  }
  function flush() {
    if (!totals.size && !completedCommands) return;
    const elapsed = Math.max(0, now() - intervalStart);
    const rows = [...totals].filter(([id]) => printed(id))
      .sort((a, b) => b[1].totalMs - a[1].totalMs).map(([id, row]) => ({
        phase: id, calls: row.calls, totalMs: +row.totalMs.toFixed(3),
        averageMs: +(row.totalMs / row.calls).toFixed(3), maxMs: +row.maxMs.toFixed(3),
        ...(config.output.descriptions ? { calculation: PHASES[id][1] } : {}),
      }));
    const showWorkload = config.output.workload && completedCommands;
    if (rows.length || showWorkload) {
      const title = `[Emergence debugdev] ${label} — ${(elapsed / 1000).toFixed(1)}s window${context ? `, day ${context.day}` : ''}`;
      logger[config.output.collapsed ? 'groupCollapsed' : 'group'](title);
      logger.log('Elapsed timings are INCLUSIVE: nested rows overlap; concurrent workers overlap. Do not add rows or workers into a wall-time total. Calls count executions, not organisms.');
      if (rows.length) logger.table(rows);
      if (showWorkload) logger.log('Latest completed workload (pools are species × hex × habitat records; directions are hypotheses, not organisms):',
        { ...context, completedCommands, completedDays, completedDaysPerSecond: elapsed > 0 ? +(completedDays * 1000 / elapsed).toFixed(2) : 0 });
      logger.groupEnd();
    }
    totals.clear(); completedCommands = 0; completedDays = 0; intervalStart = now();
    return rows;
  }
  function announce() {
    if (!config.enabled || !config.output.startup) return;
    logger.info(`[Emergence debugdev] ENABLED in ${label}. Edit degugdev-config.json and restart npm run debugdev. Reports every ${config.reportIntervalMs}ms of active work; biology is unchanged. Console/profiling overhead affects measured speed.`);
    logger.table(Object.entries(PHASES).map(([phase, [group, calculation]]) => ({ phase, group,
      measured: enabled(phase), printed: enabled(phase) && printed(phase), calculation })));
    logger.info('detail/ecology/genes/climate add frequent clock reads. Enable only when investigating those costs. Zero/missing rows mean no measured calls, not that a rule was skipped. Worker round-trip is end-to-end latency; postMessage measures sender work only.');
  }
  return { listeners, start, end, wrap, measureAsync, workload, flush, announce };
}
