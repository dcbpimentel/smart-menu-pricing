import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/api';
import { getUser } from '../lib/auth';

const T = {
  accent:      '#2A6E3A',
  accentLight: 'oklch(0.957 0.036 148)',
  textPrimary: '#1A1512',
  textSecond:  '#6B5E50',
  textMuted:   '#8C7C6C',
  inputBorder: '#E4D8C4',
  inputBg:     '#FDF9F5',
  focusShadow: '0 0 0 3.5px oklch(0.942 0.044 148)',
  cardBorder:  '1px solid #ECE4D4',
  divider:     '1px solid #F2E9DC',
};

function inits(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] || 'U').toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ── Avatar ── */
function Avatar({ name, role, size = 44 }) {
  const isAdmin = role === 'admin';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: isAdmin
        ? 'linear-gradient(140deg, #1A3E12 0%, #2A6E3A 100%)'
        : 'oklch(0.94 0.03 60)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.34), fontWeight: 800,
      color: isAdmin ? '#FFFFFF' : T.accent,
      letterSpacing: '-0.02em',
      boxShadow: isAdmin ? '0 3px 10px rgba(42,110,58,0.28)' : '0 2px 6px rgba(0,0,0,0.07)',
    }}>
      {inits(name)}
    </div>
  );
}

/* ── Role pill ── */
function RolePill({ role }) {
  const isAdmin = role === 'admin';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
      background: isAdmin ? 'oklch(0.955 0.058 145)' : 'rgba(139,92,246,0.09)',
      color: isAdmin ? 'oklch(0.44 0.12 145)' : '#6D28D9',
      border: `1px solid ${isAdmin ? 'oklch(0.88 0.09 145)' : 'rgba(139,92,246,0.2)'}`,
    }}>
      {isAdmin ? (
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
          <path d="M6 1l1.5 3H11l-2.7 2 1 3.1L6 7.3 2.7 9.1l1-3.1L1 4h3.5L6 1z" fill="currentColor"/>
        </svg>
      ) : (
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="4" r="2.2" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M2 10.5c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      )}
      {isAdmin ? 'Admin' : 'Staff'}
    </span>
  );
}

/* ── Status dot ── */
function StatusDot({ active }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: active ? 'oklch(0.44 0.12 145)' : '#9CA3AF' }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
        background: active ? '#22c55e' : '#D1D5DB',
        boxShadow: active ? '0 0 0 2.5px rgba(34,197,94,0.2)' : 'none',
      }} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

/* ── Text input ── */
function TextInput({ value, onChange, type = 'text', placeholder, suffix, autoComplete, disabled }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        style={{
          width: '100%',
          padding: suffix ? '10px 40px 10px 13px' : '10px 13px',
          fontSize: 14, fontFamily: 'inherit',
          border: `1.5px solid ${focused ? T.accent : T.inputBorder}`,
          borderRadius: 10,
          background: disabled ? '#F8F4EF' : T.inputBg,
          color: disabled ? T.textMuted : T.textPrimary,
          outline: 'none', boxSizing: 'border-box',
          boxShadow: focused ? T.focusShadow : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          cursor: disabled ? 'default' : 'text',
        }}
        onFocus={() => !disabled && setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {suffix && (
        <div style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)' }}>
          {suffix}
        </div>
      )}
    </div>
  );
}

/* ── Eye toggle ── */
function EyeBtn({ show, onToggle }) {
  return (
    <button type="button" onClick={onToggle}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, display: 'flex', alignItems: 'center', padding: 0 }}>
      {show ? (
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
          <path d="M3 3l14 14M8.46 8.52A3 3 0 0 0 13.5 13.5M6.14 5.14C4.04 6.4 2.5 8.05 2.5 10c0 2 2.73 5.5 7.5 5.5a9.3 9.3 0 0 0 3.86-.85M10 4.5C14.77 4.5 17.5 8 17.5 10c0 .95-.51 2.05-1.36 3.04" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
          <ellipse cx="10" cy="10" rx="7.5" ry="5.5" stroke="currentColor" strokeWidth="1.4"/>
          <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
        </svg>
      )}
    </button>
  );
}

