'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TopBar } from '@/components/tradezella/TopBar';
import StrategySettings from '@/components/tradezella/StrategySettings';
import { CandleStickChart } from '@/components/tradezella/CandleStickChart';
import { TradeLog } from '@/components/tradezella/TradeLog';
import { SignalDiagnosticsPanel } from '@/components/tradezella/SignalDiagnosticsPanel';
import { RiskManagementPanel } from '@/components/tradezella/RiskManagementPanel';
import { BacktestingDashboard } from '@/components/tradezella/BacktestingDashboard';
import { ReportCenter } from '@/components/tradezella/ReportCenter';
import { useToast } from '@/hooks/use-toast';
import { runConfluenceEngine } from '@/lib/liquidity';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  BarChart2,
  Sliders,
  ShieldAlert,
  ListOrdered,
  Activity,
  FileText,
  X,
  Layers,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import { cn } from '@/lib/utils';

const createInitialAnalysisResult = () => ({
  tradeLog: [],
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
  htfTrend: { direction: 'Ranging', confidence: 0 },
  simulatedAccount: null,
  riskDiagnostics: null,
  tradePlans: [],
  diagnostics: null,
  rankedOpportunities: [],
});

const STORAGE_KEYS = {
  settings: 'tradezella:settings:v1',
  config: 'tradezella:config:v1',
  session: 'sessionOverlayPrefs:v1',
  view: 'tradezella:view:v1',
  tradeLevels: 'tradezella:tradeLevels:v1',
  sidebar: 'tradezella:sidebar:v1',
};

const defaultTradeLevelVisibility = {
  showTradeLevels: false,
  showEntry: false,
  showStopLoss: false,
  showTakeProfit: false,
  showLabels: false,
  showSelectedTradeLevels: true,
};

function getDefaultConfig() {
  return {
    symbol: 'XAU/USD',
    timeframe: '15m',
    dateRange: {
      from: new Date(new Date().setDate(new Date().getDate() - 30)),
      to: new Date(),
    },
  };
}

function readStorageValue(key, fallback) {
  if (typeof window === 'undefined') return fallback;

  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    console.error(`Failed to read ${key} from local storage`, error);
    return fallback;
  }
}

