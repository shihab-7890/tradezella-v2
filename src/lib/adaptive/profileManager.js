/**
 * Trading Style Profiles Manager (Scalping, Intraday, Swing)
 */

export const TRADING_STYLE_PROFILES = {
  Scalping: {
    name: 'Scalping',
    preferredTimeframes: ['1m', '3m', '5m'],
    htfTimeframe: '15m',
    lookback: 10,
    minCandlesBetweenSignals: 3,
    minBodyRatio: 0.60,
    rejectionWickRatio: 0.40,
    confluenceScoreThreshold: 3.0,
    minimumDisplacementAtr: 0.6,
  },
  Intraday: {
    name: 'Intraday',
    preferredTimeframes: ['5m', '15m'],
    htfTimeframe: '1h',
    lookback: 20,
    minCandlesBetweenSignals: 5,
    minBodyRatio: 0.65,
    rejectionWickRatio: 0.45,
    confluenceScoreThreshold: 3.5,
    minimumDisplacementAtr: 0.8,
  },
  Swing: {
    name: 'Swing',
    preferredTimeframes: ['15m', '1h', '4h'],
    htfTimeframe: '1D',
    lookback: 40,
    minCandlesBetweenSignals: 8,
    minBodyRatio: 0.70,
    rejectionWickRatio: 0.50,
    confluenceScoreThreshold: 4.0,
    minimumDisplacementAtr: 1.0,
  },
};

export function getTradingStyleProfile(styleName = 'Intraday') {
  return TRADING_STYLE_PROFILES[styleName] || TRADING_STYLE_PROFILES.Intraday;
}

export function getProfileDefaults(styleName = 'Intraday') {
  return getTradingStyleProfile(styleName);
}

export function applyTradingProfile(settings = {}, styleName = 'Intraday') {
  const profile = getTradingStyleProfile(styleName);
  return {
    ...settings,
    profileStyle: styleName,
    ...profile,
  };
}
