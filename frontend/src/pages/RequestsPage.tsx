import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { requestsApi } from '../api/requests';
import type { Request360 } from '../types/request360';
import { PRIORITIES, REQUEST_STATUSES } from '../types/request360';
import {
  EmptyState,
  ErrorBanner,
  Loading,
  PriorityBadge,
  SeverityBadge,
  SlaBadge,
  StatusBadge,
  formatDate,
} from '../components/request360/badges';

type ViewMode = 'table' | 'board';

export function RequestsPage() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>('table');
  const [items, setItems] = useState<Request360[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState({
    q: '',
    status: '',
    priority: '',
    slaState: '',
    includeClosed: false,
  });

  const canCreate = user && ['admin', 'manager', 'sme'].includes(user.role);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await requestsApi.list({
        q: filters.q || undefined,
        status: filters.status || undefined,
        priority: filters.priority || undefined,
        slaState: filters.slaState || undefined,
        includeClosed: filters.includeClosed,
        page,
        limit: view === 'board' ? 100 : 25,
      });
      setItems(response.items);
      setTotal(response.total);
      setHasMore(response.hasMore);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, [filters, page, view]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const map: Record<string, Request360[]> = {};
    for (const status of REQUEST_STATUSES) map[status] = [];
    for (const item of items) {
      if (!map[item.statusNew]) map[item.statusNew] = [];
      map[item.statusNew].push(item);
    }
    return map;
  }, [items]);

  const applyFilter = (patch: Partial<typeof filters>) => {
    setPage(1);
    setFilters((current) => ({ ...current, ...patch }));
  };

  return (
    <Layout>
      <div className="r360-page r360-page-scroll r360-list-page">
        <div className="r360-page-header">
          <div>
            <h1>{language === 'es' ? 'Solicitudes' : 'Requests'}</h1>
            <p className="r360-subtitle">
              {language === 'es'
                ? 'Intake, logbook, SLA y entregables en una sola vista.'
                : 'Intake, logbook, SLA and deliverables in one place.'}
            </p>
          </div>
          <div className="r360-header-actions">
            <div className="r360-view-toggle">
              <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
                {language === 'es' ? 'Tabla' : 'Table'}
              </button>
              <button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}>
                {language === 'es' ? 'Tablero' : 'Board'}
              </button>
            </div>
            {canCreate && (
              <Link className="r360-btn r360-btn-primary" to="/requests/new">
                + {language === 'es' ? 'Nueva solicitud' : 'New request'}
              </Link>
            )}
          </div>
        </div>

        <div className="r360-filters">
          <input
            type="search"
            placeholder={language === 'es' ? 'Buscar clave, título o alcance…' : 'Search key, title or scope…'}
            value={filters.q}
            onChange={(event) => applyFilter({ q: event.target.value })}
          />
          <select value={filters.status} onChange={(event) => applyFilter({ status: event.target.value })}>
            <option value="">{language === 'es' ? 'Todos los estados' : 'All statuses'}</option>
            {REQUEST_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <select value={filters.priority} onChange={(event) => applyFilter({ priority: event.target.value })}>
            <option value="">{language === 'es' ? 'Todas las prioridades' : 'All priorities'}</option>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>{priority}</option>
            ))}
          </select>
          <select value={filters.slaState} onChange={(event) => applyFilter({ slaState: event.target.value })}>
            <option value="">{language === 'es' ? 'Todos los SLA' : 'All SLA'}</option>
            <option value="on_track">on_track</option>
            <option value="at_risk">at_risk</option>
            <option value="breached">breached</option>
            <option value="paused">paused</option>
          </select>
          <label className="r360-checkbox">
            <input
              type="checkbox"
              checked={filters.includeClosed}
              onChange={(event) => applyFilter({ includeClosed: event.target.checked })}
            />
            {language === 'es' ? 'Incluir cerradas' : 'Include closed'}
          </label>
        </div>

        <ErrorBanner error={error} />

        {loading ? (
          <Loading lang={language} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="🗂️"
            title={language === 'es' ? 'No hay solicitudes' : 'No requests found'}
            text={language === 'es' ? 'Ajusta los filtros o crea una nueva solicitud.' : 'Adjust the filters or create a new request.'}
          />
        ) : view === 'table' ? (
          <div className="r360-card r360-table-wrap">
            <table className="r360-table">
              <thead>
                <tr>
                  <th>{language === 'es' ? 'Clave' : 'Key'}</th>
                  <th>{language === 'es' ? 'Cliente' : 'Client'}</th>
                  <th>{language === 'es' ? 'Título' : 'Title'}</th>
                  <th>{language === 'es' ? 'Estado' : 'Status'}</th>
                  <th>{language === 'es' ? 'Prioridad' : 'Priority'}</th>
                  <th>{language === 'es' ? 'SLA' : 'SLA'}</th>
                  <th>{language === 'es' ? 'Deadline' : 'Deadline'}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} onClick={() => navigate(`/requests/${item.id}`)} className="r360-clickable-row">
                    <td><span className="r360-mono">{item.requestKey}</span></td>
                    <td>{item.client?.name || '—'}</td>
                    <td>
                      <div className="r360-truncate">{item.title}</div>
                      <div className="r360-muted">{item.requestType}</div>
                    </td>
                    <td><StatusBadge status={item.statusNew} lang={language} /></td>
                    <td>
                      <PriorityBadge priority={item.priority} />
                      <SeverityBadge severity={item.severity} lang={language} />
                    </td>
                    <td><SlaBadge state={item.slaState} lang={language} /></td>
                    <td>{formatDate(item.deadline, language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="r360-board">
            {REQUEST_STATUSES.map((status) => (
              <div key={status} className="r360-board-column">
                <div className="r360-board-column-header">
                  <StatusBadge status={status} lang={language} />
                  <span className="r360-count">{grouped[status]?.length || 0}</span>
                </div>
                <div className="r360-board-column-body">
                  {(grouped[status] || []).map((item) => (
                    <Link to={`/requests/${item.id}`} key={item.id} className="r360-board-card">
                      <div className="r360-board-card-top">
                        <span className="r360-mono">{item.requestKey}</span>
                        <PriorityBadge priority={item.priority} />
                      </div>
                      <div className="r360-board-card-title">{item.title}</div>
                      <div className="r360-muted">{item.client?.name}</div>
                      <div className="r360-board-card-footer">
                        <SlaBadge state={item.slaState} lang={language} />
                        <span>{formatDate(item.deadline, language)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'table' && (
          <div className="r360-pagination">
            <button className="r360-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← {language === 'es' ? 'Anterior' : 'Previous'}
            </button>
            <span>{language === 'es' ? `Página ${page} · ${total} resultados` : `Page ${page} · ${total} results`}</span>
            <button className="r360-btn" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
              {language === 'es' ? 'Siguiente' : 'Next'} →
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
