/**
 * Phase 8 — Daily, Weekly & Portfolio-Level Risk Protection
 * Enforces hard loss limits, maximum concurrent exposure, and drawdown brakes.
 */

import { RISK_DECISION_STATUS } from './types.js';

export const CORRELATION_GROUPS = {
  USD_WEAKNESS: ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'XAUUSD'],
  USD_STRENGTH: ['USDCAD', 'USDCHF', 'USDJPY'],
  YEN_CROSSES: ['USDJPY', 'EURJPY', 'GBPJPY'],
};

/**
 * Evaluates whether an incoming trade plan satisfies all portfolio and account-level risk constraints.
 */
export function evaluatePortfolioRiskSafeguards({
  account,
  plannedRiskAmount,
  symbol = 'XAUUSD',
  direction = 'BUY',
  openPositions = [],
  settings = {},
}) {
  const balance = account?.balance || 10000;
  const equity = account?.equity || balance;
  const peakEquity = account?.peakEquity || balance;

  // 1. Daily Loss Limit Check
  const maxDailyLossPct = settings.maxDailyLossPct || 3.0; // 3% of balance
  const maxDailyLossAmount = (balance * maxDailyLossPct) / 100;
  const dailyRealizedPnl = account?.dailyRealizedPnl || 0;

  if (dailyRealizedPnl <= -maxDailyLossAmount) {
    return {
      approved: false,
      reasonCode: RISK_DECISION_STATUS.DAILY_LOSS_LIMIT,
      reason: `Daily loss limit reached ($${Math.abs(dailyRealizedPnl).toFixed(2)} / max -$${maxDailyLossAmount.toFixed(2)}). New simulated entries halted until daily reset.`,
    };
  }

  // 2. Weekly Loss Limit Check
  const maxWeeklyLossPct = settings.maxWeeklyLossPct || 6.0;
  const maxWeeklyLossAmount = (balance * maxWeeklyLossPct) / 100;
  const weeklyRealizedPnl = account?.weeklyRealizedPnl || 0;

  if (weeklyRealizedPnl <= -maxWeeklyLossAmount) {
    return {
      approved: false,
      reasonCode: RISK_DECISION_STATUS.WEEKLY_LOSS_LIMIT,
      reason: `Weekly loss limit reached ($${Math.abs(weeklyRealizedPnl).toFixed(2)} / max -$${maxWeeklyLossAmount.toFixed(2)}). New entries halted until weekly reset.`,
    };
  }

  // 3. Maximum Drawdown Check
  const maxDrawdownLimitPct = settings.maxDrawdownLimitPct || 10.0;
  const currentDrawdownPct = peakEquity > 0 ? ((peakEquity - equity) / peakEquity) * 100 : 0;

  if (currentDrawdownPct >= maxDrawdownLimitPct) {
    return {
      approved: false,
      reasonCode: RISK_DECISION_STATUS.MAX_DRAWDOWN_REACHED,
      reason: `Maximum equity drawdown limit reached (${currentDrawdownPct.toFixed(1)}% / max ${maxDrawdownLimitPct.toFixed(1)}%). Trading circuit breaker engaged.`,
    };
  }

  // 4. Maximum Concurrent Open Positions Check
  const maxConcurrentTrades = settings.maxConcurrentTrades || 3;
  if (openPositions.length >= maxConcurrentTrades) {
    return {
      approved: false,
      reasonCode: RISK_DECISION_STATUS.MAX_EXPOSURE_REACHED,
      reason: `Maximum concurrent open positions reached (${openPositions.length} / max ${maxConcurrentTrades}).`,
    };
  }

  // 5. Total Open Risk Exposure Check
  const maxOpenRiskPct = settings.maxOpenRiskPct || 5.0; // Max 5% total open risk
  const maxOpenRiskAmount = (equity * maxOpenRiskPct) / 100;
  const currentOpenRisk = openPositions.reduce((acc, pos) => acc + (pos.monetaryRisk || 0), 0);

  if (currentOpenRisk + plannedRiskAmount > maxOpenRiskAmount) {
    return {
      approved: false,
      reasonCode: RISK_DECISION_STATUS.MAX_EXPOSURE_REACHED,
      reason: `Combined open risk ($${(currentOpenRisk + plannedRiskAmount).toFixed(2)}) would exceed portfolio limit ($${maxOpenRiskAmount.toFixed(2)}).`,
    };
  }

  // 6. Correlated Exposure Check
  const sNorm = symbol.replace(/[^A-Z]/g, '');
  let isCorrelatedExposure = false;
  let correlatedSymbol = '';

  for (const group of Object.values(CORRELATION_GROUPS)) {
    if (group.includes(sNorm)) {
      for (const openPos of openPositions) {
        const openSymNorm = (openPos.symbol || '').replace(/[^A-Z]/g, '');
        if (group.includes(openSymNorm) && openPos.direction === direction) {
          isCorrelatedExposure = true;
          correlatedSymbol = openPos.symbol;
          break;
        }
      }
    }
    if (isCorrelatedExposure) break;
  }

  const maxCorrelatedPositions = settings.maxCorrelatedPositions || 2;
  if (isCorrelatedExposure && openPositions.length >= maxCorrelatedPositions) {
    return {
      approved: false,
      reasonCode: RISK_DECISION_STATUS.MAX_EXPOSURE_REACHED,
      reason: `Correlated exposure limit reached between ${symbol} and active ${correlatedSymbol} position.`,
    };
  }

  // 7. Consecutive Loss Cooldown Check
  const maxConsecutiveLosses = settings.consecutiveLossCooldown || 3;
  if ((account?.consecutiveLosses || 0) >= maxConsecutiveLosses) {
    return {
      approved: false,
      reasonCode: RISK_DECISION_STATUS.CONSECUTIVE_LOSS_COOLDOWN,
      reason: `Cooldown engaged after ${account.consecutiveLosses} consecutive losses. Pause required before resuming trading.`,
    };
  }

  return {
    approved: true,
    reasonCode: RISK_DECISION_STATUS.ELIGIBLE,
    reason: 'Portfolio safeguards verified.',
  };
}
