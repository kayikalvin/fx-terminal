import { useState, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { computeFeatures } from '../services/featureEngine';
import { computeATR } from '../services/indicators';

export default function MLResearch() {
  const { activePairs, pairData } = useAppContext();
  const [model, setModel] = useState(null);
  const [selectedPair, setSelectedPair] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [importMsg, setImportMsg] = useState('');
  const [importError, setImportError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // ── Load model.json ──────────────────────────────
  const loadModelFile = async (file) => {
    if (!file) return;
    setImportError('');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.weights || !data.features || !data.metrics || !data.scaler) {
        throw new Error('Missing required fields (weights, features, metrics, scaler).');
      }
      setModel(data);
      setPrediction(null);
      setInfoMsg('');
      setImportMsg(file.name);
    } catch (err) {
      setModel(null);
      setImportError(err.message);
    }
  };

  const handleImport = (e) => loadModelFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    loadModelFile(e.dataTransfer.files?.[0]);
  };

  // ── Build feature vector from already‑stored indicator values + minimal extra calc ─
  const buildFeatureVector = (pair) => {
    const d = pairData[pair];
    if (!d || !d.closes || d.closes.length < 60) return null;

    const closes = d.closes;
    const last = d.lastPrice;
    const prev = closes[closes.length - 2];

    // Reuse existing indicators
    const rsi_14 = d.rsi;
    const sma_20 = d.sma20;
    const sma_50 = d.sma50;
    const atr_14 = d.atr;                            // raw ATR from dashboard
    const sma20_dist = (last - sma_20) / last;
    const sma50_dist = (last - sma_50) / last;
    const ema_20 = sma_20;                           // fallback
    const ema20_dist = sma20_dist;
    const daily_return = (last - prev) / prev;
    const weekly_return = closes.length >= 6 ? (last - closes[closes.length - 6]) / closes[closes.length - 6] : 0;
    const monthly_return = closes.length >= 21 ? (last - closes[closes.length - 21]) / closes[closes.length - 21] : 0;
    const momentum = d.mom ?? 0;
    const rolling_volatility = d.rollingVol ?? 0;
    const atr_pct = atr_14 / last;
    const trend = d.sma20 > d.sma50 ? 1 : 0;
    const volatility_percentile = d.volPercentile ?? 50;
    const price_position = 0.5;   // not stored, neutral default

    const rawMap = {
      rsi_14, sma_20, sma_50, ema_20,
      atr_14, sma20_dist, sma50_dist, ema20_dist,
      daily_return, weekly_return, monthly_return,
      momentum, rolling_volatility, atr_pct,
      trend, volatility_percentile, price_position,
      rolling_high: last * 1.01, rolling_low: last * 0.99
    };

    return model.features.map(name => rawMap[name] ?? 0);
  };

  // ── Prediction ──────────────────────────────────
  const predictPair = () => {
    setInfoMsg('');
    if (!model || !selectedPair) return;

    if (!pairData[selectedPair] || !pairData[selectedPair].closes || pairData[selectedPair].closes.length < 60) {
      setInfoMsg(`No historical data for ${selectedPair}. Add this pair to the Dashboard first to load its data.`);
      setPrediction(null);
      return;
    }

    const rawVec = buildFeatureVector(selectedPair);
    if (!rawVec) {
      setInfoMsg('Could not compute features. Ensure the pair is on the Dashboard.');
      setPrediction(null);
      return;
    }

    // Scale features
    const scaledVec = rawVec.map((val, i) => {
      const mean = model.scaler.mean[i];
      const std = model.scaler.std[i];
      return std !== 0 ? (val - mean) / std : 0;
    });

    // Logistic regression
    const z = scaledVec.reduce((sum, v, i) => sum + v * model.weights[i], 0) + (model.intercept || 0);
    const prob = 1 / (1 + Math.exp(-z));

    // Feature contributions
    const contributions = model.features.map((name, i) => ({
      name,
      contribution: model.weights[i] * scaledVec[i],
      weight: model.weights[i]
    })).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

    const maxAbsContribution = Math.max(...contributions.map(c => Math.abs(c.contribution)), 0.0001);

    const confidence =
      prob > 0.7 || prob < 0.3 ? 'High' :
      prob > 0.55 || prob < 0.45 ? 'Low' : 'Medium';

    setPrediction({
      pair: selectedPair,
      prob: prob * 100,
      signal: prob > 0.5 ? 'Bullish' : 'Bearish',
      confidence,
      contributions,
      maxAbsContribution,
    });
  };

  const removeModel = () => {
    setModel(null);
    setPrediction(null);
    setImportMsg('');
    setImportError('');
    setInfoMsg('');
    setSelectedPair('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="page">
      <div className="section-head">
        <span className="section-title">ML Research</span>
        <span className="section-sub">Import a pre‑trained model and get live, explainable predictions</span>
      </div>

      {/* Import */}
      {!model && (
        <div
          className={`dropzone ${isDragging ? 'dragging' : ''} ${importError ? 'has-error' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="dropzone-input"
          />
          <div className="dropzone-icon">⇪</div>
          <div className="dropzone-text">
            <strong>Drop model.json here</strong> or click to browse
          </div>
          <div className="dropzone-hint">Expects weights, features, metrics, and scaler fields</div>
          {importError && <div className="dropzone-error">⚠ {importError}</div>}
        </div>
      )}

      {model && (
        <div className="card model-card">
          <div className="card-head">
            <div>
              <span className="pair-tag model-tag">{model.model_type || 'logistic'}</span>
              <div className="model-filename">{importMsg}</div>
            </div>
            <button className="remove-btn" onClick={removeModel} title="Remove model">✕</button>
          </div>

          <div className="model-meta-row">
            <span className="meta-chip">{model.features.length} features</span>
          </div>

          <div className="metrics-grid">
            {Object.entries(model.metrics).map(([key, val]) => {
              const pct = val * 100;
              const tone = pct >= 70 ? 'bull' : pct >= 50 ? 'neutral' : 'bear';
              return (
                <div key={key} className="metric-block">
                  <div className="metric-label">{key.replace(/_/g, ' ')}</div>
                  <div className={`metric-val ${tone}`}>{pct.toFixed(1)}%</div>
                  <div className="bar-track">
                    <div
                      className={`bar-fill ${tone}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Prediction */}
      {model && (
        <div className="card predict-card">
          <div className="card-head">
            <span className="section-title small">Live Prediction</span>
          </div>

          <div className="predict-controls">
            <select value={selectedPair} onChange={e => setSelectedPair(e.target.value)}>
              <option value="">Select pair…</option>
              {activePairs.map(pair => <option key={pair} value={pair}>{pair}</option>)}
            </select>
            <button className="btn-primary" onClick={predictPair} disabled={!selectedPair}>
              Predict
            </button>
          </div>

          {infoMsg && <div className="info-banner">{infoMsg}</div>}

          {!prediction && !infoMsg && (
            <div className="placeholder-block predict-placeholder">
              <p>Select a pair above and run a prediction to see signal, confidence, and the features driving it.</p>
            </div>
          )}

          {prediction && (
            <div className="prediction-result">
              <div className="prediction-headline">
                <span className="prediction-pair">{prediction.pair}</span>
                <span className={`signal-pill ${prediction.signal === 'Bullish' ? 'bull' : 'bear'}`}>
                  {prediction.signal}
                </span>
                <span className={`confidence-pill conf-${prediction.confidence.toLowerCase()}`}>
                  {prediction.confidence} confidence
                </span>
              </div>

              <div className="prob-row">
                <div className="prob-label">
                  <span>Bearish</span>
                  <span className="prob-value">{prediction.prob.toFixed(1)}%</span>
                  <span>Bullish</span>
                </div>
                <div className="prob-track">
                  <div className="prob-midline" />
                  <div
                    className={`prob-fill ${prediction.signal === 'Bullish' ? 'bull' : 'bear'}`}
                    style={
                      prediction.signal === 'Bullish'
                        ? { left: '50%', width: `${prediction.prob - 50}%` }
                        : { left: `${prediction.prob}%`, width: `${50 - prediction.prob}%` }
                    }
                  />
                </div>
              </div>

              {/* Feature Contributions */}
              <div className="contributions-block">
                <h4 className="contributions-title">Top Feature Contributions</h4>
                <div className="contributions-list">
                  {prediction.contributions.slice(0, 6).map(c => {
                    const isPos = c.contribution > 0;
                    const widthPct = (Math.abs(c.contribution) / prediction.maxAbsContribution) * 50;
                    return (
                      <div key={c.name} className="contribution-row">
                        <span className="contribution-name">{c.name}</span>
                        <div className="contribution-bar-track">
                          <div className="contribution-midline" />
                          <div
                            className={`contribution-bar-fill ${isPos ? 'bull' : 'bear'}`}
                            style={
                              isPos
                                ? { left: '50%', width: `${widthPct}%` }
                                : { right: '50%', width: `${widthPct}%` }
                            }
                          />
                        </div>
                        <span className={`contribution-value ${isPos ? 'text-bull' : 'text-bear'}`}>
                          {isPos ? '+' : ''}{c.contribution.toFixed(3)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="prediction-disclaimer">
                This prediction is based on the imported model. It describes historical patterns, not future guarantees.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="footer-note">
        <strong>How to use:</strong><br />
        1. Add the pair you want to predict to the <strong>Dashboard</strong> first – that loads its historical data.<br />
        2. Run the Python training pipeline (<code>ml/train.py</code>) to produce <code>model.json</code>.<br />
        3. Import that JSON file here, select the pair, and click Predict.<br /><br />
        <strong>Disclaimer:</strong> The model is trained on historical data and may not generalise to future market conditions.
        Use for research and educational purposes only.
      </div>
    </div>
  );
}