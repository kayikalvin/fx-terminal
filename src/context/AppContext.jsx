import { createContext, useContext, useState, useEffect } from 'react';
import { computeRSI, computeSMA, computeATR } from '../services/indicators';
import { fetchTwelveData } from '../services/twelveData';
import { connectFinnhubStream } from '../services/finnhubStream';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [appSettings, setAppSettings] = useState(() => {
    const stored = localStorage.getItem('fxTerminalSettings');
    return stored ? JSON.parse(stored) : {
      primaryFeed: 'av',
      keys: { av: '', twelve: '', finnhub: '', oandaToken: '', oandaAccountId: '' },
      newsSource: 'finnhub',
      newsKeyOverride: ''
    };
  });
  const [provider, setProvider] = useState(appSettings.primaryFeed);
  const [apiKey, setApiKey] = useState(appSettings.keys[appSettings.primaryFeed] || '');
  const [activePairs, setActivePairs] = useState([]);
  const [pairData, setPairData] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [alertLogLines, setAlertLogLines] = useState([]);
  const [finnhubWs, setFinnhubWs] = useState(null);
  const [oandaWs, setOandaWs] = useState(null);

  useEffect(() => {
    localStorage.setItem('fxTerminalSettings', JSON.stringify(appSettings));
  }, [appSettings]);

  const safeid = (pair) => pair.replace('/', '-');

  const getHistoryProvider = () => {
    if (provider === 'finnhub') {
      if (appSettings.keys.twelve) return 'twelve';
      if (appSettings.keys.av) return 'av';
      return null;
    }
    return provider;
  };

  const getHistoryKey = () => {
    if (provider === 'finnhub') return appSettings.keys.twelve || appSettings.keys.av;
    return apiKey;
  };

  const fetchPair = async (pair) => {
    if (provider === 'oanda') return;
    const histProvider = getHistoryProvider();
    if (!histProvider && provider === 'finnhub') throw new Error('Add a Twelve Data key in Settings.');
    let closes;
    const key = getHistoryKey();
    if (histProvider === 'twelve') closes = await fetchTwelveData(pair, key);
    else if (histProvider === 'av') {
      const [from, to] = pair.split('/');
      const url = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${encodeURIComponent(from)}&to_symbol=${encodeURIComponent(to)}&apikey=${key}&outputsize=full`;
      const d = await (await fetch(url)).json();
      if (d['Note']) throw new Error('Alpha Vantage rate limit hit.');
      if (d['Information']) throw new Error(d['Information']);
      const raw = d['Time Series FX (Daily)'];
      if (!raw) throw new Error('No data');
      closes = Object.entries(raw).sort((a,b) => new Date(a[0]) - new Date(b[0])).slice(-200).map(([,v]) => parseFloat(v['4. close']));
    } else throw new Error('No historical data provider.');
    if (!closes || closes.length < 21) throw new Error('Not enough data.');
    setPairData(prev => ({ ...prev, [pair]: { ...prev[pair], closes } }));
    updateCard(pair, closes);
  };

  const updateCard = (pair, closes) => {
    const last = closes[closes.length-1];
    const rsi = computeRSI(closes, 14);
    const sma20 = computeSMA(closes, 20);
    const sma50 = closes.length >= 50 ? computeSMA(closes, 50) : null;
    const mom = closes.length > 10 ? last - closes[closes.length-11] : null;
    const atr = computeATR(closes);
    setPairData(prev => ({
      ...prev,
      [pair]: { ...prev[pair], closes, rsi, sma20, sma50, mom, lastPrice: last, atr }
    }));
  };

  // Streaming
  const startStreaming = () => {
    if (provider === 'finnhub' && apiKey && activePairs.length > 0) {
      const ws = connectFinnhubStream(apiKey, activePairs, (pair, price, volume) => {
        setPairData(prev => {
          const d = prev[pair] || { ticks: [] };
          d.lastPrice = price;
          if (volume) {
            d.cumVolPrice = (d.cumVolPrice || 0) + price * volume;
            d.cumVolume = (d.cumVolume || 0) + volume;
            d.vwap = d.cumVolume > 0 ? d.cumVolPrice / d.cumVolume : null;
          }
          d.ticks = [...(d.ticks || []).slice(-499), { time: Date.now(), mid: price }];
          return { ...prev, [pair]: d };
        });
      });
      setFinnhubWs(ws);
    }
  };

  useEffect(() => {
    startStreaming();
    return () => { if (finnhubWs) finnhubWs.close(); };
  }, [provider, apiKey, activePairs]);

  return (
    <AppContext.Provider value={{
      appSettings, setAppSettings,
      provider, setProvider,
      apiKey, setApiKey,
      activePairs, setActivePairs,
      pairData, setPairData,
      alerts, setAlerts,
      alertLogLines, setAlertLogLines,
      finnhubWs, setFinnhubWs,
      oandaWs, setOandaWs,
      safeid, fetchPair, updateCard
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);