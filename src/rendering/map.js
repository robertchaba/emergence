/* Read-only Canvas 2D presentation. UI supplies resolved CSS tokens, the camera,
   and snapshots. No browser style access, events, or simulation imports here. */
import { territoryContours } from './territory.js';
import { LIFE_PLANT_MARKER_LIMIT, LIFE_CONSUMER_MARKER_LIMIT, lifeMarkerPositions, lifeMarkerColour, drawLifeMarker } from './life-marks.js';
const ROOT_THREE = Math.sqrt(3);
const CORNERS = Array.from({ length: 6 }, (_, index) => {
  const angle = (index * 60 - 30) * Math.PI / 180;
  return { x: Math.cos(angle), y: Math.sin(angle) };
});

export const MAP_TOKEN_NAMES = Object.freeze([
  'ground', 'sea-deep', 'sea-shallow', 'lake', 'land-low', 'land-high',
  'relief-shadow', 'relief-light', 'ice', 'frost', 'river', 'river-bank', 'spring',
  'spring-ring', 'grid', 'pin', 'pin-outline', 'pin-fill', 'temperature-cold',
  'temperature-hot', 'humidity-dry', 'humidity-wet', 'humidity-water',
  'region-barrier', 'region-boundary', 'pass', 'pass-outline',
  'life-producer', 'life-plant', 'life-grazer', 'life-predator', 'life-mixed', 'life-other',
  'life-omnivore', 'life-photo-grazer', 'life-photo-predator',
  'life-detail', 'life-selected', 'life-selected-fill', 'life-selection-halo', 'life-variant', 'life-variant-fill',
  ...Array.from({ length: 8 }, (_, index) => `region-${index}`),
].map((name) => `--map-${name}`));

const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const modulo = (value, divisor) => ((value % divisor) + divisor) % divisor;
const LIFE_ROLES = ['producer', 'grazer', 'predator', 'mixed', 'other'];
function lifeSummary(observation) {
  const summaries = new Map();
  for (const hex of observation?.hexes ?? []) {
    if (!(hex.population > 0)) continue;
    let producerLand = 0;
    let producerWater = 0;
    const groups = new Map();
    for (const display of hex.display ?? []) {
      if (!(display.population > 0)) continue;
      const size = clamp(Number(display.size) || 0);
      const role = LIFE_ROLES.includes(display.role) ? display.role : 'other';
      const mobile = display.mobile === true;
      if (role === 'producer') {
        if (display.habitat === 'water') producerWater += display.population;
        else producerLand += display.population;
      }
      const habitat = display.habitat === 'water' ? 'water' : 'land';
      const plant = role === 'producer' && !mobile;
      // Keep large bodies visible beside abundant smaller organisms.
      // These are display bands, never species or ecological classifications.
      const band = size < 0.35 ? 0 : size < 0.7 ? 1 : 2;
      const colour = lifeMarkerColour({ ...display, role, mobile });
      // Copy only common presentation descriptors. Genomes stay inside models.
      const morphology = display.morphology ? { form: display.morphology.form,
        pattern: display.morphology.pattern, social: display.morphology.social } : undefined;
      const key = `${role}:${colour}:${habitat}:${mobile}:${band}:${JSON.stringify(morphology) ?? ''}`;
      const group = groups.get(key) ?? { key, role, colour, habitat, mobile, morphology, plant, band, population: 0, weightedSize: 0 };
      group.population += display.population;
      group.weightedSize += size * display.population;
      groups.set(key, group);
    }
    // Fixed plants have their own budget and draw beneath consumers. Show a
    // representative of each band before adding abundance samples, largest first.
    const ordered = [...groups.values()].sort((a, b) => b.band - a.band || a.key.localeCompare(b.key, 'en'));
    for (const group of ordered) {
      group.size = group.weightedSize / group.population;
      group.samples = Math.min(group.population, group.plant ? 16 : 10,
        (group.plant ? 4 : 2) * (1 + Math.floor(Math.log10(group.population))));
    }
    const sampleGroups = (groups, limit) => {
      const markers = [];
      for (let sample = 0; sample < 16 && markers.length < limit; sample += 1) {
        for (const group of groups) {
          if (sample < group.samples && markers.length < limit) markers.push({ role: group.role,
            colour: group.colour, habitat: group.habitat, size: group.size, mobile: group.mobile,
            ...(group.morphology ? { morphology: group.morphology } : {}) });
        }
      }
      return markers;
    };
    const plants = sampleGroups(ordered.filter(group => group.plant), LIFE_PLANT_MARKER_LIMIT);
    const markers = sampleGroups(ordered.filter(group => !group.plant), LIFE_CONSUMER_MARKER_LIMIT);
    const tint = Math.min(0.48, Math.min(0.44, Math.log1p(producerLand) / 26) + Math.min(0.20, Math.log1p(producerWater) / 40));
    const species = new Set((hex.species ?? []).filter(row => row.population > 0).map(row => row.id));
    const signature = JSON.stringify([tint, plants, markers, [...species].sort()]);
    summaries.set(hex.hexId, { tint, plants, markers, animated: markers.some(marker => marker.mobile), species, signature });
  }
  return summaries;
}

