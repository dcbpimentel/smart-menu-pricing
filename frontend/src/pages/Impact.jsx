import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  LabelList, ResponsiveContainer,
} from 'recharts';
import api from '../lib/api';
import Select from '../components/Select';

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div
        className="w-7 h-7 rounded-full border-2 border-gray-200 animate-spin"
        style={{ borderTopColor: 'var(--accent)' }}
      />
    </div>
  );
}

function DiffBadge({ amount, pct }) {
  if (amount == null) return <span className="text-gray-300 text-xs">—</span>;
  const up = amount > 0;
  const zero = amount === 0;
  const color = zero ? '#6b7280' : up ? '#dc2626' : '#16a34a';
  const bg    = zero ? '#f3f4f6' : up ? '#fef2f2' : '#f0fdf4';
  const sign  = up ? '+' : '';
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ color, backgroundColor: bg }}>
        {sign}{parseFloat(amount).toFixed(2)}
      </span>
      {pct != null && !zero && (
        <span className="text-xs" style={{ color }}>
          {sign}{parseFloat(pct).toFixed(1)}%
        </span>
      )}
    </span>
  );
}

// Custom bar label that renders ₱ value inside/above the bar
function BarLabel({ x, y, width, value }) {
  if (value == null) return null;
  const display = `₱${parseFloat(value).toFixed(0)}`;
  return (
    <text
      x={x + width / 2}
      y={y - 4}
      fill="#374151"
      fontSize={10}
      textAnchor="middle"
      fontWeight="600"
    >
      {display}
    </text>
  );
}

const CHART_METRICS = [
  { key: 'recipe_cost',       label: 'Recipe Cost' },
  { key: 'portion_cost',      label: 'Portion Cost' },
  { key: 'recommended_price', label: 'Rec. Price' },
];