function writeStorageValue(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to save ${key} to local storage`, error);
  }
}

function mergeSettings(defaults, saved) {
  if (!saved || typeof saved !== 'object') return defaults;

  return {
    ...defaults,
    ...saved,
    strategy: {
      ...defaults.strategy,
      ...(saved.strategy || {}),
    },
  };
}

function mergeConfig(defaults, saved) {
  if (!saved || typeof saved !== 'object') return defaults;

  const savedDateRange = saved.dateRange || {};
  return {
    ...defaults,
    ...saved,
    dateRange: {
      from: savedDateRange.from ? new Date(savedDateRange.from) : defaults.dateRange.from,
      to: savedDateRange.to ? new Date(savedDateRange.to) : defaults.dateRange.to,
    },
  };
}

function serializeConfig(config) {
  return {
    ...config,
    dateRange: {
      from: config.dateRange?.from?.toISOString?.() || null,
      to: config.dateRange?.to?.toISOString?.() || null,
    },
  };
}

function mergeViewState(defaults, saved) {
  if (!saved || typeof saved !== 'object') return defaults;

  const zoom = Number(saved.zoom);
  const candleOffset = Number(saved.candleOffset);
  return {
    zoom: Number.isFinite(zoom) ? Math.max(2, Math.min(100, zoom)) : defaults.zoom,
    candleOffset: Number.isFinite(candleOffset) ? Math.max(0, candleOffset) : defaults.candleOffset,
  };
}

const initialSettings = {
  strategy: {
    liquiditySweep: true,
    obMss: true,
    breakerBlocks: false,
    mitigationBlock: false,
    institutionalRange: false,
    asianRange: false,
    fvgImbalance: true,
    liquidityVoid: false,
    obFvgConfluence: true,
    cobMss: false,
    londonKillzone: false,
    newYorkKillzone: false,
    powerOfThree: false,
    londonBreakout: false,
    classicBreakout: false,
    momentumSpike: true,
  },
  lookback: 20,
  minWickRatio: 0.5,
  equalTolerance: 0.002,
  filterTinySweepsThreshold: 0.0,
  mssConfirmationRequired: true,
  showCandidateOnlyMarkers: false,
  showOnlyHighQuality: false,
  enableAiTradeSignalAnalyzer: false,
  showLiquidityPools: true,
  showSweepWick: true,
  showMss: true,
  showOrderBlocks: true,
  showBreakerBlocks: true,
  showMitigationBlocks: true,
  showFvgs: true,
  showAsianRange: true,
  showSLTP: false,

  // MTF Engine Settings
  enableMtfEngine: true,
  showHtfTrends: true,
  showHtfKeyLevels: true,
  htfTimeframe: '4h',
  confluenceScoreThreshold: 4,
  keyLevelProximity: 0.004,
  defaultRiskRewardRatio: 1.5,
  volumeConfirmationGlobal: false,
  minimumDisplacementAtr: 0.8,
  minCandlesBetweenSignals: 5,

  // Qualified Sweep Settings
  enableQualifiedSweepFilters: false,
  minQualifiedWickSize: 0.6,
  requireVolumeConfirmation: true,
  volumeMaPeriod: 20,
  
  // OB Scoring Settings
  enableOrderBlockScoring: true,
  minObScore: 2,

  // FVG Settings
  detectInstitutionalImbalanceZones: true,
  minFvgsPerZone: 2,
  onlyShowZonesAboveThreshold: false,
  
  // Breaker Block Settings
  breakerBlockConfirmation: 'Candle Rejection',

  // Mitigation Block Settings
  mitigationBlockConfirmation: 'Rejection Candle',

  // COB + MSS Settings
  cobLookbackPeriod: 20,
  cobMinBodyPercentage: 0.5,
  cobRequireMssConfirmation: true,
  cobAllowRefinedEntry: false,

  // London Kill Zone Settings
  londonKzStartTime: 8,
  londonKzEndTime: 12,
  londonKzVolumeConfirmation: true,
  
  // New York Kill Zone Settings
  newYorkKzStartTime: 13,
  newYorkKzEndTime: 17,
  newYorkKzVolumeConfirmation: true,

  // Power of Three Settings
  powerOfThreeAccumulationLookback: 50,
  observeManipulation: true,
  manipulationLookback: 20,
  manipulationVolumeConfirmation: false,
  requireCloseOutsideRange: false,
  enableDistributionEntries: true,
  distributionEntryLookback: 10,
  distributionRiskRewardRatio: 2,
  distributionMssConfirmation: true,

  // Classic Breakout Settings
  classicBreakoutLookback: 20,
  classicBreakoutVolumeSpike: true,
  classicBreakoutEnableRetest: false,

  // Momentum Spike Settings
  minRangeMultiplier: 2.0,
  volumeSurgeFactor: 1.5,
  bodyPercentageThreshold: 0.7,
  atrPeriod: 20,
  momentumVolumeMaPeriod: 20,
  requireMomentumBreakout: true,
  momentumEntryType: 'Close of Spike',

  slBufferPercent: 0.002,
  
  // Phase 7 — Unified Signal Scoring & Decision Engine
  enableUnifiedSignalEngine: true,
  qualityPreset: 'Balanced',
  unifiedScoreThreshold: 60,
  enableConflictAnalysis: true,
  preserveIndependentStyles: true,
  duplicateWindowCandles: 4,

  // Phase 8 — Professional Dynamic Risk Management & Trade Management
  enableRiskEngine: true,
  simulatedAccountBalance: 10000,
  riskPerTradePct: 1.0,
  riskProfile: 'Balanced',
  capitalBasis: 'Balance',
  stopLossMethod: 'HYBRID',
  takeProfitMethod: 'HYBRID',
  atrMultiplierSl: 1.5,
  enableBreakEven: true,
  breakEvenTriggerR: 1.0,
  breakEvenBufferPips: 2,
  enableTrailingStop: true,
  trailingMethod: 'ATR',
  trailingAtrMultiplier: 1.5,
  maxDailyLossPct: 3.0,
  maxWeeklyLossPct: 6.0,
  maxDrawdownLimitPct: 10.0,
  maxConcurrentPositions: 3,
  maxOpenRiskPct: 5.0,
  intrabarAmbiguityPolicy: 'CONSERVATIVE',
  showRiskOverlay: true,
};

const initialSessionSettings = {
  enabled: true,
  asia: true,
  london: true,
  newYork: true,
  overlaps: true,
};

export default function Home() {
  const { toast } = useToast();
  const hasHydratedPrefsRef = useRef(false);
  const [hasHydratedPrefs, setHasHydratedPrefs] = useState(false);
  const [settings, setSettings] = useState(initialSettings);
  const [config, setConfig] = useState(getDefaultConfig);
  const [sessionSettings, setSessionSettings] = useState(initialSessionSettings);
  const [tradeLevelVisibility, setTradeLevelVisibility] = useState(defaultTradeLevelVisibility);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [latestBacktestRun, setLatestBacktestRun] = useState(null);
  
  const [candles, setCandles] = useState([]);
  const [telemetry, setTelemetry] = useState(null);
  const [isSimulated, setIsSimulated] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [analysisResult, setAnalysisResult] = useState(createInitialAnalysisResult);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [viewState, setViewState] = useState({
    zoom: 10,
    candleOffset: 0,
  });

  // Responsive Layout States
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('strategy'); // 'strategy' | 'risk' | 'trades' | 'diagnostics' | 'backtest' | 'reports'
  
  // Mobile Drawer State
  const [mobileDrawerTab, setMobileDrawerTab] = useState(null); // null | 'strategy' | 'risk' | 'trades' | 'analytics'
  const [analyticsSubTab, setAnalyticsSubTab] = useState('diagnostics'); // 'diagnostics' | 'backtest' | 'reports'

  const containerRef = useRef(null);
  const fetchRunIdRef = useRef(0);
  const fetchAbortRef = useRef(null);
  const analysisRunIdRef = useRef(0);

  useEffect(() => {
    const nextSettings = mergeSettings(initialSettings, readStorageValue(STORAGE_KEYS.settings, null));
    const nextConfig = mergeConfig(getDefaultConfig(), readStorageValue(STORAGE_KEYS.config, null));
    const nextSessionSettings = {
      ...initialSessionSettings,
      ...readStorageValue(STORAGE_KEYS.session, null),
    };
    const nextViewState = mergeViewState({ zoom: 10, candleOffset: 0 }, readStorageValue(STORAGE_KEYS.view, null));
    const nextTradeLevels = {
      ...defaultTradeLevelVisibility,
      ...readStorageValue(STORAGE_KEYS.tradeLevels, null),
    };
    const savedSidebar = readStorageValue(STORAGE_KEYS.sidebar, true);

    setSettings(nextSettings);
    setConfig(nextConfig);
    setSessionSettings(nextSessionSettings);
    setViewState(nextViewState);
    setTradeLevelVisibility(nextTradeLevels);
    setSidebarOpen(savedSidebar);
    hasHydratedPrefsRef.current = true;
    setHasHydratedPrefs(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedPrefsRef.current) return;
    writeStorageValue(STORAGE_KEYS.settings, settings);
  }, [settings]);

  useEffect(() => {
    if (!hasHydratedPrefsRef.current) return;
    writeStorageValue(STORAGE_KEYS.config, serializeConfig(config));
  }, [config]);

  useEffect(() => {
    if (!hasHydratedPrefsRef.current) return;
    writeStorageValue(STORAGE_KEYS.session, sessionSettings);
  }, [sessionSettings]);

  useEffect(() => {
    if (!hasHydratedPrefsRef.current) return;
    writeStorageValue(STORAGE_KEYS.view, viewState);
  }, [viewState]);

  useEffect(() => {
    if (!hasHydratedPrefsRef.current) return;
    writeStorageValue(STORAGE_KEYS.tradeLevels, tradeLevelVisibility);
  }, [tradeLevelVisibility]);

  useEffect(() => {
    if (!hasHydratedPrefsRef.current) return;
    writeStorageValue(STORAGE_KEYS.sidebar, sidebarOpen);
  }, [sidebarOpen]);

  const handleFetchData = useCallback(async () => {
    const runId = fetchRunIdRef.current + 1;
    fetchRunIdRef.current = runId;
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    analysisRunIdRef.current += 1;

    setIsLoading(true);
    setLoadingStatus('Initializing market feed fetch...');
    setAnalysisResult(createInitialAnalysisResult());
    
    try {
      const { symbol, timeframe, dateRange } = config;
      if (!dateRange.from || !dateRange.to) {
        toast({ title: 'Error', description: 'Please select a valid date range.', variant: 'destructive' });
        setIsLoading(false);
        setLoadingStatus('');
        return;
      }
      const startStr = dateRange.from.toISOString().split('T')[0];
      const endStr = dateRange.to.toISOString().split('T')[0];
      const apiUrl = `/api/finage?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&start=${startStr}&end=${endStr}&inclusive=true`;
      
      setLoadingStatus(`Fetching ${symbol} (${timeframe})...`);
      const response = await fetch(apiUrl, { signal: controller.signal });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch data: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (runId !== fetchRunIdRef.current) return;

      if (!data.candles || data.candles.length === 0) {
        toast({ title: 'No Data', description: 'No candle data found for the selected range.', variant: 'destructive' });
        setCandles([]);
        setTelemetry(null);
        return;
      }
      
      setCandles(data.candles);
      setTelemetry(data.telemetry || null);
      setIsSimulated(data.isSimulated || false);
      setViewState(prev => {
        const zoom = prev.zoom || 10;
        const canvasWidth = containerRef.current?.getBoundingClientRect().width || 1000;
        const rightPadding = 85;
        const candlesOnScreen = Math.floor((canvasWidth - rightPadding) / zoom);
        const newOffset = Math.max(0, data.candles.length - candlesOnScreen);
        return { ...prev, candleOffset: newOffset };
      });

      const totalChunks = data.telemetry?.totalChunks || 1;
      const loadedMsg = data.isSimulated 
        ? `[Demo Mode] Loaded ${data.candles.length.toLocaleString()} simulated candles.`
        : `Loaded ${data.candles.length.toLocaleString()} real candles across ${totalChunks} chunks.`;
      
      toast({
        title: data.isSimulated ? 'Demo Feed Active' : 'Market Data Synced',
        description: loadedMsg,
      });
    } catch (error) {
      if (error.name === 'AbortError') return;
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setCandles([]);
      setTelemetry(null);
    } finally {
      if (runId === fetchRunIdRef.current) {
        setIsLoading(false);
        setLoadingStatus('');
      }
    }
  }, [config, toast]);

  useEffect(() => {
    if (!hasHydratedPrefs) return;
    handleFetchData();
  }, [hasHydratedPrefs, handleFetchData]);

  useEffect(() => {
    if (candles.length > 0) {
      const runId = analysisRunIdRef.current + 1;
      analysisRunIdRef.current = runId;
      const runAnalysis = async () => {
        setIsLoading(true);
        try {
          const result = await runConfluenceEngine(candles, settings, config);
          if (runId !== analysisRunIdRef.current) return;
          setAnalysisResult(result);
        } catch (error) {
          if (runId !== analysisRunIdRef.current) return;
          console.error("Analysis Error:", error);
          toast({ title: 'Analysis Failed', description: 'Could not analyze trade signals.', variant: 'destructive' });
        } finally {
          if (runId === analysisRunIdRef.current) {
            setIsLoading(false);
          }
        }
      };
      runAnalysis();
    }
  }, [candles, settings, config, toast]);

  const candleIndexByTime = useMemo(() => {
    const indexByTime = new Map();
    candles.forEach((candle, index) => {
      indexByTime.set(candle.time, index);
    });
    return indexByTime;
  }, [candles]);

  const markers = useMemo(() => {
    const logSource = analysisResult.tradeLog || [];
    
    return logSource
      .filter(log => {
        if (settings.enableMtfEngine && !log.isApproved) {
            return false;
        }
        if (settings.showOnlyHighQuality && (log.score || 0) < 5) {
            return false;
        }
        if (!settings.showCandidateOnlyMarkers && log.type.includes('candidate')) {
            return false;
        }
        if (log.type.includes('Manipulation') && !settings.observeManipulation) {
            return false;
        }
        return true;
      })
      .map(log => {
        const candleIndex = candleIndexByTime.get(log.time);
        if (candleIndex === undefined) return null;
        
        return {
          index: candleIndex,
          type: log.type,
          price: log.price,
          notes: log.notes,
          score: log.score,
          sl: log.sl,
          tp: log.tp,
          tp1: log.tp1,
          tp2: log.tp2,
          tp3: log.tp3,
          lots: log.totalLots || log.lots,
          riskReward: log.riskReward || log.grossRewardRisk,
          isApproved: log.isApproved,
          qualityTier: log.qualityTier,
          strategy: log.strategy,
          mssIndex: log.mssIndex,
        };
      }).filter(Boolean);
  }, [analysisResult.tradeLog, candleIndexByTime, settings.enableMtfEngine, settings.showOnlyHighQuality, settings.showCandidateOnlyMarkers, settings.observeManipulation]);
  
  const displayedTradeLog = useMemo(() => {
    return (analysisResult.tradeLog || [])
      .filter(log => {
        if (settings.enableMtfEngine && !log.isApproved) return false;
        if (settings.showOnlyHighQuality && (log.score || 0) < 5) return false;
        if (!settings.showCandidateOnlyMarkers && log.type?.includes('candidate')) return false;
        return true;
      })
      .sort((a, b) => b.time - a.time);
  }, [analysisResult.tradeLog, settings.enableMtfEngine, settings.showOnlyHighQuality, settings.showCandidateOnlyMarkers]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#070a0f] font-sans text-foreground">
      {/* 1. Pro Terminal Header */}
      <TopBar 
        config={config} 
        setConfig={setConfig} 
        onFetchData={handleFetchData} 
        isLoading={isLoading}
        sessionSettings={sessionSettings}
        setSessionSettings={setSessionSettings}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        telemetry={telemetry}
        isSimulated={isSimulated}
      />

      {/* Loading Progress Ribbon */}
      {isLoading && loadingStatus && (
        <div className="h-5 px-3 bg-sky-500/10 border-b border-sky-500/20 text-[11px] text-sky-300 flex items-center justify-between shrink-0 animate-pulse">
          <span className="font-medium truncate">{loadingStatus}</span>
          <span className="text-[10px] text-sky-400/80 font-mono">Syncing Finage Feed...</span>
        </div>
      )}

      {/* 2. Main Terminal Body (Desktop Split View & Mobile Viewport) */}
      <div className="flex flex-1 w-full overflow-hidden relative">
        {/* Main Chart Canvas Workspace */}
        <main className="flex-1 h-full relative overflow-hidden bg-[#0c1017]">
          <div ref={containerRef} className="h-full w-full relative">
            {isLoading && candles.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center p-6 space-y-4 text-center">
                <div className="w-16 h-16 rounded-full bg-sky-500/10 flex items-center justify-center animate-pulse border border-sky-500/20">
                  <Activity className="h-8 w-8 text-sky-400" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-white">Loading Market Feeds</h3>
                  <p className="text-xs text-muted-foreground max-w-xs">{loadingStatus || 'Connecting to Finage market aggregate API...'}</p>
                </div>
              </div>
            ) : candles.length > 0 ? (
              <CandleStickChart
                candles={candles}
                markers={markers}
                config={config}
                viewState={viewState}
                setViewState={setViewState}
                setIsDragging={setIsDragging}
                liquidityData={analysisResult.liquidityData}
                breakerBlocks={analysisResult.breakerBlocks}
                mitigationBlocks={analysisResult.mitigationBlocks}
                orderBlocks={analysisResult.orderBlocks}
                continuationOrderBlocks={analysisResult.continuationOrderBlocks}
                fvgs={analysisResult.fvgs}
                imbalanceZones={analysisResult.imbalanceZones}
                dealingRange={analysisResult.dealingRange}
                asianRanges={analysisResult.asianRanges}
                powerOfThreeZones={analysisResult.powerOfThreeZones}
                classicBreakoutZones={analysisResult.classicBreakoutZones}
                htfKeyLevels={analysisResult.htfKeyLevels}
                htfTrend={analysisResult.htfTrend}
                waterfallMarkers={analysisResult.waterfallMarkers}
                sessionSettings={sessionSettings}
                settings={settings}
                tradeLevelVisibility={tradeLevelVisibility}
                setTradeLevelVisibility={setTradeLevelVisibility}
                selectedTrade={selectedTrade}
                onSelectTrade={setSelectedTrade}
              />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center p-6 space-y-3 text-center">
                <p className="text-xs text-muted-foreground">Select parameters and sync data to view price action.</p>
                <Button size="sm" onClick={handleFetchData} className="bg-sky-600 hover:bg-sky-500 text-white text-xs">
                  Load Market Data
                </Button>
              </div>
            )}
          </div>
        </main>

        {/* Desktop Sidebar (Right Panel) */}
        {sidebarOpen && (
          <aside className="hidden md:flex flex-col w-[380px] lg:w-[420px] h-full border-l border-white/10 bg-[#090d14] z-20 shrink-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full w-full">
              {/* Tab Header Bar */}
              <div className="border-b border-white/10 bg-[#0d121c] p-1.5 shrink-0">
                <TabsList className="grid grid-cols-6 h-8 w-full bg-white/5 p-0.5 rounded-lg text-xs">
                  <TabsTrigger value="strategy" className="px-1 py-1 text-[11px] font-medium data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-300">
                    Strategy
                  </TabsTrigger>
                  <TabsTrigger value="risk" className="px-1 py-1 text-[11px] font-medium data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-300">
                    Risk
                  </TabsTrigger>
                  <TabsTrigger value="trades" className="px-1 py-1 text-[11px] font-medium data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-300 relative">
                    Trades
                    {displayedTradeLog.length > 0 && (
                      <span className="ml-1 px-1 rounded bg-sky-500 text-[9px] text-white font-bold">{displayedTradeLog.length}</span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="diagnostics" className="px-1 py-1 text-[11px] font-medium data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-300">
                    Diag
                  </TabsTrigger>
                  <TabsTrigger value="backtest" className="px-1 py-1 text-[11px] font-medium data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-300">
                    Backtest
                  </TabsTrigger>
                  <TabsTrigger value="reports" className="px-1 py-1 text-[11px] font-medium data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-300">
                    Report
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Tab Contents Container */}
              <div className="flex-1 overflow-y-auto p-3 text-xs custom-scrollbar">
                <TabsContent value="strategy" className="mt-0 space-y-4">
                  <StrategySettings settings={settings} setSettings={setSettings} />
                </TabsContent>

                <TabsContent value="risk" className="mt-0 space-y-4">
                  <RiskManagementPanel 
                    simulatedAccount={analysisResult.simulatedAccount}
                    riskDiagnostics={analysisResult.riskDiagnostics}
                    tradePlans={analysisResult.tradePlans}
                    symbol={config?.symbol || 'XAUUSD'}
                  />
                </TabsContent>

                <TabsContent value="trades" className="mt-0 space-y-4">
                  <TradeLog 
                    tradeLog={displayedTradeLog} 
                    selectedTrade={selectedTrade}
                    onSelectTrade={setSelectedTrade}
                  />
                </TabsContent>

                <TabsContent value="diagnostics" className="mt-0 space-y-4">
                  <SignalDiagnosticsPanel 
                    diagnostics={analysisResult.diagnostics} 
                    rankedOpportunities={analysisResult.rankedOpportunities} 
                  />
                </TabsContent>

                <TabsContent value="backtest" className="mt-0 space-y-4">
                  <BacktestingDashboard 
                    candles={candles} 
                    config={config} 
                    settings={settings} 
                    onRunComplete={setLatestBacktestRun} 
                  />
                </TabsContent>

                <TabsContent value="reports" className="mt-0 space-y-4">
                  <ReportCenter 
                    backtestRun={latestBacktestRun} 
                    candles={candles} 
                    config={config} 
                    settings={settings} 
                  />
                </TabsContent>
              </div>
            </Tabs>
          </aside>
        )}
      </div>

      {/* 3. Mobile Navigation Bottom Bar (<768px) */}
      <nav className="md:hidden h-14 w-full bg-[#090d14] border-t border-white/10 flex items-center justify-around px-2 z-30 shrink-0 select-none">
        <button
          onClick={() => setMobileDrawerTab(null)}
          className={cn(
            "flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors text-[10px] font-medium",
            mobileDrawerTab === null ? "text-sky-400 font-bold" : "text-gray-400 hover:text-white"
          )}
        >
          <BarChart2 className="h-4 w-4" />
          <span>Chart</span>
        </button>

        <button
          onClick={() => setMobileDrawerTab('strategy')}
          className={cn(
            "flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors text-[10px] font-medium",
            mobileDrawerTab === 'strategy' ? "text-sky-400 font-bold" : "text-gray-400 hover:text-white"
          )}
        >
          <Sliders className="h-4 w-4" />
          <span>Strategy</span>
        </button>

        <button
          onClick={() => setMobileDrawerTab('risk')}
          className={cn(
            "flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors text-[10px] font-medium",
            mobileDrawerTab === 'risk' ? "text-sky-400 font-bold" : "text-gray-400 hover:text-white"
          )}
        >
          <ShieldAlert className="h-4 w-4" />
          <span>Risk & Size</span>
        </button>

        <button
          onClick={() => setMobileDrawerTab('trades')}
          className={cn(
            "flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors text-[10px] font-medium relative",
            mobileDrawerTab === 'trades' ? "text-sky-400 font-bold" : "text-gray-400 hover:text-white"
          )}
        >
          <ListOrdered className="h-4 w-4" />
          <span>Trade Log</span>
          {displayedTradeLog.length > 0 && (
            <span className="absolute top-0.5 right-3 h-3.5 w-3.5 rounded-full bg-sky-500 text-[8px] text-white flex items-center justify-center font-bold">
              {displayedTradeLog.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setMobileDrawerTab('analytics')}
          className={cn(
            "flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors text-[10px] font-medium",
            mobileDrawerTab === 'analytics' ? "text-sky-400 font-bold" : "text-gray-400 hover:text-white"
          )}
        >
          <Activity className="h-4 w-4" />
          <span>Analytics</span>
        </button>
      </nav>

      {/* 4. Mobile Drawer / Sheet (<768px) */}
      <Sheet open={mobileDrawerTab !== null} onOpenChange={(open) => !open && setMobileDrawerTab(null)}>
        <SheetContent side="bottom" className="h-[85vh] p-0 bg-[#0c1017] border-t border-white/15 text-white z-50 flex flex-col">
          {/* Drawer Handle & Header */}
          <div className="flex items-center justify-between p-3 border-b border-white/10 bg-[#111827] shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <SheetTitle className="text-sm font-bold text-white">
                {mobileDrawerTab === 'strategy' && 'Strategy & Signal Engine Controls'}
                {mobileDrawerTab === 'risk' && 'Dynamic Risk & Position Sizing'}
                {mobileDrawerTab === 'trades' && `Trade Log & Signal Execution (${displayedTradeLog.length})`}
                {mobileDrawerTab === 'analytics' && 'Analytics, Backtesting & Reports'}
              </SheetTitle>
            </div>
            <SheetDescription className="sr-only">Mobile Config Sheet</SheetDescription>
          </div>

          {/* Drawer Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 text-xs space-y-4 custom-scrollbar">
            {mobileDrawerTab === 'strategy' && (
              <StrategySettings settings={settings} setSettings={setSettings} />
            )}

            {mobileDrawerTab === 'risk' && (
              <RiskManagementPanel 
                simulatedAccount={analysisResult.simulatedAccount}
                riskDiagnostics={analysisResult.riskDiagnostics}
                tradePlans={analysisResult.tradePlans}
                symbol={config?.symbol || 'XAUUSD'}
              />
            )}

            {mobileDrawerTab === 'trades' && (
              <TradeLog 
                tradeLog={displayedTradeLog} 
                selectedTrade={selectedTrade}
                onSelectTrade={setSelectedTrade}
              />
            )}

            {mobileDrawerTab === 'analytics' && (
              <Tabs value={analyticsSubTab} onValueChange={setAnalyticsSubTab} className="w-full space-y-3">
                <TabsList className="grid grid-cols-3 h-8 w-full bg-white/5 p-0.5 rounded-lg text-xs">
                  <TabsTrigger value="diagnostics" className="px-2 py-1 text-[11px] font-medium">Diagnostics</TabsTrigger>
                  <TabsTrigger value="backtest" className="px-2 py-1 text-[11px] font-medium">Backtest</TabsTrigger>
                  <TabsTrigger value="reports" className="px-2 py-1 text-[11px] font-medium">Reports</TabsTrigger>
                </TabsList>

                <TabsContent value="diagnostics" className="mt-0">
                  <SignalDiagnosticsPanel 
                    diagnostics={analysisResult.diagnostics} 
                    rankedOpportunities={analysisResult.rankedOpportunities} 
                  />
                </TabsContent>

                <TabsContent value="backtest" className="mt-0">
                  <BacktestingDashboard 
                    candles={candles} 
                    config={config} 
                    settings={settings} 
                    onRunComplete={setLatestBacktestRun} 
                  />
                </TabsContent>

                <TabsContent value="reports" className="mt-0">
                  <ReportCenter 
                    backtestRun={latestBacktestRun} 
                    candles={candles} 
                    config={config} 
                    settings={settings} 
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
