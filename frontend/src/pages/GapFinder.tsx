import { useState } from 'react';
import { Layout } from '../components/Layout';
import { useApi } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

interface GapAnalysis {
  query: string;
  coverage: number;
  gapsFound: GapItem[];
  strengths: GapItem[];
  metrics: CoverageMetrics;
}

interface GapItem {
  id: string;
  title: string;
  source: 'qanda' | 'document';
  similarity: number;
  severity: 'high' | 'medium' | 'low';
  category?: string;
  department?: string;
}

interface CoverageMetrics {
  questionsAnalyzed: number;
  topicsCovered: number;
  gapsDetected: number;
  highSeverity: number;
  mediumSeverity: number;
  lowSeverity: number;
  avgDepthScore: number;
  topCategories: Record<string, number>;
}

const SAMPLE_QUERIES = [
  'password security policy',
  'SOC 2 compliance requirements',
  'data privacy GDPR',
  'incident response plan',
  'access control management'
];

export function GapFinderPage() {
  const { language } = useLanguage();
  const apiFetch = useApi();
  
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<GapAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = (es: string, en: string) => language === 'es' ? es : en;

  const handleSearch = async (searchQuery?: string) => {
    const finalQuery = searchQuery || query;
    if (!finalQuery || finalQuery.length < 2) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await apiFetch(`/gap-finder?q=${encodeURIComponent(finalQuery)}&topK=50`);
      
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
      } else {
        const err = await res.json();
        setError(err.error || 'Analysis failed');
      }
    } catch (e) {
      setError('Failed to analyze gap');
    } finally {
      setLoading(false);
    }
  };

  const handleQueryClick = (q: string) => {
    setQuery(q);
    handleSearch(q);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'high': return '#dc2626';
      case 'medium': return '#f59e0b';
      case 'low': return '#22c55e';
      default: return '#6b7280';
    }
  };

  const getSeverityBg = (severity: string) => {
    switch(severity) {
      case 'high': return '#fef2f2';
      case 'medium': return '#fffbeb';
      case 'low': return '#f0fdf4';
      default: return '#f9fafb';
    }
  };

  return (
    <Layout>
      <div className="gap-finder-page">
        <div className="gf-header">
          <h1>{t('Gap Finder', 'Buscador de Gaps')}</h1>
          <p>{t('Analyze your knowledge base to identify coverage gaps', 'Analiza tu base de conocimiento para identificar gaps de cobertura')}</p>
        </div>

        <div className="gf-search-section">
          <form onSubmit={handleSubmit} className="gf-search-form">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Enter topic, phrase or domain...', 'Ingresa tema, frase o dominio...')}
              className="gf-search-input"
            />
            <button type="submit" className="btn-primary" disabled={loading || !query}>
              {loading ? t('Analyzing...', 'Analizando...') : t('Analyze', 'Analizar')}
            </button>
          </form>

          <div className="gf-sample-queries">
            <span className="gf-sample-label">{t('Try:', 'Prueba:')}</span>
            {SAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                className="gf-sample-btn"
                onClick={() => handleQueryClick(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="gf-error">{error}</div>
        )}

        {analysis && (
          <>
            <div className="gf-coverage-header">
              <h2>{t('Results for:', 'Resultados para:')} "{analysis.query}"</h2>
            </div>

            <div className="gf-metrics-grid">
              <div className="gf-metric-card primary">
                <span className="gf-metric-value">{analysis.coverage}%</span>
                <span className="gf-metric-label">{t('Coverage', 'Cobertura')}</span>
              </div>
              <div className="gf-metric-card">
                <span className="gf-metric-value">{analysis.metrics.questionsAnalyzed}</span>
                <span className="gf-metric-label">{t('Questions Analyzed', 'Preguntas Analizadas')}</span>
              </div>
              <div className="gf-metric-card">
                <span className="gf-metric-value">{analysis.metrics.topicsCovered}</span>
                <span className="gf-metric-label">{t('Topics Covered', 'Temas Cubiertos')}</span>
              </div>
              <div className="gf-metric-card">
                <span className="gf-metric-value">{analysis.metrics.avgDepthScore}/5</span>
                <span className="gf-metric-label">{t('Avg Depth', 'Profundidad Prom')}</span>
              </div>
            </div>

            {analysis.strengths.length > 0 && (
              <div className="gf-section">
                <h3>
                  <span className="gf-section-icon strength">✓</span>
                  {t('Strengths (', 'Fortalezas (')} {analysis.strengths.length}
                </h3>
                <div className="gf-items-list">
                  {analysis.strengths.map((item) => (
                    <div key={item.id} className="gf-item strength-item">
                      <span className="gf-item-title">{item.title}</span>
                      <span className="gf-item-meta">
                        {item.source} • {Math.round(item.similarity * 100)}% match
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.gapsFound.length > 0 && (
              <div className="gf-section">
                <h3>
                  <span className="gf-section-icon gap">⚠</span>
                  {t('Gaps Detected (', 'Gaps Detectados (')} {analysis.gapsFound.length}
                </h3>
                
                <div className="gf-severity-summary">
                  {analysis.metrics.highSeverity > 0 && (
                    <span className="gf-severity-badge high">
                      {analysis.metrics.highSeverity} {t('High', 'Alto')}
                    </span>
                  )}
                  {analysis.metrics.mediumSeverity > 0 && (
                    <span className="gf-severity-badge medium">
                      {analysis.metrics.mediumSeverity} {t('Medium', 'Medio')}
                    </span>
                  )}
                  {analysis.metrics.lowSeverity > 0 && (
                    <span className="gf-severity-badge low">
                      {analysis.metrics.lowSeverity} {t('Low', 'Bajo')}
                    </span>
                  )}
                </div>

                <div className="gf-items-list">
                  {analysis.gapsFound.map((item) => (
                    <div 
                      key={item.id} 
                      className="gf-item gap-item"
                      style={{ 
                        borderLeftColor: getSeverityColor(item.severity),
                        backgroundColor: getSeverityBg(item.severity)
                      }}
                    >
                      <span className="gf-item-title">{item.title}</span>
                      <div className="gf-item-details">
                        <span className="gf-item-source">{item.source}</span>
                        <span className="gf-item-severity" style={{ color: getSeverityColor(item.severity)}}>
                          {item.severity.toUpperCase()}
                        </span>
                        {item.category && <span className="gf-item-category">{item.category}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(analysis.metrics.topCategories).length > 0 && (
              <div className="gf-section">
                <h3>{t('Top Categories', 'Categorías Principales')}</h3>
                <div className="gf-categories">
                  {Object.entries(analysis.metrics.topCategories).map(([cat, count]) => (
                    <div key={cat} className="gf-category">
                      <span className="gf-category-name">{cat}</span>
                      <span className="gf-category-count">{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!analysis && !loading && !error && (
          <div className="gf-empty">
            <p>{t('Enter a topic to analyze your knowledge base coverage', 'Ingresa un tema para analizar la cobertura de tu base de conocimiento')}</p>
          </div>
        )}
      </div>
    </Layout>
  );
}