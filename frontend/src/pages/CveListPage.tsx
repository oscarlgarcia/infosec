import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { cveApi } from '../api/cve';
import type { CveAdvisory } from '../types/request360';
import { SEVERITIES } from '../types/request360';
import {
  EmptyState,
  ErrorBanner,
  Loading,
  SeverityBadge,
  formatDate,
} from '../components/request360/badges';

export function CveListPage() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<CveAdvisory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState({ q: '', severity: '', status: '' });
  const [form, setForm] = useState({
    cveId: '',
    title: '',
    severity: 'high',
    cvssScore: '',
    products: '',
    publishedAt: '',
    status: 'draft',
    summary: '',
  });

  const canManage = Boolean(user && ['admin', 'manager', 'sme'].includes(user.role));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await cveApi.list({
        q: filters.q || undefined,
        severity: filters.severity || undefined,
        status: filters.status || undefined,
        page,
        limit: 25,
      });
      setItems(response.items);
      setTotal(response.total);
      setHasMore(response.hasMore);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await cveApi.create({
        cveId: form.cveId,
        title: form.title,
        severity: form.severity,
        cvssScore: form.cvssScore ? Number(form.cvssScore) : undefined,
        products: form.products ? form.products.split(',').map((item) => item.trim()).filter(Boolean) : [],
        publishedAt: form.publishedAt || undefined,
        status: form.status,
        summary: form.summary || undefined,
      });
      setShowCreate(false);
      setForm({ cveId: '', title: '', severity: 'high', cvssScore: '', products: '', publishedAt: '', status: 'draft', summary: '' });
      navigate(`/cve/${created._id}`);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout>
      <div className="r360-page">
        <div className="r360-page-header">
          <div>
            <h1>CVE Advisories</h1>
            <p className="r360-subtitle">
              {language === 'es'
                ? 'Seguimiento de vulnerabilidades y comunicación a clientes afectados.'
                : 'Vulnerability tracking and communication to affected clients.'}
            </p>
          </div>
          <div className="r360-header-actions">
            {canManage && (
              <button className="r360-btn r360-btn-primary" onClick={() => setShowCreate((current) => !current)}>
                + {language === 'es' ? 'Nuevo CVE' : 'New CVE'}
              </button>
            )}
          </div>
        </div>

        <ErrorBanner error={error} />

        {showCreate && canManage && (
          <div className="r360-card r360-section">
            <div className="r360-form-grid">
              <label className="r360-field">
                <span>CVE ID</span>
                <input placeholder="CVE-2026-12345" value={form.cveId} onChange={(event) => setForm((c) => ({ ...c, cveId: event.target.value }))} />
              </label>
              <label className="r360-field">
                <span>{language === 'es' ? 'Severidad' : 'Severity'}</span>
                <select value={form.severity} onChange={(event) => setForm((c) => ({ ...c, severity: event.target.value }))}>
                  {SEVERITIES.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
                </select>
              </label>
              <label className="r360-field">
                <span>CVSS</span>
                <input type="number" min={0} max={10} step={0.1} value={form.cvssScore} onChange={(event) => setForm((c) => ({ ...c, cvssScore: event.target.value }))} />
              </label>
              <label className="r360-field">
                <span>{language === 'es' ? 'Estado' : 'Status'}</span>
                <select value={form.status} onChange={(event) => setForm((c) => ({ ...c, status: event.target.value }))}>
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                  <option value="archived">archived</option>
                </select>
              </label>
              <label className="r360-field r360-field-full">
                <span>{language === 'es' ? 'Título' : 'Title'}</span>
                <input value={form.title} onChange={(event) => setForm((c) => ({ ...c, title: event.target.value }))} />
              </label>
              <label className="r360-field r360-field-full">
                <span>{language === 'es' ? 'Productos (coma)' : 'Products (comma)'}</span>
                <input value={form.products} onChange={(event) => setForm((c) => ({ ...c, products: event.target.value }))} />
              </label>
              <label className="r360-field">
                <span>{language === 'es' ? 'Publicado' : 'Published'}</span>
                <input type="date" value={form.publishedAt} onChange={(event) => setForm((c) => ({ ...c, publishedAt: event.target.value }))} />
              </label>
              <label className="r360-field r360-field-full">
                <span>{language === 'es' ? 'Resumen' : 'Summary'}</span>
                <textarea rows={3} value={form.summary} onChange={(event) => setForm((c) => ({ ...c, summary: event.target.value }))} />
              </label>
              <div className="r360-inline-group r360-field-full">
                <button className="r360-btn r360-btn-primary" disabled={busy || !form.cveId || !form.title} onClick={create}>
                  {language === 'es' ? 'Crear CVE' : 'Create CVE'}
                </button>
                <button className="r360-btn" onClick={() => setShowCreate(false)}>{language === 'es' ? 'Cancelar' : 'Cancel'}</button>
              </div>
            </div>
          </div>
        )}

        <div className="r360-filters">
          <input
            type="search"
            placeholder={language === 'es' ? 'Buscar CVE, título o producto…' : 'Search CVE, title or product…'}
            value={filters.q}
            onChange={(event) => { setPage(1); setFilters((c) => ({ ...c, q: event.target.value })); }}
          />
          <select value={filters.severity} onChange={(event) => { setPage(1); setFilters((c) => ({ ...c, severity: event.target.value })); }}>
            <option value="">{language === 'es' ? 'Todas las severidades' : 'All severities'}</option>
            {SEVERITIES.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
          </select>
          <select value={filters.status} onChange={(event) => { setPage(1); setFilters((c) => ({ ...c, status: event.target.value })); }}>
            <option value="">{language === 'es' ? 'Todos los estados' : 'All statuses'}</option>
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
        </div>

        {loading ? (
          <Loading lang={language} />
        ) : items.length === 0 ? (
          <EmptyState icon="🛡️" title={language === 'es' ? 'Sin CVE registrados' : 'No CVEs'} />
        ) : (
          <div className="r360-card r360-table-wrap">
            <table className="r360-table">
              <thead>
                <tr>
                  <th>CVE</th>
                  <th>{language === 'es' ? 'Título' : 'Title'}</th>
                  <th>{language === 'es' ? 'Severidad' : 'Severity'}</th>
                  <th>CVSS</th>
                  <th>{language === 'es' ? 'Estado' : 'Status'}</th>
                  <th>{language === 'es' ? 'Publicado' : 'Published'}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((advisory) => (
                  <tr key={advisory._id} className="r360-clickable-row" onClick={() => navigate(`/cve/${advisory._id}`)}>
                    <td><span className="r360-mono">{advisory.cveId}</span></td>
                    <td><div className="r360-truncate">{advisory.title}</div></td>
                    <td><SeverityBadge severity={advisory.severity} lang={language} /></td>
                    <td>{advisory.cvssScore ?? '—'}</td>
                    <td><span className="r360-badge r360-status-new">{advisory.status || 'draft'}</span></td>
                    <td>{formatDate(advisory.publishedAt, language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="r360-pagination">
          <button className="r360-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← {language === 'es' ? 'Anterior' : 'Previous'}</button>
          <span>{language === 'es' ? `Página ${page} · ${total} resultados` : `Page ${page} · ${total} results`}</span>
          <button className="r360-btn" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>{language === 'es' ? 'Siguiente' : 'Next'} →</button>
        </div>

        <p className="r360-muted">
          <Link className="r360-link" to="/requests">{language === 'es' ? 'Volver a solicitudes' : 'Back to requests'}</Link>
        </p>
      </div>
    </Layout>
  );
}
