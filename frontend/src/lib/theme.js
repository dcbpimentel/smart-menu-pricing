export const THEMES = {
  light: {
    name: 'Light',
    description: "Boyd's daytime — warm cream canvas with forest green accent",
    isDark: false,
    darkCounterpart: 'dark',
    vars: {
      '--accent':              '#2A6E3A',
      '--accent-light':        'oklch(0.957 0.036 148)',
      '--accent-ring':         'oklch(0.942 0.044 148)',
      '--sidebar-bg':          '#FFFFFF',
      '--sidebar-text':        '#1A1512',
      '--sidebar-text-muted':  '#9A8C7E',
      '--sidebar-hover-bg':    'oklch(0.97 0.015 148)',
      '--sidebar-active-bg':   'oklch(0.955 0.026 148)',
      '--sidebar-active-text': '#2A6E3A',
      '--sidebar-right-border':'#EFE8D8',
      '--canvas-bg':           '#FDF8F2',
      '--card-bg':             '#FFFFFF',
      '--card-bg-alt':         '#FDFAF6',
      '--text-primary':        '#1A1512',
      '--text-secondary':      '#6B5E50',
      '--text-muted':          '#8C7C6C',
      '--text-ultra-muted':    '#A8988A',
      '--border':              '#ECE4D4',
      '--border-strong':       '#D8CCB8',
      '--header-bg':           'rgba(253,248,242,0.90)',
      '--header-border':       '#ECE4D4',
      '--input-bg':            '#FDF9F5',
      '--input-border':        '#E4D8C4',
      '--scrollbar-thumb':     '#D4C8B0',
      '--row-hover':           '#FDF9F5',
      '--divider':             '#F2E9DC',
      '--table-header-bg':     '#FDFAF6',
    },
  },
  dark: {
    name: 'Dark',
    description: "Boyd's night — warm espresso canvas with vibrant green accent",
    isDark: true,
    lightCounterpart: 'light',
    vars: {
      '--accent':              '#5DBB5A',
      '--accent-light':        'rgba(93,187,90,0.16)',
      '--accent-ring':         'rgba(93,187,90,0.24)',
      '--sidebar-bg':          '#180E06',
      '--sidebar-text':        'rgba(245,238,220,0.90)',
      '--sidebar-text-muted':  'rgba(245,238,220,0.40)',
      '--sidebar-hover-bg':    'rgba(255,255,255,0.05)',
      '--sidebar-active-bg':   'rgba(93,187,90,0.18)',
      '--sidebar-active-text': '#7DCE7A',
      '--sidebar-right-border':'#2C1A0A',
      '--canvas-bg':           '#140C06',
      '--card-bg':             '#1E1208',
      '--card-bg-alt':         '#261810',
      '--text-primary':        '#F5EDDC',
      '--text-secondary':      '#C4A882',
      '--text-muted':          '#8C7060',
      '--text-ultra-muted':    '#5C4030',
      '--border':              '#2C1A0A',
      '--border-strong':       '#3D2414',
      '--header-bg':           'rgba(20,12,6,0.92)',
      '--header-border':       '#2C1A0A',
      '--input-bg':            '#1C1008',
      '--input-border':        '#3A2012',
      '--scrollbar-thumb':     '#3A2012',
      '--row-hover':           'rgba(255,255,255,0.03)',
      '--divider':             '#261810',
      '--table-header-bg':     '#180E06',
    },
  },
};

export function applyTheme(themeId) {
  const theme = THEMES[themeId] || THEMES.light;
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.setAttribute('data-theme', themeId);
  if (theme.isDark) {
    document.body.setAttribute('data-theme', 'dark');
  } else {
    document.body.removeAttribute('data-theme');
  }
}
