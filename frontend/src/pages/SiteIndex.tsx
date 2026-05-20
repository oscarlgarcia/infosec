import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

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
  const [pages, setPages] = useState<PageData[]>([]);
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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

  return (
    <div className="site-index">
      <header className="site-header">
        <div className="site-header-inner">
          <a href="/site" className="site-logo">InfoSec</a>
          <span className="site-header-title">{page?.title || 'Pages'}</span>
        </div>
      </header>
      <div className="site-index-body">
        <aside className="site-index-sidebar">
          <div className="site-index-sidebar-title">Pages</div>
          {renderTree(tree.roots)}
        </aside>
        <main className="site-index-main">
          {page ? (
            <article className="site-article">
              <h1 className="site-title">{page.title}</h1>
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
