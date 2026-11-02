/**
 * Phase 6 — Intraday Strategy Setup Detectors
 * Dedicated Intraday setups for session sweeps, intraday BOS/CHoCH/MSS & breakout retests.
 */

import { analyzeSessionStructure } from './sessionStructure';

export function detectIntradaySetups(candles, options = {}) {
  if (!candles || candles.length < 2) return [];

  const candidates = [];
  const { sessionHigh, sessionLow, prevDayHigh, prevDayLow } = analyzeSessionStructure(candles);

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1] || c;

    // Intraday Setup 1: Session SSL / PDL Sweep Reversal (BUY)
    if (prevDayLow && c.low < prevDayLow && c.close > prevDayLow) {
      candidates.push({
        id: `intraday-pdl-sweep-buy-${c.time}`,
        strategy: 'intradaySessionSweep',
        type: 'BUY_INTRADAY_SWEEP',
        tradingStyle: 'Intraday',
        direction: 'BUY',
        time: c.time,
        price: c.close,
        invalidationLevel: c.low - (c.high - c.low) * 0.2,
        score: 4.8,
        reasons: [`Intraday Previous Day Low Sweep Reclaim (${prevDayLow.toFixed(2)})`],
        qualityTier: 'A+',
      });
    }

    // Intraday Setup 2: Session BSL / PDH Sweep Reversal (SELL)
    if (prevDayHigh && c.high > prevDayHigh && c.close < prevDayHigh) {
      candidates.push({
        id: `intraday-pdh-sweep-sell-${c.time}`,
        strategy: 'intradaySessionSweep',
        type: 'SELL_INTRADAY_SWEEP',
        tradingStyle: 'Intraday',
        direction: 'SELL',
        time: c.time,
        price: c.close,
        invalidationLevel: c.high + (c.high - c.low) * 0.2,
        score: 4.8,
        reasons: [`Intraday Previous Day High Sweep Reclaim (${prevDayHigh.toFixed(2)})`],
        qualityTier: 'A+',
      });
    }

    // Intraday Setup 3: Intraday BOS Continuation (BUY & SELL)
    const body = Math.abs(c.close - c.open);
    const prevBody = Math.abs(prev.close - prev.open);

    if (body > prevBody * 1.8 && c.close > c.open && c.close > prev.high) {
      candidates.push({
        id: `intraday-bos-buy-${c.time}`,
        strategy: 'intradayBosContinuation',
        type: 'BUY_INTRADAY_BOS',
        tradingStyle: 'Intraday',
        direction: 'BUY',
        time: c.time,
        price: c.close,
        invalidationLevel: c.low,
        score: 4.5,
        reasons: ['Intraday Structural BOS Breakout'],
        qualityTier: 'A',
      });
    } else if (body > prevBody * 1.8 && c.close < c.open && c.close < prev.low) {
      candidates.push({
        id: `intraday-bos-sell-${c.time}`,
        strategy: 'intradayBosContinuation',
        type: 'SELL_INTRADAY_BOS',
        tradingStyle: 'Intraday',
        direction: 'SELL',
        time: c.time,
        price: c.close,
        invalidationLevel: c.high,
        score: 4.5,
        reasons: ['Intraday Structural BOS Breakdown'],
        qualityTier: 'A',
      });
    }
  }

  return candidates;
}