/* ── Native role select — more reliable than a custom dropdown inside a modal ── */
function RoleSelect({ value, onChange }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '10px 36px 10px 13px',
          fontSize: 14, fontFamily: 'inherit', fontWeight: 600,
          border: `1.5px solid ${focused ? T.accent : T.inputBorder}`,
          borderRadius: 10,
          background: T.inputBg, color: T.textPrimary,
          outline: 'none', appearance: 'none', cursor: 'pointer',
          boxShadow: focused ? T.focusShadow : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          boxSizing: 'border-box',
        }}
      >
        <option value="staff">Staff</option>
        <option value="admin">Admin</option>
      </select>
      <div style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.textMuted }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}

/* ── Field label wrapper ── */
function Field({ label, hint, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: T.textSecond, marginBottom: hint ? 2 : 7 }}>{label}</label>
      {hint && <p style={{ margin: '0 0 7px', fontSize: 11.5, color: T.textMuted }}>{hint}</p>}
      {children}
    </div>
  );
}

/* ── Error message ── */
function ErrorMsg({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(185,28,28,0.06)', border: '1px solid rgba(185,28,28,0.18)', fontSize: 13, color: '#9b1c1c', fontWeight: 500 }}>
      {msg}
    </div>
  );
}

/*
 * ── Modal — fixed header + scrollable body + pinned footer ──
 * Key design decisions:
 * - z-index: 9999 ensures it's above the sidebar (z-index ~30-50) and topbar
 * - align-items: flex-start + padding-top: 60px so the modal is never clipped at the top
 * - flex column layout: header (fixed) + body (scrollable) + footer (fixed)
 * - No avatar in the sheet body — avatar goes inline in the header next to the title
 */
