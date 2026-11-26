import React, { useState } from 'react';
import { fetchApi } from '../api';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

interface DiscoveredBug {
  category: 'pageerror' | 'console' | 'network' | 'render';
  exceptionType: string;
  message: string;
  stackTrace?: string;
  url: string;
  statusCode?: number;
  timestamp: string;
  details?: Record<string, any>;
}

interface ScanResult {
  url: string;
  durationMs: number;
  bugsFound: DiscoveredBug[];
  incidentsCreated: any[];
  summary: {
    total: number;
    javascriptErrors: number;
    networkFailures: number;
    consoleErrors: number;
  };
}

export default function UrlScanner() {
  const [url, setUrl] = useState('');
  const [simulateClicks, setSimulateClicks] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { currentProjectId, retry } = useAppContext();
  const navigate = useNavigate();

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsScanning(true);
    setError(null);
    setScanResult(null);

    try {
      const res = await fetchApi('/scanner/audit', {
        method: 'POST',
        body: JSON.stringify({
          url: url.trim(),
          projectId: currentProjectId || 'proj_dev_testing',
          simulateClicks
        })
      });

      if (res && res.data) {
        setScanResult(res.data);
        retry(); // Refresh incidents in the global app context
      } else {
        throw new Error('No data received from scanner');
      }
    } catch (err: any) {
      console.error('Scan failed:', err);
      setError(err.message || 'Failed to scan website. Please ensure the URL is reachable.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div style={{ padding: '32px 24px', maxWidth: 'var(--page-max-width)', margin: '0 auto', width: '100%' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ 
            fontSize: 10, 
            fontWeight: 700, 
            padding: '3px 8px', 
            borderRadius: 6, 
            background: 'rgba(37, 99, 235, 0.15)', 
            color: '#3b82f6', 
            border: '1px solid rgba(59, 130, 246, 0.3)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Zero-Code Synthetic Auditor
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-pale-stone)' }}>v1.0</span>
        </div>
        <h1 className="text-heading" style={{ fontSize: 28, margin: '0 0 8px 0' }}>
          Website URL Bug Scanner
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-warm-granite)', maxWidth: 640, lineHeight: 1.5 }}>
          Audit any website, web app, or local server link without installing an SDK. TracePilot spins up a headless browser, executes JavaScript, intercepts network requests, and automatically reports detected bugs with AI root-cause analysis.
        </p>
      </div>

      {/* Input Card */}
      <div className="card" style={{ marginBottom: 32, border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
        <div className="card-body" style={{ padding: 24 }}>
          <form onSubmit={handleScan}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <div style={{ flex: 1, minWidth: 280, position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Enter website URL (e.g. https://my-app.com or http://localhost:5173)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isScanning}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: 'var(--color-obsidian)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-white)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={isScanning || !url.trim()}
                style={{
                  padding: '12px 24px',
                  borderRadius: 8,
                  background: isScanning ? '#1d4ed8' : '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: isScanning || !url.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  opacity: isScanning || !url.trim() ? 0.7 : 1,
                  transition: 'background 0.15s ease'
                }}
              >
                {isScanning ? (
                  <>
                    <span className="spinner" style={{
                      width: 14,
                      height: 14,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'spin 0.8s linear infinite'
                    }} />
                    Auditing Website...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    Scan for Bugs
                  </>
                )}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-pale-stone)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={simulateClicks}
                  onChange={(e) => setSimulateClicks(e.target.checked)}
                  disabled={isScanning}
                  style={{ accentColor: '#2563eb' }}
                />
                Simulate user interactions (click buttons, scroll, trigger lazy loading)
              </label>

              <div style={{ display: 'flex', gap: 12, fontSize: 12, alignItems: 'center' }}>
                <span style={{ color: 'var(--color-warm-granite)' }}>Quick test:</span>
                <button
                  type="button"
                  onClick={() => setUrl('https://example.com')}
                  style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }}
                >
                  ⚡ Synthetic Failure Target
                </button>
                <button
                  type="button"
                  onClick={() => setUrl('http://localhost:5173')}
                  style={{ background: 'rgba(37, 99, 235, 0.15)', border: '1px solid rgba(37, 99, 235, 0.3)', color: '#60a5fa', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
                >
                  localhost:5173
                </button>
                <button
                  type="button"
                  onClick={() => setUrl('https://example.com')}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                >
                  example.com
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{
          padding: '16px 20px',
          borderRadius: 8,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#f87171',
          marginBottom: 24,
          fontSize: 14
        }}>
          <strong>Audit Failed:</strong> {error}
        </div>
      )}

      {/* Live Scanning Progress Banner */}
      {isScanning && (
        <div className="card" style={{ padding: 24, marginBottom: 32, textAlign: 'center', background: 'var(--color-obsidian)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
          <div style={{ display: 'inline-block', marginBottom: 12 }}>
            <div style={{
              width: 36,
              height: 36,
              border: '3px solid rgba(59, 130, 246, 0.2)',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-white)', marginBottom: 4 }}>
            Scanning {url}...
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-pale-stone)' }}>
            Launching headless Chromium • Evaluating JavaScript • Capturing Console Logs & Failed Network APIs
          </div>
        </div>
      )}

      {/* Results View */}
      {scanResult && (
        <div>
          {/* Summary Stat Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            <div className="card" style={{ padding: 20, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-obsidian)' }}>
              <div style={{ fontSize: 12, color: 'var(--color-pale-stone)', marginBottom: 6 }}>TOTAL BUGS FOUND</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: scanResult.summary.total > 0 ? '#ef4444' : '#10b981' }}>
                {scanResult.summary.total}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-warm-granite)', marginTop: 4 }}>
                In {Math.round(scanResult.durationMs / 100) / 10}s scan
              </div>
            </div>

            <div className="card" style={{ padding: 20, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-obsidian)' }}>
              <div style={{ fontSize: 12, color: 'var(--color-pale-stone)', marginBottom: 6 }}>JAVASCRIPT EXCEPTIONS</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: scanResult.summary.javascriptErrors > 0 ? '#f87171' : 'var(--color-white)' }}>
                {scanResult.summary.javascriptErrors}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-warm-granite)', marginTop: 4 }}>Uncaught page errors</div>
            </div>

            <div className="card" style={{ padding: 20, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-obsidian)' }}>
              <div style={{ fontSize: 12, color: 'var(--color-pale-stone)', marginBottom: 6 }}>NETWORK & API FAILURES</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: scanResult.summary.networkFailures > 0 ? '#fbbf24' : 'var(--color-white)' }}>
                {scanResult.summary.networkFailures}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-warm-granite)', marginTop: 4 }}>HTTP 4xx / 5xx & drops</div>
            </div>

            <div className="card" style={{ padding: 20, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-obsidian)' }}>
              <div style={{ fontSize: 12, color: 'var(--color-pale-stone)', marginBottom: 6 }}>CONSOLE ERRORS</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: scanResult.summary.consoleErrors > 0 ? '#a78bfa' : 'var(--color-white)' }}>
                {scanResult.summary.consoleErrors}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-warm-granite)', marginTop: 4 }}>Logged to console.error</div>
            </div>
          </div>

          {/* Incidents Created Banner */}
          {scanResult.incidentsCreated.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderRadius: 8,
              background: 'rgba(37, 99, 235, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              marginBottom: 24
            }}>
              <div style={{ fontSize: 14, color: 'var(--color-white)' }}>
                🎉 <strong>{scanResult.incidentsCreated.length} new incidents</strong> created and queued for AI Root-Cause Analysis.
              </div>
              <button
                onClick={() => navigate('/incidents')}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                View Incidents Dashboard →
              </button>
            </div>
          )}

          {/* Discovered Bugs List */}
          <div className="card" style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-white)' }}>
                Discovered Issues ({scanResult.bugsFound.length})
              </div>
              <span style={{ fontSize: 12, color: 'var(--color-pale-stone)' }}>
                Scanned: {scanResult.url}
              </span>
            </div>

            {scanResult.bugsFound.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.05)', borderRadius: 12 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🛡️</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#10b981' }}>Website is 100% Healthy — No Bugs Detected!</div>
                <div style={{ fontSize: 14, color: 'var(--color-pale-stone)', marginTop: 8, maxWidth: 540, margin: '8px auto 0', lineHeight: 1.6 }}>
                  The synthetic browser audited <strong>{scanResult.url}</strong> in {Math.round(scanResult.durationMs / 100) / 10}s.<br/>
                  Zero uncaught exceptions, zero console errors, and zero failed network requests were detected on this page.
                </div>
              </div>
            ) : (
              <div>
                {scanResult.bugsFound.map((bug, idx) => (
                  <div key={idx} style={{ padding: 20, borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        textTransform: 'uppercase',
                        background:
                          bug.category === 'pageerror' ? 'rgba(239, 68, 68, 0.15)' :
                          bug.category === 'network' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                        color:
                          bug.category === 'pageerror' ? '#ef4444' :
                          bug.category === 'network' ? '#f59e0b' : '#a855f7',
                        border: `1px solid ${
                          bug.category === 'pageerror' ? 'rgba(239, 68, 68, 0.3)' :
                          bug.category === 'network' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(168, 85, 247, 0.3)'
                        }`
                      }}>
                        {bug.category}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-white)', fontFamily: 'var(--font-geist-mono)' }}>
                        {bug.exceptionType}
                      </span>
                      {bug.statusCode && (
                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
                          HTTP {bug.statusCode}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 13, color: 'var(--color-pale-stone)', marginBottom: 8, wordBreak: 'break-word' }}>
                      {bug.message}
                    </div>

                    {bug.stackTrace && (
                      <pre style={{
                        margin: '8px 0 0 0',
                        padding: 12,
                        borderRadius: 6,
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        color: 'var(--color-warm-granite)',
                        fontSize: 11,
                        overflowX: 'auto',
                        maxHeight: 120,
                        fontFamily: 'var(--font-geist-mono)'
                      }}>
                        {bug.stackTrace}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Graph Engineering Architecture Note */}
      <div style={{ marginTop: 48, padding: 20, borderRadius: 12, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-white)', marginBottom: 8 }}>
          🌐 TracePilot Knowledge Graph Flow
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-pale-stone)', lineHeight: 1.6 }}>
          When you scan a URL, TracePilot executes a directed <strong>Task Graph</strong>:
          <code style={{ display: 'block', margin: '8px 0', padding: 8, borderRadius: 6, background: 'var(--color-obsidian)', color: '#38bdf8', fontSize: 11 }}>
            Scanned URL ➔ Headless Browser ➔ Event Interception (DOM + Net + Console) ➔ Deterministic Fingerprint ➔ TracePilot Knowledge Graph ➔ Gemini AI Diagnosis
          </code>
          Every detected issue creates a persistent node linked to its root URL and request signature.
        </div>
      </div>
    </div>
  );
}
