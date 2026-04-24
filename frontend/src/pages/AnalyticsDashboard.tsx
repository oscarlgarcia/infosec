import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useApi } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import type {
  AnalyticsClientOverview,
  AnalyticsCoverageGaps,
  AnalyticsFreshness,
  AnalyticsOpportunities,
  AnalyticsOverview,
  AnalyticsQuestionClusters,
  AnalyticsQuality,
  AnalyticsRecommendations,
  AnalyticsTrends,
} from '../types';
import '../styles/App.css';

export function AnalyticsDashboardPage() {
  const apiFetch = useApi();
  const { language } = useLanguage();
  const [windowDays, setWindowDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [coverage, setCoverage] = useState<AnalyticsCoverageGaps | null>(null);
  const [quality, setQuality] = useState<AnalyticsQuality | null>(null);
  const [freshness, setFreshness] = useState<AnalyticsFreshness | null>(null);
  const [recommendations, setRecommendations] = useState<AnalyticsRecommendations | null>(null);
  const [trends, setTrends] = useState<AnalyticsTrends | null>(null);
  const [questionClusters, setQuestionClusters] = useState<AnalyticsQuestionClusters | null>(null);
  const [opportunities, setOpportunities] = useState<AnalyticsOpportunities | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientOverview, setClientOverview] = useState<AnalyticsClientOverview | null>(null);

  useEffect(() => {
    void fetchAnalytics();
  }, [windowDays]);

  useEffect(() => {
    void fetchClients();
  }, []);

  useEffect(() => {
    if (!selectedClientId) return;
    void fetchClientOverview(selectedClientId);
  }, [selectedClientId, windowDays]);

  const fetchClients = async () => {
    try {
      const response = await apiFetch('/clients');
      if (!response.ok) return;
      const data = await response.json();
      setClients(data);
      if (data.length > 0) {
        setSelectedClientId((current) => current || data[0].id);
      }
    } catch {
      setClients([]);
    }
  };

  const fetchClientOverview = async (clientId: string) => {
    try {
      const response = await apiFetch(`/analytics/client-overview?clientId=${clientId}&windowDays=${windowDays}`);
      if (!response.ok) throw new Error('client-overview');
      setClientOverview(await response.json());
    } catch {
      setClientOverview(null);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, coverageRes, qualityRes, freshnessRes, recommendationRes, trendsRes, clustersRes, opportunitiesRes] = await Promise.all([
        apiFetch(`/analytics/overview?windowDays=${windowDays}`),
        apiFetch(`/analytics/coverage-gaps?windowDays=${windowDays}`),
        apiFetch(`/analytics/quality?windowDays=${windowDays}`),
        apiFetch('/analytics/freshness?staleDays=365'),
        apiFetch('/analytics/recommendations?limit=12'),
        apiFetch(`/analytics/trends?windowDays=${windowDays}`),
        apiFetch(`/analytics/question-clusters?windowDays=${windowDays}&minCount=2`),
        apiFetch('/analytics/opportunities?limit=10'),
      ]);

      if (!overviewRes.ok || !coverageRes.ok || !qualityRes.ok || !freshnessRes.ok || !recommendationRes.ok || !trendsRes.ok || !clustersRes.ok || !opportunitiesRes.ok) {
        throw new Error(language === 'es' ? 'No se pudieron cargar las metricas' : 'Unable to load analytics');
      }

      setOverview(await overviewRes.json());
      setCoverage(await coverageRes.json());
      setQuality(await qualityRes.json());
      setFreshness(await freshnessRes.json());
      setRecommendations(await recommendationRes.json());
      setTrends(await trendsRes.json());
      setQuestionClusters(await clustersRes.json());
      setOpportunities(await opportunitiesRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analytics error');
    } finally {
      setLoading(false);
    }
  };

  const toPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  return (
    <Layout>
      <div className="analytics-page">
        <div className="analytics-header">
          <h1>{language === 'es' ? 'Dashboard de Analytics' : 'Analytics Dashboard'}</h1>
          <select
            className="analytics-window"
            value={windowDays}
            onChange={(event) => setWindowDays(Number(event.target.value))}
          >
            <option value={7}>7 {language === 'es' ? 'dias' : 'days'}</option>
            <option value={30}>30 {language === 'es' ? 'dias' : 'days'}</option>
            <option value={90}>90 {language === 'es' ? 'dias' : 'days'}</option>
          </select>
        </div>

        {loading && <div className="analytics-loading">{language === 'es' ? 'Cargando...' : 'Loading...'}</div>}
        {error && <div className="analytics-error">{error}</div>}

        {!loading && !error && overview && quality && coverage && freshness && recommendations && trends && questionClusters && opportunities && (
          <>
            <div className="analytics-cards">
              <article className="analytics-card">
                <h3>{language === 'es' ? 'Consultas' : 'Queries'}</h3>
                <strong>{overview.total_queries}</strong>
              </article>
              <article className="analytics-card">
                <h3>{language === 'es' ? 'Usuarios Activos' : 'Active Users'}</h3>
                <strong>{overview.unique_users}</strong>
              </article>
              <article className="analytics-card">
                <h3>{language === 'es' ? 'Sesiones' : 'Sessions'}</h3>
                <strong>{overview.sessions_started}</strong>
              </article>
              <article className="analytics-card">
                <h3>{language === 'es' ? 'Latencia p95' : 'Latency p95'}</h3>
                <strong>{overview.latency_p95_ms} ms</strong>
              </article>
              <article className="analytics-card">
                <h3>{language === 'es' ? 'Coste estimado' : 'Estimated cost'}</h3>
                <strong>${overview.cost_estimate.toFixed(4)}</strong>
              </article>
              <article className="analytics-card">
                <h3>{language === 'es' ? 'Con citas' : 'With citations'}</h3>
                <strong>{toPercent(quality.answer_with_citation_rate)}</strong>
              </article>
              <article className="analytics-card">
                <h3>{language === 'es' ? 'Aceptadas' : 'Accepted'}</h3>
                <strong>{toPercent(quality.accepted_rate)}</strong>
              </article>
              <article className="analytics-card">
                <h3>{language === 'es' ? 'Editadas' : 'Edited'}</h3>
                <strong>{toPercent(quality.edited_rate)}</strong>
              </article>
              <article className="analytics-card">
                <h3>{language === 'es' ? 'Docs obsoletos' : 'Stale docs'}</h3>
                <strong>{freshness.stale_documents_count}</strong>
              </article>
              <article className="analytics-card">
                <h3>{language === 'es' ? 'Docs no usados' : 'Unused docs'}</h3>
                <strong>{freshness.unused_documents_count}</strong>
              </article>
            </div>

            <div className="analytics-grid">
              <section className="analytics-panel">
                <h2>{language === 'es' ? 'Top dominios' : 'Top domains'}</h2>
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>{language === 'es' ? 'Dominio' : 'Domain'}</th>
                      <th>{language === 'es' ? 'Consultas' : 'Queries'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.top_domains.map((item) => (
                      <tr key={item.domain}>
                        <td>{item.domain}</td>
                        <td>{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="analytics-panel">
                <h2>{language === 'es' ? 'Cobertura por dominio' : 'Coverage by domain'}</h2>
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>{language === 'es' ? 'Dominio' : 'Domain'}</th>
                      <th>{language === 'es' ? 'Covered' : 'Covered'}</th>
                      <th>{language === 'es' ? 'Partial' : 'Partial'}</th>
                      <th>{language === 'es' ? 'Uncovered' : 'Uncovered'}</th>
                      <th>{language === 'es' ? 'Contradictory' : 'Contradictory'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverage.coverage_rate_by_domain.map((row) => (
                      <tr key={row.domain}>
                        <td>{row.domain}</td>
                        <td>{row.covered}</td>
                        <td>{row.partial}</td>
                        <td>{row.uncovered}</td>
                        <td>{row.contradictory}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>

            <section className="analytics-panel">
              <h2>{language === 'es' ? 'Top gaps' : 'Top gaps'}</h2>
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>{language === 'es' ? 'Dominio' : 'Domain'}</th>
                    <th>{language === 'es' ? 'Pregunta' : 'Question'}</th>
                    <th>{language === 'es' ? 'Frecuencia' : 'Frequency'}</th>
                    <th>{language === 'es' ? 'Impacto' : 'Impact'}</th>
                    <th>{language === 'es' ? 'Estado' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.top_gap_items.slice(0, 15).map((item) => (
                    <tr key={item.gap_id}>
                      <td>{item.domain}</td>
                      <td>{item.question_example}</td>
                      <td>{item.frequency}</td>
                      <td>{item.impact_score}</td>
                      <td>{item.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <div className="analytics-grid">
              <section className="analytics-panel">
                <h2>{language === 'es' ? 'Question clusters' : 'Question clusters'}</h2>
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>{language === 'es' ? 'Cluster' : 'Cluster'}</th>
                      <th>{language === 'es' ? 'Frecuencia' : 'Count'}</th>
                      <th>{language === 'es' ? 'Dominio' : 'Domain'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questionClusters.clusters.slice(0, 10).map((cluster, index) => (
                      <tr key={`${cluster.cluster_key}-${index}`}>
                        <td>{cluster.cluster_key}</td>
                        <td>{cluster.count}</td>
                        <td>{cluster.top_domain}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="analytics-panel">
                <h2>{language === 'es' ? 'Opportunity scoring' : 'Opportunity scoring'}</h2>
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>{language === 'es' ? 'Dominio' : 'Domain'}</th>
                      <th>{language === 'es' ? 'Score' : 'Score'}</th>
                      <th>{language === 'es' ? 'Accion' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.opportunities.map((item) => (
                      <tr key={item.gap_id}>
                        <td>{item.domain}</td>
                        <td>{item.opportunity_score}</td>
                        <td>{item.recommended_action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>

            <div className="analytics-grid">
              <section className="analytics-panel">
                <h2>{language === 'es' ? 'Calidad por feedback' : 'Feedback quality'}</h2>
                <table className="analytics-table">
                  <tbody>
                    <tr>
                      <td>{language === 'es' ? 'Eventos feedback' : 'Feedback events'}</td>
                      <td>{quality.feedback_events}</td>
                    </tr>
                    <tr>
                      <td>{language === 'es' ? 'Discarded rate' : 'Discarded rate'}</td>
                      <td>{toPercent(quality.discarded_rate)}</td>
                    </tr>
                    <tr>
                      <td>{language === 'es' ? 'Copy rate' : 'Copy rate'}</td>
                      <td>{toPercent(quality.copy_answer_rate)}</td>
                    </tr>
                    <tr>
                      <td>{language === 'es' ? 'Export rate' : 'Export rate'}</td>
                      <td>{toPercent(quality.export_rate)}</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <section className="analytics-panel">
                <h2>{language === 'es' ? 'Tendencia diaria' : 'Daily trend'}</h2>
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>{language === 'es' ? 'Fecha' : 'Date'}</th>
                      <th>{language === 'es' ? 'Consultas' : 'Queries'}</th>
                      <th>{language === 'es' ? 'Coste' : 'Cost'}</th>
                      <th>{language === 'es' ? 'Latencia media' : 'Avg latency'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trends.series.slice(-15).map((row) => (
                      <tr key={row.date}>
                        <td>{row.date}</td>
                        <td>{row.queries}</td>
                        <td>${row.cost.toFixed(4)}</td>
                        <td>{row.avg_latency_ms} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="analytics-panel">
                <h2>{language === 'es' ? 'Recomendaciones V2' : 'V2 recommendations'}</h2>
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>{language === 'es' ? 'Prioridad' : 'Priority'}</th>
                      <th>{language === 'es' ? 'Tipo' : 'Type'}</th>
                      <th>{language === 'es' ? 'Accion' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recommendations.recommendations.map((row, index) => (
                      <tr key={`${row.type}-${index}`}>
                        <td>{row.priority}</td>
                        <td>{row.type}</td>
                        <td>
                          <strong>{row.title}</strong>
                          <div>{row.detail}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>

            <section className="analytics-panel">
              <div className="analytics-header">
                <h2>{language === 'es' ? 'Drill-down por cliente' : 'Client drill-down'}</h2>
                <select
                  className="analytics-window"
                  value={selectedClientId}
                  onChange={(event) => setSelectedClientId(event.target.value)}
                >
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              {clientOverview ? (
                <table className="analytics-table">
                  <tbody>
                    <tr>
                      <td>{language === 'es' ? 'Consultas cliente' : 'Client queries'}</td>
                      <td>{clientOverview.total_queries}</td>
                    </tr>
                    <tr>
                      <td>{language === 'es' ? 'Sesiones cliente' : 'Client sessions'}</td>
                      <td>{clientOverview.sessions}</td>
                    </tr>
                    <tr>
                      <td>{language === 'es' ? 'Confianza media' : 'Avg confidence'}</td>
                      <td>{clientOverview.avg_confidence}</td>
                    </tr>
                    <tr>
                      <td>{language === 'es' ? 'Legal review rate' : 'Legal review rate'}</td>
                      <td>{toPercent(clientOverview.legal_review_rate)}</td>
                    </tr>
                    <tr>
                      <td>{language === 'es' ? 'Contradiction rate' : 'Contradiction rate'}</td>
                      <td>{toPercent(clientOverview.contradiction_rate)}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <div className="analytics-loading">{language === 'es' ? 'Sin datos de cliente' : 'No client data'}</div>
              )}
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
