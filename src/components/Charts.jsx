import { useRef, useEffect, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { useAppContext } from '../context/AppContext';
import { fetchTwelveData } from '../services/twelveData';

export default function Charts() {
  const { activePairs, pairData, appSettings, provider } = useAppContext();
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
    const histProvider = provider === 'finnhub' ? (appSettings.keys.twelve ? 'twelve' : 'av') : provider;

    try {
      if (histProvider === 'twelve' && appSettings.keys.twelve) {
        const values = await fetchTwelveData(pair, appSettings.keys.twelve);
        if (values && values.length > 0) {
          ohlc = values
            .map(v => {
              // Convert datetime string to Unix seconds safely
              let ts = Math.floor(new Date(v.datetime + 'T00:00:00').getTime() / 1000);
              if (isNaN(ts)) ts = 0;  // will be filtered later
              return {
                time: ts,
                open: parseFloat(v.open),
                high: parseFloat(v.high),
                low: parseFloat(v.low),
                close: parseFloat(v.close),
              };
            })
            .filter(d => !isNaN(d.time) && d.time > 0);  // remove invalid entries
        }
      } else if (histProvider === 'av' && appSettings.keys.av) {
        const closes = await (async () => {
          const [from, to] = pair.split('/');
          const url = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${encodeURIComponent(from)}&to_symbol=${encodeURIComponent(to)}&apikey=${appSettings.keys.av}&outputsize=full`;
          const d = await (await fetch(url)).json();
          if (d['Note']) throw new Error('Alpha Vantage rate limit hit.');
          if (d['Information']) throw new Error(d['Information']);
          const raw = d['Time Series FX (Daily)'];
          if (!raw) throw new Error('No data');
          return Object.entries(raw).sort((a,b) => new Date(a[0]) - new Date(b[0])).slice(-200).map(([,v]) => parseFloat(v['4. close']));
        })();
        if (!closes || closes.length < 20) throw new Error('Not enough Alpha Vantage data');
        ohlc = closes.map((close, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (closes.length - 1 - i));
          return {
            time: Math.floor(date.getTime() / 1000),
            open: close, high: close, low: close, close: close,
          };
        });
      } else {
        const closes = pairData[pair]?.closes;
        if (!closes || closes.length < 20) throw new Error('No Twelve Data key saved. Add it in Settings, or add the pair to the Dashboard first.');
        ohlc = closes.map((close, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (closes.length - 1 - i));
          return {
            time: Math.floor(date.getTime() / 1000),
            open: close, high: close, low: close, close: close,
          };
        });
      }
    } catch (e) {
      container.innerHTML = `<div style="color:var(--color-bear); padding:40px; text-align:center;">❌ ${e.message}<br><span style="font-size:12px; color:var(--color-text-faint);">The chart requires historical data. Either:<br>• Save a <b>Twelve Data</b> key (free, 800 req/day) in Settings<br>• Or add the pair to the Dashboard first (uses cached closes)</span></div>`;
      return;
    }

    if (!ohlc.length || ohlc.length < 20) {
      container.innerHTML = '<div style="color:var(--color-amber); padding:40px; text-align:center;">⚠ Not enough data to display chart.</div>';
      return;
    }

    // Ensure ascending order by time
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
        <span style={{ fontSize: 11, color: 'var(--color-text-faint)', marginLeft: 'auto' }}>Uses daily OHLC from Twelve Data. SMA 20 (blue), SMA 50 (orange).</span>
      </div>
      <div ref={chartContainerRef} id="tvChartContainer" style={{ width: '100%', height: 500, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6 }}></div>
      <div className="footer-note" style={{ marginTop: 16 }}>Chart powered by Lightweight Charts (TradingView). Requires a Twelve Data key saved in Settings.</div>
    </div>
  );
}