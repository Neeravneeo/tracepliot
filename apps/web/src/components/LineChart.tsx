import { useState } from 'react';

type DataPoint = { timestamp: string; value: number };

export default function LineChart({ data }: { data: DataPoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map(d => d.value), 10); // Ensure at least some max to avoid / 0
  const minVal = 0;
  
  // Chart dimensions
  const height = 160;
  
  const getY = (val: number) => {
    return height - ((val - minVal) / (maxVal - minVal)) * height;
  };

  // Generate SVG path
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = getY(d.value);
    return `${x}%,${y}`;
  });

  const pathD = `M 0%,${height} L ${points.join(' L ')} L 100%,${height} Z`;
  const lineD = `M ${points.join(' L ')}`;

  return (
    <div style={{ position: 'relative', width: '100%', height: height, marginTop: 24, paddingBottom: 24 }}>
      {/* Y Axis Labels (Approximate) */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 40, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'var(--font-geist-mono)', fontSize: 10, color: 'var(--color-warm-granite)', zIndex: 1 }}>
        <div>{Math.round(maxVal)} ┤</div>
        <div>{Math.round(maxVal / 2)} ┤</div>
        <div>0 ┤</div>
      </div>

      <div style={{ marginLeft: 40, position: 'relative', height: '100%', borderBottom: '1px solid var(--color-ash-stroke)' }}>
        <svg width="100%" height="100%" style={{ overflow: 'visible' }} preserveAspectRatio="none">
          {/* Grid lines */}
          <line x1="0" y1={height / 2} x2="100%" y2={height / 2} stroke="var(--color-carbon-lift)" strokeDasharray="4 4" />
          
          {/* Area */}
          <path d={pathD} fill="rgba(238, 96, 24, 0.1)" stroke="none" />
          {/* Line */}
          <path d={lineD} fill="none" stroke="var(--color-signal-orange)" strokeWidth="2" vectorEffect="non-scaling-stroke" />

          {/* Hover hit targets */}
          {data.map((d, i) => {
            const x = `${(i / (data.length - 1)) * 100}%`;
            return (
              <g 
                key={i} 
                onMouseEnter={() => setHoveredIndex(i)} 
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ cursor: 'crosshair' }}
              >
                {/* Invisible larger hover area */}
                <rect x={`${(i / (data.length - 1)) * 100 - (100/data.length/2)}%`} y="0" width={`${100/data.length}%`} height="100%" fill="transparent" />
                
                {hoveredIndex === i && (
                  <>
                    <line x1={x} y1="0" x2={x} y2="100%" stroke="var(--color-warm-granite)" strokeDasharray="2 2" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                    <circle cx={x} cy={getY(d.value)} r="4" fill="var(--color-obsidian-canvas)" stroke="var(--color-signal-orange)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  </>
                )}
              </g>
            );
          })}
        </svg>

        {/* X Axis Labels */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: -24, display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-geist-mono)', fontSize: 10, color: 'var(--color-warm-granite)' }}>
          <span>{data[0]?.timestamp}</span>
          <span>{data[Math.floor(data.length / 2)]?.timestamp}</span>
          <span>{data[data.length - 1]?.timestamp}</span>
        </div>

        {/* Tooltip */}
        {hoveredIndex !== null && (
          <div style={{ 
            position: 'absolute', 
            left: `${(hoveredIndex / (data.length - 1)) * 100}%`, 
            top: -30, 
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--color-obsidian-canvas)', 
            border: '1px solid var(--color-ash-stroke)',
            padding: '4px 8px',
            borderRadius: 'var(--radius-buttons)',
            fontFamily: 'var(--font-geist-mono)',
            fontSize: 11,
            color: 'var(--color-bone)',
            pointerEvents: 'none',
            zIndex: 10,
            whiteSpace: 'nowrap'
          }}>
            <div style={{ color: 'var(--color-warm-granite)', fontSize: 10, marginBottom: 2 }}>{data[hoveredIndex].timestamp}</div>
            Errors: <span style={{ color: 'var(--color-signal-orange)' }}>{data[hoveredIndex].value}</span>
          </div>
        )}
      </div>
    </div>
  );
}
