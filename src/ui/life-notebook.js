import { t, formatNumber } from './locale.js';
import { createSpecimenSvg, createSpeciesTrendSvg } from '../rendering/specimen.js';

const integer = value => formatNumber(value, 'integer');
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
export function createLifeNotebook({ onSpeciesSelect }) {
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
  let traitSignature = '';
  let messageKey = '';
  let failed = false;
  let retryAvailable = false;
  let pinnedId = null;
  let busy = false;
  let totalHexes = 0;

  function highlight(id) {
    if (highlightedId === id) return;
    highlightedId = id;
    onSpeciesSelect(id);
  }

  function geneValue(trait) {
    if (trait.key === 'size') return t('geneBodySize', { value: integer(trait.value), cells: integer(trait.cells) });
    if (trait.key === 'landAdaptation') return t(['geneAquatic', 'geneAmphibious', 'geneTerrestrial', 'geneDryLand'][trait.value] || 'genePresent');
    if (trait.key === 'temperatureTolerance' && trait.temperatureRange) {
      const [minimum, maximum] = trait.temperatureRange;
      return t('geneTemperatureRange', { minimum: integer(minimum), maximum: integer(maximum) });
    }
    if (trait.max > 1) return t('geneLevel', { value: integer(trait.value) });
    return t('genePresent');
  }

  function renderTraits(species) {
    const signature = JSON.stringify([species.traits, species.population, species.variants?.[0]?.traits, document.documentElement.lang]);
    if (signature === traitSignature) return;
    traitSignature = signature;
    drawing.innerHTML = createSpecimenSvg(species.variants?.[0]?.traits ?? []);
    traits.replaceChildren();
    for (const trait of species.traits ?? []) {
      const partial = trait.population < species.population;
      const row = element('div', `gene-row${partial ? ' is-partial' : ''}`);
      const term = element('dt', '', geneKeys[trait.key] ? t(geneKeys[trait.key]) : trait.label ?? trait.key.replace(/([a-z])([A-Z])/g, '$1 $2'));
      const values = element('dd');
      for (const expression of trait.expressions) {
        const share = formatNumber(expression.population / species.population, 'percent');
        const text = expression.population < species.population
          ? t('geneCarrierShare', { value: geneValue(expression), share }) : geneValue(expression);
        values.append(element('span', expression.population < species.population ? 'gene-expression-partial' : '', text));
      }
      row.append(term, values);
      traits.append(row);
    }
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
        population.textContent = t('speciesPopulation', { population: integer(species.population) });
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
    const history = observation?.history?.length ? observation.history : [{ day: observation?.day ?? 1, species: 0, extinctSpecies: 0 }];
    document.querySelector('.species-trend-drawing').innerHTML = createSpeciesTrendSvg(history, {
      label: t('speciesTrendLabel', { first: integer(history[0].day), last: integer(history.at(-1).day), living: integer(counts.species), extinct: integer(counts.extinctSpecies) }),
      format: integer,
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
      failed = false; retryAvailable = false; expandedId = null; traitSignature = '';
      messageKey = ''; observation = null; pinnedId = null; totalHexes = 0;
      highlight(null); render();
    },
  };
}
