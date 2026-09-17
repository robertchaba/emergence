import { canCross, supportsHabitat } from './habitat.js';
import { geneticDistance } from './genes/genome.js';

const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export const acquisitionSignature = (genome) => `${genome.photosynthesis}:${genome.plantFeeding}:${genome.animalFeeding}`;
const nodeKey = (hexId, habitat, niche) => `${hexId}:${habitat}:${niche}`;
const habitatIndex = (habitat) => habitat === 'water' ? 0 : 1;
const topologyCache = new WeakMap();
export const ISOLATION_RULES = Object.freeze({ minimumPopulation: 20, demeRadius: 1,
  minimumDistance: 4, barrierGeneticDistance: 2, distanceGeneticDistance: 3,
  ecologicalGeneticDistance: 3, barrierTurns: 240, distanceTurns: 420,
  ecologicalTurns: 360, minimumFlowShare: 0.12 });

// Geography is read-only. Immediate crossing depends only on land adaptation,
// so at most four immutable topology arrays are retained per physical atlas.
function habitatTopology(genome, hexes) {
  if (!topologyCache.has(hexes)) topologyCache.set(hexes, new Map());
  const cache = topologyCache.get(hexes);
  if (cache.has(genome.landAdaptation)) return cache.get(genome.landAdaptation);
  const labels = new Int32Array(hexes.length * 2);
  let component = 0;
  for (const hex of hexes) {
    for (const habitat of ['water', 'land']) {
      const start = hex.id * 2 + habitatIndex(habitat);
      if (labels[start] || !supportsHabitat(genome, hex, habitat)) continue;
      component += 1;
      labels[start] = component;
      const queue = [{ hex, habitat }];
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const current = queue[cursor];
        for (const nextId of [current.hex.id, ...current.hex.neighbors]) {
          const next = hexes[nextId];
          for (const nextHabitat of ['water', 'land']) {
            const index = nextId * 2 + habitatIndex(nextHabitat);
            if (labels[index] || !canCross(genome, current.hex, current.habitat, next, nextHabitat)) continue;
            labels[index] = component;
            queue.push({ hex: next, habitat: nextHabitat });
          }
        }
      }
    }
  }
  cache.set(genome.landAdaptation, labels);
  return labels;
}

function hasOrdinaryPath(genome, a, b, hexes) {
  const labels = habitatTopology(genome, hexes);
  const first = labels[a.hexId * 2 + habitatIndex(a.habitat)];
  return first > 0 && first === labels[b.hexId * 2 + habitatIndex(b.habitat)];
}

function flowing(a, b, genomes, hexes) {
  const capableShare = (source, destination) => source.cohorts.reduce((sum, cohort) => sum
    + (canCross(genomes.get(cohort.genomeId).genome, hexes[source.hexId], source.habitat,
      hexes[destination.hexId], destination.habitat) ? cohort.count : 0), 0) / source.population;
  return capableShare(a, b) >= ISOLATION_RULES.minimumFlowShare
    && capableShare(b, a) >= ISOLATION_RULES.minimumFlowShare;
}

function nearbyHexes(hexId, hexes) {
  const visited = new Set([hexId]);
  let frontier = [hexId];
  for (let distance = 1; distance < ISOLATION_RULES.minimumDistance; distance += 1) {
    const next = [];
    for (const id of frontier) for (const neighbor of hexes[id].neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor); next.push(neighbor);
    }
    frontier = next;
  }
  return visited;
}

/** Persistent local demes, with rare migrants distinct from effective gene flow.
 * `day` is the explicit physical day; timers advance once per biological call. */
