import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/api';
import { loadPrefs, savePrefs } from '../lib/prefs';
import { applyTheme, THEMES } from '../lib/theme';
import { BrandMark } from '../components/Icons';
import Select from '../components/Select';

const ROUNDING_LABELS = {
  none: 'None',
  nearest5: 'Round up to nearest ₱5',
  nearest10: 'Round up to nearest ₱10',
};

const ROUNDING_OPTIONS = [
  { value: 'none',      label: 'None',                description: 'Use the exact calculated price' },
  { value: 'nearest5',  label: 'Round up to nearest ₱5',  description: 'e.g. ₱43.20 → ₱45.00' },
  { value: 'nearest10', label: 'Round up to nearest ₱10', description: 'e.g. ₱43.20 → ₱50.00' },
];

const THRESHOLD_OPTIONS = [
  { value: 3,  label: '3 days',  description: 'Alert when prices are older than 3 days' },
  { value: 7,  label: '7 days',  description: 'Alert when prices are older than 7 days (default)' },
  { value: 14, label: '14 days', description: 'Alert when prices are older than 2 weeks' },
  { value: 30, label: '30 days', description: 'Alert when prices are older than 1 month' },
];

const SOURCE_OPTIONS = [
  { value: 'latest', label: 'Latest (any source)',  description: 'Use most recent price regardless of origin' },
  { value: 'manual', label: 'Manual entries only',  description: 'Only use prices you entered by hand' },
  { value: 'dti',    label: 'DTI prices only',      description: 'Only use prices from DTI bulletins' },
  { value: 'da',     label: 'DA prices only',       description: 'Only use prices from DA bulletins' },
];

const ICON_OPTIONS = [
  { id: 'fork',  label: 'Fork & Bowl' },
  { id: 'flame', label: 'Flame' },
  { id: 'leaf',  label: 'Leaf' },
  { id: 'star',  label: 'Star' },
  { id: 'bowl',  label: 'Bowl' },
  { id: 'custom', label: 'Custom PNG' },
];

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-7 h-7 rounded-full border-2 border-gray-200 animate-spin" style={{ borderTopColor: 'var(--accent)' }} />
    </div>
  );
}

function SectionCard({ title, description, children }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60">
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-5">
        {children}
      </div>
    </div>
  );
}

