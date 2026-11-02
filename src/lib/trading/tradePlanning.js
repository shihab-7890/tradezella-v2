/**
 * Phase 6 — Multi-Style Trade Planning & Isolation Engine
 * Prevents cross-style pollution between Scalping, Intraday, and Swing signals.
 */

export function consolidateMultiStyleTradeLog(scalpSignals = [], intradaySignals = [], swingSignals = []) {
  const annotatedScalp = scalpSignals.map(s => ({ ...s, tradingStyle: s.tradingStyle || 'Scalping' }));
  const annotatedIntraday = intradaySignals.map(s => ({ ...s, tradingStyle: s.tradingStyle || 'Intraday' }));
  const annotatedSwing = swingSignals.map(s => ({ ...s, tradingStyle: s.tradingStyle || 'Swing' }));

  return [...annotatedScalp, ...annotatedIntraday, ...annotatedSwing].sort((a, b) => b.time - a.time);
}
