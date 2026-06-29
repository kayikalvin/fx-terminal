import { createContext, useContext, useState, useEffect } from 'react';
import { computeRSI, computeSMA, computeATR } from '../services/indicators';
import {
  fetchHistoricalOHLC,       // ← combined MT5 + web fallback
  fetchLivePrice,
  fetchBridgeHealth,
} from '../services/dataProviders';
import { connectFinnhubStream } from '../services/finnhubStream';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [appSettings, setAppSettings] = useState(() => {
    const stored = localStorage.getItem('fxTerminalSettings');
    return stored ? JSON.parse(stored) : {
      primaryFeed: 'mt5',
      mt5ServerUrl: 'http://localhost:8000',
      keys: { finnhub: '', oandaToken: '', oandaAccountId: '' },
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
  const [selectedPair, setSelectedPair] = useState(null);
  const [mt5Status, setMt5Status] = useState('disconnected');

  const safeid = (pair) => pair.replace('/', '-');

  // Persist settings
  useEffect(() => {
    localStorage.setItem('fxTerminalSettings', JSON.stringify(appSettings));
  }, [appSettings]);

  // MT5 health check
  useEffect(() => {
    if (provider !== 'mt5') return;
    const check = async () => {
      const health = await fetchBridgeHealth(appSettings.mt5ServerUrl);
      setMt5Status(health.connected ? 'connected' : 'disconnected');
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [provider, appSettings.mt5ServerUrl]);

  // ── Fetch historical data (MT5 first, web fallback) ──
  const fetchPair = async (pair) => {
    if (provider === 'oanda') return;
    // Use the combined provider – it tries MT5 bridge first, then Yahoo/Stooq
    const ohlc = await fetchHistoricalOHLC(
      pair,
      'D',                         // daily by default for Dashboard cards
      500,
      appSettings.mt5ServerUrl
    );
    if (!ohlc || ohlc.length < 21) throw new Error('Not enough historical data.');
    const closes = ohlc.map(d => d.close);
    setPairData(prev => ({ ...prev, [pair]: { ...prev[pair], closes, ohlc } }));
    updateCard(pair, closes);
  };

  const updateCard = (pair, closes) => {
    const last = closes[closes.length - 1];
    const rsi = computeRSI(closes, 14);
    const sma20 = computeSMA(closes, 20);
    const sma50 = closes.length >= 50 ? computeSMA(closes, 50) : null;
    const mom = closes.length > 10 ? last - closes[closes.length - 11] : null;
    const atr = computeATR(closes);
    setPairData(prev => ({
      ...prev,
      [pair]: { ...prev[pair], closes, rsi, sma20, sma50, mom, lastPrice: last, atr }
    }));
  };

  // ── Live price polling (MT5 only, no web fallback for ticks) ──
  useEffect(() => {
    if (provider !== 'mt5' || activePairs.length === 0) return;
    const interval = setInterval(async () => {
      for (const pair of activePairs) {
        try {
          const tick = await fetchLivePrice(pair, appSettings.mt5ServerUrl);
          setPairData(prev => ({
            ...prev,
            [pair]: { ...prev[pair], lastPrice: tick.bid, bid: tick.bid, ask: tick.ask }
          }));
        } catch (e) {}
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [provider, activePairs, appSettings.mt5ServerUrl]);

  // ── Finnhub streaming (optional fallback for live prices) ──
  useEffect(() => {
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
      selectedPair, setSelectedPair,
      mt5Status,
      safeid, fetchPair, updateCard
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);