import { acquisitionSignature } from './classification.js';
import { deriveGenome, geneticDistance } from './genes/genome.js';
import { createRandom } from './random.js';

export const VARIANT_RULES = Object.freeze({ maximumPerPool: 3, protectedAbundant: 2 });
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function poolKey(cohort, genome) {
  const transit = cohort.transit;
  return JSON.stringify([cohort.speciesId, cohort.hexId, cohort.habitat,
    acquisitionSignature(genome), transit ? [transit.hexId, transit.habitat,
      transit.dueTurn, transit.probability] : null]);
}

/** Coarse local variation, applied only after a completed ecological turn.
 * Two abundant genomes compete alongside one exploratory representative. A
 * fixed seeded ticket lets a rare contender persist without rerolling its slot
 * every turn. All ticket inputs are checkpointed; there is no evolving second
 * random stream or query-time sampling. Separate niches/routes cannot be folded
 * into one another, and no synthetic average genome is constructed. */
export function compactVariants(cohorts, genomes, { seed }) {
  const pools = new Map();
  for (const cohort of cohorts) {
    const key = poolKey(cohort, genomes.get(cohort.genomeId).genome);
    if (!pools.has(key)) pools.set(key, { cohorts: [], variants: new Map() });
    const pool = pools.get(key);
    pool.cohorts.push(cohort);
    pool.variants.set(cohort.genomeId, (pool.variants.get(cohort.genomeId) ?? 0) + cohort.count);
  }
  const replacements = new Map();
  let reassignedPopulation = 0;
  let reassignedCohorts = 0;
  for (const [key, pool] of pools) {
    if (pool.variants.size <= VARIANT_RULES.maximumPerPool) continue;
    const abundanceOrder = (a, b) => pool.variants.get(b) - pool.variants.get(a)
      || (genomes.get(a).establishedOrder ?? Infinity) - (genomes.get(b).establishedOrder ?? Infinity)
      || order(a, b);
    const ranked = [...pool.variants.keys()].sort(abundanceOrder);
    const retained = ranked.slice(0, VARIANT_RULES.protectedAbundant);
    const candidates = ranked.slice(VARIANT_RULES.protectedAbundant).map((id) => {
      const random = createRandom(JSON.stringify([seed, 'compact-variants-1', key, id]));
      const ticket = -Math.log(1 - random.next());
      return { id, priority: ticket / pool.variants.get(id) };
    }).sort((a, b) => a.priority - b.priority || abundanceOrder(a.id, b.id));
    retained.push(...candidates.slice(0, VARIANT_RULES.maximumPerPool - retained.length).map(({ id }) => id));
    const targets = new Map();
    for (const id of ranked) {
      if (retained.includes(id)) continue;
      const genome = genomes.get(id).genome;
      const target = [...retained].sort((a, b) => geneticDistance(genome, genomes.get(a).genome)
        - geneticDistance(genome, genomes.get(b).genome) || abundanceOrder(a, b))[0];
      targets.set(id, { id: target, cells: genomes.get(target).derived?.cells ?? deriveGenome(genomes.get(target).genome).cells });
    }
    for (const cohort of pool.cohorts) {
      const target = targets.get(cohort.genomeId);
      if (!target) continue;
      replacements.set(cohort, { ...cohort, genomeId: target.id, energy: Math.min(cohort.energy, target.cells) });
      reassignedPopulation += cohort.count;
      reassignedCohorts += 1;
    }
  }
  return { cohorts: cohorts.map((cohort) => replacements.get(cohort) ?? cohort),
    reassignedPopulation, reassignedCohorts };
}
