import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { fetchHistoricalOHLC } from '../services/dataProviders';
import { computeRSI, computeSMA } from '../services/indicators';
import { computeFeatures } from '../services/featureEngine';

export default function Backtester() {
  const { pairData, setPairData, appSettings } = useAppContext();
  const [pair, setPair] = useState('EUR/USD');
  const [entry, setEntry] = useState('rsi_oversold');
  const [hold, setHold] = useState(5);
  const [dir, setDir] = useState('long');
  const [stop, setStop] = useState(1.5);
  const [tp, setTp] = useState(3);
  const [results, setResults] = useState(null); // { statsHtml, tableHtml, equity }

  const canvasRef = useRef(null);

  const exportDataset = () => {
    const data = pairData[pair]?.closes;
    if (!data || data.length < 60) {
      alert('Not enough data to export. Add the pair to Dashboard first.');
      return;
    }
    const feats = computeFeatures(data);
    const rows = [['Date','RSI_norm','Dist_SMA20','Dist_SMA50','ATR_pct','Momentum_norm','Trend','Daily_Return','Volatility_percentile','Target']];
    for (let i = 0; i < feats.length - 1; i++) {
      const f = feats[i];
      const target = data[i+1] / data[i] - 1 > 0 ? 1 : 0;
      rows.push([
        f.date,
        f.rsiNorm.toFixed(6),
        f.dist20.toFixed(6),
        f.dist50.toFixed(6),
        f.atr.toFixed(6),
        (f.momentum / data[i]).toFixed(6),
        f.trend,
        f.dailyReturn.toFixed(6),
        (f.volatilityPercentile / 100).toFixed(6),
        target,
      ]);
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pair.replace('/', '_')}_training.csv`;
    a.click();
  };

  const runBacktest = async () => {
    let closes;
    if (pairData[pair]?.closes) {
      closes = pairData[pair].closes;
    } else {
      try {
        const ohlc = await fetchHistoricalOHLC(pair);
        closes = ohlc.map(d => d.close);
        setPairData(prev => ({ ...prev, [pair]: { ...prev[pair], closes, ohlc } }));
      } catch (e) {
        alert(e.message);
        return;
      }
    }
    if (!closes || closes.length < 60) {
      alert('Not enough data (need 60+).');
      return;
    }

    const rsiArr = [], sma20Arr = [], sma50Arr = [], momArr = [];
    for (let i = 0; i < closes.length; i++) {
      const slice = closes.slice(0, i + 1);
      rsiArr.push(computeRSI(slice, 14));
      sma20Arr.push(slice.length >= 20 ? computeSMA(slice, 20) : null);
      sma50Arr.push(slice.length >= 50 ? computeSMA(slice, 50) : null);
      momArr.push(i >= 10 ? slice[i] - slice[i - 10] : null);
    }

    const trades = [];
    let equity = [100];
    const stopPct = stop / 100, tpPct = tp / 100;
    for (let i = 52; i < closes.length - hold; i++) {
      const signal = checkEntry(entry, i, rsiArr, sma20Arr, sma50Arr, momArr);
      if (!signal) continue;
      const entryPrice = closes[i];
      let exitPrice = closes[i + hold], exitReason = 'hold';
      for (let j = 1; j <= hold; j++) {
        const p = closes[i + j];
        const ret = dir === 'long' ? (p - entryPrice) / entryPrice : (entryPrice - p) / entryPrice;
        if (ret <= -stopPct) { exitPrice = p; exitReason = 'stop'; break; }
        if (ret >= tpPct) { exitPrice = p; exitReason = 'tp'; break; }
      }
      const ret = dir === 'long' ? (exitPrice - entryPrice) / entryPrice : (entryPrice - exitPrice) / entryPrice;
      equity.push(equity[equity.length - 1] * (1 + ret));
      trades.push({ entryPrice, exitPrice, ret, exitReason });
    }

    if (!trades.length) {
      setResults({ empty: true });
      return;
    }

    const wins = trades.filter(t => t.ret > 0), losses = trades.filter(t => t.ret <= 0);
    const winRate = ((wins.length / trades.length) * 100).toFixed(1);
    const totalReturn = (equity[equity.length - 1] - 100).toFixed(2);
    const avgWin = wins.length ? ((wins.reduce((s, t) => s + t.ret, 0) / wins.length) * 100).toFixed(2) : '0.00';
    const avgLoss = losses.length ? ((losses.reduce((s, t) => s + t.ret, 0) / losses.length) * 100).toFixed(2) : '0.00';
    let peak = 100, maxDD = 0;
    equity.forEach(v => { if (v > peak) peak = v; const dd = (peak - v) / peak; if (dd > maxDD) maxDD = dd; });
    const rets = trades.map(t => t.ret);
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const std = Math.sqrt(rets.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / rets.length);
    const sharpe = std > 0 ? ((mean / std) * Math.sqrt(252 / rets.length)).toFixed(2) : 'n/a';
    const isPositive = parseFloat(totalReturn) >= 0;

    const statsHtml = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-label">Total return</div><div class="stat-val ${isPositive ? 'bull' : 'bear'}">${isPositive ? '+' : ''}${totalReturn}%</div><div class="stat-note">100 → ${equity[equity.length - 1].toFixed(2)}</div></div>
        <div class="stat-card"><div class="stat-label">Win rate</div><div class="stat-val ${winRate >= 50 ? 'bull' : 'bear'}">${winRate}%</div><div class="stat-note">${wins.length}W / ${losses.length}L</div></div>
        <div class="stat-card"><div class="stat-label">Max drawdown</div><div class="stat-val bear">-${(maxDD * 100).toFixed(1)}%</div><div class="stat-note">Largest peak-to-trough</div></div>
        <div class="stat-card"><div class="stat-label">Avg win</div><div class="stat-val bull">+${avgWin}%</div></div>
        <div class="stat-card"><div class="stat-label">Avg loss</div><div class="stat-val bear">${avgLoss}%</div></div>
        <div class="stat-card"><div class="stat-label">Sharpe</div><div class="stat-val neutral">${sharpe}</div><div class="stat-note">Risk-adjusted</div></div>
      </div>
    `;

    const tableHtml = `
      <div class="trade-log-wrap">
        <div class="trade-log-head">TRADE LOG — ${pair} · ${dir.toUpperCase()} · ${entry.replace(/_/g, ' ')}</div>
        <div class="trade-log-scroll">
          <table>
            <tr><th>#</th><th>ENTRY</th><th>EXIT</th><th>RETURN</th><th>REASON</th></tr>
            ${trades.slice(-50).map((t, i) => `
              <tr>
                <td>${i+1}</td><td>${t.entryPrice.toFixed(5)}</td><td>${t.exitPrice.toFixed(5)}</td>
                <td class="${t.ret >= 0 ? 'win' : 'loss'}">${(t.ret * 100).toFixed(3)}%</td>
                <td>${t.exitReason === 'stop' ? '⛔ Stop' : t.exitReason === 'tp' ? '✅ TP' : '⏱ Hold'}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      </div>
      <div style="font-size:11px;color:var(--color-text-faint);line-height:1.7;padding:10px 0;">
        ⚠ <strong style="color:var(--color-text-dim)">Backtest limitations:</strong> Daily closes, no slippage/spread/commissions. Past performance ≠ future results.
      </div>
    `;

    // equity stored as real state -> canvas is a real React element redrawn by useEffect,
    // so it survives any unrelated re-render (e.g. background MT5 polling on the Charts tab)
    setResults({ statsHtml, tableHtml, equity });
  };

  // Redraw the equity curve any time `results.equity` changes OR the canvas element
  // itself gets recreated by React (covers container resizes too).
  useEffect(() => {
    if (!results || results.empty) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const equity = results.equity;
      const W = canvas.parentElement.clientWidth - 32 || 300;
      const H = 160;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      const min = Math.min(...equity), max = Math.max(...equity), range = max - min || 1, pad = 8;
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = '#1E2D45';
      for (let i = 0; i <= 4; i++) {
        const y = pad + (H - 2 * pad) * (1 - i / 4);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      const pts = equity.map((v, i) => ({
        x: (i / (equity.length - 1)) * (W - 2 * pad) + pad,
        y: H - pad - ((v - min) / range) * (H - 2 * pad),
      }));
      const finalAbove100 = equity[equity.length - 1] >= 100;
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      if (finalAbove100) { grad.addColorStop(0, 'rgba(61,184,124,0.25)'); grad.addColorStop(1, 'rgba(61,184,124,0)'); }
      else { grad.addColorStop(0, 'rgba(224,90,58,0.25)'); grad.addColorStop(1, 'rgba(224,90,58,0)'); }
      ctx.beginPath(); ctx.moveTo(pts[0].x, H - pad); pts.forEach(p => ctx.lineTo(p.x, p.y)); ctx.lineTo(pts[pts.length - 1].x, H - pad); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath(); pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = finalAbove100 ? '#3DB87C' : '#E05A3A'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#3D4A61'; ctx.font = '10px JetBrains Mono';
      ctx.fillText(max.toFixed(1), 4, 14); ctx.fillText(min.toFixed(1), 4, H - 4);
    };

    draw();

    // Redraw on container resize too (e.g. sidebar toggle, window resize)
    const ro = new ResizeObserver(draw);
    ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  }, [results]);

  return (
    <div className="page">
      <div className="section-head">
        <span className="section-title">Strategy Backtester</span>
        <span className="section-sub">Define a rule‑based strategy, run it on historical daily closes</span>
      </div>
      <div className="backtest-layout">
        <div className="backtest-form">
          <div className="form-group">
            <label>INSTRUMENT</label>
            <select value={pair} onChange={e => setPair(e.target.value)}>
              <option>EUR/USD</option><option>GBP/USD</option><option>USD/JPY</option><option>AUD/USD</option><option>XAU/USD</option>
            </select>
          </div>
          <div className="form-group">
            <label>ENTRY SIGNAL</label>
            <select value={entry} onChange={e => setEntry(e.target.value)}>
              <option value="rsi_oversold">RSI drops below 30 (oversold)</option>
              <option value="rsi_overbought">RSI rises above 70 (overbought)</option>
              <option value="sma_cross_bull">SMA 20 crosses above SMA 50</option>
              <option value="sma_cross_bear">SMA 20 crosses below SMA 50</option>
              <option value="mom_positive">Momentum turns positive</option>
              <option value="mom_negative">Momentum turns negative</option>
            </select>
          </div>
          <div className="form-group">
            <label>EXIT AFTER (DAYS)</label>
            <input type="number" value={hold} onChange={e => setHold(+e.target.value)} style={{ width: '100%' }} />
          </div>
          <div className="form-group">
            <label>DIRECTION</label>
            <select value={dir} onChange={e => setDir(e.target.value)}>
              <option value="long">Long (buy on entry)</option><option value="short">Short (sell on entry)</option>
            </select>
          </div>
          <div className="form-group">
            <label>STOP LOSS (%)</label>
            <input type="number" value={stop} onChange={e => setStop(+e.target.value)} style={{ width: '100%' }} />
          </div>
          <div className="form-group">
            <label>TAKE PROFIT (%)</label>
            <input type="number" value={tp} onChange={e => setTp(+e.target.value)} style={{ width: '100%' }} />
          </div>
          <button className="btn-primary" onClick={runBacktest} style={{ marginTop: 4 }}>Run backtest</button>
          <button className="btn-primary" onClick={exportDataset} style={{ marginTop: 4 }}>Export Training Dataset (CSV)</button>
          <p style={{ fontSize: 11, color: 'var(--color-text-faint)', lineHeight: 1.6 }}>Uses daily closes from Yahoo Finance / Stooq. No API key needed.</p>
        </div>
        <div className="backtest-results" id="btResults">
          {results && !results.empty ? (
            <>
              <div dangerouslySetInnerHTML={{ __html: results.statsHtml }} />
              <div className="equity-chart">
                <canvas ref={canvasRef} height="160" />
              </div>
              <div dangerouslySetInnerHTML={{ __html: results.tableHtml }} />
            </>
          ) : results?.empty ? (
            <div className="placeholder-block"><p>No trades triggered.</p></div>
          ) : (
            <div className="placeholder-block" style={{ padding: 48 }}>
              <p>Configure a strategy on the left and click Run backtest.<br />Results will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function checkEntry(signal, idx, rsiArr, sma20Arr, sma50Arr, momArr) {
  switch (signal) {
    case 'rsi_oversold': return rsiArr[idx] < 30;
    case 'rsi_overbought': return rsiArr[idx] > 70;
    case 'sma_cross_bull': return sma20Arr[idx] > sma50Arr[idx] && sma20Arr[idx - 1] <= sma50Arr[idx - 1];
    case 'sma_cross_bear': return sma20Arr[idx] < sma50Arr[idx] && sma20Arr[idx - 1] >= sma50Arr[idx - 1];
    case 'mom_positive': return momArr[idx] > 0 && momArr[idx - 1] <= 0;
    case 'mom_negative': return momArr[idx] < 0 && momArr[idx - 1] >= 0;
    default: return false;
  }
}