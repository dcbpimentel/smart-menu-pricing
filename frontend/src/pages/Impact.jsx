import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import Select from '../components/Select';
import { SkeletonStats } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { formatCurrency, formatPct } from '../lib/format';

/* ─── Design tokens ────────────────────────────────────────────────────────── */
const T = {
  canvasBg:    '#FBF8F3',
  cardBg:      '#FFFFFF',
  cardBorder:  '1px solid #EFE8DE',
  cardRadius:  '20px',
  accent:      'var(--accent, #4C5D3E)',
  accentLight: 'oklch(0.955 0.021 138)',
  textPrimary: '#24201C',
  textSecond:  '#6B625A',
  textMuted:   '#8C837B',
  rowDivider:  '1px solid #F3EDE4',
  rowHover:    '#FDFBF8',
  tblHead:     '#A79E94',
  tblHeadBg:   '#FDFBF8',
  danger:      'oklch(0.60 0.14 28)',
  dangerBg:    '#FFFFFF',
  dangerBorder:'1px solid #F0DFDB',
  inputBorder: '#E7DFD4',
  inputBg:     '#FDFBF8',
  focusShadow: '0 0 0 4px oklch(0.945 0.028 138)',
  amberBorder: 'oklch(0.88 0.05 30)',
  amberBg:     'oklch(0.985 0.012 32)',
  amberFocus:  '0 0 0 4px oklch(0.96 0.03 30)',
  amberFocusBorder: 'oklch(0.62 0.16 28)',
};

const styles = {
  card: {
    background: T.cardBg,
    border: T.cardBorder,
    borderRadius: T.cardRadius,
    overflow: 'hidden',
  },
  primaryBtn: {
    height: 46,
    padding: '0 24px',
    borderRadius: 13,
    background: T.accent,
    color: '#FFFFFF',
    fontWeight: 700,
    border: 'none',
    fontSize: 14,
    cursor: 'pointer',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
    boxShadow: '0 8px 20px rgba(70,86,56,0.26)',
    transition: 'transform 0.15s, box-shadow 0.15s',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  },
  secondaryBtn: {
    borderRadius: 12,
    border: '1px solid #E7DFD4',
    background: '#FFFFFF',
    color: '#4A423B',
    fontWeight: 600,
    fontSize: 13.5,
    cursor: 'pointer',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  thCell: {
    background: T.tblHeadBg,
    color: T.tblHead,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    padding: '11px 12px',
  },
  thFirst: {
    paddingLeft: 22,
    paddingRight: 12,
  },
  thLast: {
    paddingLeft: 12,
    paddingRight: 22,
  },
  tdFirst: {
    padding: '13px 12px 13px 22px',
  },
  tdLast: {
    padding: '13px 22px 13px 12px',
  },
  td: {
    padding: '13px 12px',
  },
};

function riseInStyle(delay = 0) {
  return {
    animation: `riseIn 420ms cubic-bezier(0.22,1,0.36,1) ${delay}ms both`,
  };
}

/* ─── Subcomponents ──────────────────────────────────────────────────────── */

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ArrowRight({ color = '#C5BCAF' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10M9 4l4 4-4 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function DiffPill({ amount, pct }) {
  if (amount == null) return <span style={{ color: T.textMuted, fontSize: 12 }}>—</span>;
  const up   = amount > 0;
  const zero = amount === 0;
  const color = zero ? T.textMuted : up ? 'oklch(0.58 0.16 28)' : T.accent;
  const bg    = zero ? '#F3EDE4' : up ? 'oklch(0.97 0.025 30)' : T.accentLight;
  const sign  = up ? '+' : '';
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      <span style={{
        fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
        color, background: bg, fontVariantNumeric: 'tabular-nums',
      }}>
        {sign}{formatCurrency(amount)}
      </span>
      {pct != null && !zero && (
        <span style={{ fontSize: 11, color, fontVariantNumeric: 'tabular-nums' }}>
          {sign}{formatPct(pct)}
        </span>
      )}
    </span>
  );
}

function OldPriceInput({ value, onChange }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="number"
      min="0"
      step="any"
      placeholder="e.g. 250"
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: 130,
        height: 40,
        borderRadius: 11,
        border: `1px solid ${focused ? T.accent : T.inputBorder}`,
        background: focused ? '#FFFFFF' : T.inputBg,
        boxShadow: focused ? T.focusShadow : 'none',
        fontSize: 14,
        fontVariantNumeric: 'tabular-nums',
        padding: '0 10px',
        outline: 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        fontFamily: 'inherit',
      }}
    />
  );
}

