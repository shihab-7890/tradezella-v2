/**
 * Phase 10 — Core Unified Backtest Engine Orchestrator
 * Integrates chronological signal generation, execution simulation, analytics,
 * Walk-Forward validation, and parameter optimization into reproducible Run Records.
 */

import { runConfluenceEngine } from '@/lib/liquidity';
import { calculateBacktestMetrics } from './analyticsEngine';
import { runWalkForwardValidation } from './walkForwardEngine';
import { runStrategyOptimization } from './optimizationEngine';

export async function executeBacktestRun(candles, options = {}) {
  const {
    runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    symbol = 'XAUUSD',
    timeframe = '15m',
    tradingStyle = 'Intraday', // 'Scalping' | 'Intraday' | 'Swing' | 'All'
    backtestMode = 'STANDARD', // 'STANDARD' | 'WALK_FORWARD' | 'OPTIMIZATION'
    dateRange = {},
    settings = {},
    config = {},
    initialBalance = 10000,
    executionCosts = {
      spreadCost: 0,
      slippageCost: 0,
      commissionPerTrade: 0,
    },
    walkForwardOptions = {},
    optimizationOptions = {},
  } = options;

  const startTime = Date.now();

  if (!candles || candles.length === 0) {
    return {
      runId,
      status: 'FAILED',
      error: 'No historical candle data provided for backtest execution.',
      createdAt: new Date().toISOString(),
    };
  }

  // 1. Primary Strategy & Execution Analysis Run
  const analysisResult = await runConfluenceEngine(candles, settings, { ...config, symbol, timeframe });
  const rawTradeLog = analysisResult.tradeLog || [];

  // Filter trade log by trading style if specific style requested
  const filteredTradeLog = tradingStyle === 'All' 
    ? rawTradeLog 
    : rawTradeLog.filter(t => !t.tradingStyle || t.tradingStyle === tradingStyle);

  // 2. Comprehensive Performance Analytics
  const metrics = calculateBacktestMetrics(filteredTradeLog, initialBalance, executionCosts);

  // 3. Mode Specific Evaluations
  let walkForwardResult = null;
  if (backtestMode === 'WALK_FORWARD' || options.includeWalkForward) {
    walkForwardResult = await runWalkForwardValidation(candles, {
      ...walkForwardOptions,
      symbol,
      timeframe,
      settings,
      config,
      initialBalance,
      executionCosts,
    });
  }

  let optimizationResult = null;
  if (backtestMode === 'OPTIMIZATION' || options.includeOptimization) {
    optimizationResult = await runStrategyOptimization(candles, {
      ...optimizationOptions,
      baseSettings: settings,
      config,
      initialBalance,
      executionCosts,
    });
  }

  const executionTimeMs = Date.now() - startTime;

  return {
    runId,
    status: 'COMPLETED',
    createdAt: new Date().toISOString(),
    executionTimeMs,
    provenance: {
      symbol,
      timeframe,
      tradingStyle,
      backtestMode,
      dateRange: {
        from: candles[0]?.time ? new Date(candles[0].time).toISOString() : dateRange.from,
        to: candles[candles.length - 1]?.time ? new Date(candles[candles.length - 1].time).toISOString() : dateRange.to,
      },
      candlesCount: candles.length,
      isSimulated: analysisResult.isSimulated || false,
    },
    settingsSnapshot: settings,
    tradeLog: filteredTradeLog,
    metrics,
    walkForwardResult,
    optimizationResult,
    diagnostics: analysisResult.diagnostics || null,
  };
}
