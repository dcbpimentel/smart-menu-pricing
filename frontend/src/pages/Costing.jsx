import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import Select from '../components/Select';
import { loadPrefs } from '../lib/prefs';

const SOURCE_OPTIONS = [
  { value: 'latest', label: 'Latest (any source)',  description: 'Most recent price from any origin' },
  { value: 'manual', label: 'Manual entries only',  description: 'Prices entered by hand' },
  { value: 'dti',    label: 'DTI prices only',      description: 'From DTI price bulletins' },
  { value: 'da',     label: 'DA prices only',       description: 'From DA price bulletins' },
];

const SOURCE_BADGE = {
  dti:    { bg: '#eff6ff', color: '#2563eb', label: 'DTI' },
  da:     { bg: '#f0fdf4', color: '#16a34a', label: 'DA' },
  manual: { bg: '#faf5ff', color: '#7c3aed', label: 'Manual' },
};

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-7 h-7 rounded-full border-2 border-gray-200 animate-spin" style={{ borderTopColor: 'var(--accent)' }} />
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: accent || '#111827' }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function SourceBadge({ src }) {
  if (!src) return <span className="text-gray-300 text-xs">—</span>;
  const s = SOURCE_BADGE[src] ?? { bg: '#f3f4f6', color: '#6b7280', label: src };
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export default function Costing() {
  const [recipes, setRecipes]   = useState([]);
  const [settings, setSettings] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [recipeId, setRecipeId]       = useState('');
  const [settingId, setSettingId]     = useState('');
  const [priceSource, setPriceSource] = useState(() => loadPrefs().defaultPriceSource || 'latest');
  const [computing, setComputing]     = useState(false);
  const [computeError, setComputeError] = useState('');

  const [result, setResult]               = useState(null);
  const [saved, setSaved]                 = useState(false);
  const [history, setHistory]             = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchMeta = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const [rRes, sRes] = await Promise.all([api.get('/recipes'), api.get('/settings')]);
      const r = rRes.data.data || [];
      const s = sRes.data.data || [];
      setRecipes(r);
      setSettings(s);
      if (r.length) setRecipeId(String(r[0].id));
      if (s.length) setSettingId(String(s[0].id));
    } catch {
      // non-blocking
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);

  const fetchHistory = useCallback(async (rId) => {
    if (!rId) return;
    setLoadingHistory(true);
    try {
      const res = await api.get(`/costing/history/${rId}`);
      setHistory(res.data.data || []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (recipeId) fetchHistory(recipeId);
  }, [recipeId, fetchHistory]);

  const handleCompute = async (e) => {
    e.preventDefault();
    setComputing(true);
    setComputeError('');
    setResult(null);
    setSaved(false);
    try {
      const res = await api.post('/costing/compute', {
        recipe_id:          parseInt(recipeId, 10),
        pricing_setting_id: parseInt(settingId, 10),
        price_source:       priceSource,
      });
      setResult(res.data.data);
      setSaved(true);
      fetchHistory(recipeId);
    } catch (err) {
      setComputeError(err.response?.data?.message || 'Computation failed.');
    } finally {
      setComputing(false);
    }
  };

  const fmt     = (n) => n != null ? `₱${parseFloat(n).toFixed(2)}` : '—';
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  if (loadingMeta) return <Spinner />;

  const missing  = result?.missing_price_ingredients ?? [];
  const recipeOpts  = recipes.map(r => ({ value: String(r.id), label: r.name }));
  const settingOpts = settings.map(s => ({ value: String(s.id), label: `${s.label} (${s.target_food_cost_pct}%)` }));

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Cost Computation</h2>
        <p className="text-sm text-gray-400 mt-0.5">Calculate dish costs and recommended selling prices</p>
      </div>

      {/* ── Compute form ── */}
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Compute Cost</h3>
        <form onSubmit={handleCompute} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Recipe *</label>
            <Select
              value={recipeId}
              onChange={v => { setRecipeId(v); setResult(null); setSaved(false); }}
              options={recipeOpts.length ? recipeOpts : [{ value: '', label: 'No recipes' }]}
              placeholder="Select recipe…"
              disabled={!recipeOpts.length}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Pricing Profile *</label>
            <Select
              value={settingId}
              onChange={setSettingId}
              options={settingOpts.length ? settingOpts : [{ value: '', label: 'No profiles' }]}
              placeholder="Select profile…"
              disabled={!settingOpts.length}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Price Source</label>
            <Select
              value={priceSource}
              onChange={setPriceSource}
              options={SOURCE_OPTIONS}
            />
          </div>

          <div className="sm:col-span-3 flex items-center gap-3 flex-wrap">
            <button
              type="submit"
              disabled={computing || !recipeId || !settingId}
              className="px-5 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60 transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {computing ? 'Computing…' : 'Compute Cost'}
            </button>

            {saved && !computing && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </span>
            )}

            {computeError && <p className="text-red-500 text-sm">{computeError}</p>}
          </div>
        </form>
      </div>

      {/* ── Results ── */}
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Recipe Cost"        value={fmt(result.recipe_cost)}        sub={`${result.servings} serving${result.servings !== 1 ? 's' : ''}`} />
            <StatCard label="Portion Cost"       value={fmt(result.portion_cost)}       sub="per serving" />
            <StatCard label="Recommended Price"  value={fmt(result.recommended_price)}  sub={`${result.pricing_setting?.target_food_cost_pct}% food cost`} accent="#10b981" />
            <StatCard
              label="Contribution Margin"
              value={result.recommended_price != null && result.portion_cost != null ? fmt(result.recommended_price - result.portion_cost) : '—'}
              sub="per serving"
              accent="#6366f1"
            />
          </div>

          {missing.length > 0 && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div>
                <span className="font-medium">Missing prices — excluded from totals: </span>
                {missing.map((item, i) => (
                  <span key={item.ingredient_id}>{i > 0 && ', '}<span className="font-semibold">{item.name}</span></span>
                ))}
                . Add prices in <span className="font-medium">Ingredients</span> or run an extraction.
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ingredient Breakdown</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400">Ingredient</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">Qty</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400">Unit</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">Unit Price</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">Cost</th>
                    <th className="text-center px-5 py-2.5 text-xs font-medium text-gray-400">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {result.ingredient_breakdown.map((row, i) => {
                    const isLast = i === result.ingredient_breakdown.length - 1;
                    return (
                      <tr
                        key={row.ingredient_id}
                        className={[!isLast ? 'border-b border-gray-50' : '', row.missing_price ? 'bg-amber-50/50' : ''].join(' ')}
                      >
                        <td className="px-5 py-2.5 text-gray-700 font-medium">{row.name}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-500">{row.quantity}</td>
                        <td className="px-4 py-2.5 text-gray-500">{row.unit}</td>
                        <td className="px-4 py-2.5 text-right text-gray-500">
                          {row.missing_price ? <span className="text-xs text-amber-600 italic">no price</span> : fmt(row.unit_price)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{row.missing_price ? '—' : fmt(row.ingredient_cost)}</td>
                        <td className="px-5 py-2.5 text-center">
                          {row.missing_price ? <span className="text-xs text-gray-300">—</span> : <SourceBadge src={row.price_source} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Costing History ── */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Costing History</h4>
          {recipeId && (
            <span className="text-xs text-gray-400">{recipes.find(r => String(r.id) === recipeId)?.name}</span>
          )}
        </div>
        {loadingHistory ? (
          <div className="py-6"><Spinner /></div>
        ) : history.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">No costing history yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400">Date</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400">Profile</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">Recipe Cost</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">Portion Cost</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">Rec. Price</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400">Source</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row, i) => (
                  <tr key={row.id} className={i < history.length - 1 ? 'border-b border-gray-50' : ''}>
                    <td className="px-5 py-2.5 text-gray-500 text-xs whitespace-nowrap">{fmtDate(row.computed_at)}</td>
                    <td className="px-5 py-2.5 text-gray-600">{row.pricing_setting_label}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{fmt(row.recipe_cost)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{fmt(row.portion_cost)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold" style={{ color: 'var(--accent)' }}>{fmt(row.recommended_price)}</td>
                    <td className="px-5 py-2.5">
                      <span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{row.applied_price_source}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
