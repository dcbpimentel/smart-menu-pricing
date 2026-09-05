import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FiPackage } from 'react-icons/fi';
import api from '../lib/api';
import Select from '../components/Select';
import { SkeletonTable } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { formatCurrency } from '../lib/format';

const UNITS = ['kg', 'g', 'L', 'ml', 'pcs'];

function Modal({ onClose, children, wide }) {
  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        background: 'rgba(10,8,6,0.5)',
        backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)',
      }}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl w-full flex flex-col modal-content ${wide ? 'max-w-2xl' : 'max-w-md'}`}
        style={{ maxHeight: 'calc(100vh - 40px)' }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

function ModalHeader({ title, subtitle, onClose }) {
  return (
    <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
      <div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5 ml-4"
        aria-label="Close"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

const SOURCE_BADGE = {
  manual: 'bg-blue-50 text-blue-700',
  dti:    'bg-violet-50 text-violet-700',
  da:     'bg-amber-50 text-amber-700',
};

export default function Ingredients() {
  const toast = useToast();

  // ── List ──────────────────────────────────────────────────────────────
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  // ── Add / Edit modal ──────────────────────────────────────────────────
  const [modalOpen, setModalOpen]     = useState(false);
  const [editTarget, setEditTarget]   = useState(null);
  const [form, setForm]               = useState({ name: '', unit: 'kg', category: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError]     = useState(null);

  // ── Price history modal ───────────────────────────────────────────────
  const [priceModal, setPriceModal]       = useState(false);
  const [priceTarget, setPriceTarget]     = useState(null);
  const [prices, setPrices]               = useState([]);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError]     = useState(null);

  // ── Add price form (inside price modal) ───────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const [addForm, setAddForm]         = useState({ price: '', extraction_date: today });
  const [addLoading, setAddLoading]   = useState(false);
  const [addError, setAddError]       = useState(null);

  // ── Fetch all ingredients ─────────────────────────────────────────────
  const fetchIngredients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/ingredients');
      setIngredients(data.data);
    } catch (err) {
      setError(err.response?.data?.message ?? err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIngredients(); }, [fetchIngredients]);

  // ── Open add modal ────────────────────────────────────────────────────
  const openAdd = () => {
    setEditTarget(null);
    setForm({ name: '', unit: 'kg', category: '' });
    setFormError(null);
    setModalOpen(true);
  };

  // ── Open edit modal ───────────────────────────────────────────────────
  const openEdit = (ing) => {
    setEditTarget(ing);
    setForm({ name: ing.name, unit: ing.unit, category: ing.category ?? '' });
    setFormError(null);
    setModalOpen(true);
  };

  // ── Submit add / edit ─────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      if (editTarget) {
        await api.put(`/ingredients/${editTarget.id}`, form);
      } else {
        await api.post('/ingredients', form);
      }
      setModalOpen(false);
      toast.success('Ingredient saved');
      fetchIngredients();
    } catch (err) {
      const msg = err.response?.data?.message ?? err.message;
      setFormError(msg);
      toast.error(msg);
    } finally {
      setFormLoading(false);
    }
  };

  // ── Fetch price history ───────────────────────────────────────────────
  const fetchPrices = async (ing) => {
    setPricesLoading(true);
    setPricesError(null);
    try {
      const { data } = await api.get(`/prices/history/${ing.id}`);
      setPrices(data.data);
    } catch (err) {
      setPricesError(err.response?.data?.message ?? err.message);
    } finally {
      setPricesLoading(false);
    }
  };

  const openPrices = (ing) => {
    setPriceTarget(ing);
    setPrices([]);
    setPricesError(null);
    setAddForm({ price: '', extraction_date: today });
    setAddError(null);
    setPriceModal(true);
    fetchPrices(ing);
  };

  // ── Delete ingredient ─────────────────────────────────────────────────
  const handleDelete = async (ing) => {
    setPendingDelete(null);
    try {
      await api.delete(`/ingredients/${ing.id}`);
      toast.success('Ingredient deleted');
      fetchIngredients();
    } catch (err) {
      toast.error(err.response?.data?.message ?? err.message);
    }
  };

  // ── Esc closes modal ──────────────────────────────────────────────────
  useEffect(() => {
    if (!modalOpen) return;
    const handler = (e) => { if (e.key === 'Escape') setModalOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [modalOpen]);

  // ── Add manual price ──────────────────────────────────────────────────
  const handleAddPrice = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);
    try {
      await api.post('/prices', {
        ingredient_id:   priceTarget.id,
        price:           parseFloat(addForm.price),
        source:          'manual',
        extraction_date: addForm.extraction_date,
        is_manual:       true,
      });
      setAddForm({ price: '', extraction_date: today });
      fetchPrices(priceTarget);
    } catch (err) {
      setAddError(err.response?.data?.message ?? err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');

  // ── Quick-add price (toolbar inline) ─────────────────────────────────
  const [qaIngredient, setQaIngredient] = useState('');
  const [qaPrice, setQaPrice]           = useState('');
  const [qaDate, setQaDate]             = useState(today);
  const [qaLoading, setQaLoading]       = useState(false);

  const handleQuickAddPrice = async (e) => {
    e.preventDefault();
    if (!qaIngredient || !qaPrice) return;
    setQaLoading(true);
    try {
      await api.post('/prices', {
        ingredient_id: parseInt(qaIngredient, 10),
        price: parseFloat(qaPrice),
        source: 'manual',
        extraction_date: qaDate,
        is_manual: true,
      });
      toast.success('Price added');
      setQaPrice('');
      setQaIngredient('');
      setQaDate(today);
    } catch (err) {
      toast.error(err.response?.data?.message ?? err.message);
    } finally {
      setQaLoading(false);
    }
  };

  const categories = [...new Set(ingredients.map(i => i.category).filter(Boolean))].sort();
  const displayed = ingredients.filter(ing => {
    const matchSearch = !search || ing.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !catFilter || ing.category === catFilter;
    return matchSearch && matchCat;
  });

  const inputStyle = { height: 44, padding: '0 12px', borderRadius: 12, border: '1px solid var(--input-border)', background: 'var(--input-bg)', fontSize: 14, color: 'var(--text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box' };
  const thStyle = { padding: '11px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-ultra-muted)', textAlign: 'left', background: 'var(--table-header-bg)', whiteSpace: 'nowrap' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-ultra-muted)', pointerEvents: 'none' }}>
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="Search ingredients…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 36 }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 4px var(--accent-focus)'; e.target.style.background = 'var(--card-bg)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--input-border)'; e.target.style.boxShadow = 'none'; e.target.style.background = 'var(--input-bg)'; }}
          />
        </div>

        {/* Category pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['', ...categories].map(cat => (
            <button key={cat || '__all'} onClick={() => setCatFilter(cat)}
              style={{
                padding: '6px 14px', borderRadius: 999, border: '1px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 140ms ease',
                background: catFilter === cat ? 'var(--accent-light)' : 'var(--card-bg)',
                borderColor: catFilter === cat ? 'var(--accent)' : 'var(--input-border)',
                color: catFilter === cat ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >{cat || 'All'}</button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto' }}>
          <button onClick={openAdd} className="btn-primary" style={{ height: 42, padding: '0 18px', borderRadius: 12, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add Ingredient
          </button>
        </div>
      </div>

      {/* Quick-add price */}
      {ingredients.length > 0 && (
        <form
          onSubmit={handleQuickAddPrice}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, flexWrap: 'wrap' }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-ultra-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', flexShrink: 0 }}>Quick Price</span>
          <select
            value={qaIngredient}
            onChange={e => setQaIngredient(e.target.value)}
            required
            style={{ height: 36, padding: '0 10px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'var(--input-bg)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', minWidth: 160, maxWidth: 240, flex: '1 1 140px' }}
          >
            <option value="">Select ingredient…</option>
            {[...ingredients].sort((a, b) => a.name.localeCompare(b.name)).map(ing => (
              <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
            ))}
          </select>
          <div style={{ position: 'relative', flex: '0 1 130px' }}>
            <span style={{ position: 'absolute', left: 10, top: 9, fontSize: 13, color: 'var(--text-ultra-muted)', pointerEvents: 'none' }}>₱</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Price"
              value={qaPrice}
              onChange={e => setQaPrice(e.target.value)}
              required
              style={{ height: 36, width: '100%', paddingLeft: 22, paddingRight: 10, borderRadius: 10, border: '1px solid var(--input-border)', background: 'var(--input-bg)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <input
            type="date"
            value={qaDate}
            onChange={e => setQaDate(e.target.value)}
            required
            style={{ height: 36, padding: '0 10px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'var(--input-bg)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', flex: '0 1 150px' }}
          />
          <button
            type="submit"
            disabled={qaLoading || !qaIngredient || !qaPrice}
            style={{ height: 36, padding: '0 16px', borderRadius: 10, background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: (qaLoading || !qaIngredient || !qaPrice) ? 'not-allowed' : 'pointer', opacity: (qaLoading || !qaIngredient || !qaPrice) ? 0.6 : 1, flexShrink: 0, fontFamily: 'inherit' }}
          >
            {qaLoading ? '…' : 'Add'}
          </button>
        </form>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 16px', background: 'oklch(0.97 0.025 30)', border: '1px solid oklch(0.9 0.05 30)', borderRadius: 12, fontSize: 13.5, color: 'oklch(0.48 0.14 28)' }}>{error}</div>
      )}

      {/* Table card */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden' }}>
        {loading ? <SkeletonTable rows={6} cols={5} /> : ingredients.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FiPackage size={26} /></div>
            <div className="empty-state-title">No ingredients yet</div>
            <div className="empty-state-subtitle">Add your first ingredient to start building recipes and computing costs.</div>
            <button onClick={openAdd} className="btn-primary" style={{ height: 40, padding: '0 20px', borderRadius: 11, fontSize: 14 }}>Add ingredient</button>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, paddingLeft: 22 }}>Name</th>
                    <th style={thStyle}>Unit</th>
                    <th style={thStyle}>Category</th>
                    <th style={{ ...thStyle, paddingRight: 22, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((ing, i) => (
                    <tr key={ing.id} style={{ borderTop: i > 0 ? '1px solid var(--divider)' : 'none', transition: 'background 0.12s ease' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--row-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '13px 12px 13px 22px' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{ing.name}</span>
                      </td>
                      <td style={{ padding: '13px 12px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 999, background: '#F6F1E9', fontSize: 12, fontWeight: 600, color: '#6B625A', fontFamily: 'monospace' }}>{ing.unit}</span>
                      </td>
                      <td style={{ padding: '13px 12px' }}>
                        {ing.category && <span style={{ padding: '3px 10px', borderRadius: 999, background: '#F6F1E9', fontSize: 12, fontWeight: 600, color: '#6B625A' }}>{ing.category}</span>}
                      </td>
                      <td style={{ padding: '13px 22px 13px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <button onClick={() => openPrices(ing)} style={{ height: 32, padding: '0 12px', borderRadius: 9, border: '1px solid var(--input-border)', background: 'var(--card-bg)', fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }}>
                            Prices
                          </button>
                          <button onClick={() => openEdit(ing)} style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--input-border)', background: 'var(--card-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M7.5 2.5l3 3-7 7H.5v-3l7-7z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                          </button>
                          {pendingDelete?.id === ing.id ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Delete?</span>
                              <button onClick={() => handleDelete(ing)} style={{ fontSize: 12, color: 'oklch(0.55 0.16 28)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>Yes</button>
                              <button onClick={() => setPendingDelete(null)} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>No</button>
                            </span>
                          ) : (
                            <button onClick={() => setPendingDelete(ing)} style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid #F0DFDB', background: 'var(--card-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'oklch(0.60 0.14 28)' }}>
                              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3.5h9M4.5 3.5V2.5h4v1M5 6v4M8 6v4M3 3.5l.5 7h6l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '12px 22px', borderTop: '1px solid var(--divider)', background: 'var(--table-header-bg)', fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Showing {displayed.length} of {ingredients.length} ingredients</span>
              <span>Prices in Philippine Peso (₱)</span>
            </div>
          </>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)}>
          <ModalHeader title={editTarget ? 'Edit Ingredient' : 'Add Ingredient'} onClose={() => setModalOpen(false)} />
          <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
            {[
              { label: 'Name', key: 'name', type: 'text', placeholder: 'e.g. Chicken Breast' },
              { label: 'Category', key: 'category', type: 'text', placeholder: 'e.g. Meat, Vegetable, Grain' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>{label} <span style={{ color: 'oklch(0.60 0.14 28)' }}>*</span></label>
                <input type={type} required value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 4px var(--accent-focus)'; e.target.style.background = 'var(--card-bg)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--input-border)'; e.target.style.boxShadow = 'none'; e.target.style.background = 'var(--input-bg)'; }}
                />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Unit <span style={{ color: 'oklch(0.60 0.14 28)' }}>*</span></label>
              <Select value={form.unit} onChange={v => setForm(f => ({ ...f, unit: v }))} options={UNITS.map(u => ({ value: u, label: u }))} />
            </div>
            {formError && <div style={{ padding: '10px 14px', background: 'oklch(0.97 0.025 30)', border: '1px solid oklch(0.9 0.05 30)', borderRadius: 10, fontSize: 13, color: 'oklch(0.48 0.14 28)' }}>{formError}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, paddingTop: 4 }}>
              <button type="button" onClick={() => setModalOpen(false)} style={{ height: 40, padding: '0 16px', borderRadius: 11, border: '1px solid var(--input-border)', background: 'var(--card-bg)', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={formLoading} className="btn-primary" style={{ height: 40, padding: '0 20px', borderRadius: 11, fontSize: 14 }}>{formLoading ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Ingredient'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Price History Modal ── */}
      {priceModal && priceTarget && (
        <Modal onClose={() => setPriceModal(false)} wide>
          <ModalHeader title={priceTarget.name} subtitle="Price history" onClose={() => setPriceModal(false)} />
          <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
            {/* ── Price source comparison ── */}
            {!pricesLoading && !pricesError && prices.length > 0 && (() => {
              const latest = { dti: null, da: null, manual: null };
              prices.forEach(p => { if (!latest[p.source]) latest[p.source] = p; });
              const sourceConfig = [
                { key: 'dti',    label: 'DTI',    bg: 'oklch(0.95 0.025 290)', color: 'oklch(0.44 0.12 290)' },
                { key: 'da',     label: 'DA',     bg: 'oklch(0.97 0.03 85)',   color: 'oklch(0.52 0.11 75)' },
                { key: 'manual', label: 'Manual', bg: 'oklch(0.95 0.02 240)',  color: 'oklch(0.44 0.12 240)' },
              ];
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
                  {sourceConfig.map(({ key, label, bg, color }) => (
                    <div key={key} style={{ background: bg, borderRadius: 12, padding: '12px 14px' }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color, marginBottom: 4 }}>{label}</div>
                      {latest[key] ? (
                        <>
                          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(latest[key].price)}
                            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 4 }}>/{priceTarget.unit}</span>
                          </div>
                          <div style={{ fontSize: 11.5, color, marginTop: 2 }}>{latest[key].extraction_date}</div>
                        </>
                      ) : (
                        <div style={{ fontSize: 13, color, marginTop: 4 }}>No price</div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}

            {pricesLoading ? <SkeletonTable rows={4} cols={4} /> : pricesError ? (
              <div style={{ color: 'oklch(0.48 0.14 28)', fontSize: 13.5, padding: '12px 0' }}>{pricesError}</div>
            ) : prices.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: 14, padding: '20px 0' }}>No price history yet.</p>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Date','Price','Source','Note'].map((h, i) => (
                        <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-ultra-muted)', textAlign: 'left', background: 'var(--table-header-bg)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {prices.map((p, i) => (
                      <tr key={p.id} style={{ borderTop: i > 0 ? '1px solid var(--divider)' : 'none' }}>
                        <td style={{ padding: '11px 14px', fontSize: 13.5, color: 'var(--text-secondary)' }}>{p.extraction_date}</td>
                        <td style={{ padding: '11px 14px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(p.price)}</td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ padding: '3px 9px', borderRadius: 999, background: p.source === 'manual' ? 'oklch(0.95 0.02 240)' : p.source === 'dti' ? 'oklch(0.95 0.025 290)' : 'oklch(0.97 0.03 85)', color: p.source === 'manual' ? 'oklch(0.44 0.12 240)' : p.source === 'dti' ? 'oklch(0.44 0.12 290)' : 'oklch(0.52 0.11 75)', fontSize: 11.5, fontWeight: 600 }}>{p.source.toUpperCase()}</span>
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 12.5, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.provenance_note ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 16 }}>
              <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-ultra-muted)', marginBottom: 12 }}>Add Manual Price</p>
              <form onSubmit={handleAddPrice}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 120px' }}>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 5 }}>Price (₱ / {priceTarget.unit})</label>
                    <input type="number" step="0.01" min="0.01" required value={addForm.price} onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00"
                      style={{ ...inputStyle, height: 40 }}
                      onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-focus)'; }}
                      onBlur={e => { e.target.style.borderColor = 'var(--input-border)'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 5 }}>Date</label>
                    <input type="date" required value={addForm.extraction_date} onChange={e => setAddForm(f => ({ ...f, extraction_date: e.target.value }))}
                      style={{ ...inputStyle, height: 40, width: 'auto' }}
                      onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-focus)'; }}
                      onBlur={e => { e.target.style.borderColor = 'var(--input-border)'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                  <button type="submit" disabled={addLoading} className="btn-primary" style={{ height: 40, padding: '0 16px', borderRadius: 11, fontSize: 13.5, whiteSpace: 'nowrap' }}>{addLoading ? '…' : '+ Add Price'}</button>
                </div>
                {addError && <p style={{ marginTop: 8, fontSize: 12.5, color: 'oklch(0.48 0.14 28)' }}>{addError}</p>}
              </form>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
