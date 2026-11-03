/**
 * Phase 10 — Institutional Walk-Forward Validation Engine
 * Implements chronological rolling & expanding window Walk-Forward testing across multiple folds
 * with strict Out-of-Sample (OOS) isolation to prevent look-ahead bias and overfitting.
 */

import { runConfluenceEngine } from '@/lib/liquidity';
import { calculateBacktestMetrics } from './analyticsEngine';

export async function runWalkForwardValidation(candles, options = {}) {
  const {
    foldsCount = 4,
    trainRatio = 0.7, // 70% Train, 30% Test per fold
    method = 'ROLLING', // 'ROLLING' | 'ANCHORED'
    symbol = 'XAUUSD',
    timeframe = '15m',
    settings = {},
    config = {},
    initialBalance = 10000,
    executionCosts = {},
  } = options;

  if (!candles || candles.length < 50) {
    return {
      folds: [],
      aggregatedOosMetrics: null,
      oosEfficiencyRatio: 0,
      parameterStability: 'INSUFFICIENT_DATA',
      warnings: ['Insufficient historical candles for Walk-Forward fold splitting (min 50 required).'],
    };
  }

  const totalCandles = candles.length;
  const foldSize = Math.floor(totalCandles / foldsCount);
  const folds = [];
  const oosTrades = [];

  let accumulatedTrainMetrics = [];

  for (let k = 0; k < foldsCount; k++) {
    const foldStartIndex = method === 'ANCHORED' ? 0 : k * Math.floor(foldSize * (1 - trainRatio));
    const trainEndIndex = Math.floor(foldStartIndex + foldSize * trainRatio);
    const testEndIndex = Math.min(totalCandles, trainEndIndex + Math.floor(foldSize * (1 - trainRatio)));

    if (trainEndIndex >= totalCandles || testEndIndex <= trainEndIndex) continue;

    const trainCandles = candles.slice(foldStartIndex, trainEndIndex);
    const testCandles = candles.slice(Math.max(0, trainEndIndex - 20), testEndIndex); // 20-candle warm-up buffer

    // 1. In-Sample Training Run
    const trainAnalysis = await runConfluenceEngine(trainCandles, settings, { ...config, symbol, timeframe });
    const trainMetrics = calculateBacktestMetrics(trainAnalysis.tradeLog || [], initialBalance, executionCosts);
    accumulatedTrainMetrics.push(trainMetrics);

    // 2. Out-of-Sample Testing Run (Frozen parameters on unseen candles)
    const testAnalysis = await runConfluenceEngine(testCandles, settings, { ...config, symbol, timeframe });
    const rawTestTrades = testAnalysis.tradeLog || [];

    // Filter test trades strictly to the test period (after trainEndIndex timestamp)
    const testCutoffTime = trainCandles[trainCandles.length - 1].time;
    const validOosTrades = rawTestTrades.filter(t => (t.time || t.entryTime) > testCutoffTime);
    const testMetrics = calculateBacktestMetrics(validOosTrades, initialBalance, executionCosts);

    oosTrades.push(...validOosTrades);

    folds.push({
      foldIndex: k + 1,
      trainRange: {
        from: trainCandles[0].time,
        to: trainCandles[trainCandles.length - 1].time,
        candlesCount: trainCandles.length,
      },
      testRange: {
        from: testCandles[0].time,
        to: testCandles[testCandles.length - 1].time,
        candlesCount: testCandles.length - 20,
      },
      trainMetrics,
      testMetrics,
    });
  }

  // 3. Aggregate Out-Of-Sample Performance
  const aggregatedOosMetrics = calculateBacktestMetrics(oosTrades, initialBalance, executionCosts);

  // OOS Efficiency Ratio = Aggregated OOS Net Expectancy / Average In-Sample Net Expectancy
  const avgTrainExpectancy = accumulatedTrainMetrics.length > 0
    ? accumulatedTrainMetrics.reduce((sum, m) => sum + m.netExpectancy, 0) / accumulatedTrainMetrics.length
    : 0;

  const oosEfficiencyRatio = avgTrainExpectancy !== 0
    ? Math.round((aggregatedOosMetrics.netExpectancy / avgTrainExpectancy) * 100) / 100
    : 1.0;

  // Stability Classification
  let parameterStability = 'STABLE';
  const warnings = [];

  if (oosEfficiencyRatio < 0.4) {
    parameterStability = 'OVERFITTED';
    warnings.push('High performance degradation in Out-Of-Sample folds (OOS Efficiency < 40%). Strategy may be overfitted to training period.');
  } else if (oosEfficiencyRatio < 0.7) {
    parameterStability = 'MODERATE';
    warnings.push('Moderate performance drop observed in Out-Of-Sample test folds.');
  }

  if (aggregatedOosMetrics.totalTrades < 10) {
    warnings.push('Low total Out-Of-Sample trade count (< 10 trades). Statistical sample size is limited.');
  }

  return {
    method,
    foldsCount: folds.length,
    folds,
    aggregatedOosMetrics,
    oosEfficiencyRatio,
    parameterStability,
    warnings,
  };
}
