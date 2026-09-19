const number = value => Number(value.toFixed(2));
const escapeAttribute = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

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
