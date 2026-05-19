import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useApi } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export function TermReportDetail() {
  const { id } = useParams<{ id: string }>();
  const apiFetch = useApi();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = (es: string, en: string) => language === 'es' ? es : en;

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch(`/api/reports/${id}`)
      .then(res => {
        if (!res.ok) throw new Error(t('Report not found', 'Reporte no encontrado'));
        return res.json();
      })
      .then(data => setReport(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm(t('Delete this report?', '¿Eliminar este reporte?'))) return;
    try {
      const res = await apiFetch(`/api/reports/${id}`, { method: 'DELETE' });
      if (res.ok) navigate('/knowledge-center/reports');
    } catch (err) {
      console.error('Error deleting report:', err);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="knowledge-center"><div className="analytics-loading">{t('Loading...', 'Cargando...')}</div></div>
      </Layout>
    );
  }

  if (error || !report) {
    return (
      <Layout>
        <div className="knowledge-center">
          <div className="analytics-error">{error || t('Report not found', 'Reporte no encontrado')}</div>
          <button className="btn-secondary" onClick={() => navigate('/knowledge-center/reports')}>
            ← {t('Back to reports', 'Volver a reportes')}
          </button>
        </div>
      </Layout>
    );
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="tr-section">
      <h3 className="tr-section-title">{title}</h3>
      {children}
    </div>
  );

  return (
    <Layout>
      <Link to="/knowledge-center/reports" className="back-link">← {t('Back to reports', 'Volver a reportes')}</Link>
      <div className="term-report-new">
        <div className="tr-report">
          <div className="tr-report-header">
            <div>
              <h2>{t('Report for', 'Reporte para')} "{report.term}"</h2>
              <p className="tr-report-meta">
                {report.metrics?.totalSources || 0} {t('sources', 'fuentes')} · {report.metrics?.gapCount || 0} {t('gaps', 'gaps')} · {report.metrics?.canonicalCount || 0} {t('canonical', 'canónicas')} · {new Date(report.createdAt || report.generatedAt).toLocaleString()}
              </p>
            </div>
            <div className="tr-report-actions">
              <button className="btn-secondary" onClick={() => navigate(`/knowledge-center/graph?term=${encodeURIComponent(report.term)}`)}>
                🕸️ {t('View in Graph', 'Ver en Grafo')}
              </button>
              <button className="btn-secondary" onClick={() => navigate(`/knowledge-center/scheduled?new=${encodeURIComponent(report.term)}`)}>
                📅 {t('Schedule this term', 'Programar este término')}
              </button>
              <button className="btn-secondary" style={{ color: '#dc2626' }} onClick={handleDelete}>
                🗑️ {t('Delete', 'Eliminar')}
              </button>
            </div>
          </div>

          <Section title={t('Definition', 'Definición')}>
            <p className="tr-definition">{report.definition}</p>
          </Section>

          {report.directQA?.length > 0 && (
            <Section title={`${t('Direct Q&A', 'QA Directas')} (${report.directQA.length})`}>
              <div className="tr-qa-list">
                {report.directQA.map((qa: any, i: number) => (
                  <div key={i} className="tr-qa-item">
                    <div className="tr-qa-header">
                      <span className="tr-qa-badge">{qa.sourceType.toUpperCase()}</span>
                      <strong>{qa.question}</strong>
                      <span className="tr-qa-score">{qa.score}%</span>
                    </div>
                    <p className="tr-qa-answer">{qa.answer}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {report.canonicalAnswers?.length > 0 && (
            <Section title={`${t('Canonical Answers', 'Respuestas Canónicas')} (${report.canonicalAnswers.length})`}>
              <div className="tr-canonical-list">
                {report.canonicalAnswers.map((c: any, i: number) => (
                  <div key={i} className="tr-canonical-item">
                    <div className="tr-canonical-header">
                      {c.status === 'approved' ? '✅' : c.status === 'draft' ? '⚠️' : '🚫'}
                      <strong>{c.question}</strong>
                      <span className={`tr-status-badge tr-status-${c.status}`}>{c.status}</span>
                    </div>
                    <p className="tr-canonical-answer">{c.currentAnswer}</p>
                    <p className="tr-canonical-meta">
                      {c.owner && `Owner: ${c.owner} · `}
                      {c.verified ? '✅ ' + t('Verified', 'Verificado') : '⚠️ ' + t('Not verified', 'No verificado')}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {report.sourcesUsed?.length > 0 && (
            <Section title={`${t('Sources Used', 'Fuentes Utilizadas')} (${report.sourcesUsed.length})`}>
              <div className="tr-sources-list">
                {report.sourcesUsed.map((s: any, i: number) => (
                  <div key={i} className="tr-source-chip">
                    <span className={`source-type-badge ${s.sourceType}`}>{s.sourceType.toUpperCase()}</span>
                    <span className="tr-source-title">{s.title}</span>
                    <span className="tr-source-score">{s.score}%</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {report.coverageGaps?.length > 0 && (
            <Section title={`${t('Coverage Gaps', 'Gaps de Cobertura')} (${report.coverageGaps.length})`}>
              <div className="tr-gaps-list">
                {report.coverageGaps.map((g: any, i: number) => (
                  <div key={i} className="tr-gap-item">
                    <div className="tr-gap-header">
                      <span className="tr-gap-severity">🟡</span>
                      <strong>{g.topic}</strong>
                      <span className="tr-gap-impact">{t('Impact', 'Impacto')}: {g.impactScore}/10</span>
                    </div>
                    <p className="tr-gap-rec">{t('Recommendation', 'Recomendación')}: {g.recommendation}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title={t('Summary', 'Resumen')}>
            <p className="tr-summary">{report.summary}</p>
          </Section>
        </div>
      </div>
    </Layout>
  );
}
