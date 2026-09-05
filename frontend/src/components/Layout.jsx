import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import CommandPalette from './CommandPalette';
import { ToastProvider } from './Toast';
// Icons used in the sidebar navigation.
// Only the icons for the 6 core pages + Settings + Help are kept here.
// FiBarChart2 (Reports), FiArchive (Inventory), and FiUsers (Team) were
// removed because those pages are outside the capstone paper's scope.
import {
  FiHome, FiPackage, FiBook, FiDownload,
  FiDollarSign, FiTrendingUp, FiSettings, FiHelpCircle,
  FiSearch,
} from 'react-icons/fi';
import { loadPrefs, savePrefs } from '../lib/prefs';
import { getUser } from '../lib/auth';
import { applyTheme } from '../lib/theme';

export const TopbarContext = createContext({ setTopbarRight: () => {} });
export const useTopbar = () => useContext(TopbarContext);

// NAV_SECTIONS defines the sidebar menu.
// MENU = the 6 core capstone features the evaluator will test.
// SETUP = configuration pages (Settings) and documentation (Help & Guide).
//
// Removed from MENU: Reports (/reports), Inventory (/inventory)
// Removed from SETUP: Team (/team)
// Reason: these are outside the paper's scope and would confuse evaluators.
// The pages still exist in the router — they are just hidden from the nav.
const NAV_SECTIONS = [
  {
    label: 'MENU',
    items: [
      { to: '/',           label: 'Dashboard',      icon: FiHome },
      { to: '/ingredients',label: 'Ingredients',    icon: FiPackage },
      { to: '/recipes',    label: 'Recipes',        icon: FiBook },
      { to: '/extraction', label: 'Market Prices',  icon: FiDownload },
      { to: '/costing',    label: 'Costing',        icon: FiDollarSign },
      { to: '/impact',     label: 'Impact Analysis',icon: FiTrendingUp },
    ],
  },
  {
    label: 'SETUP',
    items: [
      { to: '/settings', label: 'Settings',    icon: FiSettings },
      { to: '/help',     label: 'Help & Guide', icon: FiHelpCircle },
    ],
  },
];

const NAV_ITEMS = NAV_SECTIONS.flatMap(s => s.items);

// PAGE_META controls the topbar: kicker = small label above the title,
// title = page name shown in the topbar and browser tab,
// sub = short description shown below the title on desktop.
// Only the pages visible in the nav need entries here.
const PAGE_META = {
  '/':            { kicker: 'Overview',  title: 'Dashboard',       sub: 'Your menu pricing at a glance' },
  '/ingredients': { kicker: 'Data',     title: 'Ingredients',     sub: 'Manage your ingredient list and prices' },
  '/recipes':     { kicker: 'Menu',     title: 'Recipes',         sub: 'Your dishes and their costing status' },
  '/extraction':  { kicker: 'Data',     title: 'Market Prices',   sub: 'Import prices from DTI/DA bulletins' },
  '/costing':     { kicker: 'Pricing',  title: 'Costing',         sub: 'Calculate accurate dish costs and selling prices' },
  '/impact':      { kicker: 'Analysis', title: 'Impact Analysis', sub: 'Simulate ingredient price changes' },
  '/settings':    { kicker: 'System',   title: 'Settings',        sub: 'Restaurant profile and preferences' },
  '/help':        { kicker: 'Support',  title: 'Help & Guide',    sub: 'Learn how to use Smart Menu Pricing' },
};

