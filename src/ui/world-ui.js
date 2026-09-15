import { generateWorld } from '../simulation/world.js';
import { setDay } from '../simulation/climate.js';
import { createMapRenderer, MAP_TOKEN_NAMES } from '../rendering/map.js';

const number = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 1 });
const legends = {
  terrain: 'Depth-graded seas · teal lakes · spring-fed rivers',
  elevation: 'Deep blue seabeds → pale elevated land · metres',
  temperature: 'Blue −40 °C → red +40 °C',
  humidity: 'Dry ochre 0% → wet green 100% · land moisture index',
  regions: 'Geographic regions · marked connections show costly passes',
};

function readTokens() {
  const styles = getComputedStyle(document.documentElement);
  return Object.fromEntries(MAP_TOKEN_NAMES.map((name) => [name, styles.getPropertyValue(name).trim()]));
}

/** Browser composition only: inputs become explicit engine calls; snapshots are read-only. */
export function initWorldUI() {
  const form = document.querySelector('#world-form');
  const generateButton = document.querySelector('#generate-world');
  const startButton = document.querySelector('#start-workspace');
  const generationStatus = document.querySelector('#generation-status');
  const previewCanvas = document.querySelector('#world-preview');
  const canvas = document.querySelector('#world-map');
  const workspace = document.querySelector('#workspace');
  const page = document.querySelector('.page-shell');
  const themeSwitcher = document.querySelector('.theme-switcher');
  const themeHome = themeSwitcher.parentElement;
  const menu = document.querySelector('#application-menu');
  const dayInput = document.querySelector('#world-day');
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
  let frame = null;

  function readSettings() {
    const values = new FormData(form);
    return {
      seed: String(values.get('seed')),
      size: values.get('size'),
      geography: Number(values.get('geography')) / 100,
      landFraction: Number(values.get('landFraction')) / 100,
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

  function updateInspector() {
    details.replaceChildren();
    const heading = document.createElement('h2');
    const introduction = document.createElement('p');
    details.append(heading, introduction);
    if (pinnedId === null || !world) {
      heading.textContent = 'A world to inspect.';
      introduction.textContent = 'Pin a hex to read its terrain, water, climate, and geographic connections.';
      document.querySelector('#map-status').textContent = 'No hex pinned.';
      return;
    }
    const hex = world.hexes[pinnedId];
    heading.textContent = `Hex ${hex.col + 1}, ${hex.row + 1}`;
    const surface = hex.waterType === 'sea' ? 'Sea' : hex.waterType === 'lake' ? 'Freshwater lake' : 'Land';
    introduction.textContent = `${surface}${hex.runoff > 0 && hex.waterType === 'none' ? ' · river channel' : ''}${hex.temperature < 0 ? (hex.waterType === 'none' ? ' · frosted' : ' · ice-covered') : ''}`;
    const facts = document.createElement('dl');
    facts.className = 'hex-facts';
    addFact(facts, 'Bed elevation', `${integer.format(hex.bedElevation)} m`);
    addFact(facts, 'Water level', hex.waterLevel === null ? 'No surface water' : `${integer.format(hex.waterLevel)} m`);
    addFact(facts, 'Spill elevation', `${integer.format(hex.spillElevation)} m`);
    addFact(facts, 'Spring discharge', `${number.format(hex.springDischarge)} flow units`);
    addFact(facts, 'Accumulated flow', `${number.format(hex.runoff)} flow units`);
    addFact(facts, 'Lake inflow', `${number.format(hex.lakeInflow)} flow units`);
    addFact(facts, 'Nearest water', `${integer.format(hex.distanceToWater)} hex steps`);
    addFact(facts, 'Temperature', `${number.format(hex.temperature)} °C`);
    addFact(facts, 'Land moisture', hex.humidity === null ? 'Not a land hex' : percent.format(hex.humidity));
    addFact(facts, 'Region', integer.format(hex.regionId + 1));
    addFact(facts, 'Traversal difficulty', percent.format(hex.traversalDifficulty));
    addFact(facts, 'Permanent ice', hex.permanentIce ? 'Yes' : 'No');
    addFact(facts, 'Drainage outlet', hex.downstream === null ? 'Sea outlet' : `Hex ${world.hexes[hex.downstream].col + 1}, ${world.hexes[hex.downstream].row + 1}`);
    details.append(facts);
    const barrier = document.createElement('p');
    const reasons = (hex.barrierReasons || []).map((reason) => reason.replaceAll('-', ' '));
    barrier.textContent = reasons.length ? `Physical constraints: ${reasons.join(', ')}. Regions describe geography; crossing rules for life are not defined yet.` : 'This hex is part of an accessible geographic core. Regions describe geography; crossing rules for life are not defined yet.';
    details.append(barrier);
    document.querySelector('#map-status').textContent = `Pinned hex ${hex.col + 1}, ${hex.row + 1} · ${surface.toLowerCase()} · ${number.format(hex.temperature)} °C`;
  }

  function updateDayReadout() {
    dayInput.value = String(world.day);
    const annualDay = world.day % 360;
    const landmarks = { 0: 'Northern spring equinox', 90: 'Northern summer solstice', 180: 'Northern autumn equinox', 270: 'Northern winter solstice' };
    document.querySelector('#season-readout').textContent = `${landmarks[annualDay] || `Day ${annualDay} of the 360-day year`}. Southern seasons are opposite.`;
  }

  async function generate() {
    if (generating || !form.reportValidity()) return;
    generating = true;
    generateButton.disabled = true;
    startButton.disabled = true;
    form.setAttribute('aria-busy', 'true');
    generationStatus.textContent = 'Generating terrain, tracing water, and reading the climate…';
    const settings = readSettings();
    // Yield to paint the busy state. Browser timing is never passed into generation.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      const generated = generateWorld(settings);
      world = generated;
      pinnedId = null;
      camera = { zoom: 1, x: 0, y: 0 };
      const landCount = world.hexes.filter((hex) => hex.waterType !== 'sea').length;
      const dryCount = world.hexes.filter((hex) => hex.waterType === 'none').length;
      document.querySelector('#world-summary').textContent = `${integer.format(world.hexes.length)} hexes · ${percent.format(landCount / world.hexes.length)} non-marine footprint · ${percent.format(dryCount / world.hexes.length)} dry land · ${integer.format(world.regions.length)} regions`;
      document.querySelector('#world-readout').textContent = `${world.width} × ${world.height} · seed ${world.seed}`;
      previewCanvas.setAttribute('aria-label', `Generated world preview: ${world.width} by ${world.height} hexes, seed ${world.seed}`);
      const unchanged = JSON.stringify(settings) === JSON.stringify(readSettings());
      startButton.disabled = !unchanged;
      generationStatus.textContent = unchanged ? 'World ready. Open the atlas to inspect terrain, seasons, and regions.' : 'Settings changed. Generate again to update the preview.';
      updateDayReadout();
      updateInspector();
      queueDraw();
    } catch (error) {
      generationStatus.textContent = `World generation failed: ${error.message}`;
    } finally {
      generating = false;
      generateButton.disabled = false;
      form.removeAttribute('aria-busy');
    }
  }

  form.addEventListener('submit', (event) => { event.preventDefault(); generate(); });
  form.addEventListener('input', () => {
    document.querySelector('#geography-value').value = percent.format(Number(form.elements.geography.value) / 100);
    document.querySelector('#land-value').value = percent.format(Number(form.elements.landFraction.value) / 100);
    startButton.disabled = true;
    if (!generating) generationStatus.textContent = 'Settings changed. Generate again to update the preview.';
  });

  startButton.addEventListener('click', () => {
    if (!world) return;
    savedScroll = window.scrollY;
    workspace.hidden = false;
    page.hidden = true;
    document.querySelector('.skip-link').hidden = true;
    document.body.classList.add('workspace-open');
    document.querySelector('#workspace-preferences').append(themeSwitcher);
    resizeRenderer(map, canvas);
    camera = map.fit(world);
    draw();
    canvas.focus({ preventScroll: true });
  });

  document.querySelector('#return-setup').addEventListener('click', () => {
    menu.open = false;
    workspace.hidden = true;
    page.hidden = false;
    document.querySelector('.skip-link').hidden = false;
    document.body.classList.remove('workspace-open');
    themeHome.prepend(themeSwitcher);
    window.scrollTo({ top: savedScroll, behavior: 'instant' });
    startButton.focus({ preventScroll: true });
    queueDraw();
  });

  document.querySelector('#fit-world').addEventListener('click', () => {
    camera = map.fit(world);
    menu.open = false;
    canvas.focus();
    queueDraw();
  });
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { menu.open = false; menu.querySelector('summary').focus(); }
  });
  document.addEventListener('pointerdown', (event) => { if (!menu.contains(event.target)) menu.open = false; });

  document.querySelector('.map-layers').addEventListener('change', (event) => {
    layer = event.target.value;
    document.querySelector('#layer-legend').textContent = legends[layer];
    queueDraw();
  });

  function changeDay(day) {
    if (!Number.isSafeInteger(day) || day < 0) {
      dayInput.setCustomValidity('Enter a non-negative whole day.');
      dayInput.reportValidity();
      return;
    }
    dayInput.setCustomValidity('');
    world = setDay(world, day);
    updateDayReadout();
    updateInspector();
    queueDraw();
  }
  dayInput.addEventListener('input', () => dayInput.setCustomValidity(''));
  dayInput.addEventListener('change', () => changeDay(dayInput.value === '' ? NaN : Number(dayInput.value)));
  document.querySelector('#advance-season').addEventListener('click', () => changeDay(world.day + 90));

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

  const tabs = [...document.querySelectorAll('.notebook-tabs [role="tab"]')];
  tabs.forEach((tab, index) => tab.addEventListener('keydown', (event) => {
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  }));

  generateButton.disabled = false;
  generate();
}
