// An illustrative vocabulary, not species or anatomy inferred from genomes.
// Plants fit a 1.25-radius disk; consumer bodies and appendages fit radius 2.
const TAU = Math.PI * 2;

function oval(c, x, y, rx, ry, angle = 0) {
  c.moveTo(x + Math.cos(angle) * rx, y + Math.sin(angle) * rx);
  c.ellipse(x, y, rx, ry, angle, 0, TAU);
}

// Broad radial lobes stay readable when marks are only a few pixels across.
// Each row is [lobe count, distance from centre, length, width, rotation].
const LAND_FOLIAGE = [
  [3, 0.45, 0.8, 0.48, 0], // Three-leaf rosette.
  [5, 0.58, 0.56, 0.43, 0], // Rounded petals.
  [6, 0.47, 0.76, 0.32, 0], // Broad six-point star.
  [4, 0.48, 0.7, 0.52, 0], // Clover canopy.
  [5, 0.49, 0.63, 0.5, 0], // Soft lobed crown.
  [8, 0.68, 0.48, 0.36, 0], // Scalloped cushion.
];
const WATER_FOLIAGE = [
  [6, 0.52, 0.66, 0.4, 0], // Rounded water star.
  [4, 0.42, 0.75, 0.38, 0.45], // Swirling rosette.
  [7, 0.7, 0.35, 0.35, 0], // Circular bead colony.
  [7, 0.38, 0.78, 0.36, 0], // Many-lobed rosette.
  null, // Overlapping floating pads, drawn below.
  [8, 0.5, 0.65, 0.38, 0.4], // Rounded whorl.
];

// Optional model-produced morphology adds a second vocabulary while retaining
// the original habitat variants for observations without descriptors.
function plantForm(c, form, water) {
  if (form === 'rosette' || form === 'needleleaf') {
    const count = form === 'needleleaf' ? 9 : 5;
    for (let i = 0; i < count; i += 1) {
      const angle = i * TAU / count;
      oval(c, Math.cos(angle) * 0.49, Math.sin(angle) * 0.49,
        form === 'needleleaf' ? 0.7 : 0.66, form === 'needleleaf' ? 0.18 : 0.43, angle);
    }
  } else if (form === 'broadleaf') {
    for (const side of [-1, 1]) {
      oval(c, 0.2, side * 0.37, 0.83, 0.53, side * 0.55);
      oval(c, -0.5, side * 0.3, 0.57, 0.43, -side * 0.5);
    }
  } else if (form === 'floating') {
    oval(c, 0, 0, 1.16, water ? 0.79 : 0.93);
    oval(c, -0.44, -0.6, 0.43, 0.35, -0.35);
    oval(c, 0.44, 0.6, 0.43, 0.35, -0.35);
  } else if (form === 'beaded') {
    oval(c, 0, 0, 0.48, 0.48);
    for (let i = 0; i < 6; i += 1) {
      const angle = i * TAU / 6;
      oval(c, Math.cos(angle) * 0.76, Math.sin(angle) * 0.76, 0.35, 0.35);
    }
  } else if (form === 'plume') {
    for (const side of [-1, 1]) for (let i = 0; i < 3; i += 1) {
      oval(c, -0.52 + i * 0.49, side * (0.22 + i * 0.02), 0.46, 0.28, side * (0.75 - i * 0.2));
    }
    oval(c, 0.68, 0, 0.4, 0.25);
  } else return false;
  return true;
}

function surfacePattern(c, pattern, detail) {
  if (!detail || !['mottled', 'banded'].includes(pattern)) return;
  c.strokeStyle = detail;
  c.beginPath();
  if (pattern === 'mottled') {
    for (const [x, y, radius] of [[-0.39, -0.15, 0.1], [-0.08, 0.2, 0.12], [0.32, -0.13, 0.09]]) {
      c.moveTo(x + radius, y); c.arc(x, y, radius, 0, TAU);
    }
  } else {
    for (const x of [-0.4, 0, 0.4]) {
      c.moveTo(x - 0.08, -0.3); c.quadraticCurveTo(x + 0.1, 0, x - 0.08, 0.3);
    }
  }
  c.stroke();
}

