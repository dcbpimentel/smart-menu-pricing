import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FiPackage } from 'react-icons/fi';
import api from '../lib/api';
import Select from '../components/Select';
import { SkeletonTable } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { formatCurrency } from '../lib/format';
import { INGREDIENT_UNITS as UNITS } from '../lib/constants';

const fmtDate = (d) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
};

function Modal({ onClose, children, wide }) {
  return createPortal(
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        background: 'rgba(10,8,6,0.5)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
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
        className="text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Close"
        style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 12, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

const getCategoryStyle = (cat) => {
  const map = {
    meat:       { bg: '#FEF0E7', color: '#B84A1A' },
    meats:      { bg: '#FEF0E7', color: '#B84A1A' },
    vegetable:  { bg: '#EDF7F0', color: '#1A7A45' },
    vegetables: { bg: '#EDF7F0', color: '#1A7A45' },
    grain:      { bg: '#FDF7E3', color: '#8A6300' },
    grains:     { bg: '#FDF7E3', color: '#8A6300' },
    fish:       { bg: '#EAF2FE', color: '#1A5CB8' },
    seafood:    { bg: '#EAF2FE', color: '#1A5CB8' },
    dairy:      { bg: '#F3EFFD', color: '#5B2DAB' },
    spice:      { bg: '#FEF0F2', color: '#A81835' },
    spices:     { bg: '#FEF0F2', color: '#A81835' },
    oil:        { bg: '#FEFCE8', color: '#8A6300' },
    condiment:  { bg: '#FEF0F2', color: '#A81835' },
  };
  return map[(cat || '').toLowerCase().replace(/\s+/g, '')] || { bg: '#F3EDE4', color: '#6B5E50' };
};

export default function Ingredients() {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [latestPrices, setLatestPrices] = useState({});
  const [search, setSearch]           = useState('');
  const [catFilter, setCatFilter]     = useState('');
  const [hoveredRow, setHoveredRow]   = useState(null);

  const [addIngOpen, setAddIngOpen]   = useState(false);

  const [detailOpen, setDetailOpen]   = useState(false);
  const [detailIng, setDetailIng]     = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [form, setForm]               = useState({ name: '', unit: 'kg', category: '', initPrice: '', initDate: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError]     = useState(null);

  const [prices, setPrices]               = useState([]);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError]     = useState(null);

  const [addForm, setAddForm]         = useState({ price: '', extraction_date: today });
  const [addLoading, setAddLoading]   = useState(false);
  const [addError, setAddError]       = useState(null);

  const fetchLatestPrices = useCallback(async (ings) => {
    const results = await Promise.allSettled(
      ings.map(ing => api.get(`/prices/latest/${ing.id}`).then(r => ({ id: ing.id, entry: r.data.data })))
    );
    const map = {};
    results.forEach(r => { if (r.status === 'fulfilled') map[r.value.id] = r.value.entry; });
    setLatestPrices(map);
  }, []);

  const fetchIngredients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/ingredients');
      setIngredients(data.data);
      fetchLatestPrices(data.data);
    } catch (err) {
      setError(err.response?.data?.message ?? err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchLatestPrices]);

  useEffect(() => { fetchIngredients(); }, [fetchIngredients]);

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

  const openAdd = () => {
    setForm({ name: '', unit: 'kg', category: '', initPrice: '', initDate: today });
    setFormError(null);
    setAddIngOpen(true);
  };

  const handleAddIngredient = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      const res = await api.post('/ingredients', {
        name: form.name, unit: form.unit, category: form.category,
      });
      const newId = res.data.data?.id;
      if (newId && form.initPrice && parseFloat(form.initPrice) > 0) {
        await api.post('/prices', {
          ingredient_id: newId,
          price: parseFloat(form.initPrice),
          source: 'manual',
          extraction_date: form.initDate || today,
          is_manual: true,
        });
      }
      setAddIngOpen(false);
      toast.success('Ingredient added');
      fetchIngredients();
    } catch (err) {
      const msg = err.response?.data?.message ?? err.message;
      setFormError(msg);
      toast.error(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const openDetail = (ing) => {
    setDetailIng(ing);
    setShowEditForm(false);
    setConfirmDelete(false);
    setPrices([]);
    setPricesError(null);
    setAddForm({ price: '', extraction_date: today });
    setAddError(null);
    setForm({ name: ing.name, unit: ing.unit, category: ing.category ?? '' });
    setFormError(null);
    setDetailOpen(true);
    fetchPrices(ing);
  };

  const handleAddPrice = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);
    try {
      await api.post('/prices', {
        ingredient_id:   detailIng.id,
        price:           parseFloat(addForm.price),
        source:          'manual',
        extraction_date: addForm.extraction_date,
        is_manual:       true,
      });
      try {
        const flagged = JSON.parse(localStorage.getItem('smp_price_flagged') || '{}');
        flagged[String(detailIng.id)] = Date.now();
        localStorage.setItem('smp_price_flagged', JSON.stringify(flagged));
      } catch {}
      setAddForm({ price: '', extraction_date: today });
      fetchPrices(detailIng);
      fetchLatestPrices(ingredients);
      toast.success('Price saved');
    } catch (err) {
      setAddError(err.response?.data?.message ?? err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      await api.put(`/ingredients/${detailIng.id}`, form);
      const updated = { ...detailIng, ...form };
      setDetailIng(updated);
      setShowEditForm(false);
      toast.success('Ingredient updated');
      fetchIngredients();
    } catch (err) {
      const msg = err.response?.data?.message ?? err.message;
      setFormError(msg);
      toast.error(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/ingredients/${detailIng.id}`);
      setDetailOpen(false);
      toast.success('Ingredient deleted');
      fetchIngredients();
    } catch (err) {
      toast.error(err.response?.data?.message ?? err.message);
      setConfirmDelete(false);
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      if (detailOpen) setDetailOpen(false);
      else if (addIngOpen) setAddIngOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [detailOpen, addIngOpen]);

  const categories = [...new Set(ingredients.map(i => i.category).filter(Boolean))].sort();
  const displayed  = ingredients.filter(ing => {
    const matchSearch = !search || ing.name.toLowerCase().includes(search.toLowerCase());
    const matchCat    = !catFilter || ing.category === catFilter;
    return matchSearch && matchCat;
  });

  const inputStyle = {
    height: 40, padding: '0 12px', borderRadius: 10,
    border: '1px solid var(--input-border)', background: 'var(--input-bg)',
    fontSize: 14, color: 'var(--text-primary)', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  };

  const focusStyle  = (e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-focus)'; };
  const blurStyle   = (e) => { e.target.style.borderColor = 'var(--input-border)'; e.target.style.boxShadow = 'none'; };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 180px', maxWidth: 280 }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"
            style={{ position: 'absolute', left: 11, top: 12.5, color: 'var(--text-ultra-muted)', pointerEvents: 'none' }}>
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M10.5 10.5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input type="text" placeholder="Search ingredients…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, height: 38, paddingLeft: 34 }}
            onFocus={focusStyle} onBlur={blurStyle}
          />
        </div>

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {['', ...categories].map(cat => {
            const active = catFilter === cat;
            return (
              <button key={cat || '__all'}
                onClick={() => setCatFilter(catFilter === cat && cat !== '' ? '' : cat)}
                style={{
                  height: 34, padding: '0 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
                  cursor: 'pointer', border: `1px solid ${active ? 'var(--accent)' : 'var(--input-border)'}`,
                  background: active ? 'var(--accent-light)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  transition: 'all 120ms ease',
                }}
              >{cat || 'All'}</button>
            );
          })}
        </div>

        <button onClick={openAdd}
          style={{
            marginLeft: 'auto', height: 38, padding: '0 15px', borderRadius: 9, flexShrink: 0,
            background: 'var(--accent)', color: '#fff', border: 'none',
            fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1.5v10M1.5 6.5h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Add Ingredient
        </button>
      </div>

      {error && (
        <div style={{ padding: '11px 14px', background: 'oklch(0.97 0.025 30)', border: '1px solid oklch(0.9 0.05 30)', borderRadius: 10, fontSize: 13.5, color: 'oklch(0.48 0.14 28)' }}>
          {error}
        </div>
      )}

      {/* Ingredient list */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        {loading ? <SkeletonTable rows={6} cols={2} /> :
         ingredients.length === 0 ? (
           <div className="empty-state">
             <div className="empty-state-icon"><FiPackage size={26} /></div>
             <div className="empty-state-title">No ingredients yet</div>
             <div className="empty-state-subtitle">Add your first ingredient to start building recipes and computing costs.</div>
             <button onClick={openAdd} className="btn-primary" style={{ height: 40, padding: '0 20px', borderRadius: 11, fontSize: 14 }}>Add ingredient</button>
           </div>
         ) : displayed.length === 0 ? (
           <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-ultra-muted)', fontSize: 14 }}>
             No ingredients match your search.
           </div>
         ) : (
           <>
             {displayed.map((ing, i) => {
               const catStyle = getCategoryStyle(ing.category);
               return (
                 <div
                   key={ing.id}
                   className="stagger-item"
                   onClick={() => openDetail(ing)}
                   onMouseEnter={() => setHoveredRow(ing.id)}
                   onMouseLeave={() => setHoveredRow(null)}
                   style={{
                     '--i': i,
                     display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px',
                     borderTop: i > 0 ? '1px solid var(--divider)' : 'none',
                     background: hoveredRow === ing.id ? 'var(--row-hover)' : 'transparent',
                     transition: 'background 120ms ease, transform 0.1s ease', cursor: 'pointer',
                   }}
                 >
                   <div style={{
                     width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                     background: catStyle.bg, color: catStyle.color,
                     display: 'flex', alignItems: 'center', justifyContent: 'center',
                     fontSize: 14, fontWeight: 700, userSelect: 'none',
                   }}>
                     {ing.name.charAt(0).toUpperCase()}
                   </div>

                   <div style={{ flex: 1, minWidth: 0 }}>
                     <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                       {ing.name}
                     </div>
                   </div>

                   <div style={{ flexShrink: 0, textAlign: 'right' }}>
                     {latestPrices[ing.id] ? (
                       <span style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                         <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                           {formatCurrency(latestPrices[ing.id].price)}
                         </span>
                         <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--text-ultra-muted)' }}>/ {ing.unit}</span>
                       </span>
                     ) : (
                       <span style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 600 }}>No price</span>
                     )}
                   </div>

                   <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                     style={{ color: 'var(--text-ultra-muted)', flexShrink: 0, opacity: hoveredRow === ing.id ? 1 : 0.4, transition: 'opacity 100ms ease' }}>
                     <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                   </svg>
                 </div>
               );
             })}

             <div style={{
               padding: '10px 18px', borderTop: '1px solid var(--divider)',
               background: 'var(--table-header-bg)',
               display: 'flex', justifyContent: 'space-between', alignItems: 'center',
             }}>
               <span style={{ fontSize: 12, color: 'var(--text-ultra-muted)' }}>
                 {displayed.length === ingredients.length
                   ? `${ingredients.length} ingredient${ingredients.length !== 1 ? 's' : ''}`
                   : `${displayed.length} of ${ingredients.length} shown`}
               </span>
               <span style={{ fontSize: 12, color: 'var(--text-ultra-muted)' }}>Click any row to manage</span>
             </div>
           </>
         )}
      </div>

      {/* ── Add Ingredient Modal ── */}
      {addIngOpen && (
        <Modal onClose={() => setAddIngOpen(false)}>
          <ModalHeader title="Add Ingredient" onClose={() => setAddIngOpen(false)} />
          <form onSubmit={handleAddIngredient} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
            <datalist id="ing-category-list">
              {['Meat', 'Seafood', 'Vegetable', 'Fruit', 'Grain', 'Dairy', 'Spice', 'Oil', 'Other'].map(c => <option key={c} value={c} />)}
            </datalist>
            {[
              { label: 'Name', key: 'name', type: 'text', placeholder: 'e.g. Chicken Breast' },
              { label: 'Category', key: 'category', type: 'text', placeholder: 'e.g. Meat, Vegetable, Grain' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {label} <span style={{ color: 'oklch(0.60 0.14 28)' }}>*</span>
                </label>
                <input type={type} required value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder} style={inputStyle}
                  list={key === 'category' ? 'ing-category-list' : undefined}
                  onFocus={focusStyle} onBlur={blurStyle}
                />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Unit <span style={{ color: 'oklch(0.60 0.14 28)' }}>*</span>
              </label>
              <Select value={form.unit} onChange={v => setForm(f => ({ ...f, unit: v }))} options={UNITS.map(u => ({ value: u, label: u }))} />
            </div>

            {/* Optional initial price */}
            <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
                Initial Price
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-ultra-muted)', background: 'var(--table-header-bg)', padding: '2px 8px', borderRadius: 999 }}>Optional</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Price (₱)</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-muted)', pointerEvents: 'none' }}>₱</span>
                    <input
                      type="number" min="0.01" step="0.01"
                      placeholder="0.00"
                      value={form.initPrice}
                      onChange={e => setForm(f => ({ ...f, initPrice: e.target.value }))}
                      style={{ ...inputStyle, paddingLeft: 24 }}
                      onFocus={focusStyle} onBlur={blurStyle}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Date</label>
                  <input
                    type="date"
                    value={form.initDate}
                    onChange={e => setForm(f => ({ ...f, initDate: e.target.value }))}
                    style={inputStyle}
                    onFocus={focusStyle} onBlur={blurStyle}
                  />
                </div>
              </div>
            </div>

            {formError && (
              <div style={{ padding: '10px 14px', background: 'oklch(0.97 0.025 30)', border: '1px solid oklch(0.9 0.05 30)', borderRadius: 10, fontSize: 13, color: 'oklch(0.48 0.14 28)' }}>
                {formError}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, paddingTop: 4 }}>
              <button type="button" onClick={() => setAddIngOpen(false)}
                style={{ height: 40, padding: '0 16px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'transparent', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button type="submit" disabled={formLoading} className="btn-primary" style={{ height: 40, padding: '0 20px', borderRadius: 10, fontSize: 14 }}>
                {formLoading ? 'Adding…' : 'Add Ingredient'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Ingredient Detail Modal ── */}
      {detailOpen && detailIng && (
        <Modal onClose={() => setDetailOpen(false)} wide>
          <ModalHeader
            title={detailIng.name}
            subtitle={[detailIng.category, detailIng.unit].filter(Boolean).join(' · ')}
            onClose={() => setDetailOpen(false)}
          />

          <div style={{ overflowY: 'auto', flex: 1 }}>

            {/* Current Price */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--divider)' }}>
              {latestPrices[detailIng.id] ? (
                <div style={{ background: 'var(--table-header-bg)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-ultra-muted)', marginBottom: 5 }}>
                    Current Price
                  </div>
                  <div>
                    <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(latestPrices[detailIng.id].price)}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-ultra-muted)', marginLeft: 6 }}>
                      per {detailIng.unit}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-ultra-muted)', marginTop: 4 }}>
                    {latestPrices[detailIng.id].source?.toUpperCase()} · {fmtDate(latestPrices[detailIng.id].extraction_date)}
                  </div>
                </div>
              ) : (
                <div style={{ background: 'var(--table-header-bg)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border)', color: 'var(--text-ultra-muted)', fontSize: 13.5 }}>
                  No price recorded yet — add one below.
                </div>
              )}
            </div>

            {/* Update Price */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--divider)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-ultra-muted)', marginBottom: 10 }}>
                Update Price
              </div>
              <form onSubmit={handleAddPrice}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 120px' }}>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 5 }}>
                      Price (₱ per {detailIng.unit})
                    </label>
                    <input type="number" step="0.01" min="0.01" required
                      value={addForm.price}
                      onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))}
                      placeholder="0.00"
                      style={inputStyle}
                      onFocus={focusStyle} onBlur={blurStyle}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 5 }}>Date</label>
                    <input type="date" required
                      value={addForm.extraction_date}
                      onChange={e => setAddForm(f => ({ ...f, extraction_date: e.target.value }))}
                      style={{ ...inputStyle, width: 'auto' }}
                      onFocus={focusStyle} onBlur={blurStyle}
                    />
                  </div>
                  <button type="submit" disabled={addLoading} className="btn-primary"
                    style={{ height: 40, padding: '0 16px', borderRadius: 10, fontSize: 13.5, whiteSpace: 'nowrap' }}>
                    {addLoading ? 'Saving…' : 'Save Price'}
                  </button>
                </div>
                {addError && <p style={{ marginTop: 8, fontSize: 12.5, color: 'oklch(0.48 0.14 28)' }}>{addError}</p>}
              </form>
            </div>

            {/* Price History */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--divider)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-ultra-muted)', marginBottom: 12 }}>
                Price History
              </div>
              {pricesLoading ? <SkeletonTable rows={3} cols={3} /> :
               pricesError ? <div style={{ color: 'oklch(0.48 0.14 28)', fontSize: 13.5 }}>{pricesError}</div> :
               prices.length === 0 ? (
                 <p style={{ color: 'var(--text-ultra-muted)', fontSize: 13.5 }}>No history yet.</p>
               ) : (
                 <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                   <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                     <thead>
                       <tr>
                         {['Date', 'Price', 'Source'].map(h => (
                           <th key={h} style={{ padding: '9px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-ultra-muted)', textAlign: 'left', background: 'var(--table-header-bg)' }}>{h}</th>
                         ))}
                       </tr>
                     </thead>
                     <tbody>
                       {prices.map((p, i) => (
                         <tr key={p.id} style={{ borderTop: i > 0 ? '1px solid var(--divider)' : 'none' }}>
                           <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>{fmtDate(p.extraction_date)}</td>
                           <td style={{ padding: '10px 12px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                             {formatCurrency(p.price)}
                           </td>
                           <td style={{ padding: '10px 12px' }}>
                             <span style={{
                               padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                               background: p.source === 'manual' ? 'oklch(0.95 0.02 240)' : p.source === 'dti' ? 'oklch(0.95 0.025 290)' : 'oklch(0.97 0.03 85)',
                               color: p.source === 'manual' ? 'oklch(0.44 0.12 240)' : p.source === 'dti' ? 'oklch(0.44 0.12 290)' : 'oklch(0.52 0.11 75)',
                             }}>
                               {p.source.toUpperCase()}
                             </span>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               )}
            </div>

            {/* Edit Details — expandable */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--divider)' }}>
              <button
                onClick={() => { setShowEditForm(v => !v); setFormError(null); }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  height: 36, padding: '0 14px', borderRadius: 9,
                  background: showEditForm ? 'var(--accent-light)' : 'var(--table-header-bg)',
                  border: `1px solid ${showEditForm ? 'var(--accent)' : 'var(--border)'}`,
                  cursor: 'pointer', fontFamily: 'inherit',
                  color: showEditForm ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 13.5, fontWeight: 600,
                  transition: 'all 120ms ease',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M9 1.5l2.5 2.5-7 7L2 11.5l.5-2.5 7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Edit Details
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none"
                  style={{ marginLeft: 1, transform: showEditForm ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease', flexShrink: 0 }}>
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {showEditForm && (
                <form onSubmit={handleEditSave} style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'Name', key: 'name', type: 'text', placeholder: 'e.g. Chicken Breast' },
                    { label: 'Category', key: 'category', type: 'text', placeholder: 'e.g. Meat, Vegetable' },
                  ].map(({ label, key, type, placeholder }) => (
                    <div key={key}>
                      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>{label}</label>
                      <input type={type} value={form[key]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder} style={inputStyle}
                        list={key === 'category' ? 'ing-category-list' : undefined}
                        onFocus={focusStyle} onBlur={blurStyle}
                      />
                    </div>
                  ))}
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Unit</label>
                    <Select value={form.unit} onChange={v => setForm(f => ({ ...f, unit: v }))} options={UNITS.map(u => ({ value: u, label: u }))} />
                  </div>
                  {formError && (
                    <div style={{ padding: '9px 12px', background: 'oklch(0.97 0.025 30)', border: '1px solid oklch(0.9 0.05 30)', borderRadius: 9, fontSize: 13, color: 'oklch(0.48 0.14 28)' }}>
                      {formError}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => setShowEditForm(false)}
                      style={{ height: 38, padding: '0 14px', borderRadius: 9, border: '1px solid var(--input-border)', background: 'transparent', fontSize: 13.5, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
                      Cancel
                    </button>
                    <button type="submit" disabled={formLoading} className="btn-primary"
                      style={{ height: 38, padding: '0 16px', borderRadius: 9, fontSize: 13.5 }}>
                      {formLoading ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Delete */}
            <div style={{ padding: '16px 24px' }}>
              {confirmDelete ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, color: 'var(--text-secondary)', flex: 1 }}>
                    Delete <strong>{detailIng.name}</strong>? This cannot be undone.
                  </span>
                  <button onClick={handleDelete}
                    style={{ height: 36, padding: '0 16px', borderRadius: 9, background: 'oklch(0.55 0.16 28)', color: '#fff', border: 'none', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Yes, delete
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    style={{ height: 36, padding: '0 14px', borderRadius: 9, border: '1px solid var(--input-border)', background: 'transparent', fontSize: 13.5, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                  style={{ fontSize: 13, color: 'oklch(0.55 0.16 28)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M2 3.5h9M4.5 3.5V2.5h4v1M5 6v4M8 6v4M3 3.5l.5 7h6l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Delete ingredient
                </button>
              )}
            </div>

          </div>
        </Modal>
      )}

    </div>
  );
}
