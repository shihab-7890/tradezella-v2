'use client';

import { memo } from 'react';
import { CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award, Zap, TrendingUp, AlertTriangle, ShieldCheck } from 'lucide-react';

export const SignalDiagnosticsPanel = memo(function SignalDiagnosticsPanel({ diagnostics, rankedOpportunities }) {
  if (!diagnostics) {
    return (
      <CardContent className="p-4 text-xs text-muted-foreground">
        Load market data to inspect signal engine diagnostics.
      </CardContent>
    );
  }

  const {
    rawBuyCandidates = 0,
    rawSellCandidates = 0,
    confirmedBuySetups = 0,
    confirmedSellSetups = 0,
    approvedBuy = 0,
    approvedSell = 0,
    duplicatesSuppressed = 0,
    rejectedByScore = 0,
    rejectedByQualityFilter = 0,
    strategyBreakdown = {},
    htfTrendBreakdown = { bullishBars: 0, bearishBars: 0, rangingBars: 0 },
    gradeDistribution = { 'A+': 0, 'A': 0, 'B': 0, 'Watch': 0, 'Low': 0 },
    executionStats = { totalSignals: 0, closedTp: 0, closedSl: 0, expired: 0, winRate: 0, netPnlR: 0, avgR: 0 },
    tradingStyles = { Scalping: 0, Intraday: 0, Swing: 0 },
    conflicts = { totalConflicts: 0, sameSetupOpposite: 0, crossTimeframe: 0, waitDecisions: 0 },
  } = diagnostics;

  return (
    <CardContent className="p-4 text-xs space-y-4">
      {/* Top summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-2.5 rounded-xl border bg-muted/30">
          <div className="text-muted-foreground font-medium flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Approved Setups
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-emerald-500 font-bold text-sm">BUY: {approvedBuy}</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-rose-500 font-bold text-sm">SELL: {approvedSell}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Total Approved: {approvedBuy + approvedSell}
          </div>
        </div>

        <div className="p-2.5 rounded-xl border bg-muted/30">
          <div className="text-muted-foreground font-medium flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-500" />
            Execution Win Rate
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-foreground font-bold text-sm">{executionStats.winRate}%</span>
            <span className={`text-[11px] font-semibold ${executionStats.netPnlR >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {executionStats.netPnlR >= 0 ? `+${executionStats.netPnlR}R` : `${executionStats.netPnlR}R`}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            TP: {executionStats.closedTp} | SL: {executionStats.closedSl} | Exp: {executionStats.expired}
          </div>
        </div>

        <div className="p-2.5 rounded-xl border bg-muted/30">
          <div className="text-muted-foreground font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
            Suppressed & Conflicts
          </div>
          <div className="font-semibold text-foreground text-sm mt-1">
            {duplicatesSuppressed} duplicates
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Conflicts: {conflicts.totalConflicts} | Wait: {conflicts.waitDecisions}
          </div>
        </div>

        <div className="p-2.5 rounded-xl border bg-muted/30">
          <div className="text-muted-foreground font-medium flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
            HTF Trend Exposure
          </div>
          <div className="flex items-center gap-2 mt-1 font-semibold">
            <span className="text-emerald-500">{htfTrendBreakdown.bullishBars} Bull</span>
            <span className="text-rose-500">{htfTrendBreakdown.bearishBars} Bear</span>
            <span className="text-muted-foreground">{htfTrendBreakdown.rangingBars} Range</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Point-in-time synchronized</div>
        </div>
      </div>

      {/* Phase 7 Quality Grade Distribution & Style Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Quality Grade Distribution */}
        <div className="p-3 rounded-xl border bg-card/60">
          <div className="font-semibold text-foreground flex items-center justify-between mb-2">
            <span>Quality Grade Distribution (Phase 7)</span>
            <span className="text-[10px] text-muted-foreground font-normal">0–100 Explainable Scale</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5 text-center">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <div className="text-[10px] font-bold text-emerald-400">A+ (≥90)</div>
              <div className="text-sm font-extrabold text-foreground mt-0.5">{gradeDistribution['A+'] || 0}</div>
            </div>
            <div className="p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/30">
              <div className="text-[10px] font-bold text-teal-400">A (80–89)</div>
              <div className="text-sm font-extrabold text-foreground mt-0.5">{gradeDistribution['A'] || 0}</div>
            </div>
            <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <div className="text-[10px] font-bold text-blue-400">B (65–79)</div>
              <div className="text-sm font-extrabold text-foreground mt-0.5">{gradeDistribution['B'] || 0}</div>
            </div>
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="text-[10px] font-bold text-amber-400">Watch</div>
              <div className="text-sm font-extrabold text-foreground mt-0.5">{gradeDistribution['Watch'] || 0}</div>
            </div>
            <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30">
              <div className="text-[10px] font-bold text-rose-400">Low (&lt;50)</div>
              <div className="text-sm font-extrabold text-foreground mt-0.5">{gradeDistribution['Low'] || 0}</div>
            </div>
          </div>
        </div>

        {/* Trading Style Profile Breakdown */}
        <div className="p-3 rounded-xl border bg-card/60">
          <div className="font-semibold text-foreground flex items-center justify-between mb-2">
            <span>Trading Style Horizons</span>
            <span className="text-[10px] text-muted-foreground font-normal">Decoupled Concurrency</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg border bg-muted/20">
              <div className="text-[10px] font-medium text-muted-foreground">⚡ Scalping (1-5m)</div>
              <div className="text-base font-bold text-foreground mt-0.5">{tradingStyles.Scalping || 0}</div>
            </div>
            <div className="p-2 rounded-lg border bg-muted/20">
              <div className="text-[10px] font-medium text-muted-foreground">🎯 Intraday (15m)</div>
              <div className="text-base font-bold text-foreground mt-0.5">{tradingStyles.Intraday || 0}</div>
            </div>
            <div className="p-2 rounded-lg border bg-muted/20">
              <div className="text-[10px] font-medium text-muted-foreground">🌊 Swing (1h-4h)</div>
              <div className="text-base font-bold text-foreground mt-0.5">{tradingStyles.Swing || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Best Opportunities Ranking (if available) */}
      {rankedOpportunities && (rankedOpportunities.bestBuy || rankedOpportunities.bestSell) && (
        <div className="p-3 rounded-xl border bg-card/40">
          <div className="font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Top Ranked Physical Opportunities
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {rankedOpportunities.bestBuy && (
              <div className="p-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-emerald-600 text-white text-[10px] px-1 py-0 font-bold">BEST BUY</Badge>
                    <span className="font-semibold text-foreground">{rankedOpportunities.bestBuy.strategy}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Entry: {rankedOpportunities.bestBuy.price?.toFixed(2)} | R:R {rankedOpportunities.bestBuy.riskReward?.toFixed(1)}:1
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-400">{rankedOpportunities.bestBuy.unifiedScore || rankedOpportunities.bestBuy.score}/100</div>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 mt-0.5 font-bold">
                    Grade {rankedOpportunities.bestBuy.qualityTier}
                  </Badge>
                </div>
              </div>
            )}
            {rankedOpportunities.bestSell && (
              <div className="p-2 rounded-lg border border-rose-500/30 bg-rose-500/5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-rose-600 text-white text-[10px] px-1 py-0 font-bold">BEST SELL</Badge>
                    <span className="font-semibold text-foreground">{rankedOpportunities.bestSell.strategy}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Entry: {rankedOpportunities.bestSell.price?.toFixed(2)} | R:R {rankedOpportunities.bestSell.riskReward?.toFixed(1)}:1
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-rose-400">{rankedOpportunities.bestSell.unifiedScore || rankedOpportunities.bestSell.score}/100</div>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 mt-0.5 font-bold">
                    Grade {rankedOpportunities.bestSell.qualityTier}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Strategy Breakdown table */}
      <div>
        <div className="font-semibold text-foreground mb-2">Strategy Signal Distribution</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(strategyBreakdown || {}).map(([strat, counts]) => (
            <div key={strat} className="p-2 rounded-lg border bg-card/60 flex items-center justify-between">
              <span className="truncate font-medium text-foreground mr-1" title={strat}>
                {strat}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <Badge variant="outline" className="text-[10px] px-1 py-0 text-emerald-500">
                  {counts.buy}B
                </Badge>
                <Badge variant="outline" className="text-[10px] px-1 py-0 text-rose-500">
                  {counts.sell}S
                </Badge>
                <Badge variant="secondary" className="text-[10px] px-1 py-0 font-bold">
                  {counts.approved}✓
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CardContent>
  );
});
