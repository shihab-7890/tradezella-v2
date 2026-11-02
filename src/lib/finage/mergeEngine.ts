import { NormalizedCandle, MergeTelemetry, MissingGapInfo } from './types';
import { isWeekendClosure } from './normalizer';

export interface MergeInput {
  chunksCandles: NormalizedCandle[][];
  totalChunks: number;
  completedChunks?: number;
  totalRawRows: number;
  timeframeStepMs?: number;       // default 60_000 for 1-minute
  requestedStartEpochMs?: number; // optional boundary filter
  requestedEndEpochMs?: number;   // optional boundary filter (exclusive)
}

/**
 * Deduplicates, chronologically sorts, filters to interval boundaries,
 * and detects missing gaps for merged candle chunks.
 */
export function mergeAndDeduplicateCandles({
  chunksCandles,
  totalChunks,
  completedChunks = totalChunks,
  totalRawRows,
  timeframeStepMs = 60_000,
  requestedStartEpochMs,
  requestedEndEpochMs,
}: MergeInput): { candles: NormalizedCandle[]; telemetry: MergeTelemetry } {
  const candleMap = new Map<number, NormalizedCandle>();
  let duplicatesRemoved = 0;
  let conflictsResolved = 0;

  for (const chunk of chunksCandles) {
    if (!Array.isArray(chunk)) continue;
    for (const candle of chunk) {
      if (!candle || !Number.isFinite(candle.timestamp)) continue;

      // Filter by requested interval boundaries if specified (half-open: start <= ts < end)
      if (requestedStartEpochMs !== undefined && candle.timestamp < requestedStartEpochMs) {
        continue;
      }
      if (requestedEndEpochMs !== undefined && candle.timestamp >= requestedEndEpochMs) {
        continue;
      }

      const existing = candleMap.get(candle.timestamp);
      if (!existing) {
        candleMap.set(candle.timestamp, candle);
      } else {
        duplicatesRemoved++;

        // Check if there is an OHLC conflict
        const isConflict =
          existing.open !== candle.open ||
          existing.high !== candle.high ||
          existing.low !== candle.low ||
          existing.close !== candle.close;

        if (isConflict) {
          conflictsResolved++;
          console.warn(
            `[Merge Conflict] Duplicate timestamp ${candle.timestamp} (${new Date(candle.timestamp).toISOString()}) with conflicting OHLC. ` +
            `Existing: [${existing.open}, ${existing.high}, ${existing.low}, ${existing.close}, vol: ${existing.volume}], ` +
            `Incoming: [${candle.open}, ${candle.high}, ${candle.low}, ${candle.close}, vol: ${candle.volume}]`
          );

          // Deterministic resolution policy:
          // 1. Prefer positive volume
          if (existing.volume === 0 && candle.volume > 0) {
            candleMap.set(candle.timestamp, candle);
          } else if (candle.volume > existing.volume) {
            candleMap.set(candle.timestamp, candle);
          } else if (candle.volume === existing.volume) {
            // 2. Prefer larger price range (more information)
            const existingRange = existing.high - existing.low;
            const candleRange = candle.high - candle.low;
            if (candleRange > existingRange) {
              candleMap.set(candle.timestamp, candle);
            }
          }
        } else {
          // If OHLC is identical, prefer entry with non-zero or higher volume
          if (candle.volume > existing.volume) {
            candleMap.set(candle.timestamp, candle);
          }
        }
      }
    }
  }

  // Strictly ascending sort by timestamp
  const mergedCandles = Array.from(candleMap.values()).sort(
    (a, b) => a.timestamp - b.timestamp
  );

  const firstTimestamp = mergedCandles.length > 0 ? mergedCandles[0].timestamp : 0;
  const lastTimestamp = mergedCandles.length > 0 ? mergedCandles[mergedCandles.length - 1].timestamp : 0;

  // Gap analysis between consecutive candles
  let intradayMissingMinutes = 0;
  let weekendClosureMinutes = 0;
  const missingGaps: MissingGapInfo[] = [];

  if (mergedCandles.length > 1 && timeframeStepMs > 0) {
    for (let i = 0; i < mergedCandles.length - 1; i++) {
      const currentTs = mergedCandles[i].timestamp;
      const nextTs = mergedCandles[i + 1].timestamp;
      const diffMs = nextTs - currentTs;

      // If gap exceeds 1.5x expected step
      if (diffMs > timeframeStepMs * 1.5) {
        const gapDurationMinutes = Math.round((diffMs - timeframeStepMs) / 60_000);
        let weekendMinutesInGap = 0;
        let intradayMinutesInGap = 0;

        let cursor = currentTs + timeframeStepMs;
        while (cursor < nextTs) {
          const stepSize = Math.min(timeframeStepMs, nextTs - cursor);
          const minutes = Math.round(stepSize / 60_000);
          if (isWeekendClosure(cursor)) {
            weekendMinutesInGap += minutes;
          } else {
            intradayMinutesInGap += minutes;
          }
          cursor += timeframeStepMs;
        }

        weekendClosureMinutes += weekendMinutesInGap;
        intradayMissingMinutes += intradayMinutesInGap;

        missingGaps.push({
          startMs: currentTs,
          endMs: nextTs,
          durationMinutes: gapDurationMinutes,
          isWeekend: weekendMinutesInGap > intradayMinutesInGap,
        });
      }
    }
  }

  const telemetry: MergeTelemetry = {
    totalChunks,
    completedChunks,
    rawRowsReceived: totalRawRows,
    validCandles: mergedCandles.length,
    duplicatesRemoved,
    conflictsResolved,
    intradayMissingMinutes,
    weekendClosureMinutes,
    firstTimestamp,
    lastTimestamp,
    missingGaps,
  };

  return {
    candles: mergedCandles,
    telemetry,
  };
}
