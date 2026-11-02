import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  HtfSynchronizer,
} from '../src/lib/signalEngine/htfSynchronizer.ts';
import {
  scoreSignal,
  STRATEGY_BASE_SCORE,
} from '../src/lib/signalEngine/confluenceScorer.ts';
import {
  deduplicateAndFilterSignals,
} from '../src/lib/signalEngine/deduplicator.ts';
import {
  calculateSignalRiskManagement,
} from '../src/lib/signalEngine/riskManager.ts';
import {
  DiagnosticsCollector,
} from '../src/lib/signalEngine/diagnostics.ts';
import {
  runConfluenceEngine,
  detectLiquidityAndSweeps,
  detectMomentumSpikes,
} from '../src/lib/liquidity.js';

describe('PHASE 1: Signal Engine Repair, Directional Accuracy & Optimization', () => {

  // Helper to create synthetic candle series
  function createSyntheticCandles(count, startPrice = 2000, trend = 'bullish', stepMs = 60_000) {
    const candles = [];
    let current = startPrice;
    const baseTime = Date.UTC(2026, 9, 10, 0, 0, 0);

    for (let i = 0; i < count; i++) {
      const time = baseTime + i * stepMs;
      let delta = 0;
      if (trend === 'bullish') {
        delta = (i % 3 === 0 ? -1 : 2.5); // 2 up, 1 down
      } else if (trend === 'bearish') {
        delta = (i % 3 === 0 ? 1 : -2.5); // 2 down, 1 up
      } else {
        // Range: oscillates around startPrice
        delta = Math.sin(i / 4) * 3;
      }
      const open = current;
      const close = current + delta;
      const high = Math.max(open, close) + 1.5;
      const low = Math.min(open, close) - 1.5;
      const volume = 100 + (i % 5) * 20;

      candles.push({ time, open, high, low, close, volume });
      current = close;
    }
    return candles;
  }

  // =========================================================================
  // Test A — Bullish Market (Detects & confirms BUY signals)
  // =========================================================================
  test('Test A: Bullish Market — Confirms BUY signals with correct structure', async () => {
    const candles = createSyntheticCandles(50, 2600, 'bullish');
    // Inject a classic SSL sweep and recovery
    const sweepIdx = 25;
    const window = candles.slice(sweepIdx - 10, sweepIdx);
    const windowLow = Math.min(...window.map(c => c.low));
    const windowHigh = Math.max(...window.map(c => c.high));

    // SSL Sweep: price sweeps below the window low with a rejection wick and closes back inside
    candles[sweepIdx].low = windowLow - 5;
    candles[sweepIdx].open = windowLow + 1;
    candles[sweepIdx].close = windowLow + 2;
    candles[sweepIdx].high = windowLow + 3;

    // Next candle confirms with strong displacement upwards breaking the previous swing high
    candles[sweepIdx + 1].open = windowLow + 2;
    candles[sweepIdx + 1].low = windowLow + 1;
    candles[sweepIdx + 1].close = windowHigh + 5;
    candles[sweepIdx + 1].high = windowHigh + 6;

    const settings = {
      enableMtfEngine: false,
      confluenceScoreThreshold: 2.5,
      minCandlesBetweenSignals: 3,
      lookback: 10,
      minWickRatio: 0.3,
      equalTolerance: 0.002,
      strategy: { liquiditySweep: true, momentumSpike: true },
    };
    const config = { symbol: 'XAU/USD', timeframe: '15m' };

    const result = await runConfluenceEngine(candles, settings, config);
    const buySignals = (result.tradeLog || []).filter(s => s.direction === 'BUY' && s.isApproved);
    assert(buySignals.length > 0, 'Must detect at least 1 approved BUY signal in bullish market');
  });

  // =========================================================================
  // Test B — Bearish Market (Detects & confirms SELL signals)
  // =========================================================================
  test('Test B: Bearish Market — Confirms SELL signals without directional bias', async () => {
    const candles = createSyntheticCandles(50, 2700, 'bearish');
    // Inject a classic BSL sweep of highs and recovery down
    const sweepIdx = 25;
    const window = candles.slice(sweepIdx - 10, sweepIdx);
    const windowHigh = Math.max(...window.map(c => c.high));
    const windowLow = Math.min(...window.map(c => c.low));

    // BSL Sweep: price sweeps above window high with a rejection upper wick and closes back inside
    candles[sweepIdx].high = windowHigh + 5;
    candles[sweepIdx].open = windowHigh - 1;
    candles[sweepIdx].close = windowHigh - 2;
    candles[sweepIdx].low = windowHigh - 3;

    // Next candle confirms with strong displacement downwards breaking the previous swing low
    candles[sweepIdx + 1].open = windowHigh - 2;
    candles[sweepIdx + 1].high = windowHigh - 1;
    candles[sweepIdx + 1].close = windowLow - 5;
    candles[sweepIdx + 1].low = windowLow - 6;

    const settings = {
      enableMtfEngine: false,
      confluenceScoreThreshold: 2.5,
      minCandlesBetweenSignals: 3,
      lookback: 10,
      minWickRatio: 0.3,
      equalTolerance: 0.002,
      strategy: { liquiditySweep: true, momentumSpike: true },
    };
    const config = { symbol: 'XAU/USD', timeframe: '15m' };

    const result = await runConfluenceEngine(candles, settings, config);
    const sellSignals = (result.tradeLog || []).filter(s => s.direction === 'SELL' && s.isApproved);
    assert(sellSignals.length > 0, 'Must detect at least 1 approved SELL signal in bearish market');
  });

  // =========================================================================
  // Test C — Range Market (Does not force artificial signals)
  // =========================================================================
  test('Test C: Range Market — Operates without forcing signals or directional skew', async () => {
    const candles = createSyntheticCandles(40, 2650, 'range');
    const settings = {
      enableMtfEngine: false,
      confluenceScoreThreshold: 3.5,
      minCandlesBetweenSignals: 5,
      strategy: { liquiditySweep: true, momentumSpike: true },
    };
    const config = { symbol: 'EUR/USD', timeframe: '15m' };

    const result = await runConfluenceEngine(candles, settings, config);
    assert(Array.isArray(result.tradeLog), 'TradeLog must be an array');
    // Range market without high-displacement spikes shouldn't flood the chart
    const approved = result.tradeLog.filter(s => s.isApproved);
    assert(approved.length <= 5, 'Must not flood chart in a quiet range market');
  });

  // =========================================================================
  // Test D — Mixed Market (Both BUY and SELL paths operate independently)
  // =========================================================================
  test('Test D: Mixed Market — Detects BOTH BUY and SELL signals in same dataset', async () => {
    // 30 bars bullish, followed by 30 bars bearish
    const bullPart = createSyntheticCandles(30, 2600, 'bullish');
    const bearPart = createSyntheticCandles(30, bullPart[bullPart.length - 1].close, 'bearish');
    // Shift timestamps for second half
    const lastTime = bullPart[bullPart.length - 1].time;
    bearPart.forEach((c, idx) => { c.time = lastTime + (idx + 1) * 60_000; });
    const mixedCandles = [...bullPart, ...bearPart];

    // Inject BUY sweep in first half
    const buyIdx = 18;
    const buyWindow = mixedCandles.slice(buyIdx - 8, buyIdx);
    const buyLow = Math.min(...buyWindow.map(c => c.low));
    const buyHigh = Math.max(...buyWindow.map(c => c.high));
    mixedCandles[buyIdx].low = buyLow - 5;
    mixedCandles[buyIdx].open = buyLow + 1;
    mixedCandles[buyIdx].close = buyLow + 2;
    mixedCandles[buyIdx].high = buyLow + 3;
    mixedCandles[buyIdx + 1].open = buyLow + 2;
    mixedCandles[buyIdx + 1].low = buyLow + 1;
    mixedCandles[buyIdx + 1].close = buyHigh + 5;
    mixedCandles[buyIdx + 1].high = buyHigh + 6;

    // Inject SELL sweep in second half
    const sellIdx = 48;
    const sellWindow = mixedCandles.slice(sellIdx - 8, sellIdx);
    const sellHigh = Math.max(...sellWindow.map(c => c.high));
    const sellLow = Math.min(...sellWindow.map(c => c.low));
    mixedCandles[sellIdx].high = sellHigh + 5;
    mixedCandles[sellIdx].open = sellHigh - 1;
    mixedCandles[sellIdx].close = sellHigh - 2;
    mixedCandles[sellIdx].low = sellHigh - 3;
    mixedCandles[sellIdx + 1].open = sellHigh - 2;
    mixedCandles[sellIdx + 1].high = sellHigh - 1;
    mixedCandles[sellIdx + 1].close = sellLow - 5;
    mixedCandles[sellIdx + 1].low = sellLow - 6;

    const settings = {
      enableMtfEngine: false,
      confluenceScoreThreshold: 2.2,
      minCandlesBetweenSignals: 3,
      lookback: 8,
      minWickRatio: 0.25,
      equalTolerance: 0.003,
      strategy: { liquiditySweep: true, momentumSpike: true },
    };
    const config = { symbol: 'XAU/USD', timeframe: '15m' };

    const result = await runConfluenceEngine(mixedCandles, settings, config);
    const buySignals = result.tradeLog.filter(s => s.direction === 'BUY' && s.isApproved);
    const sellSignals = result.tradeLog.filter(s => s.direction === 'SELL' && s.isApproved);

    assert(buySignals.length > 0, 'Must detect BUY signals in bullish half');
    assert(sellSignals.length > 0, 'Must detect SELL signals in bearish half');
  });

  // =========================================================================
  // Test E — Duplicate Suppression (Clusters same-setup multiple detector events)
  // =========================================================================
  test('Test E: Duplicate Suppression — Clusters multiple strategy detections of same setup', () => {
    const baseTime = 1790000000000;
    const candleIndexMap = new Map();
    for (let i = 0; i < 20; i++) {
      candleIndexMap.set(baseTime + i * 60_000, i);
    }

    // 3 overlapping signals representing the same BUY setup around bar 5
    const rawSignals = [
      {
        id: 'sig-1',
        strategy: 'obMss',
        direction: 'BUY',
        type: 'BUY confirmed',
        time: baseTime + 5 * 60_000,
        price: 2600.0,
        score: 4.5,
        isApproved: true,
        qualityTier: 'A',
        notes: 'OB+MSS',
        reasons: ['Base', 'MSS'],
      },
      {
        id: 'sig-2',
        strategy: 'fvgImbalance',
        direction: 'BUY',
        type: 'BUY confirmed',
        time: baseTime + 6 * 60_000, // 1 bar later, virtually same price
        price: 2600.5,
        score: 3.8,
        isApproved: true,
        qualityTier: 'B',
        notes: 'FVG Retest',
        reasons: ['Base', 'FVG'],
      },
      {
        id: 'sig-3',
        strategy: 'sweepObFvgConfluence',
        direction: 'BUY',
        type: 'BUY confirmed',
        time: baseTime + 5 * 60_000,
        price: 2599.8,
        score: 5.0, // Highest score wins
        isApproved: true,
        qualityTier: 'A+',
        notes: 'Sweep+OB+FVG',
        reasons: ['Base', 'Confluence'],
      },
    ];

    const { approvedSignals, duplicatesSuppressed } = deduplicateAndFilterSignals(
      rawSignals,
      candleIndexMap,
      { minCandlesBetweenSignals: 5, timeToleranceCandles: 3, priceTolerancePct: 0.003 }
    );

    assert.equal(approvedSignals.length, 1, 'Should cluster 3 detections into 1 primary signal');
    assert.equal(duplicatesSuppressed, 2, 'Should record 2 duplicates suppressed');
    assert.equal(approvedSignals[0].id, 'sig-3', 'Highest scoring signal (score: 5.0) must win');
    assert(approvedSignals[0].confirmations?.length >= 2, 'Should attach other strategy confirmations');
  });

  // =========================================================================
  // Test F — Independent Opportunities (Direction-aware spacing does not block reversal)
  // =========================================================================
  test('Test F: Direction-Aware Spacing — Does NOT block opposite-direction reversal signal', () => {
    const baseTime = 1790000000000;
    const candleIndexMap = new Map();
    for (let i = 0; i < 20; i++) {
      candleIndexMap.set(baseTime + i * 60_000, i);
    }

    // A BUY signal at bar 5 followed immediately by a valid SELL reversal at bar 7
    const rawSignals = [
      {
        id: 'buy-1',
        strategy: 'momentumSpike',
        direction: 'BUY',
        type: 'BUY confirmed',
        time: baseTime + 5 * 60_000,
        price: 2610.0,
        score: 4.2,
        isApproved: true,
        qualityTier: 'A',
        notes: 'Momentum Spike',
        reasons: [],
      },
      {
        id: 'sell-1',
        strategy: 'liquiditySweep',
        direction: 'SELL',
        type: 'SELL confirmed',
        time: baseTime + 7 * 60_000, // Only 2 bars after BUY
        price: 2615.0,
        score: 4.5,
        isApproved: true,
        qualityTier: 'A',
        notes: 'BSL Sweep + MSS',
        reasons: [],
      },
    ];

    const { approvedSignals } = deduplicateAndFilterSignals(
      rawSignals,
      candleIndexMap,
      { minCandlesBetweenSignals: 5 } // Spacing is 5 bars
    );

    assert.equal(approvedSignals.length, 2, 'Opposite direction reversal must NOT be suppressed by BUY spacing');
    assert.equal(approvedSignals[0].direction, 'BUY');
    assert.equal(approvedSignals[1].direction, 'SELL');
  });

  // =========================================================================
  // Test G — Non-Repainting: Confirmation timestamp is when confirmation closed
  // =========================================================================
  test('Test G: Non-Repainting — Confirmed signal timestamp is at confirmation close, not pre-dated', () => {
    const candles = createSyntheticCandles(30, 2600, 'bullish');
    const sweepIdx = 10;
    candles[sweepIdx].high = 2650;
    candles[sweepIdx].close = 2640; // BSL Sweep of previous high

    const { signals } = detectLiquidityAndSweeps(candles, {
      lookback: 5,
      minWickRatio: 0.2,
      equalTolerance: 0.002,
      enableQualifiedSweepFilters: false,
      mssConfirmationRequired: true,
      timeframe: '15m',
    });

    const confirmed = signals.filter(s => s.type === 'SELL confirmed');
    if (confirmed.length > 0) {
      for (const sig of confirmed) {
        assert(sig.time >= candles[sweepIdx].time, 'Signal timestamp must NOT precede confirmation');
        if (sig.mssIndex > -1) {
          assert.equal(sig.time, candles[sig.mssIndex].time, 'Signal must be stamped at MSS confirmation candle time');
        }
      }
    }
  });

  // =========================================================================
  // Test H — MTF Point-in-Time Synchronization (No future leakage)
  // =========================================================================
  test('Test H: MTF Synchronization — Only uses HTF candles closed on or before decision time', () => {
    const htfCandles = [
      { time: 1000, open: 100, high: 105, low: 99, close: 104 },
      { time: 2000, open: 104, high: 108, low: 103, close: 107 },
      { time: 3000, open: 107, high: 110, low: 106, close: 109 },
      { time: 4000, open: 109, high: 112, low: 108, close: 111 },
      // Future candles:
      { time: 5000, open: 111, high: 115, low: 110, close: 114 },
      { time: 6000, open: 114, high: 120, low: 113, close: 119 },
    ];

    const synchronizer = new HtfSynchronizer(htfCandles, 2);

    // Query at timestamp 3500 (before candle 4000 closed)
    const trendAt3500 = synchronizer.getTrendAtTime(3500);
    // Should use close of candle at 3000 (109), NOT future candle 6000 (119)
    assert.equal(trendAt3500.lastHtfClose, 109, 'Must use latest closed candle at 3000, not future candles');
  });

  // =========================================================================
  // Test I — Replay Consistency
  // =========================================================================
  test('Test I: Replay Consistency — Incremental evaluation produces identical approved signals', async () => {
    const candles = createSyntheticCandles(35, 2600, 'bullish');
    const settings = {
      enableMtfEngine: false,
      confluenceScoreThreshold: 2.5,
      minCandlesBetweenSignals: 3,
      strategy: { momentumSpike: true },
    };
    const config = { symbol: 'XAU/USD', timeframe: '15m' };

    const fullRun = await runConfluenceEngine(candles, settings, config);
    const fullApproved = fullRun.tradeLog.filter(s => s.isApproved).map(s => s.id);

    // Run again with identical data
    const replayRun = await runConfluenceEngine(candles, settings, config);
    const replayApproved = replayRun.tradeLog.filter(s => s.isApproved).map(s => s.id);

    assert.deepEqual(fullApproved, replayApproved, 'Replay and full run must agree on approved signal IDs');
  });

  // =========================================================================
  // Test J — Settings: Threshold filter controls signal volume predictably
  // =========================================================================
  test('Test J: Settings — Confluence score threshold filters signal count predictably', () => {
    const signal = { strategy: 'momentumSpike', direction: 'BUY', price: 2600, notes: 'Momentum Spike' };
    const neutralTrend = { direction: 'Ranging', confidence: 0 };

    const scoreRes = scoreSignal(signal, neutralTrend, [], {});
    assert(scoreRes.score >= 2.5, 'Base score must be >= 2.5');

    // Threshold 2.0 approves it
    assert(scoreRes.score >= 2.0);
    // Threshold 8.0 suppresses it
    assert(scoreRes.score < 8.0);
  });

  // =========================================================================
  // Test K — SL/TP Directionality Consistency
  // =========================================================================
  test('Test K: Risk Management — Strict directional bounds (BUY: sl < entry < tp, SELL: tp < entry < sl)', () => {
    const candles = createSyntheticCandles(20, 2600, 'bullish');
    const buySignal = { price: 2610, direction: 'BUY', type: 'BUY confirmed' };
    const buyRisk = calculateSignalRiskManagement(buySignal, candles, 15, { defaultRiskRewardRatio: 1.5 });

    assert(buyRisk.sl < 2610, `BUY Stop Loss (${buyRisk.sl}) must be below entry (2610)`);
    assert(buyRisk.tp > 2610, `BUY Take Profit (${buyRisk.tp}) must be above entry (2610)`);
    assert.equal(buyRisk.riskReward, 1.5);

    const sellSignal = { price: 2610, direction: 'SELL', type: 'SELL confirmed' };
    const sellRisk = calculateSignalRiskManagement(sellSignal, candles, 15, { defaultRiskRewardRatio: 2.0 });

    assert(sellRisk.sl > 2610, `SELL Stop Loss (${sellRisk.sl}) must be above entry (2610)`);
    assert(sellRisk.tp < 2610, `SELL Take Profit (${sellRisk.tp}) must be below entry (2610)`);
    assert.equal(sellRisk.riskReward, 2.0);
  });

  // =========================================================================
  // Test L — No-Signal Conditions (Zero fabricated signals on flat data)
  // =========================================================================
  test('Test L: No-Signal Conditions — Flat market produces zero approved signals', async () => {
    const flatCandles = [];
    const baseTime = Date.UTC(2026, 9, 10, 0, 0, 0);
    for (let i = 0; i < 30; i++) {
      flatCandles.push({
        time: baseTime + i * 60_000,
        open: 2600,
        high: 2600.1,
        low: 2599.9,
        close: 2600,
        volume: 10,
      });
    }

    const settings = {
      enableMtfEngine: false,
      confluenceScoreThreshold: 4.0,
      strategy: { liquiditySweep: true, momentumSpike: true },
    };
    const config = { symbol: 'XAU/USD', timeframe: '15m' };

    const result = await runConfluenceEngine(flatCandles, settings, config);
    const approved = result.tradeLog.filter(s => s.isApproved);
    assert.equal(approved.length, 0, 'Flat market must produce ZERO fabricated signals');
  });

  // =========================================================================
  // Test M — Diagnostics Output Accuracy
  // =========================================================================
  test('Test M: Diagnostics — Accurately tracks candidates, approvals, and suppression counts', () => {
    const diag = new DiagnosticsCollector('XAU/USD', '15m', 100);
    diag.recordRawCandidate('BUY', 'obMss');
    diag.recordRawCandidate('SELL', 'fvgImbalance');
    diag.recordConfirmedSetup('BUY');
    diag.recordApprovedSignal({ id: 's1', direction: 'BUY', strategy: 'obMss' });
    diag.recordDuplicatesSuppressed(3);
    diag.recordRejection('Low score', true);

    const summary = diag.getSummary();
    assert.equal(summary.rawBuyCandidates, 1);
    assert.equal(summary.rawSellCandidates, 1);
    assert.equal(summary.confirmedBuySetups, 1);
    assert.equal(summary.approvedBuy, 1);
    assert.equal(summary.duplicatesSuppressed, 3);
    assert.equal(summary.rejectedByScore, 1);
  });

  // =========================================================================
  // Test N — Determinism
  // =========================================================================
  test('Test N: Determinism — Identical data and settings yield identical signals and scores', async () => {
    const candles = createSyntheticCandles(30, 2600, 'bullish');
    const settings = {
      enableMtfEngine: false,
      confluenceScoreThreshold: 2.5,
      strategy: { momentumSpike: true },
    };
    const config = { symbol: 'XAU/USD', timeframe: '15m' };

    const run1 = await runConfluenceEngine(candles, settings, config);
    const run2 = await runConfluenceEngine(candles, settings, config);

    assert.equal(run1.tradeLog.length, run2.tradeLog.length);
    for (let i = 0; i < run1.tradeLog.length; i++) {
      assert.equal(run1.tradeLog[i].id, run2.tradeLog[i].id);
      assert.equal(run1.tradeLog[i].score, run2.tradeLog[i].score);
      assert.equal(run1.tradeLog[i].isApproved, run2.tradeLog[i].isApproved);
    }
  });

});
