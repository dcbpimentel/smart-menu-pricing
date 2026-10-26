import { useState, useEffect, useCallback, useRef } from 'react';
import { FiDollarSign } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import Select from '../components/Select';
import { RecipeThumb } from '../components/RecipePhoto';
import { loadPrefs } from '../lib/prefs';
import { SkeletonStats, SkeletonTable } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { formatCurrency, formatPct } from '../lib/format';
import { getConversionFactor, unitOptionsFor } from '../lib/units';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/* ─── Design tokens ────────────────────────────────────────────────────────── */
const T = {
  accent:      '#4C5D3E',
  accentLight: 'oklch(0.955 0.021 138)',
  textPrimary: '#24201C',
  textSecond:  '#6B625A',
  textMuted:   '#8C837B',
  rowDivider:  '1px solid #F3EDE4',
  rowHover:    '#FDFBF8',
  tblHead:     '#A79E94',
  tblHeadBg:   '#FDFBF8',
  inputBorder: '#E7DFD4',
  inputBg:     '#FDFBF8',
  focusShadow: '0 0 0 4px oklch(0.945 0.028 138)',
};

const SOURCE_OPTIONS = [
  { value: 'latest', label: 'Latest (any source)',  description: 'Most recent price from any origin' },
  { value: 'manual', label: 'Manual entries only',  description: 'Prices entered by hand' },
  { value: 'dti',    label: 'DTI prices only',      description: 'From DTI price bulletins' },
  { value: 'da',     label: 'DA prices only',       description: 'From DA price bulletins' },
];

const SOURCE_BADGE = {
  dti:    { bg: T.accentLight, color: T.accent,                        label: 'DTI' },
  da:     { bg: 'oklch(0.96 0.03 200)',  color: 'oklch(0.42 0.1 200)', label: 'DA' },
  manual: { bg: 'oklch(0.975 0.04 85)',  color: 'oklch(0.50 0.12 85)', label: 'Manual' },
};

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function StatCard({ label, value, sub, accent, index = 0 }) {
  return (
    <div className="card-spring" style={{
      '--i': index,
      background: '#FFFFFF',
      border: '1px solid #EFE8DE',
      borderRadius: 18,
      padding: '18px 20px',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{
        fontSize: 26,
        fontWeight: 700,
        color: accent || T.textPrimary,
        fontVariantNumeric: 'tabular-nums',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
        lineHeight: 1.1,
        marginBottom: 4,
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: T.textMuted }}>{sub}</div>}
    </div>
  );
}

function SourceBadge({ src }) {
  if (!src) return <span style={{ color: '#D5CCBF', fontSize: 12 }}>—</span>;
  const s = SOURCE_BADGE[src] ?? { bg: '#F3EDE4', color: T.textMuted, label: src };
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 700,
      padding: '3px 9px',
      borderRadius: 20,
      background: s.bg,
      color: s.color,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    }}>
      {s.label}
    </span>
  );
}

