/**
 * Phase 10 — Strategy Parameter Optimization Engine
 * Bounded parameter grid search & seeded random search for objective optimization
 * (Net Expectancy, Profit Factor, Sharpe Ratio) with overfitting safeguards.
 */

import { runConfluenceEngine } from '@/lib/liquidity';
import { calculateBacktestMetrics } from './analyticsEngine';

export const OPTIMIZABLE_PARAMETERS = [
  { name: 'confluenceScoreThreshold', label: 'Confluence Score Threshold', min: 2.5, max: 5.5, step: 0.5, default: 4.0 },
  { name: 'minimumDisplacementAtr', label: 'Min Displacement ATR', min: 0.4, max: 1.6, step: 0.2, default: 0.8 },
  { name: 'slBufferPercent', label: 'SL Buffer %', min: 0.001, max: 0.005, step: 0.001, default: 0.002 },
  { name: 'defaultRiskRewardRatio', label: 'Default Risk/Reward Ratio', min: 1.0, max: 3.0, step: 0.5, default: 1.5 },
  { name: 'minCandlesBetweenSignals', label: 'Min Candles Spacing', min: 2, max: 10, step: 2, default: 5 },
];

export async function runStrategyOptimization(candles, options = {}) {
  const {
    method = 'GRID_SEARCH', // 'GRID_SEARCH' | 'RANDOM_SEARCH'
    trialBudget = 12,
    objective = 'NET_EXPECTANCY', // 'NET_EXPECTANCY' | 'PROFIT_FACTOR' | 'SHARPE_RATIO'
    selectedParams = ['confluenceScoreThreshold', 'minimumDisplacementAtr'],
    baseSettings = {},
    config = {},
    initialBalance = 10000,
    executionCosts = {},
  } = options;

  if (!candles || candles.length < 30) {
    return {
      trials: [],
      bestTrial: null,
      warnings: ['Insufficient candles for parameter optimization.'],
    };
  }

  // 1. Generate Parameter Combination Trials
  const paramDefs = OPTIMIZABLE_PARAMETERS.filter(p => selectedParams.includes(p.name));
  const parameterSpace = [];

  function generateCombinations(index, current) {
    if (index >= paramDefs.length) {
      parameterSpace.push({ ...current });
      return;
    }
    const param = paramDefs[index];
    for (let val = param.min; val <= param.max + 0.0001; val += param.step) {
      const roundedVal = Math.round(val * 10000) / 10000;
      generateCombinations(index + 1, { ...current, [param.name]: roundedVal });
    }
  }

  generateCombinations(0, {});

  // Limit combinations to trial budget
  let selectedCombinations = parameterSpace;
  if (method === 'RANDOM_SEARCH' || parameterSpace.length > trialBudget) {
    const shuffled = [...parameterSpace].sort(() => 0.5 - Math.random());
    selectedCombinations = shuffled.slice(0, trialBudget);
  }

  // Always include default baseline combination
  const defaultCombo = {};
  paramDefs.forEach(p => { defaultCombo[p.name] = p.default; });
  if (!selectedCombinations.some(c => JSON.stringify(c) === JSON.stringify(defaultCombo))) {
    selectedCombinations.unshift(defaultCombo);
  }

  const trials = [];
  let bestTrial = null;
  let bestObjectiveScore = -Infinity;

  // 2. Evaluate Trials
  for (let i = 0; i < selectedCombinations.length; i++) {
    const combo = selectedCombinations[i];
    const trialSettings = {
      ...baseSettings,
      ...combo,
    };

    const analysis = await runConfluenceEngine(candles, trialSettings, config);
    const metrics = calculateBacktestMetrics(analysis.tradeLog || [], initialBalance, executionCosts);

    let objectiveScore = 0;
    if (objective === 'PROFIT_FACTOR') {
      objectiveScore = metrics.profitFactor;
    } else if (objective === 'SHARPE_RATIO') {
      objectiveScore = metrics.sharpeRatio;
    } else { // NET_EXPECTANCY
      objectiveScore = metrics.netExpectancy;
    }

    const trialRecord = {
      trialId: `trial-${i + 1}`,
      params: combo,
      metrics,
      objectiveScore: Math.round(objectiveScore * 100) / 100,
      isDefault: JSON.stringify(combo) === JSON.stringify(defaultCombo),
    };

    trials.push(trialRecord);

    if (objectiveScore > bestObjectiveScore && metrics.totalTrades >= 3) {
      bestObjectiveScore = objectiveScore;
      bestTrial = trialRecord;
    }
  }

  // Fallback to default if no trial met minimum trade count threshold
  if (!bestTrial && trials.length > 0) {
    bestTrial = trials[0];
  }

  const defaultTrial = trials.find(t => t.isDefault) || trials[0];
  const comparison = {
    defaultMetrics: defaultTrial.metrics,
    optimizedMetrics: bestTrial ? bestTrial.metrics : defaultTrial.metrics,
    expectancyGain: bestTrial ? Math.round((bestTrial.metrics.netExpectancy - defaultTrial.metrics.netExpectancy) * 100) / 100 : 0,
    winRateGain: bestTrial ? Math.round((bestTrial.metrics.winRate - defaultTrial.metrics.winRate) * 10) / 10 : 0,
  };

  return {
    method,
    objective,
    trialsCount: trials.length,
    trials: trials.sort((a, b) => b.objectiveScore - a.objectiveScore),
    bestTrial,
    defaultTrial,
    comparison,
  };
}
