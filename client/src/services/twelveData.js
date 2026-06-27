const API_BASE = 'https://api.twelvedata.com/time_series';

export const fetchTwelveData = async (pair, apiKey) => {
  const url = `${API_BASE}?symbol=${encodeURIComponent(pair)}&interval=1day&outputsize=200&apikey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.status === 'error') throw new Error(data.message);
  return data.values.reverse().map(v => parseFloat(v.close));
};