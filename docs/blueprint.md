# **App Name**: TradeZella Canvas

## Core Features:

- Candlestick Rendering: Display historical candlestick data fetched from Finage on an HTML5 canvas, ensuring smooth, high-performance rendering.
- Playback Controls: Implement interactive playback controls (Play/Pause, Speed, Step, Jump) for navigating the candlestick data.
- Responsive UI Layout: Design a responsive UI with symbol, timeframe, and date range selectors in the top bar, and strategy settings fixed above the chart.
- Finage API Proxy: Proxy Finage API requests via a Next.js API route to protect the API key, handling rate limits and errors gracefully.
- In-Memory Trade Log: Maintain an in-memory trade log that updates live during playback, with an option to export the log as a CSV file.
- Trade Signal AI Reasoning: Employ an AI to serve as a tool, analyzing candle patterns in playback mode and displaying only relevant trade data to the user. This leverages AI as a "tool" by reasoning to decide which candles are appropriate to be flagged and incorporated.
- Liquidity Sweep Detection: Detect liquidity sweeps and MSS confirmations, displaying visual markers on the canvas (lines, arrows) only when triggered during playback. Include toggle to show 'candidate-only' markers for rapid experimentation

## Style Guidelines:

- Primary color: A muted blue (#6699CC) for a calm, professional feel. This evokes a sense of stability and trust, important for a trading application.
- Background color: A light gray (#F0F0F0) to provide a clean, neutral backdrop that allows the candlestick patterns to stand out clearly.
- Accent color: A vibrant orange (#FF851B) to highlight interactive elements and important signals. It adds energy and attracts attention to key actions.
- Body and headline font: 'Inter', a grotesque-style sans-serif for a modern, machined, objective, neutral look.
- Use crisp, scalable vector icons to represent playback controls, settings, and other UI elements.
- Employ a clear, modular layout with the top bar for data selection, strategy settings above the chart, the canvas chart in the center, playback controls below, and the trade log at the bottom.
- Subtle, performant animations (CSS transitions, canvas translate) for UI elements and candlestick rendering to provide a smooth, responsive user experience.