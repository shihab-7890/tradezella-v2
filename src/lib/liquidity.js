import { getHistoricalData } from '@/services/finageService';

const STRATEGY_PRIORITY = {
    sweepObFvgConfluence: 10,
    powerOfThree: 10,
    qualifiedSweep: 8,
    obMss: 8,
    continuationObMss: 8,
    momentumSpike: 8,
    fvgImbalance: 5,
    mitigationBlock: 5,
    liquidityVoid: 5,
    classicBreakout: 5,
    institutionalRange: 5,
    breakerBlock: 5,
    liquiditySweep: 4,
    asianRange: 4,
    londonBreakout: 4,
    londonKillZone: 3,
    newYorkKillZone: 3,
};

function buildCandleTimeIndexMap(candles) {
    const indexByTime = new Map();
    for (let i = 0; i < candles.length; i++) {
        indexByTime.set(candles[i].time, i);
    }
    return indexByTime;
}

function getSignalIndex(signal, candles, candleTimeIndex = null) {
    if (candleTimeIndex) {
        const index = candleTimeIndex.get(signal.time);
        return index === undefined ? -1 : index;
    }

    return candles.findIndex(c => c.time === signal.time);
}

function createQualityContext(candles, settings) {
    return {
        volumeMA: settings.volumeConfirmationGlobal
            ? calculateEMA(candles.map(c => c.volume || 0), settings.volumeMaPeriod || 20)
            : null,
        atr: settings.minimumDisplacementAtr > 0
            ? calculateATR(candles, settings.atrPeriod || 20)
            : null,
    };
}

/**
 * =================================================================================
 * Main Confluence Engine Orchestrator
 * =================================================================================
 */
export async function runConfluenceEngine(candles, settings, config) {
    // If MTF engine is off, run legacy analysis and return
    if (!settings.enableMtfEngine) {
        return runLegacyAnalysis(candles, settings, config);
    }

    const candleTimeIndex = buildCandleTimeIndexMap(candles);
    const qualityContext = createQualityContext(candles, settings);
    
    // --- MTF Engine is ON ---
    let analysisResult = {
        liquidityData: { equalHighs: [], equalLows: [] },
        breakerBlocks: [],
        mitigationBlocks: [],
        orderBlocks: [],
        continuationOrderBlocks: [],
        fvgs: [],
        imbalanceZones: [],
        dealingRange: null,
        asianRanges: [],
        powerOfThreeZones: [],
        classicBreakoutZones: [],
        htfKeyLevels: [],
        htfTrend: { direction: 'Ranging', confidence: 0 }
    };
    
    // 1. Fetch HTF Data
    const htfDateRange = { from: candles[0].time, to: candles[candles.length - 1].time };
    const htfCandles = await getHistoricalData(config.symbol, settings.htfTimeframe, htfDateRange.from, htfDateRange.to);

    if (!htfCandles || htfCandles.length === 0) {
        console.warn("Could not fetch HTF data. Running analysis without MTF confluence.");
        return runLegacyAnalysis(candles, settings, config);
    }
    
    // 2. Analyze HTF
    analysisResult.htfTrend = analyzeHtfTrend(htfCandles);
    analysisResult.htfKeyLevels = identifyHtfKeyLevels(htfCandles);

    // 3. Run all strategies to get potential signals and visual data
    const { potentialSignals, visualData } = runAllStrategies(candles, settings, config, analysisResult);
    
    // Assign visual data to analysisResult
    analysisResult = { ...analysisResult, ...visualData };

    // 4. Score and filter signals based on confluence
    const scoredSignals = [];
    for (const signal of potentialSignals) {
        const normalizedSignal = normalizeSignal(signal);

        // Skip adding entry signals if they are disabled for P3
        if (normalizedSignal.type.includes('confirmed') && normalizedSignal.notes.includes('Power of Three') && !settings.enableDistributionEntries) {
            continue;
        }

        const { score, reasons } = calculateConfluenceScore(normalizedSignal, analysisResult, settings);
        
        const qualityPassed = passesGlobalQualityFilters(normalizedSignal, candles, settings, candleTimeIndex, qualityContext);
        const isApproved = qualityPassed && score >= settings.confluenceScoreThreshold;

        if (isApproved) {
            const riskParams = calculateRiskManagement(normalizedSignal, candles, settings, candleTimeIndex);
            scoredSignals.push({
                ...normalizedSignal,
                isApproved: true,
                score: score,
                qualityTier: getQualityTier(score),
                notes: `${normalizedSignal.notes} | ${reasons.join(', ')}`,
                ...riskParams
            });
        } else {
             scoredSignals.push({
                ...normalizedSignal,
                isApproved: false,
                score: score,
                qualityTier: 'Suppressed',
                notes: `${normalizedSignal.notes} | Suppressed (${qualityPassed ? `Score: ${score.toFixed(1)}` : 'Quality filters'})`
            });
        }
    }

    const approvedSignals = filterSignalClustering(
        prioritizeOverlappingSignals(
            scoredSignals.filter(signal => signal.isApproved),
            candles,
            settings,
            candleTimeIndex
        ),
        candles,
        settings.minCandlesBetweenSignals || 0,
        candleTimeIndex
    );

    const suppressedSignals = scoredSignals
        .filter(signal => !signal.isApproved)
        .map(signal => ({ ...signal, hiddenByQualityFilter: true }));

    const finalSignals = [...approvedSignals, ...suppressedSignals];
    
    analysisResult.tradeLog = finalSignals.sort((a, b) => a.time - b.time);

    return analysisResult;
}


/**
 * =================================================================================
 * MTF Analysis Helpers
 * =================================================================================
 */

function analyzeHtfTrend(htfCandles, period = 20) {
    if (htfCandles.length < period) return { direction: 'Ranging', confidence: 0 };
    
    const relevantCandles = htfCandles.slice(-period);
    const ema = calculateEMA(relevantCandles.map(c => c.close), period);
    const lastPrice = htfCandles[htfCandles.length - 1].close;
    const lastEma = ema[ema.length-1];

    if (lastPrice > lastEma) {
        return { direction: 'BULLISH', confidence: 1 };
    } else if (lastPrice < lastEma) {
        return { direction: 'BEARISH', confidence: 1 };
    }
    return { direction: 'Ranging', confidence: 0 };
}

function identifyHtfKeyLevels(htfCandles) {
    const levels = [];
    if (htfCandles.length < 5) return levels;

    for (let i = 2; i < htfCandles.length - 2; i++) {
        const c = htfCandles[i];
        const prev1 = htfCandles[i-1];
        const prev2 = htfCandles[i-2];
        const next1 = htfCandles[i+1];
        const next2 = htfCandles[i+2];

        // Swing High (resistance)
        if (c.high > prev1.high && c.high > prev2.high && c.high > next1.high && c.high > next2.high) {
            levels.push({ price: c.high, type: 'resistance' });
        }
        // Swing Low (support)
        if (c.low < prev1.low && c.low < prev2.low && c.low < next1.low && c.low < next2.low) {
            levels.push({ price: c.low, type: 'support' });
        }
    }
    return levels;
}

function calculateConfluenceScore(signal, analysisResult, settings) {
    let score = 0;
    let reasons = [];

    // Trend Confluence
    if ((signal.type.includes('BUY') && analysisResult.htfTrend.direction === 'BULLISH') || 
        (signal.type.includes('SELL') && analysisResult.htfTrend.direction === 'BEARISH')) {
        score += 2;
        reasons.push('HTF Trend');
    } else if ((signal.type.includes('BUY') && analysisResult.htfTrend.direction === 'BEARISH') || 
               (signal.type.includes('SELL') && analysisResult.htfTrend.direction === 'BULLISH')) {
        score -= 2;
        reasons.push('Counter-HTF');
    }
    
    // Key Level Confluence
    const isNearKeyLevel = analysisResult.htfKeyLevels.some(level => {
        const proximity = Math.abs(signal.price - level.price) / level.price;
        const isCorrectLevelType = (signal.type.includes('BUY') && level.type === 'support') || 
                                   (signal.type.includes('SELL') && level.type === 'resistance');
        return proximity < settings.keyLevelProximity && isCorrectLevelType;
    });

    if (isNearKeyLevel) {
        score += 1.5;
        reasons.push('HTF Level');
    }

    // FVG confluence is implicitly handled by the strategy logic adding notes.
    if (signal.notes && signal.notes.includes('FVG')) {
        score += 1;
        reasons.push('FVG');
    }
    if (signal.notes && (signal.notes.includes('OB') || signal.notes.includes('Breaker') || signal.notes.includes('COB') || signal.notes.includes('Mitigation'))) {
        score += 0.5; // Lower score for blocks as they are common
        reasons.push('Block');
    }
    
    return { score, reasons };
}

function normalizeSignal(signal) {
    const strategy = signal.strategy || inferSignalStrategy(signal);
    return {
        ...signal,
        notes: signal.notes || '',
        strategy,
        priority: STRATEGY_PRIORITY[strategy] || 5,
    };
}

function inferSignalStrategy(signal) {
    const notes = signal.notes || '';
    const type = signal.type || '';

    if (notes.includes('Sweep+OB+FVG')) return 'sweepObFvgConfluence';
    if (notes.includes('Power of Three') || notes.includes('P3')) return 'powerOfThree';
    if (notes.includes('Qualified Sweep') || type.includes('QUALIFIED')) return 'qualifiedSweep';
    if (notes.includes('OB+MSS')) return 'obMss';
    if (notes.includes('COB')) return 'continuationObMss';
    if (notes.includes('Momentum Spike')) return 'momentumSpike';
    if (notes.includes('FVG') || notes.includes('ILV')) return 'fvgImbalance';
    if (notes.includes('Mitigation')) return 'mitigationBlock';
    if (notes.includes('Liquidity Void')) return 'liquidityVoid';
    if (notes.includes('Classic Breakout')) return 'classicBreakout';
    if (notes.includes('Institutional Range')) return 'institutionalRange';
    if (notes.includes('Breaker')) return 'breakerBlock';
    if (notes.includes('Asian')) return 'asianRange';
    if (notes.includes('London Breakout')) return 'londonBreakout';
    if (notes.includes('London KZ')) return 'londonKillZone';
    if (notes.includes('New York KZ')) return 'newYorkKillZone';
    if (notes.includes('Sweep')) return 'liquiditySweep';

    return 'general';
}

function getQualityTier(score) {
    if (score >= 5) return 'A+';
    if (score >= 4) return 'A';
    if (score >= 3) return 'B';
    return 'Candidate';
}

