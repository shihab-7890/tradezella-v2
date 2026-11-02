/**
 * Candle Psychology & Microstructure Measurement Engine
 * Standardized OHLC analysis across symbol types and timeframes.
 */

export function calculateCandleMetrics(candle, prevCandle = null, atr = null, volumeMA = null) {
  if (!candle || candle.high === undefined || candle.low === undefined) {
    return null;
  }

  const open = Number(candle.open);
  const high = Number(candle.high);
  const low = Number(candle.low);
  const close = Number(candle.close);
  const volume = candle.volume !== undefined ? Number(candle.volume) : null;

  const range = Math.max(0, high - low);
  const body = Math.abs(close - open);
  const upperWick = high - Math.max(open, close);
  const lowerWick = Math.min(open, close) - low;

  const bodyRatio = range > 0 ? body / range : 0;
  const upperWickRatio = range > 0 ? upperWick / range : 0;
  const lowerWickRatio = range > 0 ? lowerWick / range : 0;
  const closeLocation = range > 0 ? (close - low) / range : 0.5;

  const effectiveAtr = atr && atr > 0 ? atr : range || 1.0;
  const bodyToAtr = body / effectiveAtr;
  const rangeToAtr = range / effectiveAtr;

  const gap = prevCandle ? open - prevCandle.close : 0;

  // Overlap calculation with previous candle range
  let overlapRatio = 0;
  if (prevCandle && prevCandle.high > prevCandle.low && range > 0) {
    const overlapMin = Math.max(low, prevCandle.low);
    const overlapMax = Math.min(high, prevCandle.high);
    if (overlapMax > overlapMin) {
      overlapRatio = (overlapMax - overlapMin) / range;
    }
  }

  const isBullish = close > open;
  const isBearish = close < open;
  const isDoji = bodyRatio <= 0.15;
  const direction = isBullish ? 'BULLISH' : isBearish ? 'BEARISH' : 'NEUTRAL';

  // Volume relative ratio if available
  const volumeRatio = (volume !== null && volumeMA && volumeMA > 0) ? volume / volumeMA : 1.0;

  return {
    time: candle.time,
    open,
    high,
    low,
    close,
    volume,
    range,
    body,
    upperWick,
    lowerWick,
    bodyRatio,
    upperWickRatio,
    lowerWickRatio,
    closeLocation,
    bodyToAtr,
    rangeToAtr,
    gap,
    overlapRatio,
    isBullish,
    isBearish,
    isDoji,
    direction,
    volumeRatio,
  };
}

export function classifyCandle(metrics, settings = {}) {
  if (!metrics) return [];

  const minBodyRatio = settings.minBodyRatio || 0.65;
  const rejectionWickRatio = settings.rejectionWickRatio || 0.45;
  const impulseAtr = settings.impulseAtr || 0.8;
  const rangeExpansionAtr = settings.rangeExpansionAtr || 1.3;

  const tags = [];

  // Strong Body & Direction
  if (metrics.bodyRatio >= minBodyRatio) {
    if (metrics.isBullish) tags.push('STRONG_BULLISH');
    if (metrics.isBearish) tags.push('STRONG_BEARISH');
  } else if (metrics.bodyRatio <= 0.35 && !metrics.isDoji) {
    if (metrics.isBullish) tags.push('WEAK_BULLISH');
    if (metrics.isBearish) tags.push('WEAK_BEARISH');
  }

  // Rejections
  if (metrics.lowerWickRatio >= rejectionWickRatio && metrics.closeLocation >= 0.5) {
    tags.push('BULLISH_REJECTION');
  }
  if (metrics.upperWickRatio >= rejectionWickRatio && metrics.closeLocation <= 0.5) {
    tags.push('BEARISH_REJECTION');
  }

  // Doji / Indecision
  if (metrics.isDoji) {
    tags.push('INDECISION');
  }

  // Impulse vs Compression
  if (metrics.bodyToAtr >= impulseAtr && metrics.rangeToAtr >= rangeExpansionAtr) {
    tags.push('IMPULSE');
  } else if (metrics.rangeToAtr <= 0.5 && metrics.bodyToAtr <= 0.3) {
    tags.push('COMPRESSION');
  }

  return tags;
}

export function calculateDirectionalPressure(metrics, prevMetrics = null) {
  if (!metrics) {
    return {
      bullishScore: 50,
      bearishScore: 50,
      netPressure: 0,
      acceleration: 0,
      rejectionStrength: 0,
      continuationStrength: 0,
      exhaustionWarning: false,
    };
  }

  let bullishScore = 50;
  let bearishScore = 50;

  // Close location weight (0 to 100)
  bullishScore += (metrics.closeLocation - 0.5) * 60;
  bearishScore += (0.5 - metrics.closeLocation) * 60;

  // Body percentage contribution
  if (metrics.isBullish) {
    bullishScore += metrics.bodyRatio * 25;
    bearishScore -= metrics.bodyRatio * 15;
  } else if (metrics.isBearish) {
    bearishScore += metrics.bodyRatio * 25;
    bullishScore -= metrics.bodyRatio * 15;
  }

  // Wick rejection
  if (metrics.lowerWickRatio > 0.4) {
    bullishScore += metrics.lowerWickRatio * 20;
  }
  if (metrics.upperWickRatio > 0.4) {
    bearishScore += metrics.upperWickRatio * 20;
  }

  // Bound scores between 0 and 100
  bullishScore = Math.min(100, Math.max(0, Math.round(bullishScore)));
  bearishScore = Math.min(100, Math.max(0, Math.round(bearishScore)));
  const netPressure = Math.round(bullishScore - bearishScore);

  // Acceleration / Deceleration relative to prev metrics
  let acceleration = 0;
  if (prevMetrics && prevMetrics.range > 0) {
    const rangeChange = (metrics.range - prevMetrics.range) / prevMetrics.range;
    if (metrics.direction === prevMetrics.direction) {
      acceleration = rangeChange;
    } else {
      acceleration = -rangeChange;
    }
  }

  const rejectionStrength = metrics.isBullish ? metrics.lowerWickRatio : metrics.upperWickRatio;
  const continuationStrength = metrics.bodyToAtr;
  const exhaustionWarning = metrics.rangeToAtr > 2.0 && (metrics.upperWickRatio > 0.4 || metrics.lowerWickRatio > 0.4);

  return {
    bullishScore,
    bearishScore,
    netPressure,
    acceleration,
    rejectionStrength,
    continuationStrength,
    exhaustionWarning,
  };
}
