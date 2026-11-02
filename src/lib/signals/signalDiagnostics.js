/**
 * Phase 7 — Signal Intelligence Diagnostics & Performance Collector
 */

export class UnifiedDiagnosticsCollector {
  constructor(symbol = 'XAU/USD', timeframe = '15m') {
    this.symbol = symbol;
    this.timeframe = timeframe;
    this.totalRaw = 0;
    this.rawBuyCandidates = 0;
    this.rawSellCandidates = 0;
    this.confirmedBuySetups = 0;
    this.confirmedSellSetups = 0;
    this.deduplicatedCount = 0;
    this.duplicatesSuppressed = 0;
    this.approvedBuy = 0;
    this.approvedSell = 0;
    this.watchBuy = 0;
    this.watchSell = 0;
    this.waitCount = 0;
    this.rejectedCount = 0;
    this.rejectedByScore = 0;
    this.rejectedByQualityFilter = 0;
    this.conflictsCount = 0;

    this.htfTrendBreakdown = {
      bullishBars: 0,
      bearishBars: 0,
      rangingBars: 0,
    };

    this.gradeDistribution = {
      'A+': 0,
      'A': 0,
      'B': 0,
      'Watch': 0,
      'Low': 0,
    };

    this.styleBreakdown = {
      Scalping: { approved: 0, watch: 0, total: 0 },
      Intraday: { approved: 0, watch: 0, total: 0 },
      Swing: { approved: 0, watch: 0, total: 0 },
    };

    this.strategyBreakdown = {};
    this.conflictBreakdown = {};
    this.rejectionReasons = {};

    this.executionStats = {
      triggeredTrades: 0,
      closedTp: 0,
      closedSl: 0,
      expired: 0,
      active: 0,
      totalPnlR: 0,
    };
  }

  recordRawCandidates(count) {
    this.totalRaw += count;
  }

  recordDuplicatesSuppressed(count) {
    this.duplicatesSuppressed += count;
  }

  recordSetup(setup) {
    this.deduplicatedCount++;
    const style = setup.tradingStyle || 'Intraday';
    if (!this.styleBreakdown[style]) {
      this.styleBreakdown[style] = { approved: 0, watch: 0, total: 0 };
    }
    this.styleBreakdown[style].total++;

    const grade = setup.qualityTier || 'B';
    if (this.gradeDistribution[grade] !== undefined) {
      this.gradeDistribution[grade]++;
    }

    const strat = setup.strategy || 'general';
    if (!this.strategyBreakdown[strat]) {
      this.strategyBreakdown[strat] = { buy: 0, sell: 0, approved: 0 };
    }
    if (setup.direction === 'BUY') {
      this.strategyBreakdown[strat].buy++;
      this.rawBuyCandidates++;
      if (setup.isApproved || setup.type?.includes('confirmed')) {
        this.confirmedBuySetups++;
      }
    } else {
      this.strategyBreakdown[strat].sell++;
      this.rawSellCandidates++;
      if (setup.isApproved || setup.type?.includes('confirmed')) {
        this.confirmedSellSetups++;
      }
    }

    if (setup.decision === 'BUY APPROVED') {
      this.approvedBuy++;
      this.styleBreakdown[style].approved++;
      this.strategyBreakdown[strat].approved++;
    } else if (setup.decision === 'SELL APPROVED') {
      this.approvedSell++;
      this.styleBreakdown[style].approved++;
      this.strategyBreakdown[strat].approved++;
    } else if (setup.decision === 'WATCH BUY') {
      this.watchBuy++;
      this.styleBreakdown[style].watch++;
    } else if (setup.decision === 'WATCH SELL') {
      this.watchSell++;
      this.styleBreakdown[style].watch++;
    } else if (setup.decision === 'WAIT') {
      this.waitCount++;
    } else {
      this.rejectedCount++;
      const reason = setup.reasonCode || 'OTHER';
      this.rejectionReasons[reason] = (this.rejectionReasons[reason] || 0) + 1;
      if (reason.includes('SCORE')) {
        this.rejectedByScore++;
      } else {
        this.rejectedByQualityFilter++;
      }
    }

    if (setup.isConflicted) {
      this.conflictsCount++;
      const cType = setup.conflictType || 'UNKNOWN';
      this.conflictBreakdown[cType] = (this.conflictBreakdown[cType] || 0) + 1;
    }

    // Execution outcomes
    if (setup.status === 'TRIGGERED' || setup.status === 'ACTIVE' || setup.outcome === 'TP' || setup.outcome === 'SL') {
      this.executionStats.triggeredTrades++;
    }
    if (setup.outcome === 'TP') {
      this.executionStats.closedTp++;
      this.executionStats.totalPnlR += (setup.pnlR || 0);
    } else if (setup.outcome === 'SL') {
      this.executionStats.closedSl++;
      this.executionStats.totalPnlR += (setup.pnlR || 0);
    } else if (setup.outcome === 'EXPIRED') {
      this.executionStats.expired++;
    }
  }

  setHtfTrendBreakdown(htfBreakdown) {
    if (htfBreakdown) {
      this.htfTrendBreakdown = {
        bullishBars: htfBreakdown.bullishBars || 0,
        bearishBars: htfBreakdown.bearishBars || 0,
        rangingBars: htfBreakdown.rangingBars || 0,
      };
    }
  }

  getSummary() {
    const resolvedTrades = this.executionStats.closedTp + this.executionStats.closedSl;
    const winRate = resolvedTrades > 0 ? (this.executionStats.closedTp / resolvedTrades) * 100 : 0;
    const avgR = resolvedTrades > 0 ? this.executionStats.totalPnlR / resolvedTrades : 0;

    return {
      symbol: this.symbol,
      timeframe: this.timeframe,
      totalRawCandidates: this.totalRaw,
      rawBuyCandidates: this.rawBuyCandidates,
      rawSellCandidates: this.rawSellCandidates,
      confirmedBuySetups: this.confirmedBuySetups,
      confirmedSellSetups: this.confirmedSellSetups,
      deduplicatedSetups: this.deduplicatedCount,
      duplicatesSuppressed: this.duplicatesSuppressed,
      approvedBuy: this.approvedBuy,
      approvedSell: this.approvedSell,
      totalApproved: this.approvedBuy + this.approvedSell,
      watchBuy: this.watchBuy,
      watchSell: this.watchSell,
      waitCount: this.waitCount,
      rejectedCount: this.rejectedCount,
      rejectedByScore: this.rejectedByScore,
      rejectedByQualityFilter: this.rejectedByQualityFilter,
      conflictsCount: this.conflictsCount,
      gradeDistribution: this.gradeDistribution,
      styleBreakdown: this.styleBreakdown,
      strategyBreakdown: this.strategyBreakdown,
      conflictBreakdown: this.conflictBreakdown,
      rejectionReasons: this.rejectionReasons,
      htfTrendBreakdown: this.htfTrendBreakdown,
      executionStats: {
        ...this.executionStats,
        winRate: Math.round(winRate * 10) / 10,
        averageR: Math.round(avgR * 100) / 100,
        netPnlR: Math.round(this.executionStats.totalPnlR * 100) / 100,
      },
    };
  }
}
