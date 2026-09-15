export const WORLD_SIZES = Object.freeze({
  small: Object.freeze({ width: 24, height: 16 }),
  medium: Object.freeze({ width: 60, height: 40 }),
  large: Object.freeze({ width: 120, height: 80 }),
});

export function wrapColumn(col, width) {
  return ((col % width) + width) % width;
}

/** Odd-row horizontal cylinder: only longitude wraps. */
export function createGrid(width, height) {
  if (!Number.isInteger(width) || width < 3 || !Number.isInteger(height) || height < 3) {
    throw new RangeError('Grid dimensions must be integers of at least three.');
  }
  return Array.from({ length: width * height }, (_, id) => {
    const col = id % width;
    const row = Math.floor(id / width);
    const diagonal = row % 2 ? 1 : -1;
    const neighbors = [[col - 1, row], [col + 1, row]];
    for (const adjacentRow of [row - 1, row + 1]) {
      if (adjacentRow >= 0 && adjacentRow < height) {
        neighbors.push([col, adjacentRow], [col + diagonal, adjacentRow]);
      }
    }
    return {
      id, col, row,
      neighbors: neighbors.map(([x, y]) => y * width + wrapColumn(x, width)).sort((a, b) => a - b),
    };
  });
}

/** Graph distance, so coastlines, channels and seam crossings use the same metric. */
export function distancesFrom(hexes, sourceIds) {
  const distances = new Array(hexes.length).fill(Infinity);
  const queue = [...sourceIds];
  for (const id of queue) distances[id] = 0;
  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index];
    for (const neighbor of hexes[id].neighbors) {
      if (distances[neighbor] !== Infinity) continue;
      distances[neighbor] = distances[id] + 1;
      queue.push(neighbor);
    }
  }
  return distances;
}
