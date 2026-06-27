import {
  computeRSI,
  computeSMA,
  computeATR,
  computeMomentum,
  computeDailyReturn,
  computeVolatilityPercentile,
} from './indicators';

export function computeFeatures(closes, highs = [], lows = []) {
  const features = [];
  const len = closes.length;
  const rsiArr = [], sma20Arr = [], sma50Arr = [], atrArr = [], momArr = [];
  const dailyReturns = [];

  for (let i = 0; i < len; i++) {
    const slice = closes.slice(0, i + 1);
    rsiArr.push(computeRSI(slice, 14));
    sma20Arr.push(slice.length >= 20 ? computeSMA(slice, 20) : null);
    sma50Arr.push(slice.length >= 50 ? computeSMA(slice, 50) : null);
    atrArr.push(i >= 13 ? computeATR(slice, highs.slice(0, i + 1), lows.slice(0, i + 1), 14) : null);
    momArr.push(i >= 10 ? slice[i] - slice[i - 10] : null);
    if (i > 0) dailyReturns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    else dailyReturns.push(0);
  }

  for (let i = 0; i < len; i++) {
    const close = closes[i];
    const rsi = rsiArr[i];
    const sma20 = sma20Arr[i];
    const sma50 = sma50Arr[i];
    const atr = atrArr[i];
    const mom = momArr[i];
    const dailyRet = dailyReturns[i];

    const dist20 = sma20 ? (close - sma20) / close : 0;
    const dist50 = sma50 ? (close - sma50) / close : 0;
    const rsiNorm = (rsi - 50) / 50;
    const atrPct = atr ? atr / close : 0;
    const volPct = computeVolatilityPercentile(
      dailyReturns.slice(Math.max(0, i - 99), i + 1),
      Math.abs(dailyRet)
    );
    const trend = sma20 && sma50 ? (sma20 > sma50 ? 1 : 0) : 0;
    const weeklyRet = i >= 5 ? (close - closes[i - 5]) / closes[i - 5] : 0;
    const monthlyRet = i >= 20 ? (close - closes[i - 20]) / closes[i - 20] : 0;

    features.push({
      date: new Date(Date.now() - (len - 1 - i) * 86400000).toISOString().slice(0, 10),
      close,
      rsi,
      rsiNorm,
      sma20,
      sma50,
      dist20,
      dist50,
      atr: atrPct,
      momentum: mom,
      dailyReturn: dailyRet,
      weeklyReturn: weeklyRet,
      monthlyReturn: monthlyRet,
      volatilityPercentile: volPct,
      trend,
    });
  }

  return features;
}