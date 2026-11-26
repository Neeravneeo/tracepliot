import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchApi } from '../api';
import { formatDistanceToNow } from 'date-fns';

function safeFormatDistance(dateValue: any) {
  if (!dateValue) return 'Unknown';
  try {
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return 'Unknown';
    return formatDistanceToNow(d, { addSuffix: true });
  } catch (e) {
    return 'Unknown';
  }
}

export interface RankedEvidenceItem {
  id: string;
  projectId: string;
  repo: string;
  commitSha: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  score: number | null;
  coverage: number;
  lowCoverageGate: boolean;
  signals: {
    line: number | null;
    temporal: number | null;
    diff: number | null;
    deploy: number | null;
    history: number | null;
  };
  reasons: string[];
  rankingVersion: string;
}

export default function IncidentDetail() {
  const { id } = useParams();
  const [incident, setIncident] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ranked Evidence State
  const [evidenceList, setEvidenceList] = useState<RankedEvidenceItem[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [coverage, setCoverage] = useState<number>(0);
  const [lowCoverageGate, setLowCoverageGate] = useState<boolean>(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);

  // AI State
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Feedback State
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState('');

  // Source ref for scrolling
  const sourceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const loadIncidentAndEvidence = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch incident details
        const resp = await fetchApi(`/incidents/${id}`);
        if (!isMounted) return;
        setIncident(resp.data);

        // Fetch ranked evidence
        try {
          setEvidenceLoading(true);
          const evResp = await fetchApi(`/incidents/${id}/evidence`);
          if (isMounted && evResp.data) {
            setEvidenceList(evResp.data);
            setCoverage(evResp.coverage ?? 0);
            setLowCoverageGate(evResp.lowCoverageGate ?? false);
            if (evResp.data.length > 0) {
              setSelectedEvidenceId(evResp.data[0].id);
            }
          }
        } catch {
          // Evidence retrieval is optional
        } finally {
          if (isMounted) setEvidenceLoading(false);
        }

        // Fetch existing analyses
        try {
          const anResp = await fetchApi(`/incidents/${id}/analyses`);
          if (isMounted && anResp.data && anResp.data.length > 0) {
            const latest = anResp.data[0];
            setAiAnalysis(latest);
            if (latest.feedback) {
              setFeedbackSent(true);
            }
          }
        } catch {
          // No prior analyses
        }

      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Unable to connect to TracePilot API');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadIncidentAndEvidence();
    return () => { isMounted = false; };
  }, [id]);

  const handleAnalyze = async () => {
    if (!id) return;
    try {
      setAiLoading(true);
      setAiError(null);
      setFeedbackSent(false);

      const resp = await fetchApi(`/incidents/${id}/analyses`, { method: 'POST' });
      setAiAnalysis(resp.data);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'Unable to analyze this incident.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleFeedback = async (helpful: boolean) => {
    if (!id || !aiAnalysis?.id) return;
    try {
      setFeedbackLoading(true);
      await fetchApi(`/incidents/${id}/analyses/${aiAnalysis.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          helpful,
          score: helpful ? 5 : 1,
          comment: feedbackComment || undefined
        })
      });
      setFeedbackSent(true);
    } catch (err: any) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleViewSource = () => {
    if (sourceRef.current) {
      sourceRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner" style={{ border: '2px solid var(--color-ash-stroke)', borderTopColor: 'var(--color-bone)', borderRadius: '50%', width: 24, height: 24 }}></div>
        <div className="empty-state-title">Loading incident...</div>
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="empty-state" style={{ borderColor: 'var(--color-signal-orange)' }}>
        <div style={{ color: 'var(--color-signal-orange)', marginBottom: 16 }}>CONNECTION_FAILED</div>
        <div className="empty-state-title">Unable to load incident</div>
        <p style={{ marginBottom: 24 }}>{error || 'Incident not found'}</p>
        <Link to="/incidents" className="btn btn-primary">&larr; Back to incidents</Link>
      </div>
    );
  }

  const stackLines = incident.stackTrace ? incident.stackTrace.split('\n') : [];
  const displayId = incident.id.substring(0, 8).toUpperCase();
  const serviceName = incident.context?.service || incident.runtime?.language || 'Application Service';

  return (
    <div>
      <div style={{ fontFamily: 'var(--font-geist)', fontSize: 14, color: 'var(--color-warm-granite)', marginBottom: 24 }}>
        <Link to="/incidents" style={{ color: 'inherit', textDecoration: 'none' }}>Overview / Incidents</Link> / {displayId}
      </div>

      {/* HEADER SECTION */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div className="detail-eyebrow" style={{ margin: 0 }}>
            INCIDENT #{displayId}
          </div>
          <div className={`badge ${incident.status === 'resolved' ? 'resolved' : 'unresolved'}`} style={{ fontSize: 10 }}>
            {incident.status === 'resolved' ? 'RESOLVED' : 'OPEN'}
          </div>
        </div>

        <h1 style={{ fontFamily: 'var(--font-geist)', fontSize: 32, fontWeight: 400, color: 'var(--color-bone)', marginBottom: 8 }}>
          {incident.exceptionType}
        </h1>
        <div style={{ fontFamily: 'var(--font-geist)', fontSize: 16, color: 'var(--color-warm-granite)', marginBottom: 24, maxWidth: 800 }}>
          {incident.message}
        </div>

        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--color-pale-stone)', textTransform: 'uppercase', marginBottom: 4 }}>Service</div>
            <div style={{ fontFamily: 'var(--font-geist)', fontSize: 14, color: 'var(--color-bone)' }}>{serviceName}</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--color-pale-stone)', textTransform: 'uppercase', marginBottom: 4 }}>Environment</div>
            <div style={{ fontFamily: 'var(--font-geist)', fontSize: 14, color: 'var(--color-bone)', textTransform: 'capitalize' }}>{incident.environment || 'Production'}</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--color-pale-stone)', textTransform: 'uppercase', marginBottom: 4 }}>Release</div>
            <div style={{ fontFamily: 'var(--font-geist)', fontSize: 14, color: 'var(--color-bone)' }}>{incident.release || '1.0.0'}</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--color-pale-stone)', textTransform: 'uppercase', marginBottom: 4 }}>Occurred</div>
            <div style={{ fontFamily: 'var(--font-geist)', fontSize: 14, color: 'var(--color-bone)' }}>{safeFormatDistance(incident.occurredAt)}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 40, paddingBottom: 24, borderBottom: '1px solid var(--color-ash-stroke)' }}>
        <button className="btn btn-primary" onClick={handleAnalyze} disabled={aiLoading}>
          {aiLoading ? 'Diagnosing with AI...' : aiAnalysis ? 'Re-run AI Diagnosis' : 'Analyze with TracePilot AI'}
        </button>
        <button className="btn btn-ghost" style={{ padding: '0 14px', height: 32 }} onClick={handleViewSource}>
          View Evidence ({evidenceList.length})
        </button>
      </div>

      <div className="detail-grid">
        {/* LEFT COLUMN */}
        <div className="detail-main">
          
          {/* 1. Error Overview */}
          <div className="card">
            <div className="card-header">1. Error Overview</div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--color-pale-stone)', textTransform: 'uppercase', marginBottom: 4 }}>EXCEPTION TYPE</div>
                  <div style={{ fontFamily: 'var(--font-geist)', fontSize: 14, color: 'var(--color-bone)' }}>{incident.exceptionType}</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--color-pale-stone)', textTransform: 'uppercase', marginBottom: 4 }}>MESSAGE</div>
                  <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--color-bone)', wordBreak: 'break-all' }}>{incident.message}</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--color-pale-stone)', textTransform: 'uppercase', marginBottom: 4 }}>FINGERPRINT</div>
                  <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--color-warm-granite)' }}>{incident.fingerprint}</div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Stack Trace */}
          <div className="card">
            <div className="card-header">2. Stack Trace</div>
            <div className="card-body">
              {stackLines.length > 0 ? (
                <div className="code-panel">
                  {stackLines.map((line: string, i: number) => {
                    const isAt = line.trim().startsWith('at ');
                    return (
                      <div key={i} className="code-line" style={{ padding: '2px 0' }}>
                        <span className="code-line-number">{i + 1}</span>
                        <span style={{ color: isAt ? 'var(--color-warm-granite)' : 'var(--color-bone)' }}>{line}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: 40, border: 'none' }}>
                  <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--color-ash-stroke)' }}>[ STACK TRACE UNAVAILABLE ]</div>
                </div>
              )}
            </div>
          </div>

          {/* 3. Ranked Code Evidence (Live) */}
          <div className="card" ref={sourceRef}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>3. Ranked Source Code Evidence</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: 'var(--color-warm-granite)' }}>Coverage: {Math.round(coverage * 100)}%</span>
                {lowCoverageGate && (
                  <span className="badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontSize: 10 }}>
                    LOW COVERAGE GATE
                  </span>
                )}
              </div>
            </div>
            <div className="card-body">
              {evidenceLoading ? (
                <div style={{ color: 'var(--color-warm-granite)', fontSize: 13 }}>Loading ranked evidence...</div>
              ) : evidenceList.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {evidenceList.map((item, idx) => {
                    const isSelected = item.id === selectedEvidenceId;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedEvidenceId(item.id)}
                        style={{
                          border: isSelected ? '1px solid var(--color-gold, #F5BD62)' : '1px solid var(--color-ash-stroke)',
                          borderRadius: 8,
                          padding: 16,
                          background: isSelected ? 'rgba(245, 189, 98, 0.04)' : 'transparent',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: 'var(--font-geist-mono)', fontWeight: 600, fontSize: 13, color: 'var(--color-bone)' }}>
                              #{idx + 1} {item.filePath}:{item.startLine}-{item.endLine}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--color-gold, #F5BD62)' }}>
                              Score: {item.score !== null ? (item.score * 100).toFixed(0) + '%' : 'N/A'}
                            </span>
                          </div>
                        </div>

                        {/* Reasons tags */}
                        {item.reasons.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                            {item.reasons.map((r, rIdx) => (
                              <span key={rIdx} style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 4, color: 'var(--color-warm-granite)' }}>
                                {r}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Code snippet */}
                        <pre style={{
                          fontFamily: 'var(--font-geist-mono)',
                          fontSize: 12,
                          background: 'rgba(0,0,0,0.3)',
                          padding: 12,
                          borderRadius: 6,
                          overflowX: 'auto',
                          margin: 0,
                          color: 'var(--color-bone)'
                        }}>
                          {item.content}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: 40, border: '1px dashed var(--color-ash-stroke)' }}>
                  <div style={{ fontFamily: 'var(--font-geist)', fontSize: 14, color: 'var(--color-warm-granite)', marginBottom: 16, lineHeight: 1.5 }}>
                    No source code evidence ingested for this revision yet.<br/>
                    Run the source code ingestion pipeline to index your codebase into TracePilot.
                  </div>
                  <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, background: 'rgba(0,0,0,0.4)', padding: '8px 16px', borderRadius: 6, color: 'var(--color-bone)' }}>
                    tsx src/scripts/ingest-code.ts --projectId={incident.projectId} --dir=./src
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN — AI WAR ROOM PANEL */}
        <div className="detail-sidebar" style={{ position: 'sticky', top: 90, alignSelf: 'start' }}>
          
          <div className="card ai-panel">
            {!aiAnalysis && !aiLoading && !aiError && (
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-bone)', fontFamily: 'var(--font-geist-mono)', fontSize: 12, textTransform: 'uppercase' }}>
                  <div className="live-dot" style={{ backgroundColor: 'var(--color-warm-granite)' }}></div>
                  TRACEPILOT AI DIAGNOSIS
                </div>
                <div style={{ fontFamily: 'var(--font-geist)', fontSize: 14, color: 'var(--color-warm-granite)', lineHeight: 1.5 }}>
                  Analyze stack frames and ranked code evidence to uncover the root cause and generate a verified patch diff.
                </div>
                <button className="btn btn-primary" onClick={handleAnalyze} style={{ width: '100%', justifyContent: 'center' }}>
                  Analyze Incident
                </button>
              </div>
            )}

            {aiLoading && (
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-bone)', fontFamily: 'var(--font-geist-mono)', fontSize: 12, textTransform: 'uppercase' }}>
                  <div className="live-dot" style={{ backgroundColor: 'var(--color-signal-orange)' }}></div>
                  DIAGNOSIS IN PROGRESS
                </div>
                <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--color-warm-granite)', lineHeight: 1.8 }}>
                  <div>✓ Parsing stack trace frames</div>
                  <div>✓ Retrieving authorized code evidence</div>
                  <div>✓ Ranking evidence & computing signal coverage</div>
                  <div style={{ color: 'var(--color-bone)', marginTop: 8 }}>→ Running AI root-cause diagnosis...</div>
                </div>
              </div>
            )}

            {aiError && (
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-signal-orange)', fontFamily: 'var(--font-geist-mono)', fontSize: 12, textTransform: 'uppercase' }}>
                  <div className="live-dot" style={{ backgroundColor: 'var(--color-signal-orange)' }}></div>
                  DIAGNOSIS FAILED
                </div>
                <div style={{ fontFamily: 'var(--font-geist)', fontSize: 14, color: 'var(--color-bone)', lineHeight: 1.5 }}>
                  {aiError}
                </div>
                <button className="btn btn-ghost" onClick={handleAnalyze} style={{ width: '100%', justifyContent: 'center', border: '1px solid var(--color-ash-stroke)' }}>
                  Retry Analysis
                </button>
              </div>
            )}

            {aiAnalysis && (
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-metric-green)', fontFamily: 'var(--font-geist-mono)', fontSize: 12, textTransform: 'uppercase' }}>
                    <div className="live-dot" style={{ backgroundColor: 'var(--color-metric-green)' }}></div>
                    AI ROOT CAUSE DIAGNOSIS
                  </div>
                  <span className="badge" style={{ fontSize: 10, textTransform: 'uppercase' }}>
                    {aiAnalysis.supportLevel || 'STRONG'}
                  </span>
                </div>

                {/* Root Cause */}
                <div>
                  <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--color-pale-stone)', textTransform: 'uppercase', marginBottom: 6 }}>
                    ROOT CAUSE HYPOTHESIS
                  </div>
                  <div style={{ fontFamily: 'var(--font-geist)', fontSize: 14, color: 'var(--color-bone)', lineHeight: 1.5 }}>
                    {aiAnalysis.rootCause}
                  </div>
                </div>

                {/* Suggested Fix */}
                {aiAnalysis.suggestedFix && (
                  <div>
                    <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--color-pale-stone)', textTransform: 'uppercase', marginBottom: 6 }}>
                      RECOMMENDED FIX
                    </div>
                    <div style={{ fontFamily: 'var(--font-geist)', fontSize: 14, color: 'var(--color-bone)', lineHeight: 1.5 }}>
                      {aiAnalysis.suggestedFix}
                    </div>
                  </div>
                )}

                {/* Patch Diff */}
                {aiAnalysis.patchDiff && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--color-pale-stone)', textTransform: 'uppercase' }}>
                        SUGGESTED PATCH DIFF (PROVISIONAL)
                      </span>
                      <span className="badge" style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)', color: 'var(--color-warm-granite)' }}>
                        Validation: {aiAnalysis.patchValidationStatus || 'Not run'}
                      </span>
                    </div>
                    <pre style={{
                      fontFamily: 'var(--font-geist-mono)',
                      fontSize: 11,
                      background: 'rgba(0,0,0,0.4)',
                      padding: 10,
                      borderRadius: 6,
                      overflowX: 'auto',
                      color: '#a7f3d0'
                    }}>
                      {aiAnalysis.patchDiff}
                    </pre>
                  </div>
                )}

                {/* Uncertainty */}
                {aiAnalysis.uncertainty && (
                  <div>
                    <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--color-pale-stone)', textTransform: 'uppercase', marginBottom: 6 }}>
                      UNCERTAINTY & LIMITATIONS
                    </div>
                    <div style={{ fontFamily: 'var(--font-geist)', fontSize: 13, color: 'var(--color-warm-granite)', lineHeight: 1.5 }}>
                      {aiAnalysis.uncertainty}
                    </div>
                  </div>
                )}

                {/* Cited Evidence */}
                {aiAnalysis.evidenceRefs && aiAnalysis.evidenceRefs.length > 0 && (
                  <div>
                    <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--color-pale-stone)', textTransform: 'uppercase', marginBottom: 6 }}>
                      VERIFIED EVIDENCE CITATIONS ({aiAnalysis.evidenceRefs.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {aiAnalysis.evidenceRefs.map((refId: string) => (
                        <span key={refId} style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: 'var(--color-gold, #F5BD62)' }}>
                          • ID: {refId}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback Widget (P2-F01) */}
                <div style={{ paddingTop: 16, borderTop: '1px solid var(--color-ash-stroke)' }}>
                  <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--color-pale-stone)', textTransform: 'uppercase', marginBottom: 8 }}>
                    WAS THIS DIAGNOSIS HELPFUL?
                  </div>
                  {feedbackSent ? (
                    <div style={{ color: 'var(--color-metric-green)', fontSize: 13 }}>
                      ✓ Thank you for your feedback!
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-ghost"
                          onClick={() => handleFeedback(true)}
                          disabled={feedbackLoading}
                          style={{ flex: 1, justifyContent: 'center' }}
                        >
                          👍 Yes
                        </button>
                        <button
                          className="btn btn-ghost"
                          onClick={() => handleFeedback(false)}
                          disabled={feedbackLoading}
                          style={{ flex: 1, justifyContent: 'center' }}
                        >
                          👎 No
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Optional feedback comment..."
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--color-ash-stroke)',
                          borderRadius: 6,
                          padding: '6px 10px',
                          color: 'var(--color-bone)',
                          fontSize: 12,
                          fontFamily: 'var(--font-geist)'
                        }}
                      />
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
