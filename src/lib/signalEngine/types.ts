export type SignalDirection = 'BUY' | 'SELL';
export type SignalQualityTier = 'A+' | 'A' | 'B' | 'Candidate' | 'Suppressed';

export interface TradingSignal {
  id: string;                     // Deterministic stable ID
  symbol?: string;
  timeframe?: string;
  strategy: string;               // e.g. 'liquiditySweep', 'obMss', 'momentumSpike'
  direction: SignalDirection;     // 'BUY' | 'SELL'
  type: string;                   // 'BUY confirmed' | 'SELL confirmed' | 'SSL candidate' | 'BSL candidate'
  time: number;                   // Confirmation / Decision timestamp (when signal closed and confirmed)
  price: number;                  // Entry price
  setupTime?: number;             // Timestamp of pattern formation / sweep
  confirmationTime: number;       // Timestamp when confirmation condition was met
  setupId?: string;               // Physical pattern cluster ID for deduplication
  score: number;                  // Confluence score (0 to 10)
  isApproved: boolean;            // Approved by quality and threshold
  qualityTier: SignalQualityTier;
  reasons: string[];              // Explainable factor breakdown
  notes: string;
  sl?: number | null;
  tp?: number | null;
  riskReward?: number | null;
  invalidationPrice?: number | null;
  confirmations?: string[];       // Other strategies confirming this setup
  mssIndex?: number;
  hiddenByQualityFilter?: boolean;
}

export interface HtfTrendState {
  direction: 'BULLISH' | 'BEARISH' | 'Ranging';
  confidence: number;
  lastHtfClose?: number;
  emaValue?: number;
}

export interface HtfKeyLevel {
  price: number;
  type: 'support' | 'resistance';
  time: number;
}

export interface SignalEngineDiagnostics {
  symbol: string;
  timeframe: string;
  totalCandles: number;
  rawBuyCandidates: number;
  rawSellCandidates: number;
  confirmedBuySetups: number;
  confirmedSellSetups: number;
  approvedBuy: number;
  approvedSell: number;
  duplicatesSuppressed: number;
  rejectedByScore: number;
  rejectedByQualityFilter: number;
  strategyBreakdown: Record<string, { buy: number; sell: number; approved: number }>;
  rejectionReasons: Record<string, number>;
  htfTrendBreakdown: { bullishBars: number; bearishBars: number; rangingBars: number };
}
