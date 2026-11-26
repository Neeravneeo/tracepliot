import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RefreshCw, XCircle, CheckCircle2, AlertTriangle, ArrowRight, Activity } from 'lucide-react';
import { fetchApi } from '../../api';

interface ProgressData {
  scanId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  pagesDiscovered: number;
  pagesScanned: number;
  currentUrl?: string;
  healthScore?: number | null;
  errorSummary?: string;
}

export default function ScanProgressPage() {
  const { scanId } = useParams<{ scanId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ProgressData | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scanId) return;

    let timerId: any = null;
    let failureCount = 0;

    const poll = async () => {
      try {
        const res = await fetchApi(`/website-scans/${scanId}/progress`);
        if (res.success && res.data) {
          setData(res.data);
          failureCount = 0;
          if (res.data.status === 'completed' || res.data.status === 'failed' || res.data.status === 'cancelled') {
            return;
          }
        }
      } catch (err: any) {
        failureCount++;
        setError(err.message);
      }

      const backoffMs = Math.min(10000, 1500 * Math.pow(1.5, Math.min(failureCount, 5)));
      timerId = setTimeout(poll, backoffMs);
    };

    poll();

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [scanId]);

  const handleCancel = async () => {
    if (!scanId) return;
    setCancelling(true);
    try {
      await fetchApi(`/website-scans/${scanId}/cancel`, { method: 'POST' });
    } catch {
      // Ignore
    } finally {
      setCancelling(false);
    }
  };

  const pagesScanned = data?.pagesScanned ?? 0;
  const pagesDiscovered = Math.max(1, data?.pagesDiscovered ?? 1);
  const percent = Math.min(100, Math.round((pagesScanned / pagesDiscovered) * 100));

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 16px' }}>
      <div style={{
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 16,
        padding: '36px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
      }}>
        {/* Status Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: '50%',
            backgroundColor: data?.status === 'completed' ? '#065f46' : data?.status === 'failed' ? '#7f1d1d' : '#1e3a8a',
            color: data?.status === 'completed' ? '#34d399' : data?.status === 'failed' ? '#f87171' : '#60a5fa',
            marginBottom: 16
          }}>
            {data?.status === 'completed' ? (
              <CheckCircle2 size={36} />
            ) : data?.status === 'failed' ? (
              <AlertTriangle size={36} />
            ) : (
              <RefreshCw size={32} className="animate-spin" />
            )}
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f8fafc' }}>
            {data?.status === 'completed'
              ? 'Audit Complete!'
              : data?.status === 'failed'
              ? 'Scan Encountered An Error'
              : data?.status === 'cancelled'
              ? 'Scan Cancelled'
              : 'Automated Browser Scan In Progress...'}
          </h2>
          <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: 14 }}>
            Scan ID: <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{scanId}</span>
          </p>
          {data?.errorSummary && (
            <p style={{ margin: '8px 0 0', color: '#f87171', fontSize: 13, background: 'rgba(239, 68, 68, 0.1)', padding: '6px 12px', borderRadius: 6 }}>
              {data.errorSummary}
            </p>
          )}
          {error && (
            <p style={{ margin: '8px 0 0', color: '#f87171', fontSize: 13 }}>
              {error}
            </p>
          )}
        </div>

        {/* Progress Bar */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#cbd5e1', marginBottom: 8 }}>
            <span>Testing & crawling discovered pages...</span>
            <span style={{ fontWeight: 600 }}>{pagesScanned} of {pagesDiscovered} pages ({percent}%)</span>
          </div>
          <div style={{
            height: 10,
            backgroundColor: '#0f172a',
            borderRadius: 5,
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${percent}%`,
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              transition: 'width 0.4s ease'
            }} />
          </div>
        </div>

        {/* Live Inspecting Feed */}
        {data?.status === 'running' && (
          <div style={{
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: '14px 16px',
            marginBottom: 28,
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <Activity size={18} color="#38bdf8" className="animate-pulse" />
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 12, color: '#64748b', display: 'block' }}>Auditing URL:</span>
              <span style={{ fontSize: 13, color: '#f1f5f9', fontFamily: 'monospace' }}>
                {data.currentUrl || 'Initializing Chromium engine...'}
              </span>
            </div>
          </div>
        )}

        {/* Actions / CTA */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          {data?.status === 'completed' ? (
            <button
              onClick={() => navigate(`/dashboard/website-scanner/reports/${scanId}`)}
              style={{
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
              }}
            >
              View Full Health Report <ArrowRight size={16} />
            </button>
          ) : data?.status === 'running' || data?.status === 'pending' ? (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              style={{
                backgroundColor: 'transparent',
                color: '#ef4444',
                border: '1px solid #ef4444',
                borderRadius: 8,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <XCircle size={16} /> Cancel Scan
            </button>
          ) : (
            <button
              onClick={() => navigate('/dashboard/website-scanner')}
              style={{
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Back to Website Scanner
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
