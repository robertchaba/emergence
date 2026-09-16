import { canCross } from './habitat.js';
import { geneticDistance } from './genes/genome.js';

const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const nodeKey = (hexId, habitat) => `${hexId}:${habitat}`;

function connected(a, b, genomes, hexes) {
  return a.cohorts.some((cohort) => canCross(genomes.get(cohort.genomeId).genome,
    hexes[a.hexId], a.habitat, hexes[b.hexId], b.habitat))
    || b.cohorts.some((cohort) => canCross(genomes.get(cohort.genomeId).genome,
      hexes[b.hexId], b.habitat, hexes[a.hexId], a.habitat));
}

/** Cohorts carry their previous component identity through births and movement.
 * Thus continuity follows carriers, including a whole component relocating. */
export function classify(cohorts, genomes, hexes, state, day, branch) {
  const speciesNodes = new Map();
  for (const cohort of cohorts) {
    if (!speciesNodes.has(cohort.speciesId)) speciesNodes.set(cohort.speciesId, new Map());
    const nodes = speciesNodes.get(cohort.speciesId);
    const key = nodeKey(cohort.hexId, cohort.habitat);
    if (!nodes.has(key)) nodes.set(key, { key, hexId: cohort.hexId, habitat: cohort.habitat, cohorts: [] });
    nodes.get(key).cohorts.push(cohort);
  }
  const oldGroups = new Map(state.groups.map((group) => [group.id, group]));
  const groups = [];
  for (const [speciesId, nodes] of [...speciesNodes].sort(([a], [b]) => order(a, b))) {
    const visited = new Set();
    const components = [];
    for (const start of nodes.values()) {
      if (visited.has(start.key)) continue;
      const queue = [start];
      visited.add(start.key);
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const current = queue[cursor];
        for (const hexId of [current.hexId, ...hexes[current.hexId].neighbors]) {
          for (const habitat of ['water', 'land']) {
            const key = nodeKey(hexId, habitat);
            if (visited.has(key) || !nodes.has(key)) continue;
            const candidate = nodes.get(key);
            if (connected(current, candidate, genomes, hexes)) {
              visited.add(key);
              queue.push(candidate);
            }
          }
        }
      }
      const members = queue.flatMap((node) => node.cohorts);
      const population = members.reduce((sum, cohort) => sum + cohort.count, 0);
      const variants = new Map();
      const provenance = new Map();
      for (const cohort of members) {
        variants.set(cohort.genomeId, (variants.get(cohort.genomeId) ?? 0) + cohort.count);
        if (oldGroups.has(cohort.groupId)) {
          provenance.set(cohort.groupId, (provenance.get(cohort.groupId) ?? 0) + cohort.count);
        }
      }
      const representative = [...variants].sort(([a, aCount], [b, bCount]) => bCount - aCount
        || genomes.get(a).establishedOrder - genomes.get(b).establishedOrder || order(a, b))[0];
      components.push({ speciesId, members, population, representative: representative[0],
        majority: representative[1] > population / 2, provenance, order: components.length });
    }
    // Largest carrier overlap wins an old ID; every old/new component matches once.
    const matches = components.flatMap((component) => [...component.provenance].map(([id, count]) =>
      ({ component, id, count, foundedDay: oldGroups.get(id).foundedDay })))
      .sort((a, b) => b.count - a.count || a.foundedDay - b.foundedDay
        || order(a.id, b.id) || a.component.order - b.component.order);
    const used = new Set();
    for (const match of matches) {
      if (match.component.id || used.has(match.id)) continue;
      match.component.id = match.id;
      match.component.foundedDay = match.foundedDay;
      used.add(match.id);
    }
    for (const component of components) {
      if (!component.id) {
        component.id = `group-${state.nextGroup++}`;
        component.foundedDay = day;
      }
      for (const cohort of component.members) cohort.groupId = component.id;
      groups.push(component);
    }
  }

  const timers = {};
  const qualifying = [];
  for (let aIndex = 0; aIndex < groups.length; aIndex += 1) {
    const a = groups[aIndex];
    if (a.population < 20 || !a.majority) continue;
    for (let bIndex = aIndex + 1; bIndex < groups.length; bIndex += 1) {
      const b = groups[bIndex];
      if (a.speciesId !== b.speciesId || b.population < 20 || !b.majority) continue;
      if (geneticDistance(genomes.get(a.representative).genome, genomes.get(b.representative).genome) < 3) continue;
      const key = `${a.speciesId}|${[a.id, b.id].sort().join('|')}`;
      timers[key] = (state.timers[key] ?? 0) + 1;
      if (timers[key] >= 100) qualifying.push({ key, a, b });
    }
  }
  const renamed = new Set();
  for (const { key, a, b } of qualifying.sort((a, b) => order(a.key, b.key))) {
    if (renamed.has(a.id) || renamed.has(b.id)) continue;
    const selected = a.population !== b.population ? (a.population < b.population ? a : b)
      : a.foundedDay !== b.foundedDay ? (a.foundedDay > b.foundedDay ? a : b)
        : (Number(a.id.slice(6)) > Number(b.id.slice(6)) ? a : b);
    selected.speciesId = branch(selected.speciesId);
    for (const cohort of selected.members) cohort.speciesId = selected.speciesId;
    renamed.add(selected.id);
    delete timers[key];
  }
  for (const key of Object.keys(timers)) {
    if (key.split('|').some((id) => renamed.has(id))) delete timers[key];
  }
  state.groups = groups.map(({ id, speciesId, foundedDay }) => ({ id, speciesId, foundedDay }));
  state.timers = timers;
  return { groups: groups.length, qualifyingPairs: Object.keys(timers).length,
    longestIsolation: Object.values(timers).reduce((longest, duration) => Math.max(longest, duration), 0) };
}
