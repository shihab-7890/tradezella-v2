import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { executeBacktestRun } from '@/lib/backtest/backtestEngine';
import { buildReportArtifact } from '@/lib/reports/reportGenerator';
import { generateSimulatedCandles } from '@/lib/simulatedMarket';

const inMemoryBacktestStore = new Map();

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      symbol = 'XAU/USD',
      timeframe = '15m',
      tradingStyle = 'Intraday',
      backtestMode = 'STANDARD', // 'STANDARD' | 'WALK_FORWARD' | 'OPTIMIZATION'
      dateRange,
      reportType = 'REPORT_A',
      format = 'PDF',
      candles: providedCandles,
      settings = {},
    } = body;

    // Use provided candles or generate fallback simulation candles if none passed
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

    // 1. Execute Backtest Run
    const backtestRun = await executeBacktestRun(candles, {
      symbol,
      timeframe,
      tradingStyle,
      backtestMode,
      dateRange: dateRange || { from: candles[0]?.time, to: candles[candles.length - 1]?.time },
      settings,
    });

    if (backtestRun.status === 'FAILED') {
      return NextResponse.json({ error: backtestRun.error }, { status: 400 });
    }

    // 2. Build Report Artifact
    const reportArtifact = await buildReportArtifact(backtestRun, {
      reportType,
      format,
    });

    // Store in memory for direct download API
    const reportId = `report-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    inMemoryBacktestStore.set(reportId, { backtestRun, reportArtifact });

    return NextResponse.json({
      success: true,
      reportId,
      runId: backtestRun.runId,
      filename: reportArtifact.filename,
      contentType: reportArtifact.contentType,
      metrics: backtestRun.metrics,
      provenance: backtestRun.provenance,
    });
  } catch (error) {
    console.error('Report Generation Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to generate report' }, { status: 500 });
  }
}

export function getStoredReport(reportId) {
  return inMemoryBacktestStore.get(reportId);
}
