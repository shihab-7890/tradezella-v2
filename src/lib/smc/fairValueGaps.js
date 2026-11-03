/**
 * Fair Value Gap & Imbalance Intelligence Engine
 * 3-candle FVG, Inverse FVG (IFVG), FVG Lifecycle & Midpoint reaction.
 */

export function detectFairValueGaps(candles, settings = {}) {
  if (!candles || candles.length < 3) return { fvgs: [], ifvgs: [] };

  const fvgs = [];
  const ifvgs = [];

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const c3 = candles[i];

    // Bullish FVG
    if (c3.low > c1.high) {
      const top = c3.low;
      const bottom = c1.high;
      const midpoint = (top + bottom) / 2;

      fvgs.push({
        id: `fvg-bull-${c3.time}`,
        type: 'Bullish FVG',
        direction: 'BUY',
        top,
        bottom,
        midpoint,
        originTime: c2.time,
        confirmationTime: c3.time,
        status: 'ACTIVE',
        score: 3.0,
      });
    }

    // Bearish FVG
    if (c1.low > c3.high) {
      const top = c1.low;
      const bottom = c3.high;
      const midpoint = (top + bottom) / 2;

      fvgs.push({
        id: `fvg-bear-${c3.time}`,
        type: 'Bearish FVG',
        direction: 'SELL',
        top,
        bottom,
        midpoint,
        originTime: c2.time,
        confirmationTime: c3.time,
        status: 'ACTIVE',
        score: 3.0,
      });
    }
  }

  // FVG Lifecycle & IFVG Qualification with active-list tracking
  const activeFvgs = [];
  let fvgPointer = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];

    // Add newly confirmed FVGs to active list
    while (fvgPointer < fvgs.length && fvgs[fvgPointer].confirmationTime <= c.time) {
      activeFvgs.push(fvgs[fvgPointer]);
      fvgPointer++;
    }

    // Process active FVGs
    for (let k = activeFvgs.length - 1; k >= 0; k--) {
      const fvg = activeFvgs[k];
      if (fvg.status === 'FULLY_MITIGATED' || fvg.status === 'INVALIDATED') {
        activeFvgs.splice(k, 1);
        continue;
      }

      if (fvg.direction === 'BUY') {
        if (c.low <= fvg.midpoint && c.low >= fvg.bottom) {
          fvg.status = 'PARTIAL_FILL';
        } else if (c.close < fvg.bottom) {
          fvg.status = 'INVALIDATED';
          activeFvgs.splice(k, 1);
          // Qualifies as Inverse Bullish-to-Bearish FVG (IFVG)
          ifvgs.push({
            id: `ifvg-bear-${c.time}`,
            type: 'Bearish IFVG',
            direction: 'SELL',
            top: fvg.top,
            bottom: fvg.bottom,
            midpoint: fvg.midpoint,
            originTime: fvg.originTime,
            confirmationTime: c.time,
            status: 'ACTIVE',
          });
        }
      } else {
        if (c.high >= fvg.midpoint && c.high <= fvg.top) {
          fvg.status = 'PARTIAL_FILL';
        } else if (c.close > fvg.top) {
          fvg.status = 'INVALIDATED';
          activeFvgs.splice(k, 1);
          // Qualifies as Inverse Bearish-to-Bullish FVG (IFVG)
          ifvgs.push({
            id: `ifvg-bull-${c.time}`,
            type: 'Bullish IFVG',
            direction: 'BUY',
            top: fvg.top,
            bottom: fvg.bottom,
            midpoint: fvg.midpoint,
            originTime: fvg.originTime,
            confirmationTime: c.time,
            status: 'ACTIVE',
          });
        }
      }
    }
  }

  return { fvgs, ifvgs };
}
