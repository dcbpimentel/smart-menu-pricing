import { useState } from 'react';
import { readImageFile } from '../lib/image';

function PhotoIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Small square photo used next to recipe names in lists and tables.
// Falls back to a placeholder when the recipe has no photo.
export function RecipeThumb({ src, name, size = 32, radius = 8 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0, overflow: 'hidden',
      background: '#F6F1E9', border: '1px solid var(--divider)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-ultra-muted)',
    }}>
      {src
        ? <img src={src} alt={name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <PhotoIcon size={Math.round(size * 0.5)} />}
    </div>
  );
}

// Optional photo upload field for recipe forms. value is a data URL or ''.
export function PhotoPicker({ value, onChange, height = 120 }) {
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setProcessing(true);
    try {
      onChange(await readImageFile(file));
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
        Dish Photo <span style={{ fontWeight: 500, color: 'var(--text-ultra-muted)' }}>(optional)</span>
      </label>
      <label style={{ display: 'block', cursor: 'pointer' }}>
        <div style={{
          height, borderRadius: 12, border: '1.5px dashed var(--input-border)',
          background: 'var(--input-bg)', overflow: 'hidden', display: 'flex',
          alignItems: 'center', justifyContent: 'center', position: 'relative',
          transition: 'border-color 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--input-border)'}
        >
          {value ? (
            <img src={value} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'var(--text-ultra-muted)' }}>
              <PhotoIcon size={24} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>{processing ? 'Processing photo…' : 'Click to upload photo'}</span>
              <span style={{ fontSize: 11, color: 'var(--text-ultra-muted)' }}>Any size. JPG, PNG or WEBP</span>
            </div>
          )}
        </div>
        <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      </label>
      {error && <p style={{ margin: '6px 0 0', fontSize: 12, color: 'oklch(0.55 0.16 28)' }}>{error}</p>}
      {value && (
        <button type="button" onClick={() => onChange('')}
          style={{ marginTop: 6, fontSize: 12, color: 'oklch(0.55 0.16 28)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, fontWeight: 600 }}>
          Remove photo
        </button>
      )}
    </div>
  );
}
