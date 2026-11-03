import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { executeBacktestRun } from '@/lib/backtest/backtestEngine';
import { buildReportArtifact } from '@/lib/reports/reportGenerator';
import { generateSimulatedCandles } from '@/lib/simulatedMarket';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      symbol = 'XAU/USD',
      timeframe = '15m',
      tradingStyle = 'Intraday',
      backtestMode = 'STANDARD',
      reportType = 'REPORT_A',
      format = 'PDF', // 'PDF' | 'EXCEL' | 'CSV' | 'JSON' | 'HTML' | 'ZIP'
      candles: providedCandles,
      settings = {},
    } = body;

    let candles = providedCandles;
    if (!candles || candles.length === 0) {
      const now = new Date();
      const past30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      candles = generateSimulatedCandles(
        symbol,
        timeframe,
        past30Days.toISOString().split('T')[0],
        now.toISOString().split('T')[0]
      );
    }

    const backtestRun = await executeBacktestRun(candles, {
      symbol,
      timeframe,
      tradingStyle,
      backtestMode,
      settings,
    });

    const report = await buildReportArtifact(backtestRun, {
      reportType,
      format,
    });

    const response = new NextResponse(report.artifact, {
      status: 200,
      headers: {
        'Content-Type': report.contentType,
        'Content-Disposition': `attachment; filename="${report.filename}"`,
        'Cache-Control': 'no-store, no-cache',
      },
    });

    return response;
  } catch (error) {
    console.error('Report Download Error:', error);
    return NextResponse.json({ error: error?.message || 'Download failed' }, { status: 500 });
  }
}
