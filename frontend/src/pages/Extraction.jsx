import { useState, useRef, useCallback } from 'react';
import api from '../lib/api';
import Select from '../components/Select';
import { SkeletonTable } from '../components/Skeleton';
import { useToast } from '../components/Toast';

/* ─── Design tokens ────────────────────────────────────────────────────────── */
const T = {
  canvasBg:    '#FBF8F3',
  cardBg:      '#FFFFFF',
  cardBorder:  '1px solid #EFE8DE',
  cardRadius:  '20px',
  accent:      'var(--accent, #4C5D3E)',
  accentLight: 'oklch(0.955 0.021 138)',
  textPrimary: '#24201C',
  textSecond:  '#6B625A',
  textMuted:   '#8C837B',
  rowDivider:  '1px solid #F3EDE4',
  rowHover:    '#FDFBF8',
  tblHead:     '#A79E94',
  tblHeadBg:   '#FDFBF8',
  inputBorder: '#E7DFD4',
  inputBg:     '#FDFBF8',
  focusShadow: '0 0 0 4px oklch(0.945 0.028 138)',
};

const SOURCES = [
  { value: 'dti', label: 'DTI — Department of Trade & Industry', description: 'dti.gov.ph price bulletins' },
  { value: 'da',  label: 'DA — Department of Agriculture',       description: 'da.gov.ph price bulletins' },
];

/* ─── Status helpers ─────────────────────────────────────────────────────── */
function getStatus(entry) {
  if (entry.matched === true && !entry.flagged) return 'matched';
  if (entry.matched === 'partial')              return 'partial';
  if (entry.matched === false)                  return 'no_match';
  return 'flagged';
}

const STATUS_META = {
  matched:  { label: 'Matched',      bg: 'oklch(0.955 0.058 145)', color: 'oklch(0.44 0.12 145)', dot: '#4ade80' },
  partial:  { label: 'Needs review', bg: 'oklch(0.975 0.04 85)',   color: 'oklch(0.55 0.12 85)',  dot: '#fbbf24' },
  flagged:  { label: 'Needs review', bg: 'oklch(0.975 0.04 85)',   color: 'oklch(0.55 0.12 85)',  dot: '#fbbf24' },
  no_match: { label: 'No match',     bg: '#F3EDE4',                 color: T.textMuted,            dot: '#C5BCAF' },
};

const FLAG_REASON_TEXT = {
  date_assumed:         'No date found in the document; today was assumed',
  missing_unit:         'No unit found for this row',
  missing_price:        'No price found for this row',
  unusual_price:        'Price is zero or above ₱5,000',
  no_match:             'No ingredient with a similar name',
  low_confidence_match: 'Name is only a partial match; check the ingredient',
  unit_mismatch:        "Bulletin unit differs from the unit this ingredient is priced in; enter the price manually",
  duplicate_match:      'Several bulletin rows matched this ingredient; enter the right one manually',
};

const flagReasonText = (entry) => {
  if (!entry.flag_reason) return undefined;
  const text = FLAG_REASON_TEXT[entry.flag_reason] ?? entry.flag_reason;
  return entry.flag_reason === 'unit_mismatch' && entry.ingredient_unit
    ? `${text} (bulletin: ${entry.normalized_unit}, ${entry.matched_name}: ${entry.ingredient_unit})`
    : text;
};

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function StatusPill({ entry }) {
  const status = getStatus(entry);
  const meta = STATUS_META[status];
  return (
    <span
      title={entry.flagged ? flagReasonText(entry) : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 12,
        fontWeight: 700,
        padding: '3px 10px',
        borderRadius: 20,
        background: meta.bg,
        color: meta.color,
        cursor: 'default',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot, flexShrink: 0 }} />
      {meta.label}
      {entry.flagged && entry.flag_reason && (
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.6 }}>
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )}
    </span>
  );
}

function UploadIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="var(--accent,#4C5D3E)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="17 8 12 3 7 8" stroke="var(--accent,#4C5D3E)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="12" y1="3" x2="12" y2="15" stroke="var(--accent,#4C5D3E)" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 2c-2 2-2 8 0 12M8 2c2 2 2 8 0 12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function StyledInput({ value, onChange, type = 'text', placeholder, required }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        flex: 1,
        height: 44,
        borderRadius: 13,
        border: `1px solid ${focused ? 'var(--accent,#4C5D3E)' : T.inputBorder}`,
        background: focused ? '#FFFFFF' : T.inputBg,
        boxShadow: focused ? T.focusShadow : 'none',
        fontSize: 14,
        color: T.textPrimary,
        padding: '0 14px',
        outline: 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        fontFamily: 'inherit',
      }}
    />
  );
}

