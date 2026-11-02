/**
 * Adaptive Diagnostics & Signal Settings Snapshot Logger
 * Attaches decision-time market regime snapshots to every approved signal for complete explainability.
 */

export function createAdaptiveSnapshot(regimeInfo = {}, effectiveSettings = {}, mode = 'AUTO') {
  return {
    decisionTimestamp: Date.now(),
    directionalRegime: regimeInfo?.directionalRegime || 'Ranging',
    volatilityRegime: regimeInfo?.volatilityRegime || 'Normal',
    transitionState: regimeInfo?.transitionState || 'Stable Trend',
    trendStrength: regimeInfo?.trendStrength || 50,
    mode: mode || effectiveSettings?.mode || 'AUTO',
    tradingStyle: effectiveSettings?.tradingStyle || 'Intraday',
    confluenceScoreThreshold: effectiveSettings?.confluenceScoreThreshold,
    minimumDisplacementAtr: effectiveSettings?.minimumDisplacementAtr,
  };
}

export function recordAdaptiveDiagnostics(signal, snapshot, notes = []) {
  if (!signal) return null;
  return {
    ...signal,
    adaptiveSnapshot: snapshot,
    notes: Array.isArray(notes) ? notes.join(' | ') : (notes || signal.notes || ''),
  };
}

export function attachAdaptiveSnapshot(signal, regimeInfo, effectiveSettings) {
  if (!signal) return null;

  const snapshot = createAdaptiveSnapshot(regimeInfo, effectiveSettings, effectiveSettings?.effectiveMode || 'AUTO');

  return {
    ...signal,
    adaptiveSnapshot: snapshot,
    reasons: [
      ...(signal.reasons || []),
      `Regime: ${snapshot.directionalRegime} (${snapshot.volatilityRegime} Vol)`,
    ],
  };
}
