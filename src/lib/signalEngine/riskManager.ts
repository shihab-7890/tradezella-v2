import { TradingSignal } from './types';
import { CandleLike } from './htfSynchronizer';

export interface RiskManagementResult {
  sl: number;
  tp: number;
  riskReward: number;
  invalidationPrice: number;
}

/**
 * Calculates structurally sound, volatility-buffered Stop Loss and Take Profit levels.
 * Guarantees strict directional logic:
 * - BUY: sl < entryPrice < tp
 * - SELL: tp < entryPrice < sl
 */
export function calculateSignalRiskManagement(
  signal: Partial<TradingSignal>,
  candles: CandleLike[],
  signalIndex: number,
  settings: any
): RiskManagementResult {
  const entryPrice = signal.price || candles[signalIndex]?.close || 1;
  const isBuy = signal.direction === 'BUY' || signal.type?.includes('BUY');
  const bufferPct = settings?.slBufferPercent || 0.002; // 0.2%
  const riskRatio = signal.notes?.includes('Power of Three')
    ? (settings?.distributionRiskRewardRatio || 2.0)
    : (settings?.defaultRiskRewardRatio || 1.5);

  const lookback = settings?.lookback || 20;
  const startIndex = Math.max(0, signalIndex - lookback);

  let sl: number;

  if (isBuy) {
    let lowestLow = Infinity;
    for (let i = startIndex; i <= signalIndex; i++) {
      if (candles[i].low < lowestLow) {
        lowestLow = candles[i].low;
      }
    }

    if (signal.setupTime && signal.setupTime > 0) {
      // If a specific manipulation price or sweep low exists
      if (signal.invalidationPrice && signal.invalidationPrice < entryPrice) {
        lowestLow = Math.min(lowestLow, signal.invalidationPrice);
      }
    }

    const calculatedSl = lowestLow * (1 - bufferPct);
    // Guarantee sl is below entry price
    if (Number.isFinite(calculatedSl) && calculatedSl > 0 && calculatedSl < entryPrice) {
      sl = calculatedSl;
    } else {
      // Fallback: 1% below entry
      sl = entryPrice * (1 - Math.max(0.005, bufferPct * 2));
    }

    const risk = Math.abs(entryPrice - sl);
    const tp = entryPrice + (risk * riskRatio);

    return {
      sl: Math.round(sl * 1000) / 1000,
      tp: Math.round(tp * 1000) / 1000,
      riskReward: riskRatio,
      invalidationPrice: Math.round(lowestLow * 1000) / 1000,
    };
  } else {
    // SELL direction
    let highestHigh = -Infinity;
    for (let i = startIndex; i <= signalIndex; i++) {
      if (candles[i].high > highestHigh) {
        highestHigh = candles[i].high;
      }
    }

    if (signal.setupTime && signal.setupTime > 0) {
      if (signal.invalidationPrice && signal.invalidationPrice > entryPrice) {
        highestHigh = Math.max(highestHigh, signal.invalidationPrice);
      }
    }

    const calculatedSl = highestHigh * (1 + bufferPct);
    // Guarantee sl is above entry price
    if (Number.isFinite(calculatedSl) && calculatedSl > entryPrice) {
      sl = calculatedSl;
    } else {
      // Fallback: 1% above entry
      sl = entryPrice * (1 + Math.max(0.005, bufferPct * 2));
    }

    const risk = Math.abs(sl - entryPrice);
    const tp = entryPrice - (risk * riskRatio);

    return {
      sl: Math.round(sl * 1000) / 1000,
      tp: Math.round(tp * 1000) / 1000,
      riskReward: riskRatio,
      invalidationPrice: Math.round(highestHigh * 1000) / 1000,
    };
  }
}
