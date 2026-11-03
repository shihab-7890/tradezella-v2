/**
 * Phase 10 — Advanced Analytics & Quantitative Performance Engine
 * Evaluates trade statistics, financial metrics, risk-adjusted ratios (Sharpe, Sortino, Calmar),
 * BUY vs SELL independent breakdowns, and Scalping/Intraday/Swing comparisons.
 */

export function calculateBacktestMetrics(trades = [], initialBalance = 10000, executionCosts = {}) {
  const completedTrades = (trades || []).filter(t => t.status === 'CLOSED' || t.realizedPnl !== undefined);
  
  let grossProfit = 0;
  let grossLoss = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let breakEvenTrades = 0;
  let totalSpreadCost = 0;
  let totalSlippageCost = 0;
  let totalCommissionCost = 0;
  let totalHoldingTimeMs = 0;

  let maxWin = 0;
  let maxLoss = 0;
  let currentStreakWins = 0;
  let maxStreakWins = 0;
  let currentStreakLosses = 0;
  let maxStreakLosses = 0;

  let buyTrades = [];
  let sellTrades = [];

  const equityCurve = [{ time: completedTrades[0]?.time || Date.now(), equity: initialBalance, drawdown: 0, pnl: 0 }];
  let currentBalance = initialBalance;
  let peakBalance = initialBalance;
  let maxDrawdownAbs = 0;
  let maxDrawdownPct = 0;
  let currentDrawdownAbs = 0;
  let currentDrawdownPct = 0;

  const returnsList = [];

  completedTrades.forEach((trade, idx) => {
    const pnl = Number(trade.realizedPnl || trade.pnl || 0);
    const comm = Number(trade.commission || executionCosts.commissionPerTrade || 0);
    const spread = Number(trade.spreadCost || executionCosts.spreadCost || 0);
    const slip = Number(trade.slippageCost || executionCosts.slippageCost || 0);

    totalCommissionCost += comm;
    totalSpreadCost += spread;
    totalSlippageCost += slip;

    const netPnl = pnl - comm - spread - slip;
    currentBalance += netPnl;

    returnsList.push(netPnl / initialBalance);

    if (netPnl > 0.001) {
      winningTrades++;
      grossProfit += netPnl;
      if (netPnl > maxWin) maxWin = netPnl;
      currentStreakWins++;
      currentStreakLosses = 0;
      if (currentStreakWins > maxStreakWins) maxStreakWins = currentStreakWins;
    } else if (netPnl < -0.001) {
      losingTrades++;
      grossLoss += Math.abs(netPnl);
      if (Math.abs(netPnl) > maxLoss) maxLoss = Math.abs(netPnl);
      currentStreakLosses++;
      currentStreakWins = 0;
      if (currentStreakLosses > maxStreakLosses) maxStreakLosses = currentStreakLosses;
    } else {
      breakEvenTrades++;
      currentStreakWins = 0;
      currentStreakLosses = 0;
    }

    if (trade.holdingTimeMs) {
      totalHoldingTimeMs += trade.holdingTimeMs;
    } else if (trade.exitTime && trade.entryTime) {
      totalHoldingTimeMs += (trade.exitTime - trade.entryTime);
    }

    const dir = String(trade.direction || trade.type || 'BUY').toUpperCase();
    if (dir.includes('BUY')) {
      buyTrades.push({ ...trade, netPnl });
    } else {
      sellTrades.push({ ...trade, netPnl });
    }

    if (currentBalance > peakBalance) {
      peakBalance = currentBalance;
      currentDrawdownAbs = 0;
      currentDrawdownPct = 0;
    } else {
      currentDrawdownAbs = peakBalance - currentBalance;
      currentDrawdownPct = peakBalance > 0 ? (currentDrawdownAbs / peakBalance) * 100 : 0;
      if (currentDrawdownAbs > maxDrawdownAbs) maxDrawdownAbs = currentDrawdownAbs;
      if (currentDrawdownPct > maxDrawdownPct) maxDrawdownPct = currentDrawdownPct;
    }

    equityCurve.push({
      time: trade.exitTime || trade.time || Date.now(),
      equity: Math.round(currentBalance * 100) / 100,
      drawdown: Math.round(currentDrawdownPct * 100) / 100,
      pnl: Math.round(netPnl * 100) / 100,
    });
  });

  const totalTradesCount = completedTrades.length;
  const winRate = totalTradesCount > 0 ? (winningTrades / totalTradesCount) * 100 : 0;
  const lossRate = totalTradesCount > 0 ? (losingTrades / totalTradesCount) * 100 : 0;
  const avgProfit = winningTrades > 0 ? grossProfit / winningTrades : 0;
  const avgLoss = losingTrades > 0 ? grossLoss / losingTrades : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999.99 : 0;
  const netPnl = grossProfit - grossLoss;
  const netExpectancy = totalTradesCount > 0 ? netPnl / totalTradesCount : 0;
  const totalCosts = totalSpreadCost + totalSlippageCost + totalCommissionCost;

  // R-Multiple
  const rMultiples = completedTrades.map(t => Number(t.realizedR || t.riskReward || 0)).filter(r => !isNaN(r));
  const avgR = rMultiples.length > 0 ? rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length : 0;

  // Risk Adjusted Ratios (Annualized assuming daily samples)
  const meanReturn = returnsList.length > 0 ? returnsList.reduce((a, b) => a + b, 0) / returnsList.length : 0;
  const variance = returnsList.length > 1 
    ? returnsList.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returnsList.length - 1) 
    : 0;
  const stdDev = Math.sqrt(variance);

  const downsideReturns = returnsList.filter(r => r < 0);
  const downsideVar = downsideReturns.length > 1 
    ? downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideReturns.length 
    : 0;
  const downsideDev = Math.sqrt(downsideVar);

  const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0;
  const sortinoRatio = downsideDev > 0 ? (meanReturn / downsideDev) * Math.sqrt(252) : 0;
  const calmarRatio = maxDrawdownPct > 0 ? ((netPnl / initialBalance) * 100) / maxDrawdownPct : 0;

  // BUY vs SELL Breakdown
  const computeDirectionalStats = (dirTrades) => {
    const count = dirTrades.length;
    const wins = dirTrades.filter(t => t.netPnl > 0.001);
    const losses = dirTrades.filter(t => t.netPnl < -0.001);
    const gProf = wins.reduce((sum, t) => sum + t.netPnl, 0);
    const gLoss = losses.reduce((sum, t) => sum + Math.abs(t.netPnl), 0);
    const dirNet = gProf - gLoss;
    return {
      totalTrades: count,
      winRate: count > 0 ? (wins.length / count) * 100 : 0,
      netPnl: dirNet,
      profitFactor: gLoss > 0 ? gProf / gLoss : gProf > 0 ? 999.99 : 0,
      expectancy: count > 0 ? dirNet / count : 0,
      avgWin: wins.length > 0 ? gProf / wins.length : 0,
      avgLoss: losses.length > 0 ? gLoss / losses.length : 0,
    };
  };

  const buyStats = computeDirectionalStats(buyTrades);
  const sellStats = computeDirectionalStats(sellTrades);

  return {
    initialBalance,
    finalBalance: currentBalance,
    totalTrades: totalTradesCount,
    winningTrades,
    losingTrades,
    breakEvenTrades,
    winRate: Math.round(winRate * 10) / 10,
    lossRate: Math.round(lossRate * 10) / 10,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossLoss: Math.round(grossLoss * 100) / 100,
    netPnl: Math.round(netPnl * 100) / 100,
    totalCosts: Math.round(totalCosts * 100) / 100,
    totalSpreadCost: Math.round(totalSpreadCost * 100) / 100,
    totalSlippageCost: Math.round(totalSlippageCost * 100) / 100,
    totalCommissionCost: Math.round(totalCommissionCost * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    netExpectancy: Math.round(netExpectancy * 100) / 100,
    avgR: Math.round(avgR * 100) / 100,
    avgProfit: Math.round(avgProfit * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    maxWin: Math.round(maxWin * 100) / 100,
    maxLoss: Math.round(maxLoss * 100) / 100,
    maxStreakWins,
    maxStreakLosses,
    avgHoldingTimeMinutes: totalTradesCount > 0 ? Math.round((totalHoldingTimeMs / totalTradesCount) / 60000) : 0,
    maxDrawdownAbs: Math.round(maxDrawdownAbs * 100) / 100,
    maxDrawdownPct: Math.round(maxDrawdownPct * 10) / 10,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    sortinoRatio: Math.round(sortinoRatio * 100) / 100,
    calmarRatio: Math.round(calmarRatio * 100) / 100,
    buyStats,
    sellStats,
    equityCurve,
  };
}
