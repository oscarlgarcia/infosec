import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { cveApi } from '../api/cve';
import type { CveAdvisory, CveRecord } from '../types/request360';
import { SEVERITIES } from '../types/request360';
import {
  EmptyState,
  ErrorBanner,
  Loading,
  SeverityBadge,
  formatDate,
} from '../components/request360/badges';

type TabKey = 'catalog' | 'advisories';

const TABS: Record<TabKey, { es: string; en: string }> = {
  catalog: { es: 'Catálogo NVD / KEV', en: 'NVD / KEV catalog' },
  advisories: { es: 'Avisos curados', en: 'Curated advisories' },
};

const EMPTY_FORM = {
  cveId: '',
  title: '',
  severity: 'high',
  cvssScore: '',
  products: '',
  publishedAt: '',
  status: 'draft',
  summary: '',
};

export function CveListPage() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('catalog');
  const [advisories, setAdvisories] = useState<CveAdvisory[]>([]);
  const [catalog, setCatalog] = useState<CveRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [filters, setFilters] = useState({ q: '', severity: '', status: '' });
  const [catalogFilters, setCatalogFilters] = useState({
    q: '',
    severity: '',
    kev: false,
    ransomware: false,
    hasAdvisory: '' as '' | 'true' | 'false',
    sort: 'published',
  });
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const pageRef = useRef<HTMLDivElement>(null);

  const canManage = Boolean(user && ['admin', 'manager', 'sme'].includes(user.role));
  const isAdmin = user?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'catalog') {
        const response = await cveApi.catalog({
          q: catalogFilters.q || undefined,
          severity: catalogFilters.severity || undefined,
          kev: catalogFilters.kev || undefined,
          ransomware: catalogFilters.ransomware || undefined,
          hasAdvisory: catalogFilters.hasAdvisory === '' ? undefined : catalogFilters.hasAdvisory === 'true',
          sort: catalogFilters.sort,
          page,
          limit: 25,
        });
        setCatalog(response.items);
        setTotal(response.total);
        setHasMore(response.hasMore);
      } else {
        const response = await cveApi.list({
          q: filters.q || undefined,
          severity: filters.severity || undefined,
          status: filters.status || undefined,
          page,
          limit: 25,
        });
        setAdvisories(response.items);
        setTotal(response.total);
        setHasMore(response.hasMore);
      }
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, [tab, page, filters, catalogFilters]);

  useEffect(() => {
    load();
  }, [load]);

  // The page is its own scroll container: reset it when paging or switching tabs.
  useEffect(() => {
    pageRef.current?.scrollTo({ top: 0 });
  }, [page, tab]);

  const switchTab = (next: TabKey) => {
    setTab(next);
    setPage(1);
    setNotice(null);
  };

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
      setForm({ ...EMPTY_FORM });
      navigate(`/cve/${created._id}`);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  const promote = async (record: CveRecord) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await cveApi.promote(record.cveId);
      if (result.created) {
        setNotice(
          language === 'es'
            ? `Aviso creado para ${record.cveId} con ${result.impacts} impacto(s).`
            : `Advisory created for ${record.cveId} with ${result.impacts} impact(s).`
        );
      } else {
        setNotice(
          language === 'es'
            ? `${record.cveId} ya tenía un aviso asociado.`
            : `${record.cveId} already had an advisory.`
        );
      }
      navigate(`/cve/${result.advisory._id}`);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout>
      <div className="r360-page r360-page-scroll r360-list-page" ref={pageRef}>
        <div className="r360-page-header">
          <div>
            <h1>CVE</h1>
            <p className="r360-subtitle">
              {language === 'es'
                ? 'Catálogo de vulnerabilidades NVD / CISA KEV y avisos curados para clientes.'
                : 'NVD / CISA KEV vulnerability catalog and curated client advisories.'}
            </p>
          </div>
          <div className="r360-header-actions">
            {isAdmin && (
              <Link className="r360-btn" to="/cve-sync">
                ⟳ {language === 'es' ? 'Sincronización' : 'Sync'}
              </Link>
            )}
            {tab === 'advisories' && canManage && (
              <button className="r360-btn r360-btn-primary" onClick={() => setShowCreate((current) => !current)}>
                + {language === 'es' ? 'Nuevo aviso' : 'New advisory'}
              </button>
            )}
          </div>
        </div>

        <div className="r360-tabs">
          {(Object.keys(TABS) as TabKey[]).map((key) => (
            <button key={key} className={`r360-tab ${tab === key ? 'active' : ''}`} onClick={() => switchTab(key)}>
              {TABS[key][language]}
            </button>
          ))}
        </div>

        <ErrorBanner error={error} />
        {notice && <div className="r360-success">{notice}</div>}

        {tab === 'advisories' && showCreate && canManage && (
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
                  {language === 'es' ? 'Crear aviso' : 'Create advisory'}
                </button>
                <button className="r360-btn" onClick={() => setShowCreate(false)}>{language === 'es' ? 'Cancelar' : 'Cancel'}</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'catalog' ? (
          <div className="r360-filters">
            <input
              type="search"
              placeholder={language === 'es' ? 'Buscar CVE, título, proveedor o producto…' : 'Search CVE, title, vendor or product…'}
              value={catalogFilters.q}
              onChange={(event) => { setPage(1); setCatalogFilters((c) => ({ ...c, q: event.target.value })); }}
            />
            <select value={catalogFilters.severity} onChange={(event) => { setPage(1); setCatalogFilters((c) => ({ ...c, severity: event.target.value })); }}>
              <option value="">{language === 'es' ? 'Todas las severidades' : 'All severities'}</option>
              {SEVERITIES.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
            </select>
            <select value={catalogFilters.hasAdvisory} onChange={(event) => { setPage(1); setCatalogFilters((c) => ({ ...c, hasAdvisory: event.target.value as any })); }}>
              <option value="">{language === 'es' ? 'Aviso: cualquiera' : 'Advisory: any'}</option>
              <option value="true">{language === 'es' ? 'Con aviso' : 'With advisory'}</option>
              <option value="false">{language === 'es' ? 'Sin aviso' : 'Without advisory'}</option>
            </select>
            <select value={catalogFilters.sort} onChange={(event) => { setPage(1); setCatalogFilters((c) => ({ ...c, sort: event.target.value })); }}>
              <option value="published">{language === 'es' ? 'Más recientes' : 'Newest'}</option>
              <option value="cvss">{language === 'es' ? 'Mayor CVSS' : 'Highest CVSS'}</option>
              <option value="kev">{language === 'es' ? 'KEV primero' : 'KEV first'}</option>
            </select>
            <label className="r360-checkbox">
              <input type="checkbox" checked={catalogFilters.kev} onChange={(event) => { setPage(1); setCatalogFilters((c) => ({ ...c, kev: event.target.checked })); }} />
              KEV
            </label>
            <label className="r360-checkbox">
              <input type="checkbox" checked={catalogFilters.ransomware} onChange={(event) => { setPage(1); setCatalogFilters((c) => ({ ...c, ransomware: event.target.checked })); }} />
              Ransomware
            </label>
          </div>
        ) : (
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
        )}

        {loading ? (
          <Loading lang={language} />
        ) : tab === 'catalog' ? (
          catalog.length === 0 ? (
            <EmptyState
              icon="🛰️"
              title={language === 'es' ? 'Sin CVEs en el catálogo' : 'No CVEs in the catalog'}
              text={language === 'es' ? 'Ejecuta una sincronización NVD/KEV para poblar el catálogo.' : 'Run an NVD/KEV sync to populate the catalog.'}
            />
          ) : (
            <div className="r360-card r360-table-wrap">
              <table className="r360-table">
                <thead>
                  <tr>
                    <th>CVE</th>
                    <th>{language === 'es' ? 'Título' : 'Title'}</th>
                    <th>{language === 'es' ? 'Severidad' : 'Severity'}</th>
                    <th>CVSS</th>
                    <th>{language === 'es' ? 'Señales' : 'Signals'}</th>
                    <th>{language === 'es' ? 'Publicado' : 'Published'}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {catalog.map((record) => (
                    <tr key={record._id} className="r360-clickable-row" onClick={() => navigate(`/cve/${record.cveId}`)}>
                      <td><span className="r360-mono r360-key">{record.cveId}</span></td>
                      <td>
                        <div className="r360-truncate">{record.title}</div>
                        {record.vendors?.length > 0 && <div className="r360-muted">{record.vendors.slice(0, 2).join(', ')}</div>}
                      </td>
                      <td><SeverityBadge severity={record.severity} lang={language} /></td>
                      <td>{record.cvssScore ?? '—'}</td>
                      <td>
                        <div className="r360-inline-group">
                          {record.kev?.listed && <span className="r360-badge r360-severity-critical">KEV</span>}
                          {/known/i.test(record.kev?.knownRansomwareCampaignUse || '') && (
                            <span className="r360-badge r360-severity-high">Ransomware</span>
                          )}
                          {record.matches?.length > 0 && (
                            <span className="r360-badge r360-status-new">
                              {record.matches.length} {language === 'es' ? 'cliente(s)' : 'client(s)'}
                            </span>
                          )}
                          {record.advisoryId && <span className="r360-badge r360-status-closed">Advisory</span>}
                        </div>
                      </td>
                      <td>{formatDate(record.publishedAt, language)}</td>
                      <td>
                        {canManage && !record.advisoryId && (
                          <button
                            className="r360-btn"
                            disabled={busy}
                            onClick={(event) => {
                              event.stopPropagation();
                              promote(record);
                            }}
                          >
                            + {language === 'es' ? 'Crear aviso' : 'Create advisory'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : advisories.length === 0 ? (
          <EmptyState icon="🛡️" title={language === 'es' ? 'Sin avisos registrados' : 'No advisories'} />
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
                {advisories.map((advisory) => (
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
