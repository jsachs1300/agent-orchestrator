interface ResultPanelProps {
  data: unknown;
  error?: { status?: number; statusText?: string; body?: string } | null;
  isLoading?: boolean;
}

export default function ResultPanel({ data, error, isLoading }: ResultPanelProps) {
  if (isLoading) {
    return (
      <div className="page-section">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="page-section">
      <h3 className="section-heading">Result</h3>
      {error ? (
        <div className="error-text">
          Error: {error.status} {error.statusText}
          <pre className="result-panel">{error.body}</pre>
        </div>
      ) : (
        <pre className="result-panel">{data ? JSON.stringify(data, null, 2) : 'No response yet.'}</pre>
      )}
    </div>
  );
}
