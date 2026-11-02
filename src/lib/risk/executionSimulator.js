/**
 * Phase 8 — Advanced Realistic Execution & Trade Lifecycle Simulator
 * Simulates bid/ask fills, slippage, partial exits, break-even adjustments, and trailing stops.
 */

import { TRADE_LIFECYCLE_STATUS, INTRABAR_AMBIGUITY_POLICIES } from './types.js';
import { evaluateBreakEvenAdjustment } from './breakEvenEngine.js';
import { calculateTrailingStop } from './trailingStopEngine.js';
import { getInstrumentSpec } from './instruments.js';

/**
 * Simulates full trade lifecycle execution across historical candles.
 */
export function simulateTradeExecution({
  tradePlan,
  candles = [],
  signalIndex = 0,
  symbol = 'XAUUSD',
  spreadPips = null,
  slippagePips = null,
  ambiguityPolicy = INTRABAR_AMBIGUITY_POLICIES.CONSERVATIVE,
  settings = {},
}) {
  if (!tradePlan || !tradePlan.isApproved || !tradePlan.entryPrice || !tradePlan.sl) {
    return {
      ...tradePlan,
      status: tradePlan?.status || TRADE_LIFECYCLE_STATUS.REJECTED_RISK,
      events: [],
      pnlR: 0,
      realizedPnl: 0,
    };
  }

  const spec = getInstrumentSpec(symbol);
  const isBuy = tradePlan.direction === 'BUY';
  const entryPrice = tradePlan.entryPrice;
  const initialSl = tradePlan.sl;
  const initialRisk = Math.abs(entryPrice - initialSl);
  const totalLots = tradePlan.lots || tradePlan.totalLots || 0.1;

  const effectiveSpreadPips = spreadPips !== null ? spreadPips : (spec.typicalSpreadPips || 1.0);
  const effectiveSlippagePips = slippagePips !== null ? slippagePips : (settings.assumedSlippagePips || 0.2);
  const spreadDistance = effectiveSpreadPips * spec.pipSize;
  const slippageDistance = effectiveSlippagePips * spec.pipSize;

  const expiryWindow = tradePlan.setupExpiryCandles || settings.setupExpiryCandles || 24;
  const maxCheckIndex = Math.min(candles.length - 1, signalIndex + expiryWindow);

  let currentLots = totalLots;
  let currentSl = initialSl;
  let isTriggered = false;
  let isOpen = false;
  let isBreakEven = false;
  let isTrailing = false;
  let status = TRADE_LIFECYCLE_STATUS.WAITING_FOR_ENTRY;

  let actualEntryPrice = entryPrice;
  let entryTime = null;
  let closeTime = null;
  let exitPrice = null;
  let outcome = null; // 'TP' | 'SL' | 'EXPIRED' | 'BE'

  const events = [];
  const partialExits = [];
  let cumulativeRealizedPnl = 0;
  let cumulativeRealizedR = 0;

  // Initial event
  events.push({
    type: 'PLAN_CREATED',
    time: tradePlan.time || (candles[signalIndex] ? candles[signalIndex].time : 0),
    price: entryPrice,
    sl: initialSl,
    lots: totalLots,
    status: TRADE_LIFECYCLE_STATUS.WAITING_FOR_ENTRY,
  });

  // Track favorable extremes
  let highestFavorablePrice = entryPrice;
  let lowestFavorablePrice = entryPrice;

  // Targets from plan
  const tp1 = tradePlan.tp1;
  const tp2 = tradePlan.tp2 || tradePlan.tp;
  const tp3 = tradePlan.tp3;

  let tp1Filled = false;
  let tp2Filled = false;
  let tp3Filled = false;

  for (let i = signalIndex + 1; i <= maxCheckIndex; i++) {
    const c = candles[i];
    const prevC = i > 0 ? candles[i - 1] : null;

    // 1. Check Entry Trigger (Limit / Market Entry)
    if (!isOpen) {
      // For BUY: Ask = c.high / c.low + spread. Fills if Ask <= entryPrice or Low <= entryPrice
      const entryTouched = isBuy ? (c.low <= entryPrice) : (c.high >= entryPrice);
      if (entryTouched) {
        isOpen = true;
        isTriggered = true;
        entryTime = c.time;
        // Apply slippage to entry
        actualEntryPrice = isBuy ? (entryPrice + slippageDistance) : (entryPrice - slippageDistance);
        status = TRADE_LIFECYCLE_STATUS.OPEN;

        events.push({
          type: 'ORDER_FILLED',
          time: c.time,
          price: actualEntryPrice,
          lots: currentLots,
          status: TRADE_LIFECYCLE_STATUS.OPEN,
          candleIndex: i,
        });

        highestFavorablePrice = actualEntryPrice;
        lowestFavorablePrice = actualEntryPrice;
      } else {
        continue; // Keep waiting for entry
      }
    }

    // 2. Active Trade Management
    if (isOpen) {
      if (c.high > highestFavorablePrice) highestFavorablePrice = c.high;
      if (c.low < lowestFavorablePrice) lowestFavorablePrice = c.low;

      // Check Stop Loss Trigger
      // BUY: SL hit if Low <= currentSl. SELL: SL hit if High >= currentSl
      const hitSl = isBuy ? (c.low <= currentSl) : (c.high >= currentSl);

      // Check Target Triggers
      const hitTp1 = !tp1Filled && tp1 && (isBuy ? c.high >= tp1 : c.low <= tp1);
      const hitTp2 = !tp2Filled && tp2 && (isBuy ? c.high >= tp2 : c.low <= tp2);
      const hitTp3 = !tp3Filled && tp3 && (isBuy ? c.high >= tp3 : c.low <= tp3);

      // ==========================================
      // Intrabar Ambiguity Resolution:
      // If both SL and a TP are touched on the same candle!
      // ==========================================
      if (hitSl && (hitTp1 || hitTp2 || hitTp3)) {
        if (ambiguityPolicy === INTRABAR_AMBIGUITY_POLICIES.PESSIMISTIC || 
           (ambiguityPolicy === INTRABAR_AMBIGUITY_POLICIES.CONSERVATIVE && (isBuy ? c.close < c.open : c.close > c.open))) {
          // Conservative/pessimistic: SL hit first
          isOpen = false;
          status = isBreakEven ? TRADE_LIFECYCLE_STATUS.CLOSED_STOP : TRADE_LIFECYCLE_STATUS.CLOSED_STOP;
          outcome = isBreakEven ? 'BE' : 'SL';
          closeTime = c.time;
          exitPrice = isBuy ? (currentSl - slippageDistance) : (currentSl + slippageDistance);

          const rMult = isBreakEven ? 0 : -1.0;
          const pnl = isBreakEven ? 0 : -(currentLots * initialRisk * (tradePlan.pointValuePerLot || 100));

          events.push({
            type: isBreakEven ? 'BREAK_EVEN_STOP_HIT' : 'STOP_LOSS_HIT',
            time: c.time,
            price: exitPrice,
            lots: currentLots,
            realizedPnl: pnl,
            r: rMult,
            status: TRADE_LIFECYCLE_STATUS.CLOSED_STOP,
            ambiguousCandle: true,
          });

          cumulativeRealizedPnl += pnl;
          cumulativeRealizedR += rMult;
          currentLots = 0;
          break;
        }
      }

      // 3. Process Partial Exits (TP1, TP2, TP3)
      if (hitTp1 && !tp1Filled) {
        tp1Filled = true;
        const targetObj = tradePlan.targets?.find(t => t.id === 'TP1');
        const exitLots = targetObj?.lots || (currentLots * 0.4);
        const closedLots = Math.min(currentLots, exitLots);
        currentLots = Math.max(0, currentLots - closedLots);

        const fillPrice = isBuy ? (tp1 - slippageDistance) : (tp1 + slippageDistance);
        const legR = initialRisk > 0 ? (Math.abs(fillPrice - actualEntryPrice) / initialRisk) : 1.0;
        const legPnl = closedLots * (Math.abs(fillPrice - actualEntryPrice)) * (tradePlan.pointValuePerLot || 100);

        cumulativeRealizedPnl += legPnl;
        cumulativeRealizedR += (legR * (closedLots / totalLots));

        events.push({
          type: 'PARTIAL_EXIT_TP1',
          time: c.time,
          price: fillPrice,
          lotsClosed: closedLots,
          lotsRemaining: currentLots,
          realizedPnl: legPnl,
          r: legR,
          status: currentLots > 0 ? TRADE_LIFECYCLE_STATUS.TP1_FILLED : TRADE_LIFECYCLE_STATUS.CLOSED_TARGET,
        });

        partialExits.push({ target: 'TP1', price: fillPrice, lots: closedLots, pnl: legPnl, r: legR });

        if (currentLots <= 0) {
          isOpen = false;
          status = TRADE_LIFECYCLE_STATUS.CLOSED_TARGET;
          outcome = 'TP';
          closeTime = c.time;
          exitPrice = fillPrice;
          break;
        }
      }

      if (hitTp2 && !tp2Filled && currentLots > 0) {
        tp2Filled = true;
        const targetObj = tradePlan.targets?.find(t => t.id === 'TP2');
        const exitLots = targetObj?.lots || (currentLots * 0.6);
        const closedLots = Math.min(currentLots, exitLots);
        currentLots = Math.max(0, currentLots - closedLots);

        const fillPrice = isBuy ? (tp2 - slippageDistance) : (tp2 + slippageDistance);
        const legR = initialRisk > 0 ? (Math.abs(fillPrice - actualEntryPrice) / initialRisk) : 2.0;
        const legPnl = closedLots * (Math.abs(fillPrice - actualEntryPrice)) * (tradePlan.pointValuePerLot || 100);

        cumulativeRealizedPnl += legPnl;
        cumulativeRealizedR += (legR * (closedLots / totalLots));

        events.push({
          type: 'PARTIAL_EXIT_TP2',
          time: c.time,
          price: fillPrice,
          lotsClosed: closedLots,
          lotsRemaining: currentLots,
          realizedPnl: legPnl,
          r: legR,
          status: currentLots > 0 ? TRADE_LIFECYCLE_STATUS.TP2_FILLED : TRADE_LIFECYCLE_STATUS.CLOSED_TARGET,
        });

        partialExits.push({ target: 'TP2', price: fillPrice, lots: closedLots, pnl: legPnl, r: legR });

        if (currentLots <= 0) {
          isOpen = false;
          status = TRADE_LIFECYCLE_STATUS.CLOSED_TARGET;
          outcome = 'TP';
          closeTime = c.time;
          exitPrice = fillPrice;
          break;
        }
      }

      if (hitTp3 && !tp3Filled && currentLots > 0) {
        tp3Filled = true;
        const closedLots = currentLots;
        currentLots = 0;

        const fillPrice = isBuy ? (tp3 - slippageDistance) : (tp3 + slippageDistance);
        const legR = initialRisk > 0 ? (Math.abs(fillPrice - actualEntryPrice) / initialRisk) : 3.0;
        const legPnl = closedLots * (Math.abs(fillPrice - actualEntryPrice)) * (tradePlan.pointValuePerLot || 100);

        cumulativeRealizedPnl += legPnl;
        cumulativeRealizedR += (legR * (closedLots / totalLots));

        events.push({
          type: 'FULL_EXIT_TP3',
          time: c.time,
          price: fillPrice,
          lotsClosed: closedLots,
          lotsRemaining: 0,
          realizedPnl: legPnl,
          r: legR,
          status: TRADE_LIFECYCLE_STATUS.CLOSED_TARGET,
        });

        partialExits.push({ target: 'TP3', price: fillPrice, lots: closedLots, pnl: legPnl, r: legR });

        isOpen = false;
        status = TRADE_LIFECYCLE_STATUS.CLOSED_TARGET;
        outcome = 'TP';
        closeTime = c.time;
        exitPrice = fillPrice;
        break;
      }

      // 4. Process Stop Loss if hit
      if (hitSl) {
        isOpen = false;
        outcome = isBreakEven ? 'BE' : 'SL';
        status = TRADE_LIFECYCLE_STATUS.CLOSED_STOP;
        closeTime = c.time;
        exitPrice = isBuy ? (currentSl - slippageDistance) : (currentSl + slippageDistance);

        const legR = isBreakEven ? 0 : -1.0;
        const legPnl = isBreakEven ? 0 : -(currentLots * initialRisk * (tradePlan.pointValuePerLot || 100));

        cumulativeRealizedPnl += legPnl;
        cumulativeRealizedR += (legR * (currentLots / totalLots));

        events.push({
          type: isBreakEven ? 'BREAK_EVEN_STOP_HIT' : 'STOP_LOSS_HIT',
          time: c.time,
          price: exitPrice,
          lotsClosed: currentLots,
          realizedPnl: legPnl,
          r: legR,
          status: TRADE_LIFECYCLE_STATUS.CLOSED_STOP,
        });

        currentLots = 0;
        break;
      }

      // 5. Evaluate Break-Even Adjustment
      if (!isBreakEven) {
        const beResult = evaluateBreakEvenAdjustment({
          trade: {
            isOpen: true,
            isBreakEven: false,
            direction: tradePlan.direction,
            entryPrice: actualEntryPrice,
            initialSl,
            sl: currentSl,
            tp1,
            tp1Filled,
          },
          currentPrice: c.close,
          highestFavorablePrice,
          lowestFavorablePrice,
          symbol,
          settings,
        });

        if (beResult.shouldMove) {
          isBreakEven = true;
          currentSl = beResult.newSl;
          events.push({
            type: 'BREAK_EVEN_ACTIVATED',
            time: c.time,
            newSl: currentSl,
            previousSl: beResult.previousSl,
            status: TRADE_LIFECYCLE_STATUS.BREAK_EVEN_ACTIVE,
            reason: beResult.reason,
          });
        }
      }

      // 6. Evaluate Trailing Stop
      if (settings.enableTrailingStop !== false) {
        const trailResult = calculateTrailingStop({
          trade: {
            isOpen: true,
            direction: tradePlan.direction,
            entryPrice: actualEntryPrice,
            initialSl,
            sl: currentSl,
            tp1Filled,
            entryTime,
          },
          candle: c,
          priorCandle: prevC,
          atr: c.atr,
          method: settings.trailingMethod || tradePlan.trailingMethod,
          symbol,
          settings,
        });

        if (trailResult.shouldUpdate) {
          isTrailing = true;
          currentSl = trailResult.newSl;
          events.push({
            type: 'TRAILING_STOP_UPDATED',
            time: c.time,
            newSl: currentSl,
            previousSl: trailResult.previousSl,
            reason: trailResult.trailReason,
            status: TRADE_LIFECYCLE_STATUS.TRAILING_ACTIVE,
          });
        }
      }
    }
  }

  // 7. If still waiting for entry after expiry window -> EXPIRED
  if (!isTriggered) {
    status = TRADE_LIFECYCLE_STATUS.EXPIRED;
    outcome = 'EXPIRED';
    events.push({
      type: 'SETUP_EXPIRED',
      time: candles[maxCheckIndex] ? candles[maxCheckIndex].time : 0,
      status: TRADE_LIFECYCLE_STATUS.EXPIRED,
      reason: `Limit entry price was never touched within ${expiryWindow} candles.`,
    });
  }

  return {
    ...tradePlan,
    status,
    outcome,
    isOpen,
    isTriggered,
    isBreakEven,
    isTrailing,
    entryTime,
    closeTime,
    actualEntryPrice: isTriggered ? actualEntryPrice : null,
    exitPrice,
    activeSl: currentSl,
    remainingLots: currentLots,
    pnlR: Math.round(cumulativeRealizedR * 100) / 100,
    realizedPnl: Math.round(cumulativeRealizedPnl * 100) / 100,
    events,
    partialExits,
  };
}
