export const computeRSI = (closes, period = 14) => {
  if (closes.length <= period) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  const ag = gains / period, al = losses / period;
  if (al === 0) return 100;
  return 100 - 100 / (1 + ag / al);
};

export const computeSMA = (closes, period) =>
  closes.slice(-period).reduce((a, b) => a + b, 0) / period;

export const computeATR = (closes, highs = null, lows = null, period = 14) => {
  if (closes.length < period + 1) return null;
  const trValues = [];
  for (let i = 1; i < closes.length; i++) {
    const prevClose = closes[i - 1];
    const h = highs ? highs[i] : closes[i];
    const l = lows ? lows[i] : closes[i];
    trValues.push(Math.max(h - l, Math.abs(h - prevClose), Math.abs(l - prevClose)));
  }
  const slice = trValues.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
};

export const computeMomentum = (closes, period = 10) => {
  if (closes.length <= period) return null;
  return closes[closes.length - 1] - closes[closes.length - period - 1];
};

export const computeDailyReturn = (closes) => {
  if (closes.length < 2) return 0;
  return (closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2];
};

export const computeVolatilityPercentile = (returns, currentAbsReturn) => {
  if (returns.length < 20) return 50;
  const sorted = [...returns.map(r => Math.abs(r))].sort((a, b) => a - b);
  const pos = sorted.findIndex(v => v >= currentAbsReturn);
  return pos === -1 ? 100 : (pos / sorted.length) * 100;
};