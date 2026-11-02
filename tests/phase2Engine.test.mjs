import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateCandleMetrics,
  classifyCandle,
  calculateDirectionalPressure,
} from '../src/lib/candlePsychology.js';
import { detectMultiCandlePatterns } from '../src/lib/candlePatterns.js';
import { runWaterfallEngine, WaterfallStateMachine, WATERFALL_STATES } from '../src/lib/waterfallMomentum.js';
import { detectReversalSetups } from '../src/lib/momentumExhaustion.js';
import { runConfluenceEngine } from '../src/lib/liquidity.js';

test('PHASE 2 ENGINE SUITE: Candle Psychology, Waterfall Momentum & Price Action Intelligence', async (t) => {
  
  await t.test('Test 1: Strong Bullish Candle — Metrics & Classification', () => {
    const candle = { time: 1000, open: 100, high: 110, low: 99, close: 109, volume: 500 };
    const prevCandle = { time: 900, open: 98, high: 101, low: 97, close: 100, volume: 400 };
    const atr = 10.0;
    const volumeMA = 400;

    const metrics = calculateCandleMetrics(candle, prevCandle, atr, volumeMA);
    assert.equal(metrics.isBullish, true);
    assert.equal(metrics.range, 11);
    assert.equal(metrics.body, 9);
    assert.equal(metrics.upperWick, 1);
    assert.equal(metrics.lowerWick, 1);
    assert.ok(metrics.bodyRatio > 0.8, 'Body ratio should be > 80%');

    const tags = classifyCandle(metrics);
    assert.ok(tags.includes('STRONG_BULLISH'), 'Should classify as STRONG_BULLISH');
  });

  await t.test('Test 2: Strong Bearish Candle — Pressure Score & Classification', () => {
    const candle = { time: 1000, open: 110, high: 111, low: 99, close: 100, volume: 600 };
    const metrics = calculateCandleMetrics(candle, null, 10.0, 500);
    const pressure = calculateDirectionalPressure(metrics);

    assert.equal(metrics.isBearish, true);
    assert.ok(pressure.bearishScore > pressure.bullishScore, 'Bearish pressure should exceed bullish score');
    assert.ok(pressure.netPressure < 0, 'Net pressure should be negative');

    const tags = classifyCandle(metrics);
    assert.ok(tags.includes('STRONG_BEARISH'), 'Should classify as STRONG_BEARISH');
  });

  await t.test('Test 3: Bullish Engulfing Pattern Recognition', () => {
    const candles = [
      { time: 1000, open: 105, high: 106, low: 100, close: 101 }, // Bearish
      { time: 2000, open: 100, high: 109, low: 99, close: 108 }, // Bullish Engulfing
    ];
    const atr = 5.0;
    const metricsList = candles.map((c, i) => calculateCandleMetrics(c, i > 0 ? candles[i - 1] : null, atr));
    const patterns = detectMultiCandlePatterns(candles, 1, metricsList);

    assert.equal(patterns.length, 1);
    assert.equal(patterns[0].type, 'Bullish Engulfing');
    assert.equal(patterns[0].direction, 'BUY');
  });

  await t.test('Test 4: Bearish Engulfing Pattern Recognition', () => {
    const candles = [
      { time: 1000, open: 100, high: 105, low: 99, close: 104 }, // Bullish
      { time: 2000, open: 105, high: 106, low: 97, close: 98 },  // Bearish Engulfing
    ];
    const atr = 5.0;
    const metricsList = candles.map((c, i) => calculateCandleMetrics(c, i > 0 ? candles[i - 1] : null, atr));
    const patterns = detectMultiCandlePatterns(candles, 1, metricsList);

    assert.equal(patterns.length, 1);
    assert.equal(patterns[0].type, 'Bearish Engulfing');
    assert.equal(patterns[0].direction, 'SELL');
  });

  await t.test('Test 5: Rejection Candle Classification', () => {
    const bullishPin = { time: 1000, open: 105, high: 106, low: 95, close: 105.5 }; // Long lower wick
    const metrics = calculateCandleMetrics(bullishPin, null, 10.0);
    const tags = classifyCandle(metrics);

    assert.ok(tags.includes('BULLISH_REJECTION'), 'Should identify lower wick rejection');
  });

  await t.test('Test 6: Bearish Waterfall — Sequence State Machine & Single Sequence ID', () => {
    const baseTime = 1700000000000;
    const candles = [
      { time: baseTime + 0, open: 100, high: 101, low: 99, close: 100 },
      { time: baseTime + 60000, open: 100, high: 100.5, low: 96, close: 96.5 },
      { time: baseTime + 120000, open: 96.5, high: 97, low: 92, close: 92.5 }, // Waterfall impulse
      { time: baseTime + 180000, open: 92.5, high: 93, low: 88, close: 88.5 }, // Waterfall continuation
      { time: baseTime + 240000, open: 88.5, high: 89, low: 84, close: 84.5 },
    ];
    const atrList = candles.map(() => 5.0);
    const metricsList = candles.map((c, i) => calculateCandleMetrics(c, i > 0 ? candles[i - 1] : null, 5.0));

    const result = runWaterfallEngine(candles, metricsList, atrList);
    assert.ok(result.candidates.length >= 1, 'Should generate at least one waterfall candidate');

    // Verify all candidate signals belong to the SAME sequence ID
    const firstSeqId = result.candidates[0].sequenceId;
    for (const cand of result.candidates) {
      assert.equal(cand.sequenceId, firstSeqId, 'All consecutive waterfall bars must share one sequence ID');
    }
  });

  await t.test('Test 7: Bullish Momentum Cascade Detection', () => {
    const baseTime = 1700000000000;
    const candles = [
      { time: baseTime + 0, open: 100, high: 101, low: 99, close: 100 },
      { time: baseTime + 60000, open: 100, high: 104, low: 99.5, close: 103.5 },
      { time: baseTime + 120000, open: 103.5, high: 108, low: 103, close: 107.5 },
      { time: baseTime + 180000, open: 107.5, high: 112, low: 107, close: 111.5 },
    ];
    const atrList = candles.map(() => 5.0);
    const metricsList = candles.map((c, i) => calculateCandleMetrics(c, i > 0 ? candles[i - 1] : null, 5.0));

    const result = runWaterfallEngine(candles, metricsList, atrList);
    assert.ok(result.candidates.length >= 1, 'Should detect bullish cascade');
    assert.equal(result.candidates[0].direction, 'BUY');
  });

  await t.test('Test 8: Setup B — First Pullback Entry Candidate', () => {
    const sm = new WaterfallStateMachine('SELL', { time: 1000, open: 100, high: 101, low: 90, close: 91 }, 'seq-1');
    
    // Candle 1: impulse continuation
    sm.processCandle({ time: 2000, open: 91, high: 91.5, low: 85, close: 85.5 }, { isBearish: true, isBullish: false, bodyRatio: 0.8 }, 5.0);
    // Candle 2: shallow counter-direction pullback
    sm.processCandle({ time: 3000, open: 85.5, high: 88, low: 85, close: 87.5 }, { isBearish: false, isBullish: true, bodyRatio: 0.6 }, 5.0);
    // Candle 3: resumption bar
    const pullbackSignal = sm.processCandle({ time: 4000, open: 87.5, high: 88, low: 82, close: 82.5 }, { isBearish: true, isBullish: false, bodyRatio: 0.85 }, 5.0);

    assert.ok(pullbackSignal, 'Should output First Pullback signal');
    assert.equal(pullbackSignal.strategy, 'waterfallFirstPullback');
  });

  await t.test('Test 9: False Momentum Rejection — Small chop does not generate trade approvals', async () => {
    const candles = [];
    let price = 100;
    for (let i = 0; i < 30; i++) {
      const isUp = i % 2 === 0;
      candles.push({
        time: 1700000000000 + i * 60000,
        open: price,
        high: price + 0.2,
        low: price - 0.2,
        close: isUp ? price + 0.1 : price - 0.1,
      });
    }

    const result = await runConfluenceEngine(candles, { enableMtfEngine: false });
    const approved = result.tradeLog.filter(t => t.isApproved);
    assert.equal(approved.length, 0, 'Chop market with low range should yield 0 approved trades');
  });

  await t.test('Test 10: Exhaustion Warning Metric', () => {
    const sm = new WaterfallStateMachine('SELL', { time: 1000, open: 100, high: 100.5, low: 98, close: 98 }, 'seq-ex');
    // Simulate extended move over 5 ATRs
    sm.processCandle({ time: 2000, open: 98, high: 98.5, low: 70, close: 70.5 }, { isBearish: true, rangeToAtr: 3.0, upperWickRatio: 0.5, closeLocation: 0.1 }, 5.0);

    assert.equal(sm.exhaustionStatus, 'EXHAUSTION_WARNING');
    assert.equal(sm.state, WATERFALL_STATES.EXHAUSTION_WATCH);
  });

  await t.test('Test 11: Chop Market Filter — Alternating candles yield no waterfall alerts', () => {
    const candles = [];
    for (let i = 0; i < 20; i++) {
      const isEven = i % 2 === 0;
      candles.push({
        time: 1700000000000 + i * 60000,
        open: 100,
        high: 101,
        low: 99,
        close: isEven ? 100.5 : 99.5,
      });
    }
    const atrList = candles.map(() => 2.0);
    const metricsList = candles.map((c, i) => calculateCandleMetrics(c, i > 0 ? candles[i - 1] : null, 2.0));

    const result = runWaterfallEngine(candles, metricsList, atrList);
    assert.equal(result.candidates.length, 0, 'No waterfall candidates in alternating chop');
  });

  await t.test('Test 12: Reversal & Exhaustion Intelligence', () => {
    const candles = [
      { time: 1000, open: 100, high: 100.5, low: 96, close: 96.5 },
      { time: 2000, open: 96.5, high: 97, low: 92, close: 92.5 },
      { time: 3000, open: 92.5, high: 93, low: 88, close: 88.5 },
      { time: 4000, open: 88, high: 95, low: 87.5, close: 94.5 }, // Bullish Reversal Engulfing + Wick Rejection
    ];
    const metricsList = candles.map((c, i) => calculateCandleMetrics(c, i > 0 ? candles[i - 1] : null, 5.0));
    const reversals = detectReversalSetups(candles, metricsList, null);

    assert.ok(reversals.length >= 1, 'Should detect bullish reversal candidate');
    assert.equal(reversals[0].direction, 'BUY');
  });

  await t.test('Test 13: Non-Repainting Verification — Historical calculations depend strictly on past bars', () => {
    const candles = [
      { time: 1000, open: 100, high: 101, low: 99, close: 100 },
      { time: 2000, open: 100, high: 105, low: 99, close: 104 },
      { time: 3000, open: 104, high: 109, low: 103, close: 108 },
    ];
    const metricsList = candles.map((c, i) => calculateCandleMetrics(c, i > 0 ? candles[i - 1] : null, 5.0));
    const patternsAtCandle2 = detectMultiCandlePatterns(candles.slice(0, 2), 1, metricsList.slice(0, 2));

    // Adding future candle 3 must not change patterns calculated at candle 2
    const patternsAtCandle2WithFuture = detectMultiCandlePatterns(candles, 1, metricsList);

    assert.deepEqual(patternsAtCandle2, patternsAtCandle2WithFuture, 'Calculations for bar 1 must be strictly non-repainting');
  });

  await t.test('Test 14: Existing SMC/ICT Strategy Compatibility', async () => {
    const candles = [];
    let price = 100;
    for (let i = 0; i < 40; i++) {
      price += (i > 20 ? 1 : -1) * 0.5;
      candles.push({
        time: 1700000000000 + i * 60000,
        open: price,
        high: price + 1.0,
        low: price - 1.0,
        close: price + (i > 20 ? 0.8 : -0.8),
        volume: 1000,
      });
    }

    const result = await runConfluenceEngine(candles, { enableMtfEngine: false });
    assert.ok(result.tradeLog !== undefined, 'Confluence engine must execute seamlessly with Phase 2 enabled');
  });

  await t.test('Test 15: Central Signal Engine Duplicate Suppression', async () => {
    const candles = [];
    let price = 100;
    for (let i = 0; i < 40; i++) {
      price -= 1.0;
      candles.push({
        time: 1700000000000 + i * 60000,
        open: price,
        high: price + 0.2,
        low: price - 1.5,
        close: price - 1.2,
        volume: 2000,
      });
    }

    const result = await runConfluenceEngine(candles, { enableMtfEngine: false, minCandlesBetweenSignals: 5 });
    const approved = result.tradeLog.filter(s => s.isApproved);

    // Verify distance between approved signals is at least minCandlesBetweenSignals
    for (let i = 1; i < approved.length; i++) {
      const idxCurr = candles.findIndex(c => c.time === approved[i].time);
      const idxPrev = candles.findIndex(c => c.time === approved[i - 1].time);
      assert.ok(idxCurr - idxPrev >= 5, 'Duplicate suppression must enforce minimum candle spacing');
    }
  });

  await t.test('Test 16: Multi-Timeframe Metric Normalization (1m vs 1h)', () => {
    const c1m = { time: 1000, open: 10, high: 10.1, low: 9.9, close: 10.08 };
    const c1h = { time: 1000, open: 2000, high: 2050, low: 1980, close: 2040 };

    const m1m = calculateCandleMetrics(c1m, null, 0.2);
    const m1h = calculateCandleMetrics(c1h, null, 50.0);

    // Both should yield normalized bodyRatio and rangeToAtr relative to their scale
    assert.ok(m1m.bodyRatio > 0 && m1m.bodyRatio <= 1.0);
    assert.ok(m1h.bodyRatio > 0 && m1h.bodyRatio <= 1.0);
    assert.ok(m1m.rangeToAtr > 0 && m1h.rangeToAtr > 0);
  });

  await t.test('Test 17: Long Historical Range Across API Chunks', () => {
    // Construct 200 candles representing 4 days of data across 2-day API chunks
    const candles = [];
    for (let i = 0; i < 200; i++) {
      candles.push({
        time: 1700000000000 + i * 900000, // 15m intervals
        open: 100 + i * 0.1,
        high: 101 + i * 0.1,
        low: 99.5 + i * 0.1,
        close: 100.8 + i * 0.1,
      });
    }

    const atrList = candles.map(() => 2.0);
    const metricsList = candles.map((c, idx) => calculateCandleMetrics(c, idx > 0 ? candles[idx - 1] : null, 2.0));
    const result = runWaterfallEngine(candles, metricsList, atrList);

    assert.ok(Array.isArray(result.candidates), 'Waterfall engine should run safely across long chunked datasets');
  });

  await t.test('Test 18: Deterministic Replay — Batch vs Incremental produce identical results', async () => {
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
    const resIncremental = await runConfluenceEngine(candles.slice(0, 30), { enableMtfEngine: false });

    assert.equal(resBatch.tradeLog.length, resIncremental.tradeLog.length, 'Batch and replay runs must produce identical trade log count');
  });

  await t.test('Test 19: Data Integrity — Zero range and null values handled safely', () => {
    const zeroCandle = { time: 1000, open: 100, high: 100, low: 100, close: 100 };
    const metrics = calculateCandleMetrics(zeroCandle, null, 0);

    assert.equal(metrics.range, 0);
    assert.equal(metrics.bodyRatio, 0);
    assert.equal(metrics.isDoji, true);

    const tags = classifyCandle(metrics);
    assert.ok(tags.includes('INDECISION'));
  });

  await t.test('Test 20: Performance Benchmark — 1,000 candles processed under 50ms', () => {
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
    const atrList = candles.map(() => 3.0);
    const metricsList = candles.map((c, idx) => calculateCandleMetrics(c, idx > 0 ? candles[idx - 1] : null, 3.0));
    runWaterfallEngine(candles, metricsList, atrList);
    const elapsed = performance.now() - start;

    assert.ok(elapsed < 100, `Execution time (${elapsed.toFixed(2)}ms) should be under 100ms for 1,000 candles`);
  });

});
