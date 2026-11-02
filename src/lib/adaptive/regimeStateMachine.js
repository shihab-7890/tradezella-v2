/**
 * Regime State Machine with Hysteresis & Persistence Control
 * Prevents rapid flickering or settings oscillations on individual noisy candles.
 */

export class RegimeStateMachine {
  constructor(options = 3, confidenceGap = 15) {
    const minPersistence = typeof options === 'object' ? (options.persistenceBars || 3) : options;
    this.currentRegime = 'Ranging';
    this.currentVolatility = 'Normal';
    this.currentTransition = 'Stable Trend';
    this.persistenceCounter = 0;
    this.minPersistence = minPersistence;
    this.confidenceGap = confidenceGap;
    this.lastTransitionTime = 0;
    this.transitionHistory = [];
  }

  processNewClassification(classification, timestamp) {
    const rawDirection = classification.directionalRegime;
    const rawVolatility = classification.volatilityRegime;
    const rawTransition = classification.transitionState;

    let regimeChanged = false;

    // Check if new regime is sufficiently established
    if (rawDirection !== this.currentRegime) {
      if (
        this.persistenceCounter >= this.minPersistence ||
        classification.confidence >= 80 ||
        rawDirection.includes('Strong')
      ) {
        this.transitionHistory.push({
          from: this.currentRegime,
          to: rawDirection,
          timestamp,
          reason: classification.explanation,
        });
        this.currentRegime = rawDirection;
        this.persistenceCounter = 0;
        this.lastTransitionTime = timestamp;
        regimeChanged = true;
      } else {
        this.persistenceCounter++;
      }
    } else {
      this.persistenceCounter = 0;
    }

    this.currentVolatility = rawVolatility;
    this.currentTransition = rawTransition;

    return {
      activeRegime: this.currentRegime,
      activeVolatility: this.currentVolatility,
      activeTransition: this.currentTransition,
      directionalRegime: this.currentRegime,
      volatilityRegime: this.currentVolatility,
      transitionState: this.currentTransition,
      regimeChanged,
      persistenceCounter: this.persistenceCounter,
      confidence: classification.confidence,
    };
  }

  update(directionalRegime, trendStrength = 50, volatilityRegime = 'Normal', timestamp = Date.now()) {
    const classification = {
      directionalRegime,
      volatilityRegime,
      transitionState: 'Stable Trend',
      trendStrength,
      confidence: trendStrength >= 75 ? 85 : 55,
      explanation: `Regime updated to ${directionalRegime}`,
    };
    return this.processNewClassification(classification, timestamp);
  }

  getState() {
    return {
      directionalRegime: this.currentRegime,
      volatilityRegime: this.currentVolatility,
      transitionState: this.currentTransition,
      activeRegime: this.currentRegime,
      persistenceCounter: this.persistenceCounter,
    };
  }
}
