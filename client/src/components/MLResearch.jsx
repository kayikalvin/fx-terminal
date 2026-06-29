import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

export default function MLResearch() {
  const { activePairs, pairData, selectedPair } = useAppContext();
  const [model, setModel] = useState(null);
  const [predictPair, setPredictPair] = useState(selectedPair || '');
  const [prediction, setPrediction] = useState(null);
  const [importMsg, setImportMsg] = useState('');
  const [importError, setImportError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Sync with unified pair context
  useEffect(() => {
    if (selectedPair) setPredictPair(selectedPair);
  }, [selectedPair]);

  const loadModelFile = async (file) => {
    if (!file) return;
    setImportError('');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.features || !data.metrics || !data.scaler) {
        throw new Error('Missing required fields (features, metrics, scaler).');
      }
      if (!data.weights) {
        setModel(data);
        setPrediction(null);
        setImportMsg(file.name);
        setImportError('Tree‑based model loaded. Browser inference only supports logistic regression. Feature importances shown below.');
        return;
      }
      setModel(data);
      setPrediction(null);
      setImportMsg(file.name);
      setImportError('');
    } catch (err) {
      setModel(null);
      setImportError(err.message);
    }
  };

  const handleImport = (e) => loadModelFile(e.target.files[0]);
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); loadModelFile(e.dataTransfer.files?.[0]); };

  const buildFeatureVector = (pair) => {
    const d = pairData[pair];
    if (!d || !d.closes || d.closes.length < 60) return null;
    const closes = d.closes;
    const last = d.lastPrice;
    const prev = closes[closes.length - 2];
    const rsi_14 = d.rsi;
    const sma_20 = d.sma20;
    const sma_50 = d.sma50;
    const atr_14 = d.atr;
    const sma20_dist = (last - sma_20) / last;
    const sma50_dist = (last - sma_50) / last;
    const ema_20 = sma_20;
    const ema20_dist = sma20_dist;
    const daily_return = (last - prev) / prev;
    const weekly_return = closes.length >= 6 ? (last - closes[closes.length - 6]) / closes[closes.length - 6] : 0;
    const monthly_return = closes.length >= 21 ? (last - closes[closes.length - 21]) / closes[closes.length - 21] : 0;
    const momentum = d.mom ?? 0;
    const rolling_volatility = d.rollingVol ?? 0;
    const atr_pct = atr_14 / last;
    const trend = d.sma20 > d.sma50 ? 1 : 0;
    const volatility_percentile = d.volPercentile ?? 50;
    const price_position = 0.5;
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

  const predict = () => {
    if (!model || !model.weights) return;
    if (!pairData[predictPair] || !pairData[predictPair].closes || pairData[predictPair].closes.length < 60) {
      alert('Add this pair to the Dashboard first.');
      return;
    }
    const rawVec = buildFeatureVector(predictPair);
    if (!rawVec) return;
    const scaledVec = rawVec.map((val, i) => {
      const mean = model.scaler.mean[i];
      const std = model.scaler.std[i];
      return std !== 0 ? (val - mean) / std : 0;
    });
    const z = scaledVec.reduce((sum, v, i) => sum + v * model.weights[i], 0) + (model.intercept || 0);
    const prob = 1 / (1 + Math.exp(-z));

    const contributions = model.features.map((name, i) => ({
      name,
      contribution: model.weights[i] * scaledVec[i],
      weight: model.weights[i]
    })).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

    const maxAbs = Math.max(...contributions.map(c => Math.abs(c.contribution)), 0.0001);
    const confidence = prob > 0.7 || prob < 0.3 ? 'High' : prob > 0.55 || prob < 0.45 ? 'Low' : 'Medium';

    // Plain‑English explanation
    const topContrib = contributions.slice(0, 3);
    let explanation = '';
    if (topContrib.length > 0) {
      explanation = topContrib.map(c => {
        const dir = c.contribution > 0 ? 'bullish' : 'bearish';
        return `${c.name} is pushing ${dir} (weight: ${c.contribution.toFixed(3)})`;
      }).join('. ') + '.';
    }

    setPrediction({
      pair: predictPair,
      prob: prob * 100,
      signal: prob > 0.5 ? 'Bullish' : 'Bearish',
      confidence,
      contributions,
      maxAbs,
      explanation
    });

    // Log prediction to Trading Journal
    const stored = JSON.parse(localStorage.getItem('fx_journal') || '[]');
    stored.push({
      id: Date.now(),
      pair: predictPair,
      prob: (prob * 100).toFixed(1),
      signal: prob > 0.5 ? 'Bullish' : 'Bearish',
      date: new Date().toISOString().slice(0, 10),
      type: 'prediction'
    });
    localStorage.setItem('fx_journal', JSON.stringify(stored));
  };

  const removeModel = () => {
    setModel(null);
    setPrediction(null);
    setImportMsg('');
    setImportError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="page">
      <div className="section-head">
        <span className="section-title">ML Research</span>
        <span className="section-sub">Import a pre‑trained model and get live, explainable predictions</span>
      </div>

      {!model && (
        <div
          className={`dropzone ${isDragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{ border: '2px dashed var(--color-border)', borderRadius: 6, padding: 40, textAlign: 'center', cursor: 'pointer', background: 'var(--color-surface)' }}
        >
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          <div style={{ fontSize: 24, color: 'var(--color-text-faint)' }}>⇪</div>
          <div><strong>Drop model.json here</strong> or click to browse</div>
          <div style={{ color: 'var(--color-text-faint)' }}>Expects weights, features, metrics, and scaler fields</div>
          {importError && <div style={{ color: 'var(--color-bear)' }}>⚠ {importError}</div>}
        </div>
      )}

      {model && (
        <div className="card model-card" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 20, marginBottom: 24 }}>
          <div className="card-head">
            <div>
              <span className="pair-tag model-tag">{model.weights ? 'logistic' : model.model_type || 'tree'}</span>
              <div className="model-filename" style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>{importMsg}</div>
            </div>
            <button className="remove-btn" onClick={removeModel}>✕</button>
          </div>
          <div className="model-meta-row" style={{ margin: '12px 0' }}>
            <span className="meta-chip" style={{ background: 'var(--color-surface-3)', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{model.features.length} features</span>
            {!model.weights && <span className="meta-chip warn" style={{ background: 'var(--color-amber-bg)', color: 'var(--color-amber)', marginLeft: 8 }}>no browser inference</span>}
          </div>
          <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
            {Object.entries(model.metrics).map(([key, val]) => {
              const pct = val * 100;
              const tone = pct >= 70 ? 'bull' : pct >= 50 ? 'neutral' : 'bear';
              return (
                <div key={key} className="metric-block" style={{ background: 'var(--color-surface-2)', padding: 10, borderRadius: 6 }}>
                  <div className="metric-label" style={{ fontSize: 10, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>{key.replace(/_/g, ' ')}</div>
                  <div className={`metric-val ${tone}`} style={{ fontSize: 18, fontWeight: 700, color: tone === 'bull' ? 'var(--color-bull)' : tone === 'bear' ? 'var(--color-bear)' : 'var(--color-amber)' }}>{pct.toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
          {model.feature_importances && (
            <div style={{ marginTop: 12 }}>
              <h4 style={{ fontSize: 12, color: 'var(--color-text-dim)', fontWeight: 600 }}>Feature Importances</h4>
              <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                {model.features.map((name, i) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: 'var(--color-text-faint)' }}>{name}</span>
                    <span style={{ color: 'var(--color-text-dim)' }}>{(model.feature_importances[i] * 100).toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {model && model.weights && (
        <div className="card predict-card" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 20, marginBottom: 24 }}>
          <div className="card-head" style={{ marginBottom: 12 }}>
            <span className="section-title" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>Live Prediction</span>
          </div>
          <div className="predict-controls" style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <select value={predictPair} onChange={e => setPredictPair(e.target.value)} style={{ flex: 1 }}>
              <option value="">Select pair…</option>
              {activePairs.map(pair => <option key={pair} value={pair}>{pair}</option>)}
            </select>
            <button className="btn-primary" onClick={predict} disabled={!predictPair}>Predict</button>
          </div>
          {prediction && (
            <div className="prediction-result" style={{ background: 'var(--color-surface-3)', borderRadius: 6, padding: 14 }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-dim)' }}>{prediction.pair}</span>{' '}
                <span style={{ padding: '2px 8px', borderRadius: 4, background: prediction.signal === 'Bullish' ? 'var(--color-bull-bg)' : 'var(--color-bear-bg)', color: prediction.signal === 'Bullish' ? 'var(--color-bull)' : 'var(--color-bear)', fontSize: 12, fontWeight: 600 }}>
                  {prediction.signal}
                </span>{' '}
                <span style={{ fontSize: 11, color: 'var(--color-text-faint)', marginLeft: 4 }}>Confidence: {prediction.confidence}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--color-bear)' }}>Bearish</span>
                <div style={{ flex: 1, height: 6, background: 'var(--color-border)', borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: `${prediction.prob}%`, top: 0, bottom: 0, width: 2, background: 'var(--color-text)' }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--color-bull)' }}>Bullish</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-faint)', marginBottom: 8 }}>{prediction.explanation}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-faint)', borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
                This prediction is based on the imported model. It describes historical patterns, not future guarantees. Always validate with other research tools.
              </div>
            </div>
          )}
        </div>
      )}

      <div className="footer-note">
        <strong>How to use:</strong><br />
        1. Add the pair you want to predict to the Dashboard first.<br />
        2. Run the Python training pipeline (<code>ml/train.py</code>) to produce <code>model.json</code>.<br />
        3. Import that JSON file here, select the pair, and click Predict.<br /><br />
        <strong>Disclaimer:</strong> The model is trained on historical data and may not generalise to future market conditions.
        Use for research and educational purposes only.
      </div>
    </div>
  );
}