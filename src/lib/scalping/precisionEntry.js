/**
 * Phase 5 — Precision Entry Price Engine
 * Early, Balanced, Confirmed entry styles, order execution models, limit zones & setup expiration.
 */

export function calculatePrecisionEntry(candidate, candle, options = {}) {
  if (!candidate || !candle) return null;

  const entryStyle = options.scalpingEntryStyle || 'Balanced'; // 'Early' | 'Balanced' | 'Confirmed'
  const isBuy = candidate.direction === 'BUY';
  const close = candle.close;
  const high = candle.high;
  const low = candle.low;
  const spread = options.assumedSpread || 0.0002;

  let entryPrice = close;
  let entryType = 'Market-on-Confirmation';

  if (entryStyle === 'Early') {
    entryPrice = close;
    entryType = 'Market-on-Confirmation';
  } else if (entryStyle === 'Balanced') {
    // Retest entry zone at 50% candle body
    const midBody = (candle.open + candle.close) / 2;
    entryPrice = isBuy ? Math.min(close, midBody) : Math.max(close, midBody);
    entryType = 'Limit-in-Zone';
  } else if (entryStyle === 'Confirmed') {
    // Breakout entry beyond candle extreme
    entryPrice = isBuy ? high + spread : low - spread;
    entryType = 'Stop-Breakout';
  }

  // Adjust for bid/ask spread
  if (isBuy) entryPrice += spread;

  const expirationTime = candle.time + (options.setupExpiryCandles || 5) * 60000;

  return {
    ...candidate,
    entryPrice: Math.round(entryPrice * 100000) / 100000,
    entryType,
    entryStyle,
    confirmationTime: candle.time,
    expirationTime,
    status: 'WAITING_FOR_ENTRY',
  };
}
