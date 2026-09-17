const nonnegative = value => Number.isFinite(value) ? Math.max(0, value) : 0;
const accessFraction = value => Math.min(1, nonnegative(value));

/** Allocate finite plant production simultaneously across consumer demands.
 * Accessibility fractions define nested tissue bands: a resistant consumer may
 * reach extra bands, but cannot make those bands edible to other consumers.
 * Returned amounts are energy before consumer assimilation losses. */
export function allocateGrazing(production, consumers) {
  const consumed = production.map(() => 0);
  const gained = consumers.map(() => 0);
  const demands = consumers.map(consumer => nonnegative(consumer.demand));
  const remaining = [...demands];
  const bands = [];
  production.forEach((raw, plant) => {
    const amount = nonnegative(raw);
    if (!amount) return;
    const access = consumers.map((consumer, index) => demands[index] > 0
      ? accessFraction(consumer.access[plant]) : 0);
    const levels = [...new Set(access.filter(value => value > 0))].sort((a, b) => a - b);
    let previous = 0;
    for (const level of levels) {
      bands.push({ plant, remaining: amount * (level - previous),
        consumers: access.flatMap((value, index) => value >= level ? [index] : []) });
      previous = level;
    }
  });
  // A pass either satisfies all remaining demand or exhausts at least one
  // contested band. The finite band count bounds the simultaneous allocation.
  const epsilon = 1e-10;
  for (let pass = 0; pass <= bands.length; pass += 1) {
    const weights = consumers.map(() => 0);
    for (const band of bands) {
      if (band.remaining <= epsilon) continue;
      for (const index of band.consumers) if (remaining[index] > epsilon) weights[index] += band.remaining;
    }
    const acquired = consumers.map(() => 0);
    let progress = 0;
    for (const band of bands) {
      if (band.remaining <= epsilon) continue;
      const requests = band.consumers.map(index => remaining[index] > epsilon && weights[index] > epsilon
        ? remaining[index] * band.remaining / weights[index] : 0);
      const total = requests.reduce((sum, value) => sum + value, 0);
      if (total <= epsilon) continue;
      const scale = Math.min(1, band.remaining / total);
      const amount = Math.min(band.remaining, total);
      band.consumers.forEach((index, offset) => { acquired[index] += requests[offset] * scale; });
      band.remaining = Math.max(0, band.remaining - amount);
      consumed[band.plant] += amount;
      progress += amount;
    }
    acquired.forEach((amount, index) => {
      gained[index] += amount;
      remaining[index] = Math.max(0, remaining[index] - amount);
    });
    if (progress <= epsilon) break;
  }
  return { consumed, gained };
}
