import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Bug,
  AlertTriangle,
  Copy,
  ExternalLink,
  Code,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { fetchApi } from '../../api';

export default function DetailedBugView() {
  const { bugId } = useParams<{ bugId: string }>();
  const navigate = useNavigate();
  const [finding, setFinding] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingBug, setCreatingBug] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!bugId) return;
    const loadFinding = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchApi(`/scan-findings/${bugId}`);
        if (res.success && res.data) {
          setFinding(res.data);
        } else {
          setError('Finding details not found.');
        }
      } catch (err: any) {
        setError(err.message || 'Error loading finding.');
      } finally {
        setLoading(false);
      }
    };
    loadFinding();
  }, [bugId]);

  const handleCreateBug = async () => {
    if (!finding) return;
    setCreatingBug(true);
    try {
      const res = await fetchApi(`/scan-findings/${finding.id}/create-bug`, {
        method: 'POST'
      });
      if (res.success && res.data?.incidentId) {
        setFinding((prev: any) => ({ ...prev, incidentId: res.data.incidentId }));
      }
    } catch (err: any) {
      alert(`Could not create bug: ${err.message}`);
    } finally {
      setCreatingBug(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94a3b8' }}>
        <RefreshCw size={36} className="animate-spin" style={{ margin: '0 auto 16px' }} />
        <p style={{ fontSize: 16 }}>Loading bug inspection details...</p>
      </div>
    );
  }

  if (error || !finding) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', padding: 24, textAlign: 'center', backgroundColor: '#1e293b', borderRadius: 12, border: '1px solid #334155' }}>
        <AlertTriangle size={40} color="#f87171" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ margin: 0, color: '#f8fafc' }}>Finding Not Found</h3>
        <p style={{ color: '#94a3b8', fontSize: 14 }}>{error || 'The requested bug could not be located.'}</p>
        <button
          onClick={() => navigate('/dashboard/website-scanner')}
          style={{ marginTop: 12, padding: '8px 16px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Back to Scanner
        </button>
      </div>
    );
  }

  let sevColor = '#3b82f6';
  if (finding.severity === 'critical') sevColor = '#ef4444';
  else if (finding.severity === 'high') sevColor = '#f97316';
  else if (finding.severity === 'medium') sevColor = '#f59e0b';

  const evidence = finding.evidenceJson || {};

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
        <span style={{ cursor: 'pointer' }} onClick={() => navigate('/dashboard/website-scanner')}>Website Scanner</span>
        <ChevronRight size={14} />
        <span style={{ cursor: 'pointer' }} onClick={() => navigate(`/dashboard/website-scanner/reports/${finding.scanId}`)}>
          Scan Report
        </span>
        <ChevronRight size={14} />
        <span style={{ color: '#f8fafc' }}>Bug Inspection</span>
      </div>

      {/* Main Header Card */}
      <div style={{
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 16,
        padding: '28px',
        marginBottom: 24
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{
                backgroundColor: `${sevColor}20`,
                color: sevColor,
                border: `1px solid ${sevColor}40`,
                padding: '3px 10px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase'
              }}>
                {finding.severity}
              </span>
              <span style={{
                backgroundColor: '#0f172a',
                color: '#94a3b8',
                border: '1px solid #334155',
                padding: '3px 10px',
                borderRadius: 12,
                fontSize: 12,
                textTransform: 'capitalize'
              }}>
                {finding.category}
              </span>
              <span style={{
                backgroundColor: '#065f46',
                color: '#34d399',
                padding: '3px 10px',
                borderRadius: 12,
                fontSize: 12
              }}>
                Verified Finding
              </span>
            </div>

            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f8fafc' }}>
              {finding.title}
            </h1>
            <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: 14, lineHeight: 1.5 }}>
              {finding.description}
            </p>
          </div>

          <div>
            {finding.incidentId ? (
              <button
                onClick={() => navigate(`/incidents/${finding.incidentId}`)}
                style={{
                  backgroundColor: '#065f46',
                  color: '#34d399',
                  border: '1px solid #059669',
                  borderRadius: 8,
                  padding: '10px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <Bug size={16} /> View Bug Incident <ExternalLink size={14} />
              </button>
            ) : (
              <button
                onClick={handleCreateBug}
                disabled={creatingBug}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 20px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: creatingBug ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'
                }}
              >
                <Bug size={16} /> {creatingBug ? 'Converting...' : 'Create TracePilot Bug'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expected vs Actual Behavior */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24 }}>
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '20px' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
            Expected Behavior
          </span>
          <p style={{ margin: 0, color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>
            {finding.expectedBehavior || 'Element or script should function as expected without errors.'}
          </p>
        </div>

        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '20px' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
            Actual Behavior
          </span>
          <p style={{ margin: 0, color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>
            {finding.actualBehavior || finding.description}
          </p>
        </div>
      </div>

      {/* Step by Step Reproduction */}
      {finding.reproductionSteps && Array.isArray(finding.reproductionSteps) && (
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '20px', marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: '#f8fafc' }}>
            Reproduction Steps
          </h3>
          <ol style={{ margin: 0, paddingLeft: 20, color: '#cbd5e1', fontSize: 14, lineHeight: 1.6 }}>
            {finding.reproductionSteps.map((step: string, idx: number) => (
              <li key={idx} style={{ marginBottom: 4 }}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Technical Evidence */}
      <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Code size={16} color="#38bdf8" /> Technical Evidence & Observations
          </h3>
          <button
            onClick={() => copyToClipboard(JSON.stringify(evidence, null, 2))}
            style={{
              background: 'none',
              border: '1px solid #475569',
              borderRadius: 4,
              color: '#cbd5e1',
              padding: '4px 8px',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <Copy size={12} /> {copied ? 'Copied!' : 'Copy Evidence'}
          </button>
        </div>

        {evidence.stackTrace && (
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Error Stack Trace:</span>
            <pre style={{
              margin: 0,
              padding: '12px 14px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 8,
              color: '#f87171',
              fontSize: 12,
              fontFamily: 'monospace',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap'
            }}>
              {evidence.stackTrace}
            </pre>
          </div>
        )}

        {evidence.snippet && (
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>DOM Element Snippet:</span>
            <pre style={{
              margin: 0,
              padding: '12px 14px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 8,
              color: '#38bdf8',
              fontSize: 12,
              fontFamily: 'monospace',
              overflowX: 'auto'
            }}>
              {evidence.snippet}
            </pre>
          </div>
        )}

        {evidence.selector && (
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>CSS Target Selector:</span>
            <code style={{
              display: 'inline-block',
              padding: '6px 10px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 6,
              color: '#f1f5f9',
              fontSize: 13,
              fontFamily: 'monospace'
            }}>
              {evidence.selector}
            </code>
          </div>
        )}

        {/* Raw Evidence JSON */}
        <div style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Structured Evidence Object:</span>
          <pre style={{
            margin: 0,
            padding: '12px 14px',
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 8,
            color: '#a5f3fc',
            fontSize: 12,
            fontFamily: 'monospace',
            maxHeight: 250,
            overflowY: 'auto'
          }}>
            {JSON.stringify(evidence, null, 2)}
          </pre>
        </div>
      </div>

      {/* Suggested Fix */}
      {finding.suggestedFix && (
        <div style={{
          backgroundColor: '#1e293b',
          border: '1px solid #3b82f640',
          borderRadius: 12,
          padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Sparkles size={18} color="#60a5fa" />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#f8fafc' }}>
              AI Suggested Remediation
            </h3>
          </div>
          <p style={{ margin: 0, color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>
            {finding.suggestedFix}
          </p>
        </div>
      )}
    </div>
  );
}
