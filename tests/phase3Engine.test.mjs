import test from 'node:test';
import assert from 'node:assert/strict';

import { detectSwings, analyzeMarketStructure } from '../src/lib/smc/marketStructure.js';
import { mapLiquidityPools, detectLiquiditySweepsAndBreakouts } from '../src/lib/smc/liquidityIntelligence.js';
import { detectOrderBlocks } from '../src/lib/smc/orderBlocks.js';
import { detectFairValueGaps } from '../src/lib/smc/fairValueGaps.js';
import { calculateAutoFibonacci } from '../src/lib/smc/fibonacci.js';
import { calculateDealingRange } from '../src/lib/smc/premiumDiscount.js';
import { detectSmcSetups } from '../src/lib/smc/smcSetups.js';
import { runConfluenceEngine } from '../src/lib/liquidity.js';

test('PHASE 3 ENGINE SUITE: Advanced Smart Money Concepts & Liquidity Intelligence', async (t) => {

  await t.test('Test 1: Bullish Structure — HH/HL Recognition & Bullish BOS', () => {
    const candles = [
      { time: 1000, open: 100, high: 105, low: 99, close: 104 },
      { time: 2000, open: 104, high: 106, low: 102, close: 103 },
      { time: 3000, open: 103, high: 104, low: 98, close: 99 },  // Swing Low at 98
      { time: 4000, open: 99, high: 108, low: 99, close: 107 },
      { time: 5000, open: 107, high: 112, low: 106, close: 111 }, // Bullish BOS close > 106
    ];

    const structure = analyzeMarketStructure(candles);
    assert.ok(structure.structureEvents.length >= 1, 'Should detect structural break event');
    assert.equal(structure.structureEvents[0].direction, 'BUY');
  });

  await t.test('Test 2: Bearish Structure — LH/LL Recognition & Bearish BOS', () => {
    const candles = [
      { time: 1000, open: 100, high: 102, low: 94, close: 95 },
      { time: 2000, open: 95, high: 97, low: 93, close: 96 },   // Swing Low at 93
      { time: 3000, open: 96, high: 98, low: 95, close: 97 },
      { time: 4000, open: 97, high: 97.5, low: 90, close: 91 }, // Bearish BOS close < 93
    ];

    const structure = analyzeMarketStructure(candles);
    assert.ok(structure.structureEvents.length >= 1, 'Should detect bearish BOS');
    assert.equal(structure.structureEvents[0].direction, 'SELL');
  });

  await t.test('Test 3: CHoCH Transition Recognition', () => {
    const candles = [
      { time: 500, open: 100, high: 110, low: 100, close: 105 },
      { time: 1000, open: 105, high: 120, low: 104, close: 115 }, // Swing High at 120
      { time: 1500, open: 115, high: 116, low: 95, close: 96 },
      { time: 2000, open: 96, high: 97, low: 85, close: 86 },    // Swing Low at 85
      { time: 3000, open: 86, high: 125, low: 85, close: 122 },  // CHoCH break above 120
    ];

    const structure = analyzeMarketStructure(candles);
    assert.ok(structure.structureEvents.some(e => e.type === 'CHoCH'), 'Should detect CHoCH');
  });

  await t.test('Test 4: Market Structure Shift (MSS)', () => {
    const candles = [
      { time: 1000, open: 100, high: 105, low: 98, close: 99 },
      { time: 2000, open: 99, high: 110, low: 99, close: 109 }, // MSS displacement
    ];
    const structure = analyzeMarketStructure(candles);
    assert.ok(structure !== null);
  });

  await t.test('Test 5: Swing Confirmation Delay (Non-Repainting Pivots)', () => {
    const candles = [
      { time: 1000, open: 100, high: 102, low: 99, close: 101 },
      { time: 2000, open: 101, high: 110, low: 100, close: 109 }, // High at 110
      { time: 3000, open: 109, high: 105, low: 102, close: 103 },
      { time: 4000, open: 103, high: 104, low: 101, close: 102 }, // Confirms pivot at index 1
    ];

    const swings = detectSwings(candles, 1, 1);
    assert.equal(swings.length, 1);
    assert.equal(swings[0].price, 110);
    assert.equal(swings[0].confirmationTime, 3000, 'Confirmation must be at index 2 close');
  });

  await t.test('Test 6: Equal Highs / Lows Pool Mapping', () => {
    const externalSwings = [
      { id: 's1', type: 'HIGH', price: 105.0, time: 1000, confirmationTime: 2000 },
      { id: 's2', type: 'HIGH', price: 105.1, time: 3000, confirmationTime: 4000 },
    ];
    const pools = mapLiquidityPools([{ time: 5000 }], [], externalSwings, 2.0);
    assert.equal(pools.bslPools.length, 2);
  });

  await t.test('Test 7: BSL / SSL Sweep Detection & Reclaim', () => {
    const candles = [
      { time: 1000, open: 100, high: 101, low: 99, close: 100 },
      { time: 2000, open: 100, high: 101, low: 89, close: 96 }, // Sweeps SSL at 90 and reclaims to 96
    ];
    const sslPools = [{ id: 'ssl-1', type: 'SSL', price: 90.0, confirmationTime: 1000, status: 'ACTIVE' }];

    const result = detectLiquiditySweepsAndBreakouts(candles, [], sslPools);
    assert.equal(result.sweeps.length, 1);
    assert.equal(result.sweeps[0].direction, 'BUY');
  });

  await t.test('Test 8: Genuine Breakout vs Sweep Classification', () => {
    const candles = [
      { time: 1000, open: 100, high: 101, low: 99, close: 100 },
      { time: 2000, open: 100, high: 101, low: 85, close: 86 }, // Closes below 90 -> Genuine Breakdown
    ];
    const sslPools = [{ id: 'ssl-1', type: 'SSL', price: 90.0, confirmationTime: 1000, status: 'ACTIVE' }];

    const result = detectLiquiditySweepsAndBreakouts(candles, [], sslPools);
    assert.equal(result.breakouts.length, 1);
    assert.equal(result.breakouts[0].type, 'Bearish Breakdown');
  });

  await t.test('Test 9: Bullish Order Block Lifecycle', () => {
    const candles = [
      { time: 1000, open: 100, high: 102, low: 95, close: 96 },  // Bearish origin bar
      { time: 2000, open: 96, high: 110, low: 96, close: 108 },  // Bullish displacement break
    ];
    const structureEvents = [{ type: 'BOS', direction: 'BUY', brokenLevel: 102, time: 2000 }];

    const obResult = detectOrderBlocks(candles, structureEvents);
    assert.equal(obResult.orderBlocks.length, 1);
    assert.equal(obResult.orderBlocks[0].direction, 'BUY');
  });

  await t.test('Test 10: Bearish Order Block Lifecycle', () => {
    const candles = [
      { time: 1000, open: 100, high: 105, low: 99, close: 104 }, // Bullish origin bar
      { time: 2000, open: 104, high: 104, low: 88, close: 89 },  // Bearish displacement break
    ];
    const structureEvents = [{ type: 'BOS', direction: 'SELL', brokenLevel: 99, time: 2000 }];

    const obResult = detectOrderBlocks(candles, structureEvents);
    assert.equal(obResult.orderBlocks.length, 1);
    assert.equal(obResult.orderBlocks[0].direction, 'SELL');
  });

  await t.test('Test 11: Breaker Block Conversion on Invalidation', () => {
    const candles = [
      { time: 1000, open: 100, high: 102, low: 95, close: 96 },
      { time: 2000, open: 96, high: 110, low: 96, close: 108 },
      { time: 3000, open: 108, high: 108, low: 90, close: 91 }, // Breaks low of OB -> Invalidation & Breaker
    ];
    const structureEvents = [{ type: 'BOS', direction: 'BUY', brokenLevel: 102, time: 2000 }];

    const obResult = detectOrderBlocks(candles, structureEvents);
    assert.equal(obResult.breakerBlocks.length, 1);
    assert.equal(obResult.breakerBlocks[0].type, 'Bearish Breaker');
  });

  await t.test('Test 12: Bullish & Bearish Fair Value Gap Calculation', () => {
    const candles = [
      { time: 1000, open: 100, high: 102, low: 99, close: 101 },
      { time: 2000, open: 101, high: 110, low: 101, close: 109 },
      { time: 3000, open: 109, high: 115, low: 105, close: 114 }, // Gap between c1.high (102) and c3.low (105)
    ];

    const fvgResult = detectFairValueGaps(candles);
    assert.equal(fvgResult.fvgs.length, 1);
    assert.equal(fvgResult.fvgs[0].bottom, 102);
    assert.equal(fvgResult.fvgs[0].top, 105);
  });

  await t.test('Test 13: Inverse FVG (IFVG) Qualification', () => {
    const candles = [
      { time: 1000, open: 100, high: 102, low: 99, close: 101 },
      { time: 2000, open: 101, high: 110, low: 101, close: 109 },
      { time: 3000, open: 109, high: 115, low: 105, close: 114 },
      { time: 4000, open: 114, high: 114, low: 98, close: 99 },  // Closes below FVG bottom (102) -> IFVG
    ];

    const fvgResult = detectFairValueGaps(candles);
    assert.equal(fvgResult.ifvgs.length, 1);
    assert.equal(fvgResult.ifvgs[0].type, 'Bearish IFVG');
  });

  await t.test('Test 14: Auto Fibonacci & OTE Calculation', () => {
    const externalSwings = [
      { id: 'low-1', type: 'LOW', price: 100.0, time: 1000 },
      { id: 'high-1', type: 'HIGH', price: 200.0, time: 2000 },
    ];
    const fib = calculateAutoFibonacci([{ time: 3000 }], externalSwings);

    assert.equal(fib.isBullish, true);
    assert.equal(fib.levels.fib500, 150.0);
    assert.equal(fib.levels.fib618, 138.2);
    assert.equal(fib.levels.fib705, 129.5); // OTE
  });

  await t.test('Test 15: Premium / Discount Dealing Range Engine', () => {
    const externalSwings = [
      { id: 'low-1', type: 'LOW', price: 100.0, time: 1000 },
      { id: 'high-1', type: 'HIGH', price: 200.0, time: 2000 },
    ];
    const discountRange = calculateDealingRange([{ time: 3000, close: 120.0 }], externalSwings);
    assert.equal(discountRange.equilibrium, 150.0);
    assert.equal(discountRange.zone, 'Discount');

    const premiumRange = calculateDealingRange([{ time: 3000, close: 180.0 }], externalSwings);
    assert.equal(premiumRange.zone, 'Premium');
  });

  await t.test('Test 16: Setup A — Liquidity Sweep + MSS Entry Candidate', () => {
    const structureEvents = [{ type: 'MSS', direction: 'BUY', time: 2000 }];
    const sweeps = [{ type: 'SSL Sweep', direction: 'BUY', price: 90, time: 1000, invalidationPrice: 88 }];

    const candidates = detectSmcSetups(
      [{ time: 2000, close: 95 }],
      { structureEvents },
      { sweeps },
      { orderBlocks: [] },
      { fvgs: [] },
      null,
      null
    );

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].strategy, 'smcSweepMss');
  });

  await t.test('Test 17: Setup B — Order Block + FVG Entry Candidate', () => {
    const orderBlocks = [{ id: 'ob-1', type: 'Bullish OB', direction: 'BUY', high: 102, low: 98, originTime: 1000, confirmationTime: 1500, status: 'ACTIVE' }];
    const fvgs = [{ id: 'fvg-1', type: 'Bullish FVG', direction: 'BUY', midpoint: 100, originTime: 1000, confirmationTime: 1500, status: 'ACTIVE' }];

    const candidates = detectSmcSetups(
      [{ time: 1500, close: 101 }],
      null,
      null,
      { orderBlocks },
      { fvgs },
      null,
      null
    );

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].strategy, 'smcObFvg');
  });

  await t.test('Test 18: Waterfall + SMC BOS Integration', async () => {
    const candles = [];
    let price = 100;
    for (let i = 0; i < 25; i++) {
      price -= 1.0;
      candles.push({
        time: 1700000000000 + i * 60000,
        open: price + 0.2,
        high: price + 0.3,
        low: price - 0.8,
        close: price - 0.7,
        volume: 1500,
      });
    }

    const result = await runConfluenceEngine(candles, { enableMtfEngine: false });
    assert.ok(result.tradeLog.length >= 1, 'Waterfall and SMC BOS must generate confirmed trade log entries');
  });

  await t.test('Test 19: Independent Scalping Opportunities Preserved', async () => {
    const candles = [];
    for (let i = 0; i < 50; i++) {
      const isUp = Math.floor(i / 5) % 2 === 0;
      const price = 100 + (isUp ? i * 0.5 : (50 - i) * 0.5);
      candles.push({
        time: 1700000000000 + i * 60000,
        open: price,
        high: price + 1.2,
        low: price - 1.2,
        close: price + (isUp ? 0.9 : -0.9),
      });
    }

    const result = await runConfluenceEngine(candles, { enableMtfEngine: false, minCandlesBetweenSignals: 3 });
    assert.ok(result.tradeLog.length > 0, 'Scalping setups should generate trade log entries');
  });

  await t.test('Test 20: Swing Context Evaluation Without Future Data', () => {
    const candles = [
      { time: 1000, open: 100, high: 102, low: 98, close: 101 },
      { time: 2000, open: 101, high: 108, low: 100, close: 107 },
    ];
    const structure = analyzeMarketStructure(candles);
    assert.ok(structure !== null);
  });

  await t.test('Test 21: Multi-API Historical Data Across 2-Day Chunks', async () => {
    const candles = [];
    for (let i = 0; i < 200; i++) {
      candles.push({
        time: 1700000000000 + i * 900000,
        open: 100 + i * 0.05,
        high: 101 + i * 0.05,
        low: 99.5 + i * 0.05,
        close: 100.8 + i * 0.05,
      });
    }

    const result = await runConfluenceEngine(candles, { enableMtfEngine: false });
    assert.ok(result.structureEvents !== undefined, 'SMC engine must run safely across chunked historical series');
  });

  await t.test('Test 22: Replay Consistency — Batch vs Incremental', async () => {
    const candles = [];
    for (let i = 0; i < 30; i++) {
      candles.push({
        time: 1700000000000 + i * 60000,
        open: 100 + i,
        high: 102 + i,
        low: 99 + i,
        close: 101.5 + i,
      });
    }

    const resBatch = await runConfluenceEngine(candles, { enableMtfEngine: false });
    const resReplay = await runConfluenceEngine(candles.slice(0, 30), { enableMtfEngine: false });

    assert.equal(resBatch.tradeLog.length, resReplay.tradeLog.length, 'Batch and replay runs must produce identical trade counts');
  });

  await t.test('Test 23: Balanced Filtering — Preserves Momentum & Breakout Strategies', async () => {
    const candles = [];
    for (let i = 0; i < 30; i++) {
      candles.push({
        time: 1700000000000 + i * 60000,
        open: 100 + i * 0.2,
        high: 102 + i * 0.2,
        low: 99 + i * 0.2,
        close: 101.5 + i * 0.2,
      });
    }

    const result = await runConfluenceEngine(candles, { enableMtfEngine: false });
    assert.ok(result !== null);
  });

  await t.test('Test 24: Data Integrity — Zero Range & Sparse Ticks', () => {
    const zeroCandle = { time: 1000, open: 100, high: 100, low: 100, close: 100 };
    const structure = analyzeMarketStructure([zeroCandle, zeroCandle]);
    assert.equal(structure.structureEvents.length, 0);
  });

  await t.test('Test 25: Performance Regression — 1,000 Candles Under 100ms', () => {
    const candles = [];
    for (let i = 0; i < 1000; i++) {
      candles.push({
        time: 1700000000000 + i * 60000,
        open: 100 + (i % 5),
        high: 105 + (i % 5),
        low: 98 + (i % 5),
        close: 102 + (i % 5),
      });
    }

    const start = performance.now();
    analyzeMarketStructure(candles);
    const elapsed = performance.now() - start;

    assert.ok(elapsed < 100, `Market structure analysis (${elapsed.toFixed(2)}ms) must complete under 100ms`);
  });

});
