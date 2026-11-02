/**
 * Phase 7 — Unified Signal Scoring, Multi-Strategy Conflict Resolution & Intelligent Trade Decision Engine
 * Main orchestrator module integrating all Phase 1-6 strategies into one coordinated decision layer.
 */

import { normalizeToCandidates } from './evidenceNormalizer.js';
import { scoreCandidate } from './confluenceScoring.js';
import { aggregateSetupEvidence } from './setupDeduplication.js';
import { resolveSignalConflicts } from './conflictResolver.js';
import { getAdaptiveScoreThreshold, evaluateTradeDecision } from './tradeDecision.js';
import { trackSignalLifecycle } from './signalLifecycle.js';
import { UnifiedDiagnosticsCollector } from './signalDiagnostics.js';
import { TRADING_STYLES, DECISION_STATUS } from './types.js';

export function runUnifiedSignalEngine({
  candles,
  potentialSignals = [],
  activeSettings = {},
  config = {},
  htfSync = null,
  candleTimeIndex,
  regimeInfo = null,
}) {
  const symbol = config?.symbol || 'XAU/USD';
  const timeframe = config?.timeframe || '15m';

  const diagnostics = new UnifiedDiagnosticsCollector(symbol, timeframe);
  diagnostics.recordRawCandidates(potentialSignals.length);

  // 1. Normalize all incoming strategy events into standard candidate models
  const rawCandidates = normalizeToCandidates(
    potentialSignals,
    candles,
    candleTimeIndex,
    htfSync,
    activeSettings,
    config,
    regimeInfo
  );

  // 2. Aggregate related strategy detections into distinct physical setups (deduplication)
  const { aggregatedSetups, duplicatesSuppressed } = aggregateSetupEvidence(
    rawCandidates,
    candleTimeIndex,
    {
      timeToleranceCandles: activeSettings.duplicateWindowCandles || 4,
      priceTolerancePct: activeSettings.keyLevelProximity || 0.003,
      minCandlesBetweenSignals: activeSettings.minCandlesBetweenSignals !== undefined ? activeSettings.minCandlesBetweenSignals : 5,
    }
  );
  diagnostics.recordDuplicatesSuppressed(duplicatesSuppressed);

  // 3. Score each aggregated setup with strategy-specific quality profiles & anti-double-counting
  const scoredSetups = aggregatedSetups.map(setup => {
    const scoreResult = scoreCandidate(setup, activeSettings);
    return {
      ...setup,
      unifiedScore: scoreResult.unifiedScore,
      score: scoreResult.score,
      qualityTier: scoreResult.qualityTier,
      scoreBreakdown: scoreResult.breakdown,
      reasons: scoreResult.reasons,
    };
  });

  // 4. Resolve multi-strategy BUY/SELL conflicts
  const { resolvedSetups, conflictsDetected } = resolveSignalConflicts(
    scoredSetups,
    candleTimeIndex,
    {
      conflictTimeTolerance: 4,
      conflictPriceTolerance: 0.005,
    }
  );

  // 5. Determine adaptive score threshold
  const effectiveThreshold = getAdaptiveScoreThreshold(activeSettings, regimeInfo);

  // 6. Evaluate final trade decision & execution lifecycle
  const evaluatedSetups = [];

  for (const setup of resolvedSetups) {
    const decisionResult = evaluateTradeDecision(setup, effectiveThreshold, activeSettings);
    const signalIndex = candleTimeIndex.get(setup.time);

    const setupWithDecision = {
      ...setup,
      decision: decisionResult.decision,
      isApproved: decisionResult.isApproved,
      reasonCode: decisionResult.reasonCode,
      explanation: decisionResult.explanation,
      status: decisionResult.isApproved ? DECISION_STATUS.APPROVED : (decisionResult.decision === 'WAIT' ? DECISION_STATUS.WAIT : DECISION_STATUS.REJECTED),
    };

    // Track execution lifecycle & realistic trade accounting on subsequent candles
    const completedSetup = trackSignalLifecycle(setupWithDecision, candles, signalIndex, activeSettings);

    diagnostics.recordSetup(completedSetup);
    evaluatedSetups.push(completedSetup);
  }

  // 7. Opportunity Ranking & Prioritization
  const approvedSetups = evaluatedSetups.filter(s => s.isApproved);
  const watchSetups = evaluatedSetups.filter(s => s.decision?.includes('WATCH'));

  // Rank by: Score descending, R:R descending, Freshness
  const ranker = (a, b) => {
    if (b.unifiedScore !== a.unifiedScore) return b.unifiedScore - a.unifiedScore;
    if ((b.riskReward || 0) !== (a.riskReward || 0)) return (b.riskReward || 0) - (a.riskReward || 0);
    return b.time - a.time;
  };

  const rankedApproved = [...approvedSetups].sort(ranker);
  const rankedWatch = [...watchSetups].sort(ranker);

  const bestBuy = rankedApproved.find(s => s.direction === 'BUY') || rankedWatch.find(s => s.direction === 'BUY') || null;
  const bestSell = rankedApproved.find(s => s.direction === 'SELL') || rankedWatch.find(s => s.direction === 'SELL') || null;

  const bestScalp = rankedApproved.find(s => s.tradingStyle === TRADING_STYLES.SCALPING) || null;
  const bestIntraday = rankedApproved.find(s => s.tradingStyle === TRADING_STYLES.INTRADAY) || null;
  const bestSwing = rankedApproved.find(s => s.tradingStyle === TRADING_STYLES.SWING) || null;

  if (htfSync) {
    try {
      const htfSummary = htfSync.getFullSeriesSummary();
      if (htfSummary?.htfTrendBreakdown) {
        diagnostics.setHtfTrendBreakdown(htfSummary.htfTrendBreakdown);
      }
    } catch {}
  }

  // 8. Format final trade log compatible with existing chart markers and UI components
  const finalTradeLog = evaluatedSetups
    .map(setup => ({
      ...setup,
      id: setup.candidateId || setup.id,
      time: setup.time,
      price: setup.price,
      direction: setup.direction,
      type: setup.isApproved ? `${setup.direction} confirmed` : setup.type,
      notes: `${setup.decision}: ${setup.notes} [${setup.qualityTier} ${setup.unifiedScore}/100]`,
      score: setup.score,
      unifiedScore: setup.unifiedScore,
      qualityTier: setup.qualityTier,
      isApproved: setup.isApproved,
      reasons: setup.reasons,
      sl: setup.sl,
      tp: setup.tp,
      riskReward: setup.riskReward,
      tradingStyle: setup.tradingStyle,
      strategy: setup.strategy,
      confirmations: setup.confirmations,
      conflictType: setup.conflictType,
      conflictWarning: setup.conflictWarning,
      explanation: setup.explanation,
    }))
    .sort((a, b) => a.time - b.time);

  return {
    tradeLog: finalTradeLog,
    diagnostics: diagnostics.getSummary(),
    rankedOpportunities: {
      bestBuy,
      bestSell,
      bestScalp,
      bestIntraday,
      bestSwing,
      rankedApproved,
      watchlist: rankedWatch,
    },
    conflictsDetected,
    effectiveThreshold,
  };
}