function NewPriceInput({ value, onChange }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="number"
      min="0"
      step="any"
      placeholder="e.g. 300"
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: 130,
        height: 40,
        borderRadius: 11,
        border: `1px solid ${focused ? T.amberFocusBorder : T.amberBorder}`,
        background: focused ? '#FFFFFF' : T.amberBg,
        boxShadow: focused ? T.amberFocus : 'none',
        fontSize: 14,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        padding: '0 10px',
        outline: 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        fontFamily: 'inherit',
      }}
    />
  );
}

function StyledSelect({ value, onChange, options, placeholder, minWidth = 280 }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative', minWidth, display: 'inline-block' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          height: 46,
          padding: '0 36px 0 12px',
          borderRadius: 13,
          border: `1px solid ${focused ? T.accent : T.inputBorder}`,
          background: focused ? '#FFFFFF' : T.inputBg,
          boxShadow: focused ? T.focusShadow : 'none',
          fontSize: 14.5,
          fontWeight: 600,
          color: T.textPrimary,
          appearance: 'none',
          cursor: 'pointer',
          outline: 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          fontFamily: 'inherit',
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span style={{
        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
        pointerEvents: 'none', color: T.textMuted,
      }}>
        <ChevronDown />
      </span>
    </div>
  );
}

function SmallSelect({ value, onChange, options, placeholder, minWidth = 220 }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative', minWidth, display: 'inline-block' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          height: 44,
          padding: '0 36px 0 12px',
          borderRadius: 12,
          border: `1px solid ${focused ? T.accent : T.inputBorder}`,
          background: focused ? '#FFFFFF' : T.inputBg,
          boxShadow: focused ? T.focusShadow : 'none',
          fontSize: 14,
          fontWeight: 600,
          color: T.textPrimary,
          appearance: 'none',
          cursor: 'pointer',
          outline: 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          fontFamily: 'inherit',
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span style={{
        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
        pointerEvents: 'none', color: T.textMuted,
      }}>
        <ChevronDown />
      </span>
    </div>
  );
}

/* ─── Price bars ────────────────────────────────────────────────────────── */
function PriceBars({ oldPrice, newPrice }) {
  const max = Math.max(oldPrice || 0, newPrice || 0, 1);
  const oldW = `${Math.round((oldPrice / max) * 100)}%`;
  const newW = `${Math.round((newPrice / max) * 100)}%`;
  return (
    <div style={{ ...styles.card, padding: '22px 24px' }}>
      <h2 style={{
        fontSize: 16.5,
        fontWeight: 600,
        color: T.textPrimary,
        marginBottom: 20,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
      }}>
        Recommended price, before and after
      </h2>

      {/* Old price row */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: T.textMuted }}>Current Price</span>
          <span style={{
            fontSize: 16,
            fontWeight: 600,
            color: T.textSecond,
            fontVariantNumeric: 'tabular-nums',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
          }}>{formatCurrency(oldPrice)}</span>
        </div>
        <div style={{ height: 26, borderRadius: 9, background: '#F3EDE4', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: oldW,
            background: '#DCD2C4',
            borderRadius: 9,
            transformOrigin: 'left',
            animation: 'growBar 620ms cubic-bezier(0.22,1,0.36,1) both',
          }} />
        </div>
      </div>

      {/* New price row */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: T.textPrimary }}>Simulated Price</span>
          <span style={{
            fontSize: 16,
            fontWeight: 600,
            color: T.accent,
            fontVariantNumeric: 'tabular-nums',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
          }}>{formatCurrency(newPrice)}</span>
        </div>
        <div style={{ height: 26, borderRadius: 9, background: '#F3EDE4', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: newW,
            background: T.accent,
            borderRadius: 9,
            transformOrigin: 'left',
            animation: 'growBar 620ms cubic-bezier(0.22,1,0.36,1) 80ms both',
          }} />
        </div>
      </div>
    </div>
  );
}

