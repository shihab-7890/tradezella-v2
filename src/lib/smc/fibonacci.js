/**
 * Automatic Fibonacci & OTE Engine
 * Auto-anchors on confirmed swing structures to compute retracements, extensions, and OTE zones.
 */

export function calculateAutoFibonacci(candles, externalSwings = [], trendState = 'Ranging') {
  if (!candles || candles.length === 0 || externalSwings.length < 2) {
    return null;
  }

  const highs = externalSwings.filter(s => s.type === 'HIGH');
  const lows = externalSwings.filter(s => s.type === 'LOW');

  if (highs.length === 0 || lows.length === 0) return null;

  const lastHigh = highs[highs.length - 1];
  const lastLow = lows[lows.length - 1];

  const isBullish = lastHigh.time > lastLow.time;
  const highPrice = lastHigh.price;
  const lowPrice = lastLow.price;
  const diff = highPrice - lowPrice;

  if (diff <= 0) return null;

  const levels = {
    fib0: isBullish ? highPrice : lowPrice,
    fib236: isBullish ? highPrice - diff * 0.236 : lowPrice + diff * 0.236,
    fib382: isBullish ? highPrice - diff * 0.382 : lowPrice + diff * 0.382,
    fib500: isBullish ? highPrice - diff * 0.500 : lowPrice + diff * 0.500,
    fib618: isBullish ? highPrice - diff * 0.618 : lowPrice + diff * 0.618,
    fib705: isBullish ? highPrice - diff * 0.705 : lowPrice + diff * 0.705, // OTE level
    fib786: isBullish ? highPrice - diff * 0.786 : lowPrice + diff * 0.786,
    fib100: isBullish ? lowPrice : highPrice,
    fib1272: isBullish ? highPrice + diff * 0.272 : lowPrice - diff * 0.272,
    fib1618: isBullish ? highPrice + diff * 0.618 : lowPrice - diff * 0.618,
  };

  const oteZone = {
    top: isBullish ? levels.fib618 : levels.fib786,
    bottom: isBullish ? levels.fib786 : levels.fib618,
  };

  return {
    isBullish,
    anchorHigh: lastHigh,
    anchorLow: lastLow,
    levels,
    oteZone,
  };
}
