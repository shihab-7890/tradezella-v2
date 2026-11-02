/**
 * Phase 8 — Smart Trailing Stop Engine
 * Trailing stop logic with strictly enforced directional ratchet rules (never loosens protective stops).
 */

import { TRAILING_STOP_METHODS } from './types.js';
import { getInstrumentSpec } from './instruments.js';

/**
 * Calculates new trailing stop candidate for an active position at a candle close.
 */
export function calculateTrailingStop({
  trade,
  candle,
  priorCandle = null,
  atr = null,
  method = TRAILING_STOP_METHODS.ATR,
  symbol = 'XAUUSD',
  confirmedSwings = [],
  settings = {},
}) {
  if (!trade || !trade.isOpen || !candle) {
    return { shouldUpdate: false, newSl: trade?.sl };
  }

  const isBuy = trade.direction === 'BUY';
  const currentSl = trade.sl;
  const spec = getInstrumentSpec(symbol);
  const tickSize = spec.tickSize || 0.01;
  const decimals = Math.max(2, Math.round(-Math.log10(tickSize)));

  // Trailing stop activation threshold (e.g. after +1.5R or after TP1)
  const entry = trade.entryPrice;
  const initialRisk = Math.abs(entry - (trade.initialSl || currentSl));
  const triggerR = settings.trailingTriggerR || 1.2;
  const favorableExcursion = isBuy ? (candle.high - entry) : (entry - candle.low);
  const currentR = initialRisk > 0 ? (favorableExcursion / initialRisk) : 0;

  if (currentR < triggerR && !trade.tp1Filled) {
    return { shouldUpdate: false, newSl: currentSl, reason: 'Trailing trigger threshold not reached' };
  }

  const atrValue = Number.isFinite(atr) && atr > 0 ? atr : (candle.close * 0.003);
  const atrMultiplier = settings.trailingAtrMultiplier || 1.5;

  let candidateSl = null;
  let trailReason = '';

  // 1. ATR Trailing
  if (method === TRAILING_STOP_METHODS.ATR || method === TRAILING_STOP_METHODS.HYBRID) {
    const dist = atrValue * atrMultiplier;
    candidateSl = isBuy ? (candle.close - dist) : (candle.close + dist);
    trailReason = `ATR Trailing (${atrMultiplier}x ATR)`;
  }

  // 2. Structural Trailing (Newly confirmed higher low for BUY, lower high for SELL)
  if (method === TRAILING_STOP_METHODS.STRUCTURAL || method === TRAILING_STOP_METHODS.HYBRID) {
    if (confirmedSwings && confirmedSwings.length > 0) {
      if (isBuy) {
        // Find highest confirmed swing low formed after trade entry
        const validLows = confirmedSwings.filter(s => s.type === 'low' && s.time >= trade.entryTime && s.price < candle.close);
        if (validLows.length > 0) {
          const highestLow = Math.max(...validLows.map(s => s.price));
          if (candidateSl === null || highestLow > candidateSl) {
            candidateSl = highestLow;
            trailReason = 'Confirmed Structural Higher Low';
          }
        }
      } else {
        // Find lowest confirmed swing high formed after trade entry
        const validHighs = confirmedSwings.filter(s => s.type === 'high' && s.time >= trade.entryTime && s.price > candle.close);
        if (validHighs.length > 0) {
          const lowestHigh = Math.min(...validHighs.map(s => s.price));
          if (candidateSl === null || lowestHigh < candidateSl) {
            candidateSl = lowestHigh;
            trailReason = 'Confirmed Structural Lower High';
          }
        }
      }
    }
  }

  // 3. Candle-Based Trailing (Prior candle extreme)
  if (method === TRAILING_STOP_METHODS.CANDLE && priorCandle) {
    candidateSl = isBuy ? priorCandle.low : priorCandle.high;
    trailReason = 'Prior Candle Extreme';
  }

  // 4. Momentum Trailing (Tightens when momentum exhaustion is detected)
  if (method === TRAILING_STOP_METHODS.MOMENTUM) {
    const isExhausted = Boolean(candle.isExhaustion || trade.exhaustionWarning);
    const tightMultiplier = isExhausted ? 0.8 : 1.6;
    const dist = atrValue * tightMultiplier;
    candidateSl = isBuy ? (candle.close - dist) : (candle.close + dist);
    trailReason = isExhausted ? 'Momentum Exhaustion Tightening' : 'Momentum Trend Follow';
  }

  if (candidateSl === null) {
    return { shouldUpdate: false, newSl: currentSl };
  }

  // Step and round to tickSize
  const steppedSl = Number((Math.round(candidateSl / tickSize) * tickSize).toFixed(decimals));

  // ==========================================
  // MANDATORY RATCHET LOCK INVARIANT:
  // A protective trailing stop must NEVER loosen!
  // BUY: New stop must be STRICTLY GREATER than current stop.
  // SELL: New stop must be STRICTLY LESS than current stop.
  // ==========================================
  if (isBuy) {
    if (steppedSl > currentSl && steppedSl < candle.close) {
      return {
        shouldUpdate: true,
        newSl: steppedSl,
        previousSl: currentSl,
        trailReason,
        method,
      };
    }
  } else {
    if (steppedSl < currentSl && steppedSl > candle.close) {
      return {
        shouldUpdate: true,
        newSl: steppedSl,
        previousSl: currentSl,
        trailReason,
        method,
      };
    }
  }

  return { shouldUpdate: false, newSl: currentSl, reason: 'Candidate stop does not improve current stop' };
}
