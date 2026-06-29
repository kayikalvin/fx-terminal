# FX Research Terminal — Project Overview (v2)

## What we're building

A **professional-grade forex research terminal** that runs entirely in the browser. It's free, open-source, and designed to help you **understand markets, not predict them**. Every indicator, chart, and model output comes with plain-English explanations and honest caveats.

The terminal now connects directly to **MetaTrader 5** (demo or live) via a small local bridge server, instead of relying on free web APIs (Finnhub, Yahoo Finance, Stooq). This gives us real-time bid/ask prices, full OHLC history, and optional trade execution — without third-party rate limits or CORS issues.

---

## Core philosophy

- **Describe, don't predict** — we show what *has* happened, not what *will* happen.
- **Free and open** — no paid APIs, no subscriptions. MT5 demo accounts are free.
- **Educational by design** — every number is explained; the ML model shows exactly which features drove its output, and is honest about how reliable (or unreliable) that output is.
- **Modular** — React components, swappable data providers, separate Python ML pipeline.
- **Self-aware about its own limits** — confidence and calibration are treated as first-class outputs, not an afterthought.

---

## Architecture

```
 MetaTrader 5 (running on your computer)
        │
        ▼
 Python Bridge Server (FastAPI + MetaTrader5 package)
        │   exposes REST endpoints on localhost:8000
        │   - live bid/ask
        │   - historical OHLC (any timeframe)
        │   - account info
        │   - /health heartbeat (NEW)
        │
        ▼
 React Frontend (browser)
        │   calls localhost:8000 instead of Yahoo Finance
        │   Dashboard, Charts, Backtester, ML, Journal, etc.
```

No internet-dependent APIs for price data. Everything comes from your own MT5 terminal.

### Bridge reliability (new considerations)

- **`/health` endpoint** — lightweight heartbeat the frontend polls so the UI can show a live "Bridge: Connected / Disconnected" indicator. If MT5 terminal closes or the bridge crashes, the user sees it immediately instead of staring at stale numbers.
- **Tiered polling intervals** — not everything needs the same refresh rate:
  - Live price ticks: ~1s
  - Indicators (RSI, SMA, ATR): ~30s
  - Correlation / strength meter: on-demand or every few minutes
- **Explicit timezone handling** — MT5 server time is broker-specific (often UTC+2/+3, with its own DST rules). This is a classic silent-bug source for daily OHLC bars and backtests, so it's pinned down explicitly in `mt5Provider` and documented rather than assumed.

---

## Features

- **Dashboard** — Live price cards with VWAP, ATR, RSI, SMA crossover, and momentum. Real-time updates via polling MT5. Selecting a pair here sets the active context for the rest of the app (see "Unified pair context" below).
- **Alerts** — Price, RSI, and MA-crossover alerts with desktop notifications.
- **Charts** — Candlestick chart with SMA 20/50 overlays (Lightweight Charts), data sourced from MT5.
- **Correlation** — 20-day Pearson matrix between active pairs.
- **Currency Strength Meter** — Average % change per currency.
- **Backtester** — Rule-based strategy testing with full statistics (Sharpe, drawdown, win rate). Exports a training dataset (CSV) for ML. Now includes **walk-forward / out-of-sample validation** (moved up in priority — see Roadmap).
- **News & COT** — Macro news (Finnhub), economic calendar, CFTC COT positioning, Macro Surprise Index.
- **ML Research** — Import a pre-trained logistic regression model and get live predictions with feature contributions, calibration context, and plain-English explanations (see below).
- **Trading Journal (new)** — Local log of trades and predictions, so the model's real-world track record is visible over time, not just its training-time metrics.
- **Settings** — Store MT5 server URL, Finnhub key (news only), and other preferences.

### Unified pair context

A single "selected pair" context drives every page — clicking a pair on the Dashboard automatically focuses Charts, Correlation, and ML Research on it, and surfaces cross-links like "see this pair's correlation matrix" or "see backtest results for a momentum strategy on this pair." This turns the terminal from a set of separate tools into one coherent research workflow.

