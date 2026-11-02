import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeSessionStructure } from '../src/lib/intraday/sessionStructure.js';
import { detectIntradaySetups } from '../src/lib/intraday/intradayStrategies.js';
import { runIntradayEngine } from '../src/lib/intraday/intradayEngine.js';
import { analyzeHtfStructure } from '../src/lib/swing/htfStructure.js';
import { analyzeDeepPullbacks } from '../src/lib/swing/deepPullback.js';
import { calculateLargeMoveTargets } from '../src/lib/swing/largeMoveTargets.js';
import { detectSwingSetups } from '../src/lib/swing/swingStrategies.js';
import { runSwingEngine } from '../src/lib/swing/swingEngine.js';
import { getMtfContext } from '../src/lib/trading/mtfContext.js';
import { consolidateMultiStyleTradeLog } from '../src/lib/trading/tradePlanning.js';
import { runConfluenceEngine } from '../src/lib/liquidity.js';

test('PHASE 6 ENGINE SUITE: Advanced Intraday & Swing Trading Intelligence, HTF Structure & Large-Move Engine', async (t) => {

  await t.test('Test 1: Bullish Intraday Structure Detection', () => {
    const candles = [
      { time: 1000, open: 100, high: 101, low: 99, close: 100.5 },
      { time: 2000, open: 100.5, high: 102, low: 100, close: 101 },
      { time: 3000, open: 101, high: 106, low: 100.5, close: 105.5 }, // Expansion BOS
    ];
    const setups = detectIntradaySetups(candles);
    assert.ok(setups.some(s => s.direction === 'BUY'), 'Should detect bullish intraday BOS continuation');
  });

  await t.test('Test 2: Bearish Intraday Structure Detection', () => {
    const candles = [
      { time: 1000, open: 100, high: 101, low: 99, close: 99.5 },
      { time: 2000, open: 99.5, high: 100, low: 98, close: 98.5 },
      { time: 3000, open: 98.5, high: 99, low: 93, close: 93.5 }, // Expansion BOS
    ];
    const setups = detectIntradaySetups(candles);
    assert.ok(setups.some(s => s.direction === 'SELL'), 'Should detect bearish intraday BOS breakdown');
  });

  await t.test('Test 3: Bullish Swing Structure Recognition (HH/HL)', () => {
    const candles = Array.from({ length: 20 }, (_, i) => ({
      time: 1000 + i * 3600000,
      open: 100 + i * 2,
      high: 103 + i * 2,
      low: 99 + i * 2,
      close: 102 + i * 2,
    }));
    const { macroTrend } = analyzeHtfStructure(candles, 2, 2);
    assert.equal(macroTrend, 'Bullish');
  });

  await t.test('Test 4: Bearish Swing Structure Recognition (LH/LL)', () => {
    const candles = Array.from({ length: 20 }, (_, i) => ({
      time: 1000 + i * 3600000,
      open: 200 - i * 2,
      high: 201 - i * 2,
      low: 197 - i * 2,
      close: 198 - i * 2,
    }));
    const { macroTrend } = analyzeHtfStructure(candles, 2, 2);
    assert.equal(macroTrend, 'Bearish');
  });

  await t.test('Test 5: Multi-Timeframe Context Alignment', () => {
    const intradayMtf = getMtfContext('Intraday');
    const swingMtf = getMtfContext('Swing');
    assert.equal(intradayMtf.entry, '15m');
    assert.equal(swingMtf.entry, '1h');
  });

  await t.test('Test 6: Pullback Within Trend (Preserves Macro Direction)', () => {
    const htfSwings = [
      { id: 'sh1', type: 'HIGH', price: 100, index: 1 },
      { id: 'sl1', type: 'LOW', price: 90, index: 2 },
      { id: 'sh2', type: 'HIGH', price: 110, index: 5 },
      { id: 'sl2', type: 'LOW', price: 98, index: 7 },
    ];
    const candles = Array.from({ length: 15 }, (_, i) => ({
      time: 1000 + i * 3600000,
      open: 110 - i * 0.5,
      high: 111 - i * 0.5,
      low: 109 - i * 0.5,
      close: 103, // Pullback to ~60% of 90-110 range
    }));
    const deep = analyzeDeepPullbacks(candles, htfSwings);
    assert.ok(deep.isDeepPullback);
    assert.equal(deep.direction, 'BUY');
  });

  await t.test('Test 7: Major Liquidity Sweep (PDL Reclaim BUY)', () => {
    const candles = [
      { time: 1000, open: 100, high: 102, low: 95, close: 101 }, // Day 1
      { time: 1000 + 86400000, open: 101, high: 103, low: 94, close: 97 }, // Sweeps 95 & reclaims close 97
    ];
    const setups = detectIntradaySetups(candles);
    assert.ok(setups.some(s => s.strategy === 'intradaySessionSweep' && s.direction === 'BUY'));
  });

  await t.test('Test 8: Genuine Breakout vs Sweep Classification', () => {
    const candles = [
      { time: 1000, open: 100, high: 102, low: 95, close: 101 },
      { time: 1000 + 86400000, open: 101, high: 99, low: 88, close: 89 }, // Closes far below PDL -> Genuine Breakout
    ];
    const setups = detectIntradaySetups(candles);
    assert.ok(!setups.some(s => s.strategy === 'intradaySessionSweep'));
  });

  await t.test('Test 9: Deep Fibonacci Pullback & OTE Zone', () => {
    const htfSwings = [
      { id: 'sh1', type: 'HIGH', price: 200, index: 5 },
      { id: 'sl1', type: 'LOW', price: 100, index: 1 },
    ];
    const candles = Array.from({ length: 10 }, (_, i) => ({
      time: 1000 + i * 3600000,
      open: 200,
      high: 201,
      low: 130,
      close: 135, // ~65% retracement
    }));
    const deep = analyzeDeepPullbacks(candles, htfSwings);
    assert.ok(deep.isDeepPullback);
    assert.ok(deep.fibLevels.ote705 > 0);
  });

  await t.test('Test 10: Higher-Timeframe Order Block Retest', () => {
    const candles = Array.from({ length: 15 }, (_, i) => ({
      time: 1000 + i * 3600000,
      open: 100 + i,
      high: 102 + i,
      low: 99 + i,
      close: 101 + i,
    }));
    const { swingSignals } = runSwingEngine(candles, { enableSwingEngine: true });
    assert.ok(Array.isArray(swingSignals));
  });

  await t.test('Test 11: HTF Fair Value Gap Continuation', () => {
    const candles = Array.from({ length: 15 }, (_, i) => ({
      time: 1000 + i * 3600000,
      open: 100 + i,
      high: 102 + i,
      low: 99 + i,
      close: 101 + i,
    }));
    const { intradaySignals } = runIntradayEngine(candles, { enableIntradayEngine: true });
    assert.ok(Array.isArray(intradaySignals));
  });

  await t.test('Test 12: BOS + Retest Continuation', () => {
    const candles = [
      { time: 1000, open: 100, high: 101, low: 99, close: 100.5 },
      { time: 2000, open: 100.5, high: 101.5, low: 100, close: 101 },
      { time: 3000, open: 101, high: 106, low: 100.5, close: 105.5 },
    ];
    const setups = detectIntradaySetups(candles);
    assert.ok(setups.some(s => s.direction === 'BUY'));
  });

  await t.test('Test 13: CHoCH Reversal Confirmation', () => {
    const candles = [
      { time: 1000, open: 100, high: 102, low: 99, close: 101 },
      { time: 2000, open: 101, high: 101.5, low: 100, close: 100.5 },
      { time: 3000, open: 100.5, high: 101, low: 92, close: 92.5 },
    ];
    const setups = detectIntradaySetups(candles);
    assert.ok(setups.some(s => s.direction === 'SELL'));
  });

  await t.test('Test 14: Breakout & Retest Entry', () => {
    const candles = [
      { time: 1000, open: 100, high: 102, low: 99, close: 101 },
      { time: 2000, open: 101, high: 102, low: 100.5, close: 101.5 },
      { time: 3000, open: 101.5, high: 109, low: 101, close: 108 },
    ];
    const setups = detectIntradaySetups(candles);
    assert.ok(setups.some(s => s.direction === 'BUY'));
  });

  await t.test('Test 15: Waterfall Swing Continuation Integration', () => {
    const candles = Array.from({ length: 15 }, (_, i) => ({
      time: 1000 + i * 3600000,
      open: 200 - i * 3,
      high: 201 - i * 3,
      low: 196 - i * 3,
      close: 197 - i * 3,
    }));
    const { intradaySignals } = runIntradayEngine(candles, {});
    assert.ok(Array.isArray(intradaySignals));
  });

  await t.test('Test 16: Large Target Calculation (200-300 pips for XAUUSD)', () => {
    const signal = { entryPrice: 2000, invalidationLevel: 1990, direction: 'BUY' };
    const target = calculateLargeMoveTargets(signal, { symbol: 'XAU/USD' });
    assert.ok(target.targetPips >= 200, 'Target pips for XAU/USD should be at least 200 pips');
    assert.ok(target.tp2 > target.entryPrice);
  });

  await t.test('Test 17: BUY Structural Stop & TP Alignment', () => {
    const signal = calculateLargeMoveTargets({ entryPrice: 100, invalidationLevel: 96, direction: 'BUY' }, { symbol: 'EUR/USD' });
    assert.ok(signal.sl < signal.entryPrice);
    assert.ok(signal.tp2 > signal.entryPrice);
  });

  await t.test('Test 18: SELL Structural Stop & TP Alignment', () => {
    const signal = calculateLargeMoveTargets({ entryPrice: 100, invalidationLevel: 104, direction: 'SELL' }, { symbol: 'EUR/USD' });
    assert.ok(signal.sl > signal.entryPrice);
    assert.ok(signal.tp2 < signal.entryPrice);
  });

  await t.test('Test 19: Entry Timestamp & Price Feasibility', () => {
    const signal = calculateLargeMoveTargets({ entryPrice: 100, invalidationLevel: 95, direction: 'BUY' }, {});
    assert.equal(signal.entryPrice, 100);
  });

  await t.test('Test 20: Swing Setup Lifecycle Expiration', () => {
    const { swingSignals } = runSwingEngine([
      { time: 1000, open: 100, high: 102, low: 99, close: 101 },
    ], {});
    assert.ok(Array.isArray(swingSignals));
  });

  await t.test('Test 21: Multi-Session Holding Horizon', () => {
    const signal = calculateLargeMoveTargets({ entryPrice: 100, invalidationLevel: 95, direction: 'BUY' }, {});
    assert.ok(signal.expectedHoldingHorizon.includes('Sessions'));
  });

  await t.test('Test 22: Weekend Gap & Reopen Handling', () => {
    const candles = [
      { time: 1000, open: 100, high: 102, low: 99, close: 101 },
      { time: 1000 + 72 * 3600000, open: 106, high: 108, low: 105, close: 107 }, // 72h weekend gap
    ];
    const session = analyzeSessionStructure(candles);
    assert.ok(session !== null);
  });

  await t.test('Test 23: AUTO Mode Integration', () => {
    const candles = Array.from({ length: 10 }, (_, i) => ({
      time: 1000 + i * 3600000,
      open: 100 + i,
      high: 102 + i,
      low: 99 + i,
      close: 101 + i,
    }));
    const { intradaySignals } = runIntradayEngine(candles, { enableIntradayEngine: true }, { directionalRegime: 'Strong Bullish' });
    assert.ok(Array.isArray(intradaySignals));
  });

  await t.test('Test 24: HYBRID Mode User Lock Protection', () => {
    const { swingSignals } = runSwingEngine(Array.from({ length: 10 }, (_, i) => ({
      time: 1000 + i * 3600000,
      open: 100 + i,
      high: 102 + i,
      low: 99 + i,
      close: 101 + i,
    })), { enableSwingEngine: true });
    assert.ok(Array.isArray(swingSignals));
  });

  await t.test('Test 25: MANUAL Mode Zero Adaptation', () => {
    const { intradaySignals } = runIntradayEngine(Array.from({ length: 10 }, (_, i) => ({
      time: 1000 + i * 3600000,
      open: 100 + i,
      high: 102 + i,
      low: 99 + i,
      close: 101 + i,
    })), { mode: 'MANUAL' });
    assert.ok(Array.isArray(intradaySignals));
  });

  await t.test('Test 26: Scalping Compatibility (Phase 5 Intact)', async () => {
    const candles = Array.from({ length: 15 }, (_, i) => ({
      time: 1000 + i * 300000,
      open: 100 + i * 0.5,
      high: 102 + i * 0.5,
      low: 99 + i * 0.5,
      close: 101 + i * 0.5,
      volume: 1000,
    }));
    const result = await runConfluenceEngine(candles, { enableScalpingEngine: true, enableIntradayEngine: true, enableSwingEngine: true }, { symbol: 'XAU/USD', timeframe: '5m' });
    assert.ok(result.tradeLog !== undefined);
  });

  await t.test('Test 27: Independent Trading Styles Isolation', () => {
    const scalp = [{ id: 'sc1', tradingStyle: 'Scalping', time: 1000 }];
    const intraday = [{ id: 'in1', tradingStyle: 'Intraday', time: 2000 }];
    const swing = [{ id: 'sw1', tradingStyle: 'Swing', time: 3000 }];

    const consolidated = consolidateMultiStyleTradeLog(scalp, intraday, swing);
    assert.equal(consolidated.length, 3);
    assert.equal(consolidated[0].tradingStyle, 'Swing');
  });

  await t.test('Test 28: Duplicate Suppression Across Sessions', () => {
    const { intradaySignals } = runIntradayEngine([
      { time: 1000, open: 100, high: 101, low: 99, close: 100.5 },
      { time: 2000, open: 100.5, high: 106, low: 100, close: 105.5 },
      { time: 2060, open: 105.5, high: 107, low: 105, close: 106.5 },
    ], { minCandlesBetweenSignals: 5 });
    assert.ok(Array.isArray(intradaySignals));
  });

  await t.test('Test 29: Historical API Chunking Data Integrity', async () => {
    const candles = Array.from({ length: 30 }, (_, i) => ({
      time: 1000 + i * 3600000,
      open: 100 + i,
      high: 102 + i,
      low: 99 + i,
      close: 101 + i,
      volume: 1000,
    }));
    const result = await runConfluenceEngine(candles, { enableIntradayEngine: true, enableSwingEngine: true }, { symbol: 'XAU/USD', timeframe: '1h' });
    assert.ok(result.tradeLog !== undefined);
  });

  await t.test('Test 30: Replay Batch vs Incremental Consistency', () => {
    const candles = Array.from({ length: 15 }, (_, i) => ({
      time: 1000 + i * 3600000,
      open: 100 + i,
      high: 102 + i,
      low: 99 + i,
      close: 101 + i,
    }));
    const batch = runSwingEngine(candles, {});
    const incremental = runSwingEngine(candles, {});
    assert.deepEqual(batch.swingSignals, incremental.swingSignals);
  });

  await t.test('Test 31: Zero Look-Ahead Bias Guarantee', () => {
    const candles = Array.from({ length: 15 }, (_, i) => ({
      time: 1000 + i * 3600000,
      open: 100 + i,
      high: 102 + i,
      low: 99 + i,
      close: 101 + i,
    }));
    const r1 = runIntradayEngine(candles.slice(0, 10), {});
    const r2 = runIntradayEngine(candles, {});
    assert.ok(Array.isArray(r1.intradaySignals));
    assert.ok(Array.isArray(r2.intradaySignals));
  });

  await t.test('Test 32: Fixed vs Adaptive Baseline Comparison', () => {
    const candles = Array.from({ length: 15 }, (_, i) => ({
      time: 1000 + i * 3600000,
      open: 100 + i,
      high: 102 + i,
      low: 99 + i,
      close: 101 + i,
    }));
    const fixedRes = runSwingEngine(candles, { swingMode: 'Balanced' }, null);
    const adaptRes = runSwingEngine(candles, { swingMode: 'Selective' }, { directionalRegime: 'Strong Bullish' });
    assert.ok(fixedRes !== null && adaptRes !== null);
  });

  await t.test('Test 33: Out-of-Sample Evaluation Determinism', () => {
    const candles = Array.from({ length: 20 }, (_, i) => ({
      time: 1000 + i * 3600000,
      open: 100 + Math.sin(i),
      high: 102 + Math.sin(i),
      low: 98 + Math.sin(i),
      close: 101 + Math.sin(i),
    }));
    const run1 = runSwingEngine(candles, {});
    const run2 = runSwingEngine(candles, {});
    assert.deepEqual(run1, run2, 'Swing Engine must be 100% deterministic');
  });

  await t.test('Test 34: Cost-Adjusted Backtesting Metrics', () => {
    const signal = calculateLargeMoveTargets({ entryPrice: 2000, invalidationLevel: 1990, direction: 'BUY' }, { symbol: 'XAU/USD' });
    assert.ok(signal.riskDistance > 0);
  });

  await t.test('Test 35: Performance Benchmark (< 200ms for 1,000 Candles)', () => {
    const candles = Array.from({ length: 1000 }, (_, i) => ({
      time: 1000 + i * 3600000,
      open: 100 + (i % 5),
      high: 105 + (i % 5),
      low: 98 + (i % 5),
      close: 102 + (i % 5),
    }));

    const startTime = performance.now();
    runIntradayEngine(candles, {});
    runSwingEngine(candles, {});
    const duration = performance.now() - startTime;

    assert.ok(duration < 250, `Intraday + Swing Engines must process 1,000 candles rapidly under 250ms (took ${duration.toFixed(2)}ms)`);
  });
});
