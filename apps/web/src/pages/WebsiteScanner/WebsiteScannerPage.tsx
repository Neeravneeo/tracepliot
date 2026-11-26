import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Play, AlertTriangle, RefreshCw, ChevronRight, Smartphone, Laptop } from 'lucide-react';
import { fetchApi } from '../../api';

interface WebsiteScan {
  id: string;
  websiteId: string;
  scanType: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  healthScore: number | null;
  pagesScanned: number;
  pagesDiscovered: number;
  createdAt: string;
  completedAt?: string;
}

export default function WebsiteScannerPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [scanType, setScanType] = useState<'quick' | 'standard' | 'deep'>('quick');
  const [device, setDevice] = useState<'desktop' | 'mobile' | 'both'>('both');
  const [engine, setEngine] = useState<'crawl4ai' | 'playwright'>('crawl4ai');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<WebsiteScan[]>([]);
  const [loadingScans, setLoadingScans] = useState(false);

  // Advanced toggles
  const [categories, setCategories] = useState({
    functional: true,
    javascript: true,
    accessibility: true,
    performance: true,
    responsive: true,
    security: true,
    seo: true
  });

  const loadPastScans = async () => {
    setLoadingScans(true);
    try {
      const res = await fetchApi('/website-scans');
      if (res.success && Array.isArray(res.data)) {
        setRecentScans(res.data);
      }
    } catch {
      // Ignore background load error
    } finally {
      setLoadingScans(false);
    }
  };

  useEffect(() => {
    loadPastScans();
  }, []);

  const handleStartScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let cleanUrl = url.trim();
    if (!cleanUrl) {
      setError('Please enter a website URL.');
      return;
    }
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    setSubmitting(true);
    try {
      const res = await fetchApi('/website-scans', {
        method: 'POST',
        body: JSON.stringify({
          url: cleanUrl,
          scanType,
          configuration: {
            engine,
            device,
            enableAccessibility: categories.accessibility,
            enablePerformance: categories.performance,
            enableResponsive: categories.responsive,
            enableSecurity: categories.security,
            enableSeo: categories.seo,
            enableFunctional: categories.functional
          }
        })
      });

      if (res.success && res.data?.id) {
        navigate(`/dashboard/website-scanner/scans/${res.data.id}`);
      } else {
        setError(res.message || 'Failed to start scan.');
      }
    } catch (err: any) {
      setError(err.message || 'Error initiating scan.');
    } finally {
      setSubmitting(false);
    }
  };

  const getScoreBadge = (score: number | null) => {
    if (score === null) return <span style={{ color: '#94a3b8' }}>Pending</span>;
    let bg = '#ef4444';
    if (score >= 90) bg = '#10b981';
    else if (score >= 75) bg = '#3b82f6';
    else if (score >= 60) bg = '#f59e0b';

    return (
      <span style={{
        backgroundColor: `${bg}20`,
        color: bg,
        border: `1px solid ${bg}40`,
        padding: '2px 8px',
        borderRadius: 12,
        fontWeight: 700,
        fontSize: 12
      }}>
        {score} / 100
      </span>
    );
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        padding: '32px 28px',
        marginBottom: 32,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            padding: 10,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Globe size={24} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#f8fafc' }}>
              AI Website Bug Scanner
            </h1>
            <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 14 }}>
              Find website bugs, broken functionality, responsive overflows, performance bottlenecks, and WCAG accessibility issues with automated browser testing.
            </p>
          </div>
        </div>
      </div>

      {/* Main Scanner Card */}
      <div style={{
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 16,
        padding: '28px',
        marginBottom: 32
      }}>
        <form onSubmit={handleStartScan}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>
            Target Website URL
          </label>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 40px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #475569',
                  borderRadius: 8,
                  color: '#f8fafc',
                  fontSize: 15,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <Globe size={18} color="#64748b" style={{ position: 'absolute', left: 14, top: 14 }} />
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                backgroundColor: submitting ? '#64748b' : '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '0 24px',
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s ease'
              }}
            >
              {submitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Starting...
                </>
              ) : (
                <>
                  <Play size={16} fill="#ffffff" /> Start Automated Scan
                </>
              )}
            </button>
          </div>

          {/* Quick Config Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
            {/* Crawler Engine */}
            <div>
              <span style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6, fontWeight: 500 }}>
                Crawler Engine
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setEngine('crawl4ai')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    backgroundColor: engine === 'crawl4ai' ? '#2563eb' : '#0f172a',
                    color: engine === 'crawl4ai' ? '#ffffff' : '#cbd5e1',
                    border: `1px solid ${engine === 'crawl4ai' ? '#3b82f6' : '#334155'}`,
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  ⚡ Crawl4AI API
                </button>
                <button
                  type="button"
                  onClick={() => setEngine('playwright')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    backgroundColor: engine === 'playwright' ? '#2563eb' : '#0f172a',
                    color: engine === 'playwright' ? '#ffffff' : '#cbd5e1',
                    border: `1px solid ${engine === 'playwright' ? '#3b82f6' : '#334155'}`,
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  🖥️ Chromium
                </button>
              </div>
            </div>

            {/* Scan Scope */}
            <div>
              <span style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6, fontWeight: 500 }}>
                Scan Depth & Scope
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['quick', 'standard', 'deep'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setScanType(mode)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: scanType === mode ? '#2563eb' : '#0f172a',
                      color: scanType === mode ? '#ffffff' : '#cbd5e1',
                      border: `1px solid ${scanType === mode ? '#3b82f6' : '#334155'}`,
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize'
                    }}
                  >
                    {mode === 'quick' ? 'Quick (5)' : mode === 'standard' ? 'Standard (15)' : 'Deep (50)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Viewports */}
            <div>
              <span style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6, fontWeight: 500 }}>
                Target Viewports
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'desktop', label: 'Desktop', icon: <Laptop size={14} /> },
                  { id: 'mobile', label: 'Mobile', icon: <Smartphone size={14} /> },
                  { id: 'both', label: 'All', icon: <Globe size={14} /> }
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDevice(d.id as any)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: device === d.id ? '#2563eb' : '#0f172a',
                      color: device === d.id ? '#ffffff' : '#cbd5e1',
                      border: `1px solid ${device === d.id ? '#3b82f6' : '#334155'}`,
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    {d.icon} {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Test Categories Checkboxes */}
          <div style={{ paddingTop: 16, borderTop: '1px solid #334155' }}>
            <span style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 10, fontWeight: 500 }}>
              Enabled Audit Modules:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {Object.entries(categories).map(([key, val]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#cbd5e1', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={(e) => setCategories({ ...categories, [key]: e.target.checked })}
                    style={{ accentColor: '#3b82f6' }}
                  />
                  <span style={{ textTransform: 'capitalize' }}>{key}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: 16,
              padding: '10px 14px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 8,
              color: '#fca5a5',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <AlertTriangle size={16} /> {error}
            </div>
          )}
        </form>
      </div>

      {/* Recent Scans Table */}
      <div style={{
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 16,
        padding: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#f8fafc' }}>
            Recent Website Audits
          </h2>
          <button
            onClick={loadPastScans}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13
            }}
          >
            <RefreshCw size={14} className={loadingScans ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {recentScans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
            <Globe size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: 14 }}>No website scans executed yet. Enter a URL above to run your first automated audit!</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                  <th style={{ padding: '10px 12px' }}>Scan ID</th>
                  <th style={{ padding: '10px 12px' }}>Scope</th>
                  <th style={{ padding: '10px 12px' }}>Pages</th>
                  <th style={{ padding: '10px 12px' }}>Health Score</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px' }}>Date</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentScans.map((scan) => (
                  <tr
                    key={scan.id}
                    style={{ borderBottom: '1px solid #273549', color: '#cbd5e1', cursor: 'pointer' }}
                    onClick={() => {
                      if (scan.status === 'completed') {
                        navigate(`/dashboard/website-scanner/reports/${scan.id}`);
                      } else {
                        navigate(`/dashboard/website-scanner/scans/${scan.id}`);
                      }
                    }}
                  >
                    <td style={{ padding: '12px', fontFamily: 'monospace', color: '#38bdf8' }}>{scan.id.slice(0, 14)}...</td>
                    <td style={{ padding: '12px', textTransform: 'capitalize' }}>{scan.scanType}</td>
                    <td style={{ padding: '12px' }}>{scan.pagesScanned} / {scan.pagesDiscovered}</td>
                    <td style={{ padding: '12px' }}>{getScoreBadge(scan.healthScore)}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        backgroundColor: scan.status === 'completed' ? '#065f46' : scan.status === 'running' ? '#1e40af' : '#7f1d1d',
                        color: scan.status === 'completed' ? '#34d399' : scan.status === 'running' ? '#60a5fa' : '#f87171'
                      }}>
                        {scan.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: '#64748b' }}>
                      {new Date(scan.createdAt).toLocaleDateString()} {new Date(scan.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <span style={{ color: '#3b82f6', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                        {scan.status === 'completed' ? 'View Report' : 'Track'} <ChevronRight size={14} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
