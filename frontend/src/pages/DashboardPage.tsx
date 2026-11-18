import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useLanguage } from '../i18n/LanguageContext';
import { dashboardApi } from '../api/dashboard';
import type { GlobalDashboard } from '../types/request360';
import { STATUS_LABELS } from '../types/request360';
import {
  EmptyState,
  ErrorBanner,
  Loading,
  PriorityBadge,
  StatusBadge,
  formatDateTime,
} from '../components/request360/badges';

export function DashboardPage() {
  const { language } = useLanguage();
  const [data, setData] = useState<GlobalDashboard | null>(null);
  const [windowDays, setWindowDays] = useState(90);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dashboardApi.global(windowDays));
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <Layout><div className="r360-page r360-page-scroll"><Loading lang={language} /></div></Layout>;
  }

  if (!data) {
    return <Layout><div className="r360-page r360-page-scroll"><ErrorBanner error={error} /></div></Layout>;
  }

  const maxPipeline = Math.max(1, ...data.pipeline.map((item) => item.count));

  return (
    <Layout>
      <div className="r360-page r360-page-scroll">
        <div className="r360-page-header">
          <div>
            <h1>{language === 'es' ? 'Dashboard InfoSec' : 'InfoSec Dashboard'}</h1>
            <p className="r360-subtitle">
              {language === 'es' ? 'Estado global de solicitudes, SLA y carga del equipo.' : 'Global request, SLA and team workload overview.'}
            </p>
          </div>
          <div className="r360-header-actions">
            <select value={windowDays} onChange={(event) => setWindowDays(Number(event.target.value))}>
              <option value={30}>30 {language === 'es' ? 'días' : 'days'}</option>
              <option value={90}>90 {language === 'es' ? 'días' : 'days'}</option>
              <option value={180}>180 {language === 'es' ? 'días' : 'days'}</option>
              <option value={365}>365 {language === 'es' ? 'días' : 'days'}</option>
            </select>
            <Link className="r360-btn r360-btn-primary" to="/requests/new">+ {language === 'es' ? 'Nueva solicitud' : 'New request'}</Link>
          </div>
        </div>

        <ErrorBanner error={error} />

        <div className="r360-kpi-grid">
          <Kpi label={language === 'es' ? 'Solicitudes' : 'Requests'} value={data.totals.requests} />
          <Kpi label={language === 'es' ? 'Abiertas' : 'Open'} value={data.totals.open} tone="info" />
          <Kpi label={language === 'es' ? 'Vencidas' : 'Overdue'} value={data.totals.overdue} tone="danger" />
          <Kpi label="SLA at risk" value={data.sla.atRisk} tone="warning" />
          <Kpi label="SLA breached" value={data.sla.breached} tone="danger" />
          <Kpi label={language === 'es' ? 'Cumplimiento SLA' : 'SLA compliance'} value={`${data.sla.compliancePct}%`} tone="success" />
          <Kpi label={language === 'es' ? '1ª respuesta' : 'First response'} value={`${data.sla.firstResponseAvgHours} h`} />
          <Kpi label={language === 'es' ? 'Resolución media' : 'Avg resolution'} value={`${data.sla.resolutionAvgDays} d`} />
          <Kpi label={language === 'es' ? 'Entregadas' : 'Delivered'} value={data.totals.delivered} tone="success" />
          <Kpi label={language === 'es' ? 'Reaperturas' : 'Reopened'} value={data.totals.reopened} tone="warning" />
          <Kpi label="CVE" value={data.cve.affectedClients} tone="danger" />
        </div>

        <div className="r360-dashboard-grid">
          <div className="r360-card r360-section r360-span-2">
            <div className="r360-section-head">
              <h2>{language === 'es' ? 'Pipeline' : 'Pipeline'}</h2>
              <span className="r360-muted">{data.pipeline.reduce((sum, item) => sum + item.count, 0)} {language === 'es' ? 'solicitudes' : 'requests'}</span>
            </div>
            <div className="r360-bar-list">
              {data.pipeline.map((item) => (
                <div key={item.status} className="r360-bar-row">
                  <StatusBadge status={item.status} lang={language} />
                  <div className="r360-bar-track">
                    <div className="r360-bar-fill" style={{ width: `${(item.count / maxPipeline) * 100}%` }} />
                  </div>
                  <span className="r360-bar-value">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="r360-card r360-section">
            <div className="r360-section-head"><h2>{language === 'es' ? 'Antigüedad' : 'Aging'}</h2></div>
            <div className="r360-bar-list">
              {data.aging.map((bucket) => {
                const max = Math.max(1, ...data.aging.map((item) => item.count));
                return (
                  <div key={bucket.bucket} className="r360-bar-row">
                    <span className="r360-muted r360-bar-label">{bucket.bucket} d</span>
                    <div className="r360-bar-track">
                      <div className="r360-bar-fill r360-bar-warning" style={{ width: `${(bucket.count / max) * 100}%` }} />
                    </div>
                    <span className="r360-bar-value">{bucket.count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="r360-card r360-section">
            <div className="r360-section-head"><h2>{language === 'es' ? 'Por prioridad' : 'By priority'}</h2></div>
            <div className="r360-chip-list">
              {data.byPriority.map((item) => (
                <div key={item.priority} className="r360-chip-row">
                  <PriorityBadge priority={item.priority} />
                  <span>{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="r360-card r360-section">
            <div className="r360-section-head"><h2>{language === 'es' ? 'Por tipo' : 'By type'}</h2></div>
            <div className="r360-chip-list">
              {data.byType.slice(0, 8).map((item) => (
                <div key={item.type} className="r360-chip-row">
                  <span className="r360-truncate">{item.type}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="r360-card r360-section r360-span-2">
            <div className="r360-section-head"><h2>{language === 'es' ? 'Top clientes' : 'Top clients'}</h2></div>
            {data.topClients.length === 0 ? (
              <EmptyState icon="🏢" title={language === 'es' ? 'Sin datos' : 'No data'} />
            ) : (
              <table className="r360-table">
                <thead>
                  <tr>
                    <th>{language === 'es' ? 'Cliente' : 'Client'}</th>
                    <th>{language === 'es' ? 'Total' : 'Total'}</th>
                    <th>{language === 'es' ? 'Abiertas' : 'Open'}</th>
                    <th>SLA breached</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topClients.map((client) => (
                    <tr key={client.clientId} className="r360-clickable-row">
                      <td><Link className="r360-link" to={`/clients/${client.clientId}`}>{client.name}</Link></td>
                      <td>{client.total}</td>
                      <td>{client.open ?? 0}</td>
                      <td>{client.breached ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="r360-card r360-section">
            <div className="r360-section-head"><h2>{language === 'es' ? 'Carga del equipo' : 'Team workload'}</h2></div>
            {data.workload.length === 0 ? (
              <EmptyState icon="👥" title={language === 'es' ? 'Sin asignaciones' : 'No assignments'} />
            ) : (
              <div className="r360-chip-list">
                {data.workload.map((entry) => (
                  <div key={entry.userId} className="r360-chip-row">
                    <span className="r360-truncate">{entry.name}</span>
                    <span>{entry.open} · {entry.overdue} ⚠</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="r360-card r360-section r360-span-2">
            <div className="r360-section-head"><h2>{language === 'es' ? 'Actividad reciente' : 'Recent activity'}</h2></div>
            {data.recentActivity.length === 0 ? (
              <EmptyState icon="🕒" title={language === 'es' ? 'Sin actividad' : 'No activity'} />
            ) : (
              <div className="r360-timeline">
                {data.recentActivity.slice(0, 12).map((event) => (
                  <div key={event.id} className="r360-event">
                    <div className="r360-event-dot" />
                    <div className="r360-event-body">
                      <div className="r360-event-head">
                        <strong>{event.type}</strong>
                        <span className="r360-muted">{STATUS_LABELS[event.toStatus as keyof typeof STATUS_LABELS]?.[language] || ''}</span>
                        <span className="r360-muted">{formatDateTime(event.createdAt, language)}</span>
                        {event.authorName && <span className="r360-muted">· {event.authorName}</span>}
                      </div>
                      {event.body && <div className="r360-event-text r360-truncate">{event.body}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: 'info' | 'danger' | 'success' | 'warning' }) {
  return (
    <div className={`r360-kpi ${tone ? `r360-kpi-${tone}` : ''}`}>
      <div className="r360-kpi-value">{value}</div>
      <div className="r360-kpi-label">{label}</div>
    </div>
  );
}
