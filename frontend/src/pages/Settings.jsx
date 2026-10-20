import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/api';
import { loadPrefs, savePrefs } from '../lib/prefs';
import { getUser } from '../lib/auth';
import Select from '../components/Select';
import { useToast } from '../components/Toast';
import { SkeletonTable } from '../components/Skeleton';

/* ─── Local tokens ─────────────────────────────────────────────────────────── */
const T = {
  accent:      '#2A6E3A',
  textPrimary: '#1C1C1E',
  textSecond:  '#48484A',
  textMuted:   '#8E8E93',
  border:      'rgba(0,0,0,0.08)',
  rowBorder:   'rgba(0,0,0,0.06)',
  inputBorder: 'rgba(0,0,0,0.11)',
  inputBg:     'rgba(0,0,0,0.028)',
  focusShadow: '0 0 0 3px rgba(42,110,58,0.13)',
  cardBg:      '#FFFFFF',
};

const ROUNDING_LABELS = {
  none:      'No rounding',
  nearest5:  'Round up to ₱5',
  nearest10: 'Round up to ₱10',
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

/* ─── Mode context: 'panel' (desktop two-col) | 'accordion' (mobile stacked) ─ */
const SettingsModeCtx = createContext('panel');

/* ─── Shared UI primitives ─────────────────────────────────────────────────── */

function SettingGroup({
  icon, iconColor = T.accent, iconBg = 'rgba(42,110,58,0.09)',
  title, children, action,
  collapsible = true, defaultOpen = false, storageKey,
}) {
  const mode      = useContext(SettingsModeCtx);
  const isPanelMode = mode === 'panel';
  const canToggle   = !isPanelMode && collapsible;

  const key = storageKey || `smp_settings_${(title || 'section').toLowerCase().replace(/\s+/g, '_')}`;
  const [open, setOpen] = useState(() => {
    if (isPanelMode || !collapsible) return true;
    try { const v = sessionStorage.getItem(key); return v !== null ? v === 'true' : defaultOpen; }
    catch { return defaultOpen; }
  });

  const toggle = () => {
    if (!canToggle) return;
    const next = !open;
    setOpen(next);
    try { sessionStorage.setItem(key, String(next)); } catch {}
  };

  const Card = ({ children: c }) => (
    <div style={{
      background: T.cardBg, border: `1px solid ${T.border}`,
      borderRadius: 16, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>{c}</div>
  );

  return (
    <div>
      {/* ── Header ── */}
      <div
        onClick={canToggle ? toggle : undefined}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: (isPanelMode || open) ? 8 : 0,
          cursor: canToggle ? 'pointer' : 'default',
          userSelect: 'none', padding: '2px 0',
          transition: 'margin-bottom 0.25s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && (
            <div style={{
              width: 26, height: 26, borderRadius: 7, background: iconBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ color: iconColor, display: 'flex' }}>{icon}</span>
            </div>
          )}
          <span style={{ fontSize: 13, fontWeight: 700, color: T.textSecond, letterSpacing: '0.01em' }}>
            {title}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {action && <span onClick={e => e.stopPropagation()}>{action}</span>}
          {canToggle && (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
              style={{
                color: T.textMuted, flexShrink: 0,
                transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.26s cubic-bezier(0.34,1.56,0.64,1)',
              }}
            >
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      {isPanelMode ? (
        /* Panel mode: always visible, no animation here (animation is on the panel switch) */
        <Card>{children}</Card>
      ) : (
        /* Accordion mode: smooth grid-row height animation */
        <div style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <div style={{ overflow: 'hidden', minHeight: 0 }}>
            <Card>{children}</Card>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingRow({ label, hint, last = false, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, padding: '14px 18px',
      borderBottom: last ? 'none' : `1px solid ${T.rowBorder}`,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, color: T.textPrimary, fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 1, lineHeight: 1.4 }}>{hint}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function SettingInput({ value, onChange, placeholder, style = {} }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        height: 36, borderRadius: 10, padding: '0 12px',
        border: `1px solid ${focused ? T.accent : T.inputBorder}`,
        background: focused ? '#FFFFFF' : T.inputBg,
        boxShadow: focused ? T.focusShadow : 'none',
        fontSize: 14, color: T.textPrimary,
        outline: 'none', fontFamily: 'inherit',
        transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
        width: 200,
        boxSizing: 'border-box',
        ...style,
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

function Toggle({ value, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        position: 'relative', width: 44, height: 26, borderRadius: 13,
        background: value ? T.accent : 'rgba(0,0,0,0.15)',
        border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0,
        transition: 'background 0.2s ease',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: value ? 21 : 3,
        width: 20, height: 20, borderRadius: '50%',
        background: '#FFFFFF', boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
        transition: 'left 0.22s cubic-bezier(0.34,1.56,0.64,1)',
      }} />
    </button>
  );
}

function SavedBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12,
      fontWeight: 600, color: '#1C5C2E', background: 'rgba(42,110,58,0.09)',
      padding: '4px 10px', borderRadius: 20,
    }}>
      <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 16 16">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2 8l5 5 7-7"/>
      </svg>
      Saved
    </span>
  );
}

function PrimaryBtn({ children, onClick, type = 'button', disabled = false, size = 'md', danger = false, style = {} }) {
  const h = size === 'sm' ? 32 : 38;
  const px = size === 'sm' ? '0 14px' : '0 18px';
  const fs = size === 'sm' ? 13 : 13.5;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        height: h, padding: px, borderRadius: 10,
        background: danger ? 'oklch(0.50 0.18 28)' : T.accent,
        color: '#FFFFFF', fontWeight: 700, fontSize: fs,
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1, fontFamily: 'inherit',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        transition: 'opacity 0.15s, transform 0.12s',
        ...style,
      }}
    >{children}</button>
  );
}

