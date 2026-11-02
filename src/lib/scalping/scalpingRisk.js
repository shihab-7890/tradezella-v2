/**
 * Phase 5 — Scalping Stop-Loss & Multi-Target Take-Profit Engine
 * Structural SL placement, TP1/TP2/TP3 multi-target planning & symbol precision/tick size handling.
 */

export function calculateScalpingRiskManagement(signal, options = {}) {
  if (!signal || !signal.entryPrice) return signal;

  const isBuy = signal.direction === 'BUY';
  const entry = signal.entryPrice;
  const targetRr = options.defaultRiskRewardRatio || 1.5;
  const symbol = options.symbol || 'XAU/USD';

  // Tick size precision
  const isGold = symbol.includes('XAU');
  const tickSize = isGold ? 0.01 : 0.00001;
  const decimals = isGold ? 2 : 5;

  let sl = signal.invalidationLevel;

  // Enforce valid SL direction
  if (isBuy) {
    if (!sl || sl >= entry) {
      sl = entry - (isGold ? 2.5 : 0.0015);
    }
  } else {
    if (!sl || sl <= entry) {
      sl = entry + (isGold ? 2.5 : 0.0015);
    }
  }

  const riskDistance = Math.abs(entry - sl);
  const rewardDistance1 = riskDistance * 1.0;
  const rewardDistance2 = riskDistance * targetRr;
  const rewardDistance3 = riskDistance * (targetRr * 1.5);

  const tp1 = isBuy ? entry + rewardDistance1 : entry - rewardDistance1;
  const tp2 = isBuy ? entry + rewardDistance2 : entry - rewardDistance2;
  const tp3 = isBuy ? entry + rewardDistance3 : entry - rewardDistance3;

  return {
    ...signal,
    sl: Math.round(sl * Math.pow(10, decimals)) / Math.pow(10, decimals),
    tp: Math.round(tp2 * Math.pow(10, decimals)) / Math.pow(10, decimals),
    tp1: Math.round(tp1 * Math.pow(10, decimals)) / Math.pow(10, decimals),
    tp2: Math.round(tp2 * Math.pow(10, decimals)) / Math.pow(10, decimals),
    tp3: Math.round(tp3 * Math.pow(10, decimals)) / Math.pow(10, decimals),
    riskDistance: Math.round(riskDistance * Math.pow(10, decimals)) / Math.pow(10, decimals),
    rewardRiskRatio: Math.round((rewardDistance2 / (riskDistance || 0.0001)) * 10) / 10,
  };
}
