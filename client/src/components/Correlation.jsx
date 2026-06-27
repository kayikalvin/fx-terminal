import { useAppContext } from '../context/AppContext';

export default function Correlation() {
  const { activePairs, pairData } = useAppContext();

  const computeMatrix = () => {
    if (activePairs.length < 2) return null;
    const len = 20;
    const matrix = [];
    for (let i = 0; i < activePairs.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < activePairs.length; j++) {
        if (i === j) { matrix[i][j] = 1; continue; }
        const closes1 = pairData[activePairs[i]]?.closes?.slice(-len);
        const closes2 = pairData[activePairs[j]]?.closes?.slice(-len);
        if (!closes1 || !closes2 || closes1.length < len || closes2.length < len) {
          matrix[i][j] = null; continue;
        }
        const n = closes1.length;
        const mean1 = closes1.reduce((a,b)=>a+b,0)/n, mean2 = closes2.reduce((a,b)=>a+b,0)/n;
        let cov = 0, var1 = 0, var2 = 0;
        for (let k = 0; k < n; k++) {
          const diff1 = closes1[k] - mean1, diff2 = closes2[k] - mean2;
          cov += diff1 * diff2;
          var1 += diff1 * diff1;
          var2 += diff2 * diff2;
        }
        matrix[i][j] = (var1 && var2) ? (cov / Math.sqrt(var1 * var2)).toFixed(2) : null;
      }
    }
    return matrix;
  };

  const matrix = computeMatrix();

  return (
    <div className="page">
      <div className="section-head">
        <span className="section-title">Correlation Matrix</span>
        <span className="section-sub">20‑day Pearson correlation between active pairs. Green = positive, red = negative.</span>
      </div>
      <div id="corrContainer" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 20 }}>
        {!matrix ? (
          <div style={{ color: 'var(--color-text-faint)', fontSize: 12 }}>Add at least two pairs on the Dashboard to compute correlation.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${activePairs.length + 1}, auto)`, gap: 4 }}>
            <div></div>
            {activePairs.map(pair => <div key={pair} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-dim)', textAlign: 'center', padding: 4 }}>{pair}</div>)}
            {activePairs.map((pair, i) => (
              <div key={pair}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-dim)', padding: 4 }}>{pair}</div>
                {activePairs.map((_, j) => {
                  const val = matrix[i][j];
                  let color = 'var(--color-text-faint)';
                  if (val !== null) {
                    const abs = Math.abs(val);
                    if (abs > 0.7) color = val > 0 ? 'var(--color-bull)' : 'var(--color-bear)';
                    else if (abs > 0.3) color = 'var(--color-amber)';
                  }
                  return <div key={j} className="corr-cell" style={{ background: 'var(--color-surface-3)', color }}>{val !== null ? val : '--'}</div>;
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}