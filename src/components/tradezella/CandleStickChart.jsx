'use client';

import { useRef, useEffect, useState, useCallback, useMemo, memo } from 'react';
import { useTheme } from 'next-themes';
import { format } from 'date-fns';
import {
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronsLeft,
  ChevronsRight,
  Sun,
  Moon,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

function getSignalColor(signal, fallbackColor) {
  if (!signal.score) return fallbackColor;
  if (signal.score >= 5) return '#22c55e';
  if (signal.score >= 4) return '#4ade80';
  if (signal.score >= 3) return '#facc15';
  return '#9ca3af';
}

function getSignalSize(signal) {
  if (!signal.score) return 6;
  if (signal.score >= 5) return 12;
  if (signal.score >= 4) return 10;
  if (signal.score >= 3) return 8;
  return 6;
}

function getCanvasDisplaySize(canvas, container) {
  const canvasRect = canvas.getBoundingClientRect();
  if (canvasRect.width > 0 && canvasRect.height > 0) {
    return { width: canvasRect.width, height: canvasRect.height };
  }
  const containerRect = container?.getBoundingClientRect();
  return {
    width: containerRect?.width || 0,
    height: containerRect?.height || 0,
  };
}

export const CandleStickChart = memo(function CandleStickChart({
  candles = [],
  markers = [],
  config = {},
  viewState,
  setViewState,
  setIsDragging,
  liquidityData,
  breakerBlocks,
  mitigationBlocks,
  orderBlocks,
  continuationOrderBlocks,
  fvgs,
  imbalanceZones,
  dealingRange,
  asianRanges,
  powerOfThreeZones,
  classicBreakoutZones,
  htfKeyLevels,
  htfTrend,
  waterfallMarkers = [],
  sessionSettings,
  settings,
  tradeLevelVisibility,
  setTradeLevelVisibility,
  selectedTrade,
  onSelectTrade,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const { resolvedTheme } = useTheme();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [forceTheme, setForceTheme] = useState('dark'); // Default to dark for pro trading terminal
  const [hoveredCandle, setHoveredCandle] = useState(null);
  const [hoveredMarker, setHoveredMarker] = useState(null);
  const [selectedMarkerState, setSelectedMarkerState] = useState(null);
  const [themeColors, setThemeColors] = useState({});

  const [internalTradeLevelVisibility, setInternalTradeLevelVisibility] = useState({
    showTradeLevels: false,
    showEntry: false,
    showStopLoss: false,
    showTakeProfit: false,
    showLabels: false,
    showSelectedTradeLevels: true,
  });

  const activeTradeLevels = tradeLevelVisibility || internalTradeLevelVisibility;
  const updateTradeLevels = setTradeLevelVisibility || setInternalTradeLevelVisibility;

  const handleToggleLevel = useCallback((key, value) => {
    updateTradeLevels(prev => {
      const next = typeof value === 'boolean' ? value : !prev[key];
      return { ...prev, [key]: next };
    });
  }, [updateTradeLevels]);

  useEffect(() => {
    if (selectedTrade !== undefined) {
      setSelectedMarkerState(selectedTrade);
    }
  }, [selectedTrade]);

  const isDraggingRef = useRef(false);
  const clickStartRef = useRef({ x: 0, y: 0, time: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, candleOffset: 0 });
  const crosshairRef = useRef(null);
  const drawFrameId = useRef(null);
  const [pinchState, setPinchState] = useState({ initialDistance: 0, initialZoom: 1 });

  // Fast marker index mapping
  const markersByIndex = useMemo(() => {
    const buckets = new Map();
    (markers || []).forEach(marker => {
      const bucket = buckets.get(marker.index);
      if (bucket) {
        bucket.push(marker);
      } else {
        buckets.set(marker.index, [marker]);
      }
    });
    return buckets;
  }, [markers]);

  // Ensure default offset
  useEffect(() => {
    if (viewState.candleOffset === undefined) {
      setViewState(prev => ({ ...prev, candleOffset: 0 }));
    }
  }, [viewState.candleOffset, setViewState]);

  // Theme Sync: Default to Dark unless user toggles explicitly to Light
  useEffect(() => {
    const isDark = forceTheme === 'dark';
    setThemeColors({
      bg: isDark ? '#0c1017' : '#ffffff',
      surface: isDark ? '#111827' : '#f8fafc',
      cardBorder: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      text: isDark ? '#f1f5f9' : '#0f172a',
      textMuted: isDark ? '#94a3b8' : '#64748b',
      bull: '#26a69a', // TradingView Pro Emerald
      bullBorder: '#1f8a80',
      bear: '#ef5350', // TradingView Pro Coral
      bearBorder: '#c62828',
      grid: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
      gridSubtle: isDark ? 'rgba(255, 255, 255, 0.025)' : 'rgba(0, 0, 0, 0.025)',
      primary: '#3b82f6',
      accent: '#8b5cf6',
      bsl: '#f97316',
      ssl: '#3b82f6',
      crosshair: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
      bullishBreaker: 'rgba(38, 166, 154, 0.12)',
      bearishBreaker: 'rgba(239, 83, 80, 0.12)',
      bullishBreakerBorder: 'rgba(38, 166, 154, 0.6)',
      bearishBreakerBorder: 'rgba(239, 83, 80, 0.6)',
      bullishMitigation: 'rgba(38, 166, 154, 0.15)',
      bearishMitigation: 'rgba(239, 83, 80, 0.15)',
      bullishMitigationBorder: 'rgba(38, 166, 154, 0.6)',
      bearishMitigationBorder: 'rgba(239, 83, 80, 0.6)',
      bullishOb: 'rgba(38, 166, 154, 0.16)',
      bearishOb: 'rgba(239, 83, 80, 0.16)',
      bullishObBorder: 'rgba(38, 166, 154, 0.65)',
      bearishObBorder: 'rgba(239, 83, 80, 0.65)',
      bullishCob: 'rgba(16, 185, 129, 0.16)',
      bearishCob: 'rgba(239, 83, 80, 0.16)',
      bullishCobBorder: 'rgba(16, 185, 129, 0.65)',
      bearishCobBorder: 'rgba(239, 83, 80, 0.65)',
      mssArrow: '#facc15',
      bullishFvg: 'rgba(38, 166, 154, 0.12)',
      bearishFvg: 'rgba(239, 83, 80, 0.12)',
      bullishFvgBorder: 'rgba(38, 166, 154, 0.4)',
      bearishFvgBorder: 'rgba(239, 83, 80, 0.4)',
      imbalanceZone: 'rgba(168, 85, 247, 0.12)',
      imbalanceZoneBorder: 'rgba(168, 85, 247, 0.5)',
      dealingRangePremium: 'rgba(239, 83, 80, 0.06)',
      dealingRangeDiscount: 'rgba(38, 166, 154, 0.06)',
      dealingRangeEq: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)',
      asianRange: 'rgba(148, 163, 184, 0.12)',
      asianRangeBorder: 'rgba(148, 163, 184, 0.4)',
      classicBreakoutZone: 'rgba(59, 130, 246, 0.12)',
      classicBreakoutZoneBorder: 'rgba(59, 130, 246, 0.45)',
      powerOfThreeAccumulation: 'rgba(250, 204, 21, 0.12)',
      powerOfThreeAccumulationBorder: 'rgba(250, 204, 21, 0.5)',
      htfSupport: 'rgba(59, 130, 246, 0.5)',
      htfResistance: 'rgba(239, 83, 80, 0.5)',
      slColor: '#f97316',
      tpColor: '#10b981',
      sessionAsia: isDark ? 'rgba(0, 128, 255, 0.08)' : 'rgba(0, 128, 255, 0.05)',
      sessionLondon: isDark ? 'rgba(8, 145, 178, 0.15)' : 'rgba(8, 145, 178, 0.1)',
      sessionNY: isDark ? 'rgba(255, 165, 0, 0.12)' : 'rgba(255, 165, 0, 0.08)',
      sessionOverlap: isDark ? 'rgba(168, 85, 247, 0.14)' : 'rgba(168, 85, 247, 0.1)',
      volBull: isDark ? 'rgba(38, 166, 154, 0.35)' : 'rgba(38, 166, 154, 0.25)',
      volBear: isDark ? 'rgba(239, 83, 80, 0.35)' : 'rgba(239, 83, 80, 0.25)',
    });
  }, [forceTheme]);

  // Toggle Theme
  const toggleTheme = useCallback(() => {
    setForceTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Fullscreen toggle handler
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => {
      const next = !prev;
      if (next) {
        if (containerRef.current?.requestFullscreen && !document.fullscreenElement) {
          containerRef.current.requestFullscreen().catch(() => {});
        }
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return next;
    });
  }, []);

  // Listen for native fullscreen changes & ESC key
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      } else if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && e.target.tagName !== 'INPUT') {
        toggleFullscreen();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, toggleFullscreen]);

  // Zoom handlers
  const handleZoom = useCallback((factor) => {
    setViewState(prev => ({
      ...prev,
      zoom: Math.max(2, Math.min(100, prev.zoom * factor)),
    }));
  }, [setViewState]);

  // Auto-fit / Reset view
  const handleResetView = useCallback(() => {
    if (!containerRef.current || candles.length === 0) return;
    const canvasWidth = containerRef.current.getBoundingClientRect().width;
    const rightPadding = 85;
    const targetZoom = 12;
    const candlesOnScreen = Math.floor((canvasWidth - rightPadding) / targetZoom);
    const newOffset = Math.max(0, candles.length - candlesOnScreen);
    setViewState({
      zoom: targetZoom,
      candleOffset: newOffset,
    });
  }, [candles.length, setViewState]);

  const handleJumpTo = useCallback((position) => {
    if (!containerRef.current || candles.length === 0) return;
    if (position === 'start') {
      setViewState(prev => ({ ...prev, candleOffset: 0 }));
    } else if (position === 'end') {
      const canvasWidth = containerRef.current.getBoundingClientRect().width;
      const rightPadding = 85;
      const candlesOnScreen = Math.floor((canvasWidth - rightPadding) / viewState.zoom);
      const newOffset = Math.max(0, candles.length - candlesOnScreen);
      setViewState(prev => ({ ...prev, candleOffset: newOffset }));
    }
  }, [candles.length, viewState.zoom, setViewState]);

  // =========================================================================
  // Core Optimized Canvas Draw Routine
  // =========================================================================
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !candles.length || Object.keys(themeColors).length === 0 || viewState.candleOffset === undefined) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = getCanvasDisplaySize(canvas, container);
    if (width <= 0 || height <= 0) return;

    // Clear background
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = themeColors.bg;
    ctx.fillRect(0, 0, width, height);

    const candleWidth = viewState.zoom;
    const rightPadding = 85;
    const topPadding = 48; // room for top HUD
    const bottomPadding = 32; // room for X-axis time scale
    const drawableWidth = Math.max(1, width - rightPadding);
    const chartHeight = Math.max(1, height - topPadding - bottomPadding);

    const candlesOnScreen = Math.max(1, Math.floor(drawableWidth / candleWidth));
    const startIndex = Math.max(0, Math.floor(viewState.candleOffset));
    const endIndex = Math.min(candles.length, startIndex + candlesOnScreen + 2);

    if (startIndex >= candles.length) return;

    // 1. Min/Max Price Scanning STRICTLY over visible slice
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVolume = 1;

    for (let i = startIndex; i < endIndex; i++) {
      const c = candles[i];
      if (!c) continue;
      if (Number.isFinite(c.low) && c.low < minPrice) minPrice = c.low;
      if (Number.isFinite(c.high) && c.high > maxPrice) maxPrice = c.high;
      if (Number.isFinite(c.volume) && c.volume > maxVolume) maxVolume = c.volume;
    }

    if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice) || minPrice >= maxPrice) {
      minPrice = 100;
      maxPrice = 110;
    }

    // Add 8% top/bottom price margin so candles fill ~84% of vertical height
    const priceSpan = maxPrice - minPrice;
    const margin = priceSpan > 0 ? priceSpan * 0.08 : Math.max(1, Math.abs(maxPrice) * 0.01);
    const paddedMin = minPrice - margin;
    const paddedMax = maxPrice + margin;
    const priceRange = Math.max(0.0001, paddedMax - paddedMin);

    const priceToY = price => topPadding + chartHeight - ((price - paddedMin) / priceRange * chartHeight);
    const yToPrice = y => paddedMax - ((y - topPadding) / chartHeight) * priceRange;

    // 2. Horizontal Gridlines & Price Ticks
    const numPriceLines = Math.max(4, Math.min(10, Math.floor(chartHeight / 55)));
    ctx.strokeStyle = themeColors.grid;
    ctx.lineWidth = 1;
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillStyle = themeColors.textMuted;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= numPriceLines; i++) {
      const y = topPadding + (chartHeight * i) / numPriceLines;
      const price = yToPrice(y);

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(drawableWidth, y);
      ctx.stroke();

      // Right axis price tick
      const decimals = price > 100 ? 2 : 5;
      ctx.fillText(price.toFixed(decimals), drawableWidth + 8, y);
    }

    // Right axis dividing line
    ctx.beginPath();
    ctx.moveTo(drawableWidth, 0);
    ctx.lineTo(drawableWidth, height - bottomPadding);
    ctx.stroke();

    // 3. Vertical Gridlines & Date/Time Ticks
    const tickIntervalCandles = Math.max(5, Math.floor(90 / candleWidth));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = startIndex; i < endIndex; i++) {
      if (i % tickIntervalCandles === 0) {
        const x = (i - viewState.candleOffset) * candleWidth + candleWidth / 2;
        if (x >= 0 && x <= drawableWidth) {
          ctx.beginPath();
          ctx.moveTo(x, topPadding);
          ctx.lineTo(x, height - bottomPadding);
          ctx.strokeStyle = themeColors.gridSubtle;
          ctx.stroke();

          // Time tick label
          const tickDate = new Date(candles[i].time);
          const timeStr = format(tickDate, 'HH:mm');
          const dateStr = format(tickDate, 'MMM d');
          ctx.fillStyle = themeColors.textMuted;
          ctx.fillText(timeStr, x, height - bottomPadding + 4);
          ctx.fillText(dateStr, x, height - bottomPadding + 16);
        }
      }
    }

    // 4. Session Highlights & Killzones
    if (sessionSettings?.enabled) {
      for (let i = startIndex; i < endIndex; i++) {
        const c = candles[i];
        const hour = new Date(c.time).getUTCHours();
        const x = (i - viewState.candleOffset) * candleWidth;

        const inAsia = hour >= 0 && hour < 9;
        const inLondon = hour >= 7 && hour < 16;
        const inNY = hour >= 12 && hour < 21;

        if (settings?.strategy?.londonKillzone && hour >= (settings.londonKzStartTime || 8) && hour < (settings.londonKzEndTime || 12)) {
          ctx.fillStyle = themeColors.sessionLondon;
          ctx.fillRect(x, topPadding, candleWidth, chartHeight);
        } else if (settings?.strategy?.newYorkKillzone && hour >= (settings.newYorkKzStartTime || 13) && hour < (settings.newYorkKzEndTime || 17)) {
          ctx.fillStyle = themeColors.sessionNY;
          ctx.fillRect(x, topPadding, candleWidth, chartHeight);
        } else if (sessionSettings.overlaps && ((inAsia && inLondon) || (inLondon && inNY))) {
          ctx.fillStyle = themeColors.sessionOverlap;
          ctx.fillRect(x, topPadding, candleWidth, chartHeight);
        } else if (sessionSettings.asia && inAsia) {
          ctx.fillStyle = themeColors.sessionAsia;
          ctx.fillRect(x, topPadding, candleWidth, chartHeight);
        } else if (sessionSettings.london && inLondon) {
          ctx.fillStyle = themeColors.sessionLondon;
          ctx.fillRect(x, topPadding, candleWidth, chartHeight);
        } else if (sessionSettings.newYork && inNY) {
          ctx.fillStyle = themeColors.sessionNY;
          ctx.fillRect(x, topPadding, candleWidth, chartHeight);
        }
      }
    }

    // 5. Institutional Structure Overlays (OB, FVG, Liquidity Pools)
    // Order Blocks
    if (settings?.showOrderBlocks && orderBlocks) {
      orderBlocks.forEach(ob => {
        if (ob.index > endIndex || ob.index < startIndex - 100) return;
        const obStartX = (ob.index - viewState.candleOffset) * candleWidth;
        const obEndX = drawableWidth;
        if (obStartX > drawableWidth) return;

        const yHigh = priceToY(ob.high);
        const yLow = priceToY(ob.low);
        const isBull = ob.type === 'bullish';

        ctx.fillStyle = isBull ? themeColors.bullishOb : themeColors.bearishOb;
        ctx.strokeStyle = isBull ? themeColors.bullishObBorder : themeColors.bearishObBorder;
        ctx.lineWidth = 1;

        ctx.fillRect(Math.max(0, obStartX), yHigh, obEndX - Math.max(0, obStartX), yLow - yHigh);
        ctx.strokeRect(Math.max(0, obStartX), yHigh, obEndX - Math.max(0, obStartX), yLow - yHigh);
      });
    }

    // Fair Value Gaps
    if (settings?.showFvgs && fvgs) {
      fvgs.forEach(fvg => {
        if (fvg.index > endIndex || fvg.index < startIndex - 80) return;
        const fvgStartX = (fvg.index - viewState.candleOffset) * candleWidth;
        const fvgEndX = drawableWidth;
        if (fvgStartX > drawableWidth) return;

        const yTop = priceToY(Math.max(fvg.start, fvg.end));
        const yBottom = priceToY(Math.min(fvg.start, fvg.end));
        const isBull = fvg.type === 'bullish';

        ctx.fillStyle = isBull ? themeColors.bullishFvg : themeColors.bearishFvg;
        ctx.strokeStyle = isBull ? themeColors.bullishFvgBorder : themeColors.bearishFvgBorder;
        ctx.lineWidth = 0.8;

        ctx.fillRect(Math.max(0, fvgStartX), yTop, fvgEndX - Math.max(0, fvgStartX), yBottom - yTop);
        ctx.strokeRect(Math.max(0, fvgStartX), yTop, fvgEndX - Math.max(0, fvgStartX), yBottom - yTop);
      });
    }

    // Liquidity Pools
    if (settings?.showLiquidityPools && liquidityData) {
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.2;

      (liquidityData.equalHighs || []).forEach(pool => {
        const y = priceToY(pool.price);
        if (y < topPadding || y > height - bottomPadding) return;
        ctx.strokeStyle = themeColors.bsl;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(drawableWidth, y);
        ctx.stroke();

        ctx.fillStyle = themeColors.bsl;
        ctx.font = '10px Inter';
        ctx.fillText('BSL Pool', drawableWidth - 55, y - 4);
      });

      (liquidityData.equalLows || []).forEach(pool => {
        const y = priceToY(pool.price);
        if (y < topPadding || y > height - bottomPadding) return;
        ctx.strokeStyle = themeColors.ssl;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(drawableWidth, y);
        ctx.stroke();

        ctx.fillStyle = themeColors.ssl;
        ctx.font = '10px Inter';
        ctx.fillText('SSL Pool', drawableWidth - 55, y + 12);
      });
      ctx.setLineDash([]);
    }

    // 6. Volume Histogram (bottom 18% of chart)
    const volumeHeight = chartHeight * 0.18;
    const volumeBaseY = topPadding + chartHeight;

    for (let i = startIndex; i < endIndex; i++) {
      const c = candles[i];
      const isUp = c.close >= c.open;
      const x = (i - viewState.candleOffset) * candleWidth;
      const barHeight = (c.volume / maxVolume) * volumeHeight;

      ctx.fillStyle = isUp ? themeColors.volBull : themeColors.volBear;
      ctx.fillRect(x + 1, volumeBaseY - barHeight, Math.max(1, candleWidth - 2), barHeight);
    }

    // 7. Candlesticks (High-Contrast Professional TradingView Style)
    for (let i = startIndex; i < endIndex; i++) {
      const c = candles[i];
      const x = (i - viewState.candleOffset) * candleWidth;
      const xCenter = Math.floor(x + candleWidth / 2) + 0.5; // Half-pixel offset for 1px line crispness

      const yOpen = priceToY(c.open);
      const yClose = priceToY(c.close);
      const yHigh = priceToY(c.high);
      const yLow = priceToY(c.low);

      const isUp = c.close >= c.open;
      const bodyTop = Math.floor(Math.min(yOpen, yClose));
      const rawBodyHeight = Math.abs(yClose - yOpen);
      const bodyHeight = Math.max(2.5, Math.floor(rawBodyHeight));

      const bWidth = Math.max(1, candleWidth <= 4 ? candleWidth - 0.5 : Math.floor(candleWidth - Math.max(1, candleWidth * 0.22)));
      const bodyX = Math.floor(xCenter - bWidth / 2);

      const color = isUp ? themeColors.bull : themeColors.bear;
      const borderColor = isUp ? themeColors.bullBorder : themeColors.bearBorder;

      // Draw Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = candleWidth > 14 ? 1.5 : 1.0;
      ctx.beginPath();
      ctx.moveTo(xCenter, Math.floor(yHigh));
      ctx.lineTo(xCenter, Math.floor(yLow));
      ctx.stroke();

      // Draw Body Rectangle
      ctx.fillStyle = color;
      ctx.fillRect(bodyX, bodyTop, bWidth, bodyHeight);

      if (candleWidth >= 6) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(bodyX, bodyTop, bWidth, bodyHeight);
      }
    }

    // 8. Latest Price Horizontal Line & Tag
    if (candles.length > 0) {
      const latest = candles[candles.length - 1];
      const latestY = priceToY(latest.close);
      const isUp = latest.close >= latest.open;
      const priceColor = isUp ? themeColors.bull : themeColors.bear;

      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = priceColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, latestY);
      ctx.lineTo(drawableWidth, latestY);
      ctx.stroke();

      // Right axis pill
      ctx.setLineDash([]);
      ctx.fillStyle = priceColor;
      ctx.fillRect(drawableWidth, latestY - 10, rightPadding - 2, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const decimals = latest.close > 100 ? 2 : 5;
      ctx.fillText(latest.close.toFixed(decimals), drawableWidth + (rightPadding - 2) / 2, latestY);
      ctx.restore();
    }

    // 9. Signal Markers (BUY / SELL)
    for (let i = startIndex; i < endIndex; i++) {
      const candleMarkers = markersByIndex.get(i);
      if (!candleMarkers || candleMarkers.length === 0) continue;

      const c = candles[i];
      const x = (i - viewState.candleOffset) * candleWidth + candleWidth / 2;
      const yHigh = priceToY(c.high);
      const yLow = priceToY(c.low);

      candleMarkers.forEach(m => {
        const isBuy = m.type?.includes('BUY') || m.type?.includes('SSL');
        const isSell = m.type?.includes('SELL') || m.type?.includes('BSL');
        const size = getSignalSize(m);
        const col = getSignalColor(m, isBuy ? themeColors.bull : themeColors.bear);

        ctx.fillStyle = col;
        ctx.strokeStyle = col;

        if (isBuy) {
          const arrowY = yLow + 8;
          ctx.beginPath();
          ctx.moveTo(x, arrowY);
          ctx.lineTo(x - size, arrowY + size + 6);
          ctx.lineTo(x + size, arrowY + size + 6);
          ctx.closePath();
          ctx.fill();

          ctx.font = 'bold 10px Inter';
          ctx.textAlign = 'center';
          ctx.fillText('BUY', x, arrowY + size + 18);

          if (m.score) {
            ctx.font = '9px Inter';
            ctx.fillStyle = themeColors.textMuted;
            ctx.fillText(`${m.qualityTier || ''} ${m.score.toFixed(1)}`, x, arrowY + size + 28);
          }
        } else if (isSell) {
          const arrowY = yHigh - 8;
          ctx.beginPath();
          ctx.moveTo(x, arrowY);
          ctx.lineTo(x - size, arrowY - size - 6);
          ctx.lineTo(x + size, arrowY - size - 6);
          ctx.closePath();
          ctx.fill();

          ctx.font = 'bold 10px Inter';
          ctx.textAlign = 'center';
          ctx.fillText('SELL', x, arrowY - size - 12);

          if (m.score) {
            ctx.font = '9px Inter';
            ctx.fillStyle = themeColors.textMuted;
            ctx.fillText(`${m.qualityTier || ''} ${m.score.toFixed(1)}`, x, arrowY - size - 22);
          }
        }
      });
    }

    // 9.5 Waterfall & Candle Psychology Markers
    if (settings.showCandlePsychologyMarkers !== false && waterfallMarkers && waterfallMarkers.length > 0) {
      waterfallMarkers.forEach(wm => {
        if (wm.index >= startIndex && wm.index < endIndex) {
          const c = candles[wm.index];
          const x = (wm.index - viewState.candleOffset) * candleWidth + candleWidth / 2;
          const isSell = wm.type === 'SELL';
          const y = isSell ? priceToY(c.high) - 36 : priceToY(c.low) + 36;

          ctx.save();
          ctx.fillStyle = isSell ? 'rgba(239, 83, 80, 0.9)' : 'rgba(38, 166, 154, 0.9)';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;

          // Draw small rounded badge badge
          const label = wm.label || 'WATERFALL';
          ctx.font = 'bold 9px Inter';
          const textWidth = ctx.measureText(label).width;
          const px = x - textWidth / 2 - 4;
          const py = y - 7;
          const pw = textWidth + 8;
          const ph = 14;

          ctx.beginPath();
          ctx.roundRect(px, py, pw, ph, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, x, y);
          ctx.restore();
        }
      });
    }

    // 9.6 Phase 8 — Clean Trade Levels Overlay (Show/Hide Controls)
    const {
      showTradeLevels = false,
      showEntry = false,
      showStopLoss = false,
      showTakeProfit = false,
      showLabels = false,
      showSelectedTradeLevels = true,
    } = activeTradeLevels;

    const targetSelected = selectedTrade || selectedMarkerState;
    const hasSelected = Boolean(targetSelected);

    if ((showTradeLevels || (showSelectedTradeLevels && hasSelected)) && markers && markers.length > 0) {
      const tradesToRender = [];
      const seenIds = new Set();

      // 1. If a trade is selected and showSelectedTradeLevels is ON, it takes priority and is displayed cleanly
      if (showSelectedTradeLevels && targetSelected) {
        const matched = markers.find(m => (
          (targetSelected.id && m.id === targetSelected.id) ||
          (m.index === targetSelected.index && Math.abs(m.price - targetSelected.price) < 0.0001) ||
          (targetSelected.time && m.time === targetSelected.time)
        )) || targetSelected;

        if (matched && matched.sl && matched.tp) {
          tradesToRender.push({ ...matched, isSelected: true });
          seenIds.add(matched.id || `${matched.index}-${matched.price}`);
        }
      }

      // 2. If Master showTradeLevels is ON, include active/visible trades (capped to recent 3 to prevent clutter)
      if (showTradeLevels) {
        const visibleApproved = markers
          .filter(m => m.sl && m.tp && m.index >= startIndex - 5 && m.index <= endIndex + 5)
          .sort((a, b) => b.index - a.index);

        for (const m of visibleApproved) {
          const mId = m.id || `${m.index}-${m.price}`;
          if (!seenIds.has(mId) && tradesToRender.length < 3) {
            tradesToRender.push({ ...m, isSelected: false });
            seenIds.add(mId);
          }
        }
      }

      // Anti-overlap vertical placement tracker for text labels
      const renderedLabelYs = [];
      const getAdjustedY = (targetY) => {
        let y = targetY;
        for (const prevY of renderedLabelYs) {
          if (Math.abs(y - prevY) < 14) {
            y = prevY + (y >= prevY ? 14 : -14);
          }
        }
        y = Math.max(topPadding + 10, Math.min(height - bottomPadding - 10, y));
        renderedLabelYs.push(y);
        return y;
      };

      tradesToRender.forEach(m => {
        const isTradeSelected = m.isSelected;
        const canDrawEntry = isTradeSelected ? true : showEntry;
        const canDrawSl = isTradeSelected ? true : showStopLoss;
        const canDrawTp = isTradeSelected ? true : showTakeProfit;
        const canDrawLabels = isTradeSelected ? true : showLabels;

        const startX = Math.max(0, (m.index - viewState.candleOffset) * candleWidth + candleWidth / 2);
        const lineLen = drawableWidth - 2;

        ctx.save();

        // 1. ENTRY LEVEL
        if (canDrawEntry && m.price) {
          const entryY = priceToY(m.price);
          if (entryY >= topPadding && entryY <= height - bottomPadding) {
            ctx.beginPath();
            ctx.strokeStyle = isTradeSelected ? 'rgba(56, 189, 248, 0.85)' : 'rgba(56, 189, 248, 0.45)';
            ctx.lineWidth = isTradeSelected ? 1.5 : 1;
            ctx.setLineDash([4, 4]);
            ctx.moveTo(startX, entryY);
            ctx.lineTo(lineLen, entryY);
            ctx.stroke();

            if (canDrawLabels) {
              const labelY = getAdjustedY(entryY);
              const labelText = `ENTRY: ${m.price.toFixed(decimals)}${m.lots ? ` (${m.lots}L)` : ''}`;
              ctx.font = 'bold 9px Inter';
              const textWidth = ctx.measureText(labelText).width;

              ctx.fillStyle = 'rgba(12, 16, 23, 0.85)';
              ctx.fillRect(lineLen - textWidth - 8, labelY - 7, textWidth + 6, 14);

              ctx.fillStyle = '#38bdf8';
              ctx.textAlign = 'right';
              ctx.textBaseline = 'middle';
              ctx.fillText(labelText, lineLen - 5, labelY);
            }
          }
        }

        // 2. STOP LOSS LEVEL
        if (canDrawSl && m.sl) {
          const slY = priceToY(m.sl);
          if (slY >= topPadding && slY <= height - bottomPadding) {
            ctx.beginPath();
            ctx.strokeStyle = isTradeSelected ? 'rgba(239, 68, 68, 0.9)' : 'rgba(239, 68, 68, 0.5)';
            ctx.lineWidth = isTradeSelected ? 1.5 : 1;
            ctx.setLineDash([4, 4]);
            ctx.moveTo(startX, slY);
            ctx.lineTo(lineLen, slY);
            ctx.stroke();

            if (canDrawLabels) {
              const labelY = getAdjustedY(slY);
              const labelText = `SL: ${m.sl.toFixed(decimals)}`;
              ctx.font = 'bold 9px Inter';
              const textWidth = ctx.measureText(labelText).width;

              ctx.fillStyle = 'rgba(12, 16, 23, 0.85)';
              ctx.fillRect(lineLen - textWidth - 8, labelY - 7, textWidth + 6, 14);

              ctx.fillStyle = '#ef4444';
              ctx.textAlign = 'right';
              ctx.textBaseline = 'middle';
              ctx.fillText(labelText, lineLen - 5, labelY);
            }
          }
        }

        // 3. TAKE PROFIT LEVEL
        if (canDrawTp && m.tp) {
          const tpY = priceToY(m.tp);
          if (tpY >= topPadding && tpY <= height - bottomPadding) {
            ctx.beginPath();
            ctx.strokeStyle = isTradeSelected ? 'rgba(34, 197, 94, 0.9)' : 'rgba(34, 197, 94, 0.5)';
            ctx.lineWidth = isTradeSelected ? 1.5 : 1;
            ctx.setLineDash([2, 3]);
            ctx.moveTo(startX, tpY);
            ctx.lineTo(lineLen, tpY);
            ctx.stroke();

            if (canDrawLabels) {
              const labelY = getAdjustedY(tpY);
              const labelText = `TP: ${m.tp.toFixed(decimals)}${m.riskReward ? ` (${m.riskReward}R)` : ''}`;
              ctx.font = 'bold 9px Inter';
              const textWidth = ctx.measureText(labelText).width;

              ctx.fillStyle = 'rgba(12, 16, 23, 0.85)';
              ctx.fillRect(lineLen - textWidth - 8, labelY - 7, textWidth + 6, 14);

              ctx.fillStyle = '#22c55e';
              ctx.textAlign = 'right';
              ctx.textBaseline = 'middle';
              ctx.fillText(labelText, lineLen - 5, labelY);
            }
          }
        }

        ctx.restore();
      });
    }

    // 10. Crosshair & Active Hover Cursor
    if (crosshairRef.current) {
      const { x, y } = crosshairRef.current;
      if (x >= 0 && x <= drawableWidth && y >= topPadding && y <= height - bottomPadding) {
        ctx.save();
        ctx.strokeStyle = themeColors.crosshair;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(drawableWidth, y);
        ctx.stroke();

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(x, topPadding);
        ctx.lineTo(x, height - bottomPadding);
        ctx.stroke();
        ctx.restore();

        // Y-axis price badge
        const hoverPrice = yToPrice(y);
        const decimals = hoverPrice > 100 ? 2 : 5;
        ctx.fillStyle = themeColors.surface;
        ctx.strokeStyle = themeColors.grid;
        ctx.lineWidth = 1;
        ctx.fillRect(drawableWidth, y - 10, rightPadding - 2, 20);
        ctx.strokeRect(drawableWidth, y - 10, rightPadding - 2, 20);

        ctx.fillStyle = themeColors.text;
        ctx.font = '11px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hoverPrice.toFixed(decimals), drawableWidth + (rightPadding - 2) / 2, y);

        // X-axis time badge
        const candleIndexUnderMouse = Math.floor(viewState.candleOffset + x / candleWidth);
        if (candleIndexUnderMouse >= 0 && candleIndexUnderMouse < candles.length) {
          const hoveredC = candles[candleIndexUnderMouse];
          const timeLabel = format(new Date(hoveredC.time), 'MMM d HH:mm');
          const timeBadgeWidth = 100;
          const timeBadgeX = Math.max(10, Math.min(drawableWidth - timeBadgeWidth, x - timeBadgeWidth / 2));

          ctx.fillStyle = themeColors.surface;
          ctx.fillRect(timeBadgeX, height - bottomPadding, timeBadgeWidth, 22);
          ctx.strokeRect(timeBadgeX, height - bottomPadding, timeBadgeWidth, 22);

          ctx.fillStyle = themeColors.text;
          ctx.fillText(timeLabel, timeBadgeX + timeBadgeWidth / 2, height - bottomPadding + 11);
        }
      }
    }
  }, [
    candles,
    markersByIndex,
    viewState,
    themeColors,
    liquidityData,
    breakerBlocks,
    mitigationBlocks,
    orderBlocks,
    continuationOrderBlocks,
    fvgs,
    imbalanceZones,
    dealingRange,
    asianRanges,
    powerOfThreeZones,
    classicBreakoutZones,
    htfKeyLevels,
    sessionSettings,
    settings,
    activeTradeLevels,
    selectedTrade,
    selectedMarkerState,
  ]);

  // Request animation frame throttled draw
  const scheduleDraw = useCallback(() => {
    if (drawFrameId.current) return;
    drawFrameId.current = window.requestAnimationFrame(() => {
      drawFrameId.current = null;
      drawChart();
    });
  }, [drawChart]);

  // Canvas size and DPR observer
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (width <= 0 || height <= 0) continue;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        scheduleDraw();
      }
    });

    resizeObserver.observe(container);
    scheduleDraw();

    return () => {
      resizeObserver.disconnect();
      if (drawFrameId.current) {
        window.cancelAnimationFrame(drawFrameId.current);
        drawFrameId.current = null;
      }
    };
  }, [scheduleDraw]);

  useEffect(() => {
    scheduleDraw();
  }, [scheduleDraw]);

  // Drag pan & Marker click selection
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    clickStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    isDraggingRef.current = true;
    setIsDragging(true);
    setDragStart({ x: e.clientX, candleOffset: viewState.candleOffset });
    if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x > 0 && y > 0 && x < rect.width && y < rect.height) {
      crosshairRef.current = { x, y };

      // Update hovered candle for top HUD
      const candleIdx = Math.floor(viewState.candleOffset + x / viewState.zoom);
      if (candleIdx >= 0 && candleIdx < candles.length) {
        setHoveredCandle(candles[candleIdx]);
        const matchedMarkers = markersByIndex.get(candleIdx);
        setHoveredMarker(matchedMarkers && matchedMarkers.length > 0 ? matchedMarkers[0] : null);
      } else {
        setHoveredCandle(null);
        setHoveredMarker(null);
      }
    } else {
      crosshairRef.current = null;
      setHoveredCandle(null);
      setHoveredMarker(null);
    }
    scheduleDraw();

    if (isDraggingRef.current) {
      const dx = e.clientX - dragStart.x;
      const dCandles = dx / viewState.zoom;
      const newOffset = dragStart.candleOffset - dCandles;
      const candleWidth = viewState.zoom;
      const rightPadding = 85;
      const candlesOnScreen = Math.floor((rect.width - rightPadding) / candleWidth);
      const maxOffset = candles.length > candlesOnScreen ? candles.length - candlesOnScreen : 0;

      setViewState(prev => ({
        ...prev,
        candleOffset: Math.max(0, Math.min(newOffset, maxOffset)),
      }));
    }
  };

  const handleMouseUp = (e) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      if (containerRef.current) containerRef.current.style.cursor = 'crosshair';
      scheduleDraw();
    }

    // Detect click (not drag) to toggle trade selection
    if (e && clickStartRef.current) {
      const dist = Math.hypot(e.clientX - clickStartRef.current.x, e.clientY - clickStartRef.current.y);
      const elapsed = Date.now() - clickStartRef.current.time;
      if (dist < 6 && elapsed < 400) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const x = e.clientX - rect.left;
          const candleIdx = Math.floor(viewState.candleOffset + x / viewState.zoom);
          const matchedMarkers = markersByIndex.get(candleIdx);
          if (matchedMarkers && matchedMarkers.length > 0) {
            const picked = matchedMarkers[0];
            const currentSelected = selectedTrade || selectedMarkerState;
            const isSame = currentSelected && (
              currentSelected.id === picked.id ||
              (currentSelected.index === picked.index && Math.abs(currentSelected.price - picked.price) < 0.0001)
            );
            const next = isSame ? null : picked;
            setSelectedMarkerState(next);
            onSelectTrade?.(next);
          } else {
            setSelectedMarkerState(null);
            onSelectTrade?.(null);
          }
          scheduleDraw();
        }
      }
    }
  };

  const handleMouseLeave = () => {
    crosshairRef.current = null;
    setHoveredCandle(null);
    setHoveredMarker(null);
    scheduleDraw();
    if (isDraggingRef.current) {
      handleMouseUp();
    }
  };

  // Cursor-centered Wheel Zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.max(2, Math.min(100, viewState.zoom * zoomFactor));

    if (crosshairRef.current) {
      const mouseX = crosshairRef.current.x;
      const oldCandleIdxAtMouse = viewState.candleOffset + mouseX / viewState.zoom;
      const newCandleOffset = oldCandleIdxAtMouse - mouseX / newZoom;
      setViewState({ zoom: newZoom, candleOffset: Math.max(0, newCandleOffset) });
    } else {
      setViewState(prev => ({ ...prev, zoom: newZoom }));
    }
  };

  // Touch Support
  const handleTouchStart = (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX, candleOffset: viewState.candleOffset });
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
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

    if (e.touches.length === 1 && isDraggingRef.current) {
      const dx = e.touches[0].clientX - dragStart.x;
      const dCandles = dx / viewState.zoom;
      const newOffset = dragStart.candleOffset - dCandles;
      const candleWidth = viewState.zoom;
      const rightPadding = 85;
      const candlesOnScreen = Math.floor((rect.width - rightPadding) / candleWidth);
      const maxOffset = candles.length > candlesOnScreen ? candles.length - candlesOnScreen : 0;

      setViewState(prev => ({ ...prev, candleOffset: Math.max(0, Math.min(newOffset, maxOffset)) }));
    } else if (e.touches.length === 2) {
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
    scheduleDraw();
  };

  // Active Display Candle for Top Bar
  const displayCandle = hoveredCandle || (candles.length > 0 ? candles[candles.length - 1] : null);
  const priceChange = displayCandle ? displayCandle.close - displayCandle.open : 0;
  const priceChangePct = displayCandle && displayCandle.open ? (priceChange / displayCandle.open) * 100 : 0;
  const isUp = priceChange >= 0;
  const decimals = displayCandle && displayCandle.close > 100 ? 2 : 5;

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden transition-all duration-200 select-none ${
        isFullscreen
          ? 'fixed inset-0 z-50 h-screen w-screen bg-[#0c1017]'
          : 'h-full min-h-[480px] bg-[#0c1017]'
      }`}
      style={{ cursor: 'crosshair' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleResetView}
    >
      {/* Top HUD & Interactive Controls Toolbar */}
      <div className="absolute top-2 left-2 right-2 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Symbol & Live OHLC stats */}
        <div className="flex items-center gap-2 pointer-events-auto bg-[#111827]/90 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white shadow-lg">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="text-white">{config.symbol || 'XAU/USD'}</span>
            <span className="text-gray-400 font-normal">·</span>
            <span className="text-blue-400 font-medium">{config.timeframe || '15m'}</span>
          </div>

          {displayCandle && (
            <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-white/10 text-xs">
              <span className="text-gray-400">
                O: <strong className="text-white font-mono">{displayCandle.open.toFixed(decimals)}</strong>
              </span>
              <span className="text-gray-400">
                H: <strong className="text-white font-mono">{displayCandle.high.toFixed(decimals)}</strong>
              </span>
              <span className="text-gray-400">
                L: <strong className="text-white font-mono">{displayCandle.low.toFixed(decimals)}</strong>
              </span>
              <span className="text-gray-400">
                C: <strong className="text-white font-mono">{displayCandle.close.toFixed(decimals)}</strong>
              </span>
              <span className={`font-semibold font-mono ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                {isUp ? '+' : ''}{priceChange.toFixed(decimals)} ({isUp ? '+' : ''}{priceChangePct.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>

        {/* Middle: Phase 4 Adaptive Market Regime HUD */}
        {settings?.showRegimeDashboard !== false && (
          <div className="hidden md:flex items-center gap-2 pointer-events-auto bg-[#111827]/90 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white shadow-lg">
            <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{settings?.activeRegime || htfTrend?.direction || 'Bullish Regime'}</span>
            </span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-300">
              Trend: <strong className="text-amber-400 font-mono">{settings?.trendStrength || htfTrend?.confidence || 75}/100</strong>
            </span>
            <span className="text-gray-400">·</span>
            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
              Mode: {settings?.mode || 'AUTO'}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
              Profile: {settings?.profileStyle || 'Intraday'}
            </span>
          </div>
        )}

        {/* Right: Fullscreen, Theme & Navigation Toolbar */}
        <div className="flex items-center gap-1 pointer-events-auto bg-[#111827]/90 backdrop-blur-md border border-white/10 rounded-xl p-1 shadow-lg">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-200 hover:text-white hover:bg-white/10"
            onClick={() => handleJumpTo('start')}
            disabled={candles.length === 0}
            title="Jump to Start"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-200 hover:text-white hover:bg-white/10"
            onClick={() => handleZoom(0.85)}
            title="Zoom Out (-)"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-200 hover:text-white hover:bg-white/10"
            onClick={handleResetView}
            title="Fit to Recent Candles"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-200 hover:text-white hover:bg-white/10"
            onClick={() => handleZoom(1.18)}
            title="Zoom In (+)"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-200 hover:text-white hover:bg-white/10"
            onClick={() => handleJumpTo('end')}
            disabled={candles.length === 0}
            title="Jump to Live End"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>

          <div className="h-4 w-px bg-white/10 mx-0.5" />

          {/* Trade Levels Visibility Controls */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 px-2 gap-1.5 font-medium text-xs rounded-lg transition-colors border ${
                  activeTradeLevels.showTradeLevels || (activeTradeLevels.showSelectedTradeLevels && (selectedTrade || selectedMarkerState))
                    ? 'bg-blue-600/25 text-blue-300 border-blue-500/40 hover:bg-blue-600/35'
                    : 'border-transparent text-gray-200 hover:text-white hover:bg-white/10'
                }`}
                title="Show/Hide Entry, Stop Loss & Take Profit Levels"
              >
                <Layers className="h-3.5 w-3.5 text-sky-400" />
                <span className="hidden sm:inline">Trade Levels</span>
                {activeTradeLevels.showTradeLevels && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 bg-[#111827]/95 backdrop-blur-md border border-white/15 text-white shadow-2xl z-50"
            >
              <DropdownMenuLabel className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                <span>Trade Levels</span>
                <span className="text-[10px] text-gray-400 font-normal">Overlay Controls</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuCheckboxItem
                checked={activeTradeLevels.showTradeLevels}
                onCheckedChange={(val) => handleToggleLevel('showTradeLevels', val)}
                className="font-semibold text-emerald-400 focus:text-emerald-300 cursor-pointer"
              >
                Show Trade Levels
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuCheckboxItem
                checked={activeTradeLevels.showEntry}
                onCheckedChange={(val) => handleToggleLevel('showEntry', val)}
                disabled={!activeTradeLevels.showTradeLevels}
                className={!activeTradeLevels.showTradeLevels ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              >
                Show Entry Levels
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={activeTradeLevels.showStopLoss}
                onCheckedChange={(val) => handleToggleLevel('showStopLoss', val)}
                disabled={!activeTradeLevels.showTradeLevels}
                className={!activeTradeLevels.showTradeLevels ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              >
                Show Stop Loss (SL)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={activeTradeLevels.showTakeProfit}
                onCheckedChange={(val) => handleToggleLevel('showTakeProfit', val)}
                disabled={!activeTradeLevels.showTradeLevels}
                className={!activeTradeLevels.showTradeLevels ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              >
                Show Take Profit (TP)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={activeTradeLevels.showLabels}
                onCheckedChange={(val) => handleToggleLevel('showLabels', val)}
                disabled={!activeTradeLevels.showTradeLevels}
                className={!activeTradeLevels.showTradeLevels ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              >
                Show Trade Level Labels
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuCheckboxItem
                checked={activeTradeLevels.showSelectedTradeLevels}
                onCheckedChange={(val) => handleToggleLevel('showSelectedTradeLevels', val)}
                className="cursor-pointer"
              >
                Show Selected Trade Levels
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-4 w-px bg-white/10 mx-0.5" />

          {/* Dark/Light Canvas Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-200 hover:text-white hover:bg-white/10"
            onClick={toggleTheme}
            title={`Switch to ${forceTheme === 'dark' ? 'Light' : 'Dark'} Terminal Theme`}
          >
            {forceTheme === 'dark' ? (
              <Sun className="h-3.5 w-3.5 text-amber-400" />
            ) : (
              <Moon className="h-3.5 w-3.5 text-indigo-400" />
            )}
          </Button>

          <div className="h-4 w-px bg-white/10 mx-0.5" />

          {/* Full Screen Toggle Button */}
          <Button
            variant={isFullscreen ? 'default' : 'outline'}
            size="sm"
            className={`h-7 px-2.5 gap-1.5 font-medium text-xs rounded-lg transition-colors border-white/20 ${
              isFullscreen
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white/5 hover:bg-white/15 text-white'
            }`}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Full Screen [ESC]' : 'Show Full Screen [F]'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" />
                <span>Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" />
                <span>Full Screen</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Signal Tooltip on Hover */}
      {hoveredMarker && (
        <div className="absolute bottom-10 left-4 z-20 pointer-events-none bg-[#111827]/95 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-2xl max-w-sm text-xs space-y-1 text-white">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`font-bold px-1.5 py-0.5 rounded ${
                hoveredMarker.type?.includes('BUY')
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
            >
              {hoveredMarker.type}
            </span>
            <span className="font-semibold text-blue-400">
              Tier {hoveredMarker.qualityTier || 'A'} · {hoveredMarker.score?.toFixed(1) || '-'} pts
            </span>
          </div>
          <div className="text-gray-300">{hoveredMarker.notes}</div>
          {hoveredMarker.sl && hoveredMarker.tp && (
            <div className="flex items-center gap-3 pt-1 border-t border-white/10 text-xs font-mono">
              <span className="text-orange-400">SL: {hoveredMarker.sl.toFixed(decimals)}</span>
              <span className="text-emerald-400">TP: {hoveredMarker.tp.toFixed(decimals)}</span>
            </div>
          )}
        </div>
      )}

      {/* Main HTML5 Canvas */}
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
});
