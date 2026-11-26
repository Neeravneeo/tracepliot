import React, { useState } from 'react';
import type { TrendDataPoint } from '../services/dashboard.service';

export interface IncidentTrendsChartProps {
  data: TrendDataPoint[];
  timeRange: string;
  onTimeRangeChange?: (range: string) => void;
  onBucketClick?: (bucket: TrendDataPoint) => void;
  isLoading?: boolean;
}

export const IncidentTrendsChart: React.FC<IncidentTrendsChartProps> = ({
  data,
  timeRange,
  onTimeRangeChange,
  onBucketClick,
  isLoading = false
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div style={{
        background: '#18181b',
        border: '1px solid #27272a',
        borderRadius: 12,
        padding: '24px',
        height: 320,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#71717a'
      }}>
        <span>Loading incident trends...</span>
      </div>
    );
  }

  // Chart configuration
  const chartHeight = 180;
  const maxIncidents = 40;
  const maxErrorRate = 8; // 8%

  // Compute SVG coordinates for the line chart (Error Rate)
  const linePoints = data.map((d, idx) => {
    const xPct = (idx / (data.length - 1 || 1)) * 100;
    const yPct = chartHeight - (Math.min(d.errorRate, maxErrorRate) / maxErrorRate) * chartHeight;
    return { x: xPct, y: yPct, raw: d };
  });

  const linePathD = linePoints.length > 0
    ? `M ${linePoints.map(p => `${p.x}%,${p.y}`).join(' L ')}`
    : '';

  return (
    <div style={{
      background: '#18181b',
      border: '1px solid #27272a',
      borderRadius: 12,
      padding: '20px 24px',
      position: 'relative'
    }}>
      {/* Header with Title and Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#f4f4f5', letterSpacing: '-0.01em' }}>
            Incident Trends
          </div>
          <div style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>
            Number of incidents and error rate over time
          </div>
        </div>

        {/* Controls: Mode & Time Range dropdowns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            style={{
              background: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: 6,
              color: '#d4d4d8',
              fontSize: 12,
              padding: '4px 10px',
              outline: 'none',
              cursor: 'pointer'
            }}
            defaultValue="incidents"
          >
            <option value="incidents">Incidents</option>
            <option value="errors">Errors</option>
          </select>

          <select
            value={timeRange}
            onChange={(e) => onTimeRangeChange && onTimeRangeChange(e.target.value)}
            style={{
              background: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: 6,
              color: '#d4d4d8',
              fontSize: 12,
              padding: '4px 10px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="1h">Last 1 hour</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 20,
        fontSize: 11,
        color: '#a1a1aa',
        marginBottom: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444' }} />
          <span>Critical</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: '#eab308' }} />
          <span>Warning</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: '#3b82f6' }} />
          <span>Info</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 14, height: 2, background: '#93c5fd' }} />
          <span>Error Rate</span>
        </div>
      </div>

      {/* Main Chart Canvas */}
      <div style={{ display: 'flex', position: 'relative', height: chartHeight + 30 }}>
        {/* Left Y-Axis (Incidents) */}
        <div style={{
          width: 30,
          height: chartHeight,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          fontSize: 10,
          color: '#71717a',
          fontFamily: 'monospace',
          textAlign: 'right',
          paddingRight: 6
        }}>
          <span>40</span>
          <span>30</span>
          <span>20</span>
          <span>10</span>
          <span>0</span>
        </div>

        {/* Center Grid & Data Rendering */}
        <div style={{
          flex: 1,
          height: chartHeight,
          position: 'relative',
          borderBottom: '1px solid #27272a'
        }}>
          {/* Horizontal Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => (
            <div
              key={idx}
              style={{
                position: 'absolute',
                top: `${pct * chartHeight}px`,
                left: 0,
                right: 0,
                borderTop: '1px dashed #27272a'
              }}
            />
          ))}

          {/* Stacked Bars */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-around',
            padding: '0 8px'
          }}>
            {data.map((item, idx) => {
              const totalVal = Math.min(item.critical + item.warning + item.info, maxIncidents);
              const barHeightPct = (totalVal / maxIncidents) * 100;
              const critPct = totalVal > 0 ? (item.critical / totalVal) * 100 : 0;
              const warnPct = totalVal > 0 ? (item.warning / totalVal) * 100 : 0;
              const infoPct = totalVal > 0 ? (item.info / totalVal) * 100 : 0;

              return (
                <div
                  key={idx}
                  onClick={() => onBucketClick && onBucketClick(item)}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{
                    width: '18px',
                    height: `${barHeightPct}%`,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 3,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease',
                    transform: hoveredIndex === idx ? 'scaleY(1.05)' : 'none',
                    zIndex: 2
                  }}
                >
                  {/* Top: Info (blue) */}
                  <div style={{ height: `${infoPct}%`, background: '#3b82f6' }} />
                  {/* Middle: Warning (yellow) */}
                  <div style={{ height: `${warnPct}%`, background: '#eab308' }} />
                  {/* Bottom: Critical (red) */}
                  <div style={{ height: `${critPct}%`, background: '#ef4444' }} />
                </div>
              );
            })}
          </div>

          {/* SVG Overlay for Error Rate Line */}
          <svg
            width="100%"
            height={chartHeight}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              overflow: 'visible',
              pointerEvents: 'none',
              zIndex: 3
            }}
          >
            <path
              d={linePathD}
              fill="none"
              stroke="#93c5fd"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            {linePoints.map((pt, i) => (
              <circle
                key={i}
                cx={`${pt.x}%`}
                cy={pt.y}
                r={hoveredIndex === i ? 4 : 2.5}
                fill="#ffffff"
                stroke="#3b82f6"
                strokeWidth="1.5"
              />
            ))}
          </svg>

          {/* Tooltip on Hover */}
          {hoveredIndex !== null && data[hoveredIndex] && (
            <div style={{
              position: 'absolute',
              top: -10,
              left: `${(hoveredIndex / (data.length - 1 || 1)) * 100}%`,
              transform: 'translate(-50%, -100%)',
              background: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 11,
              color: '#f4f4f5',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
              pointerEvents: 'none',
              zIndex: 10,
              whiteSpace: 'nowrap'
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4, color: '#e4e4e7' }}>
                {data[hoveredIndex].timeLabel}
              </div>
              <div style={{ color: '#ef4444' }}>Critical: {data[hoveredIndex].critical}</div>
              <div style={{ color: '#eab308' }}>Warning: {data[hoveredIndex].warning}</div>
              <div style={{ color: '#3b82f6' }}>Info: {data[hoveredIndex].info}</div>
              <div style={{ color: '#93c5fd', marginTop: 2, borderTop: '1px solid #27272a', paddingTop: 2 }}>
                Error Rate: {data[hoveredIndex].errorRate}%
              </div>
            </div>
          )}

          {/* X-Axis Labels */}
          <div style={{
            position: 'absolute',
            top: chartHeight + 6,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            color: '#71717a',
            fontFamily: 'monospace'
          }}>
            {data.map((d, i) => (
              <span key={i}>{d.timeLabel}</span>
            ))}
          </div>
        </div>

        {/* Right Y-Axis (Error Rate %) */}
        <div style={{
          width: 35,
          height: chartHeight,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          fontSize: 10,
          color: '#71717a',
          fontFamily: 'monospace',
          paddingLeft: 6
        }}>
          <span>8%</span>
          <span>6%</span>
          <span>4%</span>
          <span>2%</span>
          <span>0%</span>
        </div>
      </div>
    </div>
  );
};
