// Diagnostic reference geography only. These thresholds do not decide whether
// a future organism can move, survive, or establish a population.
const RIDGE_HEIGHT = 3500;
const CLIFF_STEP = 1000;
const DEEP_OCEAN_DEPTH = 2000;
const EASY_DIFFICULTY = 0.55;
const clamp = (value) => Math.max(0, Math.min(1, value));
const surfaceHeight = (hex) => hex.waterType === 'none' ? hex.bedElevation : hex.waterLevel;

function distancesFromLand(hexes) {
  const distances = Array(hexes.length).fill(Infinity);
  const queue = [];
  for (const hex of hexes) {
    if (hex.waterType === 'none') {
      distances[hex.id] = 0;
      queue.push(hex.id);
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor];
    for (const neighbor of hexes[id].neighbors) {
      if (distances[neighbor] === Infinity) {
        distances[neighbor] = distances[id] + 1;
        queue.push(neighbor);
      }
    }
  }
  return distances;
}

// A one-cell connection has neighboring pieces of the same surface which
// cannot reach one another through the cell's immediate ring.
function isNarrowConnection(hex, hexes) {
  const neighbors = hex.neighbors.filter((id) => hexes[id].waterType === hex.waterType);
  if (neighbors.length < 2 || neighbors.length > 3) return false;
  const visited = new Set([neighbors[0]]);
  const queue = [neighbors[0]];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    for (const id of hexes[queue[cursor]].neighbors) {
      if (neighbors.includes(id) && !visited.has(id)) {
        visited.add(id);
        queue.push(id);
      }
    }
  }
  return visited.size !== neighbors.length;
}

function describeHex(hex, world, distanceToLand) {
  const reasons = [];
  const land = hex.waterType === 'none';
  const depth = land ? 0 : hex.waterLevel - hex.bedElevation;
  const narrow = isNarrowConnection(hex, world.hexes);
  const wideOcean = hex.waterType === 'sea' && depth >= DEEP_OCEAN_DEPTH
    && distanceToLand >= Math.max(2, Math.round(world.width / 30));

  if (hex.permanentIce) reasons.push('permanent ice');
  if (land && hex.bedElevation >= RIDGE_HEIGHT) reasons.push('high mountain ridge');
  if (wideOcean) reasons.push('wide deep ocean');
  const hardBarrier = reasons.length > 0;

  let difficulty;
  let kind;
  if (land) {
    const elevationDifficulty = Math.max(0, hex.bedElevation) / RIDGE_HEIGHT;
    const riverDifficulty = Math.min(0.5, 0.1 * Math.log2(1 + hex.runoff));
    const drynessDifficulty = clamp((0.35 - hex.annualMinimumHumidity) / 0.35) * 0.75;
    const coldDifficulty = clamp((8 - hex.meanTemperature) / 40) * 0.75;
    if (hex.bedElevation >= 1400 && hex.bedElevation < RIDGE_HEIGHT) reasons.push('high terrain');
    if (hex.annualMinimumHumidity < 0.35) reasons.push('seasonally dry ground');
    if (hex.meanTemperature < 8) reasons.push('cold annual climate');
    if (hex.runoff > 0) reasons.push('river crossing');
    if (narrow) reasons.push('narrow land connection');
    difficulty = clamp(Math.max(elevationDifficulty, riverDifficulty, drynessDifficulty, coldDifficulty, narrow ? 0.65 : 0));
    kind = narrow ? 'narrow-land' : difficulty >= EASY_DIFFICULTY ? 'harsh-land' : 'land-core';
  } else {
    if (narrow) reasons.push('narrow water connection');
    difficulty = narrow ? 0.65 : Math.min(0.55, 0.2 + depth / 10000);
    kind = narrow ? 'strait' : hex.waterType === 'lake' ? 'lake' : 'coastal-water';
  }

  if (hardBarrier) {
    difficulty = 1;
    kind = hex.permanentIce ? 'permanent-ice'
      : land ? 'high-ridge' : 'deep-ocean';
  }
  hex.traversalDifficulty = difficulty;
  hex.barrierReasons = reasons;
  return { kind, hardBarrier };
}