---

## The Machine Learning Model — what it actually does

The ML model **does not predict prices or give trading signals**. It answers one specific research question:

> "Based on today's technical indicators, what is the probability that tomorrow's closing price will be higher than today's?"

It produces:

- **A probability** (e.g., "62% bullish") — not a buy/sell recommendation, just a numerical estimate derived from historical patterns.
- **A confidence level** — "High" if the probability is strongly skewed (>70% or <30%), "Medium" otherwise.
- **Feature contributions** — which indicators pushed the probability up or down the most (e.g., "momentum contributed +0.028 to bullishness").
- **A plain-English explanation (new)** — feature contributions are translated into a template sentence, e.g. *"Momentum is unusually high for this pair right now, which historically preceded up-days slightly more often."* The math stays visible, but it's no longer the only explanation offered.
- **A calibration check (new)** — alongside accuracy and ROC AUC, the ML Research page shows whether predicted probabilities actually match historical outcome frequencies (e.g., do "70% bullish" calls actually resolve bullish ~70% of the time?). This is what separates an honest research tool from a model that just sounds confident.
- **A visual decision boundary (new)** — a simple 2D scatter (e.g., RSI vs. momentum) showing where today's data point falls relative to the model's boundary, so the probability has a spatial, intuitive anchor rather than being just a number.

**What it is NOT:**

- It does not predict the exact price.
- It does not tell you when to enter or exit.
- It is not always right — the current model has ~57% accuracy and a ROC AUC of ~0.56, only slightly better than a coin flip. This is normal for daily FX directional prediction.

**Why we include it:**

- To learn about machine learning in finance.
- To see which technical indicators might be useful.
- To understand the limitations of such models (low accuracy, overfitting, look-ahead bias).
- **Never** to trade blindly.

**Tracking real-world performance (new):** every prediction the model makes is logged (date, pair, predicted probability, eventual outcome) in the Trading Journal. Over time this builds a personal, honest track record of the model — far more convincing, or humbling, than a static training-time AUC figure.

---

## The ML Pipeline (Python)

1. Download historical OHLC from MT5 (via the bridge) or from CSV files.
2. Run `ml/train.py` — builds features, trains multiple models, and exports the best logistic regression model as `model.json`.
3. Import that JSON into the React terminal's ML Research page.
4. For any pair on the Dashboard, click "Predict" to see the probability, feature contributions, plain-English explanation, and calibration context.

---

## Project structure

```
fx-terminal/
├── src/
│   ├── components/   (Dashboard, Alerts, Charts, Journal, etc.)
│   ├── services/     (mt5Provider, finnhubStream, indicators, featureEngine)
│   ├── context/      (AppContext — single source of truth for selected pair)
│   ├── App.jsx
│   └── index.css
├── mt5-server/
│   ├── server.py     (FastAPI bridge to MT5, includes /health)
│   └── requirements.txt
├── ml/
│   ├── data/raw/     (training CSVs)
│   ├── src/          (config, feature_engineering, models, evaluation, calibration)
│   ├── train.py
│   ├── exports/      (model.json)
│   └── requirements.txt
└── package.json
```

---

## Roadmap

1. **Finish MT5 integration** — complete the bridge server, including `/health`, and update the React frontend to use it as the sole data source.
2. **Walk-forward backtesting** — proper out-of-sample validation; moved up because it directly strengthens the credibility of every ML claim in the app.
3. **Trading Journal** — log trades and predictions locally; shares its data store with the prediction-logging feature above.
4. **Risk Calculator** — position sizing, Kelly criterion.
5. **Monte Carlo Simulator** — simulate equity paths from backtest results.
6. **Advanced ML** — explore gradient boosting, LSTM (with browser-compatible export).

---

## Bottom line

We're not building a crystal ball. We're building a **research cockpit** that puts professional-grade analytics — and the honesty to show their limits — at your fingertips, for free, so you can make more informed decisions, understand the tools, and never be misled by a black-box prediction.