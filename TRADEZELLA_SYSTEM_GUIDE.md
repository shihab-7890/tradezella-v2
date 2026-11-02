# TradeZella Canvas: Complete System Architecture, Strategy Logic & Configuration Guide

---

## 1. Executive Overview

**TradeZella Canvas** is an institutional-grade algorithmic backtesting, market replay, and visual confluence engine inspired by **ICT (Inner Circle Trader)** and **SMC (Smart Money Concepts)** methodologies. 

The application enables traders to:
1. Replay historical price action at adjustable speeds on a custom high-performance HTML5 canvas.
2. Automatically identify and visualize institutional order flow footprints:
   - Equal Highs/Lows liquidity pools (EQH/EQL)
   - Buy-Side & Sell-Side Liquidity sweeps (BSL/SSL)
   - Market Structure Shifts (MSS)
   - Order Blocks (OB) & Continuation Order Blocks (COB)
   - Fair Value Gaps (FVG) & Institutional Imbalance Zones
   - Breaker Blocks & Mitigation Blocks
   - ICT Power of Three (Accumulation, Manipulation, Distribution / AMD)
   - London and New York Kill Zones & Asian Session Ranges
   - Classic Breakouts and Momentum Spikes
3. Score setups using a **Multi-Timeframe (MTF) Confluence Engine** that evaluates higher-timeframe trends, key levels, displacement ATR, and volume confirmation to generate A+ trade signals with automated Stop-Loss (SL) and Take-Profit (TP) levels.
4. Log and inspect trades in real-time synchronized with replay, with full CSV export capabilities.
5. Optionally employ **Gemini AI reasoning** via Genkit server flows to analyze and filter trade signals.

---

## 2. System Architecture & Tech Stack

```
tradezella-canvas/
├── src/
│   ├── app/
│   │   ├── page.jsx                    # Core page orchestrator & state manager
│   │   ├── layout.jsx                  # Root layout & dark theme config
│   │   ├── globals.css                 # Tailwind base styles & theme tokens
│   │   └── api/
│   │       └── finage/
│   │           ├── route.js            # Finage proxy + resilient simulated market fallback
│   │           └── live/route.js       # Live stream stub
│   ├── components/
│   │   ├── tradezella/
│   │   │   ├── TopBar.jsx              # Symbol, timeframe, date range, session toggles
│   │   │   ├── StrategySettings.jsx    # Complete modular configuration drawer
│   │   │   ├── CandleStickChart.jsx    # High-performance HTML5 Canvas renderer
│   │   │   ├── PlaybackControls.jsx    # Replay engine (play, pause, step, speed)
│   │   │   └── TradeLog.jsx            # Synchronized trade table & CSV exporter
│   │   └── ui/                         # Radix UI + shadcn accessible components
│   ├── lib/
│   │   ├── liquidity.js                # Core Confluence & SMC detection engine (~2100 lines)
│   │   ├── simulatedMarket.js          # Deterministic high-fidelity candle simulator
│   │   └── utils.js                    # Class name merge utilities (clsx + twMerge)
│   ├── services/
│   │   └── finageService.js            # Cached market data client
│   └── ai/
│       ├── genkit.ts                   # Google GenAI Genkit client configuration
│       └── flows/
│           └── trade-signal-analyzer.ts # Server-side Gemini trade analyzer flow
```

---

## 3. Data Pipeline & Resilient Market Engine

### Supported Symbols
- **Precious Metals**: `XAU/USD` (Gold)
- **Forex Majors & Crosses**: `EUR/USD`, `GBP/USD`, `USD/JPY`, `USD/CAD`, `USD/CHF`, `AUD/USD`, `NZD/USD`, `EUR/AUD`, `EUR/CAD`, `EUR/CHF`, `EUR/GBP`, `EUR/JPY`, `EUR/NZD`, `GBP/AUD`, `GBP/CAD`, `GBP/CHF`, `GBP/JPY`, `GBP/NZD`, `AUD/JPY`, `NZD/JPY`, `CAD/JPY`, `CHF/JPY`
- **Crypto**: `BTC/USD`, `ETH/USD`

### Supported Timeframes
`1m`, `2m`, `3m`, `5m`, `10m`, `15m`, `30m`, `1h`, `4h`, `1D`

