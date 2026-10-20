import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { loadPrefs } from '../lib/prefs';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm]         = useState({ username: '', password: '' });
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);

  const prefs          = loadPrefs();
  const restaurantName = prefs.restaurantName || "Boyd's Pizza House";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', form);
      const { token, user } = res.data.data;
      localStorage.setItem('smp_token', token);
      localStorage.setItem('smp_user', JSON.stringify(user));
      setSuccess(true);
      setTimeout(() => navigate('/', { replace: true }), 600);
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#FDF8F2' }}>

      {/* ── Login success overlay ── */}
      {success && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: '#FDF8F2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 16,
          animation: 'loginSuccessIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        }}>
          <div style={{ animation: 'loginSuccessLogo 0.5s 0.08s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width="44" height="44" viewBox="0 0 28 28" fill="none">
                  <circle cx="4"  cy="4"  r="3.5" fill="#D4E8D8"/>
                  <circle cx="14" cy="4"  r="3.5" fill="#D4E8D8"/>
                  <circle cx="24" cy="4"  r="3.5" fill="#2A6E3A"/>
                  <circle cx="4"  cy="14" r="3.5" fill="#D4E8D8"/>
                  <circle cx="14" cy="14" r="3.5" fill="#2A6E3A"/>
                  <circle cx="24" cy="14" r="3.5" fill="#D4E8D8"/>
                  <circle cx="4"  cy="24" r="3.5" fill="#2A6E3A"/>
                  <circle cx="14" cy="24" r="3.5" fill="#D4E8D8"/>
                  <circle cx="24" cy="24" r="3.5" fill="#D4E8D8"/>
                </svg>
                <span style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.04em', color: '#1A1C18', lineHeight: 1 }}>JBD</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8C7C6C' }}>Smart Menu System</div>
            </div>
          </div>
          <div style={{ animation: 'loginFormItemIn 0.5s 0.22s cubic-bezier(0.22, 1, 0.36, 1) both', fontSize: 13.5, fontWeight: 600, color: '#8C7C6C', letterSpacing: '0.01em' }}>
            Opening your workspace...
          </div>
        </div>
      )}

      {/* ── Left brand panel ── */}
      <div className="login-brand login-brand-animate" style={{
        width: '44%', flexShrink: 0,
        background: 'linear-gradient(155deg, #1E4A16 0%, #122B0C 60%, #0D1F08 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '52px 56px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -100, right: -80, width: 380, height: 380, borderRadius: '50%', background: 'rgba(93,187,90,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(93,187,90,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '40%', right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.02)', pointerEvents: 'none' }} />

        {/* Logo + headline */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Brand mark — JBD Menu Grid */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36 }}>
            <svg width="42" height="42" viewBox="0 0 28 28" fill="none">
              <circle cx="4"  cy="4"  r="3.5" fill="rgba(255,255,255,0.18)"/>
              <circle cx="14" cy="4"  r="3.5" fill="rgba(255,255,255,0.18)"/>
              <circle cx="24" cy="4"  r="3.5" fill="#FFFFFF"/>
              <circle cx="4"  cy="14" r="3.5" fill="rgba(255,255,255,0.18)"/>
              <circle cx="14" cy="14" r="3.5" fill="#FFFFFF"/>
              <circle cx="24" cy="14" r="3.5" fill="rgba(255,255,255,0.18)"/>
              <circle cx="4"  cy="24" r="3.5" fill="#FFFFFF"/>
              <circle cx="14" cy="24" r="3.5" fill="rgba(255,255,255,0.18)"/>
              <circle cx="24" cy="24" r="3.5" fill="rgba(255,255,255,0.18)"/>
            </svg>
            <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em', color: '#FFFFFF', lineHeight: 1 }}>JBD</span>
          </div>

          <h1 style={{
            margin: '0 0 14px',
            fontSize: 36,
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            maxWidth: 300,
          }}>
            Price your menu with confidence.
          </h1>
          <p style={{
            margin: 0,
            fontSize: 15,
            color: 'rgba(255,255,255,0.52)',
            lineHeight: 1.6,
            maxWidth: 260,
          }}>
            Live market prices from DTI &amp; DA bulletins. Accurate costs in seconds.
          </p>
        </div>

        {/* Bottom tagline */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'rgba(255,255,255,0.32)', fontWeight: 500 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(93,187,90,0.8)', flexShrink: 0 }} />
            Kidapawan City, Philippines
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 32px',
        minHeight: '100vh',
        boxSizing: 'border-box',
        background: '#FDF8F2',
      }}>
        <div style={{ width: '100%', maxWidth: 368 }}>

          {/* Mobile-only brand mark */}
          <div className="login-mobile-logo" style={{ display: 'none', marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="34" height="34" viewBox="0 0 28 28" fill="none">
                <circle cx="4"  cy="4"  r="3.5" fill="#D4E8D8"/>
                <circle cx="14" cy="4"  r="3.5" fill="#D4E8D8"/>
                <circle cx="24" cy="4"  r="3.5" fill="#2A6E3A"/>
                <circle cx="4"  cy="14" r="3.5" fill="#D4E8D8"/>
                <circle cx="14" cy="14" r="3.5" fill="#2A6E3A"/>
                <circle cx="24" cy="14" r="3.5" fill="#D4E8D8"/>
                <circle cx="4"  cy="24" r="3.5" fill="#2A6E3A"/>
                <circle cx="14" cy="24" r="3.5" fill="#D4E8D8"/>
                <circle cx="24" cy="24" r="3.5" fill="#D4E8D8"/>
              </svg>
              <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.04em', color: '#1A1C18', lineHeight: 1 }}>JBD</span>
            </div>
          </div>

          {/* Heading */}
          <div className="login-item-1" style={{ marginBottom: 36 }}>
            <h2 style={{
              margin: '0 0 7px',
              fontSize: 30,
              fontWeight: 800,
              color: '#1A1512',
              letterSpacing: '-0.035em',
              lineHeight: 1.12,
            }}>
              Welcome back
            </h2>
            <p style={{ margin: 0, fontSize: 14.5, color: '#8C7C6C' }}>
              Sign in to {restaurantName}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 9,
              background: 'rgba(192,57,43,0.06)',
              border: '1px solid rgba(192,57,43,0.18)',
              borderRadius: 13,
              padding: '12px 15px',
              marginBottom: 24,
              fontSize: 13.5,
              color: '#A8321F',
              lineHeight: 1.45,
            }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="11" r="0.65" fill="currentColor"/>
              </svg>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Username */}
            <div className="login-item-2" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#6B5E50', letterSpacing: '0.01em' }}>
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
                  height: 50,
                  padding: '0 16px',
                  fontSize: 15,
                  border: '1.5px solid #E4D8C4',
                  borderRadius: 14,
                  background: '#FFFFFF',
                  color: '#1A1512',
                  outline: 'none',
                  boxSizing: 'border-box',
                  width: '100%',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor = '#2A6E3A'; e.target.style.boxShadow = '0 0 0 4px oklch(0.942 0.044 148)'; }}
                onBlur={e =>  { e.target.style.borderColor = '#E4D8C4'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Password */}
            <div className="login-item-3" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#6B5E50', letterSpacing: '0.01em' }}>
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
                    height: 50,
                    padding: '0 50px 0 16px',
                    fontSize: 15,
                    border: '1.5px solid #E4D8C4',
                    borderRadius: 14,
                    background: '#FFFFFF',
                    color: '#1A1512',
                    outline: 'none',
                    boxSizing: 'border-box',
                    width: '100%',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#2A6E3A'; e.target.style.boxShadow = '0 0 0 4px oklch(0.942 0.044 148)'; }}
                  onBlur={e =>  { e.target.style.borderColor = '#E4D8C4'; e.target.style.boxShadow = 'none'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  tabIndex={-1}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#A8988A', padding: 4, display: 'flex', alignItems: 'center', lineHeight: 0,
                  }}
                >
                  {showPw ? (
                    <svg width="17" height="17" viewBox="0 0 20 20" fill="none"><path d="M3 3l14 14M8.46 8.52A3 3 0 0 0 13.5 13.5M6.14 5.14C4.04 6.4 2.5 8.05 2.5 10c0 2 2.73 5.5 7.5 5.5a9.3 9.3 0 0 0 3.86-.85M10 4.5C14.77 4.5 17.5 8 17.5 10c0 .95-.51 2.05-1.36 3.04" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 20 20" fill="none"><ellipse cx="10" cy="10" rx="7.5" ry="5.5" stroke="currentColor" strokeWidth="1.4"/><circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.4"/></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              className="login-item-4"
              type="submit"
              disabled={loading}
              style={{
                height: 52,
                width: '100%',
                marginTop: 6,
                fontSize: 15.5,
                fontWeight: 700,
                color: '#FFFFFF',
                background: loading ? '#5A9E6A' : '#2A6E3A',
                border: 'none',
                borderRadius: 15,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 9,
                fontFamily: 'inherit',
                letterSpacing: '-0.01em',
                transition: 'background 0.18s ease, transform 0.12s ease, box-shadow 0.15s ease',
                boxShadow: loading ? 'none' : '0 6px 22px rgba(42,110,58,0.32)',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = '#215730'; e.currentTarget.style.boxShadow = '0 8px 26px rgba(42,110,58,0.40)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = '#2A6E3A'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(42,110,58,0.32)'; e.currentTarget.style.transform = ''; } }}
            >
              {loading ? (
                <>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFFFFF', animation: 'spin 0.7s linear infinite' }} />
                  Signing in...
                </>
              ) : 'Sign in'}
            </button>
          </form>

          {/* Back link */}
          <div className="login-item-5" style={{ marginTop: 32, textAlign: 'center' }}>
            <Link
              to="/landing"
              style={{ fontSize: 13.5, color: '#A8988A', textDecoration: 'none', fontWeight: 500 }}
              onMouseEnter={e => { e.currentTarget.style.color = '#2A6E3A'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#A8988A'; }}
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 680px) {
          .login-brand { display: none !important; }
          .login-mobile-logo { display: block !important; }
        }
      `}</style>
    </div>
  );
}
