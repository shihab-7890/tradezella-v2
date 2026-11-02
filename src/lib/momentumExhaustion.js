/**
 * Reversal & Candle Exhaustion Intelligence Engine
 * Evaluates structural exhaustion, sweeps, rejection wicks, and failed breakouts for reversal setups.
 */

export function detectReversalSetups(candles, metricsList, atrList, settings = {}) {
  if (!candles || candles.length < 4) return [];

  const enabled = settings.enableExhaustionReversal !== false;
  if (!enabled) return [];

  const candidates = [];

  for (let i = 3; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];
    const prev2 = candles[i - 2];
    const prev3 = candles[i - 3];

    const currM = metricsList[i];
    const prevM = metricsList[i - 1];
    const prev2M = metricsList[i - 2];
    const prev3M = metricsList[i - 3];

    if (!currM || !prevM || !prev2M) continue;

    // 1. Bullish Reversal (Bearish Exhaustion + Bullish Rejection/Engulfing)
    const wasBearishMove = prev3M.isBearish && prev2M.isBearish;
    const hasBullishRejection = currM.lowerWickRatio >= 0.45 && currM.closeLocation >= 0.55;
    const hasBullishEngulfing = currM.isBullish && prevM.isBearish && curr.close > prev.open;

    if (wasBearishMove && (hasBullishRejection || hasBullishEngulfing)) {
      candidates.push({
        id: `reversal-bull-${curr.time}`,
        strategy: 'candlePsychologyReversal',
        type: 'BUY confirmed',
        direction: 'BUY',
        time: curr.time,
        price: curr.close,
        setupTime: prev.time,
        confirmationTime: curr.time,
        score: 3.2,
        reasons: ['Bearish Exhaustion + Bullish Reversal', hasBullishEngulfing ? 'Bullish Engulfing' : 'Wick Rejection'],
        invalidationPrice: Math.min(curr.low, prev.low),
        notes: `Bullish Reversal setup following extended bearish move. Rejection wick: ${(currM.lowerWickRatio * 100).toFixed(0)}%`,
      });
    }

    // 2. Bearish Reversal (Bullish Exhaustion + Bearish Rejection/Engulfing)
    const wasBullishMove = prev3M.isBullish && prev2M.isBullish;
    const hasBearishRejection = currM.upperWickRatio >= 0.45 && currM.closeLocation <= 0.45;
    const hasBearishEngulfing = currM.isBearish && prevM.isBullish && curr.close < prev.open;

    if (wasBullishMove && (hasBearishRejection || hasBearishEngulfing)) {
      candidates.push({
        id: `reversal-bear-${curr.time}`,
        strategy: 'candlePsychologyReversal',
        type: 'SELL confirmed',
        direction: 'SELL',
        time: curr.time,
        price: curr.close,
        setupTime: prev.time,
        confirmationTime: curr.time,
        score: 3.2,
        reasons: ['Bullish Exhaustion + Bearish Reversal', hasBearishEngulfing ? 'Bearish Engulfing' : 'Wick Rejection'],
        invalidationPrice: Math.max(curr.high, prev.high),
        notes: `Bearish Reversal setup following extended bullish move. Rejection wick: ${(currM.upperWickRatio * 100).toFixed(0)}%`,
      });
    }
  }

  return candidates;
}
