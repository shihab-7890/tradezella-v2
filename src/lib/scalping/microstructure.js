/**
 * Phase 5 — Microstructure Intelligence Engine
 * Precision lower-timeframe (1m, 3m, 5m) micro swing, BOS, CHoCH, MSS & Sweep detection.
 */

export function detectMicroSwings(candles, left = 2, right = 2) {
  if (!candles || candles.length < left + right + 1) return [];

  const swings = [];
  for (let i = left; i < candles.length - right; i++) {
    const current = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let l = 1; l <= left; l++) {
      if (candles[i - l].high >= current.high) isHigh = false;
      if (candles[i - l].low <= current.low) isLow = false;
    }

    for (let r = 1; r <= right; r++) {
      if (candles[i + r].high > current.high) isHigh = false;
      if (candles[i + r].low < current.low) isLow = false;
    }

    if (isHigh) {
      swings.push({
        id: `micro-sh-${current.time}`,
        type: 'HIGH',
        index: i,
        price: current.high,
        time: current.time,
        confirmationTime: candles[i + right].time,
      });
    }

    if (isLow) {
      swings.push({
        id: `micro-sl-${current.time}`,
        type: 'LOW',
        index: i,
        price: current.low,
        time: current.time,
        confirmationTime: candles[i + right].time,
      });
    }
  }

  return swings;
}

export function analyzeMicroStructure(candles, atrList = [], period = 14) {
  if (!candles || candles.length < 5) {
    return { microSwings: [], microEvents: [], internalTrend: 'Ranging' };
  }

  const microSwings = detectMicroSwings(candles, 2, 2);
  const microEvents = [];
  let lastSwingHigh = null;
  let lastSwingLow = null;
  let internalTrend = 'Ranging';

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];

    // Update confirmed swings up to this point
    const confirmedSwings = microSwings.filter(s => s.confirmationTime <= candle.time);
    const highs = confirmedSwings.filter(s => s.type === 'HIGH');
    const lows = confirmedSwings.filter(s => s.type === 'LOW');

    if (highs.length > 0) lastSwingHigh = highs[highs.length - 1];
    if (lows.length > 0) lastSwingLow = lows[lows.length - 1];

    if (lastSwingHigh && candle.close > lastSwingHigh.price) {
      const isChoch = internalTrend === 'BEARISH';
      internalTrend = 'BULLISH';
      microEvents.push({
        id: `micro-bos-bull-${candle.time}`,
        type: isChoch ? 'MICRO_CHOCH' : 'MICRO_BOS',
        direction: 'BUY',
        index: i,
        time: candle.time,
        price: candle.close,
        referenceLevel: lastSwingHigh.price,
        invalidationLevel: lastSwingLow ? lastSwingLow.price : candle.low,
      });
    } else if (lastSwingLow && candle.close < lastSwingLow.price) {
      const isChoch = internalTrend === 'BULLISH';
      internalTrend = 'BEARISH';
      microEvents.push({
        id: `micro-bos-bear-${candle.time}`,
        type: isChoch ? 'MICRO_CHOCH' : 'MICRO_BOS',
        direction: 'SELL',
        index: i,
        time: candle.time,
        price: candle.close,
        referenceLevel: lastSwingLow.price,
        invalidationLevel: lastSwingHigh ? lastSwingHigh.price : candle.high,
      });
    }
  }

  return { microSwings, microEvents, internalTrend };
}

export function detectMicroSweeps(candles, microSwings = []) {
  if (!candles || candles.length < 3) return [];

  const sweeps = [];
  const highs = microSwings.filter(s => s.type === 'HIGH');
  const lows = microSwings.filter(s => s.type === 'LOW');

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];

    // Bullish SSL Sweep (sweeps below recent micro low & reclaims)
    const activeLows = lows.filter(l => l.confirmationTime < c.time && l.index < i - 1 && l.index > i - 30);
    for (const l of activeLows) {
      if (c.low < l.price && c.close > l.price) {
        sweeps.push({
          id: `micro-ssl-sweep-${c.time}-${l.time}`,
          type: 'MICRO_SSL_SWEEP',
          direction: 'BUY',
          index: i,
          time: c.time,
          sweepPrice: c.low,
          referenceLevel: l.price,
          reclaimPrice: c.close,
          invalidationLevel: c.low - Math.abs(c.close - c.open) * 0.2,
        });
        break;
      }
    }

    // Bearish BSL Sweep (sweeps above recent micro high & reclaims below)
    const activeHighs = highs.filter(h => h.confirmationTime < c.time && h.index < i - 1 && h.index > i - 30);
    for (const h of activeHighs) {
      if (c.high > h.price && c.close < h.price) {
        sweeps.push({
          id: `micro-bsl-sweep-${c.time}-${h.time}`,
          type: 'MICRO_BSL_SWEEP',
          direction: 'SELL',
          index: i,
          time: c.time,
          sweepPrice: c.high,
          referenceLevel: h.price,
          reclaimPrice: c.close,
          invalidationLevel: c.high + Math.abs(c.close - c.open) * 0.2,
        });
        break;
      }
    }
  }

  return sweeps;
}

export function detectMicroRangeBreakout(candles, lookback = 10) {
  if (!candles || candles.length < lookback + 2) return null;

  const rangeSlice = candles.slice(-lookback - 1, -1);
  let rangeHigh = -Infinity;
  let rangeLow = Infinity;

  for (const c of rangeSlice) {
    if (c.high > rangeHigh) rangeHigh = c.high;
    if (c.low < rangeLow) rangeLow = c.low;
  }

  const rangeSpan = rangeHigh - rangeLow;
  const current = candles[candles.length - 1];
  const isBreakoutUp = current.close > rangeHigh;
  const isBreakoutDown = current.close < rangeLow;

  if (isBreakoutUp) {
    return {
      type: 'MICRO_RANGE_BREAKOUT',
      direction: 'BUY',
      rangeHigh,
      rangeLow,
      rangeSpan,
      breakoutPrice: current.close,
      invalidationLevel: rangeLow,
    };
  }

  if (isBreakoutDown) {
    return {
      type: 'MICRO_RANGE_BREAKOUT',
      direction: 'SELL',
      rangeHigh,
      rangeLow,
      rangeSpan,
      breakoutPrice: current.close,
      invalidationLevel: rangeHigh,
    };
  }

  return null;
}
