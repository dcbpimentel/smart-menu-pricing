// ── Favicon SVG string map (SVG attribute syntax, not JSX) ───────────────────
const BRAND_SVG_INNER = {
  fork: `<line x1="13" y1="7" x2="13" y2="15" stroke="white" stroke-width="2" stroke-linecap="round"/><line x1="20" y1="7" x2="20" y2="15" stroke="white" stroke-width="2" stroke-linecap="round"/><line x1="27" y1="7" x2="27" y2="15" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M13 15 C13 20 17 20.5 20 20.5 C23 20.5 27 20 27 15" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/><line x1="20" y1="20.5" x2="20" y2="33" stroke="white" stroke-width="2" stroke-linecap="round"/><line x1="15.5" y1="25" x2="24.5" y2="25" stroke="white" stroke-width="1.6" stroke-linecap="round"/><line x1="15.5" y1="28.5" x2="24.5" y2="28.5" stroke="white" stroke-width="1.6" stroke-linecap="round"/>`,
  flame: `<path d="M20 9 C17 12 14 16 14 20.5 C14 24.5 16.7 28 20 28 C23.3 28 26 24.5 26 20.5 C26 18 24.5 16 24.5 16 C24.5 16 24 19 22 20 C22 20 23 17 21.5 14 C21.5 14 21 17 19 17.5 C19 17.5 21 15 20 9 Z" stroke="white" stroke-width="1.5" fill="rgba(255,255,255,0.22)" stroke-linejoin="round"/>`,
  leaf: `<path d="M20 30 L20 19" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M20 8 C20 8 29 11 29 21 C29 27 25 30 20 30 C15 30 11 27 11 21 C11 11 20 8 20 8 Z" stroke="white" stroke-width="1.6" fill="rgba(255,255,255,0.20)" stroke-linejoin="round"/><path d="M14 16 C16 14 18.5 13.5 20 14" stroke="white" stroke-width="1.4" stroke-linecap="round"/>`,
  star: `<polygon points="20,9 22.9,17.1 31.5,17.1 24.8,22.3 27.3,30.4 20,25.2 12.7,30.4 15.2,22.3 8.5,17.1 17.1,17.1" fill="white" fill-opacity="0.9" stroke="rgba(255,255,255,0.4)" stroke-width="0.5" stroke-linejoin="round"/>`,
  bowl: `<path d="M13 10 C13 10 12.5 12 14 13" stroke="white" stroke-width="1.4" stroke-linecap="round"/><path d="M20 9 C20 9 19.5 11 21 12" stroke="white" stroke-width="1.4" stroke-linecap="round"/><path d="M27 10 C27 10 26.5 12 28 13" stroke="white" stroke-width="1.4" stroke-linecap="round"/><path d="M9 15 L31 15 C31 15 30 26 20 26 C10 26 9 15 9 15 Z" stroke="white" stroke-width="1.6" fill="rgba(255,255,255,0.20)" stroke-linejoin="round"/><line x1="15" y1="29" x2="25" y2="29" stroke="white" stroke-width="1.8" stroke-linecap="round"/><line x1="20" y1="26" x2="20" y2="29" stroke="white" stroke-width="1.6" stroke-linecap="round"/>`,
};

