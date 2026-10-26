import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { loadPrefs } from '../lib/prefs';
import Select from '../components/Select';
import { RecipeThumb } from '../components/RecipePhoto';
import { useToast } from '../components/Toast';

const T = {
  accent:      '#4C5D3E',
  accentLight: 'oklch(0.955 0.021 138)',
  textPrimary: '#24201C',
  textSecond:  '#6B625A',
  textMuted:   '#8C837B',
  inputBorder: '#E7DFD4',
  inputBg:     '#FDFBF8',
  cardBorder:  '1px solid #EFE8DE',
  rowDivider:  '1px solid #F3EDE4',
  rowHover:    '#FDFBF8',
  tblHead:     '#A79E94',
  tblHeadBg:   '#FDFBF8',
  warn:        '#92400E',
  warnBg:      '#FEF3C7',
  warnBorder:  '#FDE68A',
  ok:          '#166534',
  okBg:        '#DCFCE7',
  danger:      '#991B1B',
  dangerBg:    '#FEE2E2',
};

const SOURCE_OPTIONS = [
  { value: 'latest', label: 'Latest (any source)',  description: 'Use most recent price regardless of origin' },
  { value: 'dti',    label: 'DTI prices only',      description: 'Only use prices from DTI bulletins' },
  { value: 'da',     label: 'DA prices only',       description: 'Only use prices from DA bulletins' },
  { value: 'manual', label: 'Manual entries only',  description: 'Only use prices you entered by hand' },
];

const fmt = (n, d = 2) => n == null ? '—' : `₱${Number(n).toFixed(d)}`;
const fmtPct = (n, d = 1) => n == null ? '—' : `${Number(n).toFixed(d)}%`;

function StatusBadge({ needsUpdate, noData, noActualPrice }) {
  if (noData) return (
    <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: '#F3EDE4', color: T.textMuted }}>
      Not computed
    </span>
  );
  if (noActualPrice) return (
    <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: '#F3EDE4', color: T.textMuted }}>
      No actual price
    </span>
  );
  if (needsUpdate) return (
    <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: T.warnBg, color: T.warn }}>
      Update price
    </span>
  );
  return (
    <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: T.okBg, color: T.ok }}>
      Price OK
    </span>
  );
}

function MissingBadge({ count }) {
  if (!count) return null;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: T.dangerBg, color: T.danger, marginLeft: 6 }}>
      {count} missing
    </span>
  );
}

