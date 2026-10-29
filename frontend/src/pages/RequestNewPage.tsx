import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useLanguage } from '../i18n/LanguageContext';
import { clientsApi } from '../api/clients';
import { requestsApi } from '../api/requests';
import { slaApi } from '../api/sla';
import type { Client } from '../types';
import {
  PRIORITIES,
  REQUEST_CHANNELS,
  REQUEST_KINDS,
  REQUEST_TYPE_OPTIONS,
  SEVERITIES,
} from '../types/request360';
import { ErrorBanner } from '../components/request360/badges';

interface StakeholderDraft {
  name: string;
  email: string;
  role: string;
}

export function RequestNewPage() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [clients, setClients] = useState<Client[]>([]);
  const [catalogs, setCatalogs] = useState<{ contractTypes: string[]; serviceModels: string[] }>({
    contractTypes: [],
    serviceModels: [],
  });
  const [files, setFiles] = useState<File[]>([]);
  const [stakeholders, setStakeholders] = useState<StakeholderDraft[]>([]);
  const [classifying, setClassifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [form, setForm] = useState({
    clientId: '',
    intakeText: '',
    requestType: 'InfoSec Support',
    requestKind: 'standard',
    title: '',
    scope: '',
    sectionToReview: '',
    priority: 'P3',
    severity: 'medium',
    requestChannel: 'email',
    contractType: '',
    serviceModel: '',
    businessUnit: '',
    deadline: '',
    tags: '',
  });

  useEffect(() => {
    clientsApi.list().then(setClients).catch((err) => setError(err.message));
    slaApi
      .getCatalogs()
      .then((data) => setCatalogs({ contractTypes: data.contractTypes || [], serviceModels: data.serviceModels || [] }))
      .catch(() => undefined);
  }, []);

  const label = useMemo(
    () => ({
      step1: language === 'es' ? 'Cliente e intake' : 'Client & intake',
      step2: language === 'es' ? 'Detalles' : 'Details',
      step3: language === 'es' ? 'Adjuntos y confirmación' : 'Attachments & confirmation',
    }),
    [language]
  );

  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  const handleClassify = async () => {
    if (!form.intakeText.trim()) return;
    setClassifying(true);
    setError(null);
    try {
      const result = await requestsApi.classify(form.intakeText);
      setForm((current) => ({
        ...current,
        requestType: result.requestType || current.requestType,
        priority: result.priority || current.priority,
        severity: result.severity || current.severity,
        title: current.title || result.title || '',
        scope: current.scope || result.scope || current.intakeText.slice(0, 400),
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setClassifying(false);
    }
  };

  const handleSubmit = async (overrideDuplicate = false) => {
    if (!form.clientId) {
      setError(language === 'es' ? 'Selecciona un cliente' : 'Select a client');
      setStep(1);
      return;
    }
    setSaving(true);
    setError(null);
    setDuplicates([]);
    try {
      const payload = {
        clientId: form.clientId,
        requestType: form.requestType,
        requestKind: form.requestKind,
        title: form.title || form.intakeText.slice(0, 120),
        scope: form.scope || form.intakeText,
        sectionToReview: form.sectionToReview || undefined,
        priority: form.priority,
        severity: form.severity,
        requestChannel: form.requestChannel,
        contractType: form.contractType || undefined,
        serviceModel: form.serviceModel || undefined,
        businessUnit: form.businessUnit || undefined,
        deadline: form.deadline || undefined,
        comments: form.intakeText || undefined,
        tags: form.tags ? form.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
        stakeholders: stakeholders
          .filter((item) => item.name.trim())
          .map((item) => ({
            name: item.name.trim(),
            email: item.email.trim() || undefined,
            role: item.role.trim() || undefined,
            partyType: 'client' as const,
          })),
        overrideDuplicate,
      };
      const created = files.length
        ? await requestsApi.createWithFiles(payload, files)
        : await requestsApi.create(payload);
      navigate(`/requests/${created.id}`);
    } catch (err: any) {
      if (err.status === 409 || err.duplicates?.length) {
        setDuplicates(err.duplicates || []);
        setError(language === 'es' ? 'Posible duplicado detectado' : 'Possible duplicate detected');
      } else {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const canContinue = step === 1 ? Boolean(form.clientId) : true;

  return (
    <Layout>
      <div className="r360-page r360-wizard">
        <div className="r360-page-header">
          <div>
            <h1>{language === 'es' ? 'Nueva solicitud' : 'New request'}</h1>
            <p className="r360-subtitle">
              {language === 'es' ? 'Alta guiada con clasificación, dedupe y adjuntos.' : 'Guided intake with classification, dedupe and attachments.'}
            </p>
          </div>
          <button className="r360-btn" onClick={() => navigate('/requests')}>
            ← {language === 'es' ? 'Volver' : 'Back'}
          </button>
        </div>

        <div className="r360-stepper">
          {[1, 2, 3].map((value) => (
            <button
              key={value}
              className={`r360-step ${step === value ? 'active' : ''} ${step > value ? 'done' : ''}`}
              onClick={() => setStep(value)}
            >
              <span className="r360-step-number">{step > value ? '✓' : value}</span>
              {value === 1 ? label.step1 : value === 2 ? label.step2 : label.step3}
            </button>
          ))}
        </div>

        <ErrorBanner error={error} />

        {duplicates.length > 0 && (
          <div className="r360-duplicates">
            <strong>{language === 'es' ? 'Solicitudes parecidas:' : 'Similar requests:'}</strong>
            <ul>
              {duplicates.map((duplicate, index) => (
                <li key={index}>
                  {duplicate.requestKey || duplicate.id} — {duplicate.title || duplicate.reason}
                </li>
              ))}
            </ul>
            <button className="r360-btn r360-btn-primary" disabled={saving} onClick={() => handleSubmit(true)}>
              {language === 'es' ? 'Crear de todos modos' : 'Create anyway'}
            </button>
          </div>
        )}

        <div className="r360-card r360-wizard-body">
          {step === 1 && (
            <div className="r360-form-grid">
              <label className="r360-field r360-field-full">
                <span>{language === 'es' ? 'Cliente' : 'Client'} *</span>
                <select value={form.clientId} onChange={(event) => set({ clientId: event.target.value })}>
                  <option value="">{language === 'es' ? 'Selecciona un cliente' : 'Select a client'}</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </label>
              <label className="r360-field r360-field-full">
                <span>{language === 'es' ? 'Texto del intake' : 'Intake text'}</span>
                <textarea
                  rows={5}
                  value={form.intakeText}
                  placeholder={language === 'es' ? 'Pega el email o describe la solicitud…' : 'Paste the email or describe the request…'}
                  onChange={(event) => set({ intakeText: event.target.value })}
                />
              </label>
              <button className="r360-btn" onClick={handleClassify} disabled={classifying || !form.intakeText.trim()}>
                {classifying
                  ? language === 'es' ? 'Clasificando…' : 'Classifying…'
                  : language === 'es' ? '✨ Clasificar automáticamente' : '✨ Auto-classify'}
              </button>
              <label className="r360-field">
                <span>{language === 'es' ? 'Tipo' : 'Kind'}</span>
                <select value={form.requestKind} onChange={(event) => set({ requestKind: event.target.value })}>
                  {REQUEST_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
                </select>
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="r360-form-grid">
              <label className="r360-field">
                <span>{language === 'es' ? 'Tipo de solicitud' : 'Request type'}</span>
                <select value={form.requestType} onChange={(event) => set({ requestType: event.target.value })}>
                  {REQUEST_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label className="r360-field">
                <span>{language === 'es' ? 'Prioridad' : 'Priority'}</span>
                <select value={form.priority} onChange={(event) => set({ priority: event.target.value })}>
                  {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                </select>
              </label>
              <label className="r360-field">
                <span>{language === 'es' ? 'Severidad' : 'Severity'}</span>
                <select value={form.severity} onChange={(event) => set({ severity: event.target.value })}>
                  {SEVERITIES.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
                </select>
              </label>
              <label className="r360-field">
                <span>{language === 'es' ? 'Canal' : 'Channel'}</span>
                <select value={form.requestChannel} onChange={(event) => set({ requestChannel: event.target.value })}>
                  {REQUEST_CHANNELS.map((channel) => <option key={channel} value={channel}>{channel}</option>)}
                </select>
              </label>
              <label className="r360-field r360-field-full">
                <span>{language === 'es' ? 'Título' : 'Title'}</span>
                <input value={form.title} onChange={(event) => set({ title: event.target.value })} />
              </label>
              <label className="r360-field r360-field-full">
                <span>{language === 'es' ? 'Alcance' : 'Scope'}</span>
                <textarea rows={3} value={form.scope} onChange={(event) => set({ scope: event.target.value })} />
              </label>
              <label className="r360-field">
                <span>{language === 'es' ? 'Contrato' : 'Contract type'}</span>
                <select value={form.contractType} onChange={(event) => set({ contractType: event.target.value })}>
                  <option value="">—</option>
                  {catalogs.contractTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label className="r360-field">
                <span>{language === 'es' ? 'Modelo de servicio' : 'Service model'}</span>
                <select value={form.serviceModel} onChange={(event) => set({ serviceModel: event.target.value })}>
                  <option value="">—</option>
                  {catalogs.serviceModels.map((model) => <option key={model} value={model}>{model}</option>)}
                </select>
              </label>
              <label className="r360-field">
                <span>Deadline</span>
                <input type="date" value={form.deadline} onChange={(event) => set({ deadline: event.target.value })} />
              </label>
              <label className="r360-field">
                <span>{language === 'es' ? 'Business unit' : 'Business unit'}</span>
                <input value={form.businessUnit} onChange={(event) => set({ businessUnit: event.target.value })} />
              </label>
              <label className="r360-field r360-field-full">
                <span>Tags</span>
                <input
                  value={form.tags}
                  placeholder="soc2, iso27001, dpa"
                  onChange={(event) => set({ tags: event.target.value })}
                />
              </label>

              <div className="r360-field r360-field-full">
                <span>{language === 'es' ? 'Stakeholders del cliente' : 'Client stakeholders'}</span>
                {stakeholders.map((stakeholder, index) => (
                  <div key={index} className="r360-stakeholder-row">
                    <input
                      placeholder={language === 'es' ? 'Nombre' : 'Name'}
                      value={stakeholder.name}
                      onChange={(event) => setStakeholders((current) => current.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)))}
                    />
                    <input
                      placeholder="email@cliente.com"
                      value={stakeholder.email}
                      onChange={(event) => setStakeholders((current) => current.map((item, i) => (i === index ? { ...item, email: event.target.value } : item)))}
                    />
                    <input
                      placeholder={language === 'es' ? 'Rol' : 'Role'}
                      value={stakeholder.role}
                      onChange={(event) => setStakeholders((current) => current.map((item, i) => (i === index ? { ...item, role: event.target.value } : item)))}
                    />
                    <button className="r360-btn" onClick={() => setStakeholders((current) => current.filter((_, i) => i !== index))}>×</button>
                  </div>
                ))}
                <button
                  className="r360-btn"
                  onClick={() => setStakeholders((current) => [...current, { name: '', email: '', role: '' }])}
                >
                  + {language === 'es' ? 'Añadir stakeholder' : 'Add stakeholder'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="r360-form-grid">
              <div className="r360-field r360-field-full">
                <span>{language === 'es' ? 'Documentos adjuntos' : 'Attachments'}</span>
                <input
                  type="file"
                  multiple
                  onChange={(event) => setFiles(Array.from(event.target.files || []))}
                />
                {files.length > 0 && (
                  <ul className="r360-file-list">
                    {files.map((file, index) => (
                      <li key={index}>
                        📎 {file.name}
                        <button onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}>×</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="r360-summary-grid r360-field-full">
                <div><span>{language === 'es' ? 'Cliente' : 'Client'}</span><strong>{clients.find((c) => c.id === form.clientId)?.name || '—'}</strong></div>
                <div><span>{language === 'es' ? 'Tipo' : 'Type'}</span><strong>{form.requestType}</strong></div>
                <div><span>{language === 'es' ? 'Prioridad' : 'Priority'}</span><strong>{form.priority}</strong></div>
                <div><span>{language === 'es' ? 'Severidad' : 'Severity'}</span><strong>{form.severity}</strong></div>
                <div><span>Deadline</span><strong>{form.deadline || '—'}</strong></div>
                <div><span>{language === 'es' ? 'Adjuntos' : 'Attachments'}</span><strong>{files.length}</strong></div>
              </div>
            </div>
          )}
        </div>

        <div className="r360-wizard-actions">
          <button className="r360-btn" disabled={step === 1} onClick={() => setStep((value) => value - 1)}>
            ← {language === 'es' ? 'Anterior' : 'Back'}
          </button>
          {step < 3 ? (
            <button className="r360-btn r360-btn-primary" disabled={!canContinue} onClick={() => setStep((value) => value + 1)}>
              {language === 'es' ? 'Siguiente' : 'Next'} →
            </button>
          ) : (
            <button className="r360-btn r360-btn-primary" disabled={saving} onClick={() => handleSubmit(false)}>
              {saving ? language === 'es' ? 'Creando…' : 'Creating…' : language === 'es' ? 'Crear solicitud' : 'Create request'}
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
}