function PrimaryBtn({ children, onClick, disabled, type = 'button', style: extraStyle }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: 44,
        padding: '0 20px',
        borderRadius: 13,
        background: 'var(--accent,#4C5D3E)',
        color: '#FFFFFF',
        fontWeight: 700,
        fontSize: 14,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        boxShadow: '0 8px 20px rgba(70,86,56,0.26)',
        transform: (!disabled && hovered) ? 'translateY(-2px)' : 'none',
        opacity: disabled ? 0.5 : 1,
        transition: 'transform 0.15s, box-shadow 0.15s, opacity 0.15s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        ...extraStyle,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryBtn({ children, onClick, disabled, type = 'button', style: extraStyle }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: 40,
        padding: '0 18px',
        borderRadius: 12,
        background: hovered ? '#FDFBF8' : '#FFFFFF',
        border: '1px solid #E7DFD4',
        color: '#4A423B',
        fontWeight: 600,
        fontSize: 13.5,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.15s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        ...extraStyle,
      }}
    >
      {children}
    </button>
  );
}

/* ─── Drop zone ─────────────────────────────────────────────────────────── */
function Dropzone({ file, onFile, accept }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFile(dropped);
  };

  const ext = file ? file.name.split('.').pop().toUpperCase() : '';
  const isPdf = ext === 'PDF';
  const isImg = ['PNG', 'JPG', 'JPEG', 'WEBP'].includes(ext);
  const badgeColor = isPdf ? 'oklch(0.58 0.16 28)' : isImg ? 'oklch(0.44 0.09 150)' : T.textMuted;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragEnter={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `1.5px dashed ${dragging ? 'var(--accent,#4C5D3E)' : '#DFD5C7'}`,
          borderRadius: 18,
          padding: '40px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          textAlign: 'center',
          background: dragging ? '#FFFFFF' : T.inputBg,
          cursor: 'pointer',
          transition: 'border-color 0.15s, background 0.15s',
          userSelect: 'none',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          style={{ display: 'none' }}
          onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); }}
        />

        {/* Icon box */}
        <div style={{
          width: 52,
          height: 52,
          borderRadius: 17,
          background: 'oklch(0.955 0.021 138)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <UploadIcon />
        </div>

        <div>
          <div style={{ fontSize: 17, fontWeight: 600, color: T.textPrimary, marginBottom: 5,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
          }}>
            Drop your price bulletin here
          </div>
          <div style={{ fontSize: 13.5, color: '#7A716A', maxWidth: '46ch', margin: '0 auto' }}>
            PDF, image or saved web page from DTI or DA. We'll read the prices for you.
          </div>
        </div>

        <SecondaryBtn style={{ marginTop: 2 }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M8 2v8M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Upload File
        </SecondaryBtn>
      </div>

      {/* File preview row */}
      {file && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 16,
          padding: '12px 14px',
          borderRadius: 14,
          border: '1px solid #EFE8DE',
          background: T.inputBg,
        }}>
          {/* Badge */}
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            background: '#FFFFFF',
            border: '1px solid #EFE8DE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'monospace',
            fontSize: 10,
            fontWeight: 700,
            color: badgeColor,
            flexShrink: 0,
          }}>
            {ext || 'FILE'}
          </div>

          {/* Name + size */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file.name}
            </div>
            <div style={{ fontSize: 12, color: '#9A9088', marginTop: 2 }}>
              {(file.size / 1024).toFixed(0)} KB
            </div>
          </div>

          {/* Clear */}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onFile(null); }}
            style={{
              width: 28, height: 28, borderRadius: 8,
              border: '1px solid #EFE8DE', background: '#FFFFFF',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.textMuted, flexShrink: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────────────────── */
export default function Extraction() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('upload');

  // Upload tab
  const [file, setFile]               = useState(null);
  const [uploadSource, setUploadSource] = useState('dti');

  // URL tab
  const [url, setUrl]               = useState('');
  const [urlSource, setUrlSource]   = useState('dti');

  // Shared
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [entries, setEntries]       = useState(null);
  const [extractMsg, setExtractMsg] = useState('');

  // Save
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(null);

  const resetResults = () => { setEntries(null); setExtractMsg(''); setError(''); };

  /* ── Extract ── */
  const handleUploadExtract = async (e) => {
    e.preventDefault();
    if (!file) { setError('Please select a file.'); return; }
    setLoading(true);
    setError('');
    setEntries(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('source', uploadSource);
      const res = await api.post('/extraction/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEntries(res.data.data || []);
      setExtractMsg(res.data.message || '');
    } catch (err) {
      const msg = err.response?.data?.message || 'Extraction failed.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleUrlExtract = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setEntries(null);
    try {
      const res = await api.post('/extraction/html', { url: url.trim(), source: urlSource });
      setEntries(res.data.data || []);
      setExtractMsg(res.data.message || '');
    } catch (err) {
      const msg = err.response?.data?.message || 'Extraction failed.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ── Save ── */
  const handleSave = async () => {
    if (!entries?.length) return;
    setSaving(true);
    try {
      const res = await api.post('/extraction/save', { entries });
      const { saved, skipped } = res.data.data;
      setSavedCount(saved);
      toast.success(`${saved} ${saved === 1 ? 'price' : 'prices'} saved to database${skipped > 0 ? `, ${skipped} skipped` : ''}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Counts ── */
  const saveable    = entries?.filter(e => e.matched === true && !e.flagged).length ?? 0;
  const partial     = entries?.filter(e => e.matched === 'partial').length ?? 0;
  const noMatch     = entries?.filter(e => e.matched === false).length ?? 0;
  const dataIssue   = entries?.filter(e => e.matched === true && e.flagged).length ?? 0;
  const needsReview = partial + noMatch + dataIssue;
  const totalRows   = entries?.length ?? 0;

  /* ── Render ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <style>{`
        @keyframes riseIn {
          from { opacity:0; transform:translateY(14px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>

      {/* ── Tab bar + card ── */}
      <div style={{
        background: T.cardBg,
        border: T.cardBorder,
        borderRadius: T.cardRadius,
        overflow: 'hidden',
        padding: 22,
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
      }}>
        {/* Tab bar */}
        <div style={{ display: 'inline-flex', padding: 4, borderRadius: 14, background: '#F3EDE4', gap: 4, alignSelf: 'flex-start' }}>
          {[
            {
              id: 'upload', label: 'Upload File',
              icon: (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M8 2v8M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ),
            },
            {
              id: 'url', label: 'Fetch URL',
              icon: <GlobeIcon />,
            },
          ].map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); resetResults(); }}
                style={{
                  height: 36,
                  padding: '0 16px',
                  borderRadius: 11,
                  fontSize: 13.5,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: active ? '#FFFFFF' : 'transparent',
                  color: active ? T.textPrimary : T.textMuted,
                  boxShadow: active ? '0 2px 8px rgba(36,32,28,0.08)' : 'none',
                  transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  fontFamily: 'inherit',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab panels */}
        {activeTab === 'upload' && (
          <form onSubmit={handleUploadExtract} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Dropzone
              file={file}
              onFile={setFile}
              accept=".pdf,.png,.jpg,.jpeg,.html,.htm"
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxWidth: 320 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>Source</label>
              <Select value={uploadSource} onChange={setUploadSource} options={SOURCES} />
            </div>

            {error && <p style={{ fontSize: 13, color: 'oklch(0.58 0.16 28)', margin: 0 }}>{error}</p>}

            {file && (
              <div>
                <PrimaryBtn type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <span style={{
                        width: 14, height: 14, borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff',
                        display: 'inline-block', animation: 'spin 0.7s linear infinite',
                      }} />
                      Extracting…
                    </>
                  ) : 'Extract Prices'}
                </PrimaryBtn>
              </div>
            )}
          </form>
        )}

        {activeTab === 'url' && (
          <form onSubmit={handleUrlExtract} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>Bulletin URL</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <StyledInput
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://www.dti.gov.ph/..."
                  required
                />
                <PrimaryBtn type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <span style={{
                        width: 14, height: 14, borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff',
                        display: 'inline-block', animation: 'spin 0.7s linear infinite',
                      }} />
                      Fetching…
                    </>
                  ) : 'Fetch URL'}
                </PrimaryBtn>
              </div>
              <p style={{ fontSize: 12.5, color: T.textMuted, margin: 0 }}>
                Paste a government price bulletin page. We read the table and match each item to your ingredients.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxWidth: 320 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecond }}>Source</label>
              <Select value={urlSource} onChange={setUrlSource} options={SOURCES} />
            </div>

            {error && <p style={{ fontSize: 13, color: 'oklch(0.58 0.16 28)', margin: 0 }}>{error}</p>}
          </form>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div style={{
          background: T.cardBg, border: T.cardBorder, borderRadius: T.cardRadius, padding: 20,
        }}>
          <SkeletonTable rows={5} cols={5} />
        </div>
      )}

      {/* Empty state */}
      {!loading && entries === null && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="empty-state-title">No results yet</div>
          <div className="empty-state-subtitle">Upload a price bulletin or fetch from a URL to extract ingredient prices.</div>
        </div>
      )}

      {/* Results */}
      {!loading && entries !== null && (
        <div style={{
          background: T.cardBg,
          border: T.cardBorder,
          borderRadius: T.cardRadius,
          overflow: 'hidden',
          animation: 'riseIn 420ms cubic-bezier(0.22,1,0.36,1) both',
        }}>
          {/* Results header */}
          <div style={{
            padding: '18px 22px',
            borderBottom: '1px solid #F3EDE4',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}>
            <div>
              <h2 style={{
                fontSize: 16.5, fontWeight: 600, color: T.textPrimary, margin: 0,
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
              }}>
                Review before saving
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, color: T.textMuted }}>
                  {saveable} of {totalRows} rows matched
                </span>
                {partial > 0 && (
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: 'oklch(0.975 0.04 85)', color: 'oklch(0.55 0.12 85)',
                  }}>
                    {partial} partial
                  </span>
                )}
                {noMatch > 0 && (
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: '#F3EDE4', color: T.textMuted,
                  }}>
                    {noMatch} no match
                  </span>
                )}
                {dataIssue > 0 && (
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: 'oklch(0.975 0.04 85)', color: 'oklch(0.55 0.12 85)',
                  }}>
                    {dataIssue} flagged
                  </span>
                )}
              </div>
              {extractMsg && (
                <p style={{ fontSize: 12, color: T.textMuted, margin: '4px 0 0' }}>{extractMsg}</p>
              )}
            </div>

            {savedCount !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 10, background: 'oklch(0.955 0.058 145)', border: '1px solid oklch(0.88 0.08 145)' }}>
                <svg width="14" height="14" fill="none" stroke="oklch(0.44 0.12 145)" strokeWidth="2.5" viewBox="0 0 16 16">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 8l5 5 7-7"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'oklch(0.38 0.1 145)' }}>
                  {savedCount} {savedCount === 1 ? 'price' : 'prices'} saved
                </span>
                <button
                  onClick={() => { setSavedCount(null); resetResults(); }}
                  style={{ marginLeft: 6, fontSize: 12.5, fontWeight: 600, color: 'oklch(0.44 0.12 145)', background: 'none', border: '1px solid oklch(0.78 0.1 145)', borderRadius: 8, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Extract Another
                </button>
              </div>
            )}
            <PrimaryBtn onClick={handleSave} disabled={saving || saveable === 0}>
              {saving ? (
                <>
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff',
                    display: 'inline-block', animation: 'spin 0.7s linear infinite',
                  }} />
                  Saving…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <path d="M14 10v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3M8 2v8M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Save {saveable} Valid {saveable === 1 ? 'Match' : 'Matches'}
                </>
              )}
            </PrimaryBtn>
          </div>

          {/* Status legend — always visible above the results table.
              Previously the only explanation was a conditional warning that appeared
              only when some rows had problems. New users had no way to understand
              the color-coded badges until something went wrong.
              This legend is now always shown so users immediately know what each
              status means before they try to save anything. */}
          <div style={{
            padding: '12px 22px',
            background: 'var(--table-header-bg)',
            borderBottom: '1px solid var(--divider)',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '6px 18px',
          }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Status legend:</span>
            {[
              { label: 'Matched',      dot: '#4ade80', desc: 'Price found and linked to an ingredient — will be saved.' },
              { label: 'Needs review', dot: '#fbbf24', desc: 'Fuzzy match found but confidence is low — verify before saving.' },
              { label: 'No match',     dot: '#C5BCAF', desc: 'No ingredient found in your list — add the ingredient first, then re-import.' },
            ].map(item => (
              <span key={item.label} title={item.desc} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: T.textSecond, cursor: 'default' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: item.dot, flexShrink: 0, display: 'inline-block' }} />
                <strong style={{ fontWeight: 600 }}>{item.label}</strong>
                <span style={{ color: T.textMuted }}>— {item.desc}</span>
              </span>
            ))}
          </div>
          {/* Conditional warning — only shown when at least one row is not a clean match.
              It tells the user exactly how many rows will be skipped so there are no
              surprises after clicking Save. */}
          {needsReview > 0 && (
            <div style={{
              padding: '8px 22px',
              background: 'oklch(0.985 0.025 85)',
              borderBottom: '1px solid oklch(0.94 0.05 85)',
              fontSize: 12.5,
              color: 'oklch(0.50 0.12 85)',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
            }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M8 6v3M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M6.5 2.5L1 13h14L9.5 2.5a1.7 1.7 0 00-3 0z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
              {needsReview} row{needsReview !== 1 ? 's' : ''} need manual review and will be skipped when you save.
              Only the <strong style={{ fontWeight: 700 }}>Matched</strong> rows ({saveable}) will be written to the database.
            </div>
          )}

          {entries.length === 0 ? (
            <div style={{ padding: '48px 22px', textAlign: 'center', color: T.textMuted, fontSize: 14 }}>
              No price entries found.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
                <thead>
                  <tr>
                    {[
                      { label: 'Extracted Name',     align: 'left', first: true },
                      { label: 'Matched Ingredient', align: 'left' },
                      { label: 'Unit',               align: 'left' },
                      { label: 'Price',              align: 'right' },
                      { label: 'Status',             align: 'left', last: true },
                    ].map((h, i) => (
                      <th key={i} style={{
                        background: '#FDFBF8',
                        color: '#A79E94',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.07em',
                        textTransform: 'uppercase',
                        padding: '11px 12px',
                        paddingLeft:  h.first ? 22 : 12,
                        paddingRight: h.last  ? 22 : 12,
                        textAlign: h.align,
                      }}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, i) => {
                    const status         = getStatus(entry);
                    const isDataFlagged  = status === 'flagged';
                    const isNoMatch      = status === 'no_match';
                    const willSave       = status === 'matched';

                    return (
                      <tr
                        key={i}
                        className="row-interactive"
                        style={{
                          borderTop: i === 0 ? 'none' : '1px solid #F3EDE4',
                          background: isDataFlagged ? 'oklch(0.995 0.01 85)' : 'transparent',
                          opacity: isNoMatch ? 0.6 : 1,
                          borderLeft: (isDataFlagged || status === 'partial') ? '3px solid oklch(0.75 0.1 85)' : '3px solid transparent',
                          transition: 'background 0.1s, transform 0.1s ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#FDFBF8'}
                        onMouseLeave={e => e.currentTarget.style.background = isDataFlagged ? 'oklch(0.995 0.01 85)' : 'transparent'}
                      >
                        <td style={{ padding: '13px 12px 13px 22px', color: T.textPrimary, fontWeight: 600 }}>
                          {entry.raw_name || entry.normalized_name}
                          {entry.specification && (
                            <div style={{ fontSize: 11.5, fontWeight: 500, color: T.textMuted, marginTop: 2 }}>{entry.specification}</div>
                          )}
                        </td>
                        <td style={{ padding: '13px 12px', color: T.textSecond }}>
                          {entry.matched_name
                            ? entry.matched_name
                            : <span style={{ color: '#D5CCBF', fontStyle: 'italic' }}>—</span>
                          }
                        </td>
                        <td style={{ padding: '13px 12px' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: 12,
                            fontWeight: 600,
                            background: '#F3EDE4',
                            color: T.textMuted,
                            padding: '3px 8px',
                            borderRadius: 8,
                          }}>
                            {entry.normalized_unit || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '13px 12px', textAlign: 'right', fontFamily: 'monospace', color: T.textPrimary, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          ₱{parseFloat(entry.price).toFixed(2)}
                        </td>
                        <td style={{ padding: '13px 22px 13px 12px' }}>
                          <StatusPill entry={entry} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
