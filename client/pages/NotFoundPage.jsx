/**
 * NotFoundPage fallback component.
 */
export default function NotFoundPage({ onGoHome }) {
  return (
    <div className="not-found-page" style={{ padding: '3rem', textAlign: 'center' }}>
      <h2>404 - Page Not Found</h2>
      <p style={{ marginTop: '1rem', color: 'var(--text-muted, #666)' }}>
        The page you are looking for does not exist.
      </p>
      {onGoHome && (
        <button
          onClick={onGoHome}
          style={{
            marginTop: '1.5rem',
            padding: '0.6rem 1.2rem',
            cursor: 'pointer',
            borderRadius: '6px'
          }}
        >
          Return to Catalog
        </button>
      )}
    </div>
  );
}
