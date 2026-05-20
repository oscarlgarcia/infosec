import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useApi } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export function ScheduledReports() {
  const apiFetch = useApi();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [searchParams] = useSearchParams();
  const t = (es: string, en: string) => language === 'es' ? es : en;

  const offset = new Date().getTimezoneOffset();
  const toUtc = (localHour: number, localMinute: number) => {
    const total = localHour * 60 + localMinute + offset;
    const clamped = ((total % 1440) + 1440) % 1440;
    return { hour: Math.floor(clamped / 60), minute: Math.round(clamped % 60) };
  };
  const toLocal = (utcHour: number, utcMinute: number) => {
    const total = utcHour * 60 + utcMinute - offset;
    const clamped = ((total % 1440) + 1440) % 1440;
    return { hour: Math.floor(clamped / 60), minute: Math.round(clamped % 60) };
  };

  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editSchedule, setEditSchedule] = useState<any>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ term: '', frequency: 'weekly', notifyOnChanges: true, scheduleHour: 8, scheduleMinute: 0, dayOfWeek: 1, dayOfMonth: 1 });

  useEffect(() => {
    const newTerm = searchParams.get('new');
    if (newTerm) {
      setFormData(prev => ({ ...prev, term: newTerm }));
      setShowModal(true);
    }
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/reports/schedules');
      if (res.ok) { setSchedules(await res.json()); setPage(1); }
    } catch (err) {
      console.error('Error loading schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditSchedule(null);
    setFormData({ term: '', frequency: 'weekly', notifyOnChanges: true, scheduleHour: 8, scheduleMinute: 0, dayOfWeek: 1, dayOfMonth: 1 });
    setShowModal(true);
  };

  const openEdit = (s: any) => {
    setEditSchedule(s);
    const local = toLocal(s.scheduleHour ?? 0, s.scheduleMinute ?? 0);
    setFormData({ term: s.term, frequency: s.frequency, notifyOnChanges: s.notifyOnChanges !== false, scheduleHour: local.hour, scheduleMinute: local.minute, dayOfWeek: s.dayOfWeek ?? 1, dayOfMonth: s.dayOfMonth ?? 1 });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const url = editSchedule ? `/api/reports/schedules/${editSchedule._id}` : '/api/reports/schedules';
      const method = editSchedule ? 'PUT' : 'POST';
      const utc = toUtc(formData.scheduleHour, formData.scheduleMinute);
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: formData.term,
          frequency: formData.frequency,
          notifyOnChanges: formData.notifyOnChanges,
          scheduleHour: utc.hour,
          scheduleMinute: utc.minute,
          dayOfWeek: formData.dayOfWeek,
          dayOfMonth: formData.dayOfMonth,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        fetchSchedules();
      }
    } catch (err) {
      console.error('Error saving schedule:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('Delete this schedule?', '¿Eliminar esta programación?'))) return;
    try {
      const res = await apiFetch(`/api/reports/schedules/${id}`, { method: 'DELETE' });
      if (res.ok) fetchSchedules();
    } catch (err) {
      console.error('Error deleting schedule:', err);
    }
  };

  const handleRunNow = async (id: string) => {
    setRunningId(id);
    try {
      const res = await apiFetch(`/api/reports/schedules/${id}/run-now`, { method: 'POST' });
      if (res.ok) {
        alert(t('Report generated successfully!', '¡Reporte generado exitosamente!'));
        fetchSchedules();
      }
    } catch (err) {
      console.error('Error running schedule:', err);
    } finally {
      setRunningId(null);
    }
  };

  const handleToggle = async (s: any) => {
    try {
      await apiFetch(`/api/reports/schedules/${s._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !s.enabled }),
      });
      fetchSchedules();
    } catch (err) {
      console.error('Error toggling schedule:', err);
    }
  };

  const pageSize = 10;
  const totalPages = Math.ceil(schedules.length / pageSize);
  const displayedSchedules = schedules.length > 10 ? schedules.slice((page - 1) * pageSize, page * pageSize) : schedules;

  const pad = (n: number) => String(n).padStart(2, '0');
  const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const scheduleLabel = (s: any) => {
    const local = toLocal(s.scheduleHour ?? 0, s.scheduleMinute ?? 0);
    const h = pad(local.hour);
    const m = pad(local.minute);
    const days = language === 'es' ? DAYS_ES : DAYS_EN;
    switch (s.frequency) {
      case 'daily': return `${t('Daily', 'Diario')} ${h}:${m}`;
      case 'weekly': return `${t('Weekly', 'Semanal')} ${days[s.dayOfWeek ?? 1] ?? ''} ${h}:${m}`;
      case 'monthly': return `${t('Monthly', 'Mensual')} ${t('Day', 'Día')} ${s.dayOfMonth ?? 1} ${h}:${m}`;
      default: return s.frequency;
    }
  };

  return (
    <Layout>
      <Link to="/knowledge-center" className="back-link">← {t('Back', 'Volver')}</Link>
      <div className="scheduled-reports">
        <div className="kc-header">
          <h1>📅 {t('Scheduled Reports', 'Reportes Programados')}</h1>
          <button className="btn-primary" onClick={openCreate}>➕ {t('Add Schedule', 'Agregar Programación')}</button>
        </div>

        {loading ? (
          <div className="analytics-loading">{t('Loading...', 'Cargando...')}</div>
        ) : schedules.length === 0 ? (
          <div className="kc-empty">
            <p>{t('No schedules yet.', 'Aún no hay programaciones.')}</p>
            <button className="btn-primary" onClick={openCreate}>➕ {t('Add Schedule', 'Agregar Programación')}</button>
          </div>
        ) : (
          <div style={{ overflowY: 'auto', maxHeight: '500px' }}>
          <table className="analytics-table">
            <thead>
              <tr>
                <th>{t('Term', 'Término')}</th>
                <th>{t('Frequency', 'Frecuencia')}</th>
                <th>{t('Last Run', 'Última Ejecución')}</th>
                <th>{t('Next Run', 'Próxima Ejecución')}</th>
                <th>{t('Status', 'Estado')}</th>
                <th>{t('Actions', 'Acciones')}</th>
              </tr>
            </thead>
            <tbody>
              {displayedSchedules.map((s: any) => (
                  <tr key={s._id} className="clickable" onClick={() => navigate(`/knowledge-center/scheduled/${s._id}`)}>
                    <td><strong>{s.term}</strong></td>
                    <td>{scheduleLabel(s)}</td>
                    <td>{s.lastRunAt ? new Date(s.lastRunAt).toLocaleString() : '-'}</td>
                    <td>{s.nextRunAt ? new Date(s.nextRunAt).toLocaleString() : '-'}</td>
                  <td>
                    <span className={`tr-status-badge tr-status-${s.enabled ? 'approved' : 'rejected'}`}>
                      {s.enabled ? '🟢 On' : '🔴 Off'}
                    </span>
                  </td>
                  <td>
                    <button className="btn-secondary btn-sm" disabled={runningId === s._id} onClick={e => { e.stopPropagation(); handleRunNow(s._id); }}>
                      {runningId === s._id ? '⏳...' : '▶'} {t('Run', 'Ejecutar')}
                    </button>
                    <button className="btn-secondary btn-sm" style={{ marginLeft: 4 }} onClick={e => { e.stopPropagation(); openEdit(s); }}>
                      ✏️ {t('Edit', 'Editar')}
                    </button>
                    <button className="btn-secondary btn-sm" style={{ marginLeft: 4 }} onClick={e => { e.stopPropagation(); handleToggle(s); }}>
                      {s.enabled ? '🔴' : '🟢'}
                    </button>
                    <button className="btn-secondary btn-sm" style={{ marginLeft: 4 }} onClick={e => { e.stopPropagation(); handleDelete(s._id); }}>
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        {schedules.length > 10 && totalPages > 1 && (
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← {t('Prev', 'Anterior')}</button>
            <span>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t('Next', 'Siguiente')} →</button>
          </div>
        )}

        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
              <div className="modal-header">
                <h3>{editSchedule ? t('Edit Schedule', 'Editar Programación') : t('Add Schedule', 'Agregar Programación')}</h3>
              </div>
              <div className="modal-body">
                <div className="cms-form">
                  <div className="form-group">
                    <label>{t('Term', 'Término')}</label>
                    <input type="text" value={formData.term} onChange={e => setFormData({ ...formData, term: e.target.value })} disabled={!!editSchedule} />
                  </div>
                  <div className="form-group">
                    <label>{t('Frequency', 'Frecuencia')}</label>
                    <select value={formData.frequency} onChange={e => setFormData({ ...formData, frequency: e.target.value })}>
                      <option value="daily">{t('Daily', 'Diario')}</option>
                      <option value="weekly">{t('Weekly', 'Semanal')}</option>
                      <option value="monthly">{t('Monthly', 'Mensual')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Hour (0-23)', 'Hora (0-23)')}</label>
                    <input type="number" min={0} max={23} value={formData.scheduleHour} onChange={e => setFormData({ ...formData, scheduleHour: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="form-group">
                    <label>{t('Minute (0-59)', 'Minuto (0-59)')}</label>
                    <input type="number" min={0} max={59} value={formData.scheduleMinute} onChange={e => setFormData({ ...formData, scheduleMinute: parseInt(e.target.value) || 0 })} />
                  </div>
                  {formData.frequency === 'weekly' && (
                    <div className="form-group">
                      <label>{t('Day of week', 'Día de la semana')}</label>
                      <select value={formData.dayOfWeek} onChange={e => setFormData({ ...formData, dayOfWeek: parseInt(e.target.value) })}>
                        <option value={0}>{t('Sunday', 'Domingo')}</option>
                        <option value={1}>{t('Monday', 'Lunes')}</option>
                        <option value={2}>{t('Tuesday', 'Martes')}</option>
                        <option value={3}>{t('Wednesday', 'Miércoles')}</option>
                        <option value={4}>{t('Thursday', 'Jueves')}</option>
                        <option value={5}>{t('Friday', 'Viernes')}</option>
                        <option value={6}>{t('Saturday', 'Sábado')}</option>
                      </select>
                    </div>
                  )}
                  {formData.frequency === 'monthly' && (
                    <div className="form-group">
                      <label>{t('Day of month (1-28)', 'Día del mes (1-28)')}</label>
                      <input type="number" min={1} max={28} value={formData.dayOfMonth} onChange={e => setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) || 1 })} />
                    </div>
                  )}
                  <div className="form-group">
                    <label>
                      <input type="checkbox" checked={formData.notifyOnChanges} onChange={e => setFormData({ ...formData, notifyOnChanges: e.target.checked })} />
                      {' '}{t('Notify on changes', 'Notificar cambios')}
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowModal(false)}>{t('Cancel', 'Cancelar')}</button>
                <button className="btn-primary" onClick={handleSave}>{t('Save', 'Guardar')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
