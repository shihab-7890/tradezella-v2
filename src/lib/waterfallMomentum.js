/**
 * Waterfall Momentum & Cascade Intelligence Engine
 * Deterministic State Machine for Bearish Waterfalls & Bullish Cascades.
 */

export const WATERFALL_STATES = {
  IDLE: 'IDLE',
  IMPULSE_DETECTED: 'IMPULSE_DETECTED',
  MOMENTUM_CONFIRMED: 'MOMENTUM_CONFIRMED',
  PULLBACK_WATCH: 'PULLBACK_WATCH',
  ENTRY_CANDIDATE: 'ENTRY_CANDIDATE',
  ENTRY_CONFIRMED: 'ENTRY_CONFIRMED',
  EXHAUSTION_WATCH: 'EXHAUSTION_WATCH',
  INVALIDATED: 'INVALIDATED',
  EXPIRED: 'EXPIRED',
};

export class WaterfallStateMachine {
  constructor(direction, initialCandle, sequenceId) {
    this.sequenceId = sequenceId;
    this.direction = direction; // 'BUY' (Bullish Cascade) or 'SELL' (Bearish Waterfall)
    this.state = WATERFALL_STATES.IMPULSE_DETECTED;
    this.startTimestamp = initialCandle.time;
    this.lastUpdatedTimestamp = initialCandle.time;

    this.impulseHigh = initialCandle.high;
    this.impulseLow = initialCandle.low;
    this.invalidationLevel = direction === 'SELL' ? initialCandle.high : initialCandle.low;
    this.extremePrice = direction === 'SELL' ? initialCandle.low : initialCandle.high;

    this.candleCount = 1;
    this.consecutiveDirectionCount = 1;
    this.pullbackObserved = false;
    this.pullbackDepthPct = 0;
    this.hasConfirmedEntry = false;
    this.setupType = 'waterfallEarly';
    this.exhaustionStatus = 'MOMENTUM_HEALTHY';
  }

  processCandle(candle, metrics, atr, settings = {}) {
    this.lastUpdatedTimestamp = candle.time;
    this.candleCount += 1;

    const isSell = this.direction === 'SELL';
    const isDirectionalBar = isSell ? metrics.isBearish : metrics.isBullish;

    if (isDirectionalBar) {
      this.consecutiveDirectionCount += 1;
    } else {
      this.consecutiveDirectionCount = 0;
    }

    // Update Extreme Price & Invalidation Level
    if (isSell) {
      if (candle.low < this.extremePrice) {
        this.extremePrice = candle.low;
      }
      // Check invalidation: break above impulse high or recent swing high
      if (candle.close > this.invalidationLevel) {
        this.state = WATERFALL_STATES.INVALIDATED;
        return null;
      }
    } else {
      if (candle.high > this.extremePrice) {
        this.extremePrice = candle.high;
      }
      // Check invalidation: break below impulse low
      if (candle.close < this.invalidationLevel) {
        this.state = WATERFALL_STATES.INVALIDATED;
        return null;
      }
    }

    // 1. Evaluate Anti-Chase & Exhaustion Metric
    const moveDist = Math.abs(this.extremePrice - this.invalidationLevel);
    const extensionRatio = atr && atr > 0 ? moveDist / atr : 1.0;

    if (extensionRatio > 4.0 || metrics.rangeToAtr > 2.5) {
      this.exhaustionStatus = 'EXHAUSTION_WARNING';
      this.state = WATERFALL_STATES.EXHAUSTION_WATCH;
    } else if (extensionRatio > 2.8) {
      this.exhaustionStatus = 'MOMENTUM_OVEREXTENDED';
    } else if (extensionRatio > 1.8) {
      this.exhaustionStatus = 'MOMENTUM_EXTENDING';
    } else {
      this.exhaustionStatus = 'MOMENTUM_HEALTHY';
    }

    // 2. State Machine Transitions & Setups
    let candidateSignal = null;

    if (this.state === WATERFALL_STATES.IMPULSE_DETECTED) {
      if (this.candleCount >= 2 && metrics.bodyRatio >= 0.55 && isDirectionalBar) {
        this.state = WATERFALL_STATES.MOMENTUM_CONFIRMED;
        if (!this.hasConfirmedEntry) {
          this.hasConfirmedEntry = true;
          this.setupType = 'waterfallEarly';
          candidateSignal = this.createSignalObject(candle, 'Setup A — Early Momentum Confirmation', 3.0);
        }
      }
    }

    // Detect Pullback
    const isCounterBar = isSell ? metrics.isBullish : metrics.isBearish;
    if (isCounterBar && !this.pullbackObserved) {
      this.pullbackObserved = true;
      this.state = WATERFALL_STATES.PULLBACK_WATCH;
      const moveRange = Math.abs(this.extremePrice - this.invalidationLevel);
      if (moveRange > 0) {
        const retracement = isSell
          ? (candle.high - this.extremePrice) / moveRange
          : (this.extremePrice - candle.low) / moveRange;
        this.pullbackDepthPct = Math.min(1.0, Math.max(0, retracement));
      }
    }

    // First Pullback Setup (Setup B)
    if (this.state === WATERFALL_STATES.PULLBACK_WATCH && isDirectionalBar && metrics.bodyRatio >= 0.5) {
      this.state = WATERFALL_STATES.ENTRY_CONFIRMED;
      this.setupType = 'waterfallFirstPullback';
      candidateSignal = this.createSignalObject(candle, 'Setup B — First Pullback Entry', 3.2);
    }

    // Shallow Continuation (Setup E) if strong momentum with no deep pullback
    if (this.state === WATERFALL_STATES.MOMENTUM_CONFIRMED && this.candleCount >= 3 && isDirectionalBar && !this.hasConfirmedEntry) {
      this.hasConfirmedEntry = true;
      this.setupType = 'waterfallShallow';
      candidateSignal = this.createSignalObject(candle, 'Setup E — Shallow Continuation', 2.6);
    }

    // Expiry check
    if (this.candleCount > (settings.waterfallMaxCandles || 12)) {
      this.state = WATERFALL_STATES.EXPIRED;
    }

    return candidateSignal;
  }

