import { Link } from 'react-router-dom';
import { BrandMark } from '../components/Icons';
import { loadPrefs } from '../lib/prefs';

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="3" width="16" height="18" rx="3" stroke="currentColor" strokeWidth="1.8"/>
        <rect x="7" y="6.5" width="10" height="3.5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="8.5" cy="14" r="1" fill="currentColor"/>
        <circle cx="12" cy="14" r="1" fill="currentColor"/>
        <circle cx="15.5" cy="14" r="1" fill="currentColor"/>
        <circle cx="8.5" cy="17.5" r="1" fill="currentColor"/>
        <circle cx="12" cy="17.5" r="1" fill="currentColor"/>
        <circle cx="15.5" cy="17.5" r="1" fill="currentColor"/>
      </svg>
    ),
    title: 'Accurate dish costing',
    desc: 'Calculate the exact ingredient cost per serving for every dish on your menu — no more guessing.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <polyline points="3,17 8,12 13,14 20,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="15,6 20,6 20,11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Live market prices',
    desc: 'Import prices directly from DTI and DA bulletins, or enter them manually whenever the market changes.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <polyline points="22,7 13,16 8,11 2,17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="16,7 22,7 22,13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Price change impact',
    desc: 'Simulate how a change in ingredient costs affects your margins before updating your menu prices.',
  },
];

export default function Landing() {
  const prefs     = loadPrefs();
  const brandIcon = prefs.brandIcon      || 'fork';
  const brandUrl  = prefs.brandIconCustom || '';

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--canvas-bg)',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* Top bar */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        height: '60px',
        backgroundColor: 'var(--header-bg)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BrandMark size={28} iconId={brandIcon} customUrl={brandUrl} />
          <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Smart Menu Pricing
          </span>
        </div>
        <Link
          to="/login"
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--accent)',
            textDecoration: 'none',
          }}
        >
          Log in →
        </Link>
      </header>

      {/* Hero */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ maxWidth: '640px', width: '100%', textAlign: 'center' }}>

          {/* Brand block */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
            <BrandMark size={64} iconId={brandIcon} customUrl={brandUrl} />
            <div>
              <h1 style={{
                fontSize: 'clamp(26px, 5vw, 38px)',
                fontWeight: 800,
                color: 'var(--text-primary)',
                margin: '0 0 8px',
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
              }}>
                Smart Menu Pricing
              </h1>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
                Food cost calculator and price recommender for restaurants in Kidapawan City, Philippines.
              </p>
            </div>
          </div>

          {/* Feature cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '14px',
            marginBottom: '40px',
          }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--border)',
                borderRadius: '14px',
                padding: '20px 18px',
                textAlign: 'left',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '10px',
                  backgroundColor: 'var(--accent-light)',
                  color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '12px',
                }}>
                  {f.icon}
                </div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 5px', lineHeight: 1.3 }}>
                  {f.title}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--accent)',
              color: 'white',
              fontWeight: 600,
              fontSize: '14px',
              padding: '12px 28px',
              borderRadius: '10px',
              textDecoration: 'none',
              boxShadow: '0 2px 12px var(--accent-ring)',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Log in to your account
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '16px',
        fontSize: '11.5px',
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        Smart Menu Pricing — Capstone Project · Kidapawan City, Philippines
      </footer>
    </div>
  );
}
