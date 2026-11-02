/**
 * Advanced Order Block & Mitigation Engine
 * Bullish/Bearish Order Blocks, Breaker Blocks, Mitigation Blocks, Continuation OBs, Lifecycle management.
 */

export function detectOrderBlocks(candles, structureEvents = [], atrList = [], settings = {}) {
  if (!candles || candles.length === 0) return { orderBlocks: [], breakerBlocks: [] };

  const orderBlocks = [];
  const breakerBlocks = [];

  for (const event of structureEvents) {
    const idx = candles.findIndex(c => c.time === event.time);
    if (idx < 1) continue;

    const isBuy = event.direction === 'BUY';

    if (isBuy) {
      // Find last bearish origin bar prior to break (close <= open)
      let obIdx = idx - 1;
      while (obIdx > 0 && candles[obIdx].close > candles[obIdx].open) {
        obIdx--;
      }

      if (obIdx >= 0) {
        const obCandle = candles[obIdx];
        orderBlocks.push({
          id: `ob-bull-${obCandle.time}`,
          type: 'Bullish OB',
          direction: 'BUY',
          high: obCandle.high,
          low: obCandle.low,
          originTime: obCandle.time,
          confirmationTime: event.time,
          status: 'ACTIVE',
          score: 3.5,
          reasons: [`Bullish Order Block formed prior to ${event.type} at ${event.brokenLevel.toFixed(2)}`],
        });
      }
    } else {
      // Find last bullish origin bar prior to break (close >= open)
      let obIdx = idx - 1;
      while (obIdx > 0 && candles[obIdx].close < candles[obIdx].open) {
        obIdx--;
      }

      if (obIdx >= 0) {
        const obCandle = candles[obIdx];
        orderBlocks.push({
          id: `ob-bear-${obCandle.time}`,
          type: 'Bearish OB',
          direction: 'SELL',
          high: obCandle.high,
          low: obCandle.low,
          originTime: obCandle.time,
          confirmationTime: event.time,
          status: 'ACTIVE',
          score: 3.5,
          reasons: [`Bearish Order Block formed prior to ${event.type} at ${event.brokenLevel.toFixed(2)}`],
        });
      }
    }
  }

  // Lifecycle check for OB touches & mitigations
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    for (const ob of orderBlocks) {
      if (ob.confirmationTime > c.time || ob.status === 'INVALIDATED' || ob.status === 'FULLY_MITIGATED') continue;

      if (ob.direction === 'BUY') {
        if (c.low <= ob.high && c.low >= ob.low) {
          ob.status = 'TOUCHED';
        } else if (c.close < ob.low) {
          ob.status = 'INVALIDATED';
          // Converts to Breaker Block
          breakerBlocks.push({
            id: `breaker-bear-${c.time}`,
            type: 'Bearish Breaker',
            direction: 'SELL',
            high: ob.high,
            low: ob.low,
            originTime: ob.originTime,
            confirmationTime: c.time,
            status: 'ACTIVE',
          });
        }
      } else {
        if (c.high >= ob.low && c.high <= ob.high) {
          ob.status = 'TOUCHED';
        } else if (c.close > ob.high) {
          ob.status = 'INVALIDATED';
          // Converts to Breaker Block
          breakerBlocks.push({
            id: `breaker-bull-${c.time}`,
            type: 'Bullish Breaker',
            direction: 'BUY',
            high: ob.high,
            low: ob.low,
            originTime: ob.originTime,
            confirmationTime: c.time,
            status: 'ACTIVE',
          });
        }
      }
    }
  }

  return { orderBlocks, breakerBlocks };
}
