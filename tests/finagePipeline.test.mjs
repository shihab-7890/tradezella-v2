import test from 'node:test';
import assert from 'node:assert/strict';

import {
  planDateChunks,
  formatUtcDate,
  parseUtcDateString,
} from '../src/lib/finage/chunkPlanner.ts';
import {
  normalizeCandle,
  normalizeCandles,
  isWeekendClosure,
} from '../src/lib/finage/normalizer.ts';
import {
  mergeAndDeduplicateCandles,
} from '../src/lib/finage/mergeEngine.ts';

test('1. Chunk Planner: plans 14-day date range into deterministic 2-day windows', () => {
  const startDate = '2026-10-01';
  const endDate = '2026-10-14'; // 14 total days: Oct 1 through Oct 14
  const chunks = planDateChunks(startDate, endDate, {
    inclusiveEnd: true,
    chunkHours: 48,
  });

  // Oct 1-3, 3-5, 5-7, 7-9, 9-11, 11-13, 13-15 = 7 chunks (covering full Oct 1 through Oct 14)
  assert.equal(chunks.length, 7, 'Should produce exactly 7 chunks for 14 days with 2-day slices');

  assert.equal(chunks[0].chunkIndex, 0);
  assert.equal(chunks[0].fromDate, '2026-10-01');
  assert.equal(chunks[0].toDate, '2026-10-03');
  assert.equal(chunks[0].startEpochMs, parseUtcDateString('2026-10-01').getTime());
  assert.equal(chunks[0].endEpochMs, parseUtcDateString('2026-10-03').getTime());

  assert.equal(chunks[6].chunkIndex, 6);
  assert.equal(chunks[6].fromDate, '2026-10-13');
  assert.equal(chunks[6].toDate, '2026-10-15');

  // Verify consecutive non-overlapping boundaries
  for (let i = 0; i < chunks.length - 1; i++) {
    const nextStart = chunks[i + 1].startEpochMs;
    const currentEnd = chunks[i].endEpochMs;
    assert.equal(nextStart, currentEnd, `Chunk ${i} to ${i + 1} boundary must be consecutive`);
  }
});

test('2. Normalizer: converts 10-digit to 13-digit timestamps & parses float prices', () => {
  // 10-digit seconds timestamp
  const rawSec = {
    t: 1729000000, // 10 digits
    o: '2650.10',
    h: '2655.80',
    l: '2648.50',
    c: '2652.30',
    v: '1250',
  };

  const normalized = normalizeCandle(rawSec);
  assert.ok(normalized);
  assert.equal(normalized.timestamp, 1729000000000); // Converted to 13 digits
  assert.equal(normalized.time, 1729000000000);
  assert.equal(normalized.open, 2650.1);
  assert.equal(normalized.high, 2655.8);
  assert.equal(normalized.low, 2648.5);
  assert.equal(normalized.close, 2652.3);
  assert.equal(normalized.volume, 1250);
});

test('3. Normalizer: filters out flat-line dummy ticks during weekend closures', () => {
  // Saturday 12:00 UTC (within weekend closure)
  const saturdayNoon = new Date(Date.UTC(2026, 9, 10, 12, 0, 0)).getTime(); // Oct 10 2026 is Saturday
  assert.equal(isWeekendClosure(saturdayNoon), true);

  // Flat line tick (high == low == open == close)
  const flatWeekendTick = {
    t: saturdayNoon,
    o: 2650.0,
    h: 2650.0,
    l: 2650.0,
    c: 2650.0,
    v: 0,
  };
  assert.equal(normalizeCandle(flatWeekendTick), null, 'Weekend flat ticks should be filtered out');

  // Normal weekday active tick must be kept
  const mondayNoon = new Date(Date.UTC(2026, 9, 12, 12, 0, 0)).getTime(); // Oct 12 2026 is Monday
  assert.equal(isWeekendClosure(mondayNoon), false);
  const weekdayTick = {
    t: mondayNoon,
    o: 2650.0,
    h: 2652.0,
    l: 2649.0,
    c: 2651.0,
    v: 100,
  };
  assert.ok(normalizeCandle(weekdayTick), 'Weekday ticks must be preserved');
});