export function classify(cohorts, genomes, hexes, state, day, branch) {
  const speciesNodes = new Map();
  for (const cohort of cohorts) {
    if (cohort.count <= 0) continue;
    if (!speciesNodes.has(cohort.speciesId)) speciesNodes.set(cohort.speciesId, new Map());
    const nodes = speciesNodes.get(cohort.speciesId);
    const niche = acquisitionSignature(genomes.get(cohort.genomeId).genome);
    const key = nodeKey(cohort.hexId, cohort.habitat, niche);
    if (!nodes.has(key)) nodes.set(key, { key, hexId: cohort.hexId, habitat: cohort.habitat,
      niche, cohorts: [], population: 0, neighbors: [] });
    nodes.get(key).cohorts.push(cohort);
    nodes.get(key).population += cohort.count;
  }
  const oldGroups = new Map(state.groups.map((group) => [group.id, group]));
  const groups = [];
  for (const [speciesId, nodes] of [...speciesNodes].sort(([a], [b]) => order(a, b))) {
    const sortedNodes = [...nodes.values()].sort((a, b) => a.hexId - b.hexId
      || order(a.habitat, b.habitat) || order(a.niche, b.niche));
    for (const node of sortedNodes) {
      for (const hexId of [node.hexId, ...hexes[node.hexId].neighbors]) {
        for (const habitat of ['water', 'land']) {
          const candidate = nodes.get(nodeKey(hexId, habitat, node.niche));
          if (!candidate || candidate === node || !flowing(node, candidate, genomes, hexes)) continue;
          node.neighbors.push(candidate);
        }
      }
      node.neighbors.sort((a, b) => a.hexId - b.hexId || order(a.habitat, b.habitat));
    }
    let component = 0;
    for (const start of sortedNodes) {
      if (start.component !== undefined) continue;
      start.component = component++;
      const queue = [start];
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        for (const candidate of queue[cursor].neighbors) {
          if (candidate.component !== undefined) continue;
          candidate.component = start.component;
          queue.push(candidate);
        }
      }
    }
    // Reuse previous occupied anchors before extending into newly occupied space.
    const anchors = state.groups.filter((group) => group.speciesId === speciesId && nodes.has(group.anchor))
      .sort((a, b) => a.foundedDay - b.foundedDay || order(a.id, b.id)).map((group) => nodes.get(group.anchor));
    const visited = new Set();
    const demes = [];
    for (const start of [...anchors, ...sortedNodes]) {
      if (visited.has(start.key)) continue;
      const queue = [{ node: start, distance: 0 }];
      visited.add(start.key);
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const current = queue[cursor];
        if (current.distance >= ISOLATION_RULES.demeRadius) continue;
        for (const candidate of current.node.neighbors) {
          if (visited.has(candidate.key)) continue;
          visited.add(candidate.key);
          queue.push({ node: candidate, distance: current.distance + 1 });
        }
      }
      const members = queue.flatMap(({ node }) => node.cohorts);
      const population = members.reduce((sum, cohort) => sum + cohort.count, 0);
      const variants = new Map();
      const provenance = new Map();
      for (const cohort of members) {
        variants.set(cohort.genomeId, (variants.get(cohort.genomeId) ?? 0) + cohort.count);
        const previous = oldGroups.get(cohort.groupId);
        if (previous && (previous.niche === undefined || previous.niche === start.niche)) {
          provenance.set(cohort.groupId, (provenance.get(cohort.groupId) ?? 0) + cohort.count);
        }
      }
      const representative = [...variants].sort(([a, aCount], [b, bCount]) => bCount - aCount
        || genomes.get(a).establishedOrder - genomes.get(b).establishedOrder || order(a, b))[0][0];
      demes.push({ speciesId, members, population, representative, provenance, anchor: start.key, niche: start.niche,
        location: start, component: start.component, order: demes.length });
    }
    const matches = demes.flatMap((deme) => [...deme.provenance].map(([id, count]) =>
      ({ deme, id, count, foundedDay: oldGroups.get(id).foundedDay })))
      .sort((a, b) => b.count - a.count || a.foundedDay - b.foundedDay
        || order(a.id, b.id) || a.deme.order - b.deme.order);
    const used = new Set();
    for (const match of matches) {
      if (match.deme.id || used.has(match.id)) continue;
      match.deme.id = match.id;
      match.deme.foundedDay = match.foundedDay;
      used.add(match.id);
    }
    for (const deme of demes) {
      if (!deme.id) { deme.id = `group-${state.nextGroup++}`; deme.foundedDay = day; }
      for (const cohort of deme.members) cohort.groupId = deme.id;
      groups.push(deme);
    }
  }

  const timers = {};
  const qualifying = [];
  const nearby = new Map();
  const geneticDistances = new Map();
  for (let aIndex = 0; aIndex < groups.length; aIndex += 1) {
    const a = groups[aIndex];
    if (a.population < ISOLATION_RULES.minimumPopulation) continue;
    for (let bIndex = aIndex + 1; bIndex < groups.length; bIndex += 1) {
      const b = groups[bIndex];
      if (a.speciesId !== b.speciesId || b.population < ISOLATION_RULES.minimumPopulation) continue;
      const aGenome = genomes.get(a.representative).genome;
      const bGenome = genomes.get(b.representative).genome;
      const distanceKey = [a.representative, b.representative].sort().join('|');
      if (!geneticDistances.has(distanceKey)) geneticDistances.set(distanceKey, geneticDistance(aGenome, bGenome));
      const divergence = geneticDistances.get(distanceKey);
      if (divergence < ISOLATION_RULES.barrierGeneticDistance) continue;
      const ecological = a.niche !== b.niche;
      const barrier = !ecological && a.component !== b.component
        && !hasOrdinaryPath(aGenome, a.location, b.location, hexes)
        && !hasOrdinaryPath(bGenome, a.location, b.location, hexes);
      if (ecological) {
        if (divergence < ISOLATION_RULES.ecologicalGeneticDistance) continue;
      } else if (!barrier) {
        if (divergence < ISOLATION_RULES.distanceGeneticDistance) continue;
        if (!nearby.has(a.location.hexId)) nearby.set(a.location.hexId, nearbyHexes(a.location.hexId, hexes));
        if (nearby.get(a.location.hexId).has(b.location.hexId)) continue;
      }
      const kind = ecological ? 'ecological' : barrier ? 'barrier' : 'distance';
      const key = `${a.speciesId}|${[a.id, b.id].sort().join('|')}|${kind}`;
      timers[key] = (state.timers[key] ?? 0) + 1;
      const requiredTurns = ecological ? ISOLATION_RULES.ecologicalTurns
        : barrier ? ISOLATION_RULES.barrierTurns : ISOLATION_RULES.distanceTurns;
      if (timers[key] >= requiredTurns) {
        qualifying.push({ key, a, b, ecological });
      }
    }
  }
  const renamed = new Set();
  const componentPeers = (group) => groups.filter((candidate) => candidate.speciesId === group.speciesId
    && candidate.component === group.component && candidate.niche === group.niche);
  for (const { key, a, b, ecological } of qualifying.sort((a, b) => order(a.key, b.key))) {
    if (renamed.has(a.id) || renamed.has(b.id)) continue;
    const aPeers = ecological ? componentPeers(a) : [a];
    const bPeers = ecological ? componentPeers(b) : [b];
    const aPopulation = aPeers.reduce((sum, group) => sum + group.population, 0);
    const bPopulation = bPeers.reduce((sum, group) => sum + group.population, 0);
    const selected = aPopulation !== bPopulation ? (aPopulation < bPopulation ? a : b)
      : a.foundedDay !== b.foundedDay ? (a.foundedDay > b.foundedDay ? a : b)
        : (Number(a.id.slice(6)) > Number(b.id.slice(6)) ? a : b);
    // One connected niche lineage acquires one identity, even if it spans many
    // local demes. Otherwise one food-web innovation could manufacture dozens
    // of species on the same turn merely by filling a large area.
    const affected = selected === a ? aPeers : bPeers;
    const speciesId = branch(selected.speciesId);
    for (const group of affected) {
      group.speciesId = speciesId;
      for (const cohort of group.members) cohort.speciesId = speciesId;
      renamed.add(group.id);
    }
    delete timers[key];
  }
  for (const key of Object.keys(timers)) {
    if (key.split('|').some((id) => renamed.has(id))) delete timers[key];
  }
  state.groups = groups.map(({ id, speciesId, foundedDay, anchor, niche }) => ({ id, speciesId, foundedDay, anchor, niche }));
  state.timers = timers;
  return { groups: groups.length, qualifyingPairs: Object.keys(timers).length,
    longestIsolation: Object.values(timers).reduce((longest, duration) => Math.max(longest, duration), 0) };
}
