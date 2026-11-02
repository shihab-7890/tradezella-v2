/**
 * Phase 6 — Intraday Session Structure Engine
 * Timezone-aware session high/low, previous day high/low & opening range expansion tracking.
 */

export function analyzeSessionStructure(candles) {
  if (!candles || candles.length === 0) {
    return { sessionHigh: null, sessionLow: null, prevDayHigh: null, prevDayLow: null, openRange: null };
  }

  let sessionHigh = -Infinity;
  let sessionLow = Infinity;
  let prevDayHigh = -Infinity;
  let prevDayLow = Infinity;

  const latestTime = candles[candles.length - 1].time;
  const latestDateStr = new Date(latestTime).toISOString().split('T')[0];

  for (let i = candles.length - 1; i >= 0; i--) {
    const c = candles[i];
    const dateStr = new Date(c.time).toISOString().split('T')[0];

    if (dateStr === latestDateStr) {
      if (c.high > sessionHigh) sessionHigh = c.high;
      if (c.low < sessionLow) sessionLow = c.low;
    } else {
      if (c.high > prevDayHigh) prevDayHigh = c.high;
      if (c.low < prevDayLow) prevDayLow = c.low;
    }
  }

  const openRange = candles.length >= 6 ? {
    high: Math.max(...candles.slice(0, 6).map(c => c.high)),
    low: Math.min(...candles.slice(0, 6).map(c => c.low)),
  } : null;

  return {
    sessionHigh: sessionHigh === -Infinity ? null : sessionHigh,
    sessionLow: sessionLow === Infinity ? null : sessionLow,
    prevDayHigh: prevDayHigh === -Infinity ? null : prevDayHigh,
    prevDayLow: prevDayLow === Infinity ? null : prevDayLow,
    openRange,
  };
}