function connectionFacts(first, second, descriptions) {
  const bothWater = first.waterType !== 'none' && second.waterType !== 'none';
  const step = bothWater ? 0 : Math.abs(surfaceHeight(first) - surfaceHeight(second));
  const reasons = new Set([...first.barrierReasons, ...second.barrierReasons]);
  if (step >= CLIFF_STEP) reasons.add('steep cliff');
  else if (step >= 250) reasons.add('elevation step');
  if ((first.waterType === 'none') !== (second.waterType === 'none')) reasons.add('shore crossing');
  if (first.waterType !== second.waterType && bothWater) reasons.add('water connection');
  const hardBarrier = descriptions[first.id].hardBarrier || descriptions[second.id].hardBarrier || step >= CLIFF_STEP;
  const difficulty = hardBarrier ? 1 : clamp(Math.max(
    first.traversalDifficulty,
    second.traversalDifficulty,
    step / CLIFF_STEP,
    reasons.has('shore crossing') ? 0.35 : 0,
  ));
  return { hardBarrier, difficulty, reasons: [...reasons].sort() };
}

/** Internal builder: deterministic connected physical zones and boundary edges. */
export function partitionRegions(world) {
  const distances = distancesFromLand(world.hexes);
  const descriptions = world.hexes.map((hex) => describeHex(hex, world, distances[hex.id]));
  const regions = [];
  const assigned = new Set();

  for (const start of world.hexes) {
    if (assigned.has(start.id)) continue;
    const description = descriptions[start.id];
    const region = { id: regions.length, hexIds: [], ...description, meanDifficulty: 0 };
    const queue = [start.id];
    assigned.add(start.id);
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const hex = world.hexes[queue[cursor]];
      hex.regionId = region.id;
      region.hexIds.push(hex.id);
      region.meanDifficulty += hex.traversalDifficulty;
      for (const neighbor of hex.neighbors) {
        if (assigned.has(neighbor) || descriptions[neighbor].kind !== description.kind) continue;
        const other = world.hexes[neighbor];
        const bothWater = hex.waterType !== 'none' && other.waterType !== 'none';
        if (!description.hardBarrier && !bothWater
          && Math.abs(surfaceHeight(hex) - surfaceHeight(other)) >= CLIFF_STEP) continue;
        assigned.add(neighbor);
        queue.push(neighbor);
      }
    }
    region.hexIds.sort((a, b) => a - b);
    region.meanDifficulty /= region.hexIds.length;
    regions.push(region);
  }

  // One least-cost physical boundary edge per region pair. Stable identity and
  // endpoint tie-breaking make the same seed's graph reproducible.
  const edges = new Map();
  for (const hex of world.hexes) {
    for (const neighbor of hex.neighbors) {
      const other = world.hexes[neighbor];
      if (neighbor <= hex.id || hex.regionId === other.regionId) continue;
      const first = hex.regionId < other.regionId ? hex : other;
      const second = first === hex ? other : hex;
      const key = `${first.regionId}:${second.regionId}`;
      const facts = connectionFacts(first, second, descriptions);
      const edge = {
        fromRegion: first.regionId,
        toRegion: second.regionId,
        fromHex: first.id,
        toHex: second.id,
        ...facts,
      };
      const previous = edges.get(key);
      if (!previous || Number(edge.hardBarrier) < Number(previous.hardBarrier)
        || edge.hardBarrier === previous.hardBarrier && (edge.difficulty < previous.difficulty
          || edge.difficulty === previous.difficulty && (edge.fromHex < previous.fromHex
            || edge.fromHex === previous.fromHex && edge.toHex < previous.toHex))) edges.set(key, edge);
    }
  }
  const connections = [...edges.values()]
    .sort((a, b) => a.fromRegion - b.fromRegion || a.toRegion - b.toRegion)
    .map((edge, id) => ({ id, ...edge }));
  world.regions = regions;
  world.regionConnections = connections;
  world.passes = connections.filter((edge) => !edge.hardBarrier);
  return world;
}
