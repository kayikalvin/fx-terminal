import { useRef, useEffect, useState, useCallback } from "react";
import { createChart } from "lightweight-charts";
import { useAppContext } from "../context/AppContext";
import { fetchHistoricalOHLC } from "../services/dataProviders";

/* ─── timeframes ─────────────────────────────────────────────────────────── */
const TIMEFRAMES = [
  { label: "1m",  value: "M1"  },
  { label: "5m",  value: "M5"  },
  { label: "15m", value: "M15" },
  { label: "1H",  value: "H1"  },
  { label: "4H",  value: "H4"  },
  { label: "1D",  value: "D"   },
];

const POLL_INTERVAL_MS = {
  M1: 5000, M5: 15000, M15: 30000, H1: 60000, H4: 60000, D: 60000,
};

/* ─── indicator math ──────────────────────────────────────────────────────── */
function average(v) { return v.reduce((a, b) => a + b, 0) / v.length; }

function computeSMA(ohlc, p) {
  const c = ohlc.map(d => d.close);
  const out = [];
  for (let i = p - 1; i < c.length; i++)
    out.push({ time: ohlc[i].time, value: average(c.slice(i - p + 1, i + 1)) });
  return out;
}

function computeATR(ohlc, p = 14) {
  if (ohlc.length < p + 1) return null;
  const trs = [];
  for (let i = 1; i < ohlc.length; i++) {
    const cur = ohlc[i], prev = ohlc[i - 1];
    trs.push(Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close)));
  }
  return average(trs.slice(-p));
}

function computeRSI(ohlc, period = 14) {
  const closes = ohlc.map(d => d.close);
  if (closes.length <= period) return [];
  let gains = 0, losses = 0;
  const rsi = [];
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  rsi.push({ time: ohlc[period].time, value: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss) });
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push({ time: ohlc[i].time, value: 100 - 100 / (1 + rs) });
  }
  return rsi;
}