function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] || 'U').toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Layout() {
  const location = useLocation();
  const user     = getUser();

  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [isMobile,    setIsMobile]    = useState(false);
  const [topbarRight, setTopbarRight] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const [prefs, setPrefsState] = useState(() => loadPrefs());
  const ownerName = prefs.ownerName || user?.full_name || 'Owner';

  useEffect(() => {
    applyTheme('light');
  }, []);

  useEffect(() => {
    const handler = () => setPrefsState(loadPrefs());
    window.addEventListener('smp:prefs-updated', handler);
    return () => window.removeEventListener('smp:prefs-updated', handler);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const mq     = window.matchMedia('(max-width: 767px)');
    const update = (matches) => { setIsMobile(matches); if (matches) setMobileOpen(false); };
    update(mq.matches);
    const handler = (e) => update(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (isMobile) setMobileOpen(false);
  }, [location.pathname, isMobile]);

  const pageMeta = PAGE_META[location.pathname]
    ?? (/^\/recipes\/\d+/.test(location.pathname)
      ? { kicker: 'Menu', title: 'Recipe Detail', sub: 'Ingredients and costing breakdown' }
      : { kicker: 'SmartMenu', title: 'Smart Menu Pricing', sub: '' });

  useEffect(() => {
    const freshPrefs = loadPrefs();
    document.title = `${pageMeta.title} | ${freshPrefs.restaurantName || 'Smart Menu Pricing'}`;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.type = 'image/svg+xml';
    link.href = '/favicon.svg?v=3';
  }, [pageMeta.title]);

  const handleToggle = () => {
    if (isMobile) setMobileOpen(o => !o);
    else setCollapsed(c => !c);
  };

  const iconOnly = collapsed && !isMobile;

  const navCls = ({ isActive }) =>
    ['snav-item', isActive && 'snav-item--active'].filter(Boolean).join(' ');

  const sidebarContent = (
    <>
      {/* Brand header — centered logo + system name */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: iconOnly ? '18px 8px' : '22px 16px 16px', flexShrink: 0 }}>
        {iconOnly ? (
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFFFFF', boxShadow: '0 2px 10px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <img src="/logo.png" alt="Boyd's" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          </div>
        ) : (
          <>
            <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '10px 20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.10)' }}>
              <img src="/logo.png" alt="Boyd's Pizza House" style={{ height: 58, width: 'auto', maxWidth: 190, objectFit: 'contain', display: 'block' }} />
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-ultra-muted)', marginTop: 9, textAlign: 'center' }}>
              Smart Menu System
            </div>
          </>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '4px 8px' }}>
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} style={{ marginBottom: 4 }}>
            {!iconOnly && (
              <div className="snav-section-label"
                style={{ marginTop: si > 0 ? 8 : 0 }}
              >{section.label}</div>
            )}
            {iconOnly && si > 0 && <div style={{ height: 10 }} />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {section.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  title={iconOnly ? label : undefined}
                  className={navCls}
                  style={{ justifyContent: iconOnly ? 'center' : 'flex-start' }}
                >
                  <span className="snav-icon">
                    <Icon size={17} />
                  </span>
                  {!iconOnly && <span className="snav-label">{label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Profile card — click to go to profile settings */}
      <div style={{ borderTop: '1px solid var(--divider)', padding: '10px 8px 14px', flexShrink: 0 }}>
        <Link
          to="/profile"
          title={iconOnly ? 'Profile settings' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            justifyContent: iconOnly ? 'center' : 'flex-start',
            textDecoration: 'none',
            borderRadius: 11,
            padding: '8px 10px',
            transition: 'background 0.15s',
            cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--sidebar-active-bg, rgba(76,93,62,0.06))'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <div style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: 'oklch(0.94 0.03 60)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 600, fontSize: 13, color: 'var(--accent)',
          }}>
            {initials(ownerName)}
          </div>
          {!iconOnly && (
            <>
              <div style={{ minWidth: 0, flex: 1, lineHeight: 1.3 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ownerName}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--sidebar-text-muted)' }}>View profile</div>
              </div>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, color: 'var(--sidebar-text-muted)', opacity: 0.5 }}>
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </>
          )}
        </Link>
      </div>
    </>
  );

  return (
    <ToastProvider>
    <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    {/* Paper grain texture — gives premium editorial feel */}
    <div className="grain-overlay" aria-hidden="true" />
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--canvas-bg)' }}>

      {/* Mobile backdrop */}
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 30,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.18s ease',
          }}
        />
      )}

      {/* Sidebar wrapper — relative container so edge-toggle can poke out */}
      <div style={{
        position: 'relative',
        flexShrink: 0,
        ...(!isMobile && {
          width: collapsed ? '60px' : '268px',
          transition: 'width 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }),
      }}>
        <aside style={{
          background: 'linear-gradient(180deg, #FFFEF9 0%, #F9F5EE 100%)',
          borderRight: '1px solid var(--sidebar-border)',
          boxShadow: 'inset 3px 0 0 #4C5D3E',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
          ...(isMobile ? {
            position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 40, width: '268px',
            transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            boxShadow: mobileOpen ? '8px 0 32px rgba(0,0,0,0.12)' : 'none',
          } : {
            height: '100%',
            width: '100%',
          }),
        }}>
          {sidebarContent}
        </aside>

        {/* Desktop collapse tab — sits on the sidebar's right border */}
        {!isMobile && (
          <button
            onClick={handleToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="sidebar-edge-toggle"
          >
            <svg
              width="11" height="11"
              viewBox="0 0 11 11"
              fill="none"
              style={{
                transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
                transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            >
              <path d="M7 1.5L3 5.5l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Main column */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>

        {/* Topbar */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'var(--topbar-bg)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1px solid var(--border)',
          padding: isMobile ? '14px 16px' : '16px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexShrink: 0,
        }}>

          {/* Left: page info (toggle is now the sidebar edge-tab on desktop) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
            {/* Mobile hamburger — icon only, opens the fixed sidebar */}
            {isMobile && (
              <button
                onClick={handleToggle}
                aria-label="Open navigation"
                className="topbar-icon-btn"
              >
                {mobileOpen ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                )}
              </button>
            )}

            {!isMobile && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-ultra-muted)', textTransform: 'uppercase', lineHeight: 1, marginBottom: 3 }}>
                  {pageMeta.kicker}
                </div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {pageMeta.title}
                </h1>
                {pageMeta.sub && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.3 }}>
                    {pageMeta.sub}
                  </div>
                )}
              </div>
            )}

            {isMobile && (
              <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pageMeta.title}
              </h1>
            )}
          </div>

          {/* Right: search + page CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>

            {/* ⌘K search */}
            {!isMobile && (
              <button
                onClick={() => setPaletteOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '7px 12px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
                  transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--input-border)'; e.currentTarget.style.background = 'var(--sidebar-hover-bg)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <FiSearch size={13} />
                <span>Search</span>
                <kbd style={{
                  fontSize: '10.5px', padding: '1px 5px', borderRadius: 4,
                  background: 'var(--divider)', color: 'var(--text-muted)',
                  fontFamily: 'inherit', border: '1px solid var(--border)',
                }}>⌘K</kbd>
              </button>
            )}

            {/* Per-page CTA */}
            {topbarRight && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {topbarRight}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{
          flex: 1, overflowY: 'auto',
          padding: isMobile
            ? 'clamp(14px, 4vw, 20px)'
            : '28px 40px 64px',
          paddingBottom: isMobile ? 'calc(clamp(14px, 4vw, 20px) + 64px)' : '64px',
        }}>
          <TopbarContext.Provider value={{ setTopbarRight }}>
            <div key={location.key} className="page-enter">
              <Outlet />
            </div>
          </TopbarContext.Provider>
        </main>
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <nav className="mobile-bottom-nav">
          {NAV_ITEMS.slice(0, 5).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `mobile-nav-item${isActive ? ' mobile-nav-item--active' : ''}`}
            >
              <Icon size={21} />
              <span>{label.split(' ')[0]}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
    </ToastProvider>
  );
}
