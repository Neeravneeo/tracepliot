import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function TopBar() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [environment, setEnvironment] = useState('production');
  const [timeRange, setTimeRange] = useState('24h');

  // Derive current page title for breadcrumb
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') return 'Dashboard';
    if (path.startsWith('/incidents')) return 'Incidents';
    if (path.startsWith('/traces')) return 'Traces';
    if (path.includes('scanner')) return 'Website Scanner';
    if (path.startsWith('/projects')) return 'Projects';
    if (path.startsWith('/settings')) return 'Settings';
    return 'Dashboard';
  };

  const isDark = theme === 'dark';

  return (
    <header className="tp-topbar">
      <div className="tp-topbar-left">
        <div className="tp-breadcrumb">
          <span className="tp-breadcrumb-brand">TracePilot</span>
          <span className="tp-breadcrumb-sep">/</span>
          <span className="tp-breadcrumb-current">{getPageTitle()}</span>
        </div>

        <div style={{ position: 'relative' }}>
          <select
            className="tp-select-pill"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            aria-label="Select Environment"
          >
            <option value="production">PRODUCTION</option>
            <option value="staging">STAGING</option>
            <option value="development">DEVELOPMENT</option>
          </select>
        </div>
      </div>

      <div className="tp-topbar-right">
        <div className="tp-live-pill">
          <span className="tp-live-dot"></span>
          <span>LIVE</span>
        </div>

        <div style={{ position: 'relative' }}>
          <select
            className="tp-select-pill"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            aria-label="Select Time Range"
          >
            <option value="1h">LAST 1 HOUR</option>
            <option value="24h">LAST 24 HOURS</option>
            <option value="7d">LAST 7 DAYS</option>
            <option value="30d">LAST 30 DAYS</option>
          </select>
        </div>

        <button
          className="tp-theme-btn"
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {isDark ? <Moon size={14} /> : <Sun size={14} />}
        </button>
      </div>
    </header>
  );
}