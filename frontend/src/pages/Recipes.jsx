import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

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

function Modal({ onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, subtitle, onClose }) {
  return (
    <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
      <div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4 mt-0.5">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

export default function Recipes() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', servings: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const listRes = await api.get('/recipes');
      const list = listRes.data.data || [];

      // Fetch each recipe detail in parallel to get ingredient count
      const details = await Promise.all(list.map(r => api.get(`/recipes/${r.id}`)));
      const enriched = list.map((r, i) => ({
        ...r,
        ingredientCount: details[i].data.data?.ingredients?.length ?? 0,
      }));
      setRecipes(enriched);
    } catch {
      setError('Failed to load recipes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecipes(); }, [fetchRecipes]);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ name: '', description: '', servings: '' });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (recipe, e) => {
    e.preventDefault();
    e.stopPropagation();
    setEditTarget(recipe);
    setForm({ name: recipe.name, description: recipe.description || '', servings: String(recipe.servings) });
    setFormError('');
    setModalOpen(true);
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
      };
      if (editTarget) {
        await api.put(`/recipes/${editTarget.id}`, payload);
      } else {
        await api.post('/recipes', payload);
      }
      setModalOpen(false);
      fetchRecipes();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (recipe, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Delete "${recipe.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/recipes/${recipe.id}`);
      fetchRecipes();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete.');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Recipes</h2>
          <p className="text-sm text-gray-400 mt-0.5">Manage your menu items and their ingredients</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <span className="text-lg leading-none">+</span> Add Recipe
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="text-red-500 text-sm">{error}</p>
      ) : recipes.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-xl p-16 text-center">
          <p className="text-gray-400 text-sm mb-3">No recipes yet.</p>
          <button
            onClick={openAdd}
            className="text-sm font-medium px-4 py-2 rounded-lg text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Add your first recipe
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {recipes.map(recipe => (
            <div
              key={recipe.id}
              className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col"
            >
              {/* Card body */}
              <div className="p-5 flex-1">
                <h3 className="font-bold text-gray-900 text-base mb-1">{recipe.name}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 mb-4">
                  {recipe.description || <span className="italic text-gray-300">No description</span>}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-gray-400">
                      <circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-gray-400">
                      <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M5 7h6M5 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    {recipe.ingredientCount} {recipe.ingredientCount === 1 ? 'ingredient' : 'ingredients'}
                  </span>
                </div>
              </div>

              {/* Card footer */}
              <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={e => openEdit(recipe, e)}
                    className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={e => handleDelete(recipe, e)}
                    className="text-xs font-medium text-red-400 hover:text-red-600 transition-colors"
                  >
                    Delete
                  </button>
                </div>
                <Link
                  to={`/recipes/${recipe.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Manage
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)}>
          <ModalHeader
            title={editTarget ? 'Edit Recipe' : 'Add Recipe'}
            subtitle={editTarget ? `Editing "${editTarget.name}"` : 'Create a new menu item'}
            onClose={() => setModalOpen(false)}
          />
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                placeholder="e.g. Chicken Adobo"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400 resize-none"
                placeholder="Optional description"
                rows={3}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Servings *</label>
              <input
                type="number"
                min="1"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                placeholder="e.g. 4"
                value={form.servings}
                onChange={e => setForm(f => ({ ...f, servings: e.target.value }))}
                required
              />
            </div>
            {formError && <p className="text-red-500 text-xs">{formError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {formLoading ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Recipe'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
