const DEFAULT_SERVER = 'http://localhost:8000';

async function fetchFromMT5(endpoint, serverUrl) {
  const base = serverUrl || DEFAULT_SERVER;
  const resp = await fetch(`${base}/${endpoint}`);
  if (!resp.ok) throw new Error(`MT5 server error: ${resp.status}`);
  return resp.json();
}

export async function checkMT5Health(serverUrl) {
  return fetchFromMT5('health', serverUrl);
}

export async function fetchMT5Price(pair, serverUrl) {
  const symbol = pair.replace('/', '');
  return fetchFromMT5(`price/${symbol}`, serverUrl);
}

export async function fetchMT5HistoricalOHLC(pair, serverUrl, timeframe = 'D', bars = 500) {
  const symbol = pair.replace('/', '');
  const data = await fetchFromMT5(`history/${symbol}?timeframe=${timeframe}&bars=${bars}`, serverUrl);
  // MT5 returns Date (ISO), Open, High, Low, Close, Volume
  return data.map(d => ({
    time: Math.floor(new Date(d.Date).getTime() / 1000),
    open: d.Open,
    high: d.High,
    low: d.Low,
    close: d.Close,
    volume: d.Volume || 0,
  }));
}