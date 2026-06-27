import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { computeFeatures } from '../services/featureEngine';

export default function MLResearch() {
  const { activePairs, pairData } = useAppContext();
  const [model, setModel] = useState(null);
  const [selectedPair, setSelectedPair] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [importMsg, setImportMsg] = useState('');

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.weights || !data.features || !data.metrics) throw new Error('Invalid model JSON.');
      setModel(data);
      setImportMsg(`Model loaded. Out‑of‑sample accuracy: ${(data.metrics.accuracy * 100).toFixed(1)}%`);
    } catch (err) {
      alert('Failed to load model: ' + err.message);
    }
  };

  const predictPair = () => {
    if (!model || !selectedPair || !pairData[selectedPair]) return;
    const data = pairData[selectedPair].closes;
    if (!data || data.length < 50) return;

    const feats = computeFeatures(data, [], []);
    const last = feats[feats.length - 1];
    const raw = [
      last.rsiNorm,
      last.dist20,
      last.dist50,
      last.atr,
      last.momentum / data[data.length - 1],
      last.trend,
      last.dailyReturn,
      last.volatilityPercentile / 100,
    ];

    const X = model.features.map(name => {
      const idx = ['rsiNorm','dist20','dist50','atr','momentum','trend','dailyReturn','volPercentile'].indexOf(name);
      return raw[idx] || 0;
    });

    const z = X.reduce((sum, v, i) => sum + v * model.weights[i], 0);
    const prob = 1 / (1 + Math.exp(-z));
    setPrediction({
      pair: selectedPair,
      prob: (prob * 100).toFixed(1),
      signal: prob > 0.5 ? 'Bullish' : 'Bearish',
    });
  };

  return (
    <div className="page">
      <div className="section-head">
        <span className="section-title">ML Research</span>
        <span className="section-sub">Import a pre‑trained model and get live predictions</span>
      </div>

      <div className="bg-surface border border-border rounded-lg p-4 mb-6" style={{ background: 'var(--color-surface)' }}>
        <h3 className="text-sm text-dim font-semibold mb-2">Load Trained Model</h3>
        <input type="file" accept=".json" onChange={handleImport} className="mb-2" />
        {importMsg && <p className="text-xs text-faint">{importMsg}</p>}
        {model && (
          <div className="mt-2 text-xs text-dim">
            <p>Model type: {model.model_type || 'logistic'}</p>
            <p>Features: {model.features.join(', ')}</p>
            <p>Weights: {model.weights.map(w => w.toFixed(4)).join(', ')}</p>
            <div className="mt-2 p-3 bg-surface-3 rounded">
              <h4 className="text-sm text-dim font-semibold">Performance</h4>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>Accuracy: {(model.metrics.accuracy * 100).toFixed(1)}%</div>
                <div>Precision: {(model.metrics.precision * 100).toFixed(1)}%</div>
                <div>Recall: {(model.metrics.recall * 100).toFixed(1)}%</div>
                <div>ROC AUC: {model.metrics.roc_auc.toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {model && (
        <div className="bg-surface border border-border rounded-lg p-4 mb-6" style={{ background: 'var(--color-surface)' }}>
          <h3 className="text-sm text-dim font-semibold mb-2">Live Prediction</h3>
          <div className="flex gap-2 items-center">
            <select value={selectedPair} onChange={e => setSelectedPair(e.target.value)}>
              <option value="">Select pair</option>
              {activePairs.map(pair => <option key={pair} value={pair}>{pair}</option>)}
            </select>
            <button className="btn-primary" onClick={predictPair} disabled={!selectedPair}>Predict</button>
          </div>
          {prediction && (
            <div className="mt-3 p-3 bg-surface-3 rounded">
              <div className="font-mono text-sm">
                {prediction.pair}: <span className={prediction.signal === 'Bullish' ? 'text-bull' : 'text-bear'}>{prediction.prob}% {prediction.signal}</span>
              </div>
              <div className="text-xs text-faint mt-1">
                Based on imported model. For research only.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}