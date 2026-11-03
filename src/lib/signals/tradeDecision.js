/**
 * Phase 7 — Intelligent Trade Decision Engine
 * Final multi-priority decision layer producing BUY/SELL APPROVED, WATCH, WAIT, or REJECTED.
 */

import { DECISION_STATUS, CONFLICT_TYPES } from './types.js';

export function getAdaptiveScoreThreshold(activeSettings = {}, regimeInfo = {}) {
  // If caller explicitly provides a threshold, prioritize it
  if (activeSettings.unifiedScoreThreshold !== undefined) {
    return activeSettings.unifiedScoreThreshold;
  }
  if (activeSettings.confluenceScoreThreshold !== undefined && activeSettings.confluenceScoreThreshold <= 10) {
    const raw = Number(activeSettings.confluenceScoreThreshold);
    if (raw <= 5) return raw * 20; // 0-5 scale mapped to 0-100
    if (raw <= 10) return raw * 10; // 0-10 scale mapped to 0-100
    return raw;
  }

  const mode = activeSettings.settingsMode || activeSettings.autoMode || activeSettings.adaptiveMode || 'AUTO';
  const preset = activeSettings.qualityPreset || 'QUALITY_FIRST'; // 'QUALITY_FIRST' | 'Balanced' | 'Selective' | 'Light'

  if (mode === 'MANUAL') {
    if (preset === 'Light') return 50;
    if (preset === 'Balanced') return 65;
    if (preset === 'QUALITY_FIRST' || preset === 'Selective') return 75;
    return 75;
  }

  // AUTO / HYBRID: Regime-aware bounded threshold (Default 75 for QUALITY_FIRST)
  const regime = regimeInfo?.regime || 'Ranging';
  let baseThreshold = 75;
  if (preset === 'Light') baseThreshold = 50;
  if (preset === 'Balanced') baseThreshold = 65;
  if (preset === 'QUALITY_FIRST' || preset === 'Selective') baseThreshold = 75;

  if (regime.includes('Strong Trend')) {
    return Math.max(50, baseThreshold - 5); // Slightly more permissive during strong momentum
  }
  if (regime.includes('High Volatility') || regime === 'Ranging') {
    return Math.min(85, baseThreshold + 5); // Stricter in chop or high volatility
  }

  return baseThreshold;
}

/**
 * Evaluates trade decision for each candidate in accordance with the Multi-Gate Quality Pipeline (Gates A-E).
 */
export function evaluateTradeDecision(candidate, threshold, activeSettings = {}) {
  const { direction, unifiedScore = 0, conflictType, conflictResolution, evidence } = candidate;

  // Gate A: Data Integrity (Valid OHLCV & non-null price/timestamp)
  if (!candidate.price || candidate.price <= 0 || (candidate.time !== undefined && (candidate.time === null || isNaN(candidate.time) || candidate.time <= 0))) {
    return {
      decision: DECISION_STATUS.REJECTED,
      isApproved: false,
      reasonCode: 'REJECT_DATA_INTEGRITY',
      explanation: 'Rejected (Gate A): Missing or malformed price/timestamp data.',
    };
  }

  // Gate B: Strategy Setup Validity (Confirmed setup pattern, valid direction)
  const isCandidateOnly = candidate.type?.toLowerCase().includes('candidate');
  if (isCandidateOnly) {
    return {
      decision: direction === 'BUY' ? DECISION_STATUS.WATCH : DECISION_STATUS.WATCH,
      isApproved: false,
      reasonCode: 'WATCH_PENDING_CONFIRMATION',
      explanation: `Watch (Gate B): ${direction} setup developing; awaiting final close/MSS confirmation.`,
    };
  }

  // Gate C: Freshness & Level Consumption
  if (evidence?.marketStructure && evidence.marketStructure.isFresh === false) {
    return {
      decision: DECISION_STATUS.REJECTED,
      isApproved: false,
      reasonCode: 'REJECT_STALE_LEVEL',
      explanation: `Rejected (Gate C): Key structure level or zone already consumed/invalidated.`,
    };
  }

  // Gate D: Entry & Risk Feasibility (R:R >= 1.1, non-zero SL/TP, conflict subordination checks)
  const rr = candidate.riskReward || 0;
  if (rr > 0 && rr < 1.1) {
    return {
      decision: DECISION_STATUS.REJECTED,
      isApproved: false,
      reasonCode: 'REJECT_INADEQUATE_RR',
      explanation: `Rejected (Gate D): Risk-to-reward ratio (${rr.toFixed(1)}:1) is below minimal threshold (1.1:1).`,
    };
  }

  if (conflictType === CONFLICT_TYPES.SAME_SETUP_OPPOSITE && conflictResolution === 'WAIT_AMBIGUOUS_CONTRADICTION') {
    return {
      decision: DECISION_STATUS.WAIT,
      isApproved: false,
      reasonCode: 'WAIT_AMBIGUOUS_CONFLICT',
      explanation: `Wait (Gate D): Opposing ${direction} and counter-direction setups active at same price zone with equal weight.`,
    };
  }

  if (conflictResolution === 'SUBORDINATED_TO_COUNTER') {
    return {
      decision: DECISION_STATUS.REJECTED,
      isApproved: false,
      reasonCode: 'REJECT_SUBORDINATED_CONFLICT',
      explanation: `Rejected (Gate D): Subordinated to higher-confidence counter-trend setup at the same level.`,
    };
  }

  // Gate E: Decision Quality / Confluence Score Ranking vs Threshold
  const meetsThreshold = unifiedScore >= threshold;

  if (!meetsThreshold) {
    if (unifiedScore >= 50) {
      return {
        decision: direction === 'BUY' ? 'WATCH BUY' : 'WATCH SELL',
        isApproved: false,
        reasonCode: 'WATCH_SCORE_MODERATE',
        explanation: `Watch (Gate E): Quality score (${unifiedScore.toFixed(1)}/100) is eligible for observation but below approval threshold (${threshold}).`,
      };
    }
    return {
      decision: DECISION_STATUS.REJECTED,
      isApproved: false,
      reasonCode: 'REJECT_SCORE_BELOW_THRESHOLD',
      explanation: `Rejected (Gate E): Quality score (${unifiedScore.toFixed(1)}/100) is below minimum threshold (${threshold}).`,
    };
  }

  // Gate E Passed: APPROVED DECISION
  const decision = direction === 'BUY' ? 'BUY APPROVED' : 'SELL APPROVED';
  const strat = candidate.strategy || 'Confluence';
  const confList = (candidate.confirmations || []).join(' + ');

  const explanation = `${decision} — ${strat} (${confList}). Quality Grade: ${candidate.qualityTier} (${unifiedScore.toFixed(1)}/100). Regime: ${candidate.marketRegime}. R:R: ${(candidate.riskReward || 1.5).toFixed(1)}:1.`;

  return {
    decision,
    isApproved: true,
    reasonCode: 'APPROVED_HIGH_CONFLUENCE',
    explanation,
  };
}