/* ─── 2×2 diff stat cards ──────────────────────────────────────────────── */
function DiffStatCards({ result }) {
  const cards = [
    {
      label: 'Recipe Cost',
      sub: 'Full batch',
      old: result.old?.recipe_cost,
      new: result.new?.recipe_cost,
      diff: result.diff?.recipe_cost_change,
      pct:  result.diff?.recipe_cost_pct,
    },
    {
      label: 'Portion Cost',
      sub: 'Per serving',
      old: result.old?.portion_cost,
      new: result.new?.portion_cost,
      diff: result.diff?.portion_cost_change,
      pct:  result.diff?.portion_cost_pct,
    },
    {
      label: 'Suggested Price',
      sub: 'Recommended',
      old: result.old?.recommended_price,
      new: result.new?.recommended_price,
      diff: result.diff?.recommended_price_change,
      pct:  result.diff?.recommended_price_pct,
    },
    {
      label: 'Margin Impact',
      sub: 'Price vs cost',
      old: null,
      new: null,
      diff: result.diff?.recommended_price_change != null && result.diff?.portion_cost_change != null
        ? parseFloat((result.diff.recommended_price_change - result.diff.portion_cost_change).toFixed(2))
        : null,
      pct: null,
    },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10,
    }}>
      {cards.map((c, i) => {
        const up   = c.diff != null && c.diff > 0;
        const zero = c.diff == null || c.diff === 0;
        const valueColor = zero ? T.accent : up ? 'oklch(0.58 0.16 28)' : T.accent;
        return (
          <div key={i} style={{
            background: '#FFFFFF',
            border: '1px solid #EFE8DE',
            borderRadius: 18,
            padding: '16px 20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#7A716A' }}>{c.label}</div>
                <div style={{ fontSize: 12, color: '#A0968C', marginTop: 1 }}>{c.sub}</div>
              </div>
            </div>
            <div style={{
              fontSize: 26,
              fontWeight: 600,
              color: valueColor,
              fontVariantNumeric: 'tabular-nums',
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
              lineHeight: 1.1,
            }}>
              {c.diff != null
                ? `${c.diff >= 0 ? '+' : ''}${formatCurrency(c.diff)}`
                : c.new != null ? formatCurrency(c.new) : '—'
              }
            </div>
            {c.pct != null && c.diff !== 0 && (
              <div style={{ fontSize: 12, color: valueColor, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                {c.diff >= 0 ? '+' : ''}{formatPct(c.pct)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Ingredient impact table ─────────────────────────────────────────── */
function IngredientImpactTable({ impacts }) {
  return (
    <div style={{ ...styles.card }}>
      <div style={{
        padding: '18px 22px 16px',
        borderBottom: T.rowDivider,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h2 style={{
          fontSize: 16,
          fontWeight: 600,
          color: T.textPrimary,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
        }}>
          Ingredient Impact
        </h2>
        <span style={{ fontSize: 12.5, color: T.textMuted }}>
          {impacts.length} ingredient{impacts.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr>
              {[
                { label: 'Ingredient', align: 'left',  first: true },
                { label: 'Qty',        align: 'right' },
                { label: 'Current Cost', align: 'right' },
                { label: '',             align: 'center', width: 32 },
                { label: 'Simulated Cost', align: 'right' },
                { label: 'Change',     align: 'right' },
                { label: '% Change',   align: 'right', last: true },
              ].map((h, i) => (
                <th key={i} style={{
                  ...styles.thCell,
                  ...(h.first ? styles.thFirst : {}),
                  ...(h.last  ? styles.thLast  : {}),
                  textAlign: h.align,
                  width: h.width,
                }}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {impacts.map((row, i) => {
              const costChange = row.ingredient_cost_old != null && row.ingredient_cost_new != null
                ? parseFloat((row.ingredient_cost_new - row.ingredient_cost_old).toFixed(2))
                : null;
              const costPct = costChange != null && row.ingredient_cost_old
                ? (costChange / row.ingredient_cost_old) * 100
                : null;
              const changed = costChange !== null && costChange !== 0;
              const up      = changed && costChange > 0;
              const isLast  = i === impacts.length - 1;

              const changeColor = !changed ? T.textMuted : up ? 'oklch(0.58 0.16 28)' : T.accent;
              const changeBg    = !changed ? '#F3EDE4' : up ? 'oklch(0.97 0.025 30)' : T.accentLight;

              return (
                <tr
                  key={row.ingredient_id ?? i}
                  style={{
                    borderTop: i === 0 ? 'none' : T.rowDivider,
                    opacity: !changed ? 0.7 : 1,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = T.rowHover}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...styles.tdFirst, color: T.textPrimary, fontWeight: 600 }}>
                    {row.name}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right', color: T.textMuted, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                    {row.quantity} {row.unit}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right', color: T.textSecond, fontVariantNumeric: 'tabular-nums', fontSize: 13.5 }}>
                    {formatCurrency(row.ingredient_cost_old)}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <ArrowRight color={changed ? (up ? 'oklch(0.58 0.16 28)' : T.accent) : '#D5CCBF'} />
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right', color: T.textPrimary, fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: 13.5 }}>
                    {formatCurrency(row.ingredient_cost_new)}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    {changed ? (
                      <span style={{ color: changeColor, fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {up ? '+' : ''}{formatCurrency(costChange)}
                      </span>
                    ) : (
                      <span style={{ color: T.textMuted, fontSize: 13 }}>—</span>
                    )}
                  </td>
                  <td style={{ ...styles.tdLast, textAlign: 'right' }}>
                    {changed && costPct != null ? (
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: 20,
                        background: changeBg,
                        color: changeColor,
                        fontSize: 12,
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {up ? '+' : ''}{costPct.toFixed(1)}%
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: 20,
                        background: '#F3EDE4',
                        color: T.textMuted,
                        fontSize: 12,
                        fontWeight: 700,
                      }}>
                        0%
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
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
export default function Impact() {
  const toast = useToast();

  const [recipes, setRecipes]   = useState([]);
  const [settings, setSettings] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [recipeId, setRecipeId]   = useState('');
  const [settingId, setSettingId] = useState('');

  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [loadingIngredients, setLoadingIngredients] = useState(false);

  const [prices, setPrices] = useState({});

  const [analyzing, setAnalyzing]     = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [result, setResult]           = useState(null);

  /* ── Bootstrap ── */
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

  /* ── Load ingredients + pre-fill latest prices ── */
  const fetchRecipeIngredients = useCallback(async (rId) => {
    if (!rId) return;
    setLoadingIngredients(true);
    setResult(null);
    setAnalyzeError('');
    try {
      const res = await api.get(`/recipes/${rId}`);
      const ings = res.data.data?.ingredients || [];
      setRecipeIngredients(ings);

      const latestPrices = await Promise.all(
        ings.map(async (ri) => {
          try {
            const pr = await api.get(`/prices/latest/${ri.ingredient_id}`);
            return { ingredient_id: ri.ingredient_id, price: pr.data.data?.price ?? null };
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

  const setPrice = (ingredientId, field, value) => {
    setPrices(prev => ({
      ...prev,
      [ingredientId]: { ...prev[ingredientId], [field]: value },
    }));
  };

  /* ── Submit ── */
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
      const o  = parseFloat(vals.old);
      const n  = parseFloat(vals.new);
      if (!isNaN(o)) { oldPrices[id] = o; hasAny = true; }
      if (!isNaN(n)) { newPrices[id] = n; hasAny = true; }
    }
    if (!hasAny) {
      const msg = 'Enter at least one price to analyze.';
      setAnalyzeError(msg);
      toast.error(msg);
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
      toast.success('Impact analysis complete');
    } catch (err) {
      const msg = err.response?.data?.message || 'Analysis failed.';
      setAnalyzeError(msg);
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  /* ── Render ── */
  if (loadingMeta) return (
    <div style={{ ...styles.card, padding: 24 }}>
      <SkeletonStats count={4} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ── keyframes injected once ── */}
      <style>{`
        @keyframes riseIn {
          from { opacity:0; transform:translateY(14px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes growBar {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        .impact-run-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(70,86,56,0.32) !important; }
        .impact-run-btn:active { transform: translateY(0); }
      `}</style>

      {/* ── Input card ── */}
      <div style={styles.card}>
        {/* Header row */}
        <div style={{
          padding: '20px 22px',
          borderBottom: T.rowDivider,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}>
          {/* Recipe selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 280 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>Recipe</label>
            <StyledSelect
              value={recipeId}
              onChange={setRecipeId}
              options={recipes.map(r => ({ value: String(r.id), label: r.name }))}
              placeholder="Select recipe…"
              minWidth={280}
            />
          </div>

          {/* Pricing profile + Run button */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>Pricing Profile</label>
              <SmallSelect
                value={settingId}
                onChange={setSettingId}
                options={settings.map(s => ({ value: String(s.id), label: `${s.label} (${s.target_food_cost_pct}%)` }))}
                placeholder="Select profile…"
                minWidth={220}
              />
            </div>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing || loadingIngredients || recipeIngredients.length === 0}
              className="impact-run-btn"
              style={{
                ...styles.primaryBtn,
                opacity: (analyzing || loadingIngredients || recipeIngredients.length === 0) ? 0.55 : 1,
              }}
            >
              {analyzing ? (
                <>
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.35)',
                    borderTopColor: '#fff',
                    display: 'inline-block',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                  Analyzing…
                </>
              ) : 'Run Analysis'}
            </button>
          </div>
        </div>

        {/* Price inputs */}
        {loadingIngredients ? (
          <div style={{ padding: '20px 22px' }}>
            <SkeletonStats count={4} />
          </div>
        ) : recipeIngredients.length === 0 ? (
          <div style={{ padding: '32px 22px', textAlign: 'center', color: T.textMuted, fontSize: 14 }}>
            No ingredients found for this recipe.
          </div>
        ) : (
          <div>
            <div style={{
              padding: '12px 22px 10px',
              borderBottom: T.rowDivider,
              fontSize: 12.5,
              color: T.textMuted,
            }}>
              Inputs are pre-filled with the latest recorded price. Edit the{' '}
              <span style={{ fontWeight: 600, color: T.textSecond }}>Simulated Price</span>{' '}
              column to test how a price change affects your dish cost.
            </div>
            {analyzeError && (
              <div style={{ padding: '10px 22px', fontSize: 13, color: 'oklch(0.58 0.16 28)', borderBottom: T.rowDivider }}>
                {analyzeError}
              </div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                <thead>
                  <tr>
                    {[
                      { label: 'Ingredient', align: 'left',  first: true },
                      { label: 'Unit',       align: 'left' },
                      { label: 'Current Price (₱)', align: 'left' },
                      { label: 'Simulated Price (₱)', align: 'left', last: true },
                    ].map((h, i) => (
                      <th key={i} style={{
                        ...styles.thCell,
                        ...(h.first ? styles.thFirst : {}),
                        ...(h.last  ? styles.thLast  : {}),
                        textAlign: h.align,
                      }}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recipeIngredients.map((ri, i) => (
                    <tr
                      key={ri.ingredient_id}
                      style={{ borderTop: i === 0 ? 'none' : T.rowDivider }}
                      onMouseEnter={e => e.currentTarget.style.background = T.rowHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ ...styles.tdFirst, color: T.textPrimary, fontWeight: 600 }}>
                        {ri.name}
                      </td>
                      <td style={{ ...styles.td }}>
                        <span style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: T.textMuted,
                          background: '#F3EDE4',
                          padding: '3px 8px',
                          borderRadius: 8,
                          fontFamily: 'monospace',
                        }}>
                          {ri.unit}
                        </span>
                      </td>
                      <td style={{ ...styles.td }}>
                        <OldPriceInput
                          value={prices[ri.ingredient_id]?.old ?? ''}
                          onChange={v => setPrice(ri.ingredient_id, 'old', v)}
                        />
                      </td>
                      <td style={{ ...styles.tdLast }}>
                        <NewPriceInput
                          value={prices[ri.ingredient_id]?.new ?? ''}
                          onChange={v => setPrice(ri.ingredient_id, 'new', v)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Results ── */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, ...riseInStyle(0) }}>
          {/* Row 1: bars + 2x2 cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.05fr', gap: 18, alignItems: 'start' }}>
            <PriceBars
              oldPrice={result.old?.recommended_price}
              newPrice={result.new?.recommended_price}
            />
            <DiffStatCards result={result} />
          </div>

          {/* Row 2: ingredient impact table */}
          {result.ingredient_impacts?.length > 0 && (
            <IngredientImpactTable impacts={result.ingredient_impacts} />
          )}
        </div>
      )}
    </div>
  );
}
