export function BrandMark({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return <div className={`brand ${className}`} aria-label="جيت">
    <svg className="brand-symbol" viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect width="48" height="48" rx="15" fill="currentColor"/><path d="M13 16h16c6 0 9 3 9 8s-4 8-10 8H18" stroke="var(--color-bg)" strokeWidth="4" strokeLinecap="round"/><path d="m19 26-6 6 6 6" stroke="var(--color-bg)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="27" cy="23" r="2.5" fill="var(--color-bg)"/></svg>
    {!compact ? <span className="brand-word">جيت<span>كل حصة، خطوة.</span></span> : null}
  </div>;
}
