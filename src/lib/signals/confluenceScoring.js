/**
 * Phase 7 — Unified Signal Scoring & Strategy-Specific Quality Profiles
 * Implements an explainable 0–100 quality scale with anti-double-counting guards.
 */

import { QUALITY_GRADES, STRATEGY_FAMILIES } from './types.js';

export const STRATEGY_WEIGHTS = {
  [STRATEGY_FAMILIES.WATERFALL]: {
    marketStructure: 0.8,
    liquidity: 0.7,
    candlePsychology: 1.4, // Waterfall prioritizes displacement and momentum
    zoneConfluence: 0.9,
    multiTimeframe: 1.2,
    marketRegime: 1.1,
    riskSuitability: 1.0,
  },
  [STRATEGY_FAMILIES.LIQUIDITY]: {
    marketStructure: 1.1,
    liquidity: 1.5, // Sweep reversals prioritize liquidity pool & reclaim
    candlePsychology: 1.2, // Rejection wicks
    zoneConfluence: 0.9,
    multiTimeframe: 1.0,
    marketRegime: 1.0,
    riskSuitability: 1.0,
  },
  [STRATEGY_FAMILIES.SMC]: {
    marketStructure: 1.3, // Order blocks & BOS prioritize structure
    liquidity: 1.1,
    candlePsychology: 1.0,
    zoneConfluence: 1.4, // OB, FVG, OTE
    multiTimeframe: 1.2,
    marketRegime: 1.0,
    riskSuitability: 1.0,
  },
  [STRATEGY_FAMILIES.BREAKOUT]: {
    marketStructure: 1.2,
    liquidity: 0.9,
    candlePsychology: 1.3, // Displacement breakout
    zoneConfluence: 0.8,
    multiTimeframe: 1.1,
    marketRegime: 1.2,
    riskSuitability: 1.0,
  },
  [STRATEGY_FAMILIES.SWING]: {
    marketStructure: 1.4, // Swing prioritizes macro structure
    liquidity: 1.2,
    candlePsychology: 0.8,
    zoneConfluence: 1.3,
    multiTimeframe: 1.5, // Crucial HTF trend alignment
    marketRegime: 1.2,
    riskSuitability: 1.1,
  },
  [STRATEGY_FAMILIES.SCALP]: {
    marketStructure: 1.0,
    liquidity: 1.2,
    candlePsychology: 1.4, // Microstructure and fast wicks
    zoneConfluence: 0.9,
    multiTimeframe: 0.9,
    marketRegime: 1.1,
    riskSuitability: 1.2, // Precision stops
  },
  [STRATEGY_FAMILIES.GENERAL]: {
    marketStructure: 1.0,
    liquidity: 1.0,
    candlePsychology: 1.0,
    zoneConfluence: 1.0,
    multiTimeframe: 1.0,
    marketRegime: 1.0,
    riskSuitability: 1.0,
  },
};

export const STRATEGY_BASE_POINTS = {
  sweepObFvgConfluence: 30,
  powerOfThree: 30,
  smcSweepMss: 32,
  smcObFvg: 32,
  smcChochRetest: 30,
  smcWaterfallSmc: 32,
  waterfallFirstPullback: 30,
  waterfallEarly: 28,
  waterfallBreakout: 28,
  candlePsychologyReversal: 30,
  candlePsychologyEngulfing: 28,
  obMss: 28,
  continuationObMss: 26,
  momentumSpike: 25,
  classicBreakout: 25,
  fvgImbalance: 25,
  asianRange: 22,
  londonBreakout: 25,
  liquiditySweep: 24,
  [STRATEGY_FAMILIES.WATERFALL]: 28,
  [STRATEGY_FAMILIES.SMC]: 28,
  [STRATEGY_FAMILIES.LIQUIDITY]: 26,
  [STRATEGY_FAMILIES.BREAKOUT]: 25,
  [STRATEGY_FAMILIES.SWING]: 28,
  [STRATEGY_FAMILIES.SCALP]: 25,
  [STRATEGY_FAMILIES.MOMENTUM]: 25,
  [STRATEGY_FAMILIES.GENERAL]: 22,
};

/**
 * Calculates unified 0–100 quality score for a standardized candidate.
 */
