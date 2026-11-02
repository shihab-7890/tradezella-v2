/**
 * Phase 7 — Standardized Signal Candidate & Evidence Normalizer
 * Transforms heterogeneous strategy detections into uniform candidate models.
 */

import { TRADING_STYLES, STRATEGY_FAMILIES } from './types.js';

export function inferStrategyFamily(strategy = '') {
  const s = strategy.toLowerCase();
  if (s.includes('waterfall')) return STRATEGY_FAMILIES.WATERFALL;
  if (s.includes('smc') || s.includes('choch') || s.includes('bos') || s.includes('fvg') || s.includes('orderblock') || s.includes('obmss')) return STRATEGY_FAMILIES.SMC;
  if (s.includes('candle') || s.includes('rejection') || s.includes('engulfing') || s.includes('exhaustion')) return STRATEGY_FAMILIES.CANDLE_PSYCHOLOGY;
  if (s.includes('sweep') || s.includes('liquidity') || s.includes('bsl') || s.includes('ssl')) return STRATEGY_FAMILIES.LIQUIDITY;
  if (s.includes('breakout') || s.includes('classic')) return STRATEGY_FAMILIES.BREAKOUT;
  if (s.includes('scalp') || s.includes('micro')) return STRATEGY_FAMILIES.SCALP;
  if (s.includes('swing') || s.includes('macro') || s.includes('deeppullback')) return STRATEGY_FAMILIES.SWING;
  if (s.includes('intraday') || s.includes('session')) return STRATEGY_FAMILIES.INTRADAY;
  if (s.includes('spike') || s.includes('momentum')) return STRATEGY_FAMILIES.MOMENTUM;
  return STRATEGY_FAMILIES.GENERAL;
}

export function inferTradingStyle(strategy = '', timeframe = '15m') {
  const s = strategy.toLowerCase();
  if (s.includes('scalp') || timeframe === '1m' || timeframe === '3m' || timeframe === '5m') {
    if (s.includes('swing')) return TRADING_STYLES.SWING;
    if (s.includes('intraday')) return TRADING_STYLES.INTRADAY;
    return TRADING_STYLES.SCALPING;
  }
  if (s.includes('swing') || timeframe === '4h' || timeframe === '1D') {
    return TRADING_STYLES.SWING;
  }
  if (s.includes('intraday') || timeframe === '15m' || timeframe === '30m' || timeframe === '1h') {
    return TRADING_STYLES.INTRADAY;
  }
  return TRADING_STYLES.INTRADAY;
}

export function inferSetupType(strategy = '', notes = '') {
  const text = `${strategy} ${notes}`.toLowerCase();
  if (text.includes('reversal') || text.includes('exhaustion') || text.includes('sfp') || text.includes('sweep')) {
    return 'reversal';
  }
  if (text.includes('breakout')) {
    return 'breakout';
  }
  return 'continuation';
}

export function extractEvidenceFromRawSignal(rawSignal, candles, candleIndex, htfTrend, htfLevels, regimeInfo) {
  const c = candleIndex >= 0 && candleIndex < candles.length ? candles[candleIndex] : null;
  const prevC = candleIndex > 0 ? candles[candleIndex - 1] : null;
  const isBuy = rawSignal.direction === 'BUY';
  const notes = (rawSignal.notes || '').toLowerCase();
  const type = (rawSignal.type || '').toLowerCase();

  const text = `${rawSignal.strategy || ''} ${rawSignal.notes || ''} ${rawSignal.type || ''}`.toLowerCase();

  // 1. Market Structure evidence
  const hasMss = text.includes('mss') || text.includes('choch') || rawSignal.mssIndex !== undefined;
  const hasBos = text.includes('bos') || text.includes('continuation') || text.includes('breakout');
  const hasChoch = text.includes('choch') || text.includes('reversal');

  // 2. Liquidity evidence
  const sweepDetected = text.includes('sweep') || text.includes('sfp') || text.includes('bsl') || text.includes('ssl');
  const reclaimConfirmed = text.includes('reclaim') || text.includes('mss') || (c && (isBuy ? c.close > c.open : c.close < c.open));

  // 3. Candle Psychology evidence
  let displacementQuality = 0.5;
  let rejectionWickRatio = 0;
  let momentumFollowThrough = false;

  if (c) {
    const range = c.high - c.low;
    const body = Math.abs(c.close - c.open);
    if (range > 0) {
      displacementQuality = Math.min(1, body / range);
      if (isBuy) {
        rejectionWickRatio = (Math.min(c.open, c.close) - c.low) / range;
      } else {
        rejectionWickRatio = (c.high - Math.max(c.open, c.close)) / range;
      }
    }
    if (prevC) {
      momentumFollowThrough = isBuy ? (c.close > prevC.high) : (c.close < prevC.low);
    }
  }

  // 4. Zone Confluence evidence
  const inOrderBlock = text.includes('ob') || text.includes('orderblock') || text.includes('block');
  const inFvg = text.includes('fvg') || text.includes('imbalance') || text.includes('void');
  const atFibLevel = text.includes('fib') || text.includes('ote') || text.includes('pullback');
  const inDiscountOrPremium = isBuy ? (text.includes('discount') || text.includes('ssl')) : (text.includes('premium') || text.includes('bsl'));

  // 5. Multi-Timeframe Context
  const alignedWithHtf = htfTrend ? (
    (isBuy && htfTrend.direction === 'BULLISH') ||
    (!isBuy && htfTrend.direction === 'BEARISH')
  ) : false;

  let atKeyLevel = false;
  if (c && htfLevels && htfLevels.length > 0) {
    const price = c.close;
    for (const lvl of htfLevels) {
      if (Math.abs(price - lvl.price) / lvl.price < 0.005) {
        if ((isBuy && lvl.type === 'support') || (!isBuy && lvl.type === 'resistance')) {
          atKeyLevel = true;
          break;
        }
      }
    }
  }

  // 6. Market Regime Suitability
  const regimeName = regimeInfo?.regime || 'Ranging';
  let regimeSuitability = 0.6;
  if (regimeName.includes('Bullish') && isBuy) regimeSuitability = 0.9;
  else if (regimeName.includes('Bearish') && !isBuy) regimeSuitability = 0.9;
  else if (regimeName === 'Ranging') regimeSuitability = sweepDetected ? 0.8 : 0.5;

  return {
    marketStructure: {
      hasBos,
      hasMss,
      hasChoch,
      isFresh: true,
      direction: isBuy ? 'bullish' : 'bearish',
    },
    liquidity: {
      sweepDetected,
      reclaimConfirmed,
      poolSignificance: sweepDetected ? 'high' : 'normal',
    },
    candlePsychology: {
      displacementQuality,
      rejectionWickRatio,
      momentumFollowThrough,
      exhaustionDetected: notes.includes('exhaustion'),
    },
    zoneConfluence: {
      inOrderBlock,
      inFvg,
      atFibLevel,
      inDiscountOrPremium,
    },
    multiTimeframe: {
      htfDirection: htfTrend?.direction || 'Ranging',
      alignedWithHtf,
      atKeyLevel,
    },
    marketRegime: {
      regime: regimeName,
      suitability: regimeSuitability,
      volatility: regimeInfo?.volatility || 'Normal',
    },
    riskSuitability: {
      validSl: Boolean(rawSignal.sl),
      riskRewardRatio: rawSignal.riskReward || (rawSignal.tp && rawSignal.sl && rawSignal.price ? Math.abs((rawSignal.tp - rawSignal.price) / (rawSignal.price - rawSignal.sl)) : 1.5),
      extensionRisk: false,
    },
  };
}

