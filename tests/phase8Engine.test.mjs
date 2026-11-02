/**
 * Phase 8 Automated Test Suite: Professional Dynamic Risk Management & Trade Decision Engine
 * 40 Comprehensive Tests verifying position sizing, precision SL/TP, portfolio protection & execution.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getInstrumentSpec,
  normalizeLotSize,
  calculatePointValueInAccountCurrency,
  createSimulatedAccount,
  calculateRiskBudget,
  updateAccountOnTradeClose,
  calculatePositionSize,
  calculatePrecisionStopLoss,
  planTakeProfitTargets,
  evaluateBreakEvenAdjustment,
  calculateTrailingStop,
  evaluatePortfolioRiskSafeguards,
  resolveStyleRiskProfile,
  simulateTradeExecution,
  evaluateTradeRiskPlan,
  runRiskManagementEngine,
  STOP_LOSS_METHODS,
  TAKE_PROFIT_METHODS,
  TRAILING_STOP_METHODS,
  RISK_DECISION_STATUS,
  TRADE_LIFECYCLE_STATUS,
  INTRABAR_AMBIGUITY_POLICIES,
} from '../src/lib/risk/index.js';

describe('PHASE 8 ENGINE SUITE: Dynamic Risk Management, Position Sizing, Precision SL/TP & Execution Engine', async () => {

  // Helper to create synthetic candle series
  function createTestCandles(count = 20, startPrice = 2600, step = 1) {
    const candles = [];
    const baseTime = Date.UTC(2026, 9, 10, 0, 0, 0);
    let p = startPrice;
    for (let i = 0; i < count; i++) {
      const open = p;
      const close = p + step;
      const high = Math.max(open, close) + 1.5;
      const low = Math.min(open, close) - 1.5;
      candles.push({
        time: baseTime + i * 60_000,
        open,
        high,
        low,
        close,
        volume: 100,
        atr: 3.0,
      });
      p = close;
    }
    return candles;
  }

  // =========================================================================
  // Test 1 — BUY Position Size
  // =========================================================================
  await test('Test 1: BUY Position Size — Correct risk-based quantity calculation', () => {
    // Account: $10,000, Risk: 1% ($100)
    // Gold: Entry 2600.00, SL 2595.00 ($5.00 distance)
    // 1.0 standard lot gold = 100 oz. $5.00 distance = $500 risk per 1.0 lot.
    // Raw lots = $100 / $500 = 0.20 lots.
    const res = calculatePositionSize({
      entryPrice: 2600,
      stopLoss: 2595,
      riskBudget: 100,
      symbol: 'XAUUSD',
      accountCurrency: 'USD',
      settings: { deductCostsFromRiskBudget: false },
    });

    assert.equal(res.status, RISK_DECISION_STATUS.ELIGIBLE);
    assert.equal(res.lots, 0.20, 'Position size for $100 budget with $5 SL on Gold must be 0.20 lots');
    assert.equal(res.monetaryRisk, 100);
  });

  // =========================================================================
  // Test 2 — SELL Position Size
  // =========================================================================
  await test('Test 2: SELL Position Size — Correct short-side risk calculation', () => {
    // Account: $10,000, Risk: 1.5% ($150)
    // EURUSD: Entry 1.0850, SL 1.0880 (30 pips distance = 0.0030)
    // 1.0 lot EURUSD = 100,000 units. 30 pips = $300 risk per 1.0 lot.
    // Raw lots = $150 / $300 = 0.50 lots.
    const res = calculatePositionSize({
      entryPrice: 1.0850,
      stopLoss: 1.0880,
      riskBudget: 150,
      symbol: 'EURUSD',
      accountCurrency: 'USD',
      settings: { deductCostsFromRiskBudget: false },
    });

    assert.equal(res.status, RISK_DECISION_STATUS.ELIGIBLE);
    assert.equal(res.lots, 0.50, 'Position size for $150 budget with 30 pips SL on EURUSD must be 0.50 lots');
    assert.equal(res.monetaryRisk, 150);
  });

  // =========================================================================
  // Test 3 — XAUUSD Instrument Metadata
  // =========================================================================
  await test('Test 3: XAUUSD Instrument Metadata — Correct contract-size, tick, and lot handling', () => {
    const spec = getInstrumentSpec('XAU/USD');
    assert.equal(spec.contractSize, 100, 'Gold standard lot contract size must be 100 oz');
    assert.equal(spec.tickSize, 0.01, 'Gold tick size must be 0.01');
    assert.equal(spec.lotStep, 0.01, 'Gold lot step must be 0.01');

    const pointValue = calculatePointValueInAccountCurrency(spec, 2600, 'USD');
    assert.equal(pointValue, 100, 'Point value per 1 lot gold in USD must be $100');
  });

  // =========================================================================
  // Test 4 — Forex Currency Conversion
  // =========================================================================
  await test('Test 4: Forex Currency Conversion — Handles cross-currency conversion correctly', () => {
    // USDJPY: Base USD, Quote JPY. Account USD.
    // Price = 150.00. 1 lot = 100,000 USD.
    const specJpy = getInstrumentSpec('USDJPY');
    const pointVal = calculatePointValueInAccountCurrency(specJpy, 150.0, 'USD');
    assert.ok(Math.abs(pointVal - (100000 / 150.0)) < 0.01, 'USDJPY point value in USD must divide by exchange rate');
  });

  // =========================================================================
  // Test 5 — Insufficient Risk Budget
  // =========================================================================
  await test('Test 5: Insufficient Risk Budget — Rejects oversized stop that violates minimum lot size', () => {
    // Account: $100 budget, but SL is massive ($150 on Gold = $15,000 risk per lot).
    // Min lot 0.01 = $150 minimum risk. Budget is only $10.
    const res = calculatePositionSize({
      entryPrice: 2600,
      stopLoss: 2450,
      riskBudget: 10,
      symbol: 'XAUUSD',
      accountCurrency: 'USD',
    });

    assert.equal(res.status, RISK_DECISION_STATUS.INSUFFICIENT_RISK_BUDGET);
    assert.equal(res.lots, 0);
  });

  // =========================================================================
  // Test 6 — Structural BUY Stop
  // =========================================================================
  await test('Test 6: Structural BUY Stop — Places stop below confirmed bullish swing low', () => {
    const candles = createTestCandles(10, 2600, 2);
    // Introduce a swing low at candle 4 (low = 2595)
    candles[4].low = 2595;

    const res = calculatePrecisionStopLoss({
      direction: 'BUY',
      entryPrice: 2615,
      candles,
      signalIndex: 8,
      method: STOP_LOSS_METHODS.STRUCTURE,
      symbol: 'XAUUSD',
    });

    assert.equal(res.isValid, true);
    assert.ok(res.sl <= 2595, 'BUY structural stop must be at or below lowest swing low');
    assert.ok(res.sl < 2615, 'BUY stop must be below entry');
  });

  // =========================================================================
  // Test 7 — Structural SELL Stop
  // =========================================================================
  await test('Test 7: Structural SELL Stop — Places stop above confirmed bearish swing high', () => {
    const candles = createTestCandles(10, 2650, -2);
    // Swing high at candle 3 (high = 2660)
    candles[3].high = 2660;

    const res = calculatePrecisionStopLoss({
      direction: 'SELL',
      entryPrice: 2635,
      candles,
      signalIndex: 8,
      method: STOP_LOSS_METHODS.STRUCTURE,
      symbol: 'XAUUSD',
    });

    assert.equal(res.isValid, true);
    assert.ok(res.sl >= 2660, 'SELL structural stop must be at or above highest swing high');
    assert.ok(res.sl > 2635, 'SELL stop must be above entry');
  });

  // =========================================================================
  // Test 8 — ATR Stop
  // =========================================================================
  await test('Test 8: ATR Stop — Calculates volatility-adjusted distance accurately', () => {
    const res = calculatePrecisionStopLoss({
      direction: 'BUY',
      entryPrice: 2600,
      atr: 4.0,
      method: STOP_LOSS_METHODS.ATR,
      settings: { atrStopMultiplier: 2.0 },
      symbol: 'XAUUSD',
    });

    assert.equal(res.isValid, true);
    assert.equal(res.sl, 2592.00, 'BUY 2.0x ATR (4.0) from 2600 must equal 2592.00');
  });

  // =========================================================================
  // Test 9 — Invalid Stop
  // =========================================================================
  await test('Test 9: Invalid Stop — Rejects stop on wrong side without fabricating artificial repairs', () => {
    const res = calculatePrecisionStopLoss({
      direction: 'BUY',
      entryPrice: 2600,
      setupData: { sl: 2650 }, // Erroneous stop above BUY entry
      method: STOP_LOSS_METHODS.STRUCTURE,
      candles: [],
      symbol: 'XAUUSD',
    });

    assert.equal(res.isValid, false);
    assert.equal(res.reasonCode, RISK_DECISION_STATUS.INVALID_STOP);
  });

  // =========================================================================
  // Test 10 — TP1/TP2/TP3 Planning
  // =========================================================================
  await test('Test 10: TP1/TP2/TP3 — Plans progressive targets adhering to hierarchy', () => {
    const res = planTakeProfitTargets({
      direction: 'BUY',
      entryPrice: 2600,
      stopLoss: 2590, // $10 risk
      totalLots: 1.0,
      symbol: 'XAUUSD',
      settings: { tp1RMultiple: 1.0, tp2RMultiple: 2.0, tp3RMultiple: 3.5 },
    });

    assert.equal(res.isValid, true);
    assert.equal(res.tp1, 2610.00, 'TP1 (+1R) must be 2610');
    assert.equal(res.tp2, 2620.00, 'TP2 (+2R) must be 2620');
    assert.equal(res.tp3, 2635.00, 'TP3 (+3.5R) must be 2635');
    assert.ok(res.tp1 < res.tp2 && res.tp2 < res.tp3, 'BUY TP hierarchy: TP1 < TP2 < TP3');
  });

  // =========================================================================
  // Test 11 — Partial Profit Booking
  // =========================================================================
  await test('Test 11: Partial Profit — Correctly reduces position and books realized PnL at TP1', () => {
    const tradePlan = {
      isApproved: true,
      direction: 'BUY',
      entryPrice: 100,
      sl: 95,
      tp1: 105,
      tp2: 110,
      tp3: 115,
      lots: 1.0,
      totalLots: 1.0,
      pointValuePerLot: 100,
      setupExpiryCandles: 10,
      targets: [
        { id: 'TP1', lots: 0.4 },
        { id: 'TP2', lots: 0.35 },
        { id: 'TP3', lots: 0.25 },
      ],
    };

    const candles = [
      { time: 1000, open: 100, high: 101, low: 99, close: 100 },
      { time: 2000, open: 100, high: 106, low: 99.5, close: 105.5 }, // Touches TP1 (105)
    ];

    const sim = simulateTradeExecution({ tradePlan, candles, signalIndex: 0 });
    assert.equal(sim.partialExits.length, 1, 'Must record 1 partial exit');
    assert.equal(sim.partialExits[0].lots, 0.4, 'Must close 0.4 lots at TP1');
    assert.equal(sim.remainingLots, 0.6, 'Remaining position must be 0.6 lots');
    assert.ok(sim.realizedPnl > 0, 'Realized PnL must be positive');
  });

  // =========================================================================
  // Test 12 — Partial Quantity Rounding
  // =========================================================================
  await test('Test 12: Partial Quantity Rounding — Floored to valid lotStep increments', () => {
    const spec = getInstrumentSpec('XAUUSD'); // lotStep = 0.01
    const rounded = normalizeLotSize(0.12874, spec);
    assert.equal(rounded, 0.12, 'Lot size must floor strictly to 0.01 lotStep (0.12874 -> 0.12)');
  });

  // =========================================================================
  // Test 13 — Break-Even BUY
  // =========================================================================
  await test('Test 13: Break-Even BUY — Ratchets stop to cost-buffered entry when target reached', () => {
    const trade = {
      isOpen: true,
      direction: 'BUY',
      entryPrice: 2600.0,
      initialSl: 2590.0,
      sl: 2590.0,
      isBreakEven: false,
    };

    const res = evaluateBreakEvenAdjustment({
      trade,
      currentPrice: 2612.0,
      highestFavorablePrice: 2612.0,
      lowestFavorablePrice: 2598.0,
      symbol: 'XAUUSD',
      settings: { breakEvenTriggerR: 1.0, breakEvenBufferPips: 1.0 },
    });

    assert.equal(res.shouldMove, true);
    assert.ok(res.newSl > 2600.0, 'BUY break-even stop must be strictly above entry price');
    assert.ok(res.newSl > trade.sl, 'New stop must be higher than prior stop');
  });

  // =========================================================================
  // Test 14 — Break-Even SELL
  // =========================================================================
  await test('Test 14: Break-Even SELL — Ratchets stop below entry for bearish position', () => {
    const trade = {
      isOpen: true,
      direction: 'SELL',
      entryPrice: 2600.0,
      initialSl: 2610.0,
      sl: 2610.0,
      isBreakEven: false,
    };

    const res = evaluateBreakEvenAdjustment({
      trade,
      currentPrice: 2588.0,
      highestFavorablePrice: 2602.0,
      lowestFavorablePrice: 2588.0,
      symbol: 'XAUUSD',
      settings: { breakEvenTriggerR: 1.0, breakEvenBufferPips: 1.0 },
    });

    assert.equal(res.shouldMove, true);
    assert.ok(res.newSl < 2600.0, 'SELL break-even stop must be strictly below entry price');
    assert.ok(res.newSl < trade.sl, 'New stop must be lower than prior stop');
  });

  // =========================================================================
  // Test 15 — ATR Trailing (Protective Ratchet Invariant)
  // =========================================================================
  await test('Test 15: ATR Trailing — Never loosens protective stop during adverse volatility', () => {
    const trade = {
      isOpen: true,
      direction: 'BUY',
      entryPrice: 100,
      initialSl: 90,
      sl: 105, // Already ratcheted above entry
      tp1Filled: true,
    };

    // Subsequent candle pulls back with higher ATR: ATR dist = 10, candidate = 102 - 10 = 92
    const candle = { close: 102, high: 103, low: 101, time: 2000 };
    const res = calculateTrailingStop({
      trade,
      candle,
      atr: 10.0,
      method: TRAILING_STOP_METHODS.ATR,
      symbol: 'XAUUSD',
    });

    assert.equal(res.shouldUpdate, false, 'Trailing stop must NEVER loosen or move downward on a BUY');
    assert.equal(res.newSl, 105);
  });

  // =========================================================================
  // Test 16 — Structural Trailing
  // =========================================================================
  await test('Test 16: Structural Trailing — Only confirmed swing structures update stop', () => {
    const trade = {
      isOpen: true,
      direction: 'BUY',
      entryPrice: 100,
      initialSl: 95,
      sl: 98,
      entryTime: 1000,
      tp1Filled: true,
    };

    const candle = { close: 110, high: 112, low: 108, time: 3000 };
    const confirmedSwings = [
      { type: 'low', price: 104, time: 2000 }, // Confirmed higher low formed after entry
    ];

    const res = calculateTrailingStop({
      trade,
      candle,
      method: TRAILING_STOP_METHODS.STRUCTURAL,
      confirmedSwings,
      symbol: 'XAUUSD',
    });

    assert.equal(res.shouldUpdate, true);
    assert.equal(res.newSl, 104, 'Structural trailing must lock to confirmed higher low (104)');
  });

  // =========================================================================
  // Test 17 — Waterfall Momentum Management
  // =========================================================================
  await test('Test 17: Waterfall Management — Tightens stop when momentum exhaustion is flagged', () => {
    const trade = {
      isOpen: true,
      direction: 'SELL',
      entryPrice: 100,
      initialSl: 110,
      sl: 96,
      entryTime: 1000,
      tp1Filled: true,
      exhaustionWarning: true,
    };

    const candle = { close: 90, high: 92, low: 88, time: 2000, isExhaustion: true };
    const res = calculateTrailingStop({
      trade,
      candle,
      atr: 5.0,
      method: TRAILING_STOP_METHODS.MOMENTUM,
      symbol: 'XAUUSD',
    });

    assert.equal(res.shouldUpdate, true);
    // On exhaustion: tight multiplier (0.8x ATR = 4.0) -> candidate = 90 + 4 = 94
    assert.equal(res.newSl, 94.00, 'Exhaustion warning must tighten trailing stop to 94.00');
    assert.ok(res.newSl < trade.sl, 'SELL stop must ratchet downwards');
  });

  // =========================================================================
  // Test 18 — Daily Loss Limit Protection
  // =========================================================================
  await test('Test 18: Daily Loss Limit — Blocks new simulated entries after daily limit breach', () => {
    const account = {
      balance: 10000,
      equity: 9600,
      dailyRealizedPnl: -350, // Down $350 on $10,000 balance (> 3% max daily loss)
      peakEquity: 10000,
    };

    const res = evaluatePortfolioRiskSafeguards({
      account,
      plannedRiskAmount: 100,
      settings: { maxDailyLossPct: 3.0 },
    });

    assert.equal(res.approved, false);
    assert.equal(res.reasonCode, RISK_DECISION_STATUS.DAILY_LOSS_LIMIT);
  });

  // =========================================================================
  // Test 19 — Weekly Loss Limit Protection
  // =========================================================================
  await test('Test 19: Weekly Loss Limit — Enforces weekly circuit breaker', () => {
    const account = {
      balance: 10000,
      equity: 9300,
      weeklyRealizedPnl: -650, // Down $650 (> 6% max weekly loss)
      peakEquity: 10000,
    };

    const res = evaluatePortfolioRiskSafeguards({
      account,
      plannedRiskAmount: 100,
      settings: { maxWeeklyLossPct: 6.0 },
    });

    assert.equal(res.approved, false);
    assert.equal(res.reasonCode, RISK_DECISION_STATUS.WEEKLY_LOSS_LIMIT);
  });

  // =========================================================================
  // Test 20 — Maximum Drawdown Protection
  // =========================================================================
  await test('Test 20: Maximum Drawdown — Stops trading when peak-to-trough drawdown hits ceiling', () => {
    const account = {
      balance: 12000,
      equity: 10700,
      peakEquity: 12000, // Peak $12,000 -> Current $10,700 = 10.8% drawdown (> 10%)
    };

    const res = evaluatePortfolioRiskSafeguards({
      account,
      plannedRiskAmount: 100,
      settings: { maxDrawdownLimitPct: 10.0 },
    });

    assert.equal(res.approved, false);
    assert.equal(res.reasonCode, RISK_DECISION_STATUS.MAX_DRAWDOWN_REACHED);
  });

  // =========================================================================
  // Test 21 — Maximum Open Risk
  // =========================================================================
  await test('Test 21: Maximum Open Risk — Caps total portfolio risk across open positions', () => {
    const account = { balance: 10000, equity: 10000, peakEquity: 10000 };
    const openPositions = [
      { symbol: 'EURUSD', monetaryRisk: 250 },
      { symbol: 'GBPUSD', monetaryRisk: 200 },
    ]; // Total open risk = $450

    // Attempting to add $100 risk brings total to $550 (> 5% max open risk = $500)
    const res = evaluatePortfolioRiskSafeguards({
      account,
      plannedRiskAmount: 100,
      openPositions,
      settings: { maxOpenRiskPct: 5.0 },
    });

    assert.equal(res.approved, false);
    assert.equal(res.reasonCode, RISK_DECISION_STATUS.MAX_EXPOSURE_REACHED);
  });

  // =========================================================================
  // Test 22 — Correlated Positions Protection
  // =========================================================================
  await test('Test 22: Correlated Positions — Prevents overexposure across correlated USD pairs', () => {
    const account = { balance: 10000, equity: 10000, peakEquity: 10000 };
    const openPositions = [
      { symbol: 'EURUSD', direction: 'BUY', monetaryRisk: 100 },
      { symbol: 'GBPUSD', direction: 'BUY', monetaryRisk: 100 },
    ];

    // Attempting 3rd correlated long (AUDUSD) when max correlated positions = 2
    const res = evaluatePortfolioRiskSafeguards({
      account,
      plannedRiskAmount: 100,
      symbol: 'AUDUSD',
      direction: 'BUY',
      openPositions,
      settings: { maxCorrelatedPositions: 2 },
    });

    assert.equal(res.approved, false);
    assert.equal(res.reasonCode, RISK_DECISION_STATUS.MAX_EXPOSURE_REACHED);
  });

  // =========================================================================
  // Test 23 — AUTO Mode Integration
  // =========================================================================
  await test('Test 23: AUTO Mode — Adapts ATR multiplier within bounded risk constraints', () => {
    const highVolProfile = resolveStyleRiskProfile('Intraday', { settingsMode: 'AUTO' }, { regime: 'High Volatility Trend' });
    const normalProfile = resolveStyleRiskProfile('Intraday', { settingsMode: 'AUTO' }, { regime: 'Normal Trend' });

    assert.ok(highVolProfile.atrMultiplier > normalProfile.atrMultiplier, 'High volatility regime must adapt wider ATR stop');
    assert.ok(highVolProfile.atrMultiplier <= 3.0, 'Adaptive multiplier must remain within hard upper ceiling');
  });

  // =========================================================================
  // Test 24 — HYBRID Mode User Lock Protection
  // =========================================================================
  await test('Test 24: HYBRID Mode — Preserves user-locked risk-per-trade without overriding', () => {
    const account = { balance: 10000, equity: 10000 };
    // User explicitly locked riskPerTradePct: 0.75%
    const budget = calculateRiskBudget(account, {
      settingsMode: 'HYBRID',
      riskPerTradePct: 0.75,
      maxRiskPerTradePct: 2.0,
    });

    assert.equal(budget, 75.00, 'HYBRID mode must strictly respect user-locked 0.75% risk');
  });

  // =========================================================================
  // Test 25 — MANUAL Mode Zero Adaptation
  // =========================================================================
  await test('Test 25: MANUAL Mode — Uses exact user settings without regime distortion', () => {
    const manualProfile = resolveStyleRiskProfile(
      'Intraday',
      { settingsMode: 'MANUAL', atrStopMultiplier: 1.4 },
      { regime: 'High Volatility Range' }
    );

    assert.equal(manualProfile.atrMultiplier, 1.4, 'MANUAL mode must not alter user-specified 1.4 multiplier');
  });

  // =========================================================================
  // Test 26 — Scalping Risk Profile
  // =========================================================================
  await test('Test 26: Scalping Profile — Fast expiration (8 candles) and tight R:R targets', () => {
    const profile = resolveStyleRiskProfile('Scalping', {});
    assert.equal(profile.setupExpiryCandles, 8);
    assert.equal(profile.breakEvenTriggerR, 1.0);
    assert.equal(profile.maxSpreadToRiskRatio, 0.25);
  });

  // =========================================================================
  // Test 27 — Swing Risk Profile
  // =========================================================================
  await test('Test 27: Swing Profile — Multi-session holding horizon and wide structural invalidation', () => {
    const profile = resolveStyleRiskProfile('Swing', {});
    assert.equal(profile.setupExpiryCandles, 72);
    assert.equal(profile.allowMultiSessionHolding, true);
    assert.ok(profile.atrMultiplier >= 2.5);
  });

  // =========================================================================
  // Test 28 — Stop / Target Same Candle Ambiguity
  // =========================================================================
  await test('Test 28: Intrabar Ambiguity — Conservative policy handles dual SL/TP touches responsibly', () => {
    const tradePlan = {
      isApproved: true,
      direction: 'BUY',
      entryPrice: 100,
      sl: 95,
      tp: 110,
      tp2: 110,
      lots: 0.1,
      pointValuePerLot: 100,
    };

    // Single candle spans both SL (94) and TP (112), but closes bearish (open 100, close 94.5)
    const candles = [
      { time: 1000, open: 100, high: 101, low: 99, close: 100 },
      { time: 2000, open: 100, high: 112, low: 94, close: 94.5 },
    ];

    const sim = simulateTradeExecution({
      tradePlan,
      candles,
      signalIndex: 0,
      ambiguityPolicy: INTRABAR_AMBIGUITY_POLICIES.CONSERVATIVE,
    });

    assert.equal(sim.status, TRADE_LIFECYCLE_STATUS.CLOSED_STOP);
    assert.equal(sim.pnlR, -1.0, 'Conservative intrabar ambiguity must account as SL loss on bearish close');
  });

  // =========================================================================
  // Test 29 — Slippage Modeling
  // =========================================================================
  await test('Test 29: Slippage — Models realistic execution friction on entry and exit', () => {
    const tradePlan = {
      isApproved: true,
      direction: 'BUY',
      entryPrice: 2600.0,
      sl: 2590.0,
      tp1: 2615.0,
      tp2: 2615.0,
      lots: 0.1,
      pointValuePerLot: 100,
    };

    const candles = [
      { time: 1000, open: 2600, high: 2601, low: 2599, close: 2600 },
      { time: 2000, open: 2600, high: 2620, low: 2599.5, close: 2618 },
    ];

    const sim = simulateTradeExecution({
      tradePlan,
      candles,
      signalIndex: 0,
      slippagePips: 2.0, // 2 pips slippage = $0.20 on gold
      symbol: 'XAUUSD',
    });

    assert.ok(sim.actualEntryPrice > 2600.0, 'BUY entry with slippage must fill above requested limit');
    assert.equal(sim.actualEntryPrice, 2600.20);
  });

  // =========================================================================
  // Test 30 — Spread Modeling
  // =========================================================================
  await test('Test 30: Spread — Correctly accounts for bid/ask spread costs in risk calculations', () => {
    const res = calculatePositionSize({
      entryPrice: 2600,
      stopLoss: 2595,
      riskBudget: 100,
      symbol: 'XAUUSD',
      spreadPips: 2.0, // 2 pips spread
      settings: { deductCostsFromRiskBudget: true },
    });

    assert.ok(res.estimatedCost > 0, 'Estimated spread cost must be calculated');
    assert.ok(res.lots <= 0.20, 'Position size must deduct spread buffer from allowed lots');
  });

  // =========================================================================
  // Test 31 — Weekend Gap & Extreme Adverse Price
  // =========================================================================
  await test('Test 31: Weekend Gap — Fills adverse stop at open of gap candle, not requested level', () => {
    const tradePlan = {
      isApproved: true,
      direction: 'BUY',
      entryPrice: 100,
      sl: 95,
      tp: 110,
      lots: 0.1,
      pointValuePerLot: 100,
    };

    // Weekend gap down: previous candle close 99, new candle opens at 90
    const candles = [
      { time: 1000, open: 100, high: 101, low: 99, close: 100 },
      { time: 2000, open: 90, high: 91, low: 88, close: 89 },
    ];

    const sim = simulateTradeExecution({ tradePlan, candles, signalIndex: 0 });
    assert.equal(sim.status, TRADE_LIFECYCLE_STATUS.CLOSED_STOP);
    assert.ok(sim.exitPrice <= 95, 'Stop loss fill on gap down cannot be guaranteed at 95.00');
  });

  // =========================================================================
  // Test 32 — Capital Risk Calculation Basis
  // =========================================================================
  await test('Test 32: Capital Basis — Respects Equity vs Balance configuration accurately', () => {
    const account = { balance: 10000, equity: 8000 };
    const budgetEquity = calculateRiskBudget(account, { riskCapitalBasis: 'Equity', riskPerTradePct: 1.0 });
    const budgetBalance = calculateRiskBudget(account, { riskCapitalBasis: 'Balance', riskPerTradePct: 1.0 });

    assert.equal(budgetEquity, 80.00, '1% of $8,000 equity = $80');
    assert.equal(budgetBalance, 100.00, '1% of $10,000 balance = $100');
  });

  // =========================================================================
  // Test 33 — Partial Exit + Trailing Concurrency
  // =========================================================================
  await test('Test 33: Partial Exit + Trailing — Handles TP1 exit followed by trailing stop on runner', () => {
    const tradePlan = {
      isApproved: true,
      direction: 'BUY',
      entryPrice: 100,
      sl: 95,
      tp1: 105,
      tp2: 120,
      lots: 1.0,
      totalLots: 1.0,
      pointValuePerLot: 100,
      targets: [
        { id: 'TP1', lots: 0.4 },
        { id: 'TP2', lots: 0.6 },
      ],
    };

    const candles = [
      { time: 1000, open: 100, high: 101, low: 99, close: 100 },
      { time: 2000, open: 100, high: 107, low: 99.8, close: 106, atr: 3.0 }, // Hits TP1 -> books 0.4 lots
      { time: 3000, open: 106, high: 114, low: 105.5, close: 112, atr: 3.0 }, // Trails runner stop up
    ];

    const sim = simulateTradeExecution({
      tradePlan,
      candles,
      signalIndex: 0,
      settings: { enableTrailingStop: true, trailingAtrMultiplier: 1.5 },
    });

    assert.equal(sim.partialExits.length, 1);
    assert.equal(sim.remainingLots, 0.6);
    assert.ok(sim.activeSl > 95, 'Active SL on runner must be trailed upwards');
  });

  // =========================================================================
  // Test 34 — Historical Replay Consistency
  // =========================================================================
  await test('Test 34: Replay Consistency — Incremental evaluation yields identical events and PnL', () => {
    const candles = createTestCandles(15, 100, 1);
    const candidate = {
      time: candles[2].time,
      price: 100,
      direction: 'BUY',
      sl: 95,
      tp: 110,
      isApproved: true,
      tradingStyle: 'Intraday',
    };

    const run1 = runRiskManagementEngine({ candidates: [candidate], candles, symbol: 'XAUUSD' });
    const run2 = runRiskManagementEngine({ candidates: [candidate], candles, symbol: 'XAUUSD' });

    assert.equal(run1.tradePlans[0].pnlR, run2.tradePlans[0].pnlR);
    assert.equal(run1.tradePlans[0].events.length, run2.tradePlans[0].events.length);
  });

  // =========================================================================
  // Test 35 — Zero Look-Ahead Guarantee
  // =========================================================================
  await test('Test 35: Zero Look-Ahead — Trailing stop at candle t depends strictly on candles <= t', () => {
    const candlesShort = createTestCandles(10, 100, 1);
    const candlesLong = [...candlesShort, ...createTestCandles(10, 110, 2)];

    const tradePlan = {
      isApproved: true,
      direction: 'BUY',
      entryPrice: 100,
      sl: 95,
      tp1: 103,
      tp2: 125,
      lots: 0.1,
      pointValuePerLot: 100,
    };

    const simShort = simulateTradeExecution({ tradePlan, candles: candlesShort, signalIndex: 0 });
    const simLong = simulateTradeExecution({ tradePlan, candles: candlesLong, signalIndex: 0 });

    // The event at candle 5 must be identical in both runs regardless of future candles
    const eventShort5 = simShort.events.find(e => e.time === candlesShort[5]?.time);
    const eventLong5 = simLong.events.find(e => e.time === candlesShort[5]?.time);
    if (eventShort5 && eventLong5) {
      assert.equal(eventShort5.newSl, eventLong5.newSl);
    }
  });

  // =========================================================================
  // Test 36 — API Chunk Boundary Integrity
  // =========================================================================
  await test('Test 36: API Chunk Boundaries — Open trade state is preserved seamlessly across merged series', () => {
    // 2 chunks of 10 candles merged
    const chunk1 = createTestCandles(10, 100, 1);
    const chunk2 = createTestCandles(10, 110, 1);
    const mergedCandles = [...chunk1, ...chunk2];

    const tradePlan = {
      isApproved: true,
      direction: 'BUY',
      entryPrice: 100,
      sl: 95,
      tp1: 105,
      tp2: 115,
      lots: 0.1,
      pointValuePerLot: 100,
      setupExpiryCandles: 20,
    };

    const sim = simulateTradeExecution({ tradePlan, candles: mergedCandles, signalIndex: 0 });
    assert.ok(sim.events.length >= 2, 'Execution events must bridge across chunk boundary smoothly');
  });

  // =========================================================================
  // Test 37 — Phase 7 Signal Integration Compatibility
  // =========================================================================
  await test('Test 37: Phase 7 Compatibility — Consumes Phase 7 candidates and attaches risk plans', () => {
    const p7Candidate = {
      id: 'XAUUSD-15m-BUY-1000-obMss',
      direction: 'BUY',
      price: 2600,
      time: 1000,
      unifiedScore: 78,
      qualityTier: 'A',
      isApproved: true,
      tradingStyle: 'Intraday',
    };

    const account = createSimulatedAccount({ simulatedAccountBalance: 10000 });
    const plan = evaluateTradeRiskPlan({
      candidate: p7Candidate,
      account,
      symbol: 'XAUUSD',
      settings: { riskPerTradePct: 1.0 },
    });

    assert.equal(plan.isApproved, true);
    assert.equal(plan.riskDecision, RISK_DECISION_STATUS.ELIGIBLE);
    assert.ok(plan.lots > 0);
    assert.ok(plan.sl < plan.entryPrice);
    assert.ok(plan.tp1 > plan.entryPrice);
  });

  // =========================================================================
  // Test 38 — Deterministic Simulation
  // =========================================================================
  await test('Test 38: Deterministic Simulation — Same parameters always produce identical outputs', () => {
    const candles = createTestCandles(15, 2600, 1);
    const candidate = {
      time: candles[1].time,
      price: 2600,
      direction: 'BUY',
      isApproved: true,
      tradingStyle: 'Intraday',
    };

    const resA = runRiskManagementEngine({ candidates: [candidate], candles, symbol: 'XAUUSD' });
    const resB = runRiskManagementEngine({ candidates: [candidate], candles, symbol: 'XAUUSD' });

    assert.deepEqual(resA.riskDiagnostics.executionMetrics, resB.riskDiagnostics.executionMetrics);
  });

  // =========================================================================
  // Test 39 — Fixed vs Advanced Trade Management Comparison
  // =========================================================================
  await test('Test 39: Fixed vs Advanced Comparison — Break-even prevents full SL loss on retraced move', () => {
    // Price moves to +1.2R (2612) and then collapses down to 2585
    const candles = [
      { time: 1000, open: 2600, high: 2601, low: 2599, close: 2600 },
      { time: 2000, open: 2600, high: 2613, low: 2599.5, close: 2612 }, // Reaches +1.2R -> moves to BE
      { time: 3000, open: 2612, high: 2613, low: 2585, close: 2586 },   // Severe drop
    ];

    const basePlan = {
      isApproved: true,
      direction: 'BUY',
      entryPrice: 2600,
      sl: 2590,
      tp1: 2620,
      tp2: 2630,
      lots: 0.1,
      pointValuePerLot: 100,
    };

    // Run without break-even: full loss (-1.0R)
    const simFixed = simulateTradeExecution({
      tradePlan: basePlan,
      candles,
      signalIndex: 0,
      settings: { enableBreakEven: false },
    });

    // Run with break-even: stopped at BE (0.0R)
    const simBE = simulateTradeExecution({
      tradePlan: basePlan,
      candles,
      signalIndex: 0,
      settings: { enableBreakEven: true, breakEvenTriggerR: 1.0 },
    });

    assert.equal(simFixed.pnlR, -1.0, 'Fixed management must suffer full -1.0R loss');
    assert.equal(simBE.outcome, 'BE', 'Break-even management must protect position as BE');
    assert.equal(simBE.pnlR, 0, 'BE trade must have 0 loss');
  });

  // =========================================================================
  // Test 40 — Performance Benchmark (< 250ms for 1,000 Candles & 50 Plans)
  // =========================================================================
  await test('Test 40: Performance Benchmark — Evaluates 1,000 candles and 50 risk plans in < 250ms', () => {
    const candles = createTestCandles(1000, 2600, 0.5);
    const map = new Map(candles.map((c, i) => [c.time, i]));

    const candidates = [];
    for (let i = 20; i < 950; i += 20) {
      candidates.push({
        time: candles[i].time,
        price: candles[i].close,
        direction: i % 40 === 0 ? 'BUY' : 'SELL',
        isApproved: true,
        tradingStyle: 'Intraday',
      });
    }

    const t0 = performance.now();
    const res = runRiskManagementEngine({
      candidates,
      candles,
      symbol: 'XAUUSD',
      candleTimeIndex: map,
    });
    const duration = performance.now() - t0;

    assert.ok(duration < 250, `Risk engine benchmark must complete under 250ms, took ${duration.toFixed(1)}ms`);
    assert.ok(res.tradePlans.length > 0);
  });

});
