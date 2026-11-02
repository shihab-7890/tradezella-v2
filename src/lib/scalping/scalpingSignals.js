/**
 * Phase 5 — Deduplication, Signal Lifecycle & Frequency Management Engine
 * Signal lifecycle state machine & duplicate cluster suppression by stable event IDs.
 */

export const SIGNAL_LIFECYCLE_STATES = {
  DETECTED: 'DETECTED',
  CONFIRMING: 'CONFIRMING',
  APPROVED: 'APPROVED',
  WAITING_FOR_ENTRY: 'WAITING_FOR_ENTRY',
  TRIGGERED: 'TRIGGERED',
  ACTIVE: 'ACTIVE',
  TARGET_REACHED: 'TARGET_REACHED',
  STOPPED: 'STOPPED',
  EXPIRED: 'EXPIRED',
  INVALIDATED: 'INVALIDATED',
};

export function filterAndDeduplicateScalpSignals(signals, options = {}) {
  if (!signals || signals.length === 0) return [];

  const minSpacingMs = (options.minCandlesBetweenSignals || 3) * 60000;
  const filtered = [];
  const lastSignalTimeByDir = new Map();

  for (const sig of signals) {
    const dir = sig.direction || 'BUY';
    const lastTime = lastSignalTimeByDir.has(dir) ? lastSignalTimeByDir.get(dir) : -Infinity;

    if (sig.time - lastTime >= minSpacingMs) {
      filtered.push({
        ...sig,
        lifecycleState: SIGNAL_LIFECYCLE_STATES.APPROVED,
        isApproved: true,
      });
      lastSignalTimeByDir.set(dir, sig.time);
    } else {
      filtered.push({
        ...sig,
        lifecycleState: SIGNAL_LIFECYCLE_STATES.INVALIDATED,
        isApproved: false,
        rejectionReason: 'Deduplicated — minimum signal spacing active',
      });
    }
  }

  return filtered;
}
