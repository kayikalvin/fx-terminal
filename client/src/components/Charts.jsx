import { useRef, useEffect, useState, useCallback } from "react";
import { createChart } from "lightweight-charts";
import { useAppContext } from "../context/AppContext";
import { fetchHistoricalOHLC } from "../services/dataProviders";

const TIMEFRAMES = [
  { label: "1m", value: "M1" },
  { label: "5m", value: "M5" },
  { label: "15m", value: "M15" },
  { label: "1H", value: "H1" },
  { label: "4H", value: "H4" },
  { label: "1D", value: "D" },
];

const POLL_INTERVAL_MS = {
  M1: 5000,
  M5: 15000,
  M15: 30000,
  H1: 60000,
  H4: 60000,
  D: 60000,
};

function average(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function computeSMA(ohlc, period) {
  const closes = ohlc.map((d) => d.close);
  const out = [];
  for (let i = period - 1; i < closes.length; i++) {
    out.push({
      time: ohlc[i].time,
      value: average(closes.slice(i - period + 1, i + 1)),
    });
  }
  return out;
}

function computeATR(ohlc, period = 14) {
  if (ohlc.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < ohlc.length; i++) {
    const cur = ohlc[i];
    const prev = ohlc[i - 1];
    trs.push(
      Math.max(
        cur.high - cur.low,
        Math.abs(cur.high - prev.close),
        Math.abs(cur.low - prev.close),
      ),
    );
  }
  return average(trs.slice(-period));
}

export default function Charts() {
  const { activePairs, pairData, setPairData } = useAppContext();
  const [selectedPair, setSelectedPair] = useState("");
  const [timeframe, setTimeframe] = useState("D");
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [latestStats, setLatestStats] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const sma20Ref = useRef(null);
  const sma50Ref = useRef(null);
  const volumeSeriesRef = useRef(null);
  const pollRef = useRef(null);
  const ohlcRef = useRef([]);
  const resizeHandlerRef = useRef(null);

  const cacheKey = (pair, tf) => `${pair}_${tf}`;

  const destroyChart = useCallback(() => {
    if (resizeHandlerRef.current) {
      window.removeEventListener("resize", resizeHandlerRef.current);
      resizeHandlerRef.current = null;
    }
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }
    candleSeriesRef.current = null;
    volumeSeriesRef.current = null;
    sma20Ref.current = null;
    sma50Ref.current = null;
  }, []);

  const buildChart = useCallback(() => {
    const container = chartContainerRef.current;
    if (!container) return () => {};

    destroyChart();
    container.innerHTML = "";

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 500,
      layout: { background: { color: "#111827" }, textColor: "#7A859E" },
      grid: {
        vertLines: { color: "#1E2D45" },
        horzLines: { color: "#1E2D45" },
      },
      rightPriceScale: { borderColor: "#1E2D45" },
      timeScale: {
        borderColor: "#1E2D45",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: { mode: 1 },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#3DB87C",
      downColor: "#E05A3A",
      borderUpColor: "#3DB87C",
      borderDownColor: "#E05A3A",
      wickUpColor: "#3DB87C",
      wickDownColor: "#E05A3A",
      priceScaleId: "right",
    });

    const volumeSeries = chart.addHistogramSeries({
      color: "#2A3B57",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    const sma20 = chart.addLineSeries({
      color: "#4A90D9",
      lineWidth: 1,
      priceLineVisible: false,
    });
    const sma50 = chart.addLineSeries({
      color: "#E0A840",
      lineWidth: 1,
      priceLineVisible: false,
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData.size) {
        setHoverInfo(null);
        return;
      }
      const candle = param.seriesData.get(candleSeries);
      const vol = param.seriesData.get(volumeSeries);
      if (candle) {
        setHoverInfo({
          time: param.time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: vol?.value ?? null,
        });
      }
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    sma20Ref.current = sma20;
    sma50Ref.current = sma50;

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    resizeHandlerRef.current = handleResize;
    window.addEventListener("resize", handleResize);

    return destroyChart;
  }, [destroyChart]);

  const renderData = useCallback((ohlc) => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) {
      throw new Error("Chart series not initialized.");
    }

    const sorted = [...ohlc].sort((a, b) => a.time - b.time);
    ohlcRef.current = sorted;

    candleSeriesRef.current.setData(sorted);
    volumeSeriesRef.current.setData(
      sorted.map((d) => ({
        time: d.time,
        value: d.volume ?? 0,
        color:
          d.close >= d.open ? "rgba(61,184,124,0.5)" : "rgba(224,90,58,0.5)",
      })),
    );
    sma20Ref.current?.setData(computeSMA(sorted, 20));
    sma50Ref.current?.setData(computeSMA(sorted, 50));

    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    setLatestStats({
      close: last.close,
      changePct: prev ? ((last.close - prev.close) / prev.close) * 100 : null,
      atr: computeATR(sorted),
    });
  }, []);

  const loadChart = useCallback(
    async (pair, tf, { silent = false } = {}) => {
      if (!pair) return;
      setLoadError(null);
      if (!silent && chartContainerRef.current) {
        chartContainerRef.current.innerHTML =
          '<div style="color:var(--color-text-faint); padding:40px; text-align:center;">⏳ Loading chart data…</div>';
      }

      let ohlc;
      try {
        const key = cacheKey(pair, tf);
        ohlc = pairData[key]?.ohlc;
        if (!ohlc || ohlc.length < 20) {
          ohlc = await fetchHistoricalOHLC(pair, tf);
          setPairData((prev) => ({ ...prev, [key]: { ...prev[key], ohlc } }));
        }
        if (!ohlc || ohlc.length < 20)
          throw new Error("Not enough historical data for this timeframe.");
      } catch (e) {
        setLoadError(e.message);
        if (chartContainerRef.current) {
          chartContainerRef.current.innerHTML =
            `<div style="color:var(--color-bear); padding:40px; text-align:center;">❌ ${e.message}<br>` +
            `<span style="font-size:12px; color:var(--color-text-faint);">Data is fetched from the MT5 bridge or web fallback. Confirm the bridge is running and the symbol/timeframe is available.</span></div>`;
        }
        return;
      }

      if (!chartRef.current) buildChart();
      try {
        renderData(ohlc);
      } catch (e) {
        console.error("renderData failed:", e);
        setLoadError(e.message);
        if (chartContainerRef.current) {
          chartContainerRef.current.innerHTML = `<div style="color:var(--color-bear); padding:40px; text-align:center;">❌ Chart render error: ${e.message}</div>`;
        }
      }
    },
    [pairData, setPairData, buildChart, renderData],
  );

  useEffect(() => {
    const cleanup = buildChart();
    if (selectedPair) loadChart(selectedPair, timeframe);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPair, timeframe]);

  useEffect(() => {
    clearInterval(pollRef.current);
    if (!liveEnabled || !selectedPair) return;

    const intervalMs = POLL_INTERVAL_MS[timeframe] ?? 60000;
    pollRef.current = setInterval(() => {
      loadChart(selectedPair, timeframe, { silent: true });
    }, intervalMs);

    return () => clearInterval(pollRef.current);
  }, [liveEnabled, selectedPair, timeframe, loadChart]);

  const fmt = (n, d = 5) => (n == null ? "—" : n.toFixed(d));

  return (
    <div className="page">
      <div className="section-head">
        <span className="section-title">Candlestick Chart</span>
        <span className="section-sub">
          {selectedPair || "Select a pair below"}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <select
          className="input"
          style={{ flex: "0 0 auto" }}
          value={selectedPair}
          onChange={(e) => setSelectedPair(e.target.value)}
        >
          <option value="">Select a pair…</option>
          {activePairs.map((pair) => (
            <option key={pair} value={pair}>
              {pair}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 4 }}>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={
                tf.value === timeframe ? "btn-primary" : "btn-secondary"
              }
              style={{ padding: "4px 10px", fontSize: 12 }}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setLiveEnabled((v) => !v)}
          className={liveEnabled ? "btn-primary" : "btn-secondary"}
          style={{
            padding: "4px 10px",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
          title={
            liveEnabled ? "Polling for new candles" : "Live updates paused"
          }
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: liveEnabled
                ? "var(--color-bull, #3DB87C)"
                : "var(--color-text-faint)",
              display: "inline-block",
            }}
          />
          {liveEnabled ? "Live" : "Paused"}
        </button>

        <span
          style={{
            fontSize: 11,
            color: "var(--color-text-faint)",
            marginLeft: "auto",
          }}
        >
          SMA 20 (blue) · SMA 50 (orange) · Volume below
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 24,
          padding: "8px 12px",
          marginBottom: 8,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 6,
          fontSize: 13,
          flexWrap: "wrap",
        }}
      >
        {hoverInfo ? (
          <>
            <span>
              O <strong>{fmt(hoverInfo.open)}</strong>
            </span>
            <span>
              H <strong>{fmt(hoverInfo.high)}</strong>
            </span>
            <span>
              L <strong>{fmt(hoverInfo.low)}</strong>
            </span>
            <span>
              C <strong>{fmt(hoverInfo.close)}</strong>
            </span>
            {hoverInfo.volume != null && (
              <span>
                Vol <strong>{fmt(hoverInfo.volume, 0)}</strong>
              </span>
            )}
          </>
        ) : latestStats ? (
          <>
            <span>
              Last <strong>{fmt(latestStats.close)}</strong>
            </span>
            {latestStats.changePct != null && (
              <span
                style={{
                  color:
                    latestStats.changePct >= 0
                      ? "var(--color-bull, #3DB87C)"
                      : "var(--color-bear, #E05A3A)",
                }}
              >
                {latestStats.changePct >= 0 ? "+" : ""}
                {latestStats.changePct.toFixed(2)}%
              </span>
            )}
            {latestStats.atr != null && (
              <span style={{ color: "var(--color-text-faint)" }}>
                ATR(14) {fmt(latestStats.atr)}
              </span>
            )}
          </>
        ) : (
          <span style={{ color: "var(--color-text-faint)" }}>
            Hover the chart for candle detail
          </span>
        )}
      </div>

      <div
        ref={chartContainerRef}
        style={{
          width: "100%",
          height: 500,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 6,
        }}
      />

      <div className="footer-note" style={{ marginTop: 16 }}>
        Chart powered by Lightweight Charts (TradingView). Data sourced live
        from your MT5 bridge — no third-party API key needed.{" "}
        {liveEnabled
          ? "Live mode polls for new candles automatically."
          : "Live updates paused."}
      </div>
    </div>
  );
}