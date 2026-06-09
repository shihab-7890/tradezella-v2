'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TopBar } from '@/components/tradezella/TopBar';
import StrategySettings from '@/components/tradezella/StrategySettings';
import { CandleStickChart } from '@/components/tradezella/CandleStickChart';
import { PlaybackControls } from '@/components/tradezella/PlaybackControls';
import { TradeLog } from '@/components/tradezella/TradeLog';
import { useToast } from '@/hooks/use-toast';
import { runConfluenceEngine } from '@/lib/liquidity';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, ChevronsUpDown, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
});

const STORAGE_KEYS = {
  settings: 'tradezella:settings:v1',
  config: 'tradezella:config:v1',
  session: 'sessionOverlayPrefs:v1',
  view: 'tradezella:view:v1',
  playback: 'tradezella:playback:v1',
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

function mergePlaybackState(defaults, saved) {
  if (!saved || typeof saved !== 'object') return defaults;

  const speed = Number(saved.speed);
  const currentIndex = Number(saved.currentIndex);
  return {
    ...defaults,
    speed: Number.isFinite(speed) ? Math.max(0.5, Math.min(10, speed)) : defaults.speed,
    currentIndex: Number.isFinite(currentIndex) ? Math.max(0, currentIndex) : defaults.currentIndex,
    playing: false,
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
  keyLevelProximity: 0.004, // 0.4%
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
  breakerBlockConfirmation: 'Candle Rejection', // Options: 'Candle Rejection', 'FVG', 'MSS'

  // Mitigation Block Settings
  mitigationBlockConfirmation: 'Rejection Candle', // Options: 'Rejection Candle', 'FVG', 'MSS'

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

  slBufferPercent: 0.002, // 0.2%
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
  
  const [candles, setCandles] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(createInitialAnalysisResult);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [playbackState, setPlaybackState] = useState({
    playing: false,
    speed: 1, // candles per second
    currentIndex: 0,
  });
  const [viewState, setViewState] = useState({
    zoom: 10, // candle width in pixels
    candleOffset: 0,
  });
  
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
    const savedPlayback = readStorageValue(STORAGE_KEYS.playback, null);

    setSettings(nextSettings);
    setConfig(nextConfig);
    setSessionSettings(nextSessionSettings);
    setViewState(nextViewState);
    setPlaybackState(prev => mergePlaybackState(prev, savedPlayback));
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
    writeStorageValue(STORAGE_KEYS.playback, {
      speed: playbackState.speed,
      currentIndex: playbackState.currentIndex,
    });
  }, [playbackState.speed, playbackState.currentIndex]);

  const handleFetchData = useCallback(async () => {
    const runId = fetchRunIdRef.current + 1;
    fetchRunIdRef.current = runId;
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    analysisRunIdRef.current += 1;

    setIsLoading(true);
    setPlaybackState(prev => ({ ...prev, playing: false, currentIndex: 0 }));
    setAnalysisResult(createInitialAnalysisResult());
    
    try {
      const { symbol, timeframe, dateRange } = config;
      if (!dateRange.from || !dateRange.to) {
        toast({ title: 'Error', description: 'Please select a valid date range.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }
      const apiUrl = `/api/finage?symbol=${symbol}&timeframe=${timeframe}&start=${dateRange.from.toISOString().split('T')[0]}&end=${dateRange.to.toISOString().split('T')[0]}`;
      
      const response = await fetch(apiUrl, { signal: controller.signal });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch data: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (runId !== fetchRunIdRef.current) return;

      if (!data.candles || data.candles.length === 0) {
        toast({ title: 'No Data', description: 'No candle data found for the selected range.', variant: 'destructive' });
        setCandles([]);
        return;
      }
      
      setCandles(data.candles);
      setPlaybackState(prev => ({...prev, currentIndex: data.candles.length > 0 ? data.candles.length -1 : 0}))
      toast({ title: 'Success', description: `Loaded ${data.candles.length} candles for ${symbol}.` });
    } catch (error) {
      if (error.name === 'AbortError') return;
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setCandles([]);
    } finally {
      if (runId === fetchRunIdRef.current) {
        setIsLoading(false);
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
          isApproved: log.isApproved,
          qualityTier: log.qualityTier,
          strategy: log.strategy,
          mssIndex: log.mssIndex, // Pass mssIndex for drawing
        };
      }).filter(Boolean);
  }, [analysisResult.tradeLog, candleIndexByTime, settings.enableMtfEngine, settings.showOnlyHighQuality, settings.showCandidateOnlyMarkers, settings.observeManipulation]);
  
  const displayedTradeLog = useMemo(() => {
    return (analysisResult.tradeLog || [])
      .filter(log => {
        const candleIndex = candleIndexByTime.get(log.time);
        if (candleIndex === undefined || candleIndex > playbackState.currentIndex) return false;
        if (settings.enableMtfEngine && !log.isApproved) return false;
        if (settings.showOnlyHighQuality && (log.score || 0) < 5) return false;
        if (!settings.showCandidateOnlyMarkers && log.type.includes('candidate')) return false;
        return true;
      })
      .sort((a, b) => b.time - a.time);
  }, [analysisResult.tradeLog, candleIndexByTime, playbackState.currentIndex, settings.enableMtfEngine, settings.showOnlyHighQuality, settings.showCandidateOnlyMarkers]);

  const handleZoom = (factor) => {
    setViewState(prev => ({ ...prev, zoom: Math.max(2, Math.min(100, prev.zoom * factor)) }));
  };

  const handleJumpTo = (position) => {
    if (!containerRef.current || candles.length === 0) return;
    
    if (position === 'start') {
      setViewState(prev => ({ ...prev, candleOffset: 0 }));
    } else if (position === 'end') {
      const canvasWidth = containerRef.current.getBoundingClientRect().width;
      const rightPadding = 80;
      const candlesOnScreen = Math.floor((canvasWidth - rightPadding) / viewState.zoom);
      const newOffset = Math.max(0, candles.length - candlesOnScreen);
      setViewState(prev => ({ ...prev, candleOffset: newOffset }));
    }
  };
  
  // Auto-pan logic
  useEffect(() => {
    if (playbackState.playing && !isDragging) {
        const canvasWidth = containerRef.current?.getBoundingClientRect().width || 0;
        const rightPadding = 80;
        const candlesOnScreen = Math.floor((canvasWidth - rightPadding) / viewState.zoom);
        const playbackX = (playbackState.currentIndex - viewState.candleOffset) * viewState.zoom;

        // If playback cursor is near the right edge, pan the view
        if (playbackX > canvasWidth - rightPadding - viewState.zoom * 10) {
            const targetOffset = Math.max(0, playbackState.currentIndex - candlesOnScreen + 10);
            if (viewState.candleOffset !== targetOffset) {
                setViewState(prev => ({ ...prev, candleOffset: targetOffset }));
            }
        }
    }
  }, [playbackState.currentIndex, playbackState.playing, viewState.zoom, viewState.candleOffset, isDragging]);

  const CollapsibleTriggerButton = ({ sectionName }) => (
    <CollapsibleTrigger asChild>
      <Button variant="ghost" className="w-full justify-between px-4">
        <span className="text-base font-semibold">{sectionName}</span>
        <ChevronsUpDown className="h-4 w-4" />
      </Button>
    </CollapsibleTrigger>
  );

  return (
    <div className="flex h-screen w-full flex-col bg-background font-sans text-foreground">
      <Collapsible>
        <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between px-4 border-b">
                <span className="text-lg font-semibold">Configuration</span>
                <ChevronsUpDown className="h-4 w-4" />
            </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <TopBar 
            config={config} 
            setConfig={setConfig} 
            onFetchData={handleFetchData} 
            isLoading={isLoading}
            sessionSettings={sessionSettings}
            setSessionSettings={setSessionSettings}
           />
        </CollapsibleContent>
      </Collapsible>
      
      <main className="flex flex-1 flex-col gap-2 overflow-hidden p-4 pt-2">
        <Collapsible className="rounded-2xl border bg-card shadow-md">
           <CollapsibleTriggerButton sectionName="Strategy Settings" />
          <CollapsibleContent>
            <StrategySettings settings={settings} setSettings={setSettings} />
          </CollapsibleContent>
        </Collapsible>

        <div className="flex-1 flex flex-col gap-2 overflow-hidden">
          <Card ref={containerRef} className="flex-1 overflow-hidden shadow-lg rounded-2xl relative">
            <CardContent className="h-full p-0">
              {isLoading && candles.length === 0 ? (
                <div className="h-full w-full flex items-center justify-center">
                  <div className="w-1/2 space-y-4">
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-8 w-1/2" />
                  </div>
                </div>
              ) : candles.length > 0 ? (
                <CandleStickChart
                  candles={candles}
                  markers={markers}
                  playbackIndex={playbackState.currentIndex}
                  isPlaying={playbackState.playing}
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
                  sessionSettings={sessionSettings}
                  settings={settings}
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <p className="text-muted-foreground">Select parameters and load data to begin.</p>
                </div>
              )}
            </CardContent>
             <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
               <Button variant="outline" size="icon" onClick={() => handleJumpTo('start')} disabled={candles.length === 0} aria-label="Jump to Start">
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => handleZoom(0.9)} aria-label="Zoom Out">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => handleZoom(1.1)} aria-label="Zoom In">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => handleJumpTo('end')} disabled={candles.length === 0} aria-label="Jump to End">
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
            {candles.length > 0 && (
              <div className="absolute left-2 top-2 z-10 rounded border bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm">
                {candles.length.toLocaleString()} candles loaded
              </div>
            )}
          </Card>
          {/* <PlaybackControls 
              playbackState={playbackState} 
              setPlaybackState={setPlaybackState} 
              maxIndex={candles.length - 1} 
              disabled={candles.length === 0}
          /> */}
          <Collapsible className="rounded-2xl border bg-card shadow-md">
            <CollapsibleTriggerButton sectionName="Trade Log" />
            <CollapsibleContent>
              <TradeLog tradeLog={displayedTradeLog} />
            </CollapsibleContent>
          </Collapsible>
        </div>
      </main>
    </div>
  );
}
