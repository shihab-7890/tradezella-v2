'use client';

import { memo } from 'react';
import { CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const SignalDiagnosticsPanel = memo(function SignalDiagnosticsPanel({ diagnostics }) {
  if (!diagnostics) {
    return (
      <CardContent className="p-4 text-xs text-muted-foreground">
        Load market data to inspect signal engine diagnostics.
      </CardContent>
    );
  }

  const {
    rawBuyCandidates,
    rawSellCandidates,
    confirmedBuySetups,
    confirmedSellSetups,
    approvedBuy,
    approvedSell,
    duplicatesSuppressed,
    rejectedByScore,
    rejectedByQualityFilter,
    strategyBreakdown,
    htfTrendBreakdown,
  } = diagnostics;

  return (
    <CardContent className="p-4 text-xs space-y-4">
      {/* Top summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-2.5 rounded-xl border bg-muted/30">
          <div className="text-muted-foreground font-medium">Approved Signals</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-emerald-500 font-bold text-sm">BUY: {approvedBuy}</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-rose-500 font-bold text-sm">SELL: {approvedSell}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Total: {approvedBuy + approvedSell}
          </div>
        </div>

        <div className="p-2.5 rounded-xl border bg-muted/30">
          <div className="text-muted-foreground font-medium">Confirmed Setups</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-foreground font-semibold">BUY: {confirmedBuySetups}</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-foreground font-semibold">SELL: {confirmedSellSetups}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Raw: {rawBuyCandidates}B / {rawSellCandidates}S
          </div>
        </div>

        <div className="p-2.5 rounded-xl border bg-muted/30">
          <div className="text-muted-foreground font-medium">Suppressed & Filtered</div>
          <div className="font-semibold text-foreground text-sm mt-1">
            {duplicatesSuppressed} duplicates
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Low score: {rejectedByScore} | Quality: {rejectedByQualityFilter}
          </div>
        </div>

        <div className="p-2.5 rounded-xl border bg-muted/30">
          <div className="text-muted-foreground font-medium">HTF Trend Exposure</div>
          <div className="flex items-center gap-2 mt-1 font-semibold">
            <span className="text-emerald-500">{htfTrendBreakdown.bullishBars} Bull</span>
            <span className="text-rose-500">{htfTrendBreakdown.bearishBars} Bear</span>
            <span className="text-muted-foreground">{htfTrendBreakdown.rangingBars} Range</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Point-in-time bars</div>
        </div>
      </div>

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
