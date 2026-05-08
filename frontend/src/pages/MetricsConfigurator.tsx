import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useApi } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import type { MetricConfiguration } from '../types';
import '../styles/App.css';

export function MetricsConfigurator() {
  const { language } = useLanguage();
  const apiFetch = useApi();
  const [metrics, setMetrics] = useState<MetricConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MetricConfiguration | null>(null);
  const [form, setForm] = useState<{
    metricId: string;
    name: string;
    nameEs: string;
    description: string;
    category: string;
    endpoint: string;
    chartType: string;
    isActive: boolean;
    order: number;
  }>({
    metricId: '',
    name: '',
    nameEs: '',
    description: '',
    category: 'temporal',
    endpoint: '',
    chartType: 'line',
    isActive: true,
    order: 0,
  });

  const loadMetrics = async () => {
    try {
      const res = await apiFetch('/api/metrics-config');
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (e) {
      console.error('Failed to load metrics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await apiFetch(`/api/metrics-config/${editing._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        await apiFetch('/api/metrics-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }
      setEditing(null);
      setForm({
        metricId: '',
        name: '',
        nameEs: '',
        description: '',
        category: 'temporal',
        endpoint: '',
        chartType: 'line',
        isActive: true,
        order: 0,
      });
      await loadMetrics();
    } catch (e) {
      console.error('Failed to save metric:', e);
    }
  };

  const handleEdit = (metric: MetricConfiguration) => {
    setEditing(metric);
    setForm({
      metricId: metric.metricId,
      name: metric.name,
      nameEs: metric.nameEs || '',
      description: metric.description || '',
      category: metric.category,
      endpoint: metric.endpoint,
      chartType: metric.chartType,
      isActive: metric.isActive,
      order: metric.order,
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === 'es' ? '¿Eliminar esta métrica?' : 'Delete this metric?')) return;
    try {
      await apiFetch(`/api/metrics-config/${id}`, { method: 'DELETE' });
      await loadMetrics();
    } catch (e) {
      console.error('Failed to delete metric:', e);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await apiFetch(`/api/metrics-config/${id}/toggle`, { method: 'PATCH' });
      await loadMetrics();
    } catch (e) {
      console.error('Failed to toggle metric:', e);
    }
  };

  if (loading) return <Layout><div className="analytics-loading">{language === 'es' ? 'Cargando...' : 'Loading...'}</div></Layout>;

  return (
    <Layout>
      <div className="settings-page">
        <h1 className="settings-title">
          {language === 'es' ? 'Configuración de Métricas' : 'Metrics Configuration'}
        </h1>

        <div className="settings-section">
          <h2>{editing ? (language === 'es' ? 'Editar Métrica' : 'Edit Metric') : (language === 'es' ? 'Nueva Métrica' : 'New Metric')}</h2>
          <form onSubmit={handleSubmit} className="settings-form">
            <div className="form-group">
              <label>Metric ID</label>
              <input
                type="text"
                value={form.metricId}
                onChange={(e) => setForm({ ...form, metricId: e.target.value })}
                required
                disabled={!!editing}
              />
            </div>
            <div className="form-group">
              <label>{language === 'es' ? 'Nombre (EN)' : 'Name (EN)'}</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>{language === 'es' ? 'Nombre (ES)' : 'Name (ES)'}</label>
              <input
                type="text"
                value={form.nameEs}
                onChange={(e) => setForm({ ...form, nameEs: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>{language === 'es' ? 'Descripción' : 'Description'}</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as any })}
              >
                <option value="temporal">Temporal</option>
                <option value="client">Client</option>
                <option value="request">Request</option>
                <option value="kanban">Kanban</option>
                <option value="agent">Agent</option>
              </select>
            </div>
            <div className="form-group">
              <label>Endpoint</label>
              <input
                type="text"
                value={form.endpoint}
                onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                placeholder="/analytics/..."
                required
              />
            </div>
            <div className="form-group">
              <label>Chart Type</label>
              <select
                value={form.chartType}
                onChange={(e) => setForm({ ...form, chartType: e.target.value as any })}
              >
                <option value="line">Line Chart</option>
                <option value="bar">Bar Chart</option>
                <option value="pie">Pie Chart</option>
                <option value="heatmap">Heatmap</option>
                <option value="stat">Stat Card</option>
              </select>
            </div>
            <div className="form-group">
              <label>Order</label>
              <input
                type="number"
                value={form.order}
                onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                {language === 'es' ? 'Activo' : 'Active'}
              </label>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary">
                {editing ? (language === 'es' ? 'Actualizar' : 'Update') : (language === 'es' ? 'Crear' : 'Create')}
              </button>
              {editing && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setEditing(null);
                    setForm({
                      metricId: '',
                      name: '',
                      nameEs: '',
                      description: '',
                      category: 'temporal',
                      endpoint: '',
                      chartType: 'line',
                      isActive: true,
                      order: 0,
                    });
                  }}
                >
                  {language === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="settings-section">
          <h2>{language === 'es' ? 'Métricas Configuradas' : 'Configured Metrics'}</h2>
          <table className="analytics-table">
            <thead>
              <tr>
                <th>{language === 'es' ? 'Nombre' : 'Name'}</th>
                <th>ID</th>
                <th>Category</th>
                <th>Chart</th>
                <th>Order</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {metrics.sort((a, b) => a.order - b.order).map((metric) => (
                <tr key={metric._id}>
                  <td>{language === 'es' && metric.nameEs ? metric.nameEs : metric.name}</td>
                  <td><code>{metric.metricId}</code></td>
                  <td>{metric.category}</td>
                  <td>{metric.chartType}</td>
                  <td>{metric.order}</td>
                  <td>
                    <button
                      className={`btn-${metric.isActive ? 'success' : 'secondary'}`}
                      onClick={() => handleToggle(metric._id)}
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      {metric.isActive ? (language === 'es' ? 'Activo' : 'Active') : (language === 'es' ? 'Inactivo' : 'Inactive')}
                    </button>
                  </td>
                  <td>
                    <button
                      className="btn-primary"
                      onClick={() => handleEdit(metric)}
                      style={{ padding: '4px 8px', marginRight: '4px' }}
                    >
                      {language === 'es' ? 'Editar' : 'Edit'}
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => handleDelete(metric._id)}
                      style={{ padding: '4px 8px' }}
                    >
                      {language === 'es' ? 'Eliminar' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
