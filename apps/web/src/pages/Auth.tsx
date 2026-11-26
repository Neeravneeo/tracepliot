import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { AlertCircle } from 'lucide-react';

import { OrbitSwitch } from '../components/OrbitSwitch';

export const Auth = () => {
  const { login, register, authPaused } = useAppContext();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 24, left: 24 }}>
        <a href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Back to Home
        </a>
      </div>
      <div style={{ position: 'absolute', top: 24, right: 24 }}>
        <OrbitSwitch />
      </div>
      <div className="auth-content">
        <div className="auth-brand">TracePilot</div>
        
        <div className="auth-header">
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">
            {isLogin ? 'Sign in to TracePilot to continue.' : 'Create a TracePilot account to continue.'}
          </p>
        </div>

        {authPaused && (
          <div style={{
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 20,
            fontSize: 13,
            color: '#38bdf8'
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>🧪 Testing Mode: Auth Paused</div>
            <div style={{ color: 'var(--color-pale-stone)', marginBottom: 10 }}>
              Authentication is currently bypassed for testing. You can enter with one click.
            </div>
            <button
              type="button"
              onClick={() => login('developer@tracepilot.dev', 'dev_testing_mode')}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Continue to Dashboard (Bypass Auth)
            </button>
          </div>
        )}

        {error && (
          <div className="auth-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="form-input"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="form-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`btn-auth ${loading ? 'disabled' : ''}`}
          >
            {loading ? 'Processing...' : (isLogin ? 'Continue' : 'Create account')}
          </button>
        </form>

        <div className="auth-footer">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="auth-link"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};
