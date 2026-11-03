import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { normalizeCandle } from '@/lib/finage';
import { generateSimulatedCandles } from '@/lib/simulatedMarket';

const TIMEFRAME_MS = {
  '1m': 60_000,
  '2m': 120_000,
  '3m': 180_000,
  '5m': 300_000,
  '10m': 600_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1D': 86_400_000,
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'XAU/USD';
  const timeframe = searchParams.get('timeframe') || '15m';

  const apiKey = process.env.FINAGE_API_KEY || 'API_KEY95YTO81R66DCOZUANVVX135GBVHXQ5CK';
  const cleanSymbol = symbol.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  // If live API key is configured, attempt real-time quote fetch from Finage
  if (apiKey) {
    try {
      const liveUrl = `https://api.finage.co.uk/last/forex/${cleanSymbol}?apikey=${apiKey}`;
      const res = await fetch(liveUrl, { cache: 'no-store' });
      const data = await res.json();

      if (res.ok && (data.price || data.ask || data.bid)) {
        const currentPrice = Number(data.price || data.ask || data.bid);
        const timestamp = data.timestamp
          ? (data.timestamp < 10_000_000_000 ? data.timestamp * 1000 : data.timestamp)
          : Date.now();

        const rawCandle = {
          time: timestamp,
          open: currentPrice,
          high: currentPrice,
          low: currentPrice,
          close: currentPrice,
          volume: data.volume || 10,
        };

        const candle = normalizeCandle(rawCandle);
        if (candle) {
          return NextResponse.json({
            candle,
            isLive: true,
            isSimulated: false,
          });
        }
      }
    } catch (err) {
      console.warn('[Live API] Live quote fetch failed:', err.message);
    }
  }

  // Fallback: Generate real-time forming candle using simulated market engine
  const now = new Date();
  const stepMs = TIMEFRAME_MS[timeframe] || 900_000;
  const bucketStart = Math.floor(now.getTime() / stepMs) * stepMs;

  const simCandles = generateSimulatedCandles(
    symbol,
    timeframe,
    new Date(bucketStart - 5 * stepMs).toISOString().split('T')[0],
    now.toISOString().split('T')[0]
  );

  const latestSim = simCandles[simCandles.length - 1] || {
    time: bucketStart,
    open: 2650,
    high: 2652,
    low: 2649,
    close: 2651,
    volume: 50,
  };

  const candle = normalizeCandle({
    time: bucketStart,
    open: latestSim.open,
    high: latestSim.high,
    low: latestSim.low,
    close: latestSim.close,
    volume: latestSim.volume,
  });

  return NextResponse.json({
    candle,
    isLive: false,
    isSimulated: true,
    notice: 'Simulated live tick (configure FINAGE_API_KEY with live permissions for exchange feed).',
  });
}
