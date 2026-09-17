/* A decorative, gene-responsive specimen plate. This is an abstract visual
   summary of supplied traits, never a biological reconstruction or classifier. */
const clamp = value => Math.max(0, Math.min(1, value));
const number = value => Number(value.toFixed(2));
const escapeAttribute = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

export function createSpecimenSvg(traits = [], { label } = {}) {
  const values = new Map(traits.map(trait => {
    const min = Number(trait.min) || 0;
    const max = Number(trait.max) || 1;
    const value = Number(trait.value);
    return [trait.key, trait.active === false || !Number.isFinite(value) ? 0 : clamp((value - min) / (max - min || 1))];
  }));
  const trait = key => values.get(key) ?? 0;
  const radius = 19 + trait('size') * 18;
  const length = 1 + trait('trunk') * 0.30;
  const parts = [];
  const point = (angle, distance, stretch = 1) => [
    number(100 + Math.cos(angle) * distance), number(86 + Math.sin(angle) * distance * stretch),
  ];
  const pointText = coordinates => coordinates.join(' ');
  const photo = trait('photosynthesis');
  const movement = trait('movement');
  const feeding = Math.max(trait('plantFeeding'), trait('animalFeeding'));

  parts.push('<g class="specimen-guide" fill="none" stroke="currentColor" stroke-width="0.65">',
    '<circle cx="100" cy="86" r="64" stroke-dasharray="2 5"/>',
    '<path d="M22 86h10m136 0h10M100 8v10m0 136v10"/>',
    '</g>');
  parts.push('<g class="specimen-appendages" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round">');
  if (photo > 0) {
    const leaves = 4 + Math.round(photo * 6);
    for (let index = 0; index < leaves; index += 1) {
      const angle = index * Math.PI * 2 / leaves;
      const start = point(angle, radius * 0.75, length);
      const tip = point(angle, radius + 12 + photo * 13, length);
      const a = point(angle + 0.23, radius + 9 + photo * 7, length);
      const b = point(angle - 0.23, radius + 9 + photo * 7, length);
      parts.push(`<path d="M${pointText(start)}Q${pointText(a)} ${pointText(tip)}Q${pointText(b)} ${pointText(start)}M${pointText(start)}L${pointText(tip)}"/>`);
    }
  }
  if (movement > 0) {
    const limbs = 2 + Math.round(movement * 4);
    for (let index = 0; index < limbs; index += 1) {
      const angle = (index + 0.5) * Math.PI * 2 / limbs;
      const start = point(angle, radius * 0.92, length);
      const elbow = point(angle + 0.15, radius + 13, length);
      const tip = point(angle - 0.12, radius + 12 + movement * 11, length);
      parts.push(`<path d="M${pointText(start)}Q${pointText(elbow)} ${pointText(tip)}"/>`);
    }
  }
  parts.push('</g>', '<g class="specimen-body" fill="none" stroke="currentColor">',
    `<ellipse cx="100" cy="86" rx="${number(radius)}" ry="${number(radius * length)}" stroke-width="1.7"/>`,
    `<ellipse cx="100" cy="86" rx="${number(radius * 0.82)}" ry="${number(radius * length * 0.82)}" stroke-width="0.55"/>`,
    `<ellipse cx="100" cy="86" rx="${number(radius * 0.27)}" ry="${number(radius * 0.34)}" stroke-width="1"/>`);
  // Cell marks communicate texture only: their count is deliberately unrelated
  // to the engine's body-cell and population counts.
  for (let index = 0; index < 9; index += 1) {
    const [cx, cy] = point(index * 2.399963, radius * (index % 2 ? 0.58 : 0.66), length);
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${number(1.4 + photo)}" stroke-width="0.75"/>`);
  }
  if (feeding > 0) {
    const mouth = point(-Math.PI / 2, radius * length * 0.62);
    parts.push(`<path class="specimen-feeding" d="M${mouth[0] - 4} ${mouth[1]}q4 ${number(4 + feeding * 4)} 8 0" stroke-width="1.4"/>`);
  }
  parts.push('</g>', '<g class="specimen-scale" fill="none" stroke="currentColor" stroke-width="1">',
    '<path d="M155 148h22m-22-3v6m22-6v6"/>', '</g>');
  const accessibility = label === undefined ? 'aria-hidden="true"' : `role="img" aria-label="${escapeAttribute(label)}"`;
  return `<svg class="specimen-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 180" ${accessibility} focusable="false">${parts.join('')}</svg>`;
}

/** One metric per chart, with its own zero-based scale and physical-day axis. */
export function createLifeTrendSvg(samples = [], { metric = 'species', label, format = String, formatDay = format } = {}) {
  const points = samples.slice(-180).filter(sample => Number.isFinite(sample.day)
    && Number.isFinite(sample[metric]) && sample[metric] >= 0)
    .map(sample => ({ ...sample })).sort((a, b) => a.day - b.day);
  const firstDay = points[0]?.day ?? 1;
  const lastDay = points.at(-1)?.day ?? firstDay;
  const span = Math.max(1, lastDay - firstDay);
  const peak = Math.max(1, ...points.map(sample => sample[metric]));
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  const maximum = Math.ceil(peak / magnitude) * magnitude;
  const positions = points.map(sample => ({ x: number(48 + (sample.day - firstDay) / span * 264), y: number(38 - sample[metric] / maximum * 30) }));
  // Step paths preserve discrete counts, including abrupt extinctions.
  const path = positions.map(({ x, y }, index) => index ? `H${x}V${y}` : `M${x} ${y}`).join('');
  const last = positions.at(-1);
  const plot = last ? `<path class="life-trend-line" d="${path}" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="${last.x}" cy="${last.y}" r="2.5" fill="currentColor"/>` : '';
  const accessibility = label === undefined ? 'aria-hidden="true"' : `role="img" aria-label="${escapeAttribute(label)}"`;
  const text = value => escapeAttribute(format(value));
  const dayText = value => escapeAttribute(formatDay(value));
  return `<svg class="life-trend-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 58" ${accessibility} focusable="false"><path class="life-trend-baseline" d="M48 8H312M48 38H312" fill="none" stroke="currentColor" stroke-width="0.6"/><g class="trend-axis" fill="currentColor"><text x="40" y="12" text-anchor="end">${text(maximum)}</text><text x="40" y="41" text-anchor="end">${text(0)}</text><text x="48" y="55">${dayText(firstDay)}</text>${lastDay !== firstDay ? `<text x="312" y="55" text-anchor="end">${dayText(lastDay)}</text>` : ''}</g>${plot}</svg>`;
}
