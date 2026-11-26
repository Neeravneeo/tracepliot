import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchApi } from '../api';
import { useAppContext } from '../context/AppContext';

interface UploadTraceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (incidentId: string) => void;
}

export const UploadTraceModal: React.FC<UploadTraceModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { currentProjectId } = useAppContext();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(currentProjectId || '');
  const [rawText, setRawText] = useState('');
  const [environment, setEnvironment] = useState('production');
  const [release, setRelease] = useState('1.0.0');
  const [service, setService] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load user's projects for selector
  useEffect(() => {
    if (!isOpen) return;
    const fetchProjects = async () => {
      try {
        const res = await fetchApi('/projects');
        const list = res.data || [];
        setProjects(list);
        if (!selectedProjectId && list.length > 0) {
          setSelectedProjectId(currentProjectId || list[0].id);
        }
      } catch (err) {
        console.error('Failed to load projects for modal:', err);
      }
    };
    fetchProjects();
  }, [isOpen, currentProjectId]);

  // Live quick parsing preview for feedback
  const quickPreview = useMemo(() => {
    const trimmed = rawText.trim();
    if (!trimmed) return null;

    // Check if user entered a website URL
    if (/^https?:\/\//i.test(trimmed)) {
      return {
        type: 'SyntheticWebsiteAudit',
        msg: `Auditing URL: ${trimmed}`,
        runtime: 'Headless Crawler'
      };
    }

    const lines = trimmed.split('\n').map(l => l.trim());
    
    // Check python
    if (trimmed.includes('Traceback (most recent call last):')) {
      const errLine = lines.slice().reverse().find(l => /^[A-Za-z0-9_.]+(?:Error|Exception):/.test(l));
      if (errLine) {
        const match = errLine.match(/^([A-Za-z0-9_.]+(?:Error|Exception)):\s*(.*)$/);
        return {
          type: match ? match[1] : 'PythonException',
          msg: match ? match[2] : errLine,
          runtime: 'Python'
        };
      }
      return { type: 'PythonException', msg: lines[lines.length - 1], runtime: 'Python' };
    }

    // Check JS / Java
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const match = lines[i].match(/(?:^|\[[A-Z]+\]\s+)?([A-Za-z0-9_.$]+(?:Error|Exception)):\s*(.*)$/);
      if (match) {
        return { type: match[1], msg: match[2] || '(no message)', runtime: 'JavaScript / Node' };
      }
    }

    return { type: 'ManualIncidentError', msg: lines[0].slice(0, 80), runtime: 'Generic' };
  }, [rawText]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        if (!service) {
          const nameClean = file.name.replace(/\.(log|txt|out|json)$/i, '');
          setService(nameClean);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setError('Please select or create a project first.');
      return;
    }
    if (rawText.trim().length < 5) {
      setError('Please enter or paste at least 5 characters of stack trace/log content.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const trimmed = rawText.trim();

      // If user provided a website URL, run synthetic bug scanner
      if (/^https?:\/\//i.test(trimmed)) {
        const scanRes = await fetchApi('/scanner/audit', {
          method: 'POST',
          body: JSON.stringify({
            url: trimmed,
            projectId: selectedProjectId,
            simulateClicks: true
          })
        });

        if (scanRes && scanRes.data) {
          const firstIncident = scanRes.data.incidentsCreated?.[0];
          setRawText('');
          setError(null);
          if (firstIncident) {
            onSuccess(firstIncident.id);
          } else {
            alert(`Audit completed for ${trimmed}: 0 bugs found! The website loaded cleanly.`);
          }
          onClose();
          return;
        }
      }

      const res = await fetchApi('/incidents/upload', {
        method: 'POST',
        body: JSON.stringify({
          projectId: selectedProjectId,
          rawText: trimmed,
          environment,
          release: release.trim() || '1.0.0',
          service: service.trim() || undefined
        })
      });

      setRawText('');
      setError(null);
      onSuccess(res.incidentId);
      onClose();
    } catch (err: any) {
      console.error('Failed to upload trace:', err);
      setError(err.message || 'Failed to parse and upload trace.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 16
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-cards)',
        width: '100%',
        maxWidth: 680,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-elevated)'
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-signal-orange)', letterSpacing: '0.05em', marginBottom: 4 }}>
              MANUAL INGESTION
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' }}>
              Analyze Raw Stack Trace or Log
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 20,
              lineHeight: 1,
              padding: 4
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: 'var(--color-error-bg)',
              border: '1px solid var(--color-error-border)',
              borderRadius: 'var(--radius-buttons)',
              color: 'var(--color-error-text)',
              fontSize: 13
            }}>
              {error}
            </div>
          )}

          {/* Project & Environment Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                Target Project
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-buttons)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                Environment
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-buttons)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14
                }}
              >
                <option value="production">production</option>
                <option value="staging">staging</option>
                <option value="development">development</option>
                <option value="test">test</option>
              </select>
            </div>
          </div>

          {/* Service & Release Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                Service Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. payment-service"
                value={service}
                onChange={(e) => setService(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-buttons)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                Release / Tag
              </label>
              <input
                type="text"
                placeholder="1.0.0"
                value={release}
                onChange={(e) => setRelease(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-buttons)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14
                }}
              />
            </div>
          </div>

          {/* Stack Trace / Log Textarea & File Drop */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Raw Stack Trace or Log Content
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".txt,.log,.out,.json"
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-buttons)',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer'
                  }}
                >
                  📁 Load from file (.log / .txt)
                </button>
              </div>
            </div>
            <textarea
              rows={8}
              placeholder={`Paste unformatted error, traceback, or log snippet here...\n\nExample:\nTypeError: Cannot read properties of undefined (reading 'name')\n    at getUserProfile (src/services/user.ts:42:15)\n    at handleRequest (src/controllers/api.ts:18:9)`}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '12px',
                borderRadius: 'var(--radius-buttons)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                lineHeight: 1.5,
                resize: 'vertical'
              }}
            />
          </div>

          {/* Dynamic Parse Preview */}
          {quickPreview && (
            <div style={{
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-buttons)',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-signal-orange)' }}>
                  PARSER PREVIEW ({quickPreview.runtime})
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                {quickPreview.type}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                {quickPreview.msg}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn btn-ghost"
              style={{ padding: '8px 16px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || rawText.trim().length < 5}
              className="btn btn-primary"
              style={{ padding: '8px 20px' }}
            >
              {submitting ? 'Parsing & Creating...' : 'Ingest & Open Incident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
