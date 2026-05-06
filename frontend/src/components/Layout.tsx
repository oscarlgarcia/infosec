import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import boardLogo from '../assets/images/Board_logo_RGB.svg';

interface LayoutProps {
  children: ReactNode;
  sidebarContent?: ReactNode;
}

interface NavLinkItem {
  path: string;
  label: string;
  icon: string;
}

export function Layout({ children, sidebarContent }: LayoutProps) {
  const { language, t } = useLanguage();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const homePath = isAuthenticated ? '/app' : '/';
  const [isNavOpen, setIsNavOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
  };

  useEffect(() => {
    setIsNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isNavOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNavOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNavOpen]);

  const getNavLinks = (): NavLinkItem[] => {
    if (!user) return [];

    const links: NavLinkItem[] = [{ path: '/app', label: t('home') || (language === 'es' ? 'Inicio' : 'Home'), icon: 'H' }];

    if (user.role === 'admin' || user.role === 'manager' || user.role === 'sme') {
      links.push({ path: '/ask', label: t('chat') || 'Chat', icon: 'CH' });
      links.push({ path: '/cms', label: t('cms') || 'CMS', icon: 'C' });
      links.push({ path: '/answer-builder', label: language === 'es' ? 'Answer Builder' : 'Answer Builder', icon: 'AB' });
      links.push({ path: '/analytics', label: language === 'es' ? 'Analytics' : 'Analytics', icon: 'AN' });
      links.push({ path: '/contradictions', label: language === 'es' ? 'Contradicciones' : 'Contradictions', icon: 'CT' });
      links.push({ path: '/kb-candidates', label: language === 'es' ? 'KB Review' : 'KB Review', icon: 'KR' });
      links.push({ path: '/knowledge-graph', label: 'Knowledge Graph', icon: 'KG' });
      links.push({ path: '/gap-finder', label: 'Gap Finder', icon: 'GF' });
    }

      links.push({ path: '/knowledge-base', label: t('knowledgeBase') || 'Knowledge Base', icon: 'KB' });
      links.push({ path: '/tasks', label: language === 'es' ? 'Tareas' : 'Tasks', icon: 'TK' });
      links.push({ path: '/settings', label: t('settings') || 'Settings', icon: 'S' });

    if (user.role === 'admin') {
      links[0] = { path: '/app', label: language === 'es' ? 'Dashboard' : 'Dashboard', icon: 'D' };
    }

    return links;
  };

  const navLinks = getNavLinks();

  return (
    <div className="app layout-app">
      <div className="main-container">
        <main className="layout-main">
          <header className="layout-header">
            <button
              type="button"
              className="nav-burger-btn"
              aria-label={language === 'es' ? 'Abrir navegación' : 'Open navigation'}
              aria-expanded={isNavOpen}
              onClick={() => setIsNavOpen((current) => !current)}
            >
              ☰
            </button>

            <img src={boardLogo} alt="Board" className="layout-header-logo" />

            <div className="header-search">
              <input
                type="text"
                className="search-input"
                placeholder={t('searchPlaceholder') || (language === 'es' ? 'Buscar...' : 'Search...')}
              />
            </div>

            <div className="header-auth-section">
              {isAuthenticated && user ? (
                <>
                  <span className="user-greeting">
                    {language === 'es' ? 'Hola,' : 'Hi,'} <strong>{user.username}</strong>
                  </span>
                  <span className={`role-indicator role-${user.role}`}>
                    {user.role === 'admin' && 'Admin'}
                    {user.role === 'manager' && 'Manager'}
                    {user.role === 'sme' && 'SME'}
                    {user.role === 'usuario' && (language === 'es' ? 'Usuario' : 'User')}
                  </span>
                  <button className="btn-logout-header" onClick={handleLogout}>
                    {language === 'es' ? 'Cerrar sesion' : 'Logout'}
                  </button>
                </>
              ) : (
                <Link to="/login" className="btn-login-header">
                  {language === 'es' ? 'Iniciar sesion' : 'Login'}
                </Link>
              )}
            </div>
          </header>

          <div
            className={`nav-drawer-overlay ${isNavOpen ? 'open' : ''}`}
            onClick={() => setIsNavOpen(false)}
          />
          <nav className={`nav-drawer ${isNavOpen ? 'open' : ''}`}>
            <div className="sidebar-logo">
              <Link to={homePath} className="logo" onClick={() => setIsNavOpen(false)}>
                <div className="logo-icon">IS</div>
                <span>InfoSec Agent</span>
              </Link>
            </div>

            <div className="sidebar-nav">
              {navLinks.map((link) => (
                <Link
                  key={`${link.path}-${link.label}`}
                  to={link.path}
                  className={`nav-item ${isActive(link.path) ? 'active' : ''}`}
                  onClick={() => setIsNavOpen(false)}
                >
                  {link.icon} {link.label}
                </Link>
              ))}
            </div>
          </nav>

          <div className="layout-content">
            {sidebarContent ? (
              <div className="content-with-sidebar">
                <div className="inner-sidebar">{sidebarContent}</div>
                <div className="inner-content">{children}</div>
              </div>
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </div>
  );
}