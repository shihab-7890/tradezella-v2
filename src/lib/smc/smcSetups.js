/**
 * Advanced SMC Strategy Setups (Setups A - I)
 * Generates structured, explainable setup candidates for the central signal engine.
 */

export function detectSmcSetups(candles, structureData, liquidityData, obData, fvgData, fibData, rangeData, settings = {}) {
  if (!candles || candles.length === 0) return [];

  const candidates = [];
  const { structureEvents } = structureData || { structureEvents: [] };
  const { sweeps } = liquidityData || { sweeps: [] };
  const { orderBlocks, breakerBlocks } = obData || { orderBlocks: [], breakerBlocks: [] };
  const { fvgs, ifvgs } = fvgData || { fvgs: [], ifvgs: [] };

  // 1. Setup A — Liquidity Sweep + MSS Reversal
  for (const sweep of sweeps) {
    const mss = structureEvents.find(e => e.direction === sweep.direction && e.time >= sweep.time);
    if (mss) {
      candidates.push({
        id: `setupA-${sweep.direction.toLowerCase()}-${mss.time}`,
        strategy: 'smcSweepMss',
        type: `${sweep.direction} confirmed`,
        direction: sweep.direction,
        time: mss.time,
        price: candles.find(c => c.time === mss.time)?.close || sweep.price,
        setupTime: sweep.time,
        confirmationTime: mss.time,
        score: 3.5,
        reasons: [`Setup A: ${sweep.type} + ${mss.type} Market Structure Shift`],
        invalidationPrice: sweep.invalidationPrice,
        notes: `Liquidity Sweep at ${sweep.price.toFixed(2)} followed by ${mss.type} confirmation.`,
      });
    }
  }

  // 2. Setup B — Order Block + FVG Confluence
  for (const ob of orderBlocks.filter(o => o.status === 'ACTIVE' || o.status === 'TOUCHED')) {
    const fvg = fvgs.find(f => f.direction === ob.direction && Math.abs(f.originTime - ob.originTime) <= 300000);
    if (fvg) {
      candidates.push({
        id: `setupB-${ob.direction.toLowerCase()}-${fvg.confirmationTime}`,
        strategy: 'smcObFvg',
        type: `${ob.direction} confirmed`,
        direction: ob.direction,
        time: fvg.confirmationTime,
        price: candles.find(c => c.time === fvg.confirmationTime)?.close || ob.high,
        setupTime: ob.originTime,
        confirmationTime: fvg.confirmationTime,
        score: 3.5,
        reasons: [`Setup B: ${ob.type} + ${fvg.type} Imbalance Overlap`],
        invalidationPrice: ob.direction === 'BUY' ? ob.low : ob.high,
        notes: `Confirmed Order Block with overlapping Fair Value Gap at ${fvg.midpoint.toFixed(2)}.`,
      });
    }
  }

  // 3. Setup C — CHoCH + Retest
  for (const choch of structureEvents.filter(e => e.type === 'CHoCH')) {
    candidates.push({
      id: `setupC-${choch.direction.toLowerCase()}-${choch.time}`,
      strategy: 'smcChochRetest',
      type: `${choch.direction} confirmed`,
      direction: choch.direction,
      time: choch.time,
      price: candles.find(c => c.time === choch.time)?.close || choch.brokenLevel,
      setupTime: choch.originTime,
      confirmationTime: choch.time,
      score: 3.2,
      reasons: [`Setup C: CHoCH Trend Transition`],
      invalidationPrice: choch.invalidationPrice,
      notes: `Change of Character breaking protected level at ${choch.brokenLevel.toFixed(2)}.`,
    });
  }

  // 4. Setup D — BOS + Trend Continuation
  for (const bos of structureEvents.filter(e => e.type === 'BOS')) {
    candidates.push({
      id: `setupD-${bos.direction.toLowerCase()}-${bos.time}`,
      strategy: 'smcBosContinuation',
      type: `${bos.direction} confirmed`,
      direction: bos.direction,
      time: bos.time,
      price: candles.find(c => c.time === bos.time)?.close || bos.brokenLevel,
      setupTime: bos.originTime,
      confirmationTime: bos.time,
      score: 3.0,
      reasons: [`Setup D: BOS Trend Continuation`],
      invalidationPrice: bos.invalidationPrice,
      notes: `Break of Structure continuing ${bos.direction} trend at ${bos.brokenLevel.toFixed(2)}.`,
    });
  }

  // 5. Setup E — Premium / Discount Zone + OB
  if (rangeData && rangeData.zone) {
    const isDiscountBuy = rangeData.zone === 'Discount';
    const isPremiumSell = rangeData.zone === 'Premium';

    if (isDiscountBuy) {
      const activeOb = orderBlocks.find(o => o.direction === 'BUY' && o.status === 'ACTIVE');
      if (activeOb) {
        candidates.push({
          id: `setupE-buy-${activeOb.confirmationTime}`,
          strategy: 'smcPremDiscOb',
          type: 'BUY confirmed',
          direction: 'BUY',
          time: activeOb.confirmationTime,
          price: activeOb.high,
          setupTime: activeOb.originTime,
          confirmationTime: activeOb.confirmationTime,
          score: 3.2,
          reasons: ['Setup E: Discount Zone + Bullish Order Block'],
          invalidationPrice: activeOb.low,
          notes: `Price in Discount dealing range (ratio: ${rangeData.currentRatio.toFixed(2)}) reacting at Order Block.`,
        });
      }
    } else if (isPremiumSell) {
      const activeOb = orderBlocks.find(o => o.direction === 'SELL' && o.status === 'ACTIVE');
      if (activeOb) {
        candidates.push({
          id: `setupE-sell-${activeOb.confirmationTime}`,
          strategy: 'smcPremDiscOb',
          type: 'SELL confirmed',
          direction: 'SELL',
          time: activeOb.confirmationTime,
          price: activeOb.low,
          setupTime: activeOb.originTime,
          confirmationTime: activeOb.confirmationTime,
          score: 3.2,
          reasons: ['Setup E: Premium Zone + Bearish Order Block'],
          invalidationPrice: activeOb.high,
          notes: `Price in Premium dealing range (ratio: ${rangeData.currentRatio.toFixed(2)}) reacting at Order Block.`,
        });
      }
    }
  }

  return candidates;
}
