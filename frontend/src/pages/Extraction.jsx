import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../lib/api';
import Select from '../components/Select';

const SOURCES = [
  { value: 'dti', label: 'DTI — Department of Trade & Industry', description: 'dti.gov.ph price bulletins' },
  { value: 'da',  label: 'DA — Department of Agriculture',       description: 'da.gov.ph price bulletins' },
];

// ── Status helpers ────────────────────────────────────────────────────────────

function getStatus(entry) {
  if (entry.matched === true && !entry.flagged) return 'matched';
  if (entry.matched === 'partial')              return 'partial';
  if (entry.matched === false)                  return 'no_match';
  return 'flagged'; // matched===true but flagged by normalizer (unusual price/unit)
}

const STATUS_META = {
  matched:  { label: 'Matched',   bg: '#f0fdf4', color: '#16a34a', dot: '#22c55e' },
  partial:  { label: 'Partial',   bg: '#eff6ff', color: '#2563eb', dot: '#60a5fa' },
  flagged:  { label: 'Flagged',   bg: '#fffbeb', color: '#d97706', dot: '#fbbf24' },
  no_match: { label: 'No Match',  bg: '#fef2f2', color: '#dc2626', dot: '#f87171' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div
        className="w-8 h-8 rounded-full border-2 border-gray-200 animate-spin"
        style={{ borderTopColor: 'var(--accent)' }}
      />
      <p className="text-sm text-gray-400">Extracting prices…</p>
    </div>
  );
}

function Toast({ message, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);

  const isSuccess = type === 'success';
  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium"
      style={{
        backgroundColor: isSuccess ? '#f0fdf4' : '#fef2f2',
        color: isSuccess ? '#15803d' : '#dc2626',
        border: `1px solid ${isSuccess ? '#bbf7d0' : '#fecaca'}`,
        minWidth: '260px',
      }}
    >
      <span className="text-lg">{isSuccess ? '✓' : '✕'}</span>
      {message}
    </div>
  );
}

function StatusBadge({ entry }) {
  const status = getStatus(entry);
  const meta = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full cursor-default"
      style={{ backgroundColor: meta.bg, color: meta.color }}
      title={entry.flagged && entry.flag_reason ? entry.flag_reason : undefined}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: meta.dot }}
      />
      {meta.label}
      {entry.flagged && entry.flag_reason && (
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="opacity-60">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )}
    </span>
  );
}

