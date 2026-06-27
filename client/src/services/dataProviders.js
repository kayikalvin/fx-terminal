// ─── Direct Yahoo Finance ─────────────────────────
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

// ─── Yahoo Finance via CORS proxy (fallback) ────
async function fetchYahooViaProxy(pair) {
  const symbol = pair.replace('/', '') + '=X';
  const period1 = Math.floor(Date.now() / 1000) - 86400 * 365 * 2;
  const period2 = Math.floor(Date.now() / 1000);
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d`;
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`;
  const resp = await fetch(proxyUrl);
  if (!resp.ok) throw new Error('Proxy Yahoo unavailable');
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

// ─── Stooq (last resort) ─────────────────────────
async function fetchStooq(pair) {
  const symbol = pair.replace('/', '').toLowerCase();
  const url = `https://stooq.com/q/d/l/?s=${symbol}&i=d`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Stooq unavailable');
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

// ─── Main export: try Yahoo → proxy Yahoo → Stooq ───
export async function fetchHistoricalOHLC(pair) {
  // 1. Direct Yahoo Finance (works from your network)
  try {
    return await fetchYahoo(pair);
  } catch (e) {
    console.warn('Direct Yahoo failed:', e.message);
  }

  // 2. Yahoo via CORS proxy (if direct is blocked)
  try {
    return await fetchYahooViaProxy(pair);
  } catch (e) {
    console.warn('Proxy Yahoo failed:', e.message);
  }

  // 3. Stooq (may be blocked, but it's a fallback)
  try {
    return await fetchStooq(pair);
  } catch (e) {
    console.warn('Stooq failed:', e.message);
  }

  throw new Error(
    'All data sources are currently unavailable. ' +
    'Please check your internet connection or try again later. ' +
    '(If the problem persists, you can still use a Twelve Data key in Settings.)'
  );
}