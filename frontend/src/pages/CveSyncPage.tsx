import { useCallback, useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useLanguage } from '../i18n/LanguageContext';
import { cveApi } from '../api/cve';
import type { CveSyncState, CveSyncStatus } from '../types/request360';
import {
  EmptyState,
  ErrorBanner,
  Loading,
  formatDateTime,
} from '../components/request360/badges';

const MODES = ['auto', 'incremental', 'backfill', 'full'] as const;

export function CveSyncPage() {
  const { language } = useLanguage();
  const [status, setStatus] = useState<CveSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [nvdForm, setNvdForm] = useState({ mode: 'auto' as (typeof MODES)[number], from: '', to: '' });
  const [kevForce, setKevForce] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await cveApi.syncStatus();
      setStatus(response);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 20000);
    return () => clearInterval(timer);
  }, [load]);

  const startNvd = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await cveApi.syncNvd({
        mode: nvdForm.mode === 'auto' ? undefined : nvdForm.mode,
        from: nvdForm.from || undefined,
        to: nvdForm.to || undefined,
      });
      setNotice(language === 'es' ? 'Sincronización NVD lanzada en segundo plano.' : 'NVD sync started in the background.');
      await load(true);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  const startKev = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await cveApi.syncKev({ force: kevForce });
      setNotice(language === 'es' ? 'Sincronización KEV lanzada en segundo plano.' : 'KEV sync started in the background.');
      await load(true);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout>
      <div className="r360-page">
        <div className="r360-page-header">
          <div>
            <h1>{language === 'es' ? 'Sincronización CVE' : 'CVE synchronization'}</h1>
            <p className="r360-subtitle">
              {language === 'es'
                ? 'Estado de la ingesta NVD / CISA KEV, cursores y recálculo de coincidencias.'
                : 'NVD / CISA KEV ingestion status, cursors and match recomputation.'}
            </p>
          </div>
          <div className="r360-header-actions">
            <button className="r360-btn" disabled={loading} onClick={() => load()}>
              ⟳ {language === 'es' ? 'Actualizar' : 'Refresh'}
            </button>
          </div>
        </div>

        <ErrorBanner error={error} />
        {notice && <div className="r360-success">{notice}</div>}

        {loading && !status ? (
          <Loading lang={language} />
        ) : !status ? (
          <EmptyState icon="🛰️" title={language === 'es' ? 'Sin datos de sincronización' : 'No sync data'} />
        ) : (
          <>
            <div className="r360-kpi-grid">
              <Kpi label={language === 'es' ? 'CVEs en catálogo' : 'CVEs in catalog'} value={status.catalog.records} />
              <Kpi label="KEV" value={status.catalog.kevListed} tone="danger" />
              <Kpi label={language === 'es' ? 'Avisos' : 'Advisories'} value={status.catalog.advisories} tone="info" />
              <Kpi label={language === 'es' ? 'Con coincidencias' : 'With matches'} value={status.catalog.matched} tone="warning" />
            </div>

            <div className="r360-card r360-section">
              <div className="r360-section-head">
                <h2>{language === 'es' ? 'Estado por fuente' : 'Per-source status'}</h2>
                <span className="r360-muted">
                  {language === 'es' ? 'Actualización automática cada 20 s' : 'Auto-refresh every 20 s'}
                </span>
              </div>

              <div className="r360-table-wrap">
                <table className="r360-table">
                  <thead>
                    <tr>
                      <th>{language === 'es' ? 'Fuente' : 'Source'}</th>
                      <th>{language === 'es' ? 'Estado' : 'Status'}</th>
                      <th>{language === 'es' ? 'Modo' : 'Mode'}</th>
                      <th>{language === 'es' ? 'Última ejecución' : 'Last run'}</th>
                      <th>{language === 'es' ? 'Último éxito' : 'Last success'}</th>
                      <th>{language === 'es' ? 'Progreso' : 'Progress'}</th>
                      <th>{language === 'es' ? 'Detalle' : 'Detail'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.states.map((state) => (
                      <tr key={state.key}>
                        <td><strong>{state.key.toUpperCase()}</strong></td>
                        <td>
                          <span className={`r360-badge ${state.status === 'running' ? 'r360-sla-at-risk' : state.status === 'error' ? 'r360-sla-breached' : 'r360-sla-on-track'}`}>
                            {state.status}
                          </span>
                        </td>
                        <td>{state.mode}</td>
                        <td>{formatDateTime(state.lastRunAt, language)}</td>
                        <td>{formatDateTime(state.lastSuccessAt, language)}</td>
                        <td>{progressLabel(state)}</td>
                        <td>
                          {state.lastError ? (
                            <span className="r360-error-text">{state.lastError}</span>
                          ) : state.catalogVersion ? (
                            <span className="r360-muted">v{state.catalogVersion}</span>
                          ) : (
                            <span className="r360-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="r360-info-grid">
                <Info label={language === 'es' ? 'Intervalo NVD' : 'NVD interval'} value={`${Math.round(status.config.nvdIntervalMs / 60000)} min`} />
                <Info label={language === 'es' ? 'Intervalo KEV' : 'KEV interval'} value={`${Math.round(status.config.kevIntervalMs / 60000)} min`} />
                <Info label={language === 'es' ? 'Backfill desde' : 'Backfill from'} value={status.config.backfillStart} />
                <Info label="Matcher" value={status.config.matcherEnabled ? 'enabled' : 'disabled'} />
              </div>
            </div>

            <div className="r360-dashboard-grid">
              <div className="r360-card r360-section">
                <div className="r360-section-head"><h2>NVD</h2></div>
                <div className="r360-form-grid">
                  <label className="r360-field">
                    <span>{language === 'es' ? 'Modo' : 'Mode'}</span>
                    <select value={nvdForm.mode} onChange={(event) => setNvdForm((c) => ({ ...c, mode: event.target.value as any }))}>
                      {MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                    </select>
                  </label>
                  <label className="r360-field">
                    <span>{language === 'es' ? 'Desde' : 'From'}</span>
                    <input type="date" value={nvdForm.from} onChange={(event) => setNvdForm((c) => ({ ...c, from: event.target.value }))} />
                  </label>
                  <label className="r360-field">
                    <span>{language === 'es' ? 'Hasta' : 'To'}</span>
                    <input type="date" value={nvdForm.to} onChange={(event) => setNvdForm((c) => ({ ...c, to: event.target.value }))} />
                  </label>
                </div>
                <p className="r360-muted">
                  {language === 'es'
                    ? 'Las ventanas se dividen automáticamente en tramos de 120 días y respetan el límite de la API.'
                    : 'Windows are split into 120-day chunks automatically and respect the API rate limit.'}
                </p>
                <button className="r360-btn r360-btn-primary" disabled={busy} onClick={startNvd}>
                  ⟳ {language === 'es' ? 'Sincronizar NVD ahora' : 'Sync NVD now'}
                </button>
              </div>

              <div className="r360-card r360-section">
                <div className="r360-section-head"><h2>CISA KEV</h2></div>
                <label className="r360-checkbox">
                  <input type="checkbox" checked={kevForce} onChange={(event) => setKevForce(event.target.checked)} />
                  {language === 'es' ? 'Forzar aunque la versión no cambie' : 'Force even if catalog version is unchanged'}
                </label>
                <p className="r360-muted">
                  {language === 'es'
                    ? 'Sin forzar, la sincronización se omite cuando la versión del catálogo es la misma.'
                    : 'Without force, the sync is skipped when the catalog version is unchanged.'}
                </p>
                <button className="r360-btn r360-btn-primary" disabled={busy} onClick={startKev}>
                  ⟳ {language === 'es' ? 'Sincronizar KEV ahora' : 'Sync KEV now'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

function progressLabel(state: CveSyncState) {
  const progress = state.progress;
  if (!progress) return '—';
  if (progress.total) return `${progress.processed} / ${progress.total}`;
  return String(progress.processed || 0);
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: 'info' | 'danger' | 'success' | 'warning' }) {
  return (
    <div className={`r360-kpi ${tone ? `r360-kpi-${tone}` : ''}`}>
      <div className="r360-kpi-value">{value}</div>
      <div className="r360-kpi-label">{label}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="r360-info">
      <div className="r360-info-label">{label}</div>
      <div className="r360-info-value">{value || '—'}</div>
    </div>
  );
}
