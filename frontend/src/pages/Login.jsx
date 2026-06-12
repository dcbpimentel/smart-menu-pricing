import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import api from '../lib/api';
import { BrandMark } from '../components/Icons';
import { loadPrefs } from '../lib/prefs';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm]       = useState({ username: '', password: '' });
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const prefs     = loadPrefs();
  const brandIcon = prefs.brandIcon      || 'fork';
  const brandUrl  = prefs.brandIconCustom || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', form);
      const { token, user } = res.data.data;
      localStorage.setItem('smp_token', token);
      localStorage.setItem('smp_user', JSON.stringify(user));
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--canvas-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Card */}
        <div style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '18px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
          overflow: 'hidden',
        }}>

          {/* Card header */}
          <div style={{
            padding: '32px 32px 24px',
            borderBottom: '1px solid var(--border)',
            textAlign: 'center',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
              <BrandMark size={48} iconId={brandIcon} customUrl={brandUrl} />
            </div>
            <h1 style={{
              fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)',
              margin: '0 0 4px', letterSpacing: '-0.01em',
            }}>
              Welcome back
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              Sign in to Smart Menu Pricing
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ padding: '28px 32px 32px' }}>

            {/* Error banner */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                backgroundColor: 'rgba(239,68,68,0.07)',
                border: '1px solid rgba(239,68,68,0.18)',
                borderRadius: '10px',
                padding: '10px 12px',
                marginBottom: '20px',
                fontSize: '13px',
                color: '#dc2626',
                lineHeight: 1.5,
              }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                  <line x1="8" y1="5" x2="8" y2="8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="8" cy="11" r="0.7" fill="currentColor"/>
                </svg>
                {error}
              </div>
            )}

            {/* Username */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block', fontSize: '12px', fontWeight: 600,
                color: 'var(--text-secondary)', marginBottom: '6px',
                letterSpacing: '0.01em',
              }}>
                Username
              </label>
              <input
                type="text"
                autoComplete="username"
                autoFocus
                required
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="Enter your username"
                style={{
                  width: '100%',
                  padding: '10px 13px',
                  fontSize: '14px',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '9px',
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--accent)';
                  e.target.style.boxShadow   = '0 0 0 3px var(--accent-ring)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'var(--border-strong)';
                  e.target.style.boxShadow   = 'none';
                }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block', fontSize: '12px', fontWeight: 600,
                color: 'var(--text-secondary)', marginBottom: '6px',
                letterSpacing: '0.01em',
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Enter your password"
                  style={{
                    width: '100%',
                    padding: '10px 42px 10px 13px',
                    fontSize: '14px',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '9px',
                    backgroundColor: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = 'var(--accent)';
                    e.target.style.boxShadow   = '0 0 0 3px var(--accent-ring)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'var(--border-strong)';
                    e.target.style.boxShadow   = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: '2px', display: 'flex', alignItems: 'center',
                  }}
                  tabIndex={-1}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '11px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'white',
                backgroundColor: 'var(--accent)',
                border: 'none',
                borderRadius: '9px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'opacity 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: 15, height: 15, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.35)',
                    borderTopColor: 'white',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                  Signing in…
                </>
              ) : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Back link */}
        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
          <Link
            to="/landing"
            style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500 }}
          >
            ← Back to home
          </Link>
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