test('4. Merge Engine: merges overlapping mock chunks, removes duplicates, and ensures strict chronological order', () => {
  const baseTime = 1729000000000;
  const minute = 60_000;

  // Chunk 1: minutes 0 to 5 (minute 5 has volume 0)
  const chunk1 = [
    { timestamp: baseTime, time: baseTime, open: 100, high: 101, low: 99, close: 100.5, volume: 10 },
    { timestamp: baseTime + minute, time: baseTime + minute, open: 100.5, high: 102, low: 100, close: 101.5, volume: 15 },
    { timestamp: baseTime + 2 * minute, time: baseTime + 2 * minute, open: 101.5, high: 103, low: 101, close: 102.5, volume: 20 },
    { timestamp: baseTime + 3 * minute, time: baseTime + 3 * minute, open: 102.5, high: 104, low: 102, close: 103.5, volume: 25 },
    { timestamp: baseTime + 4 * minute, time: baseTime + 4 * minute, open: 103.5, high: 104.5, low: 103, close: 104, volume: 30 },
    { timestamp: baseTime + 5 * minute, time: baseTime + 5 * minute, open: 104, high: 105, low: 103.5, close: 104.5, volume: 0 }, // Duplicate with 0 volume
  ];

  // Chunk 2: minutes 4 to 8 (overlapping minutes 4 and 5; minute 5 has real volume 100)
  const chunk2 = [
    { timestamp: baseTime + 4 * minute, time: baseTime + 4 * minute, open: 103.5, high: 104.5, low: 103, close: 104, volume: 30 }, // Exact duplicate
    { timestamp: baseTime + 5 * minute, time: baseTime + 5 * minute, open: 104, high: 105, low: 103.5, close: 104.5, volume: 100 }, // Better volume
    { timestamp: baseTime + 6 * minute, time: baseTime + 6 * minute, open: 104.5, high: 106, low: 104, close: 105.5, volume: 40 },
    { timestamp: baseTime + 7 * minute, time: baseTime + 7 * minute, open: 105.5, high: 107, low: 105, close: 106.5, volume: 50 },
    { timestamp: baseTime + 8 * minute, time: baseTime + 8 * minute, open: 106.5, high: 108, low: 106, close: 107.5, volume: 60 },
  ];

  const totalRawRows = chunk1.length + chunk2.length; // 6 + 5 = 11

  const { candles, telemetry } = mergeAndDeduplicateCandles({
    chunksCandles: [chunk1, chunk2],
    totalChunks: 2,
    totalRawRows,
    timeframeStepMs: 60_000,
  });

  // Unique timestamps should be exactly 9 (minutes 0 to 8)
  assert.equal(candles.length, 9, 'Should have 9 unique candles from minutes 0 to 8');
  assert.equal(telemetry.duplicatesRemoved, 2, 'Should remove 2 duplicate rows (min 4 & min 5)');

  // Verify minute 5 retained the higher volume (100 instead of 0)
  const min5 = candles.find(c => c.timestamp === baseTime + 5 * minute);
  assert.ok(min5);
  assert.equal(min5.volume, 100, 'Conflicting duplicate must preserve non-zero/higher volume');

  // Verify strictly monotonic ascending order with ZERO duplicates or regressions
  for (let i = 0; i < candles.length - 1; i++) {
    const current = candles[i];
    const next = candles[i + 1];
    assert.ok(
      next.timestamp > current.timestamp,
      `Candle at index ${i + 1} (${next.timestamp}) must be strictly greater than index ${i} (${current.timestamp})`
    );
    assert.equal(next.timestamp - current.timestamp, minute, 'Must be contiguous 1-minute steps without gaps');
  }

  // Telemetry assertions
  assert.equal(telemetry.totalChunks, 2);
  assert.equal(telemetry.rawRowsReceived, 11);
  assert.equal(telemetry.validCandles, 9);
  assert.equal(telemetry.intradayMissingMinutes, 0);
  assert.equal(telemetry.firstTimestamp, baseTime);
  assert.equal(telemetry.lastTimestamp, baseTime + 8 * minute);
});
