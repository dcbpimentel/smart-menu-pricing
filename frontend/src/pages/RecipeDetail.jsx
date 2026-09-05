import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import api from '../lib/api';
import Select from '../components/Select';
import { useToast } from '../components/Toast';

const UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'pack', 'bundle', 'tbsp', 'tsp', 'cup'];

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div
        className="w-7 h-7 rounded-full border-2 border-gray-200 animate-spin"
        style={{ borderTopColor: 'var(--accent)' }}
      />
    </div>
  );
}

const T_RD = {
  accent: '#4C5D3E', accentLight: 'oklch(0.955 0.021 138)',
  inputBorder: '#E7DFD4', inputBg: '#FDFBF8',
  focusShadow: '0 0 0 4px oklch(0.945 0.028 138)',
  cardBorder: '1px solid #EFE8DE', rowDivider: '1px solid #F3EDE4',
  textPrimary: '#24201C', textSecond: '#6B625A', textMuted: '#8C837B',
};

function PrepareModal({ recipe, onClose, onDone }) {
  const toast = useToast();
  const [batches, setBatches] = useState('1');
  const [loading, setLoading] = useState(false);

  const effQty = (ri) => {
    const q = parseFloat(ri.quantity);
    const w = parseFloat(ri.waste_pct) || 0;
    return w > 0 ? q / (1 - w / 100) : q;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const b = Math.max(1, parseInt(batches, 10) || 1);
    setLoading(true);
    try {
      const res = await api.post('/inventory/use-recipe', { recipe_id: recipe.id, batches: b });
      const { deductions } = res.data.data;
      toast.success(`Stock deducted for ${b} batch${b !== 1 ? 'es' : ''} of ${recipe.name}`);
      onDone();
      onClose();
      // Show detail if any ingredient hit 0
      const zeroed = deductions.filter(d => d.deducted > 0);
      if (zeroed.length > 0) {
        // nothing extra, toast is enough
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update stock');
    } finally {
      setLoading(false);
    }
  };

  const b = Math.max(1, parseInt(batches, 10) || 1);
  const inputStyle = { height: 40, borderRadius: 10, border: `1px solid ${T_RD.inputBorder}`, background: T_RD.inputBg, fontSize: 14, color: T_RD.textPrimary, padding: '0 12px', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(10,8,6,0.50)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)' }} onClick={onClose}>
      <div style={{ background: '#FFFFFF', borderRadius: 20, border: T_RD.cardBorder, width: '100%', maxWidth: 440, boxShadow: '0 32px 80px rgba(36,32,28,0.22)' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '18px 24px', borderBottom: T_RD.rowDivider }}>
          <div>
            <h3 style={{ fontWeight: 600, fontSize: 15.5, color: T_RD.textPrimary, margin: 0 }}>Mark as Prepared</h3>
            <p style={{ fontSize: 12.5, color: T_RD.textMuted, margin: '3px 0 0' }}>{recipe.name}</p>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #EFE8DE', background: '#FDFBF8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T_RD.textMuted }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: T_RD.textSecond, display: 'block', marginBottom: 6 }}>
              Number of batches to prepare
            </label>
            <input
              type="number" min="1" max="999" autoFocus
              value={batches} onChange={e => setBatches(e.target.value)}
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = T_RD.accent; e.target.style.boxShadow = T_RD.focusShadow; e.target.style.background = '#FFF'; }}
              onBlur={e => { e.target.style.borderColor = T_RD.inputBorder; e.target.style.boxShadow = 'none'; e.target.style.background = T_RD.inputBg; }}
            />
            <p style={{ fontSize: 12, color: T_RD.textMuted, margin: '6px 0 0' }}>1 batch = {recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}</p>
          </div>

          {/* Deductions preview */}
          {recipe.ingredients?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T_RD.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>
                Stock deductions preview
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                {recipe.ingredients.map(ri => {
                  const total = (effQty(ri) * b).toFixed(3).replace(/\.?0+$/, '');
                  return (
                    <div key={ri.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, background: '#FDFBF8', border: T_RD.rowDivider }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: T_RD.textPrimary }}>{ri.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#991B1B', fontVariantNumeric: 'tabular-nums' }}>
                        -{total} {ri.unit}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ height: 38, padding: '0 16px', borderRadius: 10, border: T_RD.cardBorder, background: '#FDFBF8', fontSize: 13, fontWeight: 600, color: T_RD.textSecond, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button type="submit" disabled={loading} style={{ height: 38, padding: '0 20px', borderRadius: 10, background: T_RD.accent, color: '#FFFFFF', fontSize: 13, fontWeight: 700, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Updating…' : `Prepare ${b > 1 ? `${b} batches` : '1 batch'}`}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default function RecipeDetail() {
  const { id } = useParams();
  const toast = useToast();

  const [recipe, setRecipe]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  // Inline edit state
  const [editingId, setEditingId]   = useState(null); // ri.id
  const [editForm, setEditForm]     = useState({ quantity: '', unit: '', waste_pct: '0' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError]   = useState('');

  // Remove state
  const [removingId, setRemovingId] = useState(null);

  // Prepare modal
  const [showPrepare, setShowPrepare] = useState(false);

  // Add ingredient form
  const [showAdd, setShowAdd]         = useState(false);
  const [allIngredients, setAllIngredients] = useState([]);
  const [addForm, setAddForm]         = useState({ ingredient_id: '', quantity: '', unit: 'kg', waste_pct: '0' });
  const [addLoading, setAddLoading]   = useState(false);
  const [addError, setAddError]       = useState('');

  const fetchRecipe = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/recipes/${id}`);
      setRecipe(res.data.data);
    } catch {
      setError('Recipe not found.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchAllIngredients = useCallback(async () => {
    try {
      const res = await api.get('/ingredients');
      setAllIngredients(res.data.data || []);
    } catch { /* ignored */ }
  }, []);

  useEffect(() => {
    fetchRecipe();
    fetchAllIngredients();
  }, [fetchRecipe, fetchAllIngredients]);

  // ── Inline edit ──────────────────────────────────────────────────────────────

  const startEdit = (ri) => {
    setEditingId(ri.id);
    setEditForm({ quantity: String(ri.quantity), unit: ri.unit, waste_pct: String(ri.waste_pct ?? 0) });
    setEditError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError('');
  };

  const saveEdit = async (ri) => {
    setEditLoading(true);
    setEditError('');
    try {
      await api.put(`/recipes/${id}/ingredients/${ri.id}`, {
        quantity: parseFloat(editForm.quantity),
        unit: editForm.unit,
        waste_pct: parseFloat(editForm.waste_pct) || 0,
      });
      setEditingId(null);
      fetchRecipe();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Save failed.');
    } finally {
      setEditLoading(false);
    }
  };

  // ── Remove ───────────────────────────────────────────────────────────────────

  const handleRemove = async (ri) => {
    if (!window.confirm(`Remove "${ri.name}" from this recipe?`)) return;
    setRemovingId(ri.id);
    try {
      await api.delete(`/recipes/${id}/ingredients/${ri.id}`);
      fetchRecipe();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove.');
    } finally {
      setRemovingId(null);
    }
  };

  // ── Add ingredient ───────────────────────────────────────────────────────────

  const availableIngredients = allIngredients.filter(
    ing => !recipe?.ingredients?.some(ri => ri.ingredient_id === ing.id)
  );

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError('');
    try {
      await api.post(`/recipes/${id}/ingredients`, {
        ingredient_id: parseInt(addForm.ingredient_id, 10),
        quantity: parseFloat(addForm.quantity),
        unit: addForm.unit,
        waste_pct: parseFloat(addForm.waste_pct) || 0,
      });
      setAddForm({ ingredient_id: '', quantity: '', unit: 'kg', waste_pct: '0' });
      setShowAdd(false);
      fetchRecipe();
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to add ingredient.');
    } finally {
      setAddLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) return <Spinner />;

  if (error) {
    return (
      <div className="max-w-3xl">
        <Link
          to="/recipes"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Recipes
        </Link>
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">

      {/* Back link */}
      <Link
        to="/recipes"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back to Recipes
      </Link>

      {/* Recipe header */}
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{recipe.name}</h2>
            {recipe.description && (
              <p className="text-sm text-gray-500 mt-1">{recipe.description}</p>
            )}
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            {recipe.ingredients?.length > 0 && (
              <button
                onClick={() => setShowPrepare(true)}
                style={{ height: 36, padding: '0 14px', borderRadius: 10, background: '#4C5D3E', color: '#FFFFFF', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Mark as Prepared
              </button>
            )}
            <span
              className="flex-shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full"
              style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}
            >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}
          </span>
          </div>
        </div>
      </div>

      {/* Ingredients section */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">Ingredients</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {recipe.ingredients?.length ?? 0} {(recipe.ingredients?.length ?? 0) === 1 ? 'ingredient' : 'ingredients'} in this recipe
            </p>
          </div>
          {!showAdd && availableIngredients.length > 0 && (
            <button
              onClick={() => { setShowAdd(true); setAddError(''); }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Add Ingredient
            </button>
          )}
        </div>

        {/* Ingredients table */}
        {!recipe.ingredients?.length ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            No ingredients yet. Add the first one below.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/60">
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Name</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Quantity</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Unit</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide" title="Trim/spoilage loss during preparation. E.g. 10% means 10% of the ingredient is discarded, so the system purchases 10% more to compensate.">Waste % ⓘ</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recipe.ingredients.map((ri, i) => {
                const isEditing = editingId === ri.id;
                const isRemoving = removingId === ri.id;

                return (
                  <tr
                    key={ri.id}
                    className={[
                      i < recipe.ingredients.length - 1 ? 'border-b border-gray-50' : '',
                      isEditing ? 'bg-emerald-50/30' : 'hover:bg-gray-50/60',
                      'transition-colors',
                    ].join(' ')}
                  >
                    {/* Name */}
                    <td className="px-5 py-3 font-medium text-gray-800">{ri.name}</td>

                    {/* Quantity */}
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <input
                          type="number"
                          min="0.0001"
                          step="any"
                          autoFocus
                          className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-emerald-400"
                          value={editForm.quantity}
                          onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))}
                        />
                      ) : (
                        <span className="font-mono text-gray-600">{ri.quantity}</span>
                      )}
                    </td>

                    {/* Unit */}
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <Select
                          value={editForm.unit}
                          onChange={v => setEditForm(f => ({ ...f, unit: v }))}
                          options={UNITS.map(u => ({ value: u, label: u }))}
                          style={{ minWidth: '100px' }}
                        />
                      ) : (
                        <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{ri.unit}</span>
                      )}
                    </td>

                    {/* Waste % */}
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="number"
                            min="0"
                            max="99"
                            step="0.1"
                            className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-emerald-400"
                            value={editForm.waste_pct}
                            onChange={e => setEditForm(f => ({ ...f, waste_pct: e.target.value }))}
                          />
                          <span className="text-xs text-gray-400">%</span>
                        </div>
                      ) : ri.waste_pct > 0 ? (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
                          background: 'oklch(0.975 0.04 85)', color: 'oklch(0.50 0.12 85)',
                        }}>
                          {ri.waste_pct}%
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {isEditing ? (
                        <span className="inline-flex items-center gap-2">
                          <button
                            onClick={() => saveEdit(ri)}
                            disabled={editLoading}
                            className="text-xs font-semibold disabled:opacity-50"
                            style={{ color: 'var(--accent)' }}
                          >
                            {editLoading ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-xs font-medium text-gray-400 hover:text-gray-600"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-3">
                          <button
                            onClick={() => startEdit(ri)}
                            className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleRemove(ri)}
                            disabled={isRemoving}
                            className="text-xs font-medium text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                          >
                            {isRemoving ? '…' : 'Remove'}
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Inline edit error */}
        {editError && (
          <p className="px-5 py-2 text-xs text-red-500 border-t border-red-50 bg-red-50">{editError}</p>
        )}

        {/* Prepare modal */}
        {showPrepare && recipe && (
          <PrepareModal recipe={recipe} onClose={() => setShowPrepare(false)} onDone={fetchRecipe} />
        )}

        {/* Add ingredient form */}
        {showAdd && (
          <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Add Ingredient</p>
            {availableIngredients.length === 0 ? (
              <p className="text-xs text-gray-400">All ingredients are already in this recipe.</p>
            ) : (
              <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Ingredient *</label>
                  <Select
                    value={String(addForm.ingredient_id)}
                    onChange={v => setAddForm(f => ({ ...f, ingredient_id: v }))}
                    options={availableIngredients.map(ing => ({ value: String(ing.id), label: ing.name }))}
                    placeholder="Select ingredient…"
                  />
                </div>
                <div className="w-28">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="0.0001"
                    step="any"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-emerald-400"
                    placeholder="0.5"
                    value={addForm.quantity}
                    onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value }))}
                    required
                  />
                </div>
                <div style={{ minWidth: '110px' }}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Unit *</label>
                  <Select
                    value={addForm.unit}
                    onChange={v => setAddForm(f => ({ ...f, unit: v }))}
                    options={UNITS.map(u => ({ value: u, label: u }))}
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-medium text-gray-500 mb-1" title="% lost during prep (trimming, peeling, bones). Leave 0 if no waste.">Waste % ⓘ</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      step="0.1"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-emerald-400"
                      placeholder="0"
                      value={addForm.waste_pct}
                      onChange={e => setAddForm(f => ({ ...f, waste_pct: e.target.value }))}
                    />
                    <span className="text-xs text-gray-400 flex-shrink-0">%</span>
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="submit"
                    disabled={addLoading}
                    className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60 whitespace-nowrap hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    {addLoading ? 'Adding…' : '+ Add'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAdd(false); setAddError(''); }}
                    className="px-3 py-2 text-sm text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
            {addError && <p className="text-red-500 text-xs mt-2">{addError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
