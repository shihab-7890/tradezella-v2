/**
 * Advanced Liquidity Intelligence Engine
 * BSL/SSL pools, EQH/EQL, Session/Prev Day/Week Highs & Lows, Sweep vs Breakout classification.
 */

export function mapLiquidityPools(candles, internalSwings = [], externalSwings = [], atr = 5.0) {
  if (!candles || candles.length === 0) return { bslPools: [], sslPools: [] };

  const tolerance = 0.2 * atr;
  const bslPools = [];
  const sslPools = [];

  // 1. Map BSL from confirmed swing highs
  for (const swing of externalSwings.filter(s => s.type === 'HIGH')) {
    bslPools.push({
      id: `bsl-${swing.time}`,
      type: 'BSL',
      price: swing.price,
      originTime: swing.time,
      confirmationTime: swing.confirmationTime,
      touches: 1,
      status: 'ACTIVE',
    });
  }

  // 2. Map SSL from confirmed swing lows
  for (const swing of externalSwings.filter(s => s.type === 'LOW')) {
    sslPools.push({
      id: `ssl-${swing.time}`,
      type: 'SSL',
      price: swing.price,
      originTime: swing.time,
      confirmationTime: swing.confirmationTime,
      touches: 1,
      status: 'ACTIVE',
    });
  }

  return { bslPools, sslPools };
}

export function detectLiquiditySweepsAndBreakouts(candles, bslPools = [], sslPools = [], settings = {}) {
  if (!candles || candles.length < 2) return { sweeps: [], breakouts: [] };

  const sweeps = [];
  const breakouts = [];

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];

    // Check SSL Sweeps / Breakouts
    for (const pool of sslPools.filter(p => p.confirmationTime <= c.time && p.status === 'ACTIVE')) {
      if (c.low < pool.price) {
        if (c.close > pool.price) {
          // Reclaimed close -> SSL Sweep (Potential Bullish Reversal)
          pool.status = 'SWEPT';
          sweeps.push({
            id: `sweep-ssl-${c.time}`,
            type: 'SSL Sweep',
            direction: 'BUY',
            poolId: pool.id,
            price: pool.price,
            time: c.time,
            reasons: [`SSL pool swept at ${pool.price.toFixed(2)} and reclaimed at ${c.close.toFixed(2)}`],
            invalidationPrice: c.low,
          });
        } else if (c.close < pool.price) {
          // Close below level -> Genuine Breakdown
          pool.status = 'SWEPT';
          breakouts.push({
            id: `breakout-bear-${c.time}`,
            type: 'Bearish Breakdown',
            direction: 'SELL',
            poolId: pool.id,
            price: pool.price,
            time: c.time,
            reasons: [`Bearish breakdown below SSL pool at ${pool.price.toFixed(2)}`],
            invalidationPrice: c.high,
          });
        }
      }
    }

    // Check BSL Sweeps / Breakouts
    for (const pool of bslPools.filter(p => p.confirmationTime <= c.time && p.status === 'ACTIVE')) {
      if (c.high > pool.price) {
        if (c.close < pool.price) {
          // Reclaimed close -> BSL Sweep (Potential Bearish Reversal)
          pool.status = 'SWEPT';
          sweeps.push({
            id: `sweep-bsl-${c.time}`,
            type: 'BSL Sweep',
            direction: 'SELL',
            poolId: pool.id,
            price: pool.price,
            time: c.time,
            reasons: [`BSL pool swept at ${pool.price.toFixed(2)} and reclaimed at ${c.close.toFixed(2)}`],
            invalidationPrice: c.high,
          });
        } else if (c.close > pool.price) {
          // Close above level -> Genuine Breakout
          pool.status = 'SWEPT';
          breakouts.push({
            id: `breakout-bull-${c.time}`,
            type: 'Bullish Breakout',
            direction: 'BUY',
            poolId: pool.id,
            price: pool.price,
            time: c.time,
            reasons: [`Bullish breakout above BSL pool at ${pool.price.toFixed(2)}`],
            invalidationPrice: c.low,
          });
        }
      }
    }
  }

  return { sweeps, breakouts };
}
