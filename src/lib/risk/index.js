/**
 * Phase 8 — Professional Dynamic Risk Management & Trade Decision Master Orchestrator
 * Connects position sizing, precision SL/TP, portfolio limits, and execution simulation.
 */

import { RISK_DECISION_STATUS, TRADE_LIFECYCLE_STATUS, STOP_LOSS_METHODS, TAKE_PROFIT_METHODS } from './types.js';
import { getInstrumentSpec } from './instruments.js';
import { createSimulatedAccount, calculateRiskBudget, updateAccountOnTradeClose, resetDailyWeeklyLimitsIfNeeded } from './accountProfile.js';
import { calculatePositionSize } from './positionSizer.js';
import { calculatePrecisionStopLoss } from './stopLossEngine.js';
import { planTakeProfitTargets } from './takeProfitEngine.js';
import { evaluatePortfolioRiskSafeguards } from './portfolioProtection.js';
import { resolveStyleRiskProfile } from './styleRiskProfiles.js';
import { simulateTradeExecution } from './executionSimulator.js';
import { RiskDiagnosticsCollector } from './riskDiagnostics.js';

export {
  RISK_DECISION_STATUS,
  TRADE_LIFECYCLE_STATUS,
  STOP_LOSS_METHODS,
  TAKE_PROFIT_METHODS,
  TRAILING_STOP_METHODS,
  RISK_PROFILES,
  INTRABAR_AMBIGUITY_POLICIES,
  TRADING_STYLES,
} from './types.js';

export {
  getInstrumentSpec,
  normalizeSymbol,
  calculatePointValueInAccountCurrency,
  normalizeLotSize,
  INSTRUMENT_REGISTRY,
} from './instruments.js';

export {
  createSimulatedAccount,
  calculateRiskBudget,
  updateAccountOnTradeClose,
  resetDailyWeeklyLimitsIfNeeded,
  RISK_PERCENTAGE_PRESETS,
} from './accountProfile.js';

export {
  calculatePositionSize,
} from './positionSizer.js';

export {
  calculatePrecisionStopLoss,
} from './stopLossEngine.js';

export {
  planTakeProfitTargets,
  DEFAULT_PARTIAL_ALLOCATIONS,
} from './takeProfitEngine.js';

export {
  evaluateBreakEvenAdjustment,
} from './breakEvenEngine.js';

export {
  calculateTrailingStop,
} from './trailingStopEngine.js';

export {
  evaluatePortfolioRiskSafeguards,
  CORRELATION_GROUPS,
} from './portfolioProtection.js';

export {
  resolveStyleRiskProfile,
  STYLE_RISK_CONFIGS,
} from './styleRiskProfiles.js';

export {
  simulateTradeExecution,
} from './executionSimulator.js';

export {
  RiskDiagnosticsCollector,
} from './riskDiagnostics.js';

/**
 * Constructs a fully risk-managed trade plan for a single signal candidate.
 */
