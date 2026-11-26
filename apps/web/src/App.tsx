import { BrowserRouter as Router, Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Overview from './pages/Overview';
import Incidents from './pages/Incidents';
import IncidentDetail from './pages/IncidentDetail';
import Traces from './pages/Traces';
import WebsiteScannerPage from './pages/WebsiteScanner/WebsiteScannerPage';
import ScanProgressPage from './pages/WebsiteScanner/ScanProgressPage';
import WebsiteHealthReport from './pages/WebsiteScanner/WebsiteHealthReport';
import DetailedBugView from './pages/WebsiteScanner/DetailedBugView';
import Projects from './pages/Projects';
import Settings from './pages/Settings';
import { Auth } from './pages/Auth';
import TopBar from './components/TopBar';
import Toast from './components/Toast';
import { useAppContext, AppProvider } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import {
  LayoutGrid,
  AlertTriangle,
  Activity,
  Globe,
  Layers,
  Settings as SettingsIcon,
  ChevronDown,
  LogOut,
  ExternalLink
} from 'lucide-react';
import { useState } from 'react';
import './index.css';

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAppContext();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const isDashboardActive = location.pathname === '/dashboard';
  const displayEmail = user?.email || 'developer@tracepilot.dev';
  const userInitial = displayEmail.charAt(0).toUpperCase() || 'D';

  return (
    <aside className="tp-sidebar">
      {/* 1. TRACEPILOT LOGO */}
      <div className="tp-sidebar-header">
        <button
          className="tp-logo-btn"
          onClick={() => navigate('/dashboard')}
          title="TracePilot Dashboard"
        >
          <span className="tp-logo-mark">//</span>
          <span className="tp-logo-text">TRACEPILOT</span>
        </button>
      </div>

      {/* 2. NAVIGATION */}
      <nav style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="tp-nav-section-title">MONITOR</div>

        <NavLink
          to="/dashboard"
          className={`tp-nav-link ${isDashboardActive ? 'active' : ''}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LayoutGrid size={15} style={{ color: isDashboardActive ? 'var(--accent-gold)' : 'var(--text-muted)' }} />
            <span>Overview</span>
          </div>
        </NavLink>

        <NavLink
          to="/incidents"
          className={({ isActive }) => `tp-nav-link ${isActive ? 'active' : ''}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={15} />
            <span>Incidents</span>
          </div>
        </NavLink>

        <NavLink
          to="/traces"
          className={({ isActive }) => `tp-nav-link ${isActive ? 'active' : ''}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Activity size={15} />
            <span>Traces</span>
          </div>
        </NavLink>

        <NavLink
          to="/dashboard/website-scanner"
          className={({ isActive }) => `tp-nav-link ${isActive ? 'active' : ''}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Globe size={15} />
            <span>Website Scanner</span>
          </div>
          <span className="tp-badge-ai">AI</span>
        </NavLink>

        <div className="tp-nav-section-title">CONFIGURE</div>

        <NavLink
          to="/projects"
          className={({ isActive }) => `tp-nav-link ${isActive ? 'active' : ''}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Layers size={15} />
            <span>Projects</span>
          </div>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) => `tp-nav-link ${isActive ? 'active' : ''}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SettingsIcon size={15} />
            <span>Settings</span>
          </div>
        </NavLink>

        <div style={{ marginTop: 12, padding: '0 8px' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px',
              borderRadius: 6,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'var(--text-muted)',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <span>Public Landing Page</span>
            <ExternalLink size={11} />
          </button>
        </div>
      </nav>

      {/* 3. FOOTER USER PROFILE */}
      <div className="tp-sidebar-footer">
        <div style={{ position: 'relative', width: '100%' }}>
          <button
            className="tp-user-pill"
            style={{ width: '100%', justifyContent: 'space-between' }}
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-label="User Account Menu"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
              <div className="tp-user-avatar">{userInitial}</div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayEmail}
              </span>
            </div>
            <ChevronDown size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </button>

          {showUserMenu && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                right: 0,
                marginBottom: 8,
                background: '#121317',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '6px 8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                zIndex: 50
              }}
            >
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  logout();
                  navigate('/');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 8px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--danger)',
                  fontSize: 12,
                  cursor: 'pointer',
                  borderRadius: 4
                }}
              >
                <LogOut size={13} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function AuthenticatedAppLayout() {
  const { token, authPaused, loading } = useAppContext();

  if (loading) {
    return <div className="layout" style={{ justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>Loading TracePilot...</div>;
  }

  if (!token && !authPaused) {
    return <Auth />;
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <TopBar />
        <div className="content-wrapper">
          <Routes>
            <Route path="dashboard" element={<Overview />} />
            <Route path="incidents" element={<Incidents />} />
            <Route path="incidents/:id" element={<IncidentDetail />} />
            <Route path="traces" element={<Traces />} />
            <Route path="dashboard/website-scanner" element={<WebsiteScannerPage />} />
            <Route path="dashboard/website-scanner/scans/:scanId" element={<ScanProgressPage />} />
            <Route path="dashboard/website-scanner/reports/:scanId" element={<WebsiteHealthReport />} />
            <Route path="dashboard/website-scanner/bugs/:bugId" element={<DetailedBugView />} />
            <Route path="scanner" element={<WebsiteScannerPage />} />
            <Route path="projects" element={<Projects />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Overview />} />
          </Routes>
        </div>
      </main>
      <Toast />
    </div>
  );
}

function AppContent() {
  return (
    <Router>
      <Routes>
        {/* Public Landing Page Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/home" element={<LandingPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/auth" element={<Auth />} />

        {/* Authenticated Dashboard & Monitoring Routes */}
        <Route path="/*" element={<AuthenticatedAppLayout />} />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ThemeProvider>
  );
}

export default App;