### High-Fidelity Market Fallback Engine
When external Finage API credentials lack aggregate Forex permissions or encounter limits:
- The backend automatically invokes `generateSimulatedCandles` (`src/lib/simulatedMarket.js`).
- Uses a deterministic mulberry32 pseudo-random seed based on symbol, timeframe, and dates.
- Generates realistic price cycles, trend waves, liquidity sweeps, displacement wicks, and FVGs so all strategies run seamlessly in offline/demo mode.

---

## 4. Signal Detection & Technical Analysis Mechanics

### 4.1 Liquidity Pools (Equal Highs / Equal Lows)
- **Detection**: Scans the `lookback` window for swing highs/lows.
- **Equal Tolerance**: If two or more swing points are within `equalTolerance` percentage of each other, they are grouped into an **Equal Highs Pool (EQH / BSL)** or **Equal Lows Pool (EQL / SSL)**.
- **Visuals**: Displayed as dashed horizontal levels across the chart.

### 4.2 Liquidity Sweeps (SSL & BSL Sweeps)
- **Sell-Side Liquidity (SSL) Sweep Candidate**:
  - Price drops below an EQL pool or recent swing low.
  - The candle wick penetrates below the level, but the **close** of the candle rebounds back **above** the level.
  - **Min Wick Ratio**: Ensures the piercing wick represents at least `minWickRatio` (default 50%) of the candle's total range.
- **Buy-Side Liquidity (BSL) Sweep Candidate**:
  - Price surges above an EQH pool or recent swing high.
  - The candle wick pierces above the level, but the **close** retreats back **below** the level.
- **Qualified Sweeps**: When enabled, additionally requires volume > Volume MA (`volumeMaPeriod`) and wick size > `minQualifiedWickSize`.

### 4.3 Market Structure Shifts (MSS)
- **Bullish MSS**: Following an SSL sweep, the price produces an energetic impulse candle whose close breaks strictly above the highest swing high formed within the sweep formation.
- **Bearish MSS**: Following a BSL sweep, the price produces an impulse candle whose close breaks strictly below the lowest swing low formed within the sweep formation.
- **Confirmation**: If `mssConfirmationRequired: true`, sweep candidates remain unconfirmed until an MSS is validated. Once validated, an approved **BUY** or **SELL** signal is published.

### 4.4 Order Blocks (OB) & Scoring
- **Bullish Order Block**: The lowest bearish candle immediately preceding the bullish displacement that caused an MSS or liquidity sweep.
- **Bearish Order Block**: The highest bullish candle immediately preceding the bearish displacement that caused an MSS or liquidity sweep.
- **Scoring Engine (1 to 5 points)**:
  - Points awarded for displacement size (> ATR), presence of Fair Value Gap directly after the OB, above-average volume, and lack of previous mitigations.
  - When `enableOrderBlockScoring` is enabled, only OBs with score $\ge$ `minObScore` are considered active.

### 4.5 Fair Value Gaps (FVG) & Imbalance Zones
- **Bullish FVG**: 3-candle sequence where Candle 1 High is strictly lower than Candle 3 Low, leaving an untraded gap between the wicks.
- **Bearish FVG**: 3-candle sequence where Candle 1 Low is strictly higher than Candle 3 High.
- **Institutional Imbalance Zones**: When adjacent FVGs occur in close succession, the system merges them into a consolidated high-probability zone (minimum `minFvgsPerZone`).

### 4.6 Sweep + OB + FVG Confluence
- Highest-priority setup (`priority: 10`). Triggered when price sweeps external liquidity, taps an unmitigated Order Block, and fills a Fair Value Gap simultaneously.

### 4.7 Breaker Blocks
- An Order Block that failed (got invalidated by price during a sweep/run) and subsequently acts as flipped support/resistance.
- **Bullish Breaker**: A bearish OB broken upward that now acts as support.
- **Bearish Breaker**: A bullish OB broken downward that now acts as resistance.
- **Confirmation Types**: `Candle Rejection`, `FVG`, or `MSS`.

### 4.8 Mitigation Blocks
- Similar to Breaker Blocks, but formed when price attempts a swing high/low, fails to sweep the prior level (swing failure pattern), and breaks the opposing order block.
- **Confirmation Types**: `Rejection Candle`, `FVG`, or `MSS`.

