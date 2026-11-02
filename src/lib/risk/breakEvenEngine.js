/**
 * Phase 8 — Automatic Break-Even Management Engine
 * Protects active open positions by moving stops to cost-adjusted entry on target progression.
 */

import { getInstrumentSpec } from './instruments.js';

/**
 * Checks if an open position is eligible for break-even stop adjustment.
 */
export function evaluateBreakEvenAdjustment({
  trade,
  currentPrice,
  highestFavorablePrice,
  lowestFavorablePrice,
  symbol = 'XAUUSD',
  settings = {},
}) {
  if (!trade || !trade.isOpen || !trade.entryPrice || !trade.sl) {
    return { shouldMove: false, newSl: trade?.sl, reason: 'Trade not active' };
  }

  // Already at or past break-even
  if (trade.isBreakEven) {
    return { shouldMove: false, newSl: trade.sl, reason: 'Already at break-even' };
  }

  const isBuy = trade.direction === 'BUY';
  const entry = trade.entryPrice;
  const originalSl = trade.initialSl || trade.sl;
  const initialRisk = Math.abs(entry - originalSl);

  if (initialRisk <= 0) {
    return { shouldMove: false, newSl: trade.sl, reason: 'Initial risk is zero' };
  }

  const spec = getInstrumentSpec(symbol);
  const tickSize = spec.tickSize || 0.01;
  const decimals = Math.max(2, Math.round(-Math.log10(tickSize)));

  // Cost-aware buffer (spread + small execution padding)
  const spreadPips = settings.assumedSpreadPips !== undefined ? settings.assumedSpreadPips : (spec.typicalSpreadPips || 1.0);
  const bufferPips = (settings.breakEvenBufferPips !== undefined ? settings.breakEvenBufferPips : 1.0) + spreadPips;
  const bufferPrice = bufferPips * spec.pipSize;

  // Activation trigger: R-multiple threshold (e.g. +1.0R) or TP1 reached
  const triggerR = settings.breakEvenTriggerR || 1.0;
  const favorableExcursion = isBuy
    ? (highestFavorablePrice - entry)
    : (entry - lowestFavorablePrice);

  const currentR = favorableExcursion / initialRisk;
  const reachedTriggerR = currentR >= triggerR;
  const reachedTp1 = trade.tp1Filled || (trade.tp1 && (isBuy ? highestFavorablePrice >= trade.tp1 : lowestFavorablePrice <= trade.tp1));

  const isEligible = settings.enableBreakEven !== false && (reachedTriggerR || reachedTp1);

  if (!isEligible) {
    return { shouldMove: false, newSl: trade.sl, currentR, reason: 'Trigger condition not met' };
  }

  // Target Break-Even Stop level:
  // BUY: entry + buffer
  // SELL: entry - buffer
  const targetBeSl = isBuy ? (entry + bufferPrice) : (entry - bufferPrice);
  const steppedSl = Number((Math.round(targetBeSl / tickSize) * tickSize).toFixed(decimals));

  // Non-loosening / Ratchet rule:
  // For BUY: new stop must be HIGHER than current stop
  // For SELL: new stop must be LOWER than current stop
  if (isBuy && steppedSl <= trade.sl) {
    return { shouldMove: false, newSl: trade.sl, reason: 'New stop would not tighten position' };
  }
  if (!isBuy && steppedSl >= trade.sl) {
    return { shouldMove: false, newSl: trade.sl, reason: 'New stop would not tighten position' };
  }

  return {
    shouldMove: true,
    newSl: steppedSl,
    previousSl: trade.sl,
    bufferPips,
    currentR: Math.round(currentR * 10) / 10,
    reason: `Break-Even activated at +${currentR.toFixed(1)}R. Stop ratcheted to cost-buffered entry (${steppedSl}).`,
  };
}
