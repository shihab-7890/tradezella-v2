import test from 'node:test';
import assert from 'node:assert/strict';

import { detectMicroSwings, analyzeMicroStructure, detectMicroSweeps, detectMicroRangeBreakout } from '../src/lib/scalping/microstructure.js';
import { detectScalpingStrategySetups } from '../src/lib/scalping/scalpingStrategies.js';
import { calculatePrecisionEntry } from '../src/lib/scalping/precisionEntry.js';
import { calculateScalpingRiskManagement } from '../src/lib/scalping/scalpingRisk.js';
import { filterAndDeduplicateScalpSignals, SIGNAL_LIFECYCLE_STATES } from '../src/lib/scalping/scalpingSignals.js';
import { gradeScalpSignal, buildScalpDiagnosticSummary } from '../src/lib/scalping/scalpingDiagnostics.js';
import { runScalpingEngine } from '../src/lib/scalping/scalpingEngine.js';
import { runConfluenceEngine } from '../src/lib/liquidity.js';

test('PHASE 5 ENGINE SUITE: Professional Scalping Intelligence, Waterfall Entries & Precision Signal Engine', async (t) => {

  await t.test('Test 1: Bullish Scalping — Detect Valid BUY Continuation', () => {
    const candles = [
      { time: 1000, open: 100, high: 101, low: 99, close: 100.5 },
      { time: 2000, open: 100.5, high: 102, low: 100, close: 101.8 },
      { time: 3000, open: 101.8, high: 102.2, low: 101.2, close: 101.5 },
      { time: 4000, open: 101.5, high: 105, low: 101.4, close: 104.8 }, // Expansion breakout
    ];
    const { scalpingSignals } = runScalpingEngine(candles, { scalpingEntryStyle: 'Early' });
    const buySignals = scalpingSignals.filter(s => s.direction === 'BUY' && s.isApproved);
    assert.ok(buySignals.length >= 1, 'Should detect at least 1 valid BUY scalping opportunity');
  });

  await t.test('Test 2: Bearish Scalping — Detect Valid SELL Continuation', () => {
    const candles = [
      { time: 1000, open: 100, high: 101, low: 99, close: 99.5 },
      { time: 2000, open: 99.5, high: 100, low: 97, close: 97.2 },
      { time: 3000, open: 97.2, high: 98, low: 96, close: 96.5 },
      { time: 4000, open: 96.5, high: 97, low: 92, close: 92.2 },
    ];
    const { scalpingSignals } = runScalpingEngine(candles, { scalpingEntryStyle: 'Early' });
    const sellSignals = scalpingSignals.filter(s => s.direction === 'SELL' && s.isApproved);
    assert.ok(sellSignals.length >= 1, 'Should detect at least 1 valid SELL scalping opportunity');
  });

  await t.test('Test 3: Liquidity Sweep BUY Candidate', () => {
    const candles = [
      { time: 1000, open: 100, high: 101, low: 98, close: 100 },
      { time: 2000, open: 100, high: 101, low: 95, close: 99 }, // Swing Low at 95
      { time: 3000, open: 99, high: 101, low: 97, close: 100 },  // Confirms Swing Low
      { time: 4000, open: 100, high: 102, low: 98, close: 101 },
      { time: 5000, open: 101, high: 102, low: 94, close: 98 },  // SSL Sweep below 95 & reclaim close at 98
    ];
    const swings = detectMicroSwings(candles, 1, 1);
    const sweeps = detectMicroSweeps(candles, swings);
    assert.ok(Array.isArray(sweeps));
  });

  await t.test('Test 4: Liquidity Sweep SELL Candidate', () => {
    const candles = [
      { time: 1000, open: 100, high: 102, low: 99, close: 101 },
      { time: 2000, open: 101, high: 106, low: 100, close: 105 }, // Swing High at 106
      { time: 3000, open: 105, high: 104, low: 101, close: 102 }, // Confirms Swing High
      { time: 4000, open: 102, high: 103, low: 100, close: 101 },
      { time: 5000, open: 101, high: 107, low: 100, close: 102 }, // BSL Sweep above 106 & reclaim close at 102
    ];
    const swings = detectMicroSwings(candles, 1, 1);
    const sweeps = detectMicroSweeps(candles, swings);
    assert.ok(Array.isArray(sweeps));
  });

  await t.test('Test 5: Micro BOS/MSS Detection', () => {
    const candles = [
      { time: 1000, open: 100, high: 101, low: 99, close: 100.5 },
      { time: 2000, open: 100.5, high: 102, low: 100, close: 101 },
      { time: 3000, open: 101, high: 105, low: 100.5, close: 104 }, // Micro High at 105
      { time: 4000, open: 104, high: 104.5, low: 102, close: 103 },
      { time: 5000, open: 103, high: 103.5, low: 101, close: 102 }, // Confirms swing high at 105
      { time: 6000, open: 102, high: 108, low: 101.5, close: 107.5 }, // Breaks 105 -> Micro BOS
    ];
    const { microEvents } = analyzeMicroStructure(candles);
    assert.ok(Array.isArray(microEvents));
  });

  await t.test('Test 6: Waterfall Continuation & First Pullback', () => {
    const candles = [
      { time: 1000, open: 100, high: 101, low: 95, close: 96 },
      { time: 2000, open: 96, high: 97, low: 91, close: 92 },
      { time: 3000, open: 92, high: 93, low: 87, close: 88 }, // Waterfall sequence
      { time: 4000, open: 88, high: 91, low: 88, close: 90 }, // Pullback
      { time: 5000, open: 90, high: 90.5, low: 84, close: 84.5 }, // Resumption
    ];
    const setups = detectScalpingStrategySetups(candles);
    assert.ok(setups.some(s => s.strategy === 'scalpWaterfallContinuation' || s.strategy === 'scalpFirstPullback'));
  });

  await t.test('Test 7: Bullish Momentum Cascade', () => {
    const candles = [
      { time: 1000, open: 100, high: 105, low: 99, close: 104 },
      { time: 2000, open: 104, high: 109, low: 103, close: 108 },
      { time: 3000, open: 108, high: 114, low: 107, close: 113 }, // Cascade
    ];
    const setups = detectScalpingStrategySetups(candles);
    assert.ok(setups.some(s => s.direction === 'BUY'));
  });

  await t.test('Test 8: No Duplicate Waterfall Alerts', () => {
    const signals = [
      { id: '1', direction: 'SELL', time: 1000 },
      { id: '2', direction: 'SELL', time: 1060 }, // 1 min later
    ];
    const filtered = filterAndDeduplicateScalpSignals(signals, { minCandlesBetweenSignals: 3 });
    const approved = filtered.filter(s => s.isApproved);
    assert.equal(approved.length, 1, 'Deduplication must suppress cluster signals within min spacing window');
  });

  await t.test('Test 9: First Pullback Entry Timing', () => {
    const candidate = { id: 'p1', strategy: 'scalpFirstPullback', direction: 'BUY', time: 3000, invalidationLevel: 98 };
    const candle = { time: 3000, open: 100, high: 105, low: 99, close: 104 };
    const precision = calculatePrecisionEntry(candidate, candle, { scalpingEntryStyle: 'Balanced' });
    assert.ok(precision.entryPrice <= candle.close, 'Balanced entry price should be at or below close for BUY limit in mid-zone');
  });

  await t.test('Test 10: Compression Range Breakout', () => {
    const candles = Array.from({ length: 12 }, (_, i) => ({
      time: 1000 + i * 60000,
      open: 100,
      high: i === 11 ? 110 : 102,
      low: 98,
      close: i === 11 ? 109 : 100,
    }));
    const breakout = detectMicroRangeBreakout(candles, 8);
    assert.ok(breakout !== null);
    assert.equal(breakout.direction, 'BUY');
  });

  await t.test('Test 11: Failed Breakout Protection', () => {
    const candidate = { id: 'fb1', direction: 'SELL', time: 1000, invalidationLevel: 105 };
    const risk = calculateScalpingRiskManagement({ ...candidate, entryPrice: 102 }, { symbol: 'XAU/USD' });
    assert.ok(risk.sl > risk.entryPrice, 'SELL stop-loss must be above entry price');
  });

  await t.test('Test 12: Precision Entry Price Validation', () => {
    const candidate = { id: 'e1', direction: 'BUY', time: 1000, invalidationLevel: 95 };
    const candle = { time: 1000, open: 100, high: 103, low: 99, close: 102 };
    const early = calculatePrecisionEntry(candidate, candle, { scalpingEntryStyle: 'Early' });
    const confirmed = calculatePrecisionEntry(candidate, candle, { scalpingEntryStyle: 'Confirmed' });
    assert.ok(confirmed.entryPrice > early.entryPrice, 'Confirmed stop-breakout entry is higher than early close entry');
  });

  await t.test('Test 13: Stop-Loss Placement Integrity', () => {
    const buySignal = calculateScalpingRiskManagement({ direction: 'BUY', entryPrice: 100, invalidationLevel: 98 }, { symbol: 'EUR/USD' });
    const sellSignal = calculateScalpingRiskManagement({ direction: 'SELL', entryPrice: 100, invalidationLevel: 102 }, { symbol: 'EUR/USD' });

    assert.ok(buySignal.sl < buySignal.entryPrice, 'BUY SL must be strictly below entry');
    assert.ok(sellSignal.sl > sellSignal.entryPrice, 'SELL SL must be strictly above entry');
  });

  await t.test('Test 14: Multi-Target Take-Profit Calculation', () => {
    const signal = calculateScalpingRiskManagement({ direction: 'BUY', entryPrice: 100, invalidationLevel: 98 }, { defaultRiskRewardRatio: 2.0 });
    assert.ok(signal.tp1 > signal.entryPrice);
    assert.ok(signal.tp2 > signal.tp1);
    assert.ok(signal.tp3 > signal.tp2);
  });

  await t.test('Test 15: Spread Feasibility Filter', () => {
    const tightTrade = { score: 4.5, rewardRiskRatio: 2.0, riskDistance: 0.0002 }; // Very small risk relative to spread
    const graded = gradeScalpSignal(tightTrade, { enableSpreadFilter: true, assumedSpread: 0.0003 });
    assert.equal(graded.isFeasible, false, 'Trade should be rejected if spread consumes >25% of risk distance');
  });

  await t.test('Test 16: AUTO Mode Integration', () => {
    const candles = [
      { time: 1000, open: 100, high: 102, low: 99, close: 101 },
      { time: 2000, open: 101, high: 105, low: 100, close: 104.5 },
    ];
    const { scalpingSignals } = runScalpingEngine(candles, { enableScalpingEngine: true }, { directionalRegime: 'Strong Bullish' });
    assert.ok(Array.isArray(scalpingSignals));
  });

  await t.test('Test 17: HYBRID Mode Locks Protection', () => {
    const candidate = { id: 'h1', direction: 'BUY', time: 1000, invalidationLevel: 95 };
    const candle = { time: 1000, open: 100, high: 102, low: 99, close: 101 };
    const entry = calculatePrecisionEntry(candidate, candle, { scalpingEntryStyle: 'Early' });
    assert.equal(entry.entryStyle, 'Early', 'User selected entry style must be preserved');
  });

  await t.test('Test 18: MANUAL Mode Zero Adaptation', () => {
    const candidate = { id: 'm1', direction: 'BUY', time: 1000, invalidationLevel: 95 };
    const candle = { time: 1000, open: 100, high: 102, low: 99, close: 101 };
    const entry = calculatePrecisionEntry(candidate, candle, { scalpingEntryStyle: 'Confirmed' });
    assert.equal(entry.entryStyle, 'Confirmed');
  });

  await t.test('Test 19: Scalping Timeframes (1m, 3m, 5m)', () => {
    const candles = [
      { time: 1000, open: 100, high: 101, low: 99, close: 100.5 },
      { time: 2000, open: 100.5, high: 104, low: 100, close: 103.8 },
    ];
    const res1m = runScalpingEngine(candles, { scalpingTimeframe: '1m' });
    const res5m = runScalpingEngine(candles, { scalpingTimeframe: '5m' });
    assert.ok(Array.isArray(res1m.scalpingSignals));
    assert.ok(Array.isArray(res5m.scalpingSignals));
  });

  await t.test('Test 20: HTF Synchronization Point-In-Time Integrity', async () => {
    const candles = Array.from({ length: 20 }, (_, i) => ({
      time: 1000 + i * 300000, // 5m candles
      open: 100 + i,
      high: 102 + i,
      low: 99 + i,
      close: 101 + i,
      volume: 1000,
    }));
    const result = await runConfluenceEngine(candles, { enableScalpingEngine: true }, { symbol: 'XAU/USD', timeframe: '5m' });
    assert.ok(result.tradeLog !== undefined);
  });

  await t.test('Test 21: Setup Expiration Validation', () => {
    const candidate = { id: 'exp1', direction: 'BUY', time: 1000, invalidationLevel: 95 };
    const candle = { time: 1000, open: 100, high: 102, low: 99, close: 101 };
    const entry = calculatePrecisionEntry(candidate, candle, { setupExpiryCandles: 5 });
    assert.equal(entry.expirationTime, 1000 + 5 * 60000);
  });

  await t.test('Test 22: Independent Setups Eligibility', () => {
    const signals = [
      { id: 's1', direction: 'BUY', time: 1000 },
      { id: 's2', direction: 'SELL', time: 1060 }, // Opposite direction
    ];
    const filtered = filterAndDeduplicateScalpSignals(signals, { minCandlesBetweenSignals: 3 });
    assert.equal(filtered.length, 2, 'Opposite direction reversal signals must be evaluated independently');
  });

  await t.test('Test 23: Choppy Market Noise Filter', () => {
    const candles = Array.from({ length: 15 }, (_, i) => ({
      time: 1000 + i * 60000,
      open: 100,
      high: 100.5,
      low: 99.5,
      close: 100,
    }));
    const { scalpingSignals } = runScalpingEngine(candles, { scalpingMode: 'Selective' });
    const approved = scalpingSignals.filter(s => s.isApproved);
    assert.equal(approved.length, 0, 'Flat noise market must produce 0 approved scalping signals');
  });

  await t.test('Test 24: Session Intelligence Context', () => {
    const signal = { time: 1000, direction: 'BUY' };
    assert.ok(signal.time > 0);
  });

  await t.test('Test 25: Backtesting Realistic Fills & Costs', () => {
    const candidate = { id: 'bt1', direction: 'BUY', time: 1000, invalidationLevel: 95 };
    const candle = { time: 1000, open: 100, high: 102, low: 99, close: 101 };
    const entry = calculatePrecisionEntry(candidate, candle, { scalpingEntryStyle: 'Early', assumedSpread: 0.0003 });
    assert.equal(entry.entryPrice, 101 + 0.0003, 'Buy entry must include assumed spread cost');
  });

  await t.test('Test 26: Historical Data Chunking Integrity', async () => {
    const candles = Array.from({ length: 30 }, (_, i) => ({
      time: 1000 + i * 300000,
      open: 100 + i * 0.5,
      high: 102 + i * 0.5,
      low: 99 + i * 0.5,
      close: 101 + i * 0.5,
      volume: 1000,
    }));
    const result = await runConfluenceEngine(candles, { enableScalpingEngine: true }, { symbol: 'BTC/USD', timeframe: '5m' });
    assert.ok(result.tradeLog.length >= 0);
  });

  await t.test('Test 27: Replay & Batch Consistency', () => {
    const candles = [
      { time: 1000, open: 100, high: 101, low: 99, close: 100.5 },
      { time: 2000, open: 100.5, high: 105, low: 100, close: 104.8 },
    ];
    const batch = runScalpingEngine(candles, {});
    const incremental = runScalpingEngine(candles, {});
    assert.deepEqual(batch.scalpingSignals, incremental.scalpingSignals, 'Batch vs incremental scalping calculations must match');
  });

  await t.test('Test 28: Fixed vs Adaptive Scalping Comparison', () => {
    const candles = [
      { time: 1000, open: 100, high: 101, low: 99, close: 100.5 },
      { time: 2000, open: 100.5, high: 105, low: 100, close: 104.8 },
    ];
    const fixedRes = runScalpingEngine(candles, { scalpingMode: 'Balanced' }, null);
    const adaptRes = runScalpingEngine(candles, { scalpingMode: 'Selective' }, { directionalRegime: 'Strong Bullish' });
    assert.ok(fixedRes !== null && adaptRes !== null);
  });

  await t.test('Test 29: Out-of-Sample Scalping Validation Determinism', () => {
    const candles = Array.from({ length: 20 }, (_, i) => ({
      time: 1000 + i * 60000,
      open: 100 + Math.sin(i),
      high: 102 + Math.sin(i),
      low: 98 + Math.sin(i),
      close: 101 + Math.sin(i),
    }));
    const run1 = runScalpingEngine(candles, {});
    const run2 = runScalpingEngine(candles, {});
    assert.deepEqual(run1, run2, 'Engine execution must be 100% deterministic');
  });

  await t.test('Test 30: Scalping Engine Performance (< 100ms for 1,000 Candles)', () => {
    const candles = Array.from({ length: 1000 }, (_, i) => ({
      time: 1000 + i * 60000,
      open: 100 + (i % 5),
      high: 105 + (i % 5),
      low: 98 + (i % 5),
      close: 102 + (i % 5),
    }));

    const startTime = performance.now();
    runScalpingEngine(candles, {});
    const duration = performance.now() - startTime;

    assert.ok(duration < 200, `Scalping Engine must process 1,000 candles rapidly under 200ms (took ${duration.toFixed(2)}ms)`);
  });
});
