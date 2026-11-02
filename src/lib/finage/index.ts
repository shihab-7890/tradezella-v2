import { planDateChunks } from './chunkPlanner';
import { fetchAllChunks, FinageFetchOptions } from './finageFetcher';
import { normalizeCandles } from './normalizer';
import { mergeAndDeduplicateCandles } from './mergeEngine';
import { FinagePipelineResult, NormalizedCandle, DataChunk } from './types';
import { generateSimulatedCandles } from '@/lib/simulatedMarket';

export * from './types';
export * from './chunkPlanner';
export * from './normalizer';
export * from './mergeEngine';
export * from './finageFetcher';
export * from './chunkCache';

export interface ExecutePipelineOptions {
  symbol: string;
  startDate: string | Date | number;
  endDate: string | Date | number;
  timeframe?: string;
  apiKey?: string;
  chunkHours?: number; // default: 48 hours (2 days)
  chunkDays?: number;  // alias for chunkHours / 24
  concurrency?: number; // default: 3
  inclusiveEnd?: boolean; // default: false
  allowSimulationFallback?: boolean; // default: true
  useCache?: boolean; // default: true
  onProgress?: (completed: number, total: number, candlesCount: number) => void;
}

export const TIMEFRAME_STEP_MS: Record<string, number> = {
  '1m': 60_000,
  '2m': 120_000,
  '3m': 180_000,
  '5m': 300_000,
  '10m': 600_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1D': 86_400_000,
};

/**
 * Executes the complete Finage Multi-Chunk pipeline:
 * 1. Plan deterministic 48-hour chunks respecting half-open interval boundaries.
 * 2. Fetch chunks with concurrency control (limit: 3), in-flight deduplication, and exponential backoff retry.
 * 3. Normalize timestamps to UTC epoch milliseconds and strictly validate OHLC prices.
 * 4. Deduplicate candles via Map, resolve conflicting OHLCs with deterministic policy, and sort chronologically.
 * 5. Compute audit telemetry metadata and missing gap analysis.
 * 6. If Finage endpoint has permission restrictions or is offline, seamlessly serve clearly labeled demo/simulation data without mixing.
 */
export async function executeFinagePipeline(
  options: ExecutePipelineOptions
): Promise<FinagePipelineResult> {
  const {
    symbol,
    startDate,
    endDate,
    timeframe = '15m',
    apiKey = process.env.FINAGE_API_KEY || 'API_KEY95YTO81R66DCOZUANVVX135GBVHXQ5CK',
    chunkHours = 48,
    chunkDays,
    concurrency = 3,
    inclusiveEnd = false,
    allowSimulationFallback = true,
    useCache = true,
    onProgress,
  } = options;

  const isDummyKey = !apiKey || apiKey.trim() === '';

  const effectiveChunkHours = chunkDays ? chunkDays * 24 : chunkHours;

  const chunks = planDateChunks(startDate, endDate, {
    chunkHours: effectiveChunkHours,
    inclusiveEnd,
    clampToNow: false,
  });

  const stepMs = TIMEFRAME_STEP_MS[timeframe] || 900_000;
  const requestedStartMs = chunks.length > 0 ? chunks[0].startEpochMs : 0;
  const requestedEndMs = chunks.length > 0 ? chunks[chunks.length - 1].endEpochMs : 0;

  let fetchFailed = isDummyKey;
  let failureReason = isDummyKey ? 'Demo Mode: No Finage API key provided.' : '';
  let chunksCandles: NormalizedCandle[][] = [];
  let totalRawRows = 0;
  let completedCount = 0;

  if (!isDummyKey) {
    try {
      const { results, errors, completedCount: cCount } = await fetchAllChunks(chunks, {
        symbol,
        apiKey,
        timeframe,
        concurrency,
        maxRetries: 3,
        useCache,
        onProgress,
      });

      completedCount = cCount;

      for (const r of results) {
        totalRawRows += r.rawRows.length;
        if (r.rawRows.length > 0) {
          const normalized = normalizeCandles(r.rawRows);
          chunksCandles.push(normalized);
        }
      }

      if (errors.length > 0 && totalRawRows === 0) {
        fetchFailed = true;
        failureReason = errors[0];
      }
    } catch (err: any) {
      fetchFailed = true;
      failureReason = err?.message || 'Pipeline fetch error';
    }
  }

  // If real Finage candles were retrieved, merge, deduplicate, and return
  if (!fetchFailed && totalRawRows > 0) {
    const { candles, telemetry } = mergeAndDeduplicateCandles({
      chunksCandles,
      totalChunks: chunks.length,
      completedChunks: completedCount,
      totalRawRows,
      timeframeStepMs: stepMs,
      requestedStartEpochMs: requestedStartMs,
      requestedEndEpochMs: requestedEndMs,
    });

    return {
      candles,
      telemetry,
      isSimulated: false,
      chunks,
    };
  }

  // Fallback to high-fidelity simulated market if Finage API key is not configured or failed
  if (allowSimulationFallback) {
    if (!isDummyKey) {
      console.info(
        `[Finage Pipeline] Real data unavailable (${failureReason}). Serving simulated market data in Demo Mode.`
      );
    }

    // Format start and end date strings for simulation generator
    const startStr = typeof startDate === 'string' ? startDate.split('T')[0] : new Date(startDate).toISOString().split('T')[0];
    const endStr = typeof endDate === 'string' ? endDate.split('T')[0] : new Date(endDate).toISOString().split('T')[0];

    const simulated = generateSimulatedCandles(symbol, timeframe, startStr, endStr);
    const normalizedSimulated: NormalizedCandle[] = simulated.map(c => ({
      timestamp: c.time,
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume || 100,
    }));

    const { candles, telemetry } = mergeAndDeduplicateCandles({
      chunksCandles: [normalizedSimulated],
      totalChunks: chunks.length,
      completedChunks: chunks.length,
      totalRawRows: normalizedSimulated.length,
      timeframeStepMs: stepMs,
      requestedStartEpochMs: requestedStartMs,
      requestedEndEpochMs: requestedEndMs,
    });

    return {
      candles,
      telemetry,
      isSimulated: true,
      notice: isDummyKey
        ? 'Demo Mode: Market data generated by local simulator (Configure FINAGE_API_KEY in .env for live exchange feed).'
        : failureReason || 'Demo Mode: Finage API key permission restriction active. Market data is generated by local simulator.',
      chunks,
    };
  }

  throw new Error(`Finage Pipeline failed: ${failureReason || 'No data returned'}`);
}

