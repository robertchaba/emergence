import { coordinateHash } from './noise.js';
import { distancesFrom } from './grid.js';

/** Stable min-heap: equal flood surfaces always settle in cell-id order. */
class FloodQueue {
  entries = [];

  before(a, b) {
    return a.surface < b.surface || (a.surface === b.surface && a.id < b.id);
  }

  push(entry) {
    let index = this.entries.length;
    this.entries.push(entry);
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (!this.before(entry, this.entries[parent])) break;
      this.entries[index] = this.entries[parent];
      index = parent;
    }
    this.entries[index] = entry;
  }

  pop() {
    const first = this.entries[0];
    const last = this.entries.pop();
    if (this.entries.length === 0) return first;
    let index = 0;
    while (index * 2 + 1 < this.entries.length) {
      let child = index * 2 + 1;
      if (child + 1 < this.entries.length && this.before(this.entries[child + 1], this.entries[child])) child += 1;
      if (!this.before(this.entries[child], last)) break;
      this.entries[index] = this.entries[child];
      index = child;
    }
    this.entries[index] = last;
    return first;
  }
}

export function priorityFlood(hexes) {
  const queue = new FloodQueue();
  const visited = new Uint8Array(hexes.length);
  const order = [];
  for (const hex of hexes) {
    hex.downstream = null;
    if (hex.waterType !== 'sea') continue;
    hex.spillElevation = 0;
    visited[hex.id] = 1;
    queue.push({ id: hex.id, surface: 0 });
  }
  if (queue.entries.length === 0) throw new Error('Drainage needs at least one sea outlet.');
  while (queue.entries.length) {
    const { id } = queue.pop();
    const current = hexes[id];
    order.push(id);
    for (const neighborId of current.neighbors) {
      if (visited[neighborId]) continue;
      visited[neighborId] = 1;
      const neighbor = hexes[neighborId];
      neighbor.spillElevation = Math.max(neighbor.bedElevation, current.spillElevation);
      neighbor.downstream = id;
      queue.push({ id: neighborId, surface: neighbor.spillElevation });
    }
  }
  return order;
}

function identifyBasins(hexes, floodOrder, minimumDepth) {
  const rank = new Array(hexes.length);
  floodOrder.forEach((id, index) => { rank[id] = index; });
  const basins = [];
  for (const hex of hexes) hex.basinId = null;
  for (const start of hexes) {
    if (start.waterType === 'sea' || start.basinId !== null || start.bedElevation >= start.spillElevation) continue;
    const basin = {
      id: basins.length,
      hexIds: [],
      connectorHexIds: [],
      spillElevation: start.spillElevation,
      maxDepth: 0,
      outlet: null,
      lakeInflow: 0,
      sedimentFilled: false,
    };
    const routingIds = [start.id];
    start.basinId = basin.id;
    for (let index = 0; index < routingIds.length; index += 1) {
      const current = hexes[routingIds[index]];
      if (current.bedElevation < basin.spillElevation) basin.hexIds.push(current.id);
      else basin.connectorHexIds.push(current.id);
      basin.maxDepth = Math.max(basin.maxDepth, current.spillElevation - current.bedElevation);
      for (const neighborId of current.neighbors) {
        const neighbor = hexes[neighborId];
        if (neighbor.basinId !== null || neighbor.waterType === 'sea'
          || neighbor.spillElevation !== basin.spillElevation || neighbor.bedElevation > basin.spillElevation) continue;
        neighbor.basinId = basin.id;
        routingIds.push(neighborId);
      }
    }
    // A basin has one reproducible overflow. Reorient all pockets toward its
    // earliest flooded member, whose original outlet cannot lead back inside.
    // Zero-depth saddles connect same-spill side pockets, but remain dry land.
    const rootId = routingIds.reduce((best, id) => rank[id] < rank[best] ? id : best);
    basin.outlet = hexes[rootId].downstream;
    basin.outletHex = rootId;
    const routed = new Set([rootId]);
    const queue = [rootId];
    for (let index = 0; index < queue.length; index += 1) {
      for (const neighborId of hexes[queue[index]].neighbors) {
        if (hexes[neighborId].basinId !== basin.id || routed.has(neighborId)) continue;
        routed.add(neighborId);
        hexes[neighborId].downstream = queue[index];
        queue.push(neighborId);
      }
    }
    basin.hexIds.sort((a, b) => a - b);
    basin.connectorHexIds.sort((a, b) => a - b);
    basin.sedimentFilled = basin.maxDepth <= minimumDepth;
    if (basin.sedimentFilled) {
      for (const id of basin.hexIds) hexes[id].bedElevation = basin.spillElevation;
    }
    basins.push(basin);
  }
  return basins;
}