export function getFaviconSvg(iconId, accentColor = '#10b981') {
  const inner = BRAND_SVG_INNER[iconId] || BRAND_SVG_INNER.fork;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="10" fill="${accentColor}"/>${inner}</svg>`;
}

// ── Brand icon inner SVG content map ─────────────────────────────────────────
const BRAND_INNER = {
  fork: (
    <>
      <line x1="13" y1="7" x2="13" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="20" y1="7" x2="20" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="27" y1="7" x2="27" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M13 15 C13 20 17 20.5 20 20.5 C23 20.5 27 20 27 15" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
      <line x1="20" y1="20.5" x2="20" y2="33" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="15.5" y1="25" x2="24.5" y2="25" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="15.5" y1="28.5" x2="24.5" y2="28.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  flame: (
    <>
      <path
        d="M20 9 C17 12 14 16 14 20.5 C14 24.5 16.7 28 20 28 C23.3 28 26 24.5 26 20.5 C26 18 24.5 16 24.5 16 C24.5 16 24 19 22 20 C22 20 23 17 21.5 14 C21.5 14 21 17 19 17.5 C19 17.5 21 15 20 9 Z"
        stroke="white" strokeWidth="1.5" fill="rgba(255,255,255,0.22)" strokeLinejoin="round"
      />
    </>
  ),
  leaf: (
    <>
      <path
        d="M20 30 L20 19"
        stroke="white" strokeWidth="2" strokeLinecap="round"
      />
      <path
        d="M20 8 C20 8 29 11 29 21 C29 27 25 30 20 30 C15 30 11 27 11 21 C11 11 20 8 20 8 Z"
        stroke="white" strokeWidth="1.6" fill="rgba(255,255,255,0.20)" strokeLinejoin="round"
      />
      <path d="M14 16 C16 14 18.5 13.5 20 14" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  star: (
    <polygon
      points="20,9 22.9,17.1 31.5,17.1 24.8,22.3 27.3,30.4 20,25.2 12.7,30.4 15.2,22.3 8.5,17.1 17.1,17.1"
      fill="white" fillOpacity="0.9" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" strokeLinejoin="round"
    />
  ),
  bowl: (
    <>
      <path d="M13 10 C13 10 12.5 12 14 13" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M20 9 C20 9 19.5 11 21 12" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M27 10 C27 10 26.5 12 28 13" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M9 15 L31 15 C31 15 30 26 20 26 C10 26 9 15 9 15 Z"
        stroke="white" strokeWidth="1.6" fill="rgba(255,255,255,0.20)" strokeLinejoin="round"
      />
      <line x1="15" y1="29" x2="25" y2="29" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="20" y1="26" x2="20" y2="29" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
};

// ── Brand mark ────────────────────────────────────────────────────────────────
// iconId: 'fork' | 'flame' | 'leaf' | 'star' | 'bowl' | 'custom'
// customUrl: base64 data URL for custom PNG (used when iconId === 'custom')
export function BrandMark({ size = 32, iconId = 'fork', customUrl = '', className = '', style: styleProp = {} }) {
  if (iconId === 'custom' && customUrl) {
    return (
      <img
        src={customUrl}
        width={size}
        height={size}
        alt="Brand"
        className={className}
        style={{ borderRadius: '10px', objectFit: 'cover', flexShrink: 0, ...styleProp }}
      />
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={styleProp}
    >
      <rect width="40" height="40" rx="10" style={{ fill: 'var(--accent)' }} />
      {BRAND_INNER[iconId] ?? BRAND_INNER.fork}
    </svg>
  );
}

// ── Stat card icons ───────────────────────────────────────────────────────────

export function IconIngredients({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 22V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 7C5 7 6.5 4 12 4C17.5 4 19 7 19 7C19 7 19 14 12 14C5 14 5 7 5 7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
      <path d="M8.5 9.5C8.5 9.5 10 8 12 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconRecipes({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M8 3C8 3 7.5 4.5 9 5.5C10.5 6.5 10 8 10 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 3C14 3 13.5 4.5 15 5.5C16.5 6.5 16 8 16 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 11H20C20 11 19.5 18 12 18C4.5 18 4 11 4 11Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
      <line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="18" x2="12" y2="21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconComputations({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="16" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <rect x="7" y="6.5" width="10" height="3.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8.5" cy="14" r="1" fill="currentColor" />
      <circle cx="12" cy="14" r="1" fill="currentColor" />
      <circle cx="15.5" cy="14" r="1" fill="currentColor" />
      <circle cx="8.5" cy="17.5" r="1" fill="currentColor" />
      <circle cx="12" cy="17.5" r="1" fill="currentColor" />
      <circle cx="15.5" cy="17.5" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconPrices({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <polyline points="3,17 8,12 13,14 20,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <polyline points="15,6 20,6 20,11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function IconWarning({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconCheck({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
