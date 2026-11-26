import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import {
  Sun,
  Moon,
  ArrowRight,
  AlertTriangle,
  Activity,
  Layers,
  Sparkles,
  Globe,
  FileText
} from 'lucide-react';

export const LandingLogoMark = ({ size = 20, color = 'var(--lp-accent)' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <rect x="4" y="3" width="4.5" height="18" rx="2.2" transform="skewX(-16)" fill={color} />
    <rect x="13.5" y="3" width="4.5" height="18" rx="2.2" transform="skewX(-16)" fill={color} />
  </svg>
);

export default function LandingPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleGetStarted = () => {
    navigate('/dashboard');
  };

  const handleViewDemo = () => {
    navigate('/dashboard');
  };

  return (
    <div className="landing-page" data-theme={theme}>
      {/* =========================================================================
          1. DESKTOP & MOBILE NAVIGATION
          ========================================================================= */}
      <header className="landing-navbar">
        {/* Left: Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => scrollToSection('hero')}>
          <LandingLogoMark size={22} color="var(--lp-accent)" />
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--lp-text-primary)' }}>
            TRACEPILOT
          </span>
        </div>

        {/* Center: Navigation Links */}
        <nav className="landing-nav-links">
          <a href="#hero" className="landing-nav-item" onClick={(e) => { e.preventDefault(); scrollToSection('hero'); }}>HOME</a>
          <a href="#about" className="landing-nav-item" onClick={(e) => { e.preventDefault(); scrollToSection('about'); }}>ABOUT</a>
          <a href="#product" className="landing-nav-item" onClick={(e) => { e.preventDefault(); scrollToSection('product'); }}>PRODUCT</a>
          <a href="#how-it-works" className="landing-nav-item" onClick={(e) => { e.preventDefault(); scrollToSection('how-it-works'); }}>SOLUTIONS</a>
          <a href="#pricing" className="landing-nav-item" onClick={(e) => { e.preventDefault(); scrollToSection('pricing'); }}>PRICING</a>
          <a href="#features" className="landing-nav-item" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}>RESOURCES</a>
        </nav>

        {/* Right: Theme Toggle & Get Started Button */}
        <div className="landing-nav-right">
          <button
            className="landing-theme-toggle"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <Sun size={18} style={{ color: '#F5BD62' }} />
            ) : (
              <Moon size={18} style={{ color: '#101827' }} />
            )}
          </button>

          <button className="landing-btn-primary" onClick={handleGetStarted}>
            GET STARTED
          </button>
        </div>
      </header>

      {/* =========================================================================
          2. HERO SECTION WITH 7 FLOATING MONITORING CARDS & CLOUDS
          ========================================================================= */}
      <section id="hero" className="landing-hero-container">
        {/* Atmospheric Clouds Background Textures */}
        <div className="landing-clouds-top" />
        <div className="landing-clouds-bottom" />

        {/* Cloud vector curves for layered atmosphere */}
        <svg className="landing-cloud-texture" style={{ top: -20, left: 0, width: '100%', height: 260, opacity: isDark ? 0.25 : 0.7 }} viewBox="0 0 1440 260" fill="none">
          <path d="M0 120 C 180 40, 360 80, 520 110 C 720 145, 960 70, 1140 100 C 1300 130, 1380 90, 1440 70 L 1440 0 L 0 0 Z" fill="#FFFFFF" />
        </svg>

        <svg className="landing-cloud-texture" style={{ bottom: -20, right: 0, width: '100%', height: 320, opacity: isDark ? 0.35 : 0.85 }} viewBox="0 0 1440 320" fill="none">
          <path d="M0 240 C 240 180, 480 280, 720 220 C 960 160, 1200 250, 1440 210 L 1440 320 L 0 320 Z" fill="#FFFFFF" />
        </svg>

        {/* Hero Headlines */}
        <h1 className="landing-hero-title">
          Debug with evidence,
          <span className="gold-accent">not guesswork.</span>
        </h1>

        <p className="landing-hero-sub">
          Unify incidents, traces, service health, AI diagnosis, and website scanning in one platform.
          Find the root cause faster, reduce downtime, and keep your services running smoothly.
        </p>

        {/* Action Buttons */}
        <div className="landing-hero-actions">
          <button className="landing-btn-secondary" onClick={handleViewDemo}>
            VIEW DEMO
          </button>
          <button className="landing-btn-primary" onClick={handleGetStarted}>
            <span>GET STARTED</span>
            <ArrowRight size={15} />
          </button>
        </div>

        {/* 7 Floating Monitoring Cards in Arc */}
        <div className="landing-cards-arc">
          {/* Card 1: Incidents */}
          <div className="landing-float-card landing-card-tilt-1">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--lp-text-muted)' }}>
              <AlertTriangle size={13} style={{ color: '#F5BD62' }} />
              <span>Incidents</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--lp-text-primary)', marginTop: 8, lineHeight: 1 }}>
              3 open
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#F87171', marginTop: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
              <span>↑ 2 high severity</span>
            </div>
          </div>

          {/* Card 2: Error Activity */}
          <div className="landing-float-card landing-card-tilt-2">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--lp-text-muted)' }}>
              <Activity size={13} style={{ color: '#F5BD62' }} />
              <span>Error Activity</span>
            </div>
            <div style={{ height: 38, marginTop: 8 }}>
              <svg width="100%" height="100%" viewBox="0 0 120 38" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="heroCardGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F5BD62" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#F5BD62" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path d="M 0,30 Q 20,28 35,16 T 70,22 T 95,8 T 120,24 L 120,38 L 0,38 Z" fill="url(#heroCardGrad)" />
                <path d="M 0,30 Q 20,28 35,16 T 70,22 T 95,8 T 120,24" fill="none" stroke="#F5BD62" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Card 3: AI Diagnosis */}
          <div className="landing-float-card landing-card-tilt-3" style={{ minWidth: 160 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--lp-text-muted)' }}>
              <Sparkles size={13} style={{ color: '#F5BD62' }} />
              <span>AI Diagnosis</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--lp-text-primary)' }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#F5BD62', color: '#101827', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
                <span style={{ fontWeight: 600 }}>AuthenticationError</span>
              </div>
              <div style={{ fontSize: 9, color: 'var(--lp-text-muted)', paddingLeft: 20 }}>(98% confidence)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--lp-text-primary)', marginTop: 2 }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', color: 'var(--lp-text-primary)', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
                <span style={{ fontWeight: 600 }}>Invalid token</span>
              </div>
            </div>
          </div>

          {/* Card 4: TRACEPILOT (Center Visual Anchor) */}
          <div className="landing-float-center landing-card-tilt-4">
            <LandingLogoMark size={32} color="#F5BD62" />
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--lp-text-primary)', marginTop: 8 }}>
              TRACEPILOT
            </div>
          </div>

          {/* Card 5: Service Health */}
          <div className="landing-float-card landing-card-tilt-5" style={{ minWidth: 155 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--lp-text-muted)' }}>
              <Layers size={13} style={{ color: 'var(--lp-text-secondary)' }} />
              <span>Service Health</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38C976' }} />
                  <span style={{ color: 'var(--lp-text-primary)', fontWeight: 600 }}>API Gateway</span>
                </div>
                <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: 'rgba(56,201,118,0.15)', color: '#38C976', fontWeight: 700 }}>Operational</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38C976' }} />
                  <span style={{ color: 'var(--lp-text-primary)', fontWeight: 600 }}>UserService</span>
                </div>
                <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: 'rgba(56,201,118,0.15)', color: '#38C976', fontWeight: 700 }}>Operational</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B' }} />
                  <span style={{ color: 'var(--lp-text-primary)', fontWeight: 600 }}>PaymentService</span>
                </div>
                <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', fontWeight: 700 }}>Degraded</span>
              </div>
            </div>
          </div>

          {/* Card 6: Website Scanner */}
          <div className="landing-float-card landing-card-tilt-6">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--lp-text-muted)' }}>
              <Globe size={13} style={{ color: '#F5BD62' }} />
              <span>Website Scanner</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--lp-text-secondary)', marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span>Scan coverage</span>
              <span style={{ fontWeight: 700, color: 'var(--lp-text-primary)' }}>86%</span>
            </div>
            <div style={{ width: '100%', height: 6, borderRadius: 9999, background: 'rgba(255,255,255,0.1)', marginTop: 6, overflow: 'hidden' }}>
              <div style={{ width: '86%', height: '100%', background: 'linear-gradient(90deg, #F5BD62, #FFD493)', borderRadius: 9999 }} />
            </div>
          </div>

          {/* Card 7: Recent Activity */}
          <div className="landing-float-card landing-card-tilt-7">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--lp-text-muted)' }}>
              <FileText size={13} style={{ color: '#F5BD62' }} />
              <span>Recent Activity</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--lp-text-primary)' }}>Incident resolved</div>
                <div style={{ fontSize: 9, color: 'var(--lp-text-muted)' }}>2 min ago</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--lp-text-primary)' }}>New trace received</div>
                <div style={{ fontSize: 9, color: 'var(--lp-text-muted)' }}>5 min ago</div>
              </div>
            </div>
          </div>
        </div>

        {/* Social Proof */}
        <div className="landing-social-proof">
          <div className="landing-social-text">Trusted by engineering teams at modern companies</div>
          <div className="landing-stars">★★★★★</div>
        </div>
      </section>

      {/* =========================================================================
          3. LOGO STRIP / SOCIAL PROOF
          ========================================================================= */}
      <div className="landing-logo-strip">
        {[1, 2, 3, 4, 5, 6, 7].map((num) => (
          <div key={num} className="landing-logo-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5 10 5 10-5-5-2.5-5 2.5z" />
            </svg>
            <span>Logoipsum</span>
          </div>
        ))}
      </div>

      {/* =========================================================================
          4. ABOUT TRACEPILOT SECTION & 4 BENTO CARDS
          ========================================================================= */}
      <section id="about" style={{ padding: '60px 0' }}>
        <div className="landing-section-tag">• ABOUT TRACEPILOT</div>
        <h2 className="landing-section-title">
          The observability platform for reliable,{' '}
          <span style={{ color: 'var(--lp-accent)' }}>high-performing services.</span>
        </h2>
        <p className="landing-section-desc">
          TracePilot brings together incident management, distributed traces, service health, AI-powered diagnosis, and website scanning so your team can find, understand, and fix issues faster.
        </p>

        {/* Bento Grid */}
        <div className="landing-bento-grid">
          {/* Bento Card 1: Dashboard Preview (Spans 1st column, 2 rows) */}
          <div className="landing-card" style={{ gridRow: 'span 2', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <LandingLogoMark size={18} color="var(--lp-accent)" />
                <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--lp-text-primary)' }}>TRACEPILOT</span>
              </div>

              {/* Simulated high-tech dashboard perspective graphic */}
              <div style={{
                background: '#09090b',
                borderRadius: 14,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: 16,
                transform: 'perspective(800px) rotateX(6deg) rotateY(-4deg)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                marginTop: 10
              }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <div style={{ flex: 1, height: 42, background: '#121317', borderRadius: 8, padding: '6px 8px' }}>
                    <div style={{ fontSize: 8, color: '#9194a1' }}>OPEN INCIDENTS</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>0</div>
                  </div>
                  <div style={{ flex: 1, height: 42, background: '#121317', borderRadius: 8, padding: '6px 8px' }}>
                    <div style={{ fontSize: 8, color: '#9194a1' }}>TOTAL ERRORS</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>1,284</div>
                  </div>
                  <div style={{ flex: 1, height: 42, background: '#121317', borderRadius: 8, padding: '6px 8px' }}>
                    <div style={{ fontSize: 8, color: '#9194a1' }}>SERVICES</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>3</div>
                  </div>
                </div>

                {/* Simulated Chart */}
                <div style={{ height: 60, width: '100%', background: '#0e0f13', borderRadius: 8, padding: 8, position: 'relative' }}>
                  <svg width="100%" height="100%" viewBox="0 0 200 44" preserveAspectRatio="none">
                    <path d="M 0,34 Q 30,30 60,18 T 120,24 T 160,8 T 200,26 L 200,44 L 0,44 Z" fill="rgba(245, 189, 98, 0.15)" />
                    <path d="M 0,34 Q 30,30 60,18 T 120,24 T 160,8 T 200,26" fill="none" stroke="#F5BD62" strokeWidth="2" />
                  </svg>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--lp-text-primary)', marginTop: 24 }}>
              From signal to root cause — faster.
            </div>
          </div>

          {/* Bento Card 2: Mean Time to Resolution */}
          <div className="landing-card" style={{ gridColumn: 'span 1' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--lp-text-muted)' }}>
              Mean time to resolution
            </div>
            <div style={{ fontSize: 42, fontWeight: 800, color: 'var(--lp-text-primary)', margin: '8px 0', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>70%</span>
              <span style={{ color: 'var(--lp-accent)' }}>↓</span>
            </div>

            {/* 3 Customer Avatars */}
            <div style={{ display: 'flex', alignItems: 'center', gap: -6, margin: '14px 0' }}>
              {['#F5BD62', '#38C976', '#38BDF8'].map((bg, idx) => (
                <div key={idx} style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: bg,
                  border: '2px solid var(--lp-surface)',
                  marginLeft: idx > 0 ? -8 : 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#101827'
                }}>
                  {String.fromCharCode(65 + idx)}
                </div>
              ))}
            </div>

            <p style={{ fontSize: 13, color: 'var(--lp-text-secondary)', lineHeight: 1.5, margin: 0 }}>
              "TracePilot gives us the evidence we need to fix issues quickly and with confidence."
            </p>
          </div>

          {/* Bento Card 3: Errors Analyzed (Warm Gold Surface) */}
          <div className="landing-card" style={{
            background: 'linear-gradient(135deg, rgba(245, 189, 98, 0.16) 0%, rgba(204, 145, 102, 0.28) 100%)',
            borderColor: 'rgba(245, 189, 98, 0.45)'
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--lp-text-secondary)' }}>
              Errors analyzed (monthly)
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--lp-text-primary)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>1,284</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#38C976', padding: '2px 8px', borderRadius: 9999, background: 'rgba(56, 201, 118, 0.15)' }}>
                ↑ 18%
              </span>
            </div>
          </div>

          {/* Bento Card 4: Services Monitored */}
          <div className="landing-card" style={{ gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--lp-text-muted)' }}>
                  Services monitored
                </div>
                <div style={{ fontSize: 38, fontWeight: 800, color: 'var(--lp-text-primary)', marginTop: 4 }}>
                  20+
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--lp-surface-elevated)', fontSize: 11, fontWeight: 600, color: 'var(--lp-text-secondary)' }}>API Gateway</span>
                <span style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--lp-surface-elevated)', fontSize: 11, fontWeight: 600, color: 'var(--lp-text-secondary)' }}>Payments</span>
                <span style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--lp-surface-elevated)', fontSize: 11, fontWeight: 600, color: 'var(--lp-text-secondary)' }}>Database</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. PRODUCT FEATURES (4 CARDS)
          ========================================================================= */}
      <section id="product" style={{ padding: '60px 0' }}>
        <div className="landing-section-tag">• PRODUCT</div>
        <h2 className="landing-section-title">
          A complete reliability toolkit for modern engineering teams.
        </h2>
        <p className="landing-section-desc">
          Everything you need to detect, diagnose, and resolve issues across your services, applications, and websites.
        </p>

        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <button className="landing-btn-primary" onClick={handleGetStarted}>
            <span>GET STARTED</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* 4 Feature Cards */}
        <div className="landing-features-grid">
          {/* Card 1 */}
          <div className="landing-feature-card">
            <div className="landing-icon-tile">
              <AlertTriangle size={18} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--lp-text-primary)', margin: 0 }}>
              Incident Management
            </h3>
            <p style={{ fontSize: 14, color: 'var(--lp-text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Capture, prioritize, and resolve incidents with full context and evidence.
            </p>
          </div>

          {/* Card 2 */}
          <div className="landing-feature-card">
            <div className="landing-icon-tile">
              <Activity size={18} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--lp-text-primary)', margin: 0 }}>
              Traces & Performance
            </h3>
            <p style={{ fontSize: 14, color: 'var(--lp-text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Explore distributed traces, spot bottlenecks, and understand what's really happening.
            </p>
          </div>

          {/* Card 3 */}
          <div className="landing-feature-card">
            <div className="landing-icon-tile">
              <Layers size={18} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--lp-text-primary)', margin: 0 }}>
              Service Health
            </h3>
            <p style={{ fontSize: 14, color: 'var(--lp-text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Monitor service uptime, detect degradations early, and stay ahead of outages.
            </p>
          </div>

          {/* Card 4 */}
          <div className="landing-feature-card">
            <div className="landing-icon-tile">
              <Sparkles size={18} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--lp-text-primary)', margin: 0 }}>
              AI Diagnosis
            </h3>
            <p style={{ fontSize: 14, color: 'var(--lp-text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Get AI-powered root cause suggestions with ranked evidence and confidence scores.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. HOW IT WORKS (3 SIMPLE STEPS)
          ========================================================================= */}
      <section id="how-it-works" style={{ padding: '60px 20px' }}>
        <div className="landing-steps-box">
          {/* Left Column: Headline */}
          <div>
            <div className="landing-section-tag" style={{ justifyContent: 'flex-start' }}>• HOW IT WORKS</div>
            <h2 style={{ fontSize: 'clamp(26px, 3.2vw, 36px)', fontWeight: 800, lineHeight: 1.2, color: 'var(--lp-text-primary)', margin: '12px 0 0 0' }}>
              From issue to resolution in{' '}
              <span style={{ color: 'var(--lp-accent)' }}>three simple steps.</span>
            </h2>
          </div>

          {/* Right Column: 3 Horizontal Steps */}
          <div className="landing-steps-row">
            {/* Step 1 */}
            <div className="landing-step-card">
              <div className="landing-step-num">1</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--lp-text-primary)', margin: '0 0 6px 0' }}>Detect</h3>
              <p style={{ fontSize: 13, color: 'var(--lp-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Automatically capture incidents, errors, and anomalies.
              </p>
            </div>

            <ArrowRight size={20} style={{ color: 'var(--lp-text-muted)', flexShrink: 0 }} />

            {/* Step 2 */}
            <div className="landing-step-card">
              <div className="landing-step-num">2</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--lp-text-primary)', margin: '0 0 6px 0' }}>Diagnose</h3>
              <p style={{ fontSize: 13, color: 'var(--lp-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Use traces, service health, and AI analysis to find the root cause.
              </p>
            </div>

            <ArrowRight size={20} style={{ color: 'var(--lp-text-muted)', flexShrink: 0 }} />

            {/* Step 3 */}
            <div className="landing-step-card">
              <div className="landing-step-num">3</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--lp-text-primary)', margin: '0 0 6px 0' }}>Resolve</h3>
              <p style={{ fontSize: 13, color: 'var(--lp-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Take action with clear evidence, context, and next steps.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. FINAL CTA BANNER
          ========================================================================= */}
      <section id="pricing" style={{ padding: '0 20px' }}>
        <div className="landing-cta-banner">
          {/* Cloud overlays */}
          <div className="landing-clouds-top" style={{ height: 120 }} />
          <div className="landing-clouds-bottom" style={{ height: 120 }} />

          <div style={{ position: 'relative', zIndex: 10, maxWidth: 640 }}>
            <h2 style={{ fontSize: 'clamp(26px, 3.4vw, 38px)', fontWeight: 800, color: '#FFFFFF', margin: 0, lineHeight: 1.2 }}>
              Get started with TracePilot today.
            </h2>
            <p style={{ fontSize: 15, color: isDark ? '#C4CBD6' : '#E0F2FE', marginTop: 12, lineHeight: 1.5 }}>
              Debug faster, reduce downtime, and build more reliable services with a single, AI-powered observability platform.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', zIndex: 10 }}>
            <button className="landing-btn-primary" onClick={handleGetStarted}>
              <span>GET STARTED</span>
              <ArrowRight size={14} />
            </button>
            <button className="landing-btn-secondary" onClick={handleViewDemo}>
              VIEW DEMO
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          8. FOOTER
          ========================================================================= */}
      <footer id="features" className="landing-footer">
        <div className="landing-footer-inner">
          {/* Brand Col */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <LandingLogoMark size={20} color="var(--lp-accent)" />
              <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--lp-text-primary)' }}>
                TRACEPILOT
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--lp-text-muted)', lineHeight: 1.6, maxWidth: 280, margin: 0 }}>
              The modern observability platform delivering deep telemetry, distributed tracing, and AI root cause diagnosis.
            </p>
            <div style={{ fontSize: 12, color: 'var(--lp-text-muted)', marginTop: 20 }}>
              © {new Date().getFullYear()} TracePilot Inc. All rights reserved.
            </div>
          </div>

          {/* Links Col 1: Product */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--lp-text-primary)', textTransform: 'uppercase', marginBottom: 14 }}>
              Product
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <a href="#about" onClick={(e) => { e.preventDefault(); scrollToSection('about'); }} style={{ color: 'var(--lp-text-secondary)', textDecoration: 'none' }}>Overview</a>
              <a href="#product" onClick={(e) => { e.preventDefault(); scrollToSection('product'); }} style={{ color: 'var(--lp-text-secondary)', textDecoration: 'none' }}>Incident Management</a>
              <a href="#product" onClick={(e) => { e.preventDefault(); scrollToSection('product'); }} style={{ color: 'var(--lp-text-secondary)', textDecoration: 'none' }}>Traces & Performance</a>
              <a href="#product" onClick={(e) => { e.preventDefault(); scrollToSection('product'); }} style={{ color: 'var(--lp-text-secondary)', textDecoration: 'none' }}>AI Diagnosis</a>
              <a href="#product" onClick={(e) => { e.preventDefault(); scrollToSection('product'); }} style={{ color: 'var(--lp-text-secondary)', textDecoration: 'none' }}>Website Scanner</a>
            </div>
          </div>

          {/* Links Col 2: Solutions */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--lp-text-primary)', textTransform: 'uppercase', marginBottom: 14 }}>
              Resources
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <span style={{ color: 'var(--lp-text-secondary)', cursor: 'pointer' }} onClick={handleGetStarted}>Documentation</span>
              <span style={{ color: 'var(--lp-text-secondary)', cursor: 'pointer' }} onClick={handleGetStarted}>API Reference</span>
              <span style={{ color: 'var(--lp-text-secondary)', cursor: 'pointer' }} onClick={handleGetStarted}>SDK Guides</span>
              <span style={{ color: 'var(--lp-text-secondary)', cursor: 'pointer' }} onClick={handleGetStarted}>Status & Uptime</span>
            </div>
          </div>

          {/* Links Col 3: Company */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--lp-text-primary)', textTransform: 'uppercase', marginBottom: 14 }}>
              Company
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <span style={{ color: 'var(--lp-text-secondary)', cursor: 'pointer' }}>About Us</span>
              <span style={{ color: 'var(--lp-text-secondary)', cursor: 'pointer' }}>Careers</span>
              <span style={{ color: 'var(--lp-text-secondary)', cursor: 'pointer' }}>Privacy Policy</span>
              <span style={{ color: 'var(--lp-text-secondary)', cursor: 'pointer' }}>Terms of Service</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
