/**
 * Phase 10 — Multi-Format Report ZIP Packager
 * Uses 'jszip' to create downloadable report packages containing PDF/HTML, Excel, CSV, JSON, and Manifests.
 */

import JSZip from 'jszip';
import { generateExcelWorkbook } from './excelGenerator';
import { generatePdfHtmlReport } from './pdfGenerator';
import { exportTradesToCsv } from './csvExporter';

export async function createReportZipPackage(backtestRun, options = {}) {
  const zip = new JSZip();
  const symbol = backtestRun.provenance?.symbol || 'XAUUSD';
  const dateStr = new Date().toISOString().split('T')[0];

  // 1. Add HTML Report
  const htmlContent = generatePdfHtmlReport(backtestRun, options);
  zip.file(`TradeZella_${symbol}_Report_${dateStr}.html`, htmlContent);

  // 2. Add Excel Workbook
  const excelBuffer = generateExcelWorkbook(backtestRun, options);
  zip.file(`TradeZella_${symbol}_Workbook_${dateStr}.xlsx`, excelBuffer);

  // 3. Add Trades CSV
  const csvContent = exportTradesToCsv(backtestRun.tradeLog || []);
  zip.file(`TradeZella_${symbol}_Trades_${dateStr}.csv`, csvContent);

  // 4. Add Backtest Run JSON
  const jsonContent = JSON.stringify(backtestRun, null, 2);
  zip.file(`TradeZella_${symbol}_BacktestRun_${dateStr}.json`, jsonContent);

  // 5. Add Manifest
  const manifestText = `
TradeZella Institutional Backtest Package Manifest
=================================================
Run ID: ${backtestRun.runId}
Generated At: ${new Date().toISOString()}
Symbol: ${symbol}
Timeframe: ${backtestRun.provenance?.timeframe || '15m'}
Trading Style: ${backtestRun.provenance?.tradingStyle || 'Intraday'}
Total Trades: ${backtestRun.metrics?.totalTrades || 0}
Net PnL: $${backtestRun.metrics?.netPnl || 0}
Win Rate: ${backtestRun.metrics?.winRate || 0}%

Package Contents:
- TradeZella_${symbol}_Report_${dateStr}.html (Printable PDF/HTML Report)
- TradeZella_${symbol}_Workbook_${dateStr}.xlsx (Excel Workbook)
- TradeZella_${symbol}_Trades_${dateStr}.csv (Executed Trades Log)
- TradeZella_${symbol}_BacktestRun_${dateStr}.json (Complete JSON Snapshot)
`;
  zip.file('MANIFEST.txt', manifestText.trim());

  // Generate ZIP Uint8Array / Buffer
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  return zipBuffer;
}