export function evaluateTradeRiskPlan({
  candidate,
  account,
  candles = [],
  signalIndex = -1,
  openPositions = [],
  symbol = 'XAUUSD',
  settings = {},
  regimeInfo = {},
}) {
  if (candidate.isApproved === false) {
    return {
      ...candidate,
      isApproved: false,
      riskDecision: candidate.riskDecision || candidate.reasonCode || 'REJECTED_BY_SIGNAL_ENGINE',
      status: TRADE_LIFECYCLE_STATUS.REJECTED_SIGNAL || 'REJECTED_SIGNAL',
    };
  }

  const direction = candidate.direction || (candidate.type?.includes('BUY') ? 'BUY' : 'SELL');
  const entryPrice = candidate.price || candidate.entryPrice || (candles[signalIndex] ? candles[signalIndex].close : 0);
  const tradingStyle = candidate.tradingStyle || 'Intraday';
  const styleProfile = resolveStyleRiskProfile(tradingStyle, settings, regimeInfo);

  // 1. Calculate Precision Stop Loss
  const slMethod = settings.stopLossMethod || styleProfile.defaultStopMethod || STOP_LOSS_METHODS.HYBRID;
  const slResult = calculatePrecisionStopLoss({
    direction,
    entryPrice,
    candles,
    signalIndex,
    atr: candidate.atr || (candles[signalIndex] ? candles[signalIndex].atr : null),
    method: slMethod,
    symbol,
    setupData: candidate,
    settings,
  });

  if (!slResult.isValid) {
    return {
      ...candidate,
      isApproved: false,
      riskDecision: slResult.reasonCode,
      status: TRADE_LIFECYCLE_STATUS.REJECTED_RISK,
      reason: slResult.reason,
    };
  }

  const stopLoss = slResult.sl;

  // 2. Calculate Permitted Risk Budget
  const riskBudget = calculateRiskBudget(account, settings);

  // 3. Calculate Instrument-Aware Position Size
  const sizeResult = calculatePositionSize({
    entryPrice,
    stopLoss,
    riskBudget,
    symbol,
    accountCurrency: account.currency,
    settings,
  });

  if (sizeResult.status !== RISK_DECISION_STATUS.ELIGIBLE) {
    return {
      ...candidate,
      isApproved: false,
      riskDecision: sizeResult.status,
      status: TRADE_LIFECYCLE_STATUS.REJECTED_RISK,
      reason: sizeResult.reason,
      minRequiredBudget: sizeResult.minRequiredBudget,
    };
  }

  const lots = sizeResult.lots;

  // 4. Plan TP1, TP2, TP3 Targets & Partial Exits
  const tpMethod = settings.takeProfitMethod || TAKE_PROFIT_METHODS.HYBRID;
  const tpResult = planTakeProfitTargets({
    direction,
    entryPrice,
    stopLoss,
    totalLots: lots,
    symbol,
    method: tpMethod,
    setupData: candidate,
    settings,
  });

  if (!tpResult.isValid) {
    return {
      ...candidate,
      isApproved: false,
      riskDecision: tpResult.reasonCode,
      status: TRADE_LIFECYCLE_STATUS.REJECTED_RISK,
      reason: tpResult.reason,
    };
  }

  // 5. Evaluate Portfolio & Account Safeguards
  const portfolioCheck = evaluatePortfolioRiskSafeguards({
    account,
    plannedRiskAmount: sizeResult.monetaryRisk,
    symbol,
    direction,
    openPositions,
    settings,
  });

  if (!portfolioCheck.approved) {
    return {
      ...candidate,
      isApproved: false,
      riskDecision: portfolioCheck.reasonCode,
      status: TRADE_LIFECYCLE_STATUS.REJECTED_RISK,
      reason: portfolioCheck.reason,
    };
  }

  // Construct complete, verified trade plan
  return {
    ...candidate,
    isApproved: true,
    riskDecision: RISK_DECISION_STATUS.ELIGIBLE,
    status: TRADE_LIFECYCLE_STATUS.WAITING_FOR_ENTRY,
    direction,
    entryPrice,
    sl: stopLoss,
    tp: tpResult.tp2 || tpResult.tp,
    tp1: tpResult.tp1,
    tp2: tpResult.tp2,
    tp3: tpResult.tp3,
    targets: tpResult.targets,
    lots,
    totalLots: lots,
    monetaryRisk: sizeResult.monetaryRisk,
    riskBudget,
    stopDistance: sizeResult.stopDistance,
    stopDistancePips: sizeResult.stopDistancePips,
    grossRewardRisk: tpResult.grossRewardRisk,
    netRewardRisk: tpResult.netRewardRisk,
    riskReward: tpResult.grossRewardRisk,
    pointValuePerLot: sizeResult.pointValuePerLot,
    setupExpiryCandles: styleProfile.setupExpiryCandles,
    tradingStyle,
    spec: sizeResult.spec,
  };
}

/**
 * Runs full Risk & Trade Management pipeline over a collection of candidate setups.
 */
export function runRiskManagementEngine({
  candidates = [],
  candles = [],
  symbol = 'XAUUSD',
  candleTimeIndex,
  activeSettings = {},
  regimeInfo = {},
}) {
  let simulatedAccount = createSimulatedAccount(activeSettings);
  const diagnostics = new RiskDiagnosticsCollector(symbol, simulatedAccount.currency);

  const managedPlans = [];
  const openPositions = [];

  for (let idx = 0; idx < candidates.length; idx++) {
    const candidate = candidates[idx];
    const signalIndex = candleTimeIndex ? candleTimeIndex.get(candidate.time) : idx;

    // Reset daily/weekly metrics if timestamp crosses boundaries
    simulatedAccount = resetDailyWeeklyLimitsIfNeeded(simulatedAccount, candidate.time);

    // 1. Evaluate Trade Plan & Risk Feasibility
    const tradePlan = evaluateTradeRiskPlan({
      candidate,
      account: simulatedAccount,
      candles,
      signalIndex,
      openPositions,
      symbol,
      settings: activeSettings,
      regimeInfo,
    });

    diagnostics.recordPlanEvaluation(tradePlan);

    if (tradePlan.isApproved) {
      // 2. Simulate historical execution lifecycle
      const executedTrade = simulateTradeExecution({
        tradePlan,
        candles,
        signalIndex,
        symbol,
        settings: activeSettings,
      });

      // Update simulated account when trade closes
      if (executedTrade.status?.includes('CLOSED')) {
        simulatedAccount = updateAccountOnTradeClose(
          simulatedAccount,
          executedTrade.realizedPnl || 0,
          executedTrade.closeTime || candidate.time
        );
      }

      diagnostics.recordSimulatedTrade(executedTrade);
      managedPlans.push(executedTrade);
    } else {
      managedPlans.push(tradePlan);
    }
  }

  return {
    tradePlans: managedPlans,
    simulatedAccount,
    riskDiagnostics: diagnostics.getSummary(simulatedAccount),
  };
}