export function scoreCandidate(candidate, activeSettings = {}) {
  const { evidence = {}, strategyFamily = 'general', confirmations = [] } = candidate;
  const weights = STRATEGY_WEIGHTS[strategyFamily] || STRATEGY_WEIGHTS[STRATEGY_FAMILIES.GENERAL];
  const breakdown = {};
  const reasons = [];

  // Base strategy points
  let basePoints = 0;
  if (candidate.score && candidate.score > 0) {
    basePoints = candidate.score > 10 ? candidate.score : candidate.score * 7.5;
  } else if (candidate.strategy && STRATEGY_BASE_POINTS[candidate.strategy]) {
    basePoints = STRATEGY_BASE_POINTS[candidate.strategy];
  } else {
    basePoints = STRATEGY_BASE_POINTS[strategyFamily] || 20;
  }
  breakdown.basePoints = Math.round(basePoints * 10) / 10;

  // ==========================================
  // Category A: Market Structure (Base Max: 20 pts)
  // Anti-Double-Counting: BOS + MSS + CHoCH from same move are capped at 20 pts
  // ==========================================
  let msPoints = 0;
  if (evidence?.marketStructure?.hasBos) {
    msPoints += 10;
    reasons.push('BOS Verified (+10)');
  }
  if (evidence?.marketStructure?.hasMss) {
    msPoints += 8;
    reasons.push('MSS/CHoCH Shift (+8)');
  }
  if (evidence?.marketStructure?.hasChoch && !evidence?.marketStructure?.hasMss) {
    msPoints += 6;
    reasons.push('CHoCH Detected (+6)');
  }
  if (evidence?.marketStructure?.isFresh) {
    msPoints += 2;
  }
  const rawMs = Math.min(20, msPoints);
  breakdown.marketStructure = Math.round(rawMs * weights.marketStructure * 10) / 10;

  // ==========================================
  // Category B: Liquidity (Base Max: 20 pts)
  // ==========================================
  let liqPoints = 0;
  if (evidence?.liquidity?.sweepDetected) {
    liqPoints += 12;
    reasons.push('Liquidity Sweep Confirmed (+12)');
  }
  if (evidence?.liquidity?.reclaimConfirmed) {
    liqPoints += 6;
    reasons.push('Level Reclaim (+6)');
  }
  if (evidence?.liquidity?.poolSignificance === 'high') {
    liqPoints += 2;
  }
  const rawLiq = Math.min(20, liqPoints);
  breakdown.liquidity = Math.round(rawLiq * weights.liquidity * 10) / 10;

  // ==========================================
  // Category C: Candle Psychology (Base Max: 15 pts)
  // ==========================================
  let cpPoints = 0;
  const disp = evidence?.candlePsychology?.displacementQuality !== undefined ? evidence.candlePsychology.displacementQuality : 0.5;
  cpPoints += Math.round(disp * 8); // Up to 8 pts for strong displacement
  if (evidence?.candlePsychology?.rejectionWickRatio > 0.3) {
    cpPoints += 5;
    reasons.push(`Rejection Wick (${Math.round(evidence.candlePsychology.rejectionWickRatio * 100)}%) (+5)`);
  }
  if (evidence?.candlePsychology?.momentumFollowThrough) {
    cpPoints += 2;
    reasons.push('Momentum Follow-through (+2)');
  }
  if (evidence?.candlePsychology?.exhaustionDetected) {
    cpPoints = Math.max(0, cpPoints - 4);
    reasons.push('Exhaustion Penalty (-4)');
  }
  const rawCp = Math.min(15, cpPoints);
  breakdown.candlePsychology = Math.round(rawCp * weights.candlePsychology * 10) / 10;

  // ==========================================
  // Category D: Zone Confluence (Base Max: 15 pts)
  // Anti-Double-Counting: OB + FVG + Fib capped at 15
  // ==========================================
  let zcPoints = 0;
  if (evidence?.zoneConfluence?.inOrderBlock) {
    zcPoints += 7;
    reasons.push('Order Block Retest (+7)');
  }
  if (evidence?.zoneConfluence?.inFvg) {
    zcPoints += 5;
    reasons.push('FVG Infill (+5)');
  }
  if (evidence?.zoneConfluence?.atFibLevel) {
    zcPoints += 3;
    reasons.push('OTE Fibonacci Confluence (+3)');
  }
  if (evidence?.zoneConfluence?.inDiscountOrPremium) {
    zcPoints += 2;
  }
  const rawZc = Math.min(15, zcPoints);
  breakdown.zoneConfluence = Math.round(rawZc * weights.zoneConfluence * 10) / 10;

  // ==========================================
  // Category E: Multi-Timeframe Context (Base Max: 15 pts)
  // ==========================================
  let mtfPoints = 0;
  if (evidence?.multiTimeframe?.alignedWithHtf) {
    mtfPoints += 10;
    reasons.push(`HTF ${evidence.multiTimeframe.htfDirection} Aligned (+10)`);
  } else if (evidence?.multiTimeframe?.htfDirection === 'Ranging') {
    mtfPoints += 5;
    reasons.push('HTF Neutral Range (+5)');
  } else {
    // Counter-trend scalp or reversal
    if (evidence?.multiTimeframe?.atKeyLevel) {
      mtfPoints += 4;
      reasons.push('Counter-trend at HTF Key Level (+4)');
    }
  }
  if (evidence?.multiTimeframe?.atKeyLevel) {
    mtfPoints += 3;
  }
  const rawMtf = Math.min(15, mtfPoints);
  breakdown.multiTimeframe = Math.round(rawMtf * weights.multiTimeframe * 10) / 10;

  // ==========================================
  // Category F: Market Regime Suitability (Base Max: 10 pts)
  // ==========================================
  const rawRegime = Math.round((evidence?.marketRegime?.suitability || 0.6) * 10);
  breakdown.marketRegime = Math.round(rawRegime * weights.marketRegime * 10) / 10;

  // ==========================================
  // Category G: Risk & Execution Suitability (Base Max: 10 pts)
  // ==========================================
  let riskPoints = 0;
  const rr = candidate.riskReward || 1.5;
  if (rr >= 2.0) {
    riskPoints += 6;
    reasons.push(`Favorable R:R (${rr.toFixed(1)}:1) (+6)`);
  } else if (rr >= 1.5) {
    riskPoints += 4;
    reasons.push(`Acceptable R:R (${rr.toFixed(1)}:1) (+4)`);
  } else {
    riskPoints += 1;
    reasons.push(`Low R:R (${rr.toFixed(1)}:1)`);
  }
  if (evidence?.riskSuitability?.validSl) {
    riskPoints += 4;
  }
  const rawRisk = Math.min(10, riskPoints);
  breakdown.riskSuitability = Math.round(rawRisk * weights.riskSuitability * 10) / 10;

  // Multi-Strategy Confirmation Bonus (Max 5 pts)
  let multiStratBonus = 0;
  if (confirmations.length > 1) {
    multiStratBonus = Math.min(5, (confirmations.length - 1) * 2.5);
    reasons.push(`Multi-Strategy Confluence (${confirmations.length} strategies) (+${multiStratBonus})`);
  }
  breakdown.multiStrategyBonus = multiStratBonus;

  // Total Unified Score (0–100 scale)
  const totalScore = Math.min(
    100,
    Math.max(
      0,
      breakdown.basePoints +
      breakdown.marketStructure +
      breakdown.liquidity +
      breakdown.candlePsychology +
      breakdown.zoneConfluence +
      breakdown.multiTimeframe +
      breakdown.marketRegime +
      breakdown.riskSuitability +
      multiStratBonus
    )
  );

  const roundedTotal = Math.round(totalScore * 10) / 10;

  // Quality Tier mapping (Canonical Scale: A+: 85-100, A: 75-84.9, B: 65-74.9, Watch: 50-64.9, Rejected: < 50)
  let qualityTier = QUALITY_GRADES.REJECTED;
  if (roundedTotal >= 85) qualityTier = QUALITY_GRADES.A_PLUS;
  else if (roundedTotal >= 75) qualityTier = QUALITY_GRADES.A;
  else if (roundedTotal >= 65) qualityTier = QUALITY_GRADES.B;
  else if (roundedTotal >= 50) qualityTier = QUALITY_GRADES.WATCH;

  // Compatible 0–10 score for backward compatibility
  const legacyScore = Math.round((roundedTotal / 10) * 10) / 10;

  return {
    unifiedScore: roundedTotal,
    score: legacyScore,
    qualityTier,
    breakdown,
    reasons,
  };
}
