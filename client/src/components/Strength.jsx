import { useAppContext } from '../context/AppContext';

export default function Strength() {
  const { activePairs, pairData } = useAppContext();

  const computeStrength = () => {
    if (activePairs.length < 2) return null;
    const currencies = ['EUR','USD','GBP','JPY','CHF','AUD','NZD','CAD','XAU','XAG'];
    const strength = {};
    currencies.forEach(c => { strength[c] = { sum: 0, count: 0 }; });
    activePairs.forEach(pair => {
      const d = pairData[pair];
      if (!d?.closes || d.closes.length < 2) return;
      const last = d.closes[d.closes.length-1], prev = d.closes[d.closes.length-2];
      const pct = ((last - prev) / prev) * 100;
      const [base, quote] = pair.split('/');
      if (strength[base] && strength[quote]) {
        strength[base].sum += pct; strength[base].count++;
        strength[quote].sum -= pct; strength[quote].count++;
      }
    });
    const result = Object.entries(strength).filter(([,v]) => v.count > 0).map(([cur, v]) => ({ currency: cur, strength: v.sum / v.count }));
    result.sort((a,b) => b.strength - a.strength);
    return result;
  };

  const data = computeStrength();
  const maxAbs = data ? Math.max(...data.map(d => Math.abs(d.strength)), 1) : 1;

  return (
    <div className="page">
      <div className="section-head">
        <span className="section-title">Currency Strength Meter</span>
        <span className="section-sub">Based on average % change of all pairs for each currency. Green = strong, red = weak.</span>
      </div>
      <div id="strengthContainer" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 20 }}>
        {!data ? (
          <div style={{ color: 'var(--color-text-faint)', fontSize: 12 }}>Add at least two pairs on the Dashboard to compute strength.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.map(d => (
              <div key={d.currency} className="strength-bar-container">
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, width: 40 }}>{d.currency}</span>
                <div className="strength-bar">
                  <div className="strength-fill" style={{ width: `${Math.abs(d.strength / maxAbs * 100).toFixed(0)}%`, background: d.strength > 0 ? 'var(--color-bull)' : 'var(--color-bear)' }} />
                </div>
                <span className="strength-label">{d.strength.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}