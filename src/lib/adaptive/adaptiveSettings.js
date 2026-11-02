/**
 * Bounded Adaptive Settings Manager
 * Computes effective settings based on AUTO / HYBRID / MANUAL mode precedence rules.
 */

import { getTradingStyleProfile } from './profileManager';

export const SETTINGS_BOUNDS = {
  confluenceScoreThreshold: { min: 2.5, max: 5.0 },
  minimumDisplacementAtr: { min: 0.4, max: 1.5 },
  minCandlesBetweenSignals: { min: 2, max: 12 },
  minBodyRatio: { min: 0.50, max: 0.80 },
  rejectionWickRatio: { min: 0.35, max: 0.65 },
};

export function clampValue(val, bound) {
  if (!bound) return val;
  return Math.min(bound.max, Math.max(bound.min, val));
}

export function computeEffectiveSettings(rawSettings = {}, regimeInfo = null, explicitMode = null, explicitStyle = null) {
  const mode = explicitMode || rawSettings.mode || rawSettings.settingsMode || 'AUTO'; // 'AUTO' | 'HYBRID' | 'MANUAL'
  const style = explicitStyle || rawSettings.profileStyle || rawSettings.tradingStyle || 'Intraday';
  const locks = rawSettings.lockedSettings || rawSettings.userLocks || {};

  if (mode === 'MANUAL') {
    return { ...rawSettings, mode: 'MANUAL', effectiveMode: 'MANUAL' };
  }

  const profile = getTradingStyleProfile(style);
  const effective = {
    ...rawSettings,
    ...profile,
    mode,
    effectiveMode: mode,
  };

  if (regimeInfo && mode !== 'MANUAL') {
    const { directionalRegime, volatilityRegime } = regimeInfo;

    // Adjust parameters for volatility unless locked by user in HYBRID mode
    if (!locks.minimumDisplacementAtr) {
      if (volatilityRegime === 'Elevated') {
        effective.minimumDisplacementAtr = clampValue((profile.minimumDisplacementAtr || 0.8) * 1.2, SETTINGS_BOUNDS.minimumDisplacementAtr);
      } else if (volatilityRegime === 'Low') {
        effective.minimumDisplacementAtr = clampValue((profile.minimumDisplacementAtr || 0.8) * 0.85, SETTINGS_BOUNDS.minimumDisplacementAtr);
      }
    }

    if (!locks.confluenceScoreThreshold) {
      if (directionalRegime === 'Choppy' || volatilityRegime === 'Extreme') {
        effective.confluenceScoreThreshold = clampValue((profile.confluenceScoreThreshold || 3.5) + 0.5, SETTINGS_BOUNDS.confluenceScoreThreshold);
      } else if (directionalRegime && directionalRegime.includes('Strong')) {
        effective.confluenceScoreThreshold = clampValue((profile.confluenceScoreThreshold || 3.5) - 0.3, SETTINGS_BOUNDS.confluenceScoreThreshold);
      }
    }
  }

  // Ensure hard user overrides/locks from rawSettings persist in HYBRID mode
  if (rawSettings.confluenceScoreThreshold !== undefined && (locks.confluenceScoreThreshold || mode === 'HYBRID')) {
    effective.confluenceScoreThreshold = rawSettings.confluenceScoreThreshold;
  }

  return effective;
}
