import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Layers,
  Users,
  Box,
  AlertTriangle,
  Radio,
  Globe,
  Info,
  ChevronRight,
  Play,
  ArrowRight,
  TrendingDown,
  FileText,
  Link as LinkIcon
} from 'lucide-react';
import { fetchApi } from '../api';

// Spline data points matching the screenshot visual reference
const DEFAULT_ERROR_TRENDS_24H = [
  { time: '16:00', value: 34 },
  { time: '18:00', value: 28 },
  { time: '20:00', value: 45 },
  { time: '22:00', value: 76 },
  { time: '00:00', value: 26 },
  { time: '02:00', value: 42 },
  { time: '04:00', value: 24 },
  { time: '06:00', value: 62 },
  { time: '08:00', value: 46 },
  { time: '10:00', value: 160 },
  { time: '12:00', value: 65 },
  { time: '14:00', value: 102 },
  { time: '15:00', value: 44 }
];

export default function Overview() {
  const navigate = useNavigate();

  // Range and filter state
  const [chartRange, setChartRange] = useState<'1H' | '24H' | '7D' | '30D'>('24H');
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; time: string; value: number } | null>(null);

  // Live telemetry state
  const [liveStats, setLiveStats] = useState<any>(null);
  const [liveTimeSeries, setLiveTimeSeries] = useState<any[] | null>(null);
  const [liveIncidents, setLiveIncidents] = useState<any[] | null>(null);
  const [liveServices, setLiveServices] = useState<any[] | null>(null);
  const [liveActivity, setLiveActivity] = useState<any[] | null>(null);

  // Quick scanner card state
  const [scanUrl, setScanUrl] = useState('https://example.com');
  const [isStartingScan, setIsStartingScan] = useState(false);

  React.useEffect(() => {
    let isMounted = true;
    async function fetchDashboardData() {
      try {
        const [statsRes, tsRes, incRes, healthRes, actRes] = await Promise.allSettled([
          fetchApi('/incidents/stats'),
          fetchApi(`/incidents/time-series?timeRange=${chartRange.toLowerCase()}`),
          fetchApi('/incidents?limit=4'),
          fetchApi('/incidents/service-health'),
          fetchApi('/incidents/activity?limit=10')
        ]);

        if (!isMounted) return;

        if (statsRes.status === 'fulfilled' && statsRes.value) setLiveStats(statsRes.value);
        if (tsRes.status === 'fulfilled' && tsRes.value && Array.isArray(tsRes.value.data)) setLiveTimeSeries(tsRes.value.data);
        if (incRes.status === 'fulfilled' && incRes.value && Array.isArray(incRes.value.data)) setLiveIncidents(incRes.value.data);
        if (healthRes.status === 'fulfilled' && healthRes.value && Array.isArray(healthRes.value.data)) setLiveServices(healthRes.value.data);
        if (actRes.status === 'fulfilled' && actRes.value && Array.isArray(actRes.value.data)) setLiveActivity(actRes.value.data);
      } catch (err) {
        console.warn('[Overview] Failed to load some dashboard metrics:', err);
      }
    }

    fetchDashboardData();
    return () => { isMounted = false; };
  }, [chartRange]);

  // Dynamic multiplier based on selected chart range fallback
  const rangeMultiplier = useMemo(() => {
    switch (chartRange) {
      case '1H': return 0.2;
      case '24H': return 1.0;
      case '7D': return 3.8;
      case '30D': return 12.5;
      default: return 1.0;
    }
  }, [chartRange]);

  const chartData = useMemo(() => {
    if (liveTimeSeries && liveTimeSeries.length > 0) {
      return liveTimeSeries.map(pt => ({
        time: pt.timestamp,
        value: Number(pt.value) || 0
      }));
    }
    return DEFAULT_ERROR_TRENDS_24H.map(pt => ({
      ...pt,
      value: Math.round(pt.value * (chartRange === '24H' ? 1 : rangeMultiplier))
    }));
  }, [liveTimeSeries, chartRange, rangeMultiplier]);

  // Derived KPI metrics
  const totalErrorsCount = liveStats?.totalErrors ?? 1284;
  const openIncidentsCount = liveStats?.openIncidents ?? 0;
  const affectedUsersCount = liveStats?.affectedUsers ?? 53;
  const servicesCount = liveStats?.servicesCount ?? 3;
  const openDelta = liveStats?.openIncidentsDelta ?? '+2 today';
  const totalErrorsDelta = liveStats?.totalErrorsDelta ?? '↑ 18%';
  const affectedUsersDelta = liveStats?.affectedUsersDelta ?? '↑ 7%';
  const degradedCount = liveStats?.degradedCount ?? 2;

  // Recent Incidents list matching screenshot
  const recentIncidentsList = useMemo(() => {
    if (liveIncidents && liveIncidents.length > 0) {
      return liveIncidents.slice(0, 4).map(inc => {
        const isResolved = inc.status === 'resolved';
        const isInvestigating = inc.status === 'investigating';
        const statusColor = isResolved ? '#38c976' : isInvestigating ? '#e2b474' : '#f59e0b';
        const statusLabel = isResolved ? 'Resolved' : isInvestigating ? 'Investigating' : 'Open';
        const diffMs = Date.now() - new Date(inc.occurredAt || inc.createdAt || Date.now()).getTime();
        const minsAgo = Math.max(1, Math.floor(diffMs / 60000));
        const updatedLabel = minsAgo < 60 ? `${minsAgo} min ago` : `${Math.floor(minsAgo / 60)}h ago`;

        return {
          id: inc.id,
          title: `${inc.exceptionType || 'Error'}: ${inc.message?.slice(0, 32) || 'Runtime issue'}...`,
          service: inc.service || inc.context?.service || 'UserService',
          severity: (inc.severity || 'HIGH').toUpperCase(),
          status: statusLabel,
          statusColor,
          updated: updatedLabel
        };
      });
    }
    return [
      {
        id: 'inc_1',
        title: 'TypeError: Cannot read properties of...',
        service: 'UserService',
        severity: 'HIGH',
        status: 'Open',
        statusColor: '#f59e0b',
        updated: '2 min ago'
      },
      {
        id: 'inc_2',
        title: 'AuthenticationError: Invalid token',
        service: 'API Gateway',
        severity: 'MEDIUM',
        status: 'Investigating',
        statusColor: '#e2b474',
        updated: '8 min ago'
      },
      {
        id: 'inc_3',
        title: 'TypeError: undefined is not a function',
        service: 'UserService',
        severity: 'MEDIUM',
        status: 'Resolved',
        statusColor: '#38c976',
        updated: '18 min ago'
      },
      {
        id: 'inc_4',
        title: 'AuthenticationError: Session expired',
        service: 'UserService',
        severity: 'LOW',
        status: 'Resolved',
        statusColor: '#38c976',
        updated: '36 min ago'
      }
    ];
  }, [liveIncidents]);

  // Service Health data matching screenshot
  const servicesList = useMemo(() => {
    if (liveServices && liveServices.length > 0) {
      return liveServices.map(s => ({
        name: s.name,
        uptime: s.uptime ? `${s.uptime} uptime` : '99.98% uptime',
        status: s.status === 'Operational' ? 'healthy' : 'warning',
        label: s.status || 'Operational'
      }));
    }
    return [
      { name: 'API Gateway', uptime: '99.98% uptime', status: 'healthy', label: 'Operational' },
      { name: 'UserService', uptime: '99.93% uptime', status: 'healthy', label: 'Operational' },
      { name: 'PaymentService', uptime: '99.21% uptime', status: 'warning', label: 'Degraded' },
      { name: 'NotificationService', uptime: '99.97% uptime', status: 'healthy', label: 'Operational' }
    ];
  }, [liveServices]);

  // Activity Feed events matching screenshot
  const activityFeedEvents = useMemo(() => {
    if (liveActivity && liveActivity.length > 0) {
      return liveActivity.map((a: any) => ({
        id: a.id,
        dotColor: a.level === 'warning' ? '#f59e0b' : a.level === 'danger' ? '#f87171' : '#38c976',
        title: a.title,
        desc: a.description,
        time: a.timeAgo || 'Just now'
      }));
    }
    return [
      {
        id: 'act_1',
        dotColor: '#f59e0b',
        title: 'Service degraded',
        desc: 'PaymentService error rate increased to 6.8%',
        time: '2 min ago'
      },
      {
        id: 'act_2',
        dotColor: '#38c976',
        title: 'Incident resolved',
        desc: 'AuthenticationError in UserService',
        time: '5 min ago'
      },
      {
        id: 'act_3',
        dotColor: '#f59e0b',
        title: 'New error spike',
        desc: 'TypeError in UserService (214 occurrences)',
        time: '12 min ago'
      },
      {
        id: 'act_4',
        dotColor: '#38c976',
        title: 'Trace captured',
        desc: 'New trace for /api/users (287 ms)',
        time: '18 min ago'
      },
      {
        id: 'act_5',
        dotColor: '#38c976',
        title: 'Website scan completed',
        desc: '12 pages crawled • 4 issues found',
        time: '24 min ago'
      }
    ];
  }, [liveActivity]);

  // Recent Activity timeline matching screenshot
  const timelineNodes = useMemo(() => {
    if (liveActivity && liveActivity.length > 3) {
      return liveActivity.slice(0, 4).map((a: any, idx: number) => ({
        id: `tl_${idx}`,
        title: a.title,
        detail: a.description,
        time: a.timeAgo || 'Just now'
      }));
    }
    return [
      { id: 'tl_1', title: 'Incident detected', detail: 'TypeError / UserService', time: '2 minutes ago' },
      { id: 'tl_2', title: 'New trace received', detail: 'PaymentService', time: '5 minutes ago' },
      { id: 'tl_3', title: 'Incident resolved', detail: 'AuthenticationError', time: '18 minutes ago' },
      { id: 'tl_4', title: 'Source code indexed', detail: 'customer.ts', time: '24 minutes ago' }
    ];
  }, [liveActivity]);

  // Quick Run Scan trigger from Website Scanner Card
  const handleRunScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanUrl.trim()) return;
    setIsStartingScan(true);
    try {
      const res = await fetchApi('/website-scans', {
        method: 'POST',
        body: JSON.stringify({
          url: scanUrl.trim(),
          scanType: 'quick',
          configuration: { engine: 'crawl4ai', device: 'both' }
        })
      });
      if (res && res.data && res.data.id) {
        navigate(`/dashboard/website-scanner/scans/${res.data.id}`);
      } else {
        navigate('/dashboard/website-scanner');
      }
    } catch (err) {
      console.error('Failed to trigger quick scan:', err);
      navigate('/dashboard/website-scanner');
    } finally {
      setIsStartingScan(false);
    }
  };

  // Smooth SVG cubic bezier path computation
  const { pathD, areaD, pointsCoords } = useMemo(() => {
    const width = 800;
    const height = 140;
    const paddingX = 20;
    const paddingY = 15;
    const plotWidth = width - paddingX * 2;
    const plotHeight = height - paddingY * 2;
    const maxVal = 200;

    const coords = chartData.map((d, i) => {
      const x = paddingX + (i / (chartData.length - 1)) * plotWidth;
      const y = height - paddingY - (Math.min(d.value, maxVal) / maxVal) * plotHeight;
      return { x, y, time: d.time, value: d.value };
    });

    if (coords.length < 2) return { pathD: '', areaD: '', pointsCoords: [] };

    // Cubic spline path calculation
    let pD = `M ${coords[0].x},${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[Math.max(i - 1, 0)];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[Math.min(i + 2, coords.length - 1)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      pD += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }

    const aD = `${pD} L ${coords[coords.length - 1].x},${height} L ${coords[0].x},${height} Z`;

    return { pathD: pD, areaD: aD, pointsCoords: coords };
  }, [chartData]);

  return (
    <div className="tp-bento-layout">
      {/* =========================================================================
          LEFT / MAIN COLUMN (KPIs, Error Chart, Incidents, Health, Traces, Activity)
          ========================================================================= */}
      <div className="tp-main-col">
        {/* 1. KPI 4-CARD ROW */}
        <div className="tp-kpi-grid">
          {/* Card 1: Open Incidents */}
          <div className="tp-kpi-card" onClick={() => navigate('/incidents')} style={{ cursor: 'pointer' }}>
            <div className="tp-kpi-top">
              <span className="tp-kpi-title">OPEN INCIDENTS</span>
              <Activity size={15} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div>
              <div className="tp-kpi-val">{openIncidentsCount}</div>
              <div className="tp-kpi-sub">{openDelta}</div>
            </div>
          </div>

          {/* Card 2: Total Errors */}
          <div className="tp-kpi-card" onClick={() => navigate('/incidents')} style={{ cursor: 'pointer' }}>
            <div className="tp-kpi-top">
              <span className="tp-kpi-title">TOTAL ERRORS</span>
              <Layers size={15} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div>
              <div className="tp-kpi-val">{totalErrorsCount.toLocaleString()}</div>
              <div className="tp-kpi-sub">
                <span style={{ color: 'var(--text-secondary)' }}>{totalErrorsDelta}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Affected Users */}
          <div className="tp-kpi-card">
            <div className="tp-kpi-top">
              <span className="tp-kpi-title">AFFECTED USERS</span>
              <Users size={15} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div>
              <div className="tp-kpi-val">{affectedUsersCount}</div>
              <div className="tp-kpi-sub">
                <span style={{ color: 'var(--text-secondary)' }}>{affectedUsersDelta}</span>
              </div>
            </div>
          </div>

          {/* Card 4: Services */}
          <div className="tp-kpi-card">
            <div className="tp-kpi-top">
              <span className="tp-kpi-title">SERVICES</span>
              <Box size={15} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div>
              <div className="tp-kpi-val">{servicesCount}</div>
              <div className="tp-kpi-sub warning">{degradedCount} degraded</div>
            </div>
          </div>
        </div>

        {/* 2. ERROR ACTIVITY SPLINE CHART */}
        <div className="tp-card" style={{ paddingBottom: 14 }}>
          <div className="tp-card-header" style={{ marginBottom: 8 }}>
            <div className="tp-card-title">
              <span>ERROR ACTIVITY</span>
              <Info size={13} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} />
            </div>

            <div style={{ display: 'flex', gap: 4 }}>
              {(['1H', '24H', '7D', '30D'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setChartRange(range)}
                  className={`tp-chart-range-btn ${chartRange === range ? 'active' : ''}`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          {/* Spline Chart SVG with Y Axis and Grid */}
          <div style={{ position: 'relative', width: '100%', height: 160, display: 'flex' }}>
            {/* Y-Axis Labels */}
            <div
              style={{
                width: 34,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                paddingTop: 12,
                paddingBottom: 24,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: '#6a6d7a',
                textAlign: 'right',
                paddingRight: 8,
                userSelect: 'none'
              }}
            >
              <div>200</div>
              <div>150</div>
              <div>100</div>
              <div>50</div>
              <div>0</div>
            </div>

            {/* SVG Plot */}
            <div style={{ flex: 1, position: 'relative', height: '100%' }}>
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 800 140"
                preserveAspectRatio="none"
                style={{ overflow: 'visible' }}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <defs>
                  <linearGradient id="tpChartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e2b474" stopOpacity="0.22" />
                    <stop offset="60%" stopColor="#cc9166" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#cc9166" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Subtle horizontal grid lines */}
                <line x1="0" y1="20" x2="800" y2="20" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3 3" />
                <line x1="0" y1="50" x2="800" y2="50" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3 3" />
                <line x1="0" y1="80" x2="800" y2="80" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3 3" />
                <line x1="0" y1="110" x2="800" y2="110" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3 3" />
                <line x1="0" y1="135" x2="800" y2="135" stroke="rgba(255, 255, 255, 0.08)" />

                {/* Area under curve */}
                {areaD && <path d={areaD} fill="url(#tpChartGradient)" />}

                {/* Gold Spline Curve */}
                {pathD && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#e2b474"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Interactive Points */}
                {pointsCoords.map((pt, idx) => (
                  <g key={idx}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="10"
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredPoint(pt)}
                    />
                    {hoveredPoint?.time === pt.time && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="4"
                        fill="#08080a"
                        stroke="#e2b474"
                        strokeWidth="2"
                      />
                    )}
                  </g>
                ))}
              </svg>

              {/* Hover Tooltip */}
              {hoveredPoint && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${(hoveredPoint.x / 800) * 100}%`,
                    top: hoveredPoint.y - 36,
                    transform: 'translateX(-50%)',
                    background: '#121317',
                    border: '1px solid rgba(204, 145, 102, 0.45)',
                    borderRadius: 6,
                    padding: '3px 8px',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    color: '#ffffff',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                  }}
                >
                  <span style={{ color: '#9194a1' }}>{hoveredPoint.time} : </span>
                  <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>
                    {hoveredPoint.value} errors
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* X-Axis Timestamps */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingLeft: 34,
              paddingRight: 10,
              marginTop: 4,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: '#6a6d7a',
              userSelect: 'none'
            }}
          >
            {chartData.map((pt, i) => (
              <span key={i}>{pt.time}</span>
            ))}
          </div>
        </div>

        {/* 3. ROW: RECENT INCIDENTS + SERVICE HEALTH */}
        <div className="tp-two-col">
          {/* Card: Recent Incidents */}
          <div className="tp-card">
            <div className="tp-card-header">
              <div className="tp-card-title">
                <AlertTriangle size={14} style={{ color: 'var(--accent-gold)' }} />
                <span>RECENT INCIDENTS</span>
              </div>
              <button
                className="tp-card-link"
                onClick={() => navigate('/incidents')}
              >
                <span>View all</span>
                <ArrowRight size={12} />
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="tp-table">
                <thead>
                  <tr>
                    <th>INCIDENT</th>
                    <th>SERVICE</th>
                    <th>SEVERITY</th>
                    <th>STATUS</th>
                    <th style={{ textAlign: 'right' }}>UPDATED</th>
                  </tr>
                </thead>
                <tbody>
                  {recentIncidentsList.map((inc) => (
                    <tr
                      key={inc.id}
                      className="clickable"
                      onClick={() => navigate('/incidents')}
                    >
                      <td style={{ maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#ffffff', fontWeight: 500 }}>
                        {inc.title}
                      </td>
                      <td style={{ color: '#9194a1' }}>{inc.service}</td>
                      <td>
                        <span
                          className={
                            inc.severity === 'HIGH'
                              ? 'tp-pill-high'
                              : inc.severity === 'MEDIUM'
                              ? 'tp-pill-med'
                              : 'tp-pill-low'
                          }
                        >
                          {inc.severity}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              backgroundColor: inc.statusColor
                            }}
                          />
                          <span>{inc.status}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', color: '#6a6d7a' }}>{inc.updated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card: Service Health */}
          <div className="tp-card">
            <div className="tp-card-header">
              <div className="tp-card-title">
                <Layers size={14} style={{ color: 'var(--text-secondary)' }} />
                <span>SERVICE HEALTH</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {servicesList.map((svc, i) => (
                <div key={i} className="tp-service-item">
                  <div className="tp-service-left">
                    <span
                      className={`tp-status-dot ${
                        svc.status === 'healthy' ? 'healthy' : 'warning'
                      }`}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>
                        {svc.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#6a6d7a', marginTop: 1 }}>
                        {svc.uptime}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`tp-service-badge ${
                      svc.label === 'Operational' ? 'operational' : 'degraded'
                    }`}
                  >
                    <span>{svc.label}</span>
                    <ChevronRight size={11} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. ROW: TRACES + RECENT ACTIVITY */}
        <div className="tp-two-col">
          {/* Card: Traces */}
          <div className="tp-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="tp-card-header">
                <div className="tp-card-title">
                  <Activity size={14} style={{ color: 'var(--accent-gold)' }} />
                  <span>TRACES</span>
                </div>
                <button
                  className="tp-card-link"
                  onClick={() => navigate('/traces')}
                >
                  <span>View traces</span>
                  <ArrowRight size={12} />
                </button>
              </div>

              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  287 <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-muted)' }}>ms</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  <span>Avg. trace duration</span>
                  <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 600 }}>
                    <TrendingDown size={13} /> 12%
                  </span>
                </div>
              </div>
            </div>

            {/* Sparkline wave along bottom */}
            <div style={{ width: '100%', height: 44, marginTop: 16 }}>
              <svg width="100%" height="100%" viewBox="0 0 400 44" preserveAspectRatio="none">
                <path
                  d="M 0,32 C 30,22 50,38 80,30 C 110,22 130,12 160,26 C 190,40 220,18 250,22 C 280,26 310,34 340,16 C 360,6 380,24 400,28"
                  fill="none"
                  stroke="#e2b474"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Card: Recent Activity */}
          <div className="tp-card">
            <div className="tp-card-header">
              <div className="tp-card-title">
                <FileText size={14} style={{ color: 'var(--accent-gold)' }} />
                <span>RECENT ACTIVITY</span>
              </div>
              <button
                className="tp-card-link"
                onClick={() => navigate('/incidents')}
              >
                <span>View all</span>
                <ArrowRight size={12} />
              </button>
            </div>

            <div className="tp-timeline">
              {timelineNodes.map((node) => (
                <div key={node.id} className="tp-timeline-node">
                  <div className="tp-timeline-dot" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#ffffff' }}>
                      <span style={{ fontWeight: 600 }}>{node.title}</span>
                      <span style={{ color: '#6a6d7a' }}> — </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{node.detail}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#6a6d7a', whiteSpace: 'nowrap' }}>
                    {node.time}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          RIGHT COLUMN (Activity Feed & Website Scanner)
          ========================================================================= */}
      <div className="tp-side-col">
        {/* 1. ACTIVITY FEED CARD */}
        <div className="tp-card">
          <div className="tp-card-header">
            <div className="tp-card-title">
              <Radio size={14} style={{ color: 'var(--accent-primary)' }} />
              <span>ACTIVITY FEED</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>
              <span className="tp-live-dot" />
              <span>Live</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {activityFeedEvents.map((evt) => (
              <div key={evt.id} className="tp-feed-item">
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: evt.dotColor,
                    marginTop: 5,
                    flexShrink: 0
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#ffffff', lineHeight: 1.3 }}>
                    {evt.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#9194a1', marginTop: 1, lineHeight: 1.3 }}>
                    {evt.desc}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: '#6a6d7a', whiteSpace: 'nowrap', marginTop: 1 }}>
                  {evt.time}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. WEBSITE SCANNER CARD */}
        <div className="tp-card">
          <div className="tp-card-header" style={{ marginBottom: 10 }}>
            <div className="tp-card-title">
              <Globe size={14} style={{ color: 'var(--accent-primary)' }} />
              <span>WEBSITE SCANNER</span>
            </div>
            <span className="tp-badge-ai">AI</span>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
            Scan your website for bugs, errors, and common issues using AI test cases.
          </p>

          {/* URL Input */}
          <form onSubmit={handleRunScan} style={{ marginTop: 12 }}>
            <div className="tp-scanner-input-box">
              <LinkIcon size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                className="tp-scanner-input"
                placeholder="https://example.com"
                value={scanUrl}
                onChange={(e) => setScanUrl(e.target.value)}
                aria-label="Website Target URL"
              />
            </div>

            <button
              type="submit"
              className="tp-scan-btn"
              disabled={isStartingScan}
            >
              <Play size={12} fill="#ffffff" />
              <span>{isStartingScan ? 'Starting Scan...' : 'Run scan'}</span>
            </button>
          </form>

          {/* 3 Metric Boxes */}
          <div className="tp-scanner-stats">
            <div className="tp-scanner-stat-box">
              <div className="tp-scanner-stat-num">12</div>
              <div className="tp-scanner-stat-lbl">Pages crawled</div>
            </div>
            <div className="tp-scanner-stat-box">
              <div className="tp-scanner-stat-num">4</div>
              <div className="tp-scanner-stat-lbl">Issues found</div>
            </div>
            <div className="tp-scanner-stat-box">
              <div className="tp-scanner-stat-num">18</div>
              <div className="tp-scanner-stat-lbl">Test cases</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>
              <span>Scan coverage</span>
              <span style={{ fontWeight: 700, color: '#ffffff' }}>86%</span>
            </div>
            <div className="tp-coverage-bar">
              <div className="tp-coverage-fill" style={{ width: '86%' }} />
            </div>
          </div>

          {/* View Last Scan Report Link */}
          <div style={{ marginTop: 6 }}>
            <button
              className="tp-card-link"
              onClick={() => navigate('/dashboard/website-scanner')}
              style={{ fontSize: 12 }}
            >
              <span>View last scan report</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}