function Modal({ onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col"
        style={{ maxHeight: '90vh' }}
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
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5 ml-4" aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

// ── Brand Appearance section ────────────────────────────────────────────────────
function BrandAppearanceSection() {
  const fileInputRef = useRef(null);
  const [sel, setSel] = useState(() => {
    const p = loadPrefs();
    return {
      theme: p.theme || 'default',
      brandIcon: p.brandIcon || 'fork',
      brandIconCustom: p.brandIconCustom || '',
    };
  });
  const [saved, setSaved] = useState(false);

  const persist = (updates) => {
    const next = { ...sel, ...updates };
    setSel(next);
    const current = loadPrefs();
    savePrefs({ ...current, ...next });
    if (updates.theme) {
      applyTheme(updates.theme);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const handleIconSelect = (iconId) => {
    if (iconId === 'custom') {
      fileInputRef.current?.click();
      return;
    }
    persist({ brandIcon: iconId });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      persist({ brandIcon: 'custom', brandIconCustom: ev.target.result });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <SectionCard
      title="Brand & Appearance"
      description="Customize the system icon, color theme, and display mode. Changes apply immediately."
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* System Icon */}
      <div className="mb-6">
        <label className="block text-xs font-medium text-gray-500 mb-3">System Icon</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {ICON_OPTIONS.map(({ id, label }) => {
            const isSelected = sel.brandIcon === id || (id === 'custom' && sel.brandIcon === 'custom');
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleIconSelect(id)}
                title={label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 10px 8px',
                  borderRadius: '12px',
                  border: `2px solid ${isSelected ? 'var(--accent)' : '#EAEAEA'}`,
                  background: isSelected ? 'var(--accent-light)' : 'white',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                  minWidth: '72px',
                }}
              >
                {id === 'custom' && sel.brandIcon === 'custom' && sel.brandIconCustom ? (
                  <BrandMark size={36} iconId="custom" customUrl={sel.brandIconCustom} />
                ) : id === 'custom' ? (
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: '10px', border: '1.5px dashed #d1d5db',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#9ca3af', background: '#f9fafb',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                ) : (
                  <BrandMark size={36} iconId={id} />
                )}
                <span style={{
                  fontSize: '10px', fontWeight: 500, lineHeight: 1,
                  color: isSelected ? 'var(--accent)' : '#6b7280',
                  whiteSpace: 'nowrap',
                }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
        {sel.brandIcon === 'custom' && sel.brandIconCustom && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
          >
            Replace image
          </button>
        )}
      </div>

      {/* Theme picker */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-3">Color Theme</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {Object.entries(THEMES).map(([id, theme]) => {
            const isSelected = sel.theme === id;
            const isDark = theme.isDark;

            // Dark mode swatch has its own dark-background treatment
            const swatchBg = isDark
              ? (isSelected ? '#0f172a' : '#1a2235')
              : (isSelected ? `${theme.preview}15` : 'white');
            const swatchBorder = isDark
              ? `2px solid ${isSelected ? '#10b981' : '#334155'}`
              : `2px solid ${isSelected ? theme.preview : '#EAEAEA'}`;
            const labelColor = isDark
              ? (isSelected ? '#6ee7b7' : '#94a3b8')
              : (isSelected ? theme.preview : '#6b7280');

            return (
              <button
                key={id}
                type="button"
                onClick={() => persist({ theme: id })}
                title={theme.description}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '10px 12px 9px',
                  borderRadius: '12px',
                  border: swatchBorder,
                  background: swatchBg,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                  minWidth: '76px',
                }}
              >
                {isDark ? (
                  /* Dark mode: show a tiny dark-UI preview */
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'stretch' }}>
                    {/* mini sidebar strip */}
                    <div style={{ width: 7, borderRadius: '3px', background: '#0d1117', flexShrink: 0 }} />
                    {/* mini canvas with card */}
                    <div style={{
                      width: 38, height: 26, borderRadius: '4px', background: '#0f172a',
                      padding: '3px 4px', display: 'flex', flexDirection: 'column', gap: '3px',
                    }}>
                      <div style={{ height: 4, borderRadius: '2px', background: '#1e293b', width: '100%' }} />
                      <div style={{ height: 4, borderRadius: '2px', background: '#10b981', width: '60%' }} />
                      <div style={{ height: 4, borderRadius: '2px', background: '#1e293b', width: '80%' }} />
                    </div>
                  </div>
                ) : (
                  /* Light themes: sidebar dot + content lines */
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '6px',
                      background: '#1e293b',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <div style={{ width: 10, height: 10, borderRadius: '3px', background: theme.preview }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ width: 24, height: 4, borderRadius: '2px', background: '#f3f4f6' }} />
                      <div style={{ width: 18, height: 4, borderRadius: '2px', background: '#e5e7eb' }} />
                    </div>
                  </div>
                )}
                <span style={{
                  fontSize: '10px', fontWeight: 600, lineHeight: 1,
                  color: labelColor,
                  whiteSpace: 'nowrap',
                }}>
                  {theme.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {saved && (
        <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full w-fit">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 16 16">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l4 4 6-6"/>
          </svg>
          Applied
        </div>
      )}
    </SectionCard>
  );
}

// ── Restaurant Profile section ─────────────────────────────────────────────────
function RestaurantProfileSection() {
  const [form, setForm] = useState(() => {
    const p = loadPrefs();
    return { restaurantName: p.restaurantName, ownerName: p.ownerName, location: p.location };
  });
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    const current = loadPrefs();
    savePrefs({ ...current, ...form });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <SectionCard
      title="Restaurant Profile"
      description="Displayed in the sidebar and used to personalize the experience"
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Restaurant Name</label>
            <input
              type="text"
              value={form.restaurantName}
              onChange={e => setForm(f => ({ ...f, restaurantName: e.target.value }))}
              placeholder="e.g. Casa Manila"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Owner / Manager Name</label>
            <input
              type="text"
              value={form.ownerName}
              onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))}
              placeholder="e.g. Maria Santos"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Location</label>
          <input
            type="text"
            value={form.location}
            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            placeholder="e.g. Kidapawan City, Cotabato"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity btn-accent"
          >
            Save Profile
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 16 16">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l4 4 6-6"/>
              </svg>
              Saved. Reload to see sidebar update.
            </span>
          )}
        </div>
      </form>
    </SectionCard>
  );
}

