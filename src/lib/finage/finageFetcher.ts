import { DataChunk, RawFinageCandle } from './types';
import { chunkCache } from './chunkCache';

export interface FinageFetchOptions {
  symbol: string;
  apiKey: string;
  timeframe?: string;
  concurrency?: number;
  maxRetries?: number;
  useCache?: boolean;
  onProgress?: (completed: number, total: number, candlesCount: number) => void;
}

export interface ChunkFetchResult {
  chunk: DataChunk;
  rawRows: RawFinageCandle[];
  error?: string;
  statusCode?: number;
  fromCache?: boolean;
}

export const TIMEFRAME_MAP: Record<string, { interval: string; value: number }> = {
  '1m': { interval: 'minute', value: 1 },
  '2m': { interval: 'minute', value: 2 },
  '3m': { interval: 'minute', value: 3 },
  '5m': { interval: 'minute', value: 5 },
  '10m': { interval: 'minute', value: 10 },
  '15m': { interval: 'minute', value: 15 },
  '30m': { interval: 'minute', value: 30 },
  '1h': { interval: 'minute', value: 60 },
  '4h': { interval: 'hour', value: 4 },
  '1D': { interval: 'day', value: 1 },
};

/**
 * Executes an asynchronous task with bounded exponential backoff for transient errors (429, 5xx).
 */
export async function fetchWithRetry(
  url: string,
  maxRetries: number = 3
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  let attempt = 0;
  let delayMs = 400;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      const status = response.status;

      let json: any = null;
      try {
        json = await response.json();
      } catch {
        json = null;
      }

      if (response.ok) {
        return { ok: true, status, data: json };
      }

      const errorMessage =
        json?.error || json?.message || response.statusText || `HTTP ${status}`;

      // Rate limit (429) or Server error (5xx) -> bounded exponential backoff
      if ((status === 429 || (status >= 500 && status < 600)) && attempt < maxRetries) {
        attempt++;
        const jitter = Math.random() * 200;
        await new Promise(r => setTimeout(r, delayMs + jitter));
        delayMs = Math.min(delayMs * 2, 4000);
        continue;
      }

      return {
        ok: false,
        status,
        data: json,
        error: `Finage API Error (${status}): ${errorMessage}`,
      };
    } catch (err: any) {
      if (attempt < maxRetries) {
        attempt++;
        const jitter = Math.random() * 200;
        await new Promise(r => setTimeout(r, delayMs + jitter));
        delayMs = Math.min(delayMs * 2, 4000);
        continue;
      }
      return {
        ok: false,
        status: 0,
        data: null,
        error: `Network error reaching Finage: ${err?.message || 'Unknown network error'}`,
      };
    }
  }

  return { ok: false, status: 0, data: null, error: 'Max retries exceeded' };
}

/**
 * Fetches raw candles for a single DataChunk with chunk-level caching and in-flight deduplication.
 */
export async function fetchChunk(
  chunk: DataChunk,
  options: FinageFetchOptions
): Promise<ChunkFetchResult> {
  const { symbol, apiKey, timeframe = '15m', maxRetries = 3, useCache = true } = options;
  const cacheKey = chunkCache.buildKey(symbol, timeframe, chunk, 'finage');

  if (useCache) {
    const cachedRows = chunkCache.get(cacheKey);
    if (cachedRows) {
      return {
        chunk,
        rawRows: cachedRows,
        statusCode: 200,
        fromCache: true,
      };
    }
  }

  // Deduplicate in-flight requests for the same chunk
  const inFlightPromise = chunkCache.getInFlight(cacheKey);
  if (inFlightPromise) {
    try {
      const rows = await inFlightPromise;
      return {
        chunk,
        rawRows: rows,
        statusCode: 200,
        fromCache: true,
      };
    } catch {
      // Fall through to retry on error
    }
  }

  const cleanSymbol = symbol.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const tf = TIMEFRAME_MAP[timeframe] || { interval: 'minute', value: 15 };
  const url = `https://api.finage.co.uk/agg/forex/${cleanSymbol}/${tf.value}/${tf.interval}/${chunk.fromDate}/${chunk.toDate}?apikey=${apiKey}&limit=50000&sort=asc&date_format=ts`;

  const fetchPromise = (async () => {
    const res = await fetchWithRetry(url, maxRetries);

    if (!res.ok) {
      throw new Error(res.error || `Finage fetch error (${res.status})`);
    }

    let rows: RawFinageCandle[] = [];
    if (Array.isArray(res.data)) {
      rows = res.data;
    } else if (res.data && Array.isArray(res.data.results)) {
      rows = res.data.results;
    }

    if (useCache && rows.length > 0) {
      chunkCache.set(cacheKey, chunk, rows);
    }

    return rows;
  })();

  chunkCache.setInFlight(cacheKey, fetchPromise);

  try {
    const rows = await fetchPromise;
    return {
      chunk,
      rawRows: rows,
      statusCode: 200,
      fromCache: false,
    };
  } catch (err: any) {
    return {
      chunk,
      rawRows: [],
      error: err?.message || 'Failed to fetch chunk',
      statusCode: 500,
      fromCache: false,
    };
  } finally {
    chunkCache.deleteInFlight(cacheKey);
  }
}

/**
 * Fetches multiple chunks using a bounded concurrency pool (default: 3).
 * Invokes onProgress callback as each chunk completes.
 */
export async function fetchAllChunks(
  chunks: DataChunk[],
  options: FinageFetchOptions
): Promise<{ results: ChunkFetchResult[]; errors: string[]; completedCount: number }> {
  const concurrency = Math.max(1, Math.min(options.concurrency || 3, 5));
  const results: ChunkFetchResult[] = [];
  const errors: string[] = [];

  let completedCount = 0;
  let totalCandlesCount = 0;
  const totalChunks = chunks.length;

  const queue = [...chunks];
  const workers: Promise<void>[] = [];

  for (let w = 0; w < concurrency; w++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const chunk = queue.shift();
          if (!chunk) break;

          const res = await fetchChunk(chunk, options);
          results.push(res);
          completedCount++;
          totalCandlesCount += res.rawRows.length;

          if (res.error) {
            errors.push(`Chunk ${chunk.chunkIndex + 1}/${totalChunks} (${chunk.fromDate} to ${chunk.toDate}): ${res.error}`);
          }

          if (options.onProgress) {
            options.onProgress(completedCount, totalChunks, totalCandlesCount);
          }
        }
      })()
    );
  }

  await Promise.all(workers);

  // Preserve chunk index order
  results.sort((a, b) => a.chunk.chunkIndex - b.chunk.chunkIndex);

  return { results, errors, completedCount };
}
