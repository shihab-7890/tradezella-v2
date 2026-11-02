import { TradingSignal } from './types';

export interface DeduplicateOptions {
  minCandlesBetweenSignals?: number; // default: 5
  timeToleranceCandles?: number;      // candles window to cluster same setup (default: 4)
  priceTolerancePct?: number;        // price proximity to cluster same setup (default: 0.003 / 0.3%)
}

/**
 * Aggregates multi-strategy candidate signals, merges duplicates representing
 * the same physical setup, and enforces direction-aware spacing.
 */
export function deduplicateAndFilterSignals(
  rawSignals: TradingSignal[],
  candleIndexMap: Map<number, number>,
  options: DeduplicateOptions = {}
): { approvedSignals: TradingSignal[]; duplicatesSuppressed: number } {
  const {
    minCandlesBetweenSignals = 5,
    timeToleranceCandles = 4,
    priceTolerancePct = 0.003,
  } = options;

  let duplicatesSuppressed = 0;

  // Filter only candidate signals that have a valid candle index
  const validSignals = rawSignals.filter(s => {
    const idx = candleIndexMap.get(s.time);
    return idx !== undefined;
  });

  // Sort candidates by score descending, then priority/base quality descending
  const sortedCandidates = [...validSignals].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.time - a.time;
  });

  const clusteredSignals: TradingSignal[] = [];
  const clusteredMeta: Array<{ signal: TradingSignal; index: number }> = [];

  for (const candidate of sortedCandidates) {
    const candidateIndex = candleIndexMap.get(candidate.time)!;

    // Check if this candidate represents the same physical setup as an existing cluster
    const matchingCluster = clusteredMeta.find(meta => {
      const sameDirection = meta.signal.direction === candidate.direction;
      const indexDiff = Math.abs(meta.index - candidateIndex);
      const priceDiffPct = Math.abs(meta.signal.price - candidate.price) / Math.max(meta.signal.price, candidate.price);

      // Same setup if same direction, within time tolerance and close in price
      return sameDirection && indexDiff <= timeToleranceCandles && priceDiffPct <= priceTolerancePct;
    });

    if (matchingCluster) {
      duplicatesSuppressed++;
      // Attach this strategy's confirmation to the winning cluster
      const existing = matchingCluster.signal;
      if (!existing.confirmations) {
        existing.confirmations = [existing.strategy];
      }
      if (!existing.confirmations.includes(candidate.strategy)) {
        existing.confirmations.push(candidate.strategy);
        existing.notes = `${existing.notes} + ${candidate.strategy}`;
      }
    } else {
      clusteredSignals.push(candidate);
      clusteredMeta.push({ signal: candidate, index: candidateIndex });
    }
  }

  // Next: Enforce direction-aware spacing chronologically
  // Chronological sort
  clusteredSignals.sort((a, b) => a.time - b.time);

  const finalApproved: TradingSignal[] = [];
  let lastBuyIndex = -Infinity;
  let lastSellIndex = -Infinity;

  for (const signal of clusteredSignals) {
    const idx = candleIndexMap.get(signal.time)!;

    if (signal.direction === 'BUY') {
      if (idx - lastBuyIndex >= minCandlesBetweenSignals) {
        finalApproved.push(signal);
        lastBuyIndex = idx;
      } else {
        duplicatesSuppressed++;
      }
    } else {
      // SELL direction
      if (idx - lastSellIndex >= minCandlesBetweenSignals) {
        finalApproved.push(signal);
        lastSellIndex = idx;
      } else {
        duplicatesSuppressed++;
      }
    }
  }

  return {
    approvedSignals: finalApproved,
    duplicatesSuppressed,
  };
}
