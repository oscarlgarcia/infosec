import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { dashboardApi } from '../api/dashboard';
import { clientsApi } from '../api/clients';
import { cveApi } from '../api/cve';
import { contractsApi } from '../api/contracts';
import { slaApi } from '../api/sla';
import type {
  BusinessCalendar,
  Client360,
  ClientSlaOverride,
  Contract,
  Request360,
  SlaPolicy,
  TechnologyInventoryItem,
} from '../types/request360';
import {
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  CONTRACT_TYPES,
  PRIORITIES,
  REQUEST_TYPE_OPTIONS,
  SERVICE_MODELS,
} from '../types/request360';
import {
  EmptyState,
  ErrorBanner,
  Loading,
  PriorityBadge,
  SeverityBadge,
  SlaBadge,
  StatusBadge,
  formatDate,
  formatDateTime,
} from '../components/request360/badges';
import { COUNTRIES, countryName } from '../constants/countries';
import { copyText, formatDirectoryError, isWindowsPath, normalizeLocalPath } from '../utils/directory';

type TabKey =
  | 'overview'
  | 'requests'
  | 'questions'
  | 'document-requests'
  | 'documents'
  | 'cve'
  | 'sla'
  | 'contracts'
  | 'inventory'
  | 'directory'
  | 'activity';

const TABS: Record<TabKey, { es: string; en: string }> = {
  overview: { es: 'Resumen', en: 'Overview' },
  requests: { es: 'Solicitudes', en: 'Requests' },
  questions: { es: 'Preguntas', en: 'Questions' },
  'document-requests': { es: 'Solicitudes de documentos', en: 'Document requests' },
  documents: { es: 'Documentos y entregables', en: 'Documents & deliverables' },
  cve: { es: 'Exposición CVE', en: 'CVE exposure' },
  sla: { es: 'SLA', en: 'SLA' },
  contracts: { es: 'Contratos', en: 'Contracts' },
  inventory: { es: 'Inventario', en: 'Inventory' },
  directory: { es: 'Directorio', en: 'Directory' },
  activity: { es: 'Actividad', en: 'Activity' },
};

const TAB_KEYS = Object.keys(TABS) as TabKey[];

const EMPTY_CONTRACT = {
  name: '',
  contractNumber: '',
  contractType: 'MSA',
  serviceModel: '',
  status: 'draft',
  signedAt: '',
  startDate: '',
  endDate: '',
  autoRenew: false,
  renewalNoticeDays: '',
  notes: '',
};

const EMPTY_OVERRIDE = {
  name: '',
  requestType: '',
  priority: '',
  responseHours: '',
  resolutionHours: '',
  atRiskThresholdPct: '',
  pauseOnWaitingClient: true,
  effectiveFrom: '',
  effectiveTo: '',
  active: true,
  reason: '',
};

const CUSTOMER_STATUS_OPTIONS = ['prospect', 'active', 'strategic', 'at_risk', 'churned'];
const CLIENT_PHASE_OPTIONS = ['onboarding', 'active', 'renewal', 'offboarding'];
const CLIENT_SERVICE_MODELS = ['cloud', 'rent', 'ps', 'hybrid'];

const EMPTY_CLIENT_PROFILE = {
  name: '',
  clientType: 'Cloud',
  country: '',
  contact: '',
  customerStatus: '',
  currentPhase: '',
  contractSigned: false,
  contractType: '',
  serviceModel: '',
  businessUnit: '',
  salesOwnerId: '',
  clientOwnerId: '',
  infosecOwnerId: '',
  infosecRepoUrl: '',
  tags: '',
};

