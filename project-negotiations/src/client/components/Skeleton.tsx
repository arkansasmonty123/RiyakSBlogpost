export function SkeletonCard() {
  return (
    <article className="panel case-card skeleton-card" aria-hidden="true">
      <div className="skeleton-line skeleton-title" />
      <div className="skeleton-line skeleton-sub" />
      <div className="skeleton-line skeleton-sub2" />
      <div className="skeleton-line skeleton-sub3" />
    </article>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="case-grid">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
