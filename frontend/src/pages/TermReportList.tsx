import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useApi } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export function TermReportList() {
  const apiFetch = useApi();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = (es: string, en: string) => language === 'es' ? es : en;

  const [reports, setReports] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    fetchReports();
  }, [page, search]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set('search', search);
      const res = await apiFetch(`/api/reports?${params}`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.items || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Error loading reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t('Delete this report?', '¿Eliminar este reporte?'))) return;
    try {
      const res = await apiFetch(`/api/reports/${id}`, { method: 'DELETE' });
      if (res.ok) fetchReports();
    } catch (err) {
      console.error('Error deleting report:', err);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <Layout>
      <Link to="/knowledge-center" className="back-link">← {t('Back', 'Volver')}</Link>
      <div className="term-report-list">
        <div className="kc-header">
          <h1>📋 {t('Saved Reports', 'Reportes Guardados')}</h1>
          <button className="btn-primary" onClick={() => navigate('/knowledge-center/reports/new')}>
            🔍 {t('New Report', 'Nuevo Reporte')}
          </button>
        </div>

        <div className="tr-filter-bar">
          <input
            type="text"
            className="tr-search-input"
            placeholder={t('Search by term...', 'Buscar por término...')}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {loading ? (
          <div className="analytics-loading">{t('Loading...', 'Cargando...')}</div>
        ) : reports.length === 0 ? (
          <div className="kc-empty">
            <p>{t('No saved reports yet.', 'Aún no hay reportes guardados.')}</p>
            <button className="btn-primary" onClick={() => navigate('/knowledge-center/reports/new')}>
              🔍 {t('Generate New Report', 'Generar Nuevo Reporte')}
            </button>
          </div>
        ) : (
          <>
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>{t('Term', 'Término')}</th>
                  <th>{t('Sources', 'Fuentes')}</th>
                  <th>{t('Gaps', 'Gaps')}</th>
                  <th>{t('Canonical', 'Canónicas')}</th>
                  <th>{t('Date', 'Fecha')}</th>
                  <th>{t('Actions', 'Acciones')}</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r: any) => (
                  <tr key={r._id} className="clickable" onClick={() => navigate(`/knowledge-center/reports/${r._id}`)}>
                    <td><strong>{r.term}</strong></td>
                    <td>{r.metrics?.totalSources || 0}</td>
                    <td>{r.metrics?.gapCount || 0}</td>
                    <td>{r.metrics?.canonicalCount || 0}</td>
                    <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button className="btn-secondary btn-sm" onClick={() => navigate(`/knowledge-center/reports/${r._id}`)}>
                        {t('View', 'Ver')}
                      </button>
                      <button className="btn-secondary btn-sm" style={{ marginLeft: 4 }} onClick={(e) => handleDelete(r._id, e)}>
                        {t('Delete', 'Eliminar')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="pagination">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← {t('Prev', 'Anterior')}</button>
                <span>{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t('Next', 'Siguiente')} →</button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
