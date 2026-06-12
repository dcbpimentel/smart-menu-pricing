import { useState, useRef, useEffect } from 'react';

// options: [{ value: string, label: string, description?: string }]
export default function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  disabled = false,
  className = '',
  style = {},
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = options.find(o => String(o.value) === String(value));

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div ref={ref} className={className} style={{ position: 'relative', ...style }}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
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

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'white',
            border: '1px solid #EAEAEA',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
            overflow: 'hidden auto',
            zIndex: 9999,
            maxHeight: '260px',
          }}
        >
          {options.map((opt) => (
            <OptionItem
              key={opt.value}
              opt={opt}
              isSel={String(opt.value) === String(value)}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            />
          ))}
        </div>
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
