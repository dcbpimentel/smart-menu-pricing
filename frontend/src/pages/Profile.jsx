import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/api';
import { getUser, logout } from '../lib/auth';

const T = {
  accent:      '#2A6E3A',
  accentLight: 'oklch(0.957 0.036 148)',
  textPrimary: '#1A1512',
  textSecond:  '#6B5E50',
  textMuted:   '#8C7C6C',
  inputBorder: '#E4D8C4',
  inputBg:     '#FDF9F5',
  focusShadow: '0 0 0 4px oklch(0.942 0.044 148)',
  divider:     '#F2E9DC',
};

function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] || 'U').toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function TextInput({ value, onChange, disabled, readOnly, type = 'text', placeholder, suffix, autoComplete }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        autoComplete={autoComplete}
        style={{
          width: '100%',
          padding: suffix ? '11px 44px 11px 14px' : '11px 14px',
          fontSize: 14,
          border: `1.5px solid ${focused ? T.accent : T.inputBorder}`,
          borderRadius: 12,
          backgroundColor: readOnly || disabled ? '#FDFAF6' : T.inputBg,
          color: readOnly ? T.textSecond : T.textPrimary,
          outline: 'none',
          boxSizing: 'border-box',
          boxShadow: focused ? T.focusShadow : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          cursor: readOnly ? 'default' : 'text',
          fontFamily: 'inherit',
        }}
        onFocus={() => !readOnly && setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {suffix && (
        <div style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)' }}>
          {suffix}
        </div>
      )}
    </div>
  );
}

function EyeToggle({ show, onToggle }) {
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

function StatusBanner({ msg }) {
  if (!msg.text) return null;
  const ok = !msg.error;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9,
      padding: '10px 14px', borderRadius: 11, marginTop: 14,
      background: ok ? 'oklch(0.965 0.04 148)' : 'rgba(185,28,28,0.06)',
      border: `1px solid ${ok ? 'oklch(0.88 0.08 148)' : 'rgba(185,28,28,0.2)'}`,
      fontSize: 13, color: ok ? 'oklch(0.4 0.12 148)' : '#9b1c1c', fontWeight: 500,
    }}>
      {ok ? (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="8" cy="8" r="6" fill="oklch(0.4 0.12 148)" opacity="0.15"/>
          <path d="M5 8l2.5 2.5L11 5.5" stroke="oklch(0.4 0.12 148)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="8" cy="8" r="6" stroke="#9b1c1c" strokeWidth="1.4"/>
          <path d="M8 5v3.5M8 10.5v.5" stroke="#9b1c1c" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )}
      {msg.text}
    </div>
  );
}

function PasswordStrength({ password }) {
  if (!password) return null;
  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
  const colors = ['', '#dc2626', '#f97316', '#eab308', '#22c55e', '#16a34a'];
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 3, marginBottom: 5 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i <= score ? colors[score] : '#ECE4D4', transition: 'background 0.25s' }} />
        ))}
      </div>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: colors[score] || '#dc2626', transition: 'color 0.25s' }}>
        {labels[score] || 'Weak'}
      </span>
    </div>
  );
}

/* ── Section wrapper ── */
function Section({ label, children }) {
  return (
    <div style={{ padding: '36px 0' }}>
      <p style={{ margin: '0 0 20px', fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: T.textMuted }}>
        {label}
      </p>
      {children}
    </div>
  );
}

/* ── Save button — small, right-aligned ── */
function SaveBtn({ loading, label = 'Save changes' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
      <button
        type="submit"
        disabled={loading}
        style={{
          padding: '9px 20px',
          fontSize: 13, fontWeight: 700,
          color: 'white', backgroundColor: T.accent,
          border: 'none', borderRadius: 10,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.72 : 1,
          display: 'inline-flex', alignItems: 'center', gap: 7,
          fontFamily: 'inherit',
          boxShadow: loading ? 'none' : '0 2px 8px rgba(42,110,58,0.22)',
          transition: 'opacity 0.15s, background 0.15s',
        }}
        onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = '#215730'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = T.accent; }}
      >
        {loading && <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} />}
        {label}
      </button>
    </div>
  );
}

/* ── Account info row ── */
function InfoRow({ label, children, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '13px 0',
      borderBottom: last ? 'none' : `1px solid ${T.divider}`,
    }}>
      <span style={{ fontSize: 13.5, color: T.textMuted, fontWeight: 500 }}>{label}</span>
      <div style={{ fontSize: 13.5, color: T.textPrimary, fontWeight: 600 }}>{children}</div>
    </div>
  );
}

