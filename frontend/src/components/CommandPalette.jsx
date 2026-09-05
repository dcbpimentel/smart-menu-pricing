import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiHome, FiPackage, FiBook, FiDownload,
  FiDollarSign, FiTrendingUp, FiSettings, FiHelpCircle,
  FiSearch, FiArrowRight,
} from 'react-icons/fi';
import api from '../lib/api';

const PAGES = [
  { label: 'Dashboard',        path: '/',            icon: FiHome },
  { label: 'Ingredients',      path: '/ingredients', icon: FiPackage },
  { label: 'Recipes',          path: '/recipes',     icon: FiBook },
  { label: 'Price Updates',    path: '/extraction',  icon: FiDownload },
  { label: 'Cost Computation', path: '/costing',     icon: FiDollarSign },
  { label: 'Impact Analysis',  path: '/impact',      icon: FiTrendingUp },
  { label: 'Settings',         path: '/settings',    icon: FiSettings },
  { label: 'Help & Guide',     path: '/help',        icon: FiHelpCircle },
];

export default function CommandPalette({ open, onClose }) {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState(PAGES.map(p => ({ ...p, type: 'page' })));
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef  = useRef(null);
  const navigate  = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(PAGES.map(p => ({ ...p, type: 'page' })));
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim().toLowerCase();
    if (!q) { setResults(PAGES.map(p => ({ ...p, type: 'page' }))); return; }

    const pageHits = PAGES
      .filter(p => p.label.toLowerCase().includes(q))
      .map(p => ({ ...p, type: 'page' }));

    setResults(pageHits);

    Promise.all([
      api.get('/ingredients').catch(() => ({ data: { data: [] } })),
      api.get('/recipes').catch(() => ({ data: { data: [] } })),
    ]).then(([ir, rr]) => {
      const ings = (ir.data.data || [])
        .filter(i => i.name.toLowerCase().includes(q))
        .slice(0, 4)
        .map(i => ({ label: i.name, subtitle: i.category, path: '/ingredients', icon: FiPackage, type: 'ingredient' }));
      const recs = (rr.data.data || [])
        .filter(r => r.name.toLowerCase().includes(q))
        .slice(0, 4)
        .map(r => ({ label: r.name, subtitle: `${r.servings} serving${r.servings !== 1 ? 's' : ''}`, path: `/recipes/${r.id}`, icon: FiBook, type: 'recipe' }));
      setResults([...pageHits, ...ings, ...recs]);
    });
  }, [query, open]);

  const go = useCallback((item) => {
    navigate(item.path);
    onClose();
  }, [navigate, onClose]);

  const onKey = useCallback((e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[activeIdx]) go(results[activeIdx]);
    if (e.key === 'Escape') onClose();
  }, [results, activeIdx, go, onClose]);

  if (!open) return null;

  const typeLabel = { page: 'Page', ingredient: 'Ingredient', recipe: 'Recipe' };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9990,
        background: 'rgba(0,0,0,0.38)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 'clamp(60px, 14vh, 130px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '560px', margin: '0 16px',
          background: 'var(--card-bg)', borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
          overflow: 'hidden',
          animation: 'paletteIn 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '15px 18px', borderBottom: '1px solid var(--border)',
        }}>
          <FiSearch size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0); }}
            onKeyDown={onKey}
            placeholder="Search pages, ingredients, recipes…"
            style={{
              flex: 1, border: 'none', background: 'none', outline: 'none',
              fontSize: '15px', color: 'var(--text-primary)', fontFamily: 'inherit',
            }}
          />
          <kbd style={{
            fontSize: '11px', padding: '3px 7px', borderRadius: '5px',
            background: 'var(--canvas-bg)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', fontFamily: 'inherit', letterSpacing: '0.02em',
          }}>esc</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: '340px', overflowY: 'auto', padding: '6px' }}>
          {results.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13.5px' }}>
              No results for "<strong>{query}</strong>"
            </div>
          ) : results.map((item, i) => {
            const Icon = item.icon;
            const active = i === activeIdx;
            return (
              <div
                key={i}
                onClick={() => go(item)}
                onMouseEnter={() => setActiveIdx(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '9px 12px', borderRadius: '10px', cursor: 'pointer',
                  background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                  transition: 'background 0.1s ease',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '8px', flexShrink: 0,
                  background: active ? 'var(--accent-light)' : 'var(--canvas-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  transition: 'background 0.1s ease',
                }}>
                  <Icon size={15} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '14px', fontWeight: 500, lineHeight: 1.3,
                    color: active ? 'var(--sidebar-active-text)' : 'var(--text-primary)',
                  }}>{item.label}</div>
                  {item.subtitle && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
                      {item.subtitle}
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
                  color: active ? 'var(--sidebar-active-text)' : 'var(--text-muted)',
                  opacity: active ? 0.7 : 0.5,
                }}>
                  {typeLabel[item.type]}
                </span>
                <FiArrowRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, opacity: active ? 1 : 0.4 }} />
              </div>
            );
          })}
        </div>

        {/* Footer hints */}
        <div style={{
          padding: '9px 18px', borderTop: '1px solid var(--border)',
          display: 'flex', gap: '16px', color: 'var(--text-muted)', fontSize: '11.5px',
        }}>
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
