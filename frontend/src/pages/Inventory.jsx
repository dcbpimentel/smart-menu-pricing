import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/api';
import { useToast } from '../components/Toast';

const T = {
  accent:      '#4C5D3E',
  accentLight: 'oklch(0.955 0.021 138)',
  textPrimary: '#24201C',
  textSecond:  '#6B625A',
  textMuted:   '#8C837B',
  inputBorder: '#E7DFD4',
  inputBg:     '#FDFBF8',
  focusShadow: '0 0 0 4px oklch(0.945 0.028 138)',
  cardBorder:  '1px solid #EFE8DE',
  rowDivider:  '1px solid #F3EDE4',
  rowHover:    '#FDFBF8',
  tblHead:     '#A79E94',
  tblHeadBg:   '#FDFBF8',
  dangerBg:    '#FEE2E2',
  danger:      '#991B1B',
  warnBg:      '#FEF3C7',
  warn:        '#92400E',
  okBg:        '#DCFCE7',
  ok:          '#166534',
};

const TYPE_CONFIG = {
  restock:    { label: 'Restock',    color: T.ok,     bg: T.okBg },
  usage:      { label: 'Used',       color: T.accent,  bg: T.accentLight },
  spoilage:   { label: 'Spoilage',   color: T.danger,  bg: T.dangerBg },
  adjustment: { label: 'Adjustment', color: T.warn,    bg: T.warnBg },
};

const inputStyle = {
  height: 40, borderRadius: 10, border: `1px solid ${T.inputBorder}`,
  background: T.inputBg, fontSize: 14, color: T.textPrimary,
  padding: '0 12px', outline: 'none', fontFamily: 'inherit',
  width: '100%', boxSizing: 'border-box',
};

const fmt = (n) => n == null ? '—' : Number(n).toFixed(3).replace(/\.?0+$/, '') || '0';
const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

