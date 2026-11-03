'use client';

import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Play, Layers, TrendingUp, ShieldAlert, BarChart3, SlidersHorizontal, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { executeBacktestRun } from '@/lib/backtest/backtestEngine';

export function BacktestingDashboard({ candles = [], config = {}, settings = {}, onRunComplete }) {
  const [backtestMode, setBacktestMode] = useState('STANDARD'); // 'STANDARD' | 'WALK_FORWARD' | 'OPTIMIZATION'
  const [tradingStyle, setTradingStyle] = useState('All'); // 'Scalping' | 'Intraday' | 'Swing' | 'All'
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [backtestRun, setBacktestRun] = useState(null);

  const handleExecuteBacktest = useCallback(async () => {
    setIsEvaluating(true);
    try {
      const runResult = await executeBacktestRun(candles, {
        symbol: config.symbol || 'XAU/USD',
        timeframe: config.timeframe || '15m',
        tradingStyle,
        backtestMode,
        settings,
        config,
        includeWalkForward: backtestMode === 'WALK_FORWARD',
        includeOptimization: backtestMode === 'OPTIMIZATION',
      });

      setBacktestRun(runResult);
      if (onRunComplete) {
        onRunComplete(runResult);
      }
    } catch (err) {
      console.error('Backtest Execution Failed:', err);
    } finally {
      setIsEvaluating(false);
    }
  }, [candles, config, settings, tradingStyle, backtestMode, onRunComplete]);

  const metrics = backtestRun?.metrics;
  const walkForward = backtestRun?.walkForwardResult;
  const optimization = backtestRun?.optimizationResult;

  return (
    <div className="flex flex-col gap-4 p-4 bg-card/50 rounded-2xl border">
      {/* Top Backtesting Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-card rounded-xl border">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Mode:</span>
            <Select value={backtestMode} onValueChange={setBacktestMode}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STANDARD">Standard Backtest</SelectItem>
                <SelectItem value="WALK_FORWARD">Walk-Forward Validation</SelectItem>
                <SelectItem value="OPTIMIZATION">Strategy Optimization</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Style:</span>
            <Select value={tradingStyle} onValueChange={setTradingStyle}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Styles</SelectItem>
                <SelectItem value="Scalping">Scalping</SelectItem>
                <SelectItem value="Intraday">Intraday</SelectItem>
                <SelectItem value="Swing">Swing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button 
          onClick={handleExecuteBacktest} 
          disabled={isEvaluating || candles.length === 0}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
        >
          <Play className={`mr-2 h-4 w-4 ${isEvaluating ? 'animate-spin' : ''}`} />
          {isEvaluating ? 'Simulating Historical Run...' : 'Run Quantitative Backtest'}
        </Button>
      </div>

      {/* Backtest Run Results Dashboard */}
      {backtestRun ? (
        <div className="flex flex-col gap-4">
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-card/80 border p-3">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">Net Profit / Loss</span>
              <div className={`text-xl font-bold mt-1 ${metrics?.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ${metrics?.netPnl?.toLocaleString() || 0}
              </div>
              <span className="text-[10px] text-muted-foreground">Profit Factor: {metrics?.profitFactor || 0}</span>
            </Card>

            <Card className="bg-card/80 border p-3">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">Win Rate (%)</span>
              <div className="text-xl font-bold mt-1 text-foreground">
                {metrics?.winRate || 0}%
              </div>
              <span className="text-[10px] text-muted-foreground">{metrics?.winningTrades || 0} W / {metrics?.losingTrades || 0} L ({metrics?.totalTrades || 0} Trades)</span>
            </Card>

            <Card className="bg-card/80 border p-3">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">Net Expectancy</span>
              <div className="text-xl font-bold mt-1 text-primary">
                ${metrics?.netExpectancy || 0}
              </div>
              <span className="text-[10px] text-muted-foreground">Avg R: {metrics?.avgR || 0}R / trade</span>
            </Card>

            <Card className="bg-card/80 border p-3">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">Max Drawdown</span>
              <div className="text-xl font-bold mt-1 text-amber-400">
                {metrics?.maxDrawdownPct || 0}%
              </div>
              <span className="text-[10px] text-muted-foreground">Sharpe: {metrics?.sharpeRatio || 0} | Sortino: {metrics?.sortinoRatio || 0}</span>
            </Card>
          </div>

          {/* Detailed Analytics Tabs */}
          <Tabs defaultValue="performance" className="w-full">
            <TabsList className="grid grid-cols-4 w-full h-9 text-xs">
              <TabsTrigger value="performance">Performance & BUY/SELL</TabsTrigger>
              <TabsTrigger value="walkforward" disabled={!walkForward}>Walk-Forward Folds</TabsTrigger>
              <TabsTrigger value="optimization" disabled={!optimization}>Optimization Trials</TabsTrigger>
              <TabsTrigger value="trades">Executed Trades ({metrics?.totalTrades || 0})</TabsTrigger>
            </TabsList>

            <TabsContent value="performance" className="p-3 bg-card border rounded-xl mt-2 flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* BUY Analysis */}
                <div className="p-3 rounded-lg border bg-emerald-500/5 border-emerald-500/20">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-xs text-emerald-400">BUY Signals & Executions</span>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                      {metrics?.buyStats?.totalTrades || 0} Trades
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>Win Rate: <strong className="text-foreground">{metrics?.buyStats?.winRate || 0}%</strong></div>
                    <div>Net PnL: <strong className="text-emerald-400">${metrics?.buyStats?.netPnl || 0}</strong></div>
                    <div>Profit Factor: <strong className="text-foreground">{metrics?.buyStats?.profitFactor || 0}</strong></div>
                    <div>Expectancy: <strong className="text-foreground">${metrics?.buyStats?.expectancy || 0}</strong></div>
                  </div>
                </div>

                {/* SELL Analysis */}
                <div className="p-3 rounded-lg border bg-rose-500/5 border-rose-500/20">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-xs text-rose-400">SELL Signals & Executions</span>
                    <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/30 text-[10px]">
                      {metrics?.sellStats?.totalTrades || 0} Trades
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>Win Rate: <strong className="text-foreground">{metrics?.sellStats?.winRate || 0}%</strong></div>
                    <div>Net PnL: <strong className="text-rose-400">${metrics?.sellStats?.netPnl || 0}</strong></div>
                    <div>Profit Factor: <strong className="text-foreground">{metrics?.sellStats?.profitFactor || 0}</strong></div>
                    <div>Expectancy: <strong className="text-foreground">${metrics?.sellStats?.expectancy || 0}</strong></div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="walkforward" className="p-3 bg-card border rounded-xl mt-2">
              {walkForward ? (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">OOS Efficiency Ratio:</span>
                      <Badge variant="outline" className={`text-xs ${walkForward.oosEfficiencyRatio >= 0.7 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}`}>
                        {walkForward.oosEfficiencyRatio} ({walkForward.parameterStability})
                      </Badge>
                    </div>
                  </div>

                  {walkForward.warnings && walkForward.warnings.length > 0 && (
                    <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>{walkForward.warnings[0]}</span>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="border-b bg-muted/40">
                        <tr>
                          <th className="p-2">Fold</th>
                          <th className="p-2">In-Sample Train Range</th>
                          <th className="p-2">Out-Of-Sample Test Range</th>
                          <th className="p-2">Train Win %</th>
                          <th className="p-2">OOS Win %</th>
                          <th className="p-2">OOS Net PnL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {walkForward.folds.map(f => (
                          <tr key={f.foldIndex} className="border-b hover:bg-muted/20">
                            <td className="p-2 font-bold">Fold {f.foldIndex}</td>
                            <td className="p-2 text-muted-foreground">{new Date(f.trainRange.from).toLocaleDateString()} - {new Date(f.trainRange.to).toLocaleDateString()}</td>
                            <td className="p-2 text-muted-foreground">{new Date(f.testRange.from).toLocaleDateString()} - {new Date(f.testRange.to).toLocaleDateString()}</td>
                            <td className="p-2">{f.trainMetrics.winRate}%</td>
                            <td className="p-2 font-bold">{f.testMetrics.winRate}%</td>
                            <td className={`p-2 font-bold ${f.testMetrics.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>${f.testMetrics.netPnl}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="optimization" className="p-3 bg-card border rounded-xl mt-2">
              {optimization ? (
                <div className="flex flex-col gap-3">
                  <div className="p-2.5 rounded border bg-card/60 flex justify-between items-center text-xs">
                    <span>Best Parameter Combination: <strong className="text-emerald-400">{JSON.stringify(optimization.bestTrial?.params)}</strong></span>
                    <span>Expectancy Gain: <strong className="text-emerald-400">+${optimization.comparison?.expectancyGain}</strong></span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="border-b bg-muted/40">
                        <tr>
                          <th className="p-2">Trial</th>
                          <th className="p-2">Parameter Set</th>
                          <th className="p-2">Trades</th>
                          <th className="p-2">Win Rate</th>
                          <th className="p-2">Expectancy</th>
                          <th className="p-2">Profit Factor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {optimization.trials.map((t, idx) => (
                          <tr key={t.trialId} className={`border-b ${t.trialId === optimization.bestTrial?.trialId ? 'bg-emerald-500/10 font-bold' : 'hover:bg-muted/20'}`}>
                            <td className="p-2">Trial #{idx + 1} {t.isDefault ? '(Default)' : ''}</td>
                            <td className="p-2 font-mono text-[11px]">{JSON.stringify(t.params)}</td>
                            <td className="p-2">{t.metrics.totalTrades}</td>
                            <td className="p-2">{t.metrics.winRate}%</td>
                            <td className="p-2 text-emerald-400">${t.metrics.netExpectancy}</td>
                            <td className="p-2">{t.metrics.profitFactor}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="trades" className="p-3 bg-card border rounded-xl mt-2">
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="border-b bg-muted/40 sticky top-0 bg-card">
                    <tr>
                      <th className="p-2">Time</th>
                      <th className="p-2">Direction</th>
                      <th className="p-2">Entry</th>
                      <th className="p-2">SL / TP</th>
                      <th className="p-2">Grade</th>
                      <th className="p-2">Realized PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(backtestRun.tradeLog || []).map((t, idx) => (
                      <tr key={t.id || idx} className="border-b hover:bg-muted/20">
                        <td className="p-2 font-mono">{new Date(t.time || t.entryTime).toLocaleTimeString()}</td>
                        <td className="p-2 font-bold">{t.decision || t.direction || t.type}</td>
                        <td className="p-2 font-mono">${Number(t.price).toFixed(2)}</td>
                        <td className="p-2 font-mono text-[11px]">${t.sl ? Number(t.sl).toFixed(2) : '-'} / ${t.tp ? Number(t.tp).toFixed(2) : '-'}</td>
                        <td className="p-2">{t.qualityTier || 'B'}</td>
                        <td className={`p-2 font-bold ${Number(t.realizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ${Number(t.realizedPnl || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <div className="p-8 text-center border rounded-xl bg-card/40 text-muted-foreground text-xs">
          Select backtest parameters and click <strong>&quot;Run Quantitative Backtest&quot;</strong> to evaluate historical trading strategy performance.
        </div>
      )}
    </div>
  );
}
