/**
 * Phase 8 — Dynamic Multi-Target Take-Profit Engine (TP1, TP2, TP3)
 * Plans progressive targets, partial exit allocations, and cost-adjusted reward-to-risk ratios.
 */

import { TAKE_PROFIT_METHODS, RISK_DECISION_STATUS } from './types.js';
import { getInstrumentSpec, normalizeLotSize } from './instruments.js';

export const DEFAULT_PARTIAL_ALLOCATIONS = {
  tp1Pct: 40, // 40% of position closed at TP1
  tp2Pct: 35, // 35% of position closed at TP2
  tp3Pct: 25, // 25% runner closed at TP3
};

/**
 * Plans TP1, TP2, and TP3 targets and partial lot sizes for an approved setup.
 */
export function planTakeProfitTargets({
  direction = 'BUY',
  entryPrice,
  stopLoss,
  totalLots = 0.1,
  symbol = 'XAUUSD',
  method = TAKE_PROFIT_METHODS.HYBRID,
  setupData = {},
  spreadPips = null,
  settings = {},
}) {
  const isBuy = direction === 'BUY';
  const spec = getInstrumentSpec(symbol);
  const tickSize = spec.tickSize || 0.01;
  const decimals = Math.max(2, Math.round(-Math.log10(tickSize)));

  if (!entryPrice || entryPrice <= 0 || !stopLoss || stopLoss <= 0) {
    return {
      isValid: false,
      reasonCode: RISK_DECISION_STATUS.INVALID_STOP,
      reason: 'Valid entry and stop loss required to plan take-profit targets.',
    };
  }

  const riskDistance = Math.abs(entryPrice - stopLoss);
  if (riskDistance <= 0) {
    return {
      isValid: false,
      reasonCode: RISK_DECISION_STATUS.INVALID_STOP,
      reason: 'Risk distance cannot be zero.',
    };
  }

  // Desired R-multiples
  const r1 = settings.tp1RMultiple || 1.2;
  const r2 = settings.tp2RMultiple || (settings.defaultRiskRewardRatio || 2.0);
  const r3 = settings.tp3RMultiple || (r2 * 1.6);

  let tp1Price = null;
  let tp2Price = null;
  let tp3Price = null;

  let tp1Reason = `Target 1 (+${r1.toFixed(1)}R)`;
  let tp2Reason = `Target 2 (+${r2.toFixed(1)}R)`;
  let tp3Reason = `Target 3 (+${r3.toFixed(1)}R Runner)`;

  // 1. Structural / Liquidity Targets if available
  if (method === TAKE_PROFIT_METHODS.STRUCTURAL || method === TAKE_PROFIT_METHODS.LIQUIDITY || method === TAKE_PROFIT_METHODS.HYBRID) {
    if (setupData.opposingLiquidity) {
      const opp = setupData.opposingLiquidity;
      if (isBuy && opp > entryPrice) {
        tp1Price = opp;
        tp1Reason = 'Opposing BSL Pool';
      } else if (!isBuy && opp < entryPrice) {
        tp1Price = opp;
        tp1Reason = 'Opposing SSL Pool';
      }
    }
  }

  // Fallback to progressive R:R projections
  if (tp1Price === null) {
    tp1Price = isBuy ? (entryPrice + riskDistance * r1) : (entryPrice - riskDistance * r1);
  }
  if (tp2Price === null) {
    tp2Price = isBuy ? (entryPrice + riskDistance * r2) : (entryPrice - riskDistance * r2);
  }
  if (tp3Price === null) {
    tp3Price = isBuy ? (entryPrice + riskDistance * r3) : (entryPrice - riskDistance * r3);
  }

  // Step and format prices
  const roundPrice = (p) => Number((Math.round(p / tickSize) * tickSize).toFixed(decimals));
  tp1Price = roundPrice(tp1Price);
  tp2Price = roundPrice(tp2Price);
  tp3Price = roundPrice(tp3Price);

  // ==========================================
  // Strict Directional & Target Hierarchy Checks
  // ==========================================
  if (isBuy) {
    if (tp1Price <= entryPrice || tp2Price <= tp1Price || tp3Price <= tp2Price) {
      return {
        isValid: false,
        reasonCode: RISK_DECISION_STATUS.INSUFFICIENT_REWARD,
        reason: 'Invalid BUY TP order: Targets must satisfy Entry < TP1 < TP2 < TP3.',
      };
    }
  } else {
    if (tp1Price >= entryPrice || tp2Price >= tp1Price || tp3Price >= tp2Price) {
      return {
        isValid: false,
        reasonCode: RISK_DECISION_STATUS.INSUFFICIENT_REWARD,
        reason: 'Invalid SELL TP order: Targets must satisfy TP3 < TP2 < TP1 < Entry.',
      };
    }
  }

  // Distances
  const dist1 = Math.abs(tp1Price - entryPrice);
  const dist2 = Math.abs(tp2Price - entryPrice);
  const dist3 = Math.abs(tp3Price - entryPrice);

  // Gross Reward-to-Risk Ratios
  const rr1 = Math.round((dist1 / riskDistance) * 100) / 100;
  const rr2 = Math.round((dist2 / riskDistance) * 100) / 100;
  const rr3 = Math.round((dist3 / riskDistance) * 100) / 100;

  // Cost-adjusted Net R:R (accounting for spread and slippage)
  const effectiveSpreadPips = spreadPips !== null ? spreadPips : (spec.typicalSpreadPips || 1.0);
  const costPips = effectiveSpreadPips + (settings.assumedSlippagePips || 0.2);
  const costDistance = costPips * spec.pipSize;

  const netRiskDistance = riskDistance + costDistance;
  const netRewardDistance2 = Math.max(0, dist2 - costDistance);
  const netRr = netRiskDistance > 0 ? Math.round((netRewardDistance2 / netRiskDistance) * 100) / 100 : rr2;

  // Partial lot allocation
  const alloc = {
    tp1Pct: settings.tp1AllocationPct || DEFAULT_PARTIAL_ALLOCATIONS.tp1Pct,
    tp2Pct: settings.tp2AllocationPct || DEFAULT_PARTIAL_ALLOCATIONS.tp2Pct,
    tp3Pct: settings.tp3AllocationPct || DEFAULT_PARTIAL_ALLOCATIONS.tp3Pct,
  };

  // Guarantee allocations do not exceed 100%
  const totalAllocPct = alloc.tp1Pct + alloc.tp2Pct + alloc.tp3Pct;
  const scale = totalAllocPct > 100 ? (100 / totalAllocPct) : 1;
  const p1 = (alloc.tp1Pct * scale) / 100;
  const p2 = (alloc.tp2Pct * scale) / 100;

  // Allocate lots respecting lotStep
  let tp1Lots = normalizeLotSize(totalLots * p1, spec);
  let tp2Lots = normalizeLotSize(totalLots * p2, spec);
  let tp3Lots = normalizeLotSize(Math.max(0, totalLots - tp1Lots - tp2Lots), spec);

  // If totalLots is small (e.g. 0.01 minLot), full position exits at TP1 or TP2
  if (totalLots <= spec.minLot) {
    tp1Lots = totalLots;
    tp2Lots = 0;
    tp3Lots = 0;
  }

  return {
    isValid: true,
    tp1: tp1Price,
    tp2: tp2Price,
    tp3: tp3Price,
    tp: tp2Price, // Primary anchor target
    targets: [
      { id: 'TP1', price: tp1Price, distance: dist1, rr: rr1, lots: tp1Lots, pct: alloc.tp1Pct, reason: tp1Reason },
      { id: 'TP2', price: tp2Price, distance: dist2, rr: rr2, lots: tp2Lots, pct: alloc.tp2Pct, reason: tp2Reason },
      { id: 'TP3', price: tp3Price, distance: dist3, rr: rr3, lots: tp3Lots, pct: alloc.tp3Pct, reason: tp3Reason },
    ],
    grossRewardRisk: rr2,
    netRewardRisk: netRr,
    riskReward: rr2,
    status: RISK_DECISION_STATUS.ELIGIBLE,
  };
}
