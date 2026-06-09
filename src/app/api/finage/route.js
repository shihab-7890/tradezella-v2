import { NextResponse } from 'next/server';

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 50;
const responseCache = new Map();
const pendingRequests = new Map();

function getCachedResponse(cacheKey) {
  const cached = responseCache.get(cacheKey);
  if (!cached || Date.now() - cached.createdAt > CACHE_TTL_MS) {
    responseCache.delete(cacheKey);
    return null;
  }

  responseCache.delete(cacheKey);
  responseCache.set(cacheKey, cached);
  return cached.data;
}

function setCachedResponse(cacheKey, data) {
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    responseCache.delete(oldestKey);
  }

  responseCache.set(cacheKey, { data, createdAt: Date.now() });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const timeframe = searchParams.get('timeframe');
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!symbol || !timeframe || !start || !end) {
    return NextResponse.json({ error: 'Missing required query parameters' }, { status: 400 });
  }

  const apiKey = process.env.FINAGE_API_KEY || 'API_KEY614U7ET6JJOW4D1RUZNJKJWDV0ET0Q5W';
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured on server' }, { status: 500 });
  }

  // Map user-friendly timeframes to Finage API intervals
  const timeframeMap = {
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

  const apiTimeframe = timeframeMap[timeframe];
  if (!apiTimeframe) {
    return NextResponse.json({ error: 'Invalid timeframe' }, { status: 400 });
  }
  
  const formattedSymbol = symbol.replace(/\//g, '').toLowerCase();
  const cacheKey = `${formattedSymbol}|${timeframe}|${start}|${end}`;
  const cachedResponse = getCachedResponse(cacheKey);

  if (cachedResponse) {
    return NextResponse.json(cachedResponse, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    });
  }

  const finageUrl = `https://api.finage.co.uk/agg/forex/${formattedSymbol}/${apiTimeframe.value}/${apiTimeframe.interval}/${start}/${end}?apikey=${apiKey}&limit=30000`;

  if (pendingRequests.has(cacheKey)) {
    const pendingResponse = await pendingRequests.get(cacheKey);
    if (pendingResponse.errorResponse) {
      return pendingResponse.errorResponse;
    }
    return NextResponse.json(pendingResponse, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    });
  }
  
  try {
    const pendingRequest = fetch(finageUrl, { cache: 'no-store' })
      .then(async finageResponse => {
        const data = await finageResponse.json();

        if (!finageResponse.ok) {
          const errorMessage = data?.error || finageResponse.statusText;
          console.error('Finage API Error:', errorMessage);
          return {
            errorResponse: NextResponse.json({ error: `Finage API error: ${errorMessage}` }, { status: finageResponse.status }),
          };
        }

        const responseData = {
          candles: data.results?.map(c => ({
            time: c.t,
            open: c.o,
            high: c.h,
            low: c.l,
            close: c.c,
            volume: c.v
          })) || []
        };

        setCachedResponse(cacheKey, responseData);
        return responseData;
      })
      .finally(() => {
        pendingRequests.delete(cacheKey);
      });

    pendingRequests.set(cacheKey, pendingRequest);
    const responseData = await pendingRequest;

    if (responseData.errorResponse) {
      return responseData.errorResponse;
    }
    
    return NextResponse.json(responseData, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    });
  } catch (error) {
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
