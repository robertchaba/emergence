import { hashSeed } from '../../noise.js';

const syllables = ['ba', 'be', 'bi', 'bo', 'ca', 'ce', 'ci', 'co',
  'da', 'de', 'di', 'do', 'fa', 'fe', 'fi', 'fo', 'la', 'le', 'li', 'lo',
  'ma', 'me', 'mi', 'mo', 'na', 'ne', 'ni', 'no', 'ra', 're', 'ri', 'ro'];
const roots = ['Aure', 'Cala', 'Elo', 'Flori', 'Lumi', 'Mira', 'Neri', 'Oro',
  'Sela', 'Silva', 'Tera', 'Vela', 'Astra', 'Cera', 'Iri', 'Luna'];
const endings = ['lia', 'phora', 'nella', 'soma', 'thea', 'lina', 'myra', 'dora'];

/** Stable cosmetic labels, independent of biological random draws. */
export function speciesName(seed, ordinal) {
  let remaining = BigInt(ordinal);
  if (remaining < 1n) throw new RangeError('Species ordinal must be positive.');
  const hash = hashSeed(`${seed}:v4-species-name:${ordinal}`);
  const genus = roots[hash % roots.length] + endings[(hash >>> 8) % endings.length];
  const parts = [];
  do {
    const offset = hashSeed(`${seed}:v4-name-position:${parts.length}`) % syllables.length;
    parts.push(syllables[(Number(remaining % 32n) * 13 + offset) % syllables.length]);
    remaining /= 32n;
  } while (remaining > 0n || parts.length < 3);
  return `${genus} ${parts.reverse().join('')}`;
}
