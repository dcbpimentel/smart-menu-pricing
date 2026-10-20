import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

// options: [{ value: string, label: string, description?: string }]
export default function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  disabled = false,
  searchable = false,
  className = '',
  style = {},
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [query, setQuery] = useState('');
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const ref = useRef(null);
  const portalRef = useRef(null);
  const searchRef = useRef(null);
  const closeTimer = useRef(null);

  const selected = options.find(o => String(o.value) === String(value));

  const filtered = searchable && query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const closeDropdown = () => {
    setClosing(true);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => { setOpen(false); setClosing(false); }, 130);
  };

  const openDropdown = () => {
    if (disabled) return;
    if (open && !closing) { closeDropdown(); return; }
    if (open && closing) return;
    clearTimeout(closeTimer.current);
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setOpen(true);
    setClosing(false);
    setQuery('');
  };

  useEffect(() => {
    if (open && searchable) {
      setTimeout(() => searchRef.current?.focus(), 30);
    }
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!ref.current?.contains(e.target) && !portalRef.current?.contains(e.target)) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, closing]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') closeDropdown(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, closing]);

  return (
    <div ref={ref} className={className} style={{ position: 'relative', ...style }}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={openDropdown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          width: '100%',
          padding: '9px 12px',
          background: disabled ? '#fafafa' : open ? '#FBFBFA' : 'white',
          border: '1px solid #EAEAEA',
          borderRadius: '8px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          boxShadow: open ? '0 0 0 3px rgba(0,0,0,0.05)' : 'none',
          transition: 'background 0.15s ease, box-shadow 0.15s ease',
          textAlign: 'left',
          fontSize: '14px',
          minWidth: 0,
        }}
      >
        <span
          style={{
            color: selected ? '#2F3437' : '#9ca3af',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          style={{
            flexShrink: 0,
            color: '#9ca3af',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          <path
            d="M2.5 4.5L7 9.5L11.5 4.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Dropdown panel — rendered in a portal to escape overflow:hidden ancestors */}
      {open && createPortal(
        <div
          ref={portalRef}
          className={closing ? 'drop-close' : 'drop-open'}
          style={{
            position: 'fixed',
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            background: 'white',
            border: '1px solid #EAEAEA',
            borderRadius: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '300px',
            overflow: 'hidden',
          }}
        >
          {searchable && (
            <div style={{ padding: '8px 8px 4px', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <svg width="13" height="13" viewBox="0 0 15 15" fill="none"
                  style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}>
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M10.5 10.5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Type to search…"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    height: 34, paddingLeft: 28, paddingRight: 10,
                    border: '1px solid #EAEAEA', borderRadius: 7,
                    fontSize: 13, color: '#2F3437', outline: 'none',
                    background: '#FAFAFA',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent, #4C5D3E)'}
                  onBlur={e => e.target.style.borderColor = '#EAEAEA'}
                />
              </div>
            </div>
          )}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '14px', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
                No results
              </div>
            ) : (
              filtered.map((opt) => (
                <OptionItem
                  key={opt.value}
                  opt={opt}
                  isSel={String(opt.value) === String(value)}
                  onClick={() => { onChange(opt.value); closeDropdown(); setQuery(''); }}
                />
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function OptionItem({ opt, isSel, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '10px 14px',
        background: isSel ? '#F7F6F3' : hov ? '#FBFBFA' : 'white',
        color: isSel ? '#111111' : '#2F3437',
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: '14px',
        lineHeight: 1,
        transition: 'background 0.1s ease',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: isSel ? 500 : 400, lineHeight: 1.4 }}>{opt.label}</div>
        {opt.description && (
          <div
            style={{
              fontSize: '12px',
              color: isSel ? '#787774' : '#9ca3af',
              marginTop: '2px',
              lineHeight: 1.3,
            }}
          >
            {opt.description}
          </div>
        )}
      </div>
      {isSel && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          style={{ flexShrink: 0, marginLeft: '8px', color: 'var(--accent)' }}
        >
          <path
            d="M2.5 7L5.5 10L11.5 4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
