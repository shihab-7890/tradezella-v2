/**
 * Phase 7 — Standardized Signal Candidate & Unified Decision Types
 */

export const DECISION_STATUS = {
  DETECTED: 'DETECTED',
  CANDIDATE: 'CANDIDATE',
  CONFIRMING: 'CONFIRMING',
  APPROVED: 'APPROVED',
  WAITING_FOR_ENTRY: 'WAITING_FOR_ENTRY',
  TRIGGERED: 'TRIGGERED',
  ACTIVE: 'ACTIVE',
  PARTIALLY_CLOSED: 'PARTIALLY_CLOSED',
  CLOSED_TP: 'CLOSED_TP',
  CLOSED_SL: 'CLOSED_SL',
  EXPIRED: 'EXPIRED',
  INVALIDATED: 'INVALIDATED',
  REJECTED: 'REJECTED',
  WATCH: 'WATCH',
  WAIT: 'WAIT',
};

export const CONFLICT_TYPES = {
  SAME_SETUP_OPPOSITE: 'SAME_SETUP_OPPOSITE', // Type A: Same level/time conflicting signals
  CROSS_TIMEFRAME: 'CROSS_TIMEFRAME',         // Type B: Scalp counter to HTF swing
  SAME_TF_DIFF_STRAT: 'SAME_TF_DIFF_STRAT',   // Type C: Breakout vs Failed-Breakout
  REVERSAL_VS_CONTINUATION: 'REVERSAL_VS_CONTINUATION', // Type D: Waterfall vs exhaustion
  INDEPENDENT_OPPOSITE: 'INDEPENDENT_OPPOSITE', // Type E: Both valid at distinct levels
  NONE: 'NONE',
};

export const TRADING_STYLES = {
  SCALPING: 'Scalping',
  INTRADAY: 'Intraday',
  SWING: 'Swing',
};

export const STRATEGY_FAMILIES = {
  WATERFALL: 'waterfall',
  SMC: 'smc',
  CANDLE_PSYCHOLOGY: 'candlePsychology',
  LIQUIDITY: 'liquidity',
  BREAKOUT: 'breakout',
  SCALP: 'scalp',
  SWING: 'swing',
  INTRADAY: 'intraday',
  MOMENTUM: 'momentum',
  GENERAL: 'general',
};

export const QUALITY_GRADES = {
  A_PLUS: 'A+',   // 85 - 100
  A: 'A',         // 75 - 84.9
  B: 'B',         // 65 - 74.9
  WATCH: 'Watch', // 50 - 64.9
  REJECTED: 'Rejected', // < 50
  LOW: 'Rejected',      // < 50
};
