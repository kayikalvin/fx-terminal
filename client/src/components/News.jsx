import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

export default function News() {
  const { appSettings, provider } = useAppContext();
  const [news, setNews] = useState([]);
  const [cot, setCot] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [surprise, setSurprise] = useState([]);
  const [filter, setFilter] = useState('');

  const fetchNews = async () => {
    const newsKey = appSettings.newsKeyOverride || appSettings.keys.finnhub;
    if (!newsKey) return;
    try {
      const res = await fetch(`https://finnhub.io/api/v1/news?category=forex&token=${newsKey}`);
      const data = await res.json();
      const filtered = filter ? data.filter(n => (n.headline + (n.summary || '')).toLowerCase().includes(filter.toLowerCase())) : data;
      setNews(filtered.slice(0, 20));
    } catch (e) { console.error(e); }
  };

  const fetchCOT = async () => {
    const pairMap = { 'EURO FX': 'EUR/USD', 'BRITISH POUND': 'GBP/USD', 'JAPANESE YEN': 'USD/JPY', 'AUSTRALIAN DOLLAR': 'AUD/USD', 'SWISS FRANC': 'USD/CHF', 'CANADIAN DOLLAR': 'USD/CAD', 'NEW ZEALAND DOLLAR': 'NZD/USD', 'GOLD': 'XAU/USD', 'SILVER': 'XAG/USD' };
    const promises = Object.keys(pairMap).map(async commodity => {
      const res = await fetch(`https://www.cftc.gov/api/v1/cot?format=json&market=futures&commodity=${encodeURIComponent(commodity)}`);
      if (!res.ok) return null;
      const data = await res.json();
      const cot = data.cotData?.[0];
      if (!cot) return null;
      const net = (cot.nonCommLong || 0) - (cot.nonCommShort || 0);
      return { pair: pairMap[commodity], net, label: net > 0 ? 'Net Long' : net < 0 ? 'Net Short' : 'Neutral', bias: net > 0 ? 'bull' : net < 0 ? 'bear' : 'neutral' };
    });
    const results = (await Promise.all(promises)).filter(r => r);
    setCot(results);
  };

  const fetchCalendar = async () => {
    const newsKey = appSettings.newsKeyOverride || appSettings.keys.finnhub;
    if (!newsKey) return;
    const from = new Date(), to = new Date(); to.setDate(to.getDate()+5);
    const url = `https://finnhub.io/api/v1/calendar/economic?from=${from.toISOString().split('T')[0]}&to=${to.toISOString().split('T')[0]}&token=${newsKey}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      let events = data.economicCalendar || [];
      if (filter) events = events.filter(e => e.currency === (filter === 'gold' ? 'XAU' : filter.toUpperCase()));
      setCalendar(events.slice(0, 15));
      // surprise index
      const scores = {};
      events.forEach(e => { if (e.actual && e.forecast && e.currency) { const diff = e.actual - e.forecast; if (!scores[e.currency]) scores[e.currency] = { total: 0, count: 0 }; scores[e.currency].total += diff; scores[e.currency].count++; } });
      const arr = Object.entries(scores).map(([cur, v]) => ({ currency: cur, avg: (v.total / v.count).toFixed(2) }));
      setSurprise(arr);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchNews(); fetchCOT(); fetchCalendar(); }, [filter]);

  return (
    <div className="page">
      <div className="section-head">
        <span className="section-title">Market Context</span>
        <span className="section-sub">Macro news + COT positioning data + economic calendar + Surprise Index — context, not signals</span>
      </div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
        <button className="btn-blue" onClick={fetchNews}>Refresh news (needs Finnhub key)</button>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          <option value="">All currencies</option>
          <option value="EUR">EUR</option><option value="GBP">GBP</option><option value="USD">USD</option>
          <option value="JPY">JPY</option><option value="AUD">AUD</option><option value="gold">Gold</option>
        </select>
      </div>
      <div className="news-grid">
        <div className="news-panel">
          <div className="news-panel-head"><span>📰</span> Macro News</div>
          <div className="news-scroll" id="newsScroll">
            {news.length === 0 && <div style={{ padding: 24, color: 'var(--color-text-faint)' }}>Click "Refresh news" above.</div>}
            {news.map((n, i) => (
              <div key={i} className="news-item">
                <div className="news-headline"><a href={n.url} target="_blank">{n.headline}</a>
                  <span className={`news-sentiment ${guessSentiment(n.headline)}`}>{guessSentiment(n.headline)}</span>
                </div>
                <div className="news-meta">{n.source} · {timeAgo(n.datetime * 1000)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="news-panel">
          <div className="news-panel-head"><span>📊</span> COT Positioning (CFTC)</div>
          <div id="cotPanel" style={{ padding: 10 }}>
            {cot.length === 0 && <div className="cot-warning">Loading COT data…</div>}
            {cot.map(r => (
              <div key={r.pair} className="cot-row">
                <span className="cot-pair">{r.pair}</span>
                <span className={`cot-bias ${r.bias}`}>{r.label} ({r.net})</span>
                <span className="cot-note">Non-commercial net positions</span>
              </div>
            ))}
            <div className="cot-warning">⚠ Updated Fridays for prior Tuesday.</div>
          </div>
        </div>
        <div className="news-panel" style={{ gridColumn: 'span 2' }}>
          <div className="news-panel-head"><span>📅</span> Economic Calendar (Finnhub)</div>
          <div className="news-scroll" id="econCalendar" style={{ maxHeight: 300 }}>
            {calendar.length === 0 && <div style={{ padding: 20, color: 'var(--color-text-faint)' }}>Click "Refresh news" to load calendar events.</div>}
            {calendar.map((e, i) => (
              <div key={i} className="news-item">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{e.currency} {e.impact === 'high' ? '🔴' : e.impact === 'medium' ? '🟡' : '⚪'}</strong><span style={{ color: 'var(--color-text-faint)' }}>{e.date} {e.time || ''}</span></div>
                <div style={{ marginTop: 4 }}>{e.event}</div>
                {e.actual && <div style={{ color: 'var(--color-text-dim)', fontSize: 11 }}>Actual: {e.actual} | Forecast: {e.forecast || '-'} | Previous: {e.previous || '-'}</div>}
              </div>
            ))}
          </div>
        </div>
        <div className="news-panel" style={{ gridColumn: 'span 2', marginTop: 16 }}>
          <div className="news-panel-head"><span>📈</span> Macro Surprise Index</div>
          <div className="news-scroll" id="surprisePanel" style={{ maxHeight: 200 }}>
            {surprise.length === 0 && <div style={{ padding: 20, color: 'var(--color-text-faint)' }}>Click "Refresh news" to compute surprise scores.</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 10 }}>
              {surprise.map(s => (
                <div key={s.currency} className="surprise-cell" style={{ color: s.avg > 0 ? 'var(--color-bull)' : s.avg < 0 ? 'var(--color-bear)' : 'var(--color-amber)' }}>{s.currency}: {s.avg > 0 ? '+' : ''}{s.avg}</div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-faint)', padding: 10 }}>Positive = better than forecast, Negative = worse than forecast</div>
          </div>
        </div>
      </div>
      <div className="footer-note">
        <strong>On using news and COT data:</strong> News tells you the narrative around a currency. COT positioning tells you what large speculators were holding earlier in the week. Neither is a reliable predictor of short-term price moves.
      </div>
    </div>
  );
}

function guessSentiment(headline) {
  const h = headline.toLowerCase();
  if (['rise','rises','rally','rallies','gains','surges','strength','higher','beats','beat'].some(w => h.includes(w))) return 'positive';
  if (['fall','falls','drop','drops','declines','weak','lower','miss','misses','concern','fear'].some(w => h.includes(w))) return 'negative';
  return 'neutral';
}
function timeAgo(ms) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
}