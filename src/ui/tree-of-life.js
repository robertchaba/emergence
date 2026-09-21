import { t, formatNumber } from './locale.js';
import { layoutLifeTree, createLifeTreeSvg, TREE_TOKEN_NAMES } from '../rendering/life-tree.js';

const integer = value => formatNumber(value, 'integer');
const geneName = key => t(`gene${key[0].toUpperCase()}${key.slice(1)}`);
const roleName = role => t(`treeRole_${role}`);
const HISTORY_PAGE_SIZE = 20;
const node = (tag, className = '', text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const button = (text, action, className = '') => {
  const element = node('button', className, text);
  element.type = 'button'; element.addEventListener('click', action);
  return element;
};
function geneValue(trait) {
  if (trait.value === null) return t('geneAbsent');
  const categories = {
    landAdaptation: ['geneAquatic', 'geneAmphibious', 'geneTerrestrial', 'geneDryLand'],
    skeleton: ['geneSoftBody', 'geneHydrostaticSkeleton', 'geneExoskeleton', 'geneEndoskeleton'],
    armorType: ['geneFlexibleCovering', 'geneMineralShell', 'geneSegmentedPlates', 'geneScales'],
    size: ['geneSizeTiny', 'geneSizeVerySmall', 'geneSizeSmall', 'geneSizeFairlySmall', 'geneSizeMedium',
      'geneSizeModeratelyLarge', 'geneSizeLarge', 'geneSizeVeryLarge', 'geneSizeHuge', 'geneSizeEnormous'],
  };
  if (categories[trait.key]) return t(categories[trait.key][trait.value - (trait.key === 'size' ? 1 : 0)]);
  if (trait.max === 1) return t(trait.value ? 'geneEnabled' : 'geneDisabled');
  return t('geneLevel', { value: integer(trait.value) });
}

export function createTreeOfLife({ onClose, onRequest }) {
  const page = node('section', 'tree-page');
  page.id = 'tree-of-life'; page.hidden = true;
  page.setAttribute('aria-labelledby', 'tree-title');
  page.innerHTML = `<header class="tree-header"><div><p class="eyebrow" data-tree-copy="treeEyebrow"></p>
    <h1 id="tree-title" tabindex="-1"></h1></div><div class="tree-header-actions"><div id="tree-preferences"></div>
    <button type="button" class="action-button" id="tree-close"></button></div></header>
    <div class="tree-overview"><div class="tree-introduction"><p data-tree-copy="treeIntroduction"></p><p class="readout" id="tree-census" role="status"></p></div>
    <p id="tree-message" class="field-note" role="status"></p>
    <div class="tree-content"><section class="tree-chart-panel" aria-labelledby="tree-chart-title"><div class="tree-chart-heading"><h2 id="tree-chart-title"></h2><p data-tree-copy="treeChartHelp"></p>
      <div class="tree-zoom"><button type="button" id="tree-zoom-out">−</button><button type="button" id="tree-zoom-in">+</button><button type="button" id="tree-fit"></button></div></div>
      <div class="tree-legend"><span data-tree-copy="treeLegendAlive"></span><span data-tree-copy="treeLegendExtinct"></span><span data-tree-copy="treeLegendGene"></span></div>
      <div class="tree-chart-scroll" tabindex="0"><div class="tree-chart"><div class="tree-axis"></div><div class="tree-plot"><div class="tree-drawing"></div><ol class="tree-species"></ol></div></div></div>
      <div class="tree-focus"><div><strong id="tree-traced-gene" role="status"></strong><button type="button" id="tree-clear-gene" class="tree-link"></button></div>
        <label class="tree-gene-scope"><input type="checkbox" id="tree-all-species" /><span data-tree-copy="treeAllSpecies"></span></label>
        <p class="field-note" data-tree-copy="treeGeneLegend"></p></div>
      <p class="field-note tree-chart-note" data-tree-copy="treeContext"></p></section>
      <aside class="tree-detail" aria-labelledby="tree-species-title"></aside></div>
      <details class="tree-archives"><summary data-tree-copy="treeArchives"></summary><div class="tree-attempts"></div></details></div>
    <section class="tree-history-page" hidden aria-labelledby="tree-history-title"></section>`;
  document.body.append(page);
  const find = selector => page.querySelector(selector);
  let data = null;
  let runId = null;
  let sourceRunId = null;
  let selectedId = null;
  let gene = null;
  let trace = null;
  let traceMode = 'lineage';
  let requestId = 0;
  let status = 'treeLoading';
  let zoom = 1;
  let historyOpen = false;
  let historyPage = 0;
  let overviewPosition = [0, 0, 0];
  const attempt = () => data?.attempts.find(row => row.runId === runId);
  const species = () => attempt()?.species ?? [];
  const selection = () => species().find(row => row.id === selectedId);
  function request(command, fields = {}) {
    requestId += 1;
    onRequest({ command, requestId, ...fields });
  }
  // Replacing SVG/labels and asynchronous summaries must not move the viewport.
  function keepPosition(update) {
    const scroll = find('.tree-chart-scroll');
    const positions = [page.scrollTop, scroll.scrollTop, scroll.scrollLeft];
    update();
    [page.scrollTop, scroll.scrollTop, scroll.scrollLeft] = positions;
  }
  function select(id, focus = false) {
    selectedId = id; trace = null; traceMode = 'lineage'; historyPage = 0;
    keepPosition(() => { renderChart(); renderDetail(); });
    if (gene) request('gene-history', { runId, speciesId: id, key: gene });
    if (focus) {
      find('#tree-species-title').focus({ preventScroll: true });
      find('.tree-detail').scrollIntoView({ block: 'nearest' });
    }
  }
  function renderChart() {
    const focusedId = document.activeElement?.closest('.tree-species-choice')?.dataset.speciesId;
    const all = species();
    find('.tree-chart').style.minWidth = `${200 + 480 * zoom}px`;
    const layout = layoutLifeTree(all, attempt()?.endDay ?? data?.day ?? 1,
      Math.max(480, find('.tree-chart').clientWidth - 200));
    find('#tree-zoom-out').disabled = zoom === 1;
    find('#tree-zoom-in').disabled = zoom === 8;
    find('#tree-traced-gene').textContent = gene ? t('treeTracing', { gene: geneName(gene) }) : t('treeSelectGene');
    find('#tree-clear-gene').style.visibility = gene ? 'visible' : 'hidden';
    find('.tree-gene-scope').style.visibility = gene ? 'visible' : 'hidden';
    find('#tree-all-species').checked = traceMode === 'all';
    find('#tree-all-species').disabled = !trace?.branches;
    const styles = getComputedStyle(document.documentElement);
    const tokens = Object.fromEntries(TREE_TOKEN_NAMES.map(key => [key, styles.getPropertyValue(key).trim()]));
    const tracedBranches = trace?.branches ? (traceMode === 'all' ? trace.branches : trace.lineage) : [];
    const visualTrace = trace?.branches ? { ...trace, mode: traceMode,
      originLabel: trace.firstAppearance ? t('treeOriginMarker', { day: integer(trace.firstAppearance.day) }) : '',
      branches: tracedBranches.map(branch => ({ ...branch,
      events: branch.events.map(event => ({ ...event,
        label: !event.trait.active ? '○' : trace.quantitative ? integer(event.trait.value) : geneValue(event.trait),
      })),
    })) } : null;
    find('.tree-drawing').innerHTML = createLifeTreeSvg(layout, { selectedId, trace: visualTrace, tokens });
    find('.tree-plot').style.height = `${layout.height}px`;
    const axis = find('.tree-axis');
    axis.replaceChildren();
    for (let index = 0; index <= (layout.end === layout.start ? 0 : 4); index += 1) {
      const day = layout.start + (layout.end - layout.start) * index / 4;
      const label = node('span', '', t('treeDay', { day: integer(Math.round(day)) }));
      label.style.left = `${layout.x(day)}px`; axis.append(label);
    }
    const branches = new Map(tracedBranches.map(branch => [branch.speciesId, branch]));
    const list = find('.tree-species');
    list.replaceChildren(...layout.rows.map(({ record, depth }) => {
      const item = node('li');
      const choice = button('', () => select(record.id, true), 'tree-species-choice');
      choice.dataset.speciesId = record.id;
      choice.dataset.role = record.role;
      choice.setAttribute('aria-pressed', String(record.id === selectedId));
      const copy = node('span', 'tree-species-copy');
      copy.style.paddingInlineStart = `${Math.min(depth, 5) * 7 + 12}px`;
      copy.append(node('span', 'tree-species-name', record.name), node('span', 'tree-species-meta',
        `${t(record.extinctDay === null ? 'treeAlive' : 'treeExtinct')} · ${t('treeDay', { day: integer(record.originDay) })}`));
      const branch = branches.get(record.id);
      if (visualTrace) choice.dataset.geneContext = String(!branch);
      if (branch) {
        const active = branch.events.some(event => event.trait.active);
        choice.dataset.genePresent = String(active);
        const latest = branch.events.at(-1).trait;
        copy.append(node('strong', 'tree-species-gene', latest.active ? geneValue(latest) : t(active ? 'treeGeneLost' : 'treeGeneInactive')));
      }
      choice.append(copy);
      const label = t('treeSelectSpecies', { name: record.name,
        status: t(record.extinctDay === null ? 'treeAlive' : 'treeExtinct'), day: integer(record.originDay) });
      choice.setAttribute('aria-label', branch ? `${label}. ${geneName(gene)}: ${branch.events.map(event =>
        `${t('treeDay', { day: integer(event.day) })}, ${event.trait.active ? geneValue(event.trait) : t('treeGeneInactive')}`).join('; ')}${branch.complete ? '' : `. ${t('treeHistoryIncomplete')}`}` : label);
      item.append(choice); return item;
    }));
    if (focusedId) [...list.querySelectorAll('button')].find(item => item.dataset.speciesId === focusedId)?.focus({ preventScroll: true });
    if (data) find('#tree-message').textContent = !all.length ? t('treeEmpty') : '';
  }
  function speciesLink(record) {
    return button(record.name, () => {
      if (historyOpen) closeHistory(false);
      select(record.id, true);
    }, 'tree-link');
  }
  function renderTrace(container) {
    container.replaceChildren();
    if (!gene) { container.append(node('p', 'field-note', t('treeGeneHelp'))); return; }
    container.append(node('h3', '', geneName(gene)), node('p', 'field-note', t(`treeGeneHelp_${gene}`)));
    if (!trace) { container.append(node('p', 'field-note', t('treeLoading'))); return; }
    if (trace.error) { container.append(node('p', 'field-note', t('treeError'))); return; }
    if (!trace.complete || traceMode === 'all' && trace.branches.some(branch => !branch.complete)) {
      container.append(node('p', 'tree-history-notice', t('treeHistoryIncomplete')));
    }
    if (trace.firstAppearance) {
      container.append(node('p', 'tree-origin', t('treeFirstAppearance', { name: trace.firstAppearance.name, day: integer(trace.firstAppearance.day) })));
    } else container.append(node('p', 'field-note', t('treeNeverPresent')));
    container.append(button(t('treeOpenHistory', { count: integer(trace.events.length) }), openHistory, 'action-button tree-history-open'),
      button(t('treeViewGene'), () => {
        find('.tree-chart-scroll').scrollIntoView({ block: 'center' });
        find('.tree-chart-scroll').focus({ preventScroll: true });
      }, 'tree-link tree-view-gene'));
  }
  function openHistory() {
    const scroll = find('.tree-chart-scroll');
    overviewPosition = [page.scrollTop, scroll.scrollTop, scroll.scrollLeft];
    historyOpen = true; historyPage = 0;
    find('.tree-overview').hidden = true;
    find('.tree-history-page').hidden = false;
    renderHistory(); page.scrollTop = 0;
    find('#tree-history-title').focus({ preventScroll: true });
  }
  function closeHistory(focus = true) {
    historyOpen = false;
    find('.tree-history-page').hidden = true;
    find('.tree-overview').hidden = false;
    keepPosition(renderChart);
    const scroll = find('.tree-chart-scroll');
    [page.scrollTop, scroll.scrollTop, scroll.scrollLeft] = overviewPosition;
    if (focus) find('.tree-history-open')?.focus({ preventScroll: true });
  }
  function renderHistory() {
    if (!historyOpen || !trace?.events) return;
    const container = find('.tree-history-page');
    const focused = document.activeElement?.dataset.historyAction;
    container.replaceChildren(button(t('treeBackToTree'), () => closeHistory(), 'action-button'));
    const title = node('h2', '', t('treeGeneTrace', { gene: geneName(gene) }));
    title.id = 'tree-history-title'; title.tabIndex = -1;
    container.append(title, node('p', 'tree-history-species', selection().name), node('p', 'field-note', t('treeHistoryScope')));
    if (!trace.complete) container.append(node('p', 'tree-history-notice', t('treeHistoryIncomplete')));
    const start = historyPage * HISTORY_PAGE_SIZE;
    const timeline = node('ol', 'tree-gene-timeline');
    timeline.start = start + 1;
    for (const event of trace.events.slice(start, start + HISTORY_PAGE_SIZE)) {
      const item = node('li');
      item.dataset.kind = event.kind;
      item.append(node('span', 'readout', t('treeDay', { day: integer(event.day) })),
        speciesLink(species().find(row => row.id === event.speciesId)),
        node('span', '', t(`treeEvent_${event.kind}`)), node('strong', '', geneValue(event.trait)));
      timeline.append(item);
    }
    const pagination = node('nav', 'tree-pagination');
    pagination.setAttribute('aria-label', t('treeHistoryPages'));
    const pages = Math.max(1, Math.ceil(trace.events.length / HISTORY_PAGE_SIZE));
    const move = delta => {
      historyPage += delta; renderHistory();
      page.scrollTop = 0; find('#tree-history-title').focus({ preventScroll: true });
    };
    const previous = button(t('treePrevious'), () => move(-1), 'action-button');
    const next = button(t('treeNext'), () => move(1), 'action-button');
    previous.disabled = historyPage === 0; next.disabled = historyPage === pages - 1;
    previous.dataset.historyAction = 'previous'; next.dataset.historyAction = 'next';
    pagination.append(previous, node('span', 'field-note', t('treePageCount', { page: integer(historyPage + 1), pages: integer(pages), count: integer(trace.events.length) })), next);
    container.append(pagination, timeline);
    if (focused) container.querySelector(`[data-history-action="${focused}"]`)?.focus({ preventScroll: true });
  }
  function renderDetail() {
    const detail = find('.tree-detail');
    const record = selection();
    detail.replaceChildren();
    const heading = node('h2', '', record?.name ?? t('treeSelectPrompt'));
    heading.id = 'tree-species-title'; heading.tabIndex = -1;
    detail.append(node('p', 'eyebrow', t('treeSpecimen')), heading);
    if (!record) return;
    detail.append(node('p', 'tree-status', t(record.extinctDay === null ? 'treeAlive' : 'treeExtinct')),
      node('p', 'tree-description', t('treeDescription', { role: roleName(record.role),
        habitats: record.habitats.map(habitat => t(`treeHabitat_${habitat}`)).join(t('treeJoin')),
        movement: t(record.mobile ? 'treeMobile' : 'treeStationary') })), node('h3', '', t('treeGenes')));
    const genes = node('div', 'tree-genes');
    for (const trait of record.traits.filter(trait => trait.active)) {
      const choice = button('', () => keepPosition(() => {
        gene = trait.key; trace = null; traceMode = 'lineage'; historyPage = 0;
        for (const item of genes.children) item.setAttribute('aria-pressed', String(item.dataset.gene === gene));
        renderTrace(find('.tree-trace')); renderChart();
        request('gene-history', { runId, speciesId: selectedId, key: gene });
      }), 'tree-gene');
      choice.dataset.gene = trait.key;
      choice.setAttribute('aria-pressed', String(gene === trait.key));
      choice.append(node('span', '', geneName(trait.key)), node('strong', '', geneValue(trait)));
      genes.append(choice);
    }
    const tracePanel = node('section', 'tree-trace'); tracePanel.setAttribute('aria-live', 'polite');
    detail.append(genes, tracePanel);
    renderTrace(tracePanel);
    const facts = node('dl', 'tree-facts');
    for (const [label, value] of [['treeOriginDay', integer(record.originDay)],
      ['treeEndDay', record.extinctDay === null ? t('treeStillLiving') : integer(record.extinctDay)],
      ['treePopulation', integer(record.population)], ['treeRange', integer(record.occupiedHexes)]]) {
      const row = node('div'); row.append(node('dt', '', t(label)), node('dd', '', value)); facts.append(row);
    }
    detail.append(facts);
    const family = node('div', 'tree-family');
    family.append(node('h3', '', t('treeAncestor')));
    const parent = species().find(row => row.id === record.parentId);
    family.append(parent ? speciesLink(parent) : node('p', 'field-note', t('treeFounder')));
    const children = species().filter(row => row.parentId === record.id);
    if (children.length) { family.append(node('h3', '', t('treeDescendants'))); for (const child of children) family.append(speciesLink(child)); }
    detail.append(family, button(t('treeBack'), onClose, 'action-button tree-detail-back'));
  }
  function render() {
    if (page.hidden) return;
    for (const element of page.querySelectorAll('[data-tree-copy]')) element.textContent = t(element.dataset.treeCopy);
    find('#tree-title').textContent = t('treeTitle');
    find('#tree-close').textContent = t('treeBack');
    find('#tree-chart-title').textContent = t('treeLineages');
    find('#tree-zoom-out').setAttribute('aria-label', t('treeZoomOut'));
    find('#tree-zoom-in').setAttribute('aria-label', t('treeZoomIn'));
    find('#tree-fit').textContent = t('treeFit');
    find('#tree-clear-gene').textContent = t('treeClearGene');
    find('.tree-chart-scroll').setAttribute('aria-label', t('treeChartHelp'));
    find('.tree-archives').hidden = (data?.attempts.length ?? 0) < 2;
    find('.tree-attempts').replaceChildren(...(data?.attempts ?? []).map(row => {
      const choice = button(t(row.runId === data.runId ? 'treeCurrentAttempt' : 'treeAttemptOption',
        { number: integer(row.number), count: integer(row.species.length) }), () => {
        runId = row.runId; selectedId = species()[0]?.id ?? null;
        gene = null; trace = null; requestId += 1; zoom = 1; render();
      }, 'tree-link');
      choice.dataset.runId = row.runId;
      choice.setAttribute('aria-pressed', String(runId === row.runId));
      return choice;
    }));
    const alive = species().filter(row => row.extinctDay === null).length;
    find('#tree-census').textContent = data ? t('treeCensus', { alive: integer(alive), extinct: integer(species().length - alive), day: integer(data.day) }) : '';
    find('#tree-message').textContent = status ? t(status) : '';
    keepPosition(() => { if (!historyOpen) renderChart(); renderDetail(); renderHistory(); });
  }
  find('#tree-close').addEventListener('click', onClose);
  find('#tree-all-species').addEventListener('change', event => keepPosition(() => {
    traceMode = event.target.checked ? 'all' : 'lineage';
    renderChart(); renderTrace(find('.tree-trace'));
  }));
  find('#tree-clear-gene').addEventListener('click', () => keepPosition(() => {
    gene = null; trace = null; requestId += 1;
    renderChart(); renderDetail();
    find('.tree-chart-scroll').focus({ preventScroll: true });
  }));
  page.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !event.target.closest('.theme-picker')) {
      if (historyOpen) closeHistory(); else onClose();
    }
  });
  find('#tree-zoom-in').addEventListener('click', () => { zoom = Math.min(8, zoom * 2); renderChart(); });
  find('#tree-zoom-out').addEventListener('click', () => { zoom = Math.max(1, zoom / 2); renderChart(); });
  find('#tree-fit').addEventListener('click', () => { zoom = 1; renderChart(); find('.tree-chart-scroll').scrollLeft = 0; });
  new ResizeObserver(() => { if (!page.hidden && !historyOpen) keepPosition(renderChart); }).observe(find('.tree-chart-scroll'));
  document.addEventListener('emergence:localechange', render);
  new MutationObserver(() => { if (!page.hidden && !historyOpen) keepPosition(renderChart); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return {
    get open() { return !page.hidden; },
    show() {
      traceMode = 'lineage';
      historyOpen = false; find('.tree-history-page').hidden = true; find('.tree-overview').hidden = false;
      page.hidden = false; data = null; trace = null; status = 'treeLoading';
      request('tree'); render(); find('#tree-title').focus();
    },
    hide() { page.hidden = true; requestId += 1; },
    receive(message) {
      if (page.hidden || message.requestId !== requestId) return;
      if (message.command === 'gene-history') {
        trace = message.error ? { error: true } : message.trace;
        keepPosition(() => { renderTrace(find('.tree-trace')); renderChart(); }); return;
      }
      if (message.error) { status = 'treeError'; render(); return; }
      const sameRun = sourceRunId === message.tree.runId;
      sourceRunId = message.tree.runId;
      data = message.tree;
      if (!sameRun) zoom = 1;
      if (!data.attempts.some(row => row.runId === runId)) runId = data.runId;
      if (!sameRun || !selection()) { selectedId = species()[0]?.id ?? null; gene = null; }
      status = ''; render();
      if (gene && selectedId) request('gene-history', { runId, speciesId: selectedId, key: gene });
    },
  };
}
