import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import boardLogo from '../assets/images/Board_logo_RGB.svg';

const NAV_ICONS: Record<string, JSX.Element> = {
  home: <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>,
  cms: <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/></svg>,
  site: <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}><path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.43.22-.247.237-.528.657-.783 1.278-.237.577-.445 1.31-.605 2.167h3.636c-.16-.857-.368-1.59-.605-2.167-.255-.621-.536-1.04-.783-1.278C10.232 4.032 10.076 4 10 4zm-3 7a1 1 0 100-2 1 1 0 000 2zm6 0a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg>,
  login: <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}><path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd"/></svg>,
};

interface PageData {
  _id: string;
  title: string;
  slug: string;
  content: string;
  summary?: string;
  tags: string[];
  parentId?: string | { _id: string } | null;
  order?: number;
  updatedAt: string;
}

export function SiteIndex() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [pages, setPages] = useState<PageData[]>([]);
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isNavOpen, setIsNavOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    fetch('/api/cms/public/pages')
      .then(r => r.json())
      .then((data: PageData[]) => {
        setPages(data);
        const targetSlug = slug || 'index';
        const found = data.find(p => p.slug === targetSlug);
        if (found) setPage(found);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  useEffect(() => { setIsNavOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!isNavOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsNavOpen(false); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNavOpen]);

  const { language } = useLanguage();
  const { user, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (!loading && page) {
      document.title = (slug && slug !== 'index' ? page?.title : 'Home') + ' | InfoSec';
    }
  }, [loading, page, slug]);

  const tree = useMemo(() => {
    const map = new Map<string, PageData[]>();
    const roots: PageData[] = [];
    pages.forEach(p => {
      const pid: string | null = p.parentId && typeof p.parentId === 'object' ? (p.parentId as any)._id : (p.parentId as string) || null;
      if (pid) {
        const arr = map.get(pid) || [];
        arr.push(p);
        if (!map.has(pid)) map.set(pid, arr);
      } else {
        roots.push(p);
      }
    });
    map.forEach(children => children.sort((a, b) => (a.order || 0) - (b.order || 0)));
    roots.sort((a, b) => (a.order || 0) - (b.order || 0));
    return { roots, map };
  }, [pages]);

  const renderTree = (nodes: PageData[], depth = 0): JSX.Element[] => {
    return nodes.flatMap(node => {
      if (node.slug === 'index') {
        const children = tree.map.get(node._id) || [];
        return renderTree(children, depth);
      }
      const children = tree.map.get(node._id) || [];
      const hasChildren = children.length > 0;
      const isExpanded = expandedIds.has(node._id);
      const isActive = page?._id === node._id;
      return [
        <div key={node._id}
          className={`site-tree-node${isActive ? ' active' : ''}`}
          style={{ paddingLeft: 12 + depth * 16 }}
          onClick={() => navigate(`/site/${node.slug}`)}
        >
          {hasChildren ? (
            <span className="site-tree-toggle" onClick={e => { e.stopPropagation(); const s = new Set(expandedIds); if (isExpanded) s.delete(node._id); else s.add(node._id); setExpandedIds(s); }}>
              {isExpanded ? '▼' : '▶'}
            </span>
          ) : <span className="site-tree-toggle site-tree-toggle-empty">•</span>}
          <span className="site-tree-title">{node.title}</span>
        </div>,
        ...(hasChildren && isExpanded ? renderTree(children, depth + 1) : []),
      ];
    });
  };

  if (loading) {
    return (
      <div className="site-index">
        <div className="site-loading"><em>Loading...</em></div>
      </div>
    );
  }

  const isIndex = !slug || slug === 'index';

  const handleLogout = async () => { await logout(); };

  return (
    <div className="site-index">
      <header className="layout-header">
        <button type="button" className="nav-burger-btn" aria-label={language === 'es' ? 'Abrir menu' : 'Open menu'} aria-expanded={isNavOpen} onClick={() => setIsNavOpen(!isNavOpen)}>☰</button>
        <img src={boardLogo} alt="Board" className="layout-header-logo" />
        <div className="header-search">
          <input
            type="text"
            className="search-input"
            placeholder={language === 'es' ? 'Buscar...' : 'Search...'}
          />
        </div>
        <div className="header-auth-section">
          {isAuthenticated && user ? (
            <>
              {(user.role === 'admin' || user.role === 'manager' || user.role === 'sme') && (
                <Link to="/cms" className="btn-primary btn-sm" style={{ textDecoration: 'none' }}>CMS</Link>
              )}
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
      <div className={`nav-drawer-overlay ${isNavOpen ? 'open' : ''}`} onClick={() => setIsNavOpen(false)} />
      <nav className={`nav-drawer ${isNavOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <Link to="/app" className="logo" onClick={() => setIsNavOpen(false)}>
            <div className="logo-icon">IS</div>
            <span>InfoSec Agent</span>
          </Link>
        </div>
        <div className="sidebar-nav">
          {isAuthenticated && user ? (
            <>
              <Link to="/app" className={`nav-item ${isActive('/app') || isActive('/') ? 'active' : ''}`} onClick={() => setIsNavOpen(false)}>
                <span className="nav-icon">{NAV_ICONS.home}</span>
                <span>{language === 'es' ? 'Inicio' : 'Home'}</span>
              </Link>
              {(user.role === 'admin' || user.role === 'manager' || user.role === 'sme') && (
                <>
                  <Link to="/cms" className={`nav-item ${isActive('/cms') ? 'active' : ''}`} onClick={() => setIsNavOpen(false)}>
                    <span className="nav-icon">{NAV_ICONS.cms}</span>
                    <span>CMS</span>
                  </Link>
                  <Link to="/site" className={`nav-item ${isActive('/site') ? 'active' : ''}`} onClick={() => setIsNavOpen(false)}>
                    <span className="nav-icon">{NAV_ICONS.site}</span>
                    <span>Site</span>
                  </Link>
                </>
              )}
            </>
          ) : (
            <Link to="/login" className={`nav-item ${isActive('/login') ? 'active' : ''}`} onClick={() => setIsNavOpen(false)}>
              <span className="nav-icon">{NAV_ICONS.login}</span>
              <span>{language === 'es' ? 'Iniciar sesion' : 'Login'}</span>
            </Link>
          )}
        </div>
      </nav>
      <div className="site-index-body">
        <aside className="site-index-sidebar">
          <div className="site-index-sidebar-title">Pages</div>
          <a href="/app" className="site-index-back-link">← Back to Home</a>
          {renderTree(tree.roots)}
        </aside>
        <main className="site-index-main">
          {page ? (
            <article className="site-article">
              <h1 className="site-title">{isIndex ? 'Home' : page.title}</h1>
              {page.summary && <p className="site-summary">{page.summary}</p>}
              {page.tags.length > 0 && (
                <div className="site-meta">
                  <div className="site-tags">
                    {page.tags.map((tag, i) => <span key={i} className="site-tag">{tag}</span>)}
                  </div>
                </div>
              )}
              <div className="site-content" dangerouslySetInnerHTML={{ __html: page.content }} />
            </article>
          ) : (
            <div className="site-index-empty">
              <h2>Page not found</h2>
              <p>The page you are looking for does not exist.</p>
            </div>
          )}
        </main>
      </div>
      <footer className="site-footer">
        <p>&copy; {new Date().getFullYear()} InfoSec</p>
      </footer>
    </div>
  );
}
