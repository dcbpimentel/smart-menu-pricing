import { createContext, useContext, useState, useCallback } from 'react';
import { FiCheck, FiX, FiAlertCircle, FiInfo } from 'react-icons/fi';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

const STYLES = {
  success: { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D', icon: '#16A34A' },
  error:   { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626', icon: '#EF4444' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309', icon: '#F59E0B' },
  info:    { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', icon: '#3B82F6' },
};

const ICONS = { success: FiCheck, error: FiX, warning: FiAlertCircle, info: FiInfo };

function ToastItem({ id, message, type, onDismiss }) {
  const s = STYLES[type] || STYLES.info;
  const Icon = ICONS[type] || FiInfo;
  return (
    <div className="toast-item" style={{
      background: s.bg, border: `1px solid ${s.border}`, borderRadius: '12px',
      padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: '10px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.10)', minWidth: '260px', maxWidth: '380px',
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%', background: s.icon,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px',
      }}>
        <Icon size={11} color="white" strokeWidth={2.5} />
      </div>
      <span style={{ flex: 1, fontSize: '13.5px', fontWeight: 500, color: s.text, lineHeight: 1.45 }}>
        {message}
      </span>
      <button
        onClick={() => onDismiss(id)}
        style={{
          border: 'none', background: 'none', cursor: 'pointer', padding: '1px',
          color: s.text, opacity: 0.45, flexShrink: 0, display: 'flex', lineHeight: 1,
          transition: 'opacity 0.15s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
        onMouseLeave={e => e.currentTarget.style.opacity = '0.45'}
      >
        <FiX size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const add = useCallback((message, type, duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const api = {
    success: (msg, dur)  => add(msg, 'success', dur),
    error:   (msg, dur)  => add(msg, 'error',   dur ?? 6000),
    info:    (msg, dur)  => add(msg, 'info',    dur),
    warning: (msg, dur)  => add(msg, 'warning', dur),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div style={{
        position: 'fixed', top: '16px', right: '16px',
        display: 'flex', flexDirection: 'column', gap: '8px',
        zIndex: 9999, pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem {...t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
