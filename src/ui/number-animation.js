/** Short presentation-only transitions; targets always come from completed observations. */
export function createNumberAnimator() {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const pending = new Map();
  let values = new WeakMap();
  let frame = null;
  const duration = 240;

  function paint(node, state) {
    const text = state.format(state.value);
    if (node.textContent !== text) node.textContent = text;
  }

  function tick(now) {
    frame = null;
    for (const [node, state] of pending) {
      const progress = Math.min(1, (now - state.started) / duration);
      state.value = state.from + (state.target - state.from) * (1 - (1 - progress) ** 3);
      if (progress === 1 || !node.isConnected) {
        state.value = state.target;
        pending.delete(node);
      }
      paint(node, state);
    }
    if (pending.size) frame = requestAnimationFrame(tick);
  }

  function finish() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    for (const [node, state] of pending) {
      state.value = state.target;
      paint(node, state);
    }
    pending.clear();
  }

  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) finish(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });

  return {
    set(node, target, format, { immediate = false } = {}) {
      const previous = values.get(node);
      const snap = immediate || !previous || reducedMotion.matches || document.hidden;
      const state = previous ?? { value: target, target };
      state.format = format;
      if (snap) {
        state.value = target;
        pending.delete(node);
      } else if (state.target !== target) {
        state.from = state.value;
        state.started = performance.now();
        pending.set(node, state);
        if (frame === null) frame = requestAnimationFrame(tick);
      }
      state.target = target;
      values.set(node, state);
      paint(node, state);
    },
    reset() { finish(); values = new WeakMap(); },
    finish,
  };
}
