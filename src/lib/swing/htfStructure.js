/**
 * Phase 6 — Higher-Timeframe External Swing Structure Engine
 * Macro HH/HL & LH/LL structure recognition, major BOS/CHoCH & protected swings.
 */

export function analyzeHtfStructure(candles, left = 3, right = 3) {
  if (!candles || candles.length < left + right + 1) {
    return { htfSwings: [], macroTrend: 'Ranging', htfEvents: [] };
  }

  const htfSwings = [];
  for (let i = left; i < candles.length - right; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let l = 1; l <= left; l++) {
      if (candles[i - l].high >= c.high) isHigh = false;
      if (candles[i - l].low <= c.low) isLow = false;
    }

    for (let r = 1; r <= right; r++) {
      if (candles[i + r].high > c.high) isHigh = false;
      if (candles[i + r].low < c.low) isLow = false;
    }

    if (isHigh) {
      htfSwings.push({ id: `htf-sh-${c.time}`, type: 'HIGH', index: i, price: c.high, time: c.time });
    }
    if (isLow) {
      htfSwings.push({ id: `htf-sl-${c.time}`, type: 'LOW', index: i, price: c.low, time: c.time });
    }
  }

  let macroTrend = 'Ranging';
  const highs = htfSwings.filter(s => s.type === 'HIGH');
  const lows = htfSwings.filter(s => s.type === 'LOW');

  if (highs.length >= 2 && lows.length >= 2) {
    const last2Highs = highs.slice(-2);
    const last2Lows = lows.slice(-2);

    if (last2Highs[1].price > last2Highs[0].price && last2Lows[1].price > last2Lows[0].price) {
      macroTrend = 'Bullish';
    } else if (last2Highs[1].price < last2Highs[0].price && last2Lows[1].price < last2Lows[0].price) {
      macroTrend = 'Bearish';
    }
  } else if (candles.length >= 5) {
    const first = candles[0];
    const last = candles[candles.length - 1];
    if (last.close > first.close * 1.01) macroTrend = 'Bullish';
    else if (last.close < first.close * 0.99) macroTrend = 'Bearish';
  }

  return { htfSwings, macroTrend };
}