/* ── Form field row ── */
function FormRow({ label, hint, children, last }) {
  return (
    <div style={{ paddingBottom: last ? 0 : 18, marginBottom: last ? 0 : 18, borderBottom: last ? 'none' : `1px solid ${T.divider}` }}>
      <div style={{ marginBottom: 7 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: T.textSecond }}>{label}</label>
        {hint && <p style={{ margin: '2px 0 0', fontSize: 11.5, color: T.textMuted }}>{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export default function Profile() {
  const localUser = getUser();

  const [profile,    setProfile]    = useState(null);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg,    setNameMsg]    = useState({ text: '', error: false });
  const [nameForm,   setNameForm]   = useState({ full_name: localUser?.full_name || '' });

  const [pwForm,    setPwForm]    = useState({ old_password: '', new_password: '', confirm: '' });
  const [pwSaving,  setPwSaving]  = useState(false);
  const [pwMsg,     setPwMsg]     = useState({ text: '', error: false });
  const [showPw,    setShowPw]    = useState({ old: false, new: false, confirm: false });

  const [confirming, setConfirming] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    api.get('/auth/me').then(res => {
      setProfile(res.data.data);
      setNameForm({ full_name: res.data.data.full_name });
    }).catch(() => {});
  }, []);

  const handleNameSave = async (e) => {
    e.preventDefault();
    const trimmed = nameForm.full_name.trim();
    if (!trimmed) return;
    setNameSaving(true);
    setNameMsg({ text: '', error: false });
    try {
      const res = await api.put(`/users/${localUser.id}`, { full_name: trimmed });
      const updated = { ...localUser, full_name: res.data.data.full_name };
      localStorage.setItem('smp_user', JSON.stringify(updated));
      setProfile(p => ({ ...p, full_name: res.data.data.full_name }));
      setNameMsg({ text: 'Display name updated.', error: false });
    } catch (err) {
      setNameMsg({ text: err.response?.data?.message || 'Failed to update name.', error: true });
    } finally {
      setNameSaving(false);
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) {
      setPwMsg({ text: 'New passwords do not match.', error: true }); return;
    }
    if (pwForm.new_password.length < 6) {
      setPwMsg({ text: 'Password must be at least 6 characters.', error: true }); return;
    }
    setPwSaving(true);
    setPwMsg({ text: '', error: false });
    try {
      await api.put('/auth/password', { old_password: pwForm.old_password, new_password: pwForm.new_password });
      setPwMsg({ text: 'Password changed successfully.', error: false });
      setPwForm({ old_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setPwMsg({ text: err.response?.data?.message || 'Failed to change password.', error: true });
    } finally {
      setPwSaving(false);
    }
  };

  const handleLogout = () => {
    setLoggingOut(true);
    setTimeout(logout, 480);
  };

  const displayName  = profile?.full_name || localUser?.full_name || 'User';
  const username     = profile?.username   || localUser?.username  || '';
  const role         = profile?.role === 'admin' ? 'Administrator' : 'Staff';
  const isAdmin      = profile?.role === 'admin';
  const memberSince  = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div style={{ maxWidth: 560 }}>

      {/* ── Logout overlay ── */}
      {loggingOut && createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(18,14,10,0.96)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 20,
          animation: 'authOverlayIn 0.42s cubic-bezier(0.22,1,0.36,1) both',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        }}>
          <div style={{ animation: 'authOverlayLogo 0.42s 0.08s cubic-bezier(0.22,1,0.36,1) both' }}>
            <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 20, padding: '14px 28px' }}>
              <img src="/logo.png" alt="Boyd's Pizza House" style={{ height: 68, width: 'auto', objectFit: 'contain', display: 'block', opacity: 0.9 }} />
            </div>
          </div>
          <div style={{ animation: 'authOverlayLogo 0.4s 0.22s cubic-bezier(0.22,1,0.36,1) both', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Signing out
          </div>
        </div>,
        document.body
      )}

      {/* ── Hero ── */}
      <div style={{
        background: 'linear-gradient(145deg, #1A3E12 0%, #2A6E3A 55%, #3A8A50 100%)',
        borderRadius: 20,
        padding: '32px 36px',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: 8,
      }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.045)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: '40%', width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, position: 'relative', zIndex: 1 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(255,255,255,0.14)',
            border: '2.5px solid rgba(255,255,255,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 800, color: '#FFFFFF',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
          }}>
            {initials(displayName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                {displayName}
              </h2>
              <span style={{
                padding: '2px 9px', borderRadius: 20,
                background: isAdmin ? 'rgba(250,210,100,0.18)' : 'rgba(255,255,255,0.13)',
                color: isAdmin ? '#fde68a' : 'rgba(255,255,255,0.75)',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', flexShrink: 0,
                border: `1px solid ${isAdmin ? 'rgba(250,210,100,0.3)' : 'rgba(255,255,255,0.18)'}`,
              }}>
                {role}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>@{username}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 6px rgba(74,222,128,0.7)' }} />
                Active
              </span>
              {memberSince && (
                <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.38)', fontWeight: 500 }}>Since {memberSince}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Settings document ── */}
      <div>

        {/* ── Profile ── */}
        <Section label="Profile">
          <FormRow label="Username">
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '8px 12px', borderRadius: 9,
              background: '#FDFAF6', border: `1px solid ${T.divider}`,
              fontSize: 13.5, fontWeight: 600, color: T.textSecond,
            }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <rect x="2.5" y="7" width="11" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              @{username}
              <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>read-only</span>
            </div>
          </FormRow>

          <form onSubmit={handleNameSave}>
            <FormRow label="Full name" hint="This name appears throughout the system." last>
              <TextInput
                value={nameForm.full_name}
                onChange={e => setNameForm({ full_name: e.target.value })}
                placeholder="Your full name"
                autoComplete="name"
              />
            </FormRow>
            <StatusBanner msg={nameMsg} />
            <SaveBtn loading={nameSaving} label="Save name" />
          </form>
        </Section>

        <div style={{ height: 1, background: T.divider }} />

        {/* ── Account ── */}
        <Section label="Account">
          <InfoRow label="Username">@{username}</InfoRow>
          <InfoRow label="Role">{role}</InfoRow>
          <InfoRow label="Status">
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 20,
              background: profile?.is_active !== false ? 'oklch(0.955 0.058 145)' : 'rgba(192,57,43,0.09)',
              color: profile?.is_active !== false ? 'oklch(0.44 0.12 145)' : '#c0392b',
              fontSize: 12, fontWeight: 700,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
              {profile?.is_active !== false ? 'Active' : 'Deactivated'}
            </span>
          </InfoRow>
          {memberSince && <InfoRow label="Member since" last>{memberSince}</InfoRow>}
        </Section>

        <div style={{ height: 1, background: T.divider }} />

        {/* ── Security ── */}
        <Section label="Security">
          <form onSubmit={handlePasswordSave}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <FormRow label="Current password">
                <TextInput
                  type={showPw.old ? 'text' : 'password'}
                  value={pwForm.old_password}
                  onChange={e => setPwForm(f => ({ ...f, old_password: e.target.value }))}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  suffix={<EyeToggle show={showPw.old} onToggle={() => setShowPw(s => ({ ...s, old: !s.old }))} />}
                />
              </FormRow>
              <FormRow label="New password">
                <TextInput
                  type={showPw.new ? 'text' : 'password'}
                  value={pwForm.new_password}
                  onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                  placeholder="Choose a new password"
                  autoComplete="new-password"
                  suffix={<EyeToggle show={showPw.new} onToggle={() => setShowPw(s => ({ ...s, new: !s.new }))} />}
                />
                <PasswordStrength password={pwForm.new_password} />
              </FormRow>
              <FormRow label="Confirm new password" last>
                <TextInput
                  type={showPw.confirm ? 'text' : 'password'}
                  value={pwForm.confirm}
                  onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                  suffix={<EyeToggle show={showPw.confirm} onToggle={() => setShowPw(s => ({ ...s, confirm: !s.confirm }))} />}
                />
              </FormRow>
            </div>
            <StatusBanner msg={pwMsg} />
            <SaveBtn loading={pwSaving} label="Update password" />
          </form>
        </Section>

        <div style={{ height: 1, background: T.divider }} />

        {/* ── Session ── */}
        <Section label="Session">
          {/* Who's signed in */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: 'oklch(0.94 0.03 60)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 800, color: T.accent,
            }}>
              {initials(displayName)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
              <div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 1 }}>@{username} &middot; {role}</div>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, background: 'oklch(0.955 0.058 145)', color: 'oklch(0.44 0.12 145)', fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
              Active
            </span>
          </div>

          {!confirming ? (
            <div>
              <p style={{ margin: '0 0 16px', fontSize: 13.5, color: T.textSecond, lineHeight: 1.65 }}>
                Signing out will end your session on this device. You'll need your username and password to sign back in.
              </p>
              <button
                onClick={() => setConfirming(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 700,
                  color: '#b91c1c', backgroundColor: 'rgba(185,28,28,0.07)',
                  border: '1.5px solid rgba(185,28,28,0.18)', borderRadius: 10,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(185,28,28,0.13)'; e.currentTarget.style.borderColor = 'rgba(185,28,28,0.35)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(185,28,28,0.07)'; e.currentTarget.style.borderColor = 'rgba(185,28,28,0.18)'; }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M10 2H13a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10M7 5l-3 3 3 3M4 8h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Sign out
              </button>
            </div>
          ) : (
            <div style={{
              padding: 18, borderRadius: 14,
              background: 'rgba(185,28,28,0.04)',
              border: '1.5px solid rgba(185,28,28,0.16)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1, color: '#b91c1c' }}>
                  <path d="M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8 5v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#b91c1c', marginBottom: 3 }}>Sign out of Smart Menu?</div>
                  <div style={{ fontSize: 12.5, color: T.textSecond, lineHeight: 1.5 }}>
                    Signed in as <strong style={{ color: T.textPrimary }}>{displayName}</strong>. You'll need your credentials to sign back in.
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleLogout}
                  style={{ flex: 1, padding: '9px 0', fontSize: 13.5, fontWeight: 700, color: '#FFFFFF', background: '#b91c1c', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#991b1b'}
                  onMouseLeave={e => e.currentTarget.style.background = '#b91c1c'}
                >
                  Yes, sign out
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  style={{ flex: 1, padding: '9px 0', fontSize: 13.5, fontWeight: 600, color: T.textSecond, background: '#FFFFFF', border: `1px solid ${T.divider}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FDFAF6'}
                  onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Section>

      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
