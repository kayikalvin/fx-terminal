

// ─── helpers ──────────────────────────────────────
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithProxy(url, timeoutMs = 10000) {
  const proxies = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest=',
  ];
  for (const proxy of proxies) {
    try {
      const resp = await fetchWithTimeout(proxy + encodeURIComponent(url), {}, timeoutMs);
      if (resp.ok) return resp;
    } catch (e) { /* try next proxy */ }
  }
  throw new Error('All CORS proxies failed');
}

// ─── MT5 bridge ───────────────────────────────────
import {
  fetchMT5HistoricalOHLC,
  fetchMT5Price,
  checkMT5Health,
} from './mt5Provider';

// ─── Yahoo Finance (direct) ──────────────────────
async function fetchYahoo(pair) {
  const symbol = pair.replace('/', '') + '=X';
  const period1 = Math.floor(Date.now() / 1000) - 86400 * 365 * 2;
  const period2 = Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d`;
  const resp = await fetchWithTimeout(url);
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

// ─── Yahoo Finance via CORS proxy ────────────────
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

// ─── Stooq via proxy ─────────────────────────────
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

// ─── Fallback chain (no MT5) ─────────────────────
async function fetchWebFallback(pair) {
  try { return await fetchYahooProxy(pair); } catch (e) {
    console.warn('Yahoo proxy failed:', e.message);
  }
  try { return await fetchStooq(pair); } catch (e) {
    console.warn('Stooq proxy failed:', e.message);
  }
  try { return await fetchYahoo(pair); } catch (e) {
    console.warn('Direct Yahoo failed:', e.message);
  }
  throw new Error('All web data sources are unavailable.');
}

/**
 * Main export – tries MT5 bridge first (with timeout), then web fallback.
 */
export async function fetchHistoricalOHLC(pair, timeframe = 'D', bars = 500, serverUrl) {
  // 1. MT5 bridge – race with a 10s timeout
  try {
    const data = await Promise.race([
      fetchMT5HistoricalOHLC(pair, serverUrl, timeframe, bars),
      new Promise((_, reject) => setTimeout(() => reject(new Error('MT5 bridge timeout')), 10000))
    ]);
    if (data && data.length > 0) return data;
  } catch (e) {
    console.warn('MT5 bridge unavailable:', e.message);
  }

  // 2. Web fallback (daily only – timeframe is ignored)
  return fetchWebFallback(pair);
}

export async function fetchLivePrice(pair, serverUrl) {
  return fetchMT5Price(pair, serverUrl);
}

export async function fetchBridgeHealth(serverUrl) {
  try {
    const data = await checkMT5Health(serverUrl);
    return {
      connected: data.status === 'connected',
      account: data.account ?? null,
      balance: data.balance ?? null,
      error: data.status === 'error' ? data.message : null,
    };
  } catch (e) {
    return { connected: false, account: null, balance: null, error: e.message };
  }
}