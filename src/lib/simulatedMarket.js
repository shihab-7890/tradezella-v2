/**
 * Realistic market candle generator for TradeZella playback & confluence engine.
 * Used when external market data APIs (like Finage) are restricted or lack permissions.
 */

const BASE_PRICES = {
  'xauusd': 2385.50,
  'eurusd': 1.0845,
  'gbpusd': 1.2725,
  'usdjpy': 154.60,
  'usdcad': 1.3650,
  'usdchf': 0.9080,
  'audusd': 0.6580,
  'nzdusd': 0.6030,
  'euraud': 1.6480,
  'eurcad': 1.4810,
  'eurchf': 0.9850,
  'eurgbp': 0.8520,
  'eurjpy': 167.70,
  'eurnzd': 1.7980,
  'gbpaud': 1.9340,
  'gbpcad': 1.7380,
  'gbpchf': 1.1550,
  'gbpjpy': 196.80,
  'gbpnzd': 2.1100,
  'audjpy': 101.70,
  'nzdjpy': 93.20,
  'cadjpy': 113.20,
  'chfjpy': 170.20,
  'btcusd': 64850.00,
  'ethusd': 3240.00,
};

const TIMEFRAME_MS = {
  '1m': 60 * 1000,
  '2m': 2 * 60 * 1000,
  '3m': 3 * 60 * 1000,
  '5m': 5 * 60 * 1000,
  '10m': 10 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1D': 24 * 60 * 60 * 1000,
};

function createRng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function generateSimulatedCandles(symbol, timeframe, start, end) {
  const cleanSymbol = symbol.replace(/[^a-zA-Z]/g, '').toLowerCase();
  const stepMs = TIMEFRAME_MS[timeframe] || (15 * 60 * 1000);

  const basePrice = BASE_PRICES[cleanSymbol] || (cleanSymbol.includes('jpy') ? 150.0 : 1.1500);
  const decimals = basePrice > 1000 ? 2 : (basePrice > 50 ? 3 : 5);
  const pip = Math.pow(10, -decimals);

  let startTime = new Date(start).getTime();
  let endTime = new Date(end).getTime();

  if (isNaN(startTime)) startTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
  if (isNaN(endTime)) endTime = Date.now();
  if (endTime <= startTime) endTime = startTime + 14 * 24 * 60 * 60 * 1000;

  // Calculate desired count of candles (between 120 and 450 candles)
  const rawBars = Math.floor((endTime - startTime) / stepMs);
  let barCount = Math.max(120, Math.min(rawBars, 380));

  // Align timestamps
  const adjustedStartTime = endTime - (barCount * stepMs);

  const rng = createRng(`${cleanSymbol}_${timeframe}_${start}_${end}`);

  const volatility = basePrice * 0.0018; // approx 0.18% base bar volatility
  let currentPrice = basePrice * (0.985 + rng() * 0.03); // +/- 1.5% starting offset

  const candles = [];
  let swingHigh = currentPrice;
  let swingLow = currentPrice;
  let trendDirection = 1; // 1 for bull, -1 for bear
  let trendDuration = Math.floor(15 + rng() * 20);

  for (let i = 0; i < barCount; i++) {
    const time = adjustedStartTime + (i * stepMs);

    // Switch trend direction periodically
    if (i % trendDuration === 0) {
      trendDirection = rng() > 0.48 ? 1 : -1;
      trendDuration = Math.floor(12 + rng() * 22);
    }

    const open = currentPrice;
    const isDisplacement = (i % 24 === 7 || i % 24 === 18);
    const isSweep = (i % 31 === 12 || i % 31 === 25);

    let delta;
    if (isDisplacement) {
      // Big institutional displacement bar (creates FVGs & Order Blocks)
      delta = trendDirection * volatility * (2.2 + rng() * 1.5);
    } else if (isSweep) {
      // Sweep candle: wick pierces key swing high/low then reverses
      delta = -trendDirection * volatility * (0.4 + rng() * 0.6);
    } else {
      // Normal candle with trend bias
      const randomNoise = (rng() - 0.48) * 1.8;
      delta = (trendDirection * 0.35 + randomNoise) * volatility;
    }

    let close = open + delta;

    // Determine high and low wicks
    let upperWick = rng() * volatility * 0.9;
    let lowerWick = rng() * volatility * 0.9;

    if (isSweep) {
      if (trendDirection === 1) {
        // Piercing swing high with a long upper wick
        upperWick = volatility * (1.8 + rng() * 1.2);
      } else {
        // Piercing swing low with a long lower wick
        lowerWick = volatility * (1.8 + rng() * 1.2);
      }
    }

    let high = Math.max(open, close) + upperWick;
    let low = Math.min(open, close) - lowerWick;

    // Track swing highs / lows
    if (high > swingHigh) swingHigh = high;
    if (low < swingLow) swingLow = low;

    // Occasional equal highs/lows for liquidity pools (ICT concept)
    if (i > 15 && i % 28 === 0 && candles.length > 5) {
      const prevSwing = candles[candles.length - 8];
      if (rng() > 0.5 && prevSwing) {
        high = prevSwing.high; // Equal high pool
      } else if (prevSwing) {
        low = prevSwing.low; // Equal low pool
      }
    }

    // Safety checks
    if (high < Math.max(open, close)) high = Math.max(open, close) + pip;
    if (low > Math.min(open, close)) low = Math.min(open, close) - pip;

    // Realistic volume
    const baseVolume = 800 + Math.floor(rng() * 1200);
    const volume = isDisplacement || isSweep ? Math.floor(baseVolume * (2.5 + rng() * 1.5)) : baseVolume;

    const candle = {
      time,
      open: Number(open.toFixed(decimals)),
      high: Number(high.toFixed(decimals)),
      low: Number(low.toFixed(decimals)),
      close: Number(close.toFixed(decimals)),
      volume,
    };

    candles.push(candle);
    currentPrice = close;
  }

  return candles;
}
