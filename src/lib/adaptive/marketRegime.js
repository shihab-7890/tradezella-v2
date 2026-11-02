/**
 * Advanced Market Regime & Volatility Intelligence Engine
 * Directional Regime, Volatility Regime, Transition State & Trend Strength Scoring (0-100).
 */

export function calculateTrendStrength(candles, atrList = [], period = 14) {
  if (!candles || candles.length < period) {
    return { score: 50, direction: 'Ranging', bullishEvidence: 0, bearishEvidence: 0 };
  }

  const slice = candles.slice(-period);
  const firstClose = slice[0].close;
  const lastClose = slice[slice.length - 1].close;

  let bullishBars = 0;
  let bearishBars = 0;
  let totalDisplacement = 0;

  for (let i = 1; i < slice.length; i++) {
    const c = slice[i];
    const prev = slice[i - 1];
    const diff = c.close - prev.close;
    totalDisplacement += diff;

    if (c.close > c.open) bullishBars++;
    if (c.close < c.open) bearishBars++;
  }

  const netMove = lastClose - firstClose;
  const atr = atrList.length >= candles.length ? atrList[candles.length - 1] || 1.0 : 1.0;
  const normalizedMove = Math.abs(netMove) / (atr * Math.sqrt(period));

  const bullishEvidence = Math.min(100, Math.max(0, Math.round((bullishBars / period) * 50 + (netMove > 0 ? normalizedMove * 35 : 0))));
  const bearishEvidence = Math.min(100, Math.max(0, Math.round((bearishBars / period) * 50 + (netMove < 0 ? normalizedMove * 35 : 0))));

  let direction = 'Ranging';
  let score = 50;

  if (bullishEvidence > bearishEvidence + 15) {
    direction = 'Bullish';
    score = Math.min(100, 50 + (bullishEvidence - bearishEvidence));
  } else if (bearishEvidence > bullishEvidence + 15) {
    direction = 'Bearish';
    score = Math.min(100, 50 + (bearishEvidence - bullishEvidence));
  } else {
    score = Math.round(50 + Math.abs(bullishEvidence - bearishEvidence));
  }

  return { score, direction, bullishEvidence, bearishEvidence };
}

export function detectVolatilityRegime(candles, atrList = [], period = 20) {
  if (!candles || candles.length < period || atrList.length < candles.length) {
    return { regime: 'Normal', atrRatio: 1.0, isCompressing: false, isExpanding: false };
  }

  const currentAtr = atrList[candles.length - 1] || 1.0;
  const recentAtrSlice = atrList.slice(-period).filter(Boolean);
  const avgAtr = recentAtrSlice.reduce((a, b) => a + b, 0) / (recentAtrSlice.length || 1);

  const atrRatio = avgAtr > 0 ? currentAtr / avgAtr : 1.0;

  let regime = 'Normal';
  if (atrRatio < 0.7) regime = 'Low';
  else if (atrRatio > 1.6) regime = 'Extreme';
  else if (atrRatio > 1.25) regime = 'Elevated';

  const isCompressing = atrRatio < 0.8;
  const isExpanding = atrRatio > 1.3;

  return { regime, atrRatio, isCompressing, isExpanding };
}

export function classifyMarketRegime(candles, atrList = [], settings = {}) {
  if (!candles || candles.length < 10) {
    return {
      directionalRegime: 'Ranging',
      volatilityRegime: 'Normal',
      transitionState: 'Stable Trend',
      trendStrength: 50,
      confidence: 50,
      explanation: 'Insufficient candle history for regime classification.',
    };
  }

  const trend = calculateTrendStrength(candles, atrList, 14);
  const volatility = detectVolatilityRegime(candles, atrList, 20);

  let directionalRegime = 'Ranging';
  if (trend.direction === 'Bullish') {
    directionalRegime = trend.score >= 75 ? 'Strong Bullish' : 'Moderate Bullish';
  } else if (trend.direction === 'Bearish') {
    directionalRegime = trend.score >= 75 ? 'Strong Bearish' : 'Moderate Bearish';
  } else {
    directionalRegime = trend.bullishEvidence < 25 && trend.bearishEvidence < 25 ? 'Choppy' : 'Ranging';
  }

  let transitionState = 'Stable Trend';
  if (volatility.isCompressing) {
    transitionState = 'Compression';
  } else if (volatility.isExpanding && directionalRegime !== 'Ranging') {
    transitionState = 'Confirmed Expansion';
  } else if (volatility.isExpanding && directionalRegime === 'Ranging') {
    transitionState = 'Breakout Attempt';
  } else if (trend.score < 55 && (directionalRegime.includes('Bullish') || directionalRegime.includes('Bearish'))) {
    transitionState = 'Trend Weakening';
  }

  const confidence = Math.min(100, Math.max(30, Math.round(trend.score * 0.7 + (volatility.regime === 'Normal' ? 30 : 15))));

  return {
    directionalRegime,
    volatilityRegime: volatility.regime,
    transitionState,
    trendStrength: trend.score,
    confidence,
    bullishEvidence: trend.bullishEvidence,
    bearishEvidence: trend.bearishEvidence,
    explanation: `Market is in ${directionalRegime} regime with ${volatility.regime} volatility (${transitionState}). Strength: ${trend.score}/100.`,
  };
}
