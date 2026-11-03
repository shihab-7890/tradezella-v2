/**
 * Phase 10 — Professional Excel Report Generator
 * Uses 'xlsx' package to generate structured multi-sheet .xlsx workbooks.
 */

import * as XLSX from 'xlsx';

export function generateExcelWorkbook(backtestRun, options = {}) {
  const wb = XLSX.utils.book_new();
  const { metrics, provenance, tradeLog, walkForwardResult, optimizationResult, settingsSnapshot } = backtestRun;

  // Sheet 1: Overview & Provenance
  const overviewData = [
    { Parameter: 'Backtest Run ID', Value: backtestRun.runId || 'N/A' },
    { Parameter: 'Report Generated At', Value: new Date().toISOString() },
    { Parameter: 'Symbol', Value: provenance?.symbol || 'XAUUSD' },
    { Parameter: 'Timeframe', Value: provenance?.timeframe || '15m' },
    { Parameter: 'Trading Style', Value: provenance?.tradingStyle || 'Intraday' },
    { Parameter: 'Backtest Mode', Value: provenance?.backtestMode || 'STANDARD' },
    { Parameter: 'Historical Date Range', Value: `${provenance?.dateRange?.from || ''} to ${provenance?.dateRange?.to || ''}` },
    { Parameter: 'Total Historical Candles', Value: provenance?.candlesCount || 0 },
    { Parameter: 'Data Source', Value: provenance?.isSimulated ? 'Simulated Demo Feed' : 'Finage Real Exchange Feed' },
    { Parameter: 'Initial Balance', Value: `$${metrics?.initialBalance || 10000}` },
    { Parameter: 'Final Balance', Value: `$${metrics?.finalBalance || 10000}` },
  ];
  const wsOverview = XLSX.utils.json_to_sheet(overviewData);
  XLSX.utils.book_append_sheet(wb, wsOverview, 'Overview');

  // Sheet 2: Summary Metrics
  const summaryData = [
    { Category: 'Financial', Metric: 'Net PnL ($)', Value: metrics?.netPnl || 0 },
    { Category: 'Financial', Metric: 'Gross Profit ($)', Value: metrics?.grossProfit || 0 },
    { Category: 'Financial', Metric: 'Gross Loss ($)', Value: metrics?.grossLoss || 0 },
    { Category: 'Financial', Metric: 'Profit Factor', Value: metrics?.profitFactor || 0 },
    { Category: 'Financial', Metric: 'Net Expectancy ($/trade)', Value: metrics?.netExpectancy || 0 },
    { Category: 'Financial', Metric: 'Total Execution Costs ($)', Value: metrics?.totalCosts || 0 },
    { Category: 'Trades', Metric: 'Total Executed Trades', Value: metrics?.totalTrades || 0 },
    { Category: 'Trades', Metric: 'Winning Trades', Value: metrics?.winningTrades || 0 },
    { Category: 'Trades', Metric: 'Losing Trades', Value: metrics?.losingTrades || 0 },
    { Category: 'Trades', Metric: 'Win Rate (%)', Value: `${metrics?.winRate || 0}%` },
    { Category: 'Trades', Metric: 'Average Win ($)', Value: metrics?.avgProfit || 0 },
    { Category: 'Trades', Metric: 'Average Loss ($)', Value: metrics?.avgLoss || 0 },
    { Category: 'Trades', Metric: 'Average R-Multiple', Value: metrics?.avgR || 0 },
    { Category: 'Risk & Ratios', Metric: 'Max Drawdown (%)', Value: `${metrics?.maxDrawdownPct || 0}%` },
    { Category: 'Risk & Ratios', Metric: 'Max Drawdown ($)', Value: metrics?.maxDrawdownAbs || 0 },
    { Category: 'Risk & Ratios', Metric: 'Sharpe Ratio', Value: metrics?.sharpeRatio || 0 },
    { Category: 'Risk & Ratios', Metric: 'Sortino Ratio', Value: metrics?.sortinoRatio || 0 },
    { Category: 'Risk & Ratios', Metric: 'Calmar Ratio', Value: metrics?.calmarRatio || 0 },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary Metrics');

  // Sheet 3: Executed Trades
  if (tradeLog && tradeLog.length > 0) {
    const formattedTrades = tradeLog.map(t => ({
      Time: new Date(t.time || t.entryTime).toISOString(),
      Decision: t.decision || (t.isApproved ? 'APPROVED' : 'WATCH'),
      Direction: t.direction || t.type,
      Price: t.price,
      SL: t.sl || '',
      TP: t.tp || '',
      Score: t.unifiedScore !== undefined ? t.unifiedScore : (t.score ? Math.round(t.score * 10) : ''),
      Grade: t.qualityTier || '',
      Style: t.tradingStyle || '',
      Strategy: t.strategy || '',
      RealizedPnL: t.realizedPnl !== undefined ? t.realizedPnl : 0,
      RealizedR: t.realizedR !== undefined ? t.realizedR : '',
      Notes: t.notes || '',
    }));
    const wsTrades = XLSX.utils.json_to_sheet(formattedTrades);
    XLSX.utils.book_append_sheet(wb, wsTrades, 'Executed Trades');
  }

  // Sheet 4: BUY vs SELL Analysis
  const buySellData = [
    { Direction: 'BUY', TotalTrades: metrics?.buyStats?.totalTrades || 0, WinRatePct: metrics?.buyStats?.winRate || 0, NetPnL: metrics?.buyStats?.netPnl || 0, ProfitFactor: metrics?.buyStats?.profitFactor || 0, Expectancy: metrics?.buyStats?.expectancy || 0 },
    { Direction: 'SELL', TotalTrades: metrics?.sellStats?.totalTrades || 0, WinRatePct: metrics?.sellStats?.winRate || 0, NetPnL: metrics?.sellStats?.netPnl || 0, ProfitFactor: metrics?.sellStats?.profitFactor || 0, Expectancy: metrics?.sellStats?.expectancy || 0 },
  ];
  const wsBuySell = XLSX.utils.json_to_sheet(buySellData);
  XLSX.utils.book_append_sheet(wb, wsBuySell, 'BUY vs SELL');

  // Sheet 5: Walk-Forward Folds (if available)
  if (walkForwardResult && walkForwardResult.folds) {
    const foldData = walkForwardResult.folds.map(f => ({
      FoldNumber: f.foldIndex,
      TrainRange: `${new Date(f.trainRange.from).toLocaleDateString()} to ${new Date(f.trainRange.to).toLocaleDateString()}`,
      TestRange: `${new Date(f.testRange.from).toLocaleDateString()} to ${new Date(f.testRange.to).toLocaleDateString()}`,
      TrainWinRatePct: f.trainMetrics.winRate,
      TrainNetPnL: f.trainMetrics.netPnl,
      TestWinRatePct: f.testMetrics.winRate,
      TestNetPnL: f.testMetrics.netPnl,
      TestProfitFactor: f.testMetrics.profitFactor,
    }));
    const wsFolds = XLSX.utils.json_to_sheet(foldData);
    XLSX.utils.book_append_sheet(wb, wsFolds, 'Walk-Forward Folds');
  }

  // Write workbook to Buffer or Uint8Array
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  return excelBuffer;
}
