import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

const STORAGE_KEY = 'fx_journal';

export default function Journal() {
  const { selectedPair } = useAppContext();
  const [entries, setEntries] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });
  const [form, setForm] = useState({
    pair: selectedPair || '',
    direction: 'long',
    entry: '',
    exit: '',
    notes: '',
    date: new Date().toISOString().slice(0, 10)
  });

  useEffect(() => {
    if (selectedPair) setForm(prev => ({ ...prev, pair: selectedPair }));
  }, [selectedPair]);

  const addEntry = () => {
    const newEntry = {
      id: Date.now(),
      ...form,
      entry: parseFloat(form.entry),
      exit: parseFloat(form.exit)
    };
    const updated = [newEntry, ...entries];
    setEntries(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setForm({
      pair: selectedPair || '',
      direction: 'long',
      entry: '',
      exit: '',
      notes: '',
      date: new Date().toISOString().slice(0, 10)
    });
  };

  return (
    <div className="page">
      <div className="section-head">
        <span className="section-title">Trading Journal</span>
        <span className="section-sub">Log your trades and predictions</span>
      </div>

      <div className="card p-4 mb-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="input" />
          <select value={form.direction} onChange={e => setForm({...form, direction: e.target.value})} className="input">
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
          <input type="number" value={form.entry} onChange={e => setForm({...form, entry: e.target.value})} placeholder="Entry price" className="input" />
          <input type="number" value={form.exit} onChange={e => setForm({...form, exit: e.target.value})} placeholder="Exit price" className="input" />
          <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Notes…" className="input col-span-2" rows={2} />
        </div>
        <button className="btn-primary" onClick={addEntry}>Add Entry</button>
      </div>

      <div className="flex flex-col gap-2">
        {entries.length === 0 && <div className="placeholder-block"><p>No journal entries yet.</p></div>}
        {entries.map(e => {
          const pnl = e.direction === 'long' ? (e.exit - e.entry) : (e.entry - e.exit);
          return (
            <div key={e.id} className="card p-3 flex justify-between items-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
              <div>
                <strong>{e.pair}</strong>{' '}
                <span className={`text-xs ${pnl >= 0 ? 'text-bull' : 'text-bear'}`}>
                  {pnl >= 0 ? '+' : ''}{pnl.toFixed(4)}
                </span>
                <div className="text-xs text-faint">{e.date} · {e.direction}</div>
                {e.notes && <div className="text-xs text-faint mt-1">{e.notes}</div>}
                {e.type === 'prediction' && (
                  <div className="text-xs text-amber mt-1">ML Prediction: {e.prob}% {e.signal}</div>
                )}
              </div>
              <button className="btn-danger text-xs" onClick={() => {
                const updated = entries.filter(x => x.id !== e.id);
                setEntries(updated);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
              }}>Delete</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}