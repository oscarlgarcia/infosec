import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { cveApi } from '../api/cve';
import { clientsApi } from '../api/clients';
import type { Client } from '../types';
import type { CveAdvisory, CveCpe, CveImpact, CveRecord } from '../types/request360';
import { SEVERITIES } from '../types/request360';
import {
  EmptyState,
  ErrorBanner,
  Loading,
  SeverityBadge,
  formatDate,
  formatDateTime,
} from '../components/request360/badges';

const POSTURES = ['not_affected', 'affected', 'under_review', 'mitigated', 'unknown'];

function emptyForm() {
  return {
    title: '',
    severity: 'high',
    cvssScore: '',
    products: '',
    publishedAt: '',
    status: 'draft',
    posture: 'unknown',
    summary: '',
    sourceUrl: '',
  };
}

function formFromAdvisory(advisory: CveAdvisory) {
  return {
    title: advisory.title || '',
    severity: advisory.severity || 'high',
    cvssScore: advisory.cvssScore !== undefined ? String(advisory.cvssScore) : '',
    products: (advisory.products || []).join(', '),
    publishedAt: advisory.publishedAt ? String(advisory.publishedAt).slice(0, 10) : '',
    status: advisory.status || 'draft',
    posture: advisory.posture || 'unknown',
    summary: advisory.summary || '',
    sourceUrl: advisory.sourceUrl || '',
  };
}

function cpeRange(cpe: CveCpe): string {
  if (cpe.versionStartIncluding || cpe.versionStartExcluding || cpe.versionEndIncluding || cpe.versionEndExcluding) {
    const start = cpe.versionStartIncluding
      ? `>= ${cpe.versionStartIncluding}`
      : cpe.versionStartExcluding
        ? `> ${cpe.versionStartExcluding}`
        : '';
    const end = cpe.versionEndIncluding
      ? `<= ${cpe.versionEndIncluding}`
      : cpe.versionEndExcluding
        ? `< ${cpe.versionEndExcluding}`
        : '';
    return [start, end].filter(Boolean).join(' · ');
  }
  return cpe.version || '*';
}

