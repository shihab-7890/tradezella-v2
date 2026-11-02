/**
 * Phase 6 — Master Intraday Engine Orchestrator
 * Session structure, intraday strategy candidates, risk management & intraday lifecycle integration.
 */

import { detectIntradaySetups } from './intradayStrategies';
import { calculateScalpingRiskManagement } from '../scalping/scalpingRisk';
import { filterAndDeduplicateScalpSignals } from '../scalping/scalpingSignals';

export function runIntradayEngine(candles, options = {}, regimeInfo = null) {
  if (!candles || candles.length < 5) {
    return { intradaySignals: [], diagnostics: { totalEvaluated: 0, approvedCount: 0 } };
  }

  const rawCandidates = detectIntradaySetups(candles, options);

  const evaluated = rawCandidates.map(candidate => {
    const isBuy = candidate.direction === 'BUY';
    const entryPrice = candidate.price;
    const isGold = (options.symbol || 'XAU/USD').includes('XAU');
    const slDistance = isGold ? 4.0 : 0.0030;

    let sl = candidate.invalidationLevel;
    if (isBuy && (!sl || sl >= entryPrice)) sl = entryPrice - slDistance;
    if (!isBuy && (!sl || sl <= entryPrice)) sl = entryPrice + slDistance;

    const riskSignal = calculateScalpingRiskManagement({
      ...candidate,
      entryPrice,
      invalidationLevel: sl,
      tradingStyle: 'Intraday',
    }, { ...options, defaultRiskRewardRatio: options.defaultRiskRewardRatio || 2.0 });

    return {
      ...riskSignal,
      tradingStyle: 'Intraday',
      isApproved: true,
      grade: riskSignal.rewardRiskRatio >= 2.0 ? 'A+' : 'A',
    };
  });

  const finalSignals = filterAndDeduplicateScalpSignals(evaluated, { minCandlesBetweenSignals: options.minCandlesBetweenSignals || 5 });

  return {
    intradaySignals: finalSignals,
    diagnostics: {
      totalEvaluated: evaluated.length,
      approvedCount: finalSignals.filter(s => s.isApproved).length,
    },
  };
}
