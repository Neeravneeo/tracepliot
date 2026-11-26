import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface KpiCardProps {
  title: string;
  value: string | number;
  subValue?: string | number;
  changeText?: string;
  isPositiveChange?: boolean;
  isGoodMetric?: boolean; // For example: error rate decrease is good (green)
  icon: LucideIcon;
  iconColor: string;
  sparklineColor: string;
  sparklinePoints?: number[];
  onClick?: () => void;
  isLoading?: boolean;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subValue,
  changeText,
  isPositiveChange = true,
  isGoodMetric = false,
  icon: Icon,
  iconColor,
  sparklineColor,
  sparklinePoints = [10, 14, 12, 18, 15, 22, 19, 26, 23, 28],
  onClick,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <div className="kpi-card loading" style={{
        background: '#18181b',
        border: '1px solid #27272a',
        borderRadius: 12,
        padding: '20px 24px',
        minHeight: 140,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        animation: 'pulse 1.5s infinite'
      }}>
        <div style={{ width: '40%', height: 16, background: '#27272a', borderRadius: 4 }} />
        <div style={{ width: '60%', height: 32, background: '#27272a', borderRadius: 4, margin: '12px 0' }} />
        <div style={{ width: '30%', height: 14, background: '#27272a', borderRadius: 4 }} />
      </div>
    );
  }

  // SVG Sparkline calculation
  const max = Math.max(...sparklinePoints, 1);
  const min = Math.min(...sparklinePoints, 0);
  const range = max - min || 1;
  const width = 110;
  const height = 36;
  const pts = sparklinePoints.map((p, idx) => {
    const x = (idx / (sparklinePoints.length - 1)) * width;
    const y = height - ((p - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  }).join(' ');

  // Determine trend color
  const trendColor = isGoodMetric
    ? '#22c55e'
    : isPositiveChange
    ? '#ef4444'
    : '#22c55e';

  return (
    <div
      className="kpi-card"
      onClick={onClick}
      style={{
        background: '#18181b',
        border: '1px solid #27272a',
        borderRadius: 12,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s ease, transform 0.15s ease',
        position: 'relative',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = '#3f3f46';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = '#27272a';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {/* Header with Icon and Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: 'rgba(255, 255, 255, 0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: iconColor
        }}>
          <Icon size={16} />
        </div>
        <span style={{
          fontSize: 13,
          fontWeight: 500,
          color: '#a1a1aa',
          letterSpacing: '-0.01em'
        }}>
          {title}
        </span>
      </div>

      {/* Main Metric Value */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
        <span style={{
          fontSize: 32,
          fontWeight: 700,
          color: '#f4f4f5',
          letterSpacing: '-0.03em',
          lineHeight: 1
        }}>
          {value}
        </span>
        {subValue && (
          <span style={{
            fontSize: 20,
            fontWeight: 500,
            color: '#71717a'
          }}>
            / {subValue}
          </span>
        )}
      </div>

      {/* Footer with Trend & Mini Sparkline */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {changeText && (
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: trendColor
            }}>
              {isPositiveChange ? '↑' : '↓'} {changeText}
            </span>
          )}
          <span style={{ fontSize: 11, color: '#71717a' }}>
            vs prev 24h
          </span>
        </div>

        {/* Mini Sparkline Chart */}
        <div style={{ width: width, height: height, opacity: 0.85 }}>
          <svg width={width} height={height} style={{ overflow: 'visible' }}>
            <polyline
              fill="none"
              stroke={sparklineColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pts}
            />
          </svg>
        </div>
      </div>
    </div>
  );
};
