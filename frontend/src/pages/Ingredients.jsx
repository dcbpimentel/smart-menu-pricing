import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import Select from '../components/Select';

const UNITS = ['kg', 'g', 'L', 'ml', 'pcs'];

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div
        className="w-7 h-7 rounded-full border-2 border-gray-200 animate-spin"
        style={{ borderTopColor: 'var(--accent)' }}
      />
    </div>
  );
}

function Modal({ onClose, children, wide }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl w-full flex flex-col max-h-[90vh] ${wide ? 'max-w-2xl' : 'max-w-md'}`}
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
  // ── List ──────────────────────────────────────────────────────────────
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

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
      fetchIngredients();
    } catch (err) {
      setFormError(err.response?.data?.message ?? err.message);
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

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl">

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Ingredients</h2>
          <p className="text-sm text-gray-400 mt-0.5">Manage your ingredient list and market prices</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <span className="text-base leading-none">+</span>
          Add Ingredient
        </button>
      </div>

      {/* Page-level error */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Table card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <Spinner />
        ) : ingredients.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 text-sm">No ingredients yet.</p>
            <button
              onClick={openAdd}
              className="mt-3 text-sm font-medium hover:opacity-80 transition-opacity"
              style={{ color: 'var(--accent)' }}
            >
              Add your first ingredient →
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-400 text-xs uppercase tracking-wide">Name</th>
                <th className="text-left px-5 py-3 font-medium text-gray-400 text-xs uppercase tracking-wide">Unit</th>
                <th className="text-left px-5 py-3 font-medium text-gray-400 text-xs uppercase tracking-wide">Category</th>
                <th className="text-right px-5 py-3 font-medium text-gray-400 text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ingredients.map((ing) => (
                <tr key={ing.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-800">{ing.name}</td>
                  <td className="px-5 py-3.5">
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-600">
                      {ing.unit}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{ing.category}</td>
                  <td className="px-5 py-3.5 text-right space-x-4">
                    <button
                      onClick={() => openEdit(ing)}
                      className="text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openPrices(ing)}
                      className="text-xs font-medium transition-colors hover:opacity-75"
                      style={{ color: 'var(--accent)' }}
                    >
                      View Prices
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────── */}
      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)}>
          <ModalHeader
            title={editTarget ? 'Edit Ingredient' : 'Add Ingredient'}
            onClose={() => setModalOpen(false)}
          />
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Chicken Breast"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Unit <span className="text-red-400">*</span>
              </label>
              <Select
                value={form.unit}
                onChange={v => setForm(f => ({ ...f, unit: v }))}
                options={UNITS.map(u => ({ value: u, label: u }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Category <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Meat, Vegetable, Grain"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {formError && (
              <div className="px-3 py-2.5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
                {formError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {formLoading ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Ingredient'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Price History Modal ──────────────────────────────────────── */}
      {priceModal && priceTarget && (
        <Modal onClose={() => setPriceModal(false)} wide>
          <ModalHeader
            title={priceTarget.name}
            subtitle="Price history"
            onClose={() => setPriceModal(false)}
          />

          <div className="overflow-y-auto flex-1 px-6 py-4">
            {/* History table */}
            {pricesLoading ? (
              <Spinner />
            ) : pricesError ? (
              <div className="py-3 text-red-600 text-sm">{pricesError}</div>
            ) : prices.length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">No price history yet.</p>
            ) : (
              <div className="rounded-lg border border-gray-100 overflow-hidden mb-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-2.5 font-medium text-gray-400 text-xs uppercase tracking-wide">Date</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-400 text-xs uppercase tracking-wide">Price</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-400 text-xs uppercase tracking-wide">Source</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-400 text-xs uppercase tracking-wide">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {prices.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-500">{p.extraction_date}</td>
                        <td className="px-4 py-2.5 font-semibold text-gray-800">
                          ₱{Number(p.price).toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_BADGE[p.source] ?? 'bg-gray-100 text-gray-600'}`}>
                            {p.source.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs max-w-xs truncate">
                          {p.provenance_note ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add manual price form */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Add Manual Price
              </p>
              <form onSubmit={handleAddPrice}>
                <div className="flex gap-3 items-end flex-wrap">
                  <div className="flex-1 min-w-32">
                    <label className="block text-xs text-gray-500 mb-1">
                      Price (₱ / {priceTarget.unit})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={addForm.price}
                      onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={addForm.extraction_date}
                      onChange={e => setAddForm(f => ({ ...f, extraction_date: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={addLoading}
                    className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90 whitespace-nowrap"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    {addLoading ? '…' : '+ Add Price'}
                  </button>
                </div>
                {addError && (
                  <p className="mt-2 text-xs text-red-600">{addError}</p>
                )}
              </form>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
