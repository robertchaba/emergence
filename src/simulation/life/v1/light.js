/** Weighted water filling with per-organism caps and a single shared hex budget.
 * Entries expose count, cap, weight; result is per-member absorbed light. */
export function allocateLight(entries, budget = 2000) {
  const sorted = entries.map((entry, index) => ({ ...entry, index }))
    .filter((entry) => entry.count > 0 && entry.weight > 0 && entry.cap > 0)
    .sort((a, b) => a.cap / a.weight - b.cap / b.weight || a.index - b.index);
  const result = entries.map(() => 0);
  let weight = sorted.reduce((sum, entry) => sum + entry.count * entry.weight, 0);
  let available = budget;
  for (const entry of sorted) {
    const perMember = Math.min(entry.cap, weight > 0 ? available * entry.weight / weight : 0);
    result[entry.index] = Math.max(0, perMember);
    available = Math.max(0, available - perMember * entry.count);
    weight = Math.max(0, weight - entry.count * entry.weight);
  }
  return result;
}
