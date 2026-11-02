/**
 * Phase 7 — Multi-Strategy Setup Deduplication & Evidence Aggregator
 * Merges multi-strategy detections of the same physical setup into one primary trade idea.
 */

/**
 * Groups raw candidates into physical setup clusters and selects the primary trade idea.
 */
export function aggregateSetupEvidence(candidates, candleTimeIndex, options = {}) {
  const {
    timeToleranceCandles = 4,
    priceTolerancePct = 0.003, // 0.3%
    minCandlesBetweenSignals = 5,
  } = options;

  let duplicatesSuppressed = 0;
  const clusteredSetups = [];
  const clusterMeta = [];

  // Sort candidates by initial score / confirmation time
  const sorted = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.time - b.time;
  });

  for (const candidate of sorted) {
    const candidateIdx = candleTimeIndex.get(candidate.time);
    if (candidateIdx === undefined) continue;

    // Look for existing cluster with SAME direction AND SAME tradingStyle within time & price tolerance
    const match = clusterMeta.find(m => {
      const sameDirection = m.candidate.direction === candidate.direction;
      const sameStyle = m.candidate.tradingStyle === candidate.tradingStyle;
      const indexDiff = Math.abs(m.index - candidateIdx);
      const priceDiffPct = Math.abs(m.candidate.price - candidate.price) / Math.max(m.candidate.price, candidate.price);

      return sameDirection && sameStyle && indexDiff <= timeToleranceCandles && priceDiffPct <= priceTolerancePct;
    });

    if (match) {
      duplicatesSuppressed++;
      const existing = match.candidate;

      // Merge confirmations
      if (!existing.confirmations) existing.confirmations = [existing.strategy];
      if (!existing.confirmations.includes(candidate.strategy)) {
        existing.confirmations.push(candidate.strategy);
      }

      // Merge source events
      if (!existing.sourceEvents) existing.sourceEvents = [];
      existing.sourceEvents.push(...(candidate.sourceEvents || [candidate]));

      // Merge evidence components
      if (candidate.evidence) {
        if (candidate.evidence.marketStructure?.hasMss) existing.evidence.marketStructure.hasMss = true;
        if (candidate.evidence.marketStructure?.hasBos) existing.evidence.marketStructure.hasBos = true;
        if (candidate.evidence.liquidity?.sweepDetected) existing.evidence.liquidity.sweepDetected = true;
        if (candidate.evidence.zoneConfluence?.inOrderBlock) existing.evidence.zoneConfluence.inOrderBlock = true;
        if (candidate.evidence.zoneConfluence?.inFvg) existing.evidence.zoneConfluence.inFvg = true;
      }

      // Update notes with combined evidence
      existing.notes = `${existing.strategy} + ${existing.confirmations.filter(c => c !== existing.strategy).join(' + ')}`;
    } else {
      const clustered = {
        ...candidate,
        confirmations: candidate.confirmations || [candidate.strategy],
      };
      clusteredSetups.push(clustered);
      clusterMeta.push({ candidate: clustered, index: candidateIdx });
    }
  }

  // Next: Enforce direction-aware spacing chronologically per trading style
  clusteredSetups.sort((a, b) => a.time - b.time);

  const styleBuckets = new Map();
  for (const setup of clusteredSetups) {
    const style = setup.tradingStyle || 'Intraday';
    if (!styleBuckets.has(style)) styleBuckets.set(style, []);
    styleBuckets.get(style).push(setup);
  }

  const finalSetups = [];

  for (const [style, setups] of styleBuckets.entries()) {
    let lastBuyIndex = -Infinity;
    let lastSellIndex = -Infinity;

    for (const setup of setups) {
      const idx = candleTimeIndex.get(setup.time);
      if (idx === undefined) continue;

      if (setup.direction === 'BUY') {
        if (idx - lastBuyIndex >= minCandlesBetweenSignals) {
          finalSetups.push(setup);
          lastBuyIndex = idx;
        } else {
          duplicatesSuppressed++;
        }
      } else {
        // SELL
        if (idx - lastSellIndex >= minCandlesBetweenSignals) {
          finalSetups.push(setup);
          lastSellIndex = idx;
        } else {
          duplicatesSuppressed++;
        }
      }
    }
  }

  finalSetups.sort((a, b) => a.time - b.time);

  return {
    aggregatedSetups: finalSetups,
    duplicatesSuppressed,
  };
}
