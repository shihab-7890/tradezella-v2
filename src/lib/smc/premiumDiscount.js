/**
 * Premium, Equilibrium & Discount Dealing Range Engine
 * Calculates structural dealing range boundaries, equilibrium midpoint, and price zone classification.
 */

export function calculateDealingRange(candles, externalSwings = []) {
  if (!candles || candles.length === 0) return null;

  const highs = externalSwings.filter(s => s.type === 'HIGH');
  const lows = externalSwings.filter(s => s.type === 'LOW');

  let rangeHigh = -Infinity;
  let rangeLow = Infinity;

  if (highs.length > 0 && lows.length > 0) {
    rangeHigh = highs[highs.length - 1].price;
    rangeLow = lows[lows.length - 1].price;
  } else {
    for (const c of candles) {
      if (c.high > rangeHigh) rangeHigh = c.high;
      if (c.low < rangeLow) rangeLow = c.low;
    }
  }

  if (rangeHigh <= rangeLow) return null;

  const equilibrium = (rangeHigh + rangeLow) / 2;
  const rangeSpan = rangeHigh - rangeLow;

  const currentPrice = candles[candles.length - 1].close;
  const currentRatio = (currentPrice - rangeLow) / rangeSpan;

  let zone = 'Equilibrium';
  if (currentRatio > 0.52) zone = 'Premium';
  else if (currentRatio < 0.48) zone = 'Discount';

  return {
    rangeHigh,
    rangeLow,
    equilibrium,
    currentPrice,
    zone,
    currentRatio,
  };
}
