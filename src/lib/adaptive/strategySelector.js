/**
 * Strategy Suitability Matrix & Dynamic Strategy Selector Engine
 * Dynamically weights Phase 1, Phase 2, and Phase 3 strategies according to active market regime.
 */

export const STRATEGY_REGIME_SUITABILITY = {
  'Strong Bullish': {
    waterfallEarly: 1.2,
    waterfallFirstPullback: 1.3,
    waterfallShallow: 1.2,
    smcBosContinuation: 1.3,
    smcObFvg: 1.3,
    smcPremDiscOb: 1.2,
    candlePsychologyEngulfing: 1.1,
    candlePsychologyRejection: 1.1,
    smcSweepMss: 0.9,
    candlePsychologyReversal: 0.8,
  },
  'Moderate Bullish': {
    waterfallFirstPullback: 1.2,
    smcObFvg: 1.2,
    smcBosContinuation: 1.1,
    smcChochRetest: 1.1,
    smcSweepMss: 1.0,
    candlePsychologyEngulfing: 1.0,
    candlePsychologyRejection: 1.0,
  },
  'Strong Bearish': {
    waterfallEarly: 1.3,
    waterfallFirstPullback: 1.3,
    waterfallShallow: 1.2,
    smcBosContinuation: 1.3,
    smcObFvg: 1.3,
    smcPremDiscOb: 1.2,
    candlePsychologyEngulfing: 1.1,
    candlePsychologyRejection: 1.1,
    smcSweepMss: 0.9,
    candlePsychologyReversal: 0.8,
  },
  'Moderate Bearish': {
    waterfallFirstPullback: 1.2,
    smcObFvg: 1.2,
    smcBosContinuation: 1.1,
    smcChochRetest: 1.1,
    smcSweepMss: 1.0,
    candlePsychologyEngulfing: 1.0,
    candlePsychologyRejection: 1.0,
  },
  'Ranging': {
    smcSweepMss: 1.3,
    candlePsychologyReversal: 1.2,
    candlePsychologyRejection: 1.2,
    smcPremDiscOb: 1.1,
    waterfallFirstPullback: 0.8,
    smcBosContinuation: 0.7,
  },
  'Choppy': {
    smcSweepMss: 1.1,
    candlePsychologyRejection: 1.1,
    waterfallEarly: 0.6,
    smcBosContinuation: 0.5,
  },
};

export function getStrategySuitabilityWeight(strategyName, directionalRegime = 'Ranging', volatilityRegime = 'Normal') {
  const regimeWeights = STRATEGY_REGIME_SUITABILITY[directionalRegime] || {};
  let weight = regimeWeights[strategyName] !== undefined ? regimeWeights[strategyName] : 1.0;

  // Adjust for Volatility
  if (volatilityRegime === 'Extreme') {
    if (strategyName.includes('waterfall') || strategyName.includes('Reversal') || strategyName.includes('momentum')) {
      weight *= 1.1; // Favors momentum or strong sweeps in extreme volatility
    } else {
      weight *= 0.9;
    }
  } else if (volatilityRegime === 'Low') {
    if (strategyName.includes('Compression') || strategyName.includes('Sweep')) {
      weight *= 1.1;
    }
  }

  return Math.round(weight * 100) / 100;
}

export function calculateStrategyWeights(regime = {}) {
  const directionalRegime = regime.directionalRegime || 'Ranging';
  const volatilityRegime = regime.volatilityRegime || 'Normal';

  return {
    liquiditySweep: getStrategySuitabilityWeight('smcSweepMss', directionalRegime, volatilityRegime),
    obMss: getStrategySuitabilityWeight('smcObFvg', directionalRegime, volatilityRegime),
    momentumSpike: getStrategySuitabilityWeight('waterfallEarly', directionalRegime, volatilityRegime),
    classicBreakout: getStrategySuitabilityWeight('smcBosContinuation', directionalRegime, volatilityRegime),
    fvgImbalance: getStrategySuitabilityWeight('smcObFvg', directionalRegime, volatilityRegime),
  };
}

export function getStrategySuitabilityMatrix(strategyName, regime = {}) {
  const weight = getStrategySuitabilityWeight(strategyName, regime.directionalRegime, regime.volatilityRegime);
  const dir = regime.directionalRegime || 'Ranging';
  const isBull = dir.includes('Bullish');
  const isBear = dir.includes('Bearish');

  return {
    strategy: strategyName,
    suitabilityScore: weight,
    bullishWeight: isBull ? weight * 1.1 : isBear ? weight * 0.9 : weight,
    bearishWeight: isBear ? weight * 1.1 : isBull ? weight * 0.9 : weight,
  };
}
