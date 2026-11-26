import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Download,
  AlertOctagon,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  ChevronRight,
  Bug,
  Search,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  Zap,
  Eye
} from 'lucide-react';
import { fetchApi } from '../../api';

interface Finding {
  id: string;
  scanId: string;
  issueFingerprint: string;
  title: string;
  description: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence: string;
  verificationStatus: string;
  pageUrl?: string;
  incidentId?: string | null;
  suggestedFix?: string;
  evidenceJson?: any;
}

interface ReportData {
  scan: any;
  report: {
    summaryJson: {
      totalPages: number;
      totalFindings: number;
      criticalCount: number;
      highCount: number;
      mediumCount: number;
      lowCount: number;
      executiveSummary: string;
      keyRiskAreas: string[];
      topRecommendations: string[];
      durationMs: number;
    };
    scoreBreakdownJson: Record<string, { score: number; weight: number; issuesCount: any }>;
    coverageJson: {
      scannedUrls: string[];
      scanType: string;
      viewportsTested: string[];
    };
  };
  pages: any[];
  findings: Finding[];
}

export default function WebsiteHealthReport() {
  const { scanId } = useParams<{ scanId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [creatingBugId, setCreatingBugId] = useState<string | null>(null);

  const loadReport = async () => {
    if (!scanId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApi(`/website-scans/${scanId}/report`);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError('Report not found for this scan.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load scan report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [scanId]);

  const handleCreateBug = async (finding: Finding) => {
    setCreatingBugId(finding.id);
    try {
      const res = await fetchApi(`/scan-findings/${finding.id}/create-bug`, {
        method: 'POST'
      });
      if (res.success && res.data?.incidentId) {
        // Update local finding
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            findings: prev.findings.map((f) =>
              f.id === finding.id ? { ...f, incidentId: res.data.incidentId } : f
            )
          };
        });
      }
    } catch (err: any) {
      alert(`Could not create bug: ${err.message}`);
    } finally {
      setCreatingBugId(null);
    }
  };

  const handleExportJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tracepilot-audit-${scanId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94a3b8' }}>
        <RefreshCw size={36} className="animate-spin" style={{ margin: '0 auto 16px' }} />
        <p style={{ fontSize: 16 }}>Loading website health report...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', padding: 24, textAlign: 'center', backgroundColor: '#1e293b', borderRadius: 12, border: '1px solid #334155' }}>
        <AlertTriangle size={40} color="#f87171" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ margin: 0, color: '#f8fafc' }}>Unable to Load Report</h3>
        <p style={{ color: '#94a3b8', fontSize: 14 }}>{error || 'No report found.'}</p>
        <button
          onClick={() => navigate('/dashboard/website-scanner')}
          style={{ marginTop: 12, padding: '8px 16px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Back to Scanner
        </button>
      </div>
    );
  }

  const { scan, report, findings } = data;
  const summary = report?.summaryJson || {
    totalPages: data.pages?.length || 0,
    totalFindings: findings?.length || 0,
    criticalCount: findings?.filter((f) => f.severity === 'critical').length || 0,
    highCount: findings?.filter((f) => f.severity === 'high').length || 0,
    mediumCount: findings?.filter((f) => f.severity === 'medium').length || 0,
    lowCount: findings?.filter((f) => f.severity === 'low').length || 0,
    executiveSummary: 'Automated audit complete.',
    keyRiskAreas: [],
    topRecommendations: []
  };

  const scoreBreakdown = report?.scoreBreakdownJson || {};
  const overallScore = scan?.healthScore ?? 85;

  let scoreColor = '#ef4444';
  let grade = 'F';
  if (overallScore >= 90) { scoreColor = '#10b981'; grade = 'A'; }
  else if (overallScore >= 80) { scoreColor = '#3b82f6'; grade = 'B'; }
  else if (overallScore >= 70) { scoreColor = '#f59e0b'; grade = 'C'; }
  else if (overallScore >= 60) { scoreColor = '#f97316'; grade = 'D'; }

  // Filter findings
  const filteredFindings = findings.filter((f) => {
    if (categoryFilter !== 'all' && f.category !== categoryFilter) return false;
    if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        (f.pageUrl && f.pageUrl.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 13, marginBottom: 4 }}>
            <span style={{ cursor: 'pointer' }} onClick={() => navigate('/dashboard/website-scanner')}>Website Scanner</span>
            <ChevronRight size={14} />
            <span>Health Audit Report</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#f8fafc' }}>
            Website Health Audit Report
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
            Scan ID: <span style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{scanId}</span> &bull; Scanned {summary.totalPages} page(s)
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => window.print()}
            style={{
              backgroundColor: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Download size={14} />
            <span>Print / PDF</span>
          </button>
          <button
            onClick={handleExportJson}
            style={{
              backgroundColor: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Download size={14} /> Export JSON
          </button>
          <button
            onClick={() => navigate('/dashboard/website-scanner')}
            style={{
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            New Scan
          </button>
        </div>
      </div>

      {/* Main Score & AI Summary Bento Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 28 }}>
        {/* Score Gauge Card */}
        <div style={{
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 16,
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Website Health Score
          </span>
          <div style={{
            position: 'relative',
            width: 140,
            height: 140,
            borderRadius: '50%',
            border: `8px solid ${scoreColor}30`,
            borderTopColor: scoreColor,
            borderRightColor: scoreColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '20px 0',
            boxShadow: `0 0 24px ${scoreColor}20`
          }}>
            <div>
              <div style={{ fontSize: 38, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
                {overallScore}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Grade {grade}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8' }}>
            <span><b style={{ color: '#ef4444' }}>{summary.criticalCount}</b> Critical</span>
            <span><b style={{ color: '#f97316' }}>{summary.highCount}</b> High</span>
            <span><b style={{ color: '#f59e0b' }}>{summary.mediumCount}</b> Med</span>
            <span><b style={{ color: '#3b82f6' }}>{summary.lowCount}</b> Low</span>
          </div>
        </div>

        {/* AI Executive Summary Card */}
        <div style={{
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 16,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Sparkles size={18} color="#a855f7" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#f8fafc' }}>
                AI Executive Summary
              </h3>
            </div>
            <p style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
              {summary.executiveSummary}
            </p>
          </div>

          {summary.topRecommendations && summary.topRecommendations.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #334155' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>
                Actionable Fix Recommendations:
              </span>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#e2e8f0', fontSize: 13, lineHeight: 1.4 }}>
                {summary.topRecommendations.slice(0, 3).map((rec, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Category Breakdown Cards */}
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#f8fafc', marginBottom: 16 }}>
        Category Performance & Audits
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 32 }}>
        {[
          { key: 'functional', label: 'Functional UI', weight: '30%', icon: <Zap size={16} /> },
          { key: 'javascript', label: 'JavaScript & Console', weight: '20%', icon: <AlertOctagon size={16} /> },
          { key: 'accessibility', label: 'WCAG Accessibility', weight: '15%', icon: <Eye size={16} /> },
          { key: 'performance', label: 'Performance', weight: '15%', icon: <Zap size={16} /> },
          { key: 'responsive', label: 'Responsive Layout', weight: '10%', icon: <Smartphone size={16} /> },
          { key: 'security', label: 'Security Headers', weight: '10%', icon: <ShieldAlert size={16} /> }
        ].map((cat) => {
          const catData = scoreBreakdown[cat.key];
          const score = catData ? catData.score : 100;
          let barBg = '#10b981';
          if (score < 60) barBg = '#ef4444';
          else if (score < 80) barBg = '#f59e0b';

          return (
            <div
              key={cat.key}
              style={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 12,
                padding: '16px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{cat.icon} {cat.label}</span>
                <span>{cat.weight}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>
                {score} <span style={{ fontSize: 13, color: '#64748b' }}>/ 100</span>
              </div>
              <div style={{ height: 6, backgroundColor: '#0f172a', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${score}%`, backgroundColor: barBg }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Discovered Bugs Table */}
      <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#f8fafc' }}>
              Detected Issues & Defects ({filteredFindings.length})
            </h2>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
              Every issue is backed by reproducible browser evidence.
            </p>
          </div>

          {/* Search bar */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search issues or URLs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '8px 12px 8px 34px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  color: '#f8fafc',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
              <Search size={14} color="#64748b" style={{ position: 'absolute', left: 12, top: 11 }} />
            </div>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 6,
                color: '#f8fafc',
                fontSize: 13,
                outline: 'none'
              }}
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 6,
                color: '#f8fafc',
                fontSize: 13,
                outline: 'none'
              }}
            >
              <option value="all">All Categories</option>
              <option value="javascript">JavaScript</option>
              <option value="functional">Functional</option>
              <option value="network">Network</option>
              <option value="accessibility">Accessibility</option>
              <option value="responsive">Responsive</option>
              <option value="performance">Performance</option>
              <option value="security">Security</option>
              <option value="seo">SEO</option>
            </select>
          </div>
        </div>

        {filteredFindings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b' }}>
            <CheckCircle size={40} color="#10b981" style={{ margin: '0 auto 12px', opacity: 0.8 }} />
            <h3 style={{ margin: 0, color: '#f8fafc' }}>No Issues Found Matching Filter</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13 }}>Try clearing your search query or filters.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredFindings.map((finding) => {
              let sevColor = '#3b82f6';
              if (finding.severity === 'critical') sevColor = '#ef4444';
              else if (finding.severity === 'high') sevColor = '#f97316';
              else if (finding.severity === 'medium') sevColor = '#f59e0b';

              const isConverting = creatingBugId === finding.id;

              return (
                <div
                  key={finding.id}
                  style={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: 10,
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{
                        backgroundColor: `${sevColor}20`,
                        color: sevColor,
                        border: `1px solid ${sevColor}40`,
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase'
                      }}>
                        {finding.severity}
                      </span>
                      <span style={{
                        backgroundColor: '#1e293b',
                        color: '#94a3b8',
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: 11,
                        textTransform: 'capitalize'
                      }}>
                        {finding.category}
                      </span>
                      <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                        fp:{finding.issueFingerprint.slice(0, 8)}
                      </span>
                    </div>

                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#f8fafc' }}>
                      {finding.title}
                    </h4>
                    <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13, lineHeight: 1.4 }}>
                      {finding.description}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {finding.incidentId ? (
                      <button
                        onClick={() => navigate(`/incidents/${finding.incidentId}`)}
                        style={{
                          backgroundColor: '#065f46',
                          color: '#34d399',
                          border: '1px solid #059669',
                          borderRadius: 6,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <Bug size={14} /> View Bug Incident <ExternalLink size={12} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCreateBug(finding)}
                        disabled={isConverting}
                        style={{
                          backgroundColor: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 14px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: isConverting ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <Bug size={14} /> {isConverting ? 'Creating...' : 'Create TracePilot Bug'}
                      </button>
                    )}

                    <button
                      onClick={() => navigate(`/dashboard/website-scanner/bugs/${finding.id}`)}
                      style={{
                        backgroundColor: '#1e293b',
                        color: '#cbd5e1',
                        border: '1px solid #334155',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      Inspect <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
