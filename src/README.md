# Backtesting Engine: Strategy Logic & Analysis Manual

This document provides the internal logic and institutional rationale for the TradeZella Canvas strategy engine. It focuses on how market structure, liquidity, and volume are analyzed to generate high-probability signals.

---

## The Core Logic: "Smart Money" Footprints

The engine is programmed to ignore standard retail indicators and instead focus on the "footprints" left by institutional order flow.

### 1. Market Structure Shift (MSS) Detection
The engine identifies shifts in momentum by tracking swing highs and lows. An **MSS** is confirmed when price breaks the *previous significant swing point* in the opposite direction of the sweep. This is the primary "Trigger" for most institutional entries.

### 2. Qualified Liquidity Analysis
Not all liquidity pools are equal.
- **Level 1 (Standard)**: Two touches. Represents minor retail interest.
- **Level 2 (Qualified)**: Three or more touches. Represents a "Major Liquidity Pool" where significant buy/sell stops are resting. These levels are drawn as **solid lines** and are prioritized by the Confluence Matrix.

### 3. Momentum & Volatility (The "Ignition")
The **Momentum Spike** strategy calculates the statistical probability of a move being institutional:
- **Volatility Filter**: The candle range must exceed 2.0x the Average True Range (ATR).
- **Commitment Filter**: The candle must have at least 70% "body" relative to its range, proving that the price did not reject.
- **Volume Confirmation**: Volume must be 1.5x higher than the recent average.

### 4. Zone Clustering (Institutional Imbalance)
Single Fair Value Gaps (FVGs) can be noisy. The engine uses a **Clustering Algorithm** to group adjacent FVGs into **Institutional Imbalance Zones (IZ)**. These zones act as magnets for price and are much higher-probability re-entry points than single gaps.

### 5. Session-Specific Dynamics (The "Kill Zones")
Price behavior changes based on time.
- **Asian Session**: Typically identifies as a "Consolidation" or "Accumulation" range.
- **London/NY Kill Zones**: The engine specifically hunts for **Liquidity Raids** of the Asian highs/lows during these windows, as institutions use the session opens to engineer the "Manipulation" phase of the Power of Three.

---

## Strategy Confluence Mapping

The **Confluence Matrix** uses the following scoring weights to filter signals:

| Factor | Score Weight | Institutional Rationale |
| :--- | :--- | :--- |
| **HTF Trend Alignment** | +2.0 | Trading with the macro order flow. |
| **HTF Key Level Proximity** | +1.5 | Price is reacting at a major Daily/4H level. |
| **Institutional Imbalance (FVG)** | +1.0 | Price is re-balancing an inefficiency. |
| **Order Block / Breaker / MB** | +0.5 | Price is re-testing an institutional footprint. |
| **Counter-HTF Trend** | -2.0 | High risk; trading against institutional bias. |

---

## Risk & Position Analysis

Every approved signal includes an automatic risk assessment:
- **Stop Loss (SL)**: Set exactly beyond the invalidation point (the sweep wick extreme or the edge of the Order Block).
- **Take Profit (TP)**: Calculated based on the user's desired **Risk-to-Reward (R:R)** ratio (default 1.5 - 2.0), often targeting the next major liquidity pool.
