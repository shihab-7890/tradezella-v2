import { NormalizedCandle, RawFinageCandle } from './types';

/**
 * Checks if a given timestamp falls into the standard Forex weekend closure window:
 * Friday 21:00 UTC through Sunday 21:00 UTC.
 */
export function isWeekendClosure(epochMs: number): boolean {
  const d = new Date(epochMs);
  const day = d.getUTCDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
  const hour = d.getUTCHours();

  // Friday after 21:00 UTC
  if (day === 5 && hour >= 21) {
    return true;
  }
  // Saturday all day
  if (day === 6) {
    return true;
  }
  // Sunday before 21:00 UTC
  if (day === 0 && hour < 21) {
    return true;
  }

  return false;
}

/**
 * Normalizes raw timestamp into UTC epoch milliseconds.
 * Supports:
 * - Unix timestamp in seconds (10 digits)
 * - Unix timestamp in milliseconds (13 digits)
 * - ISO date/time strings
 * - Custom Finage property keys (t, time, timestamp, date, datetime)
 */
export function parseRawTimestampToEpochMs(rawT: any): number | null {
  if (rawT === undefined || rawT === null) {
    return null;
  }

  // If already a number
  if (typeof rawT === 'number') {
    if (!Number.isFinite(rawT) || rawT <= 0) return null;
    // If seconds (< 100,000,000,000 / ~Nov 2286 in seconds, ~1973 in ms), convert to ms
    if (rawT < 100_000_000_000) {
      return Math.round(rawT * 1000);
    }
    return Math.round(rawT);
  }

  // If numeric string e.g. "1728518400000" or "1728518400"
  if (typeof rawT === 'string') {
    const trimmed = rawT.trim();
    if (!trimmed) return null;

    // Check if purely numeric
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const num = parseFloat(trimmed);
      if (!Number.isFinite(num) || num <= 0) return null;
      if (num < 100_000_000_000) {
        return Math.round(num * 1000);
      }
      return Math.round(num);
    }

    // Try parsing as ISO date string
    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

/**
 * Normalizes a raw candle object into a validated NormalizedCandle.
 * Strictly rejects:
 * - Invalid timestamps
 * - Non-finite prices (NaN, null, Infinity, <= 0)
 * - Impossible OHLC relationships (high < low, high < open, high < close, low > open, low > close)
 */
export function normalizeCandle(raw: RawFinageCandle): NormalizedCandle | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  // Extract raw timestamp from possible keys
  const rawTimestamp = raw.t ?? raw.time ?? raw.timestamp ?? raw.date ?? raw.datetime;
  const timestamp = parseRawTimestampToEpochMs(rawTimestamp);
  if (timestamp === null || !Number.isFinite(timestamp)) {
    return null;
  }

  // Extract OHLC prices
  const rawOpen = raw.o ?? raw.open;
  const rawHigh = raw.h ?? raw.high;
  const rawLow = raw.l ?? raw.low;
  const rawClose = raw.c ?? raw.close;
  const rawVolume = raw.v ?? raw.volume ?? 0;

  const open = typeof rawOpen === 'string' ? parseFloat(rawOpen) : Number(rawOpen);
  const high = typeof rawHigh === 'string' ? parseFloat(rawHigh) : Number(rawHigh);
  const low = typeof rawLow === 'string' ? parseFloat(rawLow) : Number(rawLow);
  const close = typeof rawClose === 'string' ? parseFloat(rawClose) : Number(rawClose);
  const volume = typeof rawVolume === 'string' ? parseFloat(rawVolume) : Number(rawVolume);

  // Validate price finiteness and positivity
  if (!Number.isFinite(open) || open <= 0 ||
      !Number.isFinite(high) || high <= 0 ||
      !Number.isFinite(low) || low <= 0 ||
      !Number.isFinite(close) || close <= 0) {
    return null;
  }

  // Validate impossible OHLC relationships
  if (high < low ||
      high < open ||
      high < close ||
      low > open ||
      low > close) {
    return null;
  }

  const validVolume = (Number.isFinite(volume) && volume >= 0) ? volume : 0;

  // Filter out weekend flat-line dummy ticks (Friday >21:00 to Sunday <21:00 with zero price movement and zero volume)
  const isFlat = high === low && open === close && high === open;
  if (isFlat && validVolume === 0 && isWeekendClosure(timestamp)) {
    return null;
  }

  return {
    timestamp,
    time: timestamp, // Backward compatibility alias
    open,
    high,
    low,
    close,
    volume: validVolume,
  };
}

/**
 * Normalizes an array of raw candles, discarding invalid items.
 */
export function normalizeCandles(rawCandles: RawFinageCandle[]): NormalizedCandle[] {
  if (!Array.isArray(rawCandles)) {
    return [];
  }

  const result: NormalizedCandle[] = [];
  for (const raw of rawCandles) {
    const candle = normalizeCandle(raw);
    if (candle) {
      result.push(candle);
    }
  }

  return result;
}
