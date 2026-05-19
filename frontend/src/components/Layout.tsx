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
  icon: ReactNode;
}

const NAV_ICONS = {
  home: <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>,
  dashboard: <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zm10 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>,
  chat: <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zm-4 0H9v2h2V9z" clipRule="evenodd"/></svg>,
  cms: <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/></svg>,
  analytics: <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>,
  contradictions: <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>,
  kbReview: <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>,
  knowledgeGraph: <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zm6-6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zm0 8a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>,
  knowledgeCenter: <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}><path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.43.22-.247.237-.528.657-.783 1.278-.237.577-.445 1.31-.605 2.167h3.636c-.16-.857-.368-1.59-.605-2.167-.255-.621-.536-1.04-.783-1.278C10.232 4.032 10.076 4 10 4zm-3.918 7A7.005 7.005 0 004.082 11h1.946c.089 1.546.383 2.97.837 4.118A6.004 6.004 0 016.082 11zm.82 4.736c.475.898 1.034 1.528 1.38 1.712.212.113.33.114.406.112.094-.003.202-.04.333-.13.31-.213.643-.646.905-1.261.221-.518.394-1.154.514-1.93H7.59c.12.776.293 1.412.514 1.93.262.615.595 1.048.905 1.261.13.09.239.127.333.13.077.002.194 0 .406-.113.346-.183.905-.813 1.38-1.712.475-.898.85-2.07.997-3.524H7.903c.147 1.454.522 2.626.997 3.524zm3.782-4.736c.089 1.546.383 2.97.837 4.118A5.99 5.99 0 0013.918 11h1.946a6.004 6.004 0 00-2.783-4.118c.454 1.147.748 2.572.837 4.118zm.82-4.736c.475.898 1.034 1.528 1.38 1.712.212.113.33.114.406.112.094-.003.202-.04.333-.13.31-.213.643-.646.905-1.261.221-.518.394-1.154.514-1.93h-3.436c.12.776.293 1.412.514 1.93.262.615.595 1.048.905 1.261.13.09.239.127.333.13.077.002.194 0 .406-.113.346-.183.905-.813 1.38-1.712z" clipRule="evenodd"/></svg>,
  gapFinder: <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/></svg>,
  orchestrator: <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/></svg>,
  knowledgeBase: <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>,
  tasks: <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg>,
  settings: <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/></svg>,
};

export function Layout({ children, sidebarContent }: LayoutProps) {
  const { language, t } = useLanguage();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const homePath = isAuthenticated ? '/app' : '/';
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isKcOpen, setIsKcOpen] = useState(location.pathname.startsWith('/knowledge-center'));

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

  const KC_SUBMENU_ICONS = {
    dashboard: <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16}><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zm10 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>,
    reports: <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16}><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" clipRule="evenodd"/></svg>,
    newReport: <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16}><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/></svg>,
    scheduled: <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16}><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/></svg>,
    canonical: <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16}><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>,
    graph: <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16}><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zm6-6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zm0 8a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>,
  };

  const kcSubmenuItems = [
    { path: '/knowledge-center', label: language === 'es' ? 'Dashboard' : 'Dashboard', icon: KC_SUBMENU_ICONS.dashboard },
    { path: '/knowledge-center/reports', label: language === 'es' ? 'Reportes' : 'Reports', icon: KC_SUBMENU_ICONS.reports },
    { path: '/knowledge-center/reports/new', label: language === 'es' ? 'Nuevo Reporte' : 'New Report', icon: KC_SUBMENU_ICONS.newReport },
    { path: '/knowledge-center/scheduled', label: language === 'es' ? 'Programados' : 'Scheduled', icon: KC_SUBMENU_ICONS.scheduled },
    { path: '/knowledge-center/canonical', label: language === 'es' ? 'Canónicas' : 'Canonical', icon: KC_SUBMENU_ICONS.canonical },
    { path: '/knowledge-center/graph', label: language === 'es' ? 'Grafo' : 'Graph', icon: KC_SUBMENU_ICONS.graph },
  ];

  const getNavLinks = (): NavLinkItem[] => {
    if (!user) return [];

    const links: NavLinkItem[] = [{ path: '/app', label: t('home') || (language === 'es' ? 'Inicio' : 'Home'), icon: NAV_ICONS.home }];

    if (user.role === 'admin' || user.role === 'manager' || user.role === 'sme') {
      links.push({ path: '/analytics', label: 'Analytics', icon: NAV_ICONS.analytics });
      links.push({ path: '/ask', label: t('chat') || 'Chat', icon: NAV_ICONS.chat });
    }

    links.push({ path: '/knowledge-base', label: t('knowledgeBase') || 'Knowledge Base', icon: NAV_ICONS.knowledgeBase });

    if (user.role === 'admin' || user.role === 'manager' || user.role === 'sme') {
      links.push({ path: '/kb-candidates', label: 'KB Review', icon: NAV_ICONS.kbReview });
      links.push({ path: '/gap-finder', label: 'Gap Finder', icon: NAV_ICONS.gapFinder });
      links.push({ path: '/orchestrator', label: 'Orchestrator', icon: NAV_ICONS.orchestrator });
      links.push({ path: '/cms', label: 'Content', icon: NAV_ICONS.cms });
      links.push({ path: '/contradictions', label: 'Contradictions', icon: NAV_ICONS.contradictions });
    }

    links.push({ path: '/tasks', label: language === 'es' ? 'Tareas' : 'Tasks', icon: NAV_ICONS.tasks });
    links.push({ path: '/settings', label: t('settings') || 'Settings', icon: NAV_ICONS.settings });

    if (user.role === 'admin') {
      links[0] = { path: '/app', label: language === 'es' ? 'Dashboard' : 'Dashboard', icon: NAV_ICONS.dashboard };
    }

    return links;
  };

  const navLinks = getNavLinks();
  const kcInsertIndex = navLinks.findIndex(l => l.path === '/ask') + 1;

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
              {navLinks.slice(0, kcInsertIndex).map((link) => (
                <Link
                  key={`${link.path}-${link.label}`}
                  to={link.path}
                  className={`nav-item ${isActive(link.path) ? 'active' : ''}`}
                  onClick={() => setIsNavOpen(false)}
                >
                  <span className="nav-icon">{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              ))}

              {user && (user.role === 'admin' || user.role === 'manager' || user.role === 'sme') && (
                <div className="nav-submenu">
                  <button
                    className={`nav-item nav-submenu-toggle ${isKcOpen ? 'active' : ''}`}
                    onClick={() => setIsKcOpen(!isKcOpen)}
                  >
                    <span className="nav-icon">{NAV_ICONS.knowledgeCenter}</span>
                    <span>Knowledge Center</span>
                    <span className={`submenu-arrow ${isKcOpen ? 'open' : ''}`}>▸</span>
                  </button>
                  {isKcOpen && (
                    <div className="nav-submenu-items">
                      {kcSubmenuItems.map((item) => (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`nav-item nav-submenu-item ${location.pathname === item.path || (item.path !== '/knowledge-center' && location.pathname.startsWith(item.path)) ? 'active' : ''}`}
                          onClick={() => setIsNavOpen(false)}
                        >
                          <span className="nav-icon" style={{ width: 16, height: 16 }}>{item.icon}</span>
                          <span>{item.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {navLinks.slice(kcInsertIndex).map((link) => (
                <Link
                  key={`${link.path}-${link.label}`}
                  to={link.path}
                  className={`nav-item ${isActive(link.path) ? 'active' : ''}`}
                  onClick={() => setIsNavOpen(false)}
                >
                  <span className="nav-icon">{link.icon}</span>
                  <span>{link.label}</span>
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
