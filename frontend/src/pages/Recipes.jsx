import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { FiBook } from 'react-icons/fi';
import api from '../lib/api';
import { SkeletonCards } from '../components/Skeleton';
import { useToast } from '../components/Toast';

function Modal({ onClose, children }) {
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
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col modal-content"
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
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 12, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

function computeFlaggedRecipes(enrichedList) {
  try {
    const flagged = JSON.parse(localStorage.getItem('smp_price_flagged') || '{}');
    const dismissed = JSON.parse(localStorage.getItem('smp_price_dismissed') || '{}');
    const ids = new Set();
    for (const recipe of enrichedList) {
      const dismissedAt = dismissed[String(recipe.id)] || 0;
      const affected = (recipe.ingredientIds || []).some(ingId => {
        const flaggedAt = flagged[String(ingId)];
        return flaggedAt && flaggedAt > dismissedAt;
      });
      if (affected) ids.add(recipe.id);
    }
    return ids;
  } catch { return new Set(); }
}

export default function Recipes() {
  const toast = useToast();
  const navigate = useNavigate();

  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', servings: '', image: '', category: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [catFilter, setCatFilter] = useState('');

  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [flaggedRecipeIds, setFlaggedRecipeIds] = useState(new Set());

  const dismissFlag = (recipeId) => {
    try {
      const dismissed = JSON.parse(localStorage.getItem('smp_price_dismissed') || '{}');
      dismissed[String(recipeId)] = Date.now();
      localStorage.setItem('smp_price_dismissed', JSON.stringify(dismissed));
    } catch {}
    setFlaggedRecipeIds(prev => { const next = new Set(prev); next.delete(recipeId); return next; });
  };

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const listRes = await api.get('/recipes');
      const list = listRes.data.data || [];

      // Fetch each recipe detail in parallel to get ingredient count and IDs
      const details = await Promise.all(list.map(r => api.get(`/recipes/${r.id}`)));
      const enriched = list.map((r, i) => ({
        ...r,
        ingredientCount: details[i].data.data?.ingredients?.length ?? 0,
        ingredientIds: (details[i].data.data?.ingredients || []).map(ing => ing.ingredient_id),
      }));
      setRecipes(enriched);
      setFlaggedRecipeIds(computeFlaggedRecipes(enriched));
    } catch {
      setError('Failed to load recipes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecipes(); }, [fetchRecipes]);

  // Close modal on Escape key
  useEffect(() => {
    if (!modalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen]);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ name: '', description: '', servings: '', image: '', category: '' });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (recipe) => {
    setEditTarget(recipe);
    setForm({ name: recipe.name, description: recipe.description || '', servings: String(recipe.servings), image: recipe.image_data || '', category: recipe.category || '' });
    setFormError('');
    setModalOpen(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm(f => ({ ...f, image: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        servings: parseInt(form.servings, 10),
        category: form.category.trim() || null,
        image_data: form.image || null,
      };
      if (editTarget) {
        await api.put(`/recipes/${editTarget.id}`, payload);
      } else {
        await api.post('/recipes', payload);
      }
      setModalOpen(false);
      toast.success(editTarget ? 'Recipe updated' : 'Recipe created');
      fetchRecipes();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (recipe) => {
    try {
      await api.delete(`/recipes/${recipe.id}`);
      toast.success('Recipe deleted');
      fetchRecipes();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete.');
    }
  };

  const inputStyle = { height: 44, padding: '0 12px', borderRadius: 12, border: '1px solid var(--input-border)', background: 'var(--input-bg)', fontSize: 14, color: 'var(--text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box' };

  const allCategories = [...new Set(recipes.map(r => r.category).filter(Boolean))].sort();
  const displayedRecipes = catFilter ? recipes.filter(r => r.category === catFilter) : recipes;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Category filter pills */}
      {!loading && allCategories.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {['', ...allCategories].map(cat => (
            <button key={cat || '__all'} onClick={() => setCatFilter(catFilter === cat && cat !== '' ? '' : cat)}
              style={{
                padding: '6px 14px', borderRadius: 999, border: '1px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 140ms ease',
                background: catFilter === cat ? 'var(--accent-light)' : 'var(--card-bg)',
                borderColor: catFilter === cat ? 'var(--accent)' : 'var(--input-border)',
                color: catFilter === cat ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >{cat || 'All'}</button>
          ))}
          {catFilter && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {displayedRecipes.length} of {recipes.length} recipes
            </span>
          )}
        </div>
      )}
      {loading ? (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(285px, 1fr))' }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 280, borderRadius: 22, background: 'var(--card-bg)', border: '1px solid var(--border)' }} className="skeleton-shimmer" />)}
        </div>
      ) : error ? (
        <p style={{ color: 'oklch(0.55 0.16 28)', fontSize: 14 }}>{error}</p>
      ) : (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(285px, 1fr))' }}>
          {displayedRecipes.map((recipe, idx) => {
            const isFlagged = flaggedRecipeIds.has(recipe.id);
            return (
            <div key={recipe.id} className="card-hover card-spring"
              style={{ '--i': idx, background: 'var(--card-bg)', border: isFlagged ? '1.5px solid oklch(0.78 0.16 72)' : '1px solid var(--border)', borderRadius: 22, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'border-color 300ms ease, box-shadow 0.22s ease, transform 0.22s cubic-bezier(0.22,1,0.36,1)', cursor: 'pointer' }}
              onMouseEnter={() => { if (isFlagged) dismissFlag(recipe.id); }}
              onClick={() => navigate(`/recipes/${recipe.id}`)}
            >
              {/* Dish photo */}
              <div style={{ height: 120, borderBottom: '1px solid var(--divider)', overflow: 'hidden', position: 'relative', background: 'repeating-linear-gradient(135deg, #F6F1E9 0 10px, #FBF7F1 10px 20px)' }}>
                {isFlagged && (
                  <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 1, width: 22, height: 22, borderRadius: 99, background: 'oklch(0.97 0.06 72)', border: '1px solid oklch(0.85 0.10 72)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'oklch(0.52 0.14 60)' }}>
                    <svg width="11" height="11" viewBox="0 0 10 10" fill="none"><path d="M5 1.5v3.5M5 7.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/></svg>
                  </div>
                )}
                {recipe.image_data ? (
                  <img src={recipe.image_data} alt={recipe.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--text-ultra-muted)', opacity: 0.5 }}>
                      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.4"/>
                      <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span style={{ fontSize: 10, color: 'var(--text-ultra-muted)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>NO PHOTO</span>
                  </div>
                )}
              </div>
              {/* Body */}
              <div style={{ padding: '15px 18px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)', lineHeight: 1.25 }}>{recipe.name}</h3>
                  <span style={{ padding: '3px 9px', borderRadius: 999, background: '#F6F1E9', fontSize: 11.5, fontWeight: 600, color: '#6B625A', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}
                  </span>
                </div>
                {recipe.description && (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{recipe.description}</p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-ultra-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="2" width="9" height="8" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M4 5.5h4M4 8h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    {recipe.ingredientCount} ingredient{recipe.ingredientCount !== 1 ? 's' : ''}
                  </span>
                  {recipe.category && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: 'var(--accent-light)', color: 'var(--accent)' }}>
                      {recipe.category}
                    </span>
                  )}
                </div>
                {/* Actions */}
                <div style={{ marginTop: 'auto', paddingTop: 11, borderTop: '1px solid var(--divider)', display: 'flex', gap: 7 }}
                  onClick={e => e.stopPropagation()}>
                  <Link to={`/recipes/${recipe.id}`} className="btn-primary" style={{ flex: 1, height: 38, borderRadius: 11, fontSize: 13.5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none' }}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <rect x="1.5" y="2" width="10" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M4 5.5h5M4 8h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    Manage Recipe
                  </Link>
                  {deleteConfirmId === recipe.id ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 4px' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Delete?</span>
                      <button onClick={() => { handleDelete(recipe); setDeleteConfirmId(null); }} style={{ fontSize: 12, color: 'oklch(0.55 0.16 28)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontFamily: 'inherit' }}>Yes</button>
                      <button onClick={() => setDeleteConfirmId(null)} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontFamily: 'inherit' }}>No</button>
                    </span>
                  ) : (
                    <button onClick={() => setDeleteConfirmId(recipe.id)} title="Delete recipe" style={{ width: 38, height: 38, borderRadius: 11, border: '1px solid #F0DFDB', background: 'var(--card-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'oklch(0.60 0.14 28)', flexShrink: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3.5h9M4.5 3.5V2.5h4v1M5 6v4M8 6v4M3 3.5l.5 7h6l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
          })}

          {/* Add Recipe ghost card — only shown when recipes already exist */}
          {recipes.length > 0 && <button onClick={openAdd}
            style={{ minHeight: 280, borderRadius: 22, border: '1.5px dashed var(--input-border)', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', transition: 'all 220ms ease', padding: 24 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--card-bg)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--input-border)'; }}
          >
            <div style={{ width: 46, height: 46, borderRadius: 15, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Add Recipe</span>
            <span style={{ fontSize: 12.5, color: 'var(--text-ultra-muted)', textAlign: 'center', maxWidth: '22ch', lineHeight: 1.5 }}>Start with a dish name and how many servings it makes</span>
          </button>}

          {recipes.length === 0 && (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-state-icon"><FiBook size={26} /></div>
              <div className="empty-state-title">No recipes yet</div>
              <div className="empty-state-subtitle">Add your first dish to start computing costs and recommended selling prices.</div>
              <button
                onClick={openAdd}
                style={{
                  marginTop: 12, padding: '9px 20px', borderRadius: 12,
                  background: 'var(--accent)', color: '#fff',
                  fontWeight: 700, fontSize: 13.5, border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                </svg>
                Create your first recipe
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)}>
          <ModalHeader title={editTarget ? 'Edit Recipe' : 'Add Recipe'} subtitle={editTarget ? `Editing "${editTarget.name}"` : 'Create a new menu item'} onClose={() => setModalOpen(false)} />
          <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
            {/* Dish photo upload */}
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Dish Photo</label>
              <label style={{ display: 'block', cursor: 'pointer' }}>
                <div style={{
                  height: 120, borderRadius: 12, border: '1.5px dashed var(--input-border)',
                  background: 'var(--input-bg)', overflow: 'hidden', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', position: 'relative',
                  transition: 'border-color 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--input-border)'}
                >
                  {form.image ? (
                    <img src={form.image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'var(--text-ultra-muted)' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.4"/>
                        <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.4"/>
                        <path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>Click to upload photo</span>
                      <span style={{ fontSize: 11, color: 'var(--text-ultra-muted)' }}>JPG, PNG or WEBP</span>
                    </div>
                  )}
                </div>
                <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
              </label>
              {form.image && (
                <button type="button" onClick={() => setForm(f => ({ ...f, image: '' }))}
                  style={{ marginTop: 6, fontSize: 12, color: 'oklch(0.55 0.16 28)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, fontWeight: 600 }}>
                  Remove photo
                </button>
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Name <span style={{ color: 'oklch(0.60 0.14 28)' }}>*</span></label>
              <input type="text" required autoFocus placeholder="e.g. Chicken Adobo" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 4px var(--accent-focus)'; e.target.style.background = 'var(--card-bg)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--input-border)'; e.target.style.boxShadow = 'none'; e.target.style.background = 'var(--input-bg)'; }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Description</label>
              <textarea placeholder="Optional description" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'none' }}
                onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 4px var(--accent-focus)'; e.target.style.background = 'var(--card-bg)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--input-border)'; e.target.style.boxShadow = 'none'; e.target.style.background = 'var(--input-bg)'; }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Category</label>
              <input type="text" placeholder="e.g. Main Course, Appetizer, Dessert" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                list="recipe-categories"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 4px var(--accent-focus)'; e.target.style.background = 'var(--card-bg)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--input-border)'; e.target.style.boxShadow = 'none'; e.target.style.background = 'var(--input-bg)'; }}
              />
              <datalist id="recipe-categories">
                {['Main Course', 'Appetizer', 'Dessert', 'Soup', 'Beverage', 'Side Dish', 'Snack', 'Breakfast'].map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Servings <span style={{ color: 'oklch(0.60 0.14 28)' }}>*</span></label>
              <input type="number" min="1" required placeholder="e.g. 4" value={form.servings} onChange={e => setForm(f => ({ ...f, servings: e.target.value }))}
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 4px var(--accent-focus)'; e.target.style.background = 'var(--card-bg)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--input-border)'; e.target.style.boxShadow = 'none'; e.target.style.background = 'var(--input-bg)'; }}
              />
            </div>
            {formError && <p style={{ fontSize: 13, color: 'oklch(0.55 0.16 28)' }}>{formError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, paddingTop: 4 }}>
              <button type="button" onClick={() => setModalOpen(false)} style={{ height: 40, padding: '0 16px', borderRadius: 11, border: '1px solid var(--input-border)', background: 'var(--card-bg)', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={formLoading} className="btn-primary" style={{ height: 40, padding: '0 20px', borderRadius: 11, fontSize: 14 }}>{formLoading ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Recipe'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