// All numeric channels come from supplied tokens; interpolation introduces no
// second palette. Both hex and computed rgb() CSS serializations are accepted.
function rgb(color) {
  if (color.startsWith('#')) {
    const value = color.slice(1);
    const full = value.length === 3 ? [...value].map((char) => char + char).join('') : value;
    return [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16));
  }
  const channels = color.match(/[\d.]+/g);
  if (!channels || channels.length < 3) throw new Error(`Unsupported map token: ${color}`);
  return channels.slice(0, 3).map(Number);
}

function blend(a, b, fraction) {
  const amount = clamp(fraction);
  return a.map((channel, index) => channel + (b[index] - channel) * amount);
}

function cssRgb(channels) {
  return `rgb(${channels.map((channel) => Math.round(channel)).join(' ')})`;
}

function hsl(channels) {
  const [r, g, b] = channels.map((channel) => channel / 255);
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const difference = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  if (!difference) return [0, 0, lightness];
  const hue = maximum === r ? ((g - b) / difference) % 6
    : maximum === g ? (b - r) / difference + 2 : (r - g) / difference + 4;
  return [modulo(hue * 60, 360), difference / (1 - Math.abs(2 * lightness - 1)), lightness];
}

function center(hex) {
  return { x: ROOT_THREE * (hex.col + (hex.row % 2) / 2 + 0.5), y: 1 + hex.row * 1.5 };
}

function polygon(context, x, y, radius, begin = true) {
  if (begin) context.beginPath();
  for (let index = 0; index < CORNERS.length; index += 1) {
    const corner = CORNERS[index];
    const method = index === 0 ? 'moveTo' : 'lineTo';
    context[method](x + corner.x * radius, y + corner.y * radius);
  }
  context.closePath();
}

function insideHex(x, y) {
  const dx = Math.abs(x);
  const dy = Math.abs(y);
  return dx <= ROOT_THREE / 2 + 1e-9 && dy <= 1 + 1e-9 && dy + dx / ROOT_THREE <= 1 + 1e-9;
}

