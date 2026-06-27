import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

export default function Alerts() {
  const { alerts, setAlerts, pairData, alertLogLines, setAlertLogLines } = useAppContext();
  const [pair, setPair] = useState('EUR/USD');
  const [cond, setCond] = useState('price_above');
  const [value, setValue] = useState('');
  const [notify, setNotify] = useState('once');

  const addAlert = () => {
    const needsVal = ['price_above','price_below','rsi_above','rsi_below'].includes(cond);
    if (needsVal && isNaN(parseFloat(value))) return alert('Enter a numeric value.');
    const newAlert = {
      id: Date.now(),
      pair,
      cond,
      val: needsVal ? parseFloat(value) : null,
      notify,
      triggered: false
    };
    setAlerts([...alerts, newAlert]);
    setValue('');
  };

  const removeAlert = (id) => setAlerts(alerts.filter(a => a.id !== id));

  // Check alerts whenever pairData changes
  useEffect(() => {
    alerts.forEach(a => {
      const d = pairData[a.pair];
      if (!d) return;
      let hit = false;
      if (a.cond === 'ma_cross_bull') {
        if (d.sma20 > d.sma50 && d.prevSMA20 <= d.prevSMA50) hit = true;
      } else if (a.cond === 'ma_cross_bear') {
        if (d.sma20 < d.sma50 && d.prevSMA20 >= d.prevSMA50) hit = true;
      } else if (a.cond === 'price_above' && d.lastPrice > a.val) hit = true;
      else if (a.cond === 'price_below' && d.lastPrice < a.val) hit = true;
      else if (a.cond === 'rsi_above' && d.rsi > a.val) hit = true;
      else if (a.cond === 'rsi_below' && d.rsi < a.val) hit = true;

      if (hit && (a.notify === 'repeat' || !a.triggered)) {
        setAlerts(prev => prev.map(x => x.id === a.id ? { ...x, triggered: true } : x));
        const logLine = `[${new Date().toLocaleTimeString()}] ALERT: ${a.pair} — ${condLabel(a.cond, a.val)}`;
        setAlertLogLines(prev => [logLine, ...prev].slice(0, 100));
      }
    });
  }, [pairData]);

  const needsVal = ['price_above','price_below','rsi_above','rsi_below'].includes(cond);

  return (
    <div className="page">
      <div className="section-head">
        <span className="section-title">Price Alerts</span>
        <span className="section-sub">Fires when a condition is met on the next data refresh (every 60 seconds, or instantly via streaming)</span>
      </div>
      <div className="alert-form" id="alertForm">
        <div className="form-group">
          <label>PAIR</label>
          <select value={pair} onChange={e => setPair(e.target.value)}>
            <option>EUR/USD</option><option>GBP/USD</option><option>USD/JPY</option>
            <option>USD/CHF</option><option>AUD/USD</option><option>USD/CAD</option>
            <option>XAU/USD</option>
          </select>
        </div>
        <div className="form-group">
          <label>CONDITION</label>
          <select value={cond} onChange={e => { setCond(e.target.value); if (!['price_above','price_below','rsi_above','rsi_below'].includes(e.target.value)) setValue(''); }}>
            <option value="price_above">Price rises above</option>
            <option value="price_below">Price falls below</option>
            <option value="rsi_above">RSI rises above</option>
            <option value="rsi_below">RSI falls below</option>
            <option value="ma_cross_bull">MA bullish crossover</option>
            <option value="ma_cross_bear">MA bearish crossover</option>
          </select>
        </div>
        {needsVal && (
          <div className="form-group" id="alertValueGroup">
            <label>VALUE</label>
            <input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. 1.0900" step="any" style={{ width: 110 }} />
          </div>
        )}
        <div className="form-group">
          <label>NOTIFY</label>
          <select value={notify} onChange={e => setNotify(e.target.value)}>
            <option value="once">Once</option>
            <option value="repeat">Every trigger</option>
          </select>
        </div>
        <div></div>
        <div className="form-group">
          <label>&nbsp;</label>
          <button className="btn-primary" onClick={addAlert}>Add alert</button>
        </div>
      </div>

      <div className="section-head">
        <span className="section-title">Active alerts</span>
        <span className="section-sub" id="alertCount">{alerts.length} configured</span>
      </div>
      <div className="alerts-list" id="alertsList">
        {alerts.length === 0 && (
          <div className="placeholder-block" style={{ padding: 32 }}><p>No alerts set. Add one above.</p></div>
        )}
        {alerts.map(a => (
          <div key={a.id} className={`alert-item ${a.triggered ? 'triggered' : ''}`} id={`alert-${a.id}`}>
            <div className="alert-desc">
              <strong>{a.pair}</strong> — {condLabel(a.cond, a.val)}
              <div style={{ fontSize: 10, color: 'var(--color-text-faint)', marginTop: 3 }}>Notify: {a.notify} · Added {new Date(a.id).toLocaleTimeString()}</div>
            </div>
            <div className={`alert-status ${a.triggered ? 'hit' : ''}`}>{a.triggered ? '✓ TRIGGERED' : 'Watching…'}</div>
            <button className="btn-danger" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => removeAlert(a.id)}>Remove</button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <div className="section-head">
          <span className="section-title">Alert log</span>
        </div>
        <div className="alert-log" id="alertLog">
          {alertLogLines.length === 0 ? 'Waiting for triggers…' : alertLogLines.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      </div>
    </div>
  );
}

function condLabel(cond, val) {
  const m = {
    price_above: `Price rises above ${val}`,
    price_below: `Price falls below ${val}`,
    rsi_above: `RSI rises above ${val}`,
    rsi_below: `RSI falls below ${val}`,
    ma_cross_bull: 'SMA 20 crosses above SMA 50',
    ma_cross_bear: 'SMA 20 crosses below SMA 50',
  };
  return m[cond] || cond;
}