### 4.9 Continuation Order Blocks (COB + MSS)
- Trend-continuation entries during strong institutional trends.
- Identifies order blocks in the direction of the macro trend with `cobMinBodyPercentage`, optionally requiring LTF MSS confirmation or refined entries.

### 4.10 ICT Power of Three (AMD)
- **Accumulation**: Initial consolidation phase over `powerOfThreeAccumulationLookback` candles.
- **Manipulation (Judas Swing)**: False breakout engineered by institutions to grab liquidity outside the accumulation range.
- **Distribution**: Reversal back through the accumulation range toward target liquidity, generating high R:R distribution entries.

### 4.11 Kill Zones & Session Profiles
- **London Kill Zone**: Default 08:00 - 12:00 GMT (volume-backed liquidity sweeps).
- **New York Kill Zone**: Default 13:00 - 17:00 GMT (morning US session momentum).
- **Asian Session Range**: 00:00 - 08:00 UTC box displayed on chart; establishes initial high/low boundaries for the trading day.

### 4.12 Classic Breakouts & Momentum Spikes
- **Classic Breakout**: Breakout beyond consolidation range lookback, filtered by volume surge and optional retest.
- **Momentum Spike**: Candles with body $\ge$ `bodyPercentageThreshold`, range $\ge$ `minRangeMultiplier` $\times$ ATR, and volume $\ge$ `volumeSurgeFactor` $\times$ Volume MA.

---

## 5. Multi-Timeframe (MTF) Confluence Engine

When `enableMtfEngine` is active:
1. **HTF Data Ingestion**: Concurrently queries higher-timeframe data (`htfTimeframe`, default `4h`).
2. **HTF Trend Analysis**: Evaluates swing structures and EMA slopes on the HTF to determine `Bullish`, `Bearish`, or `Ranging`.
3. **HTF Key Levels**: Identifies major swing highs/lows and significant daily/4H levels.
4. **Confluence Scoring Matrix**:
   - +2 points: Signal direction matches HTF trend.
   - +2 points: Signal is within `keyLevelProximity` (default 0.4%) of an HTF key level.
   - +1 to +2 points: Valid Order Block or FVG confluence.
   - +1 point: Signal occurs inside London or New York Kill Zone.
   - +1 point: Volume exceeds 1.2x Volume Moving Average.
5. **Approval**: Signals with total score $\ge$ `confluenceScoreThreshold` (default 4.0) are marked `isApproved: true`.
6. **Risk Management Calculation**:
   - **Stop Loss (SL)**: Set at the invalidation level (opposite wick of the sweep candle or OB extreme) plus `slBufferPercent` (0.2%).
   - **Take Profit (TP)**: Computed dynamically at `defaultRiskRewardRatio` (default 1:1.5 or 1:2.0), or targeting the next opposing liquidity pool.

---

## 6. Complete Exhaustive Settings Dictionary

### 6.1 Strategy Toggles (Range-Bound & Balanced Markets)
| Setting Key | UI Label | Default | Description |
|---|---|---|---|
| `strategy.liquiditySweep` | Liquidity Sweep | `true` | Enables baseline SSL/BSL liquidity sweep detection. |
| `strategy.breakerBlocks` | Breaker Blocks | `false` | Enables detection and retest trading of failed flipped Order Blocks. |
| `strategy.mitigationBlock` | Mitigation Block | `false` | Enables trading of Mitigation Blocks from swing failure structures. |
| `strategy.institutionalRange` | Institutional Range | `false` | Identifies 50% equilibrium dealing ranges (Discount vs Premium). |
| `strategy.asianRange` | Asian Range | `false` | Enables trading sweeps of the Asian session high/low. |
| `strategy.powerOfThree` | Power Of Three | `false` | Enables ICT Accumulation-Manipulation-Distribution (AMD) setups. |
| `strategy.londonBreakout` | London Breakout | `false` | Enables breakouts of the pre-London range. |

