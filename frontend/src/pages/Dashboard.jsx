import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { loadPrefs } from '../lib/prefs';
import { getUser } from '../lib/auth';
import { SkeletonTable, SkeletonStats } from '../components/Skeleton';
import { formatCurrency } from '../lib/format';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgoISO(n) { return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); }
const fmtDate = (d) => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtDateLong = (d) => new Date(d).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? (parts[0][0] || '?').toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const T = {
  accent: '#4C5D3E',
  accentLight: 'oklch(0.955 0.021 138)',
  textPrimary: '#24201C',
  textSecond: '#6B625A',
  textMuted: '#8C837B',
  rowDivider: '1px solid #F3EDE4',
  rowHover: '#FDFBF8',
  tblHead: '#A79E94',
  tblHeadBg: '#FDFBF8',
  cardBorder: '1px solid #EDE7DC',
  inputBorder: '#E7DFD4',
};

const StatIcons = {
  ingredient: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2C5.8 2 4 3.8 4 6c0 1.4.7 2.6 1.8 3.3L4.5 13h7l-1.3-3.7A4 4 0 0 0 12 6c0-2.2-1.8-4-4-4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
  recipe:     <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="2" width="11" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  compute:    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M5 5h2M9 5h2M5 8h2M9 8h2M5 11h2M9 11h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  price:      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/><path d="M8 4.5v7M6.2 6.2a2 2 0 0 1 3.6 1.3c0 1.8-3.6 1.2-3.6 3a2 2 0 0 0 3.6-.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
};