// ── Preferences section ────────────────────────────────────────────────────────
function PreferencesSection() {
  const [prefs, setPrefsState] = useState(() => loadPrefs());
  const [saved, setSaved] = useState(false);

  const update = (key, value) => {
    setPrefsState(p => ({ ...p, [key]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    savePrefs(prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <SectionCard
      title="Preferences"
      description="Controls how the Dashboard and Costing pages behave by default"
    >
      <form onSubmit={handleSave} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Price Alert Threshold</label>
            <Select
              value={prefs.alertThresholdDays}
              onChange={v => update('alertThresholdDays', Number(v))}
              options={THRESHOLD_OPTIONS}
            />
            <p className="text-xs text-gray-400 mt-1.5">
              Dashboard flags ingredients with prices older than this
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Default Price Source</label>
            <Select
              value={prefs.defaultPriceSource}
              onChange={v => update('defaultPriceSource', v)}
              options={SOURCE_OPTIONS}
            />
            <p className="text-xs text-gray-400 mt-1.5">
              Pre-selected in the Cost Computation form
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity btn-accent"
          >
            Save Preferences
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 16 16">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l4 4 6-6"/>
              </svg>
              Saved
            </span>
          )}
        </div>
      </form>
    </SectionCard>
  );
}

// ── Pricing Profiles section ───────────────────────────────────────────────────
function PricingProfilesSection() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ label: '', target_food_cost_pct: '', rounding_rule: 'nearest5' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/settings');
      setProfiles(res.data.data || []);
    } catch {
      setError('Failed to load pricing profiles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ label: '', target_food_cost_pct: '', rounding_rule: 'nearest5' });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (profile) => {
    setEditTarget(profile);
    setForm({
      label: profile.label,
      target_food_cost_pct: String(profile.target_food_cost_pct),
      rounding_rule: profile.rounding_rule,
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      const payload = {
        label: form.label.trim(),
        target_food_cost_pct: parseFloat(form.target_food_cost_pct),
        rounding_rule: form.rounding_rule,
      };
      if (editTarget) {
        await api.put(`/settings/${editTarget.id}`, payload);
      } else {
        await api.post('/settings', payload);
      }
      setModalOpen(false);
      fetchProfiles();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (profile) => {
    if (!window.confirm(`Delete profile "${profile.label}"?`)) return;
    try {
      await api.delete(`/settings/${profile.id}`);
      fetchProfiles();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete profile.');
    }
  };

  return (
    <>
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">Pricing Profiles</h3>
            <p className="text-xs text-gray-400 mt-0.5">Configure food-cost targets and rounding rules for selling price recommendations</p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg hover:opacity-90 transition-opacity btn-accent"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Add Profile
          </button>
        </div>

        <div className="px-6 py-4">
          <div className="flex items-start gap-2.5 p-3.5 border border-blue-100 bg-blue-50 rounded-lg text-xs text-blue-700">
            <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="8" y1="7" x2="8" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="8" cy="5.5" r="0.5" fill="currentColor"/>
            </svg>
            <span>
              <strong>Formula:</strong> Recommended price = Portion Cost ÷ (Food Cost % ÷ 100).
              A 35% target means ingredients cost 35% of the selling price, which is the industry standard.
            </span>
          </div>
        </div>

        {loading ? (
          <Spinner />
        ) : error ? (
          <p className="text-red-500 text-sm px-6 pb-6">{error}</p>
        ) : profiles.length === 0 ? (
          <div className="border border-dashed border-gray-200 rounded-lg mx-6 mb-6 p-10 text-center">
            <p className="text-gray-400 text-sm">No pricing profiles yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Label</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Food Cost Target</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Rounding</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile, i) => (
                  <tr
                    key={profile.id}
                    className={`${i < profiles.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50 transition-colors`}
                  >
                    <td className="px-5 py-3.5 font-medium text-gray-800">{profile.label}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-sm font-semibold text-accent">
                        {profile.target_food_cost_pct}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">
                      {ROUNDING_LABELS[profile.rounding_rule] ?? profile.rounding_rule}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button onClick={() => openEdit(profile)} className="text-xs font-medium text-gray-400 hover:text-gray-600 mr-4">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(profile)} className="text-xs font-medium text-red-400 hover:text-red-600">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)}>
          <ModalHeader
            title={editTarget ? 'Edit Profile' : 'Add Pricing Profile'}
            subtitle={editTarget ? `Editing "${editTarget.label}"` : 'Create a new pricing configuration'}
            onClose={() => setModalOpen(false)}
          />
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Label *</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                placeholder="e.g. Default, High Margin"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Target Food Cost % *</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="0.01"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  placeholder="35.00"
                  value={form.target_food_cost_pct}
                  onChange={e => setForm(f => ({ ...f, target_food_cost_pct: e.target.value }))}
                  required
                />
                <span className="text-gray-400 text-sm font-medium flex-shrink-0">%</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Industry standard: 25–40% for restaurants</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Rounding Rule *</label>
              <Select
                value={form.rounding_rule}
                onChange={v => setForm(f => ({ ...f, rounding_rule: v }))}
                options={ROUNDING_OPTIONS}
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
                className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60 hover:opacity-90 transition-opacity btn-accent"
              >
                {formLoading ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Profile'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

// ── About section ──────────────────────────────────────────────────────────────
function AboutSection() {
  const prefs = loadPrefs();
  return (
    <SectionCard title="About System" description="Smart Menu Pricing capstone project information">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-3">
          {[
            { label: 'System',    value: 'Smart Menu Pricing' },
            { label: 'Version',   value: 'Sprint 4 Final' },
            { label: 'Purpose',   value: 'Food cost calculation & price recommendation' },
            { label: 'Coverage',  value: 'Kidapawan City, Philippines (DTI/DA Region XII)' },
          ].map(({ label, value }) => (
            <div key={label} className="flex gap-3">
              <span className="text-xs font-medium text-gray-400 w-20 flex-shrink-0 pt-0.5">{label}</span>
              <span className="text-xs text-gray-700">{value}</span>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {[
            { label: 'Backend',   value: 'Node.js + Express REST API' },
            { label: 'Database',  value: 'MySQL (smart_menu_pricing)' },
            { label: 'Frontend',  value: 'React + Vite + Tailwind CSS v4' },
            { label: 'Extraction', value: 'Axios + Cheerio + pdf-parse + Tesseract.js' },
          ].map(({ label, value }) => (
            <div key={label} className="flex gap-3">
              <span className="text-xs font-medium text-gray-400 w-20 flex-shrink-0 pt-0.5">{label}</span>
              <span className="text-xs text-gray-700 font-mono">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {prefs.restaurantName && (
        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L2 5v9h4v-4h4v4h4V5L8 1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
          Currently configured for <span className="font-medium text-gray-600 ml-1">{prefs.restaurantName}</span>
          {prefs.location && <span className="ml-1">· {prefs.location}</span>}
        </div>
      )}
    </SectionCard>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Settings() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Manage your restaurant profile, preferences, and pricing profiles
        </p>
      </div>

      <BrandAppearanceSection />
      <RestaurantProfileSection />
      <PreferencesSection />
      <PricingProfilesSection />
      <AboutSection />
    </div>
  );
}
