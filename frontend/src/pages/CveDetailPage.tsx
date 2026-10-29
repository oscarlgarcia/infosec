import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { cveApi } from '../api/cve';
import { clientsApi } from '../api/clients';
import type { Client } from '../types';
import type { CveAdvisory, CveImpact } from '../types/request360';
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

export function CveDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [advisory, setAdvisory] = useState<CveAdvisory | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    title: '',
    severity: 'high',
    cvssScore: '',
    products: '',
    publishedAt: '',
    status: 'draft',
    posture: 'unknown',
    summary: '',
    sourceUrl: '',
  });
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
    try {
      const response = await cveApi.get(id);
      setAdvisory(response);
      setForm({
        title: response.title || '',
        severity: response.severity || 'high',
        cvssScore: response.cvssScore !== undefined ? String(response.cvssScore) : '',
        products: (response.products || []).join(', '),
        publishedAt: response.publishedAt ? String(response.publishedAt).slice(0, 10) : '',
        status: response.status || 'draft',
        posture: response.posture || 'unknown',
        summary: response.summary || '',
        sourceUrl: response.sourceUrl || '',
      });
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    clientsApi.list().then(setClients).catch(() => undefined);
  }, [load]);

  const run = async (action: () => Promise<any>, reload = true) => {
    setBusy(true);
    setError(null);
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
    if (!id) return;
    setSaved(false);
    await run(async () => {
      await cveApi.update(id, {
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
    if (!id || !impactForm.clientId) return;
    await run(async () => {
      await cveApi.upsertImpact(id, {
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
    if (!id || !draftForm.clientId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await cveApi.draft(id, { clientId: draftForm.clientId, tone: draftForm.tone });
      setDraft({ clientId: response.clientId, tone: response.tone, content: response.content, model: response.model });
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <Layout><div className="r360-page"><Loading lang={language} /></div></Layout>;
  }

  if (!advisory) {
    return (
      <Layout>
        <div className="r360-page">
          <ErrorBanner error={error || 'CVE not found'} />
          <button className="r360-btn" onClick={() => navigate('/cve')}>← {language === 'es' ? 'Volver' : 'Back'}</button>
        </div>
      </Layout>
    );
  }

  const impacts: CveImpact[] = advisory.impacts || [];

  return (
    <Layout>
      <div className="r360-page">
        <div className="r360-page-header">
          <div>
            <div className="r360-detail-topline">
              <span className="r360-mono r360-key">{advisory.cveId}</span>
              <SeverityBadge severity={advisory.severity} lang={language} />
              <span className="r360-badge r360-status-new">{advisory.status || 'draft'}</span>
              {advisory.cvssScore !== undefined && <span className="r360-badge r360-severity-high">CVSS {advisory.cvssScore}</span>}
            </div>
            <h1>{advisory.title}</h1>
            <p className="r360-subtitle">
              {language === 'es' ? 'Publicado' : 'Published'} {formatDate(advisory.publishedAt, language)}
              {advisory.products?.length ? ` · ${advisory.products.join(', ')}` : ''}
            </p>
          </div>
          <div className="r360-header-actions">
            <button className="r360-btn" onClick={() => navigate('/cve')}>← CVE</button>
            {canNotify && (
              <button
                className="r360-btn r360-btn-primary"
                disabled={busy}
                onClick={() => run(() => cveApi.notify(advisory._id))}
              >
                ✉️ {language === 'es' ? 'Notificar suscriptores' : 'Notify subscribers'}
              </button>
            )}
            {isAdmin && (
              <button
                className="r360-btn r360-btn-danger"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(language === 'es' ? '¿Eliminar este CVE?' : 'Delete this CVE?')) return;
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

        {canManage && (
          <div className="r360-card r360-section">
            <div className="r360-section-head"><h2>{language === 'es' ? 'Datos del CVE' : 'CVE details'}</h2></div>
            <div className="r360-form-grid">
              <label className="r360-field r360-field-full">
                <span>{language === 'es' ? 'Título' : 'Title'}</span>
                <input value={form.title} onChange={(event) => setForm((c) => ({ ...c, title: event.target.value }))} />
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
              <label className="r360-field">
                <span>Posture</span>
                <select value={form.posture} onChange={(event) => setForm((c) => ({ ...c, posture: event.target.value }))}>
                  {POSTURES.map((posture) => <option key={posture} value={posture}>{posture}</option>)}
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

          {canManage && (
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
                {POSTURES.map((posture) => <option key={posture} value={posture}>{posture}</option>)}
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
            <EmptyState icon="🏢" title={language === 'es' ? 'Sin impactos registrados' : 'No impacts registered'} />
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

        {canManage && (
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
