import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import api from '../lib/api';
import { loadPrefs } from '../lib/prefs';
import { getUser } from '../lib/auth';
import { SkeletonTable, SkeletonStats } from '../components/Skeleton';
import { formatCurrency } from '../lib/format';

const fmtDate = (d) => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtDateLong = (d) => new Date(d).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const fmtChartDate = (d) => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? (parts[0][0] || '?').toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function daysAgoISO(n) { return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); }


const T = {
  accent:      '#4C5D3E',
  accentLight: 'oklch(0.955 0.021 138)',
  textPrimary: '#24201C',
  textSecond:  '#6B625A',
  textMuted:   '#8C837B',
  rowHover:    '#FDFBF8',
  tblHead:     '#A79E94',
  tblHeadBg:   '#FDFBF8',
  cardBorder:  '1px solid #EDE7DC',
};

// Chart line colors — one per recipe, cycling through these
const LINE_COLORS = ['#4C5D3E', '#D97706', '#2563EB', '#7C3AED', '#DC2626', '#059669'];

/* ── Stat card ─────────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, icon, accent, index = 0 }) {
  return (
    <div className="card-spring" style={{
      '--i': index,
      background: 'var(--card-bg)', border: T.cardBorder, borderRadius: 18,
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: accent ? `${accent}18` : T.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent || T.accent }}>
          {icon}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.04em', color: accent || 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 5 }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── Custom chart tooltip ─────────────────────────────────────────────────── */
function CostTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#FFF', border: T.cardBorder, borderRadius: 12, padding: '10px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', minWidth: 160 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: T.textMuted, marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{fmtChartDate(label)}</div>
      {payload.map(entry => (
        <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: T.textSecond, flex: 1 }}>{entry.name}</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Onboarding ─────────────────────────────────────────────────────────────── */
function Onboarding() {
  const steps = [
    { num: 1, to: '/ingredients', label: 'Add your ingredients',  desc: 'Enter the items you use in your dishes.' },
    { num: 2, to: '/recipes',     label: 'Build your recipes',    desc: 'Link ingredients and set how many servings each batch makes.' },
    { num: 3, to: '/extraction',  label: 'Import market prices',  desc: 'Pull current prices from DTI or DA price bulletins.' },
    { num: 4, to: '/costing',     label: 'Get your selling price', desc: 'The system calculates your portion cost and recommended price.' },
  ];
  return (
    <div style={{ background: 'var(--card-bg)', border: T.cardBorder, borderRadius: 20, padding: '24px' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Set up in 4 steps</h2>
      <p style={{ margin: '0 0 18px', fontSize: 13, color: T.textMuted }}>Follow this to get your first dish priced.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        {steps.map(s => (
          <Link key={s.num} to={s.to} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 8, padding: 16, borderRadius: 14, border: T.cardBorder, background: 'var(--table-header-bg)', transition: 'all 180ms ease' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(76,93,62,0.10)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--table-header-bg)'; e.currentTarget.style.borderColor = '#EDE7DC'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
          >
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, color: T.accent }}>{s.num}</div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.4 }}>{s.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const prefs = loadPrefs();
  const user  = getUser();
  const ownerName    = prefs.ownerName || user?.full_name || user?.username || 'there';
  const alertThreshold = prefs.alertThresholdDays ?? 7;

  const [menuBoard, setMenuBoard]         = useState([]);
  const [priceAlerts, setPriceAlerts]     = useState([]);
  const [trendData, setTrendData]         = useState([]);
  const [trendRecipes, setTrendRecipes]   = useState([]);
  const [dismissedAlert, setDismissedAlert] = useState(() => {
    try { return localStorage.getItem('smp_alert_dismissed') === 'true'; } catch { return false; }
  });
  const [editingId, setEditingId]         = useState(null);   // recipe id being edited
  const [editingVal, setEditingVal]       = useState('');

  const totalRecipes    = menuBoard.length;
  const pricedRecipes   = menuBoard.filter(r => r.status === 'priced').length;
  const unpricedCount   = totalRecipes - pricedRecipes;

  // Underpriced: dishes where the owner's set price is below the recommended
  const underpricedCount = menuBoard.filter(r =>
    r.menuPrice != null && r.recPrice != null && r.menuPrice < r.recPrice - 0.01
  ).length;

  // Avg food cost % using actual menu price where set, recommended price otherwise
  const fcRows = menuBoard.filter(r => r.portionCost != null && (r.menuPrice ?? r.recPrice) != null);
  const avgFoodCostPct = fcRows.length > 0
    ? fcRows.reduce((s, r) => s + (r.portionCost / (r.menuPrice ?? r.recPrice)) * 100, 0) / fcRows.length
    : null;

  const load = async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [ingRes, recRes] = await Promise.all([api.get('/ingredients'), api.get('/recipes')]);
        const ingredients = ingRes.data.data || [];
        const recipes     = recRes.data.data || [];

        const [historyResults, latestPriceResults] = await Promise.all([
          Promise.all(recipes.map(r =>
            api.get(`/costing/history/${r.id}`)
              .then(res => ({ recipeId: r.id, name: r.name, rows: res.data.data || [] }))
              .catch(() => ({ recipeId: r.id, name: r.name, rows: [] }))
          )),
          Promise.all(ingredients.map(ing =>
            api.get(`/prices/latest/${ing.id}`)
              .then(res => ({ ingredient: ing, price: res.data.data }))
              .catch(() => ({ ingredient: ing, price: null }))
          )),
        ]);

        // Menu board
        const historyMap = {};
        historyResults.forEach(({ recipeId, rows }) => { historyMap[recipeId] = rows; });

        const board = recipes.map(r => {
          const rows      = historyMap[r.id] || [];
          const latest    = rows[0] || null;
          // actual_selling_price is saved per costing_output row — find the most recent one that has it
          const withPrice = rows.find(row => row.actual_selling_price != null);
          return {
            id:           r.id,
            name:         r.name,
            servings:     r.servings,
            portionCost:  latest ? parseFloat(latest.portion_cost) : null,
            recPrice:     latest ? parseFloat(latest.recommended_price) : null,
            menuPrice:    withPrice ? parseFloat(withPrice.actual_selling_price) : null,
            outputId:     latest?.id ?? null,  // needed for PATCH /costing/:id/actual-price
            lastComputed: latest ? latest.computed_at : null,
            status:       latest ? 'priced' : 'unpriced',
          };
        });
        board.sort((a, b) => {
          if (a.status !== b.status) return a.status === 'unpriced' ? -1 : 1;
          return new Date(b.lastComputed) - new Date(a.lastComputed);
        });
        setMenuBoard(board);

        // ── Cost trend chart data (last 30 days) ──────────────────────────────
        // Keep recipes that have ≥2 costing entries in the last 30 days
        const cutoff30 = daysAgoISO(30);
        const trendableRecipes = historyResults.filter(({ rows }) =>
          rows.filter(r => r.computed_at >= cutoff30).length >= 1
        ).slice(0, 6); // cap at 6 to keep chart readable

        if (trendableRecipes.length > 0) {
          // Build a unified date-keyed map
          const dateMap = {};
          trendableRecipes.forEach(({ recipeId, name, rows }) => {
            rows.filter(r => r.computed_at >= cutoff30).forEach(row => {
              const d = row.computed_at.slice(0, 10);
              if (!dateMap[d]) dateMap[d] = { date: d };
              // Keep latest entry per recipe per day
              if (!dateMap[d][name] || row.computed_at > dateMap[d][`_ts_${name}`]) {
                dateMap[d][name] = parseFloat(row.portion_cost);
                dateMap[d][`_ts_${name}`] = row.computed_at;
              }
            });
          });
          const chartRows = Object.values(dateMap)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(row => {
              // strip internal tracking keys
              const clean = {};
              Object.keys(row).forEach(k => { if (!k.startsWith('_ts_')) clean[k] = row[k]; });
              return clean;
            });
          setTrendData(chartRows);
          setTrendRecipes(trendableRecipes.map(r => r.name));
        }

        // Price alerts
        const cutoff = daysAgoISO(alertThreshold);
        const alerts = [];
        latestPriceResults.forEach(({ ingredient, price }) => {
          if (!price) {
            alerts.push({ ...ingredient, alertReason: 'No price recorded yet', noPrice: true });
          } else if (price.extraction_date < cutoff) {
            alerts.push({ ...ingredient, alertReason: `Last updated ${fmtDate(price.extraction_date)}`, noPrice: false });
          }
        });
        setPriceAlerts(alerts);
    } catch { /* fail silently */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [alertThreshold]);

  const downloadMenuReport = () => {
    const today = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
    const headers = [
      'Recipe Name', 'Servings per Batch',
      'Recommended Price (PHP)',
      'Your Current Price (PHP)', 'Gap vs Recommended (PHP)', 'Pricing Status',
      'Last Computed', 'Status',
    ];
    const rows = menuBoard.map(r => {
      const gap = (r.menuPrice != null && r.recPrice != null) ? (r.menuPrice - r.recPrice).toFixed(2) : '';
      const pricingStatus = r.menuPrice == null || r.recPrice == null
        ? 'Not set'
        : r.menuPrice < r.recPrice - 0.01 ? 'Under-charging'
        : r.menuPrice > r.recPrice + 0.01 ? 'Over-charging'
        : 'On target';
      return [
        r.name,
        r.servings,
        r.recPrice    != null ? r.recPrice.toFixed(2)    : '',
        r.menuPrice   != null ? r.menuPrice.toFixed(2)   : '',
        gap,
        pricingStatus,
        r.lastComputed ? fmtDate(r.lastComputed) : 'Never',
        r.status === 'priced' ? 'Priced' : 'Needs Pricing',
      ];
    });
    const csvContent = [
      [`Smart Menu Pricing — Menu Report — ${today}`],
      [],
      headers,
      ...rows,
    ].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `menu-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setEditingVal(row.menuPrice != null ? String(row.menuPrice) : '');
  };

  const commitEdit = async (recipeId) => {
    const parsed = parseFloat(editingVal);
    const row    = menuBoard.find(r => r.id === recipeId);
    setEditingId(null);
    setEditingVal('');

    if (isNaN(parsed) || parsed <= 0) return; // empty or invalid — do nothing
    if (!row?.outputId) return; // no computation yet — can't link the price

    // Optimistically update the board so the UI feels instant
    setMenuBoard(prev => prev.map(r => r.id === recipeId ? { ...r, menuPrice: parsed } : r));

    // Persist to the same DB column that Costing.jsx uses
    try {
      await api.patch(`/costing/${row.outputId}/actual-price`, { actual_selling_price: parsed });
    } catch {
      // Revert on failure
      setMenuBoard(prev => prev.map(r => r.id === recipeId ? { ...r, menuPrice: row.menuPrice } : r));
    }
  };

  const cancelEdit = () => { setEditingId(null); setEditingVal(''); };

  const applyRecommendedPrice = async (row) => {
    if (!row.recPrice || !row.outputId) return;
    setMenuBoard(prev => prev.map(r => r.id === row.id ? { ...r, menuPrice: row.recPrice } : r));
    try {
      await api.patch(`/costing/${row.outputId}/actual-price`, { actual_selling_price: row.recPrice });
    } catch {
      setMenuBoard(prev => prev.map(r => r.id === row.id ? { ...r, menuPrice: row.menuPrice } : r));
    }
  };

  const thStyle = {
    padding: '11px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
    textTransform: 'uppercase', color: T.tblHead, background: T.tblHeadBg, textAlign: 'left',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Greeting ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1.15 }}>
            {greeting()}, {ownerName.split(' ')[0]}
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: T.textMuted }}>{fmtDateLong(new Date())}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => load({ silent: true })}
            disabled={refreshing}
            title="Refresh dashboard"
            style={{ height: 40, padding: '0 14px', border: T.cardBorder, background: 'var(--card-bg)', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: refreshing ? 'not-allowed' : 'pointer', color: T.textSecond, flexShrink: 0, fontSize: 13.5, fontWeight: 600, transition: 'all 180ms ease', opacity: refreshing ? 0.6 : 1 }}
            onMouseEnter={e => { if (!refreshing) { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#EDE7DC'; e.currentTarget.style.color = T.textSecond; }}
          >
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none" style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none', flexShrink: 0 }}>
              <path d="M13 7.5A5.5 5.5 0 1 1 7.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M7.5 2L10.5 2L10.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <Link to="/costing"
            style={{ flexShrink: 0, height: 40, padding: '0 18px', background: T.accent, color: '#FFFFFF', borderRadius: 12, fontWeight: 600, fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M4.5 4.5h2M7.5 4.5h2M4.5 7h2M7.5 7h2M4.5 9.5h2M7.5 9.5h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            Compute Cost
          </Link>
        </div>
      </div>

      {/* ── Price alert banner ── */}
      {!loading && priceAlerts.length > 0 && !dismissedAlert && (
        <div style={{ borderRadius: 18, padding: '15px 18px', background: 'linear-gradient(100deg, oklch(0.97 0.028 32) 0%, oklch(0.985 0.012 40) 100%)', border: '1px solid oklch(0.9 0.04 32)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 12, background: '#FFFFFF', boxShadow: '0 3px 10px rgba(160,60,40,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="oklch(0.60 0.16 28)" strokeWidth="1.6"/><path d="M10 6.5v4M10 13.5v.5" stroke="oklch(0.60 0.16 28)" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'oklch(0.35 0.1 28)', marginBottom: 2 }}>
              {priceAlerts.length} ingredient{priceAlerts.length !== 1 ? 's' : ''} have outdated or missing prices — your cost calculations may be off
            </div>
            <div style={{ fontSize: 12.5, color: 'oklch(0.52 0.09 30)' }}>
              {priceAlerts.slice(0, 3).map(a => a.name).join(', ')}{priceAlerts.length > 3 ? ` +${priceAlerts.length - 3} more` : ''}
            </div>
          </div>
          <Link to="/ingredients" style={{ flexShrink: 0, height: 34, padding: '0 14px', background: 'oklch(0.60 0.16 28)', color: '#FFFFFF', borderRadius: 10, fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
            Update prices
          </Link>
          <button onClick={() => { setDismissedAlert(true); try { localStorage.setItem('smp_alert_dismissed', 'true'); } catch {} }} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'rgba(0,0,0,0.06)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'oklch(0.52 0.09 30)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
      )}

      {/* ── Stat cards ── */}
      {loading ? <SkeletonStats count={4} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>

          {/* 1 — How many dishes are ready */}
          <StatCard index={0}
            label="Dishes Priced"
            value={`${pricedRecipes} of ${totalRecipes}`}
            sub={unpricedCount > 0 ? `${unpricedCount} dish${unpricedCount !== 1 ? 'es' : ''} still need pricing` : 'All dishes are priced'}
            accent={unpricedCount > 0 ? '#D97706' : T.accent}
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="2" width="11" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>}
          />

          {/* 2 — Underpriced alarm: dishes where owner charges less than recommended */}
          <StatCard index={1}
            label="Underpriced Dishes"
            value={underpricedCount > 0 ? underpricedCount : 'None'}
            sub={
              underpricedCount > 0
                ? `${underpricedCount} dish${underpricedCount !== 1 ? 'es' : ''} priced below recommended`
                : 'All priced dishes are on target'
            }
            accent={underpricedCount > 0 ? '#DC2626' : T.accent}
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v7M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 13h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>}
          />

          {/* 3 — Avg food cost %: the core restaurant health KPI */}
          <StatCard index={2}
            label="Avg. Food Cost %"
            value={avgFoodCostPct != null ? `${avgFoodCostPct.toFixed(1)}%` : '—'}
            sub={
              avgFoodCostPct != null
                ? `Target: ${prefs.targetFoodCostPct ?? 35}% — ${avgFoodCostPct <= (prefs.targetFoodCostPct ?? 35) ? 'within target' : 'above target, review pricing'}`
                : 'Compute dishes to see this'
            }
            accent={
              avgFoodCostPct == null ? T.textMuted
              : avgFoodCostPct <= (prefs.targetFoodCostPct ?? 35) ? T.accent
              : avgFoodCostPct <= (prefs.targetFoodCostPct ?? 35) + 5 ? '#D97706'
              : '#DC2626'
            }
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 12l3.5-4 3 2.5L12 5l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          />

          {/* 4 — Stale ingredient prices */}
          <StatCard index={3}
            label="Price Alerts"
            value={priceAlerts.length > 0 ? priceAlerts.length : 'None'}
            sub={priceAlerts.length > 0 ? 'ingredients with outdated prices' : 'All ingredient prices are fresh'}
            accent={priceAlerts.length > 0 ? 'oklch(0.60 0.16 28)' : T.accent}
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2l1.5 4.5H14l-3.7 2.7L11.8 14 8 11.3 4.2 14l1.5-4.8L2 6.5h4.5L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>}
          />
        </div>
      )}

      {/* ── Menu Price Board ── */}
      <div style={{ background: 'var(--card-bg)', border: T.cardBorder, borderRadius: 20, overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: '0 0 3px', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
              Menu Price Board
            </h2>
            <p style={{ margin: 0, fontSize: 12.5, color: T.textMuted }}>
              Set and track your actual selling prices — the system suggestion is a guide, not a rule
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {menuBoard.some(r => r.status === 'priced') && (
              <button
                onClick={downloadMenuReport}
                style={{ flexShrink: 0, height: 36, padding: '0 14px', background: T.accent, color: '#FFFFFF', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', transition: 'opacity 150ms' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v7.5M4 6.5l2.5 2.5L9 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M1.5 10.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                Download Report
              </button>
            )}
            <Link to="/costing"
              style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: T.accent, textDecoration: 'none', padding: '6px 12px', borderRadius: 9, border: T.cardBorder, background: 'var(--table-header-bg)', display: 'inline-flex', alignItems: 'center' }}
            >
              Go to Costing →
            </Link>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 20 }}><SkeletonTable rows={5} cols={5} /></div>
        ) : menuBoard.length === 0 ? (
          <Onboarding />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, paddingLeft: 22 }}>Dish</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Your Price</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>System Suggestion</th>
                  <th style={{ ...thStyle, paddingRight: 22, textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {menuBoard.map((row, i) => {
                  const gap = (row.menuPrice != null && row.recPrice != null)
                    ? row.menuPrice - row.recPrice
                    : null;
                  const isUndercharging = gap != null && gap < -0.01;
                  const isOvercharging  = gap != null && gap > 0.01;
                  const isOnTarget      = gap != null && !isUndercharging && !isOvercharging;
                  const priceColor = isUndercharging ? '#D97706' : isOvercharging ? '#2563EB' : T.textPrimary;

                  return (
                    <tr
                      key={row.id}
                      style={{ borderTop: i > 0 ? '1px solid #F3EDE4' : 'none', transition: 'background 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = T.rowHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Dish name */}
                      <td style={{ padding: '14px 12px 14px 22px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 10, background: row.status === 'unpriced' ? '#F5F0E8' : T.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 700, color: row.status === 'unpriced' ? T.textMuted : T.accent, flexShrink: 0 }}>
                            {initials(row.name)}
                          </div>
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</div>
                            <div style={{ fontSize: 11.5, color: T.textMuted }}>{row.servings} serving{row.servings !== 1 ? 's' : ''} per batch</div>
                          </div>
                        </div>
                      </td>

                      {/* Your Price — PRIMARY: what the owner actually charges */}
                      <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                        {editingId === row.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                            <span style={{ fontSize: 13, color: T.textMuted }}>₱</span>
                            <input
                              autoFocus type="number" min="0" step="0.01"
                              value={editingVal} onChange={e => setEditingVal(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') commitEdit(row.id); if (e.key === 'Escape') cancelEdit(); }}
                              onBlur={() => commitEdit(row.id)}
                              style={{ width: 90, padding: '4px 8px', fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'right', border: `1.5px solid ${T.accent}`, borderRadius: 8, background: T.accentLight, color: T.textPrimary, outline: 'none' }}
                            />
                          </div>
                        ) : (
                          <div
                            role={row.outputId ? 'button' : undefined}
                            onClick={() => row.outputId && startEdit(row)}
                            title={row.outputId ? 'Click to edit your selling price' : 'Compute cost first'}
                            style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, cursor: row.outputId ? 'pointer' : 'default', borderRadius: 8, padding: '4px 8px', transition: 'background 120ms' }}
                            onMouseEnter={e => { if (row.outputId) e.currentTarget.style.background = '#F0EAE1'; }}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            {row.menuPrice != null ? (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <span style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: priceColor, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif", letterSpacing: '-0.01em' }}>
                                    {formatCurrency(row.menuPrice)}
                                  </span>
                                  {row.outputId && (
                                    <svg width="10" height="10" viewBox="0 0 11 11" fill="none" style={{ opacity: 0.35, flexShrink: 0 }}>
                                      <path d="M7.5 1.5l2 2-6 6H1.5v-2l6-6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                                    </svg>
                                  )}
                                </div>
                                {gap != null && (
                                  <span style={{ fontSize: 10.5, fontWeight: 600, color: isOnTarget ? T.accent : isUndercharging ? '#D97706' : '#2563EB' }}>
                                    {isOnTarget ? '✓ On target with suggestion' : isUndercharging ? `↓ ${formatCurrency(Math.abs(gap))} below suggestion` : `↑ ${formatCurrency(gap)} above suggestion`}
                                  </span>
                                )}
                              </>
                            ) : row.outputId ? (
                              <span style={{ fontSize: 12.5, color: T.accent, fontWeight: 600, borderBottom: `1px dashed ${T.accent}`, lineHeight: 1.3 }}>
                                + Set price
                              </span>
                            ) : (
                              <span style={{ fontSize: 12, color: '#D5CCBF', fontStyle: 'italic' }}>Compute first</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* System Suggestion — SECONDARY: calculated guidance only */}
                      <td style={{ padding: '14px 22px 14px 12px', textAlign: 'right' }}>
                        {row.recPrice != null ? (
                          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: T.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                              Suggested
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 500, color: T.textSecond, fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(row.recPrice)}
                            </span>
                            {row.outputId && (row.menuPrice == null || Math.abs(row.menuPrice - row.recPrice) > 0.01) && (
                              <button
                                onClick={() => applyRecommendedPrice(row)}
                                title="Apply this suggestion as your selling price"
                                style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, background: 'transparent', border: '1px solid #DDD7D0', borderRadius: 6, padding: '2px 9px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, transition: 'all 150ms' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#F0EAE1'; e.currentTarget.style.borderColor = '#C8C0B6'; e.currentTarget.style.color = T.textSecond; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#DDD7D0'; e.currentTarget.style.color = T.textMuted; }}
                              >
                                Apply →
                              </button>
                            )}
                          </div>
                        ) : (
                          <Link to={`/costing?recipe=${row.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: T.textMuted, textDecoration: 'none', padding: '4px 10px', borderRadius: 8, border: '1px dashed #DDD7D0' }}>
                            Compute first →
                          </Link>
                        )}
                      </td>

                      {/* Status badge */}
                      <td style={{ padding: '14px 22px 14px 12px', textAlign: 'center' }}>
                        {row.status === 'priced' ? (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'oklch(0.955 0.058 145)', color: 'oklch(0.44 0.12 145)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            Priced
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'oklch(0.975 0.04 85)', color: 'oklch(0.50 0.12 85)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            Needs pricing
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Cost Trend Chart ── */}
      {!loading && trendData.length > 0 && (
        <div style={{ background: 'var(--card-bg)', border: T.cardBorder, borderRadius: 20, padding: '20px 22px' }}>
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
              Portion Cost Trend — Last 30 Days
            </h2>
            <p style={{ margin: 0, fontSize: 12.5, color: T.textMuted }}>
              How much it costs to make one serving of each dish over time. Rising lines mean it's time to review your selling price.
            </p>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EAE1" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtChartDate}
                tick={{ fontSize: 11, fill: T.textMuted }}
                axisLine={false}
                tickLine={false}
                dy={8}
              />
              <YAxis
                tickFormatter={v => `₱${v}`}
                tick={{ fontSize: 11, fill: T.textMuted }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<CostTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 12, color: T.textSecond }}
                iconType="circle"
                iconSize={8}
              />
              {trendRecipes.map((name, idx) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ r: 3.5, strokeWidth: 0, fill: LINE_COLORS[idx % LINE_COLORS.length] }}
                  activeDot={{ r: 5.5, strokeWidth: 2, stroke: '#FFF' }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Placeholder when no trend data yet ── */}
      {!loading && trendData.length === 0 && menuBoard.some(r => r.status === 'priced') && (
        <div style={{ background: 'var(--card-bg)', border: `1px dashed #DDD5C8`, borderRadius: 20, padding: '28px 24px', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: T.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M2 15l4-5 4 3.5L14 7l4 3" stroke={T.accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 5 }}>Cost Trend — Coming Soon</div>
          <div style={{ fontSize: 13, color: T.textMuted, maxWidth: 320, margin: '0 auto' }}>
            Compute costs for your dishes a few times over the coming days and a trend chart will appear here showing how your costs are changing.
          </div>
        </div>
      )}

      {/* ── Price Alerts detail ── */}
      {!loading && priceAlerts.length > 0 && (
        <div style={{ background: 'var(--card-bg)', border: T.cardBorder, borderRadius: 20, padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: '0 0 3px', fontSize: 15.5, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
                Ingredient Prices Need Updating
              </h2>
              <p style={{ margin: 0, fontSize: 12.5, color: T.textMuted }}>
                Stale prices mean your dish cost calculations could be wrong
              </p>
            </div>
            <Link to="/ingredients" style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: '#FFFFFF', textDecoration: 'none', padding: '7px 14px', borderRadius: 10, background: 'oklch(0.60 0.16 28)' }}>
              Update prices
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {priceAlerts.map(ing => (
              <div key={ing.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--table-header-bg)', border: '1px solid var(--divider)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: ing.noPrice ? '#E04444' : '#D97706', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ing.name}</div>
                  <div style={{ fontSize: 11.5, color: T.textMuted }}>{ing.alertReason}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
