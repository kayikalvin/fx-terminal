import { useState } from 'react';
import { useAppContext } from '../context/AppContext';

export default function Settings() {
  const { appSettings, setAppSettings } = useAppContext();
  const [primaryFeed, setPrimaryFeed] = useState(appSettings.primaryFeed);
  const [keys, setKeys] = useState(appSettings.keys);
  const [newsSource, setNewsSource] = useState(appSettings.newsSource);
  const [newsKeyOverride, setNewsKeyOverride] = useState(appSettings.newsKeyOverride);

  const save = () => {
    const newSettings = { primaryFeed, keys, newsSource, newsKeyOverride };
    setAppSettings(newSettings);
    localStorage.setItem('fxTerminalSettings', JSON.stringify(newSettings));
    alert('Settings saved!');
  };

  return (
    <div className="page">
      <div className="section-head">
        <span className="section-title">API Configuration</span>
        <span className="section-sub">Keys are stored in your browser's localStorage. Never share this file.</span>
      </div>
      <div className="settings-grid">
        <div className="setting-block">
          <h3>Market Data Providers</h3>
          <div className="setting-row">
            <label>Primary Price Feed</label>
            <select value={primaryFeed} onChange={e => setPrimaryFeed(e.target.value)}>
              <option value="av">Alpha Vantage</option>
              <option value="twelve">Twelve Data</option>
              <option value="finnhub">Finnhub (live streaming)</option>
              <option value="oanda">OANDA Practice (needs account)</option>
            </select>
          </div>
          {Object.entries({
            av: 'Alpha Vantage Key',
            twelve: 'Twelve Data Key',
            finnhub: 'Finnhub Key (API Key)',
            oandaToken: 'OANDA Token',
            oandaAccountId: 'OANDA Account ID'
          }).map(([field, label]) => (
            <div className="setting-row" key={field}>
              <label>{label}</label>
              <input type="text" value={keys[field] || ''} onChange={e => setKeys({ ...keys, [field]: e.target.value })} placeholder="Key" />
            </div>
          ))}
        </div>
        <div className="setting-block">
          <h3>News & Calendar</h3>
          <div className="setting-row">
            <label>News Source</label>
            <select value={newsSource} onChange={e => setNewsSource(e.target.value)}>
              <option value="finnhub">Finnhub</option>
            </select>
          </div>
          <div className="setting-row">
            <label>Finnhub Key (override)</label>
            <input type="text" value={newsKeyOverride} onChange={e => setNewsKeyOverride(e.target.value)} placeholder="Leave empty to use main Finnhub key" />
          </div>
        </div>
        <div className="setting-block" style={{ gridColumn: 'span 2' }}>
          <button className="btn-primary btn-save-settings" onClick={save}>Save All Settings</button>
          <p style={{ fontSize: 11, color: 'var(--color-text-faint)', marginTop: 8 }}>
            For real‑time streaming, select <strong>Finnhub</strong> and paste your <strong>API Key</strong> (short string). For charts & history, <strong>Twelve Data</strong> key is required (free, 800 req/day).
          </p>
        </div>
      </div>
    </div>
  );
}