import { describeGenome, deriveGenome, genomeKey, TRAITS, validateGenome } from './genes/genome.js';

// Accepted genomes only. A candidate has no inherited history until established.
export function recordGenome(record, day, kind, parentRevision = null) {
  record.genomeHistory ??= [];
  record.genomeHistory.push({ day, kind, revision: record.genomeRevision,
    parentRevision, genome: { ...record.genome } });
}

export function validateLineage(records, day) {
  const byId = new Map(records.map(record => [record.id, record]));
  if (byId.size !== records.length) throw new TypeError('Invalid lineage identities.');
  const integer = value => Number.isSafeInteger(value) && value >= 0;
  const visited = new Set();
  for (const record of records) {
    if (!record || typeof record.id !== 'string' || typeof record.name !== 'string'
      || !integer(record.originDay) || record.originDay > day
      || !(record.extinctDay === null || integer(record.extinctDay)
        && record.extinctDay >= record.originDay && record.extinctDay <= day)
      || !validateGenome(record.genome) || !integer(record.genomeRevision) || record.genomeRevision < 1) {
      throw new TypeError('Invalid lineage record.');
    }
    const path = new Set();
    let node = record;
    while (node && !visited.has(node.id)) {
      if (path.has(node.id)) throw new TypeError('Cyclic lineage.');
      path.add(node.id);
      const parent = byId.get(node.parentId);
      if (node.parentId !== null && (!parent || parent.originDay > node.originDay
        || parent.extinctDay !== null && parent.extinctDay < node.originDay)) throw new TypeError('Invalid lineage parent.');
      node = parent;
    }
    for (const id of path) visited.add(id);
    const history = record.genomeHistory;
    if (history === undefined) continue; // Compatible saves did not retain accepted changes.
    if (!Array.isArray(history) || !history.length) throw new TypeError('Invalid genome history.');
    for (const [index, event] of history.entries()) {
      const previous = history[index - 1];
      if (!event || !integer(event.day) || event.day < record.originDay
        || event.day > (record.extinctDay ?? day) || !validateGenome(event.genome)
        || !integer(event.revision) || event.revision < 1
        || !['origin', 'adaptation', 'snapshot'].includes(event.kind)
        || index === 0 && event.kind === 'adaptation'
        || index > 0 && (event.kind !== 'adaptation' || event.day < previous.day
          || event.revision !== previous.revision + 1)
        || event.kind === 'origin' && (event.revision !== 1 || event.day !== record.originDay)
        || !(event.parentRevision === null || integer(event.parentRevision) && event.parentRevision > 0)
        || event.parentRevision !== null && (event.kind !== 'origin' || !record.parentId
          || event.parentRevision > byId.get(record.parentId).genomeRevision)) {
        throw new TypeError('Invalid genome history.');
      }
      if (event.parentRevision !== null) {
        const parentHistory = byId.get(record.parentId).genomeHistory;
        const parentEvent = parentHistory?.find(row => row.revision === event.parentRevision);
        if (parentEvent && parentEvent.day > event.day
          || parentHistory?.some(row => row.revision > event.parentRevision && row.day <= event.day)) {
          throw new TypeError('Invalid inherited revision.');
        }
      }
    }
    if (history.at(-1).revision !== record.genomeRevision
      || genomeKey(history.at(-1).genome) !== genomeKey(record.genome)) throw new TypeError('Genome history does not match species.');
  }
}

const attemptsOf = state => [...state.previousAttempts,
  { runId: state.runId, startDay: state.startDay, endDay: state.day, species: state.species }];

/** Detached common observations; historical private genomes never cross to UI. */
export function observeTree(state) {
  const populations = new Map();
  const ranges = new Map();
  for (const row of state.populations) {
    populations.set(row.speciesId, (populations.get(row.speciesId) ?? 0) + row.count);
    if (!ranges.has(row.speciesId)) ranges.set(row.speciesId, new Set());
    ranges.get(row.speciesId).add(row.hexId);
  }
  return { runId: state.runId, revision: state.revision, day: state.day,
    attempts: attemptsOf(state).map((attempt, index) => ({
      runId: attempt.runId, number: index + 1, startDay: attempt.startDay, endDay: attempt.endDay,
      species: attempt.species.map(record => {
        const derived = deriveGenome(record.genome);
        const current = attempt.runId === state.runId;
        return { id: record.id, name: record.name, parentId: record.parentId,
          originDay: record.originDay, extinctDay: record.extinctDay,
          population: current ? populations.get(record.id) ?? 0 : 0,
          occupiedHexes: current ? ranges.get(record.id)?.size ?? 0 : 0,
          role: derived.role, habitats: derived.habitats, mobile: record.genome.movement > 0,
          traits: describeGenome(record.genome),
          historyComplete: record.genomeHistory?.[0]?.kind === 'origin' };
      }),
    })) };
}

