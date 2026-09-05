import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/api';
import { loadPrefs, savePrefs } from '../lib/prefs';
import Select from '../components/Select';
import { useToast } from '../components/Toast';
import { SkeletonTable } from '../components/Skeleton';

/* ─── Design tokens ────────────────────────────────────────────────────────── */
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
};

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


function SectionCard({ title, description, children, defaultOpen = true }) {
  const storageKey = `scard_${title}`;
  const [open, setOpen] = useState(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      return stored !== null ? stored === 'true' : defaultOpen;
    } catch { return defaultOpen; }
  });
  const toggle = () => setOpen(o => {
    const next = !o;
    try { sessionStorage.setItem(storageKey, String(next)); } catch {}
    return next;
  });
  return (
    <div style={{ background: '#FFFFFF', border: T.cardBorder, borderRadius: 20, overflow: 'hidden' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggle()}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '16px 24px', background: '#FDFBF8',
          borderBottom: open ? T.rowDivider : 'none',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, margin: 0,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif" }}>
            {title}
          </h3>
          {description && <p style={{ fontSize: 12.5, color: T.textMuted, marginTop: 3, marginBottom: 0 }}>{description}</p>}
        </div>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: T.textMuted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <path d="M3 5.5L8 10.5L13 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {open && (
        <div style={{ padding: '22px 24px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Modal({ onClose, children }) {
  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(10,8,6,0.5)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)' }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{ background: '#FFFFFF', borderRadius: 20, border: T.cardBorder, width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)', boxShadow: '0 32px 80px rgba(36,32,28,0.22)' }}
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
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '18px 24px', borderBottom: T.rowDivider, flexShrink: 0 }}>
      <div>
        <h3 style={{ fontWeight: 600, fontSize: 15.5, color: T.textPrimary, margin: 0,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif" }}>
          {title}
        </h3>
        {subtitle && <p style={{ fontSize: 12.5, color: T.textMuted, marginTop: 3, marginBottom: 0 }}>{subtitle}</p>}
      </div>
      <button
        onClick={onClose}
        aria-label="Close"
        style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #EFE8DE', background: '#FDFBF8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMuted, marginLeft: 12, flexShrink: 0 }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
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
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>Restaurant Name</label>
            <input
              type="text"
              value={form.restaurantName}
              onChange={e => setForm(f => ({ ...f, restaurantName: e.target.value }))}
              placeholder="e.g. Casa Manila"
              style={{ height: 44, borderRadius: 12, border: `1px solid ${T.inputBorder}`, background: T.inputBg, fontSize: 14, color: T.textPrimary, padding: '0 14px', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
              onFocus={e => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = T.focusShadow; e.target.style.background = '#FFFFFF'; }}
              onBlur={e => { e.target.style.borderColor = T.inputBorder; e.target.style.boxShadow = 'none'; e.target.style.background = T.inputBg; }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>Owner / Manager Name</label>
            <input
              type="text"
              value={form.ownerName}
              onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))}
              placeholder="e.g. Maria Santos"
              style={{ height: 44, borderRadius: 12, border: `1px solid ${T.inputBorder}`, background: T.inputBg, fontSize: 14, color: T.textPrimary, padding: '0 14px', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
              onFocus={e => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = T.focusShadow; e.target.style.background = '#FFFFFF'; }}
              onBlur={e => { e.target.style.borderColor = T.inputBorder; e.target.style.boxShadow = 'none'; e.target.style.background = T.inputBg; }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>Location</label>
          <input
            type="text"
            value={form.location}
            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            placeholder="e.g. Kidapawan City, Cotabato"
            style={{ height: 44, borderRadius: 12, border: `1px solid ${T.inputBorder}`, background: T.inputBg, fontSize: 14, color: T.textPrimary, padding: '0 14px', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
            onFocus={e => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = T.focusShadow; e.target.style.background = '#FFFFFF'; }}
            onBlur={e => { e.target.style.borderColor = T.inputBorder; e.target.style.boxShadow = 'none'; e.target.style.background = T.inputBg; }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
          <button
            type="submit"
            style={{ height: 40, padding: '0 20px', borderRadius: 12, background: T.accent, color: '#FFFFFF', fontWeight: 700, fontSize: 13.5, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Save Profile
          </button>
          {saved && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'oklch(0.44 0.12 145)', background: 'oklch(0.955 0.058 145)', padding: '4px 10px', borderRadius: 20 }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 16 16">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 8l5 5 7-7"/>
              </svg>
              Saved
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
      defaultOpen={false}
    >
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>Price Alert Threshold</label>
            <Select
              value={prefs.alertThresholdDays}
              onChange={v => update('alertThresholdDays', Number(v))}
              options={THRESHOLD_OPTIONS}
            />
            <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>
              Dashboard flags ingredients with prices older than this
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>Default Price Source</label>
            <Select
              value={prefs.defaultPriceSource}
              onChange={v => update('defaultPriceSource', v)}
              options={SOURCE_OPTIONS}
            />
            <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>
              Pre-selected in the Cost Computation form
            </p>
          </div>
        </div>

        {/* Price Change Threshold settings */}
        <div style={{ borderTop: T.rowDivider, paddingTop: 18 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, margin: '0 0 4px' }}>Price Change Thresholds</p>
          <p style={{ fontSize: 12, color: T.textMuted, margin: '0 0 16px' }}>
            The system flags a recipe for a price update when <strong>either</strong> condition is exceeded. Used on the Reports page and Cost Computation page.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>
                Max Price Gap (%)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={prefs.priceGapThreshold ?? 15}
                  onChange={e => update('priceGapThreshold', Math.max(1, Math.min(100, Number(e.target.value))))}
                  style={{ width: 72, height: 38, padding: '0 10px', borderRadius: 10, border: `1px solid ${T.inputBorder}`, background: T.inputBg, fontSize: 14, fontWeight: 600, color: T.textPrimary, fontFamily: 'inherit' }}
                />
                <span style={{ fontSize: 13, color: T.textMuted }}>%</span>
              </div>
              <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>
                Flag when actual selling price deviates from the recommended price by more than this percentage
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>
                Max Food Cost Deviation (pp)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={prefs.foodCostDeviationThreshold ?? 5}
                  onChange={e => update('foodCostDeviationThreshold', Math.max(1, Math.min(50, Number(e.target.value))))}
                  style={{ width: 72, height: 38, padding: '0 10px', borderRadius: 10, border: `1px solid ${T.inputBorder}`, background: T.inputBg, fontSize: 14, fontWeight: 600, color: T.textPrimary, fontFamily: 'inherit' }}
                />
                <span style={{ fontSize: 13, color: T.textMuted }}>pp</span>
              </div>
              <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>
                Flag when the actual food cost % exceeds the target by more than this many percentage points
              </p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
          <button
            type="submit"
            style={{ height: 40, padding: '0 20px', borderRadius: 12, background: T.accent, color: '#FFFFFF', fontWeight: 700, fontSize: 13.5, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Save Preferences
          </button>
          {saved && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'oklch(0.44 0.12 145)', background: 'oklch(0.955 0.058 145)', padding: '4px 10px', borderRadius: 20 }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 16 16">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 8l5 5 7-7"/>
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
  const toast = useToast();
  const [open, setOpen] = useState(() => {
    try {
      const stored = sessionStorage.getItem('scard_Pricing Profiles');
      return stored !== null ? stored === 'true' : true;
    } catch { return true; }
  });
  const toggleOpen = () => setOpen(o => {
    const next = !o;
    try { sessionStorage.setItem('scard_Pricing Profiles', String(next)); } catch {}
    return next;
  });
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

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

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setModalOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

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
        toast.success(`"${payload.label}" updated.`);
      } else {
        await api.post('/settings', payload);
        toast.success(`"${payload.label}" added.`);
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
    try {
      await api.delete(`/settings/${profile.id}`);
      setPendingDelete(null);
      toast.success(`"${profile.label}" deleted.`);
      fetchProfiles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete profile.');
    }
  };

  return (
    <>
      <div style={{ background: '#FFFFFF', border: T.cardBorder, borderRadius: 20, overflow: 'hidden' }}>
        <div
          role="button"
          tabIndex={0}
          onClick={toggleOpen}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggleOpen()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, padding: '16px 24px', background: '#FDFBF8',
            borderBottom: open ? T.rowDivider : 'none',
            cursor: 'pointer', userSelect: 'none',
          }}
        >
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, margin: 0,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif" }}>
              Pricing Profiles
            </h3>
            <p style={{ fontSize: 12.5, color: T.textMuted, marginTop: 3, marginBottom: 0 }}>
              Configure food-cost targets and rounding rules for selling price recommendations
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); openAdd(); }}
              style={{ height: 32, padding: '0 14px', borderRadius: 10, background: T.accent, color: '#FFFFFF', fontWeight: 700, fontSize: 12.5, border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Add Profile
            </button>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ color: T.textMuted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <path d="M3 5.5L8 10.5L13 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {open && (
          <div style={{ padding: '16px 24px', borderBottom: T.rowDivider }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', border: '1px solid #DAE8E0', background: 'oklch(0.975 0.018 145)', borderRadius: 12, fontSize: 12.5, color: 'oklch(0.40 0.1 145)' }}>
              <svg style={{ flexShrink: 0, marginTop: 1 }} width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                <line x1="8" y1="7" x2="8" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="5.5" r="0.5" fill="currentColor"/>
              </svg>
              <span>
                <strong>Formula:</strong> Recommended price = Portion Cost divided by (Food Cost % divided by 100).
                A 35% target means ingredients cost 35% of the selling price, which is the industry standard.
              </span>
            </div>
          </div>
        )}
        {open && (loading ? (
          <div style={{ padding: 20 }}><SkeletonTable rows={3} cols={4} /></div>
        ) : error ? (
          <p style={{ color: 'oklch(0.58 0.16 28)', fontSize: 13, padding: '0 24px 24px' }}>{error}</p>
        ) : profiles.length === 0 ? (
          <div style={{ border: '1.5px dashed #DFD5C7', borderRadius: 14, margin: '0 24px 24px', padding: '40px 24px', textAlign: 'center' }}>
            <p style={{ color: T.textMuted, fontSize: 14, margin: 0 }}>No pricing profiles yet.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
              <thead>
                <tr>
                  {[
                    { label: 'Label',            align: 'left',  first: true },
                    { label: 'Food Cost Target', align: 'left' },
                    { label: 'Rounding',         align: 'left' },
                    { label: 'Actions',          align: 'right', last: true },
                  ].map((h, i) => (
                    <th key={i} style={{
                      background: T.tblHeadBg, color: T.tblHead,
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
                      padding: '11px 12px',
                      paddingLeft:  h.first ? 24 : 12,
                      paddingRight: h.last  ? 24 : 12,
                      textAlign: h.align,
                    }}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile, i) => (
                  <tr
                    key={profile.id}
                    style={{ borderTop: i === 0 ? 'none' : T.rowDivider, transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = T.rowHover}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '13px 12px 13px 24px', fontWeight: 600, color: T.textPrimary, fontSize: 14 }}>{profile.label}</td>
                    <td style={{ padding: '13px 12px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: T.accent }}>
                        {profile.target_food_cost_pct}%
                      </span>
                    </td>
                    <td style={{ padding: '13px 12px', color: T.textSecond, fontSize: 13 }}>
                      {ROUNDING_LABELS[profile.rounding_rule] ?? profile.rounding_rule}
                    </td>
                    <td style={{ padding: '13px 24px 13px 12px', textAlign: 'right' }}>
                      {pendingDelete === profile.id ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12.5, color: T.textSecond }}>Delete?</span>
                          <button onClick={() => handleDelete(profile)} style={{ fontSize: 12.5, fontWeight: 700, color: 'oklch(0.52 0.18 28)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Yes</button>
                          <button onClick={() => setPendingDelete(null)} style={{ fontSize: 12.5, fontWeight: 600, color: T.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>No</button>
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => openEdit(profile)} style={{ fontSize: 12.5, fontWeight: 600, color: T.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                            Edit
                          </button>
                          <button onClick={() => setPendingDelete(profile.id)} style={{ fontSize: 12.5, fontWeight: 600, color: 'oklch(0.58 0.16 28)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                            Delete
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)}>
          <ModalHeader
            title={editTarget ? 'Edit Profile' : 'Add Pricing Profile'}
            subtitle={editTarget ? `Editing "${editTarget.label}"` : 'Create a new pricing configuration'}
            onClose={() => setModalOpen(false)}
          />
          <form onSubmit={handleSubmit} style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>Label *</label>
              <input
                type="text"
                placeholder="e.g. Default, High Margin"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                required
                autoFocus
                style={{ height: 44, borderRadius: 12, border: `1px solid ${T.inputBorder}`, background: T.inputBg, fontSize: 14, color: T.textPrimary, padding: '0 14px', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
                onFocus={e => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = T.focusShadow; e.target.style.background = '#FFFFFF'; }}
                onBlur={e => { e.target.style.borderColor = T.inputBorder; e.target.style.boxShadow = 'none'; e.target.style.background = T.inputBg; }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>Target Food Cost % *</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="0.01"
                  placeholder="35.00"
                  value={form.target_food_cost_pct}
                  onChange={e => setForm(f => ({ ...f, target_food_cost_pct: e.target.value }))}
                  required
                  style={{ height: 44, borderRadius: 12, border: `1px solid ${T.inputBorder}`, background: T.inputBg, fontSize: 14, color: T.textPrimary, padding: '0 14px', outline: 'none', fontFamily: 'inherit', flex: 1 }}
                  onFocus={e => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = T.focusShadow; e.target.style.background = '#FFFFFF'; }}
                  onBlur={e => { e.target.style.borderColor = T.inputBorder; e.target.style.boxShadow = 'none'; e.target.style.background = T.inputBg; }}
                />
                <span style={{ color: T.textMuted, fontSize: 14, fontWeight: 600, flexShrink: 0 }}>%</span>
              </div>
              <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>Industry standard: 25–40% for restaurants</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>Rounding Rule *</label>
              <Select
                value={form.rounding_rule}
                onChange={v => setForm(f => ({ ...f, rounding_rule: v }))}
                options={ROUNDING_OPTIONS}
              />
            </div>
            {formError && <p style={{ color: 'oklch(0.58 0.16 28)', fontSize: 13, margin: 0 }}>{formError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 6 }}>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ height: 40, padding: '0 18px', borderRadius: 12, background: '#FFFFFF', border: '1px solid #E7DFD4', color: T.textSecond, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                style={{ height: 40, padding: '0 20px', borderRadius: 12, background: T.accent, color: '#FFFFFF', fontWeight: 700, fontSize: 13.5, border: 'none', cursor: formLoading ? 'not-allowed' : 'pointer', opacity: formLoading ? 0.6 : 1, fontFamily: 'inherit' }}
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

// ── Data Export section ────────────────────────────────────────────────────────
function DataExportSection() {
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get('/export');
      const payload = res.data.data;
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `smart-menu-pricing-export-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setLastExport(new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      // silently fail — user will see no download
    } finally {
      setExporting(false);
    }
  };

  return (
    <SectionCard title="Data Backup & Export" description="Download a full JSON snapshot of all your data for safekeeping or migration" defaultOpen={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {[
            { label: 'Ingredients', desc: 'All ingredient records' },
            { label: 'Prices', desc: 'Full price history' },
            { label: 'Recipes', desc: 'All recipes + ingredients' },
            { label: 'Costing History', desc: 'All computation snapshots' },
            { label: 'Pricing Profiles', desc: 'Settings configurations' },
          ].map(({ label, desc }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#FDFBF8', border: '1px solid #EFE8DE', borderRadius: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{label}</div>
                <div style={{ fontSize: 11.5, color: T.textMuted }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 20px', borderRadius: 12, background: T.accent, color: '#FFFFFF', fontWeight: 700, fontSize: 13.5, border: 'none', cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.65 : 1, fontFamily: 'inherit' }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v8M5 7l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {exporting ? 'Preparing…' : 'Export as JSON'}
          </button>
          {lastExport && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'oklch(0.44 0.12 145)', background: 'oklch(0.955 0.058 145)', padding: '4px 10px', borderRadius: 20 }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 16 16">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 8l5 5 7-7"/>
              </svg>
              Downloaded at {lastExport}
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: T.textMuted }}>
          The exported file includes all 5 data tables. Store it safely — it can be used to restore or migrate your data.
        </p>
      </div>
    </SectionCard>
  );
}

// ── About section ──────────────────────────────────────────────────────────────
function AboutSection() {
  const prefs = loadPrefs();
  return (
    <SectionCard title="About System" description="Smart Menu Pricing capstone project information" defaultOpen={false}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'System',    value: 'Smart Menu Pricing' },
            { label: 'Version',   value: 'Sprint 4 Final' },
            { label: 'Purpose',   value: 'Food cost calculation & price recommendation' },
            { label: 'Coverage',  value: 'Kidapawan City, Philippines (DTI/DA Region XII)' },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, width: 72, flexShrink: 0, paddingTop: 1 }}>{label}</span>
              <span style={{ fontSize: 12.5, color: T.textSecond }}>{value}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'Backend',    value: 'Node.js + Express REST API' },
            { label: 'Database',   value: 'MySQL (smart_menu_pricing)' },
            { label: 'Frontend',   value: 'React + Vite + Tailwind CSS v4' },
            { label: 'Extraction', value: 'Axios + Cheerio + pdf-parse + Tesseract.js' },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, width: 72, flexShrink: 0, paddingTop: 1 }}>{label}</span>
              <span style={{ fontSize: 12, color: T.textSecond, fontFamily: 'monospace' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {prefs.restaurantName && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #F3EDE4', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: T.textMuted }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L2 5v9h4v-4h4v4h4V5L8 1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
          Currently configured for <span style={{ fontWeight: 600, color: T.textSecond, marginLeft: 4 }}>{prefs.restaurantName}</span>
          {prefs.location && <span style={{ marginLeft: 4 }}>· {prefs.location}</span>}
        </div>
      )}
    </SectionCard>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Settings() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 860 }}>
      <RestaurantProfileSection />
      <PreferencesSection />
      <PricingProfilesSection />
      <DataExportSection />
      <AboutSection />
    </div>
  );
}