function passesGlobalQualityFilters(signal, candles, settings, candleTimeIndex = null, qualityContext = null) {
    if (!signal.type.includes('confirmed')) return false;

    const signalIndex = getSignalIndex(signal, candles, candleTimeIndex);
    if (signalIndex === -1) return false;

    if (settings.volumeConfirmationGlobal) {
        const volumeMA = qualityContext?.volumeMA || calculateEMA(candles.map(c => c.volume || 0), settings.volumeMaPeriod || 20);
        const currentVolumeMa = volumeMA[signalIndex];
        const currentVolume = candles[signalIndex].volume || 0;

        if (currentVolumeMa > 0 && currentVolume > 0 && currentVolume < currentVolumeMa * 1.2) {
            return false;
        }
    }

    if (settings.minimumDisplacementAtr > 0) {
        const atr = qualityContext?.atr || calculateATR(candles, settings.atrPeriod || 20);
        const currentAtr = atr[signalIndex];

        if (currentAtr > 0) {
            const displacementWindow = candles.slice(Math.max(0, signalIndex - 2), signalIndex + 1);
            const hasStrongDisplacement = displacementWindow.some(candle => {
                const body = Math.abs(candle.close - candle.open);
                return body >= currentAtr * settings.minimumDisplacementAtr;
            });

            if (!hasStrongDisplacement) {
                return false;
            }
        }
    }

    return true;
}

function filterSignalClustering(signals, candles, minCandlesBetween = 5, candleTimeIndex = null) {
    if (!minCandlesBetween) return signals;

    const filtered = [];
    let lastSignalIndex = -Infinity;

    for (const signal of signals.sort((a, b) => a.time - b.time)) {
        const signalIndex = getSignalIndex(signal, candles, candleTimeIndex);
        if (signalIndex === -1) continue;

        if (signalIndex - lastSignalIndex >= minCandlesBetween) {
            filtered.push(signal);
            lastSignalIndex = signalIndex;
        }
    }

    return filtered;
}

function prioritizeOverlappingSignals(signals, candles, settings, candleTimeIndex = null) {
    const candleWindow = settings.minCandlesBetweenSignals || 5;
    const priceTolerance = settings.keyLevelProximity || 0.004;
    const prioritized = [];
    const prioritizedWithIndex = [];

    const sortedSignals = [...signals].sort((a, b) => {
        if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
        return (b.priority || 5) - (a.priority || 5);
    });

    for (const signal of sortedSignals) {
        const signalIndex = getSignalIndex(signal, candles, candleTimeIndex);
        if (signalIndex === -1) continue;

        const overlapsExisting = prioritizedWithIndex.some(existing => {
            const sameDirection = signal.type.includes('BUY') === existing.type.includes('BUY');
            const nearTime = Math.abs(signalIndex - existing.index) < candleWindow;
            const nearPrice = Math.abs(signal.price - existing.price) / Math.max(existing.price, signal.price) < priceTolerance;
            return sameDirection && nearTime && nearPrice;
        });

        if (!overlapsExisting) {
            prioritized.push(signal);
            prioritizedWithIndex.push({ ...signal, index: signalIndex });
        }
    }

    return prioritized.sort((a, b) => a.time - b.time);
}

function calculateRiskManagement(signal, candles, settings, candleTimeIndex = null) {
    const signalIndex = getSignalIndex(signal, candles, candleTimeIndex);
    if (signalIndex === -1) return { sl: null, tp: null };

    const lookbackStart = Math.max(0, signalIndex - settings.lookback);
    let sl = null;
    let tp = null;
    let riskRatio = settings.defaultRiskRewardRatio;
    
    if (signal.notes.includes('Power of Three') && settings.strategy.powerOfThree) {
        riskRatio = settings.distributionRiskRewardRatio;
        if (signal.manipulationPrice) {
            if (signal.type.includes('BUY')) {
                 sl = signal.manipulationPrice * (1 - settings.slBufferPercent);
            } else {
                 sl = signal.manipulationPrice * (1 + settings.slBufferPercent);
            }
        }
    }
    
    if (sl === null) {
        if (signal.type.includes('BUY')) {
            let swingLow = Infinity;
            for (let i = lookbackStart; i <= signalIndex; i++) {
                if (candles[i].low < swingLow) swingLow = candles[i].low;
            }
            sl = swingLow * (1 - settings.slBufferPercent); // Slightly below the low
        } else { // SELL
            let swingHigh = -Infinity;
            for (let i = lookbackStart; i <= signalIndex; i++) {
                if (candles[i].high > swingHigh) swingHigh = candles[i].high;
            }
            sl = swingHigh * (1 + settings.slBufferPercent); // Slightly above the high
        }
    }

    const entryPrice = signal.price;
    const risk = Math.abs(entryPrice - sl);
    tp = signal.type.includes('BUY') ? entryPrice + (risk * riskRatio) : entryPrice - (risk * riskRatio);


    return { sl, tp };
}

function calculateEMA(prices, period) {
    if (!prices || prices.length < period) return [];
    const k = 2 / (period + 1);
    let ema = [prices[0]];
    for (let i = 1; i < prices.length; i++) {
        ema.push(prices[i] * k + ema[i-1] * (1 - k));
    }
    return ema;
}

function calculateATR(candles, period) {
  const trueRanges = new Array(candles.length);
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (i === 0) {
      trueRanges[i] = c.high - c.low;
      continue;
    }

    const prev = candles[i - 1];
    trueRanges[i] = Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low - prev.close)
    );
  }
  
  const atr = [];
  let rollingSum = 0;
  for (let i = 0; i < trueRanges.length; i++) {
    rollingSum += trueRanges[i];
    if (i < period) {
      atr.push(null);
      continue;
    }
    rollingSum -= trueRanges[i - period];
    atr.push(rollingSum / period);
  }
  return atr;
}


/**
 * =================================================================================
 * Analysis Functions
 * =================================================================================
 */

// Legacy runner for when MTF is off
function runLegacyAnalysis(candles, settings, config) {
    const { potentialSignals, visualData } = runAllStrategies(candles, settings, config, null);

    const result = {
      ...visualData,
      tradeLog: potentialSignals.sort((a,b) => a.time - b.time),
      htfKeyLevels: [],
      htfTrend: { direction: 'Ranging', confidence: 0 }
    };
    return result;
}

// Universal function to run all strategies and collect signals
function runAllStrategies(candles, settings, config, analysisResult = null) {
    let potentialSignals = [];
    const visualData = {
        liquidityData: { equalHighs: [], equalLows: [] },
        breakerBlocks: [],
        mitigationBlocks: [],
        orderBlocks: [],
        continuationOrderBlocks: [],
        fvgs: [],
        imbalanceZones: [],
        dealingRange: null,
        asianRanges: [],
        powerOfThreeZones: [],
        classicBreakoutZones: [],
    };

    if (settings.strategy.liquiditySweep) {
        const result = detectLiquidityAndSweeps(candles, settings, config);
        visualData.liquidityData = { equalHighs: result.equalHighs, equalLows: result.equalLows };
        potentialSignals.push(...result.signals);
    }
    if (settings.strategy.obMss) {
        const result = detectObAndMss(candles, settings, analysisResult);
        visualData.fvgs.push(...result.fvgs);
        visualData.imbalanceZones.push(...result.imbalanceZones);
        visualData.orderBlocks.push(...result.orderBlocks);
        potentialSignals.push(...result.buySignals, ...result.sellSignals);
    }
    if (settings.strategy.breakerBlocks) {
        const result = detectBreakerBlocks(candles, settings, analysisResult);
        visualData.breakerBlocks.push(...result.breakerBlocks);
        potentialSignals.push(...result.buySignals, ...result.sellSignals);
    }
    if (settings.strategy.mitigationBlock) {
        const result = detectMitigationBlocks(candles, settings, analysisResult);
        visualData.mitigationBlocks.push(...result.mitigationBlocks);
        potentialSignals.push(...result.buySignals, ...result.sellSignals);
    }
    if (settings.strategy.institutionalRange) {
        const result = detectInstitutionalRange(candles, settings);
        visualData.dealingRange = result.dealingRange;
        potentialSignals.push(...result.buySignals, ...result.sellSignals);
    }
    if (settings.strategy.asianRange) {
        const result = detectAsianRangeAndSweeps(candles, settings);
        visualData.asianRanges.push(...result.asianRanges);
        potentialSignals.push(...result.buySignals, ...result.sellSignals, ...result.buyCandidates, ...result.sellCandidates);
    }
     if (settings.strategy.londonBreakout) {
        const result = detectLondonBreakout(candles, settings);
        // This strategy might share visualization with asian range, ensure it's handled.
        if (result.asianRanges.length > 0 && visualData.asianRanges.length === 0) {
            visualData.asianRanges.push(...result.asianRanges);
        }
        potentialSignals.push(...result.buySignals, ...result.sellSignals);
    }
    if (settings.strategy.classicBreakout) {
        const result = detectClassicBreakout(candles, settings);
        visualData.classicBreakoutZones.push(...result.classicBreakoutZones);
        potentialSignals.push(...result.buySignals, ...result.sellSignals);
    }
    if (settings.strategy.fvgImbalance) {
        const result = detectFvgImbalance(candles, settings, analysisResult);
        if (settings.detectInstitutionalImbalanceZones) {
             visualData.imbalanceZones.push(...result.imbalanceZones);
        } else {
             visualData.fvgs.push(...result.fvgs);
        }
        potentialSignals.push(...result.buySignals, ...result.sellSignals);
    }
    if (settings.strategy.liquidityVoid) {
        const result = detectLiquidityVoid(candles, settings);
        visualData.fvgs.push(...result.fvgs);
        potentialSignals.push(...result.buySignals, ...result.sellSignals);
    }
    if (settings.strategy.obFvgConfluence) {
        const result = detectConfluenceStrategy(candles, settings, analysisResult);
        // This strategy re-uses existing visualizations, just generates signals
        potentialSignals.push(...result.buySignals, ...result.sellSignals);
    }
     if (settings.strategy.cobMss) {
        const result = detectContinuationObAndMss(candles, settings, analysisResult);
        visualData.continuationOrderBlocks.push(...result.continuationOrderBlocks);
        potentialSignals.push(...result.buySignals, ...result.sellSignals);
    }
    if (settings.strategy.londonKillzone) {
        const result = detectLondonKillzoneTrades(candles, settings);
        potentialSignals.push(...result.buySignals, ...result.sellSignals);
    }
    if (settings.strategy.newYorkKillzone) {
        const result = detectNewYorkKillzoneTrades(candles, settings);
        potentialSignals.push(...result.buySignals, ...result.sellSignals);
    }
     if (settings.strategy.powerOfThree) {
        const result = detectPowerOfThree(candles, settings);
        visualData.powerOfThreeZones.push(...result.powerOfThreeZones);
        potentialSignals.push(...result.signals);
    }
    if (settings.strategy.momentumSpike) {
        const result = detectMomentumSpikes(candles, settings);
        potentialSignals.push(...result.signals);
    }

    return { potentialSignals, visualData };
}

