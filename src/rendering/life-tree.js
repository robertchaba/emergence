const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const TREE_TOKEN_NAMES = ['--color-rule', '--color-rule-strong', '--color-muted', '--color-accent',
  '--color-highlight', '--color-panel', '--color-energy-photosynthesis', '--color-energy-plant-feeding', '--color-energy-animal-feeding', '--color-energy-other'];

/** Topological ordering and geometry only; all biological meanings are supplied. */
export function layoutLifeTree(species, endDay, width = 520) {
  const children = new Map();
  const ids = new Set(species.map(record => record.id));
  for (const record of species) {
    const parent = ids.has(record.parentId) ? record.parentId : null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(record);
  }
  for (const rows of children.values()) rows.sort((a, b) => a.originDay - b.originDay || a.id.localeCompare(b.id));
  const rows = [];
  const stack = (children.get(null) ?? []).map(record => ({ record, depth: 0 })).reverse();
  while (stack.length) {
    const item = stack.pop();
    rows.push(item);
    for (const record of [...(children.get(item.record.id) ?? [])].reverse()) stack.push({ record, depth: item.depth + 1 });
  }
  const start = species.reduce((day, record) => Math.min(day, record.originDay), endDay);
  const span = Math.max(1, endDay - start);
  const x = day => 44 + (day - start) / span * (width - 88);
  return { start, end: endDay, width, height: Math.max(1, rows.length) * 72,
    rows: rows.map((item, index) => ({ ...item, y: index * 72 + 36,
      x: x(item.record.originDay), endX: x(item.record.extinctDay ?? endDay) })), x };
}

export function createLifeTreeSvg(layout, { selectedId, trace, tokens }) {
  const color = name => escape(tokens[name]);
  const roleColor = role => color({ producer: '--color-energy-photosynthesis', grazer: '--color-energy-plant-feeding',
    predator: '--color-energy-animal-feeding' }[role] ?? '--color-energy-other');
  const byId = new Map(layout.rows.map(row => [row.record.id, row]));
  const branches = new Map(trace?.branches?.map(branch => [branch.speciesId, branch]) ?? []);
  const ancestors = new Set();
  let selected = byId.get(selectedId);
  while (selected && !ancestors.has(selected.record.id)) {
    ancestors.add(selected.record.id); selected = byId.get(selected.record.parentId);
  }
  let drawing = '';
  for (let index = 0; index <= 4; index += 1) {
    const x = 44 + (layout.width - 88) * index / 4;
    drawing += `<path d="M${x} 0V${layout.height}" stroke="${color('--color-rule')}" stroke-dasharray="2 6"/>`;
  }
  for (const row of layout.rows) {
    const parent = byId.get(row.record.parentId);
    const traced = trace?.mode === 'lineage' && branches.has(row.record.id) && branches.has(row.record.parentId);
    const emphasized = traced || !trace && ancestors.has(row.record.id);
    if (parent) drawing += `<path ${traced ? `data-gene-link="${escape(row.record.id)}"` : ''} d="M${row.x} ${parent.y} C${row.x - 20} ${parent.y + 20},${row.x - 20} ${row.y - 20},${row.x} ${row.y}" fill="none" stroke="${color(emphasized ? '--color-accent' : '--color-rule-strong')}" stroke-width="${traced ? 3 : emphasized ? 2 : 1}"/>`;
  }
  for (const row of layout.rows) {
    const ink = trace ? color('--color-rule-strong') : roleColor(row.record.role);
    const extinct = row.record.extinctDay !== null;
    drawing += `<path d="M${row.x} ${row.y}H${row.endX}" stroke="${ink}" stroke-width="${trace ? 1 : row.record.id === selectedId ? 6 : 3}" ${extinct ? 'stroke-dasharray="5 4"' : ''}/>`;
    const branch = branches.get(row.record.id);
    if (branch) {
      let labelEnd = -Infinity;
      drawing += `<g data-gene-species="${escape(row.record.id)}">`;
      if (!branch.complete) {
        drawing += `<path d="M${row.x} ${row.y - 14}H${layout.x(branch.events[0].day)}" stroke="${color('--color-muted')}" stroke-dasharray="1 5"/>`;
      }
      for (const [index, event] of branch.events.entries()) {
        const start = layout.x(event.day);
        const end = layout.x(branch.events[index + 1]?.day ?? branch.endDay);
        const trait = event.trait;
        if (trait.active) {
          const weight = trace.quantitative ? 4 + 8 * (trait.value - trait.min) / (trait.max - trait.min) : 7;
          drawing += `<path data-gene-active="true" data-value="${trait.value}" d="M${start} ${row.y}H${end}" stroke="${color('--color-accent')}" stroke-width="${weight}"/>`;
        }
        // A diamond marks a recorded active expression, including reacquisition;
        // an open circle marks inactivity. Width changes are discrete, never an
        // invented interpolation between accepted genomes.
        drawing += trait.active
          ? `<path d="M${start} ${row.y - 6}l6 6 -6 6 -6 -6Z" fill="${color('--color-highlight')}"/>`
          : `<circle cx="${start}" cy="${row.y}" r="3" fill="${color('--color-panel')}" stroke="${color('--color-muted')}"/>`;
        const labelWidth = event.label.length * 8;
        const labelX = Math.min(start, layout.width - labelWidth - 8);
        if (labelX >= labelEnd + 8) {
          drawing += `<text class="tree-expression-label" x="${labelX}" y="${row.y + 26}" fill="${color(trait.active ? '--color-accent' : '--color-muted')}">${escape(event.label)}</text>`;
          labelEnd = labelX + labelWidth;
        }
      }
      drawing += '</g>';
    }
    drawing += `<circle cx="${row.x}" cy="${row.y}" r="5" fill="${ink}"/>`;
    drawing += extinct ? `<path d="M${row.endX - 4} ${row.y - 5}L${row.endX + 4} ${row.y + 5}M${row.endX + 4} ${row.y - 5}L${row.endX - 4} ${row.y + 5}" stroke="${ink}" stroke-width="2"/>`
      : `<circle cx="${row.endX}" cy="${row.y}" r="4" fill="${color('--color-panel')}" stroke="${ink}" stroke-width="2"/>`;
  }
  if (trace?.mode === 'lineage' && trace.firstAppearance) {
    const origin = trace.firstAppearance;
    const row = byId.get(origin.speciesId);
    if (row) {
      const x = layout.x(origin.day);
      const labelX = Math.max(8, Math.min(x, layout.width - trace.originLabel.length * 8 - 8));
      drawing += `<g data-gene-origin="${escape(origin.speciesId)}" data-day="${origin.day}"><circle cx="${x}" cy="${row.y}" r="10" fill="${color('--color-panel')}" stroke="${color('--color-accent')}" stroke-width="3"/><circle cx="${x}" cy="${row.y}" r="4" fill="${color('--color-accent')}"/><text class="tree-expression-label" x="${labelX}" y="${row.y - 17}" fill="${color('--color-accent')}">${escape(trace.originLabel)}</text></g>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" preserveAspectRatio="none" aria-hidden="true">${drawing}</svg>`;
}
