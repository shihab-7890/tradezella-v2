/**
 * Phase 7 — Advanced BUY/SELL Conflict Resolver
 * Classifies and resolves directional conflicts without discarding valid independent setups.
 */

import { CONFLICT_TYPES } from './types.js';

export function resolveSignalConflicts(setups, candleTimeIndex, options = {}) {
  const {
    conflictTimeTolerance = 4, // within 4 candles
    conflictPriceTolerance = 0.005, // within 0.5%
  } = options;

  const conflictsDetected = [];
  const resolvedSetups = [];

  for (let i = 0; i < setups.length; i++) {
    const current = setups[i];
    const currentIdx = candleTimeIndex.get(current.time);
    let conflictType = CONFLICT_TYPES.NONE;
    let conflictWarning = null;
    let conflictResolution = 'VALID_INDEPENDENT';

    // Compare with other setups in chronological window
    for (let j = 0; j < setups.length; j++) {
      if (i === j) continue;
      const other = setups[j];
      const otherIdx = candleTimeIndex.get(other.time);

      if (currentIdx === undefined || otherIdx === undefined) continue;
      const indexDiff = Math.abs(currentIdx - otherIdx);
      if (indexDiff > conflictTimeTolerance) continue;

      // Are they in opposite directions?
      if (current.direction !== other.direction) {
        const priceDiffPct = Math.abs(current.price - other.price) / Math.max(current.price, other.price);

        // Conflict Type B: Cross-Timeframe / Cross-Style
        if (current.tradingStyle !== other.tradingStyle) {
          conflictType = CONFLICT_TYPES.CROSS_TIMEFRAME;
          conflictWarning = `${current.tradingStyle} ${current.direction} counter to ${other.tradingStyle} ${other.direction}`;
          conflictResolution = 'PRESERVED_INDEPENDENT_STYLE';
          conflictsDetected.push({
            type: conflictType,
            setupA: current.candidateId,
            setupB: other.candidateId,
            warning: conflictWarning,
          });
          continue;
        }

        // Conflict Type A: Same Setup / Same Level Opposite Direction
        if (priceDiffPct <= conflictPriceTolerance) {
          const currentConfirmed = current.type?.includes('confirmed') || current.type?.includes('QUALIFIED');
          const otherConfirmed = other.type?.includes('confirmed') || other.type?.includes('QUALIFIED');

          if (currentConfirmed && !otherConfirmed) {
            conflictType = CONFLICT_TYPES.SAME_SETUP_OPPOSITE;
            conflictWarning = `${current.direction} confirmed while ${other.direction} is unconfirmed`;
            conflictResolution = 'DOMINANT_SCORE_RESOLVED';
          } else if (!currentConfirmed && otherConfirmed) {
            conflictType = CONFLICT_TYPES.SAME_SETUP_OPPOSITE;
            conflictWarning = `${current.direction} unconfirmed against confirmed ${other.direction}`;
            conflictResolution = 'SUBORDINATED_TO_COUNTER';
          } else {
            // Both confirmed or both unconfirmed
            const scoreDiff = (current.unifiedScore || 0) - (other.unifiedScore || 0);

            if (Math.abs(scoreDiff) < 10 && currentConfirmed && otherConfirmed) {
              // Contradictory evidence at same level with close scores -> classify as uncertain / WAIT
              conflictType = CONFLICT_TYPES.SAME_SETUP_OPPOSITE;
              conflictWarning = `Ambiguous contradictory ${current.direction} vs ${other.direction} at ${current.price.toFixed(2)}`;
              conflictResolution = 'WAIT_AMBIGUOUS_CONTRADICTION';
            } else if (scoreDiff >= 0) {
              conflictType = CONFLICT_TYPES.SAME_SETUP_OPPOSITE;
              conflictWarning = `${current.direction} favored over weak ${other.direction} (Score diff: +${scoreDiff.toFixed(1)})`;
              conflictResolution = 'DOMINANT_SCORE_RESOLVED';
            } else {
              conflictType = CONFLICT_TYPES.SAME_SETUP_OPPOSITE;
              conflictWarning = `${current.direction} subordinated to higher-quality ${other.direction}`;
              conflictResolution = 'SUBORDINATED_TO_COUNTER';
            }
          }

          conflictsDetected.push({
            type: conflictType,
            setupA: current.candidateId,
            setupB: other.candidateId,
            warning: conflictWarning,
          });
          continue;
        }

        // Conflict Type E: Independent Opposite Opportunities (distinct price zones)
        conflictType = CONFLICT_TYPES.INDEPENDENT_OPPOSITE;
        conflictWarning = `Distinct ${current.direction} setup at ${current.price.toFixed(2)} vs ${other.direction} at ${other.price.toFixed(2)}`;
        conflictResolution = 'PRESERVED_SEPARATE_ZONES';
      }
    }

    resolvedSetups.push({
      ...current,
      conflictType,
      conflictWarning,
      conflictResolution,
      isConflicted: conflictType !== CONFLICT_TYPES.NONE,
    });
  }

  return {
    resolvedSetups,
    conflictsDetected,
  };
}