/**
 * Detects Momentum Spike Entries based on volatility expansion and volume surges.
 */
export function detectMomentumSpikes(candles, settings) {
    const { 
        minRangeMultiplier, 
        volumeSurgeFactor, 
        bodyPercentageThreshold, 
        atrPeriod, 
        momentumVolumeMaPeriod, 
        requireMomentumBreakout,
        momentumEntryType 
    } = settings;

    const signals = [];
    const atr = calculateATR(candles, atrPeriod);
    const volumeMA = calculateEMA(candles.map(c => c.volume), momentumVolumeMaPeriod);

    for (let i = Math.max(atrPeriod, momentumVolumeMaPeriod); i < candles.length; i++) {
        const c = candles[i];
        const range = c.high - c.low;
        const currentAtr = atr[i];
        const currentVolMa = volumeMA[i];

        if (!currentAtr || !currentVolMa) continue;

        // 1. Range Expansion
        const isRangeExpanded = range > minRangeMultiplier * currentAtr;

        // 2. Volume Surge
        const isVolumeSurged = c.volume > volumeSurgeFactor * currentVolMa;

        // 3. Directional Commitment (Body size relative to range)
        const bodySize = Math.abs(c.close - c.open);
        const isDirectional = range > 0 && (bodySize / range) >= bodyPercentageThreshold;

        if (isRangeExpanded && isVolumeSurged && isDirectional) {
            const isBullish = c.close > c.open;
            let isBreakoutValid = true;

            // 4. Optional Breakout Confirmation
            if (requireMomentumBreakout) {
                const lookbackWindow = candles.slice(i - 10, i);
                if (isBullish) {
                    const highestHigh = Math.max(...lookbackWindow.map(w => w.high));
                    isBreakoutValid = c.close > highestHigh;
                } else {
                    const lowestLow = Math.min(...lookbackWindow.map(w => w.low));
                    isBreakoutValid = c.close < lowestLow;
                }
            }

            if (isBreakoutValid) {
                const signalType = isBullish ? 'BUY confirmed' : 'SELL confirmed';
                const note = `Momentum Spike (${isBullish ? 'Bullish' : 'Bearish'})`;

                if (momentumEntryType === 'Close of Spike') {
                    signals.push({
                        time: c.time,
                        price: c.close,
                        type: signalType,
                        notes: note
                    });
                } else {
                    // Retest entry logic
                    for (let j = i + 1; j < Math.min(i + 10, candles.length); j++) {
                        const nextC = candles[j];
                        if (isBullish && nextC.low <= c.high && nextC.close > c.open) {
                             signals.push({
                                time: nextC.time,
                                price: nextC.close,
                                type: signalType,
                                notes: `${note} | Retest`
                            });
                            break;
                        } else if (!isBullish && nextC.high >= c.low && nextC.close < c.open) {
                             signals.push({
                                time: nextC.time,
                                price: nextC.close,
                                type: signalType,
                                notes: `${note} | Retest`
                            });
                            break;
                        }
                    }
                }
            }
        }
    }

    return { signals };
}


/**
 * Detects liquidity pools (equal highs/lows) and sweep candidates.
 * Enhanced to qualify pools with 3+ touches as higher quality.
 * @param {Array<object>} candles - The array of candlestick data.
 * @param {object} settings - The strategy settings.
 * @returns {object} - An object containing arrays of detected liquidity events.
 */
export function detectLiquidityAndSweeps(candles, settings) {
  const { lookback, minWickRatio, equalTolerance, enableQualifiedSweepFilters, minQualifiedWickSize, requireVolumeConfirmation, volumeMaPeriod, timeframe } = settings;
  const equalHighs = [];
  const equalLows = [];
  const signals = [];
  const volumeMA = calculateEMA(candles.map(c => c.volume), volumeMaPeriod);

  for (let i = lookback; i < candles.length; i++) {
    const window = candles.slice(i - lookback, i);
    
    // Detect Equal Highs/Lows
    const highPool = findEqualLevels(window, 'high', equalTolerance);
    const lowPool = findEqualLevels(window, 'low', equalTolerance);

    if (highPool.indices.length > 1) {
      equalHighs.push({ 
        price: highPool.price, 
        indices: highPool.indices.map(idx => i - lookback + idx),
        isQualified: highPool.indices.length >= 3 // Qualify if 3 or more touches
      });
    }
    if (lowPool.indices.length > 1) {
      equalLows.push({ 
        price: lowPool.price, 
        indices: lowPool.indices.map(idx => i - lookback + idx),
        isQualified: lowPool.indices.length >= 3 // Qualify if 3 or more touches
      });
    }

    const currentCandle = candles[i];
    const highestHighInWindow = Math.max(...window.map(c => c.high));
    const lowestLowInWindow = Math.min(...window.map(c => c.low));

    // BSL/SSL Sweep Detection
    const isBslSweep = currentCandle.high > highestHighInWindow && currentCandle.close < highestHighInWindow;
    const isSslSweep = currentCandle.low < lowestLowInWindow && currentCandle.close > lowestLowInWindow;
    
    if (isBslSweep) {
        let isQualifiedSweep = true;
        let notes = ['Sweep'];
        const upperWick = currentCandle.high - Math.max(currentCandle.close, currentCandle.open);
        const candleRange = currentCandle.high - currentCandle.low;
        const wickRatio = candleRange > 0 ? upperWick / candleRange : 0;

        if (wickRatio < minWickRatio) {
            isQualifiedSweep = false;
        }

        if (enableQualifiedSweepFilters) {
            if (candleRange > 0 && (upperWick / candleRange) < minQualifiedWickSize) isQualifiedSweep = false;
            else if (candleRange > 0) notes.push('Wick');

            if (requireVolumeConfirmation && currentCandle.volume < volumeMA[i]) isQualifiedSweep = false;
            else if(requireVolumeConfirmation) notes.push('Vol');
        }

        const { confirmed, mssIndex } = isMssConfirmed(candles, i, 'bearish', settings);
        if (isQualifiedSweep && enableQualifiedSweepFilters) {
            signals.push({ time: currentCandle.time, type: 'QUALIFIED_SELL_SWEEP', price: currentCandle.high, timeframe: timeframe, notes: notes.join('+') });
             if (confirmed) {
                signals.push({ time: currentCandle.time, type: 'SELL confirmed', price: currentCandle.close, timeframe: timeframe, notes: 'Qualified Sweep + MSS', mssIndex });
            }
        } else if (isQualifiedSweep) {
            signals.push({ time: currentCandle.time, type: 'BSL candidate', price: currentCandle.high, timeframe: timeframe, notes: 'Sweep' });
            if (confirmed) {
                signals.push({ time: currentCandle.time, type: 'SELL confirmed', price: currentCandle.close, timeframe: timeframe, notes: 'Sweep + MSS', mssIndex });
            }
        }
    }

    if (isSslSweep) {
        let isQualifiedSweep = true;
        let notes = ['Sweep'];
        const lowerWick = Math.min(currentCandle.open, currentCandle.close) - currentCandle.low;
        const candleRange = currentCandle.high - currentCandle.low;
        const wickRatio = candleRange > 0 ? lowerWick / candleRange : 0;

        if (wickRatio < minWickRatio) {
            isQualifiedSweep = false;
        }
        
        if (enableQualifiedSweepFilters) {
            if (candleRange > 0 && (lowerWick / candleRange) < minQualifiedWickSize) isQualifiedSweep = false;
            else if (candleRange > 0) notes.push('Wick');

            if (requireVolumeConfirmation && currentCandle.volume < volumeMA[i]) isQualifiedSweep = false;
            else if(requireVolumeConfirmation) notes.push('Vol');
        }

        const { confirmed, mssIndex } = isMssConfirmed(candles, i, 'bullish', settings);
        if (isQualifiedSweep && enableQualifiedSweepFilters) {
             signals.push({ time: currentCandle.time, type: 'QUALIFIED_BUY_SWEEP', price: currentCandle.low, timeframe: timeframe, notes: notes.join('+') });
             if (confirmed) {
                signals.push({ time: currentCandle.time, type: 'BUY confirmed', price: currentCandle.close, timeframe: timeframe, notes: 'Qualified Sweep + MSS', mssIndex });
            }
        } else if (isQualifiedSweep) {
            signals.push({ time: currentCandle.time, type: 'SSL candidate', price: currentCandle.low, timeframe: timeframe, notes: 'Sweep' });
            if (confirmed) {
                signals.push({ time: currentCandle.time, type: 'BUY confirmed', price: currentCandle.close, timeframe: timeframe, notes: 'Sweep + MSS', mssIndex });
            }
        }
    }
  }

  return { equalHighs, equalLows, signals };
}

function findEqualLevels(candles, key, tolerance) {
  let bestPool = { price: 0, indices: [] };
  for (let i = 0; i < candles.length; i++) {
    const currentPrice = candles[i][key];
    const currentPool = { price: currentPrice, indices: [i] };
    for (let j = i + 1; j < candles.length; j++) {
      const price2 = candles[j][key];
      if (Math.abs(currentPrice - price2) / currentPrice < tolerance) {
        currentPool.indices.push(j);
      }
    }
    if (currentPool.indices.length > bestPool.indices.length) {
      bestPool = currentPool;
    }
  }
  return bestPool;
}

function isMssConfirmed(candles, sweepIndex, direction, settings) {
    if (!settings.mssConfirmationRequired && !settings.distributionMssConfirmation && !settings.mitigationBlockConfirmation && !settings.cobRequireMssConfirmation) {
        return { confirmed: true, mssIndex: -1 };
    }
    if (sweepIndex >= candles.length - 2) return { confirmed: false, mssIndex: -1 };

    // 1. Identify swing points before the sweep
    const lookbackStart = Math.max(0, sweepIndex - settings.lookback);
    const lookbackCandles = candles.slice(lookbackStart, sweepIndex + 1);

    let swingPoint = null;
    let swingPointIndex = -1;

    // For a bullish confirmation (after SSL), we need to break a swing HIGH
    if (direction === 'bullish') {
        for (let i = lookbackCandles.length - 3; i > 1; i--) {
            const c = lookbackCandles[i];
            if (c.high > lookbackCandles[i-1].high && c.high > lookbackCandles[i+1].high) {
                swingPoint = c.high;
                swingPointIndex = lookbackStart + i;
                break;
            }
        }
    } 
    // For a bearish confirmation (after BSL), we need to break a swing LOW
    else {
        for (let i = lookbackCandles.length - 3; i > 1; i--) {
            const c = lookbackCandles[i];
            if (c.low < lookbackCandles[i-1].low && c.low < lookbackCandles[i+1].low) {
                swingPoint = c.low;
                swingPointIndex = lookbackStart + i;
                break;
            }
        }
    }

    if (swingPoint === null) return { confirmed: false, mssIndex: -1 };

    // 2. Look for the break of that swing point after the sweep
    for(let i = sweepIndex + 1; i < Math.min(sweepIndex + 10, candles.length); i++) {
        const confCandle = candles[i];
        if (direction === 'bullish' && confCandle.close > swingPoint) {
            return { confirmed: true, mssIndex: i };
        }
        if (direction === 'bearish' && confCandle.close < swingPoint) {
            return { confirmed: true, mssIndex: i };
        }
    }

    return { confirmed: false, mssIndex: -1 };
}