function Modal({ title, subtitle, avatarName, avatarRole, onClose, footer, children }) {
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px 16px',
        background: 'rgba(10,8,6,0.52)',
        backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)',
        animation: 'fadeIn 0.15s ease both',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FFFFFF', borderRadius: 18,
          width: '100%', maxWidth: 400,
          maxHeight: 'calc(100vh - 40px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)',
          display: 'flex', flexDirection: 'column',
          animation: 'modalIn 0.2s cubic-bezier(0.22, 1, 0.36, 1) both',
        }}
      >
        {/* ── Sticky header ── */}
        <div style={{
          padding: '18px 20px 16px',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 10,
          borderBottom: '1px solid #F2E9DC',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
            {avatarName && <Avatar name={avatarName} role={avatarRole} size={36} />}
            <div style={{ minWidth: 0 }}>
              <h3 style={{
                margin: 0, fontSize: 15.5, fontWeight: 800, color: T.textPrimary,
                letterSpacing: '-0.02em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{title}</h3>
              {subtitle && (
                <p style={{
                  margin: '2px 0 0', fontSize: 12, color: T.textMuted,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{subtitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              border: 'none', background: '#F0E8DC',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: T.textMuted,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#E5DBCD'}
            onMouseLeave={e => e.currentTarget.style.background = '#F0E8DC'}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ── Scrollable body — flex:1 + minHeight:0 lets it shrink within maxHeight ── */}
        <div style={{ padding: '20px 20px 4px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {children}
        </div>

        {/* ── Pinned footer — always visible, never scrolls ── */}
        <div style={{ padding: '14px 20px 20px', display: 'flex', gap: 8, flexShrink: 0 }}>
          {footer}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Skeleton row ── */
function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#F2E9DC', flexShrink: 0, animation: 'pulse 1.4s ease infinite' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ width: '44%', height: 13, borderRadius: 6, background: '#F2E9DC', animation: 'pulse 1.4s ease infinite' }} />
        <div style={{ width: '28%', height: 11, borderRadius: 6, background: '#F2E9DC', animation: 'pulse 1.4s 0.1s ease infinite' }} />
      </div>
      <div style={{ width: 56, height: 22, borderRadius: 20, background: '#F2E9DC', animation: 'pulse 1.4s ease infinite' }} />
    </div>
  );
}

const EMPTY_ADD = { full_name: '', username: '', role: 'staff', password: '' };

export default function Team() {
  const currentUser = getUser();
  const isAdmin = currentUser?.role === 'admin';

  const [users,      setUsers]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showAdd,    setShowAdd]    = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [toastMsg,   setToastMsg]   = useState('');
  const toastTimer = useRef(null);

  const [addForm,   setAddForm]   = useState(EMPTY_ADD);
  const [addError,  setAddError]  = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [showAddPw, setShowAddPw] = useState(false);

  const [editForm,   setEditForm]   = useState({ full_name: '', role: 'staff' });
  const [editError,  setEditError]  = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const toast = (msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 3000);
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data.data);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadUsers();
    else setLoading(false);
  }, [isAdmin]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddSaving(true);
    setAddError('');
    try {
      await api.post('/users', addForm);
      setShowAdd(false);
      setAddForm(EMPTY_ADD);
      setShowAddPw(false);
      toast('Team member added.');
      loadUsers();
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to create account.');
    } finally {
      setAddSaving(false);
    }
  };

  const openEdit = (u) => {
    setEditTarget(u);
    setEditForm({ full_name: u.full_name, role: u.role });
    setEditError('');
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    setEditError('');
    try {
      await api.put(`/users/${editTarget.id}`, editForm);
      setEditTarget(null);
      toast('Changes saved.');
      loadUsers();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to save changes.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggle = async (u) => {
    try {
      await api.patch(`/users/${u.id}/toggle`);
      toast(`${u.full_name} ${u.is_active ? 'deactivated' : 'reactivated'}.`);
      loadUsers();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to update status.');
    }
  };

  /* ── Non-admin guard ── */
  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360, gap: 14, textAlign: 'center', padding: 32 }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: 'rgba(185,28,28,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b91c1c' }}>
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
            <path d="M14 4L4 22h20L14 4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M14 11v5M14 18.5v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: T.textPrimary, letterSpacing: '-0.025em' }}>Access restricted</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: T.textMuted, maxWidth: 260, lineHeight: 1.6 }}>
            Team management is only available to Administrators.
          </p>
        </div>
      </div>
    );
  }

  const admins = users.filter(u => u.role === 'admin');
  const staff  = users.filter(u => u.role === 'staff');
  const active = users.filter(u => u.is_active);

  return (
    <div style={{ maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Toast ── */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10000, padding: '12px 22px', borderRadius: 99,
          background: T.textPrimary, color: '#FFFFFF',
          fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.01em',
          boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
          animation: 'fadeIn 0.18s ease both',
          whiteSpace: 'nowrap',
        }}>
          {toastMsg}
        </div>
      )}

      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'Members', value: users.length },
            { label: 'Admins',  value: admins.length },
            { label: 'Staff',   value: staff.length },
            { label: 'Active',  value: active.length },
          ].map(({ label, value }) => (
            <div key={label} style={{
              padding: '8px 16px',
              background: '#FFFFFF', border: T.cardBorder, borderRadius: 12,
              display: 'flex', alignItems: 'baseline', gap: 7,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: T.textPrimary, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
                {loading ? '—' : value}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={() => { setShowAdd(true); setAddError(''); setAddForm(EMPTY_ADD); setShowAddPw(false); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '10px 20px', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
            color: '#FFFFFF', background: T.accent, border: 'none', borderRadius: 12,
            cursor: 'pointer', boxShadow: '0 2px 10px rgba(42,110,58,0.28)',
            transition: 'background 0.15s, transform 0.1s, box-shadow 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#215730'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(42,110,58,0.36)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = T.accent; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 10px rgba(42,110,58,0.28)'; }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Add member
        </button>
      </div>

      {/* ── Member list ── */}
      <div style={{ background: '#FFFFFF', border: T.cardBorder, borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{
          padding: '13px 20px 11px', borderBottom: T.cardBorder, background: '#FDFAF6',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Team members</span>
          {!loading && users.length > 0 && (
            <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>{users.length} {users.length === 1 ? 'person' : 'people'}</span>
          )}
        </div>

        {loading && [0, 1, 2].map(i => (
          <div key={i} style={{ borderBottom: i < 2 ? T.divider : 'none' }}><SkeletonRow /></div>
        ))}

        {!loading && users.length === 0 && (
          <div style={{ padding: '52px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
            <div style={{ width: 50, height: 50, borderRadius: 16, background: T.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.accent }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="9" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M3 20c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                <path d="M17 11v6M20 14h-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>No team members yet</div>
              <div style={{ fontSize: 13, color: T.textMuted }}>Add your first member to get started.</div>
            </div>
          </div>
        )}

        {!loading && users.map((u, i) => {
          const isMe    = u.id === currentUser?.id;
          const hovered = hoveredRow === u.id;
          return (
            <div
              key={u.id}
              onMouseEnter={() => setHoveredRow(u.id)}
              onMouseLeave={() => setHoveredRow(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '13px 20px',
                borderBottom: i < users.length - 1 ? T.divider : 'none',
                background: hovered ? '#FDFAF6' : 'transparent',
                transition: 'background 0.12s',
                opacity: !u.is_active ? 0.6 : 1,
              }}
            >
              <Avatar name={u.full_name} role={u.role} size={44} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.full_name}
                  </span>
                  {isMe && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, background: '#F2E9DC', padding: '1px 7px', borderRadius: 20, flexShrink: 0 }}>You</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, color: T.textMuted, fontWeight: 500 }}>@{u.username}</span>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: T.inputBorder, display: 'inline-block', flexShrink: 0 }} />
                  <RolePill role={u.role} />
                </div>
              </div>

              {/* Status fades; actions appear on hover */}
              <div style={{ flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center' }}>
                <div style={{ transition: 'opacity 0.15s', opacity: hovered ? 0 : 1, pointerEvents: 'none' }}>
                  <StatusDot active={u.is_active} />
                </div>
                <div style={{
                  position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
                  display: 'flex', gap: 6, whiteSpace: 'nowrap',
                  opacity: hovered ? 1 : 0,
                  transition: 'opacity 0.15s',
                  pointerEvents: hovered ? 'auto' : 'none',
                }}>
                  <button
                    onClick={() => openEdit(u)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '6px 11px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                      border: T.cardBorder, borderRadius: 8,
                      background: '#FFFFFF', color: T.textSecond,
                      cursor: 'pointer', transition: 'background 0.12s, color 0.12s, border-color 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = T.accentLight; e.currentTarget.style.color = T.accent; e.currentTarget.style.borderColor = 'oklch(0.88 0.08 148)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.color = T.textSecond; e.currentTarget.style.borderColor = '#ECE4D4'; }}
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M8.5 1.5a1.5 1.5 0 0 1 2.1 2.1L4 10.3l-2.8.5.5-2.8L8.5 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Edit
                  </button>
                  <button
                    onClick={() => !isMe && handleToggle(u)}
                    disabled={isMe}
                    title={isMe ? 'Cannot deactivate your own account' : (u.is_active ? 'Deactivate' : 'Reactivate')}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '6px 11px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                      borderRadius: 8, cursor: isMe ? 'not-allowed' : 'pointer',
                      opacity: isMe ? 0.38 : 1,
                      border: u.is_active ? '1px solid rgba(185,28,28,0.22)' : '1px solid rgba(22,163,74,0.28)',
                      background: u.is_active ? 'rgba(185,28,28,0.06)' : 'rgba(22,163,74,0.06)',
                      color: u.is_active ? '#b91c1c' : '#15803d',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { if (!isMe) e.currentTarget.style.background = u.is_active ? 'rgba(185,28,28,0.12)' : 'rgba(22,163,74,0.12)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = u.is_active ? 'rgba(185,28,28,0.06)' : 'rgba(22,163,74,0.06)'; }}
                  >
                    {u.is_active ? (
                      <>
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
                          <path d="M4 4l4 4M8 4L4 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                        Deactivate
                      </>
                    ) : (
                      <>
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
                          <path d="M4.5 6l1.5 1.5L8.5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Reactivate
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Add member modal ── */}
      {showAdd && (
        <Modal
          title="Add team member"
          subtitle="They'll be able to sign in immediately."
          onClose={() => setShowAdd(false)}
          footer={
            <>
              <button type="button" onClick={() => setShowAdd(false)}
                style={{ flex: 1, padding: '10px 0', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', color: T.textSecond, background: '#FDFAF6', border: T.cardBorder, borderRadius: 10, cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" form="add-form" disabled={addSaving}
                style={{ flex: 2, padding: '10px 0', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', color: '#FFFFFF', background: T.accent, border: 'none', borderRadius: 10, cursor: addSaving ? 'not-allowed' : 'pointer', opacity: addSaving ? 0.72 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 2px 10px rgba(42,110,58,0.25)' }}>
                {addSaving && <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite' }} />}
                Create account
              </button>
            </>
          }
        >
          <form id="add-form" onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Full name">
              <TextInput
                value={addForm.full_name}
                onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="e.g. Maria Santos"
                autoComplete="name"
              />
            </Field>
            <Field label="Username" hint="Used to sign in — no spaces.">
              <TextInput
                value={addForm.username}
                onChange={e => setAddForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, '') }))}
                placeholder="e.g. maria.santos"
                autoComplete="username"
              />
            </Field>
            <Field label="Role">
              <RoleSelect value={addForm.role} onChange={val => setAddForm(f => ({ ...f, role: val }))} />
            </Field>
            <Field label="Password" hint="Minimum 6 characters.">
              <TextInput
                type={showAddPw ? 'text' : 'password'}
                value={addForm.password}
                onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Set a password"
                autoComplete="new-password"
                suffix={<EyeBtn show={showAddPw} onToggle={() => setShowAddPw(v => !v)} />}
              />
            </Field>
            <ErrorMsg msg={addError} />
          </form>
        </Modal>
      )}

      {/* ── Edit member modal ── */}
      {editTarget && (
        <Modal
          title={editTarget.full_name}
          subtitle={`@${editTarget.username}`}
          avatarName={editTarget.full_name}
          avatarRole={editTarget.role}
          onClose={() => setEditTarget(null)}
          footer={
            <>
              <button type="button" onClick={() => setEditTarget(null)}
                style={{ flex: 1, padding: '10px 0', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', color: T.textSecond, background: '#FDFAF6', border: T.cardBorder, borderRadius: 10, cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" form="edit-form" disabled={editSaving}
                style={{ flex: 2, padding: '10px 0', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', color: '#FFFFFF', background: T.accent, border: 'none', borderRadius: 10, cursor: editSaving ? 'not-allowed' : 'pointer', opacity: editSaving ? 0.72 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 2px 10px rgba(42,110,58,0.25)' }}>
                {editSaving && <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite' }} />}
                Save changes
              </button>
            </>
          }
        >
          <form id="edit-form" onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Full name">
              <TextInput
                value={editForm.full_name}
                onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Full name"
                autoComplete="name"
              />
            </Field>
            <Field label="Username" hint="Username cannot be changed.">
              <TextInput value={editTarget.username} disabled />
            </Field>
            <Field label="Role">
              <RoleSelect value={editForm.role} onChange={val => setEditForm(f => ({ ...f, role: val }))} />
            </Field>
            <ErrorMsg msg={editError} />
          </form>
        </Modal>
      )}

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes pulse   { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
      `}</style>
    </div>
  );
}
