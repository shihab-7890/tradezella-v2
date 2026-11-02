import { TradingSignal, HtfTrendState, HtfKeyLevel, SignalQualityTier } from './types';

export interface ScoreResult {
  score: number;
  qualityTier: SignalQualityTier;
  reasons: string[];
}

export const STRATEGY_BASE_SCORE: Record<string, number> = {
  sweepObFvgConfluence: 3.0,
  powerOfThree: 3.0,
  qualifiedSweep: 2.8,
  obMss: 2.8,
  continuationObMss: 2.5,
  momentumSpike: 2.5,
  classicBreakout: 2.5,
  fvgImbalance: 2.5,
  breakerBlock: 2.5,
  mitigationBlock: 2.5,
  liquidityVoid: 2.5,
  institutionalRange: 2.5,
  asianRange: 2.2,
  londonBreakout: 2.5,
  londonKillZone: 2.2,
  newYorkKillZone: 2.2,
  liquiditySweep: 2.2,
  // Phase 2 Waterfall & Candle Psychology Strategies
  waterfallEarly: 3.0,
  waterfallFirstPullback: 3.2,
  waterfallBreakout: 2.8,
  waterfallRetest: 2.8,
  waterfallShallow: 2.6,
  candlePsychologyReversal: 3.2,
  candlePsychologyEngulfing: 3.0,
  candlePsychologyRejection: 2.8,
  candlePsychologyExpansion: 3.0,
  candlePsychologyCompression: 2.2,
  // Phase 3 — Advanced SMC Strategies
  smcSweepMss: 3.5,
  smcObFvg: 3.5,
  smcChochRetest: 3.2,
  smcBosContinuation: 3.0,
  smcPremDiscOb: 3.2,
  smcFibConfluence: 3.0,
  smcBreakerRetest: 3.0,
  smcSweepSfp: 3.2,
  smcWaterfallSmc: 3.5,
};

/**
 * Calculates fair, bidirectional confluence score for a candidate signal.
 * Avoids one-direction bias by permitting high-probability counter-trend reversals
 * at key structural levels rather than blindly penalizing opposite-direction setups.
 */
export function scoreSignal(
  signal: Partial<TradingSignal>,
  htfTrend: HtfTrendState,
  htfKeyLevels: HtfKeyLevel[],
  settings: any
): ScoreResult {
  const strategy = signal.strategy || 'general';
  let score = STRATEGY_BASE_SCORE[strategy] || 2.2;
  const reasons: string[] = [`Base (${strategy})`];

  const isBuy = signal.type?.includes('BUY') || signal.direction === 'BUY';
  const isSell = signal.type?.includes('SELL') || signal.direction === 'SELL';

  // 1. HTF Trend Confluence
  if (htfTrend.direction === 'BULLISH') {
    if (isBuy) {
      score += 1.5;
      reasons.push('HTF Trend (Bullish)');
    }
  } else if (htfTrend.direction === 'BEARISH') {
    if (isSell) {
      score += 1.5;
      reasons.push('HTF Trend (Bearish)');
    }
  } else {
    // Ranging market
    score += 0.5;
    reasons.push('Neutral Trend');
  }

  // 2. HTF Key Level Confluence (Support for BUY, Resistance for SELL)
  const proximityThreshold = settings?.keyLevelProximity || 0.004;
  const signalPrice = signal.price || 0;

  let isAtKeyLevel = false;
  if (signalPrice > 0 && htfKeyLevels.length > 0) {
    for (const level of htfKeyLevels) {
      const distPct = Math.abs(signalPrice - level.price) / level.price;
      if (distPct < proximityThreshold) {
        if (isBuy && level.type === 'support') {
          isAtKeyLevel = true;
          break;
        } else if (isSell && level.type === 'resistance') {
          isAtKeyLevel = true;
          break;
        }
      }
    }
  }

  if (isAtKeyLevel) {
    score += 1.0;
    reasons.push('HTF Key Level');

    // Counter-trend reversal bonus: If taking a counter-trend setup at a confirmed major HTF level,
    // award an additional +0.5 for valid structural exhaustion / reversal.
    const isCounterTrend =
      (isBuy && htfTrend.direction === 'BEARISH') ||
      (isSell && htfTrend.direction === 'BULLISH');
    if (isCounterTrend) {
      score += 0.5;
      reasons.push('Counter-HTF Key Reversal');
    }
  }

  // 3. FVG / Imbalance Confluence
  const notes = signal.notes || '';
  if (notes.includes('FVG') || notes.includes('ILV') || notes.includes('Void')) {
    score += 0.5;
    reasons.push('FVG Confluence');
  }

  // 4. Order Block / Breaker / Mitigation Confluence
  if (notes.includes('OB') || notes.includes('Breaker') || notes.includes('Mitigation') || notes.includes('COB')) {
    score += 0.5;
    reasons.push('Block Confluence');
  }

  // 5. Structure confirmation (MSS or Qualified Sweep)
  if (notes.includes('MSS') || notes.includes('Qualified') || signal.mssIndex !== undefined) {
    score += 0.5;
    reasons.push('MSS Break');
  }

  // Bound score between 0 and 10
  score = Math.min(10, Math.max(0, Math.round(score * 10) / 10));

  let qualityTier: SignalQualityTier = 'Candidate';
  if (score >= 5.0) qualityTier = 'A+';
  else if (score >= 4.0) qualityTier = 'A';
  else if (score >= 3.0) qualityTier = 'B';

  return {
    score,
    qualityTier,
    reasons,
  };
}
