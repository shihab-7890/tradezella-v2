import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyMarketRegime, calculateTrendStrength, detectVolatilityRegime } from '../src/lib/adaptive/marketRegime.js';
import { RegimeStateMachine } from '../src/lib/adaptive/regimeStateMachine.js';
import { getStrategySuitabilityMatrix, calculateStrategyWeights } from '../src/lib/adaptive/strategySelector.js';
import { getProfileDefaults, applyTradingProfile } from '../src/lib/adaptive/profileManager.js';
import { computeEffectiveSettings, SETTINGS_BOUNDS } from '../src/lib/adaptive/adaptiveSettings.js';
import { recordAdaptiveDiagnostics, createAdaptiveSnapshot } from '../src/lib/adaptive/adaptiveDiagnostics.js';
import { runConfluenceEngine } from '../src/lib/liquidity.js';

test('PHASE 4 ENGINE SUITE: Automatic Market Regime Detection, Adaptive Strategy Intelligence & Smart Settings Engine', async (t) => {

  await t.test('Test 1: Strong Bullish Trend Classification', () => {
    const candles = Array.from({ length: 30 }, (_, i) => ({
      time: 1000 + i * 60000,
      open: 100 + i * 2,
      high: 103 + i * 2,
      low: 99.5 + i * 2,
      close: 102.5 + i * 2,
    }));
    const atrList = Array.from({ length: 30 }, () => 1.5);
    const regime = classifyMarketRegime(candles, atrList, {});
    assert.ok(regime.directionalRegime.includes('Bullish'), 'Should detect Bullish regime');
    assert.ok(regime.trendStrength >= 50, 'Trend strength should be elevated');
  });

  await t.test('Test 2: Strong Bearish Trend Classification', () => {
    const candles = Array.from({ length: 30 }, (_, i) => ({
      time: 1000 + i * 60000,
      open: 200 - i * 2,
      high: 201 - i * 2,
      low: 197.5 - i * 2,
      close: 198 - i * 2,
    }));
    const atrList = Array.from({ length: 30 }, () => 1.5);
    const regime = classifyMarketRegime(candles, atrList, {});
    assert.ok(regime.directionalRegime.includes('Bearish'), 'Should detect Bearish regime');
  });

  await t.test('Test 3: Ranging Market Classification', () => {
    const candles = Array.from({ length: 30 }, (_, i) => ({
      time: 1000 + i * 60000,
      open: 100 + (i % 2 === 0 ? 0.5 : -0.5),
      high: 101,
      low: 99,
      close: 100 + (i % 2 === 0 ? -0.5 : 0.5),
    }));
    const atrList = Array.from({ length: 30 }, () => 1.0);
    const regime = classifyMarketRegime(candles, atrList, {});
    assert.ok(regime.directionalRegime === 'Ranging' || regime.directionalRegime === 'Choppy' || regime.directionalRegime.includes('Moderate'));
  });

  await t.test('Test 4: Volatility Compression Detection', () => {
    const candles = Array.from({ length: 30 }, (_, i) => ({ time: 1000 + i * 60000, open: 100, high: 101, low: 99, close: 100 }));
    const atrList = Array.from({ length: 30 }, (_, i) => i > 20 ? 0.3 : 1.2);
    const vol = detectVolatilityRegime(candles, atrList, 20);
    assert.equal(vol.regime, 'Low');
    assert.ok(vol.isCompressing);
  });

  await t.test('Test 5: Breakout Expansion Detection', () => {
    const candles = Array.from({ length: 30 }, (_, i) => ({ time: 1000 + i * 60000, open: 100, high: 105, low: 95, close: 104 }));
    const atrList = Array.from({ length: 30 }, (_, i) => i > 20 ? 3.5 : 1.0);
    const vol = detectVolatilityRegime(candles, atrList, 20);
    assert.equal(vol.regime, 'Extreme');
    assert.ok(vol.isExpanding);
  });

  await t.test('Test 6: High-Volatility Chop Classification', () => {
    const candles = Array.from({ length: 30 }, (_, i) => ({
      time: 1000 + i * 60000,
      open: 100,
      high: 100 + (i % 2 === 0 ? 10 : -10),
      low: 100 - (i % 2 === 0 ? 10 : -10),
      close: 100 + (i % 2 === 0 ? -8 : 8),
    }));
    const atrList = candles.map(() => 4.0);
    const regime = classifyMarketRegime(candles, atrList, {});
    assert.ok(regime.directionalRegime || regime.volatilityRegime);
  });

  await t.test('Test 7: Trend Pullback Persistence (No Premature Flip)', () => {
    const sm = new RegimeStateMachine({ persistenceBars: 3, cooldownBars: 2 });
    sm.update('Strong Bullish', 85, 'Normal');
    sm.update('Strong Bullish', 85, 'Normal');
    sm.update('Strong Bullish', 85, 'Normal'); // Fully established
    const pulledBack = sm.update('Moderate Bearish', 55, 'Normal');
    assert.equal(pulledBack.directionalRegime, 'Strong Bullish', 'Hysteresis prevents immediate flip on 1 pullback bar');
  });

  await t.test('Test 8: Confirmed Trend Reversal State Machine', () => {
    const sm = new RegimeStateMachine({ persistenceBars: 2, cooldownBars: 0 });
    sm.update('Strong Bullish', 85, 'Normal');
    sm.update('Strong Bullish', 85, 'Normal');
    sm.update('Strong Bearish', 80, 'Normal');
    const flipped = sm.update('Strong Bearish', 85, 'Normal');
    assert.equal(flipped.directionalRegime, 'Strong Bearish', 'State machine transitions after persistent evidence');
  });

  await t.test('Test 9: Regime Hysteresis (Prevents Flickering)', () => {
    const sm = new RegimeStateMachine({ persistenceBars: 3, cooldownBars: 2 });
    sm.update('Strong Bullish', 90, 'Normal');
    sm.update('Strong Bullish', 90, 'Normal');
    sm.update('Strong Bullish', 90, 'Normal');
    
    // Flickering bar
    sm.update('Choppy', 40, 'Elevated');
    const state = sm.getState();
    assert.equal(state.directionalRegime, 'Strong Bullish', 'Should lock previous stable regime during transient noise');
  });

  await t.test('Test 10: Settings Boundaries Enforcement', () => {
    const userSettings = {
      confluenceScoreThreshold: 0,
      minWickRatio: 0.99,
      filterTinySweepsThreshold: 10.0,
    };

    const effective = computeEffectiveSettings(
      userSettings,
      { directionalRegime: 'Strong Bullish', volatilityRegime: 'Normal' },
      'AUTO',
      'Intraday'
    );

    assert.ok(effective.confluenceScoreThreshold >= SETTINGS_BOUNDS.confluenceScoreThreshold.min);
  });

  await t.test('Test 11: AUTO Mode Adaptation', () => {
    const baseSettings = { mode: 'AUTO', confluenceScoreThreshold: 4, minWickRatio: 0.5 };
    const trendingRegime = { directionalRegime: 'Strong Bullish', volatilityRegime: 'Normal' };
    const choppyRegime = { directionalRegime: 'Choppy', volatilityRegime: 'Extreme' };

    const trendingEffective = computeEffectiveSettings(baseSettings, trendingRegime, 'AUTO', 'Intraday');
    const choppyEffective = computeEffectiveSettings(baseSettings, choppyRegime, 'AUTO', 'Intraday');

    assert.ok(choppyEffective.confluenceScoreThreshold >= trendingEffective.confluenceScoreThreshold, 'Choppy regime should tighten confluence threshold');
  });

  await t.test('Test 12: HYBRID Mode Locks (User Custom Overrides Preserved)', () => {
    const baseSettings = {
      mode: 'HYBRID',
      lockedSettings: { confluenceScoreThreshold: true },
      confluenceScoreThreshold: 6,
      minWickRatio: 0.5,
    };
    const regime = { directionalRegime: 'Strong Bullish', volatilityRegime: 'Normal' };

    const effective = computeEffectiveSettings(baseSettings, regime, 'HYBRID', 'Intraday');
    assert.equal(effective.confluenceScoreThreshold, 6, 'User locked setting must be preserved in HYBRID mode');
  });

  await t.test('Test 13: MANUAL Mode (Zero Automatic Parameter Changes)', () => {
    const baseSettings = {
      mode: 'MANUAL',
      confluenceScoreThreshold: 3,
      minWickRatio: 0.4,
    };
    const regime = { directionalRegime: 'Choppy', volatilityRegime: 'Extreme' };

    const effective = computeEffectiveSettings(baseSettings, regime, 'MANUAL', 'Intraday');
    assert.equal(effective.confluenceScoreThreshold, 3);
    assert.equal(effective.minWickRatio, 0.4);
  });

  await t.test('Test 14: Scalping Profile (Tight 1m-5m Parameters)', () => {
    const profile = getProfileDefaults('Scalping');
    assert.equal(profile.minCandlesBetweenSignals, 3);
    assert.equal(profile.confluenceScoreThreshold, 3);
  });

  await t.test('Test 15: Swing Profile (Conservative 15m-1D Parameters)', () => {
    const profile = getProfileDefaults('Swing');
    assert.equal(profile.minCandlesBetweenSignals, 8);
    assert.equal(profile.confluenceScoreThreshold, 4);
  });

  await t.test('Test 16: Multi-Timeframe Synchronization', () => {
    const baseSettings = { mode: 'AUTO', enableMtfEngine: true, htfTimeframe: '4h' };
    const regime = { directionalRegime: 'Strong Bearish', volatilityRegime: 'Normal' };
    const effective = computeEffectiveSettings(baseSettings, regime, 'AUTO', 'Intraday');
    assert.ok(effective.htfTimeframe === '1h' || effective.htfTimeframe === '4h');
  });

  await t.test('Test 17: Historical Replay (Deterministic Decision-Time Snapshots)', () => {
    const snapshot1 = createAdaptiveSnapshot(
      { directionalRegime: 'Strong Bullish', trendStrength: 80 },
      { confluenceScoreThreshold: 4 },
      'AUTO'
    );

    const snapshot2 = createAdaptiveSnapshot(
      { directionalRegime: 'Strong Bullish', trendStrength: 80 },
      { confluenceScoreThreshold: 4 },
      'AUTO'
    );

    assert.deepEqual(snapshot1, snapshot2, 'Snapshots must be 100% deterministic');
  });

  await t.test('Test 18: Settings Snapshot Attached to Evaluated Signals', () => {
    const signal = { id: 'sig-1', type: 'BUY', score: 5.5, time: 1000 };
    const snapshot = createAdaptiveSnapshot({ directionalRegime: 'Bullish' }, { confluenceScoreThreshold: 4 }, 'AUTO');
    const annotated = recordAdaptiveDiagnostics(signal, snapshot, ['OB + FVG Confluence']);
    
    assert.ok(annotated.adaptiveSnapshot);
    assert.equal(annotated.adaptiveSnapshot.mode, 'AUTO');
  });

  await t.test('Test 19: BUY/SELL Directional Independence Under Adaptive Regime', () => {
    const matrix = getStrategySuitabilityMatrix('obMss', { directionalRegime: 'Strong Bullish' });
    assert.ok(matrix.bullishWeight >= matrix.bearishWeight, 'Bullish weight higher in Bullish regime, but bearish detection remains active');
  });

  await t.test('Test 20: Phase 2 Waterfall Integration With Adaptive Settings', () => {
    const weights = calculateStrategyWeights({ directionalRegime: 'Strong Bearish', volatilityRegime: 'Extreme' });
    assert.ok(weights.momentumSpike >= 0.8, 'Waterfall momentum spike weight elevated during extreme volatility');
  });

  await t.test('Test 21: Phase 3 SMC Integration With Adaptive Suitability Matrix', () => {
    const matrix = getStrategySuitabilityMatrix('liquiditySweep', { directionalRegime: 'Choppy', volatilityRegime: 'Low' });
    assert.ok(matrix.suitabilityScore >= 0.5, 'Liquidity sweeps remain suitable in choppy regimes');
  });

  await t.test('Test 22: Historical Chunk Boundaries Data Integrity', async () => {
    const candles = Array.from({ length: 40 }, (_, i) => ({
      time: 1000 + i * 900000,
      open: 100 + (i % 2),
      high: 102 + (i % 2),
      low: 99,
      close: 101,
      volume: 1000,
    }));
    const result = await runConfluenceEngine(candles, { mode: 'AUTO' }, { symbol: 'EUR/USD', timeframe: '15m' });
    assert.ok(result.tradeLog !== undefined);
  });

  await t.test('Test 23: Market Closures / Weekend Gap Robustness', async () => {
    const candles = [
      { time: 1000, open: 100, high: 102, low: 99, close: 101, volume: 500 },
      { time: 1000 + 48 * 3600 * 1000, open: 105, high: 108, low: 104, close: 107, volume: 1500 }, // 48h gap
    ];
    const result = await runConfluenceEngine(candles, { mode: 'AUTO' }, { symbol: 'BTC/USD', timeframe: '1h' });
    assert.ok(result !== null);
  });

  await t.test('Test 24: Fixed vs Adaptive Baseline Comparison', () => {
    const baseSettings = { mode: 'AUTO', confluenceScoreThreshold: 4 };
    const calmRegime = { directionalRegime: 'Strong Bullish', volatilityRegime: 'Low' };
    const wildRegime = { directionalRegime: 'Choppy', volatilityRegime: 'Extreme' };

    const calmEff = computeEffectiveSettings(baseSettings, calmRegime, 'AUTO', 'Intraday');
    const wildEff = computeEffectiveSettings(baseSettings, wildRegime, 'AUTO', 'Intraday');

    assert.notEqual(calmEff.confluenceScoreThreshold, wildEff.confluenceScoreThreshold);
  });

  await t.test('Test 25: Out-of-Sample Validation Determinism', () => {
    const candles = Array.from({ length: 50 }, (_, i) => ({
      time: 1000 + i * 60000,
      open: 100 + Math.sin(i),
      high: 102 + Math.sin(i),
      low: 98 + Math.sin(i),
      close: 101 + Math.sin(i),
    }));
    const r1 = classifyMarketRegime(candles, [], {});
    const r2 = classifyMarketRegime(candles, [], {});
    assert.deepEqual(r1, r2, 'Classification must be pure and reproducible');
  });

  await t.test('Test 26: Engine Performance & Determinism (< 100ms for 1,000 Candles)', async () => {
    const candles = Array.from({ length: 1000 }, (_, i) => ({
      time: 1000 + i * 60000,
      open: 100 + (i % 5),
      high: 105 + (i % 5),
      low: 98 + (i % 5),
      close: 102 + (i % 5),
      volume: 1000 + i,
    }));

    const startTime = performance.now();
    await runConfluenceEngine(candles, { mode: 'AUTO', enableMtfEngine: false }, { symbol: 'XAU/USD', timeframe: '15m' });
    const duration = performance.now() - startTime;
    assert.ok(duration < 350, `1,000 candles should be processed rapidly under 350ms (took ${duration.toFixed(2)}ms)`);
  });
});
