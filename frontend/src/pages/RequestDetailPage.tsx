import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { requestsApi } from '../api/requests';
import type {
  AiArtifact,
  Deliverable,
  Request360Detail,
  RequestDocument,
  RequestEvent,
  RequestThread,
} from '../types/request360';
import { EVENT_TYPE_LABELS, REQUEST_STATUSES, STATUS_LABELS } from '../types/request360';
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

type TabKey = 'logbook' | 'threads' | 'documents' | 'deliverables' | 'sla' | 'ai';

const TAB_LABELS: Record<TabKey, { es: string; en: string }> = {
  logbook: { es: 'Logbook', en: 'Logbook' },
  threads: { es: 'Hilos', en: 'Threads' },
  documents: { es: 'Documentos', en: 'Documents' },
  deliverables: { es: 'Entregables', en: 'Deliverables' },
  sla: { es: 'SLA', en: 'SLA' },
  ai: { es: 'IA', en: 'AI' },
};

const VISIBILITY_LABELS: Record<string, { es: string; en: string }> = {
  internal: { es: 'Interno', en: 'Internal' },
  client: { es: 'Cliente', en: 'Client' },
  public: { es: 'Público', en: 'Public' },
};

const DELIVERABLE_STATUS_LABELS: Record<string, { es: string; en: string }> = {
  draft: { es: 'Borrador', en: 'Draft' },
  in_review: { es: 'En revisión', en: 'In review' },
  approved: { es: 'Aprobado', en: 'Approved' },
  sent: { es: 'Enviado', en: 'Sent' },
  accepted: { es: 'Aceptado', en: 'Accepted' },
  rejected: { es: 'Rechazado', en: 'Rejected' },
};

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<Request360Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('logbook');
  const [busy, setBusy] = useState(false);

  const [composer, setComposer] = useState({ body: '', visibility: 'internal', threadId: '', type: 'comment' });
  const [newThread, setNewThread] = useState({ title: '', type: 'question', description: '', parentThreadId: '' });
  const [newDeliverable, setNewDeliverable] = useState({ name: '', type: 'report', description: '' });
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [transition, setTransition] = useState({ status: '', reason: '' });
  const [artifacts, setArtifacts] = useState<AiArtifact[]>([]);
  const [editingArtifact, setEditingArtifact] = useState<{ id: string; content: string } | null>(null);

  const canManage = Boolean(user && ['admin', 'manager', 'sme'].includes(user.role));
  const canDelete = Boolean(user && ['admin', 'manager'].includes(user.role));

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await requestsApi.get360(id);
      setDetail(data);
      setTransition((current) => ({ ...current, status: current.status || data.request.statusNew }));
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const loadArtifacts = useCallback(async () => {
    if (!id) return;
    try {
      const response = await requestsApi.listAiArtifacts(id);
      setArtifacts(response.items);
    } catch {
      // AI is optional; ignore failures (e.g. LLM not configured)
    }
  }, [id]);

  useEffect(() => {
    if (tab === 'ai') loadArtifacts();
  }, [tab, loadArtifacts]);

  const threadMap = useMemo(() => {
    const map = new Map<string, { thread: RequestThread; depth: number }>();
    const list = detail?.threads || [];
    const byParent = new Map<string | undefined, RequestThread[]>();
    for (const thread of list) {
      const key = thread.parentThreadId || undefined;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(thread);
    }
    const walk = (parent: string | undefined, depth: number) => {
      for (const thread of byParent.get(parent) || []) {
        map.set(thread.id, { thread, depth });
        walk(thread.id, depth + 1);
      }
    };
    walk(undefined, 0);
    for (const thread of list) if (!map.has(thread.id)) map.set(thread.id, { thread, depth: 0 });
    return map;
  }, [detail?.threads]);

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

  const submitComposer = async () => {
    if (!id || !composer.body.trim()) return;
    await run(async () => {
      await requestsApi.addEvent(id, {
        type: composer.type,
        visibility: composer.visibility,
        body: composer.body,
        threadId: composer.threadId || undefined,
      });
      setComposer((current) => ({ ...current, body: '' }));
    });
  };

  const submitTransition = async () => {
    if (!id || !transition.status) return;
    await run(() => requestsApi.transition(id, transition.status, transition.reason || undefined));
  };

  const upload = async () => {
    if (!id || uploadFiles.length === 0) return;
    await run(async () => {
      await requestsApi.uploadDocuments(id, uploadFiles, uploadFiles.map(() => ({ documentType: 'other', visibility: 'internal' })));
      setUploadFiles([]);
    });
  };

  const createThread = async () => {
    if (!id || !newThread.title.trim()) return;
    await run(async () => {
      await requestsApi.createThread(id, {
        title: newThread.title,
        type: newThread.type,
        description: newThread.description || undefined,
        parentThreadId: newThread.parentThreadId || undefined,
      });
      setNewThread({ title: '', type: 'question', description: '', parentThreadId: '' });
    });
  };

  const createDeliverable = async () => {
    if (!id || !newDeliverable.name.trim()) return;
    await run(async () => {
      await requestsApi.createDeliverable(id, {
        name: newDeliverable.name,
        type: newDeliverable.type,
        description: newDeliverable.description || undefined,
      });
      setNewDeliverable({ name: '', type: 'report', description: '' });
    });
  };

  const generate = async (kind: 'summary' | 'followup' | 'minutes') => {
    if (!id) return;
    await run(async () => {
      if (kind === 'summary') await requestsApi.generateSummary(id);
      if (kind === 'followup') await requestsApi.generateFollowupDraft(id);
      if (kind === 'minutes') await requestsApi.generateMeetingMinutes(id);
      await loadArtifacts();
    }, false);
  };

  if (loading) {
    return (
      <Layout>
        <div className="r360-page"><Loading lang={language} /></div>
      </Layout>
    );
  }

  if (!detail) {
    return (
      <Layout>
        <div className="r360-page">
          <ErrorBanner error={error || (language === 'es' ? 'Solicitud no encontrada' : 'Request not found')} />
          <button className="r360-btn" onClick={() => navigate('/requests')}>← {language === 'es' ? 'Volver' : 'Back'}</button>
        </div>
      </Layout>
    );
  }

  const request = detail.request;
  const counts = detail.counts;

  const tabs: Array<{ key: TabKey; count?: number }> = [
    { key: 'logbook', count: counts?.events },
    { key: 'threads', count: counts?.threads },
    { key: 'documents', count: counts?.documents },
    { key: 'deliverables', count: counts?.deliverables },
    { key: 'sla' },
    { key: 'ai' },
  ];

  return (
    <Layout>
      <div className="r360-page">
        <div className="r360-page-header r360-detail-header">
          <div>
            <div className="r360-detail-topline">
              <span className="r360-mono r360-key">{request.requestKey}</span>
              <StatusBadge status={request.statusNew} lang={language} />
              <PriorityBadge priority={request.priority} />
              <SeverityBadge severity={request.severity} lang={language} />
              <SlaBadge state={request.slaState} lang={language} />
            </div>
            <h1>{request.title}</h1>
            <p className="r360-subtitle">
              {request.client ? (
                <Link to={`/clients/${request.clientId}`} className="r360-link">
                  {request.client.name}
                </Link>
              ) : (
                request.clientId
              )}
              {' · '}
              {request.requestType}
              {request.requestKind !== 'standard' ? ` · ${request.requestKind}` : ''}
            </p>
          </div>
          <div className="r360-header-actions">
            <button className="r360-btn" onClick={() => navigate('/requests')}>← {language === 'es' ? 'Solicitudes' : 'Requests'}</button>
            <button className="r360-btn" onClick={() => requestsApi.downloadLogbookMarkdown(request.id, request.requestKey)}>
              ⬇ Markdown
            </button>
            <button className="r360-btn" onClick={() => requestsApi.openLogbookHtml(request.id)}>
              🖨 HTML
            </button>
            {canDelete && (
              <button
                className="r360-btn r360-btn-danger"
                disabled={busy}
                onClick={() => {
                  const reason = window.prompt(language === 'es' ? 'Motivo del borrado' : 'Delete reason') || undefined;
                  if (reason === undefined) return;
                  run(async () => {
                    await requestsApi.softDelete(request.id, reason);
                    navigate('/requests');
                  }, false);
                }}
              >
                {language === 'es' ? 'Eliminar' : 'Delete'}
              </button>
            )}
          </div>
        </div>

        <ErrorBanner error={error} />

        <div className="r360-meta-grid">
          <div><span>{language === 'es' ? 'Estado' : 'Status'}</span><strong>{STATUS_LABELS[request.statusNew]?.[language] || request.statusNew}</strong></div>
          <div><span>Deadline</span><strong>{formatDate(request.deadline, language)}</strong></div>
          <div><span>{language === 'es' ? 'Primera respuesta' : 'First response'}</span><strong>{formatDateTime(request.firstResponseAt, language)}</strong></div>
          <div><span>{language === 'es' ? 'Última actividad' : 'Last activity'}</span><strong>{formatDateTime(request.lastActivityAt || request.updatedAt, language)}</strong></div>
          <div><span>{language === 'es' ? 'Reaperturas' : 'Reopens'}</span><strong>{request.reopenCount || 0}</strong></div>
          <div><span>{language === 'es' ? 'Contrato' : 'Contract'}</span><strong>{request.contractType || '—'}</strong></div>
          <div><span>{language === 'es' ? 'Modelo' : 'Service model'}</span><strong>{request.serviceModel || '—'}</strong></div>
          <div><span>Tags</span><strong>{request.tags?.length ? request.tags.join(', ') : '—'}</strong></div>
        </div>

        {canManage && (
          <div className="r360-card r360-inline-actions">
            <div className="r360-inline-group">
              <span>{language === 'es' ? 'Cambiar estado' : 'Change status'}</span>
              <select value={transition.status} onChange={(event) => setTransition((current) => ({ ...current, status: event.target.value }))}>
                {REQUEST_STATUSES.map((status) => (
                  <option key={status} value={status}>{STATUS_LABELS[status][language]}</option>
                ))}
              </select>
              <input
                placeholder={language === 'es' ? 'Motivo (opcional)' : 'Reason (optional)'}
                value={transition.reason}
                onChange={(event) => setTransition((current) => ({ ...current, reason: event.target.value }))}
              />
              <button className="r360-btn r360-btn-primary" disabled={busy} onClick={submitTransition}>
                {language === 'es' ? 'Aplicar' : 'Apply'}
              </button>
            </div>
            {request.requestKind === 'quick_query' && (
              <button className="r360-btn" disabled={busy} onClick={() => run(() => requestsApi.promote(request.id))}>
                {language === 'es' ? 'Promover a solicitud estándar' : 'Promote to standard'}
              </button>
            )}
          </div>
        )}

        <div className="r360-tabs">
          {tabs.map((item) => (
            <button key={item.key} className={`r360-tab ${tab === item.key ? 'active' : ''}`} onClick={() => setTab(item.key)}>
              {TAB_LABELS[item.key][language]}
              {item.count !== undefined && <span className="r360-tab-count">{item.count}</span>}
            </button>
          ))}
        </div>

        {tab === 'logbook' && (
          <div className="r360-card r360-section">
            <div className="r360-composer">
              <textarea
                rows={3}
                value={composer.body}
                placeholder={language === 'es' ? 'Escribe una entrada del logbook…' : 'Write a logbook entry…'}
                onChange={(event) => setComposer((current) => ({ ...current, body: event.target.value }))}
              />
              <div className="r360-composer-actions">
                <select value={composer.type} onChange={(event) => setComposer((current) => ({ ...current, type: event.target.value }))}>
                  <option value="comment">{language === 'es' ? 'Comentario' : 'Comment'}</option>
                  <option value="client_followup">{language === 'es' ? 'Seguimiento cliente' : 'Client follow-up'}</option>
                  <option value="system">{language === 'es' ? 'Nota de sistema' : 'System note'}</option>
                  <option value="email">{language === 'es' ? 'Email' : 'Email'}</option>
                </select>
                <select value={composer.visibility} onChange={(event) => setComposer((current) => ({ ...current, visibility: event.target.value }))}>
                  <option value="internal">{language === 'es' ? 'Interno' : 'Internal'}</option>
                  <option value="client">{language === 'es' ? 'Visible cliente' : 'Client visible'}</option>
                  <option value="public">{language === 'es' ? 'Público' : 'Public'}</option>
                </select>
                <select value={composer.threadId} onChange={(event) => setComposer((current) => ({ ...current, threadId: event.target.value }))}>
                  <option value="">{language === 'es' ? 'Sin hilo' : 'No thread'}</option>
                  {(detail.threads || []).map((thread) => (
                    <option key={thread.id} value={thread.id}>{thread.title}</option>
                  ))}
                </select>
                <button className="r360-btn r360-btn-primary" disabled={busy || !composer.body.trim()} onClick={submitComposer}>
                  {language === 'es' ? 'Añadir entrada' : 'Add entry'}
                </button>
              </div>
            </div>

            {(detail.events || []).length === 0 ? (
              <EmptyState icon="📝" title={language === 'es' ? 'Sin entradas todavía' : 'No entries yet'} />
            ) : (
              <div className="r360-timeline">
                {detail.events.map((event) => (
                  <LogbookEntry key={event.id} event={event} lang={language} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'threads' && (
          <div className="r360-card r360-section">
            {canManage && (
              <div className="r360-inline-group r360-create-row">
                <input
                  placeholder={language === 'es' ? 'Título del hilo' : 'Thread title'}
                  value={newThread.title}
                  onChange={(event) => setNewThread((current) => ({ ...current, title: event.target.value }))}
                />
                <select value={newThread.type} onChange={(event) => setNewThread((current) => ({ ...current, type: event.target.value }))}>
                  {['question', 'task', 'review', 'incident', 'followup'].map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <select value={newThread.parentThreadId} onChange={(event) => setNewThread((current) => ({ ...current, parentThreadId: event.target.value }))}>
                  <option value="">{language === 'es' ? 'Hilo raíz' : 'Root thread'}</option>
                  {(detail.threads || []).filter((thread) => !thread.parentThreadId).map((thread) => (
                    <option key={thread.id} value={thread.id}>{thread.title}</option>
                  ))}
                </select>
                <button className="r360-btn r360-btn-primary" disabled={busy || !newThread.title.trim()} onClick={createThread}>
                  + {language === 'es' ? 'Crear hilo' : 'Create thread'}
                </button>
              </div>
            )}

            {(detail.threads || []).length === 0 ? (
              <EmptyState icon="🧵" title={language === 'es' ? 'Sin hilos' : 'No threads'} />
            ) : (
              <div className="r360-thread-list">
                {(detail.threads || []).map((thread) => {
                  const info = threadMap.get(thread.id);
                  return (
                    <div key={thread.id} className="r360-thread" style={{ marginLeft: (info?.depth || 0) * 24 }}>
                      <div className="r360-thread-main">
                        <div>
                          <strong>{thread.title}</strong>
                          <div className="r360-muted">
                            {thread.type} · {thread.status} · {thread.eventCount || 0} {language === 'es' ? 'entradas' : 'entries'}
                          </div>
                          {thread.description && <div className="r360-muted">{thread.description}</div>}
                        </div>
                        {canManage && thread.status !== 'closed' && (
                          <button className="r360-btn" disabled={busy} onClick={() => run(() => requestsApi.closeThread(request.id, thread.id))}>
                            {language === 'es' ? 'Cerrar' : 'Close'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'documents' && (
          <div className="r360-card r360-section">
            {canManage && (
              <div className="r360-inline-group r360-create-row">
                <input type="file" multiple onChange={(event) => setUploadFiles(Array.from(event.target.files || []))} />
                <button className="r360-btn r360-btn-primary" disabled={busy || !uploadFiles.length} onClick={upload}>
                  ⬆ {language === 'es' ? 'Subir' : 'Upload'}
                </button>
              </div>
            )}
            {(detail.documents || []).length === 0 ? (
              <EmptyState icon="📎" title={language === 'es' ? 'Sin documentos' : 'No documents'} />
            ) : (
              <div className="r360-doc-list">
                {detail.documents.map((document) => (
                  <DocumentRow
                    key={document.id}
                    document={document}
                    lang={language}
                    canManage={canManage}
                    busy={busy}
                    onDownload={() => requestsApi.downloadDocument(request.id, document.id, document.originalName || document.filename)}
                    onDelete={() => run(() => requestsApi.deleteDocument(request.id, document.id))}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'deliverables' && (
          <div className="r360-card r360-section">
            {canManage && (
              <div className="r360-inline-group r360-create-row">
                <input
                  placeholder={language === 'es' ? 'Nombre del entregable' : 'Deliverable name'}
                  value={newDeliverable.name}
                  onChange={(event) => setNewDeliverable((current) => ({ ...current, name: event.target.value }))}
                />
                <select value={newDeliverable.type} onChange={(event) => setNewDeliverable((current) => ({ ...current, type: event.target.value }))}>
                  {['report', 'answer', 'certificate', 'evidence', 'questionnaire', 'other'].map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <button className="r360-btn r360-btn-primary" disabled={busy || !newDeliverable.name.trim()} onClick={createDeliverable}>
                  + {language === 'es' ? 'Crear' : 'Create'}
                </button>
              </div>
            )}
            {(detail.deliverables || []).length === 0 ? (
              <EmptyState icon="📦" title={language === 'es' ? 'Sin entregables' : 'No deliverables'} />
            ) : (
              <div className="r360-deliverable-list">
                {detail.deliverables.map((deliverable) => (
                  <DeliverableRow
                    key={deliverable.id}
                    deliverable={deliverable}
                    lang={language}
                    canManage={canManage}
                    busy={busy}
                    onStatus={(status) => run(() => requestsApi.updateDeliverable(request.id, deliverable.id, { status }))}
                    onSend={() => run(() => requestsApi.sendDeliverable(request.id, deliverable.id))}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'sla' && (
          <div className="r360-card r360-section">
            <div className="r360-meta-grid">
              <div><span>SLA</span><strong><SlaBadge state={request.slaState} lang={language} /></strong></div>
              <div><span>{language === 'es' ? 'Respuesta debida' : 'Response due'}</span><strong>{formatDateTime(request.slaResponseDueAt, language)}</strong></div>
              <div><span>{language === 'es' ? 'Resolución debida' : 'Resolution due'}</span><strong>{formatDateTime(request.slaResolutionDueAt, language)}</strong></div>
              <div><span>{language === 'es' ? 'Pausado desde' : 'Paused since'}</span><strong>{formatDateTime(request.slaPausedAt, language)}</strong></div>
              <div><span>{language === 'es' ? 'Tiempo pausado' : 'Paused time'}</span><strong>{Math.round((request.pausedMsTotal || 0) / 3600000)} h</strong></div>
              <div><span>{language === 'es' ? 'Entregado' : 'Delivered'}</span><strong>{formatDateTime(request.deliveredAt, language)}</strong></div>
              <div><span>{language === 'es' ? 'Cerrado' : 'Closed'}</span><strong>{formatDateTime(request.closedAt, language)}</strong></div>
              <div><span>{language === 'es' ? 'Política' : 'Policy'}</span><strong>{request.slaPolicyId || '—'}</strong></div>
            </div>
          </div>
        )}

        {tab === 'ai' && (
          <div className="r360-card r360-section">
            {canManage ? (
              <div className="r360-inline-group r360-create-row">
                <button className="r360-btn" disabled={busy} onClick={() => generate('summary')}>✨ {language === 'es' ? 'Resumen del caso' : 'Case summary'}</button>
                <button className="r360-btn" disabled={busy} onClick={() => generate('followup')}>✉️ {language === 'es' ? 'Borrador de seguimiento' : 'Follow-up draft'}</button>
                <button className="r360-btn" disabled={busy} onClick={() => generate('minutes')}>🗒 {language === 'es' ? 'Acta de reunión' : 'Meeting minutes'}</button>
                <button className="r360-btn" disabled={busy} onClick={loadArtifacts}>↻ {language === 'es' ? 'Refrescar' : 'Refresh'}</button>
              </div>
            ) : (
              <p className="r360-muted">{language === 'es' ? 'Solo el equipo interno puede generar borradores.' : 'Only internal users can generate drafts.'}</p>
            )}
            {artifacts.length === 0 ? (
              <EmptyState icon="🤖" title={language === 'es' ? 'Sin artefactos IA' : 'No AI artifacts'} />
            ) : (
              <div className="r360-artifact-list">
                {artifacts.map((artifact) => (
                  <div key={artifact.id} className="r360-artifact">
                    <div className="r360-artifact-head">
                      <strong>{artifact.kind}</strong>
                      <span className="r360-badge r360-status-new">{artifact.status}</span>
                      <span className="r360-muted">{formatDateTime(artifact.createdAt, language)}</span>
                    </div>
                    {editingArtifact?.id === artifact.id ? (
                      <>
                        <textarea
                          rows={8}
                          value={editingArtifact.content}
                          onChange={(event) => setEditingArtifact({ id: artifact.id, content: event.target.value })}
                        />
                        <div className="r360-inline-group">
                          <button
                            className="r360-btn r360-btn-primary"
                            disabled={busy}
                            onClick={() => {
                              run(async () => {
                                await requestsApi.acceptArtifact(artifact.id, editingArtifact.content);
                                setEditingArtifact(null);
                                await loadArtifacts();
                              }, false);
                            }}
                          >
                            {language === 'es' ? 'Guardar y aceptar' : 'Save & accept'}
                          </button>
                          <button className="r360-btn" onClick={() => setEditingArtifact(null)}>{language === 'es' ? 'Cancelar' : 'Cancel'}</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <pre className="r360-artifact-body">{artifact.editedContent || artifact.content}</pre>
                        <div className="r360-inline-group">
                          <button
                            className="r360-btn"
                            onClick={() => setEditingArtifact({ id: artifact.id, content: artifact.editedContent || artifact.content })}
                          >
                            ✏️ {language === 'es' ? 'Editar' : 'Edit'}
                          </button>
                          {canManage && artifact.status === 'draft' && (
                            <button
                              className="r360-btn r360-btn-primary"
                              disabled={busy}
                              onClick={() => run(async () => { await requestsApi.acceptArtifact(artifact.id); await loadArtifacts(); }, false)}
                            >
                              ✓ {language === 'es' ? 'Aceptar' : 'Accept'}
                            </button>
                          )}
                          {canManage && artifact.status === 'draft' && (
                            <button
                              className="r360-btn r360-btn-danger"
                              disabled={busy}
                              onClick={() => run(async () => { await requestsApi.discardArtifact(artifact.id); await loadArtifacts(); }, false)}
                            >
                              {language === 'es' ? 'Descartar' : 'Discard'}
                            </button>
                          )}
                        </div>
                      </>
                    )}
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

function LogbookEntry({ event, lang }: { event: RequestEvent; lang: 'es' | 'en' }) {
  const typeLabel = EVENT_TYPE_LABELS[event.type]?.[lang] || event.type;
  return (
    <div className={`r360-event r360-event-${event.type}`}>
      <div className="r360-event-dot" />
      <div className="r360-event-body">
        <div className="r360-event-head">
          <strong>{typeLabel}</strong>
          <span className={`r360-badge r360-vis-${event.visibility}`}>
            {VISIBILITY_LABELS[event.visibility]?.[lang] || event.visibility}
          </span>
          <span className="r360-muted">{formatDateTime(event.createdAt, lang)}</span>
          {event.authorName && <span className="r360-muted">· {event.authorName}</span>}
        </div>
        {event.fromStatus && event.toStatus && (
          <div className="r360-muted">{event.fromStatus} → {event.toStatus}</div>
        )}
        {event.body && <div className="r360-event-text">{event.body}</div>}
      </div>
    </div>
  );
}

function DocumentRow({
  document,
  lang,
  canManage,
  busy,
  onDownload,
  onDelete,
}: {
  document: RequestDocument;
  lang: 'es' | 'en';
  canManage: boolean;
  busy: boolean;
  onDownload: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="r360-doc-row">
      <div>
        <strong>{document.originalName || document.filename}</strong>
        <div className="r360-muted">
          {document.documentType || 'other'} · {document.visibility || 'internal'}
          {document.size ? ` · ${Math.round(document.size / 1024)} KB` : ''}
          {document.version ? ` · v${document.version}` : ''}
        </div>
      </div>
      <div className="r360-inline-group">
        <span className="r360-muted">{formatDate(document.createdAt, lang)}</span>
        <button className="r360-btn" onClick={onDownload}>⬇</button>
        {canManage && <button className="r360-btn r360-btn-danger" disabled={busy} onClick={onDelete}>×</button>}
      </div>
    </div>
  );
}

function DeliverableRow({
  deliverable,
  lang,
  canManage,
  busy,
  onStatus,
  onSend,
}: {
  deliverable: Deliverable;
  lang: 'es' | 'en';
  canManage: boolean;
  busy: boolean;
  onStatus: (status: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="r360-deliverable-row">
      <div>
        <strong>{deliverable.name}</strong>
        <div className="r360-muted">
          {deliverable.type || 'other'} · v{deliverable.version || 1}
          {deliverable.clientVisible ? ' · cliente' : ''}
          {deliverable.dueDate ? ` · ${formatDate(deliverable.dueDate, lang)}` : ''}
        </div>
      </div>
      <div className="r360-inline-group">
        {canManage ? (
          <>
            <select value={deliverable.status} onChange={(event) => onStatus(event.target.value)} disabled={busy}>
              {Object.entries(DELIVERABLE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label[lang]}</option>
              ))}
            </select>
            <button className="r360-btn" disabled={busy || deliverable.status === 'sent'} onClick={onSend}>
              {lang === 'es' ? 'Enviar' : 'Send'}
            </button>
          </>
        ) : (
          <span className="r360-badge r360-status-new">{DELIVERABLE_STATUS_LABELS[deliverable.status]?.[lang] || deliverable.status}</span>
        )}
      </div>
    </div>
  );
}
