import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  planDateChunks,
  formatUtcDate,
  parseUtcDateString,
  DEFAULT_CHUNK_HOURS,
  MS_PER_DAY,
  MS_PER_HOUR,
} from '../src/lib/finage/chunkPlanner.ts';
import {
  normalizeCandle,
  normalizeCandles,
  parseRawTimestampToEpochMs,
  isWeekendClosure,
} from '../src/lib/finage/normalizer.ts';
import {
  mergeAndDeduplicateCandles,
} from '../src/lib/finage/mergeEngine.ts';
import {
  chunkCache,
} from '../src/lib/finage/chunkCache.ts';
import {
  fetchChunk,
  fetchAllChunks,
} from '../src/lib/finage/finageFetcher.ts';

describe('Finage 2-Day Chunking, Normalization & Merge Engine', () => {

  // =========================================================================
  // Test Case 1: Five Requests (Oct 10 00:00 to Oct 20 00:00 UTC, end exclusive)
  // =========================================================================
  test('Test Case 1: Five Requests — Oct 10 00:00 to Oct 20 00:00 UTC (end exclusive)', () => {
    const chunks = planDateChunks('2026-10-10', '2026-10-20', {
      inclusiveEnd: false,
      chunkHours: 48,
    });

    assert.equal(chunks.length, 5, 'Must generate exactly 5 chunks for 10-day range with 48h chunks');

    const expectedChunks = [
      { fromDate: '2026-10-10', toDate: '2026-10-12', start: Date.UTC(2026, 9, 10), end: Date.UTC(2026, 9, 12) },
      { fromDate: '2026-10-12', toDate: '2026-10-14', start: Date.UTC(2026, 9, 12), end: Date.UTC(2026, 9, 14) },
      { fromDate: '2026-10-14', toDate: '2026-10-16', start: Date.UTC(2026, 9, 14), end: Date.UTC(2026, 9, 16) },
      { fromDate: '2026-10-16', toDate: '2026-10-18', start: Date.UTC(2026, 9, 16), end: Date.UTC(2026, 9, 18) },
      { fromDate: '2026-10-18', toDate: '2026-10-20', start: Date.UTC(2026, 9, 18), end: Date.UTC(2026, 9, 20) },
    ];

    for (let i = 0; i < expectedChunks.length; i++) {
      const c = chunks[i];
      const exp = expectedChunks[i];
      assert.equal(c.chunkIndex, i);
      assert.equal(c.fromDate, exp.fromDate, `Chunk ${i} fromDate mismatch`);
      assert.equal(c.toDate, exp.toDate, `Chunk ${i} toDate mismatch`);
      assert.equal(c.startEpochMs, exp.start, `Chunk ${i} startEpochMs mismatch`);
      assert.equal(c.endEpochMs, exp.end, `Chunk ${i} endEpochMs mismatch`);
      assert.equal(c.endEpochMs - c.startEpochMs, 48 * MS_PER_HOUR, `Chunk ${i} must be exactly 48h`);
    }

    // Simulate candles for all 5 chunks and merge
    const chunksCandles = chunks.map((chunk, idx) => {
      const candles = [];
      // 1 candle per 4 hours
      for (let t = chunk.startEpochMs; t < chunk.endEpochMs; t += 4 * MS_PER_HOUR) {
        candles.push({
          timestamp: t,
          time: t,
          open: 2600 + idx,
          high: 2610 + idx,
          low: 2595 + idx,
          close: 2605 + idx,
          volume: 100,
        });
      }
      return candles;
    });

    const { candles, telemetry } = mergeAndDeduplicateCandles({
      chunksCandles,
      totalChunks: 5,
      totalRawRows: chunksCandles.reduce((acc, c) => acc + c.length, 0),
      timeframeStepMs: 4 * MS_PER_HOUR,
    });

    assert.equal(telemetry.totalChunks, 5);
    assert.equal(candles.length, 60, '10 days * 6 candles/day = 60 candles');
    // Verify strictly ascending order
    for (let i = 0; i < candles.length - 1; i++) {
      assert(candles[i].timestamp < candles[i + 1].timestamp, 'Must be strictly ascending');
    }
  });

  // =========================================================================
  // Test Case 2: Inclusive End Date (Oct 10 through Oct 20 inclusive)
  // =========================================================================
  test('Test Case 2: Inclusive End Date — Oct 10 through full Oct 20 (6 chunks)', () => {
    const chunks = planDateChunks('2026-10-10', '2026-10-20', {
      inclusiveEnd: true,
      chunkHours: 48,
    });

    assert.equal(chunks.length, 6, 'Must generate exactly 6 chunks to include full day of Oct 20 (ending Oct 21 00:00 UTC)');
    assert.equal(chunks[5].fromDate, '2026-10-20');
    assert.equal(chunks[5].toDate, '2026-10-21');
    assert.equal(chunks[5].endEpochMs, Date.UTC(2026, 9, 21), 'Exclusive end boundary must be Oct 21 00:00 UTC');
  });

  // =========================================================================
  // Test Case 3: Short Range (< 2 days)
  // =========================================================================
  test('Test Case 3: Short Range (< 2 days) — Exactly 1 chunk', () => {
    const chunks = planDateChunks('2026-10-10', '2026-10-11', {
      inclusiveEnd: false,
      chunkHours: 48,
    });

    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].fromDate, '2026-10-10');
    assert.equal(chunks[0].toDate, '2026-10-11');
    assert.equal(chunks[0].endEpochMs - chunks[0].startEpochMs, 24 * MS_PER_HOUR);
  });

  // =========================================================================
  // Test Case 4: Arbitrary Range (7 days)
  // =========================================================================
  test('Test Case 4: Arbitrary Range — 7 days produces 3x 48h chunks + 1x 24h chunk', () => {
    const chunks = planDateChunks('2026-10-10', '2026-10-17', {
      inclusiveEnd: false,
      chunkHours: 48,
    });

    assert.equal(chunks.length, 4, '7 days = 3 x 48h + 1 x 24h chunk');
    assert.equal(chunks[0].endEpochMs - chunks[0].startEpochMs, 48 * MS_PER_HOUR);
    assert.equal(chunks[1].endEpochMs - chunks[1].startEpochMs, 48 * MS_PER_HOUR);
    assert.equal(chunks[2].endEpochMs - chunks[2].startEpochMs, 48 * MS_PER_HOUR);
    assert.equal(chunks[3].endEpochMs - chunks[3].startEpochMs, 24 * MS_PER_HOUR);
  });

  // =========================================================================
  // Test Case 5: Duplicate Boundary Candles Deduplication
  // =========================================================================
  test('Test Case 5: Duplicate Boundary Candles — Deduplicated seamlessly', () => {
    const boundaryTs = Date.UTC(2026, 9, 12, 0, 0, 0);

    const chunk1 = [
      { timestamp: boundaryTs - 3600_000, time: boundaryTs - 3600_000, open: 2600, high: 2605, low: 2598, close: 2602, volume: 100 },
      { timestamp: boundaryTs, time: boundaryTs, open: 2602, high: 2608, low: 2601, close: 2606, volume: 80 },
    ];

    const chunk2 = [
      // Exact duplicate at boundaryTs with identical OHLC
      { timestamp: boundaryTs, time: boundaryTs, open: 2602, high: 2608, low: 2601, close: 2606, volume: 120 },
      { timestamp: boundaryTs + 3600_000, time: boundaryTs + 3600_000, open: 2606, high: 2612, low: 2605, close: 2610, volume: 95 },
    ];

    const { candles, telemetry } = mergeAndDeduplicateCandles({
      chunksCandles: [chunk1, chunk2],
      totalChunks: 2,
      totalRawRows: 4,
      timeframeStepMs: 3600_000,
    });

    assert.equal(candles.length, 3, 'Must have exactly 3 candles after boundary deduplication');
    assert.equal(telemetry.duplicatesRemoved, 1);
    // Highest volume candle (120) should be retained
    const boundaryCandle = candles.find(c => c.timestamp === boundaryTs);
    assert(boundaryCandle, 'Boundary candle must exist');
    assert.equal(boundaryCandle.volume, 120, 'Should retain candle with higher volume (120 vs 80)');
  });

  // =========================================================================
  // Test Case 6: Out-of-Order & Mixed Timestamps Normalization & Sorting
  // =========================================================================
  test('Test Case 6: Out-of-Order & Mixed Timestamps — Seconds, ms, strings normalized and sorted', () => {
    const rawData = [
      // 10-digit Unix seconds: 1728518400 (Oct 10 2024 00:00:00 GMT) -> 1728518400000 ms
      { t: 1728518400, o: '2600.5', h: '2610.0', l: '2595.0', c: '2605.2', v: '150' },
      // 13-digit Unix milliseconds: 1728514800000 (1 hour earlier)
      { timestamp: 1728514800000, open: 2595, high: 2602, low: 2590, close: 2600.5, volume: 200 },
      // ISO timestamp string: 2 hours earlier
      { time: '2024-10-09T22:00:00.000Z', open: 2590, high: 2598, low: 2588, close: 2595, volume: 180 },
      // Invalid candle: high < low (should be rejected)
      { t: 1728522000, o: 2600, h: 2590, l: 2610, c: 2605, v: 50 },
      // Invalid candle: negative price
      { t: 1728525600, o: -10, h: 2600, l: -20, c: 2500, v: 50 },
    ];

    const normalized = normalizeCandles(rawData);
    assert.equal(normalized.length, 3, 'Must reject 2 invalid candles and keep 3 valid ones');

    const { candles } = mergeAndDeduplicateCandles({
      chunksCandles: [normalized],
      totalChunks: 1,
      totalRawRows: normalized.length,
    });

    assert.equal(candles.length, 3);
    assert.equal(candles[0].timestamp, Date.parse('2024-10-09T22:00:00.000Z'));
    assert.equal(candles[1].timestamp, 1728514800000);
    assert.equal(candles[2].timestamp, 1728518400000);
    // Check backward compatibility alias
    assert.equal(candles[0].time, candles[0].timestamp);
  });

  // =========================================================================
  // Test Case 7: Missing Data & Weekend Gap Detection
  // =========================================================================
  test('Test Case 7: Missing Data — Detects gaps and classifies weekend closures', () => {
    // Friday Oct 11 2024 20:00 UTC to Sunday Oct 13 2024 22:00 UTC (standard Forex weekend)
    const fridayClose = Date.UTC(2024, 9, 11, 20, 0, 0); // Friday 20:00 UTC
    const sundayOpen = Date.UTC(2024, 9, 13, 22, 0, 0);  // Sunday 22:00 UTC (48h later)

    const candles = [
      { timestamp: fridayClose, time: fridayClose, open: 2600, high: 2605, low: 2598, close: 2602, volume: 100 },
      { timestamp: sundayOpen, time: sundayOpen, open: 2605, high: 2610, low: 2602, close: 2608, volume: 150 },
    ];

    const { telemetry } = mergeAndDeduplicateCandles({
      chunksCandles: [candles],
      totalChunks: 1,
      totalRawRows: 2,
      timeframeStepMs: 3600_000, // 1h step
    });

    assert(telemetry.weekendClosureMinutes > 0, 'Must record weekend closure minutes');
    assert.equal(telemetry.missingGaps.length, 1);
    assert.equal(telemetry.missingGaps[0].isWeekend, true, 'Gap across Sat-Sun must be marked as weekend');
  });

  // =========================================================================
  // Test Case 8: Conflict Resolution Deterministic Policy
  // =========================================================================
  test('Test Case 8: Conflict Resolution — Deterministic policy logs conflict and prefers higher volume', () => {
    const ts = Date.UTC(2026, 9, 15, 12, 0, 0);
    const candleA = { timestamp: ts, time: ts, open: 2600, high: 2610, low: 2595, close: 2605, volume: 50 };
    const candleB = { timestamp: ts, time: ts, open: 2601, high: 2612, low: 2596, close: 2607, volume: 250 };

    const { candles, telemetry } = mergeAndDeduplicateCandles({
      chunksCandles: [[candleA], [candleB]],
      totalChunks: 2,
      totalRawRows: 2,
    });

    assert.equal(candles.length, 1);
    assert.equal(telemetry.duplicatesRemoved, 1);
    assert.equal(telemetry.conflictsResolved, 1);
    // Candle B has higher volume (250 vs 50)
    assert.equal(candles[0].volume, 250);
    assert.equal(candles[0].close, 2607);
  });

  // =========================================================================
  // Test Case 9: Caching & Performance — Reuses cached chunks
  // =========================================================================
  test('Test Case 9: Chunk Cache — Caches and retrieves chunks without duplicate network calls', () => {
    chunkCache.clear();
    const chunk = {
      chunkIndex: 0,
      fromDate: '2026-10-10',
      toDate: '2026-10-12',
      startEpochMs: 1791590400000,
      endEpochMs: 1791763200000,
    };

    const key = chunkCache.buildKey('XAU/USD', '15m', chunk, 'finage');
    const mockRows = [{ t: 1791590400000, o: 2600, h: 2605, l: 2595, c: 2602, v: 100 }];

    // Store in cache
    chunkCache.set(key, chunk, mockRows);

    // Retrieve from cache
    const retrieved = chunkCache.get(key);
    assert(retrieved !== null);
    assert.equal(retrieved.length, 1);
    assert.equal(retrieved[0].o, 2600);
  });

  // =========================================================================
  // Test Case 10: Date Formatting and Parsing Robustness
  // =========================================================================
  test('Test Case 10: Date Helpers — UTC parsing and formatting consistency', () => {
    const dStr = '2026-10-15';
    const parsed = parseUtcDateString(dStr);
    assert.equal(parsed.getUTCFullYear(), 2026);
    assert.equal(parsed.getUTCMonth(), 9); // 0-indexed: 9 = October
    assert.equal(parsed.getUTCDate(), 15);
    assert.equal(parsed.getUTCHours(), 0);

    const formatted = formatUtcDate(parsed);
    assert.equal(formatted, dStr);
  });

});
