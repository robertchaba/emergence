// An illustrative vocabulary, not species or anatomy inferred from genomes.
// Plants fit a 1.25-radius disk; consumer bodies and appendages fit radius 2.
const TAU = Math.PI * 2;

function oval(c, x, y, rx, ry, angle = 0) {
  c.moveTo(x + Math.cos(angle) * rx, y + Math.sin(angle) * rx);
  c.ellipse(x, y, rx, ry, angle, 0, TAU);
}

function leaf(c, x, y, length, width, angle) {
  oval(c, x, y, length, width, angle);
}

export function drawPlantShape(c, variant, water, detail) {
  c.beginPath();
  if (!water) {
    if (variant === 0) {
      // The original three-leaf rosette.
      for (let i = 0; i < 3; i += 1) {
        const a = i * TAU / 3;
        leaf(c, Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0.8, 0.48, a);
      }
    } else if (variant === 1) {
      // Paired fern leaflets.
      for (let i = 0; i < 4; i += 1) {
        for (const side of [-1, 1]) leaf(c, -0.65 + i * 0.4, side * 0.25,
          0.42 - i * 0.05, 0.15, side * 0.8);
      }
      leaf(c, 0.85, 0, 0.3, 0.17, 0);
    } else if (variant === 2) {
      // Five narrow blades from a shared root.
      for (let i = 0; i < 5; i += 1) {
        const a = (i - 2) * 0.48;
        leaf(c, Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0.94, 0.12, a);
      }
    } else if (variant === 3) {
      // Broad branching leaves.
      for (const side of [-1, 1]) {
        leaf(c, -0.4, side * 0.48, 0.55, 0.28, side * 0.65);
        leaf(c, 0.35, side * 0.33, 0.5, 0.23, side * 0.65);
      }
      leaf(c, 0.83, 0, 0.37, 0.22, 0);
    } else if (variant === 4) {
      // Rounded, lobed canopy.
      for (let i = 0; i < 5; i += 1) {
        const a = i * TAU / 5;
        oval(c, Math.cos(a) * 0.49, Math.sin(a) * 0.49, 0.63, 0.5, a);
      }
    } else {
      // Layered needle sprays.
      for (let i = 0; i < 4; i += 1) {
        const x = -0.85 + i * 0.48, width = 0.7 - i * 0.15;
        c.moveTo(x, -width); c.lineTo(x + 0.65, 0); c.lineTo(x, width);
        c.lineTo(x + 0.17, 0); c.closePath();
      }
    }
  } else if (variant === 0) {
    // Ribbon star, distinct from the broad land rosette.
    for (let i = 0; i < 6; i += 1) {
      const a = i * TAU / 6;
      leaf(c, Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.7, 0.16, a);
    }
  } else if (variant === 1) {
    // Three flowing kelp ribbons.
    for (const side of [-1, 0, 1]) {
      c.moveTo(-1, 0);
      c.bezierCurveTo(-0.1, side * 0.95 - 0.2, 0.25, side * 0.55 - 0.4, 1.1, side * 0.4);
      c.bezierCurveTo(0.35, side * 0.55, -0.2, side * 0.95 + 0.15, -1, 0);
    }
  } else if (variant === 2) {
    // Beaded branching colonies.
    for (let i = 0; i < 4; i += 1) {
      for (const side of [-1, 1]) oval(c, -0.7 + i * 0.46, side * (0.5 - i * 0.09), 0.24, 0.22);
    }
    oval(c, 0.93, 0, 0.26, 0.2);
  } else if (variant === 3) {
    // A pleated underwater fan.
    c.moveTo(-0.95, 0);
    for (let i = 0; i <= 8; i += 1) {
      const a = -1.2 + i * 0.3, r = i % 2 ? 0.95 : 1.2;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
  } else if (variant === 4) {
    // Overlapping floating pads.
    oval(c, -0.5, -0.3, 0.67, 0.55, -0.4);
    oval(c, 0.45, -0.25, 0.65, 0.56, 0.3);
    oval(c, 0, 0.5, 0.61, 0.66, 0);
  } else {
    // Fine feather fronds.
    for (let i = 0; i < 5; i += 1) {
      for (const side of [-1, 1]) leaf(c, -0.7 + i * 0.35, side * 0.29,
        0.5 - i * 0.04, 0.085, side * 1.05);
    }
  }
  c.fill();
  if (!detail) return;
  c.strokeStyle = detail;
  c.beginPath();
  if (variant === 0 || variant === 4) {
    const count = water && variant === 0 ? 6 : variant === 4 ? 5 : 3;
    for (let i = 0; i < count; i += 1) {
      const a = i * TAU / count;
      c.moveTo(0, 0); c.lineTo(Math.cos(a) * 0.91, Math.sin(a) * 0.91);
    }
  } else if (water && variant === 3) {
    for (let i = 0; i < 5; i += 1) {
      const a = -1.1 + i * 0.55;
      c.moveTo(-0.8, 0); c.lineTo(Math.cos(a), Math.sin(a));
    }
  } else {
    c.moveTo(-0.95, 0); c.lineTo(0.95, 0);
  }
  c.stroke();
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
