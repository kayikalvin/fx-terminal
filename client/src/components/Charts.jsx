import { useRef, useEffect, useState, useCallback } from "react";
import { createChart } from "lightweight-charts";
import { useAppContext } from "../context/AppContext";
import { fetchHistoricalOHLC } from "../services/dataProviders";

/* ─── tokens ─────────────────────────────────────────────────────────────── */
const T = {
  void:    "#0A0D14",
  surface: "#0F1520",
  raised:  "#141D2E",
  border:  "#1C2A40",
  accent:  "#C8A96E",   // amber — active states & pair name only
  bull:    "#4DFFB4",
  bear:    "#FF5A5A",
  dim:     "#3D5070",
  muted:   "#566880",
  text:    "#A8BBC8",
  bright:  "#DCE8F0",
};

/* ─── chart theme ─────────────────────────────────────────────────────────── */
const CHART_OPTS = {
  layout:          { background: { color: T.surface }, textColor: T.muted },
  grid:            { vertLines: { color: T.border }, horzLines: { color: T.border } },
  rightPriceScale: { borderColor: T.border },
  timeScale:       { borderColor: T.border, timeVisible: true, secondsVisible: false },
  crosshair:       { mode: 1 },
};

/* ─── static data ─────────────────────────────────────────────────────────── */
const TIMEFRAMES = [
  { label: "1m", value: "M1" },
  { label: "5m", value: "M5" },
  { label: "15m", value: "M15" },
  { label: "1H", value: "H1" },
  { label: "4H", value: "H4" },
  { label: "1D", value: "D" },
];

const POLL_INTERVAL_MS = {
  M1: 5000, M5: 15000, M15: 30000, H1: 60000, H4: 60000, D: 60000,
};

/* ─── indicator math ─────────────────────────────────────────────────────── */
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

/* ─── helpers ────────────────────────────────────────────────────────────── */
const fmt = (n, d = 5) => n == null ? "—" : Number(n).toFixed(d);

