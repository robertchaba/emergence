// Optional observation of execution boundaries. No clocks, browser services,
// state or callback results enter the model. Disabled phases keep the original
// function, and a failed observer cannot interrupt biological work.
export function traceEvent(listener, entering) {
  try { listener?.(entering); } catch { /* Diagnostics are non-authoritative. */ }
}

export function traceCalls(fn, listener) {
  if (!listener) return fn;
  return function (...args) {
    traceEvent(listener, true);
    try { return fn.apply(this, args); }
    finally { traceEvent(listener, false); }
  };
}