function GhostBtn({ children, onClick, type = 'button', disabled = false, size = 'md', style = {} }) {
  const h = size === 'sm' ? 32 : 38;
  const px = size === 'sm' ? '0 14px' : '0 16px';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        height: h, padding: px, borderRadius: 10,
        background: 'transparent', color: T.textSecond,
        border: `1px solid ${T.border}`, fontWeight: 600, fontSize: 13.5,
        cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        ...style,
      }}
    >{children}</button>
  );
}

/* ─── Modal shell ──────────────────────────────────────────────────────────── */
function Modal({ onClose, children }) {
  return createPortal(
    <div
      className="modal-backdrop"
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(10,8,6,0.48)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{ background: '#FFFFFF', borderRadius: 20, border: `1px solid ${T.border}`, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}
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
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${T.rowBorder}`, flexShrink: 0 }}>
      <div>
        <h3 style={{ fontWeight: 700, fontSize: 15.5, color: T.textPrimary, margin: 0 }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 12.5, color: T.textMuted, marginTop: 2, marginBottom: 0 }}>{subtitle}</p>}
      </div>
      <button
        onClick={onClose}
        aria-label="Close"
        style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMuted, marginLeft: 12, flexShrink: 0 }}
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
          <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

function ModalInput({ label, required, ...rest }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>{label}{required && ' *'}</label>
      <input
        {...rest}
        required={required}
        style={{
          height: 42, borderRadius: 11,
          border: `1px solid ${focused ? T.accent : T.inputBorder}`,
          background: focused ? '#FFFFFF' : T.inputBg,
          boxShadow: focused ? T.focusShadow : 'none',
          fontSize: 14, color: T.textPrimary, padding: '0 13px',
          outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </div>
  );
}

/* ─── Restaurant Profile ───────────────────────────────────────────────────── */
function RestaurantProfileSection() {
  const [form, setForm] = useState(() => {
    const p = loadPrefs();
    return { restaurantName: p.restaurantName, ownerName: p.ownerName, location: p.location };
  });
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    savePrefs({ ...loadPrefs(), ...form });
    window.dispatchEvent(new Event('smp:prefs-updated'));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const inputStyle = { width: '100%' };

  return (
    <SettingGroup
      icon={<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 1L2 5v9h4v-4h4v4h4V5L8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>}
      title="Restaurant" defaultOpen={false}
    >
      <form onSubmit={handleSave}>
        <SettingRow label="Restaurant Name">
          <SettingInput
            value={form.restaurantName}
            onChange={e => setForm(f => ({ ...f, restaurantName: e.target.value }))}
            placeholder="e.g. Casa Manila"
            style={inputStyle}
          />
        </SettingRow>
        <SettingRow label="Owner / Manager">
          <SettingInput
            value={form.ownerName}
            onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))}
            placeholder="e.g. Maria Santos"
            style={inputStyle}
          />
        </SettingRow>
        <SettingRow label="Location" last>
          <SettingInput
            value={form.location}
            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            placeholder="e.g. Kidapawan City"
            style={inputStyle}
          />
        </SettingRow>
        <div style={{ padding: '12px 18px', borderTop: `1px solid ${T.rowBorder}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <PrimaryBtn type="submit" size="sm">Save</PrimaryBtn>
          {saved && <SavedBadge />}
        </div>
      </form>
    </SettingGroup>
  );
}