export function createMapRenderer(canvas, { tokens }) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is required to display the map.');
  let width = 1;
  let height = 1;
  let pixelRatio = 1;
  let palette;
  let channels;
  let temperatureRamp;
  let colorCache = new WeakMap();
  const geometryCache = new WeakMap();
  const lifeGeometryCache = new WeakMap();
  let cachedLife = null;
  let cachedTerritory = null;
  let previousFrame = null;

  function setTokens(nextTokens) {
    palette = {};
    channels = {};
    for (const name of MAP_TOKEN_NAMES) {
      const value = nextTokens[name]?.trim();
      if (!value) throw new Error(`Missing map token ${name}`);
      const key = name.slice('--map-'.length);
      palette[key] = value;
      if (!['grid', 'region-boundary'].includes(key)) channels[key] = rgb(value);
    }
    temperatureRamp = [hsl(channels['temperature-cold']), hsl(channels['temperature-hot'])];
    colorCache = new WeakMap();
    previousFrame = null;
  }

  function resize(nextWidth, nextHeight, dpr = 1) {
    if (width !== Math.max(1, nextWidth) || height !== Math.max(1, nextHeight) || pixelRatio !== Math.max(1, dpr)) previousFrame = null;
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    pixelRatio = Math.max(1, dpr);
    const backingWidth = Math.round(width * pixelRatio);
    const backingHeight = Math.round(height * pixelRatio);
    if (canvas.width !== backingWidth) canvas.width = backingWidth;
    if (canvas.height !== backingHeight) canvas.height = backingHeight;
  }

  function dimensions(world) {
    return { width: (world.width + (world.height > 1 ? 0.5 : 0)) * ROOT_THREE, height: world.height * 1.5 + 0.5 };
  }

  function transform(world, camera) {
    const size = dimensions(world);
    const margin = Math.min(12, width * 0.025, height * 0.025);
    const scale = Math.min((width - margin * 2) / size.width, (height - margin * 2) / size.height) * camera.zoom;
    const circumference = world.width * ROOT_THREE * scale;
    const pan = Math.abs(camera.x) <= circumference / 2 ? camera.x
      : modulo(camera.x + circumference / 2, circumference) - circumference / 2;
    return {
      scale,
      x: (width - size.width * scale) / 2 + pan,
      y: (height - size.height * scale) / 2 + camera.y,
      mapWidth: size.width * scale,
      mapHeight: size.height * scale,
    };
  }

  function fit(world) {
    if (!world) return { zoom: 1, x: 0, y: 0 };
    const base = transform(world, { zoom: 1, x: 0, y: 0 });
    // Leave a complete cell width (plus raster padding) outside the viewport.
    // Even partial copies of the same hex cannot appear at opposite edges.
    const uniqueWidth = (world.width - 1) * ROOT_THREE;
    return { zoom: Math.max(1, (width + 8) / (uniqueWidth * base.scale)), x: 0, y: 0 };
  }

  function constrain(world, camera) {
    const zoom = Math.max(fit(world).zoom, camera.zoom);
    const circumference = world.width * ROOT_THREE * transform(world, { ...camera, zoom }).scale;
    const x = Math.abs(camera.x) <= circumference / 2 ? camera.x
      : modulo(camera.x + circumference / 2, circumference) - circumference / 2;
    return { zoom, x, y: camera.y };
  }

  function projected(point, world, view) {
    const circumference = world.width * ROOT_THREE;
    const middle = (width / 2 - view.x) / view.scale;
    return { x: point.x + Math.round((middle - point.x) / circumference) * circumference, y: point.y };
  }

  // Cover also fills the space between the finite polar edges.
  function cover(world) {
    const fitted = transform(world, fit());
    const innerWidth = Math.max(1, world.width - 0.5) * ROOT_THREE;
    const innerHeight = Math.max(1, world.height * 1.5 - 0.5);
    return { zoom: Math.max(fit(world).zoom, Math.max(width / innerWidth, height / innerHeight) / fitted.scale), x: 0, y: 0 };
  }

  function cellCenter(world, id, camera = fit(world)) {
    const hex = world.hexes[id];
    if (!hex) return null;
    const view = transform(world, camera);
    const position = projected(center(hex), world, view);
    return { x: view.x + position.x * view.scale, y: view.y + position.y * view.scale };
  }

  function hitTest(world, camera, screenX, screenY) {
    const view = transform(world, camera);
    const x = (screenX - view.x) / view.scale;
    const y = (screenY - view.y) / view.scale;
    const size = dimensions(world);
    if (y < 0 || y > size.height) return null;
    const nearestRow = Math.round((y - 1) / 1.5);
    for (let row = nearestRow - 1; row <= nearestRow + 1; row += 1) {
      if (row < 0 || row >= world.height) continue;
      const nearestCol = Math.round(x / ROOT_THREE - (row % 2) / 2 - 0.5);
      for (let col = nearestCol - 1; col <= nearestCol + 1; col += 1) {
        const localCenter = ROOT_THREE * (col + (row % 2) / 2 + 0.5);
        if (insideHex(x - localCenter, y - (1 + row * 1.5))) {
          return row * world.width + modulo(col, world.width);
        }
      }
    }
    return null;
  }

  function terrainChannels(hex) {
    if (hex.waterType === 'sea') {
      return blend(channels['sea-shallow'], channels['sea-deep'], Math.sqrt(clamp(-hex.bedElevation / 6000)));
    }
    if (hex.waterType === 'lake') return channels.lake;
    return blend(channels['land-low'], channels['land-high'], Math.sqrt(clamp(hex.bedElevation / 5000)));
  }

  function relief(hex, world) {
    let gradient = 0;
    for (const neighborId of hex.neighbors) {
      const neighbor = world.hexes[neighborId];
      const offset = neighbor.col - hex.col;
      const dx = offset > world.width / 2 ? offset - world.width : offset < -world.width / 2 ? offset + world.width : offset;
      // Light comes from the northwest. Only display height drives shading.
      gradient += (neighbor.bedElevation - hex.bedElevation) * (-dx - (neighbor.row - hex.row));
    }
    return clamp(gradient / 9000, -0.3, 0.3);
  }

  function fillColor(hex, world, layer) {
    if (layer === 'temperature') {
      const t = clamp((hex.temperature + 40) / 80);
      const [cold, hot] = temperatureRamp;
      const mixed = blend(cold, hot, t);
      return `hsl(${mixed[0]} ${mixed[1] * 100}% ${mixed[2] * 100}%)`;
    }
    if (layer === 'humidity') {
      if (hex.humidity === null || hex.waterType !== 'none') return palette['humidity-water'];
      return cssRgb(blend(channels['humidity-dry'], channels['humidity-wet'], hex.humidity));
    }
    if (layer === 'regions') {
      if (hex.regionId === null || hex.regionId < 0 || hex.permanentIce || world.regions?.[hex.regionId]?.hardBarrier) return palette['region-barrier'];
      return cssRgb(blend(channels[`region-${modulo(hex.regionId, 8)}`], channels['relief-shadow'], hex.traversalDifficulty * 0.18));
    }
    let value = terrainChannels(hex);
    if (layer === 'terrain' && hex.waterType === 'none') {
      const shade = relief(hex, world);
      value = blend(value, shade < 0 ? channels['relief-light'] : channels['relief-shadow'], Math.abs(shade));
    }
    // Frost sits above relief so deep terrain shadows cannot make frozen land
    // look thawed. A little shaded ground remains visible beneath the white.
    if (layer === 'terrain' && hex.temperature < 0) {
      if (hex.waterType !== 'none') return palette.ice;
      value = blend(value, channels.frost, 0.86);
    }
    return cssRgb(value);
  }

  function colors(world, layer, geography) {
    const staticLayer = ['terrain', 'elevation', 'regions'].includes(layer);
    const key = staticLayer ? geography : world;
    let cached = colorCache.get(key);
    if (!cached) {
      cached = new Map();
      colorCache.set(key, cached);
    }
    if (layer === 'terrain') {
      if (!cached.has(layer)) {
        cached.set(layer, {
          warm: geography.hexes.map((hex) => fillColor({ ...hex, temperature: 1 }, geography, layer)),
          frozen: geography.hexes.map((hex) => fillColor({ ...hex, temperature: -1 }, geography, layer)),
        });
      }
      const { warm, frozen } = cached.get(layer);
      return world.hexes.map((hex) => (hex.temperature < 0 ? frozen : warm)[hex.id]);
    }
    if (!cached.has(layer)) cached.set(layer, world.hexes.map((hex) => fillColor(hex, world, layer)));
    return cached.get(layer);
  }

  // A cylindrical edge is not a long straight line across the map: unwrap to
  // the nearest longitude and draw a second clipped segment on the other edge.
  function connection(world, fromId, toId, view, stroke, lineWidth, dash = []) {
    const fromHex = world.hexes[fromId];
    const toHex = world.hexes[toId];
    if (!fromHex || !toHex) return;
    const from = center(fromHex);
    const to = center(toHex);
    const circumference = world.width * ROOT_THREE;
    if (to.x - from.x > circumference / 2) to.x -= circumference;
    if (to.x - from.x < -circumference / 2) to.x += circumference;
    context.strokeStyle = stroke;
    context.lineWidth = lineWidth;
    context.setLineDash(dash);
    for (const shift of [-circumference, 0, circumference]) {
      context.beginPath();
      context.moveTo(view.x + (from.x + shift) * view.scale, view.y + from.y * view.scale);
      context.lineTo(view.x + (to.x + shift) * view.scale, view.y + to.y * view.scale);
      context.stroke();
    }
    context.setLineDash([]);
  }

  // Cosmetic geometry stays in hex units, so seasons, theme, and zoom cannot
  // move a channel. Shared nodes keep tributaries joined; water ends stay centered.
  function riverGeometry(world) {
    if (geometryCache.has(world)) return geometryCache.get(world);
    const circumference = world.width * ROOT_THREE;
    const nodes = world.hexes.map((hex) => {
      const point = center(hex);
      if (hex.waterType === 'none') {
        point.x += Math.sin(hex.id * 2.399963) * 0.10;
        point.y += Math.cos(hex.id * 1.618034) * 0.10;
      }
      return point;
    });
    const near = (point, reference) => {
      const offset = point.x - reference.x;
      return { x: point.x + (offset > circumference / 2 ? -circumference : offset < -circumference / 2 ? circumference : 0), y: point.y };
    };
    const links = world.hexes.filter((hex) => {
      const outlet = world.hexes[hex.downstream];
      return hex.runoff > 0 && outlet && hex.waterType !== 'sea'
        && !(hex.waterType === 'lake' && outlet.waterType === 'lake' && hex.waterLevel === outlet.waterLevel);
    });
    const incoming = new Map();
    const outgoing = new Map(links.map((hex) => [hex.id, hex.downstream]));
    for (const hex of links) {
      const previous = incoming.get(hex.downstream);
      if (!previous || hex.runoff > previous.runoff || (hex.runoff === previous.runoff && hex.id < previous.id)) {
        incoming.set(hex.downstream, hex);
      }
    }
    const tangents = nodes.map((point, id) => {
      const upstream = incoming.get(id);
      const downstream = outgoing.get(id);
      const before = upstream ? near(nodes[upstream.id], point) : point;
      const after = downstream !== undefined ? near(nodes[downstream], point) : point;
      let dx = after.x - before.x;
      let dy = after.y - before.y;
      // Slightly turn terminal tangents as well, giving one-link streams a bend.
      if (!upstream || downstream === undefined) {
        const turn = Math.sin(id * 2.399963) * 0.24;
        [dx, dy] = [dx * Math.cos(turn) - dy * Math.sin(turn), dx * Math.sin(turn) + dy * Math.cos(turn)];
      }
      const length = Math.hypot(dx, dy) || 1;
      return { x: dx / length, y: dy / length };
    });
    const segments = links.map((hex) => {
      const from = nodes[hex.id];
      const to = near(nodes[hex.downstream], from);
      // Short handles stay close to the linked cells even at tight turns.
      const handle = Math.min(0.46, Math.hypot(to.x - from.x, to.y - from.y) * 0.28);
      const a = tangents[hex.id];
      const b = tangents[hex.downstream];
      return { hex, from, to,
        first: { x: from.x + a.x * handle, y: from.y + a.y * handle },
        second: { x: to.x - b.x * handle, y: to.y - b.y * handle },
      };
    });
    const geometry = { nodes, segments };
    geometryCache.set(world, geometry);
    return geometry;
  }

  function visibleCurve(from, first, second, to, shift, view) {
    // A cubic is contained by its control-point bounds. Include stroke padding.
    const xs = [from.x, first.x, second.x, to.x];
    const ys = [from.y, first.y, second.y, to.y];
    return view.x + (Math.max(...xs) + shift) * view.scale >= -4
      && view.x + (Math.min(...xs) + shift) * view.scale <= width + 4
      && view.y + Math.max(...ys) * view.scale >= -4
      && view.y + Math.min(...ys) * view.scale <= height + 4;
  }

  function riverCurve(segment, world, view) {
    const { from, first, second, to } = segment;
    const circumference = world.width * ROOT_THREE;
    for (const shift of [-circumference, 0, circumference]) {
      if (!visibleCurve(from, first, second, to, shift, view)) continue;
      const x = (point) => view.x + (point.x + shift) * view.scale;
      const y = (point) => view.y + point.y * view.scale;
      context.beginPath();
      context.moveTo(x(from), y(from));
      context.bezierCurveTo(x(first), y(first), x(second), y(second), x(to), y(to));
      context.stroke();
    }
  }

  function draw(world, { camera = fit(world), layer = 'terrain', pinnedId = null, hoveredId = null, geography = world,
    life = null, selectedSpeciesId = null, selectedVariantHexIds = [], motionTime = 0 } = {}) {
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    if (!world?.hexes?.length) {
      context.clearRect(0, 0, width, height);
      previousFrame = null;
      return;
    }
    if (!cachedLife || cachedLife.observation !== life || cachedLife.revision !== life?.revision || cachedLife.runId !== life?.runId) {
      cachedLife = { observation: life, revision: life?.revision, runId: life?.runId, summaries: lifeSummary(life) };
    }
    const lifeHexes = cachedLife.summaries;
    const speciesHexIds = selectedSpeciesId === null ? [] : [...lifeHexes]
      .filter(([, summary]) => summary.species.has(selectedSpeciesId)).map(([id]) => id);
    const view = transform(world, camera);
    const middle = (width / 2 - view.x) / view.scale;
    const territorySignature = JSON.stringify([speciesHexIds, selectedVariantHexIds, Math.floor(2 * middle / ROOT_THREE)]);
    if (!cachedTerritory || cachedTerritory.geography !== geography || cachedTerritory.signature !== territorySignature) {
      cachedTerritory = { geography, signature: territorySignature,
        species: territoryContours(world, speciesHexIds, middle),
        variant: territoryContours(world, selectedVariantHexIds, middle) };
    }
    const frozen = layer === 'terrain' ? world.hexes.map((hex) => hex.temperature < 0) : null;
    const stable = previousFrame && previousFrame.geography === geography
      && previousFrame.layer === layer && previousFrame.zoom === camera.zoom
      && previousFrame.x === camera.x && previousFrame.y === camera.y
      && previousFrame.pinnedId === pinnedId && previousFrame.hoveredId === hoveredId
      && previousFrame.selectedSpeciesId === selectedSpeciesId
      && previousFrame.territorySignature === territorySignature
      && previousFrame.lifeRunId === life?.runId;
    const frame = { geography, layer, zoom: camera.zoom, x: camera.x, y: camera.y, pinnedId, hoveredId, frozen,
      lifeHexes, selectedSpeciesId, territorySignature, lifeRunId: life?.runId, motionTime };
    let damagedRows = null;
    context.save();
    if (stable && ['terrain', 'elevation', 'regions'].includes(layer)) {
      const changed = new Set(frozen ? frozen.flatMap((value, id) => value !== previousFrame.frozen[id] ? [id] : []) : []);
      if (motionTime !== previousFrame.motionTime) {
        for (const [id, summary] of lifeHexes) if (summary.animated) changed.add(id);
      }
      if (lifeHexes !== previousFrame.lifeHexes) {
        for (const id of new Set([...(lifeHexes?.keys() ?? []), ...(previousFrame.lifeHexes?.keys() ?? [])])) {
          if (world.hexes[id] && lifeHexes?.get(id)?.signature !== previousFrame.lifeHexes?.get(id)?.signature) changed.add(id);
        }
      }
      if (!changed.size) {
        previousFrame = frame;
        context.restore();
        return;
      }
      // Preserve the existing frame and repaint complete cell-sized rectangles
      // around frost transitions. Pixel-aligned clips avoid antialiased seams.
      damagedRows = new Map();
      context.beginPath();
      const damaged = new Set(changed);
      for (const id of changed) {
        const hex = world.hexes[id];
        if (hex.runoff > 0 && hex.downstream !== null) damaged.add(hex.downstream);
      }
      for (const id of damaged) {
        const hex = world.hexes[id];
        const point = projected(center(hex), world, view);
        const x = view.x + point.x * view.scale;
        const y = view.y + point.y * view.scale;
        const padding = view.scale + 4;
        const left = Math.floor((x - padding) * pixelRatio) / pixelRatio;
        const top = Math.floor((y - padding) * pixelRatio) / pixelRatio;
        const right = Math.ceil((x + padding) * pixelRatio) / pixelRatio;
        const bottom = Math.ceil((y + padding) * pixelRatio) / pixelRatio;
        if (right < 0 || left > width || bottom < 0 || top > height) continue;
        context.rect(left, top, right - left, bottom - top);
        // Include every cell whose enlarged fill or grid can touch the damage.
        const reach = Math.ceil((padding / view.scale + 1.5) / 1.5) + 1;
        for (let row = Math.max(0, hex.row - reach); row <= Math.min(world.height - 1, hex.row + reach); row += 1) {
          // A damaged seam cell can touch neighbors at the opposite physical
          // column. The clip bounds work; scan the full nearby rows for repaint.
          damagedRows.set(row, [0, world.width - 1]);
        }
      }
      context.clip();
    }
    previousFrame = frame;
    // Clearing respects the damage clip, including the transparent light ground.
    context.clearRect(0, 0, width, height);
    context.fillStyle = palette.ground;
    context.fillRect(0, 0, width, height);
    const fills = colors(world, layer, geography);
    const circumference = world.width * ROOT_THREE;
    context.save();
    // Longitude is continuous; only the two jagged polar edges clip overlays.
    context.beginPath();
    if (world.height > 1) {
      context.rect(-view.scale, view.y + view.scale, width + 2 * view.scale,
        (world.height * 1.5 - 1.5) * view.scale);
    }
    for (const row of new Set([0, world.height - 1])) {
      for (let col = 0; col < world.width; col += 1) {
        const position = projected(center({ col, row }), world, view);
        polygon(context, view.x + position.x * view.scale, view.y + position.y * view.scale, view.scale, false);
      }
    }
    context.clip();

    for (const hex of world.hexes) {
      if (damagedRows) {
        const range = damagedRows.get(hex.row);
        if (!range || hex.col < range[0] || hex.col > range[1]) continue;
      }
      const position = projected(center(hex), world, view);
      const y = view.y + position.y * view.scale;
      if (y + view.scale < 0 || y - view.scale > height) continue;
      const x = view.x + position.x * view.scale;
      if (x + view.scale < 0 || x - view.scale > width) continue;
      polygon(context, x, y, view.scale + 0.35);
      const tint = lifeHexes?.get(hex.id)?.tint ?? 0;
      context.fillStyle = tint && ['terrain', 'elevation'].includes(layer)
        ? cssRgb(blend(rgb(fills[hex.id]), channels['life-producer'], tint)) : fills[hex.id];
      context.fill();
      if (view.scale >= 5) {
        polygon(context, x, y, view.scale);
        context.strokeStyle = palette.grid;
        context.lineWidth = Math.min(0.8, view.scale * 0.025);
        context.stroke();
      }
    }

    context.lineCap = 'round';
    if (layer === 'terrain' || layer === 'elevation') {
      const rivers = riverGeometry(geography);
      // Paint banks first so confluences have one continuous water surface.
      for (const bank of [true, false]) {
        for (const segment of rivers.segments) {
          const { hex } = segment;
          const riverWidth = clamp((0.045 + Math.sqrt(hex.runoff) * 0.025) * view.scale, 0.45, 2.5);
          context.strokeStyle = bank ? palette['river-bank']
            : layer === 'terrain' && world.hexes[hex.id].temperature < 0 ? palette.ice : palette.river;
          context.lineWidth = riverWidth + (bank ? Math.min(view.scale * 0.035, 1.2) : 0);
          riverCurve(segment, world, view);
        }
      }
      for (const hex of world.hexes) {
        if (!(hex.springDischarge > 0)) continue;
        const node = projected(rivers.nodes[hex.id], world, view);
        const position = { x: view.x + node.x * view.scale, y: view.y + node.y * view.scale };
        const radius = clamp(view.scale * 0.12, 0.8, 2.5);
        if (position.x < -4 || position.x > width + 4 || position.y < -4 || position.y > height + 4) continue;
        context.beginPath();
        context.arc(position.x, position.y, radius, 0, Math.PI * 2);
        context.fillStyle = palette.spring;
        context.fill();
        context.strokeStyle = palette['spring-ring'];
        context.lineWidth = 0.65;
        context.stroke();
      }
    }
    if (layer === 'regions') {
      for (const hex of world.hexes) {
        const a = center(hex);
        for (const id of hex.neighbors) {
          if (id < hex.id || world.hexes[id].regionId === hex.regionId) continue;
          const b = center(world.hexes[id]);
          if (b.x - a.x > circumference / 2) b.x -= circumference;
          if (b.x - a.x < -circumference / 2) b.x += circumference;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const length = Math.hypot(dx, dy);
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          for (const shift of [-circumference, 0, circumference]) {
            context.beginPath();
            context.moveTo(view.x + (mx - dy / length * 0.5 + shift) * view.scale, view.y + (my + dx / length * 0.5) * view.scale);
            context.lineTo(view.x + (mx + dy / length * 0.5 + shift) * view.scale, view.y + (my - dx / length * 0.5) * view.scale);
            context.strokeStyle = palette['region-boundary'];
            context.lineWidth = clamp(view.scale * 0.08, 0.7, 2);
            context.stroke();
          }
        }
      }
      for (const pass of world.passes ?? []) {
        const lineWidth = clamp(view.scale * 0.28, 2, 7);
        connection(world, pass.fromHex, pass.toHex, view, palette['pass-outline'], lineWidth + 2);
        connection(world, pass.fromHex, pass.toHex, view, palette.pass, lineWidth, [3, 2]);
      }
    }

    if (lifeHexes?.size) {
      let geometry = lifeGeometryCache.get(geography);
      if (!geometry) {
        geometry = new Map();
        lifeGeometryCache.set(geography, geometry);
      }
      for (const [id, summary] of lifeHexes) {
        const hex = world.hexes[id];
        if (!hex) continue;
        if (damagedRows) {
          const range = damagedRows.get(hex.row);
          if (!range || hex.col < range[0] || hex.col > range[1]) continue;
        }
        const position = projected(center(hex), world, view);
        const x = view.x + position.x * view.scale;
        const y = view.y + position.y * view.scale;
        if (x + view.scale < 0 || x - view.scale > width || y + view.scale < 0 || y - view.scale > height) continue;
        if (!summary.markers.length && !summary.plants.length) continue;
        if (!geometry.has(id)) geometry.set(id, lifeMarkerPositions(id));
        const positions = geometry.get(id);
        const plantLimit = view.scale < 7 ? 6 : view.scale < 15 ? 12 : LIFE_PLANT_MARKER_LIMIT;
        const markerLimit = view.scale < 7 ? 6 : view.scale < 15 ? 15 : LIFE_CONSUMER_MARKER_LIMIT;
        for (let index = 0; index < Math.min(plantLimit, summary.plants.length); index += 1) {
          drawLifeMarker(context, summary.plants[index], positions[index], motionTime, x, y, view.scale, palette);
        }
        for (let index = 0; index < Math.min(markerLimit, summary.markers.length); index += 1) {
          drawLifeMarker(context, summary.markers[index], positions[LIFE_PLANT_MARKER_LIMIT + index], motionTime, x, y, view.scale, palette);
        }
        context.globalAlpha = 1;
      }
    }

    context.lineJoin = 'round';
    for (const [kind, contours] of [['species', cachedTerritory.species], ['variant', cachedTerritory.variant]]) {
      if (!contours.length) continue;
      context.beginPath();
      for (const contour of contours) {
        contour.forEach((point, index) => context[index ? 'lineTo' : 'moveTo'](
          view.x + point.x * view.scale, view.y + point.y * view.scale));
        context.closePath();
      }
      const variant = kind === 'variant';
      context.fillStyle = palette[variant ? 'life-variant-fill' : 'life-selected-fill'];
      context.fill('evenodd');
      if (!variant) {
        context.strokeStyle = palette['life-selection-halo'];
        context.lineWidth = 5.5;
        context.stroke();
      }
      context.strokeStyle = palette[variant ? 'life-variant' : 'life-selected'];
      context.lineWidth = variant ? 1.8 : 3;
      context.setLineDash(variant ? [4, 4] : []);
      context.stroke();
      context.setLineDash([]);
    }
    for (const id of new Set([hoveredId, pinnedId])) {
      if (id === null || !world.hexes[id]) continue;
      const pinned = id === pinnedId;
      const position = cellCenter(world, id, camera);
      const outline = pinned ? clamp(view.scale * 0.22, 4.5, 7) : clamp(view.scale * 0.10, 1.6, 2.4);
      const radius = Math.max(view.scale * 0.6, view.scale - outline / ROOT_THREE - 0.6);
      polygon(context, position.x, position.y, radius);
      if (pinned) {
        context.fillStyle = palette['pin-fill'];
        context.fill();
      }
      context.strokeStyle = palette['pin-outline'];
      context.lineWidth = outline;
      context.stroke();
      context.strokeStyle = palette.pin;
      context.lineWidth = outline * (pinned ? 0.55 : 0.3);
      context.stroke();
    }
    context.restore();
    context.restore();
  }

  setTokens(tokens);
  return { resize, setTokens, fit, cover, constrain, draw, hitTest, cellCenter };
}
