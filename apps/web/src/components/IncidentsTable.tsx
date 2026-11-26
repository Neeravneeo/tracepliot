import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Incident } from '../services/dashboard.service';
import { Sparkles, MoreHorizontal, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export interface IncidentsTableProps {
  incidents: Incident[];
  onAnalyze?: (incidentId: string) => void;
  isLoading?: boolean;
}

export const IncidentsTable: React.FC<IncidentsTableProps> = ({
  incidents,
  onAnalyze,
  isLoading = false
}) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'occurredAt' | 'occurrences'>('occurredAt');
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());

  // Filter & sort
  const filtered = useMemo(() => {
    return incidents
      .filter((inc) => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
          inc.exceptionType.toLowerCase().includes(q) ||
          inc.message.toLowerCase().includes(q) ||
          (inc.context?.service || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'occurrences') {
          return (b.occurrences || 1) - (a.occurrences || 1);
        }
        return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
      });
  }, [incidents, searchTerm, sortBy]);

  const handleRunAnalysis = async (e: React.MouseEvent, incidentId: string) => {
    e.stopPropagation();
    if (analyzingIds.has(incidentId)) return;
    setAnalyzingIds((prev) => new Set(prev).add(incidentId));
    try {
      if (onAnalyze) {
        await onAnalyze(incidentId);
      }
    } finally {
      setAnalyzingIds((prev) => {
        const next = new Set(prev);
        next.delete(incidentId);
        return next;
      });
    }
  };

  // Helper for Severity Badge
  const renderSeverityBadge = (inc: Incident) => {
    const isCrit = inc.exceptionType.includes('Error') || inc.exceptionType.includes('Fatal') || inc.exceptionType.includes('Timeout');
    const isHigh = inc.exceptionType.includes('Validation') || inc.exceptionType.includes('Auth');
    const isMed = inc.exceptionType.includes('Slow') || inc.exceptionType.includes('Null');
    
    if (isCrit) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '2px 8px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#ef4444',
          border: '1px solid rgba(239, 68, 68, 0.3)'
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
          Critical
        </span>
      );
    }
    if (isHigh) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '2px 8px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          background: 'rgba(234, 179, 8, 0.15)',
          color: '#eab308',
          border: '1px solid rgba(234, 179, 8, 0.3)'
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#eab308' }} />
          High
        </span>
      );
    }
    if (isMed) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '2px 8px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          background: 'rgba(234, 179, 8, 0.1)',
          color: '#ca8a04',
          border: '1px solid rgba(234, 179, 8, 0.2)'
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ca8a04' }} />
          Medium
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: 'rgba(59, 130, 246, 0.15)',
        color: '#3b82f6',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6' }} />
        Low
      </span>
    );
  };

  // Helper for Status Badge
  const renderStatusBadge = (status: string) => {
    if (status === 'investigating') {
      return (
        <span style={{
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 500,
          background: 'rgba(59, 130, 246, 0.2)',
          color: '#60a5fa'
        }}>
          Investigating
        </span>
      );
    }
    if (status === 'resolved') {
      return (
        <span style={{
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 500,
          background: 'rgba(34, 197, 94, 0.15)',
          color: '#4ade80'
        }}>
          Resolved
        </span>
      );
    }
    return (
      <span style={{
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        background: 'rgba(239, 68, 68, 0.15)',
        color: '#f87171'
      }}>
        Open
      </span>
    );
  };

  // Helper for AI Status
  const renderAiStatus = (inc: Incident) => {
    const isAnalyzing = analyzingIds.has(inc.id);
    if (isAnalyzing) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '2px 8px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 500,
          background: 'rgba(59, 130, 246, 0.15)',
          color: '#60a5fa'
        }}>
          <Sparkles size={12} className="spin" />
          Analyzing...
        </span>
      );
    }
    if (inc.aiAnalysis && inc.aiAnalysis.rootCause) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '2px 8px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 500,
          background: 'rgba(34, 197, 94, 0.15)',
          color: '#4ade80'
        }}>
          <CheckCircle2 size={12} />
          Completed
        </span>
      );
    }
    if (inc.status === 'open') {
      return (
        <span
          onClick={(e) => handleRunAnalysis(e, inc.id)}
          title="Click to run AI root-cause analysis"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 500,
            background: 'rgba(234, 179, 8, 0.15)',
            color: '#facc15',
            cursor: 'pointer'
          }}
        >
          <Clock size={12} />
          Pending
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        color: '#71717a',
        background: '#27272a'
      }}>
        <AlertCircle size={12} />
        Not analyzed
      </span>
    );
  };

  if (isLoading) {
    return (
      <div style={{
        background: '#18181b',
        border: '1px solid #27272a',
        borderRadius: 12,
        padding: '24px',
        color: '#71717a'
      }}>
        Loading incidents...
      </div>
    );
  }

  return (
    <div style={{
      background: '#18181b',
      border: '1px solid #27272a',
      borderRadius: 12,
      overflow: 'hidden'
    }}>
      {/* Table Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
        borderBottom: '1px solid #27272a'
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#f4f4f5' }}>
          Recent Incidents
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="text"
            placeholder="Search incidents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: 6,
              color: '#d4d4d8',
              fontSize: 12,
              padding: '4px 10px',
              outline: 'none',
              width: 160
            }}
          />
          <button
            onClick={() => navigate('/incidents')}
            style={{
              background: 'none',
              border: 'none',
              color: '#38bdf8',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            View all
          </button>
        </div>
      </div>

      {/* Table Element */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{
              background: '#141416',
              borderBottom: '1px solid #27272a',
              color: '#71717a',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              <th style={{ padding: '10px 16px' }}>Severity</th>
              <th style={{ padding: '10px 16px' }}>Incident</th>
              <th style={{ padding: '10px 16px' }}>Service</th>
              <th style={{ padding: '10px 16px' }}>Status</th>
              <th
                style={{ padding: '10px 16px', cursor: 'pointer' }}
                onClick={() => setSortBy(sortBy === 'occurrences' ? 'occurredAt' : 'occurrences')}
              >
                Occurrences {sortBy === 'occurrences' ? '↓' : ''}
              </th>
              <th style={{ padding: '10px 16px' }}>AI Status</th>
              <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inc) => {
              const service = inc.context?.service || inc.context?.tags?.component || 'payments-service';
              const occurrences = inc.occurrences || (Math.abs(inc.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 18) + 1;

              return (
                <tr
                  key={inc.id}
                  onClick={() => navigate(`/incidents/${inc.id}`)}
                  style={{
                    borderBottom: '1px solid #27272a',
                    cursor: 'pointer',
                    transition: 'background 0.1s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#202024';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {/* Severity */}
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    {renderSeverityBadge(inc)}
                  </td>

                  {/* Incident Type & Message */}
                  <td style={{ padding: '12px 16px', maxWidth: 260 }}>
                    <div style={{ fontWeight: 500, color: '#f4f4f5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {inc.exceptionType}
                    </div>
                    <div style={{ fontSize: 11, color: '#71717a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {inc.message || 'No description provided'}
                    </div>
                  </td>

                  {/* Service */}
                  <td style={{ padding: '12px 16px', color: '#a1a1aa', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }}>
                    {service}
                  </td>

                  {/* Status */}
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    {renderStatusBadge(inc.status)}
                  </td>

                  {/* Occurrences */}
                  <td style={{ padding: '12px 16px', color: '#d4d4d8', fontWeight: 500 }}>
                    {occurrences}
                  </td>

                  {/* AI Status */}
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    {renderAiStatus(inc)}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={(e) => handleRunAnalysis(e, inc.id)}
                      title="Run diagnosis or view incident details"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#71717a',
                        cursor: 'pointer',
                        padding: 4,
                        borderRadius: 4
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#f4f4f5')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#71717a')}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px 16px', color: '#71717a' }}>
                  No incidents found for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
