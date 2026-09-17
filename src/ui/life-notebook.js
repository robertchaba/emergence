import { t, formatNumber } from './locale.js';
import { createSpecimenSvg, createLifeTrendSvg } from '../rendering/specimen.js';

const integer = value => formatNumber(value, 'integer');
// Presentation cutoffs only; all carrier observations remain intact.
const minimumExpressionShare = 0.02;
const universalExpressionShare = 1 - minimumExpressionShare;
const geneKeys = {
  size: 'geneSize', photosynthesis: 'genePhotosynthesis', trunk: 'geneTrunk',
  temperatureTolerance: 'geneTemperatureTolerance', landAdaptation: 'geneLandAdaptation',
  movement: 'geneMovement', plantFeeding: 'genePlantFeeding', animalFeeding: 'geneAnimalFeeding',
};
const rejectionKeys = {
  'already-introduced': 'lifeAlreadyIntroduced', 'unknown-hex': 'lifeUnknownHex',
  'permanent-ice': 'lifePermanentIce', 'unsuitable-conditions': 'lifeUnsuitableConditions',
  'unsuitable-habitat': 'lifeUnsuitableHabitat',
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Common observations only: the model supplies names and carrier summaries. */
export function createLifeNotebook({ onSpeciesSelect, onVariantSelect }) {
  const speciesPanel = document.querySelector('#species-panel');
  const list = document.querySelector('#species-list');
  const detail = element('div', 'species-detail');
  detail.id = 'species-detail';
  const population = element('p', 'species-population');
  const heading = element('h4', 'gene-heading');
  const traits = element('dl', 'gene-list');
  const portrait = element('figure', 'specimen-portrait');
  const drawing = element('div', 'specimen-drawing');
  const caption = element('figcaption', 'field-note');
  portrait.append(drawing, caption);
  detail.append(population, heading, traits, portrait);
  const buttons = new Map();
  let observation = null;
  let expandedId = null;
  let highlightedId = null;
  let traitSpeciesId = null;
  let portraitSignature = '';
  let selectedVariant = null;
  const traitRows = new Map();
  const expressionNodes = new Map();
  let messageKey = '';
  let failed = false;
  let retryAvailable = false;
  let pinnedId = null;
  let busy = false;
  let totalHexes = 0;

  function highlight(id) {
    if (highlightedId === id) return;
    highlightedId = id;
    selectedVariant = null;
    onVariantSelect(null);
    onSpeciesSelect(id);
  }

  function geneValue(trait) {
    if (trait.key === 'size') return t('geneBodySize', { value: integer(trait.value), cells: integer(trait.cells) });
    if (trait.key === 'landAdaptation') return t(['geneAquatic', 'geneAmphibious', 'geneTerrestrial', 'geneDryLand'][trait.value] || 'geneLevel', { value: integer(trait.value) });
    if (trait.key === 'temperatureTolerance' && trait.temperatureRange) {
      const [minimum, maximum] = trait.temperatureRange;
      return t('geneTemperatureRange', { minimum: integer(minimum), maximum: integer(maximum) });
    }
    if (trait.max > 1) return t('geneLevel', { value: integer(trait.value) });
    return '';
  }

  function renderTraits(species) {
    const portraitTraits = species.variants?.[0]?.traits ?? [];
    const signature = JSON.stringify(portraitTraits);
    if (portraitSignature !== signature) {
      drawing.innerHTML = createSpecimenSvg(portraitTraits);
      portraitSignature = signature;
    }
    if (traitSpeciesId !== species.id) {
      traits.replaceChildren(); traitRows.clear(); expressionNodes.clear();
      traitSpeciesId = species.id;
    }
    const visibleTraits = new Set();
    const visibleExpressions = new Set();
    let selectedExpression = null;
    for (const trait of species.traits ?? []) {
      const expressions = trait.expressions.filter(expression => expression.population / species.population >= minimumExpressionShare);
      if (!expressions.length) continue;
      visibleTraits.add(trait.key);
      const partial = trait.population < species.population;
      let row = traitRows.get(trait.key);
      if (!row) {
        row = element('div'); row.append(element('dt'), element('dd'));
        traits.append(row); traitRows.set(trait.key, row);
      }
      row.className = `gene-row${partial ? ' is-partial' : ''}`;
      const [term, values] = row.children;
      const geneName = geneKeys[trait.key] ? t(geneKeys[trait.key]) : trait.label ?? trait.key.replace(/([a-z])([A-Z])/g, '$1 $2');
      term.textContent = geneName;
      for (const expression of expressions) {
        const id = JSON.stringify([trait.key, expression.value]);
        visibleExpressions.add(id);
        const fraction = expression.population / species.population;
        const share = formatNumber(fraction, 'percent');
        const value = geneValue(expression);
        const text = value ? (fraction < 1 ? t('geneCarrierShare', { value, share }) : value) : share;
        const selectable = fraction < universalExpressionShare && expression.locations?.length > 0;
        const tag = selectable ? 'button' : 'span';
        let node = expressionNodes.get(id);
        if (!node || node.localName !== tag) {
          const previous = node;
          const wasFocused = previous === document.activeElement;
          node = element(tag);
          node.dataset.gene = trait.key; node.dataset.expression = String(expression.value);
          if (selectable) {
            node.type = 'button';
            node.addEventListener('click', () => {
              highlight(species.id);
              selectedVariant = selectedVariant === id ? null : id;
              renderSpecies();
            });
          }
          if (previous) previous.replaceWith(node);
          else values.append(node);
          expressionNodes.set(id, node);
          if (wasFocused) buttons.get(species.id)?.focus({ preventScroll: true });
        }
        node.className = `gene-expression${fraction < 1 ? ' gene-expression-partial' : ''}`;
        node.textContent = text;
        const selected = selectedVariant === id && selectable;
        if (selectable) {
          node.setAttribute('aria-pressed', String(selected));
          node.setAttribute('aria-label', t(selected ? 'clearGeneHighlight' : 'highlightGene', { gene: geneName, value: text }));
          node.title = node.getAttribute('aria-label');
        }
        if (selected) selectedExpression = { id, hexIds: expression.locations.map(location => location.hexId) };
      }
    }
    for (const [key, row] of traitRows) if (!visibleTraits.has(key)) { row.remove(); traitRows.delete(key); }
    for (const [id, node] of expressionNodes) if (!visibleExpressions.has(id)) { node.remove(); expressionNodes.delete(id); }
    if (!selectedExpression) selectedVariant = null;
    onVariantSelect(selectedExpression);
  }

  function renderSpecies() {
    const occupants = observation?.hexes.find(hex => hex.hexId === pinnedId)?.species ?? [];
    const ids = new Set(occupants.map(row => row.id));
    speciesPanel.hidden = !ids.size;
    document.querySelector('#hex-life-empty').hidden = pinnedId === null || ids.size > 0;
    if (!ids.has(highlightedId)) highlight(null);
    if (!ids.has(expandedId)) expandedId = occupants.length === 1 ? occupants[0].id : null;
    for (const [id, button] of buttons) {
      if (!ids.has(id)) { button.parentElement.remove(); buttons.delete(id); }
    }
    const records = new Map((observation?.species ?? []).map(row => [row.id, row]));
    for (const occupant of occupants) {
      const species = records.get(occupant.id);
      if (!species) continue;
      let button = buttons.get(species.id);
      if (!button) {
        button = element('button', 'species-choice');
        button.type = 'button';
        button.dataset.speciesId = species.id;
        const row = element('li');
        row.append(button);
        list.append(row);
        buttons.set(species.id, button);
        button.addEventListener('click', () => {
          expandedId = species.id;
          highlight(highlightedId === species.id ? null : species.id);
          renderSpecies();
        });
      }
      button.textContent = species.name ?? t('speciesName', { id: species.id });
      button.setAttribute('aria-pressed', String(highlightedId === species.id));
      button.setAttribute('aria-expanded', String(expandedId === species.id));
      button.title = t(highlightedId === species.id ? 'clearSpeciesHighlight' : 'highlightSpecies');
      if (expandedId === species.id) {
        button.setAttribute('aria-controls', detail.id);
        if (detail.parentElement !== button.parentElement) button.parentElement.append(detail);
        population.textContent = t('speciesPopulation', { population: formatNumber(species.population, 'compact') });
        population.dataset.count = String(species.population);
        heading.textContent = t('geneHeading');
        caption.textContent = t('specimenCaption');
        renderTraits(species);
      } else button.removeAttribute('aria-controls');
    }
    if (expandedId === null) detail.remove();
  }

  function renderControls() {
    const status = observation?.status ?? 'not-introduced';
    document.querySelector('#start-life').disabled = pinnedId === null || busy || failed || status === 'living';
    document.querySelector('#retry-life').disabled = busy;
  }

  function render() {
    const counts = observation?.counts ?? { species: 0, extinctSpecies: 0, occupiedHexes: 0 };
    const status = observation?.status ?? 'not-introduced';
    for (const [id, key] of [['species-count', 'species'], ['extinct-species-count', 'extinctSpecies'], ['occupied-count', 'occupiedHexes']]) {
      const output = document.getElementById(id);
      output.textContent = key === 'occupiedHexes' ? formatNumber(totalHexes ? counts[key] / totalHexes : 0, 'percent') : integer(counts[key]);
      output.dataset.count = String(counts[key]);
    }
    const panel = document.querySelector('.life-panel');
    panel.dataset.status = failed ? 'error' : status;
    panel.hidden = status === 'living' && !failed;
    document.querySelector('#life-introduction-controls').hidden = status === 'living' || failed;
    document.querySelector('#retry-life').hidden = !failed || !retryAvailable;
    document.querySelector('#life-title').textContent = t(status === 'extinct' ? 'lifeExtinct' : 'lifeBeginning');
    const message = document.querySelector('#life-message');
    const key = failed ? retryAvailable ? 'lifeInitializationError' : 'lifeError' : messageKey;
    message.textContent = key ? t(key) : '';
    message.hidden = !key;
    const history = observation?.history?.length ? observation.history : [{ day: observation?.day ?? 1, species: 0, extinctSpecies: 0, occupiedHexes: 0 }];
    document.querySelector('.life-trend-drawing').innerHTML = createLifeTrendSvg(history, {
      metric: 'species',
      label: t('lifeTrendLabel', { metric: t('extantSpecies'), first: integer(history[0].day), last: integer(history.at(-1).day), count: integer(counts.species) }),
      format: value => formatNumber(value, 'compact'), formatDay: integer,
    });
    renderControls();
    renderSpecies();
  }

  function setPin(id) {
    if (id === pinnedId) return;
    pinnedId = id;
    expandedId = null;
    highlight(null);
  }

  render();
  return {
    update(next, options = {}) {
      if (next?.runId !== observation?.runId) { expandedId = null; highlight(null); messageKey = ''; }
      observation = next;
      busy = options.busy ?? busy;
      totalHexes = options.totalHexes ?? totalHexes;
      if (options.pinnedId !== undefined) setPin(options.pinnedId);
      render();
    },
    setInteraction(nextBusy, nextPin) {
      busy = nextBusy;
      const changed = nextPin !== pinnedId;
      setPin(nextPin);
      renderControls();
      if (changed) { messageKey = ''; renderSpecies(); }
    },
    message(key) { messageKey = rejectionKeys[key] || 'lifeError'; render(); },
    fail({ canRetry = false } = {}) { failed = true; busy = false; retryAvailable = canRetry; render(); },
    reset() {
      failed = false; retryAvailable = false; expandedId = null; traitSpeciesId = null;
      messageKey = ''; observation = null; pinnedId = null; totalHexes = 0;
      highlight(null); render();
    },
  };
}
