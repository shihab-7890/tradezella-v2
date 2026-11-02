/**
 * Phase 7 — Intelligent Trade Decision Engine
 * Final multi-priority decision layer producing BUY/SELL APPROVED, WATCH, WAIT, or REJECTED.
 */

import { DECISION_STATUS, CONFLICT_TYPES } from './types.js';

export function getAdaptiveScoreThreshold(activeSettings = {}, regimeInfo = {}) {
  // If caller explicitly provides a threshold, prioritize it
  if (activeSettings.confluenceScoreThreshold !== undefined) {
    const raw = Number(activeSettings.confluenceScoreThreshold);
    if (raw <= 5) return raw * 20; // 0-5 scale mapped to 0-100 (e.g. 2.5 -> 50, 4.0 -> 80)
    if (raw <= 10) return raw * 10; // 0-10 scale mapped to 0-100
    return raw;
  }
  if (activeSettings.unifiedScoreThreshold !== undefined) {
    return activeSettings.unifiedScoreThreshold;
  }

  const mode = activeSettings.settingsMode || activeSettings.autoMode || activeSettings.adaptiveMode || 'AUTO';
  const preset = activeSettings.qualityPreset || 'Balanced'; // 'Light' | 'Balanced' | 'Selective'

  if (mode === 'MANUAL') {
    if (preset === 'Light') return 50;
    if (preset === 'Selective') return 75;
    return 60;
  }

  // AUTO / HYBRID: Regime-aware bounded threshold
  const regime = regimeInfo?.regime || 'Ranging';
  let baseThreshold = 60;
  if (preset === 'Light') baseThreshold = 50;
  if (preset === 'Selective') baseThreshold = 75;

  if (regime.includes('Strong Trend')) {
    return Math.max(45, baseThreshold - 5); // Slightly more permissive during strong momentum
  }
  if (regime.includes('High Volatility') || regime === 'Ranging') {
    return Math.min(75, baseThreshold + 5); // Stricter in chop or high volatility
  }

  return baseThreshold;
}

/**
 * Evaluates trade decision for each candidate in accordance with the 6-priority hierarchy.
 */
export function evaluateTradeDecision(candidate, threshold, activeSettings = {}) {
  const { direction, unifiedScore = 0, conflictType, conflictResolution, evidence } = candidate;

  // Priority 1: Data Integrity
  if (!candidate.price || candidate.price <= 0 || (candidate.time !== undefined && (candidate.time === null || isNaN(candidate.time) || candidate.time <= 0))) {
    return {
      decision: DECISION_STATUS.REJECTED,
      isApproved: false,
      reasonCode: 'REJECT_DATA_INTEGRITY',
      explanation: 'Rejected: Missing or malformed price/timestamp data.',
    };
  }

  // Priority 2: Setup Validity
  const isCandidateOnly = candidate.type?.toLowerCase().includes('candidate');
  if (isCandidateOnly) {
    return {
      decision: direction === 'BUY' ? DECISION_STATUS.WATCH : DECISION_STATUS.WATCH,
      isApproved: false,
      reasonCode: 'WATCH_PENDING_CONFIRMATION',
      explanation: `Watch: ${direction} setup developing; awaiting final MSS / close confirmation.`,
    };
  }

  // Priority 3: Risk & Execution Feasibility
  const rr = candidate.riskReward || 0;
  if (rr > 0 && rr < 1.1) {
    return {
      decision: DECISION_STATUS.REJECTED,
      isApproved: false,
      reasonCode: 'REJECT_INADEQUATE_RR',
      explanation: `Rejected: Risk-to-reward ratio (${rr.toFixed(1)}:1) is below minimal threshold (1.1:1).`,
    };
  }

  // Priority 4: Conflict Resolution
  if (conflictType === CONFLICT_TYPES.SAME_SETUP_OPPOSITE && conflictResolution === 'WAIT_AMBIGUOUS_CONTRADICTION') {
    return {
      decision: DECISION_STATUS.WAIT,
      isApproved: false,
      reasonCode: 'WAIT_AMBIGUOUS_CONFLICT',
      explanation: `Wait: Opposing ${direction} and counter-direction setups active at same price zone with equal weight.`,
    };
  }

  if (conflictResolution === 'SUBORDINATED_TO_COUNTER') {
    return {
      decision: DECISION_STATUS.REJECTED,
      isApproved: false,
      reasonCode: 'REJECT_SUBORDINATED_CONFLICT',
      explanation: `Rejected: Subordinated to higher-confidence counter-trend setup at the same level.`,
    };
  }

  // Priority 5: Quality Score Ranking vs Threshold
  const meetsThreshold = unifiedScore >= threshold;

  if (!meetsThreshold) {
    if (unifiedScore >= 50) {
      return {
        decision: direction === 'BUY' ? 'WATCH BUY' : 'WATCH SELL',
        isApproved: false,
        reasonCode: 'WATCH_SCORE_MODERATE',
        explanation: `Watch: Setup score (${unifiedScore.toFixed(1)}/100) is eligible for observation but below approval threshold (${threshold}).`,
      };
    }
    return {
      decision: DECISION_STATUS.REJECTED,
      isApproved: false,
      reasonCode: 'REJECT_SCORE_BELOW_THRESHOLD',
      explanation: `Rejected: Quality score (${unifiedScore.toFixed(1)}/100) is below minimum threshold (${threshold}).`,
    };
  }

  // Priority 6: APPROVED DECISION
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
