import { HtfTrendState, HtfKeyLevel } from './types';

export interface CandleLike {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

function calculateEMA(prices: number[], period: number): number[] {
  if (!prices || prices.length < period) return [];
  const k = 2 / (period + 1);
  const ema = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

/**
 * Pre-indexes HTF candles for O(1) or O(log N) point-in-time queries.
 * Prevents look-ahead bias by only exposing HTF information available at or before query timestamp.
 */
export class HtfSynchronizer {
  private htfCandles: CandleLike[];
  private emaPeriod: number;
  private htfEmaValues: number[];
  private confirmedLevels: HtfKeyLevel[];

  constructor(htfCandles: CandleLike[], emaPeriod: number = 20) {
    // Sort HTF candles chronologically
    this.htfCandles = [...htfCandles].sort((a, b) => a.time - b.time);
    this.emaPeriod = emaPeriod;

    // Precalculate EMA across HTF series
    const closes = this.htfCandles.map(c => c.close);
    this.htfEmaValues = calculateEMA(closes, this.emaPeriod);

    // Precalculate all swing levels with strict 2-bar confirmation delay:
    // A swing high at index k is only confirmed when index k+2 closes.
    this.confirmedLevels = [];
    for (let k = 2; k < this.htfCandles.length - 2; k++) {
      const c = this.htfCandles[k];
      const prev1 = this.htfCandles[k - 1];
      const prev2 = this.htfCandles[k - 2];
      const next1 = this.htfCandles[k + 1];
      const next2 = this.htfCandles[k + 2];
      const confirmationTime = next2.time; // Known at close of next2

      if (c.high > prev1.high && c.high > prev2.high && c.high > next1.high && c.high > next2.high) {
        this.confirmedLevels.push({
          price: c.high,
          type: 'resistance',
          time: confirmationTime,
        });
      }
      if (c.low < prev1.low && c.low < prev2.low && c.low < next1.low && c.low < next2.low) {
        this.confirmedLevels.push({
          price: c.low,
          type: 'support',
          time: confirmationTime,
        });
      }
    }
  }

  /**
   * Finds the latest closed HTF candle index on or before timestamp T using binary search.
   */
  private findLatestClosedHtfIndex(timestamp: number): number {
    let low = 0;
    let high = this.htfCandles.length - 1;
    let best = -1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.htfCandles[mid].time <= timestamp) {
        best = mid;
        low = mid + 1; // Try to find a later closed candle still <= timestamp
      } else {
        high = mid - 1;
      }
    }

    return best;
  }

  /**
   * Returns point-in-time HTF trend at timestamp T without using future data.
   */
  public getTrendAtTime(timestamp: number): HtfTrendState {
    const idx = this.findLatestClosedHtfIndex(timestamp);
    if (idx < this.emaPeriod || idx === -1) {
      return { direction: 'Ranging', confidence: 0 };
    }

    const lastPrice = this.htfCandles[idx].close;
    const ema = this.htfEmaValues[idx];

    if (!ema) {
      return { direction: 'Ranging', confidence: 0 };
    }

    // Check difference relative to price for confidence
    const diffPct = (lastPrice - ema) / ema;
    if (diffPct > 0.001) {
      return { direction: 'BULLISH', confidence: Math.min(1, Math.abs(diffPct) * 100), lastHtfClose: lastPrice, emaValue: ema };
    } else if (diffPct < -0.001) {
      return { direction: 'BEARISH', confidence: Math.min(1, Math.abs(diffPct) * 100), lastHtfClose: lastPrice, emaValue: ema };
    }

    return { direction: 'Ranging', confidence: 0, lastHtfClose: lastPrice, emaValue: ema };
  }

  /**
   * Returns HTF key levels that were confirmed on or before timestamp T.
   */
  public getKeyLevelsAtTime(timestamp: number): HtfKeyLevel[] {
    return this.confirmedLevels.filter(lvl => lvl.time <= timestamp);
  }

  /**
   * Returns complete static summary for chart UI overlays.
   */
  public getFullSeriesSummary(): { htfTrend: HtfTrendState; htfKeyLevels: HtfKeyLevel[] } {
    if (this.htfCandles.length === 0) {
      return { htfTrend: { direction: 'Ranging', confidence: 0 }, htfKeyLevels: [] };
    }
    const lastTime = this.htfCandles[this.htfCandles.length - 1].time;
    return {
      htfTrend: this.getTrendAtTime(lastTime),
      htfKeyLevels: this.getKeyLevelsAtTime(lastTime),
    };
  }
}
