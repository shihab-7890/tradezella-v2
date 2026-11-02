/**
 * Phase 6 — Large-Move Target & Multi-Session Risk Engine
 * Structural SL placement, multi-target TP1/TP2/TP3, XAUUSD pip conversion & holding horizon planning.
 */

export function calculateLargeMoveTargets(signal, options = {}) {
  if (!signal || !signal.entryPrice) return signal;

  const isBuy = signal.direction === 'BUY';
  const entry = signal.entryPrice;
  const symbol = options.symbol || 'XAU/USD';
  const isGold = symbol.includes('XAU');
  const decimals = isGold ? 2 : 5;

  let sl = signal.invalidationLevel;
  const defaultSlDistance = isGold ? 8.0 : 0.0060; // Structural stop buffer

  if (isBuy) {
    if (!sl || sl >= entry) sl = entry - defaultSlDistance;
  } else {
    if (!sl || sl <= entry) sl = entry + defaultSlDistance;
  }

  const riskDistance = Math.abs(entry - sl);
  const targetRr1 = 1.5;
  const targetRr2 = 2.5;
  const targetRr3 = 4.0;

  const tp1 = isBuy ? entry + riskDistance * targetRr1 : entry - riskDistance * targetRr1;
  const tp2 = isBuy ? entry + riskDistance * targetRr2 : entry - riskDistance * targetRr2;
  const tp3 = isBuy ? entry + riskDistance * targetRr3 : entry - riskDistance * targetRr3;

  const targetPips = Math.round((Math.abs(tp2 - entry) / (isGold ? 0.1 : 0.0001)));

  return {
    ...signal,
    sl: Math.round(sl * Math.pow(10, decimals)) / Math.pow(10, decimals),
    tp: Math.round(tp2 * Math.pow(10, decimals)) / Math.pow(10, decimals),
    tp1: Math.round(tp1 * Math.pow(10, decimals)) / Math.pow(10, decimals),
    tp2: Math.round(tp2 * Math.pow(10, decimals)) / Math.pow(10, decimals),
    tp3: Math.round(tp3 * Math.pow(10, decimals)) / Math.pow(10, decimals),
    riskDistance: Math.round(riskDistance * Math.pow(10, decimals)) / Math.pow(10, decimals),
    targetPips,
    rewardRiskRatio: Math.round(targetRr2 * 10) / 10,
    expectedHoldingHorizon: '1 - 3 Sessions (Intraday/Swing)',
  };
}
