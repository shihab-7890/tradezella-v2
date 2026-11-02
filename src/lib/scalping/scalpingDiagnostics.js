/**
 * Phase 5 — Scalping Diagnostics & Grade Ranking Engine
 * Grade evaluation (A+, A, B, Rejected) & spread/execution feasibility verification.
 */

export function gradeScalpSignal(signal, options = {}) {
  if (!signal) return null;

  const score = signal.score || 4.0;
  const rr = signal.rewardRiskRatio || 1.5;
  const spread = options.assumedSpread || 0.0002;
  const risk = signal.riskDistance || 0.001;

  // Feasibility check: spread cost must not exceed 25% of risk distance
  const spreadRatio = spread / (risk || 0.001);
  if (spreadRatio > 0.25 && options.enableSpreadFilter) {
    return {
      ...signal,
      grade: 'Rejected',
      isFeasible: false,
      rejectionReason: `Spread (${spread}) exceeds 25% of stop distance (${risk})`,
    };
  }

  let grade = 'B';
  if (score >= 4.5 && rr >= 1.5) grade = 'A+';
  else if (score >= 4.0 && rr >= 1.2) grade = 'A';

  return {
    ...signal,
    grade,
    isFeasible: true,
  };
}

export function buildScalpDiagnosticSummary(signals = []) {
  const approved = signals.filter(s => s.isApproved && s.isFeasible !== false);
  const buyCount = approved.filter(s => s.direction === 'BUY').length;
  const sellCount = approved.filter(s => s.direction === 'SELL').length;
  const gradeAPlus = approved.filter(s => s.grade === 'A+').length;
  const gradeA = approved.filter(s => s.grade === 'A').length;

  return {
    totalEvaluated: signals.length,
    approvedCount: approved.length,
    buyCount,
    sellCount,
    gradeAPlus,
    gradeA,
    rejectionCount: signals.length - approved.length,
  };
}
