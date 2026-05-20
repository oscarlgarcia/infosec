import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

interface PageData {
  _id: string;
  title: string;
  content: string;
  summary?: string;
  tags: string[];
  updatedAt: string;
}

export function SitePage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/cms/public/pages/${slug}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(data => { setPage(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="site-page">
        <div className="site-loading"><em>Loading...</em></div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="site-page">
        <div className="site-error">
          <h1>404</h1>
          <p>Page not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="site-page">
      <header className="site-header">
        <div className="site-header-inner">
          <a href="/" className="site-logo">InfoSec</a>
          <span className="site-header-title">{page.title}</span>
        </div>
      </header>
      <main className="site-main">
        <article className="site-article">
          <h1 className="site-title">{page.title}</h1>
          {page.summary && <p className="site-summary">{page.summary}</p>}
          <div className="site-meta">
            {page.tags.length > 0 && (
              <div className="site-tags">
                {page.tags.map((tag, i) => <span key={i} className="site-tag">{tag}</span>)}
              </div>
            )}
            <span className="site-date">{new Date(page.updatedAt).toLocaleDateString()}</span>
          </div>
          <div className="site-content" dangerouslySetInnerHTML={{ __html: page.content }} />
        </article>
      </main>
      <footer className="site-footer">
        <p>&copy; {new Date().getFullYear()} InfoSec</p>
      </footer>
    </div>
  );
}