/**
 * Detects Order Blocks, Market Structure Shifts (ICT-style), Fair Value Gaps, and Imbalance Zones.
 * Enhanced with Strength-Based Scoring for OBs and FVG clustering.
 * @param {Array<object>} candles - The array of candlestick data.
 * @param {object} settings - The strategy settings.
 * @param {object|null} analysisResult - The HTF analysis result, if available.
 * @returns {object} An object containing signals, FVGs, scored Order Blocks, and Imbalance Zones.
 */
export function detectObAndMss(candles, settings, analysisResult) {
    const buySignals = [];
    const sellSignals = [];
    let fvgs = [];
    const orderBlocks = [];
    const imbalanceZones = [];
    const volumeMA = calculateEMA(candles.map(c => c.volume), 20);
    const avgBodySize = candles.slice(0, -1).reduce((acc, c) => acc + Math.abs(c.close - c.open), 0) / candles.length;

    // --- FVG Detection ---
    for (let i = 2; i < candles.length; i++) {
        const prevCandle = candles[i - 2];
        const currentCandle = candles[i];
        if (currentCandle.low > prevCandle.high) {
            fvgs.push({ type: 'bullish', start: prevCandle.high, end: currentCandle.low, index: i - 1 });
        }
        if (prevCandle.low > currentCandle.high) {
            fvgs.push({ type: 'bearish', start: currentCandle.high, end: prevCandle.low, index: i - 1 });
        }
    }

    // --- Imbalance Zone Clustering ---
    if (settings.detectInstitutionalImbalanceZones && fvgs.length > 0) {
        let currentZone = null;
        for (const fvg of fvgs) {
            if (currentZone && fvg.type === currentZone.type && fvg.index === currentZone.endIndex + 1) {
                // This FVG is adjacent to the current zone, so merge it
                currentZone.end = (currentZone.type === 'bullish') ? Math.max(currentZone.end, fvg.end) : Math.min(currentZone.end, fvg.end);
                currentZone.start = (currentZone.type === 'bullish') ? Math.min(currentZone.start, fvg.start) : Math.max(currentZone.start, fvg.start);
                currentZone.endIndex = fvg.index;
                currentZone.fvgCount++;
            } else {
                // This FVG starts a new zone, store the previous one if it exists and meets criteria
                if (currentZone) {
                     if (!settings.onlyShowZonesAboveThreshold || currentZone.fvgCount >= settings.minFvgsPerZone) {
                        imbalanceZones.push(currentZone);
                    }
                }
                // Start a new zone
                currentZone = {
                    type: fvg.type,
                    start: fvg.start,
                    end: fvg.end,
                    startIndex: fvg.index,
                    endIndex: fvg.index,
                    fvgCount: 1
                };
            }
        }
        // Add the last zone
        if (currentZone) {
             if (!settings.onlyShowZonesAboveThreshold || currentZone.fvgCount >= settings.minFvgsPerZone) {
                imbalanceZones.push(currentZone);
            }
        }
        // If clustering is active, we don't show individual FVGs
        fvgs = []; 
    }

    // --- OB + MSS Detection and Scoring ---
    for (let i = settings.lookback; i < candles.length - 1; i++) {
        const { confirmed: bullishMss, mssIndex: bullishMssIndex } = isMssConfirmed(candles, i, 'bullish', settings);
        const { confirmed: bearishMss, mssIndex: bearishMssIndex } = isMssConfirmed(candles, i, 'bearish', settings);
        
        // --- Bearish OB + MSS ---
        if (i > 1 && candles[i-1].close > candles[i-1].open && bearishMss) { 
            const ob = { ...candles[i-1], type: 'bearish', index: i - 1, score: 0 };
            let score = 0;
            if (Math.abs(ob.close - ob.open) > avgBodySize) score += 1;
            if (ob.volume > volumeMA[i-1]) score += 1;
            if (analysisResult?.htfTrend?.direction === 'BEARISH') score += 1;
            const isAtHtfLevel = analysisResult?.htfKeyLevels?.some(l => l.type === 'resistance' && ob.high > l.price * (1 - settings.keyLevelProximity) && ob.low < l.price * (1 + settings.keyLevelProximity));
            if (isAtHtfLevel) score += 1;
            if (Math.abs(candles[bearishMssIndex].close - candles[bearishMssIndex].open) > avgBodySize * 1.2) score += 1;
            ob.score = score;
            orderBlocks.push(ob);

            if (!settings.enableOrderBlockScoring || score >= settings.minObScore) {
                for (let entryIndex = bearishMssIndex + 1; entryIndex < Math.min(bearishMssIndex + 6, candles.length); entryIndex++) {
                    if (candles[entryIndex].high >= ob.low) {
                        sellSignals.push({ time: candles[entryIndex].time, price: candles[entryIndex].high, type: 'SELL confirmed', notes: `OB+MSS (Score: ${score.toFixed(1)})`, mssIndex: bearishMssIndex });
                        break;
                    }
                }
            }
        }

        // --- Bullish OB + MSS ---
         if (i > 1 && candles[i-1].close < candles[i-1].open && bullishMss) { 
            const ob = { ...candles[i-1], type: 'bullish', index: i-1, score: 0 };
             let score = 0;
            if (Math.abs(ob.close - ob.open) > avgBodySize) score += 1;
            if (ob.volume > volumeMA[i-1]) score += 1;
            if (analysisResult?.htfTrend?.direction === 'BULLISH') score += 1;
            const isAtHtfLevel = analysisResult?.htfKeyLevels?.some(l => l.type === 'support' && ob.high > l.price * (1 - settings.keyLevelProximity) && ob.low < l.price * (1 + settings.keyLevelProximity));
            if (isAtHtfLevel) score += 1;
            if (Math.abs(candles[bullishMssIndex].close - candles[bullishMssIndex].open) > avgBodySize * 1.2) score += 1;
            ob.score = score;
            orderBlocks.push(ob);

            if (!settings.enableOrderBlockScoring || score >= settings.minObScore) {
                for (let entryIndex = bullishMssIndex + 1; entryIndex < Math.min(bullishMssIndex + 6, candles.length); entryIndex++) {
                    if (candles[entryIndex].low <= ob.high) {
                        buySignals.push({ time: candles[entryIndex].time, price: candles[entryIndex].low, type: 'BUY confirmed', notes: `OB+MSS (Score: ${score.toFixed(1)})`, mssIndex: bullishMssIndex });
                        break;
                    }
                }
            }
        }
    }
    const uniqueOrderBlocks = Array.from(new Map(orderBlocks.map(ob => [ob.index, ob])).values());
    return { buySignals, sellSignals, fvgs, orderBlocks: uniqueOrderBlocks, imbalanceZones };
}


/**
 * Detects Breaker Blocks (ICT-style) based on failed Order Blocks.
 * @param {Array<object>} candles - The array of candlestick data.
 * @param {object} settings - The strategy settings.
 * @param {object|null} analysisResult - The HTF analysis result, if available.
 */
export function detectBreakerBlocks(candles, settings, analysisResult) {
  const { lookback, breakerBlockConfirmation } = settings;
  const buySignals = [];
  const sellSignals = [];
  const breakerBlocks = [];
  
  // 1. Identify all potential order blocks first
  const potentialObs = findOrderBlocks(candles, lookback);

  for (const ob of potentialObs) {
    // 2. Check if the Order Block failed (was invalidated)
    let brokenIndex = -1;
    for (let i = ob.index + 1; i < Math.min(ob.index + lookback, candles.length); i++) {
        const candle = candles[i];
        // Bullish OB fails by price closing below its low
        if (ob.type === 'bullish' && candle.close < ob.candle.low) {
            brokenIndex = i;
            break;
        }
        // Bearish OB fails by price closing above its high
        if (ob.type === 'bearish' && candle.close > ob.candle.high) {
            brokenIndex = i;
            break;
        }
    }

    if (brokenIndex !== -1) {
        // This is now a candidate for a Breaker Block
        const breaker = {
            type: ob.type === 'bullish' ? 'bearish' : 'bullish', // The breaker is the opposite of the failed OB
            start: ob.candle.open,
            end: ob.candle.close,
            high: ob.candle.high,
            low: ob.candle.low,
            startIndex: ob.index,
            brokenIndex: brokenIndex,
        };
        breakerBlocks.push(breaker);

        // 3. Look for a retest and confirmation
        for (let i = brokenIndex + 1; i < Math.min(brokenIndex + 10, candles.length); i++) {
            const retestCandle = candles[i];
            let confirmed = false;
            let mssIndex = -1;

            // If a bearish OB failed, it becomes a bullish breaker (support)
            if (breaker.type === 'bullish' && retestCandle.low <= breaker.high && retestCandle.low >= breaker.low) {
                const { confirmed: bullishMss, mssIndex: bullishMssIndex } = isMssConfirmed(candles, i, 'bullish', settings);
                if (breakerBlockConfirmation === 'Candle Rejection' && retestCandle.close > retestCandle.open) confirmed = true;
                else if (breakerBlockConfirmation === 'MSS' && bullishMss) { confirmed = true; mssIndex = bullishMssIndex; }
                else if (breakerBlockConfirmation === 'FVG' && findFvgs(candles.slice(i, i+3)).some(f=>f.type==='bullish')) confirmed = true;
                
                if (confirmed) {
                    buySignals.push({ time: retestCandle.time, price: retestCandle.close, type: 'BUY confirmed', notes: `Bullish Breaker (${breakerBlockConfirmation})`, mssIndex });
                    break;
                }

            } 
            // If a bullish OB failed, it becomes a bearish breaker (resistance)
            else if (breaker.type === 'bearish' && retestCandle.high >= breaker.low && retestCandle.high <= breaker.high) {
                 const { confirmed: bearishMss, mssIndex: bearishMssIndex } = isMssConfirmed(candles, i, 'bearish', settings);
                 if (breakerBlockConfirmation === 'Candle Rejection' && retestCandle.close < retestCandle.open) confirmed = true;
                 else if (breakerBlockConfirmation === 'MSS' && bearishMss) { confirmed = true; mssIndex = bearishMssIndex; }
                 else if (breakerBlockConfirmation === 'FVG' && findFvgs(candles.slice(i, i+3)).some(f=>f.type==='bearish')) confirmed = true;

                if (confirmed) {
                    sellSignals.push({ time: retestCandle.time, price: retestCandle.close, type: 'SELL confirmed', notes: `Bearish Breaker (${breakerBlockConfirmation})`, mssIndex });
                    break;
                }
            }
        }
    }
  }
  
  const uniqueBreakerBlocks = Array.from(new Map(breakerBlocks.map(b => [b.startIndex, b])).values());
  return { buySignals, sellSignals, breakerBlocks: uniqueBreakerBlocks };
}

