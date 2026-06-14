import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import {
  FiHome, FiPackage, FiBook, FiDownload,
  FiDollarSign, FiTrendingUp, FiSettings, FiMenu, FiHelpCircle, FiUsers,
} from 'react-icons/fi';
import { BrandMark, getFaviconSvg } from './Icons';
import { loadPrefs } from '../lib/prefs';
import { getUser } from '../lib/auth';
import { THEMES } from '../lib/theme';

const NAV_ITEMS = [
  { to: '/',            label: 'Dashboard',       icon: FiHome },
  { to: '/ingredients', label: 'Ingredients',      icon: FiPackage },
  { to: '/recipes',     label: 'Recipes',          icon: FiBook },
  { to: '/extraction',  label: 'Price Extraction', icon: FiDownload },
  { to: '/costing',     label: 'Cost Computation', icon: FiDollarSign },
  { to: '/impact',      label: 'Impact Analysis',  icon: FiTrendingUp },
  { to: '/settings',    label: 'Settings',         icon: FiSettings },
  { to: '/help',        label: 'Help & Guide',     icon: FiHelpCircle },
];

const PAGE_TITLES = {
  '/':            'Dashboard',
  '/ingredients': 'Ingredients',
  '/recipes':     'Recipes',
  '/extraction':  'Price Extraction',
  '/costing':     'Cost Computation',
  '/impact':      'Impact Analysis',
  '/settings':    'Settings',
  '/help':        'Help & Guide',
  '/profile':     'My Profile',
  '/team':        'Team',
};

function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] || 'U').toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Layout() {
  const location    = useLocation();
  const user        = getUser();

  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile]     = useState(false);

  const prefs           = loadPrefs();
  const brandName       = prefs.restaurantName  || 'SmartMenu';
  const brandIcon       = prefs.brandIcon       || 'fork';
  const brandIconCustom = prefs.brandIconCustom || '';

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

  const pageTitle = PAGE_TITLES[location.pathname]
    ?? (/^\/recipes\/\d+/.test(location.pathname) ? 'Recipes' : 'SmartMenu');

  useEffect(() => {
    const freshPrefs = loadPrefs();
    const restaurantName = freshPrefs.restaurantName || 'Smart Menu Pricing';
    document.title = `${pageTitle} — ${restaurantName}`;

    const themeId = freshPrefs.theme || 'default';
    const icon = freshPrefs.brandIcon || 'fork';
    const accentColor = THEMES[themeId]?.vars?.['--accent'] || '#10b981';
    const svgStr = getFaviconSvg(icon, accentColor);
    let link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.type = 'image/svg+xml';
    link.href = 'data:image/svg+xml,' + encodeURIComponent(svgStr);
  }, [pageTitle]);

  const handleToggle = () => {
    if (isMobile) setMobileOpen(o => !o);
    else setCollapsed(c => !c);
  };

  const navLinkClass = ({ isActive }) => [
    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
    'transition-all duration-150 overflow-hidden',
    isActive ? 'text-white' : 'text-white/50 hover:text-white/90 hover:bg-white/8',
  ].join(' ');

  const navLinkStyle = ({ isActive }) => isActive
    ? { backgroundColor: 'var(--accent)', boxShadow: '0 2px 8px var(--accent-ring)' }
    : {};

  const iconOnly = collapsed && !isMobile;

  const sidebarContent = (
    <>
      {/* Brand */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '11px',
        padding: iconOnly ? '0 15px' : '0 16px',
        height: '64px', minHeight: '64px', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        justifyContent: iconOnly ? 'center' : 'flex-start',
      }}>
        <BrandMark size={33} iconId={brandIcon} customUrl={brandIconCustom} style={{ flexShrink: 0 }} />
        {!iconOnly && (
          <span style={{
            color: 'white', fontWeight: 700, fontSize: '14.5px', letterSpacing: '-0.01em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0,
          }}>
            {brandName}
          </span>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={iconOnly ? label : undefined}
              className={navLinkClass}
              style={navLinkStyle}
            >
              <Icon size={17} style={{ flexShrink: 0 }} />
              {!iconOnly && (
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {label}
                </span>
              )}
            </NavLink>
          ))}

          {/* Team — admin only */}
          {user?.role === 'admin' && (
            <NavLink
              to="/team"
              title={iconOnly ? 'Team' : undefined}
              className={navLinkClass}
              style={navLinkStyle}
            >
              <FiUsers size={17} style={{ flexShrink: 0 }} />
              {!iconOnly && (
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Team
                </span>
              )}
            </NavLink>
          )}
        </div>
      </nav>

      {/* Separator */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '0 8px' }} />

      {/* Profile card */}
      <Link
        to="/profile"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: iconOnly ? '13px 0' : '11px 12px',
          margin: '6px 8px 8px',
          borderRadius: '10px',
          textDecoration: 'none',
          cursor: 'pointer',
          justifyContent: iconOnly ? 'center' : 'flex-start',
          transition: 'background 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        {/* Avatar */}
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          backgroundColor: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: '11.5px',
          flexShrink: 0, letterSpacing: '0.04em',
        }}>
          {initials(user?.full_name || 'U')}
        </div>

        {/* Name + role */}
        {!iconOnly && (
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              color: 'white', fontSize: '12.5px', fontWeight: 600,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              lineHeight: 1.3,
            }}>
              {user?.full_name || 'User'}
            </div>
            <span style={{
              display: 'inline-block',
              marginTop: '3px',
              padding: '1px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              backgroundColor: user?.role === 'admin' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.09)',
              color: user?.role === 'admin' ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.55)',
            }}>
              {user?.role === 'admin' ? 'Admin' : 'Staff'}
            </span>
          </div>
        )}
      </Link>
    </>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--canvas-bg)' }}>

      {/* Mobile backdrop */}
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 30,
            backgroundColor: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
          }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        background: `linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 40%), var(--sidebar-bg)`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
        ...(isMobile ? {
          position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 40, width: '240px',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.28s cubic-bezier(0.16,1,0.3,1)',
        } : {
          position: 'relative',
          width: collapsed ? '64px' : '240px',
          transition: 'width 0.28s cubic-bezier(0.16,1,0.3,1)',
        }),
      }}>
        {sidebarContent}
      </aside>

      {/* Main area */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>

        {/* Top bar */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '0 20px',
          backgroundColor: 'var(--header-bg)',
          borderBottom: '1px solid var(--header-border)',
          boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
          height: '60px', flexShrink: 0,
        }}>
          <button
            onClick={handleToggle}
            title={isMobile ? 'Open menu' : (collapsed ? 'Expand sidebar' : 'Collapse sidebar')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '34px', height: '34px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0,
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <FiMenu size={15} />
          </button>

          <h1 style={{
            fontSize: '14.5px', fontWeight: 600, color: 'var(--text-primary)',
            margin: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {pageTitle}
          </h1>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 'clamp(16px, 3vw, 28px)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
