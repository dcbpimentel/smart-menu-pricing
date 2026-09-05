export function SkeletonLine({ width = '100%', height = '13px', radius = '6px', style = {} }) {
  return (
    <div className="skeleton-shimmer" style={{ width, height, borderRadius: radius, ...style }} />
  );
}

export function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--border)',
      borderRadius: '12px', padding: '20px',
    }}>
      <SkeletonLine width="55%" height="16px" style={{ marginBottom: '10px' }} />
      <SkeletonLine width="85%" height="13px" style={{ marginBottom: '4px' }} />
      <SkeletonLine width="65%" height="13px" style={{ marginBottom: '18px' }} />
      <div style={{ display: 'flex', gap: '8px' }}>
        <SkeletonLine width="72px" height="24px" radius="99px" />
        <SkeletonLine width="72px" height="24px" radius="99px" />
      </div>
    </div>
  );
}

export function SkeletonCards({ count = 3 }) {
  return (
    <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  const widths = ['70%', '55%', '45%', '35%', '30%'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{
          display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: '16px', padding: '13px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonLine key={c} width={widths[c % widths.length]} height="13px" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 4 }) {
  return (
    <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: `repeat(${count}, 1fr)` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '16px 20px',
        }}>
          <SkeletonLine width="50%" height="12px" style={{ marginBottom: '10px' }} />
          <SkeletonLine width="65%" height="26px" />
        </div>
      ))}
    </div>
  );
}
