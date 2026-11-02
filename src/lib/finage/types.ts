export interface DataChunk {
  chunkIndex: number;
  fromDate: string;     // YYYY-MM-DD
  toDate: string;       // YYYY-MM-DD
  startEpochMs: number; // inclusive UTC epoch ms
  endEpochMs: number;   // exclusive UTC epoch ms: startEpochMs <= candle.timestamp < endEpochMs
  totalChunks?: number;
}

export interface RawFinageCandle {
  t?: number | string;
  time?: number | string;
  timestamp?: number | string;
  date?: string;
  datetime?: string;
  o?: number | string;
  open?: number | string;
  h?: number | string;
  high?: number | string;
  l?: number | string;
  low?: number | string;
  c?: number | string;
  close?: number | string;
  v?: number | string;
  volume?: number | string;
}

export interface NormalizedCandle {
  timestamp: number; // UTC Epoch time in milliseconds (13 digits)
  time: number;      // Alias for backward compatibility with TradeZella Canvas
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MissingGapInfo {
  startMs: number;
  endMs: number;
  durationMinutes: number;
  isWeekend: boolean;
}

export interface MergeTelemetry {
  totalChunks: number;
  completedChunks: number;
  rawRowsReceived: number;
  validCandles: number;
  duplicatesRemoved: number;
  conflictsResolved: number;
  intradayMissingMinutes: number;
  weekendClosureMinutes: number;
  firstTimestamp: number;
  lastTimestamp: number;
  missingGaps?: MissingGapInfo[];
}

export interface FinagePipelineResult {
  candles: NormalizedCandle[];
  telemetry: MergeTelemetry;
  isSimulated?: boolean;
  notice?: string;
  chunks?: DataChunk[];
}