export function drawPlantShape(c, variant, water, detail, morphology) {
  c.beginPath();
  if (morphology && plantForm(c, morphology.form, water)) {
    // The model chose the form; rendering only draws its common descriptor.
  } else if (water && variant === 4) {
    oval(c, -0.5, -0.3, 0.67, 0.55, -0.4);
    oval(c, 0.45, -0.25, 0.65, 0.56, 0.3);
    oval(c, 0, 0.5, 0.61, 0.66);
  } else {
    const [count, distance, length, width, twist] = (water ? WATER_FOLIAGE : LAND_FOLIAGE)[variant];
    for (let i = 0; i < count; i += 1) {
      const angle = i * TAU / count;
      oval(c, Math.cos(angle) * distance, Math.sin(angle) * distance,
        length, width, angle + twist);
    }
  }
  c.fill();
  if (!detail) return;
  if (morphology?.pattern && morphology.pattern !== 'plain') {
    surfacePattern(c, morphology.pattern, detail);
    return;
  }
  // A small round centre replaces the former straight stems and vein strokes.
  c.strokeStyle = detail;
  c.beginPath();
  c.arc(0, 0, water ? 0.24 : 0.19, 0, TAU);
  c.stroke();
}

function animalForm(c, form, water, mobile, gait) {
  if (!['sail', 'burrower', 'ambush', 'filter'].includes(form)) return false;
  c.beginPath();
  if (form === 'sail') {
    oval(c, -0.15, 0, 1.12, 0.54);
    for (const side of [-1, 1]) {
      oval(c, -0.21, side * 0.65, 0.94, 0.47, -side * (0.43 + gait * 0.06));
      oval(c, -1.1, side * 0.27, 0.54, 0.21, side * 0.5);
    }
    oval(c, 0.95, 0, 0.36, 0.31);
  } else if (form === 'burrower') {
    oval(c, -0.2, 0, 1.02, 0.7);
    oval(c, 0.75, 0, 0.54, 0.37);
    for (const side of [-1, 1]) {
      oval(c, 0.43 + gait * 0.07, side * 0.65, 0.5, 0.25, -side * 0.5);
      oval(c, -0.65, side * 0.49, 0.32, 0.25, side * 0.4);
    }
  } else if (form === 'ambush') {
    oval(c, -0.3, 0, 0.99, 0.44);
    oval(c, 0.68, 0, 0.54, 0.47);
    for (const side of [-1, 1]) {
      oval(c, 0.9, side * 0.69, 0.59, 0.18, -side * (0.5 + gait * 0.08));
      oval(c, -0.65, side * 0.49, 0.61, 0.17, side * 0.3);
    }
  } else {
    oval(c, -0.42, 0, 0.9, water ? 0.64 : 0.77);
    for (let i = 0; i < 5; i += 1) {
      const angle = (i - 2) * 0.5;
      oval(c, 0.5 + Math.cos(angle) * 0.34, Math.sin(angle) * 0.67,
        0.68, 0.19, angle + gait * 0.04);
    }
  }
  c.fill();
  if (mobile) {
    c.beginPath();
    for (const side of [-1, 1]) {
      c.moveTo(-0.7, side * 0.3);
      c.quadraticCurveTo(-1.2, side * (0.65 + gait * 0.1), -1.65, side * 0.45);
    }
    c.stroke();
  }
  return true;
}

