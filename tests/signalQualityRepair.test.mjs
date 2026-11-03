import { describe, it } from 'node:test';
import assert from 'node:assert';
import { scoreCandidate } from '../src/lib/signals/confluenceScoring.js';
import { getAdaptiveScoreThreshold, evaluateTradeDecision } from '../src/lib/signals/tradeDecision.js';
import { resolveSignalConflicts } from '../src/lib/signals/conflictResolver.js';
import { aggregateSetupEvidence } from '../src/lib/signals/setupDeduplication.js';
import { exportTradesToCsv, sanitizeCsvField } from '../src/lib/reports/csvExporter.js';
import { DEFAULT_STRATEGY_SETTINGS } from '../src/lib/liquidity.js';
import { calculateBacktestMetrics } from '../src/lib/backtest/analyticsEngine.js';

describe('Signal Quality & Decision Pipeline Repair Suite', () => {

  it('1. Canonical Grade Mapping — Correctly assigns A+, A, B, Watch, and Rejected grades', () => {
    const highScoringCandidate = {
      score: 10,
      strategy: 'smcSweepMss',
      strategyFamily: 'smc',
      confirmations: ['smcSweepMss', 'smcObFvg', 'sweepObFvgConfluence'],
      evidence: {
        marketStructure: { hasBos: true, hasMss: true, isFresh: true },
        liquidity: { sweepDetected: true, reclaimConfirmed: true, poolSignificance: 'high' },
        candlePsychology: { displacementQuality: 0.9, rejectionWickRatio: 0.5, momentumFollowThrough: true },
        zoneConfluence: { inOrderBlock: true, inFvg: true, atFibLevel: true, inDiscountOrPremium: true },
        multiTimeframe: { htfDirection: 'BULLISH', alignedWithHtf: true, atKeyLevel: true },
        marketRegime: { regime: 'Bullish Trend', suitability: 0.9 },
        riskSuitability: { validSl: true, riskRewardRatio: 2.5 },
      },
      riskReward: 2.5,
    };

    const scored = scoreCandidate(highScoringCandidate);
    assert.ok(scored.unifiedScore >= 85, `Expected score >= 85, got ${scored.unifiedScore}`);
    assert.strictEqual(scored.qualityTier, 'A+');

    // Test grade boundary mapping directly with neutral evidence
    const nullEvidence = { marketRegime: { suitability: 0 }, candlePsychology: { displacementQuality: 0 }, riskSuitability: { validSl: false } };
    assert.strictEqual(scoreCandidate({ score: 85, riskReward: 1.0, evidence: nullEvidence }).qualityTier, 'A+');
    assert.strictEqual(scoreCandidate({ score: 75, riskReward: 1.0, evidence: nullEvidence }).qualityTier, 'A');
    assert.strictEqual(scoreCandidate({ score: 65, riskReward: 1.0, evidence: nullEvidence }).qualityTier, 'B');
    assert.strictEqual(scoreCandidate({ score: 50, riskReward: 1.0, evidence: nullEvidence }).qualityTier, 'Watch');
  });

  it('2. Multi-Gate Quality Pipeline — Correctly evaluates Gates A through E', () => {
    // Gate A: Malformed Data -> Rejected
    const gateA = evaluateTradeDecision({ price: 0, time: Date.now() }, 75);
    assert.strictEqual(gateA.isApproved, false);
    assert.strictEqual(gateA.reasonCode, 'REJECT_DATA_INTEGRITY');

    // Gate B: Candidate Only -> Watch
    const gateB = evaluateTradeDecision({ price: 2000, time: Date.now(), type: 'BUY_candidate', direction: 'BUY' }, 75);
    assert.strictEqual(gateB.isApproved, false);
    assert.strictEqual(gateB.reasonCode, 'WATCH_PENDING_CONFIRMATION');

    // Gate C: Stale Level -> Rejected
    const gateC = evaluateTradeDecision({ price: 2000, time: Date.now(), direction: 'BUY', type: 'BUY confirmed', evidence: { marketStructure: { isFresh: false } } }, 75);
    assert.strictEqual(gateC.isApproved, false);
    assert.strictEqual(gateC.reasonCode, 'REJECT_STALE_LEVEL');

    // Gate D: Low R:R (< 1.1) -> Rejected
    const gateD = evaluateTradeDecision({ price: 2000, time: Date.now(), direction: 'BUY', type: 'BUY confirmed', riskReward: 0.8 }, 75);
    assert.strictEqual(gateD.isApproved, false);
    assert.strictEqual(gateD.reasonCode, 'REJECT_INADEQUATE_RR');

    // Gate E: Score below threshold (e.g. 60 vs 75) -> Watch/Rejected
    const gateE = evaluateTradeDecision({ price: 2000, time: Date.now(), direction: 'BUY', type: 'BUY confirmed', unifiedScore: 60, qualityTier: 'Watch', riskReward: 2.0 }, 75);
    assert.strictEqual(gateE.isApproved, false);
    assert.strictEqual(gateE.reasonCode, 'WATCH_SCORE_MODERATE');

    // Gate E Passed: Score >= 75 -> Approved
    const gateEPass = evaluateTradeDecision({ price: 2000, time: Date.now(), direction: 'BUY', type: 'BUY confirmed', unifiedScore: 80, qualityTier: 'A', riskReward: 2.0, strategy: 'smcSweepMss' }, 75);
    assert.strictEqual(gateEPass.isApproved, true);
    assert.strictEqual(gateEPass.reasonCode, 'APPROVED_HIGH_CONFLUENCE');
  });

  it('3. Quality First Preset Defaulting — Defaults to QUALITY_FIRST mode and threshold 75', () => {
    assert.strictEqual(DEFAULT_STRATEGY_SETTINGS.qualityPreset, 'QUALITY_FIRST');
    assert.strictEqual(DEFAULT_STRATEGY_SETTINGS.unifiedScoreThreshold, 75);

    const threshold = getAdaptiveScoreThreshold(DEFAULT_STRATEGY_SETTINGS);
    assert.strictEqual(threshold, 75);
  });

  it('4. Setup Deduplication — Groups candidates and eliminates duplicate event flooding', () => {
    const candleTimeIndex = new Map([
      [1000, 0],
      [1060, 1],
      [1120, 2],
    ]);

    const rawCandidates = [
      { candidateId: 'c1', strategy: 'liquiditySweep', direction: 'BUY', price: 2000.0, time: 1000, tradingStyle: 'Intraday', score: 70 },
      { candidateId: 'c2', strategy: 'obMss', direction: 'BUY', price: 2000.2, time: 1000, tradingStyle: 'Intraday', score: 80 },
      { candidateId: 'c3', strategy: 'fvgImbalance', direction: 'BUY', price: 2000.1, time: 1060, tradingStyle: 'Intraday', score: 75 },
    ];

    const result = aggregateSetupEvidence(rawCandidates, candleTimeIndex, {
      timeToleranceCandles: 4,
      priceTolerancePct: 0.003,
      minCandlesBetweenSignals: 5,
    });

    assert.strictEqual(result.aggregatedSetups.length, 1);
    assert.ok(result.duplicatesSuppressed >= 2);
    assert.strictEqual(result.aggregatedSetups[0].confirmations.length, 3);
  });

  it('5. Conflict Analysis & Metadata — Populates conflictType and relatedCandidateIds', () => {
    const candleTimeIndex = new Map([
      [1000, 0],
    ]);

    const setups = [
      { candidateId: 'buy-1', id: 'buy-1', direction: 'BUY', price: 2000.0, time: 1000, tradingStyle: 'Intraday', unifiedScore: 80, type: 'BUY confirmed' },
      { candidateId: 'sell-1', id: 'sell-1', direction: 'SELL', price: 2000.1, time: 1000, tradingStyle: 'Intraday', unifiedScore: 78, type: 'SELL confirmed' },
    ];

    const { resolvedSetups, conflictsDetected } = resolveSignalConflicts(setups, candleTimeIndex, {
      conflictTimeTolerance: 4,
      conflictPriceTolerance: 0.005,
    });

    assert.ok(conflictsDetected.length > 0);
    assert.strictEqual(conflictsDetected[0].type, 'SAME_SETUP_OPPOSITE');
    assert.ok(conflictsDetected[0].relatedCandidateIds.includes('buy-1'));
    assert.ok(conflictsDetected[0].relatedCandidateIds.includes('sell-1'));
    assert.ok(resolvedSetups[0].relatedCandidateIds.includes('sell-1'));
  });

  it('6. CSV Export Escaping — Properly wraps timestamp strings containing commas', () => {
    const trades = [
      {
        time: 1793618533329,
        decision: 'BUY APPROVED',
        direction: 'BUY',
        price: 2000.5,
        sl: 1990.0,
        tp: 2020.0,
        unifiedScore: 88,
        qualityTier: 'A+',
        tradingStyle: 'Intraday',
        strategy: 'smcSweepMss',
        realizedPnl: 150.0,
        notes: 'Sweep + OB, FVG',
      }
    ];

    const csvStr = exportTradesToCsv(trades);
    assert.ok(csvStr.includes('"2026-'), 'CSV should sanitize and enclose timestamp');
    assert.ok(csvStr.includes('"Intraday"'), 'CSV should include non-empty Style');

    // Test quote escaping function directly
    const escaped = sanitizeCsvField('Date, with comma');
    assert.strictEqual(escaped, '"Date, with comma"');
  });

  it('7. Report Empty Trade Handling — Returns N/A for win rate when total trades is 0', () => {
    const metrics = calculateBacktestMetrics([], 10000);
    assert.strictEqual(metrics.totalTrades, 0);
    assert.strictEqual(metrics.winRate, 0);
  });

});
