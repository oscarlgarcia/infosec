import { useCallback, useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { slaApi } from '../api/sla';
import type { BusinessCalendar, SlaPolicy } from '../types/request360';
import { PRIORITIES, REQUEST_TYPE_OPTIONS } from '../types/request360';
import { EmptyState, ErrorBanner, Loading, formatDate } from '../components/request360/badges';

interface PolicyForm {
  name: string;
  requestType: string;
  priority: string;
  businessHoursOnly: boolean;
  responseHours: string;
  resolutionHours: string;
  atRiskThresholdPct: string;
  pauseOnWaitingClient: boolean;
  calendarId: string;
  active: boolean;
}

const EMPTY_POLICY: PolicyForm = {
  name: '',
  requestType: '',
  priority: '',
  businessHoursOnly: true,
  responseHours: '8',
  resolutionHours: '40',
  atRiskThresholdPct: '80',
  pauseOnWaitingClient: true,
  calendarId: '',
  active: true,
};

export function SlaPoliciesPage() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [calendars, setCalendars] = useState<BusinessCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [policyForm, setPolicyForm] = useState<PolicyForm>(EMPTY_POLICY);
  const [calendarForm, setCalendarForm] = useState({
    name: '',
    timezone: 'Europe/Madrid',
    workdays: '1,2,3,4,5',
    startTime: '09:00',
    endTime: '18:00',
    holidays: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [policyResponse, calendarResponse] = await Promise.all([slaApi.listPolicies(), slaApi.listCalendars()]);
      setPolicies(policyResponse.items);
      setCalendars(calendarResponse.items);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action: () => Promise<any>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  const savePolicy = async () => {
    const payload: Record<string, any> = {
      name: policyForm.name,
      requestType: policyForm.requestType || null,
      priority: policyForm.priority || null,
      businessHoursOnly: policyForm.businessHoursOnly,
      responseHours: Number(policyForm.responseHours) || 0,
      resolutionHours: Number(policyForm.resolutionHours) || 1,
      atRiskThresholdPct: Number(policyForm.atRiskThresholdPct) || 80,
      pauseOnWaitingClient: policyForm.pauseOnWaitingClient,
      calendarId: policyForm.calendarId || null,
      active: policyForm.active,
    };
    await run(async () => {
      if (editingId) await slaApi.updatePolicy(editingId, payload);
      else await slaApi.createPolicy(payload);
      setPolicyForm(EMPTY_POLICY);
      setEditingId(null);
    });
  };

  const startEdit = (policy: SlaPolicy) => {
    setEditingId(policy._id);
    setPolicyForm({
      name: policy.name || '',
      requestType: policy.requestType || '',
      priority: policy.priority || '',
      businessHoursOnly: Boolean(policy.businessHoursOnly),
      responseHours: String(policy.responseHours ?? 8),
      resolutionHours: String(policy.resolutionHours ?? 40),
      atRiskThresholdPct: String(policy.atRiskThresholdPct ?? 80),
      pauseOnWaitingClient: Boolean(policy.pauseOnWaitingClient),
      calendarId: typeof policy.calendarId === 'string' ? policy.calendarId : (policy.calendarId as any)?._id || '',
      active: policy.active !== false,
    });
  };

  const createCalendar = async () => {
    await run(async () => {
      await slaApi.createCalendar({
        name: calendarForm.name,
        timezone: calendarForm.timezone,
        workdays: calendarForm.workdays.split(',').map((item) => Number(item.trim())).filter((value) => !Number.isNaN(value)),
        startTime: calendarForm.startTime,
        endTime: calendarForm.endTime,
        holidays: calendarForm.holidays ? calendarForm.holidays.split(',').map((item) => item.trim()).filter(Boolean) : [],
      });
      setCalendarForm({ name: '', timezone: 'Europe/Madrid', workdays: '1,2,3,4,5', startTime: '09:00', endTime: '18:00', holidays: '' });
    });
  };

  if (loading) {
    return <Layout><div className="r360-page r360-page-scroll r360-list-page"><Loading lang={language} /></div></Layout>;
  }

  return (
    <Layout>
      <div className="r360-page r360-page-scroll r360-list-page">
        <div className="r360-page-header">
          <div>
            <h1>{language === 'es' ? 'Políticas SLA' : 'SLA Policies'}</h1>
            <p className="r360-subtitle">
              {language === 'es'
                ? 'Define objetivos de respuesta y resolución, calendarios y pausas.'
                : 'Define response and resolution targets, calendars and pauses.'}
            </p>
          </div>
          <div className="r360-header-actions">
            <button className="r360-btn" disabled={busy} onClick={() => run(() => slaApi.runSweep())}>
              ↻ {language === 'es' ? 'Ejecutar barrido SLA' : 'Run SLA sweep'}
            </button>
          </div>
        </div>

        <ErrorBanner error={error} />

        {isAdmin && (
          <div className="r360-card r360-section">
            <div className="r360-section-head">
              <h2>{editingId ? (language === 'es' ? 'Editar política' : 'Edit policy') : (language === 'es' ? 'Nueva política' : 'New policy')}</h2>
              {editingId && (
                <button className="r360-btn" onClick={() => { setEditingId(null); setPolicyForm(EMPTY_POLICY); }}>
                  {language === 'es' ? 'Cancelar edición' : 'Cancel edit'}
                </button>
              )}
            </div>
            <div className="r360-form-grid">
              <label className="r360-field">
                <span>{language === 'es' ? 'Nombre' : 'Name'}</span>
                <input value={policyForm.name} onChange={(event) => setPolicyForm((c) => ({ ...c, name: event.target.value }))} />
              </label>
              <label className="r360-field">
                <span>{language === 'es' ? 'Tipo de solicitud' : 'Request type'}</span>
                <select value={policyForm.requestType} onChange={(event) => setPolicyForm((c) => ({ ...c, requestType: event.target.value }))}>
                  <option value="">{language === 'es' ? 'Cualquiera' : 'Any'}</option>
                  {REQUEST_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label className="r360-field">
                <span>{language === 'es' ? 'Prioridad' : 'Priority'}</span>
                <select value={policyForm.priority} onChange={(event) => setPolicyForm((c) => ({ ...c, priority: event.target.value }))}>
                  <option value="">{language === 'es' ? 'Cualquiera' : 'Any'}</option>
                  {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                </select>
              </label>
              <label className="r360-field">
                <span>{language === 'es' ? 'Horas de respuesta' : 'Response hours'}</span>
                <input type="number" min={0} value={policyForm.responseHours} onChange={(event) => setPolicyForm((c) => ({ ...c, responseHours: event.target.value }))} />
              </label>
              <label className="r360-field">
                <span>{language === 'es' ? 'Horas de resolución' : 'Resolution hours'}</span>
                <input type="number" min={1} value={policyForm.resolutionHours} onChange={(event) => setPolicyForm((c) => ({ ...c, resolutionHours: event.target.value }))} />
              </label>
              <label className="r360-field">
                <span>{language === 'es' ? 'Umbral de riesgo (%)' : 'At-risk threshold (%)'}</span>
                <input type="number" min={0} max={100} value={policyForm.atRiskThresholdPct} onChange={(event) => setPolicyForm((c) => ({ ...c, atRiskThresholdPct: event.target.value }))} />
              </label>
              <label className="r360-field">
                <span>{language === 'es' ? 'Calendario' : 'Calendar'}</span>
                <select value={policyForm.calendarId} onChange={(event) => setPolicyForm((c) => ({ ...c, calendarId: event.target.value }))}>
                  <option value="">{language === 'es' ? 'Sin calendario' : 'No calendar'}</option>
                  {calendars.map((calendar) => <option key={calendar._id} value={calendar._id}>{calendar.name}</option>)}
                </select>
              </label>
              <div className="r360-field r360-field-full r360-inline-group">
                <label className="r360-checkbox">
                  <input type="checkbox" checked={policyForm.businessHoursOnly} onChange={(event) => setPolicyForm((c) => ({ ...c, businessHoursOnly: event.target.checked }))} />
                  {language === 'es' ? 'Solo horario laboral' : 'Business hours only'}
                </label>
                <label className="r360-checkbox">
                  <input type="checkbox" checked={policyForm.pauseOnWaitingClient} onChange={(event) => setPolicyForm((c) => ({ ...c, pauseOnWaitingClient: event.target.checked }))} />
                  {language === 'es' ? 'Pausar esperando cliente' : 'Pause on waiting client'}
                </label>
                <label className="r360-checkbox">
                  <input type="checkbox" checked={policyForm.active} onChange={(event) => setPolicyForm((c) => ({ ...c, active: event.target.checked }))} />
                  {language === 'es' ? 'Activa' : 'Active'}
                </label>
              </div>
              <div className="r360-inline-group r360-field-full">
                <button className="r360-btn r360-btn-primary" disabled={busy || !policyForm.name} onClick={savePolicy}>
                  {editingId ? (language === 'es' ? 'Guardar cambios' : 'Save changes') : (language === 'es' ? 'Crear política' : 'Create policy')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="r360-card r360-table-wrap">
          <div className="r360-section-head r360-padded"><h2>{language === 'es' ? 'Políticas' : 'Policies'}</h2></div>
          {policies.length === 0 ? (
            <EmptyState icon="⏱️" title={language === 'es' ? 'Sin políticas' : 'No policies'} />
          ) : (
            <table className="r360-table">
              <thead>
                <tr>
                  <th>{language === 'es' ? 'Nombre' : 'Name'}</th>
                  <th>{language === 'es' ? 'Tipo' : 'Type'}</th>
                  <th>{language === 'es' ? 'Prioridad' : 'Priority'}</th>
                  <th>{language === 'es' ? 'Respuesta' : 'Response'}</th>
                  <th>{language === 'es' ? 'Resolución' : 'Resolution'}</th>
                  <th>{language === 'es' ? 'En riesgo' : 'At risk'}</th>
                  <th>{language === 'es' ? 'Activa' : 'Active'}</th>
                  {isAdmin && <th />}
                </tr>
              </thead>
              <tbody>
                {policies.map((policy) => {
                  const calendar: any = policy.calendarId;
                  return (
                    <tr key={policy._id}>
                      <td>
                        <strong>{policy.name}</strong>
                        <div className="r360-muted">{calendar?.name || (language === 'es' ? 'Sin calendario' : 'No calendar')}</div>
                      </td>
                      <td>{policy.requestType || '—'}</td>
                      <td>{policy.priority || '—'}</td>
                      <td>{policy.responseHours ?? '—'} h</td>
                      <td>{policy.resolutionHours ?? '—'} h</td>
                      <td>{policy.atRiskThresholdPct ?? '—'}%</td>
                      <td>{policy.active === false ? '—' : '✓'}</td>
                      {isAdmin && (
                        <td>
                          <div className="r360-inline-group">
                            <button className="r360-btn" onClick={() => startEdit(policy)}>✏️</button>
                            <button
                              className="r360-btn r360-btn-danger"
                              disabled={busy}
                              onClick={() => {
                                if (!window.confirm(language === 'es' ? '¿Eliminar política?' : 'Delete policy?')) return;
                                run(() => slaApi.deletePolicy(policy._id));
                              }}
                            >
                              ×
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="r360-card r360-section">
          <div className="r360-section-head"><h2>{language === 'es' ? 'Calendarios laborales' : 'Business calendars'}</h2></div>
          {isAdmin && (
            <div className="r360-inline-group r360-create-row">
              <input placeholder={language === 'es' ? 'Nombre' : 'Name'} value={calendarForm.name} onChange={(event) => setCalendarForm((c) => ({ ...c, name: event.target.value }))} />
              <input placeholder="Europe/Madrid" value={calendarForm.timezone} onChange={(event) => setCalendarForm((c) => ({ ...c, timezone: event.target.value }))} />
              <input placeholder="1,2,3,4,5" value={calendarForm.workdays} onChange={(event) => setCalendarForm((c) => ({ ...c, workdays: event.target.value }))} />
              <input type="time" value={calendarForm.startTime} onChange={(event) => setCalendarForm((c) => ({ ...c, startTime: event.target.value }))} />
              <input type="time" value={calendarForm.endTime} onChange={(event) => setCalendarForm((c) => ({ ...c, endTime: event.target.value }))} />
              <input placeholder={language === 'es' ? 'Festivos (YYYY-MM-DD,…)' : 'Holidays (YYYY-MM-DD,…)'} value={calendarForm.holidays} onChange={(event) => setCalendarForm((c) => ({ ...c, holidays: event.target.value }))} />
              <button className="r360-btn r360-btn-primary" disabled={busy || !calendarForm.name} onClick={createCalendar}>
                + {language === 'es' ? 'Añadir' : 'Add'}
              </button>
            </div>
          )}
          {calendars.length === 0 ? (
            <EmptyState icon="📅" title={language === 'es' ? 'Sin calendarios' : 'No calendars'} />
          ) : (
            <div className="r360-doc-list">
              {calendars.map((calendar) => (
                <div key={calendar._id} className="r360-doc-row">
                  <div>
                    <strong>{calendar.name}</strong>
                    <div className="r360-muted">
                      {calendar.timezone || 'UTC'} · {calendar.startTime || '09:00'}–{calendar.endTime || '18:00'}
                      {' · '}
                      {(calendar.workdays || []).join(',') || '1,2,3,4,5'}
                      {calendar.holidays?.length ? ` · ${calendar.holidays.length} ${language === 'es' ? 'festivos' : 'holidays'}` : ''}
                    </div>
                  </div>
                  <div className="r360-inline-group">
                    <span className="r360-muted">{formatDate(calendar.createdAt, language)}</span>
                    {isAdmin && (
                      <button
                        className="r360-btn r360-btn-danger"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm(language === 'es' ? '¿Eliminar calendario?' : 'Delete calendar?')) return;
                          run(() => slaApi.deleteCalendar(calendar._id));
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