/**
 * Detects trade setups based on the Institutional Range (Dealing Range) strategy.
 * @param {Array<object>} candles - The full array of candlestick data.
 * @param {object} settings - The strategy settings.
 * @returns {object} An object containing buy/sell signals and the active dealing range.
 */
export function detectInstitutionalRange(candles, settings) {
  if (candles.length < settings.lookback || !settings.strategy.institutionalRange) {
    return { buySignals: [], sellSignals: [], dealingRange: null };
  }

  // 1. Define the Dealing Range from the most recent significant swing high/low
  let swingHigh = { price: -Infinity, index: -1 };
  let swingLow = { price: Infinity, index: -1 };

  // Find the highest high and lowest low in the current dataset to form the range
  for (let i = 0; i < candles.length; i++) {
    if (candles[i].high > swingHigh.price) {
      swingHigh = { price: candles[i].high, index: i };
    }
    if (candles[i].low < swingLow.price) {
      swingLow = { price: candles[i].low, index: i };
    }
  }

  if (swingHigh.index === -1 || swingLow.index === -1) {
    return { buySignals: [], sellSignals: [], dealingRange: null };
  }

  const anchor_high = swingHigh.price;
  const anchor_low = swingLow.price;
  const eq_50 = (anchor_high + anchor_low) / 2;

  const dealingRange = {
    anchor_high,
    anchor_low,
    eq_50,
  };

  const buySignals = [];
  const sellSignals = [];

  const { fvgs } = detectObAndMss(candles, settings, null);
  const potentialOBs = findOrderBlocks(candles, settings.lookback);
  const orderBlocks = potentialOBs.map(ob => ob.candle);


  for (let i = settings.lookback; i < candles.length; i++) {
    const currentCandle = candles[i];
    const isInPremium = currentCandle.close >= eq_50;
    const isInDiscount = currentCandle.close <= eq_50;
    const { confirmed: bullishMss, mssIndex: bullishMssIndex } = isMssConfirmed(candles, i, 'bullish', settings);
    const { confirmed: bearishMss, mssIndex: bearishMssIndex } = isMssConfirmed(candles, i, 'bearish', settings);


    if (isInDiscount) {
        const bullishOb = orderBlocks.find(ob => ob.type === 'bullish' && ob.index < i && currentCandle.low <= ob.high && currentCandle.low >= ob.low);
        const bullishFvg = fvgs.find(fvg => fvg.type === 'bullish' && fvg.index < i && currentCandle.low <= fvg.end && currentCandle.high >= fvg.start);

        if (bullishOb || bullishFvg) {
            if (bullishMss) {
                buySignals.push({
                    time: currentCandle.time,
                    price: currentCandle.close,
                    type: 'BUY confirmed',
                    notes: `Institutional Range: Discount entry via ${bullishOb ? 'OB' : ''}${bullishFvg ? (bullishOb ? '+FVG' : 'FVG'): ''}`,
                    mssIndex: bullishMssIndex
                });
            }
        }
    }

    if (isInPremium) {
        const bearishOb = orderBlocks.find(ob => ob.type === 'bearish' && ob.index < i && currentCandle.high >= ob.low && currentCandle.high <= ob.high);
        const bearishFvg = fvgs.find(fvg => fvg.type === 'bearish' && fvg.index < i && currentCandle.high >= fvg.start && currentCandle.low <= fvg.end);

        if (bearishOb || bearishFvg) {
             if (bearishMss) {
                sellSignals.push({
                    time: currentCandle.time,
                    price: currentCandle.close,
                    type: 'SELL confirmed',
                    notes: `Institutional Range: Premium entry via ${bearishOb ? 'OB' : ''}${bearishFvg ? (bullishOb ? '+FVG' : 'FVG'): ''}`,
                    mssIndex: bearishMssIndex
                });
            }
        }
    }
  }

  return { buySignals, sellSignals, dealingRange };
}


// Helper function to find basic order blocks.
function findOrderBlocks(candles, lookback) {
    const obs = [];
    for (let i = lookback; i < candles.length - 1; i++) {
        // Find a swing high for potential bearish OB
        const isSwingHigh = candles[i].high > candles[i-1].high && candles[i].high > candles[i+1].high;
        if(isSwingHigh) {
            // Find last bullish candle before this swing high
            for(let j=i-1; j > Math.max(0, i - lookback); j--) {
                if(candles[j].close > candles[j].open) {
                    obs.push({ type: 'bearish', candle: candles[j], index: j });
                    break;
                }
            }
        }

        // Find a swing low for potential bullish OB
        const isSwingLow = candles[i].low < candles[i-1].low && candles[i].low < candles[i+1].low;
        if(isSwingLow) {
             // Find last bearish candle before this swing low
             for(let j=i-1; j > Math.max(0, i-lookback); j--) {
                if(candles[j].close < candles[j].open) {
                    obs.push({ type: 'bullish', candle: candles[j], index: j });
                    break;
                }
            }
        }
    }
    return obs;
}


/**
 * Detects Asian session range, liquidity sweeps, and generates trade signals.
 * @param {Array<object>} candles - The array of candlestick data.
 * @param {object} settings - The strategy settings.
 * @returns {object} An object containing buy/sell signals and Asian range data.
 */
export function detectAsianRangeAndSweeps(candles, settings) {
    const buySignals = [];
    const sellSignals = [];
    const buyCandidates = [];
    const sellCandidates = [];
    const asianRanges = [];

    let currentDayRanges = {}; // { 'YYYY-MM-DD': { startIndex, endIndex, high, low, candles: [] } }

    candles.forEach((candle, index) => {
        const date = new Date(candle.time);
        const dayKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
        const hour = date.getUTCHours();

        if (hour >= 0 && hour < 5) {
            if (!currentDayRanges[dayKey]) {
                currentDayRanges[dayKey] = {
                    startIndex: index,
                    endIndex: index,
                    high: candle.high,
                    low: candle.low,
                };
            } else {
                const range = currentDayRanges[dayKey];
                range.endIndex = index;
                range.high = Math.max(range.high, candle.high);
                range.low = Math.min(range.low, candle.low);
            }
        }
    });
    
    Object.values(currentDayRanges).forEach(range => asianRanges.push(range));
    
    for(const range of asianRanges) {
        for (let i = range.endIndex + 1; i < candles.length; i++) {
            const candle = candles[i];
            const date = new Date(candle.time);
            const hour = date.getUTCHours();
            
            const rangeDay = new Date(candles[range.startIndex].time);
            const candleDay = new Date(candle.time);

            // only check for sweeps on the same day as the range
            if (rangeDay.getUTCFullYear() !== candleDay.getUTCFullYear() ||
                rangeDay.getUTCMonth() !== candleDay.getUTCMonth() ||
                rangeDay.getUTCDate() !== candleDay.getUTCDate()) {
                continue;
            }

            const inLondonKz = hour >= 7 && hour < 10;
            
            if (!inLondonKz) continue;
            
            const session = 'London';
            const { confirmed: bearishMss, mssIndex: bearishMssIndex } = isMssConfirmed(candles, i, 'bearish', settings);
            const { confirmed: bullishMss, mssIndex: bullishMssIndex } = isMssConfirmed(candles, i, 'bullish', settings);

            if (candle.high > range.high && candle.close < range.high) {
                sellCandidates.push({ time: candle.time, price: candle.high, type: 'BSL candidate', notes: `Asian High Sweep (${session})`});
                if (bearishMss) {
                    sellSignals.push({
                        time: candle.time,
                        price: candle.close,
                        type: 'SELL confirmed',
                        notes: `Asian High Sweep (${session})`,
                        mssIndex: bearishMssIndex
                    });
                }
            }

            if (candle.low < range.low && candle.close > range.low) {
                 buyCandidates.push({ time: candle.time, price: candle.low, type: 'SSL candidate', notes: `Asian Low Sweep (${session})`});
                 if (bullishMss) {
                    buySignals.push({
                        time: candle.time,
                        price: candle.close,
                        type: 'BUY confirmed',
                        notes: `Asian Low Sweep (${session})`,
                        mssIndex: bullishMssIndex
                    });
                }
            }
        }
    }
    
    return { buySignals, sellSignals, buyCandidates, sellCandidates, asianRanges };
}

/**
 * Detects trade setups based on the FVG Imbalance Rebalancing Model.
 * This function is enhanced to align with the FVG + ILV Continuation Model.
 * @param {Array<object>} candles - The array of candlestick data.
 * @param {object} settings - The strategy settings.
 * @param {object|null} analysisResult - The HTF analysis result, if available.
 * @returns {object} An object containing buy/sell signals and all detected FVGs/Imbalance Zones.
 */
export function detectFvgImbalance(candles, settings, analysisResult) {
    const buySignals = [];
    const sellSignals = [];
    const { fvgs, imbalanceZones } = detectObAndMss(candles, settings, null);
    const trend = analysisResult?.htfTrend?.direction || 'Ranging';

    const zonesToTest = settings.detectInstitutionalImbalanceZones ? imbalanceZones : fvgs;
    
    for (const zone of zonesToTest) {
        // --- Trend Alignment Check ---
        if (trend === 'BULLISH' && zone.type !== 'bullish') continue;
        if (trend === 'BEARISH' && zone.type !== 'bearish') continue;

        const endIndex = zone.endIndex || zone.index; // Handle both single FVGs and zones
        for (let i = endIndex + 1; i < candles.length && i < endIndex + 10; i++) {
            const candle = candles[i];
            const retraceBullish = zone.type === 'bullish' && candle.low <= zone.end;
            const retraceBearish = zone.type === 'bearish' && candle.high >= zone.start;
            const mssSettings = { ...settings, mssConfirmationRequired: true };
            const { confirmed: bullishMss, mssIndex: bullishMssIndex } = isMssConfirmed(candles, i, 'bullish', mssSettings);
            const { confirmed: bearishMss, mssIndex: bearishMssIndex } = isMssConfirmed(candles, i, 'bearish', mssSettings);


            if (retraceBullish) {
                // Check for MSS confirmation for a higher probability entry
                if (bullishMss) {
                    buySignals.push({ time: candle.time, price: candle.close, type: 'BUY confirmed', notes: `FVG/ILV Retest`, mssIndex: bullishMssIndex });
                    break; // Move to the next zone after a signal is found
                }
            }
            
            if (retraceBearish) {
                if (bearishMss) {
                    sellSignals.push({ time: candle.time, price: candle.close, type: 'SELL confirmed', notes: 'FVG/ILV Retest', mssIndex: bearishMssIndex });
                    break; // Move to the next zone after a signal is found
                }
            }
        }
    }

    return { buySignals, sellSignals, fvgs, imbalanceZones };
}