### 6.2 Strategy Toggles (Trend-Following Institutional)
| Setting Key | UI Label | Default | Description |
|---|---|---|---|
| `strategy.obMss` | Ob Mss | `true` | Requires Order Block formation combined with Market Structure Shift. |
| `strategy.fvgImbalance` | Fvg Imbalance | `true` | Detects trade entries upon return to Fair Value Gaps. |
| `strategy.liquidityVoid` | Liquidity Void | `false` | Identifies large directional price runs that must be filled. |
| `strategy.obFvgConfluence` | Sweep + OB + FVG | `true` | Triple confluence setups (Sweep + OB tap + FVG fill). |
| `strategy.cobMss` | Cob Mss | `false` | Continuation Order Block with lower-timeframe MSS confirmation. |
| `strategy.classicBreakout` | Classic Breakout | `false` | Consolidation range breakouts with volume confirmation. |
| `strategy.londonKillzone` | London Killzone | `false` | Restricts valid signals to London Kill Zone hours. |
| `strategy.newYorkKillzone` | New York Killzone | `false` | Restricts valid signals to New York Kill Zone hours. |
| `strategy.momentumSpike` | Momentum Spike | `true` | Identifies high-momentum institutional impulse candles. |

### 6.3 Multi-Timeframe (MTF) Confluence Engine Settings
| Setting Key | UI Label | Default | Description |
|---|---|---|---|
| `enableMtfEngine` | Enable MTF Engine | `true` | Activates higher-timeframe confluence scoring and approval filters. |
| `htfTimeframe` | HTF for Analysis | `'4h'` | Higher timeframe used for trend and key levels (`30m`, `1h`, `4h`, `1D`). |
| `confluenceScoreThreshold` | Confluence Score | `4.0` | Minimum score required for a signal to be approved and traded. |
| `volumeConfirmationGlobal` | Global Volume Filter | `false` | Requires confirmed signals to exhibit $\ge$ 1.2x Volume MA. |
| `minimumDisplacementAtr` | Min Displacement ATR | `0.8` | Minimum displacement candle body size expressed in multiples of ATR. |
| `minCandlesBetweenSignals` | Signal Spacing | `5` | Minimum number of candles required between consecutive signals. |
| `showOnlyHighQuality` | Only A+ Signals | `false` | Displays only signals with a confluence score of 5 or higher. |
| `showSLTP` | Show SL/TP Lines | `false` | Renders dynamic Stop-Loss and Take-Profit price lines on the chart. |
| `keyLevelProximity` | Key Level Proximity (%) | `0.4%` | Maximum percentage distance from HTF key level to award confluence points. |
| `defaultRiskRewardRatio` | Default R:R Ratio | `1.5` | Risk-to-reward ratio used for automatic Take-Profit calculation. |

### 6.4 General & Sweep Detection Parameters
| Setting Key | UI Label | Default | Description |
|---|---|---|---|
| `lookback` | Lookback | `20` | Number of bars used to detect swing highs and swing lows. |
| `minWickRatio` | Min Wick Ratio (%) | `50%` (`0.5`) | Minimum wick size relative to candle range for sweep recognition. |
| `equalTolerance` | Equal Tolerance (%) | `0.2%` (`0.002`) | Maximum price variance between highs/lows to treat them as equal pools. |
| `filterTinySweepsThreshold` | Filter Sweeps Threshold | `0.0` | Minimum pip/price distance required to count a sweep beyond a pool. |
| `mssConfirmationRequired` | MSS Confirmation | `true` | If true, candidates are only confirmed upon a Market Structure Shift. |
| `enableAiTradeSignalAnalyzer` | AI Analyzer | `false` | Sends candidate signals to Gemini via Genkit for AI reasoning. |

### 6.5 ICT Power of Three (AMD) Parameters
| Setting Key | UI Label | Default | Description |
|---|---|---|---|
| `powerOfThreeAccumulationLookback` | Accumulation Lookback | `50` | Number of bars to determine the accumulation range box. |
| `observeManipulation` | Observe Manipulation | `true` | Flags false breakout wicks during manipulation phase. |
| `manipulationLookback` | Manipulation Lookback | `20` | Lookback window for detecting manipulation swings. |
| `manipulationVolumeConfirmation` | Volume Confirmation | `false` | Requires above-average volume on manipulation breakouts. |
| `requireCloseOutsideRange` | Require Close Outside | `false` | Requires candle close outside accumulation box to validate manipulation. |
| `enableDistributionEntries` | Distribution Entries | `true` | Triggers trade entries as price expands in the distribution phase. |
| `distributionEntryLookback` | Entry Lookback | `10` | Retracement window into accumulation range for entry validation. |
| `distributionRiskRewardRatio` | R:R Ratio | `2.0` | Target R:R ratio for distribution expansion targets. |
| `distributionMssConfirmation` | MSS Confirmation | `true` | Requires MSS confirmation before distribution entry. |