/**
 * Normalizes an array of raw strategy outputs into standard candidate objects.
 */
export function normalizeToCandidates(rawSignals, candles, candleTimeIndex, htfSync, activeSettings, config, regimeInfo) {
  const symbol = config?.symbol || 'XAU/USD';
  const timeframe = config?.timeframe || '15m';

  const candidates = [];

  for (let idx = 0; idx < rawSignals.length; idx++) {
    const raw = rawSignals[idx];
    if (!raw || !raw.time) continue;

    const candleIdx = candleTimeIndex.get(raw.time);
    if (candleIdx === undefined) continue;

    const isBuy = raw.type?.includes('BUY') || raw.type?.includes('SSL') || raw.direction === 'BUY';
    const direction = isBuy ? 'BUY' : 'SELL';
    const strategy = raw.strategy || raw.notes?.split(' ')[0] || 'smc';
    const strategyFamily = inferStrategyFamily(strategy);
    const tradingStyle = raw.tradingStyle || inferTradingStyle(strategy, timeframe);
    const setupType = inferSetupType(strategy, raw.notes);

    const confirmationTime = raw.confirmationTime || raw.time;
    const formationTime = raw.setupTime || raw.time;

    const htfTrend = htfSync ? htfSync.getTrendAtTime(raw.time) : { direction: 'Ranging', confidence: 0 };
    const htfLevels = htfSync ? htfSync.getKeyLevelsAtTime(raw.time) : [];

    const evidence = extractEvidenceFromRawSignal(
      { ...raw, direction },
      candles,
      candleIdx,
      htfTrend,
      htfLevels,
      regimeInfo
    );

    const price = Number(raw.price || (candles[candleIdx] ? candles[candleIdx].close : 0));
    const sl = raw.sl ? Number(raw.sl) : null;
    const tp = raw.tp ? Number(raw.tp) : null;
    const riskReward = raw.riskReward || (tp && sl && price ? Math.abs((tp - price) / (price - sl)) : 1.5);

    // Physical setup cluster ID: groups candidates around the same price level & time window
    const priceRounded = (Math.round(price * 10) / 10).toFixed(1);
    const setupId = `${symbol}_${timeframe}_${tradingStyle}_${direction}_${Math.floor(candleIdx / 4)}_${priceRounded}`;
    const candidateId = `${symbol}-${timeframe}-${direction}-${raw.time}-${strategy}`;

    candidates.push({
      candidateId,
      id: candidateId,
      setupId,
      symbol,
      timeframe,
      tradingStyle,
      strategy,
      strategyFamily,
      setupType,
      direction,
      price,
      sl,
      tp,
      tp1: raw.tp1 || tp,
      tp2: raw.tp2 || null,
      tp3: raw.tp3 || null,
      riskReward,
      candleIndex: candleIdx,
      formationTimestamp: formationTime,
      confirmationTimestamp: confirmationTime,
      decisionTimestamp: raw.time,
      time: raw.time,
      type: raw.type || `${direction} confirmed`,
      notes: raw.notes || strategy,
      evidence,
      marketRegime: regimeInfo?.regime || 'Ranging',
      volatilityRegime: regimeInfo?.volatility || 'Normal',
      status: 'DETECTED',
      mssIndex: raw.mssIndex,
      sourceEvents: [raw],
      confirmations: [strategy],
      score: raw.score || 0,
      qualityTier: raw.qualityTier || 'B',
      reasons: raw.reasons || [],
    });
  }

  return candidates;
}
