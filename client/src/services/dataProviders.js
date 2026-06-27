// ─── Proxy helper ─────────────────────────────────
async function fetchWithProxy(url) {
  // Try a few public CORS proxies; if one fails, use the next
  const proxies = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest='
  ];
  for (const proxy of proxies) {
    try {
      const resp = await fetch(proxy + encodeURIComponent(url));
      if (resp.ok) return resp;
    } catch (e) {}
  }
  throw new Error('All CORS proxies failed');
}

// ─── Yahoo Finance (direct – only works from backend) ───
async function fetchYahoo(pair) {
  const symbol = pair.replace('/', '') + '=X';
  const period1 = Math.floor(Date.now() / 1000) - 86400 * 365 * 2;
  const period2 = Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Yahoo Finance unavailable');
  const json = await resp.json();
  const result = json.chart.result[0];
  const t = result.timestamp;
  const o = result.indicators.quote[0].open;
  const h = result.indicators.quote[0].high;
  const l = result.indicators.quote[0].low;
  const c = result.indicators.quote[0].close;
  return t
    .map((ts, i) => ({
      time: ts,
      open: o[i] ?? c[i],
      high: h[i] ?? c[i],
      low: l[i] ?? c[i],
      close: c[i],
    }))
    .filter(d => d.close != null && d.time);
}

// ─── Yahoo Finance via CORS proxy ─────────────────
async function fetchYahooProxy(pair) {
  const symbol = pair.replace('/', '') + '=X';
  const period1 = Math.floor(Date.now() / 1000) - 86400 * 365 * 2;
  const period2 = Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d`;
  const resp = await fetchWithProxy(url);
  const json = await resp.json();
  const result = json.chart.result[0];
  const t = result.timestamp;
  const o = result.indicators.quote[0].open;
  const h = result.indicators.quote[0].high;
  const l = result.indicators.quote[0].low;
  const c = result.indicators.quote[0].close;
  return t
    .map((ts, i) => ({
      time: ts,
      open: o[i] ?? c[i],
      high: h[i] ?? c[i],
      low: l[i] ?? c[i],
      close: c[i],
    }))
    .filter(d => d.close != null && d.time);
}

// ─── Stooq (via proxy) ────────────────────────────
async function fetchStooq(pair) {
  const symbol = pair.replace('/', '').toLowerCase();
  const url = `https://stooq.com/q/d/l/?s=${symbol}&i=d`;
  const resp = await fetchWithProxy(url);
  const text = await resp.text();
  const lines = text.trim().split('\n');
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 5) continue;
    const date = new Date(cols[0]);
    if (isNaN(date.getTime())) continue;
    data.push({
      time: Math.floor(date.getTime() / 1000),
      open: parseFloat(cols[1]),
      high: parseFloat(cols[2]),
      low: parseFloat(cols[3]),
      close: parseFloat(cols[4]),
    });
  }
  return data.sort((a, b) => a.time - b.time);
}

// ─── Main export ─────────────────────────────────
export async function fetchHistoricalOHLC(pair) {
  // 1. Try Yahoo via CORS proxy (since direct is blocked in browser)
  try {
    return await fetchYahooProxy(pair);
  } catch (e) {
    console.warn('Yahoo proxy failed:', e.message);
  }

  // 2. Try Stooq via proxy
  try {
    return await fetchStooq(pair);
  } catch (e) {
    console.warn('Stooq proxy failed:', e.message);
  }

  // 3. Last resort: direct Yahoo (may work if CORS is relaxed)
  try {
    return await fetchYahoo(pair);
  } catch (e) {
    console.warn('Direct Yahoo failed:', e.message);
  }

  throw new Error(
    'All data sources are currently unavailable. Please check your internet connection.'
  );
}