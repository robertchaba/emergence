import { t, formatNumber } from './locale.js';
import { createLifeTrendSvg } from '../rendering/life-trend.js';
import { createNumberAnimator } from './number-animation.js';

const integer = value => formatNumber(value, 'integer');
// Presentation cutoffs only; all carrier observations remain intact.
const minimumExpressionShare = 0.02;
const universalExpressionShare = 1 - minimumExpressionShare;
const energyKeys = ['photosynthesis', 'plantFeeding', 'animalFeeding'];
const leadingTraits = [...energyKeys, 'size', 'sexualReproduction'];
// Copy before sorting: common model observations are read-only.
const orderedTraits = traits => [...traits].sort((a, b) =>
  (leadingTraits.indexOf(a.key) < 0 ? leadingTraits.length : leadingTraits.indexOf(a.key))
  - (leadingTraits.indexOf(b.key) < 0 ? leadingTraits.length : leadingTraits.indexOf(b.key)));
const geneKeys = {
  size: 'geneSize', photosynthesis: 'genePhotosynthesis', trunk: 'geneTrunk',
  temperatureTolerance: 'geneTemperatureTolerance', landAdaptation: 'geneLandAdaptation',
  movement: 'geneMovement', plantFeeding: 'genePlantFeeding', animalFeeding: 'geneAnimalFeeding',
  poison: 'genePoison', spines: 'geneSpines', detoxification: 'geneDetoxification',
  biteForce: 'geneBiteForce', skeleton: 'geneSkeleton', armor: 'geneArmor', armorType: 'geneArmorType',
  flight: 'geneFlight', eyesight: 'geneEyesight', echolocation: 'geneEcholocation',
  thermalSensing: 'geneThermalSensing', sexualReproduction: 'geneSexualReproduction',
  elevationTolerance: 'geneElevationTolerance', depthTolerance: 'geneDepthTolerance',
};
const rejectionKeys = {
  'already-introduced': 'lifeAlreadyIntroduced', 'unknown-hex': 'lifeUnknownHex',
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
  const localPopulation = element('p', 'species-local-population');
  const heading = element('h4', 'gene-heading');
  const traits = element('dl', 'gene-list');
  const tendencies = element('details', 'species-tendencies');
  const tendencyHeading = element('summary', 'gene-heading');
  const tendencyList = element('ul', 'tendency-list');
  tendencies.append(tendencyHeading, tendencyList);
  detail.append(population, localPopulation, heading, traits, tendencies);
  const buttons = new Map();
  const numbers = createNumberAnimator();
  let observation = null;
  // Undefined permits a sole occupant to open by default; null records a collapse.
  let expandedId;
  let highlightedId = null;
  let traitSpeciesId = null;
  let selectedVariant = null;
  const traitRows = new Map();
  const expressionNodes = new Map();
  const tendencyNodes = new Map();
  let messageKey = '';
  let failed = false;
  let retryAvailable = false;
  let pinnedId = null;
  let busy = false;
  let totalHexes = 0;
  let populationSpeciesId = null;
  let populationHexId = null;

  function highlight(id) {
    if (highlightedId === id) return;
    highlightedId = id;
    selectedVariant = null;
    onVariantSelect(null);
    onSpeciesSelect(id);
  }

  function geneValue(trait) {
    if (trait.key === 'size') {
      const scale = ['geneSizeTiny', 'geneSizeVerySmall', 'geneSizeSmall', 'geneSizeFairlySmall',
        'geneSizeMedium', 'geneSizeModeratelyLarge', 'geneSizeLarge', 'geneSizeVeryLarge', 'geneSizeHuge', 'geneSizeEnormous'];
      const fraction = (trait.value - trait.min) / (trait.max - trait.min || 1);
      return t(scale[Math.max(0, Math.min(scale.length - 1, Math.round(fraction * (scale.length - 1))))]);
    }
    if (trait.key === 'landAdaptation') return t(['geneAquatic', 'geneAmphibious', 'geneTerrestrial', 'geneDryLand'][trait.value] || 'geneLevel', { value: integer(trait.value) });
    if (trait.key === 'skeleton') return t(['geneSoftBody', 'geneHydrostaticSkeleton', 'geneExoskeleton', 'geneEndoskeleton'][trait.value] || 'geneLevel', { value: integer(trait.value) });
    if (trait.key === 'armorType') return t(['geneFlexibleCovering', 'geneMineralShell', 'geneSegmentedPlates', 'geneScales'][trait.value] || 'geneLevel', { value: integer(trait.value) });
    if (trait.key === 'temperatureTolerance' && trait.temperatureRange) {
      const [minimum, maximum] = trait.temperatureRange;
      return t('geneTemperatureRange', { minimum: integer(minimum), maximum: integer(maximum) });
    }
    if (trait.max > 1) return t('geneLevel', { value: integer(trait.value) });
    return '';
  }

  function renderTraits(species) {
    const focusedTrait = traits.contains(document.activeElement) ? document.activeElement : null;
    const establishedTraits = species.variants?.[0]?.traits ?? [];
    if (traitSpeciesId !== species.id) {
      traits.replaceChildren(); traitRows.clear(); expressionNodes.clear();
      tendencyList.replaceChildren(); tendencyNodes.clear();
      tendencies.open = false;
      traitSpeciesId = species.id;
    }
    const visibleTraits = new Set();
    const visibleExpressions = new Set();
    let selectedExpression = null;
    for (const trait of orderedTraits(species.traits ?? [])) {
      const expressions = trait.expressions.filter(expression => expression.population / species.population >= minimumExpressionShare);
      if (!expressions.length) continue;
      visibleTraits.add(trait.key);
      const partial = trait.population / species.population < universalExpressionShare;
      let row = traitRows.get(trait.key);
      if (!row) {
        row = element('div'); row.append(element('dt'), element('dd'));
        traits.append(row); traitRows.set(trait.key, row);
      }
      row.className = `gene-row${partial ? ' is-partial' : ''}`;
      row.dataset.gene = trait.key;
      // New traits can appear during playback; maintain the same reading order.
      const position = visibleTraits.size - 1;
      if (traits.children[position] !== row) traits.insertBefore(row, traits.children[position] ?? null);
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
        node.className = `gene-expression${fraction < universalExpressionShare ? ' gene-expression-partial' : ''}`;
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
    if (focusedTrait?.isConnected && document.activeElement !== focusedTrait) focusedTrait.focus({ preventScroll: true });
    const directions = species.tendencies ?? [];
    tendencies.hidden = directions.length === 0;
    tendencyHeading.textContent = t('tendencyHeading');
    const visibleTendencies = new Set();
    for (const direction of directions) {
      const id = `tendency:${direction.id}`;
      visibleTendencies.add(id);
      let button = tendencyNodes.get(id);
      if (!button) {
        button = element('button', 'gene-expression tendency-choice');
        button.type = 'button';
        button.dataset.tendencyId = direction.id;
        const item = element('li'); item.append(button); tendencyList.append(item);
        button.addEventListener('click', () => {
          highlight(species.id);
          selectedVariant = selectedVariant === id ? null : id;
          renderSpecies();
        });
        tendencyNodes.set(id, button);
      }
      const changes = direction.changes ?? (direction.traits ?? []).filter(trait =>
        establishedTraits.find(current => current.key === trait.key)?.value !== trait.value);
      const descriptions = orderedTraits(changes).map(trait => {
        const gene = geneKeys[trait.key] ? t(geneKeys[trait.key]) : trait.label ?? trait.key;
        const value = trait.value === null ? t('geneAbsent')
          : trait.max === 1 ? t(trait.value ? 'geneEnabled' : 'geneDisabled')
            : ['movement', 'trunk', 'elevationTolerance', 'depthTolerance', 'poison', 'spines',
              'detoxification', 'biteForce', 'armor', 'flight', 'eyesight', 'echolocation', 'thermalSensing'].includes(trait.key)
              ? integer(trait.value) : geneValue(trait);
        return t('tendencyChange', { gene, value });
      }).join(' · ');
      const count = direction.locations?.length ?? 0;
      button.textContent = t('tendencyRange', { changes: descriptions, count: integer(count) });
      button.disabled = count === 0;
      const selected = selectedVariant === id && !button.disabled;
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', t(selected ? 'clearTendencyHighlight' : 'highlightTendency', { changes: descriptions, count: integer(count) }));
      if (selected) selectedExpression = { id, hexIds: direction.locations.map(location => location.hexId) };
    }
    for (const [id, button] of tendencyNodes) if (!visibleTendencies.has(id)) {
      if (document.activeElement === button) buttons.get(species.id)?.focus({ preventScroll: true });
      button.parentElement.remove(); tendencyNodes.delete(id);
    }
    if (!selectedExpression) selectedVariant = null;
    onVariantSelect(selectedExpression);
  }

  function renderSpecies() {
    const occupants = observation?.hexes.find(hex => hex.hexId === pinnedId)?.species ?? [];
    const ids = new Set(occupants.map(row => row.id));
    speciesPanel.hidden = !ids.size;
    document.querySelector('#hex-life-empty').hidden = pinnedId === null || ids.size > 0;
    if (!ids.has(highlightedId)) highlight(null);
    if (expandedId !== null && !ids.has(expandedId)) {
      expandedId = occupants.length === 1 ? occupants[0].id : undefined;
      if (expandedId !== undefined) highlight(expandedId);
    }
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
        const copy = element('span', 'species-choice-copy');
        copy.append(element('span', 'species-name'), element('span', 'species-energy'));
        button.append(copy);
        const row = element('li');
        row.append(button);
        list.append(row);
        buttons.set(species.id, button);
        button.addEventListener('click', () => {
          const collapse = expandedId === species.id;
          expandedId = collapse ? null : species.id;
          highlight(collapse || highlightedId === species.id ? null : species.id);
          renderSpecies();
        });
      }
      button.querySelector('.species-name').textContent = species.name ?? t('speciesName', { id: species.id });
      const sources = energyKeys.filter(key => species.traits?.some(trait => trait.key === key
        && trait.expressions.some(expression => expression.value > 0
          && expression.population / species.population >= minimumExpressionShare)));
      const energy = button.querySelector('.species-energy');
      const labels = sources.map(key => t(geneKeys[key]));
      if (energy.textContent !== labels.join('')) {
        energy.replaceChildren(...sources.map((key, index) => {
          const label = element('span', 'species-energy-label', labels[index]);
          label.dataset.energy = key;
          return label;
        }));
      }
      button.dataset.collapsible = 'true';
      button.setAttribute('aria-pressed', String(highlightedId === species.id));
      button.setAttribute('aria-expanded', String(expandedId === species.id));
      button.title = t(expandedId === species.id ? 'collapseSpecies' : 'expandSpecies');
      if (expandedId === species.id) {
        button.setAttribute('aria-controls', detail.id);
        if (detail.parentElement !== button.parentElement) button.parentElement.append(detail);
        numbers.set(population, species.population,
          value => t('speciesPopulation', { population: formatNumber(Math.round(value), 'compact') }),
          { immediate: populationSpeciesId !== species.id });
        numbers.set(localPopulation, occupant.population,
          value => t('speciesLocalPopulation', { population: formatNumber(Math.round(value), 'compact') }),
          { immediate: populationSpeciesId !== species.id || populationHexId !== pinnedId });
        localPopulation.dataset.count = String(occupant.population);
        populationHexId = pinnedId;
        populationSpeciesId = species.id;
        population.dataset.count = String(species.population);
        heading.textContent = t('geneHeading');
        renderTraits(species);
      } else button.removeAttribute('aria-controls');
    }
    if (expandedId == null) detail.remove();
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
      numbers.set(output, counts[key], value => key === 'occupiedHexes'
        ? formatNumber(totalHexes ? value / totalHexes : 0, 'percent') : integer(value));
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
    const categories = [...energyKeys, 'other'];
    const energyCounts = counts.speciesByEnergy;
    const history = observation?.history?.length ? observation.history : [{ day: observation?.day ?? 1, species: 0 }];
    // Historical saves may predate the energy census. Do not invent past shares.
    const energyHistory = history.filter(sample => sample.speciesByEnergy)
      .map(sample => ({ day: sample.day, ...sample.speciesByEnergy }));
    if (energyCounts && energyHistory.at(-1)?.day !== observation.day) {
      energyHistory.push({ day: observation.day, ...energyCounts });
    }
    const split = !!energyCounts;
    const plotted = split ? energyHistory : history;
    const label = t('lifeTrendLabel', { metric: t('extantSpecies'), first: integer(plotted[0]?.day ?? 1),
      last: integer(plotted.at(-1)?.day ?? 1), count: integer(counts.species) });
    const drawing = document.querySelector('.life-trend-drawing');
    drawing.innerHTML = createLifeTrendSvg(plotted, {
      metric: 'species', series: split ? categories : undefined,
      label: split ? `${label} ${t('energyTrendDescription')}` : label,
      format: value => formatNumber(value, 'compact'), formatDay: integer,
    });
    if (split) {
      const legend = element('ul', 'life-trend-legend');
      for (const key of categories) {
        const item = element('li');
        item.dataset.energy = key;
        item.dataset.count = String(energyCounts[key]);
        item.append(element('span', 'life-trend-swatch'),
          element('span', '', t('energySpeciesCount', {
            energy: t(geneKeys[key] ?? 'energyOther'), count: integer(energyCounts[key]),
          })));
        legend.append(item);
      }
      drawing.append(legend);
    }
    renderControls();
    renderSpecies();
  }

  function setPin(id) {
    if (id === pinnedId) return;
    pinnedId = id;
    expandedId = undefined;
    highlight(null);
  }

  render();
  return {
    update(next, options = {}) {
      if (next?.runId !== observation?.runId) {
        numbers.reset(); populationSpeciesId = null; traitSpeciesId = null;
        expandedId = undefined; highlight(null); messageKey = '';
      }
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
      numbers.reset(); populationSpeciesId = null;
      failed = false; retryAvailable = false; expandedId = undefined; traitSpeciesId = null;
      messageKey = ''; observation = null; pinnedId = null; totalHexes = 0;
      highlight(null); render();
    },
  };
}
