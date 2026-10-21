import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import api from '../lib/api';
import Select from '../components/Select';
import { PhotoPicker, RecipeThumb } from '../components/RecipePhoto';
import { useToast } from '../components/Toast';
import { formatCurrency } from '../lib/format';
import { INGREDIENT_UNITS as UNITS } from '../lib/constants';
import { getConversionFactor, unitOptionsFor } from '../lib/units';

const fmtQty = (n) => Number(n.toFixed(4)).toString();

// Ingredient table columns. Fixed widths so the header, every row and the total line up.
const ROW_COLS = 'minmax(0, 1fr) 120px 120px 104px';
const COL_ALIGN = ['left', 'left', 'right', 'center'];

const iStyle = {
  width: '100%', boxSizing: 'border-box', height: 38,
  padding: '0 12px', border: '1px solid var(--input-border)', borderRadius: 10,
  fontSize: 14, color: 'var(--text-primary)', background: 'white',
  outline: 'none', fontFamily: 'inherit',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};
const iFocus = (e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-focus)'; };
const iBlur  = (e) => { e.target.style.borderColor = 'var(--input-border)'; e.target.style.boxShadow = 'none'; };

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2.5px solid var(--divider)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite' }} />
    </div>
  );
}

function AddModal({ open, onClose, availableIngredients, recipeId, onAdded }) {
  const [form, setForm] = useState({ ingredient_id: '', quantity: '', unit: 'kg', waste_pct: '0' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setForm({ ingredient_id: '', quantity: '', unit: 'kg', waste_pct: '0' }); setError(''); }
  }, [open]);

  if (!open) return null;

  const selectedIng = availableIngredients.find(ing => String(ing.id) === String(form.ingredient_id));
  const unitChoices = selectedIng ? unitOptionsFor(selectedIng.unit) : UNITS;
  const factor      = selectedIng ? getConversionFactor(form.unit, selectedIng.unit) : null;
  const qtyNum      = parseFloat(form.quantity);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.ingredient_id) { setError('Please select an ingredient.'); return; }
    if (!form.quantity || parseFloat(form.quantity) <= 0) { setError('Enter a valid quantity.'); return; }
    setLoading(true); setError('');
    try {
      await api.post(`/recipes/${recipeId}/ingredients`, {
        ingredient_id: parseInt(form.ingredient_id, 10),
        quantity: parseFloat(form.quantity),
        unit: form.unit,
        waste_pct: parseFloat(form.waste_pct) || 0,
      });
      onAdded(); onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add ingredient.');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 460, padding: '28px 28px 24px', boxShadow: '0 24px 64px rgba(0,0,0,0.14)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Add Ingredient</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 6px', fontSize: 20, lineHeight: 1, borderRadius: 6 }}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Ingredient <span style={{ color: 'oklch(0.60 0.14 28)' }}>*</span>
            </label>
            <Select value={String(form.ingredient_id)} onChange={v => {
                // Default the recipe unit to the unit the ingredient is priced in
                const ing = availableIngredients.find(i => String(i.id) === v);
                setForm(f => ({ ...f, ingredient_id: v, unit: ing?.unit || f.unit }));
              }}
              options={availableIngredients.map(ing => ({ value: String(ing.id), label: ing.name }))}
              placeholder="Choose ingredient…" searchable />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Quantity <span style={{ color: 'oklch(0.60 0.14 28)' }}>*</span>
              </label>
              <input type="number" min="0.0001" step="any" placeholder="e.g. 0.5"
                value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                style={iStyle} onFocus={iFocus} onBlur={iBlur} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Unit <span style={{ color: 'oklch(0.60 0.14 28)' }}>*</span>
              </label>
              <Select value={form.unit} onChange={v => setForm(f => ({ ...f, unit: v }))} options={unitChoices.map(u => ({ value: u, label: u }))} />
            </div>
          </div>
          {selectedIng && (
            <p style={{ margin: '-4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              {selectedIng.name} is priced per {selectedIng.unit}.
              {factor != null && factor !== 1 && qtyNum > 0 && ` ${fmtQty(qtyNum)} ${form.unit} = ${fmtQty(qtyNum * factor)} ${selectedIng.unit}.`}
            </p>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Waste % <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-ultra-muted)' }}>— optional trim/prep loss</span>
            </label>
            <div style={{ position: 'relative', width: 130 }}>
              <input type="number" min="0" max="99" step="0.1" placeholder="0"
                value={form.waste_pct} onChange={e => setForm(f => ({ ...f, waste_pct: e.target.value }))}
                style={{ ...iStyle, paddingRight: 28 }} onFocus={iFocus} onBlur={iBlur} />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-muted)', pointerEvents: 'none' }}>%</span>
            </div>
          </div>
          {error && (
            <div style={{ padding: '10px 14px', background: 'oklch(0.97 0.025 30)', border: '1px solid oklch(0.9 0.05 30)', borderRadius: 10, fontSize: 13, color: 'oklch(0.48 0.14 28)' }}>{error}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, paddingTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ height: 40, padding: '0 16px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'transparent', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              style={{ height: 40, padding: '0 20px', borderRadius: 10, background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'inherit' }}>
              {loading ? 'Adding…' : 'Add Ingredient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditRecipeModal({ recipe, onClose, onSaved, toast }) {
  const [form, setForm]       = useState({ name: recipe.name, description: recipe.description || '', servings: String(recipe.servings), image: recipe.image_data || '' });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const servings = parseInt(form.servings, 10);
    if (!name)              { setError('Name is required.'); return; }
    if (!servings || servings < 1) { setError('Servings must be at least 1.'); return; }
    setSaving(true); setError('');
    try {
      await api.put(`/recipes/${recipe.id}`, { name, description: form.description.trim(), servings, image_data: form.image || null });
      toast.success('Recipe updated');
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update recipe.');
    } finally { setSaving(false); }
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', padding: '28px 28px 24px', boxShadow: '0 24px 64px rgba(0,0,0,0.14)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>Edit Recipe</h3>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Update details for "{recipe.name}"</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 6px', fontSize: 20, lineHeight: 1, borderRadius: 6 }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <PhotoPicker value={form.image} onChange={image => setForm(f => ({ ...f, image }))} />
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Recipe Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Chicken Adobo" required
              style={{ width: '100%', boxSizing: 'border-box', height: 42, padding: '0 12px', border: '1px solid var(--input-border)', borderRadius: 10, fontSize: 14, color: 'var(--text-primary)', background: 'var(--input-bg)', outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional description"
              rows={2}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid var(--input-border)', borderRadius: 10, fontSize: 14, color: 'var(--text-primary)', background: 'var(--input-bg)', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Servings (portions per batch)</label>
            <input type="number" min="1" value={form.servings} onChange={e => setForm(f => ({ ...f, servings: e.target.value }))}
              placeholder="e.g. 4" required
              style={{ width: '100%', boxSizing: 'border-box', height: 42, padding: '0 12px', border: '1px solid var(--input-border)', borderRadius: 10, fontSize: 14, color: 'var(--text-primary)', background: 'var(--input-bg)', outline: 'none', fontFamily: 'inherit' }} />
          </div>
          {error && <p style={{ margin: 0, fontSize: 13, color: 'oklch(0.48 0.14 28)', padding: '10px 14px', background: 'oklch(0.97 0.025 30)', borderRadius: 10, border: '1px solid oklch(0.9 0.05 30)' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={{ height: 40, padding: '0 16px', borderRadius: 11, border: '1px solid var(--input-border)', background: 'var(--card-bg)', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary" style={{ height: 40, padding: '0 20px', borderRadius: 11, fontSize: 14, fontFamily: 'inherit' }}>{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [recipe, setRecipe]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [editingId, setEditingId]     = useState(null);
  const [editForm, setEditForm]       = useState({ quantity: '', unit: '', waste_pct: '0' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError]     = useState('');

  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [removingId, setRemovingId]           = useState(null);

  const [showAdd, setShowAdd]               = useState(false);
  const [allIngredients, setAllIngredients] = useState([]);

  const [latestIngPrices, setLatestIngPrices] = useState({});

  const [recipeEditOpen, setRecipeEditOpen] = useState(false);
  const [duplicating, setDuplicating]       = useState(false);

  const [latestCosting, setLatestCosting]     = useState(null);
  const [savedMenuPrice, setSavedMenuPrice]   = useState(null);
  const [menuPriceEdit, setMenuPriceEdit]     = useState(false);
  const [menuPriceVal, setMenuPriceVal]       = useState('');
  const [menuPriceSaving, setMenuPriceSaving] = useState(false);

  const fetchLatestCosting = useCallback(async () => {
    try {
      const res = await api.get(`/costing/history/${id}`);
      const rows = res.data.data;
      if (rows?.length) {
        setLatestCosting(rows[0]);
        const withPrice = rows.find(r => r.actual_selling_price != null);
        if (withPrice) setSavedMenuPrice(parseFloat(withPrice.actual_selling_price));
      } else { setLatestCosting(null); }
    } catch { /* silent */ }
  }, [id]);

  const fetchIngPrices = useCallback(async (ingredients) => {
    if (!ingredients?.length) return;
    const results = await Promise.allSettled(ingredients.map(ri => api.get(`/prices/latest/${ri.ingredient_id}`)));
    const map = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value.data.data) map[ingredients[i].ingredient_id] = parseFloat(r.value.data.data.price);
    });
    setLatestIngPrices(map);
  }, []);

  const fetchRecipe = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get(`/recipes/${id}`);
      setRecipe(res.data.data);
      fetchIngPrices(res.data.data?.ingredients);
    } catch { setError('Recipe not found.'); }
    finally { setLoading(false); }
  }, [id, fetchIngPrices]);

  const fetchAllIngredients = useCallback(async () => {
    try { const res = await api.get('/ingredients'); setAllIngredients(res.data.data || []); }
    catch { /* ignored */ }
  }, []);

  useEffect(() => {
    fetchRecipe(); fetchAllIngredients(); fetchLatestCosting();
  }, [fetchRecipe, fetchAllIngredients, fetchLatestCosting]);

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const payload = { name: `${recipe.name} (Copy)`, description: recipe.description || '', servings: recipe.servings, category: recipe.category ?? null, image_data: recipe.image_data ?? null };
      const res = await api.post('/recipes', payload);
      const newId = res.data.data?.id;
      if (newId && recipe.ingredients?.length) {
        await Promise.all(recipe.ingredients.map(ing =>
          api.post(`/recipes/${newId}/ingredients`, { ingredient_id: ing.ingredient_id, quantity: ing.quantity, unit: ing.unit })
        ));
      }
      toast.success('Recipe duplicated');
      navigate(`/recipes/${newId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to duplicate recipe.');
    } finally { setDuplicating(false); }
  };

  const saveMenuPrice = async () => {
    const val = parseFloat(menuPriceVal);
    if (!val || val <= 0 || !latestCosting) return;
    setMenuPriceSaving(true);
    try {
      await api.patch(`/costing/${latestCosting.id}/actual-price`, { actual_selling_price: val });
      setSavedMenuPrice(val); setMenuPriceEdit(false);
      fetchLatestCosting(); toast.success('Menu price saved');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save'); }
    finally { setMenuPriceSaving(false); }
  };

  const startEdit = (ri) => {
    setConfirmRemoveId(null); setEditingId(ri.id);
    setEditForm({ quantity: String(ri.quantity), unit: ri.unit, waste_pct: String(ri.waste_pct ?? 0) });
    setEditError('');
  };
  const cancelEdit = () => { setEditingId(null); setEditError(''); };

  const saveEdit = async (ri) => {
    const quantity = parseFloat(editForm.quantity);
    if (!(quantity > 0)) { setEditError('Enter a quantity greater than 0.'); return; }
    setEditLoading(true); setEditError('');
    try {
      await api.put(`/recipes/${id}/ingredients/${ri.id}`, {
        quantity, unit: editForm.unit, waste_pct: parseFloat(editForm.waste_pct) || 0,
      });
      setEditingId(null); fetchRecipe();
      toast.success(`${ri.name} updated`);
    } catch (err) { setEditError(err.response?.data?.message || 'Save failed.'); }
    finally { setEditLoading(false); }
  };

  const handleRemove = async (ri) => {
    setRemovingId(ri.id);
    try {
      await api.delete(`/recipes/${id}/ingredients/${ri.id}`);
      setConfirmRemoveId(null); fetchRecipe();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to remove.'); }
    finally { setRemovingId(null); }
  };

  const availableIngredients = allIngredients.filter(ing => !recipe?.ingredients?.some(ri => ri.ingredient_id === ing.id));

  const estCost = (ri) => {
    const p = latestIngPrices[ri.ingredient_id];
    if (p == null) return null;
    const factor = getConversionFactor(ri.unit, ri.base_unit);
    if (factor == null) return null;
    const qty = ri.waste_pct > 0 ? ri.quantity / (1 - ri.waste_pct / 100) : ri.quantity;
    return qty * factor * p;
  };

  const totalCost = recipe?.ingredients?.reduce((sum, ri) => { const c = estCost(ri); return c != null ? sum + c : sum; }, 0) ?? 0;
  const hasAnyPrice = recipe?.ingredients?.some(ri => latestIngPrices[ri.ingredient_id] != null);

  if (loading) return <Spinner />;

  if (error) return (
    <div>
      <Link to="/recipes" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 20 }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Back to Recipes
      </Link>
      <p style={{ fontSize: 14, color: 'var(--danger, #dc2626)' }}>{error}</p>
    </div>
  );

  const statCard = (label, valueEl) => (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--divider)' }}>
      <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 6px' }}>{label}</p>
      {valueEl}
    </div>
  );

  return (
    <>
      <AddModal open={showAdd} onClose={() => setShowAdd(false)} availableIngredients={availableIngredients} recipeId={id} onAdded={fetchRecipe} />
      {recipeEditOpen && <EditRecipeModal recipe={recipe} onClose={() => setRecipeEditOpen(false)} onSaved={fetchRecipe} toast={toast} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>

        {/* Back link */}
        <Link to="/recipes" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', width: 'fit-content' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Back to Recipes
        </Link>

        {/* Full-width recipe header */}
        <div style={{ background: '#fff', border: '1px solid var(--card-border)', borderRadius: 16, padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
          <RecipeThumb src={recipe.image_data} name={recipe.name} size={72} radius={14} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>{recipe.name}</h1>
            {recipe.description && (
              <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '6px 0 0', lineHeight: 1.5 }}>{recipe.description}</p>
            )}
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 999, background: '#f0fdf4', color: '#16a34a', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM2.5 14c0-2.761 2.462-4.5 5.5-4.5s5.5 1.739 5.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}
          </span>
        </div>

        {/* Two-column body */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>

          {/* ── LEFT: Pricing + actions ── */}
          <div style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Pricing panel */}
          <div style={{ background: '#fff', border: '1px solid var(--card-border)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Pricing</span>
              <Link to={`/costing?recipe=${id}`} style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
                Recompute →
              </Link>
            </div>

            {latestCosting ? (
              <>
                {statCard('Portion Cost',
                  <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(latestCosting.portion_cost)}
                  </p>
                )}
                {statCard('Recommended Price',
                  <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(latestCosting.recommended_price)}
                  </p>
                )}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--divider)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>Menu Price</p>
                    {!menuPriceEdit && (
                      <button onClick={() => { setMenuPriceVal(String(savedMenuPrice ?? '')); setMenuPriceEdit(true); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px', borderRadius: 5, display: 'flex', alignItems: 'center' }}
                        title="Set menu price">
                        <svg width="12" height="12" viewBox="0 0 13 13" fill="none"><path d="M7.5 2.5l3 3-7 7H.5v-3l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
                      </button>
                    )}
                  </div>
                  {menuPriceEdit ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-muted)', pointerEvents: 'none' }}>₱</span>
                        <input autoFocus type="number" min="0.01" step="0.01" value={menuPriceVal}
                          onChange={e => setMenuPriceVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveMenuPrice(); if (e.key === 'Escape') setMenuPriceEdit(false); }}
                          style={{ width: '100%', height: 36, paddingLeft: 22, borderRadius: 9, border: '1px solid var(--accent)', fontSize: 16, fontWeight: 700, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                      </div>
                      <button onClick={saveMenuPrice} disabled={menuPriceSaving}
                        style={{ height: 36, padding: '0 12px', borderRadius: 9, background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                        {menuPriceSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={() => setMenuPriceEdit(false)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)', fontFamily: 'inherit', lineHeight: 1 }}>✕</button>
                    </div>
                  ) : (
                    <p style={{ fontSize: 28, fontWeight: 800, color: savedMenuPrice ? 'var(--text-primary)' : '#C8BEAF', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                      {savedMenuPrice ? formatCurrency(savedMenuPrice) : '—'}
                    </p>
                  )}
                </div>
                <div style={{ padding: '12px 20px' }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{latestCosting.pricing_setting_label}</span> profile
                    <br />
                    {new Date(latestCosting.computed_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </>
            ) : (
              <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--table-header-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                  </svg>
                </div>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 4px' }}>No cost computed yet</p>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>Run a computation to see pricing here.</p>
                <Link to={`/costing?recipe=${id}`}
                  style={{ display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 16px', borderRadius: 10, background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                  Go to Costing →
                </Link>
              </div>
            )}
          </div>

          {/* ── Actions card (below pricing, same left column) ── */}
          <div style={{ background: '#fff', border: '1px solid var(--card-border)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--divider)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Recipe Actions</span>
            </div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => setRecipeEditOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', borderRadius: 11, border: '1px solid var(--input-border)', background: 'var(--card-bg)', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--table-header-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--card-bg)'}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M9 2.5l1.5 1.5L4 10.5H2.5V9L9 2.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                </span>
                Edit Recipe
              </button>
              <button onClick={handleDuplicate} disabled={duplicating}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', borderRadius: 11, border: '1px solid var(--input-border)', background: 'var(--card-bg)', cursor: duplicating ? 'wait' : 'pointer', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'inherit', textAlign: 'left', opacity: duplicating ? 0.65 : 1, transition: 'background 0.12s' }}
                onMouseEnter={e => { if (!duplicating) e.currentTarget.style.background = 'var(--table-header-bg)'; }}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--card-bg)'}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1 9V2a1 1 0 011-1h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                </span>
                {duplicating ? 'Duplicating…' : 'Duplicate Recipe'}
              </button>
            </div>
          </div>
          </div>

          {/* ── RIGHT: Ingredients panel ── */}
          <div style={{ flex: '999 1 440px', minWidth: 0, background: '#fff', border: '1px solid var(--card-border)', borderRadius: 16, overflow: 'hidden' }}>

            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: recipe.ingredients?.length ? '1px solid var(--divider)' : 'none' }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Ingredients</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  {recipe.ingredients?.length ?? 0} {(recipe.ingredients?.length ?? 0) === 1 ? 'item' : 'items'}
                </p>
              </div>
              {availableIngredients.length > 0 && (
                <button onClick={() => setShowAdd(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 10, background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
                  Add Ingredient
                </button>
              )}
            </div>

            {/* Column labels */}
            {!!recipe.ingredients?.length && (
              <div style={{ display: 'grid', gridTemplateColumns: ROW_COLS, columnGap: 16, padding: '8px 24px', background: 'var(--table-header-bg)', borderBottom: '1px solid var(--divider)' }}>
                {['Ingredient', 'Quantity', 'Est. Cost', 'Actions'].map((h, i) => (
                  <span key={i} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: COL_ALIGN[i] }}>{h}</span>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!recipe.ingredients?.length && (
              <div style={{ textAlign: 'center', padding: '50px 24px' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--table-header-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                    <rect x="9" y="3" width="6" height="4" rx="1"/>
                    <path d="M9 12h6M9 16h4"/>
                  </svg>
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 4px' }}>No ingredients yet</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Add the first ingredient to start building this recipe.</p>
              </div>
            )}

            {/* Ingredient rows */}
            {recipe.ingredients?.map((ri, i) => {
              const isEditing    = editingId === ri.id;
              const isConfirming = confirmRemoveId === ri.id;
              const isRemoving   = removingId === ri.id;
              const cost         = estCost(ri);
              const isLast       = i === recipe.ingredients.length - 1;
              const borderB      = isLast && !hasAnyPrice ? 'none' : '1px solid var(--divider)';

              return (
                <div key={ri.id} style={{ borderBottom: borderB }}>

                  {/* Normal row */}
                  {!isEditing && !isConfirming && (
                    <div style={{ display: 'grid', gridTemplateColumns: ROW_COLS, columnGap: 16, alignItems: 'center', padding: '13px 24px', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--table-header-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      {/* Name + waste */}
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{ri.name}</span>
                        {ri.waste_pct > 0 && (
                          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: 'oklch(0.975 0.04 85)', color: 'oklch(0.50 0.12 85)' }}>
                            {ri.waste_pct}% waste
                          </span>
                        )}
                      </div>
                      {/* Qty + unit */}
                      <div onClick={() => startEdit(ri)} title="Click to edit quantity"
                        style={{ fontSize: 13.5, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {ri.quantity}{' '}
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: '#f1f0ef', color: 'var(--text-muted)' }}>{ri.unit}</span>
                        {(() => {
                          const f = getConversionFactor(ri.unit, ri.base_unit);
                          if (f == null) return <div style={{ fontSize: 11, color: 'oklch(0.55 0.15 50)', marginTop: 2 }}>Can't convert to {ri.base_unit}</div>;
                          if (f === 1) return null;
                          return <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>= {fmtQty(ri.quantity * f)} {ri.base_unit}</div>;
                        })()}
                      </div>
                      {/* Cost */}
                      <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: cost != null ? 'var(--text-primary)' : 'var(--text-ultra-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {cost != null ? formatCurrency(cost) : '—'}
                      </div>
                      {/* Actions */}
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                        <button onClick={() => startEdit(ri)} title={`Edit ${ri.name} quantity`}
                          style={{ height: 30, padding: '0 10px', borderRadius: 8, border: '1px solid var(--input-border)', background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#f1f0ef'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                          <svg width="12" height="12" viewBox="0 0 13 13" fill="none"><path d="M7.5 2.5l3 3-7 7H.5v-3l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
                          Edit
                        </button>
                        <button onClick={() => { setEditingId(null); setConfirmRemoveId(ri.id); }} title={`Remove ${ri.name}`} aria-label={`Remove ${ri.name}`} disabled={isRemoving}
                          style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'oklch(0.97 0.025 30)'; e.currentTarget.style.color = 'oklch(0.55 0.16 28)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 5h10M6 5V3.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V5m1 0v7.5a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 4.5 12.5V5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Edit row */}
                  {isEditing && (
                    <div style={{ padding: '16px 24px', background: 'oklch(0.987 0.008 150)' }}>
                      <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Editing: {ri.name}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 12 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Quantity</label>
                          <input type="number" min="0.0001" step="any" autoFocus value={editForm.quantity}
                            onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(ri); if (e.key === 'Escape') cancelEdit(); }}
                            style={{ ...iStyle, height: 36 }} onFocus={iFocus} onBlur={iBlur} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Unit</label>
                          <Select value={editForm.unit} onChange={v => setEditForm(f => ({ ...f, unit: v }))} options={(ri.base_unit ? unitOptionsFor(ri.base_unit) : UNITS).map(u => ({ value: u, label: u }))} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Waste %</label>
                          <div style={{ position: 'relative' }}>
                            <input type="number" min="0" max="99" step="0.1" value={editForm.waste_pct}
                              onChange={e => setEditForm(f => ({ ...f, waste_pct: e.target.value }))}
                              style={{ ...iStyle, height: 36, paddingRight: 26 }} onFocus={iFocus} onBlur={iBlur} />
                            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-muted)', pointerEvents: 'none' }}>%</span>
                          </div>
                        </div>
                      </div>
                      {(() => {
                        const preview = estCost({ ...ri, quantity: parseFloat(editForm.quantity), unit: editForm.unit, waste_pct: parseFloat(editForm.waste_pct) || 0 });
                        const f = getConversionFactor(editForm.unit, ri.base_unit);
                        const q = parseFloat(editForm.quantity);
                        if (!(q > 0)) return null;
                        return (
                          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                            {f != null && f !== 1 && <>{fmtQty(q)} {editForm.unit} = {fmtQty(q * f)} {ri.base_unit}. </>}
                            {preview != null && <>New est. cost: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(preview)}</strong>{cost != null && <> (was {formatCurrency(cost)})</>}</>}
                          </p>
                        );
                      })()}
                      {editError && <p style={{ fontSize: 12, color: 'oklch(0.48 0.14 28)', margin: '0 0 10px' }}>{editError}</p>}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => saveEdit(ri)} disabled={editLoading}
                          style={{ height: 34, padding: '0 18px', borderRadius: 9, background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: editLoading ? 'not-allowed' : 'pointer', opacity: editLoading ? 0.7 : 1, fontFamily: 'inherit' }}>
                          {editLoading ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={cancelEdit}
                          style={{ height: 34, padding: '0 14px', borderRadius: 9, background: 'transparent', border: '1px solid var(--input-border)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Confirm remove */}
                  {isConfirming && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 24px', background: 'oklch(0.985 0.012 30)' }}>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: 'oklch(0.45 0.14 28)', margin: 0 }}>
                        Remove <strong>{ri.name}</strong> from this recipe?
                      </p>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button onClick={() => handleRemove(ri)} disabled={isRemoving}
                          style={{ height: 32, padding: '0 14px', borderRadius: 8, background: 'oklch(0.55 0.16 28)', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', opacity: isRemoving ? 0.7 : 1 }}>
                          {isRemoving ? '…' : 'Remove'}
                        </button>
                        <button onClick={() => setConfirmRemoveId(null)}
                          style={{ height: 32, padding: '0 12px', borderRadius: 8, background: 'transparent', border: '1px solid var(--input-border)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Total row */}
            {hasAnyPrice && (
              <div style={{ display: 'grid', gridTemplateColumns: ROW_COLS, columnGap: 16, alignItems: 'center', padding: '13px 24px', background: '#FDFBF8', borderTop: '2px solid #F3EDE4' }}>
                <span style={{ gridColumn: '1 / 3', fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Ingredient Cost
                </span>
                <span style={{ textAlign: 'right', fontSize: 17, fontWeight: 800, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {formatCurrency(totalCost)}
                </span>
                <span />
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
