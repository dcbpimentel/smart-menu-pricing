import { useState, useEffect } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import api from '../lib/api';
import { getUser, logout } from '../lib/auth';

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

function FieldLabel({ children }) {
  return (
    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', letterSpacing: '0.01em' }}>
      {children}
    </label>
  );
}

function TextInput({ value, onChange, disabled, readOnly, type = 'text', placeholder, suffix }) {
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
        style={{
          width: '100%',
          padding: suffix ? '9px 40px 9px 12px' : '9px 12px',
          fontSize: '13.5px',
          border: `1px solid ${focused ? 'var(--accent)' : 'var(--border-strong)'}`,
          borderRadius: '8px',
          backgroundColor: readOnly || disabled ? 'var(--canvas-bg)' : 'var(--input-bg)',
          color: readOnly ? 'var(--text-secondary)' : 'var(--text-primary)',
          outline: 'none',
          boxSizing: 'border-box',
          boxShadow: focused ? '0 0 0 3px var(--accent-ring)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          cursor: readOnly ? 'default' : 'text',
        }}
        onFocus={() => !readOnly && setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {suffix && (
        <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
          {suffix}
        </div>
      )}
    </div>
  );
}

function StatusMsg({ msg }) {
  if (!msg.text) return null;
  return (
    <p style={{
      marginTop: '10px', fontSize: '12.5px',
      color: msg.error ? '#dc2626' : '#16a34a',
      fontWeight: 500,
    }}>
      {msg.error ? '✕ ' : '✓ '}{msg.text}
    </p>
  );
}

function SaveBtn({ loading, label = 'Save changes' }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        marginTop: '16px',
        padding: '8px 20px',
        fontSize: '13px',
        fontWeight: 600,
        color: 'white',
        backgroundColor: 'var(--accent)',
        border: 'none',
        borderRadius: '8px',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        transition: 'opacity 0.15s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
      }}
    >
      {loading && (
        <div style={{
          width: 13, height: 13, borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.35)',
          borderTopColor: 'white',
          animation: 'spin 0.7s linear infinite',
        }} />
      )}
      {label}
    </button>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default function Profile() {
  const localUser = getUser();

  const [profile, setProfile] = useState(null);

  // Edit profile form
  const [nameForm, setNameForm]   = useState({ full_name: localUser?.full_name || '' });
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg]       = useState({ text: '', error: false });

  // Change password form
  const [pwForm, setPwForm]     = useState({ old_password: '', new_password: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg]       = useState({ text: '', error: false });
  const [showPw, setShowPw]     = useState({ old: false, new: false, confirm: false });

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
      setNameMsg({ text: 'Name updated successfully.', error: false });
    } catch (err) {
      setNameMsg({ text: err.response?.data?.message || 'Failed to update name.', error: true });
    } finally {
      setNameSaving(false);
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) {
      setPwMsg({ text: 'New passwords do not match.', error: true });
      return;
    }
    if (pwForm.new_password.length < 6) {
      setPwMsg({ text: 'New password must be at least 6 characters.', error: true });
      return;
    }
    setPwSaving(true);
    setPwMsg({ text: '', error: false });
    try {
      await api.put('/auth/password', {
        old_password: pwForm.old_password,
        new_password: pwForm.new_password,
      });
      setPwMsg({ text: 'Password changed successfully.', error: false });
      setPwForm({ old_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setPwMsg({ text: err.response?.data?.message || 'Failed to change password.', error: true });
    } finally {
      setPwSaving(false);
    }
  };

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  return (
    <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Edit Profile */}
      <SectionCard title="Edit Profile" description="Update your display name.">
        <form onSubmit={handleNameSave}>
          <FieldLabel>Full name</FieldLabel>
          <TextInput
            value={nameForm.full_name}
            onChange={e => setNameForm({ full_name: e.target.value })}
            placeholder="Your full name"
          />
          <StatusMsg msg={nameMsg} />
          <SaveBtn loading={nameSaving} />
        </form>
      </SectionCard>

      {/* Change Password */}
      <SectionCard title="Change Password" description="Use a strong password of at least 6 characters.">
        <form onSubmit={handlePasswordSave}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <FieldLabel>Current password</FieldLabel>
              <TextInput
                type={showPw.old ? 'text' : 'password'}
                value={pwForm.old_password}
                onChange={e => setPwForm(f => ({ ...f, old_password: e.target.value }))}
                placeholder="Enter current password"
                suffix={
                  <button type="button" onClick={() => setShowPw(s => ({ ...s, old: !s.old }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 0 }}>
                    {showPw.old ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                  </button>
                }
              />
            </div>
            <div>
              <FieldLabel>New password</FieldLabel>
              <TextInput
                type={showPw.new ? 'text' : 'password'}
                value={pwForm.new_password}
                onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                placeholder="Enter new password"
                suffix={
                  <button type="button" onClick={() => setShowPw(s => ({ ...s, new: !s.new }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 0 }}>
                    {showPw.new ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                  </button>
                }
              />
            </div>
            <div>
              <FieldLabel>Confirm new password</FieldLabel>
              <TextInput
                type={showPw.confirm ? 'text' : 'password'}
                value={pwForm.confirm}
                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                placeholder="Repeat new password"
                suffix={
                  <button type="button" onClick={() => setShowPw(s => ({ ...s, confirm: !s.confirm }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 0 }}>
                    {showPw.confirm ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                  </button>
                }
              />
            </div>
          </div>
          <StatusMsg msg={pwMsg} />
          <SaveBtn loading={pwSaving} label="Update password" />
        </form>
      </SectionCard>

      {/* Account Info */}
      <SectionCard title="Account Info" description="Read-only system information about your account.">
        <div style={{ marginTop: '-10px' }}>
          <InfoRow label="Username"     value={profile?.username  || localUser?.username  || '—'} />
          <InfoRow label="Role"         value={profile?.role === 'admin' ? 'Administrator' : 'Staff'} />
          <InfoRow label="Member since" value={memberSince} />
          <div style={{ paddingTop: '10px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '3px 9px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
              backgroundColor: profile?.is_active !== false ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)',
              color: profile?.is_active !== false ? '#16a34a' : '#dc2626',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                backgroundColor: profile?.is_active !== false ? '#16a34a' : '#dc2626',
                display: 'inline-block',
              }} />
              {profile?.is_active !== false ? 'Active account' : 'Deactivated'}
            </span>
          </div>
        </div>
      </SectionCard>

      {/* Session */}
      <SectionCard title="Session" description="Sign out of your current session on this device.">
        <button
          onClick={logout}
          style={{
            padding: '8px 20px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#dc2626',
            backgroundColor: 'rgba(239,68,68,0.07)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.12)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.07)'}
        >
          Log out
        </button>
      </SectionCard>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
