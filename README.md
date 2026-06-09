# TradeZella Canvas

TradeZella Canvas is a Next.js market analysis and institutional backtesting interface. It loads historical OHLCV candles from Finage, renders them on an HTML5 canvas, runs liquidity and smart-money strategy detectors, scores signals with a multi-timeframe confluence engine, and shows chart overlays plus a trade log.

This README explains the current application behavior, especially what happens after the app starts and which features are active by default.

---

## Quick Start

Install dependencies:

```bash
npm install
```

Start the Next.js app:

```bash
npm run dev
```

The app runs on:

```text
http://localhost:9002
```

Optional Genkit development server for the AI flow:

```bash
npm run genkit:dev
```

Other scripts:

```bash
npm run build
npm run start
npm run lint
npm run typecheck
```

---

## Environment Variables

The Finage API proxy reads:

```bash
FINAGE_API_KEY=your_finage_key
```

The route currently also contains a fallback key in code, but production usage should rely on `.env` instead.

The Genkit AI flow uses Google AI through `@genkit-ai/googleai`. If you run the Genkit flow, configure the required Google AI credentials in your environment.

---

## What Happens After `npm run dev`

1. Next.js starts with Turbopack on port `9002`.
2. The root page at `src/app/page.jsx` renders the trading workspace.
3. Initial state is created with:
   - Symbol: `XAU/USD`
   - Timeframe: `15m`
   - Date range: last 30 days through today
   - Session overlay: enabled
   - Multi-timeframe confluence engine: enabled
4. On first mount, the page automatically calls `handleFetchData()`.
5. `handleFetchData()` requests:

```text
/api/finage?symbol=XAU/USD&timeframe=15m&start=<date>&end=<date>
```

6. The Next.js API route at `src/app/api/finage/route.js` validates query parameters, maps the selected timeframe to a Finage interval, requests historical candles from Finage, and returns normalized candle data:

```js
{
  candles: [
    { time, open, high, low, close, volume }
  ]
}
```

7. After candles are loaded, the app sets the playback index to the last candle.
8. A second effect runs `runConfluenceEngine(candles, settings, config)`.
9. Because the MTF engine is enabled by default, the engine fetches higher-timeframe candles through `src/services/finageService.js`.
10. HTF trend and HTF key levels are calculated.
11. All enabled strategy modules scan the candle data and produce potential signals plus visual zones.
12. Potential signals are scored by the confluence engine.
13. Approved signals receive score, notes, stop loss, and take profit.
14. The canvas redraws with candles, overlays, markers, HTF labels, and session bands.
15. The trade log displays available signals up to the current playback index. Since the current index is set to the end after load, the log normally shows the full loaded period immediately.

---

## Main UI Areas

### Configuration

Implemented in `src/components/tradezella/TopBar.jsx`.

Controls:

- Symbol selector
- Timeframe selector
- Date range picker
- Load Data button
- Session Overlay popover

Supported symbols include gold, major forex pairs, BTC/USD, and ETH/USD.

Supported timeframes:

- `1m`
- `2m`
- `3m`
- `5m`
- `10m`
- `15m`
- `30m`
- `1h`
- `4h`
- `1D`

### Strategy Settings

Implemented in `src/components/tradezella/StrategySettings.jsx`.

This panel controls strategy enablement, visual overlays, confluence scoring, risk settings, session filters, and detection thresholds. Most switches immediately update local React state. When settings change and candles are already loaded, the confluence engine reruns automatically.

### Chart

Implemented in `src/components/tradezella/CandleStickChart.jsx`.

The chart uses canvas rendering for candles and overlays. It supports:

- Drag-to-pan
- Mouse wheel zoom
- Touch pan
- Pinch zoom
- Crosshair tooltip
- Jump to start
- Jump to end
- Zoom in
- Zoom out

### Trade Log

Implemented in `src/components/tradezella/TradeLog.jsx`.

The log shows:

- Time
- Type
- Price
- Timeframe
- Notes

It can export the visible log to `trade_log.csv`.

---

## Features Active By Default

These strategies are enabled on initial load:

- Liquidity Sweep
- OB + MSS
- FVG Imbalance
- Sweep + OB + FVG Confluence
- Momentum Spike

These strategies are present but disabled by default:

- Breaker Blocks
- Mitigation Block
- Institutional Range
- Asian Range
- Liquidity Void
- Continuation OB + MSS
- London Kill Zone
- New York Kill Zone
- Power of Three
- London Breakout
- Classic Breakout

---

## Default Engine And Filter Settings

General defaults:

