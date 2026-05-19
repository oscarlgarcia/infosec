import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useApi, useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export function KnowledgeCenter() {
  const apiFetch = useApi();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = (es: string, en: string) => language === 'es' ? es : en;

  const hasAccess = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'sme';

  const [stats, setStats] = useState({ reports: 0, nodes: 0, schedules: 0, canonicals: 0 });
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [upcomingSchedules, setUpcomingSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportPage, setReportPage] = useState(1);
  const [schedulePage, setSchedulePage] = useState(1);

  useEffect(() => {
    if (!hasAccess) { setLoading(false); return; }
    async function load() {
      try {
        const [reportsRes, statsRes, schedulesRes, canonicalRes] = await Promise.all([
          apiFetch('/api/reports?pageSize=5'),
          apiFetch('/api/knowledge-graph/stats'),
          apiFetch('/api/reports/schedules?enabled=true'),
          apiFetch('/api/canonical-answers?pageSize=1'),
        ]);
        const reportsData = reportsRes.ok ? await reportsRes.json() : { items: [], total: 0 };
        const statsData = statsRes.ok ? await statsRes.json() : { totalNodes: 0 };
        const schedulesData = schedulesRes.ok ? await schedulesRes.json() : [];
        const canonicalData = canonicalRes.ok ? await canonicalRes.json() : { total: 0 };

        setRecentReports(reportsData.items || []);
        setUpcomingSchedules((schedulesData || []).slice(0, 3));
        setStats({
          reports: reportsData.total || 0,
          nodes: statsData.totalNodes || 0,
          schedules: (schedulesData || []).length,
          canonicals: canonicalData.total || 0,
        });
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="knowledge-center">
          <div className="kc-loading">{t('Cargando...', 'Loading...')}</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="knowledge-center">
        <div className="kc-header">
          <h1>🔬 {t('Knowledge Center', 'Centro de Conocimiento')}</h1>
          <p>{t('Visualiza, analiza y monitorea tu base de conocimiento', 'Visualize, analyze and monitor your knowledge base')}</p>
        </div>

        <div className="kc-stats-grid">
          <div className="kc-stat-card" onClick={() => navigate('/knowledge-center/reports')}>
            <span className="kc-stat-icon">📄</span>
            <span className="kc-stat-value">{stats.reports}</span>
            <span className="kc-stat-label">{t('Reports', 'Reportes')}</span>
          </div>
          <div className="kc-stat-card" onClick={() => navigate('/knowledge-center/graph')}>
            <span className="kc-stat-icon">🕸️</span>
            <span className="kc-stat-value">{stats.nodes}</span>
            <span className="kc-stat-label">{t('Nodes', 'Nodos')}</span>
          </div>
          <div className="kc-stat-card" onClick={() => navigate('/knowledge-center/scheduled')}>
            <span className="kc-stat-icon">📅</span>
            <span className="kc-stat-value">{stats.schedules}</span>
            <span className="kc-stat-label">{t('Schedules', 'Programados')}</span>
          </div>
          <div className="kc-stat-card" onClick={() => navigate('/knowledge-center/canonical')}>
            <span className="kc-stat-icon">⭐</span>
            <span className="kc-stat-value">{stats.canonicals}</span>
            <span className="kc-stat-label">{t('Canonical', 'Canónicas')}</span>
          </div>
        </div>

        <div className="kc-quick-actions">
          <button className="btn-primary" onClick={() => navigate('/knowledge-center/reports/new')}>
            🔍 {t('New Report', 'Nuevo Reporte')}
          </button>
          <button className="btn-secondary" onClick={() => navigate('/knowledge-center/graph')}>
            🕸️ {t('Explore Graph', 'Explorar Grafo')}
          </button>
          <button className="btn-secondary" onClick={() => navigate('/knowledge-center/scheduled')}>
            📅 {t('New Schedule', 'Nueva Programación')}
          </button>
        </div>

        <div className="kc-sections">
          <div className="kc-section">
            <h2>{t('Recent Reports', 'Reportes Recientes')}</h2>
            {recentReports.length === 0 ? (
              <div className="kc-empty">
                <p>{t('No reports yet. Generate your first one!', 'Aún no hay reportes. ¡Genera el primero!')}</p>
                <button className="btn-primary" onClick={() => navigate('/knowledge-center/reports/new')}>
                  🔍 {t('Generate Report', 'Generar Reporte')}
                </button>
              </div>
            ) : (
              <div className="kc-list" style={{ overflowY: 'auto', maxHeight: '400px' }}>
                {(recentReports.length > 15 ? recentReports.slice((reportPage - 1) * 10, reportPage * 10) : recentReports).map((r: any) => (
                  <div key={r._id} className="kc-list-item clickable" onClick={() => navigate(`/knowledge-center/reports/${r._id}`)}>
                    <span className="kc-list-term">{r.term}</span>
                    <span className="kc-list-meta">{r.metrics?.totalSources || 0} sources · {r.metrics?.gapCount || 0} gaps</span>
                    <span className="kc-list-date">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
                {recentReports.length > 15 && (
                  <div className="pagination" style={{ marginTop: 8 }}>
                    <button disabled={reportPage <= 1} onClick={() => setReportPage(p => p - 1)}>←</button>
                    <span>{reportPage} / {Math.ceil(recentReports.length / 10)}</span>
                    <button disabled={reportPage >= Math.ceil(recentReports.length / 10)} onClick={() => setReportPage(p => p + 1)}>→</button>
                  </div>
                )}
                <div className="kc-list-footer">
                  <span className="clickable" onClick={() => navigate('/knowledge-center/reports')}>
                    {t('View all →', 'Ver todos →')}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="kc-section">
            <h2>{t('Upcoming Scheduled', 'Próximos Programados')}</h2>
            {upcomingSchedules.length === 0 ? (
              <div className="kc-empty">
                <p>{t('No schedules yet.', 'Aún no hay programaciones.')}</p>
                <button className="btn-secondary" onClick={() => navigate('/knowledge-center/scheduled')}>
                  📅 {t('Create Schedule', 'Crear Programación')}
                </button>
              </div>
            ) : (
              <div className="kc-list" style={{ overflowY: 'auto', maxHeight: '400px' }}>
                {(upcomingSchedules.length > 15 ? upcomingSchedules.slice((schedulePage - 1) * 10, schedulePage * 10) : upcomingSchedules).map((s: any) => (
                  <div key={s._id} className="kc-list-item clickable" onClick={() => navigate(`/knowledge-center/scheduled/${s._id}`)}>
                    <span className="kc-list-term">🔄 {s.term}</span>
                    <span className="kc-list-meta">{s.frequency}</span>
                    <span className="kc-list-date">{s.nextRunAt ? new Date(s.nextRunAt).toLocaleDateString() : '-'}</span>
                  </div>
                ))}
                {upcomingSchedules.length > 15 && (
                  <div className="pagination" style={{ marginTop: 8 }}>
                    <button disabled={schedulePage <= 1} onClick={() => setSchedulePage(p => p - 1)}>←</button>
                    <span>{schedulePage} / {Math.ceil(upcomingSchedules.length / 10)}</span>
                    <button disabled={schedulePage >= Math.ceil(upcomingSchedules.length / 10)} onClick={() => setSchedulePage(p => p + 1)}>→</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
