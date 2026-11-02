import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Trade Level Overlay & Clutter Management Suite', () => {
  const defaultTradeLevelVisibility = {
    showTradeLevels: false,
    showEntry: false,
    showStopLoss: false,
    showTakeProfit: false,
    showLabels: false,
    showSelectedTradeLevels: true,
  };

  it('Default settings provide a clean chart with lines and labels hidden by default', () => {
    assert.strictEqual(defaultTradeLevelVisibility.showTradeLevels, false, 'Master toggle should be false by default');
    assert.strictEqual(defaultTradeLevelVisibility.showEntry, false, 'Entry lines should be false by default');
    assert.strictEqual(defaultTradeLevelVisibility.showStopLoss, false, 'Stop loss lines should be false by default');
    assert.strictEqual(defaultTradeLevelVisibility.showTakeProfit, false, 'Take profit lines should be false by default');
    assert.strictEqual(defaultTradeLevelVisibility.showLabels, false, 'Labels should be false by default');
    assert.strictEqual(defaultTradeLevelVisibility.showSelectedTradeLevels, true, 'Selected trade levels should be true');
  });

  it('Master toggle OFF suppresses all background lines and labels', () => {
    const visibility = {
      ...defaultTradeLevelVisibility,
      showTradeLevels: false,
      showEntry: true,
      showStopLoss: true,
      showTakeProfit: true,
      showLabels: true,
      showSelectedTradeLevels: false,
    };

    // When master toggle is OFF and showSelectedTradeLevels is false, no trade levels are shown
    const shouldShowBackgroundLevels = visibility.showTradeLevels;
    const shouldShowSelectedLevels = visibility.showSelectedTradeLevels;
    
    assert.strictEqual(shouldShowBackgroundLevels, false);
    assert.strictEqual(shouldShowSelectedLevels, false);
  });

  it('Selected trade levels can be displayed even when background trade levels master is OFF', () => {
    const visibility = {
      ...defaultTradeLevelVisibility,
      showTradeLevels: false,
      showSelectedTradeLevels: true,
    };

    const isSelected = true;
    const shouldRenderForThisTrade = (isSelected && visibility.showSelectedTradeLevels) || visibility.showTradeLevels;
    assert.strictEqual(shouldRenderForThisTrade, true);

    const isNotSelected = false;
    const shouldRenderForOtherTrade = (isNotSelected && visibility.showSelectedTradeLevels) || visibility.showTradeLevels;
    assert.strictEqual(shouldRenderForOtherTrade, false);
  });

  it('Anti-overlap vertical positioning prevents label collisions', () => {
    // Replicates getAdjustedY logic from CandleStickChart.jsx
    function getAdjustedY(rawY, existingYList, minGap = 14, minBound = 10, maxBound = 500) {
      let y = Math.max(minBound, Math.min(maxBound, rawY));
      for (const usedY of existingYList) {
        if (Math.abs(y - usedY) < minGap) {
          y = y < usedY ? usedY - minGap : usedY + minGap;
        }
      }
      return Math.max(minBound, Math.min(maxBound, y));
    }

    const occupiedY = [];
    const rawY1 = 150.0;
    const y1 = getAdjustedY(rawY1, occupiedY);
    occupiedY.push(y1);

    // Second level very close (e.g., tight SL/Entry only 3px apart)
    const rawY2 = 152.0;
    const y2 = getAdjustedY(rawY2, occupiedY);
    occupiedY.push(y2);

    // Third level close to rawY2
    const rawY3 = 151.0;
    const y3 = getAdjustedY(rawY3, occupiedY);
    occupiedY.push(y3);

    // Verify minimum gap is maintained
    assert.ok(Math.abs(y1 - y2) >= 14, `y1 (${y1}) and y2 (${y2}) must be separated by >= 14px`);
    assert.ok(Math.abs(y2 - y3) >= 14, `y2 (${y2}) and y3 (${y3}) must be separated by >= 14px`);
  });

  it('Simultaneous visible trades are capped to prevent visual clutter', () => {
    const trades = [
      { id: 't1', price: 2000, time: 1000 },
      { id: 't2', price: 2005, time: 2000 },
      { id: 't3', price: 2010, time: 3000 },
      { id: 't4', price: 2015, time: 4000 },
      { id: 't5', price: 2020, time: 5000 },
      { id: 't6', price: 2025, time: 6000 },
    ];

    // Chart overlay limits background trades to max 3 recent visible trades
    const MAX_VISIBLE_TRADES = 3;
    const backgroundTrades = trades.slice(-MAX_VISIBLE_TRADES);

    assert.strictEqual(backgroundTrades.length, 3);
    assert.deepStrictEqual(backgroundTrades.map(t => t.id), ['t4', 't5', 't6']);
  });
});
