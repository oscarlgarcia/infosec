import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types';
import '../styles/App.css';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await login({ username, password });
      const role = (user as any)?.role || 'usuario';
      
      if (role === 'admin' || role === 'manager' || role === 'sme') {
        navigate('/app', { replace: true });
      } else {
        navigate('/app', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        <section className="login-brand-panel">
          <div className="login-brand-mark">
            <span className="login-brand-square login-brand-square-large"></span>
            <span className="login-brand-square login-brand-square-small"></span>
          </div>

          <div className="login-brand-copy">
            <div className="login-eyebrow">Continuous Planning Security Workspace</div>
            <h1>Secure planning intelligence for teams that cannot guess.</h1>
            <p>
              Access the InfoSec workspace to manage clients, review knowledge content, and
              coordinate conversations with domain-specific agents in a controlled environment.
            </p>
          </div>

          <div className="login-brand-stats">
            <div className="login-stat-card">
              <span className="login-stat-label">Workspace</span>
              <strong>InfoSec Agent</strong>
            </div>
            <div className="login-stat-card">
              <span className="login-stat-label">Environment</span>
              <strong>Docker Dev</strong>
            </div>
          </div>
        </section>

        <section className="login-form-panel">
          <div className="login-form-card">
            <div className="login-card-topline"></div>

            <div className="login-card-header">
              <div className="login-card-logo">
                <span className="login-card-logo-box">B</span>
                <span>BOARD style</span>
              </div>
              <Link to="/" className="login-back-link">
                Back to home
              </Link>
            </div>

            <div className="login-card-title">
              <h2>Sign in</h2>
              <p>Use your workspace credentials to continue.</p>
            </div>

            {error && <div className="login-error-banner">{error}</div>}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-field">
                <label htmlFor="username">Username or Email</label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="admin or admin@infosec.local"
                />
              </div>

              <div className="login-field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                />
              </div>

              <button type="submit" disabled={isLoading} className="login-submit">
                {isLoading ? 'Signing in...' : 'Enter workspace'}
              </button>
            </form>

            <div className="login-demo-panel">
              <span className="login-demo-label">Demo credentials</span>
              <code>admin / Admin123!@#</code>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
