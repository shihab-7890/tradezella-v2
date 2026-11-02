/**
 * Phase 8 — Scalping, Intraday, Swing & Waterfall Risk Profiles
 * Dedicated risk parameters tailored to trade duration horizons and momentum profiles.
 */

import { TRADING_STYLES, STOP_LOSS_METHODS, TRAILING_STOP_METHODS } from './types.js';

export const STYLE_RISK_CONFIGS = {
  [TRADING_STYLES.SCALPING]: {
    style: TRADING_STYLES.SCALPING,
    defaultStopMethod: STOP_LOSS_METHODS.HYBRID,
    atrMultiplier: 1.2,
    defaultRiskReward: 1.5,
    tp1RMultiple: 1.0,
    tp2RMultiple: 1.5,
    tp3RMultiple: 2.2,
    breakEvenTriggerR: 1.0,
    trailingMethod: TRAILING_STOP_METHODS.ATR,
    trailingAtrMultiplier: 1.0,
    setupExpiryCandles: 8,
    maxSpreadToRiskRatio: 0.25, // Reject if spread > 25% of stop distance
    allowMultiSessionHolding: false,
  },

  [TRADING_STYLES.INTRADAY]: {
    style: TRADING_STYLES.INTRADAY,
    defaultStopMethod: STOP_LOSS_METHODS.STRUCTURE,
    atrMultiplier: 1.8,
    defaultRiskReward: 2.0,
    tp1RMultiple: 1.2,
    tp2RMultiple: 2.0,
    tp3RMultiple: 3.0,
    breakEvenTriggerR: 1.2,
    trailingMethod: TRAILING_STOP_METHODS.STRUCTURAL,
    trailingAtrMultiplier: 1.5,
    setupExpiryCandles: 24,
    maxSpreadToRiskRatio: 0.15,
    allowMultiSessionHolding: false,
  },

  [TRADING_STYLES.SWING]: {
    style: TRADING_STYLES.SWING,
    defaultStopMethod: STOP_LOSS_METHODS.HYBRID,
    atrMultiplier: 2.5,
    defaultRiskReward: 2.8,
    tp1RMultiple: 1.5,
    tp2RMultiple: 2.8,
    tp3RMultiple: 4.5,
    breakEvenTriggerR: 1.8,
    trailingMethod: TRAILING_STOP_METHODS.HYBRID,
    trailingAtrMultiplier: 2.2,
    setupExpiryCandles: 72,
    maxSpreadToRiskRatio: 0.08,
    allowMultiSessionHolding: true,
  },
};

/**
 * Resolves risk parameters for a trade according to its trading style and active settings mode (AUTO/HYBRID/MANUAL).
 */
export function resolveStyleRiskProfile(tradingStyle = 'Intraday', activeSettings = {}, regimeInfo = {}) {
  const baseProfile = STYLE_RISK_CONFIGS[tradingStyle] || STYLE_RISK_CONFIGS[TRADING_STYLES.INTRADAY];
  const mode = activeSettings.settingsMode || activeSettings.autoMode || 'AUTO';

  if (mode === 'MANUAL') {
    // In MANUAL mode, strictly respect explicitly configured user values
    return {
      ...baseProfile,
      atrMultiplier: activeSettings.atrStopMultiplier || baseProfile.atrMultiplier,
      defaultRiskReward: activeSettings.defaultRiskRewardRatio || baseProfile.defaultRiskReward,
      breakEvenTriggerR: activeSettings.breakEvenTriggerR || baseProfile.breakEvenTriggerR,
      setupExpiryCandles: activeSettings.setupExpiryCandles || baseProfile.setupExpiryCandles,
    };
  }

  // AUTO / HYBRID: Regime-aware adjustments within hard user bounds
  const regime = regimeInfo?.regime || 'Ranging';
  let adjustedMultiplier = baseProfile.atrMultiplier;

  if (regime.includes('High Volatility')) {
    adjustedMultiplier = Math.min(3.0, baseProfile.atrMultiplier * 1.2);
  } else if (regime.includes('Strong Trend')) {
    adjustedMultiplier = Math.max(1.0, baseProfile.atrMultiplier * 0.9);
  }

  return {
    ...baseProfile,
    atrMultiplier: adjustedMultiplier,
  };
}
