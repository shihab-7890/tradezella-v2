const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes for historical candles
const historicalDataCache = new Map();
const pendingHistoricalRequests = new Map();

function getDateKey(value) {
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  if (typeof value === 'number') {
    return new Date(value).toISOString().split('T')[0];
  }
  if (typeof value === 'string') {
    return value.split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

/**
 * Fetches historical candlestick data with transparent deduplication and caching.
 */
export async function getHistoricalData(symbol, timeframe, from, to, options = {}) {
  const result = await getHistoricalDataWithDetails(symbol, timeframe, from, to, options);
  return result.candles || [];
}

/**
 * Fetches historical candlestick data along with merge telemetry and simulation indicators.
 */
export async function getHistoricalDataWithDetails(symbol, timeframe, from, to, options = {}) {
  try {
    const startDate = getDateKey(from);
    const endDate = getDateKey(to);
    const inclusive = options.inclusive !== false; // default true for UI date-picker ranges
    const cleanSym = symbol.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const cacheKey = `${cleanSym}|${timeframe}|${startDate}|${endDate}|${inclusive}`;

    const cached = historicalDataCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
      return cached.data;
    }

    if (pendingHistoricalRequests.has(cacheKey)) {
      return pendingHistoricalRequests.get(cacheKey);
    }

    const baseUrl = typeof window !== 'undefined' ? '' : (process.env.APP_URL || 'http://localhost:3000');
    const apiUrl = `${baseUrl}/api/finage?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&start=${startDate}&end=${endDate}&inclusive=${inclusive}`;

    const request = fetch(apiUrl)
      .then(async response => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch ${timeframe} data: ${response.statusText}`);
        }

        const data = await response.json();
        const responseData = {
          candles: data.candles || [],
          telemetry: data.telemetry,
          chunks: data.chunks || [],
          isSimulated: data.isSimulated || false,
          notice: data.notice,
        };

        historicalDataCache.set(cacheKey, { data: responseData, createdAt: Date.now() });
        return responseData;
      })
      .finally(() => {
        pendingHistoricalRequests.delete(cacheKey);
      });

    pendingHistoricalRequests.set(cacheKey, request);
    return await request;
  } catch (error) {
    console.error(`Error fetching historical data for ${symbol} (${timeframe}):`, error);
    return {
      candles: [],
      isSimulated: false,
      error: error.message,
    };
  }
}