/**
 * Detects Liquidity Voids based on single-candle imbalances.
 * @param {Array<object>} candles - The array of candlestick data.
 * @param {object} settings - The strategy settings.
 * @returns {object} An object containing buy/sell signals and detected voids (as fvgs for visualization).
 */
export function detectLiquidityVoid(candles, settings) {
    const buySignals = [];
    const sellSignals = [];
    const voids = []; // Using the 'fvg' structure for visualization

    for (let i = 1; i < candles.length - 1; i++) {
        const displacementCandle = candles[i];
        const bodySize = Math.abs(displacementCandle.close - displacementCandle.open);
        const candleRange = displacementCandle.high - displacementCandle.low;

        // Check for strong displacement
        const isDisplacement = candleRange > 0 && bodySize / candleRange > 0.7;
        if (!isDisplacement) continue;

        if (displacementCandle.close > displacementCandle.open) {
            // A bullish displacement leaves a void behind.
            const voidStart = displacementCandle.open;
            const voidEnd = displacementCandle.close;
            voids.push({ type: 'bullish', start: voidStart, end: voidEnd, index: i });
            
            // Look for retest and confirmation
            for (let j = i + 1; j < Math.min(i + 10, candles.length); j++) {
                const { confirmed, mssIndex } = isMssConfirmed(candles, j, 'bullish', settings);
                if (candles[j].low <= voidEnd) { // Price re-enters the void
                    if (confirmed) {
                        buySignals.push({ time: candles[j].time, price: candles[j].close, type: 'BUY confirmed', notes: 'Liquidity Void Retest', mssIndex });
                        break; 
                    }
                }
            }
        }
        else if (displacementCandle.close < displacementCandle.open) {
            // A bearish displacement leaves a void behind.
            const voidStart = displacementCandle.close;
            const voidEnd = displacementCandle.open;
            voids.push({ type: 'bearish', start: voidStart, end: voidEnd, index: i });

            // Look for retest and confirmation
            for (let j = i + 1; j < Math.min(i + 10, candles.length); j++) {
                const { confirmed, mssIndex } = isMssConfirmed(candles, j, 'bearish', settings);
                if (candles[j].high >= voidStart) { // Price re-enters the void
                     if (confirmed) {
                        sellSignals.push({ time: candles[j].time, price: candles[j].close, type: 'SELL confirmed', notes: 'Liquidity Void Retest', mssIndex });
                        break;
                    }
                }
            }
        }
    }
    
    // Return voids as fvgs for visualization
    return { buySignals, sellSignals, fvgs: voids };
}


/**
 * Detects high-confluence setups combining a Liquidity Sweep, Order Block, and FVG.
 * This is an independent function and does not modify other strategies.
 * @param {Array<object>} candles - The array of candlestick data.
 * @param {object} settings - The strategy settings.
 * @returns {object} An object containing buy and sell signals.
 */
export function detectConfluenceStrategy(candles, settings, analysisResult) {
    const buySignals = [];
    const sellSignals = [];
    const { lookback } = settings;

    for (let i = lookback; i < candles.length - 5; i++) {
        const window = candles.slice(i - lookback, i);
        const highestHigh = Math.max(...window.map(c => c.high));
        const lowestLow = Math.min(...window.map(c => c.low));
        const sweepCandle = candles[i];

        // --- Bearish Confluence Setup (Sweep of High) ---
        const isBslSweep = sweepCandle.high > highestHigh && sweepCandle.close < highestHigh;
        if (isBslSweep) {
            // Find displacement, OB, and FVG after the sweep
            for (let j = i + 1; j < Math.min(i + 5, candles.length - 2); j++) {
                const displacementCandle = candles[j];
                const isBearishDisplacement = displacementCandle.close < displacementCandle.open && Math.abs(displacementCandle.close - displacementCandle.open) > (displacementCandle.high - displacementCandle.low) * 0.6;
                
                if (isBearishDisplacement) {
                    const obCandle = candles[j - 1];
                    const isBearishOb = obCandle.close > obCandle.open;
                    const fvg = findFvgs(candles.slice(j - 1, j + 2)).find(f => f.type === 'bearish');

                    if (isBearishOb && fvg) {
                        const confluenceZoneHigh = obCandle.high;
                        const confluenceZoneLow = Math.min(obCandle.low, fvg.start);
                        
                        // Look for retest of the confluence zone
                        for (let k = j + 1; k < Math.min(j + 5, candles.length); k++) {
                            const retestCandle = candles[k];
                            if (retestCandle.high >= confluenceZoneLow) {
                                // Confirmation: rejection candle
                                if (retestCandle.close < retestCandle.open) {
                                    sellSignals.push({
                                        time: retestCandle.time,
                                        price: retestCandle.close,
                                        type: 'SELL confirmed',
                                        notes: 'Sweep+OB+FVG Confluence'
                                    });
                                    break; 
                                }
                            }
                        }
                    }
                    break;
                }
            }
        }

        // --- Bullish Confluence Setup (Sweep of Low) ---
        const isSslSweep = sweepCandle.low < lowestLow && sweepCandle.close > lowestLow;
        if (isSslSweep) {
            for (let j = i + 1; j < Math.min(i + 5, candles.length - 2); j++) {
                const displacementCandle = candles[j];
                const isBullishDisplacement = displacementCandle.close > displacementCandle.open && Math.abs(displacementCandle.close - displacementCandle.open) > (displacementCandle.high - displacementCandle.low) * 0.6;

                if (isBullishDisplacement) {
                    const obCandle = candles[j - 1];
                    const isBullishOb = obCandle.close < obCandle.open;
                    const fvg = findFvgs(candles.slice(j - 1, j + 2)).find(f => f.type === 'bullish');

                    if (isBullishOb && fvg) {
                        const confluenceZoneLow = obCandle.low;
                        const confluenceZoneHigh = Math.max(obCandle.high, fvg.end);
                        
                        for (let k = j + 1; k < Math.min(j + 5, candles.length); k++) {
                            const retestCandle = candles[k];
                            if (retestCandle.low <= confluenceZoneHigh) {
                                if (retestCandle.close > retestCandle.open) {
                                    buySignals.push({
                                        time: retestCandle.time,
                                        price: retestCandle.close,
                                        type: 'BUY confirmed',
                                        notes: 'Sweep+OB+FVG Confluence'
                                    });
                                }
                                break;
                            }
                        }
                    }
                    break; 
                }
            }
        }
    }

    return { buySignals, sellSignals };
}


/**
 * Detects Continuation Order Blocks (COB) + Market Structure Shift (MSS) for trend-following entries.
 * @param {Array<object>} candles - The array of candlestick data.
 * @param {object} settings - The strategy settings.
 * @param {object|null} analysisResult - The HTF analysis result, if available.
 * @returns {object} An object containing buy/sell signals and detected continuation order blocks.
 */
export function detectContinuationObAndMss(candles, settings, analysisResult) {
    const buySignals = [];
    const sellSignals = [];
    const continuationOrderBlocks = [];
    const trend = analysisResult?.htfTrend?.direction || 'Ranging';

    if (trend === 'Ranging') return { buySignals, sellSignals, continuationOrderBlocks };

    for (let i = settings.cobLookbackPeriod; i < candles.length - 1; i++) {
        // --- Bullish COB Search ---
        if (trend === 'BULLISH') {
            const obCandle = candles[i-1];
            const displacementCandle = candles[i];

            // Is it a valid down-candle before a strong up-move?
            const isBullishImpulse = displacementCandle.close > displacementCandle.open && obCandle.close < obCandle.open;
            const bodySize = Math.abs(obCandle.close - obCandle.open);
            const range = obCandle.high - obCandle.low;
            const isValidBody = (range > 0) && (bodySize / range >= settings.cobMinBodyPercentage);

            if (isBullishImpulse && isValidBody) {
                const cob = { ...obCandle, type: 'bullish', index: i - 1 };
                continuationOrderBlocks.push(cob);

                // Check for retracement and MSS confirmation
                for (let j = i + 1; j < Math.min(i + 10, candles.length); j++) {
                    const retraceCandle = candles[j];
                    if (retraceCandle.low <= cob.high) { // Price has retraced into the COB
                        
                        // MSS Confirmation
                        if (settings.cobRequireMssConfirmation) {
                            const { confirmed, mssIndex } = isMssConfirmed(candles, j, 'bullish', { ...settings, mssConfirmationRequired: true });
                            if (confirmed) {
                                buySignals.push({ 
                                    time: retraceCandle.time, 
                                    price: retraceCandle.close, 
                                    type: 'BUY confirmed', 
                                    notes: 'COB+MSS',
                                    mssIndex: mssIndex
                                });
                                break; // Exit after first confirmed entry
                            }
                        } else {
                            buySignals.push({ time: retraceCandle.time, price: retraceCandle.close, type: 'BUY confirmed', notes: 'COB Retracement' });
                            break;
                        }
                    }
                }
            }
        }

        // --- Bearish COB Search ---
        if (trend === 'BEARISH') {
            const obCandle = candles[i-1];
            const displacementCandle = candles[i];

            // Is it a valid up-candle before a strong down-move?
            const isBearishImpulse = displacementCandle.close < displacementCandle.open && obCandle.close > obCandle.open;
            const bodySize = Math.abs(obCandle.close - obCandle.open);
            const range = obCandle.high - obCandle.low;
            const isValidBody = (range > 0) && (bodySize / range >= settings.cobMinBodyPercentage);

            if (isBearishImpulse && isValidBody) {
                const cob = { ...obCandle, type: 'bearish', index: i - 1 };
                continuationOrderBlocks.push(cob);

                // Check for retracement and MSS confirmation
                for (let j = i + 1; j < Math.min(i + 10, candles.length); j++) {
                    const retraceCandle = candles[j];
                    if (retraceCandle.high >= cob.low) { // Price has retraced into the COB

                        // MSS Confirmation
                        if (settings.cobRequireMssConfirmation) {
                            const { confirmed, mssIndex } = isMssConfirmed(candles, j, 'bearish', { ...settings, mssConfirmationRequired: true });
                            if (confirmed) {
                                sellSignals.push({ 
                                    time: retraceCandle.time, 
                                    price: retraceCandle.close, 
                                    type: 'SELL confirmed', 
                                    notes: 'COB+MSS',
                                    mssIndex: mssIndex
                                });
                                break; // Exit after first confirmed entry
                            }
                        } else {
                            sellSignals.push({ time: retraceCandle.time, price: retraceCandle.close, type: 'SELL confirmed', notes: 'COB Retracement' });
                            break;
                        }
                    }
                }
            }
        }
    }
    const uniqueCobs = Array.from(new Map(continuationOrderBlocks.map(cob => [cob.index, cob])).values());
    return { buySignals, sellSignals, continuationOrderBlocks: uniqueCobs };
}