/* ─── inline styles (CSS-in-JS, no class dependency) ─────────────────────── */
const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    background: T.void,
    minHeight: "100vh",
    padding: "20px 24px 32px",
    fontFamily: "'Inter', system-ui, sans-serif",
    color: T.text,
    boxSizing: "border-box",
  },

  /* ── header ── */
  header: {
    display: "flex",
    alignItems: "baseline",
    gap: 12,
    marginBottom: 16,
    borderBottom: `1px solid ${T.border}`,
    paddingBottom: 14,
  },
  pairName: {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: "0.04em",
    color: T.accent,
  },
  headerSub: {
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: T.muted,
  },
  liveIndicator: (live) => ({
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: live ? T.bull : T.muted,
  }),
  liveDot: (live) => ({
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: live ? T.bull : T.dim,
    boxShadow: live ? `0 0 6px ${T.bull}` : "none",
    transition: "box-shadow 0.3s",
  }),

  /* ── toolbar rail ── */
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 0,
    marginBottom: 12,
    background: T.raised,
    border: `1px solid ${T.border}`,
    borderRadius: 4,
    overflow: "hidden",
    height: 36,
  },
  pairSelect: {
    appearance: "none",
    background: "transparent",
    border: "none",
    borderRight: `1px solid ${T.border}`,
    color: T.bright,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    fontWeight: 600,
    padding: "0 32px 0 14px",
    height: "100%",
    cursor: "pointer",
    outline: "none",
    minWidth: 140,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23566880' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
  },
  tfGroup: {
    display: "flex",
    alignItems: "center",
    borderRight: `1px solid ${T.border}`,
    height: "100%",
  },
  tfBtn: (active) => ({
    background: "transparent",
    border: "none",
    borderRight: `1px solid ${T.border}`,
    color: active ? T.accent : T.muted,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    fontWeight: active ? 700 : 400,
    padding: "0 13px",
    height: "100%",
    cursor: "pointer",
    letterSpacing: "0.04em",
    transition: "color 0.15s",
    position: "relative",
    // bottom accent bar on active
    ...(active ? {
      background: `linear-gradient(to top, ${T.accent}22 0%, transparent 60%)`,
    } : {}),
  }),
  liveBtn: (live) => ({
    background: "transparent",
    border: "none",
    color: live ? T.bull : T.muted,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    fontWeight: 600,
    padding: "0 14px",
    height: "100%",
    cursor: "pointer",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    display: "flex",
    alignItems: "center",
    gap: 7,
    transition: "color 0.15s",
  }),

  /* ── stats ticker ── */
  statsTicker: {
    display: "flex",
    alignItems: "stretch",
    background: T.raised,
    border: `1px solid ${T.border}`,
    borderRadius: 4,
    marginBottom: 8,
    overflow: "hidden",
    height: 42,
    fontFamily: "'JetBrains Mono', monospace",
  },
  statsCell: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: "0 16px",
    borderRight: `1px solid ${T.border}`,
    minWidth: 80,
  },
  statsCellLabel: {
    fontSize: 9,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: T.dim,
    marginBottom: 2,
  },
  statsCellValue: {
    fontSize: 13,
    fontWeight: 600,
    color: T.bright,
    letterSpacing: "0.02em",
  },
  statsEmpty: {
    display: "flex",
    alignItems: "center",
    padding: "0 16px",
    fontSize: 11,
    color: T.dim,
    letterSpacing: "0.08em",
    fontFamily: "'JetBrains Mono', monospace",
  },

  /* ── chart panes ── */
  mainPane: {
    width: "100%",
    minHeight: 420,
    height: 560,
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: "4px 4px 0 0",
    overflow: "hidden",
  },
  rsiPane: {
    width: "100%",
    height: 120,
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderTop: "none",
    borderRadius: "0 0 4px 4px",
    overflow: "hidden",
    marginBottom: 16,
  },
  rsiLabel: {
    position: "absolute",
    top: 6,
    left: 8,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.12em",
    color: T.dim,
    textTransform: "uppercase",
    pointerEvents: "none",
  },
  rsiWrapper: {
    position: "relative",
    width: "100%",
  },

  /* ── legend ── */
  legend: {
    display: "flex",
    gap: 20,
    padding: "10px 14px",
    background: T.raised,
    border: `1px solid ${T.border}`,
    borderRadius: 4,
    flexWrap: "wrap",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 11,
    color: T.muted,
    letterSpacing: "0.04em",
  },
  legendDot: (color) => ({
    width: 18,
    height: 2,
    background: color,
    borderRadius: 1,
    flexShrink: 0,
  }),
};

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function Charts() {
  const { activePairs, pairData, setPairData } = useAppContext();
  const [selectedPair, setSelectedPair] = useState("");
  const [timeframe, setTimeframe]       = useState("D");
  const [liveEnabled, setLiveEnabled]   = useState(true);
  const [hoverInfo, setHoverInfo]       = useState(null);
  const [latestStats, setLatestStats]   = useState(null);
  const [loadError, setLoadError]       = useState(null);

  const chartContainerRef = useRef(null);
  const rsiContainerRef   = useRef(null);
  const chartRef          = useRef(null);
  const rsiChartRef       = useRef(null);
  const seriesRef         = useRef({ candle: null, vol: null, sma20: null, sma50: null, rsi: null, overbought: null, oversold: null });
  const pollRef           = useRef(null);
  const ohlcRef           = useRef([]);
  const resizeObserverRef = useRef(null);

  const cacheKey = (pair, tf) => `${pair}_${tf}`;

  /* ── chart lifecycle ─────────────────────────────────────────────────────── */
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
      ...CHART_OPTS,
      width:  container.clientWidth  || 800,
      height: container.clientHeight || 560,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor:        T.bull,  downColor:        T.bear,
      borderUpColor:  T.bull,  borderDownColor:  T.bear,
      wickUpColor:    T.bull,  wickDownColor:    T.bear,
      priceScaleId: "right",
    });

    const volumeSeries = chart.addHistogramSeries({
      color: T.dim,
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.88, bottom: 0 } });

    const sma20 = chart.addLineSeries({ color: "#4A90D9", lineWidth: 1, priceLineVisible: false });
    const sma50 = chart.addLineSeries({ color: T.accent,  lineWidth: 1, priceLineVisible: false });

    chart.subscribeCrosshairMove(param => {
      if (!param.time || !param.seriesData.size) { setHoverInfo(null); return; }
      const c = param.seriesData.get(candleSeries);
      const v = param.seriesData.get(volumeSeries);
      if (c) setHoverInfo({ time: param.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: v?.value ?? null });
    });

    /* ── RSI sub-chart ── */
    const rsiChart = createChart(rsiContainer, {
      ...CHART_OPTS,
      width:  rsiContainer.clientWidth  || 800,
      height: rsiContainer.clientHeight || 120,
      timeScale: { ...CHART_OPTS.timeScale, timeVisible: false, secondsVisible: false },
    });

    const rsiLine      = rsiChart.addLineSeries({ color: T.accent, lineWidth: 1, priceLineVisible: false });
    const overbought   = rsiChart.addLineSeries({ color: T.bear,   lineWidth: 1, lineStyle: 2, priceLineVisible: false });
    const oversold     = rsiChart.addLineSeries({ color: T.bull,   lineWidth: 1, lineStyle: 2, priceLineVisible: false });

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
      time: d.time,
      value: d.volume ?? 0,
      color: d.close >= d.open ? `${T.bull}55` : `${T.bear}55`,
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
      close:     last.close,
      open:      last.open,
      high:      last.high,
      low:       last.low,
      volume:    last.volume,
      changePct: prev ? ((last.close - prev.close) / prev.close) * 100 : null,
      atr:       computeATR(sorted),
    });
  }, []);

  const loadChart = useCallback(async (pair, tf, { silent = false } = {}) => {
    if (!pair) return;
    setLoadError(null);
    if (!silent) {
      setHoverInfo(null);
      setLatestStats(null);
    }

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
      return;
    }

    if (!chartRef.current) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      buildChart();
    }
    if (!chartRef.current) { setLoadError("Chart container not ready."); return; }

    try { renderData(ohlc); }
    catch (e) { console.error("renderData:", e); setLoadError(e.message); }
  }, [pairData, setPairData, buildChart, renderData]);

  /* ── effects ─────────────────────────────────────────────────────────────── */
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

  /* ── derived display values ──────────────────────────────────────────────── */
  const displayStats = hoverInfo
    ? { open: hoverInfo.open, high: hoverInfo.high, low: hoverInfo.low, close: hoverInfo.close, volume: hoverInfo.volume, changePct: null, atr: null }
    : latestStats;

  const changePct = displayStats?.changePct;
  const changeColor = changePct == null ? T.muted : changePct >= 0 ? T.bull : T.bear;

  /* ═══════════════════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* Google Fonts — JetBrains Mono + Inter */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet" />

      <div style={styles.page}>

        {/* ── Header ── */}
        <div style={styles.header}>
          <span style={styles.pairName}>
            {selectedPair || "—"}
          </span>
          <span style={styles.headerSub}>
            {selectedPair ? `candlestick · ${TIMEFRAMES.find(t => t.value === timeframe)?.label}` : "select a pair"}
          </span>
          <div style={styles.liveIndicator(liveEnabled)}>
            <span style={styles.liveDot(liveEnabled)} />
            {liveEnabled ? "live" : "paused"}
          </div>
        </div>

        {/* ── Toolbar rail ── */}
        <div style={styles.toolbar}>
          {/* Pair selector */}
          <select
            style={styles.pairSelect}
            value={selectedPair}
            onChange={e => setSelectedPair(e.target.value)}
          >
            <option value="">Pair…</option>
            {activePairs.map(pair => (
              <option key={pair} value={pair}>{pair}</option>
            ))}
          </select>

          {/* Timeframe buttons */}
          <div style={styles.tfGroup}>
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.value}
                style={styles.tfBtn(tf.value === timeframe)}
                onClick={() => setTimeframe(tf.value)}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Live toggle */}
          <button
            style={styles.liveBtn(liveEnabled)}
            onClick={() => setLiveEnabled(v => !v)}
          >
            <span style={styles.liveDot(liveEnabled)} />
            {liveEnabled ? "live" : "paused"}
          </button>
        </div>

        {/* ── Stats ticker ── */}
        <div style={styles.statsTicker}>
          {loadError ? (
            <div style={{ ...styles.statsEmpty, color: T.bear }}>
              ✕ {loadError}
            </div>
          ) : displayStats ? (
            <>
              {[
                { label: "open",   value: fmt(displayStats.open)   },
                { label: "high",   value: fmt(displayStats.high)   },
                { label: "low",    value: fmt(displayStats.low)    },
                { label: "close",  value: fmt(displayStats.close)  },
                ...(displayStats.volume != null ? [{ label: "vol", value: fmt(displayStats.volume, 0) }] : []),
                ...(displayStats.atr    != null ? [{ label: "atr(14)", value: fmt(displayStats.atr) }] : []),
              ].map(({ label, value }) => (
                <div key={label} style={styles.statsCell}>
                  <span style={styles.statsCellLabel}>{label}</span>
                  <span style={styles.statsCellValue}>{value}</span>
                </div>
              ))}

              {changePct != null && (
                <div style={{ ...styles.statsCell, borderRight: "none", marginLeft: "auto" }}>
                  <span style={styles.statsCellLabel}>chg</span>
                  <span style={{ ...styles.statsCellValue, color: changeColor }}>
                    {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
                  </span>
                </div>
              )}
            </>
          ) : (
            <div style={styles.statsEmpty}>
              {selectedPair ? "loading…" : "select a pair to begin"}
            </div>
          )}
        </div>

        {/* ── Main chart pane ── */}
        <div ref={chartContainerRef} style={styles.mainPane} />

        {/* ── RSI pane ── */}
        <div style={styles.rsiWrapper}>
          <div ref={rsiContainerRef} style={styles.rsiPane} />
          <span style={styles.rsiLabel}>RSI 14</span>
        </div>

        {/* ── Legend ── */}
        <div style={styles.legend}>
          {[
            { color: "#4A90D9", label: "SMA 20 — short trend" },
            { color: T.accent,  label: "SMA 50 — medium trend" },
            { color: T.bull,    label: "Bull candle / oversold(30)" },
            { color: T.bear,    label: "Bear candle / overbought(70)" },
            { color: T.muted,   label: "Volume (tick vol from MT5)" },
          ].map(({ color, label }) => (
            <div key={label} style={styles.legendItem}>
              <span style={styles.legendDot(color)} />
              {label}
            </div>
          ))}
        </div>

      </div>
    </>
  );
}