export default function Costing() {
  const toast = useToast();

  const [recipes, setRecipes]   = useState([]);
  const [settings, setSettings] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState('');

  const [recipeId, setRecipeId]       = useState('');
  const [settingId, setSettingId]     = useState('');
  const [priceSource, setPriceSource] = useState(() => loadPrefs().defaultPriceSource || 'latest');
  const [computing, setComputing]     = useState(false);
  const [computeError, setComputeError] = useState('');

  const [result, setResult]               = useState(null);
  const [saved, setSaved]                 = useState(false);
  const [history, setHistory]             = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError]   = useState('');
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const HISTORY_PREVIEW = 5;

  const [batchRunning, setBatchRunning]   = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [batchResults, setBatchResults]   = useState(null);
  const [activeBatchRow, setActiveBatchRow] = useState(null);

  const resultRef = useRef(null);

  // Editing the recipe's ingredients straight from the breakdown
  const [allIngredients, setAllIngredients] = useState([]);
  const [addOpen, setAddOpen]               = useState(false);
  const [addForm, setAddForm]               = useState({ ingredient_id: '', quantity: '', unit: '' });
  const [addError, setAddError]             = useState('');
  const [addBusy, setAddBusy]               = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [removingId, setRemovingId]         = useState(null);

  const [actualPrice, setActualPrice]     = useState('');
  const [savingActual, setSavingActual]   = useState(false);
  const [savedMenuPrice, setSavedMenuPrice] = useState(null);

  const fetchMeta = useCallback(async () => {
    setLoadingMeta(true);
    setMetaError('');
    try {
      const [rRes, sRes] = await Promise.all([api.get('/recipes'), api.get('/settings')]);
      const r = rRes.data.data || [];
      const s = sRes.data.data || [];
      setRecipes(r);
      setSettings(s);
      if (r.length) setRecipeId(String(r[0].id));
      if (s.length) setSettingId(String(s[0].id));
    } catch {
      setMetaError('Failed to load recipes and settings.');
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);

  const fetchHistory = useCallback(async (rId) => {
    if (!rId) return;
    setLoadingHistory(true);
    setHistoryError('');
    try {
      const res = await api.get(`/costing/history/${rId}`);
      const rows = res.data.data || [];
      setHistory(rows);
      // Track the most recently saved menu price for this recipe
      const withPrice = rows.find(r => r.actual_selling_price != null);
      setSavedMenuPrice(withPrice ? withPrice.actual_selling_price : null);
    } catch {
      setHistory([]);
      setHistoryError('Failed to load costing history.');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (recipeId) { fetchHistory(recipeId); setHistoryExpanded(false); }
  }, [recipeId, fetchHistory]);

  const handleSaveActualPrice = async () => {
    if (!result?.output_id || !actualPrice || parseFloat(actualPrice) <= 0) return;
    setSavingActual(true);
    try {
      const price = parseFloat(actualPrice);
      await api.patch(`/costing/${result.output_id}/actual-price`, {
        actual_selling_price: price,
      });
      setSavedMenuPrice(price);
      toast.success('Menu price saved');
      fetchHistory(recipeId);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save actual price');
    } finally {
      setSavingActual(false);
    }
  };

  // Re-run costing for the recipe on screen after its ingredients change
  const recompute = async (rId) => {
    const res = await api.post('/costing/compute', {
      recipe_id:          rId,
      pricing_setting_id: parseInt(settingId, 10),
      price_source:       priceSource,
    });
    setResult(res.data.data);
    setSaved(res.data.data.saved);
    setActiveBatchRow(null);
    fetchHistory(String(rId));
  };

  const openAddIngredient = async () => {
    setAddOpen(true);
    setAddError('');
    setAddForm({ ingredient_id: '', quantity: '', unit: '' });
    if (!allIngredients.length) {
      try {
        const res = await api.get('/ingredients');
        setAllIngredients(res.data.data || []);
      } catch {
        setAddError('Failed to load ingredients.');
      }
    }
  };

  const handleAddIngredient = async () => {
    const ing = allIngredients.find(i => String(i.id) === addForm.ingredient_id);
    const qty = parseFloat(addForm.quantity);
    if (!ing)            { setAddError('Choose an ingredient.'); return; }
    if (!(qty > 0))      { setAddError('Enter a quantity greater than 0.'); return; }
    setAddBusy(true);
    setAddError('');
    try {
      await api.post(`/recipes/${result.recipe_id}/ingredients`, {
        ingredient_id: ing.id,
        quantity:      qty,
        unit:          addForm.unit || ing.unit,
      });
      await recompute(result.recipe_id);
      setAddOpen(false);
      toast.success(`${ing.name} added and cost updated`);
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to add ingredient.');
    } finally {
      setAddBusy(false);
    }
  };

  const handleRemoveIngredient = async (row) => {
    setRemovingId(row.recipe_ingredient_id);
    try {
      await api.delete(`/recipes/${result.recipe_id}/ingredients/${row.recipe_ingredient_id}`);
      await recompute(result.recipe_id);
      toast.success(`${row.name} removed and cost updated`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove ingredient.');
    } finally {
      setRemovingId(null);
      setConfirmRemoveId(null);
    }
  };

  const handleCompute = async (e) => {
    e.preventDefault();
    setComputing(true);
    setComputeError('');
    setResult(null);
    setSaved(false);
    setActiveBatchRow(null);
    setActualPrice(savedMenuPrice ? String(savedMenuPrice) : '');
    try {
      const res = await api.post('/costing/compute', {
        recipe_id:          parseInt(recipeId, 10),
        pricing_setting_id: parseInt(settingId, 10),
        price_source:       priceSource,
      });
      const data = res.data.data;
      setResult(data);
      setSaved(data.saved);
      fetchHistory(recipeId);
      if (!data.saved) {
        toast.error(res.data.message || 'Cost not computed');
      } else if (data.is_duplicate) {
        toast.info('No changes detected — cost is already up to date');
      } else {
        toast.success('Cost computed and saved successfully');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Computation failed.';
      setComputeError(msg);
      toast.error(msg);
    } finally {
      setComputing(false);
    }
  };

  const handleBatchCompute = async () => {
    if (!settingId || batchRunning || !recipes.length) return;
    setBatchRunning(true);
    setBatchProgress({ done: 0, total: recipes.length });
    setBatchResults(null);
    setActiveBatchRow(null);
    setResult(null);
    const results = [];
    const errors = [];
    let newCount = 0;
    let dupCount = 0;
    for (const recipe of recipes) {
      try {
        const res = await api.post('/costing/compute', {
          recipe_id:          recipe.id,
          pricing_setting_id: parseInt(settingId, 10),
          price_source:       priceSource,
        });
        const data = res.data.data;
        if (!data.saved) {
          const names = data.missing_price_ingredients?.map(m => m.name).join(', ');
          errors.push({ recipe_id: recipe.id, recipe_name: recipe.name, error: names ? `No price for ${names}` : (res.data.message || 'Not computed') });
        } else {
          results.push({ recipe_id: recipe.id, recipe_name: recipe.name, ...data });
          if (data.is_duplicate) dupCount++; else newCount++;
        }
      } catch (err) {
        errors.push({ recipe_id: recipe.id, recipe_name: recipe.name, error: err.response?.data?.message || 'Computation failed' });
      }
      setBatchProgress(prev => ({ ...prev, done: prev.done + 1 }));
    }
    setBatchResults({ results, errors });
    setBatchRunning(false);
    if (newCount > 0 && dupCount > 0) {
      toast.success(`${newCount} new cost${newCount !== 1 ? 's' : ''} saved; ${dupCount} already up to date`);
    } else if (newCount > 0) {
      toast.success(`${newCount} recipe cost${newCount !== 1 ? 's' : ''} saved successfully`);
    } else if (dupCount > 0) {
      toast.info('All costs already up to date — no changes detected');
    }
    if (errors.length > 0) {
      toast.error(`${errors.length} recipe${errors.length !== 1 ? 's' : ''} not computed — see the list below`);
    }
    if (recipeId) fetchHistory(recipeId);
  };

  const handlePrint = () => {
    if (!result) return;
    const w = window.open('', '_blank', 'width=820,height=700');
    if (!w) {
      toast.error('Popup was blocked. Please allow popups for this site to print.');
      return;
    }
    const rows = (result.ingredient_breakdown ?? []).map(row => `
      <tr>
        <td>${row.name}</td>
        <td style="text-align:right;font-family:monospace">${row.quantity}</td>
        ${row.waste_pct > 0 ? `<td style="text-align:center">${row.waste_pct}%</td><td style="text-align:right;font-family:monospace">${row.effective_quantity ?? row.quantity}</td>` : `<td style="text-align:center;color:#ccc">—</td><td style="text-align:right;font-family:monospace;color:#999">${row.quantity}</td>`}
        <td>${row.unit}</td>
        <td style="text-align:right">${row.missing_price ? '<em style="color:#999">no price</em>' : '₱' + (row.unit_price?.toFixed(2) ?? '—')}</td>
        <td style="text-align:right;font-weight:700">${row.missing_price ? '—' : '₱' + (row.ingredient_cost?.toFixed(2) ?? '—')}</td>
      </tr>`).join('');
    w.document.write(`<!DOCTYPE html><html><head><title>Cost Sheet — ${result.recipe_name}</title>
    <style>
      *{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;max-width:740px;margin:40px auto;color:#24201C;padding:0 20px}
      h1{font-size:22px;font-weight:700;margin:0 0 4px}
      .meta{font-size:13px;color:#8C837B;margin-bottom:28px}
      .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:28px}
      .stat{border:1px solid #EFE8DE;border-radius:12px;padding:14px 16px}
      .stat-label{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#A79E94;margin-bottom:5px}
      .stat-value{font-size:22px;font-weight:700;letter-spacing:-0.01em}
      table{width:100%;border-collapse:collapse;font-size:13px}
      thead th{background:#FDFBF8;color:#A79E94;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:9px 10px;text-align:left;border-bottom:1px solid #EFE8DE}
      tbody td{padding:9px 10px;border-bottom:1px solid #F3EDE4}
      .rec{color:#4C5D3E;font-size:22px;font-weight:700}
      @media print{@page{margin:18mm}body{margin:0}}
    </style></head><body>
    <h1>${result.recipe_name}</h1>
    <div class="meta">Generated ${new Date().toLocaleDateString('en-PH',{dateStyle:'long'})} &middot; ${result.servings} serving${result.servings !== 1 ? 's' : ''} per batch</div>
    <div class="stats">
      <div class="stat"><div class="stat-label">Recipe Cost</div><div class="stat-value">₱${result.recipe_cost?.toFixed(2) ?? '—'}</div></div>
      <div class="stat"><div class="stat-label">Portion Cost</div><div class="stat-value">₱${result.portion_cost?.toFixed(2) ?? '—'}</div></div>
      <div class="stat"><div class="stat-label">Recommended Price</div><div class="stat-value rec">₱${result.recommended_price?.toFixed(2) ?? '—'}</div></div>
    </div>
    <table><thead><tr><th>Ingredient</th><th style="text-align:right">Qty</th><th style="text-align:center">Waste</th><th style="text-align:right">Eff. Qty</th><th>Unit</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Cost</th></tr></thead>
    <tbody>${rows}</tbody></table>
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const fmtSource = (s) => {
    if (!s) return '—';
    const [src, date] = s.split(':');
    const label = { dti: 'DTI', da: 'DA', manual: 'Manual', latest: 'Latest' }[src] ?? src.toUpperCase();
    if (!date) return label;
    const [y, m, d] = date.split('-').map(Number);
    const dateStr = new Date(y, m - 1, d).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
    return `${label} · ${dateStr}`;
  };

  const downloadCSV = (filename, headers, rows) => {
    const escape = (v) => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const lines = [
      headers.map(escape).join(','),
      ...rows.map(r => r.map(escape).join(',')),
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportHistoryCSV = () => {
    if (!history.length) return;
    const recipeName = recipes.find(r => String(r.id) === recipeId)?.name ?? 'recipe';
    downloadCSV(
      `costing-history-${recipeName.replace(/\s+/g, '-').toLowerCase()}.csv`,
      ['Date', 'Profile', 'Recipe Cost (₱)', 'Portion Cost (₱)', 'Recommended Price (₱)', 'Price Source'],
      history.map(row => [
        fmtDate(row.computed_at),
        row.pricing_setting_label,
        row.recipe_cost,
        row.portion_cost,
        row.recommended_price,
        row.applied_price_source,
      ])
    );
  };

  const handleBatchRowClick = (row) => {
    setActiveBatchRow(row.recipe_id);
    setRecipeId(String(row.recipe_id));
    setResult(row);
    setSaved(true);
    setActualPrice(savedMenuPrice ? String(savedMenuPrice) : '');
    fetchHistory(row.recipe_id);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const exportBatchCSV = () => {
    if (!batchResults?.results?.length) return;
    downloadCSV(
      `batch-costing-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Recipe', 'Recipe Cost (₱)', 'Portion Cost (₱)', 'Recommended Price (₱)', 'Status'],
      [
        ...batchResults.results.map(row => [
          row.recipe_name,
          row.recipe_cost,
          row.portion_cost,
          row.recommended_price,
          'Computed',
        ]),
        ...batchResults.errors.map(row => [
          row.recipe_name,
          '', '', '',
          `Failed: ${row.error}`,
        ]),
      ]
    );
  };

  const exportResultCSV = () => {
    if (!result) return;
    downloadCSV(
      `cost-breakdown-${result.recipe_name.replace(/\s+/g, '-').toLowerCase()}.csv`,
      ['Ingredient', 'Quantity', 'Unit', 'Waste %', 'Eff. Quantity', 'Unit Price (₱)', 'Cost (₱)', 'Source'],
      (result.ingredient_breakdown ?? []).map(row => [
        row.name,
        row.quantity,
        row.unit,
        row.waste_pct ?? 0,
        row.effective_quantity ?? row.quantity,
        row.missing_price ? '' : row.unit_price,
        row.missing_price ? '' : row.ingredient_cost,
        row.missing_price ? 'no price' : (row.price_source ?? ''),
      ])
    );
  };

  if (loadingMeta) return (
    <div style={{ background: '#FFFFFF', border: '1px solid #EFE8DE', borderRadius: 20, padding: 24 }}>
      <SkeletonStats count={3} />
    </div>
  );

  if (metaError) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 12, textAlign: 'center' }}>
      <p style={{ color: 'oklch(0.58 0.16 28)', fontSize: 14 }}>{metaError}</p>
      <button
        onClick={fetchMeta}
        style={{
          padding: '8px 18px', borderRadius: 12, background: T.accent, color: '#FFFFFF',
          fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Retry
      </button>
    </div>
  );

  const missing     = result?.missing_price_ingredients ?? [];
  const recipeOpts  = recipes.map(r => ({ value: String(r.id), label: r.name }));
  const settingOpts = settings.map(s => ({ value: String(s.id), label: `${s.label} (${s.target_food_cost_pct}%)` }));

  /* Max cost for bar widths */
  const maxCost = result
    ? Math.max(...(result.ingredient_breakdown ?? []).map(r => r.ingredient_cost ?? 0), 0.01)
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <style>{`
        @keyframes growBar { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes riseIn  { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .cst-compute-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(70,86,56,0.32) !important; }
        .cst-compute-btn:active:not(:disabled) { transform: translateY(0); }
      `}</style>

      {/* ── Compute form ── */}
      <div style={{ background: '#FFFFFF', border: '1px solid #EFE8DE', borderRadius: 20, overflow: 'hidden' }}>
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid #F3EDE4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <h3 style={{
            fontSize: 16,
            fontWeight: 600,
            color: T.textPrimary,
            margin: 0,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
          }}>
            Cost Computation
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={handleBatchCompute}
              disabled={batchRunning || !settingId || !recipes.length}
              style={{
                height: 36, padding: '0 16px', borderRadius: 11,
                border: '1px solid var(--input-border, #E7DFD4)',
                background: batchRunning ? T.accentLight : 'var(--card-bg, #FDFBF8)',
                fontSize: 13, fontWeight: 600, color: T.accent,
                cursor: (batchRunning || !settingId || !recipes.length) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', opacity: (!settingId || !recipes.length) ? 0.45 : 1,
                display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              {batchRunning ? (
                <>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  {batchProgress.done}/{batchProgress.total}
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                  Compute All
                </>
              )}
            </button>
          </div>
        </div>

        <form onSubmit={handleCompute} style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>Recipe *</label>
              <Select
                value={recipeId}
                onChange={v => { setRecipeId(v); setResult(null); setSaved(false); setActiveBatchRow(null); setAddOpen(false); setConfirmRemoveId(null); }}
                options={recipeOpts.length ? recipeOpts : [{ value: '', label: 'No recipes' }]}
                placeholder="Select recipe…"
                disabled={!recipeOpts.length}
                searchable
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>Pricing Profile *</label>
              <Select
                value={settingId}
                onChange={setSettingId}
                options={settingOpts.length ? settingOpts : [{ value: '', label: 'No profiles' }]}
                placeholder="Select profile…"
                disabled={!settingOpts.length}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>Price Source</label>
              <Select
                value={priceSource}
                onChange={setPriceSource}
                options={SOURCE_OPTIONS}
              />
            </div>
          </div>

          {recipes.length === 0 && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: 'oklch(0.985 0.025 85)', border: '1px solid oklch(0.92 0.06 85)',
              borderRadius: 14, padding: '12px 16px',
              fontSize: 13, color: 'oklch(0.50 0.12 85)',
            }}>
              <svg style={{ flexShrink: 0, marginTop: 1 }} width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M8 6v3M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M6.5 2.5L1 13h14L9.5 2.5a1.7 1.7 0 00-3 0z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
              <span>
                <strong>No recipes found.</strong> Add recipes in the{' '}
                <a href="/recipes" style={{ color: 'inherit', fontWeight: 700 }}>Recipes</a> page first, then come back to compute costs.
              </span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={computing || !recipeId || !settingId}
              className="cst-compute-btn"
              style={{
                height: 44, padding: '0 22px', borderRadius: 13,
                background: T.accent, color: '#FFFFFF',
                fontWeight: 700, fontSize: 14, border: 'none',
                cursor: (computing || !recipeId || !settingId) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 8px 20px rgba(70,86,56,0.26)',
                opacity: (computing || !recipeId || !settingId) ? 0.55 : 1,
                transition: 'transform 0.15s, box-shadow 0.15s',
                display: 'inline-flex', alignItems: 'center', gap: 7,
              }}
            >
              {computing ? (
                <>
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff',
                    display: 'inline-block', animation: 'spin 0.7s linear infinite',
                  }} />
                  Computing…
                </>
              ) : 'Compute Cost'}
            </button>

            {saved && !computing && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 12, fontWeight: 700,
                color: 'oklch(0.44 0.12 145)',
                background: 'oklch(0.955 0.058 145)',
                padding: '4px 10px', borderRadius: 20,
              }}>
                <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 16 16">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 8l5 5 7-7"/>
                </svg>
                Saved
              </span>
            )}


            {computeError && (
              <p style={{ fontSize: 13, color: 'oklch(0.58 0.16 28)', margin: 0 }}>{computeError}</p>
            )}
          </div>
        </form>
      </div>

      {/* ── Batch results ── */}
      {batchResults && !batchRunning && (
        <div style={{ background: '#FFFFFF', border: '1px solid #EFE8DE', borderRadius: 20, overflow: 'hidden', animation: 'riseIn 420ms cubic-bezier(0.22,1,0.36,1) both' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid #F3EDE4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: T.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 1px' }}>
                Batch Results
              </h4>
              <span style={{ fontSize: 12, color: T.textMuted }}>
                {batchResults.results.length} computed{batchResults.errors.length > 0 ? `, ${batchResults.errors.length} failed` : ''} · <span style={{ color: T.accent }}>click a row to view breakdown</span>
              </span>
            </div>
            <button
              type="button"
              onClick={exportBatchCSV}
              style={{
                height: 34, padding: '0 14px', borderRadius: 10,
                border: 'none', background: T.accent,
                fontSize: 12.5, fontWeight: 700, color: '#FFFFFF',
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                boxShadow: '0 2px 8px rgba(70,86,56,0.22)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#3a4a2e'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(70,86,56,0.32)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.accent; e.currentTarget.style.boxShadow = '0 2px 8px rgba(70,86,56,0.22)'; }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v7m0 0l-3-3m3 3l3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 12h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              Export CSV
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr>
                  {['Recipe', 'Portion Cost', 'Rec. Price', 'Status'].map((h, i) => (
                    <th key={i} style={{ background: T.tblHeadBg, color: T.tblHead, fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', padding: '11px 12px', paddingLeft: i === 0 ? 22 : 12, paddingRight: i === 3 ? 22 : 12, textAlign: i === 0 ? 'left' : 'right' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batchResults.results.map((row, i) => {
                  const isActive = activeBatchRow === row.recipe_id;
                  return (
                    <tr
                      key={i}
                      className="row-interactive"
                      onClick={() => handleBatchRowClick(row)}
                      style={{
                        borderTop: i === 0 ? 'none' : '1px solid #F3EDE4',
                        background: isActive ? T.accentLight : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.1s, transform 0.1s ease',
                        borderLeft: isActive ? `3px solid ${T.accent}` : '3px solid transparent',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = T.rowHover; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '11px 12px 11px 19px', fontWeight: 600, color: T.textPrimary }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, verticalAlign: 'middle' }}>
                          <RecipeThumb src={recipes.find(r => r.id === row.recipe_id)?.image_data} name={row.recipe_name} size={26} radius={7} />
                          {row.recipe_name}
                        </span>
                        {isActive && <span style={{ marginLeft: 7, fontSize: 10.5, fontWeight: 700, color: T.accent, background: '#FFFFFF', padding: '1px 7px', borderRadius: 10, border: `1px solid ${T.accent}` }}>Viewing</span>}
                      </td>
                      <td style={{ padding: '11px 12px', textAlign: 'right', color: T.textSecond, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(row.portion_cost)}</td>
                      <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, color: T.accent, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(row.recommended_price)}</td>
                      <td style={{ padding: '11px 22px 11px 12px', textAlign: 'right' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'oklch(0.955 0.058 145)', color: 'oklch(0.44 0.12 145)' }}>Saved</span>
                      </td>
                    </tr>
                  );
                })}
                {batchResults.errors.map((row, i) => (
                  <tr key={`e${i}`} style={{ borderTop: '1px solid #F3EDE4', background: 'oklch(0.995 0.01 28)' }}>
                    <td style={{ padding: '11px 12px 11px 22px', fontWeight: 600, color: T.textPrimary }}>{row.recipe_name}</td>
                    <td colSpan={2} style={{ padding: '11px 12px', color: 'oklch(0.58 0.16 28)', fontSize: 12, fontStyle: 'italic' }}>{row.error}</td>
                    <td style={{ padding: '11px 22px 11px 12px', textAlign: 'right' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'oklch(0.965 0.04 28)', color: 'oklch(0.55 0.16 28)' }}>Not computed</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Computing skeleton ── */}
      {computing && (
        <div style={{ background: '#FFFFFF', border: '1px solid #EFE8DE', borderRadius: 20, padding: 24 }}>
          <SkeletonStats count={3} />
        </div>
      )}

      {/* ── Results ── */}
      {result && !computing && (
        <div ref={resultRef} style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'riseIn 420ms cubic-bezier(0.22,1,0.36,1) both' }}>

          {/* Hero card — recommended price */}
          <div style={{
            background: 'linear-gradient(160deg, oklch(0.30 0.032 145) 0%, oklch(0.228 0.026 150) 100%)',
            borderRadius: 20,
            padding: '28px 28px 24px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Decorative circle */}
            <div style={{
              position: 'absolute', top: -40, right: -40,
              width: 180, height: 180, borderRadius: '50%',
              background: 'rgba(255,255,255,0.03)',
            }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <RecipeThumb src={recipes.find(r => r.id === result.recipe_id)?.image_data} name={result.recipe_name} size={40} radius={10} />
                <span style={{ fontSize: 16, fontWeight: 600, color: '#FFFFFF' }}>{result.recipe_name}</span>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
                Recommended Selling Price
              </div>
              <div style={{
                fontSize: 66,
                fontWeight: 700,
                color: '#FFFFFF',
                fontVariantNumeric: 'tabular-nums',
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
                lineHeight: 1,
                marginBottom: 12,
              }}>
                {formatCurrency(result.recommended_price)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 13, color: 'rgba(255,255,255,0.7)',
                  background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: '3px 10px',
                }}>
                  {formatPct(result.pricing_setting?.target_food_cost_pct)} food cost target
                </span>
                <span style={{
                  fontSize: 13, color: 'rgba(255,255,255,0.7)',
                  background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: '3px 10px',
                }}>
                  {result.servings} serving{result.servings !== 1 ? 's' : ''} per batch
                </span>
              </div>
            </div>
          </div>

          {/* stat tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            <StatCard
              index={0}
              label="Recipe Cost"
              value={formatCurrency(result.recipe_cost)}
              sub="Full batch total"
            />
            <StatCard
              index={1}
              label="Portion Cost"
              value={formatCurrency(result.portion_cost)}
              sub="Per serving"
            />
            <StatCard
              index={2}
              label="Food Cost %"
              value={
                result.portion_cost != null && result.recommended_price != null && result.recommended_price > 0
                  ? `${((result.portion_cost / result.recommended_price) * 100).toFixed(1)}%`
                  : '—'
              }
              sub={`Target: ${result.pricing_setting?.target_food_cost_pct ?? '—'}%`}
              accent={
                result.portion_cost != null && result.recommended_price != null && result.recommended_price > 0
                  ? ((result.portion_cost / result.recommended_price) * 100) <= (result.pricing_setting?.target_food_cost_pct ?? 35)
                    ? T.accent
                    : 'oklch(0.55 0.16 28)'
                  : T.textPrimary
              }
            />
            <StatCard
              index={3}
              label="Gross Profit / Serving"
              value={
                result.recommended_price != null && result.portion_cost != null
                  ? formatCurrency(result.recommended_price - result.portion_cost)
                  : '—'
              }
              sub="Recommended price − portion cost"
              accent={T.accent}
            />
            {/* Your actual menu price — always show so the owner sees the gap */}
            {(() => {
              const mp = savedMenuPrice ?? (actualPrice && parseFloat(actualPrice) > 0 ? parseFloat(actualPrice) : null);
              const gap = mp != null && result.recommended_price != null ? mp - result.recommended_price : null;
              const isUnder = gap != null && gap < -0.01;
              const isOver  = gap != null && gap > 0.01;
              return (
                <StatCard
                  label="Your Menu Price"
                  value={mp != null ? formatCurrency(mp) : 'Not set'}
                  sub={
                    gap != null
                      ? isUnder
                        ? `↓ ${formatCurrency(Math.abs(gap))} below recommended`
                        : isOver
                        ? `↑ ${formatCurrency(gap)} above recommended`
                        : 'On target with recommended'
                      : 'Set your actual selling price below'
                  }
                  accent={
                    mp == null ? T.textMuted
                    : isUnder ? '#D97706'
                    : isOver  ? '#2563EB'
                    : T.accent
                  }
                />
              );
            })()}
          </div>

          {/* Menu price — show whenever there's a result OR an already-saved price */}
          {(result.portion_cost != null || savedMenuPrice) && (
            <div style={{ background: '#FFFFFF', border: '1px solid #EFE8DE', borderRadius: 18, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Menu Price
                </span>
                {savedMenuPrice && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.accent, background: 'oklch(0.955 0.021 138)', padding: '2px 10px', borderRadius: 999 }}>
                    Currently on menu: {formatCurrency(savedMenuPrice)}
                  </span>
                )}
              </div>
              {result.portion_cost != null ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: '1 1 140px', maxWidth: 220 }}>
                      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 600, color: T.textMuted, pointerEvents: 'none' }}>₱</span>
                      <input
                        type="number" step="0.01" min="0.01"
                        placeholder={savedMenuPrice ? String(savedMenuPrice) : 'Set your menu price'}
                        value={actualPrice}
                        onChange={e => setActualPrice(e.target.value)}
                        style={{ height: 40, paddingLeft: 28, paddingRight: 12, borderRadius: 10, border: `1px solid ${T.inputBorder}`, background: T.inputBg, fontSize: 14, color: T.textPrimary, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
                        onFocus={e => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = T.focusShadow; e.target.style.background = '#FFFFFF'; }}
                        onBlur={e => { e.target.style.borderColor = T.inputBorder; e.target.style.boxShadow = 'none'; e.target.style.background = T.inputBg; }}
                      />
                    </div>
                    {actualPrice && parseFloat(actualPrice) > 0 && (
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
                        {(() => {
                          const ap = parseFloat(actualPrice);
                          const actualFcPct = (result.portion_cost / ap * 100);
                          const targetPct = result.pricing_setting?.target_food_cost_pct ?? 35;
                          const p = loadPrefs();
                          const priceGapThreshold = p.priceGapThreshold ?? 15;
                          const foodCostDeviationThreshold = p.foodCostDeviationThreshold ?? 5;
                          const gapPct = Math.abs((ap - result.recommended_price) / result.recommended_price * 100);
                          const fcDeviation = actualFcPct - targetPct;
                          const needsPriceUpdate = fcDeviation > foodCostDeviationThreshold || gapPct > priceGapThreshold;
                          return (
                            <>
                              <span style={{ color: T.textSecond }}>
                                Food cost:{' '}
                                <strong style={{ color: fcDeviation > foodCostDeviationThreshold ? 'oklch(0.55 0.16 28)' : T.accent }}>
                                  {actualFcPct.toFixed(1)}%
                                </strong>
                                {' '}<span style={{ color: T.textMuted }}>(target {targetPct}%)</span>
                              </span>
                              <span style={{ color: T.textSecond }}>
                                Price gap:{' '}
                                <strong style={{ color: gapPct > priceGapThreshold ? 'oklch(0.55 0.16 28)' : T.accent }}>
                                  {gapPct.toFixed(1)}%
                                </strong>
                                {' '}<span style={{ color: T.textMuted }}>(max {priceGapThreshold}%)</span>
                              </span>
                              <span style={{ color: T.textSecond }}>
                                Margin: <strong style={{ color: T.accent }}>{formatCurrency(ap - result.portion_cost)}</strong>
                              </span>
                              {needsPriceUpdate && (
                                <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: '#FEF3C7', color: '#92400E' }}>
                                  Consider updating your selling price
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                    {result.output_id && (
                      <button
                        type="button"
                        disabled={!actualPrice || parseFloat(actualPrice) <= 0 || savingActual}
                        onClick={handleSaveActualPrice}
                        style={{
                          height: 40, padding: '0 16px', borderRadius: 10,
                          background: (!actualPrice || parseFloat(actualPrice) <= 0) ? T.accentLight : T.accent,
                          color: (!actualPrice || parseFloat(actualPrice) <= 0) ? T.accent : '#FFFFFF',
                          fontWeight: 600, fontSize: 13, border: 'none', cursor: (!actualPrice || parseFloat(actualPrice) <= 0) ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit', opacity: savingActual ? 0.6 : 1, whiteSpace: 'nowrap',
                        }}
                      >
                        {savingActual ? 'Saving…' : savedMenuPrice ? 'Update Price' : 'Save Price'}
                      </button>
                    )}
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: T.textMuted }}>
                    {savedMenuPrice
                      ? 'Update the price you charge on the menu — reflected on the Recipe page too.'
                      : 'Set the price you charge to compare against the recommendation above.'}
                  </p>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 12.5, color: T.textMuted }}>
                  Compute cost to update the menu price for this recipe.
                </p>
              )}
            </div>
          )}

          {/* Missing prices warning */}
          {missing.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: 'oklch(0.985 0.025 85)', border: '1px solid oklch(0.92 0.06 85)',
              borderRadius: 14, padding: '12px 16px',
              fontSize: 13, color: 'oklch(0.50 0.12 85)',
            }}>
              <svg style={{ flexShrink: 0, marginTop: 1 }} width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M8 6v3M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M6.5 2.5L1 13h14L9.5 2.5a1.7 1.7 0 00-3 0z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
              <div>
                <span style={{ fontWeight: 700 }}>Cost not computed. These ingredients have no price: </span>
                {missing.map((item, i) => (
                  <span key={item.ingredient_id}>{i > 0 && ', '}<span style={{ fontWeight: 700 }}>{item.name}</span></span>
                ))}
                . Add a price for each in <span style={{ fontWeight: 700 }}>Ingredients</span>, then compute again. A cost from only some ingredients would understate the price.
              </div>
            </div>
          )}

          {/* Ingredient breakdown */}
          <div style={{ background: '#FFFFFF', border: '1px solid #EFE8DE', borderRadius: 20, overflow: 'hidden' }}>
            <div style={{
              padding: '14px 22px',
              borderBottom: '1px solid #F3EDE4',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
            }}>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: T.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 1px' }}>
                  Ingredient Breakdown
                </h4>
                <span style={{ fontSize: 12, color: T.textMuted }}>
                  {result.ingredient_breakdown.length} ingredient{result.ingredient_breakdown.length !== 1 ? 's' : ''}
                  {' · '}adding or removing here updates the recipe and recomputes
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={openAddIngredient}
                  disabled={addOpen}
                  style={{
                    height: 34, padding: '0 13px', borderRadius: 10,
                    border: `1px solid ${T.accent}`, background: '#FFFFFF',
                    fontSize: 12.5, fontWeight: 700, color: T.accent,
                    cursor: addOpen ? 'default' : 'pointer', fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    opacity: addOpen ? 0.5 : 1,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                  Add ingredient
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  style={{
                    height: 34, padding: '0 13px', borderRadius: 10,
                    border: '1px solid #E7DFD4', background: '#FDFBF8',
                    fontSize: 12.5, fontWeight: 600, color: T.textSecond,
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F3EDE4'}
                  onMouseLeave={e => e.currentTarget.style.background = '#FDFBF8'}
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <rect x="3" y="5" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M5 5V3h6v2M5 12v1h6v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="12" cy="8" r="0.7" fill="currentColor"/>
                  </svg>
                  Print
                </button>
                <button
                  type="button"
                  onClick={exportResultCSV}
                  style={{
                    height: 34, padding: '0 14px', borderRadius: 10,
                    border: 'none', background: T.accent,
                    fontSize: 12.5, fontWeight: 700, color: '#FFFFFF',
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    boxShadow: '0 2px 8px rgba(70,86,56,0.22)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#3a4a2e'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(70,86,56,0.32)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.accent; e.currentTarget.style.boxShadow = '0 2px 8px rgba(70,86,56,0.22)'; }}
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <path d="M8 3v7m0 0l-3-3m3 3l3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M3 12h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                  Export CSV
                </button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
                <thead>
                  <tr>
                    {[
                      { label: 'Ingredient',  align: 'left',  first: true },
                      { label: 'Qty',         align: 'right' },
                      { label: 'Unit',        align: 'left' },
                      { label: 'Unit Price',  align: 'right' },
                      { label: 'Cost',        align: 'right' },
                      { label: 'Source',      align: 'center' },
                      { label: '',            align: 'right', last: true },
                    ].map((h, i) => (
                      <th key={i} style={{
                        background: T.tblHeadBg, color: T.tblHead,
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
                        padding: '11px 12px',
                        paddingLeft:  h.first ? 22 : 12,
                        paddingRight: h.last  ? 22 : 12,
                        textAlign: h.align,
                      }}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.ingredient_breakdown.map((row, i) => {
                    const barW = row.ingredient_cost && maxCost
                      ? `${Math.max(4, Math.round((row.ingredient_cost / maxCost) * 100))}%`
                      : '4%';
                    return (
                      <tr
                        key={row.ingredient_id}
                        className="row-interactive"
                        style={{
                          borderTop: i === 0 ? 'none' : '1px solid #F3EDE4',
                          background: row.missing_price ? 'oklch(0.995 0.01 85)' : 'transparent',
                          transition: 'background 0.1s, transform 0.1s ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = T.rowHover}
                        onMouseLeave={e => e.currentTarget.style.background = row.missing_price ? 'oklch(0.995 0.01 85)' : 'transparent'}
                      >
                        <td style={{ padding: '13px 12px 13px 22px', color: T.textPrimary, fontWeight: 600 }}>
                          {row.name}
                        </td>
                        <td style={{ padding: '13px 12px', textAlign: 'right', color: T.textMuted, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                          {row.waste_pct > 0 ? (
                            <div>
                              <div style={{ fontFamily: 'monospace', fontWeight: 600, color: T.textSecond }}>{row.effective_quantity}</div>
                              <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 2 }}>orig {row.quantity} +{row.waste_pct}%</div>
                            </div>
                          ) : (
                            <span style={{ fontFamily: 'monospace' }}>{row.quantity}</span>
                          )}
                        </td>
                        <td style={{ padding: '13px 12px', color: T.textMuted, fontSize: 13 }}>
                          <span>{row.unit}</span>
                          {row.base_unit && row.base_unit !== row.unit && !row.unit_mismatch && (
                            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1, opacity: 0.7 }}>
                              → {Number(row.converted_quantity % 1 === 0 ? row.converted_quantity : row.converted_quantity?.toFixed(4))} {row.base_unit}
                            </div>
                          )}
                          {row.unit_mismatch && (
                            <div style={{ fontSize: 10, color: 'oklch(0.55 0.15 50)', marginTop: 1 }}>⚠ unit mismatch</div>
                          )}
                        </td>
                        <td style={{ padding: '13px 12px', textAlign: 'right', color: T.textSecond, fontVariantNumeric: 'tabular-nums', fontSize: 13.5 }}>
                          {row.missing_price
                            ? <span style={{ fontSize: 12, color: 'oklch(0.50 0.12 85)', fontStyle: 'italic' }}>no price</span>
                            : <div>
                                {formatCurrency(row.unit_price)}
                                {row.base_unit && (
                                  <span style={{ fontSize: 10.5, color: T.textMuted, marginLeft: 2 }}>/{row.base_unit}</span>
                                )}
                              </div>
                          }
                        </td>
                        <td style={{ padding: '13px 12px', textAlign: 'right' }}>
                          {row.missing_price ? (
                            <span style={{ color: '#D5CCBF', fontSize: 13 }}>—</span>
                          ) : (
                            <div>
                              <div style={{ fontWeight: 700, color: T.textPrimary, fontVariantNumeric: 'tabular-nums', fontSize: 13.5, marginBottom: 4 }}>
                                {formatCurrency(row.ingredient_cost)}
                              </div>
                              <div style={{ height: 5, borderRadius: 4, background: '#F3EDE4', overflow: 'hidden', minWidth: 60 }}>
                                <div style={{
                                  height: '100%', width: barW,
                                  background: T.accent, borderRadius: 4,
                                  transformOrigin: 'left',
                                  animation: 'growBar 520ms cubic-bezier(0.22,1,0.36,1) both',
                                }} />
                              </div>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '13px 12px', textAlign: 'center' }}>
                          {row.missing_price
                            ? <span style={{ color: '#D5CCBF', fontSize: 12 }}>—</span>
                            : <SourceBadge src={row.price_source} />
                          }
                        </td>
                        <td style={{ padding: '13px 22px 13px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {row.recipe_ingredient_id == null ? null : confirmRemoveId === row.recipe_ingredient_id ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 12, color: T.textSecond }}>Remove?</span>
                              <button type="button" onClick={() => handleRemoveIngredient(row)} disabled={removingId === row.recipe_ingredient_id}
                                style={{ height: 26, padding: '0 9px', borderRadius: 7, border: 'none', background: 'oklch(0.58 0.16 28)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                {removingId === row.recipe_ingredient_id ? '…' : 'Yes'}
                              </button>
                              <button type="button" onClick={() => setConfirmRemoveId(null)}
                                style={{ height: 26, padding: '0 9px', borderRadius: 7, border: '1px solid #E7DFD4', background: '#fff', color: T.textSecond, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                No
                              </button>
                            </span>
                          ) : (
                            <button type="button" title={`Remove ${row.name} from recipe`} aria-label={`Remove ${row.name}`}
                              onClick={() => setConfirmRemoveId(row.recipe_ingredient_id)}
                              style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: T.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'oklch(0.97 0.025 30)'; e.currentTarget.style.color = 'oklch(0.55 0.16 28)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.textMuted; }}>
                              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 5h10M6 5V3.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V5m1 0v7.5a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 4.5 12.5V5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {addOpen && (() => {
                    const inRecipe   = new Set(result.ingredient_breakdown.map(r => r.ingredient_id));
                    const choices    = allIngredients.filter(i => !inRecipe.has(i.id));
                    const selected   = allIngredients.find(i => String(i.id) === addForm.ingredient_id);
                    const unit       = addForm.unit || selected?.unit || '';
                    const factor     = selected ? getConversionFactor(unit, selected.unit) : null;
                    const qty        = parseFloat(addForm.quantity);
                    const fieldStyle = { height: 34, borderRadius: 9, border: '1px solid #E7DFD4', background: '#FDFBF8', padding: '0 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
                    return (
                      <tr style={{ borderTop: '1px solid #F3EDE4', background: T.accentLight }}>
                        <td colSpan={7} style={{ padding: '14px 22px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                            <div style={{ minWidth: 220, flex: '1 1 220px' }}>
                              <div style={{ fontSize: 11.5, fontWeight: 600, color: T.textSecond, marginBottom: 5 }}>Ingredient</div>
                              <Select
                                value={addForm.ingredient_id}
                                onChange={v => {
                                  const ing = allIngredients.find(i => String(i.id) === v);
                                  setAddForm(f => ({ ...f, ingredient_id: v, unit: ing?.unit || '' }));
                                }}
                                options={choices.map(i => ({ value: String(i.id), label: i.name }))}
                                placeholder={choices.length ? 'Choose ingredient…' : 'All ingredients already added'}
                                searchable
                              />
                            </div>
                            <div>
                              <div style={{ fontSize: 11.5, fontWeight: 600, color: T.textSecond, marginBottom: 5 }}>Quantity</div>
                              <input type="number" min="0" step="any" placeholder="e.g. 250" value={addForm.quantity}
                                onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddIngredient(); } }}
                                style={{ ...fieldStyle, width: 110 }} />
                            </div>
                            <div style={{ width: 100 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 600, color: T.textSecond, marginBottom: 5 }}>Unit</div>
                              <Select
                                value={unit}
                                onChange={v => setAddForm(f => ({ ...f, unit: v }))}
                                options={(selected ? unitOptionsFor(selected.unit) : []).map(u => ({ value: u, label: u }))}
                                placeholder="—"
                                disabled={!selected}
                              />
                            </div>
                            <button type="button" onClick={handleAddIngredient} disabled={addBusy}
                              style={{ height: 34, padding: '0 16px', borderRadius: 9, border: 'none', background: T.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: addBusy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: addBusy ? 0.7 : 1 }}>
                              {addBusy ? 'Adding…' : 'Add & recompute'}
                            </button>
                            <button type="button" onClick={() => setAddOpen(false)}
                              style={{ height: 34, padding: '0 12px', borderRadius: 9, border: '1px solid #E7DFD4', background: '#fff', color: T.textSecond, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Cancel
                            </button>
                          </div>
                          {selected && (
                            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 8 }}>
                              {selected.name} is priced per {selected.unit}.
                              {factor != null && factor !== 1 && qty > 0 && ` ${qty} ${unit} = ${Number((qty * factor).toFixed(4))} ${selected.unit}.`}
                            </div>
                          )}
                          {addError && <div style={{ fontSize: 12.5, color: 'oklch(0.55 0.16 28)', marginTop: 8 }}>{addError}</div>}
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Cost Trend Chart ── */}
      {history.length > 0 && history.length < 2 && (
        <div style={{ background: '#FFFFFF', border: '1px solid #EFE8DE', borderRadius: 20, padding: '20px 22px' }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: T.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 8px' }}>
            Cost Trend
          </h4>
          <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>
            Run Compute again after prices change to see the cost trend here.
          </p>
        </div>
      )}
      {history.length >= 2 && (
        <div style={{ background: '#FFFFFF', border: '1px solid #EFE8DE', borderRadius: 20, padding: '20px 22px' }}>
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: T.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 2px' }}>
              Cost Trend
            </h4>
            <span style={{ fontSize: 12, color: T.textMuted }}>Portion cost and recommended price over time</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={[...history].reverse().map(row => ({
                date: new Date(row.computed_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
                portion_cost: row.portion_cost,
                recommended_price: row.recommended_price,
              }))}
              margin={{ top: 4, right: 20, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F3EDE4" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: T.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: T.textMuted }} axisLine={false} tickLine={false} tickFormatter={v => `₱${v}`} width={56} />
              <Tooltip
                formatter={(value, name) => [formatCurrency(value), name === 'portion_cost' ? 'Portion Cost' : 'Rec. Price']}
                contentStyle={{ background: 'rgba(24,20,16,0.88)', border: 'none', borderRadius: 10, fontSize: 12, color: '#F5F0E8' }}
                labelStyle={{ color: 'rgba(245,240,232,0.65)', marginBottom: 4 }}
              />
              <Line type="monotone" dataKey="portion_cost" stroke="#8B7EC8" strokeWidth={2} dot={{ r: 3, fill: '#8B7EC8' }} strokeDasharray="5 3" />
              <Line type="monotone" dataKey="recommended_price" stroke={T.accent} strokeWidth={2.5} dot={{ r: 3.5, fill: T.accent }} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: T.textMuted }}>
              <svg width="18" height="3"><line x1="0" y1="1.5" x2="8" y2="1.5" stroke="#8B7EC8" strokeWidth="2" strokeDasharray="4 2"/><line x1="10" y1="1.5" x2="18" y2="1.5" stroke="#8B7EC8" strokeWidth="2" strokeDasharray="4 2"/></svg>
              Portion Cost
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: T.textMuted }}>
              <svg width="18" height="3"><line x1="0" y1="1.5" x2="18" y2="1.5" stroke={T.accent} strokeWidth="2.5"/></svg>
              Rec. Price
            </span>
          </div>
        </div>
      )}

      {/* Persistent menu price badge — visible when no active computation result */}
      {!result && !computing && savedMenuPrice && (
        <div style={{ background: '#FFFFFF', border: '1px solid #EFE8DE', borderRadius: 18, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Menu Price</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.accent, background: 'oklch(0.955 0.021 138)', padding: '3px 12px', borderRadius: 999 }}>
            Currently on menu: {formatCurrency(savedMenuPrice)}
          </span>
          <span style={{ fontSize: 12, color: T.textMuted }}>Compute cost to update</span>
        </div>
      )}

      {/* ── Costing History ── */}
      <div style={{ background: '#FFFFFF', border: '1px solid #EFE8DE', borderRadius: 20, overflow: 'hidden' }}>
        <div style={{
          padding: '14px 22px',
          borderBottom: '1px solid #F3EDE4',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
        }}>
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: T.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 1px' }}>
              Costing History
            </h4>
            {recipeId && (
              <span style={{ fontSize: 12, color: T.textMuted }}>
                {recipes.find(r => String(r.id) === recipeId)?.name}
              </span>
            )}
          </div>
          {history.length > 0 && (
            <button
              type="button"
              onClick={exportHistoryCSV}
              style={{
                height: 34, padding: '0 14px', borderRadius: 10,
                border: 'none', background: T.accent,
                fontSize: 12.5, fontWeight: 700, color: '#FFFFFF',
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                boxShadow: '0 2px 8px rgba(70,86,56,0.22)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#3a4a2e'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(70,86,56,0.32)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.accent; e.currentTarget.style.boxShadow = '0 2px 8px rgba(70,86,56,0.22)'; }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v7m0 0l-3-3m3 3l3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 12h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              Export CSV
            </button>
          )}
        </div>

        {loadingHistory ? (
          <div style={{ padding: 20 }}>
            <SkeletonTable rows={5} cols={4} />
          </div>
        ) : historyError ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '32px 0', textAlign: 'center' }}>
            <p style={{ color: 'oklch(0.58 0.16 28)', fontSize: 13 }}>{historyError}</p>
            <button
              onClick={() => fetchHistory(recipeId)}
              style={{
                padding: '6px 14px', borderRadius: 10, background: T.accent, color: '#FFFFFF',
                fontWeight: 600, fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Retry
            </button>
          </div>
        ) : history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FiDollarSign size={24} /></div>
            <div className="empty-state-title">No computations yet</div>
            <div className="empty-state-subtitle">Select a recipe and pricing profile above to compute your first dish cost.</div>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
                <thead>
                  <tr>
                    {[
                      { label: 'Date',       align: 'left',  first: true },
                      { label: 'Profile',    align: 'left' },
                      { label: 'Portion',    align: 'right' },
                      { label: 'Rec. Price', align: 'right' },
                      { label: 'Source',     align: 'left',  last: true },
                    ].map((h, i) => (
                      <th key={i} style={{
                        background: T.tblHeadBg, color: T.tblHead,
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
                        padding: '11px 12px',
                        paddingLeft:  h.first ? 22 : 12,
                        paddingRight: h.last  ? 22 : 12,
                        textAlign: h.align,
                      }}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(historyExpanded ? history : history.slice(0, HISTORY_PREVIEW)).map((row, i) => (
                    <tr
                      key={row.id}
                      className="row-interactive"
                      style={{ borderTop: i === 0 ? 'none' : '1px solid #F3EDE4', transition: 'background 0.1s, transform 0.1s ease' }}
                      onMouseEnter={e => e.currentTarget.style.background = T.rowHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 12px 12px 22px', color: T.textMuted, fontSize: 12, whiteSpace: 'nowrap' }}>
                        {fmtDate(row.computed_at)}
                      </td>
                      <td style={{ padding: '12px', color: T.textSecond, fontSize: 13.5 }}>
                        {row.pricing_setting_label}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: T.textSecond, fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(row.portion_cost)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: T.accent, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(row.recommended_price)}
                      </td>
                      <td style={{ padding: '12px 22px 12px 12px' }}>
                        <span style={{
                          fontSize: 12.5, fontWeight: 500, color: T.textSecond,
                        }}>
                          {fmtSource(row.applied_price_source)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {history.length > HISTORY_PREVIEW && (
              <div style={{ padding: '10px 22px 14px', borderTop: '1px solid #F3EDE4' }}>
                <button
                  type="button"
                  onClick={() => setHistoryExpanded(e => !e)}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    fontSize: 12.5, fontWeight: 600, color: T.accent,
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <svg
                    width="13" height="13" viewBox="0 0 14 14" fill="none"
                    style={{ transition: 'transform 0.2s', transform: historyExpanded ? 'rotate(180deg)' : 'none' }}
                  >
                    <path d="M2 4.5l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {historyExpanded
                    ? 'Show less'
                    : `Show ${history.length - HISTORY_PREVIEW} older record${history.length - HISTORY_PREVIEW !== 1 ? 's' : ''}`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
