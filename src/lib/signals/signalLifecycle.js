/**
 * Phase 7 — Signal Lifecycle & Realistic Execution Accounting
 * Tracks transitions from detection to approval, execution triggering, TP/SL resolution, or expiry.
 */

import { DECISION_STATUS, TRADING_STYLES } from './types.js';

export const LIFECYCLE_EXPIRY_CANDLES = {
  [TRADING_STYLES.SCALPING]: 8,
  [TRADING_STYLES.INTRADAY]: 24,
  [TRADING_STYLES.SWING]: 72,
};

/**
 * Evaluates execution outcomes on subsequent candles without look-ahead leakage.
 */
export function trackSignalLifecycle(signal, candles, signalIndex, activeSettings = {}) {
  const tradingStyle = signal.tradingStyle || TRADING_STYLES.INTRADAY;
  const expiryWindow = LIFECYCLE_EXPIRY_CANDLES[tradingStyle] || 24;
  const entryPrice = signal.price;
  const isBuy = signal.direction === 'BUY';
  const sl = signal.sl;
  const tp = signal.tp;

  let status = signal.isApproved ? DECISION_STATUS.WAITING_FOR_ENTRY : signal.status;
  let triggeredAt = null;
  let closedAt = null;
  let exitPrice = null;
  let outcome = null; // 'TP' | 'SL' | 'EXPIRED' | 'ACTIVE' | null
  let pnlR = 0;

  if (!signal.isApproved) {
    return {
      ...signal,
      status: signal.status || DECISION_STATUS.REJECTED,
      outcome: null,
      pnlR: 0,
    };
  }

  // If SL or TP are missing, cannot track outcome
  if (!sl || !tp || signalIndex >= candles.length - 1) {
    return {
      ...signal,
      status: DECISION_STATUS.APPROVED,
      outcome: 'PENDING',
      pnlR: 0,
    };
  }

  const risk = Math.abs(entryPrice - sl);
  let isTriggered = false;

  const maxCheckIndex = Math.min(candles.length - 1, signalIndex + expiryWindow);

  for (let i = signalIndex + 1; i <= maxCheckIndex; i++) {
    const c = candles[i];

    // Check entry trigger: did price trade through entryPrice?
    if (!isTriggered) {
      const entryTouched = isBuy ? (c.low <= entryPrice) : (c.high >= entryPrice);
      if (entryTouched) {
        isTriggered = true;
        triggeredAt = c.time;
        status = DECISION_STATUS.ACTIVE;
      } else {
        continue;
      }
    }

    // If triggered, check TP and SL
    if (isTriggered) {
      if (isBuy) {
        const hitSL = c.low <= sl;
        const hitTP = c.high >= tp;

        if (hitSL && hitTP) {
          // Intrabar ambiguity: conservative policy assumes SL hit first if close < open
          if (c.close < c.open) {
            status = DECISION_STATUS.CLOSED_SL;
            closedAt = c.time;
            exitPrice = sl;
            outcome = 'SL';
            pnlR = -1.0;
            break;
          } else {
            status = DECISION_STATUS.CLOSED_TP;
            closedAt = c.time;
            exitPrice = tp;
            outcome = 'TP';
            pnlR = risk > 0 ? (tp - entryPrice) / risk : 1.5;
            break;
          }
        } else if (hitSL) {
          status = DECISION_STATUS.CLOSED_SL;
          closedAt = c.time;
          exitPrice = sl;
          outcome = 'SL';
          pnlR = -1.0;
          break;
        } else if (hitTP) {
          status = DECISION_STATUS.CLOSED_TP;
          closedAt = c.time;
          exitPrice = tp;
          outcome = 'TP';
          pnlR = risk > 0 ? (tp - entryPrice) / risk : 1.5;
          break;
        }
      } else {
        // SELL direction
        const hitSL = c.high >= sl;
        const hitTP = c.low <= tp;

        if (hitSL && hitTP) {
          if (c.close > c.open) {
            status = DECISION_STATUS.CLOSED_SL;
            closedAt = c.time;
            exitPrice = sl;
            outcome = 'SL';
            pnlR = -1.0;
            break;
          } else {
            status = DECISION_STATUS.CLOSED_TP;
            closedAt = c.time;
            exitPrice = tp;
            outcome = 'TP';
            pnlR = risk > 0 ? (entryPrice - tp) / risk : 1.5;
            break;
          }
        } else if (hitSL) {
          status = DECISION_STATUS.CLOSED_SL;
          closedAt = c.time;
          exitPrice = sl;
          outcome = 'SL';
          pnlR = -1.0;
          break;
        } else if (hitTP) {
          status = DECISION_STATUS.CLOSED_TP;
          closedAt = c.time;
          exitPrice = tp;
          outcome = 'TP';
          pnlR = risk > 0 ? (entryPrice - tp) / risk : 1.5;
          break;
        }
      }
    }
  }

  // If still not triggered by end of expiry window
  if (!isTriggered && candles.length - 1 > signalIndex + expiryWindow) {
    status = DECISION_STATUS.EXPIRED;
    outcome = 'EXPIRED';
    pnlR = 0;
  }

  return {
    ...signal,
    status,
    triggeredAt,
    closedAt,
    exitPrice,
    outcome,
    pnlR: Math.round(pnlR * 100) / 100,
  };
}
