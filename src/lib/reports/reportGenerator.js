/**
 * Phase 10 — Master Report Generation Orchestrator
 * Maps Backtest Run Records to Reports A-J across PDF, Excel, CSV, JSON, HTML, and ZIP formats.
 */

import { generatePdfHtmlReport } from './pdfGenerator';
import { generateExcelWorkbook } from './excelGenerator';
import { exportTradesToCsv } from './csvExporter';
import { createReportZipPackage } from './zipPackager';

export const REPORT_TYPES = [
  { id: 'REPORT_A', name: 'Report A — Complete Backtesting Report', description: 'Executive summary, trade statistics, equity curve, risk analysis, and trade log.' },
  { id: 'REPORT_B', name: 'Report B — Walk-Forward Validation Report', description: 'Chronological fold-by-fold validation, OOS efficiency, and parameter stability.' },
  { id: 'REPORT_C', name: 'Report C — Strategy Comparison Report', description: 'Side-by-side strategy and style performance benchmarks.' },
  { id: 'REPORT_D', name: 'Report D — Signal Quality Report', description: 'BUY/SELL candidates, approval scores, grades, and rejection breakdowns.' },
  { id: 'REPORT_E', name: 'Report E — Risk Management Report', description: 'Position sizing, SL/TP execution, break-even, trailing stops, and drawdown.' },
  { id: 'REPORT_F', name: 'Report F — Scalping Report', description: '1m/3m/5m fast liquidity setups, micro-MSS, and spread cost sensitivity.' },
  { id: 'REPORT_G', name: 'Report G — Intraday Report', description: 'Session structure, breakouts, intraday momentum, and session performance.' },
  { id: 'REPORT_H', name: 'Report H — Swing Report', description: 'HTF structure, major liquidity reversals, and multi-session holding analytics.' },
  { id: 'REPORT_I', name: 'Report I — Optimization Report', description: 'Parameter search trials, objective scoring, and overfitting comparison.' },
  { id: 'REPORT_J', name: 'Report J — Complete Research Report', description: 'All-inclusive quantitative research report incorporating all sections.' },
];

export async function buildReportArtifact(backtestRun, options = {}) {
  const {
    reportType = 'REPORT_A',
    format = 'PDF', // 'PDF' | 'EXCEL' | 'CSV' | 'JSON' | 'HTML' | 'ZIP'
    reportTitle,
  } = options;

  const foundType = REPORT_TYPES.find(r => r.id === reportType) || REPORT_TYPES[0];
  const customTitle = reportTitle || foundType.name;

  let artifact = null;
  let contentType = 'text/html';
  let fileExtension = 'html';

  if (format === 'EXCEL' || format === 'XLSX') {
    artifact = generateExcelWorkbook(backtestRun, { reportTitle: customTitle, ...options });
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    fileExtension = 'xlsx';
  } else if (format === 'CSV') {
    artifact = exportTradesToCsv(backtestRun.tradeLog || []);
    contentType = 'text/csv; charset=utf-8';
    fileExtension = 'csv';
  } else if (format === 'JSON') {
    artifact = JSON.stringify({ reportType, reportTitle: customTitle, backtestRun }, null, 2);
    contentType = 'application/json';
    fileExtension = 'json';
  } else if (format === 'ZIP') {
    artifact = await createReportZipPackage(backtestRun, { reportTitle: customTitle, ...options });
    contentType = 'application/zip';
    fileExtension = 'zip';
  } else { // 'PDF' or 'HTML'
    artifact = generatePdfHtmlReport(backtestRun, { reportTitle: customTitle, ...options });
    contentType = 'text/html; charset=utf-8';
    fileExtension = 'html';
  }

  const symbol = backtestRun.provenance?.symbol?.replace(/[^a-zA-Z0-9]/g, '') || 'XAUUSD';
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `TradeZella_${symbol}_${reportType}_${dateStr}.${fileExtension}`;

  return {
    filename,
    contentType,
    fileExtension,
    artifact,
    reportType,
    reportTitle: customTitle,
    createdAt: new Date().toISOString(),
  };
}