function landLimbs(c, variant, phase, size) {
  const pairs = [3, 3, 2, 4, 2, 2, 3, 0][variant];
  for (const side of [-1, 1]) {
    for (let i = 0; i < pairs; i += 1) {
      const root = 0.55 - i * (pairs === 2 ? 1.1 : 0.43);
      const stride = Math.sin(phase + i * Math.PI * 0.8 + side) * (0.24 - size * 0.07);
      const reach = variant === 4 ? 0.98 : 1.25;
      c.moveTo(root, side * 0.35);
      c.lineTo(root - 0.2 + stride, side * 0.85);
      c.lineTo(root - 0.4 + stride, side * reach);
    }
  }
  if (variant === 1 || variant === 6 || variant === 7) {
    for (const side of [-1, 1]) {
      c.moveTo(0.95, side * 0.17);
      c.quadraticCurveTo(1.45, side * 0.55, 1.7, side * 0.65);
    }
  }
  if (variant === 2 || variant === 5) {
    c.moveTo(-0.8, 0);
    c.quadraticCurveTo(-1.45, Math.sin(phase) * 0.2, -1.85, Math.sin(phase) * 0.35);
  }
}

function waterAppendages(c, variant, phase) {
  const gait = Math.sin(phase);
  if (variant === 4) {
    for (let i = 0; i < 5; i += 1) {
      const y = (i - 2) * 0.25;
      c.moveTo(-0.3, y);
      c.bezierCurveTo(-0.85, y + gait * 0.25, -1.3, y - gait * 0.3, -1.75, y + gait * 0.18);
    }
  } else {
    c.moveTo(-0.8, 0);
    c.bezierCurveTo(-1.25, gait * 0.35, -1.6, -gait * 0.45, -1.9, gait * 0.35);
    for (const side of [-1, 1]) {
      const pairs = variant === 5 || variant === 7 ? 3 : 1;
      for (let i = 0; i < pairs; i += 1) {
        const x = 0.15 - i * 0.42;
        c.moveTo(x, side * 0.32);
        c.quadraticCurveTo(x - 0.15 + gait * 0.12, side * 1.08, x - 0.65, side * 0.7);
      }
    }
  }
}

