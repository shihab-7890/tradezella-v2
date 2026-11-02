/**
 * Advanced Market Structure Intelligence Engine
 * Dual-Layer Internal & External Structure, Confirmed Swings, BOS, CHoCH, and MSS.
 */

export function detectSwings(candles, leftLen = 2, rightLen = 2) {
  if (!candles || candles.length < leftLen + rightLen + 1) return [];

  const swings = [];

  for (let i = leftLen; i < candles.length - rightLen; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let l = 1; l <= leftLen; l++) {
      if (candles[i - l].high >= c.high) isHigh = false;
      if (candles[i - l].low <= c.low) isLow = false;
    }
    for (let r = 1; r <= rightLen; r++) {
      if (candles[i + r].high > c.high) isHigh = false;
      if (candles[i + r].low < c.low) isLow = false;
    }

    if (isHigh) {
      swings.push({
        id: `swing-high-${c.time}`,
        type: 'HIGH',
        index: i,
        price: c.high,
        time: c.time,
        confirmationTime: candles[i + rightLen].time,
        confirmationIndex: i + rightLen,
      });
    }
    if (isLow) {
      swings.push({
        id: `swing-low-${c.time}`,
        type: 'LOW',
        index: i,
        price: c.low,
        time: c.time,
        confirmationTime: candles[i + rightLen].time,
        confirmationIndex: i + rightLen,
      });
    }
  }

  return swings.sort((a, b) => a.time - b.time);
}

export function analyzeMarketStructure(candles, settings = {}) {
  if (!candles || candles.length === 0) {
    return {
      internalSwings: [],
      externalSwings: [],
      structureEvents: [],
      trendState: { internal: 'Ranging', external: 'Ranging' },
    };
  }

  const internalSwings = detectSwings(candles, 1, 1);
  const externalSwings = detectSwings(candles, 3, 3);

  const structureEvents = [];
  let internalTrend = 'Ranging';
  let lastConfirmedHigh = null;
  let lastConfirmedLow = null;

  for (let i = 2; i < candles.length; i++) {
    const candle = candles[i];

    // Find swings confirmed on or before current candle
    const activeInternalHighs = internalSwings.filter(s => s.type === 'HIGH' && s.confirmationIndex <= i);
    const activeInternalLows = internalSwings.filter(s => s.type === 'LOW' && s.confirmationIndex <= i);

    const prevHigh = activeInternalHighs.length > 0 ? activeInternalHighs[activeInternalHighs.length - 1] : null;
    const prevLow = activeInternalLows.length > 0 ? activeInternalLows[activeInternalLows.length - 1] : null;

    // 1. Bullish BOS / CHoCH: candle close above previous confirmed swing high
    if (prevHigh && candle.close > prevHigh.price && prevHigh !== lastConfirmedHigh) {
      const isChoch = internalTrend !== 'BULLISH';
      const eventType = isChoch ? 'CHoCH' : 'BOS';
      internalTrend = 'BULLISH';
      lastConfirmedHigh = prevHigh;

      structureEvents.push({
        id: `${eventType.toLowerCase()}-bull-${candle.time}`,
        type: eventType,
        direction: 'BUY',
        classification: 'internal',
        brokenLevel: prevHigh.price,
        time: candle.time,
        originTime: prevHigh.time,
        confirmationTime: candle.time,
        invalidationPrice: prevLow ? prevLow.price : candle.low,
        reasons: [`Bullish ${eventType} above swing high at ${prevHigh.price.toFixed(2)}`],
      });
    }

    // 2. Bearish BOS / CHoCH: candle close below previous confirmed swing low
    if (prevLow && candle.close < prevLow.price && prevLow !== lastConfirmedLow) {
      const isChoch = internalTrend !== 'BEARISH';
      const eventType = isChoch ? 'CHoCH' : 'BOS';
      internalTrend = 'BEARISH';
      lastConfirmedLow = prevLow;

      structureEvents.push({
        id: `${eventType.toLowerCase()}-bear-${candle.time}`,
        type: eventType,
        direction: 'SELL',
        classification: 'internal',
        brokenLevel: prevLow.price,
        time: candle.time,
        originTime: prevLow.time,
        confirmationTime: candle.time,
        invalidationPrice: prevHigh ? prevHigh.price : candle.high,
        reasons: [`Bearish ${eventType} below swing low at ${prevLow.price.toFixed(2)}`],
      });
    }
  }

  return {
    internalSwings,
    externalSwings,
    structureEvents,
    trendState: { internal: internalTrend, external: 'Ranging' },
  };
}
