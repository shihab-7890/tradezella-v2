/**
 * Advanced Multi-Candle Pattern Recognition Engine
 * Evaluates rolling completed-candle windows for price action patterns.
 */

import { calculateCandleMetrics, classifyCandle } from './candlePsychology';

export function detectMultiCandlePatterns(candles, currentIndex, metricsList, settings = {}) {
  if (currentIndex < 1 || !candles || currentIndex >= candles.length) {
    return [];
  }

  const curr = candles[currentIndex];
  const prev = candles[currentIndex - 1];
  const currMetrics = metricsList[currentIndex];
  const prevMetrics = metricsList[currentIndex - 1];

  if (!currMetrics || !prevMetrics) return [];

  const patterns = [];
  const minScore = settings.minPatternScore || 2.5;

  // 1. Bullish & Bearish Engulfing
  if (currMetrics.isBullish && prevMetrics.isBearish) {
    const engulfsBody = curr.close >= prev.open && curr.open <= prev.close;
    if (engulfsBody && currMetrics.bodyRatio >= 0.5) {
      patterns.push({
        id: `engulfing-bull-${curr.time}`,
        strategy: 'candlePsychologyEngulfing',
        type: 'Bullish Engulfing',
        direction: 'BUY',
        time: curr.time,
        price: curr.close,
        setupTime: prev.time,
        confirmationTime: curr.time,
        score: 3.0,
        reasons: ['Bullish Engulfing candle', `Body ratio: ${(currMetrics.bodyRatio * 100).toFixed(0)}%`],
        evidence: { currMetrics, prevMetrics },
        invalidationPrice: Math.min(curr.low, prev.low),
        explanation: `Bullish candle completely engulfs previous bearish body at ${curr.close.toFixed(2)}.`,
      });
    }
  } else if (currMetrics.isBearish && prevMetrics.isBullish) {
    const engulfsBody = curr.close <= prev.open && curr.open >= prev.close;
    if (engulfsBody && currMetrics.bodyRatio >= 0.5) {
      patterns.push({
        id: `engulfing-bear-${curr.time}`,
        strategy: 'candlePsychologyEngulfing',
        type: 'Bearish Engulfing',
        direction: 'SELL',
        time: curr.time,
        price: curr.close,
        setupTime: prev.time,
        confirmationTime: curr.time,
        score: 3.0,
        reasons: ['Bearish Engulfing candle', `Body ratio: ${(currMetrics.bodyRatio * 100).toFixed(0)}%`],
        evidence: { currMetrics, prevMetrics },
        invalidationPrice: Math.max(curr.high, prev.high),
        explanation: `Bearish candle completely engulfs previous bullish body at ${curr.close.toFixed(2)}.`,
      });
    }
  }

  // 2. Bullish & Bearish Pin Bar / Rejection
  if (currMetrics.lowerWickRatio >= 0.5 && currMetrics.closeLocation >= 0.6) {
    patterns.push({
      id: `pinbar-bull-${curr.time}`,
      strategy: 'candlePsychologyRejection',
      type: 'Bullish Rejection Pin Bar',
      direction: 'BUY',
      time: curr.time,
      price: curr.close,
      setupTime: curr.time,
      confirmationTime: curr.time,
      score: 2.8,
      reasons: ['Bullish Wick Rejection', `Lower wick ${(currMetrics.lowerWickRatio * 100).toFixed(0)}%`],
      evidence: { currMetrics },
      invalidationPrice: curr.low,
      explanation: `Strong lower wick rejection (${(currMetrics.lowerWickRatio * 100).toFixed(0)}% wick) closing at ${curr.close.toFixed(2)}.`,
    });
  } else if (currMetrics.upperWickRatio >= 0.5 && currMetrics.closeLocation <= 0.4) {
    patterns.push({
      id: `pinbar-bear-${curr.time}`,
      strategy: 'candlePsychologyRejection',
      type: 'Bearish Rejection Pin Bar',
      direction: 'SELL',
      time: curr.time,
      price: curr.close,
      setupTime: curr.time,
      confirmationTime: curr.time,
      score: 2.8,
      reasons: ['Bearish Wick Rejection', `Upper wick ${(currMetrics.upperWickRatio * 100).toFixed(0)}%`],
      evidence: { currMetrics },
      invalidationPrice: curr.high,
      explanation: `Strong upper wick rejection (${(currMetrics.upperWickRatio * 100).toFixed(0)}% wick) closing at ${curr.close.toFixed(2)}.`,
    });
  }

  // 3. Three-Candle Expansion
  if (currentIndex >= 2) {
    const prev2 = candles[currentIndex - 2];
    const prev2Metrics = metricsList[currentIndex - 2];

    if (
      prev2Metrics && prev2Metrics.isBullish &&
      prevMetrics.isBullish &&
      currMetrics.isBullish &&
      curr.close > prev.close && prev.close > prev2.close &&
      currMetrics.bodyRatio >= 0.55 && prevMetrics.bodyRatio >= 0.55
    ) {
      patterns.push({
        id: `expansion-bull-${curr.time}`,
        strategy: 'candlePsychologyExpansion',
        type: 'Bullish 3-Candle Expansion',
        direction: 'BUY',
        time: curr.time,
        price: curr.close,
        setupTime: prev2.time,
        confirmationTime: curr.time,
        score: 3.2,
        reasons: ['3 Consecutive Bullish Expansion Bars', 'Consecutive Higher Closes'],
        evidence: { currMetrics, prevMetrics, prev2Metrics },
        invalidationPrice: Math.min(prev2.low, prev.low, curr.low),
        explanation: 'Three consecutive bullish expansion candles with clear higher closes.',
      });
    } else if (
      prev2Metrics && prev2Metrics.isBearish &&
      prevMetrics.isBearish &&
      currMetrics.isBearish &&
      curr.close < prev.close && prev.close < prev2.close &&
      currMetrics.bodyRatio >= 0.55 && prevMetrics.bodyRatio >= 0.55
    ) {
      patterns.push({
        id: `expansion-bear-${curr.time}`,
        strategy: 'candlePsychologyExpansion',
        type: 'Bearish 3-Candle Expansion',
        direction: 'SELL',
        time: curr.time,
        price: curr.close,
        setupTime: prev2.time,
        confirmationTime: curr.time,
        score: 3.2,
        reasons: ['3 Consecutive Bearish Expansion Bars', 'Consecutive Lower Closes'],
        evidence: { currMetrics, prevMetrics, prev2Metrics },
        invalidationPrice: Math.max(prev2.high, prev.high, curr.high),
        explanation: 'Three consecutive bearish expansion candles with clear lower closes.',
      });
    }
  }

  // 4. Inside-Bar Compression
  if (curr.high <= prev.high && curr.low >= prev.low) {
    patterns.push({
      id: `insidebar-${curr.time}`,
      strategy: 'candlePsychologyCompression',
      type: 'Inside-Bar Compression',
      direction: currMetrics.isBullish ? 'BUY' : 'SELL',
      time: curr.time,
      price: curr.close,
      setupTime: prev.time,
      confirmationTime: curr.time,
      score: 2.2,
      reasons: ['Inside Bar Compression', 'Consolidation inside mother bar'],
      evidence: { currMetrics, prevMetrics },
      invalidationPrice: currMetrics.isBullish ? prev.low : prev.high,
      explanation: `Inside bar contained entirely within previous candle range [${prev.low.toFixed(2)} - ${prev.high.toFixed(2)}].`,
    });
  }

  return patterns;
}
