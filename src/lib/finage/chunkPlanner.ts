import { DataChunk } from './types';

export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;
export const DEFAULT_CHUNK_HOURS = 48; // Maximum 48 hours (2 days) per chunk

/**
 * Formats a Date or timestamp to UTC 'YYYY-MM-DD'
 */
export function formatUtcDate(dateOrMs: Date | number): string {
  const d = typeof dateOrMs === 'number' ? new Date(dateOrMs) : dateOrMs;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses 'YYYY-MM-DD' (or ISO string or timestamp) to a Date at UTC 00:00:00.000
 */
export function parseUtcDateString(dateStr: string | number | Date): Date {
  if (dateStr instanceof Date) {
    return new Date(Date.UTC(dateStr.getUTCFullYear(), dateStr.getUTCMonth(), dateStr.getUTCDate(), 0, 0, 0, 0));
  }
  if (typeof dateStr === 'number') {
    return new Date(dateStr);
  }
  // If string contains 'T', parse as ISO/date
  if (dateStr.includes('T')) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid date format: ${dateStr}`);
    }
    return d;
  }
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
  }
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

export interface ChunkPlannerOptions {
  chunkHours?: number;     // max chunk size in hours (default: 48)
  inclusiveEnd?: boolean;   // if true, covers through the end of the selected day (exclusive end is next day 00:00 UTC)
  clampToNow?: boolean;     // if true, clamps end boundary to current time
}

/**
 * Generates consecutive, non-overlapping chunks with maximum 48-hour (2-day) duration.
 * Adheres to half-open interval semantics: startEpochMs <= candle.timestamp < endEpochMs.
 *
 * @param startDate Start date ('YYYY-MM-DD', Date, or epoch ms)
 * @param endDate End date ('YYYY-MM-DD', Date, or epoch ms)
 * @param options Planning options (chunkHours, inclusiveEnd, clampToNow)
 * @returns Array of DataChunk objects
 */
export function planDateChunks(
  startDate: string | Date | number,
  endDate: string | Date | number,
  options: ChunkPlannerOptions = {}
): DataChunk[] {
  const {
    chunkHours = DEFAULT_CHUNK_HOURS,
    inclusiveEnd = false,
    clampToNow = false,
  } = options;

  if (chunkHours <= 0) {
    throw new Error('chunkHours must be a positive number');
  }

  const startUtc = parseUtcDateString(startDate);
  let endUtc = parseUtcDateString(endDate);

  let startEpochMs = startUtc.getTime();
  let endEpochMs = endUtc.getTime();

  // If inclusiveEnd is true (typical date-picker selection e.g. Oct 10 through Oct 20),
  // the exclusive end boundary is Oct 21 00:00 UTC.
  if (inclusiveEnd) {
    endEpochMs += MS_PER_DAY;
  }

  // If range is degenerate (start >= end), ensure at least a minimum 24h interval
  if (startEpochMs >= endEpochMs) {
    endEpochMs = startEpochMs + MS_PER_DAY;
  }

  // Optional clamp to current time (if clampToNow is specified)
  if (clampToNow) {
    const nowMs = Date.now();
    if (endEpochMs > nowMs) {
      endEpochMs = nowMs;
    }
    if (startEpochMs > endEpochMs) {
      startEpochMs = endEpochMs - MS_PER_DAY;
    }
  }

  const maxChunkMs = chunkHours * MS_PER_HOUR;
  const chunks: DataChunk[] = [];
  let currentStartMs = startEpochMs;
  let index = 0;

  while (currentStartMs < endEpochMs) {
    const currentEndMs = Math.min(currentStartMs + maxChunkMs, endEpochMs);
    
    const fromDate = formatUtcDate(currentStartMs);
    // For Finage API string date parameter, toDate represents the date of currentEndMs
    // If currentEndMs lands exactly on 00:00 UTC of a day, formatUtcDate(currentEndMs) matches
    // the day boundary.
    const toDate = formatUtcDate(currentEndMs);

    chunks.push({
      chunkIndex: index++,
      fromDate,
      toDate,
      startEpochMs: currentStartMs,
      endEpochMs: currentEndMs,
    });

    currentStartMs = currentEndMs;
  }

  // Attach totalChunks to each chunk
  const totalChunks = chunks.length;
  for (const chunk of chunks) {
    chunk.totalChunks = totalChunks;
  }

  return chunks;
}
