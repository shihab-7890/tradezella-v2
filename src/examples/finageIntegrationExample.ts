/**
 * Example: How to invoke the Finage Multi-Chunk Ingestion & Merge Pipeline
 * 
 * This example demonstrates:
 * 1. Server-side invocation (Next.js Route Handler or Server Action)
 * 2. Client-side consumption via Next.js React component / custom hook
 */

import { executeFinagePipeline, FinagePipelineResult } from '@/lib/finage';
import { getHistoricalDataWithDetails } from '@/services/finageService';

// ==============================================================================
// 1. Server-Side Route Handler / Server Action Example
// ==============================================================================
export async function fetchHistoricalForexServerExample(): Promise<FinagePipelineResult> {
  const symbol = 'XAU/USD';
  const startDate = '2026-10-01';
  const endDate = '2026-10-14';

  const result = await executeFinagePipeline({
    symbol,
    startDate,
    endDate,
    timeframe: '1m',                  // 1-minute aggregate candles
    chunkDays: 2,                     // 2-day deterministic slices to prevent truncation
    concurrency: 2,                   // Concurrency pool to stay within Finage rate limits
    allowSimulationFallback: true,    // Graceful fallback to market simulation if key restricted
  });

  console.log(`[Server] Merged ${result.candles.length} candles.`);
  console.log(`[Server] Telemetry:`, result.telemetry);
  /**
   * Output example:
   * Telemetry: {
   *   totalChunks: 7,
   *   rawRowsReceived: 10080,
   *   validCandles: 9940,
   *   duplicatesRemoved: 140,
   *   intradayMissingMinutes: 0,
   *   weekendClosureMinutes: 2880,
   *   firstTimestamp: 1790812800000,
   *   lastTimestamp: 1792022340000
   * }
   */

  return result;
}

// ==============================================================================
// 2. Client-Side React Service Call Example
// ==============================================================================
export async function fetchMarketDataClientExample() {
  const symbol = 'EUR/USD';
  const timeframe = '15m';
  const from = new Date(Date.now() - 14 * 86_400_000);
  const to = new Date();

  // Call the client service which proxies through the multi-chunk route
  const { candles, telemetry, isSimulated } = await getHistoricalDataWithDetails(
    symbol,
    timeframe,
    from,
    to
  );

  console.log(`[Client] Fetched ${candles.length} candles (isSimulated: ${isSimulated})`);
  if (telemetry) {
    console.log(`[Client] Removed ${telemetry.duplicatesRemoved} boundary duplicate ticks.`);
  }

  return candles;
}
