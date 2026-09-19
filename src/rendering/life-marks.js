// Illustrative population marks, not organisms or inferred anatomy. All input
// comes from common display observations; motion is a separate cosmetic clock.
export const LIFE_MARKER_LIMIT = 30;
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
  const clock = (time + slot.offset) / (marker.mobile ? 3.5 : 12);
  const step = Math.floor(clock);
  const progress = clock - step;
  const point = markerPoint(slot.seed, step);
  const heading = slot.offset / 12 * TAU;
  if (!marker.mobile) {
    // Only rooted producers renew their patches. Stationary consumers stay put.
    return marker.role === 'producer'
      ? { ...point, heading, phase: heading, opacity: Math.min(1, progress * 12, (1 - progress) * 12) }
      : { ...markerPoint(slot.seed, 0), heading, phase: heading, opacity: 1 };
  }
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
    heading: Math.atan2(dy, dx), phase: time * 5 + slot.offset, opacity: 1,
  };
}

export function drawLifeMarker(context, marker, slot, time, x, y, scale, palette) {
  const plant = marker.role === 'producer' && !marker.mobile;
  const point = lifeMarkerPose(marker, slot, time);
  const radius = clamp(scale * (0.03 + marker.size * 0.05) * (plant ? 0.8 : 1), 0.4, plant ? 3.5 : 6);
  const cx = x + point.x * scale;
  const cy = y + point.y * scale;
  const colour = palette[plant ? 'life-plant' : `life-${marker.role}`];
  context.globalAlpha = point.opacity;
  context.fillStyle = colour;
  // Keep a quiet, inexpensive atlas at low zoom. Detail appears as space allows.
  if (scale < 18 || radius < 0.85 || plant && (scale < 28 || marker.size < 0.35)) {
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
  if (plant) {
    // A small engraved rosette; the silhouette does not imply a plant species.
    context.beginPath();
    for (let leaf = 0; leaf < 3; leaf += 1) {
      const angle = leaf * TAU / 3;
      const lx = Math.cos(angle) * 0.45;
      const ly = Math.sin(angle) * 0.45;
      context.moveTo(lx + Math.cos(angle) * 0.8, ly + Math.sin(angle) * 0.8);
      context.ellipse(lx, ly, 0.8, 0.34, angle, 0, TAU);
    }
    context.fill();
  } else {
    const swim = marker.habitat === 'water';
    const gait = Math.sin(point.phase);
    const pointed = marker.role === 'predator';
    const broad = marker.role === 'grazer';
    // Appendages follow observed habitat and mobility, never gene guesses.
    if (marker.mobile) {
      context.beginPath();
      if (swim) {
        context.moveTo(-0.8, 0);
        context.bezierCurveTo(-1.3, gait * 0.5, -1.6, -gait * 0.7, -2, gait * 0.5);
        for (const side of [-1, 1]) {
          context.moveTo(0.05, side * 0.35);
          context.quadraticCurveTo(-0.2 + gait * 0.12, side * 1.05, -0.75, side * 0.7);
        }
      } else {
        for (const side of [-1, 1]) {
          for (let leg = 0; leg < 3; leg += 1) {
            const root = 0.55 - leg * 0.55;
            const stride = Math.sin(point.phase + leg * Math.PI * 0.8 + side) * 0.24;
            context.moveTo(root, side * 0.35);
            context.lineTo(root - 0.2 + stride, side * 0.85);
            context.lineTo(root - 0.4 + stride, side * 1.25);
          }
        }
      }
      context.stroke();
    }
    context.beginPath();
    if (pointed || swim) {
      context.moveTo(1.35, 0);
      context.bezierCurveTo(0.45, -0.95, -0.6, -0.6, -1.05, 0);
      context.bezierCurveTo(-0.6, 0.6, 0.45, 0.95, 1.35, 0);
    } else {
      context.ellipse(-0.15, 0, broad ? 1.1 : 0.95, broad ? 0.75 : 0.6, 0, 0, TAU);
      context.moveTo(1.2, 0);
      context.ellipse(0.7, 0, 0.5, 0.43, 0, 0, TAU);
    }
    context.fill();
    // A dorsal engraving reads at close zoom without an enclosing dark border.
    if (radius >= 1.5) {
      context.strokeStyle = palette['life-detail'];
      context.beginPath();
      context.moveTo(-0.6, 0);
      context.lineTo(0.45, 0);
      if (marker.role === 'mixed' || marker.role === 'other') {
        for (const segment of [-0.4, 0, 0.4]) {
          context.moveTo(segment, -0.3);
          context.lineTo(segment, 0.3);
        }
      }
      context.stroke();
    }
  }
  context.restore();
}
