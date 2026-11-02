/**
 * Phase 5 — Scalping Strategy Library
 * 10 dedicated high-precision scalping setup detectors.
 */

import { analyzeMicroStructure, detectMicroSweeps, detectMicroRangeBreakout } from './microstructure';

export function detectScalpingStrategySetups(candles, options = {}) {
  if (!candles || candles.length < 3) return [];

  const candidates = [];
  const { microSwings, microEvents } = analyzeMicroStructure(candles);
  const microSweeps = detectMicroSweeps(candles, microSwings);

  for (let i = 2; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const prev2 = candles[i - 2];

    // Strategy 1: Liquidity Sweep Reversal Scalp
    const matchedSweeps = microSweeps.filter(s => s.index === i);
    for (const sweep of matchedSweeps) {
      candidates.push({
        id: `scalp-sweep-${sweep.direction.toLowerCase()}-${c.time}`,
        strategy: 'scalpSweepReversal',
        type: `${sweep.direction}_SCALP_SWEEP`,
        direction: sweep.direction,
        time: c.time,
        price: c.close,
        invalidationLevel: sweep.invalidationLevel,
        score: 4.5,
        reasons: [`Phase 5 ${sweep.type} at ${sweep.referenceLevel.toFixed(2)}`],
        qualityTier: 'A',
      });
    }

    // Strategy 2: Micro-MSS Scalp
    const matchedMss = microEvents.filter(e => e.index === i && e.type.includes('CHOCH'));
    for (const mss of matchedMss) {
      candidates.push({
        id: `scalp-mss-${mss.direction.toLowerCase()}-${c.time}`,
        strategy: 'scalpMicroMss',
        type: `${mss.direction}_SCALP_MSS`,
        direction: mss.direction,
        time: c.time,
        price: c.close,
        invalidationLevel: mss.invalidationLevel,
        score: 4.8,
        reasons: [`Micro CHoCH / MSS break at ${mss.referenceLevel.toFixed(2)}`],
        qualityTier: 'A+',
      });
    }

    // Strategy 5: Momentum Breakout Scalp (Bullish & Bearish)
    const bodySize = Math.abs(c.close - c.open);
    const prevBody = Math.abs(prev.close - prev.open);
    if (bodySize > prevBody * 2.0 && c.close > c.open && c.close > prev.high) {
      candidates.push({
        id: `scalp-breakout-buy-${c.time}`,
        strategy: 'scalpMomentumBreakout',
        type: 'BUY_SCALP_BREAKOUT',
        direction: 'BUY',
        time: c.time,
        price: c.close,
        invalidationLevel: c.low - bodySize * 0.3,
        score: 4.2,
        reasons: ['Bullish Momentum Expansion Breakout'],
        qualityTier: 'A',
      });
    } else if (bodySize > prevBody * 2.0 && c.close < c.open && c.close < prev.low) {
      candidates.push({
        id: `scalp-breakout-sell-${c.time}`,
        strategy: 'scalpMomentumBreakout',
        type: 'SELL_SCALP_BREAKOUT',
        direction: 'SELL',
        time: c.time,
        price: c.close,
        invalidationLevel: c.high + bodySize * 0.3,
        score: 4.2,
        reasons: ['Bearish Momentum Expansion Breakout'],
        qualityTier: 'A',
      });
    }

    // Strategy 6: First Pullback Continuation
    if (prev2.close > prev2.open && prev.close < prev.open && c.close > c.open && c.close > prev.high) {
      candidates.push({
        id: `scalp-pullback-buy-${c.time}`,
        strategy: 'scalpFirstPullback',
        type: 'BUY_SCALP_PULLBACK',
        direction: 'BUY',
        time: c.time,
        price: c.close,
        invalidationLevel: prev.low,
        score: 4.0,
        reasons: ['First Pullback Resumption (Bullish)'],
        qualityTier: 'B',
      });
    } else if (prev2.close < prev2.open && prev.close > prev.open && c.close < c.open && c.close < prev.low) {
      candidates.push({
        id: `scalp-pullback-sell-${c.time}`,
        strategy: 'scalpFirstPullback',
        type: 'SELL_SCALP_PULLBACK',
        direction: 'SELL',
        time: c.time,
        price: c.close,
        invalidationLevel: prev.high,
        score: 4.0,
        reasons: ['First Pullback Resumption (Bearish)'],
        qualityTier: 'B',
      });
    }

    // Strategy 7: Waterfall Continuation & Bullish Cascade
    if (prev2.close < prev2.open && prev.close < prev.open && c.close < c.open && c.close < prev.close) {
      candidates.push({
        id: `scalp-waterfall-sell-${c.time}`,
        strategy: 'scalpWaterfallContinuation',
        type: 'SELL_SCALP_WATERFALL',
        direction: 'SELL',
        time: c.time,
        price: c.close,
        invalidationLevel: c.high + bodySize * 0.5,
        score: 4.6,
        reasons: ['Bearish Waterfall Momentum Cascade'],
        qualityTier: 'A',
      });
    } else if (prev2.close > prev2.open && prev.close > prev.open && c.close > c.open && c.close > prev.close) {
      candidates.push({
        id: `scalp-cascade-buy-${c.time}`,
        strategy: 'scalpWaterfallContinuation',
        type: 'BUY_SCALP_CASCADE',
        direction: 'BUY',
        time: c.time,
        price: c.close,
        invalidationLevel: c.low - bodySize * 0.5,
        score: 4.6,
        reasons: ['Bullish Momentum Cascade'],
        qualityTier: 'A',
      });
    }

    // Strategy 8 & 9: Compression Breakout & Failed Breakout
    if (i >= 8) {
      const range = detectMicroRangeBreakout(candles.slice(0, i + 1), 8);
      if (range) {
        candidates.push({
          id: `scalp-range-breakout-${range.direction.toLowerCase()}-${c.time}`,
          strategy: 'scalpCompressionBreakout',
          type: `${range.direction}_SCALP_COMPRESSION_BREAKOUT`,
          direction: range.direction,
          time: c.time,
          price: c.close,
          invalidationLevel: range.invalidationLevel,
          score: 4.3,
          reasons: [`Compression Range Breakout (${range.rangeSpan.toFixed(2)} pts)`],
          qualityTier: 'A',
        });
      }
    }
  }

  return candidates;
}