export default function Reports() {
  const toast = useToast();
  const prefs = loadPrefs();
  const priceGapThreshold          = prefs.priceGapThreshold          ?? 15;
  const foodCostDeviationThreshold = prefs.foodCostDeviationThreshold ?? 5;

  const [profiles, setProfiles]         = useState([]);
  const [settingId, setSettingId]       = useState('');
  const [priceSource, setPriceSource]   = useState(prefs.defaultPriceSource || 'latest');
  const [rows, setRows]                 = useState([]);
  const [loading, setLoading]           = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [generated, setGenerated]       = useState(false);
  const [generatedAt, setGeneratedAt]   = useState(null);

  // Load pricing profiles and initial summary
  const loadProfiles = useCallback(async () => {
    try {
      const { data } = await api.get('/settings');
      const list = data.data ?? [];
      setProfiles(list);
      if (list.length > 0) setSettingId(String(list[0].id));
    } catch (err) {
      toast.error('Failed to load pricing profiles');
    }
  }, []);

  const loadSummary = useCallback(async () => {
    setInitialLoading(true);
    try {
      const { data } = await api.get('/costing/summary');
      setRows(data.data ?? []);
      setGenerated(false);
    } catch (err) {
      toast.error('Failed to load summary');
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
    loadSummary();
  }, [loadProfiles, loadSummary]);

  // Batch compute all recipes
  const handleGenerate = async () => {
    if (!settingId) return toast.error('Select a pricing profile first');
    setLoading(true);
    try {
      const { data } = await api.post('/costing/batch', {
        pricing_setting_id: parseInt(settingId, 10),
        price_source: priceSource,
      });
      const batchResults = data.data ?? [];

      // Merge batch results into summary-shaped rows for the table
      const merged = batchResults.map(r => ({
        recipe_id:            r.recipe_id,
        recipe_name:          r.recipe_name,
        image_data:           rows.find(s => s.recipe_id === r.recipe_id)?.image_data ?? null,
        servings:             r.servings,
        output_id:            r.output_id,
        portion_cost:         r.portion_cost,
        recommended_price:    r.recommended_price,
        actual_selling_price: null,
        target_food_cost_pct: r.target_food_cost_pct,
        applied_price_source: r.price_source,
        computed_at:          new Date().toISOString(),
        has_missing_prices:   r.has_missing_prices,
        missing_count:        r.missing_price_ingredients?.length ?? 0,
        error:                r.error ?? null,
      }));

      setRows(merged);
      setGenerated(true);
      setGeneratedAt(new Date());
      toast.success(data.message || `Report generated for ${batchResults.length} recipes`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Batch compute failed');
    } finally {
      setLoading(false);
    }
  };

  // Threshold check logic
  const getFlag = (row) => {
    if (!row.portion_cost || !row.recommended_price) return { needsUpdate: false, noData: true, noActualPrice: false };

    const ap = row.actual_selling_price;
    if (ap == null) return { needsUpdate: false, noData: false, noActualPrice: true, gapFlag: false, fcFlag: false };

    const rec = row.recommended_price;
    const pc = row.portion_cost;
    const targetPct = row.target_food_cost_pct;

    // Condition 1: actual vs recommended gap
    const gapFlag = Math.abs((ap - rec) / rec * 100) > priceGapThreshold;

    // Condition 2: actual FC% vs target
    const fcFlag = targetPct != null
      ? (pc / ap * 100) - targetPct > foodCostDeviationThreshold
      : false;

    return { needsUpdate: gapFlag || fcFlag, noData: false, noActualPrice: false, gapFlag, fcFlag };
  };

  // Computed stats
  const totalRecipes       = rows.length;
  const withCost           = rows.filter(r => r.recommended_price != null).length;
  const missingPrices      = rows.filter(r => r.recommended_price == null).length;
  const needsUpdateCount   = rows.filter(r => {
    const f = getFlag(r);
    return !f.noData && f.needsUpdate;
  }).length;

  // CSV export
  const downloadCSV = () => {
    const headers = [
      'Recipe', 'Servings', 'Portion Cost (₱)', 'Recommended Price (₱)',
      'Actual Price (₱)', 'Actual FC%', 'Target FC%', 'Price Gap%', 'FC Deviation (pp)', 'Status',
    ];
    const csvRows = rows.map(r => {
      const { needsUpdate, noData, noActualPrice } = getFlag(r);
      const ap = r.actual_selling_price;
      const actualFcPct = ap && r.portion_cost ? (r.portion_cost / ap * 100).toFixed(1) : '';
      const gapPct = ap && r.recommended_price
        ? Math.abs((ap - r.recommended_price) / r.recommended_price * 100).toFixed(1)
        : '';
      const fcDev = ap && r.portion_cost && r.target_food_cost_pct
        ? ((r.portion_cost / ap * 100) - r.target_food_cost_pct).toFixed(1)
        : '';
      const status = noData ? 'Not computed' : noActualPrice ? 'No actual price' : needsUpdate ? 'Update price' : 'Price OK';
      return [
        r.recipe_name ?? '',
        r.servings ?? '',
        r.portion_cost?.toFixed(2) ?? '',
        r.recommended_price?.toFixed(2) ?? '',
        ap?.toFixed(2) ?? '',
        actualFcPct,
        r.target_food_cost_pct?.toFixed(1) ?? '',
        gapPct,
        fcDev,
        status,
      ];
    });
    const csv = [headers, ...csvRows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `costing-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const profileOptions = profiles.map(p => ({
    value: String(p.id),
    label: p.label,
    description: `${p.target_food_cost_pct}% food cost · ${p.rounding_rule === 'none' ? 'No rounding' : p.rounding_rule === 'nearest5' ? 'Round to ₱5' : 'Round to ₱10'}`,
  }));

  const thStyle = {
    padding: '10px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 700,
    color: T.tblHead, letterSpacing: '0.05em', textTransform: 'uppercase',
    background: T.tblHeadBg, borderBottom: T.rowDivider, whiteSpace: 'nowrap',
  };
  const tdStyle = {
    padding: '11px 14px', fontSize: 13.5, color: T.textPrimary,
    borderBottom: T.rowDivider, verticalAlign: 'middle',
  };

  return (
    <div style={{ maxWidth: 1100, paddingBottom: 40 }}>
      {/* Print-only header */}
      <div className="print-only" style={{ display: 'none', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: T.textPrimary, margin: '0 0 4px' }}>
          Costing Report
        </h1>
        <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>
          Generated: {new Date().toLocaleString('en-PH')}
          {generatedAt && ` · Computed at ${generatedAt.toLocaleString('en-PH')}`}
        </p>
      </div>

      {/* Controls */}
      <div className="no-print" style={{ background: '#FFFFFF', border: T.cardBorder, borderRadius: 20, padding: '20px 24px', marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, margin: '0 0 16px' }}>Generate Report</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>Pricing Profile</label>
            <Select
              value={settingId}
              onChange={setSettingId}
              options={profileOptions}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>Price Source</label>
            <Select
              value={priceSource}
              onChange={setPriceSource}
              options={SOURCE_OPTIONS}
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading || !settingId}
            style={{
              height: 42, padding: '0 24px', borderRadius: 12,
              background: loading || !settingId ? T.accentLight : T.accent,
              color: loading || !settingId ? T.accent : '#FFFFFF',
              fontWeight: 700, fontSize: 13.5, border: 'none',
              cursor: loading || !settingId ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Computing…' : 'Generate Report'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: T.textMuted, margin: '10px 0 0' }}>
          Computes costs for all recipes and saves a snapshot. Or view the table below to see the most recent computation per recipe.
        </p>
      </div>

      {/* Summary stat cards */}
      {!initialLoading && rows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, marginBottom: 20 }}>
          {[
            { label: 'Total Recipes',     value: totalRecipes,     color: T.accent },
            { label: 'Costs Computed',    value: withCost,         color: '#166534' },
            { label: 'Missing Prices',    value: missingPrices,    color: missingPrices > 0 ? '#991B1B' : '#166534' },
            { label: 'Need Price Update', value: needsUpdateCount, color: needsUpdateCount > 0 ? '#92400E' : '#166534' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: '#FFFFFF', border: T.cardBorder, borderRadius: 16, padding: '16px 20px' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Threshold legend */}
      <div className="no-print" style={{ background: '#FDFBF8', border: T.cardBorder, borderRadius: 12, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: T.textMuted, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <span>
          <strong style={{ color: T.ok }}>Price OK</strong> — actual price within {priceGapThreshold}% of recommended AND food cost within {foodCostDeviationThreshold}pp of target
        </span>
        <span>
          <strong style={{ color: T.warn }}>Update price</strong> — either threshold exceeded (configure in Settings &rsaquo; Preferences)
        </span>
        <span>
          <strong style={{ color: T.textSecond }}>No actual price</strong> — set the actual selling price on the Costing page to enable comparison
        </span>
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', border: T.cardBorder, borderRadius: 20, overflow: 'hidden' }}>
        {initialLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
            No recipes found. Add some recipes first.
          </div>
        ) : (
          <>
            {/* Table actions */}
            <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: T.rowDivider, flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontSize: 13, color: T.textSecond, fontWeight: 600 }}>
                {rows.length} recipe{rows.length !== 1 ? 's' : ''}
                {generated && generatedAt && (
                  <span style={{ fontWeight: 400, color: T.textMuted, marginLeft: 8 }}>
                    · Batch computed {generatedAt.toLocaleString('en-PH')}
                  </span>
                )}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={downloadCSV}
                  style={{ height: 34, padding: '0 14px', borderRadius: 10, border: T.cardBorder, background: T.inputBg, color: T.textSecond, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Export CSV
                </button>
                <button
                  onClick={() => window.print()}
                  style={{ height: 34, padding: '0 14px', borderRadius: 10, border: T.cardBorder, background: T.inputBg, color: T.textSecond, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Print
                </button>
              </div>
            </div>

            {/* Scrollable table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Recipe</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Servings</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Portion Cost</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Recommended Price</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Actual Price</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Actual FC%</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Target FC%</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Price Gap</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const { needsUpdate, noData, noActualPrice, gapFlag, fcFlag } = getFlag(row);
                    const ap         = row.actual_selling_price;
                    const actualFcPct = ap && row.portion_cost
                      ? (row.portion_cost / ap * 100)
                      : null;
                    const gapPct     = ap && row.recommended_price
                      ? Math.abs((ap - row.recommended_price) / row.recommended_price * 100)
                      : null;
                    const fcDeviation = actualFcPct != null && row.target_food_cost_pct != null
                      ? actualFcPct - row.target_food_cost_pct
                      : null;

                    const rowBg = !noData && needsUpdate ? '#FFFDF5' : 'transparent';

                    return (
                      <tr key={row.recipe_id} style={{ background: rowBg }}>
                        <td style={tdStyle}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, verticalAlign: 'middle' }}>
                            <RecipeThumb src={row.image_data} name={row.recipe_name} size={26} radius={7} />
                            <span style={{ fontWeight: 600, color: T.textPrimary }}>{row.recipe_name}</span>
                          </span>
                          {row.has_missing_prices && (
                            <MissingBadge count={row.missing_count} />
                          )}
                          {row.error && (
                            <span style={{ fontSize: 11.5, color: T.danger, marginLeft: 6 }}>Error</span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', color: T.textMuted }}>{row.servings ?? '—'}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(row.portion_cost)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(row.recommended_price)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: T.textMuted }}>{fmt(ap)}</td>
                        <td style={{
                          ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                          color: fcFlag ? T.warn : actualFcPct != null ? T.textSecond : T.textMuted,
                          fontWeight: fcFlag ? 700 : 400,
                        }}>
                          {fmtPct(actualFcPct)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: T.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                          {fmtPct(row.target_food_cost_pct)}
                        </td>
                        <td style={{
                          ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                          color: gapFlag ? T.warn : gapPct != null ? T.textSecond : T.textMuted,
                          fontWeight: gapFlag ? 700 : 400,
                        }}>
                          {gapPct != null ? `${gapPct.toFixed(1)}%` : '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <StatusBadge needsUpdate={needsUpdate} noData={noData} noActualPrice={noActualPrice} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Print footer */}
            <div className="print-only" style={{ display: 'none', padding: '12px 20px', borderTop: T.rowDivider, fontSize: 11, color: T.textMuted }}>
              Smart Menu Pricing System ·
              Price update threshold: {priceGapThreshold}% gap or +{foodCostDeviationThreshold}pp over target food cost %
            </div>
          </>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
          @page { margin: 1.5cm; }
        }
      `}</style>
    </div>
  );
}
