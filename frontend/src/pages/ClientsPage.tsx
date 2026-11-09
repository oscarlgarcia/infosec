import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { clientsApi } from '../api/clients';
import type { Client } from '../types';
import { EmptyState, ErrorBanner, Loading } from '../components/request360/badges';

const CLIENT_STATUSES = ['prospect', 'active', 'strategic', 'at_risk', 'churned'] as const;
const CLIENT_PHASES = ['onboarding', 'active', 'renewal', 'offboarding'] as const;

export function ClientsPage() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const canManage = Boolean(user && ['admin', 'manager', 'sme'].includes(user.role));
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', clientType: 'Cloud', country: '', contact: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setClients(await clientsApi.list());
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return clients.filter((client) => {
      if (term && !`${client.name} ${client.country || ''} ${client.contact || ''}`.toLowerCase().includes(term)) {
        return false;
      }
      if (statusFilter && client.customerStatus !== statusFilter) return false;
      if (phaseFilter && client.currentPhase !== phaseFilter) return false;
      return true;
    });
  }, [clients, query, statusFilter, phaseFilter]);

  const kpis = useMemo(
    () => ({
      total: clients.length,
      active: clients.filter((client) => ['active', 'strategic'].includes(client.customerStatus || '')).length,
      atRisk: clients.filter((client) => client.customerStatus === 'at_risk').length,
      contracted: clients.filter((client) => client.contractSigned).length,
      cve: clients.filter((client) => client.cveSubscriptions?.enabled).length,
    }),
    [clients]
  );

  const createClient = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await clientsApi.create({
        name: form.name.trim(),
        clientType: form.clientType,
        country: form.country || undefined,
        contact: form.contact || undefined,
      });
      setForm({ name: '', clientType: 'Cloud', country: '', contact: '' });
      setShowCreate(false);
      await load();
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <Layout><div className="r360-page r360-page-scroll"><Loading lang={language} /></div></Layout>;
  }

  return (
    <Layout>
      <div className="r360-page r360-page-scroll">
        <div className="r360-page-header">
          <div>
            <h1>{language === 'es' ? 'Clientes' : 'Clients'}</h1>
            <p className="r360-subtitle">
              {language === 'es'
                ? 'Cada cliente, de extremo a extremo: solicitudes, contratos, SLA, CVE y documentación.'
                : 'Every client, end to end: requests, contracts, SLA, CVE and documentation.'}
            </p>
          </div>
          {canManage && (
            <div className="r360-header-actions">
              <button className="r360-btn r360-btn-primary" onClick={() => setShowCreate((value) => !value)}>
                + {language === 'es' ? 'Nuevo cliente' : 'New client'}
              </button>
            </div>
          )}
        </div>

        <ErrorBanner error={error} />

        <div className="r360-kpi-grid">
          <Kpi label={language === 'es' ? 'Clientes' : 'Clients'} value={kpis.total} />
          <Kpi label={language === 'es' ? 'Activos' : 'Active'} value={kpis.active} tone="success" />
          <Kpi label={language === 'es' ? 'En riesgo' : 'At risk'} value={kpis.atRisk} tone="danger" />
          <Kpi label={language === 'es' ? 'Con contrato' : 'Contracted'} value={kpis.contracted} tone="info" />
          <Kpi label={language === 'es' ? 'Suscripción CVE' : 'CVE subscription'} value={kpis.cve} />
        </div>

        {showCreate && (
          <div className="r360-card r360-section">
            <div className="r360-section-head">
              <h2>{language === 'es' ? 'Nuevo cliente' : 'New client'}</h2>
            </div>
            <div className="r360-filters">
              <input
                placeholder={language === 'es' ? 'Nombre' : 'Name'}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
              <select value={form.clientType} onChange={(event) => setForm({ ...form, clientType: event.target.value })}>
                <option value="Cloud">Cloud</option>
                <option value="Rent">Rent</option>
                <option value="PS">PS</option>
              </select>
              <input
                placeholder={language === 'es' ? 'País' : 'Country'}
                value={form.country}
                onChange={(event) => setForm({ ...form, country: event.target.value })}
              />
              <input
                placeholder={language === 'es' ? 'Contacto' : 'Contact'}
                value={form.contact}
                onChange={(event) => setForm({ ...form, contact: event.target.value })}
              />
              <button className="r360-btn r360-btn-primary" disabled={busy || !form.name.trim()} onClick={createClient}>
                {language === 'es' ? 'Crear' : 'Create'}
              </button>
            </div>
          </div>
        )}

        <div className="r360-filters">
          <input
            type="search"
            placeholder={language === 'es' ? 'Buscar cliente…' : 'Search clients…'}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">{language === 'es' ? 'Todos los estados' : 'All statuses'}</option>
            {CLIENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select value={phaseFilter} onChange={(event) => setPhaseFilter(event.target.value)}>
            <option value="">{language === 'es' ? 'Todas las fases' : 'All phases'}</option>
            {CLIENT_PHASES.map((phase) => <option key={phase} value={phase}>{phase}</option>)}
          </select>
          <span className="r360-muted">
            {filtered.length} {language === 'es' ? 'clientes' : 'clients'}
          </span>
        </div>

        <div className="r360-card r360-table-wrap">
          {filtered.length === 0 ? (
            <EmptyState
              icon="🏢"
              title={language === 'es' ? 'Sin clientes' : 'No clients'}
              text={language === 'es' ? 'Crea el primer cliente para empezar.' : 'Create the first client to get started.'}
            />
          ) : (
            <table className="r360-table">
              <thead>
                <tr>
                  <th>{language === 'es' ? 'Cliente' : 'Client'}</th>
                  <th>{language === 'es' ? 'Tipo' : 'Type'}</th>
                  <th>{language === 'es' ? 'País' : 'Country'}</th>
                  <th>{language === 'es' ? 'Estado' : 'Status'}</th>
                  <th>{language === 'es' ? 'Fase' : 'Phase'}</th>
                  <th>{language === 'es' ? 'Contrato' : 'Contract'}</th>
                  <th>{language === 'es' ? 'Modalidad' : 'Service model'}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <Link className="r360-link" to={`/clients/${client.id}`}>{client.name}</Link>
                      {client.contact && <div className="r360-muted">{client.contact}</div>}
                    </td>
                    <td>{client.clientType}</td>
                    <td>{client.country || '—'}</td>
                    <td>{client.customerStatus || '—'}</td>
                    <td>{client.currentPhase || '—'}</td>
                    <td>
                      <span className={`r360-badge ${client.contractSigned ? 'r360-status-delivered' : 'r360-status-new'}`}>
                        {client.contractSigned ? (language === 'es' ? 'Firmado' : 'Signed') : (language === 'es' ? 'Sin contrato' : 'No contract')}
                      </span>
                      {client.contractType && <div className="r360-muted">{client.contractType}</div>}
                    </td>
                    <td>{client.serviceModel || '—'}</td>
                    <td>
                      <Link className="r360-btn" to={`/clients/${client.id}`}>
                        {language === 'es' ? 'Ver ficha' : 'Open'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: 'info' | 'danger' | 'success' }) {
  return (
    <div className={`r360-kpi ${tone ? `r360-kpi-${tone}` : ''}`}>
      <div className="r360-kpi-value">{value}</div>
      <div className="r360-kpi-label">{label}</div>
    </div>
  );
}