### 6.6 Kill Zone Parameters
| Setting Key | UI Label | Default | Description |
|---|---|---|---|
| `londonKzStartTime` | London Start (GMT) | `8` | Start hour for London Kill Zone (08:00 GMT). |
| `londonKzEndTime` | London End (GMT) | `12` | End hour for London Kill Zone (12:00 GMT). |
| `londonKzVolumeConfirmation` | London Volume Conf. | `true` | Requires volume confirmation during London Kill Zone. |
| `newYorkKzStartTime` | NY Start (GMT) | `13` | Start hour for New York Kill Zone (13:00 GMT). |
| `newYorkKzEndTime` | NY End (GMT) | `17` | End hour for New York Kill Zone (17:00 GMT). |
| `newYorkKzVolumeConfirmation` | NY Volume Conf. | `true` | Requires volume confirmation during New York Kill Zone. |

### 6.7 Order Block & Continuation Settings
| Setting Key | UI Label | Default | Description |
|---|---|---|---|
| `enableOrderBlockScoring` | Enable OB Scoring | `true` | Activates institutional quality scoring for order blocks. |
| `minObScore` | Minimum OB Score | `2.0` | Minimum score (out of 5) for an order block to be highlighted and traded. |
| `cobLookbackPeriod` | COB Lookback | `20` | Lookback period to discover Continuation Order Blocks. |
| `cobMinBodyPercentage` | Min COB Body (%) | `50%` (`0.5`) | Minimum body-to-range percentage for valid Continuation OBs. |
| `cobRequireMssConfirmation` | Require MSS Conf. | `true` | Requires lower timeframe MSS for continuation entries. |
| `cobAllowRefinedEntry` | Refined Entry | `false` | Enables entry on secondary LTF OB/FVG for tighter stop loss. |

### 6.8 Breaker & Mitigation Settings
| Setting Key | UI Label | Default | Description |
|---|---|---|---|
| `breakerBlockConfirmation` | Confirmation Type | `'Candle Rejection'` | Options: `Candle Rejection`, `FVG`, `MSS`. |
| `mitigationBlockConfirmation` | Confirmation Type | `'Rejection Candle'` | Options: `Rejection Candle`, `FVG`, `MSS`. |

### 6.9 FVG / Imbalance Settings
| Setting Key | UI Label | Default | Description |
|---|---|---|---|
| `detectInstitutionalImbalanceZones` | Detect Imbalance Zones | `true` | Merges consecutive FVGs into unified institutional zones. |
| `onlyShowZonesAboveThreshold` | Only Zones > Threshold | `false` | Filters display to only zones exceeding minimum FVG count. |
| `minFvgsPerZone` | Min FVGs per Zone | `2` | Minimum number of adjacent FVGs to constitute an imbalance zone. |

### 6.10 Classic Breakout & Momentum Spike Settings
| Setting Key | UI Label | Default | Description |
|---|---|---|---|
| `classicBreakoutLookback` | Consolidation Lookback| `20` | Number of candles to establish consolidation range boundaries. |
| `classicBreakoutVolumeSpike` | Require Volume Spike | `true` | Requires breakout candle volume > volume moving average. |
| `classicBreakoutEnableRetest` | Enable Retest Conf. | `false` | Waits for a pullback retest of the broken level before signaling. |
| `minRangeMultiplier` | Min Range (ATR) | `2.0` | Multiplier of ATR required for a candle to qualify as a momentum spike. |
| `volumeSurgeFactor` | Volume Surge Factor | `1.5` | Multiple of volume MA required for momentum spike confirmation. |
| `bodyPercentageThreshold` | Body % Threshold | `70%` (`0.7`) | Minimum body percentage in move direction to prevent long wicks. |
| `atrPeriod` | ATR Period | `20` | Moving average lookback period for Average True Range. |
| `requireMomentumBreakout` | Require Breakout | `true` | Requires spike candle to break the highest high/lowest low of 10 bars. |
| `momentumEntryType` | Entry Type | `'Close of Spike'` | Options: `Close of Spike`, `Retest of Spike Level`. |

