// Illustrative population marks, not organisms or inferred anatomy. All input
// comes from common display observations; motion is a separate cosmetic clock.
import { drawPlantShape, drawAnimalShape } from './life-shapes.js';

export const LIFE_PLANT_MARKER_LIMIT = 24;
export const LIFE_CONSUMER_MARKER_LIMIT = 30;
export const LIFE_MARKER_LIMIT = LIFE_PLANT_MARKER_LIMIT + LIFE_CONSUMER_MARKER_LIMIT;
const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function markerPoint(seed, step) {
  const hash = salt => {
    let value = Math.imul(seed ^ Math.imul(step + 1, 1597334677) ^ salt, 2246822507);
    value = Math.imul(value ^ (value >>> 16), 3266489909);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  };
  const angle = hash(374761393) * TAU;
  const radius = Math.sqrt(hash(668265263)) * 0.66;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

export function lifeMarkerPositions(hexId) {
  return Array.from({ length: LIFE_MARKER_LIMIT }, (_, index) => {
    const seed = Math.imul(hexId + 1, 2654435761) ^ Math.imul(index + 1, 1597334677);
    return { seed, offset: (seed >>> 0) / 4294967296 * 12 };
  });
}

export function lifeMarkerPose(marker, slot, time) {
  const heading = slot.offset / 12 * TAU;
  if (!marker.mobile) {
    return { ...markerPoint(slot.seed, 0), heading, phase: heading, opacity: 1 };
  }
  // Larger representatives amble with a slower limb/tail beat. This is a
  // visual size cue, not a velocity measurement or biological movement rule.
  const size = clamp(Number(marker.size) || 0, 0, 1);
  const pace = 0.85 + 2.2 * size * size;
  const clock = (time / pace + slot.offset) / 3.5;
  const step = Math.floor(clock);
  const progress = clock - step;
  const point = markerPoint(slot.seed, step);
  const previous = markerPoint(slot.seed, step - 1);
  const next = markerPoint(slot.seed, step + 1);
  const from = { x: (previous.x + point.x) / 2, y: (previous.y + point.y) / 2 };
  const to = { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 };
  const rest = 1 - progress;
  // Joined quadratic curves share position AND tangent. The convex hull keeps
  // every path within the occupied hex, including at interval boundaries.
  const dx = rest * (point.x - from.x) + progress * (to.x - point.x);
  const dy = rest * (point.y - from.y) + progress * (to.y - point.y);
  return {
    x: rest * rest * from.x + 2 * rest * progress * point.x + progress * progress * to.x,
    y: rest * rest * from.y + 2 * rest * progress * point.y + progress * progress * to.y,
    heading: Math.atan2(dy, dx), phase: time * 5 / pace + slot.offset, opacity: 1,
  };
}

// The model supplies enabled acquisition systems, not energy-intake shares.
// Older observations without this optional extension retain their role colour.
export function lifeMarkerColour(marker) {
  if (marker.role === 'mixed' && Array.isArray(marker.energySources)) {
    const sources = new Set(marker.energySources);
    const photo = sources.has('photosynthesis');
    const plant = sources.has('plantFeeding');
    const animal = sources.has('animalFeeding');
    if (!photo && plant && animal) return 'life-omnivore';
    if (photo && plant && !animal) return 'life-photo-grazer';
    if (photo && !plant && animal) return 'life-photo-predator';
  }
  return marker.role === 'producer' && !marker.mobile ? 'life-plant' : `life-${marker.role}`;
}

export function drawLifeMarker(context, marker, slot, time, x, y, scale, palette) {
  const plant = marker.role === 'producer' && !marker.mobile;
  const point = lifeMarkerPose(marker, slot, time);
  const size = clamp(Number(marker.size) || 0, 0, 1);
  const radius = plant ? clamp(scale * (0.024 + size * 0.14), 0.4, 2.5 + 7.5 * size)
    : clamp(scale * (0.019 + 0.074 * size ** 1.15), 0.4, 2.5 + 10.5 * size);
  const cx = x + point.x * scale;
  const cy = y + point.y * scale;
  const colour = palette[marker.colour ?? lifeMarkerColour(marker)];
  context.globalAlpha = point.opacity;
  context.fillStyle = colour;
  // Keep a quiet, inexpensive atlas at low zoom. Detail appears as space allows.
  if (scale < (plant ? 10 : 18) || radius < 0.85 || plant && size < 0.35) {
    context.beginPath();
    context.arc(cx, cy, radius, 0, TAU);
    context.fill();
    return;
  }
  context.save();
  context.translate(cx, cy);
  context.rotate(point.heading);
  context.scale(radius, radius);
  context.lineWidth = clamp(0.7 / radius, 0.16, 0.6);
  context.strokeStyle = colour;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  // Stable slot hashes give each habitat a varied vocabulary without random
  // draws, new species, or shapes flickering as the cosmetic clock advances.
  const variant = ((slot.seed >>> 0) + (marker.role === 'predator' ? 3 : 0)) % (plant ? 6 : 8);
  const water = marker.habitat === 'water';
  if (plant) drawPlantShape(context, variant, water, radius >= 2 ? palette['life-detail'] : null);
  else drawAnimalShape(context, variant, water, { ...marker, size }, point.phase,
    radius >= 1.5 ? palette['life-detail'] : null);
  context.restore();
}