/**
 * Detects liquidity sweeps during the London Kill Zone and generates signals.
 * @param {Array<object>} candles - The array of candlestick data.
 * @param {object} settings - The strategy settings.
 * @returns {object} An object containing buy and sell signals.
 */
export function detectLondonKillzoneTrades(candles, settings) {
    const buySignals = [];
    const sellSignals = [];
    const { 
        londonKzStartTime, 
        londonKzEndTime, 
        londonKzVolumeConfirmation, 
        lookback, 
        volumeMaPeriod 
    } = settings;
    
    const volumeMA = calculateEMA(candles.map(c => c.volume), volumeMaPeriod);

    for (let i = lookback; i < candles.length; i++) {
        const currentCandle = candles[i];
        const date = new Date(currentCandle.time);
        const hour = date.getUTCHours();

        // Check if the candle is within the London Kill Zone
        if (hour >= londonKzStartTime && hour < londonKzEndTime) {
            const window = candles.slice(i - lookback, i);
            const highestHighInWindow = Math.max(...window.map(c => c.high));
            const lowestLowInWindow = Math.min(...window.map(c => c.low));

            const isBslSweep = currentCandle.high > highestHighInWindow && currentCandle.close < highestHighInWindow;
            const isSslSweep = currentCandle.low < lowestLowInWindow && currentCandle.close > lowestLowInWindow;
            
            // Sell Signal
            if (isBslSweep) {
                const { confirmed, mssIndex } = isMssConfirmed(candles, i, 'bearish', settings);
                const volumeCheckPassed = !londonKzVolumeConfirmation || currentCandle.volume > volumeMA[i];
                if (volumeCheckPassed && confirmed) {
                    sellSignals.push({
                        time: currentCandle.time,
                        price: currentCandle.close,
                        type: 'SELL confirmed',
                        notes: `London KZ Sweep${londonKzVolumeConfirmation ? ' +Vol' : ''}`,
                        mssIndex
                    });
                }
            }

            // Buy Signal
            if (isSslSweep) {
                const { confirmed, mssIndex } = isMssConfirmed(candles, i, 'bullish', settings);
                const volumeCheckPassed = !londonKzVolumeConfirmation || currentCandle.volume > volumeMA[i];
                if (volumeCheckPassed && confirmed) {
                     buySignals.push({
                        time: currentCandle.time,
                        price: currentCandle.close,
                        type: 'BUY confirmed',
                        notes: `London KZ Sweep${londonKzVolumeConfirmation ? ' +Vol' : ''}`,
                        mssIndex
                    });
                }
            }
        }
    }

    return { buySignals, sellSignals };
}


/**
 * Detects liquidity sweeps during the New York Kill Zone and generates signals.
 * @param {Array<object>} candles - The array of candlestick data.
 * @param {object} settings - The strategy settings.
 * @returns {object} An object containing buy and sell signals.
 */
export function detectNewYorkKillzoneTrades(candles, settings) {
    const buySignals = [];
    const sellSignals = [];
    const { 
        newYorkKzStartTime, 
        newYorkKzEndTime, 
        newYorkKzVolumeConfirmation, 
        lookback, 
        volumeMaPeriod 
    } = settings;
    
    const volumeMA = calculateEMA(candles.map(c => c.volume), volumeMaPeriod);

    for (let i = lookback; i < candles.length; i++) {
        const currentCandle = candles[i];
        const date = new Date(currentCandle.time);
        const hour = date.getUTCHours();

        // Check if the candle is within the New York Kill Zone
        if (hour >= newYorkKzStartTime && hour < newYorkKzEndTime) {
            const window = candles.slice(i - lookback, i);
            const highestHighInWindow = Math.max(...window.map(c => c.high));
            const lowestLowInWindow = Math.min(...window.map(c => c.low));

            const isBslSweep = currentCandle.high > highestHighInWindow && currentCandle.close < highestHighInWindow;
            const isSslSweep = currentCandle.low < lowestLowInWindow && currentCandle.close > lowestLowInWindow;
            
            // Sell Signal
            if (isBslSweep) {
                const { confirmed, mssIndex } = isMssConfirmed(candles, i, 'bearish', settings);
                const volumeCheckPassed = !newYorkKzVolumeConfirmation || currentCandle.volume > volumeMA[i];
                if (volumeCheckPassed && confirmed) {
                    sellSignals.push({
                        time: currentCandle.time,
                        price: currentCandle.close,
                        type: 'SELL confirmed',
                        notes: `New York KZ Sweep${newYorkKzVolumeConfirmation ? ' +Vol' : ''}`,
                        mssIndex
                    });
                }
            }

            // Buy Signal
            if (isSslSweep) {
                const { confirmed, mssIndex } = isMssConfirmed(candles, i, 'bullish', settings);
                const volumeCheckPassed = !newYorkKzVolumeConfirmation || currentCandle.volume > volumeMA[i];
                if (volumeCheckPassed && confirmed) {
                     buySignals.push({
                        time: currentCandle.time,
                        price: currentCandle.close,
                        type: 'BUY confirmed',
                        notes: `New York KZ Sweep${newYorkKzVolumeConfirmation ? ' +Vol' : ''}`,
                        mssIndex
                    });
                }
            }
        }
    }

    return { buySignals, sellSignals };
}


/**
 * Detects the ICT Power of Three (AMD) pattern with granular phase controls.
 * @param {Array<object>} candles - The array of candlestick data.
 * @param {object} settings - The strategy settings.
 * @returns {object} An object containing signals and detected AMD zones.
 */
export function detectPowerOfThree(candles, settings) {
    const signals = [];
    const powerOfThreeZones = [];
    const { 
        powerOfThreeAccumulationLookback, 
        manipulationLookback, 
        manipulationVolumeConfirmation,
        requireCloseOutsideRange,
        distributionEntryLookback,
        distributionMssConfirmation
    } = settings;
    const volumeMA = calculateEMA(candles.map(c => c.volume), 20);

    for (let i = powerOfThreeAccumulationLookback; i < candles.length - (manipulationLookback + distributionEntryLookback); i++) {
        const accumulationWindow = candles.slice(i - powerOfThreeAccumulationLookback, i);
        
        // 1. Identify Accumulation Phase
        const high = Math.max(...accumulationWindow.map(c => c.high));
        const low = Math.min(...accumulationWindow.map(c => c.low));
        const avgRange = accumulationWindow.reduce((acc, c) => acc + (c.high - c.low), 0) / accumulationWindow.length;
        const totalRange = high - low;

        if (totalRange > avgRange * 2.5) continue; // Filter out high volatility

        const accumulationZone = {
            startIndex: i - powerOfThreeAccumulationLookback,
            endIndex: i - 1,
            accumulationHigh: high,
            accumulationLow: low,
        };

        // 2. Detect Manipulation Phase
        let manipulationCandle = null;
        let manipulationIndex = -1;
        for (let j = i; j < Math.min(i + manipulationLookback, candles.length); j++) {
            const candle = candles[j];
            
            // Bearish AMD (manipulation above high)
            const isBearishSweep = requireCloseOutsideRange ? candle.close > accumulationZone.accumulationHigh : candle.high > accumulationZone.accumulationHigh;
            if (isBearishSweep) {
                const volCheck = !manipulationVolumeConfirmation || candle.volume > volumeMA[j];
                if (volCheck) {
                    manipulationCandle = candle;
                    manipulationIndex = j;
                    signals.push({ time: candle.time, price: candle.high, type: 'Bearish Manipulation', notes: 'P3: Manipulation High' });
                    
                    // 3. Distribution + Entry
                    for (let k = j + 1; k < Math.min(j + distributionEntryLookback, candles.length); k++) {
                        const entryCandle = candles[k];
                        if (entryCandle.close < accumulationZone.accumulationHigh) {
                             const { confirmed, mssIndex } = isMssConfirmed(candles, k, 'bearish', {...settings, lookback: 10, mssConfirmationRequired: true});
                            if (!distributionMssConfirmation || confirmed) {
                                signals.push({
                                    time: entryCandle.time,
                                    price: entryCandle.close,
                                    type: 'SELL confirmed',
                                    notes: 'Power of Three',
                                    manipulationPrice: manipulationCandle.high,
                                    mssIndex
                                });
                                powerOfThreeZones.push({ ...accumulationZone, type: 'bearish', manipulationIndex: j, manipulationPrice: candle.high });
                            }
                            break;
                        }
                    }
                }
                break;
            }
            
            // Bullish AMD (manipulation below low)
            const isBullishSweep = requireCloseOutsideRange ? candle.close < accumulationZone.accumulationLow : candle.low < accumulationZone.accumulationLow;
            if (isBullishSweep) {
                const volCheck = !manipulationVolumeConfirmation || candle.volume > volumeMA[j];
                if (volCheck) {
                    manipulationCandle = candle;
                    manipulationIndex = j;
                    signals.push({ time: candle.time, price: candle.low, type: 'Bullish Manipulation', notes: 'P3: Manipulation Low' });

                    // 3. Distribution + Entry
                    for (let k = j + 1; k < Math.min(j + distributionEntryLookback, candles.length); k++) {
                        const entryCandle = candles[k];
                        if (entryCandle.close > accumulationZone.accumulationLow) {
                            const { confirmed, mssIndex } = isMssConfirmed(candles, k, 'bullish', {...settings, lookback: 10, mssConfirmationRequired: true});
                            if (!distributionMssConfirmation || confirmed) {
                                signals.push({
                                    time: entryCandle.time,
                                    price: entryCandle.close,
                                    type: 'BUY confirmed',
                                    notes: 'Power of Three',
                                    manipulationPrice: manipulationCandle.low,
                                    mssIndex
                                });
                                powerOfThreeZones.push({ ...accumulationZone, type: 'bullish', manipulationIndex: j, manipulationPrice: candle.low });
                            }
                            break;
                        }
                    }
                }
                break;
            }
        }
        if (manipulationIndex !== -1) {
            i = manipulationIndex; // Skip ahead to avoid re-detecting
        }
    }

    const uniqueZones = Array.from(new Map(powerOfThreeZones.map(z => [z.startIndex, z])).values());
    return { signals, powerOfThreeZones: uniqueZones };
}

/**
 * Detects breakouts of the Asian session range during the London open.
 * @param {Array<object>} candles - The array of candlestick data.
 * @param {object} settings - The strategy settings.
 * @returns {object} An object containing buy/sell signals and Asian range data.
 */