/* ─── lightweight-charts theme (mirrors CSS variables as literals) ────────── */
const CHART_THEME = {
  layout:          { background: { color: "#111827" }, textColor: "#7A859E" },
  grid:            { vertLines: { color: "#1E2D45" },  horzLines: { color: "#1E2D45" } },
  rightPriceScale: { borderColor: "#1E2D45" },
  timeScale:       { borderColor: "#1E2D45", timeVisible: true, secondsVisible: false },
  crosshair:       { mode: 1 },
};

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const fmt = (n, d = 5) => n == null ? "—" : Number(n).toFixed(d);

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function Charts() {
  const { activePairs, pairData, setPairData } = useAppContext();
  const [selectedPair, setSelectedPair] = useState("");
  const [timeframe, setTimeframe]       = useState("D");
  const [liveEnabled, setLiveEnabled]   = useState(true);
  const [hoverInfo, setHoverInfo]       = useState(null);
  const [latestStats, setLatestStats]   = useState(null);
  const [loadError, setLoadError]       = useState(null);
  const [isLoading, setIsLoading]       = useState(false);

  const chartContainerRef = useRef(null);
  const rsiContainerRef   = useRef(null);
  const chartRef          = useRef(null);
  const rsiChartRef       = useRef(null);
  const seriesRef         = useRef({ candle: null, vol: null, sma20: null, sma50: null, rsi: null, overbought: null, oversold: null });
  const pollRef           = useRef(null);
  const ohlcRef           = useRef([]);
  const resizeObserverRef = useRef(null);

  const cacheKey = (pair, tf) => `${pair}_${tf}`;

  /* ── chart lifecycle ──────────────────────────────────────────────────────── */
  const destroyChart = useCallback(() => {
    if (resizeObserverRef.current) { resizeObserverRef.current.disconnect(); resizeObserverRef.current = null; }
    if (chartRef.current)    { chartRef.current.remove();    chartRef.current = null; }
    if (rsiChartRef.current) { rsiChartRef.current.remove(); rsiChartRef.current = null; }
    seriesRef.current = { candle: null, vol: null, sma20: null, sma50: null, rsi: null, overbought: null, oversold: null };
  }, []);

  const buildChart = useCallback(() => {
    const container    = chartContainerRef.current;
    const rsiContainer = rsiContainerRef.current;
    if (!container || !rsiContainer) return;
    destroyChart();

    const chart = createChart(container, {
      ...CHART_THEME,
      width:  container.clientWidth  || 800,
      height: container.clientHeight || 520,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor:       "#3DB87C", downColor:       "#E05A3A",
      borderUpColor: "#3DB87C", borderDownColor: "#E05A3A",
      wickUpColor:   "#3DB87C", wickDownColor:   "#E05A3A",
      priceScaleId: "right",
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.88, bottom: 0 } });

    const sma20 = chart.addLineSeries({ color: "#4A90D9", lineWidth: 1, priceLineVisible: false });
    const sma50 = chart.addLineSeries({ color: "#E0A840", lineWidth: 1, priceLineVisible: false });

    chart.subscribeCrosshairMove(param => {
      if (!param.time || !param.seriesData.size) { setHoverInfo(null); return; }
      const c = param.seriesData.get(candleSeries);
      const v = param.seriesData.get(volumeSeries);
      if (c) setHoverInfo({ time: param.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: v?.value ?? null });
    });

    /* RSI sub-chart */
    const rsiChart = createChart(rsiContainer, {
      ...CHART_THEME,
      width:  rsiContainer.clientWidth  || 800,
      height: rsiContainer.clientHeight || 120,
      timeScale: { ...CHART_THEME.timeScale, timeVisible: false, secondsVisible: false },
    });

    const rsiLine    = rsiChart.addLineSeries({ color: "#E0A840", lineWidth: 1, priceLineVisible: false });
    const overbought = rsiChart.addLineSeries({ color: "#E05A3A", lineWidth: 1, lineStyle: 2, priceLineVisible: false });
    const oversold   = rsiChart.addLineSeries({ color: "#3DB87C", lineWidth: 1, lineStyle: 2, priceLineVisible: false });

    chartRef.current    = chart;
    rsiChartRef.current = rsiChart;
    seriesRef.current   = { candle: candleSeries, vol: volumeSeries, sma20, sma50, rsi: rsiLine, overbought, oversold };

    /* sync scroll/zoom */
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      const r = chart.timeScale().getVisibleLogicalRange();
      if (r) rsiChart.timeScale().setVisibleLogicalRange(r);
    });
    rsiChart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      const r = rsiChart.timeScale().getVisibleLogicalRange();
      if (r) chart.timeScale().setVisibleLogicalRange(r);
    });

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
        rsiChart.applyOptions({ width: rsiContainer.clientWidth, height: rsiContainer.clientHeight });
      });
      ro.observe(container);
      ro.observe(rsiContainer);
      resizeObserverRef.current = ro;
    }
  }, [destroyChart]);

  const renderData = useCallback((ohlc) => {
    const { candle, vol, sma20, sma50, rsi, overbought, oversold } = seriesRef.current;
    if (!candle || !vol) throw new Error("Chart series not ready.");

    const sorted = [...ohlc].sort((a, b) => a.time - b.time);
    ohlcRef.current = sorted;

    candle.setData(sorted);
    vol.setData(sorted.map(d => ({
      time:  d.time,
      value: d.volume ?? 0,
      color: d.close >= d.open ? "rgba(61,184,124,0.55)" : "rgba(224,90,58,0.55)",
    })));
    sma20?.setData(computeSMA(sorted, 20));
    sma50?.setData(computeSMA(sorted, 50));

    const rsiData = computeRSI(sorted);
    rsi?.setData(rsiData);

    if (rsiData.length > 0 && overbought && oversold) {
      const t0 = rsiData[0].time, t1 = rsiData[rsiData.length - 1].time;
      overbought.setData([{ time: t0, value: 70 }, { time: t1, value: 70 }]);
      oversold.setData([  { time: t0, value: 30 }, { time: t1, value: 30 }]);
    }

    const last = sorted[sorted.length - 1], prev = sorted[sorted.length - 2];
    setLatestStats({
      open:      last.open,
      high:      last.high,
      low:       last.low,
      close:     last.close,
      volume:    last.volume,
      changePct: prev ? ((last.close - prev.close) / prev.close) * 100 : null,
      atr:       computeATR(sorted),
    });
  }, []);

  const loadChart = useCallback(async (pair, tf, { silent = false } = {}) => {
    if (!pair) return;
    setLoadError(null);
    if (!silent) { setIsLoading(true); setHoverInfo(null); setLatestStats(null); }

    let ohlc;
    try {
      const key = cacheKey(pair, tf);
      ohlc = pairData[key]?.ohlc;
      if (!ohlc || ohlc.length < 20) {
        ohlc = await fetchHistoricalOHLC(pair, tf);
        setPairData(prev => ({ ...prev, [key]: { ...prev[key], ohlc } }));
      }
      if (!ohlc || ohlc.length < 20) throw new Error("Not enough historical data.");
    } catch (e) {
      setLoadError(e.message);
      setIsLoading(false);
      return;
    }

    if (!chartRef.current) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      buildChart();
    }
    if (!chartRef.current) {
      setLoadError("Chart container not ready.");
      setIsLoading(false);
      return;
    }

    try {
      renderData(ohlc);
    } catch (e) {
      console.error("renderData:", e);
      setLoadError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [pairData, setPairData, buildChart, renderData]);

  /* ── effects ──────────────────────────────────────────────────────────────── */
  useEffect(() => {
    destroyChart();
    if (selectedPair) loadChart(selectedPair, timeframe);
  }, [selectedPair, timeframe]);

  useEffect(() => {
    clearInterval(pollRef.current);
    if (!liveEnabled || !selectedPair) return;
    const ms = POLL_INTERVAL_MS[timeframe] ?? 60000;
    pollRef.current = setInterval(() => loadChart(selectedPair, timeframe, { silent: true }), ms);
    return () => clearInterval(pollRef.current);
  }, [liveEnabled, selectedPair, timeframe, loadChart]);

  /* ── derived display values ───────────────────────────────────────────────── */
  const displayStats = hoverInfo
    ? { open: hoverInfo.open, high: hoverInfo.high, low: hoverInfo.low, close: hoverInfo.close, volume: hoverInfo.volume, changePct: null, atr: null }
    : latestStats;

  const changePct     = displayStats?.changePct;
  const changePctSign = changePct == null ? "" : changePct >= 0 ? "+" : "";
  const changeClass   = changePct == null ? "" : changePct >= 0 ? "bull" : "bear";

  /* ── status dot state ─────────────────────────────────────────────────────── */
  const dotClass = loadError ? "error" : isLoading ? "loading" : liveEnabled ? "live" : "";

  const statusText = loadError
    ? loadError
    : isLoading
    ? "loading…"
    : selectedPair
    ? liveEnabled
      ? `polling every ${POLL_INTERVAL_MS[timeframe] / 1000}s`
      : "updates paused"
    : "select a pair to begin";

  /* ═══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="page">

      {/* ── Page header ───────────────────────────────────────────────────────── */}
      <div className="section-head" style={{ marginBottom: 20 }}>
        <span
          className="section-title"
          style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--color-accent)" }}
        >
          {selectedPair || "—"}
        </span>
        <span className="section-sub">
          candlestick ·{" "}
          {TIMEFRAMES.find(t => t.value === timeframe)?.label ?? timeframe}
        </span>
        {/* Live / paused badge — reuses .pill from topbar */}
        <span
          className="pill"
          style={{
            marginLeft: "auto",
            color: liveEnabled ? "var(--color-bull)" : "var(--color-text-faint)",
            borderColor: liveEnabled ? "var(--color-bull-dim)" : "var(--color-border)",
            background: liveEnabled ? "var(--color-bull-bg)" : "transparent",
            cursor: "pointer",
            userSelect: "none",
          }}
          onClick={() => setLiveEnabled(v => !v)}
          title={liveEnabled ? "Click to pause" : "Click to resume live updates"}
        >
          {liveEnabled ? "● LIVE" : "⏸ PAUSED"}
        </span>
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────────────── */}
      <div className="setup-bar" style={{ marginBottom: 12 }}>
        {/* Pair selector */}
        <div className="setup-group">
          <label>Pair</label>
          <select value={selectedPair} onChange={e => setSelectedPair(e.target.value)}>
            <option value="">Select…</option>
            {activePairs.map(pair => (
              <option key={pair} value={pair}>{pair}</option>
            ))}
          </select>
        </div>

        {/* Timeframe buttons */}
        <div className="setup-group">
          <label>Timeframe</label>
          {TIMEFRAMES.map(tf => (
            <button
              key={tf.value}
              className={tf.value === timeframe ? "btn-primary" : ""}
              style={{ padding: "6px 12px", fontSize: 11, fontFamily: "var(--font-mono)" }}
              onClick={() => setTimeframe(tf.value)}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Status row ────────────────────────────────────────────────────────── */}
      <div className="status-row" style={{ marginBottom: 10 }}>
        <span className={`dot ${dotClass}`} />
        <span>{statusText}</span>
        {hoverInfo && (
          <span style={{ marginLeft: "auto", color: "var(--color-text-faint)" }}>
            cursor active · hover to inspect candles
          </span>
        )}
      </div>

      {/* ── Stats ticker ──────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "stretch",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 6,
        marginBottom: 8,
        overflow: "hidden",
        height: 50,
        fontFamily: "var(--font-mono)",
      }}>
        {loadError ? (
          <div style={{ display: "flex", alignItems: "center", padding: "0 16px", fontSize: 11, color: "var(--color-bear)" }}>
            ✕ {loadError}
          </div>
        ) : displayStats ? (
          <>
            {[
              { label: "O",       value: fmt(displayStats.open),   key: "open"   },
              { label: "H",       value: fmt(displayStats.high),   key: "high", color: "var(--color-bull)" },
              { label: "L",       value: fmt(displayStats.low),    key: "low",  color: "var(--color-bear)" },
              { label: "C",       value: fmt(displayStats.close),  key: "close"  },
              ...(displayStats.volume != null ? [{ label: "VOL", value: fmt(displayStats.volume, 0), key: "vol", color: "var(--color-text-dim)" }] : []),
              ...(displayStats.atr    != null ? [{ label: "ATR(14)", value: fmt(displayStats.atr), key: "atr", color: "var(--color-text-dim)" }] : []),
            ].map(({ label, value, key, color }) => (
              <div key={key} style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: "0 14px",
                borderRight: "1px solid var(--color-border)",
              }}>
                <span style={{
                  fontSize: 9,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--color-text-faint)",
                  marginBottom: 2,
                }}>
                  {label}
                </span>
                <span style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: color ?? "var(--color-text)",
                }}>
                  {value}
                </span>
              </div>
            ))}

            {/* Change % — right-aligned */}
            {changePct != null && (
              <div style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: "0 14px",
                marginLeft: "auto",
              }}>
                <span style={{ fontSize: 9, letterSpacing: "0.12em", color: "var(--color-text-faint)", marginBottom: 2 }}>
                  CHG
                </span>
                <span className={`ind-val ${changeClass}`} style={{ fontSize: 13, fontWeight: 700 }}>
                  {changePctSign}{changePct.toFixed(2)}%
                </span>
              </div>
            )}
          </>
        ) : (
          <div style={{
            display: "flex", alignItems: "center", padding: "0 16px",
            fontSize: 11, color: "var(--color-text-faint)", letterSpacing: "0.06em",
          }}>
            {selectedPair ? "Loading data…" : "Select a pair to view price data"}
          </div>
        )}
      </div>

      {/* ── Main candlestick chart ─────────────────────────────────────────────── */}
      <div
        ref={chartContainerRef}
        style={{
          width: "100%",
          height: 520,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "6px 6px 0 0",
          overflow: "hidden",
        }}
      />

      {/* ── RSI sub-chart ─────────────────────────────────────────────────────── */}
      <div style={{ position: "relative", width: "100%", marginBottom: 20 }}>
        <div
          ref={rsiContainerRef}
          style={{
            width: "100%",
            height: 120,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderTop: "none",
            borderRadius: "0 0 6px 6px",
            overflow: "hidden",
          }}
        />
        {/* RSI watermark label */}
        <span style={{
          position: "absolute",
          top: 6,
          left: 8,
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--color-text-faint)",
          pointerEvents: "none",
          userSelect: "none",
        }}>
          RSI 14 · 70/30
        </span>
      </div>

      {/* ── Indicator legend ──────────────────────────────────────────────────── */}
      <div className="footer-note" style={{ borderTop: "1px solid var(--color-border)", paddingTop: 16, marginTop: 0 }}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 10 }}>
          {[
            { color: "#4A90D9",  label: "SMA 20"        },
            { color: "#E0A840",  label: "SMA 50"        },
            { color: "#3DB87C",  label: "Bull / Oversold(30)"   },
            { color: "#E05A3A",  label: "Bear / Overbought(70)" },
          ].map(({ color, label }) => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ display: "inline-block", width: 20, height: 2, background: color, borderRadius: 1 }} />
              <span style={{ fontSize: 11, color: "var(--color-text-faint)" }}>{label}</span>
            </span>
          ))}
        </div>
        <strong>Notes:</strong>{" "}
        SMA crossovers may signal trend changes (lagging). RSI above 70 suggests overbought, below 30 oversold — not a timing signal.
        ATR(14) measures volatility; useful for stops and position sizing. Volume shows tick vol from MT5.
      </div>

    </div>
  );
}