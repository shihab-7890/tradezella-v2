
const CACHE_TTL_MS = 60_000;
const historicalDataCache = new Map();
const pendingHistoricalRequests = new Map();

function getDateKey(value) {
    return new Date(value).toISOString().split('T')[0];
}

export async function getHistoricalData(symbol, timeframe, from, to) {
    try {
        const startDate = getDateKey(from);
        const endDate = getDateKey(to);
        const cacheKey = `${symbol}|${timeframe}|${startDate}|${endDate}`;
        const cached = historicalDataCache.get(cacheKey);

        if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
            return cached.candles;
        }

        if (pendingHistoricalRequests.has(cacheKey)) {
            return pendingHistoricalRequests.get(cacheKey);
        }

        const apiUrl = `/api/finage?symbol=${symbol}&timeframe=${timeframe}&start=${startDate}&end=${endDate}`;
        
        const request = fetch(apiUrl)
          .then(async response => {
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to fetch ${timeframe} data: ${response.statusText}`);
            }
            
            const data = await response.json();
            const candles = data.candles || [];
            historicalDataCache.set(cacheKey, { candles, createdAt: Date.now() });
            return candles;
          })
          .finally(() => {
            pendingHistoricalRequests.delete(cacheKey);
          });

        pendingHistoricalRequests.set(cacheKey, request);
        return await request;
    } catch (error) {
        console.error(`Error fetching historical data for ${symbol} (${timeframe}):`, error);
        return [];
    }
}
