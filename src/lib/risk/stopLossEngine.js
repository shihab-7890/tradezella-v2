/**
 * Phase 8 — Advanced Precision Stop-Loss Engine
 * Calculates, buffers, and validates structural and volatility stop-loss levels.
 */

import { STOP_LOSS_METHODS, RISK_DECISION_STATUS } from './types.js';
import { getInstrumentSpec } from './instruments.js';

/**
 * Calculates stop-loss price for a BUY or SELL setup according to the selected method.
 */
export function calculatePrecisionStopLoss({
  direction = 'BUY',
  entryPrice,
  candles = [],
  signalIndex = -1,
  atr = null,
  method = STOP_LOSS_METHODS.HYBRID,
  symbol = 'XAUUSD',
  setupData = {},
  settings = {},
}) {
  const isBuy = direction === 'BUY';
  const spec = getInstrumentSpec(symbol);
  const tickSize = spec.tickSize || 0.01;
  const decimals = Math.max(2, Math.round(-Math.log10(tickSize)));

  if (!entryPrice || entryPrice <= 0) {
    return {
      sl: 0,
      isValid: false,
      reasonCode: RISK_DECISION_STATUS.INVALID_STOP,
      reason: 'Missing or invalid entry price.',
    };
  }

  const atrValue = Number.isFinite(atr) && atr > 0 ? atr : (entryPrice * 0.003); // ~0.3% ATR estimate if not given
  const atrMultiplier = settings.atrStopMultiplier || 1.5;
  const bufferPct = settings.slBufferPercent !== undefined ? settings.slBufferPercent : 0.001; // 0.1% buffer

  let rawSl = null;
  let slReason = '';

  // Check if explicit stop was given and is invalid
  const explicitSl = setupData.invalidationPrice || setupData.sl;
  if (explicitSl !== undefined && explicitSl !== null) {
    if (isBuy && explicitSl >= entryPrice) {
      return {
        sl: 0,
        isValid: false,
        reasonCode: RISK_DECISION_STATUS.INVALID_STOP,
        reason: `Invalid BUY Stop Loss: Explicit SL (${explicitSl}) cannot be at or above entry price (${entryPrice}).`,
      };
    }
    if (!isBuy && explicitSl <= entryPrice) {
      return {
        sl: 0,
        isValid: false,
        reasonCode: RISK_DECISION_STATUS.INVALID_STOP,
        reason: `Invalid SELL Stop Loss: Explicit SL (${explicitSl}) cannot be at or below entry price (${entryPrice}).`,
      };
    }
    rawSl = explicitSl;
    slReason = setupData.notes || 'Structural Invalidation Level';
  }

  // 1. Structure Based
  if ((method === STOP_LOSS_METHODS.STRUCTURE || method === STOP_LOSS_METHODS.HYBRID) && rawSl === null) {
    const lookback = settings.structuralLookback || 15;
    const endIdx = signalIndex >= 0 ? signalIndex : candles.length - 1;
    const startIdx = Math.max(0, endIdx - lookback);

    if (candles.length > 0 && endIdx >= 0) {
      if (isBuy) {
        let lowestLow = Infinity;
        for (let i = startIdx; i <= endIdx; i++) {
          if (candles[i] && candles[i].low < lowestLow) lowestLow = candles[i].low;
        }
        if (Number.isFinite(lowestLow) && lowestLow < entryPrice) {
          rawSl = lowestLow;
          slReason = 'Swing Low Structure';
        }
      } else {
        let highestHigh = -Infinity;
        for (let i = startIdx; i <= endIdx; i++) {
          if (candles[i] && candles[i].high > highestHigh) highestHigh = candles[i].high;
        }
        if (Number.isFinite(highestHigh) && highestHigh > entryPrice) {
          rawSl = highestHigh;
          slReason = 'Swing High Structure';
        }
      }
    }
  }

  // If hybrid and structural stop found, add ATR buffer
  if (rawSl !== null && method === STOP_LOSS_METHODS.HYBRID) {
    const buffer = Math.max(atrValue * 0.3, entryPrice * bufferPct);
    rawSl = isBuy ? (rawSl - buffer) : (rawSl + buffer);
    slReason += ' + ATR Volatility Buffer';
  }

  // 2. Liquidity Based (Behind BSL / SSL pool)
  if (method === STOP_LOSS_METHODS.LIQUIDITY && rawSl === null) {
    if (setupData.liquidityLevel) {
      const buffer = atrValue * 0.4;
      rawSl = isBuy ? (setupData.liquidityLevel - buffer) : (setupData.liquidityLevel + buffer);
      slReason = 'Liquidity Pool Boundary';
    }
  }

  // 3. Order Block Based
  if (method === STOP_LOSS_METHODS.ORDER_BLOCK && rawSl === null) {
    if (setupData.orderBlock) {
      const ob = setupData.orderBlock;
      rawSl = isBuy ? ob.low : ob.high;
      slReason = 'Order Block Zone Invalidation';
    }
  }

  // 4. Strict Structure Check: If structure is requested and candles were given but no swing point was found:
  if (method === STOP_LOSS_METHODS.STRUCTURE && rawSl === null && candles.length > 0) {
    return {
      sl: 0,
      isValid: false,
      reasonCode: RISK_DECISION_STATUS.INVALID_STOP,
      reason: 'No valid structural swing point found for stop loss.',
    };
  }

  // 5. ATR Based (Pure volatility distance or fallback when no candles provided)
  if (method === STOP_LOSS_METHODS.ATR || rawSl === null) {
    const dist = atrValue * atrMultiplier;
    rawSl = isBuy ? (entryPrice - dist) : (entryPrice + dist);
    slReason = `ATR Volatility Stop (${atrMultiplier}x ATR)`;
  }

  // 5. Fixed Distance
  if (method === STOP_LOSS_METHODS.FIXED && settings.fixedStopPips) {
    const dist = settings.fixedStopPips * spec.pipSize;
    rawSl = isBuy ? (entryPrice - dist) : (entryPrice + dist);
    slReason = `Fixed Distance (${settings.fixedStopPips} pips)`;
  }

  // Round to instrument tick size
  const steppedSl = Math.round(rawSl / tickSize) * tickSize;
  const finalSl = Number(steppedSl.toFixed(decimals));

  // ==========================================
  // Strict Directional & Validity Checks
  // ==========================================
  if (isBuy && finalSl >= entryPrice) {
    return {
      sl: 0,
      isValid: false,
      reasonCode: RISK_DECISION_STATUS.INVALID_STOP,
      reason: `Invalid BUY Stop Loss: SL (${finalSl}) cannot be at or above entry price (${entryPrice}).`,
    };
  }

  if (!isBuy && finalSl <= entryPrice) {
    return {
      sl: 0,
      isValid: false,
      reasonCode: RISK_DECISION_STATUS.INVALID_STOP,
      reason: `Invalid SELL Stop Loss: SL (${finalSl}) cannot be at or below entry price (${entryPrice}).`,
    };
  }

  const stopDistance = Math.abs(entryPrice - finalSl);
  if (stopDistance <= 0 || isNaN(stopDistance)) {
    return {
      sl: 0,
      isValid: false,
      reasonCode: RISK_DECISION_STATUS.INVALID_STOP,
      reason: 'Stop loss distance cannot be zero.',
    };
  }

  return {
    sl: finalSl,
    isValid: true,
    method,
    stopDistance,
    stopDistancePips: Math.round((stopDistance / spec.pipSize) * 10) / 10,
    slReason,
    status: RISK_DECISION_STATUS.ELIGIBLE,
  };
}
