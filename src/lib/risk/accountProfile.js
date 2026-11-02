/**
 * Phase 8 — Simulated Account Profile & Capital Risk Management
 * Manages simulated account equity, risk budgets, drawdowns, and loss limits.
 */

import { RISK_PROFILES } from './types.js';

export const RISK_PERCENTAGE_PRESETS = {
  [RISK_PROFILES.CONSERVATIVE]: 0.5, // 0.5%
  [RISK_PROFILES.BALANCED]: 1.0,     // 1.0%
  [RISK_PROFILES.AGGRESSIVE]: 1.5,   // 1.5%
};

/**
 * Creates or initializes a simulated account state object.
 */
export function createSimulatedAccount(config = {}) {
  const balance = Number(config.simulatedAccountBalance || config.balance || 10000);
  const currency = config.accountCurrency || 'USD';

  return {
    balance,
    equity: balance,
    currency,
    peakEquity: balance,
    peakBalance: balance,
    currentDrawdownPct: 0,
    maxDrawdownPct: 0,
    dailyRealizedPnl: 0,
    weeklyRealizedPnl: 0,
    totalRealizedPnl: 0,
    openPositionsCount: 0,
    consecutiveLosses: 0,
    consecutiveWins: 0,
    lastTradeTime: null,
    dayStartTime: null,
    weekStartTime: null,
  };
}

/**
 * Calculates permitted monetary risk budget for a trade.
 * Risk Budget = Capital Basis * Risk% / 100 (or Fixed Amount).
 */
export function calculateRiskBudget(account, settings = {}) {
  const balance = account?.balance || 10000;
  const equity = account?.equity || balance;

  // Capital basis: 'Equity' or 'Balance'
  const basis = settings.riskCapitalBasis === 'Balance' ? balance : equity;

  // Fixed monetary risk mode
  if (settings.positionSizingMode === 'FixedRiskAmount' && settings.fixedRiskAmount > 0) {
    const hardMax = basis * (settings.maxRiskPerTradePct ? settings.maxRiskPerTradePct / 100 : 0.02);
    return Math.min(settings.fixedRiskAmount, hardMax);
  }

  // Percentage risk mode: Preset or custom percentage
  let riskPct = settings.riskPerTradePct;
  if (!riskPct) {
    const preset = settings.riskProfile || RISK_PROFILES.BALANCED;
    riskPct = RISK_PERCENTAGE_PRESETS[preset] || 1.0;
  }

  // Hard maximum risk cap (e.g. 2.0% absolute ceiling)
  // Adaptive settings are STRICTLY forbidden from exceeding user-defined max risk limit!
  const hardMaxPct = settings.maxRiskPerTradePct || 2.0;
  const effectivePct = Math.min(Math.max(0.1, riskPct), hardMaxPct);

  const riskBudget = (basis * effectivePct) / 100;
  return Math.round(riskBudget * 100) / 100;
}

/**
 * Updates simulated account metrics after a trade or partial leg closes.
 */
export function updateAccountOnTradeClose(account, realizedPnl, tradeTime) {
  const newBalance = Math.round((account.balance + realizedPnl) * 100) / 100;
  const newEquity = Math.round((account.equity + realizedPnl) * 100) / 100;
  const peakEquity = Math.max(account.peakEquity, newEquity);

  // Peak-to-trough Drawdown calculation
  const currentDrawdownPct = peakEquity > 0
    ? Math.round(((peakEquity - newEquity) / peakEquity) * 10000) / 100
    : 0;
  const maxDrawdownPct = Math.max(account.maxDrawdownPct, currentDrawdownPct);

  // Win / Loss streak tracking
  let consecutiveLosses = account.consecutiveLosses;
  let consecutiveWins = account.consecutiveWins;
  if (realizedPnl < 0) {
    consecutiveLosses += 1;
    consecutiveWins = 0;
  } else if (realizedPnl > 0) {
    consecutiveWins += 1;
    consecutiveLosses = 0;
  }

  return {
    ...account,
    balance: newBalance,
    equity: newEquity,
    peakEquity,
    peakBalance: Math.max(account.peakBalance, newBalance),
    currentDrawdownPct,
    maxDrawdownPct,
    dailyRealizedPnl: Math.round((account.dailyRealizedPnl + realizedPnl) * 100) / 100,
    weeklyRealizedPnl: Math.round((account.weeklyRealizedPnl + realizedPnl) * 100) / 100,
    totalRealizedPnl: Math.round((account.totalRealizedPnl + realizedPnl) * 100) / 100,
    consecutiveLosses,
    consecutiveWins,
    lastTradeTime: tradeTime,
  };
}

/**
 * Resets daily and weekly realized PnL counters at day/week boundaries in UTC.
 */
export function resetDailyWeeklyLimitsIfNeeded(account, currentTimestamp) {
  if (!currentTimestamp) return account;

  const date = new Date(currentTimestamp);
  const currentDayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  
  // Weekly boundary (Sunday 00:00 UTC)
  const dayOfWeek = date.getUTCDay();
  const currentWeekStart = currentDayStart - dayOfWeek * 86400000;

  let dailyPnl = account.dailyRealizedPnl;
  let weeklyPnl = account.weeklyRealizedPnl;

  if (account.dayStartTime && account.dayStartTime !== currentDayStart) {
    dailyPnl = 0;
  }
  if (account.weekStartTime && account.weekStartTime !== currentWeekStart) {
    weeklyPnl = 0;
  }

  return {
    ...account,
    dayStartTime: currentDayStart,
    weekStartTime: currentWeekStart,
    dailyRealizedPnl: dailyPnl,
    weeklyRealizedPnl: weeklyPnl,
  };
}