export function detectLondonBreakout(candles, settings) {
    const buySignals = [];
    const sellSignals = [];
    const asianRanges = [];
    const volumeMA = calculateEMA(candles.map(c => c.volume), settings.volumeMaPeriod);

    let currentDayRanges = {};

    candles.forEach((candle, index) => {
        const date = new Date(candle.time);
        const dayKey = date.toISOString().split('T')[0];
        const hour = date.getUTCHours();

        // Step 1: Identify Asian Session Range (00:00 - 08:00 GMT)
        if (hour >= 0 && hour < 8) {
            if (!currentDayRanges[dayKey]) {
                currentDayRanges[dayKey] = {
                    startIndex: index,
                    endIndex: index,
                    high: candle.high,
                    low: candle.low,
                    processed: false // Flag to ensure we only process breakout once per day
                };
            } else {
                const range = currentDayRanges[dayKey];
                range.endIndex = index;
                range.high = Math.max(range.high, candle.high);
                range.low = Math.min(range.low, candle.low);
            }
        }
    });
    
    Object.values(currentDayRanges).forEach(range => asianRanges.push(range));

    for (const range of asianRanges) {
        if (range.processed) continue;

        // Step 2: Monitor London Session Open (08:00 GMT onwards)
        for (let i = range.endIndex + 1; i < candles.length; i++) {
            const candle = candles[i];
            const date = new Date(candle.time);
            const hour = date.getUTCHours();
            
            const rangeDayKey = new Date(candles[range.startIndex].time).toISOString().split('T')[0];
            const candleDayKey = date.toISOString().split('T')[0];

            if (rangeDayKey !== candleDayKey) continue; // Only process for the same day
            if (hour < 8) continue; // Only start checking at London Open

            const isStrongCandle = Math.abs(candle.close - candle.open) > (candle.high - candle.low) * 0.6;
            const isVolumeSpike = candle.volume > volumeMA[i] * 1.2;

            // Bullish Breakout
            if (candle.close > range.high) {
                if (isStrongCandle && isVolumeSpike) {
                    buySignals.push({
                        time: candle.time,
                        price: candle.close,
                        type: 'BUY confirmed',
                        notes: 'London Breakout (Bullish)'
                    });
                    range.processed = true; // Mark as processed
                    break; // Move to the next day's range
                }
            }

            // Bearish Breakout
            if (candle.close < range.low) {
                 if (isStrongCandle && isVolumeSpike) {
                    sellSignals.push({
                        time: candle.time,
                        price: candle.close,
                        type: 'SELL confirmed',
                        notes: 'London Breakout (Bearish)'
                    });
                    range.processed = true; // Mark as processed
                    break; // Move to the next day's range
                }
            }
            
            // Stop checking for this day if we're too far into the session
            if(hour > 12) {
                range.processed = true;
                break;
            }
        }
    }
    
    return { buySignals, sellSignals, asianRanges };
}


/**
 * Detects breakouts of generic consolidation zones.
 * @param {Array<object>} candles - The array of candlestick data.
 * @param {object} settings - The strategy settings.
 * @returns {object} An object containing buy/sell signals and consolidation zone data.
 */
export function detectClassicBreakout(candles, settings) {
    const buySignals = [];
    const sellSignals = [];
    const classicBreakoutZones = [];
    const { classicBreakoutLookback, classicBreakoutVolumeSpike, classicBreakoutEnableRetest, volumeMaPeriod } = settings;
    const volumeMA = calculateEMA(candles.map(c => c.volume), volumeMaPeriod);
    let lastBreakoutIndex = -1;

    for (let i = classicBreakoutLookback; i < candles.length; i++) {
        if (i <= lastBreakoutIndex) continue; // Avoid overlapping analysis

        const window = candles.slice(i - classicBreakoutLookback, i);
        
        // Step 1: Identify Consolidation Zone
        const high = Math.max(...window.map(c => c.high));
        const low = Math.min(...window.map(c => c.low));
        const avgRange = window.reduce((acc, c) => acc + (c.high - c.low), 0) / window.length;
        const totalRange = high - low;

        // A simple check for consolidation: range is not too wide
        if (totalRange > avgRange * 3) {
            continue;
        }

        const zone = { startIndex: i - classicBreakoutLookback, endIndex: i - 1, high, low };
        classicBreakoutZones.push(zone);

        const breakoutCandle = candles[i];
        
        // Step 2-4: Check for Breakout
        const volCheck = !classicBreakoutVolumeSpike || breakoutCandle.volume > volumeMA[i];
        
        // Bullish Breakout
        if (breakoutCandle.close > high && volCheck) {
            if (!classicBreakoutEnableRetest) {
                buySignals.push({ time: breakoutCandle.time, price: breakoutCandle.close, type: 'BUY confirmed', notes: 'Classic Breakout' });
                lastBreakoutIndex = i;
            } else {
                // Step 5: Check for retest
                for (let j = i + 1; j < Math.min(i + 6, candles.length); j++) {
                    const retestCandle = candles[j];
                    if (retestCandle.low <= high) { // Retest successful
                        if(retestCandle.close > high) { // Bounce confirmation
                           buySignals.push({ time: retestCandle.time, price: retestCandle.close, type: 'BUY confirmed', notes: 'Classic Breakout + Retest' });
                           lastBreakoutIndex = j;
                           break;
                        }
                    }
                }
            }
        }
        
        // Bearish Breakout
        else if (breakoutCandle.close < low && volCheck) {
            if (!classicBreakoutEnableRetest) {
                sellSignals.push({ time: breakoutCandle.time, price: breakoutCandle.close, type: 'SELL confirmed', notes: 'Classic Breakout' });
                lastBreakoutIndex = i;
            } else {
                // Step 5: Check for retest
                for (let j = i + 1; j < Math.min(i + 6, candles.length); j++) {
                    const retestCandle = candles[j];
                    if (retestCandle.high >= low) { // Retest successful
                        if(retestCandle.close < low) { // Rejection confirmation
                           sellSignals.push({ time: retestCandle.time, price: retestCandle.close, type: 'SELL confirmed', notes: 'Classic Breakout + Retest' });
                           lastBreakoutIndex = j;
                           break;
                        }
                    }
                }
            }
        }
    }
    
    return { buySignals, sellSignals, classicBreakoutZones };
}

/**
 * Detects Mitigation Blocks for institutional re-entry.
 * @param {Array<object>} candles - The array of candlestick data.
 * @param {object} settings - The strategy settings.
 * @returns {object} An object containing buy/sell signals and detected mitigation blocks.
 */
export function detectMitigationBlocks(candles, settings) {
    const buySignals = [];
    const sellSignals = [];
    const mitigationBlocks = [];
    const { mitigationBlockConfirmation, lookback } = settings;

    for (let i = lookback; i < candles.length - 1; i++) {
        const displacementCandle = candles[i];
        const bodySize = Math.abs(displacementCandle.close - displacementCandle.open);
        const candleRange = displacementCandle.high - displacementCandle.low;

        // Check for strong displacement
        const isDisplacement = candleRange > 0 && bodySize / candleRange > 0.6;
        if (!isDisplacement) continue;

        // Bullish Displacement -> Find Bearish Mitigation Block
        if (displacementCandle.close > displacementCandle.open) {
            const lastOpposingCandle = candles[i - 1];
            if (lastOpposingCandle && lastOpposingCandle.close < lastOpposingCandle.open) {
                const mb = { ...lastOpposingCandle, type: 'bullish', index: i - 1 };
                mitigationBlocks.push(mb);
                
                // Look for retest and confirmation
                for (let j = i + 1; j < Math.min(i + 10, candles.length); j++) {
                    const retestCandle = candles[j];
                    if (retestCandle.low <= mb.high) { // Price came back to mitigate
                        let confirmed = false;
                        const { confirmed: mssConfirmed, mssIndex } = isMssConfirmed(candles, j, 'bullish', settings);
                        if (mitigationBlockConfirmation === 'Rejection Candle' && retestCandle.close > retestCandle.open) {
                            confirmed = true;
                        } else if (mitigationBlockConfirmation === 'MSS' && mssConfirmed) {
                            confirmed = true;
                        } else if (mitigationBlockConfirmation === 'FVG') {
                            const fvg = findFvgs(candles.slice(j, j + 3)).find(f => f.type === 'bullish');
                            if (fvg) confirmed = true;
                        }

                        if (confirmed) {
                            buySignals.push({ time: retestCandle.time, price: retestCandle.close, type: 'BUY confirmed', notes: `Mitigation (${mitigationBlockConfirmation})`, mssIndex });
                            break; // Signal found, stop checking for this block
                        }
                    }
                }
            }
        }
        // Bearish Displacement -> Find Bullish Mitigation Block
        else if (displacementCandle.close < displacementCandle.open) {
            const lastOpposingCandle = candles[i - 1];
            if (lastOpposingCandle && lastOpposingCandle.close > lastOpposingCandle.open) {
                const mb = { ...lastOpposingCandle, type: 'bearish', index: i - 1 };
                mitigationBlocks.push(mb);

                // Look for retest and confirmation
                for (let j = i + 1; j < Math.min(i + 10, candles.length); j++) {
                    const retestCandle = candles[j];
                    if (retestCandle.high >= mb.low) { // Price came back to mitigate
                        let confirmed = false;
                        const { confirmed: mssConfirmed, mssIndex } = isMssConfirmed(candles, j, 'bearish', settings);
                        if (mitigationBlockConfirmation === 'Rejection Candle' && retestCandle.close < retestCandle.open) {
                            confirmed = true;
                        } else if (mitigationBlockConfirmation === 'MSS' && mssConfirmed) {
                            confirmed = true;
                        } else if (mitigationBlockConfirmation === 'FVG') {
                             const fvg = findFvgs(candles.slice(j, j + 3)).find(f => f.type === 'bearish');
                            if (fvg) confirmed = true;
                        }
                        
                        if (confirmed) {
                            sellSignals.push({ time: retestCandle.time, price: retestCandle.close, type: 'SELL confirmed', notes: `Mitigation (${mitigationBlockConfirmation})`, mssIndex });
                            break;
                        }
                    }
                }
            }
        }
    }
    const uniqueMbs = Array.from(new Map(mitigationBlocks.map(mb => [mb.index, mb])).values());
    return { buySignals, sellSignals, mitigationBlocks: uniqueMbs };
}

// Helper to find FVGs within a small slice of candles
function findFvgs(localCandles) {
    const fvgs = [];
    if (localCandles.length < 3) return fvgs;
    const [c1, c2, c3] = localCandles;

    // Bullish FVG
    if (c3.low > c1.high) {
        fvgs.push({ type: 'bullish', start: c1.high, end: c3.low, index: 1 });
    }
    // Bearish FVG
    if (c1.low > c3.high) {
        fvgs.push({ type: 'bearish', start: c3.high, end: c1.low, index: 1 });
    }
    return fvgs;
}
