
export default function NotImplemented({ title, message }: { title: string, message: string }) {
  return (
    <div style={{ padding: '40px 24px', maxWidth: 'var(--page-max-width)', margin: '0 auto', width: '100%' }}>
      <div className="text-heading" style={{ marginBottom: 40 }}>{title}</div>
      <div className="card">
        <div className="card-body">
          <div className="empty-state" style={{ border: 'none', padding: 80 }}>
            <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--color-pale-stone)', marginBottom: 8, textTransform: 'uppercase' }}>
              UNAVAILABLE
            </div>
            <div style={{ fontFamily: 'var(--font-geist)', fontSize: 14, color: 'var(--color-warm-granite)', textAlign: 'center', lineHeight: 1.5 }}>
              {message}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