/** Follow the exact parent revision at branching, never the parent's later genome. */
export function inspectGeneHistory(state, runId, speciesId, key) {
  const definition = TRAITS.find(trait => trait.key === key);
  if (!definition) throw new RangeError('Unknown gene.');
  const attempt = attemptsOf(state).find(row => row.runId === runId);
  const byId = new Map(attempt?.species.map(record => [record.id, record]) ?? []);
  let record = byId.get(speciesId);
  if (!record) throw new RangeError('Unknown lineage species.');
  let limit = record.genomeRevision;
  let latestDay = record.extinctDay ?? attempt.endDay;
  const selectedEndDay = latestDay;
  let complete = true;
  const segments = [];
  const visited = new Set();
  while (record && !visited.has(record.id)) {
    visited.add(record.id);
    const recorded = record.genomeHistory ?? [{ day: record.extinctDay ?? attempt.endDay,
      kind: 'snapshot', revision: record.genomeRevision, genome: record.genome, parentRevision: null }];
    const events = recorded.filter(event => event.revision <= limit && event.day <= latestDay);
    if (!events.length) { complete = false; break; }
    segments.push(events.map(event => ({ speciesId: record.id, parentId: record.parentId, name: record.name, day: event.day,
      kind: event.kind, trait: describeGenome(event.genome).find(trait => trait.key === key) })));
    const first = events[0];
    if (first.kind !== 'origin') { complete = false; break; }
    if (!record.parentId) break;
    if (first.parentRevision === null) { complete = false; break; }
    limit = first.parentRevision;
    latestDay = first.day;
    record = byId.get(record.parentId);
    if (!record) complete = false;
  }
  let previous = null;
  const events = [];
  for (const event of segments.reverse().flat()) {
    const changed = !previous || previous.trait.value !== event.trait.value;
    if (changed || event.kind === 'origin' || event.kind === 'snapshot') {
      const kind = event.kind === 'snapshot' ? 'snapshot'
        : !previous ? event.parentId ? 'branch' : 'founder' : !changed ? 'inherited'
          : !previous.trait.active && event.trait.active ? 'appearance'
            : previous.trait.active && !event.trait.active ? 'loss' : 'change';
      events.push({ ...event, kind });
    }
    previous = event;
  }
  // Only the inherited path from its earliest recorded active expression.
  // Ancestors end at the next split, not at their own later extinction/day.
  const firstAppearance = events.find(event => event.trait.active) ?? null;
  const lineage = [];
  for (const event of firstAppearance ? events.slice(events.indexOf(firstAppearance)) : []) {
    let branch = lineage.at(-1);
    if (branch?.speciesId !== event.speciesId) {
      if (branch) branch.endDay = event.day;
      branch = { speciesId: event.speciesId, endDay: selectedEndDay,
        complete: byId.get(event.speciesId).genomeHistory?.[0]?.kind === 'origin', events: [] };
      lineage.push(branch);
    }
    branch.events.push({ day: event.day, trait: { ...event.trait } });
  }
  // Each branch keeps its own full lifetime, independently of the selected
  // ancestral path. Unknown time before a legacy snapshot is never filled in.
  const branches = attempt.species.map(species => {
    const endDay = species.extinctDay ?? attempt.endDay;
    const history = species.genomeHistory ?? [{ day: endDay, kind: 'snapshot', genome: species.genome }];
    const changes = [];
    let previousTrait = null;
    for (const event of history) {
      const trait = describeGenome(event.genome).find(trait => trait.key === key);
      if (!previousTrait || trait.value !== previousTrait.value) {
        changes.push({ day: event.day, trait });
      }
      previousTrait = trait;
    }
    return { speciesId: species.id, endDay, complete: history[0].kind === 'origin', events: changes };
  });
  const quantitative = definition.max > 1
    && !['temperatureTolerance', 'landAdaptation', 'skeleton', 'armorType'].includes(key);
  return { runId, speciesId, key, revision: state.revision, complete, events, branches, lineage, quantitative,
    firstAppearance };
}
