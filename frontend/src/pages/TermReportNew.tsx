import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useApi } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export function TermReportNew() {
  const apiFetch = useApi();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = (es: string, en: string) => language === 'es' ? es : en;

  const [term, setTerm] = useState('');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleGenerate = async () => {
    if (!term.trim()) return;
    setLoading(true);
    setError(null);
    setReport(null);
    setSaved(false);
    try {
      const res = await apiFetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: term.trim() }),
      });
      if (!res.ok) throw new Error(t('Failed to generate report', 'Error al generar reporte'));
      setReport(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!report) return;
    setSaving(true);
    try {
      const res = await apiFetch('/api/reports/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: report.term }),
      });
      if (!res.ok) throw new Error(t('Failed to save report', 'Error al guardar reporte'));
      const savedReport = await res.json();
      setSaved(true);
      setTimeout(() => navigate(`/knowledge-center/reports/${savedReport._id}`), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="tr-section">
      <h3 className="tr-section-title">{title}</h3>
      {children}
    </div>
  );

  return (
    <Layout>
      <Link to="/knowledge-center" className="back-link">← {t('Back', 'Volver')}</Link>
      <div className="term-report-new">
        <div className="kc-header">
          <h1>🔍 {t('New Term Report', 'Nuevo Reporte de Término')}</h1>
          <p>{t('Analyze a term across all knowledge sources', 'Analiza un término en todas las fuentes de conocimiento')}</p>
        </div>

        <div className="tr-search-bar">
          <input
            type="text"
            className="tr-search-input"
            placeholder={t('Enter a term... (e.g. SSL, Firewall, GDPR)', 'Ingresa un término... (ej: SSL, Firewall, GDPR)')}
            value={term}
            onChange={e => setTerm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
          />
          <button className="btn-primary" onClick={handleGenerate} disabled={loading || !term.trim()}>
            {loading ? t('Generating...', 'Generando...') : t('Generate Report', 'Generar Reporte')}
          </button>
        </div>

        {error && <div className="analytics-error">{error}</div>}

        {loading && (
          <div className="tr-loading">
            <div className="tr-skeleton" />
            <div className="tr-skeleton" />
            <div className="tr-skeleton" />
            <div className="tr-skeleton" />
          </div>
        )}

        {report && !loading && (
          <div className="tr-report">
            <div className="tr-report-header">
              <div>
                <h2>{t('Report for', 'Reporte para')} "{report.term}"</h2>
                <p className="tr-report-meta">
                  {report.metrics.totalSources} {t('sources', 'fuentes')} · {report.metrics.gapCount} {t('gaps', 'gaps')} · {report.metrics.canonicalCount} {t('canonical', 'canónicas')}
                </p>
              </div>
              <div className="tr-report-actions">
                <button className="btn-primary" onClick={handleSave} disabled={saving || saved}>
                  {saved ? '✅ ' + t('Saved!', '¡Guardado!') : saving ? t('Saving...', 'Guardando...') : '💾 ' + t('Save Report', 'Guardar Reporte')}
                </button>
                <button className="btn-secondary" onClick={() => navigate(`/knowledge-center/graph?term=${encodeURIComponent(report.term)}`)}>
                  🕸️ {t('View in Graph', 'Ver en Grafo')}
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
        )}
      </div>
    </Layout>
  );
}