/* ─── Preferences ──────────────────────────────────────────────────────────── */
function PreferencesSection() {
  const [prefs, setPrefsState] = useState(() => loadPrefs());
  const [saved, setSaved] = useState(false);

  const update = (key, value) => setPrefsState(p => ({ ...p, [key]: value }));

  const handleSave = (e) => {
    e.preventDefault();
    savePrefs(prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <SettingGroup
      icon={<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.22 3.22l1.41 1.41M11.37 11.37l1.41 1.41M3.22 12.78l1.41-1.41M11.37 4.63l1.41-1.41" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>}
      title="Preferences"
    >
      <form onSubmit={handleSave}>
        <SettingRow label="Price Alert Threshold" hint="Dashboard flags prices older than this">
          <div style={{ width: 180 }}>
            <Select
              value={prefs.alertThresholdDays}
              onChange={v => update('alertThresholdDays', Number(v))}
              options={THRESHOLD_OPTIONS}
            />
          </div>
        </SettingRow>
        <SettingRow label="Default Price Source" hint="Pre-selected in the Cost Computation form">
          <div style={{ width: 180 }}>
            <Select
              value={prefs.defaultPriceSource}
              onChange={v => update('defaultPriceSource', v)}
              options={SOURCE_OPTIONS}
            />
          </div>
        </SettingRow>
        <SettingRow label="Price Gap Limit" hint="Flag when selling price deviates from recommended by more than this">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number" min="1" max="100"
              value={prefs.priceGapThreshold ?? 15}
              onChange={e => update('priceGapThreshold', Math.max(1, Math.min(100, Number(e.target.value))))}
              style={{ width: 64, height: 36, padding: '0 10px', borderRadius: 10, border: `1px solid ${T.inputBorder}`, background: T.inputBg, fontSize: 14, fontWeight: 600, color: T.textPrimary, fontFamily: 'inherit', outline: 'none', textAlign: 'center' }}
            />
            <span style={{ fontSize: 13, color: T.textMuted, width: 16 }}>%</span>
          </div>
        </SettingRow>
        <SettingRow label="Food Cost Deviation Limit" hint="Flag when actual food cost % exceeds target by more than this" last>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number" min="1" max="50"
              value={prefs.foodCostDeviationThreshold ?? 5}
              onChange={e => update('foodCostDeviationThreshold', Math.max(1, Math.min(50, Number(e.target.value))))}
              style={{ width: 64, height: 36, padding: '0 10px', borderRadius: 10, border: `1px solid ${T.inputBorder}`, background: T.inputBg, fontSize: 14, fontWeight: 600, color: T.textPrimary, fontFamily: 'inherit', outline: 'none', textAlign: 'center' }}
            />
            <span style={{ fontSize: 13, color: T.textMuted, width: 28 }}>% pts</span>
          </div>
        </SettingRow>
        <div style={{ padding: '12px 18px', borderTop: `1px solid ${T.rowBorder}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <PrimaryBtn type="submit" size="sm">Save</PrimaryBtn>
          {saved && <SavedBadge />}
        </div>
      </form>
    </SettingGroup>
  );
}

/* ─── Convenience Tools ────────────────────────────────────────────────────── */
function ConvenienceSection() {
  const [calcEnabled, setCalcEnabled] = useState(() => {
    try { return localStorage.getItem('smp_calc_enabled') !== 'false'; } catch { return true; }
  });

  const toggleCalc = () => {
    const next = !calcEnabled;
    setCalcEnabled(next);
    try {
      localStorage.setItem('smp_calc_enabled', next ? 'true' : 'false');
      window.dispatchEvent(new Event('calc-setting-changed'));
    } catch {}
  };

  return (
    <SettingGroup
      icon={<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/><rect x="3.5" y="3.5" width="9" height="2.5" rx="0.8" fill="currentColor" opacity="0.4"/><circle cx="4.5" cy="9.5" r="0.9" fill="currentColor"/><circle cx="8" cy="9.5" r="0.9" fill="currentColor"/><circle cx="11.5" cy="9.5" r="0.9" fill="currentColor"/><circle cx="4.5" cy="12" r="0.9" fill="currentColor"/><circle cx="8" cy="12" r="0.9" fill="currentColor"/><rect x="10" y="11" width="3" height="2.5" rx="0.6" fill="currentColor"/></svg>}
      title="Tools"
    >
      <SettingRow label="Floating Calculator" hint="Quick-access calculator, bottom-right corner" last>
        <Toggle value={calcEnabled} onChange={toggleCalc} />
      </SettingRow>
    </SettingGroup>
  );
}

/* ─── Pricing Profiles ─────────────────────────────────────────────────────── */
function PricingProfilesSection() {
  const toast = useToast();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [modalOpen, setModalOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ label: '', target_food_cost_pct: '', rounding_rule: 'nearest5' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError]     = useState('');

  const fetchProfiles = useCallback(async () => {
    setLoading(true); setError('');
    try { setProfiles((await api.get('/settings')).data.data || []); }
    catch { setError('Failed to load pricing profiles.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);
  useEffect(() => {
    if (!modalOpen) return;
    const h = (e) => { if (e.key === 'Escape') setModalOpen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [modalOpen]);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ label: '', target_food_cost_pct: '', rounding_rule: 'nearest5' });
    setFormError(''); setModalOpen(true);
  };
  const openEdit = (p) => {
    setEditTarget(p);
    setForm({ label: p.label, target_food_cost_pct: String(p.target_food_cost_pct), rounding_rule: p.rounding_rule });
    setFormError(''); setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setFormLoading(true); setFormError('');
    try {
      const payload = { label: form.label.trim(), target_food_cost_pct: parseFloat(form.target_food_cost_pct), rounding_rule: form.rounding_rule };
      if (editTarget) { await api.put(`/settings/${editTarget.id}`, payload); toast.success(`"${payload.label}" updated.`); }
      else { await api.post('/settings', payload); toast.success(`"${payload.label}" added.`); }
      setModalOpen(false); fetchProfiles();
    } catch (err) { setFormError(err.response?.data?.message || 'Something went wrong.'); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async (profile) => {
    try {
      await api.delete(`/settings/${profile.id}`);
      setPendingDelete(null);
      toast.success(`"${profile.label}" deleted.`);
      fetchProfiles();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete.'); }
  };

  return (
    <>
      <SettingGroup
        icon={<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
        title="Pricing Profiles" defaultOpen={true}
        action={
          <button
            type="button" onClick={openAdd}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 12px', borderRadius: 8, background: T.accent, color: '#FFFFFF', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <svg width="9" height="9" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
            Add
          </button>
        }
      >
        {loading ? (
          <div style={{ padding: '16px 18px' }}><SkeletonTable rows={2} cols={3} /></div>
        ) : error ? (
          <div style={{ padding: '16px 18px', fontSize: 13, color: 'oklch(0.58 0.16 28)' }}>{error}</div>
        ) : profiles.length === 0 ? (
          <div style={{ padding: '32px 18px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
            No pricing profiles yet. Add one to get started.
          </div>
        ) : (
          profiles.map((profile, i) => (
            <div
              key={profile.id}
              style={{
                display: 'flex', alignItems: 'center',
                padding: '14px 18px',
                borderBottom: i < profiles.length - 1 ? `1px solid ${T.rowBorder}` : 'none',
                gap: 12,
              }}
            >
              {/* Color swatch */}
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent, flexShrink: 0 }} />

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{profile.label}</div>
              </div>

              {/* Food cost % */}
              <span style={{ fontSize: 13, fontWeight: 700, color: T.accent, fontVariantNumeric: 'tabular-nums', minWidth: 38, textAlign: 'right' }}>
                {profile.target_food_cost_pct}%
              </span>

              {/* Rounding */}
              <span style={{
                fontSize: 11.5, fontWeight: 600, color: T.textSecond,
                background: 'rgba(0,0,0,0.04)', borderRadius: 6, padding: '3px 8px',
                whiteSpace: 'nowrap',
              }}>
                {ROUNDING_LABELS[profile.rounding_rule] ?? profile.rounding_rule}
              </span>

              {/* Actions */}
              {pendingDelete === profile.id ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                  <span style={{ color: T.textSecond }}>Delete?</span>
                  <button onClick={() => handleDelete(profile)} style={{ fontSize: 12.5, fontWeight: 700, color: 'oklch(0.52 0.18 28)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Yes</button>
                  <button onClick={() => setPendingDelete(null)} style={{ fontSize: 12.5, fontWeight: 600, color: T.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>No</button>
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={() => openEdit(profile)} style={{ padding: '4px 8px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, color: T.textSecond, background: 'rgba(0,0,0,0.04)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                  <button onClick={() => setPendingDelete(profile.id)} style={{ padding: '4px 8px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, color: 'oklch(0.52 0.18 28)', background: 'rgba(239,68,68,0.06)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
                </span>
              )}
            </div>
          ))
        )}
      </SettingGroup>

      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)}>
          <ModalHeader
            title={editTarget ? 'Edit Profile' : 'New Pricing Profile'}
            subtitle={editTarget ? `Editing "${editTarget.label}"` : 'Set food-cost target and rounding rule'}
            onClose={() => setModalOpen(false)}
          />
          <form onSubmit={handleSubmit} style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
            <ModalInput
              label="Label" required
              placeholder="e.g. Default, High Margin"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              autoFocus
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>Target Food Cost % *</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="number" min="1" max="100" step="0.01" placeholder="35" required
                  value={form.target_food_cost_pct}
                  onChange={e => setForm(f => ({ ...f, target_food_cost_pct: e.target.value }))}
                  style={{ flex: 1, height: 42, borderRadius: 11, border: `1px solid ${T.inputBorder}`, background: T.inputBg, fontSize: 14, color: T.textPrimary, padding: '0 13px', outline: 'none', fontFamily: 'inherit' }}
                />
                <span style={{ color: T.textMuted, fontSize: 14, fontWeight: 600 }}>%</span>
              </div>
              <p style={{ fontSize: 11.5, color: T.textMuted, margin: 0 }}>Industry standard: 25–40%</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>Rounding Rule *</label>
              <Select
                value={form.rounding_rule}
                onChange={v => setForm(f => ({ ...f, rounding_rule: v }))}
                options={ROUNDING_OPTIONS}
              />
            </div>
            {formError && <p style={{ color: 'oklch(0.58 0.16 28)', fontSize: 13, margin: 0 }}>{formError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
              <GhostBtn type="button" onClick={() => setModalOpen(false)}>Cancel</GhostBtn>
              <PrimaryBtn type="submit" disabled={formLoading}>
                {formLoading ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Profile'}
              </PrimaryBtn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

/* ─── Data & Export ────────────────────────────────────────────────────────── */
const EXPORT_SLICES = [
  {
    key: 'ingredients',
    label: 'Ingredients & Prices',
    hint: 'All ingredients and their full price history',
    filename: 'ingredients-prices',
    pick: d => ({ exported_at: d.exported_at, ingredients: d.ingredients, ingredient_prices: d.ingredient_prices }),
  },
  {
    key: 'recipes',
    label: 'Recipes',
    hint: 'All recipes and their ingredient quantities',
    filename: 'recipes',
    pick: d => ({ exported_at: d.exported_at, recipes: d.recipes, recipe_ingredients: d.recipe_ingredients }),
  },
  {
    key: 'costing',
    label: 'Costing History',
    hint: 'All cost computation snapshots',
    filename: 'costing-history',
    pick: d => ({ exported_at: d.exported_at, costing_outputs: d.costing_outputs }),
  },
  {
    key: 'settings',
    label: 'Pricing Profiles',
    hint: 'All pricing profiles and their rules',
    filename: 'pricing-profiles',
    pick: d => ({ exported_at: d.exported_at, pricing_settings: d.pricing_settings }),
  },
];

function DataSection() {
  const toast   = useToast();
  const cache   = useState(null);          // [data, setData]
  const setCache = cache[1];
  const dataRef = { current: cache[0] };

  const [loading, setLoading] = useState(false);
  const [active,  setActive]  = useState(null); // which slice key is downloading

  const fetchData = async () => {
    if (dataRef.current) return dataRef.current;
    setLoading(true);
    try {
      const res = await api.get('/export');
      const d   = res.data.data;
      setCache(d);
      dataRef.current = d;
      return d;
    } catch {
      toast.error('Export failed. Please try again.');
      return null;
    } finally { setLoading(false); }
  };

  const download = (payload, filename) => {
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const handleSlice = async (slice) => {
    setActive(slice.key);
    const d = await fetchData();
    if (d) download(slice.pick(d), slice.filename);
    setActive(null);
  };

  const handleAll = async () => {
    setActive('all');
    const d = await fetchData();
    if (d) download(d, 'smart-menu-pricing-full-backup');
    setActive(null);
  };

  const DownloadBtn = ({ sliceKey, onClick }) => (
    <button
      onClick={onClick}
      disabled={loading || active !== null}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        height: 30, padding: '0 12px', borderRadius: 8,
        background: 'rgba(0,0,0,0.04)', color: T.textSecond,
        border: `1px solid ${T.border}`, fontWeight: 600, fontSize: 12.5,
        cursor: (loading || active !== null) ? 'not-allowed' : 'pointer',
        opacity: (active !== null && active !== sliceKey) ? 0.45 : 1,
        fontFamily: 'inherit', transition: 'opacity 0.15s',
      }}
    >
      {active === sliceKey ? (
        '…'
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v8M5 7l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Export
        </>
      )}
    </button>
  );

  return (
    <SettingGroup
      icon={<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      title="Data"
    >
      {EXPORT_SLICES.map((slice, i) => (
        <SettingRow key={slice.key} label={slice.label} hint={slice.hint}>
          <DownloadBtn sliceKey={slice.key} onClick={() => handleSlice(slice)} />
        </SettingRow>
      ))}

      {/* Divider before full backup */}
      <div style={{ margin: '0 18px', borderTop: `1px solid ${T.rowBorder}` }} />

      <SettingRow label="Full Backup" hint="Everything — all tables in one file" last>
        <button
          onClick={handleAll}
          disabled={loading || active !== null}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            height: 30, padding: '0 12px', borderRadius: 8,
            background: T.accent, color: '#FFFFFF',
            border: 'none', fontWeight: 700, fontSize: 12.5,
            cursor: (loading || active !== null) ? 'not-allowed' : 'pointer',
            opacity: (active !== null && active !== 'all') ? 0.45 : 1,
            fontFamily: 'inherit', transition: 'opacity 0.15s',
          }}
        >
          {active === 'all' ? '…' : (
            <>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8M5 7l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Export All
            </>
          )}
        </button>
      </SettingRow>
    </SettingGroup>
  );
}

/* ─── About ────────────────────────────────────────────────────────────────── */
function AboutSection() {
  const prefs = loadPrefs();
  const rows = [
    { label: 'System',    value: 'Smart Menu Pricing' },
    { label: 'Version',   value: 'Sprint 4 Final' },
    { label: 'Stack',     value: 'React + Node.js + MySQL' },
    { label: 'Coverage',  value: 'Kidapawan City, Philippines' },
  ];

  return (
    <SettingGroup
      icon={<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/><line x1="8" y1="7" x2="8" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="5.5" r="0.5" fill="currentColor"/></svg>}
      iconBg="rgba(0,0,0,0.05)" iconColor={T.textMuted}
      title="About"
    >
      {rows.map((r, i) => (
        <SettingRow key={r.label} label={r.label} last={i === rows.length - 1 && !prefs.restaurantName}>
          <span style={{ fontSize: 13, color: T.textMuted }}>{r.value}</span>
        </SettingRow>
      ))}
      {prefs.restaurantName && (
        <SettingRow label="Configured for" last>
          <span style={{ fontSize: 13, color: T.textSecond, fontWeight: 600 }}>
            {prefs.restaurantName}{prefs.location ? ` · ${prefs.location}` : ''}
          </span>
        </SettingRow>
      )}
    </SettingGroup>
  );
}

/* ─── Reset (admin only) ───────────────────────────────────────────────────── */
function ResetSection() {
  const toast = useToast();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false);
  const user = getUser();
  if (user?.role !== 'admin') return null;

  const handleReset = async () => {
    setLoading(true);
    try {
      await api.post('/reset');
      setShowConfirm(false);
      toast.success('System reset. Ready for new tester.');
      setTimeout(() => window.location.replace('/'), 1200);
    } catch (err) { toast.error(err.response?.data?.message || 'Reset failed'); }
    finally { setLoading(false); }
  };

  return (
    <>
      <SettingGroup
        icon={<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2.5 8A5.5 5.5 0 1 0 8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M8 2.5L5.5 2.5L5.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        iconBg="rgba(239,68,68,0.08)" iconColor="oklch(0.52 0.18 28)"
        title="System Reset"
      >
        <SettingRow
          label="Reset for New Tester"
          hint="Wipes all data and restores seed ingredients — cannot be undone"
          last
        >
          <button
            onClick={() => setShowConfirm(true)}
            style={{ height: 32, padding: '0 14px', borderRadius: 8, background: 'rgba(239,68,68,0.07)', color: 'oklch(0.50 0.18 28)', fontWeight: 700, fontSize: 12.5, border: '1px solid rgba(239,68,68,0.18)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Reset
          </button>
        </SettingRow>
      </SettingGroup>

      {showConfirm && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.48)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="modal-content" style={{ background: '#FFFFFF', borderRadius: 16, padding: '28px', maxWidth: 380, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.22)', border: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ background: 'rgba(239,68,68,0.09)', borderRadius: 9, padding: 7, display: 'flex' }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 4v4m0 3v1" stroke="oklch(0.50 0.18 28)" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </div>
              <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: T.textPrimary }}>Reset system?</h3>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: T.textSecond, lineHeight: 1.55 }}>
              All recipes, ingredients, prices, and costing history will be deleted. The system will restore seed data. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <GhostBtn onClick={() => setShowConfirm(false)} disabled={loading}>Cancel</GhostBtn>
              <PrimaryBtn onClick={handleReset} disabled={loading} danger>
                {loading ? 'Resetting…' : 'Yes, reset everything'}
              </PrimaryBtn>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/* ─── CSS injected once for layout + animations ────────────────────────────── */
const SETTINGS_CSS = `
@keyframes smpSlideIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.smp-settings {
  display: flex;
  align-items: flex-start;
  width: 100%;
  min-height: calc(100vh - 120px);
}
.smp-nav {
  width: 210px;
  flex-shrink: 0;
  position: sticky;
  top: 24px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  padding-right: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.smp-panel {
  flex: 1;
  min-width: 0;
  padding-left: 28px;
  border-left: 1px solid rgba(0,0,0,0.06);
}
.smp-content {
  animation: smpSlideIn 0.28s cubic-bezier(0.16,1,0.3,1);
}
.smp-nav-divider {
  height: 1px;
  background: rgba(0,0,0,0.06);
  margin: 6px 4px;
}
/* ── Mobile: horizontal tab strip ── */
@media (max-width: 700px) {
  .smp-settings { flex-direction: column; min-height: unset; }
  .smp-nav {
    width: 100%;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    position: static;
    max-height: none;
    padding-right: 0;
    padding-bottom: 2px;
    gap: 4px;
    border-bottom: 1px solid rgba(0,0,0,0.06);
    margin-bottom: 20px;
  }
  .smp-nav-divider { display: none; }
  .smp-panel {
    padding-left: 0;
    border-left: none;
  }
}
`;

/* ─── Left nav item ────────────────────────────────────────────────────────── */
function NavItem({ icon, iconBg, iconColor, label, active, onClick, danger }) {
  const [hover, setHover] = useState(false);
  const bg = active
    ? (danger ? 'rgba(239,68,68,0.08)' : 'rgba(42,110,58,0.09)')
    : hover ? 'rgba(0,0,0,0.04)' : 'transparent';
  const textColor = active
    ? (danger ? 'oklch(0.50 0.18 28)' : T.accent)
    : hover ? T.textPrimary : T.textSecond;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '9px 10px', borderRadius: 10,
        background: bg, border: 'none', cursor: 'pointer',
        fontFamily: 'inherit', textAlign: 'left', flexShrink: 0,
        transition: 'background 0.14s',
      }}
    >
      <div style={{
        width: 26, height: 26, borderRadius: 7,
        background: active ? iconBg : 'rgba(0,0,0,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        transition: 'background 0.14s',
      }}>
        <span style={{ color: active ? iconColor : T.textMuted, display: 'flex', transition: 'color 0.14s' }}>
          {icon}
        </span>
      </div>
      <span style={{
        fontSize: 13, fontWeight: active ? 600 : 500, color: textColor,
        whiteSpace: 'nowrap', transition: 'color 0.14s, font-weight 0.14s',
      }}>
        {label}
      </span>
    </button>
  );
}

/* ─── Section config ───────────────────────────────────────────────────────── */
const NAV_SECTIONS = [
  {
    key: 'restaurant', label: 'Restaurant', group: 'main',
    iconBg: 'rgba(42,110,58,0.09)', iconColor: '#2A6E3A',
    icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 1L2 5v9h4v-4h4v4h4V5L8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>,
    Component: RestaurantProfileSection,
  },
  {
    key: 'preferences', label: 'Preferences', group: 'main',
    iconBg: 'rgba(42,110,58,0.09)', iconColor: '#2A6E3A',
    icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.22 3.22l1.41 1.41M11.37 11.37l1.41 1.41M3.22 12.78l1.41-1.41M11.37 4.63l1.41-1.41" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
    Component: PreferencesSection,
  },
  {
    key: 'tools', label: 'Tools', group: 'main',
    iconBg: 'rgba(42,110,58,0.09)', iconColor: '#2A6E3A',
    icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/><rect x="3.5" y="3.5" width="9" height="2.5" rx="0.8" fill="currentColor" opacity="0.4"/><circle cx="4.5" cy="9.5" r="0.9" fill="currentColor"/><circle cx="8" cy="9.5" r="0.9" fill="currentColor"/><circle cx="11.5" cy="9.5" r="0.9" fill="currentColor"/><circle cx="4.5" cy="12" r="0.9" fill="currentColor"/><circle cx="8" cy="12" r="0.9" fill="currentColor"/><rect x="10" y="11" width="3" height="2.5" rx="0.6" fill="currentColor"/></svg>,
    Component: ConvenienceSection,
  },
  {
    key: 'pricing', label: 'Pricing Profiles', group: 'system',
    iconBg: 'rgba(42,110,58,0.09)', iconColor: '#2A6E3A',
    icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
    Component: PricingProfilesSection,
  },
  {
    key: 'data', label: 'Data', group: 'system',
    iconBg: 'rgba(42,110,58,0.09)', iconColor: '#2A6E3A',
    icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    Component: DataSection,
  },
  {
    key: 'about', label: 'About', group: 'system',
    iconBg: 'rgba(0,0,0,0.05)', iconColor: '#8E8E93',
    icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/><line x1="8" y1="7" x2="8" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="5.5" r="0.5" fill="currentColor"/></svg>,
    Component: AboutSection,
  },
];

const RESET_NAV_ITEM = {
  key: 'reset', label: 'System Reset', group: 'danger', danger: true,
  iconBg: 'rgba(239,68,68,0.08)', iconColor: 'oklch(0.52 0.18 28)',
  icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2.5 8A5.5 5.5 0 1 0 8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M8 2.5L5.5 2.5L5.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Component: ResetSection,
};

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function Settings() {
  const user = getUser();
  const sections = user?.role === 'admin' ? [...NAV_SECTIONS, RESET_NAV_ITEM] : NAV_SECTIONS;

  const [active,  setActive]  = useState('pricing');
  const [animKey, setAnimKey] = useState(0);

  const switchTo = (key) => {
    if (key === active) return;
    setActive(key);
    setAnimKey(k => k + 1);
  };

  const current = sections.find(s => s.key === active);

  /* Inject CSS once */
  useEffect(() => {
    const id = 'smp-settings-styles';
    if (!document.getElementById(id)) {
      const el = document.createElement('style');
      el.id = id;
      el.textContent = SETTINGS_CSS;
      document.head.appendChild(el);
    }
  }, []);

  /* Group nav items with dividers */
  const navItems = [];
  let lastGroup = null;
  sections.forEach((s) => {
    if (lastGroup && s.group !== lastGroup) {
      navItems.push({ divider: true, key: `div-${s.group}` });
    }
    navItems.push(s);
    lastGroup = s.group;
  });

  return (
    <div className="smp-settings">
      {/* ── Left nav ── */}
      <nav className="smp-nav">
        {navItems.map(item =>
          item.divider ? (
            <div key={item.key} className="smp-nav-divider" />
          ) : (
            <NavItem
              key={item.key}
              icon={item.icon}
              iconBg={item.iconBg}
              iconColor={item.iconColor}
              label={item.label}
              active={active === item.key}
              danger={item.danger}
              onClick={() => switchTo(item.key)}
            />
          )
        )}
      </nav>

      {/* ── Right panel ── */}
      <SettingsModeCtx.Provider value="panel">
        <div className="smp-panel">
          {current && (
            <div key={animKey} className="smp-content">
              <current.Component />
            </div>
          )}
        </div>
      </SettingsModeCtx.Provider>
    </div>
  );
}
