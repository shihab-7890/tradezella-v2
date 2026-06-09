'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { format } from 'date-fns';

export function CandleStickChart({ 
    candles, markers, playbackIndex, isPlaying, 
    viewState, setViewState, setIsDragging,
    liquidityData, breakerBlocks, mitigationBlocks, orderBlocks, continuationOrderBlocks, fvgs, imbalanceZones, dealingRange, asianRanges, powerOfThreeZones, classicBreakoutZones,
    htfKeyLevels, htfTrend,
    sessionSettings, settings 
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const { resolvedTheme } = useTheme();
  
  const [themeColors, setThemeColors] = useState({});
  const isDraggingRef = useRef(false);
  const [dragStart, setDragStart] = useState({ x: 0, candleOffset: 0 });
  const crosshairRef = useRef(null);
  const animationFrameId = useRef(null);
  const [pinchState, setPinchState] = useState({ initialDistance: 0, initialZoom: 1 });

  useEffect(() => {
    if (viewState.candleOffset === undefined) {
      setViewState(prev => ({ ...prev, candleOffset: 0 }));
    }
  }, [viewState.candleOffset, setViewState]);


  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const isDark = resolvedTheme === 'dark';
    setThemeColors({
      bg: `hsl(${style.getPropertyValue('--background').trim()})`,
      text: `hsl(${style.getPropertyValue('--foreground').trim()})`,
      bull: `hsl(${style.getPropertyValue('--bull').trim()})`,
      bear: `hsl(${style.getPropertyValue('--bear').trim()})`,
      grid: `hsl(${style.getPropertyValue('--border').trim()})`,
      primary: `hsl(${style.getPropertyValue('--primary').trim()})`,
      accent: `hsl(${style.getPropertyValue('--accent').trim()})`,
      accentForeground: `hsl(${style.getPropertyValue('--accent-foreground').trim()})`,
      bsl: `hsl(${style.getPropertyValue('--accent').trim()})`,
      ssl: `hsl(${style.getPropertyValue('--primary').trim()})`,
      crosshair: `hsl(${style.getPropertyValue('--muted-foreground').trim()})`,
      bullishBreaker: 'rgba(34, 197, 94, 0.1)',
      bearishBreaker: 'rgba(239, 68, 68, 0.1)',
      bullishBreakerBorder: 'rgba(34, 197, 94, 0.5)',
      bearishBreakerBorder: 'rgba(239, 68, 68, 0.5)',
      bullishMitigation: 'rgba(113, 204, 80, 0.15)', // Light Green
      bearishMitigation: 'rgba(255, 102, 102, 0.15)', // Light Red
      bullishMitigationBorder: 'rgba(113, 204, 80, 0.6)',
      bearishMitigationBorder: 'rgba(255, 102, 102, 0.6)',
      bullishOb: 'rgba(34, 197, 94, 0.15)',
      bearishOb: 'rgba(239, 68, 68, 0.15)',
      bullishObBorder: 'rgba(34, 197, 94, 0.6)',
      bearishObBorder: 'rgba(239, 68, 68, 0.6)',
      bullishCob: 'rgba(16, 185, 129, 0.15)', // A slightly different green for COB
      bearishCob: 'rgba(239, 68, 68, 0.15)', // Can be same as OB
      bullishCobBorder: 'rgba(16, 185, 129, 0.6)',
      bearishCobBorder: 'rgba(239, 68, 68, 0.6)',
      mssArrow: 'rgba(250, 204, 21, 1)', // yellow-400
      strongBullishOb: 'rgba(34, 197, 94, 0.25)',
      strongBearishOb: 'rgba(239, 68, 68, 0.25)',
      bullishFvg: 'rgba(34, 197, 94, 0.1)',
      bearishFvg: 'rgba(239, 68, 68, 0.1)',
      bullishFvgBorder: 'rgba(34, 197, 94, 0.3)',
      bearishFvgBorder: 'rgba(239, 68, 68, 0.3)',
      imbalanceZone: 'rgba(128, 0, 128, 0.1)', // Purple
      imbalanceZoneBorder: 'rgba(128, 0, 128, 0.4)',
      dealingRangePremium: 'rgba(239, 68, 68, 0.05)',
      dealingRangeDiscount: 'rgba(34, 197, 94, 0.05)',
      dealingRangeEq: 'rgba(255, 255, 255, 0.5)',
      asianRange: 'rgba(128, 128, 128, 0.1)',
      asianRangeBorder: 'rgba(128, 128, 128, 0.3)',
      classicBreakoutZone: 'rgba(100, 149, 237, 0.1)', // Cornflower blue
      classicBreakoutZoneBorder: 'rgba(100, 149, 237, 0.4)',
      powerOfThreeAccumulation: 'rgba(253, 224, 71, 0.1)', // yellow-400
      powerOfThreeAccumulationBorder: 'rgba(253, 224, 71, 0.4)',
      powerOfThreeManipulation: 'rgba(239, 68, 68, 1)', // red-500
      htfSupport: 'rgba(59, 130, 246, 0.5)',
      htfResistance: 'rgba(239, 68, 68, 0.5)',
      slColor: 'rgba(251, 146, 60, 1)', // orange-400
      tpColor: 'rgba(52, 211, 153, 1)', // emerald-400
      qualifiedSweep: 'rgba(250, 204, 21, 1)', // yellow-400
      sessionAsia: isDark ? 'rgba(0, 128, 255, 0.15)' : 'rgba(0, 128, 255, 0.10)',
      sessionLondon: isDark ? 'rgba(8, 145, 178, 0.25)' : 'rgba(8, 145, 178, 0.2)', // cyan
      sessionNY: isDark ? 'rgba(255, 165, 0, 0.17)' : 'rgba(255, 165, 0, 0.12)', // orange
      sessionOverlap: isDark ? 'rgba(128, 0, 128, 0.22)' : 'rgba(128, 0, 128, 0.16)', // purple
      sessionOverlapBorder: 'rgba(128, 0, 128, 0.5)',
    });
  }, [resolvedTheme]);

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !candles.length || Object.keys(themeColors).length === 0 || viewState.candleOffset === undefined) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas.getBoundingClientRect();

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = themeColors.bg;
    ctx.fillRect(0, 0, width, height);

    const candleWidth = viewState.zoom;
    const rightPadding = 80;
    const candlesOnScreen = Math.floor((width - rightPadding) / candleWidth);
    
    const startIndex = Math.max(0, Math.floor(viewState.candleOffset));
    const endIndex = Math.min(candles.length, startIndex + candlesOnScreen + 2); // +2 for partial candles
    const visibleCandles = candles.slice(startIndex, endIndex);

    if (visibleCandles.length === 0) return;

    let minPrice = Math.min(...visibleCandles.map(c => c.low));
    let maxPrice = Math.max(...visibleCandles.map(c => c.high));

    // Adjust price range to include dealing range if it exists
    if (settings.strategy.institutionalRange && dealingRange) {
        minPrice = Math.min(minPrice, dealingRange.anchor_low);
        maxPrice = Math.max(maxPrice, dealingRange.anchor_high);
    }
    const priceRange = maxPrice - minPrice;
    
    const topPadding = 30;
    const bottomPadding = 30;
    const chartHeight = height - topPadding - bottomPadding;

    const priceToY = price => topPadding + chartHeight - ((price - minPrice) / priceRange * chartHeight);
    const yToPrice = y => maxPrice - ((y - topPadding) / chartHeight) * priceRange;
    
    // Draw Kill Zones if enabled
    visibleCandles.forEach((candle, index) => {
        const globalIndex = startIndex + index;
        const date = new Date(candle.time);
        const hour = date.getUTCHours();
        const x = (globalIndex - viewState.candleOffset) * candleWidth;
        
        if (settings.strategy.londonKillzone && hour >= settings.londonKzStartTime && hour < settings.londonKzEndTime) {
            ctx.fillStyle = themeColors.sessionLondon;
            ctx.fillRect(x, topPadding, candleWidth, chartHeight);
        }
        if (settings.strategy.newYorkKillzone && hour >= settings.newYorkKzStartTime && hour < settings.newYorkKzEndTime) {
            ctx.fillStyle = themeColors.sessionNY;
            ctx.fillRect(x, topPadding, candleWidth, chartHeight);
        }
    });

    // Draw Session Bands
    if (sessionSettings?.enabled) {
      const sessionDefs = {
          asia: { start: 0, end: 9, color: themeColors.sessionAsia, on: sessionSettings.asia },
          london: { start: 7, end: 16, color: themeColors.sessionLondon, on: sessionSettings.london },
          newYork: { start: 12, end: 21, color: themeColors.sessionNY, on: sessionSettings.newYork }
      };

      visibleCandles.forEach((candle, index) => {
          const globalIndex = startIndex + index;
          const date = new Date(candle.time);
          const hour = date.getUTCHours();
          const x = (globalIndex - viewState.candleOffset) * candleWidth;

          const inAsia = hour >= sessionDefs.asia.start && hour < sessionDefs.asia.end;
          const inLondon = hour >= sessionDefs.london.start && hour < sessionDefs.london.end;
          const inNY = hour >= sessionDefs.newYork.start && hour < sessionDefs.newYork.end;

          const isAsiaLondonOverlap = inAsia && inLondon;
          const isLondonNYOverlap = inLondon && inNY;
          
          ctx.save();
          // Draw killzones underneath regular session bands for clarity
          if (settings.strategy.londonKillzone && hour >= settings.londonKzStartTime && hour < settings.londonKzEndTime) {
              // This is drawn above, so we skip here to avoid double-drawing
          } else if (settings.strategy.newYorkKillzone && hour >= settings.newYorkKzStartTime && hour < settings.newYorkKzEndTime) {
              // This is drawn above, so we skip here to avoid double-drawing
          } else if (sessionSettings.overlaps && (isAsiaLondonOverlap || isLondonNYOverlap)) {
              ctx.fillStyle = themeColors.sessionOverlap;
              ctx.fillRect(x, topPadding, candleWidth, chartHeight);
              
              ctx.setLineDash([2, 2]);
              ctx.strokeStyle = themeColors.sessionOverlapBorder;
              ctx.lineWidth = 0.5;
              ctx.strokeRect(x, topPadding, candleWidth, chartHeight);

          } else if (sessionDefs.asia.on && inAsia) {
              ctx.fillStyle = sessionDefs.asia.color;
              ctx.fillRect(x, topPadding, candleWidth, chartHeight);
          } else if (sessionDefs.london.on && inLondon) {
              ctx.fillStyle = sessionDefs.london.color;
              ctx.fillRect(x, topPadding, candleWidth, chartHeight);
          } else if (sessionDefs.newYork.on && inNY) {
              ctx.fillStyle = sessionDefs.newYork.color;
              ctx.fillRect(x, topPadding, candleWidth, chartHeight);
          }
          ctx.restore();
      });
    }

    // Draw Asian Range
    if (settings.showAsianRange && asianRanges) {
        asianRanges.forEach(range => {
            if (range.startIndex > endIndex || range.endIndex < startIndex) return;

            const startX = (range.startIndex - viewState.candleOffset) * candleWidth;
            const endX = (range.endIndex - viewState.candleOffset) * candleWidth + candleWidth;
            
            if (startX > width || endX < 0) return;

            const yHigh = priceToY(range.high);
            const yLow = priceToY(range.low);

            ctx.fillStyle = themeColors.asianRange;
            ctx.strokeStyle = themeColors.asianRangeBorder;
            ctx.lineWidth = 0.5;
            ctx.fillRect(startX, yHigh, endX - startX, yLow - yHigh);
            ctx.strokeRect(startX, yHigh, endX - startX, yLow - yHigh);

            ctx.font = '10px Inter';
            ctx.fillStyle = themeColors.text;
            ctx.fillText('Asia', startX + 5, yHigh - 5);
        });
    }

    // Draw Classic Breakout Zones
    if (settings.strategy.classicBreakout && classicBreakoutZones) {
        classicBreakoutZones.forEach(zone => {
            if (zone.startIndex > endIndex || zone.endIndex < startIndex) return;

            const startX = (zone.startIndex - viewState.candleOffset) * candleWidth;
            const endX = (zone.endIndex - viewState.candleOffset) * candleWidth + candleWidth;
            
            if (startX > width || endX < 0) return;

            const yHigh = priceToY(zone.high);
            const yLow = priceToY(zone.low);

            ctx.fillStyle = themeColors.classicBreakoutZone;
            ctx.strokeStyle = themeColors.classicBreakoutZoneBorder;
            ctx.lineWidth = 0.5;
            ctx.fillRect(startX, yHigh, endX - startX, yLow - yHigh);
            ctx.strokeRect(startX, yHigh, endX - startX, yLow - yHigh);

            ctx.font = '10px Inter';
            ctx.fillStyle = themeColors.classicBreakoutZoneBorder;
            ctx.fillText('Consolidation', startX + 5, yHigh - 5);
        });
    }
    
    // Draw Dealing Range
    if (settings.strategy.institutionalRange && dealingRange) {
        const yHigh = priceToY(dealingRange.anchor_high);
        const yLow = priceToY(dealingRange.anchor_low);
        const yEq = priceToY(dealingRange.eq_50);

        // Premium Zone
        ctx.fillStyle = themeColors.dealingRangePremium;
        ctx.fillRect(0, yHigh, width - rightPadding, yEq - yHigh);
        // Discount Zone
        ctx.fillStyle = themeColors.dealingRangeDiscount;
        ctx.fillRect(0, yEq, width - rightPadding, yLow - yEq);

        // EQ line
        ctx.save();
        ctx.setLineDash([10, 10]);
        ctx.strokeStyle = themeColors.dealingRangeEq;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, yEq);
        ctx.lineTo(width - rightPadding, yEq);
        ctx.stroke();
        ctx.restore();

        ctx.font = '10px Inter';
        ctx.fillStyle = themeColors.text;
        ctx.fillText('Premium', 5, yHigh + 10);
        ctx.fillText('Discount', 5, yLow - 5);
        ctx.fillText('EQ', 5, yEq - 5);
    }
    
    // Draw HTF Key Levels
    if (settings.enableMtfEngine && settings.showHtfKeyLevels && htfKeyLevels) {
      htfKeyLevels.forEach(level => {
          if (level.price >= minPrice && level.price <= maxPrice) {
              const y = priceToY(level.price);
              ctx.save();
              ctx.setLineDash([8, 8]);
              ctx.strokeStyle = level.type === 'support' ? themeColors.htfSupport : themeColors.htfResistance;
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(width - rightPadding, y);
              ctx.stroke();

              ctx.fillStyle = ctx.strokeStyle;
              ctx.font = 'bold 10px Inter';
              ctx.textAlign = 'left';
              ctx.fillText(`${settings.htfTimeframe.toUpperCase()} ${level.type.charAt(0).toUpperCase() + level.type.slice(1)}`, 5, y - 4);
              ctx.restore();
          }
      });
    }

    // Draw grid and Y-axis
    ctx.strokeStyle = themeColors.grid;
    ctx.font = '12px Inter';
    ctx.fillStyle = themeColors.text;
    ctx.lineWidth = 0.5;
    const numGridLines = 8;
    for (let i = 0; i <= numGridLines; i++) {
        const price = minPrice + (priceRange / numGridLines) * i;
        const y = priceToY(price);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width - rightPadding, y);
        ctx.stroke();
        ctx.fillText(price.toFixed(2), width - rightPadding + 5, y + 4);
    }
    
    // Draw X-axis
    ctx.beginPath();
    ctx.moveTo(0, height - bottomPadding);
    ctx.lineTo(width - rightPadding, height - bottomPadding);
    ctx.stroke();
    
    const timeLabelInterval = Math.max(1, Math.floor(candlesOnScreen / 8));
    visibleCandles.forEach((candle, index) => {
        const currentGlobalIndex = startIndex + index;
        if(currentGlobalIndex % timeLabelInterval === 0) {
            const x = (currentGlobalIndex - viewState.candleOffset) * candleWidth + candleWidth/2;
            if (x > 0 && x < width - rightPadding) {
                ctx.fillStyle = themeColors.text;
                ctx.fillText(format(new Date(candle.time), 'HH:mm'), x - 15, height - 10);
            }
        }
    });
    
    // Draw liquidity pools
    if(settings.showLiquidityPools && liquidityData) {
      const { equalHighs, equalLows } = liquidityData;
      ctx.save()
      ctx.lineWidth = 1;
      [...(equalHighs || []), ...(equalLows || [])].forEach(pool => {
        const isHigh = equalHighs.includes(pool);
        if (pool.price >= minPrice && pool.price <= maxPrice) {
          const y = priceToY(pool.price);
          const poolStartIndex = pool.indices[0];
          const poolEndIndex = pool.indices[pool.indices.length - 1];

          if(poolEndIndex >= startIndex && poolStartIndex <= endIndex) {
            ctx.strokeStyle = isHigh ? themeColors.bsl : themeColors.ssl;
            
            // Qualified pools are solid, others are dashed
            if (pool.isQualified) {
                 ctx.setLineDash([]);
                 ctx.lineWidth = 1.5;
            } else {
                 ctx.setLineDash([5, 5]);
                 ctx.lineWidth = 1;
            }

            ctx.beginPath();
            const startX = (poolStartIndex - viewState.candleOffset) * candleWidth;
            const endX = (poolEndIndex - viewState.candleOffset) * candleWidth + candleWidth;
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
          }
        }
      });
      ctx.restore();
    }

    // Draw Power of Three Zones
    if (settings.strategy.powerOfThree && powerOfThreeZones) {
        powerOfThreeZones.forEach(zone => {
            if (zone.endIndex < startIndex || zone.startIndex > endIndex) return;

            const startX = (zone.startIndex - viewState.candleOffset) * candleWidth;
            const endX = (zone.endIndex - viewState.candleOffset) * candleWidth + candleWidth;

            if (startX > width || endX < 0) return;

            // Draw Accumulation Box
            const yHigh = priceToY(zone.accumulationHigh);
            const yLow = priceToY(zone.accumulationLow);
            ctx.fillStyle = themeColors.powerOfThreeAccumulation;
            ctx.strokeStyle = themeColors.powerOfThreeAccumulationBorder;
            ctx.lineWidth = 1;
            ctx.fillRect(startX, yHigh, endX - startX, yLow - yHigh);
            ctx.strokeRect(startX, yHigh, endX - startX, yLow - yHigh);
            ctx.font = 'bold 10px Inter';
            ctx.fillStyle = themeColors.powerOfThreeAccumulationBorder;
            ctx.fillText('Accumulation', startX + 5, yHigh + 12);

            // Draw Manipulation Line/Marker if observed
            if (zone.manipulationIndex > zone.endIndex && zone.manipulationIndex <= playbackIndex && settings.observeManipulation) {
                const manipX = (zone.manipulationIndex - viewState.candleOffset) * candleWidth + candleWidth / 2;
                const manipY = priceToY(zone.manipulationPrice);
                const accumY = zone.type === 'bullish' ? yLow : yHigh;
                
                ctx.save();
                ctx.strokeStyle = themeColors.powerOfThreeManipulation;
                ctx.lineWidth = 1.5;
                ctx.setLineDash([2, 3]);
                ctx.beginPath();
                ctx.moveTo(manipX, manipY);
                ctx.lineTo(manipX, accumY);
                ctx.stroke();
                ctx.setLineDash([]);
                
                ctx.font = 'bold 12px Inter';
                ctx.fillStyle = themeColors.powerOfThreeManipulation;
                ctx.textAlign = 'center';
                ctx.fillText('M', manipX, manipY + (zone.type === 'bullish' ? 12 : -4));
                ctx.restore();
            }
        });
    }

    // Draw Imbalance Zones
    if (settings.detectInstitutionalImbalanceZones && imbalanceZones) {
        imbalanceZones.forEach(zone => {
            if (zone.endIndex < startIndex || zone.startIndex > endIndex) return;

            const y1 = priceToY(zone.start);
            const y2 = priceToY(zone.end);
            const startX = (zone.startIndex - viewState.candleOffset) * candleWidth;
            const endX = (zone.endIndex - viewState.candleOffset) * candleWidth + candleWidth;

            if (startX > width || endX < 0) return;

            ctx.fillStyle = themeColors.imbalanceZone;
            ctx.strokeStyle = themeColors.imbalanceZoneBorder;
            ctx.lineWidth = 1;
            ctx.fillRect(startX, Math.min(y1, y2), endX - startX, Math.abs(y1 - y2));
            ctx.strokeRect(startX, Math.min(y1, y2), endX - startX, Math.abs(y1 - y2));

            ctx.font = 'bold 10px Inter';
            ctx.fillStyle = themeColors.imbalanceZoneBorder;
            ctx.textAlign = 'left';
            ctx.fillText(`IZ: ${zone.fvgCount} FVGs`, startX + 5, y1 + (zone.type === 'bullish' ? -5 : 15));
        });
    }
    // Draw Fair Value Gaps (FVGs)
    else if (settings.showFvgs && fvgs) {
        fvgs.forEach(fvg => {
            if (fvg.index < startIndex - 2 || fvg.index > endIndex) return; // Cull off-screen FVGs

            const y1 = priceToY(fvg.start);
            const y2 = priceToY(fvg.end);

            const startX = (fvg.index - viewState.candleOffset) * candleWidth;
            const endX = startX + candleWidth; 
            
            if (startX > width || endX < 0) return;

            ctx.fillStyle = fvg.type === 'bullish' ? themeColors.bullishFvg : themeColors.bearishFvg;
            ctx.strokeStyle = fvg.type === 'bullish' ? themeColors.bullishFvgBorder : themeColors.bearishFvgBorder;
            ctx.lineWidth = 0.5;
            ctx.fillRect(startX, Math.min(y1, y2), endX - startX, Math.abs(y1-y2));
            ctx.strokeRect(startX, Math.min(y1, y2), endX - startX, Math.abs(y1-y2));
        });
    }
    
    // Draw Continuation Order Blocks
    if (settings.strategy.cobMss && continuationOrderBlocks) {
      continuationOrderBlocks.forEach(cob => {
        if (cob.index < startIndex || cob.index > endIndex) return;
        
        const y1 = priceToY(cob.high);
        const y2 = priceToY(cob.low);
        const x = (cob.index - viewState.candleOffset) * candleWidth;
        const cobWidth = candleWidth;

        ctx.fillStyle = cob.type === 'bullish' ? themeColors.bullishCob : themeColors.bearishCob;
        ctx.strokeStyle = cob.type === 'bullish' ? themeColors.bullishCobBorder : themeColors.bearishCobBorder;
        ctx.lineWidth = 1;
        
        ctx.fillRect(x, Math.min(y1,y2), cobWidth, Math.abs(y1-y2));
        ctx.strokeRect(x, Math.min(y1,y2), cobWidth, Math.abs(y1-y2));
      });
    }

    // Draw Reversal Order Blocks
    if (settings.strategy.obMss && orderBlocks) {
      orderBlocks.forEach(ob => {
        if (ob.index < startIndex || ob.index > endIndex) return;
        
        const isStrong = settings.enableOrderBlockScoring && ob.score >= settings.minObScore;
        const y1 = priceToY(ob.high);
        const y2 = priceToY(ob.low);
        const x = (ob.index - viewState.candleOffset) * candleWidth;
        const obWidth = candleWidth;

        ctx.fillStyle = ob.type === 'bullish' 
            ? (isStrong ? themeColors.strongBullishOb : themeColors.bullishOb) 
            : (isStrong ? themeColors.strongBearishOb : themeColors.bearishOb);
        ctx.strokeStyle = ob.type === 'bullish' ? themeColors.bullishObBorder : themeColors.bearishObBorder;
        ctx.lineWidth = 1;
        
        ctx.fillRect(x, Math.min(y1,y2), obWidth, Math.abs(y1-y2));
        ctx.strokeRect(x, Math.min(y1,y2), obWidth, Math.abs(y1-y2));

        if (settings.enableOrderBlockScoring && ob.score) {
            ctx.font = '10px Inter';
            ctx.fillStyle = themeColors.text;
            ctx.textAlign = 'left';
            const scoreText = `Score: ${ob.score.toFixed(1)}`;
            ctx.fillText(scoreText, x + 2, y1 + (ob.type === 'bullish' ? -4 : 12));
        }
      });
    }

    // Draw Breaker Blocks
    if (settings.showBreakerBlocks && breakerBlocks) {
      breakerBlocks.forEach(bb => {
        if (bb.brokenIndex < startIndex && bb.startIndex > endIndex) return;

        const y1 = priceToY(bb.start);
        const y2 = priceToY(bb.end);
        
        const startX = (bb.startIndex - viewState.candleOffset) * candleWidth;
        const endX = Math.min(width - rightPadding, (bb.brokenIndex - viewState.candleOffset + 10) * candleWidth);


        if (startX > width || endX < 0) return;
        
        ctx.fillStyle = bb.type === 'bullish' ? themeColors.bullishBreaker : themeColors.bearishBreaker;
        ctx.strokeStyle = bb.type === 'bullish' ? themeColors.bullishBreakerBorder : themeColors.bearishBreakerBorder;
        ctx.lineWidth = 1;
        ctx.fillRect(startX, Math.min(y1, y2), endX - startX, Math.abs(y1 - y2));
        ctx.strokeRect(startX, Math.min(y1, y2), endX - startX, Math.abs(y1 - y2));
      });
    }

    // Draw Mitigation Blocks
    if (settings.showMitigationBlocks && mitigationBlocks) {
      mitigationBlocks.forEach(mb => {
        if (mb.index < startIndex || mb.index > endIndex) return;

        const y1 = priceToY(mb.high);
        const y2 = priceToY(mb.low);
        const x = (mb.index - viewState.candleOffset) * candleWidth;
        
        ctx.fillStyle = mb.type === 'bullish' ? themeColors.bullishMitigation : themeColors.bearishMitigation;
        ctx.strokeStyle = mb.type === 'bullish' ? themeColors.bullishMitigationBorder : themeColors.bearishMitigationBorder;
        ctx.lineWidth = 1;
        ctx.fillRect(x, Math.min(y1, y2), candleWidth, Math.abs(y1 - y2));
        ctx.strokeRect(x, Math.min(y1, y2), candleWidth, Math.abs(y1 - y2));
        
        ctx.font = '10px Inter';
        ctx.fillStyle = mb.type === 'bullish' ? themeColors.bullishMitigationBorder : themeColors.bearishMitigationBorder;
        ctx.fillText('Mitigation', x + 2, y1 + (mb.type === 'bullish' ? -4 : 12));
      });
    }
    
    // Draw candles and markers
    visibleCandles.forEach((candle, index) => {
        const x = (startIndex + index - viewState.candleOffset) * candleWidth;
        const yOpen = priceToY(candle.open);
        const yClose = priceToY(candle.close);
        const yHigh = priceToY(candle.high);
        const yLow = priceToY(candle.low);
        
        ctx.strokeStyle = candle.close >= candle.open ? themeColors.bull : themeColors.bear;
        ctx.fillStyle = candle.close >= candle.open ? themeColors.bull : themeColors.bear;
        ctx.lineWidth = 1.5;

        // Wick
        ctx.beginPath();
        ctx.moveTo(x + candleWidth / 2, yHigh);
        ctx.lineTo(x + candleWidth / 2, yLow);
        ctx.stroke();
        
        // Body
        ctx.fillRect(x + (candleWidth * 0.1), Math.min(yOpen, yClose), candleWidth * 0.8, Math.max(1, Math.abs(yOpen - yClose)));
        
        // Draw markers
        const candleGlobalIndex = startIndex + index;
        const candleMarkers = markers.filter(m => m.index === candleGlobalIndex && candleGlobalIndex <= playbackIndex);

        candleMarkers.forEach(marker => {
          if (settings.enableMtfEngine && !marker.isApproved) {
            return; // Don't draw suppressed signals if MTF engine is on
          }

          ctx.fillStyle = marker.type.includes('BUY') || marker.type.includes('SSL') || marker.type.includes('Bullish') ? themeColors.ssl : themeColors.bsl;
          ctx.strokeStyle = ctx.fillStyle;
          
          if (marker.type.includes('candidate') || marker.type.includes('Manipulation')) {
             if (settings.showSweepWick) {
                const y = marker.type.includes('BSL') || marker.type.includes('Bearish') ? yHigh : yLow;
                ctx.beginPath();
                ctx.arc(x + candleWidth / 2, y, 4, 0, 2 * Math.PI);
                ctx.fill();
             }
          } else if (marker.type.includes('QUALIFIED')) {
             if (settings.showSweepWick) {
                const y = marker.type.includes('BSL') || marker.type.includes('BUY') ? yHigh : yLow;
                ctx.fillStyle = themeColors.qualifiedSweep;
                // Draw a star for qualified sweeps
                ctx.font = 'bold 16px Inter';
                ctx.textAlign = 'center';
                ctx.fillText('⭐', x + candleWidth / 2, y + (marker.type.includes('BUY') ? 15 : -5));
             }
          } else if (marker.type.includes('confirmed')) {
            const isBuy = marker.type.includes('BUY');
            const isSell = marker.type.includes('SELL');
            const y = priceToY(marker.price);
            
            // Draw SL and TP lines if they exist
            if(settings.showSLTP && marker.sl && marker.tp) {
              const ySL = priceToY(marker.sl);
              const yTP = priceToY(marker.tp);

              // SL Line
              ctx.save()
              ctx.beginPath();
              ctx.strokeStyle = themeColors.slColor;
              ctx.lineWidth = 2;
              ctx.moveTo(x + candleWidth / 2 + 10, ySL);
              ctx.lineTo(x + candleWidth / 2 + 30, ySL);
              ctx.stroke();
              ctx.fillStyle = themeColors.slColor;
              ctx.font = 'bold 10px Inter';
              ctx.fillText('SL', x + candleWidth / 2 + 35, ySL + 3);

              // TP Line
              ctx.beginPath();
              ctx.strokeStyle = themeColors.tpColor;
              ctx.lineWidth = 2;
              ctx.moveTo(x + candleWidth / 2 + 10, yTP);
              ctx.lineTo(x + candleWidth / 2 + 30, yTP);
              ctx.stroke();
              ctx.fillStyle = themeColors.tpColor;
              ctx.font = 'bold 10px Inter';
              ctx.fillText('TP', x + candleWidth / 2 + 35, yTP + 3);

              ctx.restore();
            }
            
            ctx.font = 'bold 12px Inter';
            if (isBuy) {
              ctx.beginPath();
              ctx.moveTo(x + candleWidth / 2, y + 15);
              ctx.lineTo(x + candleWidth / 2 - 5, y + 5);
              ctx.lineTo(x + candleWidth / 2 + 5, y + 5);
              ctx.closePath();
              ctx.fill();
              ctx.fillText('BUY', x + candleWidth / 2 - 12, y + 30);
            } else if (isSell) {
              ctx.beginPath();
              ctx.moveTo(x + candleWidth / 2, y - 15);
              ctx.lineTo(x + candleWidth / 2 - 5, y - 5);
              ctx.lineTo(x + candleWidth / 2 + 5, y - 5);
              ctx.closePath();
              ctx.fill();
              ctx.fillText('SELL', x + candleWidth / 2 - 13, y - 20);
            }

            if (settings.showMss && marker.mssIndex !== undefined) {
                 const mssX = (marker.mssIndex - viewState.candleOffset) * candleWidth + candleWidth/2;
                 const mssCandle = candles[marker.mssIndex];
                 const mssY = isBuy ? priceToY(mssCandle.low) : priceToY(mssCandle.high);
                 ctx.fillStyle = themeColors.mssArrow;
                 ctx.font = 'bold 16px Inter';
                 ctx.textAlign = 'center';
                 ctx.fillText('➤', mssX, mssY + (isBuy ? 12 : -4));
            }
            else if (settings.showMss && marker.notes && (marker.notes.includes('MSS') || marker.notes.includes('OB+MSS'))) {
                const yMss = isBuy ? yLow + 15 : yHigh - 15;
                ctx.beginPath();
                ctx.moveTo(x + candleWidth / 2 - 4, yMss);
                ctx.lineTo(x + candleWidth / 2 + 4, yMss);
                ctx.lineTo(x + candleWidth / 2, yMss + (isBuy ? -7 : 7));
                ctx.closePath();
                ctx.fill();
            }

            // Show confluence score
            if (settings.enableMtfEngine && marker.score) {
              ctx.font = '10px Inter';
              ctx.fillStyle = themeColors.text;
              const scoreText = `Score: ${marker.score.toFixed(1)}`;
              const textY = isBuy ? y + 45 : y - 35;
              ctx.fillText(scoreText, x + candleWidth / 2 - 15, textY);
            }
          }
        });
    });

    
    // Draw Playback line
    if (playbackIndex >= startIndex && playbackIndex <= endIndex) {
        const playbackX = (playbackIndex - viewState.candleOffset) * candleWidth + candleWidth;
        if (playbackX > 0 && playbackX < width - rightPadding) {
            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = themeColors.primary;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(playbackX, 0);
            ctx.lineTo(playbackX, height - bottomPadding);
            ctx.stroke();
            ctx.restore();
        }
    }
    
    // Draw HTF Trend Label
    if (settings.enableMtfEngine && settings.showHtfTrends && htfTrend) {
      ctx.save();
      ctx.font = 'bold 14px Inter';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const trendColor = htfTrend.direction === 'BULLISH' ? themeColors.bull : (htfTrend.direction === 'BEARISH' ? themeColors.bear : themeColors.text);
      ctx.fillStyle = trendColor;
      ctx.fillText(`${settings.htfTimeframe.toUpperCase()} Trend: ${htfTrend.direction}`, 10, 10);
      ctx.restore();
    }


    // Draw Crosshair and Tooltip
    if (crosshairRef.current) {
        const { x, y } = crosshairRef.current;
        ctx.save();
        ctx.strokeStyle = themeColors.crosshair;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);

        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        
        ctx.restore();

        const candleIndexOnScreen = Math.floor(x / candleWidth);
        const candleGlobalIndex = Math.floor(viewState.candleOffset + candleIndexOnScreen);
        
        if(candleGlobalIndex >= 0 && candleGlobalIndex < candles.length) {
            const candle = candles[candleGlobalIndex];
            const price = yToPrice(y);

            // Price label on Y-axis
            ctx.fillStyle = themeColors.crosshair;
            ctx.fillRect(width - rightPadding, y - 10, rightPadding, 20);
            ctx.fillStyle = themeColors.bg;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(price.toFixed(2), width - rightPadding / 2, y);

            // Time label on X-axis
            ctx.fillStyle = themeColors.crosshair;
            ctx.fillRect(x - 35, height - bottomPadding, 70, 20);
            ctx.fillStyle = themeColors.bg;
            ctx.fillText(format(new Date(candle.time), 'HH:mm'), x, height - bottomPadding + 10);
            
            // Tooltip
            const lines = [
                `Time: ${format(new Date(candle.time), 'yyyy-MM-dd HH:mm')}`,
                `Open: ${candle.open.toFixed(2)}`,
                `High: ${candle.high.toFixed(2)}`,
                `Low: ${candle.low.toFixed(2)}`,
                `Close: ${candle.close.toFixed(2)}`,
                `Volume: ${candle.volume}`,
            ];
            const tooltipWidth = 160;
            const tooltipHeight = lines.length * 15 + 15;
            const padding = 10;
            const spacing = 15;
            
            let tooltipX = x + 15;
            if (tooltipX + tooltipWidth > width) tooltipX = x - 15 - tooltipWidth;
            
            let tooltipY = y - tooltipHeight / 2;
            if (tooltipY < topPadding) tooltipY = topPadding;
            if (tooltipY + tooltipHeight > height - bottomPadding) tooltipY = height - bottomPadding - tooltipHeight;


            // Draw tooltip box
            ctx.fillStyle = themeColors.bg;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            ctx.beginPath();
            ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 8);
            ctx.fill();
            ctx.shadowColor = 'transparent';
            
            ctx.strokeStyle = themeColors.grid;
            ctx.lineWidth = 0.5;
            ctx.stroke();


            ctx.fillStyle = themeColors.text;
            ctx.font = '12px Inter';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';

            lines.forEach((line, i) => {
                ctx.fillText(line, tooltipX + padding, tooltipY + padding + i * spacing);
            });
        }
    }


  }, [candles, markers, playbackIndex, viewState, themeColors, liquidityData, breakerBlocks, mitigationBlocks, orderBlocks, continuationOrderBlocks, fvgs, imbalanceZones, dealingRange, asianRanges, powerOfThreeZones, htfKeyLevels, htfTrend, sessionSettings, settings, setViewState, isPlaying, classicBreakoutZones]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        drawChart();
      }
    });
    resizeObserver.observe(container);
    
    const render = () => {
        if (!isDraggingRef.current) {
            drawChart();
        }
        animationFrameId.current = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      resizeObserver.disconnect();
      if(animationFrameId.current) {
        window.cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [drawChart]);
  
  // Separate effect for drag-related drawing to avoid flicker
  useEffect(() => {
    if(isDraggingRef.current) {
      drawChart();
    }
  }, [viewState.candleOffset, drawChart])

  const handleMouseDown = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    setDragStart({ x: e.clientX, candleOffset: viewState.candleOffset });
    if(containerRef.current) containerRef.current.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (x > 0 && y > 0 && x < rect.width && y < rect.height) {
        crosshairRef.current = { x, y };
    } else {
        crosshairRef.current = null;
    }

    if (isDraggingRef.current) {
      const dx = e.clientX - dragStart.x;
      const dCandles = dx / viewState.zoom;
      const newOffset = dragStart.candleOffset - dCandles;
      
      const candleWidth = viewState.zoom;
      const rightPadding = 80;
      const candlesOnScreen = Math.floor((rect.width - rightPadding) / candleWidth);
      const maxOffset = candles.length > candlesOnScreen ? candles.length - candlesOnScreen : 0;
      
      setViewState(prev => ({ ...prev, candleOffset: Math.max(0, Math.min(newOffset, maxOffset)) }));
    }
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
        if(containerRef.current) containerRef.current.style.cursor = 'crosshair';
        drawChart(); // Final draw after drag ends
    }
  };

  const handleMouseLeave = () => {
    crosshairRef.current = null;
    if(isDraggingRef.current) {
        handleMouseUp();
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(2, Math.min(100, viewState.zoom * zoomFactor));

    if (crosshairRef.current) {
        const mouseX = crosshairRef.current.x;
        const oldCandleIdxAtMouse = viewState.candleOffset + mouseX / viewState.zoom;
        const newCandleOffset = oldCandleIdxAtMouse - mouseX / newZoom;
        setViewState({ zoom: newZoom, candleOffset: Math.max(0, newCandleOffset) });
    } else {
        setViewState(prev => ({ ...prev, zoom: newZoom }));
    }
  }

  // --- Touch Event Handlers ---
  const handleTouchStart = (e) => {
    e.preventDefault();
    if (e.touches.length === 1) { // Pan
      isDraggingRef.current = true;
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX, candleOffset: viewState.candleOffset });
    } else if (e.touches.length === 2) { // Zoom
      isDraggingRef.current = false; // Disable panning when zooming
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setPinchState({ initialDistance: dist, initialZoom: viewState.zoom });
    }
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (e.touches.length === 1 && isDraggingRef.current) { // Pan
      const dx = e.touches[0].clientX - dragStart.x;
      const dCandles = dx / viewState.zoom;
      const newOffset = dragStart.candleOffset - dCandles;
      
      const candleWidth = viewState.zoom;
      const rightPadding = 80;
      const candlesOnScreen = Math.floor((rect.width - rightPadding) / candleWidth);
      const maxOffset = candles.length > candlesOnScreen ? candles.length - candlesOnScreen : 0;
      
      setViewState(prev => ({ ...prev, candleOffset: Math.max(0, Math.min(newOffset, maxOffset)) }));
    } else if (e.touches.length === 2) { // Zoom
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const zoomFactor = currentDist / pinchState.initialDistance;
      const newZoom = Math.max(2, Math.min(100, pinchState.initialZoom * zoomFactor));

      const touchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const oldCandleIdxAtMouse = viewState.candleOffset + touchCenterX / viewState.zoom;
      const newCandleOffset = oldCandleIdxAtMouse - touchCenterX / newZoom;
      
      setViewState({ zoom: newZoom, candleOffset: Math.max(0, newCandleOffset) });
    }
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    isDraggingRef.current = false;
    setIsDragging(false);
    // You might want to clear crosshair on touch end if it was a tap
    // crosshairRef.current = null;
    drawChart();
  };

  return (
    <div 
        ref={containerRef} 
        className="h-full w-full relative" 
        style={{ cursor: 'crosshair' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
