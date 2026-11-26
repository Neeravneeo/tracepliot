import React from 'react';
import type { SystemHealthData } from '../services/dashboard.service';
import { Activity, Database, Cpu, Clock, Layers, Server, Sparkles, ChevronRight } from 'lucide-react';

export interface SystemHealthWidgetProps {
  health: SystemHealthData;
  isLoading?: boolean;
}

export const SystemHealthWidget: React.FC<SystemHealthWidgetProps> = ({
  health,
  isLoading = false
}) => {
  const renderStatusDot = (status: 'healthy' | 'degraded' | 'down' | 'unknown') => {
    let color = '#22c55e'; // green
    if (status === 'degraded') color = '#eab308';
    if (status === 'down') color = '#ef4444';
    if (status === 'unknown') color = '#71717a';

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 500,
        color: '#f4f4f5'
      }}>
        <span style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: color,
          boxShadow: status === 'healthy' ? `0 0 6px ${color}80` : 'none'
        }} />
        <span style={{ textTransform: 'capitalize' }}>{status}</span>
      </span>
    );
  };

  const rows = [
    {
      label: 'Qdrant Collection',
      icon: Database,
      value: renderStatusDot(health.qdrantStatus),
      detail: 'Vector store & code indices'
    },
    {
      label: 'Embedding Pipeline',
      icon: Cpu,
      value: `${health.embeddingPipelineLatencyMs} ms`,
      isMetric: true,
      detail: 'all-MiniLM-L6-v2'
    },
    {
      label: 'Last Ingestion',
      icon: Clock,
      value: health.lastIngestionTimestamp ? '8 min ago' : 'No events',
      isMetric: true,
      detail: 'Active SDK listener'
    },
    {
      label: 'Worker Queue',
      icon: Layers,
      value: `${health.workerQueueDepth} jobs`,
      isMetric: true,
      detail: 'Background indexing queue'
    },
    {
      label: 'PostgreSQL',
      icon: Server,
      value: renderStatusDot(health.postgresStatus),
      detail: 'Primary operational repository'
    },
    {
      label: 'AI Provider',
      icon: Sparkles,
      value: renderStatusDot(health.aiProviderStatus),
      detail: 'OpenRouter / Nemotron'
    }
  ];

  if (isLoading) {
    return (
      <div style={{
        background: '#18181b',
        border: '1px solid #27272a',
        borderRadius: 12,
        padding: '20px'
      }}>
        <div style={{ height: 20, width: '60%', background: '#27272a', borderRadius: 4, marginBottom: 12 }} />
        <div style={{ height: 160, background: '#27272a', borderRadius: 8 }} />
      </div>
    );
  }

  return (
    <div style={{
      background: '#18181b',
      border: '1px solid #27272a',
      borderRadius: 12,
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'rgba(34, 197, 94, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#22c55e'
          }}>
            <Activity size={16} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#f4f4f5' }}>
              System & RAG Health
            </div>
            <div style={{ fontSize: 11, color: '#71717a' }}>
              Status of core services and AI infrastructure
            </div>
          </div>
        </div>
        <span style={{ fontSize: 11, color: '#71717a' }}>
          Updated just now
        </span>
      </div>

      {/* Grid of Status Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((row, idx) => {
          const Icon = row.icon;
          return (
            <div
              key={idx}
              title={row.detail}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: 6,
                background: '#141416',
                border: '1px solid #27272a',
                fontSize: 12,
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1e')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#141416')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon size={14} color="#71717a" />
                <span style={{ color: '#d4d4d8', fontWeight: 500 }}>{row.label}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {typeof row.value === 'string' ? (
                  <span style={{
                    color: row.isMetric ? '#a1a1aa' : '#f4f4f5',
                    fontFamily: row.isMetric ? 'monospace' : 'inherit',
                    fontSize: 12,
                    fontWeight: 500
                  }}>
                    {row.value}
                  </span>
                ) : (
                  row.value
                )}
                <ChevronRight size={13} color="#52525b" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