export function Client360Page() {
  const { id, tab } = useParams<{ id: string; tab?: string }>();
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const activeTab: TabKey = TAB_KEYS.includes((tab || '') as TabKey) ? (tab as TabKey) : 'overview';

  const [data, setData] = useState<Client360 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<{ enabled: boolean; severityThreshold: string; recipients: string[] } | null>(null);
  const [inventory, setInventory] = useState<TechnologyInventoryItem[]>([]);
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [inventoryNotice, setInventoryNotice] = useState<string | null>(null);

  const [dirEditing, setDirEditing] = useState(false);
  const [dirBusy, setDirBusy] = useState(false);
  const [dirNotice, setDirNotice] = useState<string | null>(null);
  const [overviewNotice, setOverviewNotice] = useState<string | null>(null);
  const [dirForm, setDirForm] = useState({ localPath: '' });

  const [clientEditing, setClientEditing] = useState(false);
  const [clientBusy, setClientBusy] = useState(false);
  const [clientNotice, setClientNotice] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState({ ...EMPTY_CLIENT_PROFILE });

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractForm, setContractForm] = useState({ ...EMPTY_CONTRACT });
  const [contractBusy, setContractBusy] = useState(false);
  const [contractNotice, setContractNotice] = useState<string | null>(null);

  const [overrides, setOverrides] = useState<ClientSlaOverride[]>([]);
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [calendars, setCalendars] = useState<BusinessCalendar[]>([]);
  const [overrideForm, setOverrideForm] = useState({ ...EMPTY_OVERRIDE });
  const [overrideBusy, setOverrideBusy] = useState(false);
  const [overrideNotice, setOverrideNotice] = useState<string | null>(null);

  const canManage = Boolean(user && ['admin', 'manager', 'sme'].includes(user.role));
  const canManageDirectory = Boolean(user && ['admin', 'manager'].includes(user.role));

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await dashboardApi.client(id);
      setData(response);
      cveApi
        .getSubscription(id)
        .then((sub) => setSubscription({ enabled: sub.enabled, severityThreshold: sub.severityThreshold, recipients: sub.recipients }))
        .catch(() => undefined);
      cveApi
        .getTechnologyInventory(id)
        .then((result) => setInventory(result.items))
        .catch(() => undefined);
      contractsApi
        .list(id)
        .then((result) => setContracts(result.items))
        .catch(() => undefined);
      slaApi
        .listClientOverrides(id)
        .then((result) => setOverrides(result.items))
        .catch(() => undefined);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (activeTab !== 'sla') return;
    Promise.all([slaApi.listPolicies(), slaApi.listCalendars()])
      .then(([policyResponse, calendarResponse]) => {
        setPolicies(policyResponse.items);
        setCalendars(calendarResponse.items);
      })
      .catch(() => undefined);
  }, [activeTab]);

  const updateInventoryItem = (index: number, patch: Partial<TechnologyInventoryItem>) => {
    setInventory((items) => items.map((item, position) => (position === index ? { ...item, ...patch } : item)));
  };

  const addInventoryItem = () => {
    setInventory((items) => [...items, { vendor: '', product: '', version: '', criticality: 'medium' }]);
  };

  const removeInventoryItem = (index: number) => {
    setInventory((items) => items.filter((_, position) => position !== index));
  };

  const saveInventory = async () => {
    if (!id) return;
    setInventoryBusy(true);
    setInventoryNotice(null);
    setError(null);
    try {
      const cleaned = inventory
        .filter((item) => item.vendor?.trim() && item.product?.trim())
        .map((item) => ({ ...item, vendor: item.vendor.trim(), product: item.product.trim() }));
      const response = await cveApi.updateTechnologyInventory(id, cleaned);
      setInventory(response.items);
      setInventoryNotice(
        language === 'es'
          ? `Inventario guardado (${response.items.length} elemento(s)). Recalculando coincidencias en segundo plano.`
          : `Inventory saved (${response.items.length} item(s)). Recomputing matches in the background.`
      );
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setInventoryBusy(false);
    }
  };

  const rematchInventory = async () => {
    if (!id) return;
    setInventoryBusy(true);
    setInventoryNotice(null);
    setError(null);
    try {
      const response = await cveApi.rematchClient(id);
      setInventoryNotice(
        language === 'es'
          ? `Recalculadas ${response.changed} de ${response.scanned} CVEs.`
          : `Recomputed ${response.changed} of ${response.scanned} CVEs.`
      );
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setInventoryBusy(false);
    }
  };

  const startEditDirectory = () => {
    const directory = data?.client?.directory;
    setDirForm({ localPath: directory?.localPath || '' });
    setDirEditing(true);
    setDirNotice(null);
  };

  const saveDirectory = async () => {
    if (!id) return;
    const localPath = normalizeLocalPath(dirForm.localPath);
    if (!localPath) {
      setError(language === 'es' ? 'La ruta del directorio es obligatoria.' : 'The directory path is required.');
      return;
    }
    if (!isWindowsPath(localPath)) {
      setError(
        language === 'es'
          ? 'La ruta debe ser una ruta de Windows (C:\\... o \\\\servidor\\...).'
          : 'The path must be a Windows path (C:\\... or \\\\server\\...).'
      );
      return;
    }

    setDirBusy(true);
    setDirNotice(null);
    setError(null);
    try {
      await clientsApi.saveDirectory(id, { localPath });
      await load();
      setDirEditing(false);
      setDirNotice(language === 'es' ? 'Directorio guardado.' : 'Directory saved.');
    } catch (err: any) {
      setError(formatDirectoryError(err, language));
    } finally {
      setDirBusy(false);
    }
  };

  const removeDirectory = async () => {
    if (!id) return;
    const confirmed = window.confirm(
      language === 'es'
        ? '¿Quitar el directorio de este cliente?'
        : 'Remove the directory from this client?'
    );
    if (!confirmed) return;
    setDirBusy(true);
    setDirNotice(null);
    setError(null);
    try {
      await clientsApi.deleteDirectory(id);
      await load();
      setDirNotice(language === 'es' ? 'Directorio eliminado.' : 'Directory removed.');
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setDirBusy(false);
    }
  };

  const copyDirectoryPath = async (value: string) => {
    const copied = await copyText(value);
    setDirNotice(
      copied
        ? (language === 'es' ? 'Ruta copiada al portapapeles.' : 'Path copied to clipboard.')
        : (language === 'es' ? 'No se pudo copiar la ruta.' : 'Could not copy the path.')
    );
  };

  const copyOverviewPath = async (value: string) => {
    const copied = await copyText(value);
    setOverviewNotice(
      copied
        ? (language === 'es' ? 'Ruta copiada al portapapeles.' : 'Path copied to clipboard.')
        : (language === 'es' ? 'No se pudo copiar la ruta.' : 'Could not copy the path.')
    );
    window.setTimeout(() => setOverviewNotice(null), 4000);
  };

  const startEditClient = () => {
    const client = data?.client as any;
    const storedCountry = String(client?.country || '');
    const countryCode = COUNTRIES.find((country) =>
      [country.code, country.name, country.nameEn].includes(storedCountry)
    )?.code || '';

    setClientForm({
      name: client?.name || '',
      clientType: client?.clientType || 'Cloud',
      country: countryCode,
      contact: client?.contact || '',
      customerStatus: client?.customerStatus || '',
      currentPhase: client?.currentPhase || '',
      contractSigned: Boolean(client?.contractSigned),
      contractType: client?.contractType || '',
      serviceModel: client?.serviceModel || '',
      businessUnit: client?.businessUnit || '',
      salesOwnerId: client?.salesOwnerId || '',
      clientOwnerId: client?.clientOwnerId || '',
      infosecOwnerId: client?.infosecOwnerId || '',
      infosecRepoUrl: client?.infosecRepoUrl || '',
      tags: (client?.tags || []).join(', '),
    });
    setClientNotice(null);
    setClientEditing(true);
    goToTab('overview');
  };

  const saveClientProfile = async () => {
    if (!id || !clientForm.name.trim()) return;
    setClientBusy(true);
    setClientNotice(null);
    setError(null);
    try {
      await clientsApi.update(id, {
        name: clientForm.name.trim(),
        clientType: clientForm.clientType,
        country: clientForm.country || null,
        contact: clientForm.contact.trim() || null,
        customerStatus: clientForm.customerStatus || null,
        currentPhase: clientForm.currentPhase || null,
        contractSigned: clientForm.contractSigned,
        contractType: clientForm.contractType || null,
        serviceModel: clientForm.serviceModel || null,
        businessUnit: clientForm.businessUnit.trim() || null,
        tags: clientForm.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        salesOwnerId: clientForm.salesOwnerId.trim() || null,
        clientOwnerId: clientForm.clientOwnerId.trim() || null,
        infosecOwnerId: clientForm.infosecOwnerId.trim() || null,
        infosecRepoUrl: clientForm.infosecRepoUrl.trim() || null,
      });
      await load();
      setClientEditing(false);
      setClientNotice(language === 'es' ? 'Ficha del cliente guardada.' : 'Client profile saved.');
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setClientBusy(false);
    }
  };

  const createContract = async () => {
    if (!id || !contractForm.name.trim()) return;
    setContractBusy(true);
    setContractNotice(null);
    setError(null);
    try {
      await contractsApi.create(id, {
        ...contractForm,
        renewalNoticeDays: contractForm.renewalNoticeDays ? Number(contractForm.renewalNoticeDays) : undefined,
        signedAt: contractForm.signedAt || undefined,
        startDate: contractForm.startDate || undefined,
        endDate: contractForm.endDate || undefined,
        serviceModel: contractForm.serviceModel || undefined,
        notes: contractForm.notes || undefined,
      });
      setContractForm({ ...EMPTY_CONTRACT });
      setContractNotice(language === 'es' ? 'Contrato creado.' : 'Contract created.');
      const result = await contractsApi.list(id);
      setContracts(result.items);
      await load();
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setContractBusy(false);
    }
  };

  const signContract = async (contract: Contract) => {
    setContractBusy(true);
    setError(null);
    try {
      await contractsApi.sign(contract._id);
      if (id) {
        const result = await contractsApi.list(id);
        setContracts(result.items);
      }
      await load();
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setContractBusy(false);
    }
  };

  const renewContract = async (contract: Contract) => {
    setContractBusy(true);
    setContractNotice(null);
    setError(null);
    try {
      const start = contract.endDate ? new Date(contract.endDate) : new Date();
      const end = new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000);
      await contractsApi.renew(contract._id, {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        status: 'draft',
      });
      if (id) {
        const result = await contractsApi.list(id);
        setContracts(result.items);
      }
      setContractNotice(language === 'es' ? 'Renovación creada como borrador.' : 'Renewal created as draft.');
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setContractBusy(false);
    }
  };

  const cancelContract = async (contract: Contract) => {
    const reason = window.prompt(
      language === 'es' ? 'Motivo de la cancelación (opcional):' : 'Cancellation reason (optional):'
    );
    if (reason === null) return;
    setContractBusy(true);
    setError(null);
    try {
      await contractsApi.cancel(contract._id, { reason: reason || undefined });
      if (id) {
        const result = await contractsApi.list(id);
        setContracts(result.items);
      }
      await load();
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setContractBusy(false);
    }
  };

  const uploadContractAttachment = async (contract: Contract, file: File | null) => {
    if (!file) return;
    setContractBusy(true);
    setError(null);
    try {
      await contractsApi.uploadAttachment(contract._id, file);
      if (id) {
        const result = await contractsApi.list(id);
        setContracts(result.items);
      }
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setContractBusy(false);
    }
  };

  const createOverride = async () => {
    if (!id) return;
    setOverrideBusy(true);
    setOverrideNotice(null);
    setError(null);
    try {
      await slaApi.createClientOverride(id, {
        ...overrideForm,
        requestType: overrideForm.requestType || undefined,
        priority: overrideForm.priority || undefined,
        responseHours: overrideForm.responseHours ? Number(overrideForm.responseHours) : undefined,
        resolutionHours: overrideForm.resolutionHours ? Number(overrideForm.resolutionHours) : undefined,
        atRiskThresholdPct: overrideForm.atRiskThresholdPct ? Number(overrideForm.atRiskThresholdPct) : undefined,
        effectiveFrom: overrideForm.effectiveFrom || undefined,
        effectiveTo: overrideForm.effectiveTo || undefined,
        reason: overrideForm.reason || undefined,
      });
      setOverrideForm({ ...EMPTY_OVERRIDE });
      setOverrideNotice(language === 'es' ? 'Excepción de SLA creada.' : 'SLA exception created.');
      const result = await slaApi.listClientOverrides(id);
      setOverrides(result.items);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setOverrideBusy(false);
    }
  };

  const deleteOverride = async (override: ClientSlaOverride) => {
    if (!window.confirm(language === 'es' ? '¿Eliminar esta excepción?' : 'Delete this exception?')) return;
    setOverrideBusy(true);
    setError(null);
    try {
      await slaApi.deleteClientOverride(override._id);
      if (id) {
        const result = await slaApi.listClientOverrides(id);
        setOverrides(result.items);
      }
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setOverrideBusy(false);
    }
  };

  const goToTab = (key: TabKey) => navigate(`/clients/${id}/${key}`);

  const requestBuckets = useMemo(() => {
    const requests = data?.requests || [];
    return {
      questions: requests.filter((request) => request.requestKind === 'quick_query'),
      documentRequests: requests.filter(
        (request) => request.requestType === 'Document Request' || request.requestType === 'Certification Request'
      ),
    };
  }, [data]);

  const slaSummary = useMemo(() => {
    const requests = data?.requests || [];
    return {
      total: requests.length,
      onTrack: requests.filter((request) => request.slaState === 'on_track').length,
      atRisk: requests.filter((request) => request.slaState === 'at_risk').length,
      breached: requests.filter((request) => request.slaState === 'breached').length,
      paused: requests.filter((request) => request.slaState === 'paused').length,
    };
  }, [data]);

  if (loading) {
    return <Layout><div className="r360-page r360-page-scroll"><Loading lang={language} /></div></Layout>;
  }

  if (!data) {
    return (
      <Layout>
        <div className="r360-page r360-page-scroll">
          <ErrorBanner error={error || (language === 'es' ? 'Cliente no encontrado' : 'Client not found')} />
          <button className="r360-btn" onClick={() => navigate('/clients')}>← {language === 'es' ? 'Clientes' : 'Clients'}</button>
        </div>
      </Layout>
    );
  }

  const client: any = data.client;
  const metrics = data.metrics;
  const clientId = client._id || client.id;
  const activeContracts = contracts.filter((contract) => contract.status === 'active');
  const latestContract = contracts[0];

  return (
    <Layout>
      <div className="r360-page r360-page-scroll">
        <div className="r360-page-header">
          <div>
            <div className="r360-detail-topline">
              <span className="r360-badge r360-status-new">{client.clientType || 'Client'}</span>
              {client.customerStatus && <span className="r360-badge r360-status-working">{client.customerStatus}</span>}
              {client.currentPhase && <span className="r360-badge r360-status-delivered">{client.currentPhase}</span>}
            </div>
            <h1>{client.name}</h1>
            <p className="r360-subtitle">
              {[countryName(client.country, language), client.businessUnit, client.contractType, client.serviceModel].filter(Boolean).join(' · ')
                || (language === 'es' ? 'Vista 360 del cliente' : 'Client 360 view')}
            </p>
          </div>
          <div className="r360-header-actions">
            <button className="r360-btn" onClick={() => navigate('/clients')}>← {language === 'es' ? 'Clientes' : 'Clients'}</button>
            {canManageDirectory && !clientEditing && (
              <button className="r360-btn" onClick={startEditClient}>
                {language === 'es' ? 'Editar ficha' : 'Edit profile'}
              </button>
            )}
            <Link className="r360-btn r360-btn-primary" to={`/requests/new?clientId=${clientId}`}>
              + {language === 'es' ? 'Nueva solicitud' : 'New request'}
            </Link>
          </div>
        </div>

        <ErrorBanner error={error} />
        {clientNotice && <div className="r360-success">{clientNotice}</div>}

        <div className="r360-tabs">
          {TAB_KEYS.map((key) => (
            <button key={key} className={`r360-tab ${activeTab === key ? 'active' : ''}`} onClick={() => goToTab(key)}>
              {TABS[key][language]}
              {key === 'requests' && <span className="r360-tab-count">{data.requests.length}</span>}
              {key === 'questions' && <span className="r360-tab-count">{requestBuckets.questions.length}</span>}
              {key === 'document-requests' && <span className="r360-tab-count">{requestBuckets.documentRequests.length}</span>}
              {key === 'documents' && <span className="r360-tab-count">{data.documents.length + data.deliverables.length}</span>}
              {key === 'cve' && <span className="r360-tab-count">{data.cveImpacts.length}</span>}
              {key === 'contracts' && <span className="r360-tab-count">{contracts.length}</span>}
              {key === 'inventory' && <span className="r360-tab-count">{inventory.length}</span>}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div>
            {clientEditing && (
              <div className="r360-card r360-section r360-client-form">
                <div className="r360-section-head">
                  <h2>{language === 'es' ? 'Editar ficha del cliente' : 'Edit client profile'}</h2>
                </div>

                <div className="r360-form-grid">
                  <label className="r360-field">
                    {language === 'es' ? 'Nombre' : 'Name'}
                    <input
                      value={clientForm.name}
                      onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })}
                    />
                  </label>
                  <label className="r360-field">
                    {language === 'es' ? 'Tipo' : 'Type'}
                    <select
                      value={clientForm.clientType}
                      onChange={(event) => setClientForm({ ...clientForm, clientType: event.target.value })}
                    >
                      {['Cloud', 'Rent', 'PS'].map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                  <label className="r360-field">
                    {language === 'es' ? 'País' : 'Country'}
                    <select
                      value={clientForm.country}
                      onChange={(event) => setClientForm({ ...clientForm, country: event.target.value })}
                    >
                      <option value="">—</option>
                      {COUNTRIES.map((country) => (
                        <option key={country.code} value={country.code}>
                          {language === 'es' ? country.name : country.nameEn}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="r360-field">
                    {language === 'es' ? 'Contacto' : 'Contact'}
                    <input
                      value={clientForm.contact}
                      onChange={(event) => setClientForm({ ...clientForm, contact: event.target.value })}
                    />
                  </label>
                  <label className="r360-field">
                    {language === 'es' ? 'Estado del cliente' : 'Customer status'}
                    <select
                      value={clientForm.customerStatus}
                      onChange={(event) => setClientForm({ ...clientForm, customerStatus: event.target.value })}
                    >
                      <option value="">—</option>
                      {CUSTOMER_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                  <label className="r360-field">
                    {language === 'es' ? 'Fase' : 'Phase'}
                    <select
                      value={clientForm.currentPhase}
                      onChange={(event) => setClientForm({ ...clientForm, currentPhase: event.target.value })}
                    >
                      <option value="">—</option>
                      {CLIENT_PHASE_OPTIONS.map((phase) => (
                        <option key={phase} value={phase}>{phase}</option>
                      ))}
                    </select>
                  </label>
                  <label className="r360-field">
                    {language === 'es' ? 'Unidad de negocio' : 'Business unit'}
                    <input
                      value={clientForm.businessUnit}
                      onChange={(event) => setClientForm({ ...clientForm, businessUnit: event.target.value })}
                    />
                  </label>
                  <label className="r360-field">
                    {language === 'es' ? 'Tags (separados por coma)' : 'Tags (comma separated)'}
                    <input
                      value={clientForm.tags}
                      onChange={(event) => setClientForm({ ...clientForm, tags: event.target.value })}
                    />
                  </label>
                  <div className="r360-field">
                    {language === 'es' ? 'Contrato firmado' : 'Contract signed'}
                    <label className="r360-checkbox">
                      <input
                        type="checkbox"
                        checked={clientForm.contractSigned}
                        onChange={(event) => setClientForm({ ...clientForm, contractSigned: event.target.checked })}
                      />
                      {clientForm.contractSigned
                        ? (language === 'es' ? 'Sí' : 'Yes')
                        : (language === 'es' ? 'No' : 'No')}
                    </label>
                  </div>
                  <label className="r360-field">
                    {language === 'es' ? 'Tipo de contrato' : 'Contract type'}
                    <select
                      value={clientForm.contractType}
                      onChange={(event) => setClientForm({ ...clientForm, contractType: event.target.value })}
                    >
                      <option value="">—</option>
                      {CONTRACT_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                  <label className="r360-field">
                    {language === 'es' ? 'Modalidad de servicio' : 'Service model'}
                    <select
                      value={clientForm.serviceModel}
                      onChange={(event) => setClientForm({ ...clientForm, serviceModel: event.target.value })}
                    >
                      <option value="">—</option>
                      {CLIENT_SERVICE_MODELS.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </label>
                  <label className="r360-field">
                    {language === 'es' ? 'Owner comercial' : 'Sales owner'}
                    <input
                      value={clientForm.salesOwnerId}
                      onChange={(event) => setClientForm({ ...clientForm, salesOwnerId: event.target.value })}
                    />
                  </label>
                  <label className="r360-field">
                    {language === 'es' ? 'Owner cliente' : 'Client owner'}
                    <input
                      value={clientForm.clientOwnerId}
                      onChange={(event) => setClientForm({ ...clientForm, clientOwnerId: event.target.value })}
                    />
                  </label>
                  <label className="r360-field">
                    {language === 'es' ? 'Owner InfoSec' : 'InfoSec owner'}
                    <input
                      value={clientForm.infosecOwnerId}
                      onChange={(event) => setClientForm({ ...clientForm, infosecOwnerId: event.target.value })}
                    />
                  </label>
                  <label className="r360-field r360-field-full">
                    {language === 'es' ? 'Repositorio InfoSec' : 'InfoSec repository'}
                    <input
                      placeholder="https://..."
                      value={clientForm.infosecRepoUrl}
                      onChange={(event) => setClientForm({ ...clientForm, infosecRepoUrl: event.target.value })}
                    />
                  </label>
                </div>

                <div className="r360-note">
                  {language === 'es'
                    ? 'Los campos de contrato se sincronizan automáticamente cuando existe un contrato. Los valores manuales se conservan si no hay datos de contrato.'
                    : 'Contract fields sync automatically when a contract exists. Manual values are preserved when contract data is missing.'}
                </div>

                <div className="r360-inline-group">
                  <button
                    className="r360-btn r360-btn-primary"
                    disabled={clientBusy || !clientForm.name.trim()}
                    onClick={saveClientProfile}
                  >
                    {language === 'es' ? 'Guardar ficha' : 'Save profile'}
                  </button>
                  <button className="r360-btn" disabled={clientBusy} onClick={() => setClientEditing(false)}>
                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}

            <div className="r360-kpi-grid">
              <Kpi label={language === 'es' ? 'Solicitudes' : 'Requests'} value={metrics.totalRequests} />
              <Kpi label={language === 'es' ? 'Abiertas' : 'Open'} value={metrics.open} tone="info" />
              <Kpi label={language === 'es' ? 'Vencidas' : 'Overdue'} value={metrics.overdue} tone="danger" />
              <Kpi label="SLA breached" value={metrics.breached} tone="danger" />
              <Kpi label={language === 'es' ? 'Entregadas' : 'Delivered'} value={metrics.delivered} tone="success" />
              <Kpi label={language === 'es' ? 'Contratos activos' : 'Active contracts'} value={activeContracts.length} />
            </div>

            <div className="r360-dashboard-grid">
              <div className="r360-card r360-section">
                <div className="r360-section-head"><h2>{language === 'es' ? 'Ficha del cliente' : 'Client profile'}</h2></div>
                <div className="r360-detail-list">
                  <Detail label={language === 'es' ? 'Estado' : 'Status'} value={client.customerStatus} />
                  <Detail label={language === 'es' ? 'Fase' : 'Phase'} value={client.currentPhase} />
                  <Detail label={language === 'es' ? 'Tipo' : 'Type'} value={client.clientType} />
                  <Detail label={language === 'es' ? 'País' : 'Country'} value={countryName(client.country, language)} />
                  <Detail label={language === 'es' ? 'Unidad de negocio' : 'Business unit'} value={client.businessUnit} />
                  <Detail label={language === 'es' ? 'Contrato' : 'Contract'} value={client.contractType} />
                  <Detail label={language === 'es' ? 'Modalidad' : 'Service model'} value={client.serviceModel} />
                  <Detail
                    label={language === 'es' ? 'Contrato firmado' : 'Contract signed'}
                    value={client.contractSigned ? (language === 'es' ? 'Sí' : 'Yes') : (language === 'es' ? 'No' : 'No')}
                  />
                  <Detail label={language === 'es' ? 'Owner cliente' : 'Client owner'} value={client.clientOwnerId} />
                  <Detail label={language === 'es' ? 'Owner InfoSec' : 'InfoSec owner'} value={client.infosecOwnerId} />
                </div>
              </div>

              <div className="r360-card r360-section">
                <div className="r360-section-head">
                  <h2>{language === 'es' ? 'Alertas y estado' : 'Alerts & status'}</h2>
                </div>
                <div className="r360-detail-list">
                  <Detail label="SLA" value={`${slaSummary.atRisk} ${language === 'es' ? 'en riesgo' : 'at risk'} · ${slaSummary.breached} breached`} />
                  <Detail label="CVE" value={subscription ? `${subscription.enabled ? 'ON' : 'OFF'} · ${subscription.severityThreshold}` : '—'} />
                  <Detail label={language === 'es' ? 'Contrato vigente' : 'Current contract'} value={latestContract ? `${latestContract.name} · ${latestContract.status}` : '—'} />
                  <Detail label={language === 'es' ? 'Excepciones SLA' : 'SLA exceptions'} value={overrides.length} />
                  <Detail label={language === 'es' ? 'Inventario' : 'Inventory'} value={inventory.length} />
                </div>
              </div>

              <div className="r360-card r360-section r360-dir-overview">
                <div className="r360-section-head">
                  <h2>{language === 'es' ? 'Directorio' : 'Directory'}</h2>
                  {canManageDirectory && (
                    <button className="r360-btn" onClick={() => goToTab('directory')}>
                      {language === 'es' ? 'Gestionar' : 'Manage'}
                    </button>
                  )}
                </div>

                {overviewNotice && <div className="r360-success">{overviewNotice}</div>}

                {client.directory ? (
                  <div className="r360-dir-view">
                    <div className="r360-dir-local">
                      <div>
                        <div className="r360-muted">
                          {language === 'es' ? 'Ruta del directorio' : 'Directory path'}
                        </div>
                        <code className="r360-mono">{client.directory.localPath}</code>
                      </div>
                      <button className="r360-btn" onClick={() => copyOverviewPath(client.directory.localPath)}>
                        {language === 'es' ? 'Copiar ruta' : 'Copy path'}
                      </button>
                    </div>

                    <div className="r360-dir-hint">
                      {language === 'es'
                        ? 'Para abrirlo en Windows: Win+E, Ctrl+L y pega la ruta copiada.'
                        : 'To open it in Windows: Win+E, Ctrl+L and paste the copied path.'}
                    </div>
                  </div>
                ) : (
                  <div className="r360-dir-overview-empty">
                    <EmptyState
                      icon="📁"
                      title={language === 'es' ? 'Sin directorio guardado' : 'No directory saved'}
                      text={
                        canManageDirectory
                          ? (language === 'es'
                              ? 'Guarda la ruta del directorio del cliente para copiarla desde aquí.'
                              : 'Save the client directory path to copy it from here.')
                          : (language === 'es'
                              ? 'El cliente todavía no tiene un directorio guardado.'
                              : 'This client does not have a directory saved yet.')
                      }
                    />
                    {canManageDirectory && (
                      <button className="r360-btn r360-btn-primary" onClick={() => goToTab('directory')}>
                        {language === 'es' ? 'Añadir directorio' : 'Add directory'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="r360-card r360-section">
              <div className="r360-section-head">
                <h2>{language === 'es' ? 'Actividad reciente' : 'Recent activity'}</h2>
                <button className="r360-btn" onClick={() => goToTab('activity')}>{language === 'es' ? 'Ver todo' : 'View all'}</button>
              </div>
              {data.timeline.length === 0 ? (
                <EmptyState icon="🕒" title={language === 'es' ? 'Sin actividad' : 'No activity'} />
              ) : (
                <div className="r360-timeline">
                  {data.timeline.slice(0, 5).map((event) => (
                    <div key={event.id} className="r360-event">
                      <div className="r360-event-dot" />
                      <div className="r360-event-body">
                        <div className="r360-event-head">
                          <strong>{event.type}</strong>
                          <span className="r360-muted">{formatDateTime(event.createdAt, language)}</span>
                          {event.authorName && <span className="r360-muted">· {event.authorName}</span>}
                        </div>
                        {event.body && <div className="r360-event-text">{event.body}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'requests' && (
          <RequestTable requests={data.requests} language={language} navigate={navigate} />
        )}

        {activeTab === 'questions' && (
          <RequestTable
            requests={requestBuckets.questions}
            language={language}
            navigate={navigate}
            emptyTitle={language === 'es' ? 'Sin preguntas' : 'No questions'}
            emptyText={language === 'es' ? 'Las preguntas se registran como solicitudes de tipo quick query.' : 'Questions are recorded as quick-query requests.'}
          />
        )}

        {activeTab === 'document-requests' && (
          <RequestTable
            requests={requestBuckets.documentRequests}
            language={language}
            navigate={navigate}
            emptyTitle={language === 'es' ? 'Sin solicitudes de documentos' : 'No document requests'}
            emptyText={language === 'es' ? 'Incluye solicitudes de certificados, policies y referencias técnicas.' : 'Includes certificate, policy and technical reference requests.'}
          />
        )}

        {activeTab === 'documents' && (
          <div>
            <div className="r360-card r360-section">
              <div className="r360-section-head"><h2>{language === 'es' ? 'Entregables' : 'Deliverables'}</h2></div>
              {data.deliverables.length === 0 ? (
                <EmptyState icon="📦" title={language === 'es' ? 'Sin entregables' : 'No deliverables'} />
              ) : (
                <div className="r360-deliverable-list">
                  {data.deliverables.map((deliverable: any) => (
                    <div key={deliverable._id} className="r360-deliverable-row">
                      <div>
                        <strong>{deliverable.name}</strong>
                        <div className="r360-muted">{deliverable.type || 'other'} · v{deliverable.version || 1}</div>
                      </div>
                      <span className="r360-badge r360-status-new">{deliverable.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="r360-card r360-section">
              <div className="r360-section-head"><h2>{language === 'es' ? 'Documentos' : 'Documents'}</h2></div>
              {data.documents.length === 0 ? (
                <EmptyState icon="📎" title={language === 'es' ? 'Sin documentos' : 'No documents'} />
              ) : (
                <div className="r360-doc-list">
                  {data.documents.map((document: any) => (
                    <div key={document._id} className="r360-doc-row">
                      <div>
                        <strong>{document.originalName || document.filename}</strong>
                        <div className="r360-muted">{document.documentType || 'other'} · {document.visibility || 'internal'}</div>
                      </div>
                      <span className="r360-muted">{formatDate(document.createdAt, language)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'cve' && (
          <div className="r360-card r360-section">
            <div className="r360-section-head">
              <h2>{language === 'es' ? 'Exposición CVE' : 'CVE exposure'}</h2>
              <span className="r360-muted">
                {subscription
                  ? `${subscription.enabled ? (language === 'es' ? 'Suscripción activa' : 'Subscription on') : (language === 'es' ? 'Suscripción inactiva' : 'Subscription off')} · ${subscription.severityThreshold}`
                  : (language === 'es' ? 'Sin configurar' : 'Not configured')}
              </span>
            </div>
            {data.cveImpacts.length === 0 ? (
              <EmptyState icon="🛡️" title={language === 'es' ? 'Sin impactos CVE' : 'No CVE impacts'} />
            ) : (
              <div className="r360-doc-list">
                {data.cveImpacts.map((impact: any) => (
                  <div key={impact._id} className="r360-doc-row">
                    <div>
                      <strong>{impact.cveId}</strong>
                      <div className="r360-muted">
                        {impact.affected ? (language === 'es' ? 'Afectado' : 'Affected') : (language === 'es' ? 'No afectado' : 'Not affected')} · {impact.posture || '—'}
                      </div>
                    </div>
                    <Link className="r360-btn" to={`/cve/${impact.advisoryId || impact.cveId}`}>{language === 'es' ? 'Ver CVE' : 'View CVE'}</Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'sla' && (
          <div>
            <div className="r360-kpi-grid">
              <Kpi label={language === 'es' ? 'Solicitudes' : 'Requests'} value={slaSummary.total} />
              <Kpi label={language === 'es' ? 'En plazo' : 'On track'} value={slaSummary.onTrack} tone="success" />
              <Kpi label={language === 'es' ? 'En riesgo' : 'At risk'} value={slaSummary.atRisk} tone="danger" />
              <Kpi label="Breached" value={slaSummary.breached} tone="danger" />
              <Kpi label={language === 'es' ? 'Pausadas' : 'Paused'} value={slaSummary.paused} />
            </div>

            <div className="r360-card r360-section">
              <div className="r360-section-head">
                <h2>{language === 'es' ? 'Excepciones del cliente' : 'Client exceptions'}</h2>
                <span className="r360-muted">{language === 'es' ? 'Sobrescriben la política global' : 'Override the global policy'}</span>
              </div>
              {overrides.length === 0 ? (
                <EmptyState icon="⏱️" title={language === 'es' ? 'Sin excepciones' : 'No exceptions'} text={language === 'es' ? 'Se aplica la política global.' : 'The global policy applies.'} />
              ) : (
                <div className="r360-table-wrap">
                  <table className="r360-table">
                    <thead>
                      <tr>
                        <th>{language === 'es' ? 'Nombre' : 'Name'}</th>
                        <th>{language === 'es' ? 'Tipo' : 'Type'}</th>
                        <th>{language === 'es' ? 'Prioridad' : 'Priority'}</th>
                        <th>{language === 'es' ? 'Respuesta' : 'Response'}</th>
                        <th>{language === 'es' ? 'Resolución' : 'Resolution'}</th>
                        <th>{language === 'es' ? 'Umbral riesgo' : 'Risk threshold'}</th>
                        <th>{language === 'es' ? 'Vigencia' : 'Effective'}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {overrides.map((override) => (
                        <tr key={override._id}>
                          <td>{override.name || '—'}</td>
                          <td>{override.requestType || (language === 'es' ? 'Todos' : 'All')}</td>
                          <td>{override.priority || '—'}</td>
                          <td>{override.responseHours ?? '—'} h</td>
                          <td>{override.resolutionHours ?? '—'} h</td>
                          <td>{override.atRiskThresholdPct ?? '—'}%</td>
                          <td>
                            {[override.effectiveFrom, override.effectiveTo]
                              .filter(Boolean)
                              .map((value) => formatDate(value as string, language))
                              .join(' → ') || '—'}
                          </td>
                          <td>
                            {canManage && (
                              <button className="r360-btn r360-btn-danger" disabled={overrideBusy} onClick={() => deleteOverride(override)}>
                                ×
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {overrideNotice && <div className="r360-success">{overrideNotice}</div>}

              {canManage && (
                <div className="r360-filters">
                  <input placeholder={language === 'es' ? 'Nombre' : 'Name'} value={overrideForm.name} onChange={(event) => setOverrideForm({ ...overrideForm, name: event.target.value })} />
                  <select value={overrideForm.requestType} onChange={(event) => setOverrideForm({ ...overrideForm, requestType: event.target.value })}>
                    <option value="">{language === 'es' ? 'Todos los tipos' : 'All types'}</option>
                    {REQUEST_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                  <select value={overrideForm.priority} onChange={(event) => setOverrideForm({ ...overrideForm, priority: event.target.value })}>
                    <option value="">{language === 'es' ? 'Todas las prioridades' : 'All priorities'}</option>
                    {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                  </select>
                  <input type="number" placeholder="Respuesta (h)" value={overrideForm.responseHours} onChange={(event) => setOverrideForm({ ...overrideForm, responseHours: event.target.value })} />
                  <input type="number" placeholder="Resolución (h)" value={overrideForm.resolutionHours} onChange={(event) => setOverrideForm({ ...overrideForm, resolutionHours: event.target.value })} />
                  <input type="number" placeholder="% riesgo" value={overrideForm.atRiskThresholdPct} onChange={(event) => setOverrideForm({ ...overrideForm, atRiskThresholdPct: event.target.value })} />
                  <input type="date" value={overrideForm.effectiveFrom} onChange={(event) => setOverrideForm({ ...overrideForm, effectiveFrom: event.target.value })} />
                  <input type="date" value={overrideForm.effectiveTo} onChange={(event) => setOverrideForm({ ...overrideForm, effectiveTo: event.target.value })} />
                  <button className="r360-btn r360-btn-primary" disabled={overrideBusy} onClick={createOverride}>
                    + {language === 'es' ? 'Añadir excepción' : 'Add exception'}
                  </button>
                </div>
              )}
            </div>

            <div className="r360-card r360-section">
              <div className="r360-section-head"><h2>{language === 'es' ? 'Políticas globales' : 'Global policies'}</h2></div>
              {policies.length === 0 ? (
                <EmptyState icon="⏱️" title={language === 'es' ? 'Sin políticas' : 'No policies'} />
              ) : (
                <div className="r360-table-wrap">
                  <table className="r360-table">
                    <thead>
                      <tr>
                        <th>{language === 'es' ? 'Política' : 'Policy'}</th>
                        <th>{language === 'es' ? 'Tipo' : 'Type'}</th>
                        <th>{language === 'es' ? 'Prioridad' : 'Priority'}</th>
                        <th>{language === 'es' ? 'Respuesta' : 'Response'}</th>
                        <th>{language === 'es' ? 'Resolución' : 'Resolution'}</th>
                        <th>{language === 'es' ? 'Activa' : 'Active'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {policies.map((policy) => (
                        <tr key={policy._id}>
                          <td>{policy.name}</td>
                          <td>{policy.requestType || (language === 'es' ? 'Todos' : 'All')}</td>
                          <td>{policy.priority || '—'}</td>
                          <td>{policy.responseHours ?? '—'} h</td>
                          <td>{policy.resolutionHours ?? '—'} h</td>
                          <td>{policy.active ? '✓' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'contracts' && (
          <div>
            <div className="r360-card r360-section">
              <div className="r360-section-head">
                <h2>{language === 'es' ? 'Contratos' : 'Contracts'}</h2>
                <span className="r360-muted">
                  {activeContracts.length} {language === 'es' ? 'activos' : 'active'} · {contracts.length} {language === 'es' ? 'en total' : 'total'}
                </span>
              </div>

              {contractNotice && <div className="r360-success">{contractNotice}</div>}

              {contracts.length === 0 ? (
                <EmptyState icon="📄" title={language === 'es' ? 'Sin contratos' : 'No contracts'} />
              ) : (
                <div className="r360-deliverable-list">
                  {contracts.map((contract) => (
                    <div key={contract._id} className="r360-card r360-section">
                      <div className="r360-section-head">
                        <div>
                          <strong>{contract.name}</strong>
                          <div className="r360-muted">
                            {contract.contractType}
                            {contract.serviceModel ? ` · ${contract.serviceModel}` : ''}
                            {contract.contractNumber ? ` · ${contract.contractNumber}` : ''}
                          </div>
                        </div>
                        <span className="r360-badge r360-status-new">
                          {CONTRACT_STATUS_LABELS[contract.status as keyof typeof CONTRACT_STATUS_LABELS]?.[language] || contract.status}
                        </span>
                      </div>

                      <div className="r360-detail-list">
                        <Detail label={language === 'es' ? 'Inicio' : 'Start'} value={formatDate(contract.startDate, language)} />
                        <Detail label={language === 'es' ? 'Fin' : 'End'} value={formatDate(contract.endDate, language)} />
                        <Detail label={language === 'es' ? 'Firmado' : 'Signed'} value={formatDate(contract.signedAt, language)} />
                        <Detail label={language === 'es' ? 'Renovación automática' : 'Auto renew'} value={contract.autoRenew ? '✓' : '—'} />
                        {contract.cancellationReason && <Detail label={language === 'es' ? 'Motivo cancelación' : 'Cancellation reason'} value={contract.cancellationReason} />}
                      </div>

                      {contract.attachments?.length > 0 && (
                        <div className="r360-doc-list">
                          {contract.attachments.map((attachment) => (
                            <div key={attachment._id || attachment.filename} className="r360-doc-row">
                              <span>{attachment.originalName || attachment.filename}</span>
                              {attachment.path && <a className="r360-link" href={attachment.path} target="_blank" rel="noreferrer">{language === 'es' ? 'Abrir' : 'Open'}</a>}
                            </div>
                          ))}
                        </div>
                      )}

                      {canManage && (
                        <div className="r360-inline-group">
                          {(contract.status === 'draft' || contract.status === 'pending_signature') && (
                            <button className="r360-btn r360-btn-primary" disabled={contractBusy} onClick={() => signContract(contract)}>
                              {language === 'es' ? 'Firmar' : 'Sign'}
                            </button>
                          )}
                          {contract.status === 'active' && (
                            <>
                              <button className="r360-btn" disabled={contractBusy} onClick={() => renewContract(contract)}>
                                {language === 'es' ? 'Renovar' : 'Renew'}
                              </button>
                              <button className="r360-btn r360-btn-danger" disabled={contractBusy} onClick={() => cancelContract(contract)}>
                                {language === 'es' ? 'Cancelar' : 'Cancel'}
                              </button>
                            </>
                          )}
                          <label className="r360-btn">
                            {language === 'es' ? 'Adjuntar' : 'Attach'}
                            <input
                              type="file"
                              style={{ display: 'none' }}
                              onChange={(event) => uploadContractAttachment(contract, event.target.files?.[0] || null)}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {canManage && (
              <div className="r360-card r360-section">
                <div className="r360-section-head"><h2>{language === 'es' ? 'Nuevo contrato' : 'New contract'}</h2></div>
                <div className="r360-filters">
                  <input placeholder={language === 'es' ? 'Nombre' : 'Name'} value={contractForm.name} onChange={(event) => setContractForm({ ...contractForm, name: event.target.value })} />
                  <input placeholder={language === 'es' ? 'Número' : 'Number'} value={contractForm.contractNumber} onChange={(event) => setContractForm({ ...contractForm, contractNumber: event.target.value })} />
                  <select value={contractForm.contractType} onChange={(event) => setContractForm({ ...contractForm, contractType: event.target.value })}>
                    {CONTRACT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                  <select value={contractForm.serviceModel} onChange={(event) => setContractForm({ ...contractForm, serviceModel: event.target.value })}>
                    <option value="">{language === 'es' ? 'Modalidad' : 'Service model'}</option>
                    {SERVICE_MODELS.map((model) => <option key={model} value={model}>{model}</option>)}
                  </select>
                  <select value={contractForm.status} onChange={(event) => setContractForm({ ...contractForm, status: event.target.value })}>
                    {CONTRACT_STATUSES.map((status) => <option key={status} value={status}>{CONTRACT_STATUS_LABELS[status][language]}</option>)}
                  </select>
                  <input type="date" value={contractForm.startDate} onChange={(event) => setContractForm({ ...contractForm, startDate: event.target.value })} />
                  <input type="date" value={contractForm.endDate} onChange={(event) => setContractForm({ ...contractForm, endDate: event.target.value })} />
                  <input type="date" value={contractForm.signedAt} onChange={(event) => setContractForm({ ...contractForm, signedAt: event.target.value })} />
                  <input type="number" placeholder={language === 'es' ? 'Aviso renovación (días)' : 'Renewal notice (days)'} value={contractForm.renewalNoticeDays} onChange={(event) => setContractForm({ ...contractForm, renewalNoticeDays: event.target.value })} />
                  <input placeholder={language === 'es' ? 'Notas' : 'Notes'} value={contractForm.notes} onChange={(event) => setContractForm({ ...contractForm, notes: event.target.value })} />
                  <button className="r360-btn r360-btn-primary" disabled={contractBusy || !contractForm.name.trim()} onClick={createContract}>
                    + {language === 'es' ? 'Crear contrato' : 'Create contract'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="r360-card r360-section">
            <div className="r360-section-head">
              <h2>{language === 'es' ? 'Inventario tecnológico' : 'Technology inventory'}</h2>
              <div className="r360-inline-group">
                {canManage && (
                  <>
                    <button className="r360-btn" disabled={inventoryBusy} onClick={rematchInventory}>
                      ⟳ {language === 'es' ? 'Recalcular coincidencias' : 'Recompute matches'}
                    </button>
                    <button className="r360-btn r360-btn-primary" disabled={inventoryBusy} onClick={saveInventory}>
                      {language === 'es' ? 'Guardar inventario' : 'Save inventory'}
                    </button>
                  </>
                )}
              </div>
            </div>

            <p className="r360-muted">
              {language === 'es'
                ? 'El inventario se cruza con el catálogo CVE (CPE, versión y nombre) para proponer impactos. No crea avisos ni envía correos.'
                : 'The inventory is matched against the CVE catalog (CPE, version and name) to propose impacts. It does not create advisories or send emails.'}
            </p>

            {inventoryNotice && <div className="r360-success">{inventoryNotice}</div>}

            {inventory.length === 0 ? (
              <EmptyState
                icon="🧩"
                title={language === 'es' ? 'Sin inventario' : 'No inventory'}
                text={language === 'es' ? 'Añade proveedor, producto y versión para detectar CVEs aplicables.' : 'Add vendor, product and version to detect applicable CVEs.'}
              />
            ) : (
              <div className="r360-table-wrap">
                <table className="r360-table">
                  <thead>
                    <tr>
                      <th>{language === 'es' ? 'Proveedor' : 'Vendor'}</th>
                      <th>{language === 'es' ? 'Producto' : 'Product'}</th>
                      <th>{language === 'es' ? 'Versión' : 'Version'}</th>
                      <th>CPE</th>
                      <th>{language === 'es' ? 'Criticidad' : 'Criticality'}</th>
                      <th>{language === 'es' ? 'Notas' : 'Notes'}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((item, index) => (
                      <tr key={item._id || index}>
                        <td><input value={item.vendor} disabled={!canManage} onChange={(event) => updateInventoryItem(index, { vendor: event.target.value })} /></td>
                        <td><input value={item.product} disabled={!canManage} onChange={(event) => updateInventoryItem(index, { product: event.target.value })} /></td>
                        <td><input value={item.version || ''} disabled={!canManage} onChange={(event) => updateInventoryItem(index, { version: event.target.value })} /></td>
                        <td><input className="r360-mono" value={item.cpe || ''} placeholder="cpe:2.3:a:vendor:product:version" disabled={!canManage} onChange={(event) => updateInventoryItem(index, { cpe: event.target.value })} /></td>
                        <td>
                          <select value={item.criticality || 'medium'} disabled={!canManage} onChange={(event) => updateInventoryItem(index, { criticality: event.target.value as any })}>
                            <option value="low">low</option>
                            <option value="medium">medium</option>
                            <option value="high">high</option>
                            <option value="critical">critical</option>
                          </select>
                        </td>
                        <td><input value={item.notes || ''} disabled={!canManage} onChange={(event) => updateInventoryItem(index, { notes: event.target.value })} /></td>
                        <td>{canManage && <button className="r360-btn r360-btn-danger" onClick={() => removeInventoryItem(index)}>×</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {canManage && (
              <button className="r360-btn" onClick={addInventoryItem}>
                + {language === 'es' ? 'Añadir elemento' : 'Add item'}
              </button>
            )}
          </div>
        )}

        {activeTab === 'directory' && (
          <div className="r360-card r360-section">
            <div className="r360-section-head">
              <h2>{language === 'es' ? 'Directorio' : 'Directory'}</h2>
              {canManageDirectory && !dirEditing && (
                <div className="r360-inline-group">
                  <button className="r360-btn" onClick={startEditDirectory}>
                    {client.directory
                      ? (language === 'es' ? 'Editar' : 'Edit')
                      : (language === 'es' ? 'Añadir directorio' : 'Add directory')}
                  </button>
                  {client.directory && (
                    <button className="r360-btn r360-btn-danger" disabled={dirBusy} onClick={removeDirectory}>
                      {language === 'es' ? 'Quitar' : 'Remove'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {dirNotice && <div className="r360-success">{dirNotice}</div>}

            {dirEditing ? (
              <div className="r360-dir-form">
                <label className="r360-dir-label" htmlFor="client-directory-path">
                  {language === 'es' ? 'Ruta del directorio' : 'Directory path'}
                </label>
                <input
                  id="client-directory-path"
                  placeholder={'C:\\Users\\...\\carpeta'}
                  value={dirForm.localPath}
                  onChange={(event) => setDirForm({ localPath: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !dirBusy) saveDirectory();
                  }}
                />
                <div className="r360-dir-hint">
                  {language === 'es'
                    ? 'Pega la ruta de Windows tal como la copias del Explorador (C:\\... o \\\\servidor\\...).'
                    : 'Paste the Windows path exactly as copied from Explorer (C:\\... or \\\\server\\...).'}
                </div>
                <div className="r360-inline-group">
                  <button
                    className="r360-btn r360-btn-primary"
                    disabled={dirBusy || !dirForm.localPath.trim()}
                    onClick={saveDirectory}
                  >
                    {language === 'es' ? 'Guardar' : 'Save'}
                  </button>
                  <button className="r360-btn" disabled={dirBusy} onClick={() => setDirEditing(false)}>
                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                  </button>
                </div>
              </div>
            ) : client.directory ? (
              <div className="r360-dir-view">
                <div className="r360-dir-local">
                  <div>
                    <div className="r360-muted">
                      {language === 'es' ? 'Ruta del directorio' : 'Directory path'}
                    </div>
                    <code className="r360-mono">{client.directory.localPath}</code>
                  </div>
                  <button className="r360-btn" onClick={() => copyDirectoryPath(client.directory.localPath)}>
                    {language === 'es' ? 'Copiar ruta' : 'Copy path'}
                  </button>
                </div>

                <div className="r360-dir-hint">
                  {language === 'es'
                    ? 'Para abrirlo en Windows: Win+E, Ctrl+L y pega la ruta copiada.'
                    : 'To open it in Windows: Win+E, Ctrl+L and paste the copied path.'}
                </div>
              </div>
            ) : (
              <EmptyState
                icon="📁"
                title={language === 'es' ? 'Sin directorio guardado' : 'No directory saved'}
                text={
                  language === 'es'
                    ? 'Guarda la ruta del directorio del cliente para copiarla desde aquí.'
                    : 'Save the client directory path to copy it from here.'
                }
              />
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="r360-card r360-section">
            {data.timeline.length === 0 ? (
              <EmptyState icon="🕒" title={language === 'es' ? 'Sin actividad' : 'No activity'} />
            ) : (
              <div className="r360-timeline">
                {data.timeline.map((event) => (
                  <div key={event.id} className="r360-event">
                    <div className="r360-event-dot" />
                    <div className="r360-event-body">
                      <div className="r360-event-head">
                        <strong>{event.type}</strong>
                        <span className="r360-muted">{formatDateTime(event.createdAt, language)}</span>
                        {event.authorName && <span className="r360-muted">· {event.authorName}</span>}
                      </div>
                      {event.body && <div className="r360-event-text">{event.body}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function RequestTable({
  requests,
  language,
  navigate,
  emptyTitle,
  emptyText,
}: {
  requests: Request360[];
  language: 'es' | 'en';
  navigate: (path: string) => void;
  emptyTitle?: string;
  emptyText?: string;
}) {
  return (
    <div className="r360-card r360-table-wrap">
      {requests.length === 0 ? (
        <EmptyState
          icon="🗂️"
          title={emptyTitle || (language === 'es' ? 'Sin solicitudes' : 'No requests')}
          text={emptyText}
        />
      ) : (
        <table className="r360-table">
          <thead>
            <tr>
              <th>{language === 'es' ? 'Clave' : 'Key'}</th>
              <th>{language === 'es' ? 'Título' : 'Title'}</th>
              <th>{language === 'es' ? 'Estado' : 'Status'}</th>
              <th>{language === 'es' ? 'Prioridad' : 'Priority'}</th>
              <th>SLA</th>
              <th>Deadline</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} className="r360-clickable-row" onClick={() => navigate(`/requests/${request.id}`)}>
                <td><span className="r360-mono">{request.requestKey}</span></td>
                <td>
                  <div className="r360-truncate">{request.title}</div>
                  <div className="r360-muted">
                    {request.requestType}
                    {request.requestKind === 'quick_query' ? ' · quick query' : ''}
                  </div>
                </td>
                <td><StatusBadge status={request.statusNew} lang={language} /></td>
                <td><PriorityBadge priority={request.priority} /><SeverityBadge severity={request.severity} lang={language} /></td>
                <td><SlaBadge state={request.slaState} lang={language} /></td>
                <td>{formatDate(request.deadline, language)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="r360-detail-row">
      <span className="r360-muted">{label}</span>
      <strong>{value ?? '—'}</strong>
    </div>
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
