import { t, formatNumber } from './locale.js';
import { createSpecimenSvg, createPopulationTrendSvg } from '../rendering/specimen.js';

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

function reconcileOptions(select, rows, label, preferred) {
  const previous = preferred ?? select.value;
  const ids = new Set(rows.map(row => String(row.id)));
  for (const option of [...select.options]) if (!ids.has(option.value)) option.remove();
  const options = new Map([...select.options].map(option => [option.value, option]));
  for (const row of rows) {
    const id = String(row.id);
    let option = options.get(id);
    if (!option) { option = document.createElement('option'); option.value = id; select.append(option); }
    option.textContent = t(label, { id, population: integer(row.population) });
  }
  select.value = ids.has(String(previous)) ? String(previous) : String(rows[0]?.id ?? '');
}

/** Translate common life observations without reading model storage or genomes. */
export function createLifeNotebook({ onSpeciesSelect, onLocate }) {
  const speciesSelect = document.querySelector('#species-select');
  const speciesPanel = document.querySelector('#species-panel');
  const detail = document.querySelector('#species-detail');
  const population = element('p', 'species-population');
  const ancestry = element('p', 'field-note species-ancestry');
  const locationLabel = element('label', 'field-note variant-label');
  locationLabel.htmlFor = 'species-location-select';
  const locationSelect = element('select');
  locationSelect.id = 'species-location-select';
  const locate = element('button', 'notebook-button');
  locate.type = 'button';
  const variantLabel = element('label', 'field-note variant-label');
  variantLabel.htmlFor = 'variant-select';
  const variantSelect = element('select');
  variantSelect.id = 'variant-select';
  const variantPopulation = element('p', 'field-note variant-population');
  const phenotype = element('p', 'variant-profile');
  const portrait = element('figure', 'specimen-portrait');
  const drawing = element('div', 'specimen-drawing');
  const caption = element('figcaption', 'field-note');
  portrait.append(drawing, caption);
  const heading = element('h3', 'gene-heading');
  const traits = element('dl', 'gene-list');
  const geneHelp = element('p', 'field-note gene-help');
  detail.append(population, ancestry, locationLabel, locationSelect, locate, variantLabel, variantSelect, variantPopulation, phenotype, portrait, heading, traits, geneHelp);
  let observation = null;
  let selectedSpeciesId = null;
  let traitSignature = '';
  let messageKey = 'lifeReady';
  let failed = false;
  let retryAvailable = false;
  let pinnedId = null;
  let busy = false;
  let lastLocale = '';
  const history = [];
  const trend = document.querySelector('#life-population-trend');

  function geneValue(trait, variant) {
    if (trait.key === 'size') return t('geneBodySize', { value: integer(trait.value), cells: variant.cells === undefined ? t('unavailable') : integer(variant.cells) });
    if (trait.key === 'landAdaptation') return t(['geneAquatic', 'geneAmphibious', 'geneTerrestrial', 'geneDryLand'][trait.value] || 'geneAbsent');
    if (trait.key === 'temperatureTolerance' && trait.active && variant.temperatureRange) {
      const [minimum, maximum] = variant.temperatureRange;
      return t('geneTemperatureRange', { minimum: integer(minimum), maximum: integer(maximum) });
    }
    if (!trait.active) return t('geneAbsent');
    if (trait.max > 1) return t('geneLevel', { value: integer(trait.value) });
    return t('genePresent');
  }

  function renderTraits(variant, force) {
    const signature = `${variant.id}:${JSON.stringify(variant.traits)}:${document.documentElement.lang}`;
    if (!force && signature === traitSignature) return;
    traitSignature = signature;
    drawing.innerHTML = createSpecimenSvg(variant.traits);
    traits.replaceChildren();
    for (const trait of variant.traits) {
      const row = element('div', `gene-row${trait.active ? ' is-active' : ''}`);
      const term = element('dt', '', geneKeys[trait.key] ? t(geneKeys[trait.key]) : trait.key);
      const value = element('dd', '', geneValue(trait, variant));
      const bar = element('span', 'gene-expression');
      bar.setAttribute('aria-hidden', 'true');
      const fill = element('span');
      const fraction = trait.active ? (trait.max === trait.min ? 1 : Math.max(0.08, (trait.value - trait.min) / (trait.max - trait.min))) : 0;
      fill.style.width = `${Math.min(1, fraction) * 100}%`;
      bar.append(fill);
      row.append(term, value, bar);
      traits.append(row);
    }
  }

  function renderSpecies(force = false) {
    const rows = observation?.species ?? [];
    speciesPanel.hidden = rows.length === 0;
    if (!rows.length) {
      if (selectedSpeciesId !== null) { selectedSpeciesId = null; onSpeciesSelect(null); }
      return;
    }
    reconcileOptions(speciesSelect, rows, 'speciesOption', selectedSpeciesId);
    const species = rows.find(row => String(row.id) === speciesSelect.value) || rows[0];
    if (selectedSpeciesId !== species.id) {
      selectedSpeciesId = species.id;
      onSpeciesSelect(selectedSpeciesId);
    }
    population.textContent = t('speciesPopulation', { population: integer(species.population), locations: integer(species.locations.length) });
    ancestry.textContent = species.parentId ? t('speciesDescendant', { id: species.parentId }) : t('speciesFounder');
    locationLabel.textContent = t('speciesLocations');
    reconcileOptions(locationSelect, species.locations.map(row => ({ ...row, id: row.hexId })), 'speciesLocationOption');
    locate.textContent = t('viewLocation');
    locate.disabled = !species.locations.length;
    variantLabel.textContent = t('inspectVariant');
    const variants = species.variants ?? [];
    reconcileOptions(variantSelect, variants, 'variantOption');
    const variant = variants.find(row => String(row.id) === variantSelect.value);
    variantSelect.disabled = variants.length < 2;
    caption.textContent = t('specimenCaption');
    heading.textContent = t('geneHeading');
    geneHelp.textContent = t('geneHelp');
    if (variant) {
      variantPopulation.textContent = t('variantPopulation', { population: integer(variant.population), share: formatNumber(variant.population / Math.max(1, species.population), 'percent') });
      const roleKey = { producer: 'roleProducer', grazer: 'roleGrazer', predator: 'rolePredator', mixed: 'roleMixed', other: 'roleOther' }[variant.role] || 'roleOther';
      const habitats = (variant.habitats ?? []).map(habitat => t(habitat === 'water' ? 'waterHabitat' : 'land')).join(' / ');
      phenotype.textContent = t('variantProfile', { role: t(roleKey), habitats: habitats || t('unavailable') });
      renderTraits(variant, force);
    }
  }

  function renderControls() {
    const status = observation?.status ?? 'not-introduced';
    document.querySelector('#start-life').disabled = pinnedId === null || busy || failed || status === 'living';
    document.querySelector('#retry-life').disabled = busy;
  }

  function render() {
    const counts = observation?.counts ?? { organisms: 0, species: 0, variants: 0, occupiedHexes: 0 };
    const status = observation?.status ?? 'not-introduced';
    for (const [id, key] of [['organism-count', 'organisms'], ['species-count', 'species'], ['variant-count', 'variants'], ['occupied-count', 'occupiedHexes']]) {
      const output = document.getElementById(id);
      output.textContent = integer(counts[key]);
      output.dataset.count = String(counts[key]);
    }
    document.querySelector('.life-panel').dataset.status = status;
    const state = document.querySelector('#life-state');
    state.textContent = t(failed ? 'lifeModelFailed' : status === 'living' ? 'lifeLiving' : status === 'extinct' ? 'lifeExtinct' : 'lifeNotIntroduced');
    state.dataset.status = failed ? 'error' : status;
    document.querySelector('#life-census-day').textContent = t('lifeCensusDay', { day: integer(observation?.day ?? 0) });
    document.querySelector('#life-introduction-controls').hidden = status === 'living' || failed;
    const start = document.querySelector('#start-life');
    start.disabled = pinnedId === null || busy || failed || status === 'living';
    const retry = document.querySelector('#retry-life');
    retry.hidden = !failed || !retryAvailable;
    retry.disabled = busy;
    document.querySelector('.life-introduction').textContent = t(status === 'living' ? 'lifeEstablished' : 'lifeIntroduction');
    document.querySelector('#life-title').textContent = t(status === 'extinct' ? 'lifeExtinct' : status === 'living' ? 'lifeLiving' : 'lifeBeginning');
    document.querySelector('#life-message').textContent = t(failed ? retryAvailable ? 'lifeInitializationError' : 'lifeError' : messageKey);
    const events = document.querySelector('#life-events');
    events.replaceChildren();
    for (const [key, label] of [['births', 'lifeBirths'], ['deaths', 'lifeDeaths'], ['mutations', 'lifeMutations'], ['failedEstablishments', 'lifeFailedEstablishments']]) {
      const row = element('div');
      row.append(element('dt', '', t(label)), element('dd', '', integer(observation?.stats?.[key] ?? 0)));
      events.append(row);
    }
    trend.hidden = status === 'not-introduced';
    if (!trend.hidden && history.length) {
      const values = { first: integer(history[0].day), last: integer(history.at(-1).day) };
      trend.querySelector('.population-trend-drawing').innerHTML = createPopulationTrendSvg(history, { label: t('populationTrendLabel', values) });
      trend.querySelector('figcaption').textContent = t('populationTrendLabel', values);
    }
    renderSpecies(lastLocale !== document.documentElement.lang);
    lastLocale = document.documentElement.lang;
  }

  speciesSelect.addEventListener('change', () => {
    selectedSpeciesId = observation.species.find(row => String(row.id) === speciesSelect.value)?.id ?? null;
    onSpeciesSelect(selectedSpeciesId);
    variantSelect.value = '';
    locationSelect.value = '';
    renderSpecies();
  });
  variantSelect.addEventListener('change', () => renderSpecies());
  locate.addEventListener('click', () => {
    const species = observation?.species.find(row => row.id === selectedSpeciesId);
    if (species?.locations.length) {
      const location = species.locations.find(row => String(row.hexId) === locationSelect.value);
      if (location) onLocate(location.hexId);
    }
  });
  render();
  return {
    update(next, options = {}) {
      if (next?.runId && observation?.runId && next.runId !== observation.runId) {
        history.length = 0;
        selectedSpeciesId = null;
        traitSignature = '';
        variantSelect.value = '';
        locationSelect.value = '';
        onSpeciesSelect(null);
      }
      if (next?.status === 'extinct' && observation?.status !== 'extinct') messageKey = 'lifeExtinctionMessage';
      observation = next;
      if (next && next.status !== 'not-introduced') {
        const sample = { day: next.day, population: next.counts.organisms };
        if (history.at(-1)?.day === sample.day) history[history.length - 1] = sample;
        else history.push(sample);
        if (history.length > 120) history.shift();
      }
      busy = options.busy ?? busy;
      pinnedId = options.pinnedId === undefined ? pinnedId : options.pinnedId;
      render();
    },
    setInteraction(nextBusy, nextPin) { busy = nextBusy; pinnedId = nextPin; renderControls(); },
    message(key) { messageKey = rejectionKeys[key] || (key === 'lifeIntroduced' ? key : 'lifeError'); render(); },
    fail({ canRetry = false } = {}) { failed = true; busy = false; retryAvailable = canRetry; render(); },
    selectSpecies(id) { selectedSpeciesId = id; variantSelect.value = ''; locationSelect.value = ''; onSpeciesSelect(id); renderSpecies(); },
    reset() { history.length = 0; failed = false; retryAvailable = false; selectedSpeciesId = null; traitSignature = ''; messageKey = 'lifeReady'; observation = null; onSpeciesSelect(null); render(); },
    localSummary(id) {
      const row = observation?.hexes.find(hex => hex.hexId === id);
      return row?.population ? t('lifeHexCount', { organisms: integer(row.population), species: integer(row.species.length) }) : t('lifeNoLocal');
    },
  };
}
