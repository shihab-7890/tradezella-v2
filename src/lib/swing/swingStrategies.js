/**
 * Phase 6 — Swing Strategy Setup Detectors
 * Dedicated Swing setups for macro trend continuation, deep Fib pullbacks, major OB retests & swing failures.
 */

import { analyzeHtfStructure } from './htfStructure';
import { analyzeDeepPullbacks } from './deepPullback';

export function detectSwingSetups(candles, options = {}) {
  if (!candles || candles.length < 10) return [];

  const candidates = [];
  const { htfSwings, macroTrend } = analyzeHtfStructure(candles);
  const deepPullback = analyzeDeepPullbacks(candles, htfSwings);

  const c = candles[candles.length - 1];

  // Swing Setup 1: Macro Trend Continuation with Deep Fib Retracement
  if (deepPullback.isDeepPullback && deepPullback.direction === 'BUY' && macroTrend === 'Bullish') {
    candidates.push({
      id: `swing-fib-buy-${c.time}`,
      strategy: 'swingMacroTrendContinuation',
      type: 'BUY_SWING_MACRO_CONTINUATION',
      tradingStyle: 'Swing',
      direction: 'BUY',
      time: c.time,
      price: c.close,
      invalidationLevel: deepPullback.anchorLow,
      score: 5.0,
      reasons: ['Macro Bullish Trend + Deep OTE Fibonacci Retracement (61.8% - 70.5%)'],
      qualityTier: 'A+',
    });
  } else if (deepPullback.isDeepPullback && deepPullback.direction === 'SELL' && macroTrend === 'Bearish') {
    candidates.push({
      id: `swing-fib-sell-${c.time}`,
      strategy: 'swingMacroTrendContinuation',
      type: 'SELL_SWING_MACRO_CONTINUATION',
      tradingStyle: 'Swing',
      direction: 'SELL',
      time: c.time,
      price: c.close,
      invalidationLevel: deepPullback.anchorHigh,
      score: 5.0,
      reasons: ['Macro Bearish Trend + Deep OTE Fibonacci Retracement (61.8% - 70.5%)'],
      qualityTier: 'A+',
    });
  }

  // Swing Setup 2: Major Swing Failure Reversal (SFP)
  const highs = htfSwings.filter(s => s.type === 'HIGH');
  const lows = htfSwings.filter(s => s.type === 'LOW');

  if (lows.length > 0) {
    const lastMajorLow = lows[lows.length - 1];
    if (c.low < lastMajorLow.price && c.close > lastMajorLow.price) {
      candidates.push({
        id: `swing-sfp-buy-${c.time}`,
        strategy: 'swingFailureReversal',
        type: 'BUY_SWING_FAILURE_REVERSAL',
        tradingStyle: 'Swing',
        direction: 'BUY',
        time: c.time,
        price: c.close,
        invalidationLevel: c.low - (c.high - c.low) * 0.3,
        score: 4.8,
        reasons: [`Major Swing Failure Reversal below ${lastMajorLow.price.toFixed(2)}`],
        qualityTier: 'A+',
      });
    }
  }

  if (highs.length > 0) {
    const lastMajorHigh = highs[highs.length - 1];
    if (c.high > lastMajorHigh.price && c.close < lastMajorHigh.price) {
      candidates.push({
        id: `swing-sfp-sell-${c.time}`,
        strategy: 'swingFailureReversal',
        type: 'SELL_SWING_FAILURE_REVERSAL',
        tradingStyle: 'Swing',
        direction: 'SELL',
        time: c.time,
        price: c.close,
        invalidationLevel: c.high + (c.high - c.low) * 0.3,
        score: 4.8,
        reasons: [`Major Swing Failure Reversal above ${lastMajorHigh.price.toFixed(2)}`],
        qualityTier: 'A+',
      });
    }
  }

  return candidates;
}
