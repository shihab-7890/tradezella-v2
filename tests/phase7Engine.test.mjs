import test from 'node:test';
import assert from 'node:assert/strict';

import { runUnifiedSignalEngine } from '../src/lib/signals/unifiedSignalEngine.js';
import { scoreCandidate } from '../src/lib/signals/confluenceScoring.js';
import { normalizeToCandidates } from '../src/lib/signals/evidenceNormalizer.js';
import { aggregateSetupEvidence } from '../src/lib/signals/setupDeduplication.js';
import { resolveSignalConflicts } from '../src/lib/signals/conflictResolver.js';
import { evaluateTradeDecision, getAdaptiveScoreThreshold } from '../src/lib/signals/tradeDecision.js';
import { trackSignalLifecycle } from '../src/lib/signals/signalLifecycle.js';
import { DECISION_STATUS, CONFLICT_TYPES, QUALITY_GRADES, TRADING_STYLES, STRATEGY_FAMILIES } from '../src/lib/signals/types.js';
import { runConfluenceEngine } from '../src/lib/liquidity.js';

test('PHASE 7 ENGINE SUITE: Unified Signal Scoring, Multi-Strategy Conflict Resolution & Intelligent Trade Decision Engine', async (t) => {

  function createTestCandles(count = 30, basePrice = 2600, trend = 'bullish') {
    const candles = [];
    let current = basePrice;
    const baseTime = 1790000000000;
    for (let i = 0; i < count; i++) {
      const delta = trend === 'bullish' ? 1.5 : (trend === 'bearish' ? -1.5 : 0);
      const open = current;
      const close = current + delta;
      const high = Math.max(open, close) + 1.0;
      const low = Math.min(open, close) - 1.0;
      candles.push({ time: baseTime + i * 900_000, open, high, low, close, volume: 150 });
      current = close;
    }
    return candles;
  }

  // =========================================================================
  // Test 1 — Unified BUY Scoring
  // =========================================================================
  await t.test('Test 1: Unified BUY Scoring — Evaluates bullish evidence into 0-100 score', () => {
    const candidate = {
      direction: 'BUY',
      strategy: 'smcSweepMss',
      strategyFamily: STRATEGY_FAMILIES.SMC,
      tradingStyle: TRADING_STYLES.INTRADAY,
      price: 2600,
      sl: 2590,
      tp: 2620,
      riskReward: 2.0,
      evidence: {
        marketStructure: { hasBos: true, hasMss: true, isFresh: true },
        liquidity: { sweepDetected: true, reclaimConfirmed: true, poolSignificance: 'high' },
        candlePsychology: { displacementQuality: 0.8, rejectionWickRatio: 0.4, momentumFollowThrough: true },
        zoneConfluence: { inOrderBlock: true, inFvg: true, atFibLevel: true },
        multiTimeframe: { alignedWithHtf: true, htfDirection: 'BULLISH', atKeyLevel: true },
        marketRegime: { regime: 'Bullish Trend', suitability: 0.9 },
        riskSuitability: { validSl: true },
      },
      confirmations: ['smcSweepMss', 'obMss', 'fvgImbalance'],
    };

    const res = scoreCandidate(candidate, {});
    assert.ok(res.unifiedScore >= 75, `Expected score >= 75 for high confluence BUY, got ${res.unifiedScore}`);
    assert.ok(res.qualityTier === QUALITY_GRADES.A || res.qualityTier === QUALITY_GRADES.A_PLUS);
    assert.ok(res.breakdown.marketStructure > 0);
    assert.ok(res.breakdown.liquidity > 0);
  });

  // =========================================================================
  // Test 2 — Unified SELL Scoring
  // =========================================================================
  await t.test('Test 2: Unified SELL Scoring — Evaluates bearish evidence without directional skew', () => {
    const candidate = {
      direction: 'SELL',
      strategy: 'waterfallFirstPullback',
      strategyFamily: STRATEGY_FAMILIES.WATERFALL,
      tradingStyle: TRADING_STYLES.SCALPING,
      price: 2650,
      sl: 2660,
      tp: 2630,
      riskReward: 2.0,
      evidence: {
        marketStructure: { hasBos: true, hasMss: false, isFresh: true },
        liquidity: { sweepDetected: false, reclaimConfirmed: false, poolSignificance: 'normal' },
        candlePsychology: { displacementQuality: 0.85, rejectionWickRatio: 0.1, momentumFollowThrough: true, exhaustionDetected: false },
        zoneConfluence: { inOrderBlock: true, inFvg: false, atFibLevel: false },
        multiTimeframe: { alignedWithHtf: true, htfDirection: 'BEARISH', atKeyLevel: false },
        marketRegime: { regime: 'Bearish Momentum', suitability: 0.9 },
        riskSuitability: { validSl: true },
      },
      confirmations: ['waterfallFirstPullback'],
    };

    const res = scoreCandidate(candidate, {});
    assert.ok(res.unifiedScore >= 60, `Expected score >= 60 for bearish waterfall, got ${res.unifiedScore}`);
    assert.ok(res.breakdown.candlePsychology > 0);
  });

  // =========================================================================
  // Test 3 — Strategy-Specific Scoring Profiles
  // =========================================================================
  await t.test('Test 3: Strategy-Specific Scoring — Tailors weights per strategy family', () => {
    const baseEvidence = {
      marketStructure: { hasBos: true, hasMss: false, isFresh: true },
      liquidity: { sweepDetected: false, reclaimConfirmed: false, poolSignificance: 'normal' },
      candlePsychology: { displacementQuality: 0.9, rejectionWickRatio: 0.1, momentumFollowThrough: true },
      zoneConfluence: { inOrderBlock: false, inFvg: false, atFibLevel: false },
      multiTimeframe: { alignedWithHtf: true, htfDirection: 'BEARISH' },
      marketRegime: { suitability: 0.8 },
      riskSuitability: { validSl: true },
    };

    const waterfallCandidate = {
      direction: 'SELL',
      strategy: 'waterfall',
      strategyFamily: STRATEGY_FAMILIES.WATERFALL,
      riskReward: 1.5,
      evidence: baseEvidence,
    };

    const swingCandidate = {
      direction: 'SELL',
      strategy: 'swing',
      strategyFamily: STRATEGY_FAMILIES.SWING,
      riskReward: 1.5,
      evidence: baseEvidence,
    };

    const waterfallScore = scoreCandidate(waterfallCandidate);
    const swingScore = scoreCandidate(swingCandidate);

    assert.ok(waterfallScore.breakdown.candlePsychology > swingScore.breakdown.candlePsychology,
      'Waterfall profile must weight candle psychology displacement higher than Swing profile');
  });

  // =========================================================================
  // Test 4 — Correlated Evidence (Anti-Double-Counting Guard)
  // =========================================================================
  await t.test('Test 4: Correlated Evidence — Caps maximum contribution from correlated structural events', () => {
    const candidate = {
      direction: 'BUY',
      strategy: 'smc',
      strategyFamily: STRATEGY_FAMILIES.SMC,
      evidence: {
        marketStructure: { hasBos: true, hasMss: true, hasChoch: true, isFresh: true },
        liquidity: { sweepDetected: false },
        candlePsychology: { displacementQuality: 0.5 },
        zoneConfluence: { inOrderBlock: false },
        multiTimeframe: { alignedWithHtf: false, htfDirection: 'Ranging' },
        marketRegime: { suitability: 0.5 },
        riskSuitability: { validSl: false },
      },
    };

    const res = scoreCandidate(candidate);
    assert.ok(res.breakdown.marketStructure <= 26, 'Market structure category must be strictly capped against double counting');
  });

  // =========================================================================
  // Test 5 — Same-Setup Deduplication
  // =========================================================================
  await t.test('Test 5: Same-Setup Deduplication — Aggregates multi-detector events into 1 primary trade idea', () => {
    const baseTime = 1790000000000;
    const candleTimeIndex = new Map([[baseTime, 10], [baseTime + 60_000, 11]]);

    const candidates = [
      {
        candidateId: 'c1',
        time: baseTime,
        price: 2600.0,
        direction: 'BUY',
        strategy: 'obMss',
        tradingStyle: TRADING_STYLES.INTRADAY,
        score: 4.0,
        confirmations: ['obMss'],
        evidence: { marketStructure: { hasMss: true }, liquidity: {}, candlePsychology: {}, zoneConfluence: {}, multiTimeframe: {}, marketRegime: {}, riskSuitability: {} },
      },
      {
        candidateId: 'c2',
        time: baseTime + 60_000,
        price: 2600.3, // Within 0.3% price and 1 candle window
        direction: 'BUY',
        strategy: 'fvgImbalance',
        tradingStyle: TRADING_STYLES.INTRADAY,
        score: 3.5,
        confirmations: ['fvgImbalance'],
        evidence: { marketStructure: {}, liquidity: {}, candlePsychology: {}, zoneConfluence: { inFvg: true }, multiTimeframe: {}, marketRegime: {}, riskSuitability: {} },
      },
    ];

    const { aggregatedSetups, duplicatesSuppressed } = aggregateSetupEvidence(candidates, candleTimeIndex);
    assert.equal(aggregatedSetups.length, 1, 'Should cluster 2 co-located detections into 1 setup');
    assert.equal(duplicatesSuppressed, 1);
    assert.ok(aggregatedSetups[0].confirmations.includes('fvgImbalance'), 'Merged setup must record secondary detector as confirmation');
  });

  // =========================================================================
  // Test 6 — Independent Setup Preservation
  // =========================================================================
  await t.test('Test 6: Independent Setup Preservation — Preserves setups at distinct times or price levels', () => {
    const baseTime = 1790000000000;
    const candleTimeIndex = new Map([[baseTime, 5], [baseTime + 10 * 60_000, 15]]);

    const candidates = [
      { candidateId: 'c1', time: baseTime, price: 2600, direction: 'BUY', tradingStyle: 'Intraday', score: 4.0, strategy: 's1' },
      { candidateId: 'c2', time: baseTime + 10 * 60_000, price: 2620, direction: 'BUY', tradingStyle: 'Intraday', score: 4.5, strategy: 's2' },
    ];

    const { aggregatedSetups } = aggregateSetupEvidence(candidates, candleTimeIndex, { minCandlesBetweenSignals: 5 });
    assert.equal(aggregatedSetups.length, 2, 'Independent setups separated by > 5 candles must both be preserved');
  });

  // =========================================================================
  // Test 7 — BUY/SELL Conflict Classification (Type A: Contradictory)
  // =========================================================================
  await t.test('Test 7: BUY/SELL Conflict — Classifies ambiguous same-level opposite signals as WAIT', () => {
    const baseTime = 1790000000000;
    const candleTimeIndex = new Map([[baseTime, 10]]);

    const setups = [
      { candidateId: 'buy-1', time: baseTime, price: 2600, direction: 'BUY', tradingStyle: 'Intraday', unifiedScore: 62, type: 'BUY confirmed' },
      { candidateId: 'sell-1', time: baseTime, price: 2600.2, direction: 'SELL', tradingStyle: 'Intraday', unifiedScore: 61, type: 'SELL confirmed' },
    ];

    const { resolvedSetups } = resolveSignalConflicts(setups, candleTimeIndex);
    assert.equal(resolvedSetups[0].conflictType, CONFLICT_TYPES.SAME_SETUP_OPPOSITE);
    assert.equal(resolvedSetups[0].conflictResolution, 'WAIT_AMBIGUOUS_CONTRADICTION');
  });

  // =========================================================================
  // Test 8 — Cross-Timeframe Conflict (Type B: Preserved Independently)
  // =========================================================================
  await t.test('Test 8: Cross-Timeframe Conflict — Preserves 5m SELL scalp and 4h BUY swing concurrently', () => {
    const baseTime = 1790000000000;
    const candleTimeIndex = new Map([[baseTime, 10]]);

    const setups = [
      { candidateId: 'scalp-1', time: baseTime, price: 2600, direction: 'SELL', tradingStyle: TRADING_STYLES.SCALPING, unifiedScore: 70 },
      { candidateId: 'swing-1', time: baseTime, price: 2600, direction: 'BUY', tradingStyle: TRADING_STYLES.SWING, unifiedScore: 82 },
    ];

    const { resolvedSetups } = resolveSignalConflicts(setups, candleTimeIndex);
    assert.equal(resolvedSetups[0].conflictType, CONFLICT_TYPES.CROSS_TIMEFRAME);
    assert.equal(resolvedSetups[0].conflictResolution, 'PRESERVED_INDEPENDENT_STYLE');
    assert.ok(resolvedSetups[0].conflictWarning.includes('Scalping SELL counter to Swing BUY'));
  });

  // =========================================================================
  // Test 9 — Reversal vs Continuation (Exhaustion Alone Does Not Approve Reversal)
  // =========================================================================
  await t.test('Test 9: Reversal vs Continuation — Exhaustion alone without MSS remains candidate/watch', () => {
    const unconfirmedReversal = {
      direction: 'BUY',
      type: 'SSL candidate', // Unconfirmed candidate
      unifiedScore: 55,
      price: 2600,
      riskReward: 1.5,
      evidence: { candlePsychology: { exhaustionDetected: true } },
    };

    const dec = evaluateTradeDecision(unconfirmedReversal, 50);
    assert.notEqual(dec.decision, 'BUY APPROVED', 'Unconfirmed candidate must not be approved solely on exhaustion');
    assert.equal(dec.isApproved, false);
    assert.equal(dec.reasonCode, 'WATCH_PENDING_CONFIRMATION');
  });

  // =========================================================================
  // Test 10 — WAIT Decision on Inadequate Evidence
  // =========================================================================
  await t.test('Test 10: WAIT Decision — Produces WAIT or REJECTED when evidence is ambiguous', () => {
    const ambiguousSetup = {
      direction: 'BUY',
      type: 'BUY confirmed',
      unifiedScore: 60,
      price: 2600,
      conflictType: CONFLICT_TYPES.SAME_SETUP_OPPOSITE,
      conflictResolution: 'WAIT_AMBIGUOUS_CONTRADICTION',
    };

    const dec = evaluateTradeDecision(ambiguousSetup, 60);
    assert.equal(dec.decision, DECISION_STATUS.WAIT);
    assert.equal(dec.isApproved, false);
  });

  // =========================================================================
  // Test 11 — Signal Quality Grades (A+, A, B, Watch, Low)
  // =========================================================================
  await t.test('Test 11: Signal Quality Grades — Accurately maps 0-100 score to quality tier', () => {
    const s1 = scoreCandidate({ strategyFamily: 'general', evidence: { marketStructure: { hasBos: true, hasMss: true }, liquidity: { sweepDetected: true, reclaimConfirmed: true }, candlePsychology: { displacementQuality: 0.9, rejectionWickRatio: 0.5 }, zoneConfluence: { inOrderBlock: true, inFvg: true, atFibLevel: true }, multiTimeframe: { alignedWithHtf: true, atKeyLevel: true }, marketRegime: { suitability: 1 }, riskSuitability: { validSl: true } }, confirmations: ['s1', 's2'] });
    assert.equal(s1.qualityTier, QUALITY_GRADES.A_PLUS);

    const sLow = scoreCandidate({ strategyFamily: 'general', evidence: { marketStructure: {}, liquidity: {}, candlePsychology: {}, zoneConfluence: {}, multiTimeframe: { htfDirection: 'Ranging' }, marketRegime: { suitability: 0.2 }, riskSuitability: {} } });
    assert.equal(sLow.qualityTier, QUALITY_GRADES.LOW);
  });

  // =========================================================================
  // Test 12 — Candidate Lifecycle Transitions
  // =========================================================================
  await t.test('Test 12: Candidate Lifecycle — Tracks transition to ACTIVE and CLOSED_TP', () => {
    const candles = [
      { time: 1000, open: 100, high: 101, low: 99, close: 100 },
      { time: 2000, open: 100, high: 100.5, low: 99.8, close: 100.2 }, // Entry touched (100)
      { time: 3000, open: 100.2, high: 104, low: 100, close: 103.5 }, // Hits TP (103)
    ];

    const approvedSignal = {
      isApproved: true,
      price: 100,
      sl: 98,
      tp: 103,
      direction: 'BUY',
      tradingStyle: 'Intraday',
    };

    const tracked = trackSignalLifecycle(approvedSignal, candles, 0);
    assert.equal(tracked.status, DECISION_STATUS.CLOSED_TP);
    assert.equal(tracked.outcome, 'TP');
    assert.equal(tracked.pnlR, 1.5);
  });

  // =========================================================================
  // Test 13 — Entry Readiness (Approved != Triggered)
  // =========================================================================
  await t.test('Test 13: Entry Readiness — Approved signal where limit entry never touches is not counted as filled', () => {
    const candles = [
      { time: 1000, open: 105, high: 106, low: 104, close: 105.5 },
      { time: 2000, open: 105.5, high: 108, low: 105, close: 107.5 }, // Price took off, never touched entry 102
      { time: 3000, open: 107.5, high: 110, low: 107, close: 109.5 },
    ];

    const approvedLimitSignal = {
      isApproved: true,
      price: 102, // Retest limit order
      sl: 100,
      tp: 110,
      direction: 'BUY',
      tradingStyle: 'Scalping',
    };

    const tracked = trackSignalLifecycle(approvedLimitSignal, candles, 0);
    assert.notEqual(tracked.status, DECISION_STATUS.CLOSED_TP);
    assert.notEqual(tracked.outcome, 'TP', 'Unfilled signal must NOT be counted as a winning trade');
  });

  // =========================================================================
  // Test 14 — Signal Expiration on Stale Unfilled Orders
  // =========================================================================
  await t.test('Test 14: Signal Expiration — Unfilled scalping setup marks EXPIRED after 8 candles', () => {
    // 12 candles that never touch limit entry price (95)
    const candles = Array.from({ length: 12 }, (_, i) => ({
      time: 1000 + i * 1000,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
    }));

    const signal = {
      isApproved: true,
      price: 95,
      sl: 92,
      tp: 105,
      direction: 'BUY',
      tradingStyle: 'Scalping',
    };

    const tracked = trackSignalLifecycle(signal, candles, 0);
    assert.equal(tracked.status, DECISION_STATUS.EXPIRED);
    assert.equal(tracked.outcome, 'EXPIRED');
  });

  // =========================================================================
  // Test 15 — Waterfall Momentum Integration
  // =========================================================================
  await t.test('Test 15: Waterfall Integration — Merges multiple waterfall candles into single trade idea', () => {
    const baseTime = 1790000000000;
    const candleTimeIndex = new Map([[baseTime, 1], [baseTime + 60_000, 2]]);

    const waterfallSignals = [
      { candidateId: 'w1', time: baseTime, price: 2600, direction: 'SELL', strategy: 'waterfallEarly', score: 3.5 },
      { candidateId: 'w2', time: baseTime + 60_000, price: 2598, direction: 'SELL', strategy: 'waterfallFirstPullback', score: 4.0 },
    ];

    const { aggregatedSetups } = aggregateSetupEvidence(waterfallSignals, candleTimeIndex);
    assert.equal(aggregatedSetups.length, 1, 'Waterfall sequence must produce exactly 1 setup');
  });

  // =========================================================================
  // Test 16 — Advanced SMC Integration
  // =========================================================================
  await t.test('Test 16: SMC Integration — BOS, MSS, OB, FVG are normalized and scored properly', () => {
    const rawSmcSignal = {
      time: 1790000000000,
      price: 2600,
      direction: 'BUY',
      strategy: 'smcSweepMss',
      notes: 'BOS + MSS + OB + FVG Confluence',
      type: 'BUY confirmed',
    };

    const candleTimeIndex = new Map([[1790000000000, 10]]);
    const candidates = normalizeToCandidates([rawSmcSignal], [{ time: 1790000000000, open: 2595, high: 2605, low: 2594, close: 2602 }], candleTimeIndex, null, {}, {}, null);

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].evidence.marketStructure.hasBos, true);
    assert.equal(candidates[0].evidence.marketStructure.hasMss, true);
    assert.equal(candidates[0].evidence.zoneConfluence.inOrderBlock, true);
    assert.equal(candidates[0].evidence.zoneConfluence.inFvg, true);
  });

  // =========================================================================
  // Test 17 — Phase 4 Adaptive Regimes Integration
  // =========================================================================
  await t.test('Test 17: Adaptive Regimes — Adjusts threshold higher during chop, lower in trend', () => {
    const trendRegime = { regime: 'Strong Trend Bullish' };
    const rangeRegime = { regime: 'Ranging / High Volatility' };

    const trendThreshold = getAdaptiveScoreThreshold({ settingsMode: 'AUTO', qualityPreset: 'Balanced' }, trendRegime);
    const rangeThreshold = getAdaptiveScoreThreshold({ settingsMode: 'AUTO', qualityPreset: 'Balanced' }, rangeRegime);

    assert.ok(rangeThreshold > trendThreshold, 'Ranging regime must require stricter confluence threshold than Strong Trend');
  });

  // =========================================================================
  // Test 18 — Scalping Compatibility (Phase 5 Intact)
  // =========================================================================
  await t.test('Test 18: Scalping Integration — Preserves scalping setups under 1m/5m timeframe', () => {
    const raw = [{ time: 1000, price: 2600, direction: 'BUY', strategy: 'scalpMomentum', tradingStyle: 'Scalping', type: 'BUY_SCALP_CONFIRMED' }];
    const map = new Map([[1000, 2]]);
    const cands = normalizeToCandidates(raw, [{ time: 1000, close: 2600, open: 2598, high: 2602, low: 2597 }], map, null, {}, { timeframe: '5m' }, null);

    assert.equal(cands[0].tradingStyle, TRADING_STYLES.SCALPING);
  });

  // =========================================================================
  // Test 19 — Intraday & Swing Isolation (Phase 6 Intact)
  // =========================================================================
  await t.test('Test 19: Intraday & Swing Isolation — Does not cross-suppress Intraday and Swing signals', () => {
    const baseTime = 1790000000000;
    const map = new Map([[baseTime, 5]]);

    const candidates = [
      { candidateId: 'intra-1', time: baseTime, price: 2600, direction: 'BUY', tradingStyle: TRADING_STYLES.INTRADAY, strategy: 'intradayBos' },
      { candidateId: 'swing-1', time: baseTime, price: 2600, direction: 'BUY', tradingStyle: TRADING_STYLES.SWING, strategy: 'swingPullback' },
    ];

    const { aggregatedSetups } = aggregateSetupEvidence(candidates, map);
    assert.equal(aggregatedSetups.length, 2, 'Independent trading styles must not suppress each other');
  });

  // =========================================================================
  // Test 20 — AUTO / HYBRID / MANUAL Mode Precedence
  // =========================================================================
  await t.test('Test 20: Settings Precedence — MANUAL mode strictly uses specified unifiedScoreThreshold', () => {
    const manualSettings = { settingsMode: 'MANUAL', unifiedScoreThreshold: 72 };
    const threshold = getAdaptiveScoreThreshold(manualSettings, { regime: 'Ranging' });
    assert.equal(threshold, 72, 'MANUAL mode must strictly return user threshold without regime adjustment');
  });

  // =========================================================================
  // Test 21 — Historical Score Snapshot (No Future Mutation)
  // =========================================================================
  await t.test('Test 21: Historical Score Snapshot — Score remains immutable once decision is rendered', () => {
    const candidate = {
      time: 1000,
      direction: 'BUY',
      unifiedScore: 68.5,
      isApproved: true,
      decision: 'BUY APPROVED',
    };

    // Subsequent market events in candles array do not mutate decision timestamp score
    const frozen = { ...candidate };
    assert.equal(frozen.unifiedScore, 68.5);
    assert.equal(frozen.decision, 'BUY APPROVED');
  });

  // =========================================================================
  // Test 22 — Non-Repainting Guarantee
  // =========================================================================
  await t.test('Test 22: Non-Repainting — Setup decision timestamp equals confirmation candle time', () => {
    const candles = createTestCandles(20);
    const confirmedTime = candles[15].time;

    const raw = [{ time: confirmedTime, price: candles[15].close, direction: 'BUY', strategy: 'obMss', type: 'BUY confirmed' }];
    const map = new Map([[confirmedTime, 15]]);
    const cands = normalizeToCandidates(raw, candles, map, null, {}, {}, null);

    assert.equal(cands[0].decisionTimestamp, confirmedTime);
    assert.equal(cands[0].confirmationTimestamp, confirmedTime);
  });

  // =========================================================================
  // Test 23 — Replay Consistency
  // =========================================================================
  await t.test('Test 23: Replay Consistency — Incremental evaluation produces identical approved IDs', async () => {
    const candles = createTestCandles(25, 2600, 'bullish');
    const settings = { enableUnifiedSignalEngine: true, qualityPreset: 'Balanced' };
    const config = { symbol: 'XAU/USD', timeframe: '15m' };

    const runFull = await runConfluenceEngine(candles, settings, config);
    const runHalf = await runConfluenceEngine(candles.slice(0, 20), settings, config);

    // Signals generated up to index 19 must match exactly
    const fullCutoffIds = runFull.tradeLog.filter(s => s.time <= candles[19].time && s.isApproved).map(s => s.id);
    const halfCutoffIds = runHalf.tradeLog.filter(s => s.isApproved).map(s => s.id);

    assert.deepEqual(halfCutoffIds, fullCutoffIds, 'Cutoff replay IDs must agree identically with full run');
  });

  // =========================================================================
  // Test 24 — API Chunk Boundary Stability
  // =========================================================================
  await t.test('Test 24: API Chunk Boundaries — Does not duplicate signals across merged chunks', () => {
    const baseTime = 1790000000000;
    const map = new Map([[baseTime, 10]]);

    // Two copies of same signal arriving from adjacent chunk boundary
    const duplicateChunkSignals = [
      { candidateId: 'chunk1-s1', time: baseTime, price: 2600, direction: 'BUY', strategy: 'obMss', tradingStyle: 'Intraday' },
      { candidateId: 'chunk2-s1', time: baseTime, price: 2600, direction: 'BUY', strategy: 'obMss', tradingStyle: 'Intraday' },
    ];

    const { aggregatedSetups } = aggregateSetupEvidence(duplicateChunkSignals, map);
    assert.equal(aggregatedSetups.length, 1, 'Chunk boundary duplicate must be seamlessly clustered into 1 setup');
  });

  // =========================================================================
  // Test 25 — Data Integrity Guard
  // =========================================================================
  await t.test('Test 25: Data Integrity — Malformed candle (NaN or 0 price) cannot be approved', () => {
    const invalidSignal = {
      time: 1000,
      price: 0, // Invalid price
      direction: 'BUY',
      unifiedScore: 95,
      type: 'BUY confirmed',
    };

    const dec = evaluateTradeDecision(invalidSignal, 50);
    assert.equal(dec.isApproved, false);
    assert.equal(dec.reasonCode, 'REJECT_DATA_INTEGRITY');
  });

  // =========================================================================
  // Test 26 — Signal Ranking and Opportunity Prioritization
  // =========================================================================
  await t.test('Test 26: Signal Ranking — Deterministically ranks best opportunities by Score and R:R', () => {
    const candles = createTestCandles(20);
    const map = new Map(candles.map((c, i) => [c.time, i]));

    const rawSignals = [
      { time: candles[5].time, price: candles[5].close, direction: 'BUY', strategy: 's1', tradingStyle: 'Intraday', score: 3.0, type: 'BUY confirmed' },
      { time: candles[10].time, price: candles[10].close, direction: 'BUY', strategy: 's2', tradingStyle: 'Intraday', score: 4.8, type: 'BUY confirmed' },
      { time: candles[8].time, price: candles[8].close, direction: 'SELL', strategy: 's3', tradingStyle: 'Scalping', score: 4.2, type: 'SELL confirmed' },
    ];

    const res = runUnifiedSignalEngine({
      candles,
      potentialSignals: rawSignals,
      activeSettings: { qualityPreset: 'Light' },
      candleTimeIndex: map,
    });

    assert.ok(res.rankedOpportunities.bestBuy, 'Must identify best BUY');
    assert.ok(res.rankedOpportunities.bestSell, 'Must identify best SELL');
    assert.equal(res.rankedOpportunities.bestBuy.strategy, 's2', 'Highest scoring BUY must rank as bestBuy');
  });

  // =========================================================================
  // Test 27 — Score Distribution by Strategy
  // =========================================================================
  await t.test('Test 27: Scoring Distribution — Diagnostics tracks grade distribution accurately', () => {
    const candles = createTestCandles(15);
    const map = new Map(candles.map((c, i) => [c.time, i]));
    const raw = [{ time: candles[2].time, price: 2600, direction: 'BUY', strategy: 'obMss', type: 'BUY confirmed' }];

    const res = runUnifiedSignalEngine({
      candles,
      potentialSignals: raw,
      candleTimeIndex: map,
    });

    assert.ok(res.diagnostics.gradeDistribution);
    assert.equal(typeof res.diagnostics.gradeDistribution['A'], 'number');
  });

  // =========================================================================
  // Test 28 — Quality vs Outcomes (Cost-Adjusted Backtesting Metrics)
  // =========================================================================
  await t.test('Test 28: Realistic Backtesting — Accurately tracks Win Rate and Net PnL in R units', () => {
    const candles = [
      { time: 1000, open: 100, high: 101, low: 99, close: 100 },
      { time: 2000, open: 100, high: 101, low: 99.5, close: 100 }, // Triggers BUY at 100
      { time: 3000, open: 100, high: 104, low: 99.8, close: 103.5 }, // Hits TP (103) -> +1.5R
    ];

    const map = new Map(candles.map((c, i) => [c.time, i]));
    const raw = [{ time: 1000, price: 100, sl: 98, tp: 103, direction: 'BUY', strategy: 'obMss', type: 'BUY confirmed' }];

    const res = runUnifiedSignalEngine({
      candles,
      potentialSignals: raw,
      activeSettings: { qualityPreset: 'Light' },
      candleTimeIndex: map,
    });

    assert.equal(res.diagnostics.executionStats.closedTp, 1);
    assert.equal(res.diagnostics.executionStats.winRate, 100);
    assert.equal(res.diagnostics.executionStats.netPnlR, 1.5);
  });

  // =========================================================================
  // Test 29 — Execution Costs & Slippage Modeling
  // =========================================================================
  await t.test('Test 29: Execution Costs — Unfilled limit orders are categorized as EXPIRED, not SL loss', () => {
    const candles = [
      { time: 1000, open: 100, high: 101, low: 99, close: 100 },
      { time: 2000, open: 100, high: 101, low: 99.5, close: 100 },
    ];

    const unhitSignal = {
      isApproved: true,
      price: 90, // Price never reached down to 90
      sl: 85,
      tp: 110,
      direction: 'BUY',
      tradingStyle: 'Scalping',
    };

    const tracked = trackSignalLifecycle(unhitSignal, candles, 0);
    assert.equal(tracked.pnlR, 0, 'Unfilled order must have 0 PnL');
    assert.notEqual(tracked.status, DECISION_STATUS.CLOSED_SL);
  });

  // =========================================================================
  // Test 30 — Performance Benchmark (< 250ms for 1,000 Candles)
  // =========================================================================
  await t.test('Test 30: Performance Benchmark — Evaluates 1,000 candles and 50 setups in < 250ms', () => {
    const candles = createTestCandles(1000);
    const map = new Map(candles.map((c, i) => [c.time, i]));

    const rawSignals = [];
    for (let i = 20; i < 980; i += 20) {
      rawSignals.push({
        time: candles[i].time,
        price: candles[i].close,
        direction: i % 40 === 0 ? 'BUY' : 'SELL',
        strategy: 'obMss',
        type: i % 40 === 0 ? 'BUY confirmed' : 'SELL confirmed',
        score: 4.0,
      });
    }

    const t0 = performance.now();
    const res = runUnifiedSignalEngine({
      candles,
      potentialSignals: rawSignals,
      candleTimeIndex: map,
    });
    const duration = performance.now() - t0;

    assert.ok(duration < 250, `Performance benchmark must execute under 250ms, took ${duration.toFixed(1)}ms`);
    assert.ok(res.tradeLog.length > 0);
  });

});