- Lookback: `20`
- Minimum wick ratio: `0.5`
- Equal high/low tolerance: `0.002`
- Tiny sweep threshold: `0`
- MSS confirmation required: `true`
- Candidate-only markers visible: `false`
- Show only A+ signals: `false`
- AI analyzer switch: `false`

Multi-timeframe confluence defaults:

- MTF engine: enabled
- HTF trend display: enabled
- HTF key levels display: enabled
- HTF timeframe: `4h`
- Confluence score threshold: `4`
- Key level proximity: `0.004`
- Default risk/reward ratio: `1.5`
- Global volume confirmation: disabled
- Minimum displacement ATR: `0.8`
- Minimum candles between approved signals: `5`

Qualified sweep defaults:

- Qualified sweep filters: disabled
- Minimum qualified wick size: `0.6`
- Volume confirmation: enabled
- Volume MA period: `20`

Order block defaults:

- OB scoring: enabled
- Minimum OB score: `2`

FVG defaults:

- Institutional imbalance zones: enabled
- Minimum FVGs per zone: `2`
- Only show zones above threshold: disabled

Session defaults:

- Session overlay: enabled
- Asia: enabled
- London: enabled
- New York: enabled
- Overlaps: enabled

Kill zone defaults use UTC/GMT hours:

- London: `8` to `12`
- New York: `13` to `17`
- Volume confirmation enabled for both

---

## Display Overlays Active By Default

Enabled:

- Liquidity pools
- Sweep wick markers
- MSS markers
- Order blocks
- Breaker block display
- Mitigation block display
- FVG display
- Asian range display
- HTF trend label
- HTF key levels
- Candidate markers

Disabled:

- SL/TP lines

Note: some display toggles can be enabled while the underlying strategy is disabled. In that case, no related zones appear until the strategy creates data.

---

## Confluence Engine Flow

Implemented in `src/lib/liquidity.js`.

When `enableMtfEngine` is enabled:

1. Fetch higher-timeframe candles for the selected symbol and date range.
2. Calculate HTF trend using a 20-period EMA.
3. Identify HTF support and resistance from swing highs and swing lows.
4. Run enabled strategy detectors.
5. Collect potential BUY, SELL, candidate, sweep, zone, and block outputs.
6. Score each signal.
7. Approve signals that meet or exceed `confluenceScoreThreshold`.
8. Calculate SL and TP for approved signals.
9. Return a complete `analysisResult` for chart rendering and trade log display.

If HTF candles cannot be fetched, the app falls back to legacy analysis without HTF confluence.

If `enableMtfEngine` is disabled, the app skips HTF fetching and scoring and directly returns strategy outputs.

---

## Signal Scoring

Current scoring weights:

| Factor | Score |
| --- | ---: |
| Signal aligned with HTF trend | `+2.0` |
| Signal against HTF trend | `-2.0` |
| Signal near matching HTF support/resistance | `+1.5` |
| Signal notes include FVG confluence | `+1.0` |
| Signal notes include OB, Breaker, COB, or Mitigation | `+0.5` |

A signal is approved when:

```js
score >= settings.confluenceScoreThreshold
```

The default threshold is `4`.

---

## Risk Management

Approved signals receive automatic risk values:

- BUY stop loss is placed below the recent swing low.
- SELL stop loss is placed above the recent swing high.
- The stop includes `slBufferPercent`, default `0.002`.
- Take profit is calculated from the selected risk/reward ratio.
- Power of Three distribution signals use `distributionRiskRewardRatio`, default `2`.

SL/TP values exist in approved signal data. Lines only appear on the chart when `showSLTP` is enabled.

---

## Strategy Summary

### Liquidity Sweep

Detects equal highs/lows and stop-hunt candles. A BSL sweep happens when price trades above a prior high range and closes back below it. An SSL sweep happens when price trades below a prior low range and closes back above it. MSS confirmation can turn a sweep into a confirmed BUY or SELL signal.

### OB + MSS

Finds order blocks and waits for market structure shift confirmation. OB scoring can filter weak blocks.

### Mitigation Block

Finds displacement from an opposing candle and watches for a mitigation retest. Confirmation can be rejection candle, FVG, or MSS.

### Breaker Block

Detects failed order blocks that flip into support or resistance. This strategy exists but is disabled by default.

### Institutional Range

Builds a dealing range from major swing points and identifies premium, discount, and equilibrium zones. This strategy exists but is disabled by default.

### Asian Range

Builds Asian session range boxes and can detect sweeps after the range forms. This strategy exists but is disabled by default.

### FVG Imbalance

Detects fair value gaps and can merge nearby gaps into institutional imbalance zones.

### Liquidity Void

Finds large displacement candles and watches for later re-entry into the void.

### Sweep + OB + FVG Confluence

Combines liquidity sweep, displacement, order block, FVG, and retest logic into a higher confluence setup.

