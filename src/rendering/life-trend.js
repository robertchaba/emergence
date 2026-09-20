const number = value => Number(value.toFixed(2));
const escapeAttribute = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

/** A single metric or disjoint stacked series, on a zero-based physical-day axis. */
export function createLifeTrendSvg(samples = [], { metric = 'species', series, label, format = String, formatDay = format } = {}) {
  const keys = series?.length ? series : [metric];
  const total = sample => keys.reduce((sum, key) => sum + sample[key], 0);
  const points = samples.slice(-180).filter(sample => Number.isFinite(sample.day)
    && keys.every(key => Number.isFinite(sample[key]) && sample[key] >= 0))
    .map(sample => ({ ...sample })).sort((a, b) => a.day - b.day);
  const firstDay = points[0]?.day ?? 1;
  const lastDay = points.at(-1)?.day ?? firstDay;
  const span = Math.max(1, lastDay - firstDay);
  const peak = Math.max(1, ...points.map(total));
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  const maximum = Math.ceil(peak / magnitude) * magnitude;
  const height = series?.length ? 60 : 30;
  const bottom = height + 8;
  const x = sample => number(48 + (sample.day - firstDay) / span * 264);
  const y = value => number(bottom - value / maximum * height);
  const positions = points.map(sample => ({ x: x(sample), y: y(total(sample)) }));
  // Step paths preserve discrete counts, including abrupt extinctions.
  const path = positions.map(({ x, y }, index) => index ? `H${x}V${y}` : `M${x} ${y}`).join('');
  const last = positions.at(-1);
  let plot = last ? `<path class="life-trend-line" d="${path}" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="${last.x}" cy="${last.y}" r="2.5" fill="currentColor"/>` : '';
  if (series?.length) {
    const bases = points.map(() => 0);
    plot = keys.map(key => {
      const lower = points.map((sample, index) => ({ x: x(sample), y: y(bases[index]) }));
      const upper = points.map((sample, index) => {
        bases[index] += sample[key];
        return { x: x(sample), y: y(bases[index]) };
      });
      if (!upper.length) return '';
      const top = upper.map((point, index) => index ? `H${point.x}V${point.y}` : `M${point.x} ${point.y}`).join('');
      // Reverse the same discrete steps to close the lower edge of each band.
      const base = [...lower].reverse().map((point, index) => index ? `V${point.y}H${point.x}` : `L${point.x} ${point.y}`).join('');
      const end = points.at(-1)[key] > 0
        ? `<path data-energy="${escapeAttribute(key)}" d="M${last.x} ${lower.at(-1).y}V${upper.at(-1).y}" fill="none" stroke="currentColor" stroke-width="3"/>` : '';
      return `<path class="life-trend-band" data-energy="${escapeAttribute(key)}" d="${top}${base}Z" fill="currentColor"/><path class="life-trend-line" data-energy="${escapeAttribute(key)}" d="${top}" fill="none" stroke="currentColor" stroke-width="1.2"/>${end}`;
    }).join('');
  }
  const accessibility = label === undefined ? 'aria-hidden="true"' : `role="img" aria-label="${escapeAttribute(label)}"`;
  const text = value => escapeAttribute(format(value));
  const dayText = value => escapeAttribute(formatDay(value));
  return `<svg class="life-trend-svg${series?.length ? ' life-trend-stacked' : ''}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 ${bottom + 20}" ${accessibility} focusable="false"><path class="life-trend-baseline" d="M48 8H312M48 ${bottom}H312" fill="none" stroke="currentColor" stroke-width="0.6"/><g class="trend-axis" fill="currentColor"><text x="40" y="12" text-anchor="end">${text(maximum)}</text><text x="40" y="${bottom + 3}" text-anchor="end">${text(0)}</text><text x="48" y="${bottom + 17}">${dayText(firstDay)}</text>${lastDay !== firstDay ? `<text x="312" y="${bottom + 17}" text-anchor="end">${dayText(lastDay)}</text>` : ''}</g>${plot}</svg>`;
}
