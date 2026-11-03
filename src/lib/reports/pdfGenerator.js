/**
 * Phase 10 — Printable HTML/PDF Report Generator
 * Generates structured, responsive HTML documents styled for PDF conversion and printing.
 */

export function generatePdfHtmlReport(backtestRun, options = {}) {
  const { metrics, provenance, tradeLog, walkForwardResult, optimizationResult } = backtestRun;
  const title = options.reportTitle || 'TradeZella Institutional Strategy Research & Backtest Report';

  const tradesList = (tradeLog || []).slice(0, 50); // Top 50 trades in PDF report table

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 12px; color: #1e293b; background: #ffffff; margin: 0; padding: 20px; line-height: 1.5; }
    .header { border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
    .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
    .meta-badge { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 12px; font-size: 11px; text-align: right; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
    .kpi-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600; }
    .kpi-val { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 2px; }
    .kpi-val.positive { color: #16a34a; }
    .kpi-val.negative { color: #dc2626; }
    .section-heading { font-size: 14px; font-weight: 700; color: #0f172a; border-left: 3px solid #3b82f6; padding-left: 8px; margin: 20px 0 10px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
    th { background: #f1f5f9; color: #475569; text-align: left; padding: 8px; font-weight: 600; border-bottom: 1px solid #cbd5e1; }
    td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
    .badge-buy { background: #dcfce7; color: #15803d; }
    .badge-sell { background: #fee2e2; color: #b91c1c; }
    .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; pt-10px; font-size: 10px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">${title}</h1>
      <div class="subtitle">Symbol: <strong>${provenance?.symbol || 'XAUUSD'}</strong> | Timeframe: <strong>${provenance?.timeframe || '15m'}</strong> | Period: <strong>${provenance?.dateRange?.from || ''} to ${provenance?.dateRange?.to || ''}</strong></div>
    </div>
    <div class="meta-badge">
      <div>Run ID: <strong>${backtestRun.runId || 'N/A'}</strong></div>
      <div>Generated: ${new Date().toLocaleDateString()}</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Net Profit / Loss</div>
      <div class="kpi-val ${(metrics?.netPnl || 0) >= 0 ? 'positive' : 'negative'}">$${(metrics?.netPnl || 0).toLocaleString()}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Win Rate</div>
      <div class="kpi-val">${metrics?.totalTrades > 0 ? `${metrics.winRate}%` : 'N/A'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Profit Factor</div>
      <div class="kpi-val">${metrics?.totalTrades > 0 ? metrics.profitFactor : 'N/A'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Max Drawdown</div>
      <div class="kpi-val negative">${metrics?.totalTrades > 0 ? `${metrics.maxDrawdownPct}%` : 'N/A'}</div>
    </div>
  </div>

  <div class="section-heading">Financial & Risk Performance Summary</div>
  <table>
    <thead>
      <tr>
        <th>Metric</th>
        <th>Value</th>
        <th>Metric</th>
        <th>Value</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Total Executed Trades</td>
        <td><strong>${metrics?.totalTrades || 0}</strong></td>
        <td>Net Expectancy / Trade</td>
        <td><strong>$${metrics?.netExpectancy || 0}</strong></td>
      </tr>
      <tr>
        <td>Winning / Losing Trades</td>
        <td>${metrics?.winningTrades || 0} / ${metrics?.losingTrades || 0}</td>
        <td>Average Win / Loss</td>
        <td>$${metrics?.avgProfit || 0} / $${metrics?.avgLoss || 0}</td>
      </tr>
      <tr>
        <td>Gross Profit / Loss</td>
        <td>$${metrics?.grossProfit || 0} / $${metrics?.grossLoss || 0}</td>
        <td>Average R-Multiple</td>
        <td><strong>${metrics?.avgR || 0}R</strong></td>
      </tr>
      <tr>
        <td>Sharpe Ratio</td>
        <td>${metrics?.sharpeRatio || 0}</td>
        <td>Sortino Ratio</td>
        <td>${metrics?.sortinoRatio || 0}</td>
      </tr>
      <tr>
        <td>Total Execution Costs</td>
        <td>$${metrics?.totalCosts || 0}</td>
        <td>Max Streak Wins / Losses</td>
        <td>${metrics?.maxStreakWins || 0} / ${metrics?.maxStreakLosses || 0}</td>
      </tr>
    </tbody>
  </table>

  <div class="section-heading">BUY vs SELL Independent Performance</div>
  <table>
    <thead>
      <tr>
        <th>Direction</th>
        <th>Total Trades</th>
        <th>Win Rate (%)</th>
        <th>Net PnL ($)</th>
        <th>Profit Factor</th>
        <th>Expectancy ($)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><span class="badge badge-buy">BUY</span></td>
        <td>${metrics?.buyStats?.totalTrades || 0}</td>
        <td>${metrics?.buyStats?.winRate || 0}%</td>
        <td>$${metrics?.buyStats?.netPnl || 0}</td>
        <td>${metrics?.buyStats?.profitFactor || 0}</td>
        <td>$${metrics?.buyStats?.expectancy || 0}</td>
      </tr>
      <tr>
        <td><span class="badge badge-sell">SELL</span></td>
        <td>${metrics?.sellStats?.totalTrades || 0}</td>
        <td>${metrics?.sellStats?.winRate || 0}%</td>
        <td>$${metrics?.sellStats?.netPnl || 0}</td>
        <td>${metrics?.sellStats?.profitFactor || 0}</td>
        <td>$${metrics?.sellStats?.expectancy || 0}</td>
      </tr>
    </tbody>
  </table>

  ${walkForwardResult ? `
  <div class="section-heading">Walk-Forward Validation Summary</div>
  <table>
    <thead>
      <tr>
        <th>Fold</th>
        <th>Train Window</th>
        <th>Test Window (OOS)</th>
        <th>Train Win Rate</th>
        <th>OOS Win Rate</th>
        <th>OOS Net PnL</th>
      </tr>
    </thead>
    <tbody>
      ${(walkForwardResult.folds || []).map(f => `
        <tr>
          <td>Fold ${f.foldIndex}</td>
          <td>${new Date(f.trainRange.from).toLocaleDateString()} - ${new Date(f.trainRange.to).toLocaleDateString()}</td>
          <td>${new Date(f.testRange.from).toLocaleDateString()} - ${new Date(f.testRange.to).toLocaleDateString()}</td>
          <td>${f.trainMetrics.winRate}%</td>
          <td><strong>${f.testMetrics.winRate}%</strong></td>
          <td>$${f.testMetrics.netPnl}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  <div class="section-heading">Recent Executed Trades Log (Top 50)</div>
  <table>
    <thead>
      <tr>
        <th>Time</th>
        <th>Type</th>
        <th>Price</th>
        <th>Style</th>
        <th>Score</th>
        <th>Grade</th>
        <th>Realized PnL</th>
      </tr>
    </thead>
    <tbody>
      ${tradesList.map(t => `
        <tr>
          <td>${new Date(t.time || t.entryTime).toLocaleString()}</td>
          <td><span class="badge ${String(t.direction || t.type).includes('BUY') ? 'badge-buy' : 'badge-sell'}">${t.decision || t.direction || t.type}</span></td>
          <td>${Number(t.price).toFixed(2)}</td>
          <td>${t.tradingStyle || 'Intraday'}</td>
          <td>${t.unifiedScore !== undefined ? t.unifiedScore : (t.score ? Math.round(t.score * 10) : '-')}</td>
          <td>${t.qualityTier || 'B'}</td>
          <td style="color: ${Number(t.realizedPnl || 0) >= 0 ? '#16a34a' : '#dc2626'}; font-weight: bold;">
            $${Number(t.realizedPnl || 0).toFixed(2)}
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    TradeZella Quantitative Backtest Report &copy; ${new Date().getFullYear()} — Confidential Research Document.
  </div>
</body>
</html>
  `;
}
