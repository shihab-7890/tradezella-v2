/**
 * Phase 8 — Instrument-Aware Position Sizing Engine
 * Computes exact position quantities (lots) adhering to contract specs, lot steps, and risk limits.
 */

import { getInstrumentSpec, calculatePointValueInAccountCurrency, normalizeLotSize } from './instruments.js';
import { RISK_DECISION_STATUS } from './types.js';

/**
 * Calculates exact position size in standard lots.
 * 
 * Formula:
 * Raw Lots = (Risk Budget - Estimated Costs) / (Stop Distance * Point Value per 1.0 Lot)
 */
export function calculatePositionSize({
  entryPrice,
  stopLoss,
  riskBudget,
  symbol = 'XAUUSD',
  accountCurrency = 'USD',
  conversionRates = {},
  spreadPips = null,
  slippagePips = null,
  settings = {},
}) {
  const spec = getInstrumentSpec(symbol);

  // Validate basic inputs
  if (!entryPrice || entryPrice <= 0 || !stopLoss || stopLoss <= 0 || !riskBudget || riskBudget <= 0) {
    return {
      lots: 0,
      monetaryRisk: 0,
      status: RISK_DECISION_STATUS.INVALID_STOP,
      reason: 'Missing or invalid entry, stop loss, or risk budget.',
    };
  }

  const stopDistance = Math.abs(entryPrice - stopLoss);
  if (stopDistance <= 0 || isNaN(stopDistance)) {
    return {
      lots: 0,
      monetaryRisk: 0,
      status: RISK_DECISION_STATUS.INVALID_STOP,
      reason: 'Stop loss distance cannot be zero.',
    };
  }

  // Calculate point value per 1.0 lot in account currency
  const pointValueResult = calculatePointValueInAccountCurrency(
    spec,
    entryPrice,
    accountCurrency,
    conversionRates
  );
  const pointValuePerLot = typeof pointValueResult === 'object' ? pointValueResult.value : pointValueResult;

  if (!pointValuePerLot || pointValuePerLot <= 0) {
    return {
      lots: 0,
      monetaryRisk: 0,
      status: RISK_DECISION_STATUS.INVALID_INSTRUMENT_SPEC,
      reason: `Could not determine point value for ${symbol} in ${accountCurrency}.`,
    };
  }

  // Risk per 1.0 standard lot over the stop distance
  const riskPerOneLot = stopDistance * pointValuePerLot;

  // Transaction cost buffer (spread + slippage)
  const effectiveSpreadPips = spreadPips !== null ? spreadPips : (spec.typicalSpreadPips || 1.0);
  const effectiveSlippagePips = slippagePips !== null ? slippagePips : (settings.assumedSlippagePips || 0.2);
  const costPips = effectiveSpreadPips + effectiveSlippagePips;
  const costDistance = costPips * spec.pipSize;
  const costPerOneLot = costDistance * pointValuePerLot;

  // Effective risk budget after reserving transaction costs
  let adjustedRiskBudget = riskBudget;
  if (settings.deductCostsFromRiskBudget !== false) {
    // If estimated cost is very high relative to risk budget, reduce available budget
    const estCostFactor = 1 + (costDistance / stopDistance);
    adjustedRiskBudget = riskBudget / estCostFactor;
  }

  // Raw position size in lots
  const rawLots = adjustedRiskBudget / riskPerOneLot;

  // Normalize and floor to lotStep (STRICT FLOORING TO NEVER EXCEED RISK BUDGET)
  const normalizedLots = normalizeLotSize(rawLots, spec);

  // Check if position meets instrument minimum lot
  if (normalizedLots < spec.minLot) {
    return {
      lots: 0,
      rawLots,
      monetaryRisk: 0,
      minRequiredBudget: Math.round(spec.minLot * riskPerOneLot * 100) / 100,
      status: RISK_DECISION_STATUS.INSUFFICIENT_RISK_BUDGET,
      reason: `Calculated position (${rawLots.toFixed(4)} lots) is below minimum lot size (${spec.minLot}). Required budget: $${(spec.minLot * riskPerOneLot).toFixed(2)}.`,
    };
  }

  // Calculate actual planned monetary risk for the rounded position size
  const actualMonetaryRisk = Math.round((normalizedLots * riskPerOneLot) * 100) / 100;
  const actualEstimatedCost = Math.round((normalizedLots * costPerOneLot) * 100) / 100;

  // Max position size cap check
  const maxAllowedLots = settings.maxPositionSizeLots || spec.maxLot;
  const finalLots = Math.min(normalizedLots, maxAllowedLots);

  return {
    lots: finalLots,
    rawLots,
    monetaryRisk: actualMonetaryRisk,
    estimatedCost: actualEstimatedCost,
    stopDistance,
    stopDistancePips: Math.round((stopDistance / spec.pipSize) * 10) / 10,
    pointValuePerLot,
    spec,
    status: RISK_DECISION_STATUS.ELIGIBLE,
    reason: `Position size calculated: ${finalLots} lots risking $${actualMonetaryRisk} (Budget: $${riskBudget}).`,
  };
}
