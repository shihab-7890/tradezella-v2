'use client';

import { memo, useState } from 'react';
import { CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Scale,
  Crosshair,
  Lock,
  Layers,
  Activity,
  History,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

const toNum = (val, fallback = 0) => {
  if (val === undefined || val === null) return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
};

const fmtNum = (val, digits = 2, fallback = '0.00') => {
  if (val === undefined || val === null) return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(digits) : fallback;
};

export const RiskManagementPanel = memo(function RiskManagementPanel({
  simulatedAccount,
  riskDiagnostics,
  tradePlans = [],
  symbol = 'XAUUSD',
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'trades' | 'lifecycle' | 'specs'

  if (!simulatedAccount && !riskDiagnostics) {
    return (
      <CardContent className="p-4 text-xs text-muted-foreground">
        Load market data to inspect dynamic risk management and simulated execution.
      </CardContent>
    );
  }

  const account = simulatedAccount || {};
  const balance = toNum(account.balance, 10000);
  const equity = toNum(account.equity, balance);
  const peakEquity = toNum(account.peakEquity, balance);
  const currentDrawdownPct = toNum(account.currentDrawdownPct, 0);
  const dailyRealizedPnl = toNum(account.dailyRealizedPnl, 0);
  const weeklyRealizedPnl = toNum(account.weeklyRealizedPnl, 0);
  const openPositionsCount = toNum(account.openPositionsCount, 0);
  const consecutiveLosses = toNum(account.consecutiveLosses, 0);

  const diag = riskDiagnostics || {};
  const execMetrics = diag.executionMetrics || {};

  const netRealizedPnl = toNum(diag.netRealizedPnl ?? execMetrics.netMonetaryPnl, 0);
  const netPnlR = toNum(diag.netPnlR ?? execMetrics.netPnlR, 0);
  const winRate = toNum(diag.winRate ?? execMetrics.winRate, 0);
  const profitFactor = (diag.profitFactor === Infinity || execMetrics.profitFactor === Infinity)
    ? Infinity
    : toNum(diag.profitFactor ?? execMetrics.profitFactor, 1.0);
  const expectancy = toNum(diag.expectancy ?? execMetrics.expectancyR, 0);

  const closedTpTrades = toNum(diag.closedTpTrades ?? execMetrics.wins, 0);
  const closedSlTrades = toNum(diag.closedSlTrades ?? execMetrics.losses, 0);
  const closedTrailingTrades = toNum(diag.closedTrailingTrades ?? execMetrics.trailingUpdatesCount, 0);

  const totalEvaluated = toNum(diag.totalEvaluated ?? diag.totalPlans, (tradePlans || []).length);
  const approvedTrades = toNum(diag.approvedTrades ?? diag.approvedPlans, 0);

  const executedList = (tradePlans || []).filter(
    t => t && t.status && !t.status.includes('REJECTED')
  );

  return (
    <CardContent className="p-4 text-xs space-y-4">
      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b pb-2">
        <Button
          variant={activeTab === 'overview' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs font-medium"
          onClick={() => setActiveTab('overview')}
        >
          <Scale className="w-3.5 h-3.5 mr-1" />
          Risk Overview & Capital
        </Button>
        <Button
          variant={activeTab === 'trades' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs font-medium"
          onClick={() => setActiveTab('trades')}
        >
          <History className="w-3.5 h-3.5 mr-1" />
          Simulated Trades ({executedList.length})
        </Button>
        <Button
          variant={activeTab === 'lifecycle' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs font-medium"
          onClick={() => setActiveTab('lifecycle')}
        >
          <Activity className="w-3.5 h-3.5 mr-1" />
          Break-Even & Trailing Stops
        </Button>
        <Button
          variant={activeTab === 'specs' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs font-medium"
          onClick={() => setActiveTab('specs')}
        >
          <Layers className="w-3.5 h-3.5 mr-1" />
          Instrument Specs & Safeguards
        </Button>
      </div>

      {/* TAB 1: OVERVIEW & CAPITAL */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Top Capital & Balance Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-2.5 rounded-xl border bg-muted/30">
              <div className="text-muted-foreground font-medium flex items-center justify-between">
                <span>Account Balance</span>
                <DollarSign className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="text-lg font-bold text-foreground mt-1">
                ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                <span>Equity: <strong>${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border bg-muted/30">
              <div className="text-muted-foreground font-medium flex items-center justify-between">
                <span>Net Realized PnL</span>
                {netRealizedPnl >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                )}
              </div>
              <div className={`text-lg font-bold mt-1 ${netRealizedPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {netRealizedPnl >= 0 ? `+$${fmtNum(netRealizedPnl, 2)}` : `-$${fmtNum(Math.abs(netRealizedPnl), 2)}`}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Total R-Multiple: <strong className={netPnlR >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                  {netPnlR >= 0 ? `+${fmtNum(netPnlR, 2)}R` : `${fmtNum(netPnlR, 2)}R`}
                </strong>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border bg-muted/30">
              <div className="text-muted-foreground font-medium flex items-center justify-between">
                <span>Simulated Win Rate</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-lg font-bold text-foreground mt-1">
                {winRate}%
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                TP: {closedTpTrades} | SL: {closedSlTrades} | Trail: {closedTrailingTrades}
              </div>
            </div>

            <div className="p-2.5 rounded-xl border bg-muted/30">
              <div className="text-muted-foreground font-medium flex items-center justify-between">
                <span>Max Drawdown</span>
                <ShieldAlert className={`w-3.5 h-3.5 ${currentDrawdownPct > 5 ? 'text-rose-500' : 'text-amber-500'}`} />
              </div>
              <div className={`text-lg font-bold mt-1 ${currentDrawdownPct > 5 ? 'text-rose-500' : 'text-foreground'}`}>
                {fmtNum(currentDrawdownPct, 2)}%
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Peak: ${fmtNum(peakEquity, 2)} | Max Cap: 10.0%
              </div>
            </div>
          </div>

          {/* Performance & Safeguards Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Column 1: Performance Ratios */}
            <div className="p-3 rounded-xl border bg-card/60 space-y-2">
              <div className="font-semibold text-foreground flex items-center justify-between">
                <span>Statistical Performance</span>
                <Badge variant="outline" className="text-[10px]">Phase 8 Metrics</Badge>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Profit Factor</span>
                  <span className="font-semibold text-foreground">
                    {profitFactor === Infinity ? '∞' : fmtNum(profitFactor, 2)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Expectancy per Trade</span>
                  <span className={`font-semibold ${expectancy >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    ${fmtNum(expectancy, 2)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Total Evaluated Setups</span>
                  <span className="font-semibold text-foreground">{totalEvaluated}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Approved by Risk Engine</span>
                  <span className="font-semibold text-emerald-500">
                    {approvedTrades} ({totalEvaluated > 0 ? ((approvedTrades / totalEvaluated) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Column 2: Style Breakdown */}
            <div className="p-3 rounded-xl border bg-card/60 space-y-2">
              <div className="font-semibold text-foreground flex items-center justify-between">
                <span>Performance by Style</span>
                <Badge variant="outline" className="text-[10px]">Independent Decoupled</Badge>
              </div>
              <div className="space-y-2">
                {['Scalping', 'Intraday', 'Swing'].map(st => {
                  const data = diag.breakdownByStyle?.[st] || diag.styleBreakdown?.[st] || {};
                  const tradesCount = toNum(data.trades ?? data.count, 0);
                  const winsCount = toNum(data.wins, 0);
                  const styleWinRate = toNum(data.winRate, tradesCount > 0 ? (winsCount / tradesCount) * 100 : 0);
                  const stylePnlR = toNum(data.netPnlR ?? data.pnlR, 0);

                  return (
                    <div key={st} className="p-2 rounded-lg bg-muted/40 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-medium text-foreground">{st}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {tradesCount} trades ({winsCount} wins)
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-foreground">{fmtNum(styleWinRate, 0)}%</div>
                        <div className={`text-[10px] font-semibold ${stylePnlR >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {stylePnlR >= 0 ? `+${fmtNum(stylePnlR, 1)}R` : `${fmtNum(stylePnlR, 1)}R`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Column 3: Circuit Breaker Status */}
            <div className="p-3 rounded-xl border bg-card/60 space-y-2">
              <div className="font-semibold text-foreground flex items-center justify-between">
                <span>Portfolio Safeguards</span>
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground">Daily Loss Circuit Breaker</span>
                  <Badge variant={dailyRealizedPnl < -300 ? 'destructive' : 'secondary'} className="text-[10px]">
                    {dailyRealizedPnl < -300 ? 'HALTED (≥3%)' : 'NORMAL (≤3%)'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground">Weekly Loss Limit</span>
                  <Badge variant={weeklyRealizedPnl < -600 ? 'destructive' : 'secondary'} className="text-[10px]">
                    {weeklyRealizedPnl < -600 ? 'HALTED (≥6%)' : 'NORMAL (≤6%)'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground">Concurrent Positions</span>
                  <span className="font-semibold text-foreground">{openPositionsCount} / 3 Max</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground">Consecutive Losses</span>
                  <span className="font-semibold text-foreground">{consecutiveLosses} losses</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SIMULATED TRADES */}
      {activeTab === 'trades' && (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Realistic trade execution modeling bid/ask spread, slippage, and multi-stage exits.</span>
            <span>Showing {executedList.length} trades</span>
          </div>

          {executedList.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border rounded-xl bg-card/40">
              No executed trades recorded yet. Ensure market data is loaded and signals meet confluence thresholds.
            </div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
              {executedList.map((trade, idx) => {
                const isBuy = trade.direction === 'BUY';
                const tradePnl = toNum(trade.realizedPnl ?? trade.pnl, 0);
                const isWin = tradePnl > 0;
                const tradeR = trade.realizedR !== undefined && trade.realizedR !== null
                  ? toNum(trade.realizedR)
                  : (trade.pnlR !== undefined && trade.pnlR !== null ? toNum(trade.pnlR) : null);

                return (
                  <div
                    key={trade.id || idx}
                    className="p-3 rounded-xl border bg-card/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={isBuy ? 'default' : 'destructive'}
                        className={`text-xs px-2 py-0.5 font-bold ${isBuy ? 'bg-emerald-600 hover:bg-emerald-600' : 'bg-rose-600 hover:bg-rose-600'}`}
                      >
                        {trade.direction || 'BUY'}
                      </Badge>
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <span>{trade.symbol || symbol}</span>
                          <span className="text-muted-foreground text-[10px] font-normal">
                            {trade.time ? new Date(trade.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                          </span>
                          <Badge variant="outline" className="text-[10px] py-0">
                            {trade.tradingStyle || 'Intraday'}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                          <span>Entry: <strong>{fmtNum(trade.entryPrice || trade.price, 2)}</strong></span>
                          <span>SL: <strong className="text-rose-400">{fmtNum(trade.sl, 2)}</strong></span>
                          <span>TP1: <strong className="text-emerald-400">{fmtNum(trade.tp1 || trade.tp, 2)}</strong></span>
                          <span>TP2: <strong className="text-emerald-400">{fmtNum(trade.tp2 || trade.tp, 2)}</strong></span>
                          <span>Lots: <strong>{fmtNum(trade.totalLots || trade.lots, 2)}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-3 sm:flex-col sm:items-end">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold ${
                            trade.status === 'CLOSED_TP' || trade.status === 'CLOSED_TRAILING'
                              ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                              : trade.status === 'CLOSED_SL'
                              ? 'border-rose-500/50 text-rose-400 bg-rose-500/10'
                              : 'border-muted-foreground/30 text-muted-foreground'
                          }`}
                        >
                          {String(trade.status || 'OPEN').replace('CLOSED_', '')}
                        </Badge>
                      </div>
                      <div>
                        <span className={`font-bold text-sm ${isWin ? 'text-emerald-500' : tradePnl < 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>
                          {tradePnl >= 0 ? `+$${fmtNum(tradePnl, 2)}` : `-$${fmtNum(Math.abs(tradePnl), 2)}`}
                        </span>
                        {tradeR !== null && (
                          <span className="text-[10px] text-muted-foreground ml-1.5 font-medium">
                            ({tradeR >= 0 ? `+${fmtNum(tradeR, 2)}R` : `${fmtNum(tradeR, 2)}R`})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LIFECYCLE & BREAK-EVEN */}
      {activeTab === 'lifecycle' && (
        <div className="space-y-4">
          <div className="p-3 rounded-xl border bg-card/60 space-y-2">
            <div className="font-semibold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-primary" />
                Dynamic Break-Even & Trailing Stop Engine
              </span>
              <Badge variant="outline" className="text-[10px]">Ratchet Lock Enforced</Badge>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              When price achieves +1R profit or fills Target 1 (TP1), the stop loss automatically ratchets to the breakeven level
              plus a cost buffer (spread + 2 pips slippage friction). Once ratcheted, the stop loss never loosens.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border bg-muted/30 space-y-2">
              <div className="font-semibold text-foreground">Multi-Target Allocation Model</div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center p-2 rounded-lg bg-card/60">
                  <div>
                    <span className="font-bold text-emerald-400">TP1 (40% Position)</span>
                    <div className="text-[10px] text-muted-foreground">Initial quick momentum scale-out</div>
                  </div>
                  <span className="font-semibold text-foreground">1.50R Target</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-card/60">
                  <div>
                    <span className="font-bold text-teal-400">TP2 (35% Position)</span>
                    <div className="text-[10px] text-muted-foreground">Structural target level</div>
                  </div>
                  <span className="font-semibold text-foreground">2.50R Target</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-card/60">
                  <div>
                    <span className="font-bold text-sky-400">TP3 (25% Runner)</span>
                    <div className="text-[10px] text-muted-foreground">Trailing runner with momentum lock</div>
                  </div>
                  <span className="font-semibold text-foreground">4.00R Target</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl border bg-muted/30 space-y-2">
              <div className="font-semibold text-foreground">Trailing Stop Configurations</div>
              <div className="space-y-1.5 text-xs">
                <div className="p-2 rounded-lg bg-card/60">
                  <div className="flex justify-between font-medium">
                    <span>ATR Trailing Stop</span>
                    <span className="text-primary font-semibold">1.5 × ATR(14)</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Trails behind highest high (BUY) or lowest low (SELL) dynamically.
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-card/60">
                  <div className="flex justify-between font-medium">
                    <span>Structural Trailing</span>
                    <span className="text-teal-400 font-semibold">Swing Pivots</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Steps to consecutive higher swing lows / lower swing highs.
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-card/60">
                  <div className="flex justify-between font-medium">
                    <span>Momentum Exhaustion Tightener</span>
                    <span className="text-amber-400 font-semibold">Automatic</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Compresses trailing buffer by 50% when exhaustion is detected.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SPECS & SAFEGUARDS */}
      {activeTab === 'specs' && (
        <div className="space-y-4">
          <div className="p-3 rounded-xl border bg-card/60 space-y-2">
            <div className="font-semibold text-foreground flex items-center justify-between">
              <span>Instrument Registry & Specification</span>
              <Badge variant="outline" className="text-[10px]">Real Contract Mechanics</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-muted/40">
                <div className="text-[10px] text-muted-foreground">Selected Instrument</div>
                <div className="font-bold text-foreground text-sm mt-0.5">{symbol}</div>
              </div>
              <div className="p-2 rounded-lg bg-muted/40">
                <div className="text-[10px] text-muted-foreground">Contract Size</div>
                <div className="font-bold text-foreground text-sm mt-0.5">
                  {symbol.includes('XAU') ? '100 oz / lot' : '100,000 units'}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-muted/40">
                <div className="text-[10px] text-muted-foreground">Lot Step Floor</div>
                <div className="font-bold text-foreground text-sm mt-0.5">0.01 Lots (Strict)</div>
              </div>
              <div className="p-2 rounded-lg bg-muted/40">
                <div className="text-[10px] text-muted-foreground">Point Value / Lot</div>
                <div className="font-bold text-foreground text-sm mt-0.5">
                  {symbol.includes('XAU') ? '$100.00 / pt' : '$10.00 / pip'}
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl border bg-card/60 space-y-2">
            <div className="font-semibold text-foreground flex items-center justify-between">
              <span>Rejection Diagnostics</span>
              <Badge variant="secondary" className="text-[10px]">Zero Unprotected Trades</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(diag.rejectionsByReason || diag.rejectionReasons || {}).map(([reason, count]) => (
                <div key={reason} className="p-2 rounded-lg bg-muted/30 border border-muted flex justify-between items-center text-xs">
                  <span className="text-muted-foreground truncate mr-2" title={reason}>{reason}</span>
                  <Badge variant="outline" className="text-[10px] font-bold">{count}</Badge>
                </div>
              ))}
              {Object.keys(diag.rejectionsByReason || diag.rejectionReasons || {}).length === 0 && (
                <div className="col-span-3 text-center text-muted-foreground py-2 text-xs">
                  No risk engine rejections encountered.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </CardContent>
  );
});