### Continuation OB + MSS

Finds continuation order blocks inside trend conditions and optionally requires MSS confirmation.

### London Kill Zone

Scans for sweeps and MSS confirmations during configured London UTC/GMT hours.

### New York Kill Zone

Scans for sweeps and MSS confirmations during configured New York UTC/GMT hours.

### Power of Three

Detects accumulation, manipulation, and distribution phases. It can show manipulation zones and produce distribution entries.

### London Breakout

Detects breakouts from Asian range conditions during the London window. This strategy exists but is disabled by default.

### Classic Breakout

Detects consolidation ranges and breakout candles, with optional volume spike and retest confirmation.

### Momentum Spike

Detects volatility expansion with volume surge and directional candle commitment. It can enter on the spike close or wait for a retest.

---

## Playback Status

`src/components/tradezella/PlaybackControls.jsx` implements play, pause, step, reset, seek, and speed controls.

In the current root page, the playback component is commented out. Because of that:

- The app does not show playback controls in the visible UI.
- After data load, `currentIndex` is set to the last candle.
- The trade log usually shows all signals for the loaded date range immediately.
- Marker rendering still respects `playbackIndex`, but that index starts at the end after loading.

To reactivate playback, uncomment the `PlaybackControls` block in `src/app/page.jsx`.

---

## AI Analyzer Status

The Genkit AI flow exists at:

```text
src/ai/flows/trade-signal-analyzer.ts
```

It defines `analyzeTradeSignals()` and can filter candles/signals when `enableAiTradeSignalAnalyzer` is true.

Current app status:

- The AI analyzer switch exists in Strategy Settings.
- The Genkit flow can be loaded with `npm run genkit:dev`.
- The main confluence engine currently does not call `analyzeTradeSignals()`, so toggling AI in the UI does not change chart analysis unless the flow is wired into the runtime path.

---

## API Routes

### `GET /api/finage`

File:

```text
src/app/api/finage/route.js
```

Required query parameters:

- `symbol`
- `timeframe`
- `start`
- `end`

Behavior:

- Validates required parameters.
- Maps UI timeframe values to Finage API intervals.
- Formats symbols by removing `/` and lowercasing.
- Calls the Finage aggregate forex endpoint.
- Returns normalized candle data.
- Returns JSON errors for missing params, invalid timeframe, Finage errors, or proxy failures.

### `GET /api/finage/live`

File:

```text
src/app/api/finage/live/route.js
```

This route currently returns `501 Not Implemented`, so live-data functionality is reserved but not active yet.

---

## Important Files

| File | Purpose |
| --- | --- |
| `src/app/page.jsx` | Root trading workspace, state, startup fetch, analysis trigger |
| `src/app/api/finage/route.js` | Server-side Finage historical data proxy |
| `src/services/finageService.js` | Client helper used by the MTF engine to fetch HTF candles |
| `src/lib/liquidity.js` | Confluence engine and strategy detection logic |
| `src/components/tradezella/TopBar.jsx` | Symbol, timeframe, date, and session controls |
| `src/components/tradezella/StrategySettings.jsx` | Strategy, display, filter, and scoring controls |
| `src/components/tradezella/CandleStickChart.jsx` | Canvas rendering, chart overlays, zoom, pan, crosshair |
| `src/components/tradezella/TradeLog.jsx` | Signal table and CSV export |
| `src/components/tradezella/PlaybackControls.jsx` | Playback controls, currently not rendered |
| `src/ai/flows/trade-signal-analyzer.ts` | Genkit AI trade signal analysis flow |
| `docs/blueprint.md` | Original app blueprint |
| `src/README.md` | Strategy logic notes |

---

## Current Limitations

- Playback controls are implemented but not visible because they are commented out.
- The AI analyzer is defined but not wired into the main chart analysis path.
- `/api/finage/live/route.js` is a reserved route that returns `501 Not Implemented`.
- Trade log data is in-memory only; it resets when the page reloads.
- Session overlay preferences are saved in browser `localStorage`, but strategy settings are not persisted.
- The chart depends on successful Finage responses for both base timeframe candles and HTF candles when MTF confluence is enabled.

---

## Typical User Flow

1. Start the app with `npm run dev`.
2. Open `http://localhost:9002`.
3. Wait for the default XAU/USD 15m data to load.
4. Review the HTF trend label and key levels.
5. Open Strategy Settings and enable or disable strategies.
6. Adjust confluence score, risk/reward, kill-zone hours, or detection filters.
7. Use zoom, pan, jump start, and jump end to inspect the chart.
8. Open the Trade Log to review approved and candidate signals.
9. Export CSV if you need the current log outside the app.
