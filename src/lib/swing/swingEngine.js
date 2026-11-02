/**
 * Phase 6 — Master Swing Trading Engine Orchestrator
 * HTF structure, deep Fibonacci pullbacks, large-move targets & swing signal lifecycle management.
 */

import { detectSwingSetups } from './swingStrategies';
import { calculateLargeMoveTargets } from './largeMoveTargets';
import { filterAndDeduplicateScalpSignals } from '../scalping/scalpingSignals';

export function runSwingEngine(candles, options = {}, regimeInfo = null) {
  if (!candles || candles.length < 10) {
    return { swingSignals: [], diagnostics: { totalEvaluated: 0, approvedCount: 0 } };
  }

  const rawCandidates = detectSwingSetups(candles, options);

  const evaluated = rawCandidates.map(candidate => {
    const riskSignal = calculateLargeMoveTargets({
      ...candidate,
      entryPrice: candidate.price,
      tradingStyle: 'Swing',
    }, options);

    return {
      ...riskSignal,
      tradingStyle: 'Swing',
      isApproved: true,
      grade: 'A+',
    };
  });

  const finalSignals = filterAndDeduplicateScalpSignals(evaluated, { minCandlesBetweenSignals: options.minCandlesBetweenSignals || 8 });

  return {
    swingSignals: finalSignals,
    diagnostics: {
      totalEvaluated: evaluated.length,
      approvedCount: finalSignals.filter(s => s.isApproved).length,
    },
  };
}
