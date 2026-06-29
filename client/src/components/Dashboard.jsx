import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';

export default function Dashboard() {
  const {
    appSettings, setAppSettings,
    provider, setProvider,
    apiKey, setApiKey,
    activePairs, setActivePairs,
    pairData, setPairData,
    mt5Status, selectedPair, setSelectedPair,
    safeid, fetchPair
  } = useAppContext();

  const [dashStatus, setDashStatus] = useState('Connect to MT5 or enter a Finnhub key.');
  const pairSelectRef = useRef(null);

  const addPair = (pair) => {
    if (!pair || activePairs.includes(pair)) return;
    setActivePairs([...activePairs, pair]);
    fetchPair(pair).catch(e => setDashStatus('error: ' + e.message));
  };

  const removePair = (pair) => {
    setActivePairs(activePairs.filter(p => p !== pair));
    setPairData(prev => { const n = { ...prev }; delete n[pair]; return n; });
  };

  return (
    <div className="page">
      <div className="setup-bar">
        <div className="setup-group">
          <label>DATA SOURCE</label>
          <select value={provider} onChange={e => {
            const p = e.target.value;
            setProvider(p);
            setApiKey(appSettings.keys[p] || '');
          }}>
            <option value="mt5">MetaTrader 5 (local bridge)</option>
            <option value="finnhub">Finnhub (live streaming)</option>
            <option value="oanda">OANDA Practice</option>
          </select>
        </div>
        {provider !== 'mt5' && (
          <div className="setup-group">
            <label>API KEY</label>
            <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Paste key here…" style={{ width: 260 }} />
            <button className="btn-primary" onClick={() => {
              const newKeys = { ...appSettings.keys, [provider]: apiKey };
              setAppSettings({ ...appSettings, keys: newKeys });
              setDashStatus('live: Key saved.');
            }}>Save</button>
          </div>
        )}
        <div className="setup-group">
          <label>ADD PAIR</label>
          <select ref={pairSelectRef}>
            <optgroup label="FX Majors">
              <option>EUR/USD</option><option>GBP/USD</option><option>USD/JPY</option>
              <option>USD/CHF</option><option>AUD/USD</option><option>USD/CAD</option>
              <option>NZD/USD</option>
            </optgroup>
          </select>
          <button className="btn-primary" onClick={() => addPair(pairSelectRef.current?.value)}>Add to panel</button>
        </div>
      </div>

      <div className="status-row">
        <span className={`dot ${dashStatus.startsWith('live') ? 'live' : dashStatus.startsWith('error') ? 'error' : 'loading'}`} />
        {dashStatus}
        {provider === 'mt5' && (
          <span className={`connection-pill ${mt5Status === 'connected' ? 'live' : 'error'}`} style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 4, background: mt5Status === 'connected' ? 'var(--color-bull-bg)' : 'var(--color-bear-bg)', color: mt5Status === 'connected' ? 'var(--color-bull)' : 'var(--color-bear)', fontSize: 11 }}>
            MT5: {mt5Status}
          </span>
        )}
      </div>

      <div className="card-grid">
        {activePairs.length === 0 && (
          <div className="placeholder-block"><p>No instruments added yet.<br />Pick a provider, save your key, then add pairs above.</p></div>
        )}
        {activePairs.map(pair => {
          const data = pairData[pair];
          const id = safeid(pair);
          return (
            <div key={pair} className="card">
              <button className="remove-btn" onClick={() => removePair(pair)}>×</button>
              <div className="card-head">
                <span className="pair-tag" onClick={() => setSelectedPair(pair)} style={{ cursor: 'pointer', color: selectedPair === pair ? 'var(--color-accent)' : 'inherit' }}>
                  {pair}
                </span>
                <div className="card-meta">
                  <div id={`src-${id}`}>via {provider.toUpperCase()}</div>
                  <div id={`updated-${id}`}>{data?.lastPrice ? new Date().toLocaleTimeString() : '--'}</div>
                </div>
              </div>
              <div className="price-row">
                <span className="price-val" id={`price-${id}`}>{data?.lastPrice?.toFixed(5) || '--'}</span>
                {data?.closes && data.closes.length >= 2 && (
                  <span className={`change-badge ${data.lastPrice >= data.closes[data.closes.length-2] ? 'up' : 'down'}`} id={`change-${id}`}>
                    {((data.lastPrice - data.closes[data.closes.length-2]) / data.closes[data.closes.length-2] * 100).toFixed(2)}%
                  </span>
                )}
              </div>
              <div className="indicator"><div className="ind-row"><span className="ind-label">VWAP</span><span className="ind-val neutral">{data?.vwap?.toFixed(5) || '--'}</span></div><div className="ind-explain">Volume Weighted Average Price</div></div>
              <div className="indicator"><div className="ind-row"><span className="ind-label">ATR (14)</span><span className="ind-val neutral">{data?.atr?.toFixed(5) || '--'}</span></div><div className="ind-explain">Average True Range</div></div>
              <div className="indicator"><div className="ind-row"><span className="ind-label">RSI (14)</span><span className={`ind-val ${data?.rsi >= 70 ? 'bear' : data?.rsi <= 30 ? 'bull' : 'neutral'}`}>{data?.rsi?.toFixed(1) || '--'}</span></div><div className="bar-track"><div className="bar-fill" style={{ width: `${data?.rsi || 0}%`, background: data?.rsi >= 70 ? 'var(--color-bear)' : data?.rsi <= 30 ? 'var(--color-bull)' : 'var(--color-amber)' }} /></div><div className="ind-explain">{data?.rsi >= 70 ? 'Overbought' : data?.rsi <= 30 ? 'Oversold' : 'Mid-range'}</div></div>
              <div className="indicator"><div className="ind-row"><span className="ind-label">Trend (SMA 20/50)</span><span className={`ind-val ${data?.sma20 > data?.sma50 ? 'bull' : 'bear'}`}>{data?.sma20 > data?.sma50 ? '▲ Bullish' : '▼ Bearish'}</span></div><div className="ind-explain">{data?.sma20 > data?.sma50 ? 'SMA 20 above SMA 50' : 'SMA 20 below SMA 50'}</div></div>
              <div className="indicator"><div className="ind-row"><span className="ind-label">Momentum (10-period)</span><span className={`ind-val ${data?.mom >= 0 ? 'bull' : 'bear'}`}>{data?.mom != null ? ((data.mom / data.lastPrice) * 100).toFixed(3) + '%' : '--'}</span></div><div className="ind-explain">{data?.mom >= 0 ? 'Net positive momentum' : 'Net negative momentum'}</div></div>
            </div>
          );
        })}
      </div>

      {/* Volatility Overview */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-7" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h3 className="text-sm text-dim font-semibold mb-2" style={{ color: 'var(--color-text-dim)' }}>Volatility Overview</h3>
        {activePairs.map(pair => {
          const d = pairData[pair];
          if (!d?.atr) return null;
          const atrPct = ((d.atr / d.lastPrice) * 100).toFixed(2);
          const comment = atrPct > 0.8 ? 'High' : atrPct > 0.4 ? 'Medium' : 'Low';
          return <div key={pair} style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>{pair}: ATR {d.atr.toFixed(5)} ({atrPct}%) – {comment} volatility</div>;
        })}
      </div>

      <div className="footer-note">
        <strong>What the indicators mean:</strong> RSI measures recent price momentum on a 0–100 scale — above 70 suggests overbought, below 30 oversold, but neither is a reliable prediction in trending markets. The SMA crossover compares two moving averages; a crossover is a lagging trend‑change signal. Momentum shows the net direction over the last 10 periods.<br /><br />
        <strong>What none of this is:</strong> a signal to buy or sell. These tools describe what has happened, not what will happen.
      </div>
    </div>
  );
}