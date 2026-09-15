import { t, formatNumber } from './locale.js';
import { generateWorld } from '../simulation/world.js';
import { setDay } from '../simulation/climate.js';
import { createMapRenderer, MAP_TOKEN_NAMES } from '../rendering/map.js';

const number = { format: (value) => formatNumber(value) };
const integer = { format: (value) => formatNumber(value, 'integer') };
const percent = { format: (value) => formatNumber(value, 'percent') };
const legends = {
  terrain: 'legendTerrain', elevation: 'legendElevation', temperature: 'legendTemperature',
  humidity: 'legendHumidity', regions: 'legendRegions',
};

function readTokens() {
  const styles = getComputedStyle(document.documentElement);
  return Object.fromEntries(MAP_TOKEN_NAMES.map((name) => [name, styles.getPropertyValue(name).trim()]));
}

/** Browser composition only: inputs become explicit engine calls; snapshots are read-only. */
export function initWorldUI() {
  const form = document.querySelector('#world-form');
  const startButton = document.querySelector('#start-workspace');
  const generationStatus = document.querySelector('#generation-status');
  const previewCanvas = document.querySelector('#world-preview');
  const canvas = document.querySelector('#world-map');
  const workspace = document.querySelector('#workspace');
  const page = document.querySelector('.page-shell');
  const themePicker = document.querySelector('.theme-picker');
  const languageSwitcher = document.querySelector('.language-switcher');
  const preferencesHome = themePicker.parentElement;
  const menu = document.querySelector('#application-menu');
  const dayOutput = document.querySelector('#world-day');
  const speedInput = document.querySelector('#simulation-speed');
  const playButton = document.querySelector('#play-world');
  const pauseButton = document.querySelector('#pause-world');
  const details = document.querySelector('#hex-details');
  const tokens = readTokens();
  const preview = createMapRenderer(previewCanvas, { tokens });
  const map = createMapRenderer(canvas, { tokens });
  let world = null;
  let camera = { zoom: 1, x: 0, y: 0 };
  let layer = 'terrain';
  let pinnedId = null;
  let generating = false;
  let savedScroll = 0;
  let generationTimer;
  let revision = 0;
  let playing = false;
  let targetSpeed = 1;
  let clockTimestamp = null;
  let dayCredit = 0;
  let measuredElapsed = 0;
  let measuredDays = 0;
  let frame = null;
  let statusKey = 'updating';
  let actualDaysPerSecond = 0;

  function readSettings() {
    const values = new FormData(form);
    return {
      seed: String(values.get('seed')),
      size: values.get('size'),
      geography: Number(values.get('geography')) / 100,
      landFraction: Number(values.get('landFraction')) / 100,
      waterAbundance: Number(values.get('waterAbundance')) / 100,
    };
  }

  function resizeRenderer(renderer, target) {
    const { width, height } = target.parentElement.getBoundingClientRect();
    if (width < 1 || height < 1) return false;
    renderer.resize(width, height, window.devicePixelRatio || 1);
    return true;
  }

  function draw() {
    frame = null;
    if (!world) return;
    if (workspace.hidden) {
      if (resizeRenderer(preview, previewCanvas)) preview.draw(world, { camera: preview.fit(world), layer: 'terrain' });
    } else if (resizeRenderer(map, canvas)) {
      map.draw(world, { camera, layer, pinnedId });
      canvas.dataset.zoom = String(camera.zoom);
      canvas.dataset.panX = String(camera.x);
      canvas.dataset.panY = String(camera.y);
      canvas.dataset.pinnedId = pinnedId === null ? '' : String(pinnedId);
      canvas.dataset.layer = layer;
      document.querySelector('#zoom-level').value = `${number.format(camera.zoom)}×`;
      document.querySelector('#zoom-out').disabled = camera.zoom <= 1;
      document.querySelector('#zoom-in').disabled = camera.zoom >= 32;
    }
  }

  function queueDraw() {
    if (frame === null) frame = requestAnimationFrame(draw);
  }

  const resize = new ResizeObserver(queueDraw);
  resize.observe(previewCanvas.parentElement);
  resize.observe(canvas.parentElement);
  new MutationObserver(() => {
    const resolved = readTokens();
    preview.setTokens(resolved);
    map.setTokens(resolved);
    queueDraw();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function addFact(list, label, value) {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    row.append(term, description);
    list.append(row);
  }

  function updateInspector(announce = true) {
    details.replaceChildren();
    const heading = document.createElement('h2');
    details.append(heading);
    if (pinnedId === null || !world) {
      heading.textContent = t('inspectHeading');
      const introduction = document.createElement('p');
      introduction.textContent = t('inspectHelp');
      details.append(introduction);
      document.querySelector('#map-status').textContent = t('noPin');
      return;
    }
    const hex = world.hexes[pinnedId];
    heading.textContent = t('hex', { col: integer.format(hex.col + 1), row: integer.format(hex.row + 1) });
    const surface = t(hex.waterType === 'sea' ? 'sea' : hex.waterType === 'lake' ? 'lake' : 'land');
    const terrain = [surface, hex.runoff > 0 && hex.waterType === 'none' && t('river'), hex.temperature < 0 && t(hex.waterType === 'none' ? 'frost' : 'ice')].filter(Boolean).join(' · ');
    const facts = document.createElement('dl');
    facts.className = 'hex-facts';
    addFact(facts, t('terrain'), terrain);
    addFact(facts, t('elevation'), `${integer.format(hex.bedElevation)} m`);
    addFact(facts, t('temperature'), `${number.format(hex.temperature)} °C`);
    addFact(facts, t('humidity'), hex.humidity === null ? t('waterMoisture') : percent.format(hex.humidity));
    details.append(facts);
    if (announce) document.querySelector('#map-status').textContent = t('pinned', { col: integer.format(hex.col + 1), row: integer.format(hex.row + 1), surface: surface.toLowerCase(), temperature: number.format(hex.temperature) });
  }

  function updateDayReadout() {
    dayOutput.value = integer.format(world.day);
    dayOutput.dataset.day = String(world.day);
    previewCanvas.dataset.day = String(world.day);
  }

  function showSpeed(output, values) {
    // Keep the complete translated phrase while giving the rate its own column.
    const [prefix, suffix] = t('speedValue', { ...values, rate: '{rate}' }).split('{rate}');
    const multiplier = document.createElement('span');
    multiplier.className = 'speed-multiplier';
    multiplier.textContent = prefix;
    const rate = document.createElement('span');
    rate.className = 'speed-rate';
    rate.textContent = values.rate + suffix;
    output.replaceChildren(multiplier, rate);
  }

  function showActualSpeed(daysPerSecond = 0) {
    const output = document.querySelector('#actual-speed');
    actualDaysPerSecond = daysPerSecond;
    showSpeed(output, { multiplier: number.format(daysPerSecond / 2), rate: number.format(daysPerSecond) });
    output.dataset.daysPerSecond = String(daysPerSecond);
  }

  function resetClock() {
    clockTimestamp = null;
    dayCredit = 0;
    measuredElapsed = 0;
    measuredDays = 0;
    showActualSpeed();
  }

  function setPlaying(next) {
    playing = next;
    updatePlaybackState();
    playButton.setAttribute('aria-pressed', String(playing));
    pauseButton.setAttribute('aria-pressed', String(!playing));
    resetClock();
  }

  function updatePlaybackState() {
    document.querySelector('#playback-state').textContent = t(playing ? 'running' : 'paused');
  }

  async function generate() {
    const request = revision;
    if (!form.checkValidity()) {
      generating = false;
      form.removeAttribute('aria-busy');
      showGenerationStatus('enterSeed');
      return;
    }
    generating = true;
    form.setAttribute('aria-busy', 'true');
    showGenerationStatus('generating');
    const settings = readSettings();
    // Paint the busy state, then discard requests superseded by newer input.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (request !== revision) return;
    try {
      world = generateWorld(settings);
      pinnedId = null;
      camera = { zoom: 1, x: 0, y: 0 };
      updateWorldSummary();
      previewCanvas.dataset.waterAbundance = String(world.waterAbundance);
      startButton.disabled = false;
      showGenerationStatus('ready');
      resetClock();
      updateDayReadout();
      updateInspector();
      queueDraw();
    } catch {
      world = null;
      previewCanvas.getContext('2d').clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      updateWorldSummary();
      showGenerationStatus('generationFailed');
    } finally {
      generating = false;
      form.removeAttribute('aria-busy');
    }
  }

  function scheduleGeneration(delay = 180) {
    revision += 1;
    clearTimeout(generationTimer);
    startButton.disabled = true;
    generating = true;
    showGenerationStatus('updating');
    generationTimer = setTimeout(generate, delay);
  }

  function randomizeSeed() {
    const words = crypto.getRandomValues(new Uint32Array(2));
    form.elements.seed.value = [...words].map((word) => word.toString(16).padStart(8, '0')).join('-');
    scheduleGeneration(0);
  }

  form.addEventListener('submit', (event) => { event.preventDefault(); scheduleGeneration(0); });
  function updateSettingReadouts() {
    document.querySelector('#geography-value').value = percent.format(Number(form.elements.geography.value) / 100);
    document.querySelector('#land-value').value = percent.format(Number(form.elements.landFraction.value) / 100);
    document.querySelector('#water-value').value = percent.format(Number(form.elements.waterAbundance.value) / 100);
  }
  form.addEventListener('input', () => {
    updateSettingReadouts();
    scheduleGeneration();
  });
  document.querySelector('#randomize-seed').addEventListener('click', randomizeSeed);
  playButton.addEventListener('click', () => setPlaying(true));
  pauseButton.addEventListener('click', () => setPlaying(false));
  speedInput.addEventListener('input', () => {
    targetSpeed = Math.max(1, Math.min(10, Number(speedInput.value)));
    updateTargetSpeed();
    resetClock();
  });

  // Browser pacing advances only the current climate model through explicit
  // integer days. The engine never reads this clock. Hidden tabs do not catch up.
  function animateClimate(timestamp) {
    const active = !document.hidden && (workspace.hidden || playing);
    if (!active || generating || startButton.disabled || !world) {
      clockTimestamp = null;
    } else {
      const elapsed = clockTimestamp === null ? 0 : timestamp - clockTimestamp;
      clockTimestamp = timestamp;
      const daysPerSecond = workspace.hidden ? 20 : targetSpeed * 2;
      dayCredit += Math.min(250, elapsed) * daysPerSecond / 1000;
      measuredElapsed += elapsed;
      const days = Math.floor(dayCredit + 1e-9);
      if (days > 0) {
        dayCredit = Math.max(0, dayCredit - days);
        world = setDay(world, world.day + days);
        measuredDays += days;
        updateDayReadout();
        if (!workspace.hidden && pinnedId !== null) updateInspector(false);
        queueDraw();
      }
      if (!workspace.hidden && measuredElapsed >= 1000) {
        showActualSpeed(measuredDays * 1000 / measuredElapsed);
        measuredElapsed = 0;
        measuredDays = 0;
      }
    }
    requestAnimationFrame(animateClimate);
  }
  document.addEventListener('visibilitychange', resetClock);
  requestAnimationFrame(animateClimate);

  startButton.addEventListener('click', () => {
    if (!world || startButton.disabled) return;
    setPlaying(false);
    updateDayReadout();
    savedScroll = window.scrollY;
    workspace.hidden = false;
    page.hidden = true;
    document.querySelector('.skip-link').hidden = true;
    document.body.classList.add('workspace-open');
    themePicker.open = false;
    document.querySelector('#workspace-preferences').append(themePicker, languageSwitcher);
    resizeRenderer(map, canvas);
    camera = map.fit(world);
    draw();
    canvas.focus({ preventScroll: true });
  });

  document.querySelector('#return-setup').addEventListener('click', () => {
    setPlaying(false);
    menu.open = false;
    workspace.hidden = true;
    page.hidden = false;
    document.querySelector('.skip-link').hidden = false;
    document.body.classList.remove('workspace-open');
    themePicker.open = false;
    preferencesHome.append(themePicker, languageSwitcher);
    window.scrollTo({ top: savedScroll, behavior: 'instant' });
    form.elements.seed.focus({ preventScroll: true });
    randomizeSeed();
    queueDraw();
  });

  document.querySelector('#fit-world').addEventListener('click', () => {
    resizeRenderer(map, canvas);
    camera = map.fit(world);
    canvas.focus();
    queueDraw();
  });
  document.querySelector('#center-world').addEventListener('click', () => {
    camera = { ...camera, x: 0, y: 0 };
    canvas.focus();
    queueDraw();
  });
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { menu.open = false; menu.querySelector('summary').focus(); }
  });
  document.addEventListener('pointerdown', (event) => { if (!menu.contains(event.target)) menu.open = false; });

  document.querySelector('.map-layers').addEventListener('change', (event) => {
    layer = event.target.value;
    document.querySelector('#layer-legend').textContent = t(legends[layer]);
    queueDraw();
  });

  function zoomBy(factor, point) {
    const bounds = canvas.getBoundingClientRect();
    const anchor = point || { x: bounds.width / 2, y: bounds.height / 2 };
    const zoom = Math.max(1, Math.min(32, camera.zoom * factor));
    const ratio = zoom / camera.zoom;
    camera = {
      zoom,
      x: anchor.x - bounds.width / 2 - (anchor.x - bounds.width / 2 - camera.x) * ratio,
      y: anchor.y - bounds.height / 2 - (anchor.y - bounds.height / 2 - camera.y) * ratio,
    };
    queueDraw();
  }
  document.querySelector('#zoom-in').addEventListener('click', () => zoomBy(1.5));
  document.querySelector('#zoom-out').addEventListener('click', () => zoomBy(1 / 1.5));
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const box = canvas.getBoundingClientRect();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? box.height : 1);
    zoomBy(Math.exp(-delta * 0.002), { x: event.clientX - box.left, y: event.clientY - box.top });
  }, { passive: false });

  function pin(id, reveal = false) {
    pinnedId = id;
    updateInspector();
    if (reveal && id !== null) {
      const point = map.cellCenter(world, id, camera);
      const bounds = canvas.getBoundingClientRect();
      const margin = Math.min(40, bounds.width / 5, bounds.height / 5);
      camera.x += Math.max(margin, Math.min(bounds.width - margin, point.x)) - point.x;
      camera.y += Math.max(margin, Math.min(bounds.height - margin, point.y)) - point.y;
    }
    queueDraw();
  }

  canvas.addEventListener('keydown', (event) => {
    if (['+', '=', '-', '_', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) event.preventDefault();
    if (event.key === '+' || event.key === '=') return zoomBy(1.5);
    if (event.key === '-' || event.key === '_') return zoomBy(1 / 1.5);
    if (event.key === 'Escape') return pin(null);
    if (!event.key.startsWith('Arrow')) return;
    if (pinnedId === null) return pin(Math.floor(world.height / 2) * world.width + Math.floor(world.width / 2), true);
    const current = world.hexes[pinnedId];
    let col = current.col;
    let row = current.row;
    if (event.key === 'ArrowLeft') col = (col + world.width - 1) % world.width;
    if (event.key === 'ArrowRight') col = (col + 1) % world.width;
    if (event.key === 'ArrowUp') row = Math.max(0, row - 1);
    if (event.key === 'ArrowDown') row = Math.min(world.height - 1, row + 1);
    pin(row * world.width + col, true);
  });

  const pointers = new Map();
  let moved = false;
  let origin = null;
  function localPoint(event) {
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }
  function pairMetrics(points) {
    const [a, b] = [...points.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) };
  }
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    canvas.focus({ preventScroll: true });
    const point = localPoint(event);
    pointers.set(event.pointerId, point);
    canvas.setPointerCapture(event.pointerId);
    if (pointers.size === 1) { origin = point; moved = false; }
    else moved = true;
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    const previous = pointers.get(event.pointerId);
    const previousPair = pointers.size === 2 ? pairMetrics(pointers) : null;
    const point = localPoint(event);
    pointers.set(event.pointerId, point);
    if (Math.hypot(point.x - origin.x, point.y - origin.y) > 5) moved = true;
    if (previousPair) {
      const next = pairMetrics(pointers);
      zoomBy(next.distance / Math.max(1, previousPair.distance), previousPair);
      camera.x += next.x - previousPair.x;
      camera.y += next.y - previousPair.y;
    } else if (pointers.size === 1 && moved) {
      camera.x += point.x - previous.x;
      camera.y += point.y - previous.y;
    }
    queueDraw();
  });
  function releasePointer(event, cancelled = false) {
    if (!pointers.has(event.pointerId)) return;
    const point = localPoint(event);
    if (!cancelled && !moved && pointers.size === 1) pin(map.hitTest(world, camera, point.x, point.y));
    pointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
  canvas.addEventListener('pointerup', (event) => releasePointer(event));
  canvas.addEventListener('pointercancel', (event) => releasePointer(event, true));
  canvas.addEventListener('lostpointercapture', (event) => { pointers.delete(event.pointerId); });

  function showGenerationStatus(key = statusKey) {
    statusKey = key;
    generationStatus.textContent = t(key);
  }

  function updateWorldSummary() {
    if (!world) {
      previewCanvas.setAttribute('aria-label', t('previewUnavailable'));
      document.querySelector('#world-summary').textContent = t('retry');
      return;
    }
    const count = (type) => world.hexes.filter((hex) => hex.waterType === type).length;
    document.querySelector('#world-summary').textContent = t('summary', {
      hexes: integer.format(world.hexes.length),
      land: percent.format(1 - count('sea') / world.hexes.length),
      dry: percent.format(count('none') / world.hexes.length),
      lakes: integer.format(count('lake')), rivers: integer.format(world.quality.riverHexes),
    });
    previewCanvas.setAttribute('aria-label', t('generatedPreview', {
      width: integer.format(world.width), height: integer.format(world.height), seed: world.seed,
    }));
  }

  function updateTargetSpeed() {
    const values = { multiplier: number.format(targetSpeed), rate: integer.format(targetSpeed * 2) };
    showSpeed(document.querySelector('#target-speed'), values);
    speedInput.setAttribute('aria-valuetext', t('speedDescription', values));
  }

  // Locale only re-renders presentation: no world generation, clock reset,
  // camera changes, layer changes, or lost selection when switching mid-run.
  document.addEventListener('emergence:localechange', () => {
    updateSettingReadouts();
    showGenerationStatus();
    updateWorldSummary();
    updateInspector();
    updateTargetSpeed();
    showActualSpeed(actualDaysPerSecond);
    updatePlaybackState();
    document.querySelector('#layer-legend').textContent = t(legends[layer]);
    if (world) updateDayReadout();
    queueDraw();
  });
  updateSettingReadouts();
  updateTargetSpeed();
  showActualSpeed();
  updatePlaybackState();

  randomizeSeed();
  window.addEventListener('pageshow', (event) => { if (event.persisted && workspace.hidden) randomizeSeed(); });
}
