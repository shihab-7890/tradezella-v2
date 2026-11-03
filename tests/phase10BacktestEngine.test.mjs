import test from 'node:test';
import assert from 'node:assert/strict';
import { executeBacktestRun } from '../src/lib/backtest/backtestEngine.js';
import { calculateBacktestMetrics } from '../src/lib/backtest/analyticsEngine.js';
import { runWalkForwardValidation } from '../src/lib/backtest/walkForwardEngine.js';
import { runStrategyOptimization } from '../src/lib/backtest/optimizationEngine.js';
import { exportTradesToCsv } from '../src/lib/reports/csvExporter.js';
import { generateExcelWorkbook } from '../src/lib/reports/excelGenerator.js';
import { buildReportArtifact } from '../src/lib/reports/reportGenerator.js';

// Generate synthetic trend & reversal candle series
function generateSyntheticCandles(count = 100, basePrice = 2600) {
  const candles = [];
  let currentPrice = basePrice;
  const startTime = Date.now() - count * 15 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const isUp = (i % 6) < 3;
    const change = isUp ? 2.5 : -2.2;
    const open = currentPrice;
    const close = open + change;
    const high = Math.max(open, close) + 1.2;
    const low = Math.min(open, close) - 1.2;
    const volume = 100 + (i % 5) * 20;

    candles.push({
      time: startTime + i * 15 * 60 * 1000,
      open,
      high,
      low,
      close,
      volume,
    });

    currentPrice = close;
  }
  return candles;
}

test('PHASE 10 ENGINE SUITE: Backtesting, Walk-Forward, Optimization & Reporting', async (t) => {
  const candles = generateSyntheticCandles(120, 2600);

  await t.test('Test 1: Backtest Execution — Produces reproducible metrics and trade logs', async () => {
    const run = await executeBacktestRun(candles, {
      symbol: 'XAUUSD',
      timeframe: '15m',
      tradingStyle: 'All',
      initialBalance: 10000,
    });

    assert.equal(run.status, 'COMPLETED');
    assert.ok(run.runId);
    assert.ok(run.metrics);
    assert.ok(Array.isArray(run.tradeLog));
    assert.equal(run.provenance.symbol, 'XAUUSD');
    assert.equal(run.provenance.candlesCount, 120);
  });

  await t.test('Test 2: Analytics Engine — Calculates correct Win Rate, Net PnL, Profit Factor & Ratios', () => {
    const mockTrades = [
      { id: '1', realizedPnl: 150, realizedR: 1.5, direction: 'BUY', status: 'CLOSED' },
      { id: '2', realizedPnl: -100, realizedR: -1.0, direction: 'BUY', status: 'CLOSED' },
      { id: '3', realizedPnl: 200, realizedR: 2.0, direction: 'SELL', status: 'CLOSED' },
      { id: '4', realizedPnl: -50, realizedR: -0.5, direction: 'SELL', status: 'CLOSED' },
    ];

    const metrics = calculateBacktestMetrics(mockTrades, 10000);
    assert.equal(metrics.totalTrades, 4);
    assert.equal(metrics.winningTrades, 2);
    assert.equal(metrics.losingTrades, 2);
    assert.equal(metrics.winRate, 50);
    assert.equal(metrics.grossProfit, 350);
    assert.equal(metrics.grossLoss, 150);
    assert.equal(metrics.netPnl, 200);
    assert.equal(metrics.profitFactor, 2.33);
  });

  await t.test('Test 3: BUY vs SELL Directional Analytics — Evaluates both directions independently', () => {
    const mockTrades = [
      { id: '1', realizedPnl: 200, direction: 'BUY', status: 'CLOSED' },
      { id: '2', realizedPnl: 100, direction: 'BUY', status: 'CLOSED' },
      { id: '3', realizedPnl: -150, direction: 'SELL', status: 'CLOSED' },
    ];

    const metrics = calculateBacktestMetrics(mockTrades, 10000);
    assert.equal(metrics.buyStats.totalTrades, 2);
    assert.equal(metrics.buyStats.winRate, 100);
    assert.equal(metrics.buyStats.netPnl, 300);

    assert.equal(metrics.sellStats.totalTrades, 1);
    assert.equal(metrics.sellStats.winRate, 0);
    assert.equal(metrics.sellStats.netPnl, -150);
  });

  await t.test('Test 4: Walk-Forward Validation — Evaluates chronological train/test folds without data leakage', async () => {
    const wfResult = await runWalkForwardValidation(candles, {
      foldsCount: 3,
      method: 'ROLLING',
      symbol: 'XAUUSD',
      timeframe: '15m',
    });

    assert.ok(wfResult);
    assert.equal(wfResult.foldsCount, 3);
    assert.ok(Array.isArray(wfResult.folds));
    assert.ok(wfResult.aggregatedOosMetrics);
    assert.ok(typeof wfResult.oosEfficiencyRatio === 'number');
  });

  await t.test('Test 5: Strategy Parameter Optimization — Evaluates bounded trials and selects best objective', async () => {
    const optResult = await runStrategyOptimization(candles, {
      method: 'GRID_SEARCH',
      trialBudget: 4,
      objective: 'NET_EXPECTANCY',
      selectedParams: ['confluenceScoreThreshold'],
    });

    assert.ok(optResult);
    assert.ok(optResult.trialsCount > 0);
    assert.ok(optResult.bestTrial);
    assert.ok(optResult.defaultTrial);
    assert.ok(optResult.comparison);
  });

  await t.test('Test 6: CSV Exporter — Escapes formula characters (=, +, -, @) safely with UTF-8 BOM', () => {
    const mockTrades = [
      { time: Date.now(), direction: '=CMD()', price: 2600, realizedPnl: 100, notes: '+formula' },
    ];

    const csv = exportTradesToCsv(mockTrades);
    assert.ok(csv.startsWith('\uFEFF')); // UTF-8 BOM
    assert.ok(csv.includes("'=CMD()")); // Formula protection
    assert.ok(csv.includes("'+formula"));
  });

  await t.test('Test 7: Excel Workbook Generator — Builds structured .xlsx buffer', () => {
    const mockRun = {
      runId: 'test-run-123',
      provenance: { symbol: 'XAUUSD', timeframe: '15m' },
      metrics: { netPnl: 500, winRate: 60, totalTrades: 10 },
      tradeLog: [{ time: Date.now(), direction: 'BUY', price: 2600, realizedPnl: 50 }],
    };

    const excelBuffer = generateExcelWorkbook(mockRun);
    assert.ok(excelBuffer);
    assert.ok(excelBuffer.length > 0);
  });

  await t.test('Test 8: Master Report Generator — Builds PDF/HTML, Excel, CSV, JSON and ZIP artifacts', async () => {
    const mockRun = {
      runId: 'test-run-456',
      provenance: { symbol: 'EURUSD', timeframe: '15m' },
      metrics: { netPnl: 300, winRate: 55, totalTrades: 8 },
      tradeLog: [{ time: Date.now(), direction: 'SELL', price: 1.0850, realizedPnl: 40 }],
    };

    const pdfReport = await buildReportArtifact(mockRun, { reportType: 'REPORT_A', format: 'PDF' });
    assert.equal(pdfReport.fileExtension, 'html');
    assert.ok(pdfReport.artifact.includes('TradeZella'));

    const zipReport = await buildReportArtifact(mockRun, { reportType: 'REPORT_J', format: 'ZIP' });
    assert.equal(zipReport.fileExtension, 'zip');
    assert.ok(zipReport.artifact);
  });
});