export function drawAnimalShape(c, variant, water, marker, phase, detail) {
  const gait = marker.mobile ? Math.sin(phase) : 0;
  if (animalForm(c, marker.morphology?.form, water, marker.mobile, gait)) {
    if (detail && (!marker.morphology.pattern || marker.morphology.pattern === 'plain')) {
      c.strokeStyle = detail;
      c.beginPath(); c.arc(0.53, 0, 0.13, 0, TAU); c.stroke();
    }
    surfacePattern(c, marker.morphology.pattern, detail);
    return;
  }
  if (marker.mobile) {
    c.beginPath();
    if (water) waterAppendages(c, variant, phase);
    else landLimbs(c, variant, phase, marker.size);
    c.stroke();
  }
  c.beginPath();
  if (!water) {
    if (variant === 0) {
      if (marker.role === 'predator') {
        c.moveTo(1.35, 0);
        c.bezierCurveTo(0.45, -0.95, -0.6, -0.6, -1.05, 0);
        c.bezierCurveTo(-0.6, 0.6, 0.45, 0.95, 1.35, 0);
      } else {
        oval(c, -0.15, 0, 1.1, 0.75);
        oval(c, 0.7, 0, 0.5, 0.43);
      }
    } else if (variant === 1) {
      oval(c, -0.7, 0, 0.67, 0.51);
      oval(c, 0.05, 0, 0.48, 0.32);
      oval(c, 0.76, 0, 0.43, 0.39);
    } else if (variant === 2) {
      oval(c, -0.27, 0, 1.05, 0.64 + marker.size * 0.15);
      oval(c, 0.72, 0, 0.59, 0.42);
      oval(c, 1.16, 0, 0.32, 0.29);
      for (const side of [-1, 1]) oval(c, 0.7, side * 0.4, 0.24, 0.15, side * 0.6);
    } else if (variant === 3) {
      for (let i = 0; i < 5; i += 1) oval(c, -0.95 + i * 0.49, 0,
        0.4, 0.43 - Math.abs(i - 2) * 0.035);
    } else if (variant === 4) {
      oval(c, -0.15, 0, 1, 0.94);
      oval(c, 0.98, 0, 0.43, 0.34);
    } else if (variant === 5) {
      c.moveTo(1.55, 0);
      c.bezierCurveTo(0.5, -0.65, -0.65, -0.65, -1.45, 0);
      c.bezierCurveTo(-0.65, 0.65, 0.5, 0.65, 1.55, 0);
    } else if (variant === 6) {
      oval(c, -0.15, 0, 0.87, 0.88);
      for (const side of [-1, 1]) oval(c, 0.95, side * 0.67, 0.5, 0.25, -side * 0.4);
    } else {
      c.moveTo(1.35, 0);
      c.bezierCurveTo(0.9, -0.7, -0.8, -0.65, -1.5, gait * 0.13);
      c.bezierCurveTo(-0.5, 0.55, 1.1, 0.65, 1.35, 0);
    }
  } else if (variant === 0 || variant === 1) {
    const width = variant === 1 ? 1.18 : 0.88;
    c.moveTo(1.35, 0);
    c.bezierCurveTo(0.45, -width, -0.6, -width * 0.6, -1.05, 0);
    c.bezierCurveTo(-0.6, width * 0.6, 0.45, width, 1.35, 0);
    if (variant === 1) {
      c.moveTo(-0.85, 0); c.lineTo(-1.6, -0.57 + gait * 0.12);
      c.lineTo(-1.4, gait * 0.12); c.lineTo(-1.6, 0.57 + gait * 0.12); c.closePath();
    }
  } else if (variant === 2) {
    c.moveTo(1.5, 0);
    c.bezierCurveTo(0.6, -0.55, -0.8, gait * 0.2 - 0.3, -1.9, gait * 0.25);
    c.bezierCurveTo(-0.6, gait * 0.2 + 0.3, 0.7, 0.5, 1.5, 0);
  } else if (variant === 3) {
    c.moveTo(1.1, 0);
    c.quadraticCurveTo(0.55, -0.45, -0.3, -1.3);
    c.quadraticCurveTo(-0.75, -0.35, -1.1, 0);
    c.quadraticCurveTo(-0.75, 0.35, -0.3, 1.3);
    c.quadraticCurveTo(0.55, 0.45, 1.1, 0);
  } else if (variant === 4) {
    c.moveTo(-0.35, -0.87);
    c.bezierCurveTo(1.5, -1.1, 1.5, 1.1, -0.35, 0.87);
    c.quadraticCurveTo(0, 0, -0.35, -0.87);
  } else if (variant === 5) {
    for (let i = 0; i < 4; i += 1) oval(c, -0.85 + i * 0.5, i < 2 ? 0.12 : 0,
      0.4 + i * 0.06, 0.27 + i * 0.05, -0.15);
  } else if (variant === 6) {
    oval(c, 0, 0, 1.15, 0.7);
    for (const side of [-1, 1]) oval(c, -0.4, side * 0.73, 0.64, 0.22, -side * (0.45 + gait * 0.1));
    oval(c, 1.05, 0, 0.4, 0.3);
  } else {
    oval(c, -0.15, 0, 1.03, 0.77);
    oval(c, 0.7, 0, 0.46, 0.42);
  }
  c.fill();
  if (!detail) return;
  if (marker.morphology?.pattern && marker.morphology.pattern !== 'plain') {
    surfacePattern(c, marker.morphology.pattern, detail);
    return;
  }
  c.strokeStyle = detail;
  c.beginPath();
  c.moveTo(-0.65, 0); c.lineTo(0.6, 0);
  if ([1, 3, 4, 5, 7].includes(variant) || marker.role === 'mixed' || marker.role === 'other') {
    for (const x of [-0.45, -0.05, 0.35]) {
      c.moveTo(x - 0.1, -0.28); c.quadraticCurveTo(x + 0.1, 0, x - 0.1, 0.28);
    }
  }
  c.stroke();
}