  createSignalObject(candle, title, baseScore) {
    const isSell = this.direction === 'SELL';
    return {
      id: `${this.sequenceId}-${candle.time}`,
      sequenceId: this.sequenceId,
      strategy: this.setupType,
      type: `${this.direction} confirmed`,
      direction: this.direction,
      time: candle.time,
      price: candle.close,
      setupTime: this.startTimestamp,
      confirmationTime: candle.time,
      score: baseScore,
      reasons: [title, `State: ${this.state}`, `Exhaustion: ${this.exhaustionStatus}`],
      invalidationPrice: this.invalidationLevel,
      notes: `${title} | State Machine ${this.state}`,
    };
  }
}

export function runWaterfallEngine(candles, metricsList, atrList, settings = {}) {
  if (!candles || candles.length < 3) {
    return { candidates: [], markers: [], activeSequences: [] };
  }

  const enabled = settings.enableWaterfall !== false;
  const enableBearish = settings.enableBearishWaterfall !== false;
  const enableBullish = settings.enableBullishCascade !== false;

  if (!enabled) {
    return { candidates: [], markers: [], activeSequences: [] };
  }

  const candidates = [];
  const markers = [];
  let currentSequence = null;

  for (let i = 2; i < candles.length; i++) {
    const candle = candles[i];
    const metrics = metricsList[i];
    const prevMetrics = metricsList[i - 1];
    const prev2Metrics = metricsList[i - 2];
    const atr = atrList ? atrList[i] : null;

    if (!metrics || !prevMetrics || !prev2Metrics) continue;

    // Check if we need to start a new Bearish Waterfall
    if (enableBearish && !currentSequence) {
      const isBearishImpulse =
        prev2Metrics.isBearish && prevMetrics.isBearish && metrics.isBearish &&
        metrics.bodyToAtr >= 0.7 &&
        candle.close < candles[i - 1].close && candles[i - 1].close < candles[i - 2].close;

      if (isBearishImpulse) {
        const seqId = `waterfall-sell-${candles[i - 2].time}`;
        currentSequence = new WaterfallStateMachine('SELL', candles[i - 2], seqId);
      }
    }

    // Check if we need to start a new Bullish Momentum Cascade
    if (enableBullish && !currentSequence) {
      const isBullishCascade =
        prev2Metrics.isBullish && prevMetrics.isBullish && metrics.isBullish &&
        metrics.bodyToAtr >= 0.7 &&
        candle.close > candles[i - 1].close && candles[i - 1].close > candles[i - 2].close;

      if (isBullishCascade) {
        const seqId = `cascade-buy-${candles[i - 2].time}`;
        currentSequence = new WaterfallStateMachine('BUY', candles[i - 2], seqId);
      }
    }

    // Advance current sequence state machine if active
    if (currentSequence) {
      const signal = currentSequence.processCandle(candle, metrics, atr, settings);
      if (signal) {
        candidates.push(signal);
        markers.push({
          index: i,
          time: candle.time,
          price: candle.close,
          type: signal.direction,
          label: signal.direction === 'SELL' ? 'WATERFALL SELL' : 'CASCADE BUY',
          shape: signal.direction === 'SELL' ? 'arrowDown' : 'arrowUp',
          color: signal.direction === 'SELL' ? '#ef5350' : '#26a69a',
          strategy: signal.strategy,
          sequenceId: currentSequence.sequenceId,
          explanation: signal.notes,
        });
      }

      if (
        currentSequence.state === WATERFALL_STATES.INVALIDATED ||
        currentSequence.state === WATERFALL_STATES.EXPIRED
      ) {
        currentSequence = null;
      }
    }
  }

  return { candidates, markers, activeSequences: [] };
}
