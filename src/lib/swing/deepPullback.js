/**
 * Phase 6 — Fibonacci & Deep Pullback Intelligence Engine
 * Automatic anchor selection, Fib retracements (50%, 61.8%, 70.5%, 78.6% OTE) & extension targets.
 */

export function analyzeDeepPullbacks(candles, htfSwings = []) {
  if (!candles || candles.length < 10 || htfSwings.length < 2) {
    return { fibLevels: null, isDeepPullback: false };
  }

  const highs = htfSwings.filter(s => s.type === 'HIGH');
  const lows = htfSwings.filter(s => s.type === 'LOW');

  if (highs.length === 0 || lows.length === 0) {
    return { fibLevels: null, isDeepPullback: false };
  }

  const lastHigh = highs[highs.length - 1];
  const lastLow = lows[lows.length - 1];
  const current = candles[candles.length - 1];

  const isBullishImpulse = lastLow.index < lastHigh.index || (highs.length > 1 && highs[highs.length - 1].price > highs[0].price);
  const rangeSpan = Math.abs(lastHigh.price - lastLow.price);

  if (rangeSpan === 0) return { fibLevels: null, isDeepPullback: false };

  if (isBullishImpulse) {
    const retracementPct = (lastHigh.price - current.close) / rangeSpan;
    const fibLevels = {
      fib50: lastHigh.price - rangeSpan * 0.50,
      fib618: lastHigh.price - rangeSpan * 0.618,
      ote705: lastHigh.price - rangeSpan * 0.705,
      fib786: lastHigh.price - rangeSpan * 0.786,
      ext127: lastHigh.price + rangeSpan * 0.272,
      ext161: lastHigh.price + rangeSpan * 0.618,
    };

    return {
      fibLevels,
      isDeepPullback: retracementPct >= 0.50 && retracementPct <= 0.85,
      direction: 'BUY',
      anchorLow: lastLow.price,
      anchorHigh: lastHigh.price,
    };
  } else {
    const retracementPct = (current.close - lastLow.price) / rangeSpan;
    const fibLevels = {
      fib50: lastLow.price + rangeSpan * 0.50,
      fib618: lastLow.price + rangeSpan * 0.618,
      ote705: lastLow.price + rangeSpan * 0.705,
      fib786: lastLow.price + rangeSpan * 0.786,
      ext127: lastLow.price - rangeSpan * 0.272,
      ext161: lastLow.price - rangeSpan * 0.618,
    };

    return {
      fibLevels,
      isDeepPullback: retracementPct >= 0.50 && retracementPct <= 0.85,
      direction: 'SELL',
      anchorLow: lastLow.price,
      anchorHigh: lastHigh.price,
    };
  }
}
