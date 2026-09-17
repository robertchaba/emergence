// Exact hex-union contours in map units. Integer vertex keys remove shared edges
// without float tolerances. The atlas cut stays closed at each cylindrical edge.
const VERTICES = [[1, -1], [1, 1], [0, 2], [-1, 1], [-1, -1], [0, -2]];
const key = point => point.join(',');

export function territoryContours(world, hexIds) {
  const edges = new Map();
  for (const id of new Set(hexIds)) {
    const hex = world.hexes[id];
    if (!hex) continue;
    const x = 2 * hex.col + hex.row % 2 + 1;
    const y = 2 + 3 * hex.row;
    const corners = VERTICES.map(([dx, dy]) => [x + dx, y + dy]);
    for (let index = 0; index < 6; index += 1) {
      const from = corners[index];
      const to = corners[(index + 1) % 6];
      const reverse = `${key(to)}:${key(from)}`;
      if (edges.has(reverse)) edges.delete(reverse);
      else edges.set(`${key(from)}:${key(to)}`, { from, to });
    }
  }
  const next = new Map([...edges.values()].map(edge => [key(edge.from), edge]));
  const loops = [];
  while (next.size) {
    const start = next.values().next().value.from;
    const loop = [];
    let point = start;
    do {
      loop.push({ x: point[0] * Math.sqrt(3) / 2, y: point[1] / 2 });
      const edge = next.get(key(point));
      next.delete(key(point));
      point = edge.to;
    } while (key(point) !== key(start));
    loops.push(loop);
  }
  return loops;
}