const CHART_COLORS = [
  '#4C7A5A', '#C87941', '#5A87B0', '#BC6464',
  '#8B7EC8', '#47A8A0', '#B8943A',
];

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const pct = Math.round((d.count / d.total) * 100);
  return (
    <div style={{
      background: 'rgba(24,20,16,0.88)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderRadius: 11,
      padding: '8px 13px',
      boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
      border: '1px solid rgba(255,255,255,0.07)',
      pointerEvents: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: d.color, display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#F5F0E8' }}>{d.name}</span>
      </div>
      <p style={{ margin: 0, fontSize: 11.5, color: 'rgba(245,240,232,0.6)' }}>
        {d.count} item{d.count !== 1 ? 's' : ''} · {pct}%
      </p>
    </div>
  );
}

function IngredientMixChart({ ingredients }) {
  const [activeIdx, setActiveIdx] = useState(null);

  const data = useMemo(() => {
    const map = {};
    ingredients.forEach(ing => {
      const cat = ing.category || 'Other';
      map[cat] = (map[cat] || 0) + 1;
    });
    const total = ingredients.length;
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], i) => ({ name, count, total, color: CHART_COLORS[i % CHART_COLORS.length] }));
  }, [ingredients]);

  const total = ingredients.length;
  if (total === 0) return null;

  const centerValue = activeIdx !== null ? data[activeIdx].count : total;
  const centerLabel = activeIdx !== null ? data[activeIdx].name : 'items';

  return (
    <div style={{ background: 'var(--card-bg)', border: T.cardBorder, borderRadius: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 0', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: 15.5, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
            Ingredient Overview
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: T.textMuted }}>
            {data.length} categor{data.length !== 1 ? 'ies' : 'y'} · {total} total
          </p>
        </div>
        {/* Previously linked to /inventory. Changed to /ingredients because
            inventory is no longer shown in the nav. */}
        <Link to="/ingredients" style={{ fontSize: 12, fontWeight: 600, padding: '4px 11px', borderRadius: 9, background: T.accentLight, color: T.accent, textDecoration: 'none' }}>
          View all →
        </Link>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, padding: '0 22px 22px', flexWrap: 'wrap' }}>
        {/* Donut */}
        <div style={{ position: 'relative', width: 184, height: 184, flexShrink: 0 }}>
          <PieChart width={184} height={184}>
            <Pie
              data={data}
              cx={92} cy={92}
              innerRadius={60} outerRadius={84}
              dataKey="count"
              paddingAngle={data.length > 1 ? 2.5 : 0}
              startAngle={90} endAngle={-270}
              animationBegin={100} animationDuration={900} animationEasing="ease-out"
              stroke="none"
              onMouseEnter={(_, i) => setActiveIdx(i)}
              onMouseLeave={() => setActiveIdx(null)}
            >
              {data.map((entry, i) => (
                <Cell
                  key={entry.name}
                  fill={entry.color}
                  opacity={activeIdx === null || activeIdx === i ? 1 : 0.28}
                  style={{ cursor: 'default', transition: 'opacity 0.18s' }}
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} cursor={false} />
          </PieChart>
          {/* Center overlay */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{
              fontSize: activeIdx !== null ? 26 : 34,
              fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 1,
              color: activeIdx !== null ? data[activeIdx].color : 'var(--text-primary)',
              transition: 'all 0.2s ease',
              fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif",
            }}>
              {centerValue}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 600, color: T.textMuted,
              marginTop: 4, letterSpacing: '0.07em', textTransform: 'uppercase',
              maxWidth: 72, textAlign: 'center', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
            }}>
              {centerLabel}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 13 }}>
          {data.map((item, i) => {
            const pct = Math.round((item.count / total) * 100);
            const isActive = activeIdx === i;
            return (
              <div
                key={item.name}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseLeave={() => setActiveIdx(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  opacity: activeIdx === null || isActive ? 1 : 0.35,
                  transition: 'opacity 0.18s', cursor: 'default',
                }}
              >
                <div style={{
                  width: 9, height: 9, borderRadius: '50%',
                  background: item.color, flexShrink: 0,
                  transform: isActive ? 'scale(1.4)' : 'scale(1)',
                  boxShadow: isActive ? `0 0 0 3px ${item.color}2A` : 'none',
                  transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s',
                }} />
                <span style={{
                  flex: 1, fontSize: 13.5, minWidth: 0,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--text-primary)' : T.textSecond,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  transition: 'font-weight 0.15s, color 0.15s',
                }}>
                  {item.name}
                </span>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: isActive ? item.color : T.textMuted,
                  fontVariantNumeric: 'tabular-nums', width: 20, textAlign: 'right',
                  transition: 'color 0.18s',
                }}>
                  {item.count}
                </span>
                <div style={{ width: 72, height: 3.5, borderRadius: 2, background: '#EDE7DC', overflow: 'hidden', flexShrink: 0 }}>
                  <div style={{
                    height: '100%', background: item.color, borderRadius: 2,
                    width: `${pct}%`,
                    transition: 'width 1s cubic-bezier(0.23,1,0.32,1)',
                  }} />
                </div>
                <span style={{
                  fontSize: 11.5, color: T.textMuted, width: 30,
                  textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                }}>
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TopExpensiveWidget({ items }) {
  if (!items.length) return null;
  const maxPrice = items[0].price;
  const SOURCE_COLOR = { dti: '#8B7EC8', da: '#47A8A0', manual: '#C87941' };
  return (
    <div style={{ background: 'var(--card-bg)', border: T.cardBorder, borderRadius: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px' }}>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: 15.5, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
            Priciest Ingredients
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: T.textMuted }}>Top {items.length} by latest price per unit</p>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 11px', borderRadius: 9, background: T.accentLight, color: T.accent }}>
          Costs
        </span>
      </div>
      <div style={{ padding: '0 22px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((ing, i) => {
          const barPct = Math.max(6, Math.round((ing.price / maxPrice) * 100));
          const srcColor = SOURCE_COLOR[ing.source] ?? T.accent;
          return (
            <div key={ing.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 18, fontSize: 12, fontWeight: 700, color: T.textMuted, flexShrink: 0, textAlign: 'right' }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, marginRight: 8 }}>{ing.name}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {formatCurrency(ing.price)}<span style={{ fontSize: 11, fontWeight: 500, color: T.textMuted }}>/{ing.unit}</span>
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: '#EDE7DC', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${barPct}%`, borderRadius: 3, background: srcColor, transition: 'width 0.8s cubic-bezier(0.22,1,0.36,1)' }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, icon, value, sub }) {
  return (
    <div className="card-hover" style={{ background: 'var(--card-bg)', border: T.cardBorder, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12, cursor: 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: T.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.accent }}>
          {icon}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 5 }}>{sub}</div>}
      </div>
    </div>
  );
}

function OnboardingGuide() {
  const steps = [
    { num: 1, to: '/ingredients', label: 'Add ingredients', desc: 'Start by entering the items you use in your dishes.' },
    { num: 2, to: '/recipes',     label: 'Create a recipe', desc: 'Link ingredients and set batch size for each menu item.' },
    { num: 3, to: '/extraction',  label: 'Import prices',   desc: 'Pull market prices from DTI or DA price bulletins.' },
    { num: 4, to: '/costing',     label: 'Compute cost',    desc: 'Calculate portion cost and recommended selling price.' },
  ];
  return (
    <div style={{ background: 'var(--card-bg)', border: T.cardBorder, borderRadius: 20, padding: '22px 24px' }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>Get started in 4 steps</h2>
        <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>Follow this workflow to price your first dish.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        {steps.map((s) => (
          <Link key={s.num} to={s.to} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 8, padding: '16px', borderRadius: 14, border: T.cardBorder, background: 'var(--table-header-bg)', transition: 'all 180ms ease' }}
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

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const prefs = loadPrefs();
  const user = getUser();
  const ownerName = prefs.ownerName || user?.full_name || user?.username || 'there';
  const alertThreshold = prefs.alertThresholdDays ?? 7;

  const [stats, setStats] = useState({ ingredients: 0, recipes: 0, computations: 0, pricesToday: 0 });
  const [allIngredients, setAllIngredients] = useState([]);
  const [recentCostings, setRecentCostings] = useState([]);
  const [priceAlerts, setPriceAlerts] = useState([]);
  const [topExpensive, setTopExpensive] = useState([]);
  const [dismissedAlert, setDismissedAlert] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [ingRes, recRes] = await Promise.all([api.get('/ingredients'), api.get('/recipes')]);
        const ingredients = ingRes.data.data || [];
        const recipes     = recRes.data.data || [];

        // Fetch costing history for every recipe (to build the Recent Computations table)
        // and the latest price for every ingredient (to detect stale prices for the alert banner).
        // Both run in parallel so the page loads faster.
        // The /inventory/low-stock call was removed — inventory is outside the capstone scope.
        const [historyResults, latestPriceResults] = await Promise.all([
          Promise.all(recipes.map(r => api.get(`/costing/history/${r.id}`).then(res => ({ recipeName: r.name, rows: res.data.data || [] })).catch(() => ({ recipeName: r.name, rows: [] })))),
          Promise.all(ingredients.map(ing => api.get(`/prices/latest/${ing.id}`).then(res => ({ ingredient: ing, price: res.data.data })).catch(() => ({ ingredient: ing, price: null })))),
        ]);

        const allCostings = historyResults.flatMap(({ recipeName, rows }) => rows.map(row => ({ ...row, recipe_name: recipeName })));
        allCostings.sort((a, b) => new Date(b.computed_at) - new Date(a.computed_at));
        // Keep only the most recent computation per recipe
        const seenRecipes = new Set();
        const deduped = allCostings.filter(row => {
          if (seenRecipes.has(row.recipe_id)) return false;
          seenRecipes.add(row.recipe_id);
          return true;
        });
        setRecentCostings(deduped.slice(0, 5));

        const today = todayISO();
        const cutoff = daysAgoISO(alertThreshold);
        let pricesToday = 0;
        const alerts = [];

        latestPriceResults.forEach(({ ingredient, price }) => {
          if (!price) { alerts.push({ ...ingredient, alertReason: 'No price recorded yet', noPrice: true }); }
          else {
            if (price.extraction_date === today) pricesToday++;
            if (price.extraction_date < cutoff) alerts.push({ ...ingredient, alertReason: `Last updated ${fmtDate(price.extraction_date)}`, noPrice: false });
          }
        });

        setPriceAlerts(alerts);
        setAllIngredients(ingredients);
        setStats({ ingredients: ingredients.length, recipes: recipes.length, computations: allCostings.length, pricesToday });

        const withPrices = latestPriceResults
          .filter(({ price }) => price !== null)
          .map(({ ingredient, price }) => ({
            id: ingredient.id,
            name: ingredient.name,
            unit: ingredient.unit,
            price: parseFloat(price.price),
            source: price.source,
          }))
          .sort((a, b) => b.price - a.price)
          .slice(0, 5);
        setTopExpensive(withPrices);
      } catch { /* fail silently */ } finally { setLoading(false); }
    };
    load();
  }, [alertThreshold]);

  const thStyle = { padding: '11px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.tblHead, textAlign: 'left', background: T.tblHeadBg, whiteSpace: 'nowrap' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Greeting header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1.15 }}>
            {greeting()}, {ownerName.split(' ')[0]}
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: T.textMuted }}>{fmtDateLong(new Date())}</p>
        </div>
        <Link to="/costing"
          style={{ flexShrink: 0, height: 40, padding: '0 18px', background: T.accent, color: '#FFFFFF', borderRadius: 12, fontWeight: 600, fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none', transition: 'opacity 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M4.5 4.5h2M7.5 4.5h2M4.5 7h2M7.5 7h2M4.5 9.5h2M7.5 9.5h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          Compute Cost
        </Link>
      </div>

      {/* Price alert banner — shown when any ingredient has no price or a stale price.
          "Stale" means the last update was more than alertThresholdDays days ago
          (set in Settings, default 7 days). Dismissing it hides it for this session only. */}
      {/* Alert banner */}
      {!loading && priceAlerts.length > 0 && !dismissedAlert && (
        <div style={{ borderRadius: 18, padding: '15px 18px', background: 'linear-gradient(100deg, oklch(0.97 0.028 32) 0%, oklch(0.985 0.012 40) 100%)', border: '1px solid oklch(0.9 0.04 32)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 12, background: '#FFFFFF', boxShadow: '0 3px 10px rgba(160,60,40,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="oklch(0.60 0.16 28)" strokeWidth="1.6"/><path d="M10 6.5v4M10 13.5v.5" stroke="oklch(0.60 0.16 28)" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'oklch(0.35 0.1 28)', marginBottom: 2 }}>{priceAlerts.length} ingredient{priceAlerts.length !== 1 ? 's' : ''} need price attention</div>
            <div style={{ fontSize: 12.5, color: 'oklch(0.52 0.09 30)' }}>{priceAlerts.slice(0, 3).map(a => a.name).join(', ')}{priceAlerts.length > 3 ? ` +${priceAlerts.length - 3} more` : ''}</div>
          </div>
          <Link to="/ingredients" style={{ flexShrink: 0, height: 34, padding: '0 14px', background: 'oklch(0.60 0.16 28)', color: '#FFFFFF', borderRadius: 10, fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Update prices</Link>
          <button onClick={() => setDismissedAlert(true)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'rgba(0,0,0,0.06)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'oklch(0.52 0.09 30)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
      )}

      {/* Stat cards */}
      {loading ? <SkeletonStats count={4} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          <StatCard label="Ingredients"        icon={StatIcons.ingredient} value={stats.ingredients}  sub="in master list" />
          <StatCard label="Recipes"            icon={StatIcons.recipe}     value={stats.recipes}      sub="menu items" />
          <StatCard label="Computations"       icon={StatIcons.compute}    value={stats.computations} sub="cost snapshots" />
          <StatCard label="Prices Today"       icon={StatIcons.price}      value={stats.pricesToday}  sub="updated today" />
        </div>
      )}

      {/* Ingredient Overview Chart */}
      {!loading && <IngredientMixChart ingredients={allIngredients} />}

      {/* Most Expensive Ingredients */}
      {!loading && topExpensive.length > 0 && <TopExpensiveWidget items={topExpensive} />}

      {/* Onboarding guide — visible when no computations exist */}
      {!loading && stats.computations === 0 && <OnboardingGuide />}

      {/* Two-column: Recent Computations + Price Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 16, alignItems: 'start' }}>

        {/* Recent Computations */}
        <div style={{ background: 'var(--card-bg)', border: T.cardBorder, borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>Recent Computations</h2>
              <span style={{ fontSize: 12, color: T.textMuted }}>Latest cost snapshots</span>
            </div>
            <Link to="/costing" style={{ fontSize: 12.5, fontWeight: 600, color: T.accent, textDecoration: 'none', padding: '6px 12px', borderRadius: 9, border: T.cardBorder, background: 'var(--table-header-bg)' }}>View all</Link>
          </div>
          {loading ? <SkeletonTable rows={5} cols={4} /> : recentCostings.length === 0 ? (
            <div style={{ padding: '36px 22px', textAlign: 'center' }}>
              <div style={{ width: 42, height: 42, borderRadius: 14, background: T.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: T.accent }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2.5" y="2.5" width="15" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M7 7h2M11 7h2M7 10.5h2M11 10.5h2M7 14h2M11 14h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No computations yet</div>
              <div style={{ fontSize: 12.5, color: T.textMuted, marginBottom: 14 }}>Price your first dish to see results here.</div>
              <Link to="/costing" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: T.accent, textDecoration: 'none', padding: '8px 16px', borderRadius: 10, border: T.cardBorder, background: T.accentLight }}>
                Compute a dish
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, paddingLeft: 22 }}>Recipe</th>
                    <th style={thStyle}>Portion</th>
                    <th style={thStyle}>Rec. Price</th>
                    <th style={{ ...thStyle, paddingRight: 22, textAlign: 'right' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCostings.map((row, i) => (
                    <tr key={row.id}
                      style={{ borderTop: i > 0 ? T.rowDivider : 'none', transition: 'background 0.12s ease' }}
                      onMouseEnter={e => e.currentTarget.style.background = T.rowHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '13px 12px 13px 22px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'oklch(0.96 0.018 70)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'oklch(0.52 0.08 70)', flexShrink: 0 }}>{initials(row.recipe_name)}</div>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{row.recipe_name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '13px 12px', fontSize: 13.5, color: T.textSecond, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(row.portion_cost)}</td>
                      <td style={{ padding: '13px 12px' }}>
                        <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 7, background: 'oklch(0.96 0.03 150)', color: 'oklch(0.44 0.09 150)', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(row.recommended_price)}</span>
                      </td>
                      <td style={{ padding: '13px 22px 13px 12px', fontSize: 11.5, color: T.textMuted, whiteSpace: 'nowrap', textAlign: 'right' }}>{fmtDate(row.computed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Price Alerts */}
        <div style={{ background: 'var(--card-bg)', border: T.cardBorder, borderRadius: 20, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: '0 0 2px', fontSize: 15.5, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>Price Alerts</h2>
              <span style={{ fontSize: 12, color: T.textMuted }}>Items needing price updates</span>
            </div>
            {!loading && priceAlerts.length > 0 && (
              <div style={{ minWidth: 28, height: 28, borderRadius: '50%', background: 'oklch(0.96 0.035 30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, color: 'oklch(0.55 0.16 28)', padding: '0 8px' }}>{priceAlerts.length}</div>
            )}
          </div>
          {loading ? <SkeletonTable rows={4} cols={2} /> : priceAlerts.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0' }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: T.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke={T.accent} strokeWidth="1.4"/><path d="M5.5 9l2.5 2.5L12.5 6" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span style={{ fontSize: 13.5, color: T.textSecond, lineHeight: 1.4 }}>All prices updated within the last {alertThreshold} day{alertThreshold !== 1 ? 's' : ''}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {priceAlerts.map(ing => (
                <div key={ing.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 13, background: 'var(--table-header-bg)', border: '1px solid var(--divider)', transition: 'all 160ms ease' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = T.inputBorder; e.currentTarget.style.transform = 'translateX(2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--table-header-bg)'; e.currentTarget.style.borderColor = 'var(--divider)'; e.currentTarget.style.transform = ''; }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: ing.noPrice ? '#E04444' : '#D97706', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ing.name}</div>
                    <div style={{ fontSize: 11.5, color: T.textMuted }}>{ing.alertReason}</div>
                  </div>
                  <Link to="/ingredients" style={{ fontSize: 12, fontWeight: 600, color: T.accent, textDecoration: 'none', flexShrink: 0 }}>Update →</Link>
                </div>
              ))}
              <p style={{ fontSize: 11.5, color: T.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 0 }}>Flagged after {alertThreshold} day{alertThreshold !== 1 ? 's' : ''} without update</p>
            </div>
          )}
        </div>
      </div>


    </div>
  );
}
