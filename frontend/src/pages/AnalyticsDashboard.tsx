import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useApi } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
  AnalyticsTemporalPatterns,
  AnalyticsClientActivity,
  AnalyticsRequestMetrics,
  AnalyticsKanbanMetrics,
  AnalyticsAgentPerformance,
} from '../types';
import '../styles/App.css';

const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

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
  const [temporalPatterns, setTemporalPatterns] = useState<AnalyticsTemporalPatterns | null>(null);
  const [clientActivity, setClientActivity] = useState<AnalyticsClientActivity | null>(null);
  const [requestMetrics, setRequestMetrics] = useState<AnalyticsRequestMetrics | null>(null);
  const [kanbanMetrics, setKanbanMetrics] = useState<AnalyticsKanbanMetrics | null>(null);
  const [agentPerformance, setAgentPerformance] = useState<AnalyticsAgentPerformance | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientOverview, setClientOverview] = useState<AnalyticsClientOverview | null>(null);
  const [viewMode, setViewMode] = useState<Record<string, 'chart' | 'table'>>({
    temporal: 'chart', client: 'chart', request: 'chart', kanban: 'chart', agent: 'chart'
  });

  const toggleView = (key: string) => setViewMode(prev => ({
    ...prev, [key]: prev[key] === 'chart' ? 'table' : 'chart'
  }));

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
      const response = await apiFetch('/api/clients');
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
      const response = await apiFetch(`/api/analytics/client-overview?clientId=${clientId}&windowDays=${windowDays}`);
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
      const [overviewRes, coverageRes, qualityRes, freshnessRes, recommendationRes, trendsRes, clustersRes, opportunitiesRes, tempPatternsRes, clientActRes, reqMetricsRes, kanbanRes, agentPerfRes] = await Promise.all([
        apiFetch(`/api/analytics/overview?windowDays=${windowDays}`),
        apiFetch(`/api/analytics/coverage-gaps?windowDays=${windowDays}`),
        apiFetch(`/api/analytics/quality?windowDays=${windowDays}`),
        apiFetch('/api/analytics/freshness?staleDays=365'),
        apiFetch('/api/analytics/recommendations?limit=12'),
        apiFetch(`/api/analytics/trends?windowDays=${windowDays}`),
        apiFetch(`/api/analytics/question-clusters?windowDays=${windowDays}&minCount=2`),
        apiFetch('/api/analytics/opportunities?limit=10'),
        apiFetch(`/api/analytics/temporal-patterns?windowDays=${windowDays}`),
        apiFetch(`/api/analytics/client-activity?windowDays=${windowDays}`),
        apiFetch(`/api/analytics/request-metrics?windowDays=${windowDays}`),
        apiFetch(`/api/analytics/kanban-metrics?windowDays=${windowDays}`),
        apiFetch(`/api/analytics/agent-performance?windowDays=${windowDays}`),
      ]);

      if (!overviewRes.ok || !coverageRes.ok || !qualityRes.ok || !freshnessRes.ok || !recommendationRes.ok || !trendsRes.ok || !clustersRes.ok || !opportunitiesRes.ok || !tempPatternsRes.ok || !clientActRes.ok || !reqMetricsRes.ok || !kanbanRes.ok || !agentPerfRes.ok) {
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
      setTemporalPatterns(await tempPatternsRes.json());
      setClientActivity(await clientActRes.json());
      setRequestMetrics(await reqMetricsRes.json());
      setKanbanMetrics(await kanbanRes.json());
      setAgentPerformance(await agentPerfRes.json());
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

        {!loading && !error && overview && quality && coverage && freshness && recommendations && trends && questionClusters && opportunities && temporalPatterns && clientActivity && requestMetrics && kanbanMetrics && agentPerformance && (
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

            {/* 5 KPI Sections */}
            {temporalPatterns && (
              <div className="analytics-grid">
                <section className="analytics-panel">
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {language === 'es' ? 'Patrones Temporales' : 'Temporal Patterns'}
                    <button onClick={() => toggleView('temporal')} className="btn-icon" title={viewMode.temporal === 'chart' ? 'Ver tabla' : 'Ver gráfico'}>
                      {viewMode.temporal === 'chart' ? '📋' : '📊'}
                    </button>
                  </h2>
                  <div className="analytics-cards">
                    <article className="analytics-card">
                      <h3>{language === 'es' ? 'Hora Pico' : 'Peak Hour'}</h3>
                      <strong>{temporalPatterns.peak_hour}:00</strong>
                    </article>
                    <article className="analytics-card">
                      <h3>{language === 'es' ? 'Tiempo Entre Msg' : 'Avg Gap Between Messages'}</h3>
                      <strong>{temporalPatterns.avg_gap_seconds}s</strong>
                    </article>
                  </div>
                  {viewMode.temporal === 'chart' ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={temporalPatterns.by_hour}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} />
                        <YAxis />
                        <Tooltip labelFormatter={(h) => `${h}:00`} />
                        <Line type="monotone" dataKey="count" stroke="#0088FE" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <table className="analytics-table">
                      <thead><tr><th>{language === 'es' ? 'Hora' : 'Hour'}</th><th>{language === 'es' ? 'Consultas' : 'Queries'}</th></tr></thead>
                      <tbody>{temporalPatterns.by_hour.filter(h => h.count > 0).map((item) => (<tr key={item.hour}><td>{item.hour}:00</td><td>{item.count}</td></tr>))}</tbody>
                    </table>
                  )}
                </section>
                <section className="analytics-panel">
                  <h2>{language === 'es' ? 'Consultas por Día' : 'Queries by Day of Week'}</h2>
                  {viewMode.temporal === 'chart' ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={temporalPatterns.by_day_of_week}>
                        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip />
                        <Bar dataKey="count" fill="#00C49F" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <table className="analytics-table">
                      <thead><tr><th>{language === 'es' ? 'Día' : 'Day'}</th><th>{language === 'es' ? 'Consultas' : 'Queries'}</th></tr></thead>
                      <tbody>{temporalPatterns.by_day_of_week.map((item) => (<tr key={item.day}><td>{item.day}</td><td>{item.count}</td></tr>))}</tbody>
                    </table>
                  )}
                </section>
              </div>
            )}

            {clientActivity && (
              <div className="analytics-grid">
                <section className="analytics-panel">
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {language === 'es' ? 'Actividad de Clientes' : 'Client Activity'}
                    <button onClick={() => toggleView('client')} className="btn-icon" title={viewMode.client === 'chart' ? 'Ver tabla' : 'Ver gráfico'}>
                      {viewMode.client === 'chart' ? '📋' : '📊'}
                    </button>
                  </h2>
                  <div className="analytics-cards">
                    <article className="analytics-card"><h3>{language === 'es' ? 'Clientes Activos' : 'Active Clients'}</h3><strong>{clientActivity.total_active_clients}</strong></article>
                    <article className="analytics-card"><h3>{language === 'es' ? 'Clientes en Riesgo' : 'At-Risk Clients'}</h3><strong>{clientActivity.at_risk_clients}</strong></article>
                  </div>
                  <h3>{language === 'es' ? 'Top Clientes' : 'Top Clients'}</h3>
                  {viewMode.client === 'chart' ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={clientActivity.top_clients.slice(0,10)} layout="vertical" margin={{ left: 100 }}>
                        <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="name" width={90} /><Tooltip />
                        <Bar dataKey="queries" fill="#0088FE" radius={[0,4,4,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <table className="analytics-table">
                      <thead><tr><th>{language === 'es' ? 'Cliente' : 'Client'}</th><th>{language === 'es' ? 'Tipo' : 'Type'}</th><th>{language === 'es' ? 'Consultas' : 'Queries'}</th><th>{language === 'es' ? 'Sesiones' : 'Sessions'}</th><th>{language === 'es' ? 'Promedio' : 'Avg/Session'}</th></tr></thead>
                      <tbody>{clientActivity.top_clients.slice(0,10).map((item) => (<tr key={item.client_id}><td>{item.name}</td><td>{item.client_type}</td><td>{item.queries}</td><td>{item.sessions}</td><td>{item.avg_queries_per_session}</td></tr>))}</tbody>
                    </table>
                  )}
                </section>
                <section className="analytics-panel">
                  <h2>{language === 'es' ? 'Por Tipo de Cliente' : 'By Client Type'}</h2>
                  {viewMode.client === 'chart' ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={clientActivity.by_client_type} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={70} label>
                          {clientActivity.by_client_type.map((_, idx) => (<Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />))}
                        </Pie>
                        <Tooltip /><Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <table className="analytics-table">
                      <thead><tr><th>{language === 'es' ? 'Tipo' : 'Type'}</th><th>{language === 'es' ? 'Consultas' : 'Queries'}</th></tr></thead>
                      <tbody>{clientActivity.by_client_type.map((item) => (<tr key={item.type}><td>{item.type}</td><td>{item.count}</td></tr>))}</tbody>
                    </table>
                  )}
                </section>
              </div>
            )}

            {requestMetrics && (
              <div className="analytics-grid">
                <section className="analytics-panel">
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {language === 'es' ? 'Métricas de Solicitudes' : 'Request Metrics'}
                    <button onClick={() => toggleView('request')} className="btn-icon" title={viewMode.request === 'chart' ? 'Ver tabla' : 'Ver gráfico'}>
                      {viewMode.request === 'chart' ? '📋' : '📊'}
                    </button>
                  </h2>
                  <div className="analytics-cards">
                    <article className="analytics-card"><h3>{language === 'es' ? 'Total Solicitudes' : 'Total Requests'}</h3><strong>{requestMetrics.total_requests}</strong></article>
                    <article className="analytics-card"><h3>{language === 'es' ? 'SLA Cumplido' : 'SLA Compliance'}</h3><strong>{requestMetrics.sla_compliance_pct}%</strong></article>
                    <article className="analytics-card"><h3>{language === 'es' ? 'Vencidas' : 'Overdue'}</h3><strong>{requestMetrics.overdue_count}</strong></article>
                    <article className="analytics-card"><h3>{language === 'es' ? 'Resolución Promedio' : 'Avg Resolution'}</h3><strong>{requestMetrics.avg_resolution_days} {language === 'es' ? 'días' : 'days'}</strong></article>
                  </div>
                  <h3>{language === 'es' ? 'Por Tipo' : 'By Type'}</h3>
                  {viewMode.request === 'chart' ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={requestMetrics.by_type} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={80} label>
                          {requestMetrics.by_type.map((_, idx) => (<Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />))}
                        </Pie>
                        <Tooltip /><Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <table className="analytics-table">
                      <thead><tr><th>{language === 'es' ? 'Tipo' : 'Type'}</th><th>{language === 'es' ? 'Cantidad' : 'Count'}</th></tr></thead>
                      <tbody>{requestMetrics.by_type.map((item) => (<tr key={item.type}><td>{item.type}</td><td>{item.count}</td></tr>))}</tbody>
                    </table>
                  )}
                </section>
                <section className="analytics-panel">
                  <h2>{language === 'es' ? 'Por Estado' : 'By Status'}</h2>
                  {viewMode.request === 'chart' ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={requestMetrics.by_status} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label>
                          {requestMetrics.by_status.map((_, idx) => (<Cell key={idx} fill={CHART_COLORS[(idx + 3) % CHART_COLORS.length]} />))}
                        </Pie>
                        <Tooltip /><Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <table className="analytics-table">
                      <thead><tr><th>{language === 'es' ? 'Estado' : 'Status'}</th><th>{language === 'es' ? 'Cantidad' : 'Count'}</th></tr></thead>
                      <tbody>{requestMetrics.by_status.map((item) => (<tr key={item.status}><td>{item.status}</td><td>{item.count}</td></tr>))}</tbody>
                    </table>
                  )}
                </section>
                <section className="analytics-panel">
                  <h2>{language === 'es' ? 'Carga por Responsable' : 'Workload by Owner'}</h2>
                  {viewMode.request === 'chart' ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={requestMetrics.workload_by_owner} layout="vertical" margin={{ left: 100 }}>
                        <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="owner" width={90} /><Tooltip />
                        <Bar dataKey="count" fill="#FF8042" radius={[0,4,4,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <table className="analytics-table">
                      <thead><tr><th>{language === 'es' ? 'Responsable' : 'Owner'}</th><th>{language === 'es' ? 'Pendientes' : 'Pending'}</th></tr></thead>
                      <tbody>{requestMetrics.workload_by_owner.map((item) => (<tr key={item.owner}><td>{item.owner}</td><td>{item.count}</td></tr>))}</tbody>
                    </table>
                  )}
                </section>
              </div>
            )}

            {kanbanMetrics && (
              <div className="analytics-grid">
                <section className="analytics-panel">
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {language === 'es' ? 'Métricas de Kanban' : 'Kanban Metrics'}
                    <button onClick={() => toggleView('kanban')} className="btn-icon" title={viewMode.kanban === 'chart' ? 'Ver tabla' : 'Ver gráfico'}>
                      {viewMode.kanban === 'chart' ? '📋' : '📊'}
                    </button>
                  </h2>
                  <div className="analytics-cards">
                    <article className="analytics-card"><h3>{language === 'es' ? 'Total Tareas' : 'Total Tasks'}</h3><strong>{kanbanMetrics.total_tasks}</strong></article>
                    <article className="analytics-card"><h3>{language === 'es' ? 'Vencidas' : 'Overdue'}</h3><strong>{kanbanMetrics.overdue_count}</strong></article>
                  </div>
                  <h3>{language === 'es' ? 'Por Estado' : 'By Status'}</h3>
                  {viewMode.kanban === 'chart' ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={kanbanMetrics.by_status}>
                        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="status" /><YAxis /><Tooltip />
                        <Bar dataKey="count" fill="#8884d8" radius={[4,4,0,0]}>
                          {kanbanMetrics.by_status.map((_, idx) => (<Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <table className="analytics-table">
                      <thead><tr><th>{language === 'es' ? 'Estado' : 'Status'}</th><th>{language === 'es' ? 'Cantidad' : 'Count'}</th></tr></thead>
                      <tbody>{kanbanMetrics.by_status.map((item) => (<tr key={item.status}><td>{item.status}</td><td>{item.count}</td></tr>))}</tbody>
                    </table>
                  )}
                </section>
                <section className="analytics-panel">
                  <h2>{language === 'es' ? 'Throughput Semanal' : 'Weekly Throughput'}</h2>
                  {viewMode.kanban === 'chart' ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={kanbanMetrics.throughput_weekly}>
                        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="week" /><YAxis /><Tooltip />
                        <Bar dataKey="count" fill="#00C49F" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <table className="analytics-table">
                      <thead><tr><th>{language === 'es' ? 'Semana' : 'Week'}</th><th>{language === 'es' ? 'Completadas' : 'Completed'}</th></tr></thead>
                      <tbody>{kanbanMetrics.throughput_weekly.map((item) => (<tr key={item.week}><td>{item.week}</td><td>{item.count}</td></tr>))}</tbody>
                    </table>
                  )}
                </section>
                <section className="analytics-panel">
                  <h2>{language === 'es' ? 'Cuello de Botella' : 'Bottleneck'}</h2>
                  <p><strong>{language === 'es' ? 'Lista con más tareas' : 'List with most tasks'}: </strong>{kanbanMetrics.bottleneck.list} ({kanbanMetrics.bottleneck.count})</p>
                  <h3>{language === 'es' ? 'Tiempo Promedio por Estado' : 'Avg Time by Status'}</h3>
                  {viewMode.kanban === 'chart' ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={kanbanMetrics.avg_time_by_status}>
                        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="status" /><YAxis /><Tooltip />
                        <Bar dataKey="avg_days" fill="#FFBB28" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <table className="analytics-table">
                      <thead><tr><th>{language === 'es' ? 'Estado' : 'Status'}</th><th>{language === 'es' ? 'Días Promedio' : 'Avg Days'}</th></tr></thead>
                      <tbody>{kanbanMetrics.avg_time_by_status.map((item) => (<tr key={item.status}><td>{item.status}</td><td>{item.avg_days}</td></tr>))}</tbody>
                    </table>
                  )}
                </section>
              </div>
            )}

            {agentPerformance && (
              <section className="analytics-panel">
                <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {language === 'es' ? 'Rendimiento de Agentes' : 'Agent Performance'}
                  <button onClick={() => toggleView('agent')} className="btn-icon" title={viewMode.agent === 'chart' ? 'Ver tabla' : 'Ver gráfico'}>
                    {viewMode.agent === 'chart' ? '📋' : '📊'}
                  </button>
                </h2>
                {viewMode.agent === 'chart' ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={agentPerformance.agents} layout="vertical" margin={{ left: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="agent" width={90} /><Tooltip />
                      <Bar dataKey="queries" fill="#8884d8" radius={[0,4,4,0]}>
                        {agentPerformance.agents.map((_, idx) => (<Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <table className="analytics-table">
                    <thead><tr><th>{language === 'es' ? 'Agente' : 'Agent'}</th><th>{language === 'es' ? 'Consultas' : 'Queries'}</th><th>{language === 'es' ? 'Confianza Prom' : 'Avg Confidence'}</th><th>{language === 'es' ? 'Latencia Prom' : 'Avg Latency'}</th><th>{language === 'es' ? 'Tasa Aceptación' : 'Acceptance Rate'}</th><th>{language === 'es' ? 'Tokens Totales' : 'Total Tokens'}</th><th>{language === 'es' ? 'Costo Est.' : 'Est. Cost'}</th></tr></thead>
                    <tbody>{agentPerformance.agents.map((item) => (<tr key={item.agent}><td>{item.agent}</td><td>{item.queries}</td><td>{item.avg_confidence}</td><td>{item.avg_latency_ms} ms</td><td>{toPercent(item.acceptance_rate)}</td><td>{item.total_tokens}</td><td>${item.cost_estimate}</td></tr>))}</tbody>
                  </table>
                )}
              </section>
            )}

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
