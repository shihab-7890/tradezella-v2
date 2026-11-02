import { DataChunk, RawFinageCandle } from './types';

export interface ChunkCacheEntry {
  key: string;
  chunk: DataChunk;
  rawRows: RawFinageCandle[];
  createdAt: number;
}

const CHUNK_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL for historical chunks
const MAX_CACHE_ENTRIES = 500;

class ChunkCache {
  private cache = new Map<string, ChunkCacheEntry>();
  private inFlight = new Map<string, Promise<RawFinageCandle[]>>();

  public buildKey(symbol: string, timeframe: string, chunk: DataChunk, source: string = 'finage'): string {
    const cleanSym = symbol.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `${cleanSym}:${timeframe}:${chunk.startEpochMs}:${chunk.endEpochMs}:${source}`;
  }

  public get(key: string): RawFinageCandle[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.createdAt > CHUNK_CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    // Refresh LRU order
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.rawRows;
  }

  public set(key: string, chunk: DataChunk, rawRows: RawFinageCandle[]): void {
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, {
      key,
      chunk,
      rawRows,
      createdAt: Date.now(),
    });
  }

  public getInFlight(key: string): Promise<RawFinageCandle[]> | undefined {
    return this.inFlight.get(key);
  }

  public setInFlight(key: string, promise: Promise<RawFinageCandle[]>): void {
    this.inFlight.set(key, promise);
  }

  public deleteInFlight(key: string): void {
    this.inFlight.delete(key);
  }

  public clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}

export const chunkCache = new ChunkCache();
