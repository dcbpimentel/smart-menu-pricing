import { useState, useReducer, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

// ── Design tokens (warm system palette) ──────────────────────────────────────
const C = {
  accent:      '#4C5D3E',
  panelBg:     'rgba(252, 249, 245, 0.9)',
  panelBdr:    'rgba(255, 255, 255, 0.72)',
  panelShadow: '0 0 0 0.5px rgba(200, 188, 170, 0.3), 0 28px 60px rgba(0,0,0,0.12), 0 10px 24px rgba(0,0,0,0.07), inset 0 1.5px 0 rgba(255,255,255,0.92)',
  displayBg:   'rgba(248, 244, 238, 0.65)',
  numBtn:      'rgba(255, 252, 247, 0.88)',
  opBtn:       'rgba(229, 218, 202, 0.92)',
  actBtn:      'rgba(213, 203, 189, 0.88)',
  btnBdr:      'rgba(190, 178, 158, 0.32)',
  btnShadow:   '0 1.5px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.82)',
  text:        '#2B2016',
  textMuted:   '#9A8F87',
  textErr:     '#C0392B',
};

// ── Styles injected once into the portal ─────────────────────────────────────
const PORTAL_STYLES = `
  @keyframes calcPanelIn  { from { opacity:0; transform:scale(0.84) translateY(16px); } to { opacity:1; transform:scale(1) translateY(0); } }
  @keyframes calcPanelOut { from { opacity:1; transform:scale(1) translateY(0); }       to { opacity:0; transform:scale(0.9) translateY(10px); } }
  @keyframes calcBtnIn    { from { opacity:0; transform:scale(0.7); } to { opacity:1; transform:scale(1); } }
  .fc-btn { transition: transform 0.1s ease, filter 0.12s ease; user-select:none; -webkit-user-select:none; outline:none; }
  .fc-btn:hover { filter: brightness(0.94); }
  .fc-btn:active { transform: scale(0.91) !important; filter: brightness(0.88) !important; }
  .fc-toggle:active { transform: scale(0.94) !important; }
`;

// ── Calculator logic ──────────────────────────────────────────────────────────
const INIT_STATE = { display: '0', expr: '', op: null, prev: null, fresh: false };

function fmtNum(n) {
  if (!isFinite(n) || isNaN(n)) return 'Error';
  const rounded = parseFloat(n.toFixed(9));
  if (Math.abs(rounded) >= 1e11) return 'Too large';
  return String(rounded);
}

function operate(a, b, op) {
  if (op === '+') return a + b;
  if (op === '−') return a - b;
  if (op === '×') return a * b;
  if (op === '÷') return b === 0 ? Infinity : a / b;
  return b;
}

function calcReducer(s, a) {
  switch (a.type) {
    case 'DIGIT': {
      if (s.fresh) return { ...s, display: a.v, fresh: false };
      if (s.display === '0') return { ...s, display: a.v };
      if (s.display.replace(/[-.]/g, '').length >= 10) return s;
      return { ...s, display: s.display + a.v };
    }
    case 'DOT': {
      if (s.fresh) return { ...s, display: '0.', fresh: false };
      if (s.display.includes('.')) return s;
      return { ...s, display: s.display + '.' };
    }
    case 'OP': {
      const curr = parseFloat(s.display);
      if (s.op && !s.fresh) {
        const result = operate(s.prev, curr, s.op);
        const d = fmtNum(result);
        return { display: d, expr: d + ' ' + a.v, op: a.v, prev: result, fresh: true };
      }
      return { ...s, expr: s.display + ' ' + a.v, op: a.v, prev: curr, fresh: true };
    }
    case 'EQ': {
      if (!s.op) return s;
      const curr = parseFloat(s.display);
      const result = operate(s.prev, curr, s.op);
      const d = fmtNum(result);
      return { display: d, expr: '', op: null, prev: null, fresh: true };
    }
    case 'CLEAR':  return INIT_STATE;
    case 'SIGN': {
      const v = parseFloat(s.display);
      return { ...s, display: fmtNum(-v) };
    }
    case 'PCT': {
      const v = parseFloat(s.display);
      return { ...s, display: fmtNum(v / 100) };
    }
    case 'BACK': {
      if (s.fresh || s.display === 'Error' || s.display === 'Too large') {
        return { ...s, display: '0', fresh: false };
      }
      const next = s.display.slice(0, -1);
      return { ...s, display: next === '' || next === '-' ? '0' : next };
    }
    default: return s;
  }
}

// ── Button config ─────────────────────────────────────────────────────────────
const BTN_ROWS = [
  [
    { label: 'AC', kind: 'act', action: { type: 'CLEAR' } },
    { label: '±',  kind: 'act', action: { type: 'SIGN'  } },
    { label: '%',  kind: 'act', action: { type: 'PCT'   } },
    { label: '÷',  kind: 'op',  action: { type: 'OP', v: '÷' } },
  ],
  [
    { label: '7', kind: 'num', action: { type: 'DIGIT', v: '7' } },
    { label: '8', kind: 'num', action: { type: 'DIGIT', v: '8' } },
    { label: '9', kind: 'num', action: { type: 'DIGIT', v: '9' } },
    { label: '×', kind: 'op',  action: { type: 'OP', v: '×' } },
  ],
  [
    { label: '4', kind: 'num', action: { type: 'DIGIT', v: '4' } },
    { label: '5', kind: 'num', action: { type: 'DIGIT', v: '5' } },
    { label: '6', kind: 'num', action: { type: 'DIGIT', v: '6' } },
    { label: '−', kind: 'op',  action: { type: 'OP', v: '−' } },
  ],
  [
    { label: '1', kind: 'num', action: { type: 'DIGIT', v: '1' } },
    { label: '2', kind: 'num', action: { type: 'DIGIT', v: '2' } },
    { label: '3', kind: 'num', action: { type: 'DIGIT', v: '3' } },
    { label: '+', kind: 'op',  action: { type: 'OP', v: '+' } },
  ],
];

const BTN_LAST_ROW = [
  { label: '0', kind: 'num_wide', action: { type: 'DIGIT', v: '0' } },
  { label: '.', kind: 'num',      action: { type: 'DOT'  } },
  { label: '=', kind: 'eq',       action: { type: 'EQ'   } },
];

function btnBg(kind) {
  if (kind === 'act')      return C.actBtn;
  if (kind === 'op')       return C.opBtn;
  if (kind === 'eq')       return C.accent;
  return C.numBtn;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function FloatingCalculator() {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem('smp_calc_enabled') !== 'false'; } catch { return true; }
  });
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const [calcState, dispatch] = useReducer(calcReducer, INIT_STATE);

  const panelRef = useRef(null);
  const btnRef   = useRef(null);

  // Sync enabled state from Settings page
  useEffect(() => {
    const handler = () => {
      try { setEnabled(localStorage.getItem('smp_calc_enabled') !== 'false'); } catch {}
    };
    window.addEventListener('calc-setting-changed', handler);
    return () => window.removeEventListener('calc-setting-changed', handler);
  }, []);

  const doClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 180);
  }, []);

  const toggleCalc = useCallback(() => {
    if (open) doClose();
    else setOpen(true);
  }, [open, doClose]);

  // Close when clicking outside panel + button
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      if (btnRef.current?.contains(e.target)) return;
      doClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, doClose]);

  // Keyboard input while panel is open
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        dispatch({ type: 'DIGIT', v: e.key });
      } else if (e.key === '.') {
        e.preventDefault();
        dispatch({ type: 'DOT' });
      } else if (e.key === '+') {
        dispatch({ type: 'OP', v: '+' });
      } else if (e.key === '-') {
        dispatch({ type: 'OP', v: '−' });
      } else if (e.key === '*') {
        dispatch({ type: 'OP', v: '×' });
      } else if (e.key === '/') {
        e.preventDefault();
        dispatch({ type: 'OP', v: '÷' });
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        dispatch({ type: 'EQ' });
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        dispatch({ type: 'BACK' });
      } else if (e.key === 'Escape') {
        doClose();
      } else if (e.key === 'c' || e.key === 'C') {
        dispatch({ type: 'CLEAR' });
      } else if (e.key === '%') {
        dispatch({ type: 'PCT' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, doClose]);

  if (!enabled) return null;

  const { display, expr, op } = calcState;
  const isErr = display === 'Error' || display === 'Too large';
  const numFontSize = display.length > 9 ? 21 : display.length > 6 ? 26 : 33;

  const panelStyle = {
    position: 'fixed',
    bottom: 84,
    right: 24,
    width: 272,
    borderRadius: 22,
    background: C.panelBg,
    backdropFilter: 'blur(28px) saturate(1.7)',
    WebkitBackdropFilter: 'blur(28px) saturate(1.7)',
    border: `1px solid ${C.panelBdr}`,
    boxShadow: C.panelShadow,
    overflow: 'hidden',
    zIndex: 99997,
    animation: closing
      ? 'calcPanelOut 0.18s cubic-bezier(0.4,0,0.6,1) forwards'
      : 'calcPanelIn 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards',
  };

  const toggleBtnStyle = {
    position: 'fixed',
    bottom: 24,
    right: 24,
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: open
      ? 'rgba(76, 93, 62, 0.92)'
      : 'rgba(252, 249, 245, 0.92)',
    backdropFilter: 'blur(20px) saturate(1.6)',
    WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
    border: open
      ? '1px solid rgba(255,255,255,0.25)'
      : `1px solid ${C.panelBdr}`,
    boxShadow: btnHovered || open
      ? '0 0 0 0.5px rgba(200,188,170,0.4), 0 12px 32px rgba(0,0,0,0.13), 0 4px 12px rgba(0,0,0,0.08), inset 0 1.5px 0 rgba(255,255,255,0.95)'
      : '0 0 0 0.5px rgba(200,188,170,0.2), 0 4px 12px rgba(0,0,0,0.06), 0 1.5px 4px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.8)',
    opacity: 1,
    transform: (btnHovered && !open) ? 'scale(1.06)' : 'scale(1)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99998,
    transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.22s ease, transform 0.18s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease',
    animation: 'calcBtnIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
  };

  return createPortal(
    <>
      <style>{PORTAL_STYLES}</style>

      {/* Calculator panel */}
      {open && (
        <div ref={panelRef} className="calc-panel" style={panelStyle} role="dialog" aria-label="Calculator">

          {/* Display */}
          <div style={{
            background: C.displayBg,
            padding: '14px 16px 12px',
            borderBottom: '1px solid rgba(190,178,158,0.18)',
            minHeight: 80,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            gap: 2,
          }}>
            <div style={{
              fontSize: 11,
              color: C.textMuted,
              fontFamily: "'SF Mono','Geist Mono',ui-monospace,monospace",
              letterSpacing: '0.01em',
              minHeight: 14,
              lineHeight: 1,
              opacity: expr ? 0.85 : 0.25,
            }}>
              {expr || (op ? `${calcState.prev} ${op}` : '—')}
            </div>
            <div style={{
              fontSize: numFontSize,
              fontWeight: 500,
              lineHeight: 1.05,
              color: isErr ? C.textErr : C.text,
              fontFamily: "'SF Mono','Geist Mono',ui-monospace,monospace",
              letterSpacing: '-0.02em',
              transition: 'font-size 0.08s ease',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {display}
            </div>
          </div>

          {/* Button grid */}
          <div style={{ padding: '10px 10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {BTN_ROWS.map((row, ri) => (
              <div key={ri} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {row.map((btn) => (
                  <button
                    key={btn.label}
                    className="fc-btn"
                    onPointerDown={(e) => { e.preventDefault(); dispatch(btn.action); }}
                    style={{
                      height: 56,
                      borderRadius: 14,
                      background: btnBg(btn.kind),
                      border: `1px solid ${C.btnBdr}`,
                      boxShadow: C.btnShadow,
                      color: btn.kind === 'op' ? C.accent : C.text,
                      fontSize: btn.kind === 'op' ? 19 : 16,
                      fontWeight: btn.kind === 'op' ? 500 : 400,
                      fontFamily: "'SF Pro Display','Helvetica Neue',sans-serif",
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      letterSpacing: btn.kind === 'op' ? '-0.01em' : 0,
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            ))}

            {/* Last row: 0 (wide), ., = */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {BTN_LAST_ROW.map((btn) => (
                <button
                  key={btn.label}
                  className="fc-btn"
                  onPointerDown={(e) => { e.preventDefault(); dispatch(btn.action); }}
                  style={{
                    height: 56,
                    borderRadius: 14,
                    gridColumn: btn.kind === 'num_wide' ? 'span 2' : undefined,
                    background: btnBg(btn.kind),
                    border: btn.kind === 'eq' ? 'none' : `1px solid ${C.btnBdr}`,
                    boxShadow: btn.kind === 'eq'
                      ? '0 2px 8px rgba(76,93,62,0.28), inset 0 1px 0 rgba(255,255,255,0.18)'
                      : C.btnShadow,
                    color: btn.kind === 'eq' ? '#FFFFFF' : C.text,
                    fontSize: btn.kind === 'eq' ? 22 : 16,
                    fontWeight: btn.kind === 'eq' ? 400 : 400,
                    fontFamily: "'SF Pro Display','Helvetica Neue',sans-serif",
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: btn.kind === 'num_wide' ? 'flex-start' : 'center',
                    paddingLeft: btn.kind === 'num_wide' ? 22 : 0,
                    letterSpacing: 0,
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Footer hint */}
          <div style={{
            padding: '0 12px 10px',
            textAlign: 'center',
            fontSize: 10.5,
            color: C.textMuted,
            letterSpacing: '0.02em',
            opacity: 0.7,
          }}>
            Type on keyboard · Esc to close
          </div>
        </div>
      )}

      {/* Floating toggle button */}
      <button
        ref={btnRef}
        className="fc-toggle calc-fab"
        onClick={toggleCalc}
        onMouseEnter={() => setBtnHovered(true)}
        onMouseLeave={() => setBtnHovered(false)}
        aria-label={open ? 'Close calculator' : 'Open calculator'}
        title={open ? 'Close calculator' : 'Open calculator'}
        style={toggleBtnStyle}
      >
        {open ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M1.5 1.5l11 11M12.5 1.5l-11 11" stroke="white" strokeWidth="1.9" strokeLinecap="round"/>
          </svg>
        ) : (
          /* Calculator icon: body + display strip + 3×2 button grid with accent = */
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <rect x="2.5" y="2.5" width="15" height="15" rx="2.5" stroke="#4C5D3E" strokeWidth="1.45"/>
            <rect x="4.5" y="4.5" width="11" height="3" rx="0.75" fill="#4C5D3E" opacity="0.3"/>
            <rect x="4.5" y="10"  width="3"  height="2" rx="0.5" fill="#4C5D3E" opacity="0.45"/>
            <rect x="8.5" y="10"  width="3"  height="2" rx="0.5" fill="#4C5D3E" opacity="0.45"/>
            <rect x="12.5" y="10" width="3"  height="2" rx="0.5" fill="#4C5D3E" opacity="0.45"/>
            <rect x="4.5" y="13.5" width="3" height="2" rx="0.5" fill="#4C5D3E" opacity="0.45"/>
            <rect x="8.5" y="13.5" width="3" height="2" rx="0.5" fill="#4C5D3E" opacity="0.45"/>
            <rect x="12.5" y="13.5" width="3" height="2" rx="0.5" fill="#4C5D3E"/>
          </svg>
        )}
      </button>
    </>,
    document.body
  );
}
