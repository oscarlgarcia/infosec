import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { dashboardApi } from '../api/dashboard';
import { cveApi } from '../api/cve';
import type { Client360, TechnologyInventoryItem } from '../types/request360';
import {
  EmptyState,
  ErrorBanner,
  Loading,
  PriorityBadge,
  SeverityBadge,
  SlaBadge,
  StatusBadge,
  formatDate,
  formatDateTime,
} from '../components/request360/badges';

type TabKey = 'requests' | 'deliverables' | 'documents' | 'cve' | 'inventory' | 'timeline';

const TABS: Record<TabKey, { es: string; en: string }> = {
  requests: { es: 'Solicitudes', en: 'Requests' },
  deliverables: { es: 'Entregables', en: 'Deliverables' },
  documents: { es: 'Documentos', en: 'Documents' },
  cve: { es: 'CVE', en: 'CVE' },
  inventory: { es: 'Inventario tecnológico', en: 'Technology inventory' },
  timeline: { es: 'Actividad', en: 'Activity' },
};

export function Client360Page() {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<Client360 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('requests');
  const [subscription, setSubscription] = useState<{ enabled: boolean; severityThreshold: string; recipients: string[] } | null>(null);
  const [inventory, setInventory] = useState<TechnologyInventoryItem[]>([]);
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [inventoryNotice, setInventoryNotice] = useState<string | null>(null);

  const canManage = Boolean(user && ['admin', 'manager', 'sme'].includes(user.role));

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await dashboardApi.client(id);
      setData(response);
      cveApi
        .getSubscription(id)
        .then((sub) => setSubscription({ enabled: sub.enabled, severityThreshold: sub.severityThreshold, recipients: sub.recipients }))
        .catch(() => undefined);
      cveApi
        .getTechnologyInventory(id)
        .then((result) => setInventory(result.items))
        .catch(() => undefined);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const updateInventoryItem = (index: number, patch: Partial<TechnologyInventoryItem>) => {
    setInventory((items) => items.map((item, position) => (position === index ? { ...item, ...patch } : item)));
  };

  const addInventoryItem = () => {
    setInventory((items) => [...items, { vendor: '', product: '', version: '', criticality: 'medium' }]);
  };

  const removeInventoryItem = (index: number) => {
    setInventory((items) => items.filter((_, position) => position !== index));
  };

  const saveInventory = async () => {
    if (!id) return;
    setInventoryBusy(true);
    setInventoryNotice(null);
    setError(null);
    try {
      const cleaned = inventory
        .filter((item) => item.vendor?.trim() && item.product?.trim())
        .map((item) => ({ ...item, vendor: item.vendor.trim(), product: item.product.trim() }));
      const response = await cveApi.updateTechnologyInventory(id, cleaned);
      setInventory(response.items);
      setInventoryNotice(
        language === 'es'
          ? `Inventario guardado (${response.items.length} elemento(s)). Recalculando coincidencias en segundo plano.`
          : `Inventory saved (${response.items.length} item(s)). Recomputing matches in the background.`
      );
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setInventoryBusy(false);
    }
  };

  const rematchInventory = async () => {
    if (!id) return;
    setInventoryBusy(true);
    setInventoryNotice(null);
    setError(null);
    try {
      const response = await cveApi.rematchClient(id);
      setInventoryNotice(
        language === 'es'
          ? `Recalculadas ${response.changed} de ${response.scanned} CVEs.`
          : `Recomputed ${response.changed} of ${response.scanned} CVEs.`
      );
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setInventoryBusy(false);
    }
  };

  if (loading) {
    return <Layout><div className="r360-page"><Loading lang={language} /></div></Layout>;
  }

  if (!data) {
    return (
      <Layout>
        <div className="r360-page">
          <ErrorBanner error={error || (language === 'es' ? 'Cliente no encontrado' : 'Client not found')} />
          <button className="r360-btn" onClick={() => navigate('/requests')}>← {language === 'es' ? 'Volver' : 'Back'}</button>
        </div>
      </Layout>
    );
  }

  const client: any = data.client;
  const metrics = data.metrics;

  return (
    <Layout>
      <div className="r360-page">
        <div className="r360-page-header">
          <div>
            <div className="r360-detail-topline">
              <span className="r360-badge r360-status-new">{client.clientType || 'Client'}</span>
              {client.customerStatus && <span className="r360-badge r360-status-working">{client.customerStatus}</span>}
            </div>
            <h1>{client.name}</h1>
            <p className="r360-subtitle">
              {[client.country, client.currentPhase].filter(Boolean).join(' · ') || (language === 'es' ? 'Vista 360 del cliente' : 'Client 360 view')}
            </p>
          </div>
          <div className="r360-header-actions">
            <button className="r360-btn" onClick={() => navigate('/requests')}>← {language === 'es' ? 'Solicitudes' : 'Requests'}</button>
            <Link className="r360-btn r360-btn-primary" to={`/requests/new?clientId=${client._id || client.id}`}>
              + {language === 'es' ? 'Nueva solicitud' : 'New request'}
            </Link>
          </div>
        </div>

        <ErrorBanner error={error} />

        <div className="r360-kpi-grid">
          <Kpi label={language === 'es' ? 'Solicitudes' : 'Requests'} value={metrics.totalRequests} />
          <Kpi label={language === 'es' ? 'Abiertas' : 'Open'} value={metrics.open} tone="info" />
          <Kpi label={language === 'es' ? 'Vencidas' : 'Overdue'} value={metrics.overdue} tone="danger" />
          <Kpi label="SLA breached" value={metrics.breached} tone="danger" />
          <Kpi label={language === 'es' ? 'Entregadas' : 'Delivered'} value={metrics.delivered} tone="success" />
          <Kpi label={language === 'es' ? 'Cerradas' : 'Closed'} value={metrics.closed} />
          <Kpi label={language === 'es' ? 'Resolución media' : 'Avg resolution'} value={`${metrics.avgResolutionDays} d`} />
          <Kpi label={language === 'es' ? 'Reaperturas' : 'Reopens'} value={metrics.reopenCount} />
        </div>

        <div className="r360-card r360-section">
          <div className="r360-section-head">
            <h2>{language === 'es' ? 'Suscripción CVE' : 'CVE subscription'}</h2>
            {subscription ? (
              <span className="r360-muted">
                {subscription.enabled ? (language === 'es' ? 'Activa' : 'Enabled') : (language === 'es' ? 'Inactiva' : 'Disabled')}
                {' · '}
                {subscription.severityThreshold}
                {subscription.recipients?.length ? ` · ${subscription.recipients.join(', ')}` : ''}
              </span>
            ) : (
              <span className="r360-muted">{language === 'es' ? 'Sin configurar' : 'Not configured'}</span>
            )}
          </div>
        </div>

        <div className="r360-tabs">
          {(Object.keys(TABS) as TabKey[]).map((key) => (
            <button key={key} className={`r360-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
              {TABS[key][language]}
              {key === 'requests' && <span className="r360-tab-count">{data.requests.length}</span>}
              {key === 'deliverables' && <span className="r360-tab-count">{data.deliverables.length}</span>}
              {key === 'documents' && <span className="r360-tab-count">{data.documents.length}</span>}
              {key === 'cve' && <span className="r360-tab-count">{data.cveImpacts.length}</span>}
              {key === 'inventory' && <span className="r360-tab-count">{inventory.length}</span>}
            </button>
          ))}
        </div>

        {tab === 'requests' && (
          <div className="r360-card r360-table-wrap">
            {data.requests.length === 0 ? (
              <EmptyState icon="🗂️" title={language === 'es' ? 'Sin solicitudes' : 'No requests'} />
            ) : (
              <table className="r360-table">
                <thead>
                  <tr>
                    <th>{language === 'es' ? 'Clave' : 'Key'}</th>
                    <th>{language === 'es' ? 'Título' : 'Title'}</th>
                    <th>{language === 'es' ? 'Estado' : 'Status'}</th>
                    <th>{language === 'es' ? 'Prioridad' : 'Priority'}</th>
                    <th>SLA</th>
                    <th>Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {data.requests.map((request) => (
                    <tr key={request.id} className="r360-clickable-row" onClick={() => navigate(`/requests/${request.id}`)}>
                      <td><span className="r360-mono">{request.requestKey}</span></td>
                      <td><div className="r360-truncate">{request.title}</div><div className="r360-muted">{request.requestType}</div></td>
                      <td><StatusBadge status={request.statusNew} lang={language} /></td>
                      <td><PriorityBadge priority={request.priority} /><SeverityBadge severity={request.severity} lang={language} /></td>
                      <td><SlaBadge state={request.slaState} lang={language} /></td>
                      <td>{formatDate(request.deadline, language)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'deliverables' && (
          <div className="r360-card r360-section">
            {data.deliverables.length === 0 ? (
              <EmptyState icon="📦" title={language === 'es' ? 'Sin entregables' : 'No deliverables'} />
            ) : (
              <div className="r360-deliverable-list">
                {data.deliverables.map((deliverable: any) => (
                  <div key={deliverable._id} className="r360-deliverable-row">
                    <div>
                      <strong>{deliverable.name}</strong>
                      <div className="r360-muted">{deliverable.type || 'other'} · v{deliverable.version || 1}</div>
                    </div>
                    <span className="r360-badge r360-status-new">{deliverable.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'documents' && (
          <div className="r360-card r360-section">
            {data.documents.length === 0 ? (
              <EmptyState icon="📎" title={language === 'es' ? 'Sin documentos' : 'No documents'} />
            ) : (
              <div className="r360-doc-list">
                {data.documents.map((document: any) => (
                  <div key={document._id} className="r360-doc-row">
                    <div>
                      <strong>{document.originalName || document.filename}</strong>
                      <div className="r360-muted">{document.documentType || 'other'} · {document.visibility || 'internal'}</div>
                    </div>
                    <span className="r360-muted">{formatDate(document.createdAt, language)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'cve' && (
          <div className="r360-card r360-section">
            {data.cveImpacts.length === 0 ? (
              <EmptyState icon="🛡️" title={language === 'es' ? 'Sin impactos CVE' : 'No CVE impacts'} />
            ) : (
              <div className="r360-doc-list">
                {data.cveImpacts.map((impact: any) => (
                  <div key={impact._id} className="r360-doc-row">
                    <div>
                      <strong>{impact.cveId}</strong>
                      <div className="r360-muted">{impact.affected ? (language === 'es' ? 'Afectado' : 'Affected') : (language === 'es' ? 'No afectado' : 'Not affected')} · {impact.posture || '—'}</div>
                    </div>
                    <Link className="r360-btn" to={`/cve/${impact.advisoryId || impact.cveId}`}>{language === 'es' ? 'Ver CVE' : 'View CVE'}</Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'inventory' && (
          <div className="r360-card r360-section">
            <div className="r360-section-head">
              <h2>{language === 'es' ? 'Inventario tecnológico' : 'Technology inventory'}</h2>
              <div className="r360-inline-group">
                {canManage && (
                  <>
                    <button className="r360-btn" disabled={inventoryBusy} onClick={rematchInventory}>
                      ⟳ {language === 'es' ? 'Recalcular coincidencias' : 'Recompute matches'}
                    </button>
                    <button className="r360-btn r360-btn-primary" disabled={inventoryBusy} onClick={saveInventory}>
                      {language === 'es' ? 'Guardar inventario' : 'Save inventory'}
                    </button>
                  </>
                )}
              </div>
            </div>

            <p className="r360-muted">
              {language === 'es'
                ? 'El inventario se cruza con el catálogo CVE (CPE, versión y nombre) para proponer impactos. No crea avisos ni envía correos.'
                : 'The inventory is matched against the CVE catalog (CPE, version and name) to propose impacts. It does not create advisories or send emails.'}
            </p>

            {inventoryNotice && <div className="r360-success">{inventoryNotice}</div>}

            {inventory.length === 0 ? (
              <EmptyState
                icon="🧩"
                title={language === 'es' ? 'Sin inventario' : 'No inventory'}
                text={language === 'es' ? 'Añade proveedor, producto y versión para detectar CVEs aplicables.' : 'Add vendor, product and version to detect applicable CVEs.'}
              />
            ) : (
              <div className="r360-table-wrap">
                <table className="r360-table">
                  <thead>
                    <tr>
                      <th>{language === 'es' ? 'Proveedor' : 'Vendor'}</th>
                      <th>{language === 'es' ? 'Producto' : 'Product'}</th>
                      <th>{language === 'es' ? 'Versión' : 'Version'}</th>
                      <th>CPE</th>
                      <th>{language === 'es' ? 'Criticidad' : 'Criticality'}</th>
                      <th>{language === 'es' ? 'Notas' : 'Notes'}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((item, index) => (
                      <tr key={item._id || index}>
                        <td>
                          <input value={item.vendor} disabled={!canManage} onChange={(event) => updateInventoryItem(index, { vendor: event.target.value })} />
                        </td>
                        <td>
                          <input value={item.product} disabled={!canManage} onChange={(event) => updateInventoryItem(index, { product: event.target.value })} />
                        </td>
                        <td>
                          <input value={item.version || ''} disabled={!canManage} onChange={(event) => updateInventoryItem(index, { version: event.target.value })} />
                        </td>
                        <td>
                          <input className="r360-mono" value={item.cpe || ''} placeholder="cpe:2.3:a:vendor:product:version" disabled={!canManage} onChange={(event) => updateInventoryItem(index, { cpe: event.target.value })} />
                        </td>
                        <td>
                          <select value={item.criticality || 'medium'} disabled={!canManage} onChange={(event) => updateInventoryItem(index, { criticality: event.target.value as any })}>
                            <option value="low">low</option>
                            <option value="medium">medium</option>
                            <option value="high">high</option>
                            <option value="critical">critical</option>
                          </select>
                        </td>
                        <td>
                          <input value={item.notes || ''} disabled={!canManage} onChange={(event) => updateInventoryItem(index, { notes: event.target.value })} />
                        </td>
                        <td>
                          {canManage && (
                            <button className="r360-btn r360-btn-danger" onClick={() => removeInventoryItem(index)}>×</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {canManage && (
              <button className="r360-btn" onClick={addInventoryItem}>
                + {language === 'es' ? 'Añadir elemento' : 'Add item'}
              </button>
            )}
          </div>
        )}

        {tab === 'timeline' && (
          <div className="r360-card r360-section">
            {data.timeline.length === 0 ? (
              <EmptyState icon="🕒" title={language === 'es' ? 'Sin actividad' : 'No activity'} />
            ) : (
              <div className="r360-timeline">
                {data.timeline.map((event) => (
                  <div key={event.id} className="r360-event">
                    <div className="r360-event-dot" />
                    <div className="r360-event-body">
                      <div className="r360-event-head">
                        <strong>{event.type}</strong>
                        <span className="r360-muted">{formatDateTime(event.createdAt, language)}</span>
                        {event.authorName && <span className="r360-muted">· {event.authorName}</span>}
                      </div>
                      {event.body && <div className="r360-event-text">{event.body}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: 'info' | 'danger' | 'success' }) {
  return (
    <div className={`r360-kpi ${tone ? `r360-kpi-${tone}` : ''}`}>
      <div className="r360-kpi-value">{value}</div>
      <div className="r360-kpi-label">{label}</div>
    </div>
  );
}