function Modal({ onClose, title, subtitle, children, footer }) {
  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(10,8,6,0.50)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#FFFFFF', borderRadius: 20, border: T.cardBorder, width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)', boxShadow: '0 32px 80px rgba(36,32,28,0.22)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '18px 24px', borderBottom: T.rowDivider, flexShrink: 0 }}>
          <div>
            <h3 style={{ fontWeight: 600, fontSize: 15.5, color: T.textPrimary, margin: 0 }}>{title}</h3>
            {subtitle && <p style={{ fontSize: 12.5, color: T.textMuted, margin: '3px 0 0' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #EFE8DE', background: '#FDFBF8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMuted, flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '20px 24px' }}>
          {children}
        </div>
        {/* Footer */}
        {footer && (
          <div style={{ padding: '14px 24px', borderTop: T.rowDivider, flexShrink: 0, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function HistoryModal({ ingredient, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/inventory/history/${ingredient.id}`)
      .then(r => setHistory(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ingredient.id]);

  const thStyle = { padding: '9px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.tblHead, background: T.tblHeadBg, textAlign: 'left' };
  const tdStyle = { padding: '10px 12px', fontSize: 13, color: T.textPrimary, borderBottom: T.rowDivider };

  return (
    <Modal
      onClose={onClose}
      title={`${ingredient.name} — History`}
      subtitle="Last 100 transactions, newest first"
    >
      {loading ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>Loading…</div>
      ) : history.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No transactions yet.</div>
      ) : (
        <div style={{ overflowX: 'auto', margin: '0 -24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 380 }}>
            <thead>
              <tr>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Type</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Qty</th>
                <th style={thStyle}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {history.map(row => {
                const cfg = TYPE_CONFIG[row.type] ?? TYPE_CONFIG.adjustment;
                return (
                  <tr key={row.id}>
                    <td style={{ ...tdStyle, color: T.textMuted, fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(row.transaction_date)}</td>
                    <td style={tdStyle}>
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                        {row.recipe_name && ` — ${row.recipe_name}`}
                        {row.batches && row.batches > 1 && ` ×${row.batches}`}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: row.quantity >= 0 ? T.ok : T.danger }}>
                      {row.quantity >= 0 ? '+' : ''}{fmt(row.quantity)} {row.unit}
                    </td>
                    <td style={{ ...tdStyle, color: T.textMuted, fontSize: 12 }}>{row.notes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

function RestockModal({ ingredient, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ quantity: '', notes: '', date: new Date().toISOString().slice(0, 10) });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.quantity || parseFloat(form.quantity) <= 0) return toast.error('Enter a positive quantity');
    setLoading(true);
    try {
      await api.post('/inventory/restock', {
        ingredient_id: ingredient.id,
        quantity: parseFloat(form.quantity),
        notes: form.notes || undefined,
        transaction_date: form.date,
      });
      toast.success(`Restocked ${ingredient.name}`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Restock failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Restock Ingredient"
      subtitle={`Add incoming stock for ${ingredient.name}`}
      footer={
        <>
          <button onClick={onClose} style={{ height: 38, padding: '0 16px', borderRadius: 10, border: T.cardBorder, background: '#FDFBF8', fontSize: 13, fontWeight: 600, color: T.textSecond, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading} style={{ height: 38, padding: '0 20px', borderRadius: 10, background: T.accent, color: '#FFFFFF', fontSize: 13, fontWeight: 700, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Saving…' : 'Add Stock'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond, display: 'block', marginBottom: 6 }}>
            Quantity ({ingredient.unit})
          </label>
          <input
            type="number" step="0.001" min="0.001" autoFocus
            placeholder={`e.g. 5 ${ingredient.unit}`}
            value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
            style={inputStyle}
            onFocus={e => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = T.focusShadow; e.target.style.background = '#FFF'; }}
            onBlur={e => { e.target.style.borderColor = T.inputBorder; e.target.style.boxShadow = 'none'; e.target.style.background = T.inputBg; }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond, display: 'block', marginBottom: 6 }}>Date</label>
          <input
            type="date" value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            style={inputStyle}
            onFocus={e => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = T.focusShadow; e.target.style.background = '#FFF'; }}
            onBlur={e => { e.target.style.borderColor = T.inputBorder; e.target.style.boxShadow = 'none'; e.target.style.background = T.inputBg; }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond, display: 'block', marginBottom: 6 }}>Notes <span style={{ fontWeight: 400, color: T.textMuted }}>(optional)</span></label>
          <input
            type="text" placeholder="e.g. Delivery from supplier"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            style={inputStyle}
            onFocus={e => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = T.focusShadow; e.target.style.background = '#FFF'; }}
            onBlur={e => { e.target.style.borderColor = T.inputBorder; e.target.style.boxShadow = 'none'; e.target.style.background = T.inputBg; }}
          />
        </div>
      </form>
    </Modal>
  );
}

function LossModal({ ingredient, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ type: 'spoilage', quantity: '', notes: '', date: new Date().toISOString().slice(0, 10) });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.quantity || parseFloat(form.quantity) <= 0) return toast.error('Enter a positive quantity');
    setLoading(true);
    try {
      await api.post('/inventory/adjust', {
        ingredient_id: ingredient.id,
        type: form.type,
        quantity: parseFloat(form.quantity),
        notes: form.notes || undefined,
        transaction_date: form.date,
      });
      toast.success(`${form.type === 'spoilage' ? 'Spoilage' : 'Adjustment'} logged for ${ingredient.name}`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to log loss');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Log Loss / Spoilage"
      subtitle={`Record a stock reduction for ${ingredient.name}`}
      footer={
        <>
          <button onClick={onClose} style={{ height: 38, padding: '0 16px', borderRadius: 10, border: T.cardBorder, background: '#FDFBF8', fontSize: 13, fontWeight: 600, color: T.textSecond, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading} style={{ height: 38, padding: '0 20px', borderRadius: 10, background: '#991B1B', color: '#FFFFFF', fontSize: 13, fontWeight: 700, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Saving…' : 'Log Loss'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond, display: 'block', marginBottom: 8 }}>Reason</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {[{ v: 'spoilage', label: 'Spoilage' }, { v: 'adjustment', label: 'Other / Adjustment' }].map(opt => (
              <label key={opt.v} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: `1px solid ${form.type === opt.v ? T.accent : T.inputBorder}`, background: form.type === opt.v ? T.accentLight : T.inputBg, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: form.type === opt.v ? T.accent : T.textSecond, transition: 'all 0.15s' }}>
                <input type="radio" name="type" value={opt.v} checked={form.type === opt.v} onChange={() => setForm(f => ({ ...f, type: opt.v }))} style={{ display: 'none' }} />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond, display: 'block', marginBottom: 6 }}>
            Quantity lost ({ingredient.unit})
          </label>
          <input
            type="number" step="0.001" min="0.001" autoFocus
            placeholder={`e.g. 1.5 ${ingredient.unit}`}
            value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
            style={inputStyle}
            onFocus={e => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = T.focusShadow; e.target.style.background = '#FFF'; }}
            onBlur={e => { e.target.style.borderColor = T.inputBorder; e.target.style.boxShadow = 'none'; e.target.style.background = T.inputBg; }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond, display: 'block', marginBottom: 6 }}>Date</label>
          <input
            type="date" value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            style={inputStyle}
            onFocus={e => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = T.focusShadow; e.target.style.background = '#FFF'; }}
            onBlur={e => { e.target.style.borderColor = T.inputBorder; e.target.style.boxShadow = 'none'; e.target.style.background = T.inputBg; }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond, display: 'block', marginBottom: 6 }}>Notes <span style={{ fontWeight: 400, color: T.textMuted }}>(optional)</span></label>
          <input
            type="text" placeholder="e.g. Left in sun, found mold"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            style={inputStyle}
            onFocus={e => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = T.focusShadow; e.target.style.background = '#FFF'; }}
            onBlur={e => { e.target.style.borderColor = T.inputBorder; e.target.style.boxShadow = 'none'; e.target.style.background = T.inputBg; }}
          />
        </div>
      </form>
    </Modal>
  );
}

function ThresholdModal({ ingredient, onClose, onDone }) {
  const toast = useToast();
  const [value, setValue] = useState(ingredient.low_stock_qty != null ? String(ingredient.low_stock_qty) : '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put(`/inventory/${ingredient.id}/threshold`, {
        low_stock_qty: value !== '' ? parseFloat(value) : null,
      });
      toast.success('Alert threshold saved');
      onDone();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save threshold');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Low-Stock Alert Threshold"
      subtitle={`Alert when ${ingredient.name} stock falls to or below this level`}
      footer={
        <>
          <button onClick={onClose} style={{ height: 38, padding: '0 16px', borderRadius: 10, border: T.cardBorder, background: '#FDFBF8', fontSize: 13, fontWeight: 600, color: T.textSecond, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleSave} disabled={loading} style={{ height: 38, padding: '0 20px', borderRadius: 10, background: T.accent, color: '#FFFFFF', fontSize: 13, fontWeight: 700, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Saving…' : 'Save Threshold'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond, display: 'block', marginBottom: 6 }}>
            Minimum quantity ({ingredient.unit})
          </label>
          <input
            type="number" step="0.001" min="0" autoFocus
            placeholder={`e.g. 2 ${ingredient.unit}`}
            value={value}
            onChange={e => setValue(e.target.value)}
            style={inputStyle}
            onFocus={e => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = T.focusShadow; e.target.style.background = '#FFF'; }}
            onBlur={e => { e.target.style.borderColor = T.inputBorder; e.target.style.boxShadow = 'none'; e.target.style.background = T.inputBg; }}
          />
          <p style={{ fontSize: 12, color: T.textMuted, margin: '6px 0 0' }}>Leave blank to disable the alert for this ingredient.</p>
        </div>
      </div>
    </Modal>
  );
}

export default function Inventory() {
  const toast = useToast();
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterLow, setFilterLow] = useState(false);

  const [restockTarget,   setRestockTarget]   = useState(null);
  const [lossTarget,      setLossTarget]      = useState(null);
  const [historyTarget,   setHistoryTarget]   = useState(null);
  const [thresholdTarget, setThresholdTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory');
      setItems(res.data.data ?? []);
    } catch {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = items.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.category || '').toLowerCase().includes(search.toLowerCase());
    const matchLow = !filterLow || item.is_low_stock;
    return matchSearch && matchLow;
  });

  const lowCount   = items.filter(i => i.is_low_stock).length;
  const totalItems = items.length;
  const hasStock   = items.filter(i => i.quantity > 0).length;

  const thStyle = {
    padding: '10px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 700,
    color: T.tblHead, letterSpacing: '0.05em', textTransform: 'uppercase',
    background: T.tblHeadBg, borderBottom: T.rowDivider, whiteSpace: 'nowrap',
  };
  const tdStyle = { padding: '12px 14px', fontSize: 13.5, color: T.textPrimary, borderBottom: T.rowDivider, verticalAlign: 'middle' };

  return (
    <div style={{ maxWidth: 1100, paddingBottom: 40 }}>
      {/* Stat cards */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Ingredients',  value: totalItems,  color: T.accent },
            { label: 'In Stock',     value: hasStock,    color: T.ok },
            { label: 'Low / Empty',  value: lowCount,    color: lowCount > 0 ? T.danger : T.ok },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: '#FFFFFF', border: T.cardBorder, borderRadius: 16, padding: '16px 20px' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* First-time hint — visible when ingredients exist but none have been stocked */}
      {!loading && totalItems > 0 && hasStock === 0 && (
        <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 14, background: T.accentLight, border: `1px solid oklch(0.88 0.04 138)`, display: 'flex', alignItems: 'center', gap: 14 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, color: T.accent }}>
            <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10 6.5v4M10 13.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: T.accent }}>No stock recorded yet</div>
            <div style={{ fontSize: 12.5, color: T.textSecond, marginTop: 2 }}>
              Click <strong>+ Restock</strong> on any ingredient row to add your current on-hand quantities.
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ background: '#FFFFFF', border: T.cardBorder, borderRadius: 16, padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: T.textMuted, pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text" placeholder="Search ingredients…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 32, height: 38, borderRadius: 10 }}
            onFocus={e => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = T.focusShadow; e.target.style.background = '#FFF'; }}
            onBlur={e => { e.target.style.borderColor = T.inputBorder; e.target.style.boxShadow = 'none'; e.target.style.background = T.inputBg; }}
          />
        </div>
        <button
          onClick={() => setFilterLow(f => !f)}
          style={{ height: 38, padding: '0 14px', borderRadius: 10, border: `1px solid ${filterLow ? T.danger : T.inputBorder}`, background: filterLow ? T.dangerBg : T.inputBg, color: filterLow ? T.danger : T.textSecond, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          {filterLow ? 'Showing low stock' : 'Show low stock'}
          {lowCount > 0 && <span style={{ background: T.danger, color: '#FFF', borderRadius: 999, fontSize: 10.5, fontWeight: 700, padding: '1px 6px', marginLeft: 2 }}>{lowCount}</span>}
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', border: T.cardBorder, borderRadius: 20, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>Loading…</div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
            {search || filterLow ? 'No ingredients match your filter.' : 'No ingredients yet. Add some in the Ingredients page.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Ingredient</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>On Hand</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Low-Stock Alert</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Last Updated</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(item => (
                  <tr key={item.id} style={{ background: item.is_low_stock ? '#FFF5F5' : 'transparent' }}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 600, color: T.textPrimary }}>{item.name}</div>
                          {item.category && <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 1 }}>{item.category}</div>}
                        </div>
                        {item.is_low_stock && (
                          <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: T.dangerBg, color: T.danger, flexShrink: 0 }}>Low</span>
                        )}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ fontWeight: 700, color: item.quantity === 0 ? T.danger : item.is_low_stock ? T.warn : T.textPrimary, fontSize: 14 }}>
                        {fmt(item.quantity)}
                      </span>
                      <span style={{ color: T.textMuted, fontSize: 12, marginLeft: 4 }}>{item.unit}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: T.textMuted }}>
                      {item.low_stock_qty != null ? (
                        <button
                          onClick={() => setThresholdTarget(item)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, fontSize: 13, fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textUnderlineOffset: 2 }}
                        >
                          ≤ {fmt(item.low_stock_qty)} {item.unit}
                        </button>
                      ) : (
                        <button
                          onClick={() => setThresholdTarget(item)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent, fontSize: 12.5, fontFamily: 'inherit', padding: 0, fontWeight: 600 }}
                        >
                          + Set alert
                        </button>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontSize: 12, color: T.textMuted }}>
                      {item.stock_updated_at ? fmtDate(item.stock_updated_at.slice(0, 10)) : '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button onClick={() => setRestockTarget(item)} style={{ height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${T.inputBorder}`, background: T.accentLight, color: T.accent, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          + Restock
                        </button>
                        <button onClick={() => setLossTarget(item)} style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid #FECACA', background: T.dangerBg, color: T.danger, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Log Loss
                        </button>
                        <button onClick={() => setHistoryTarget(item)} style={{ height: 32, padding: '0 12px', borderRadius: 8, border: T.cardBorder, background: T.inputBg, color: T.textSecond, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          History
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {restockTarget   && <RestockModal   ingredient={restockTarget}   onClose={() => setRestockTarget(null)}   onDone={load} />}
      {lossTarget      && <LossModal      ingredient={lossTarget}      onClose={() => setLossTarget(null)}      onDone={load} />}
      {historyTarget   && <HistoryModal   ingredient={historyTarget}   onClose={() => setHistoryTarget(null)} />}
      {thresholdTarget && <ThresholdModal ingredient={thresholdTarget} onClose={() => setThresholdTarget(null)} onDone={load} />}
    </div>
  );
}
