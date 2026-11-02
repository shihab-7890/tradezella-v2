/**
 * Phase 8 — Advanced Risk & Performance Analytics Collector
 * Computes cost-adjusted metrics, drawdown profiles, policy comparisons, and style breakdowns.
 */

export class RiskDiagnosticsCollector {
  constructor(symbol = 'XAUUSD', accountCurrency = 'USD') {
    this.symbol = symbol;
    this.accountCurrency = accountCurrency;
    this.totalPlans = 0;
    this.approvedPlans = 0;
    this.rejectedPlans = 0;
    this.rejectionReasons = {};

    this.simulatedTrades = [];
    this.styleBreakdown = { Scalping: { count: 0, pnlR: 0 }, Intraday: { count: 0, pnlR: 0 }, Swing: { count: 0, pnlR: 0 } };
    this.directionBreakdown = { BUY: { count: 0, pnlR: 0, wins: 0 }, SELL: { count: 0, pnlR: 0, wins: 0 } };
  }

  recordPlanEvaluation(plan) {
    this.totalPlans += 1;
    if (plan.isApproved) {
      this.approvedPlans += 1;
    } else {
      this.rejectedPlans += 1;
      const code = plan.reasonCode || 'REJECTED_RISK';
      this.rejectionReasons[code] = (this.rejectionReasons[code] || 0) + 1;
    }
  }

  recordSimulatedTrade(trade) {
    this.simulatedTrades.push(trade);

    const style = trade.tradingStyle || 'Intraday';
    if (this.styleBreakdown[style]) {
      this.styleBreakdown[style].count += 1;
      this.styleBreakdown[style].pnlR += (trade.pnlR || 0);
    }

    const dir = trade.direction || 'BUY';
    if (this.directionBreakdown[dir]) {
      this.directionBreakdown[dir].count += 1;
      this.directionBreakdown[dir].pnlR += (trade.pnlR || 0);
      if ((trade.pnlR || 0) > 0) this.directionBreakdown[dir].wins += 1;
    }
  }

  getSummary(account = {}) {
    const closed = this.simulatedTrades.filter(t => t.status?.includes('CLOSED'));
    const triggered = this.simulatedTrades.filter(t => t.isTriggered);
    const expired = this.simulatedTrades.filter(t => t.status === 'EXPIRED');

    const wins = closed.filter(t => (t.pnlR || 0) > 0);
    const losses = closed.filter(t => (t.pnlR || 0) < 0);
    const beTrades = closed.filter(t => (t.pnlR || 0) === 0);

    const winRate = closed.length > 0 ? Math.round((wins.length / closed.length) * 1000) / 10 : 0;
    const netPnlR = Math.round(closed.reduce((acc, t) => acc + (t.pnlR || 0), 0) * 100) / 100;
    const netMonetaryPnl = Math.round(closed.reduce((acc, t) => acc + (t.realizedPnl || 0), 0) * 100) / 100;

    const totalWinR = wins.reduce((acc, t) => acc + t.pnlR, 0);
    const totalLossR = Math.abs(losses.reduce((acc, t) => acc + t.pnlR, 0));
    const profitFactor = totalLossR > 0 ? Math.round((totalWinR / totalLossR) * 100) / 100 : (totalWinR > 0 ? 99.0 : 1.0);

    const avgWinR = wins.length > 0 ? Math.round((totalWinR / wins.length) * 100) / 100 : 0;
    const avgLossR = losses.length > 0 ? Math.round((totalLossR / losses.length) * 100) / 100 : 0;
    const expectancyR = closed.length > 0 ? Math.round((netPnlR / closed.length) * 100) / 100 : 0;

    // Trailing and partial exit stats
    const partialWins = closed.filter(t => t.partialExits && t.partialExits.length > 0);
    const trailingEvents = closed.reduce((acc, t) => acc + (t.events?.filter(e => e.type === 'TRAILING_STOP_UPDATED').length || 0), 0);

    return {
      symbol: this.symbol,
      accountCurrency: this.accountCurrency,
      totalPlans: this.totalPlans,
      approvedPlans: this.approvedPlans,
      rejectedPlans: this.rejectedPlans,
      rejectionReasons: this.rejectionReasons,

      // Flat convenience properties
      totalEvaluated: this.totalPlans,
      approvedTrades: this.approvedPlans,
      executedTrades: this.simulatedTrades.length,
      closedTpTrades: wins.length,
      closedSlTrades: losses.length,
      closedTrailingTrades: trailingEvents,
      winRate,
      netRealizedPnl: netMonetaryPnl,
      netPnlR,
      profitFactor,
      expectancy: expectancyR,
      maxDrawdownPct: account?.maxDrawdownPct || 0,
      rejectionsByReason: this.rejectionReasons,

      executionMetrics: {
        totalSignals: this.simulatedTrades.length,
        triggeredOrders: triggered.length,
        closedTrades: closed.length,
        expiredOrders: expired.length,
        wins: wins.length,
        losses: losses.length,
        breakEvenTrades: beTrades.length,
        winRate,
        netPnlR,
        netMonetaryPnl,
        profitFactor,
        expectancyR,
        avgWinR,
        avgLossR,
        partialExitTrades: partialWins.length,
        trailingUpdatesCount: trailingEvents,
      },

      accountDrawdown: {
        balance: account?.balance || 10000,
        equity: account?.equity || 10000,
        currentDrawdownPct: account?.currentDrawdownPct || 0,
        maxDrawdownPct: account?.maxDrawdownPct || 0,
        dailyRealizedPnl: account?.dailyRealizedPnl || 0,
        weeklyRealizedPnl: account?.weeklyRealizedPnl || 0,
      },

      styleBreakdown: this.styleBreakdown,
      directionBreakdown: this.directionBreakdown,
    };
  }
}