export default function Impact() {
  const [recipes, setRecipes]   = useState([]);
  const [settings, setSettings] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [recipeId, setRecipeId]   = useState('');
  const [settingId, setSettingId] = useState('');

  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [loadingIngredients, setLoadingIngredients] = useState(false);

  // { [ingredient_id]: { old: string, new: string } }
  const [prices, setPrices] = useState({});

  const [analyzing, setAnalyzing]     = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [result, setResult]           = useState(null);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  const fetchMeta = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const [rRes, sRes] = await Promise.all([
        api.get('/recipes'),
        api.get('/settings'),
      ]);
      const r = rRes.data.data || [];
      const s = sRes.data.data || [];
      setRecipes(r);
      setSettings(s);
      if (r.length) setRecipeId(String(r[0].id));
      if (s.length) setSettingId(String(s[0].id));
    } catch {
      // handled inline
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);

  // ── Load ingredients + pre-fill latest prices ──────────────────────────────
  const fetchRecipeIngredients = useCallback(async (rId) => {
    if (!rId) return;
    setLoadingIngredients(true);
    setResult(null);
    setAnalyzeError('');
    try {
      const res = await api.get(`/recipes/${rId}`);
      const ings = res.data.data?.ingredients || [];
      setRecipeIngredients(ings);

      // Fetch latest price for each ingredient in parallel
      const latestPrices = await Promise.all(
        ings.map(async (ri) => {
          try {
            const pr = await api.get(`/prices/latest/${ri.ingredient_id}`);
            return {
              ingredient_id: ri.ingredient_id,
              price: pr.data.data?.price ?? null,
            };
          } catch {
            return { ingredient_id: ri.ingredient_id, price: null };
          }
        })
      );

      const initial = {};
      ings.forEach((ri) => {
        const latest = latestPrices.find(p => p.ingredient_id === ri.ingredient_id);
        const val = latest?.price != null ? String(parseFloat(latest.price).toFixed(2)) : '';
        initial[ri.ingredient_id] = { old: val, new: val };
      });
      setPrices(initial);
    } catch {
      setRecipeIngredients([]);
    } finally {
      setLoadingIngredients(false);
    }
  }, []);

  useEffect(() => {
    if (recipeId) fetchRecipeIngredients(recipeId);
  }, [recipeId, fetchRecipeIngredients]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const setPrice = (ingredientId, field, value) => {
    setPrices(prev => ({
      ...prev,
      [ingredientId]: { ...prev[ingredientId], [field]: value },
    }));
  };

  const fmt = (n) => n != null ? `₱${parseFloat(n).toFixed(2)}` : '—';

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleAnalyze = async (e) => {
    e.preventDefault();
    setAnalyzing(true);
    setAnalyzeError('');
    setResult(null);

    const oldPrices = {};
    const newPrices = {};
    let hasAny = false;
    for (const [idStr, vals] of Object.entries(prices)) {
      const id = parseInt(idStr, 10);
      const o = parseFloat(vals.old);
      const n = parseFloat(vals.new);
      if (!isNaN(o)) { oldPrices[id] = o; hasAny = true; }
      if (!isNaN(n)) { newPrices[id] = n; hasAny = true; }
    }
    if (!hasAny) {
      setAnalyzeError('Enter at least one price to analyze.');
      setAnalyzing(false);
      return;
    }

    try {
      const res = await api.post('/costing/impact', {
        recipe_id:          parseInt(recipeId, 10),
        pricing_setting_id: parseInt(settingId, 10),
        old_prices:         oldPrices,
        new_prices:         newPrices,
      });
      setResult(res.data.data);
    } catch (err) {
      setAnalyzeError(err.response?.data?.message || 'Analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loadingMeta) return <Spinner />;

  const chartData = result
    ? CHART_METRICS.map(m => ({
        metric: m.label,
        'Old Price': result.old?.[m.key] ?? 0,
        'New Price': result.new?.[m.key] ?? 0,
      }))
    : [];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Impact Analysis</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Simulate how price changes affect your dish cost and selling price
        </p>
      </div>

      {/* ── Input form ── */}
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        {/* Recipe selector */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Recipe</label>
          <Select
            value={recipeId}
            onChange={setRecipeId}
            options={recipes.map(r => ({ value: String(r.id), label: r.name }))}
            placeholder="Select recipe…"
            style={{ maxWidth: '320px' }}
          />
        </div>

        {loadingIngredients ? (
          <Spinner />
        ) : recipeIngredients.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No ingredients found for this recipe.</p>
        ) : (
          <form onSubmit={handleAnalyze}>
            {/* Ingredient price inputs */}
            <p className="text-xs text-gray-400 mb-3">
              Inputs are pre-filled with the latest recorded price. Edit the
              {' '}<span className="font-medium text-gray-600">New Price</span> column to simulate a change.
            </p>

            <div className="overflow-x-auto mb-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 pr-4 text-xs font-medium text-gray-400 uppercase">Ingredient</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-400 uppercase">
                      Old Price <span className="normal-case text-gray-300">(₱)</span>
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-400 uppercase">
                      New Price <span className="normal-case text-gray-300">(₱)</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recipeIngredients.map((ri, i) => (
                    <tr
                      key={ri.ingredient_id}
                      className={i < recipeIngredients.length - 1 ? 'border-b border-gray-50' : ''}
                    >
                      <td className="py-2.5 pr-4 text-gray-700 font-medium">
                        {ri.name}
                        <span className="ml-1.5 text-xs text-gray-400 font-normal">/ {ri.unit}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className="w-36 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-gray-400"
                          placeholder="e.g. 250"
                          value={prices[ri.ingredient_id]?.old ?? ''}
                          onChange={e => setPrice(ri.ingredient_id, 'old', e.target.value)}
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className="w-36 border border-emerald-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-emerald-400 bg-emerald-50/30"
                          placeholder="e.g. 300"
                          value={prices[ri.ingredient_id]?.new ?? ''}
                          onChange={e => setPrice(ri.ingredient_id, 'new', e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pricing profile + submit row */}
            <div className="flex flex-wrap items-end gap-4">
              <div style={{ minWidth: '220px' }}>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Pricing Profile</label>
                <Select
                  value={settingId}
                  onChange={setSettingId}
                  options={settings.map(s => ({ value: String(s.id), label: `${s.label} (${s.target_food_cost_pct}%)` }))}
                  placeholder="Select profile…"
                />
              </div>
              <div className="flex flex-col gap-1">
                {analyzeError && <p className="text-red-500 text-xs">{analyzeError}</p>}
                <button
                  type="submit"
                  disabled={analyzing}
                  className="px-5 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {analyzing ? 'Analyzing…' : 'Run Impact Analysis'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* ── Results ── */}
      {result && (
        <div className="space-y-5">

          {/* Summary diff cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: 'Recipe Cost',
                old:   result.old?.recipe_cost,
                new:   result.new?.recipe_cost,
                diff:  result.diff?.recipe_cost_change,
                pct:   result.diff?.recipe_cost_pct,
              },
              {
                label: 'Portion Cost',
                old:   result.old?.portion_cost,
                new:   result.new?.portion_cost,
                diff:  result.diff?.portion_cost_change,
                pct:   result.diff?.portion_cost_pct,
              },
              {
                label: 'Recommended Price',
                old:   result.old?.recommended_price,
                new:   result.new?.recommended_price,
                diff:  result.diff?.recommended_price_change,
                pct:   result.diff?.recommended_price_pct,
              },
            ].map((card) => (
              <div key={card.label} className="bg-white border border-gray-100 rounded-xl p-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
                  {card.label}
                </p>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Before</p>
                    <p className="text-lg font-bold text-gray-600">{fmt(card.old)}</p>
                  </div>
                  <span className="text-gray-300 text-xl mb-1">→</span>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 mb-0.5">After</p>
                    <p className="text-lg font-bold text-gray-900">{fmt(card.new)}</p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-50 flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">Change:</span>
                  <DiffBadge amount={card.diff} pct={card.pct} />
                </div>
              </div>
            ))}
          </div>

          {/* Grouped bar chart */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Cost Comparison
            </h4>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 20, left: 10, bottom: 4 }}
                barCategoryGap="30%"
                barGap={4}
              >
                <XAxis
                  dataKey="metric"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `₱${v}`}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <Tooltip
                  formatter={(value) => [`₱${parseFloat(value).toFixed(2)}`, undefined]}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
                <Bar dataKey="Old Price" fill="#d1d5db" radius={[4, 4, 0, 0]}>
                  <LabelList content={<BarLabel />} />
                </Bar>
                <Bar dataKey="New Price" fill="#10b981" radius={[4, 4, 0, 0]}>
                  <LabelList content={<BarLabel />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Per-ingredient impact table */}
          {result.ingredient_impacts?.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Ingredient Impact
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50">
                      <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400">Ingredient</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">Old Price</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">New Price</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">Change</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">Old Cost</th>
                      <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-400">New Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.ingredient_impacts.map((row, i) => {
                      const costChange = row.ingredient_cost_old != null && row.ingredient_cost_new != null
                        ? parseFloat((row.ingredient_cost_new - row.ingredient_cost_old).toFixed(2))
                        : null;
                      const priceChange = row.old_price != null && row.new_price != null
                        ? parseFloat((row.new_price - row.old_price).toFixed(2))
                        : null;
                      const isLast = i === result.ingredient_impacts.length - 1;
                      return (
                        <tr key={row.ingredient_id ?? i} className={!isLast ? 'border-b border-gray-50' : ''}>
                          <td className="px-5 py-2.5 text-gray-700 font-medium">{row.name}</td>
                          <td className="px-4 py-2.5 text-right text-gray-500">{fmt(row.old_price)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-500">{fmt(row.new_price)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <DiffBadge amount={priceChange} />
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-600">{fmt(row.ingredient_cost_old)}</td>
                          <td className="px-5 py-2.5 text-right font-semibold text-gray-800">
                            {fmt(row.ingredient_cost_new)}
                            {costChange !== null && costChange !== 0 && (
                              <span
                                className="ml-1.5 text-xs font-normal"
                                style={{ color: costChange > 0 ? '#dc2626' : '#16a34a' }}
                              >
                                ({costChange > 0 ? '+' : ''}{costChange.toFixed(2)})
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
