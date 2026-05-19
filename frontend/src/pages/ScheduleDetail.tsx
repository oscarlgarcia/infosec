import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useApi } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export function ScheduleDetail() {
  const { id } = useParams<{ id: string }>();
  const apiFetch = useApi();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = (es: string, en: string) => language === 'es' ? es : en;

  const [schedule, setSchedule] = useState<any>(null);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiFetch('/api/reports/schedules'),
      apiFetch(`/api/reports/snapshots?scheduleId=${id}&limit=20`),
    ]).then(async ([schedRes, snapRes]) => {
      if (schedRes.ok) {
        const all: any[] = await schedRes.json();
        setSchedule(all.find((s: any) => s._id === id));
      }
      if (snapRes.ok) { setSnapshots(await snapRes.json()); setPage(1); }
    }).finally(() => setLoading(false));
  }, [id]);

  const handleRunNow = async () => {
    try {
      const res = await apiFetch(`/api/reports/schedules/${id}/run-now`, { method: 'POST' });
      if (res.ok) {
        alert(t('Snapshot generated!', '¡Snapshot generado!'));
        window.location.reload();
      }
    } catch (err) {
      console.error('Error running schedule:', err);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="knowledge-center"><div className="analytics-loading">{t('Loading...', 'Cargando...')}</div></div>
      </Layout>
    );
  }

  if (!schedule) {
    return (
      <Layout>
        <div className="knowledge-center">
          <div className="analytics-error">{t('Schedule not found', 'Programación no encontrada')}</div>
          <button className="btn-secondary" onClick={() => navigate('/knowledge-center/scheduled')}>
            ← {t('Back', 'Volver')}
          </button>
        </div>
      </Layout>
    );
  }

  const pageSize = 10;
  const totalPages = Math.ceil(snapshots.length / pageSize);
  const displayedSnapshots = snapshots.length > 15 ? snapshots.slice((page - 1) * pageSize, page * pageSize) : snapshots;

  return (
    <Layout>
      <div className="schedule-detail">
        <div className="kc-header">
          <h1>📅 {t('Schedule', 'Programación')}: "{schedule.term}"</h1>
          <Link to="/knowledge-center/scheduled" className="back-link" style={{ margin: 0 }}>
            ← {t('Back', 'Volver')}
          </Link>
        </div>

        <div className="sd-info">
          <div className="sd-info-grid">
            <div className="sd-info-item">
              <label>{t('Term', 'Término')}</label>
              <span>{schedule.term}</span>
            </div>
            <div className="sd-info-item">
              <label>{t('Frequency', 'Frecuencia')}</label>
              <span>{schedule.frequency}</span>
            </div>
            <div className="sd-info-item">
              <label>{t('Last Run', 'Última Ejecución')}</label>
              <span>{schedule.lastRunAt ? new Date(schedule.lastRunAt).toLocaleString() : '-'}</span>
            </div>
            <div className="sd-info-item">
              <label>{t('Next Run', 'Próxima Ejecución')}</label>
              <span>{schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleString() : '-'}</span>
            </div>
            <div className="sd-info-item">
              <label>{t('Status', 'Estado')}</label>
              <span className={`tr-status-badge tr-status-${schedule.enabled ? 'approved' : 'rejected'}`}>
                {schedule.enabled ? '🟢 ' + t('Active', 'Activo') : '🔴 ' + t('Inactive', 'Inactivo')}
              </span>
            </div>
            <div className="sd-info-item">
              <label>{t('Notify', 'Notificar')}</label>
              <span>{schedule.notifyOnChanges ? '✅ ' + t('Yes', 'Sí') : '❌ ' + t('No', 'No')}</span>
            </div>
          </div>
          <button className="btn-primary" onClick={handleRunNow}>
            ▶ {t('Run Now', 'Ejecutar Ahora')}
          </button>
        </div>

        <div className="sd-snapshots">
          <h2>{t('Snapshot History', 'Historial de Snapshots')} ({snapshots.length})</h2>

          {snapshots.length === 0 ? (
            <div className="kc-empty">
              <p>{t('No snapshots yet. Run now to generate the first.', 'Aún no hay snapshots. Ejecuta ahora para generar el primero.')}</p>
              <button className="btn-primary" onClick={handleRunNow}>
                ▶ {t('Run Now', 'Ejecutar Ahora')}
              </button>
            </div>
          ) : (
            <div className="sd-snapshot-list" style={{ overflowY: 'auto', maxHeight: '500px' }}>
              {displayedSnapshots.map((snap: any, idx: number) => {
                const prevSnap = idx < snapshots.length - 1 ? snapshots[idx + 1] : null;
                const m = snap.metrics || {};
                const prevM = prevSnap?.metrics || {};

                const diff = (field: string) => {
                  const curr = m[field] || 0;
                  const prev = prevM[field] || 0;
                  if (prev === curr) return null;
                  return { curr, prev, up: curr > prev };
                };

                return (
                  <div key={snap._id} className="sd-snapshot-item">
                    <div className="sd-snapshot-header">
                      <span className="sd-snapshot-date">{new Date(snap.generatedAt).toLocaleString()}</span>
                      <div className="sd-snapshot-metrics">
                        <span>{m.totalSources || 0} {t('sources', 'fuentes')}</span>
                        <span>{m.gapCount || 0} {t('gaps', 'gaps')}</span>
                        <span>{m.canonicalCount || 0} {t('canonical', 'canónicas')}</span>
                        <span>{m.avgConfidence || 0}% {t('conf.', 'conf.')}</span>
                      </div>
                    </div>
                    {prevSnap && (
                      <div className="sd-snapshot-diff">
                        {['totalSources', 'gapCount', 'contradictionCount', 'canonicalCount', 'avgConfidence'].map(f => {
                          const d = diff(f);
                          if (!d) return null;
                          return (
                            <span key={f} className={`sd-diff-${d.up ? 'up' : 'down'}`}>
                              {f}: {d.prev} → {d.curr}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {snapshots.length > 15 && totalPages > 1 && (
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← {t('Prev', 'Anterior')}</button>
              <span>{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t('Next', 'Siguiente')} →</button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