export function CveDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [advisory, setAdvisory] = useState<CveAdvisory | null>(null);
  const [record, setRecord] = useState<CveRecord | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [impactForm, setImpactForm] = useState({
    clientId: '',
    affected: false,
    posture: 'unknown',
    rationale: '',
    communicate: false,
  });
  const [draft, setDraft] = useState<{ clientId: string; tone: string; content: string; model: string } | null>(null);
  const [draftForm, setDraftForm] = useState({ clientId: '', tone: 'professional' });

  const canManage = Boolean(user && ['admin', 'manager', 'sme'].includes(user.role));
  const canNotify = Boolean(user && ['admin', 'manager'].includes(user.role));
  const isAdmin = user?.role === 'admin';

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setSaved(false);
    setAdvisory(null);
    setRecord(null);
    try {
      if (/^CVE-/i.test(id)) {
        const catalogRecord = await cveApi.catalogRecord(id);
        setRecord(catalogRecord);
        if (catalogRecord.advisory) {
          const linked: CveAdvisory = { ...catalogRecord.advisory, impacts: catalogRecord.impacts || [] };
          setAdvisory(linked);
          setForm(formFromAdvisory(linked));
        } else {
          await loadLooseAdvisory(catalogRecord.cveId);
        }
      } else {
        const response = await cveApi.get(id);
        setAdvisory(response);
        setForm(formFromAdvisory(response));
        const recordKey = response.cveRecordId || (/^CVE-/i.test(response.cveId) ? response.cveId : null);
        if (recordKey) {
          cveApi.catalogRecord(recordKey).then(setRecord).catch(() => undefined);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }

    async function loadLooseAdvisory(cveId: string) {
      try {
        const response = await cveApi.get(cveId);
        setAdvisory(response);
        setForm(formFromAdvisory(response));
      } catch {
        setAdvisory(null);
        setForm(emptyForm());
      }
    }
  }, [id]);

  useEffect(() => {
    load();
    clientsApi.list().then(setClients).catch(() => undefined);
  }, [load]);

  const run = async (action: () => Promise<any>, reload = true) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      if (reload) await load();
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!advisory) return;
    setSaved(false);
    await run(async () => {
      await cveApi.update(advisory._id, {
        title: form.title,
        severity: form.severity,
        cvssScore: form.cvssScore ? Number(form.cvssScore) : undefined,
        products: form.products ? form.products.split(',').map((item) => item.trim()).filter(Boolean) : [],
        publishedAt: form.publishedAt || undefined,
        status: form.status,
        posture: form.posture,
        summary: form.summary || undefined,
        sourceUrl: form.sourceUrl || undefined,
      });
      setSaved(true);
    });
  };

  const addImpact = async () => {
    if (!advisory || !impactForm.clientId) return;
    await run(async () => {
      await cveApi.upsertImpact(advisory._id, {
        clientId: impactForm.clientId,
        affected: impactForm.affected,
        posture: impactForm.posture,
        rationale: impactForm.rationale || undefined,
        communicate: impactForm.communicate,
      });
      setImpactForm({ clientId: '', affected: false, posture: 'unknown', rationale: '', communicate: false });
    });
  };

  const generateDraft = async () => {
    if (!advisory || !draftForm.clientId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await cveApi.draft(advisory._id, { clientId: draftForm.clientId, tone: draftForm.tone });
      setDraft({ clientId: response.clientId, tone: response.tone, content: response.content, model: response.model });
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  const promote = async () => {
    if (!record) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await cveApi.promote(record.cveId);
      setNotice(
        language === 'es'
          ? `Aviso ${result.created ? 'creado' : 'existente'} con ${result.impacts} impacto(s) auto-detectado(s).`
          : `Advisory ${result.created ? 'created' : 'found'} with ${result.impacts} auto-detected impact(s).`
      );
      navigate(`/cve/${result.advisory._id}`);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  const rematch = async () => {
    if (!record) return;
    await run(async () => {
      const response = await cveApi.rematchRecord(record.cveId);
      setRecord((current) => (current ? { ...current, matches: response.items } : current));
      setNotice(
        language === 'es'
          ? `Recalculadas ${response.items.length} coincidencia(s).`
          : `Recomputed ${response.items.length} match(es).`
      );
    }, false);
  };

  if (loading) {
    return <Layout><div className="r360-page r360-page-scroll"><Loading lang={language} /></div></Layout>;
  }

  if (!advisory && !record) {
    return (
      <Layout>
        <div className="r360-page r360-page-scroll">
          <ErrorBanner error={error || 'CVE not found'} />
          <button className="r360-btn" onClick={() => navigate('/cve')}>← {language === 'es' ? 'Volver' : 'Back'}</button>
        </div>
      </Layout>
    );
  }

  const cveId = record?.cveId || advisory?.cveId || '';
  const severity = record?.severity || advisory?.severity || 'medium';
  const title = advisory?.title || record?.title || cveId;
  const cvssScore = advisory?.cvssScore ?? record?.cvssScore;
  const publishedAt = advisory?.publishedAt || record?.publishedAt;
  const products = advisory?.products?.length ? advisory.products : record?.products || [];
  const impacts: CveImpact[] = advisory?.impacts || record?.impacts || [];
  const matches = record?.matches || [];

  return (
    <Layout>
      <div className="r360-page r360-page-scroll">
        <div className="r360-page-header">
          <div>
            <div className="r360-detail-topline">
              <span className="r360-mono r360-key">{cveId}</span>
              <SeverityBadge severity={severity} lang={language} />
              {record?.kev?.listed && <span className="r360-badge r360-severity-critical">KEV</span>}
              {/known/i.test(record?.kev?.knownRansomwareCampaignUse || '') && (
                <span className="r360-badge r360-severity-high">Ransomware</span>
              )}
              {advisory && <span className="r360-badge r360-status-new">{advisory.status || 'draft'}</span>}
              {cvssScore !== undefined && <span className="r360-badge r360-severity-high">CVSS {cvssScore}</span>}
              {!advisory && <span className="r360-badge r360-status-closed">{language === 'es' ? 'Sin aviso' : 'No advisory'}</span>}
            </div>
            <h1>{title}</h1>
            <p className="r360-subtitle">
              {language === 'es' ? 'Publicado' : 'Published'} {formatDate(publishedAt, language)}
              {products.length ? ` · ${products.slice(0, 4).join(', ')}` : ''}
            </p>
          </div>
          <div className="r360-header-actions">
            <button className="r360-btn" onClick={() => navigate('/cve')}>← CVE</button>
            {!advisory && canManage && (
              <button className="r360-btn r360-btn-primary" disabled={busy} onClick={promote}>
                + {language === 'es' ? 'Crear aviso' : 'Create advisory'}
              </button>
            )}
            {advisory && canNotify && (
              <button
                className="r360-btn r360-btn-primary"
                disabled={busy}
                onClick={() => run(() => cveApi.notify(advisory._id))}
              >
                ✉️ {language === 'es' ? 'Notificar suscriptores' : 'Notify subscribers'}
              </button>
            )}
            {advisory && isAdmin && (
              <button
                className="r360-btn r360-btn-danger"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(language === 'es' ? '¿Eliminar este aviso?' : 'Delete this advisory?')) return;
                  run(async () => {
                    await cveApi.remove(advisory._id);
                    navigate('/cve');
                  }, false);
                }}
              >
                {language === 'es' ? 'Eliminar' : 'Delete'}
              </button>
            )}
          </div>
        </div>

        <ErrorBanner error={error} />
        {saved && <div className="r360-success">{language === 'es' ? 'Cambios guardados' : 'Changes saved'}</div>}
        {notice && <div className="r360-success">{notice}</div>}

        {record && (
          <div className="r360-card r360-section">
            <div className="r360-section-head">
              <h2>{language === 'es' ? 'Datos de la fuente (NVD / CISA KEV)' : 'Source data (NVD / CISA KEV)'}</h2>
              <div className="r360-inline-group">
                {(record.source || []).map((source) => (
                  <span key={source} className="r360-badge r360-status-new">{source.toUpperCase()}</span>
                ))}
                {record.nvdStatus && <span className="r360-badge r360-status-closed">{record.nvdStatus}</span>}
              </div>
            </div>

            <div className="r360-info-grid">
              <Info label="CVSS" value={cvssScore !== undefined ? `${cvssScore}${record.cvssVersion ? ` (v${record.cvssVersion})` : ''}` : '—'} />
              <Info label="CWE" value={record.cwe?.length ? record.cwe.join(', ') : '—'} />
              <Info label={language === 'es' ? 'Proveedores' : 'Vendors'} value={record.vendors?.length ? record.vendors.join(', ') : '—'} />
              <Info label={language === 'es' ? 'Publicado' : 'Published'} value={formatDate(record.publishedAt, language)} />
              <Info label={language === 'es' ? 'Última modificación' : 'Last modified'} value={formatDate(record.lastModified, language)} />
              <Info label={language === 'es' ? 'Última sincronización' : 'Last sync'} value={formatDateTime(record.lastSyncedAt, language)} />
              {record.cvssVector && <Info label="Vector" value={record.cvssVector} mono full />}
            </div>

            {(record.summary || record.summaryEs) && (
              <p className="r360-source-summary">{language === 'es' ? record.summaryEs || record.summary : record.summary}</p>
            )}

            {record.kev?.listed && (
              <div className="r360-source-block">
                <h3>{language === 'es' ? 'CISA KEV' : 'CISA KEV'}</h3>
                <div className="r360-info-grid">
                  <Info label={language === 'es' ? 'Añadido' : 'Added'} value={formatDate(record.kev.dateAdded, language)} />
                  <Info label={language === 'es' ? 'Acción antes de' : 'Action due'} value={formatDate(record.kev.dueDate, language)} />
                  <Info label="Ransomware" value={record.kev.knownRansomwareCampaignUse || '—'} />
                  <Info label={language === 'es' ? 'Producto' : 'Product'} value={[record.kev.vendorProject, record.kev.product].filter(Boolean).join(' ') || '—'} />
                  {record.kev.requiredAction && <Info label={language === 'es' ? 'Acción requerida' : 'Required action'} value={record.kev.requiredAction} full />}
                  {record.kev.notes && <Info label="Notes" value={record.kev.notes} full />}
                </div>
              </div>
            )}

            <div className="r360-source-block">
              <h3>
                {language === 'es' ? 'CPEs afectados' : 'Affected CPEs'}{' '}
                <span className="r360-muted">({record.cpes?.length || 0})</span>
              </h3>
              {!record.cpes?.length ? (
                <p className="r360-muted">{language === 'es' ? 'Sin CPEs publicados.' : 'No CPEs published.'}</p>
              ) : (
                <div className="r360-table-wrap">
                  <table className="r360-table">
                    <thead>
                      <tr>
                        <th>{language === 'es' ? 'Proveedor' : 'Vendor'}</th>
                        <th>{language === 'es' ? 'Producto' : 'Product'}</th>
                        <th>{language === 'es' ? 'Rango' : 'Range'}</th>
                        <th>CPE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.cpes.map((cpe) => (
                        <tr key={`${cpe.criteria}-${cpe.versionStartIncluding || ''}-${cpe.versionEndExcluding || ''}`}>
                          <td>{cpe.vendor}</td>
                          <td>{cpe.product}</td>
                          <td><span className="r360-mono">{cpeRange(cpe)}</span></td>
                          <td><span className="r360-mono r360-muted">{cpe.criteria}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {record.references?.length > 0 && (
              <div className="r360-source-block">
                <h3>{language === 'es' ? 'Referencias' : 'References'}</h3>
                <ul className="r360-ref-list">
                  {record.references.map((reference) => (
                    <li key={reference}>
                      <a className="r360-link" href={reference} target="_blank" rel="noreferrer">{reference}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {record.sourceUrl && (
              <p className="r360-muted">
                <a className="r360-link" href={record.sourceUrl} target="_blank" rel="noreferrer">
                  {language === 'es' ? 'Ver ficha original' : 'View source record'} ↗
                </a>
              </p>
            )}
          </div>
        )}

        {record && (
          <div className="r360-card r360-section">
            <div className="r360-section-head">
              <h2>{language === 'es' ? 'Coincidencias con clientes' : 'Client matches'}</h2>
              <div className="r360-inline-group">
                <span className="r360-muted">{matches.length}</span>
                {canManage && (
                  <button className="r360-btn" disabled={busy} onClick={rematch}>
                    ⟳ {language === 'es' ? 'Recalcular' : 'Recompute'}
                  </button>
                )}
              </div>
            </div>

            {matches.length === 0 ? (
              <EmptyState
                icon="🔍"
                title={language === 'es' ? 'Sin coincidencias' : 'No matches'}
                text={language === 'es' ? 'Añade inventario tecnológico al cliente para detectar impacto.' : 'Add a client technology inventory to detect impact.'}
              />
            ) : (
              <div className="r360-doc-list">
                {matches.map((match, index) => {
                  const client: any = match.clientId;
                  const name = client && typeof client === 'object' ? client.name : null;
                  const clientKey = client && typeof client === 'object' ? client._id : client;
                  return (
                    <div key={`${clientKey || name || index}`} className="r360-doc-row">
                      <div>
                        <strong>{name || String(clientKey || '—')}</strong>
                        <div className="r360-muted">{match.reasons?.join(' · ')}</div>
                      </div>
                      <div className="r360-inline-group">
                        <span className="r360-badge r360-status-new">{Math.round((match.confidence || 0) * 100)}%</span>
                        {clientKey && <Link className="r360-btn" to={`/clients/${clientKey}`}>{language === 'es' ? 'Ver cliente' : 'View client'}</Link>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {advisory && canManage && (
          <div className="r360-card r360-section">
            <div className="r360-section-head"><h2>{language === 'es' ? 'Datos del aviso' : 'Advisory details'}</h2></div>
            <div className="r360-form-grid">
              <label className="r360-field r360-field-full">
                <span>{language === 'es' ? 'Título' : 'Title'}</span>
                <input value={form.title} onChange={(event) => setForm((c) => ({ ...c, title: event.target.value }))} />
              </label>
              <label className="r360-field">
                <span>{language === 'es' ? 'Severidad' : 'Severity'}</span>
                <select value={form.severity} onChange={(event) => setForm((c) => ({ ...c, severity: event.target.value }))}>
                  {SEVERITIES.map((item) => <option key={item} value={item}>{item}</option>)}
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
              <label className="r360-field">
                <span>Posture</span>
                <select value={form.posture} onChange={(event) => setForm((c) => ({ ...c, posture: event.target.value }))}>
                  {POSTURES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="r360-field">
                <span>{language === 'es' ? 'Publicado' : 'Published'}</span>
                <input type="date" value={form.publishedAt} onChange={(event) => setForm((c) => ({ ...c, publishedAt: event.target.value }))} />
              </label>
              <label className="r360-field">
                <span>{language === 'es' ? 'Productos (coma)' : 'Products (comma)'}</span>
                <input value={form.products} onChange={(event) => setForm((c) => ({ ...c, products: event.target.value }))} />
              </label>
              <label className="r360-field r360-field-full">
                <span>Source URL</span>
                <input value={form.sourceUrl} onChange={(event) => setForm((c) => ({ ...c, sourceUrl: event.target.value }))} />
              </label>
              <label className="r360-field r360-field-full">
                <span>{language === 'es' ? 'Resumen' : 'Summary'}</span>
                <textarea rows={4} value={form.summary} onChange={(event) => setForm((c) => ({ ...c, summary: event.target.value }))} />
              </label>
              <div className="r360-inline-group r360-field-full">
                <button className="r360-btn r360-btn-primary" disabled={busy} onClick={save}>{language === 'es' ? 'Guardar' : 'Save'}</button>
              </div>
            </div>
          </div>
        )}

        <div className="r360-card r360-section">
          <div className="r360-section-head">
            <h2>{language === 'es' ? 'Impactos por cliente' : 'Client impacts'}</h2>
            <span className="r360-muted">{impacts.length}</span>
          </div>

          {advisory && canManage && (
            <div className="r360-inline-group r360-create-row">
              <select value={impactForm.clientId} onChange={(event) => setImpactForm((c) => ({ ...c, clientId: event.target.value }))}>
                <option value="">{language === 'es' ? 'Selecciona cliente' : 'Select client'}</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
              <label className="r360-checkbox">
                <input type="checkbox" checked={impactForm.affected} onChange={(event) => setImpactForm((c) => ({ ...c, affected: event.target.checked }))} />
                {language === 'es' ? 'Afectado' : 'Affected'}
              </label>
              <select value={impactForm.posture} onChange={(event) => setImpactForm((c) => ({ ...c, posture: event.target.value }))}>
                {POSTURES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <input
                placeholder={language === 'es' ? 'Razonamiento' : 'Rationale'}
                value={impactForm.rationale}
                onChange={(event) => setImpactForm((c) => ({ ...c, rationale: event.target.value }))}
              />
              <label className="r360-checkbox">
                <input type="checkbox" checked={impactForm.communicate} onChange={(event) => setImpactForm((c) => ({ ...c, communicate: event.target.checked }))} />
                {language === 'es' ? 'Comunicar' : 'Communicate'}
              </label>
              <button className="r360-btn r360-btn-primary" disabled={busy || !impactForm.clientId} onClick={addImpact}>
                + {language === 'es' ? 'Añadir' : 'Add'}
              </button>
            </div>
          )}

          {impacts.length === 0 ? (
            <EmptyState
              icon="🏢"
              title={language === 'es' ? 'Sin impactos registrados' : 'No impacts registered'}
              text={advisory ? undefined : (language === 'es' ? 'Crea un aviso para materializar los impactos auto-detectados.' : 'Create an advisory to materialize auto-detected impacts.')}
            />
          ) : (
            <div className="r360-doc-list">
              {impacts.map((impact) => {
                const client: any = impact.clientId;
                return (
                  <div key={impact._id} className="r360-doc-row">
                    <div>
                      <strong>{client?.name || String(impact.clientId)}</strong>
                      <div className="r360-muted">
                        {impact.affected ? (language === 'es' ? 'Afectado' : 'Affected') : (language === 'es' ? 'No afectado' : 'Not affected')}
                        {' · '}
                        {impact.posture || 'unknown'}
                        {impact.rationale ? ` · ${impact.rationale}` : ''}
                      </div>
                    </div>
                    <div className="r360-inline-group">
                      {impact.communicatedAt && (
                        <span className="r360-muted">{language === 'es' ? 'Comunicado' : 'Communicated'} {formatDateTime(impact.communicatedAt, language)}</span>
                      )}
                      {client?._id && <Link className="r360-btn" to={`/clients/${client._id}`}>{language === 'es' ? 'Ver cliente' : 'View client'}</Link>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {advisory && canManage && (
          <div className="r360-card r360-section">
            <div className="r360-section-head"><h2>{language === 'es' ? 'Borrador de comunicación IA' : 'AI communication draft'}</h2></div>
            <div className="r360-inline-group r360-create-row">
              <select value={draftForm.clientId} onChange={(event) => setDraftForm((c) => ({ ...c, clientId: event.target.value }))}>
                <option value="">{language === 'es' ? 'Selecciona cliente' : 'Select client'}</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
              <select value={draftForm.tone} onChange={(event) => setDraftForm((c) => ({ ...c, tone: event.target.value }))}>
                <option value="professional">professional</option>
                <option value="technical">technical</option>
                <option value="executive">executive</option>
              </select>
              <button className="r360-btn r360-btn-primary" disabled={busy || !draftForm.clientId} onClick={generateDraft}>
                ✨ {language === 'es' ? 'Generar borrador' : 'Generate draft'}
              </button>
            </div>
            {draft && (
              <div className="r360-artifact">
                <div className="r360-artifact-head">
                  <strong>{draft.tone}</strong>
                  <span className="r360-muted">{draft.model}</span>
                </div>
                <pre className="r360-artifact-body">{draft.content}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function Info({ label, value, mono, full }: { label: string; value?: string; mono?: boolean; full?: boolean }) {
  return (
    <div className={`r360-info ${full ? 'r360-info-full' : ''}`}>
      <div className="r360-info-label">{label}</div>
      <div className={`r360-info-value ${mono ? 'r360-mono' : ''}`}>{value || '—'}</div>
    </div>
  );
}