function Dropzone({ file, onFile, accept }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFile(dropped);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragEnter={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className="relative rounded-xl border-2 border-dashed cursor-pointer transition-all duration-150 flex flex-col items-center justify-center py-10 px-6 text-center select-none"
      style={{
        borderColor: dragging ? 'var(--accent)' : file ? 'var(--accent-ring)' : '#e5e7eb',
        backgroundColor: dragging ? 'var(--accent-light)' : file ? 'var(--accent-light)' : '#fafafa',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); }}
      />
      {file ? (
        <>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
            style={{ backgroundColor: '#d1fae5' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="14 2 14 8 20 8" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-800 break-all max-w-xs">{file.name}</p>
          <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(0)} KB · Click to change</p>
        </>
      ) : (
        <>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
            style={{ backgroundColor: '#f3f4f6' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="17 8 12 3 7 8" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="3" x2="12" y2="15" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-700">Drop your file here</p>
          <p className="text-xs text-gray-400 mt-1">or click to browse</p>
          <p className="text-xs text-gray-300 mt-2">PDF · PNG · JPG · HTML</p>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Extraction() {
  const [activeTab, setActiveTab] = useState('upload');

  // Upload tab
  const [file, setFile]           = useState(null);
  const [uploadSource, setUploadSource] = useState('dti');

  // URL tab
  const [url, setUrl]             = useState('');
  const [urlSource, setUrlSource] = useState('dti');

  // Shared
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [entries, setEntries]     = useState(null);
  const [extractMsg, setExtractMsg] = useState('');

  // Save
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState(null);

  const dismissToast = useCallback(() => setToast(null), []);

  const resetResults = () => { setEntries(null); setExtractMsg(''); setError(''); };

  // ── Extract ─────────────────────────────────────────────────────────────────

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
      setError(err.response?.data?.message || 'Extraction failed.');
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
      setError(err.response?.data?.message || 'Extraction failed.');
    } finally {
      setLoading(false);
    }
  };

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!entries?.length) return;
    setSaving(true);
    try {
      const res = await api.post('/extraction/save', { entries });
      const { saved, skipped } = res.data.data;
      setToast({
        type: 'success',
        message: `${saved} ${saved === 1 ? 'price' : 'prices'} saved${skipped > 0 ? `, ${skipped} skipped` : ''}`,
      });
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  // ── Derived counts ───────────────────────────────────────────────────────────

  const saveable   = entries?.filter(e => e.matched === true && !e.flagged).length ?? 0;
  const partial    = entries?.filter(e => e.matched === 'partial').length ?? 0;
  const noMatch    = entries?.filter(e => e.matched === false).length ?? 0;
  const dataIssue  = entries?.filter(e => e.matched === true && e.flagged).length ?? 0;
  const needsReview = partial + noMatch + dataIssue;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl space-y-5">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Price Extraction</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Pull ingredient prices from DTI/DA bulletins — upload a file or fetch from a URL
        </p>
      </div>

      {/* Tab card */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">

        {/* Tab headers */}
        <div className="flex border-b border-gray-100">
          {[
            { id: 'upload', label: 'Upload File', icon: (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M8 2v8M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )},
            { id: 'url', label: 'Fetch URL', icon: (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 2c-2 2-2 8 0 12M8 2c2 2 2 8 0 12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            )},
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); resetResults(); }}
              className={[
                'flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'text-emerald-600 border-emerald-500'
                  : 'text-gray-400 border-transparent hover:text-gray-600',
              ].join(' ')}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab panels */}
        <div className="p-6">
          {activeTab === 'upload' && (
            <form onSubmit={handleUploadExtract} className="space-y-4">
              <Dropzone
                file={file}
                onFile={setFile}
                accept=".pdf,.png,.jpg,.jpeg,.html,.htm"
              />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Source</label>
                <Select
                  value={uploadSource}
                  onChange={setUploadSource}
                  options={SOURCES}
                />
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={loading || !file}
                className="w-full py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {loading ? 'Extracting…' : 'Extract Prices'}
              </button>
            </form>
          )}

          {activeTab === 'url' && (
            <form onSubmit={handleUrlExtract} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Bulletin URL</label>
                <input
                  type="url"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                  placeholder="https://www.dti.gov.ph/..."
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Paste the URL of a DTI or DA price bulletin page. PDF links are auto-detected.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Source</label>
                <Select
                  value={urlSource}
                  onChange={setUrlSource}
                  options={SOURCES}
                />
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {loading ? 'Fetching…' : 'Fetch & Extract'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Loading overlay (full-width spinner below the card) */}
      {loading && <Spinner />}

      {/* Results */}
      {!loading && entries !== null && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">

          {/* Results header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-800 text-sm">Extraction Results</h3>
              <p className="text-xs text-gray-400 mt-0.5">{extractMsg}</p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {[
                  { label: `${saveable} matched`,                color: '#16a34a', bg: '#f0fdf4' },
                  ...(partial   > 0 ? [{ label: `${partial} partial`,   color: '#2563eb', bg: '#eff6ff' }] : []),
                  ...(noMatch   > 0 ? [{ label: `${noMatch} no match`,  color: '#dc2626', bg: '#fef2f2' }] : []),
                  ...(dataIssue > 0 ? [{ label: `${dataIssue} flagged`, color: '#d97706', bg: '#fffbeb' }] : []),
                ].map(chip => (
                  <span
                    key={chip.label}
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ color: chip.color, backgroundColor: chip.bg }}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || saveable === 0}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white/40 animate-spin" style={{ borderTopColor: '#fff' }} />
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
            </button>
          </div>

          {/* Note about non-saveable rows */}
          {needsReview > 0 && (
            <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-700 flex items-center gap-2">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M8 6v3M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M6.5 2.5L1 13h14L9.5 2.5a1.7 1.7 0 00-3 0z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
              Only <strong>Matched</strong> rows will be saved. Partial, No Match, and Flagged rows ({needsReview}) need manual review — hover any badge to see details.
            </div>
          )}

          {entries.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">No price entries found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[680px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Extracted Name</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Matched Ingredient</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Unit</th>
                    <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Price</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, i) => {
                    const status = getStatus(entry);
                    const isDataFlagged = status === 'flagged'; // matched but unusual price/unit
                    const willSave      = status === 'matched';
                    return (
                      <tr
                        key={i}
                        className={[
                          i < entries.length - 1 ? 'border-b border-gray-50' : '',
                          isDataFlagged ? 'bg-amber-50/40' : '',
                          !willSave ? 'opacity-60' : '',
                        ].join(' ')}
                      >
                        <td className="px-5 py-3 font-medium text-gray-800">{entry.normalized_name}</td>
                        <td className="px-5 py-3 text-gray-600">
                          {entry.matched_name
                            ? <span>{entry.matched_name}</span>
                            : <span className="text-gray-300 italic">—</span>
                          }
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {entry.normalized_unit || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-gray-700">
                          ₱{parseFloat(entry.price).toFixed(2)}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge entry={entry} />
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

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onDone={dismissToast} />}
    </div>
  );
}