export function accumulateRunoff(hexes) {
  const incoming = new Uint32Array(hexes.length);
  const queue = [];
  for (const hex of hexes) {
    hex.runoff = hex.springDischarge;
    if (hex.downstream !== null) incoming[hex.downstream] += 1;
  }
  for (const hex of hexes) if (incoming[hex.id] === 0) queue.push(hex.id);
  for (let index = 0; index < queue.length; index += 1) {
    const hex = hexes[queue[index]];
    if (hex.downstream === null) continue;
    hexes[hex.downstream].runoff += hex.runoff;
    incoming[hex.downstream] -= 1;
    if (incoming[hex.downstream] === 0) queue.push(hex.downstream);
  }
  if (queue.length !== hexes.length) throw new Error('Drainage contains a cycle.');
}

/** Mutates only a generation candidate. Discharge is groundwater, not rainfall. */
export function deriveHydrology(world, seed, { springIds, minimumLakeDepth = 5 } = {}) {
  const { hexes } = world;
  const order = priorityFlood(hexes);
  world.basins = identifyBasins(hexes, order, minimumLakeDepth);
  for (const hex of hexes) {
    hex.springDischarge = 0;
    hex.runoff = 0;
    hex.lakeInflow = 0;
    hex.waterLevel = hex.waterType === 'sea' ? 0 : null;
  }
  const eligible = hexes.filter((hex) => hex.waterType === 'none'
    && hex.bedElevation > 300 && hex.bedElevation === hex.spillElevation);
  eligible.sort((a, b) => coordinateHash(seed, a.col, a.row, 97) - coordinateHash(seed, b.col, b.row, 97) || a.id - b.id);
  const selected = springIds ?? eligible.slice(0, Math.max(1, Math.round(eligible.length * 0.025))).map((hex) => hex.id);
  for (const id of selected) {
    const hex = hexes[id];
    if (!hex || hex.waterType !== 'none' || hex.bedElevation <= 300 || hex.bedElevation !== hex.spillElevation) {
      throw new Error('A spring needs exposed land above 300 metres outside a depression.');
    }
    hex.springDischarge = 1;
  }
  accumulateRunoff(hexes);
  for (const hex of hexes) {
    if (hex.basinId !== null) world.basins[hex.basinId].lakeInflow += hex.springDischarge;
    if (hex.downstream === null) continue;
    const destination = hexes[hex.downstream];
    if (destination.basinId !== null && destination.basinId !== hex.basinId) {
      world.basins[destination.basinId].lakeInflow += hex.runoff;
    }
  }
  for (const basin of world.basins) {
    for (const id of [...basin.hexIds, ...basin.connectorHexIds]) {
      const hex = hexes[id];
      hex.lakeInflow = basin.lakeInflow;
      if (basin.lakeInflow > 0 && !basin.sedimentFilled && hex.bedElevation < basin.spillElevation) {
        hex.waterType = 'lake';
        hex.waterLevel = basin.spillElevation;
      }
    }
  }
  for (const hex of hexes) {
    if (hex.waterType === 'none' && hex.runoff > 0) hex.waterLevel = hex.bedElevation;
  }
  const waterIds = hexes.filter((hex) => hex.waterType !== 'none' || hex.runoff > 0).map((hex) => hex.id);
  const distances = distancesFrom(hexes, waterIds);
  for (const hex of hexes) hex.distanceToWater = distances[hex.id];
  world.dryLandFraction = hexes.filter((hex) => hex.waterType === 'none').length / hexes.length;
  return world;
}
