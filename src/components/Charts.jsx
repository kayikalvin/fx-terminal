import { useRef, useEffect, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { useAppContext } from '../context/AppContext';
import { fetchHistoricalOHLC } from '../services/dataProviders';

export default function Charts() {
  const { activePairs, pairData, setPairData } = useAppContext();
  const [selectedPair, setSelectedPair] = useState('');
  const chartContainerRef = useRef(null);
  const [chart, setChart] = useState(null);
  const [candleSeries, setCandleSeries] = useState(null);
  const [sma20Line, setSma20Line] = useState(null);
  const [sma50Line, setSma50Line] = useState(null);

  const loadChart = async (pair) => {
    if (!pair) return;
    const container = chartContainerRef.current;
    container.innerHTML = '<div style="color:var(--color-text-faint); padding:40px; text-align:center;">⏳ Loading chart data…</div>';

    let ohlc = [];
    try {
      // Use cached OHLC if available
      ohlc = pairData[pair]?.ohlc;
      if (!ohlc || ohlc.length < 20) {
        ohlc = await fetchHistoricalOHLC(pair);
        // Cache it
        setPairData(prev => ({
          ...prev,
          [pair]: { ...prev[pair], ohlc }
        }));
      }
      if (!ohlc || ohlc.length < 20) throw new Error('Not enough historical data.');
    } catch (e) {
      container.innerHTML = `<div style="color:var(--color-bear); padding:40px; text-align:center;">❌ ${e.message}<br><span style="font-size:12px; color:var(--color-text-faint);">Data is fetched automatically from Yahoo Finance or Stooq. No API key required.</span></div>`;
      return;
    }

    ohlc.sort((a, b) => a.time - b.time);
    container.innerHTML = '';

    const c = createChart(container, {
      layout: { background: { color: '#111827' }, textColor: '#7A859E' },
      grid: { vertLines: { color: '#1E2D45' }, horzLines: { color: '#1E2D45' } },
      rightPriceScale: { borderColor: '#1E2D45' },
      timeScale: { borderColor: '#1E2D45', timeVisible: true },
    });
    setChart(c);

    const series = c.addCandlestickSeries({
      upColor: '#3DB87C', downColor: '#E05A3A',
      borderUpColor: '#3DB87C', borderDownColor: '#E05A3A',
      wickUpColor: '#3DB87C', wickDownColor: '#E05A3A',
    });
    series.setData(ohlc);
    setCandleSeries(series);

    const closes = ohlc.map(d => d.close);
    const sma20 = [], sma50 = [];
    for (let i = 0; i < closes.length; i++) {
      if (i >= 19) sma20.push({ time: ohlc[i].time, value: closes.slice(i-19, i+1).reduce((a,b)=>a+b,0)/20 });
      if (i >= 49) sma50.push({ time: ohlc[i].time, value: closes.slice(i-49, i+1).reduce((a,b)=>a+b,0)/50 });
    }
    const line20 = c.addLineSeries({ color: '#4A90D9', lineWidth: 1 });
    line20.setData(sma20);
    setSma20Line(line20);
    const line50 = c.addLineSeries({ color: '#E0A840', lineWidth: 1 });
    line50.setData(sma50);
    setSma50Line(line50);
  };

  useEffect(() => {
    if (selectedPair) loadChart(selectedPair);
  }, [selectedPair]);

  return (
    <div className="page">
      <div className="section-head">
        <span className="section-title">Candlestick Chart</span>
        <span className="section-sub" id="chartSymbolLabel">{selectedPair || 'Select a pair below'}</span>
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <select style={{ flex: '0 0 auto' }} value={selectedPair} onChange={e => setSelectedPair(e.target.value)} className="input">
          <option value="">Select a pair…</option>
          {activePairs.map(pair => <option key={pair} value={pair}>{pair}</option>)}
        </select>
        <button className="btn-primary" onClick={() => loadChart(selectedPair)}>Load Chart</button>
        <span style={{ fontSize: 11, color: 'var(--color-text-faint)', marginLeft: 'auto' }}>Uses daily OHLC from Yahoo Finance / Stooq. SMA 20 (blue), SMA 50 (orange).</span>
      </div>
      <div ref={chartContainerRef} id="tvChartContainer" style={{ width: '100%', height: 500, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6 }}></div>
      <div className="footer-note" style={{ marginTop: 16 }}>Chart powered by Lightweight Charts (TradingView). Historical data auto‑fetched. No API key needed.</div>
    </div>
  );
}