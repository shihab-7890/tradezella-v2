/**
 * Phase 6 — Multi-Timeframe Context Synchronization Engine
 * Aligns macro direction, setup formation timeframe & entry confirmation timeframe.
 */

export const TIMEFRAME_MAPPINGS = {
  Scalping: { entry: '5m', setup: '15m', macro: '1h' },
  Intraday: { entry: '15m', setup: '1h', macro: '4h' },
  Swing: { entry: '1h', setup: '4h', macro: '1D' },
};

export function getMtfContext(tradingStyle = 'Intraday') {
  return TIMEFRAME_MAPPINGS[tradingStyle] || TIMEFRAME_MAPPINGS.Intraday;
}
