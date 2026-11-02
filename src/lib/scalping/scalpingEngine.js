/**
 * Phase 5 — Scalping Engine Master Orchestrator
 * Unites microstructure, strategies, precision entry timing, risk management, lifecycle deduplication & diagnostics.
 */

import { detectScalpingStrategySetups } from './scalpingStrategies';
import { calculatePrecisionEntry } from './precisionEntry';
import { calculateScalpingRiskManagement } from './scalpingRisk';
import { filterAndDeduplicateScalpSignals } from './scalpingSignals';
import { gradeScalpSignal, buildScalpDiagnosticSummary } from './scalpingDiagnostics';

export function runScalpingEngine(candles, options = {}, regimeInfo = null) {
  if (!candles || candles.length < 3) {
    return { scalpingSignals: [], diagnostics: buildScalpDiagnosticSummary([]) };
  }

  // 1. Detect Strategy Setup Candidates
  const candidates = detectScalpingStrategySetups(candles, options);

  // 2. Precision Entry, Risk & Diagnostic Grading
  const evaluatedSignals = candidates.map(candidate => {
    const candleIndex = candles.findIndex(c => c.time === candidate.time);
    const candle = candleIndex !== -1 ? candles[candleIndex] : candles[candles.length - 1];

    const withEntry = calculatePrecisionEntry(candidate, candle, options);
    const withRisk = calculateScalpingRiskManagement(withEntry, options);
    const withGrade = gradeScalpSignal(withRisk, options);

    return withGrade;
  });

  // 3. Deduplication & Signal Spacing
  const finalSignals = filterAndDeduplicateScalpSignals(evaluatedSignals, options);
  const diagnostics = buildScalpDiagnosticSummary(finalSignals);

  return {
    scalpingSignals: finalSignals,
    diagnostics,
  };
}