### 6.11 Chart Display Toggles
| Setting Key | UI Label | Default | Visual Effect on Canvas |
|---|---|---|---|
| `showLiquidityPools` | Show Liquidity | `true` | Renders horizontal dotted lines for Equal Highs / Equal Lows. |
| `showSweepWick` | Show Sweep Wick | `true` | Renders circular highlights on candles that swept liquidity pools. |
| `showMss` | Show MSS | `true` | Renders directional triangle markers for Market Structure Shifts. |
| `showOrderBlocks` | Show Order Blocks | `true` | Renders shaded rectangular price zones for unmitigated Order Blocks. |
| `showBreakerBlocks` | Show Breaker Blocks | `true` | Renders shaded rectangular zones for Breaker Blocks. |
| `showMitigationBlocks`| Show Mitigation Blocks | `true` | Renders shaded zones for Mitigation Blocks. |
| `showFvgs` | Show FVG | `true` | Renders colored gap boxes for Fair Value Gaps. |
| `showAsianRange` | Show Asian Range | `true` | Renders the 00:00 - 08:00 UTC Asian session boundary box. |
| `showHtfTrends` | Show HTF Trend | `true` | Displays badge indicating higher-timeframe trend (Bullish/Bearish). |
| `showHtfKeyLevels` | Show HTF Key Levels | `true` | Renders major HTF support and resistance horizontal bands. |
| `showCandidateOnlyMarkers`| Show Candidates | `false` | Shows unconfirmed sweep candidate markers before MSS confirmation. |

---

## 7. Interactive Canvas & Playback Controls

- **Hardware Accelerated HTML5 Canvas (`CandleStickChart.jsx`)**:
  - Automatically handles device pixel ratio (HiDPI / Retina screens).
  - Virtual coordinates with horizontal panning (drag to pan) and zoom (mouse wheel or Zoom In/Out buttons).
  - Hover crosshair displaying exact timestamp, open, high, low, close, and volume.
- **Playback Controls (`PlaybackControls.jsx`)**:
  - **Play / Pause**: Starts/stops automated candle-by-candle stepping.
  - **Speed Slider**: Controls playback rate from 0.5 candles/sec up to 10 candles/sec.
  - **Step Backward / Step Forward**: Move one candle at a time for precise review.
  - **Jump to Start / Jump to End**: Instantly seek to the beginning or latest candle.

---

## 8. In-Memory Trade Log & Export

- **Live Synchronization**: As playback progresses, only trades detected up to the current playback candle are displayed in the trade log table.
- **Table Metrics**:
  - `Time`: Human-readable date and time.
  - `Type`: Signal classification (`BUY confirmed`, `SELL confirmed`, `SSL candidate`, `BSL candidate`).
  - `Price`: Execution price level.
  - `Timeframe`: Selected bar interval.
  - `Score`: Confluence score (0.0 to 10.0 scale).
  - `Quality Tier`: `A+` ($\ge 5.0$), `A` ($4.0 - 4.9$), `B` ($3.0 - 3.9$).
  - `Strategy`: Triggering strategy setup name.
  - `Notes`: Contextual details (e.g., HTF Trend aligned, OB tap, FVG filled, Kill Zone active).
- **Export CSV**: Generates a standard RFC 4180 CSV spreadsheet file directly in the browser.

---

## 9. AI Trade Signal Analyzer (Genkit + Gemini)

- **File**: `src/ai/flows/trade-signal-analyzer.ts`
- **Execution Flow**:
  1. Triggered when `enableAiTradeSignalAnalyzer: true` is toggled.
  2. Packages candle history, detected equal pools, sweep candidates, and strategy thresholds into structured JSON.
  3. Sends prompt to Gemini (`googleai/gemini-2.5-flash`).
  4. Returns filtered candlestick data and synthesized trade commentary adhering to `AnalyzeTradeSignalsOutputSchema`.
