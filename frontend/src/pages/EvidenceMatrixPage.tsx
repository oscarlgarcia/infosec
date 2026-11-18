import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { evidenceApi } from '../api/evidence';
import type {
  EvidenceCriteriaCatalog,
  EvidenceImportResult,
  EvidenceItem,
  EvidenceSuggestions,
} from '../types/evidence';
import {
  DOCUMENT_TYPE_LABELS,
  EVIDENCE_STATUS_LABELS,
  SHARE_MODE_SHORT_LABELS,
  labelOf,
} from '../types/evidence';
import { EmptyState, ErrorBanner, Loading, formatDate } from '../components/request360/badges';
import { EvidenceDetailDrawer } from '../components/evidence/EvidenceDetailDrawer';
import { EvidenceCriteriaModal } from '../components/evidence/EvidenceCriteriaModal';
import { EvidenceMatcherTab } from '../components/evidence/EvidenceMatcherTab';

const PAGE_SIZE = 50;

type Tab = 'catalog' | 'match';

const EMPTY_FILTERS = {
  q: '',
  domain: '',
  framework: '',
  area: '',
  status: '',
  includeArchived: false,
};

const EMPTY_SUGGESTIONS: EvidenceSuggestions = { areas: [], processes: [], controls: [], tags: [] };

function evidenceFileLabel(item: EvidenceItem, isEs: boolean): string {
  const origin = item.origin || 'upload';
  const noFile = isEs ? 'Sin archivo' : 'No file';
  const kbLabel = isEs ? 'Documento del KB' : 'KB document';
  if (origin === 'local_path' && item.localPath) return item.localPath;
  if (origin === 'kb_document') return item.sourceUrl ? kbLabel : noFile;
  if (item.asset?.originalName) return item.asset.originalName;
  if (item.localPath) return item.localPath;
  if (item.sourceUrl) return kbLabel;
  return noFile;
}

function renderChips(values: string[], max = 3) {
  if (!values.length) return '—';
  const shown = values.slice(0, max);
  const rest = values.length - shown.length;
  return (
    <div className="ev-chip-list">
      {shown.map((value) => <span className="ev-chip" key={value}>{value}</span>)}
      {rest > 0 && <span className="ev-chip ev-chip-more">+{rest}</span>}
    </div>
  );
}

export function EvidenceMatrixPage() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEs = language === 'es';
  const canManage = user?.role === 'admin';

  const [tab, setTab] = useState<Tab>('catalog');
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<EvidenceSuggestions>(EMPTY_SUGGESTIONS);
  const [catalogs, setCatalogs] = useState<EvidenceCriteriaCatalog>({
    evidenceDomains: [],
    evidenceFrameworks: [],
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [criteriaSaving, setCriteriaSaving] = useState(false);
  const [criteriaError, setCriteriaError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<EvidenceImportResult | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const [selected, setSelected] = useState<EvidenceItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Debounce the free-text search so each keystroke does not hit the API.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSelectedIds(new Set());
      setFilters((current) => (current.q === search ? current : { ...current, q: search }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await evidenceApi.list({
        q: filters.q || undefined,
        domain: filters.domain || undefined,
        framework: filters.framework || undefined,
        area: filters.area || undefined,
        status: filters.status || undefined,
        includeArchived: filters.includeArchived || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setItems(response.items);
      setTotal(response.total);
      setHasMore(response.hasMore);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    evidenceApi
      .suggestions()
      .then((response) => setSuggestions(response || EMPTY_SUGGESTIONS))
      .catch(() => setSuggestions(EMPTY_SUGGESTIONS));
    evidenceApi
      .catalogs()
      .then((response) =>
        setCatalogs({
          evidenceDomains: response?.evidenceDomains || [],
          evidenceFrameworks: response?.evidenceFrameworks || [],
        })
      )
      .catch(() => undefined);
  }, [reloadKey]);

  // Deep link `/evidence-matrix/:id` opens the lateral drawer.
  useEffect(() => {
    if (!id) {
      setSelected(null);
      setDetailError(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    setDetailError(null);
    evidenceApi
      .get(id)
      .then((item) => {
        if (active) setSelected(item);
      })
      .catch((err: any) => {
        if (active) setDetailError(err.message || 'Error');
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  const refresh = useCallback(() => {
    setReloadKey((key) => key + 1);
    load();
  }, [load]);

  const allSelected = useMemo(
    () => items.length > 0 && items.every((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  );

  const openDrawer = (item: EvidenceItem) => {
    setNotice(null);
    navigate(`/evidence-matrix/${item.id}`);
  };

  const closeDrawer = () => {
    setSelected(null);
    setDetailError(null);
    navigate('/evidence-matrix');
  };

  const setFilter = (patch: Partial<typeof EMPTY_FILTERS>) => {
    setPage(1);
    setSelectedIds(new Set());
    setFilters((current) => ({ ...current, ...patch }));
  };

  const clearFilters = () => {
    setSearch('');
    setPage(1);
    setSelectedIds(new Set());
    setFilters({ ...EMPTY_FILTERS });
  };

  const toggleOne = (itemId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allSelected) items.forEach((item) => next.delete(item.id));
      else items.forEach((item) => next.add(item.id));
      return next;
    });
  };

  const exportXlsx = async () => {
    setError(null);
    try {
      await evidenceApi.exportXlsx({
        q: filters.q || undefined,
        domain: filters.domain || undefined,
        framework: filters.framework || undefined,
        area: filters.area || undefined,
        status: filters.status || undefined,
        includeArchived: filters.includeArchived || undefined,
      });
      setNotice(isEs ? 'Excel generado.' : 'Excel generated.');
    } catch (err: any) {
      setError(err.message || 'Error');
    }
  };

  const exportCsv = async () => {
    setError(null);
    try {
      await evidenceApi.exportCsv({
        q: filters.q || undefined,
        domain: filters.domain || undefined,
        framework: filters.framework || undefined,
        area: filters.area || undefined,
        status: filters.status || undefined,
        includeArchived: filters.includeArchived || undefined,
      });
      setNotice(isEs ? 'CSV generado.' : 'CSV generated.');
    } catch (err: any) {
      setError(err.message || 'Error');
    }
  };

  const importFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    setImportResult(null);
    try {
      const result = await evidenceApi.importXlsx(file);
      setImportResult(result);
      if (result.created) refresh();
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  const downloadZip = async () => {
    if (!selectedIds.size) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await evidenceApi.zip(Array.from(selectedIds));
      setNotice(
        isEs
          ? `ZIP generado con ${selectedIds.size} evidencias. Incluye manifest.csv.`
          : `ZIP generated with ${selectedIds.size} evidence items. Includes manifest.csv.`
      );
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  const saveCriteria = async (values: { evidenceDomains: string[]; evidenceFrameworks: string[] }) => {
    setCriteriaSaving(true);
    setCriteriaError(null);
    try {
      await Promise.all([
        evidenceApi.updateCatalog('evidenceDomains', values.evidenceDomains),
        evidenceApi.updateCatalog('evidenceFrameworks', values.evidenceFrameworks),
      ]);
      setCatalogs(values);
      setCriteriaOpen(false);
      setNotice(isEs ? 'Criterios actualizados.' : 'Criteria updated.');
      refresh();
    } catch (err: any) {
      setCriteriaError(err.message || 'Error');
    } finally {
      setCriteriaSaving(false);
    }
  };

  const runAction = async (action: () => Promise<any>, message: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(message);
      refresh();
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  const archive = (item: EvidenceItem) => {
    const confirmed = window.confirm(
      isEs
        ? `¿Archivar "${item.title}"? Dejará de aparecer en el catálogo por defecto.`
        : `Archive "${item.title}"? It will no longer appear in the catalog by default.`
    );
    if (!confirmed) return;
    runAction(
      () => evidenceApi.update(item.id, { archived: true }),
      isEs ? 'Evidencia archivada.' : 'Evidence archived.'
    );
  };

  const restore = (item: EvidenceItem) => {
    runAction(
      () => evidenceApi.update(item.id, { archived: false }),
      isEs ? 'Evidencia restaurada.' : 'Evidence restored.'
    );
  };

  const uploadAsset = (item: EvidenceItem, file: File) => {
    runAction(
      () => evidenceApi.uploadAsset(item.id, file),
      isEs ? 'Archivo subido.' : 'File uploaded.'
    );
  };

  const removeAsset = (item: EvidenceItem) => {
    const confirmed = window.confirm(
      isEs ? '¿Quitar el archivo adjunto de esta evidencia?' : 'Remove the file attached to this evidence?'
    );
    if (!confirmed) return;
    runAction(
      () => evidenceApi.removeAsset(item.id),
      isEs ? 'Archivo eliminado.' : 'File removed.'
    );
  };

  const download = async (item: EvidenceItem) => {
    setError(null);
    if (!item.hasAsset) {
      setError(
        isEs
          ? 'Esta evidencia no tiene un archivo descargable (ruta local o documento del KB).'
          : 'This evidence has no downloadable file (local path or KB document).'
      );
      return;
    }
    try {
      await evidenceApi.download(item);
    } catch (err: any) {
      setError(err.message || 'Error');
    }
  };

  const openAsset = async (item: EvidenceItem) => {
    setError(null);
    try {
      await evidenceApi.open(item);
    } catch (err: any) {
      setError(err.message || 'Error');
    }
  };

  const filtersActive = Boolean(
    filters.q || filters.domain || filters.framework || filters.area || filters.status || filters.includeArchived
  );

  return (
    <Layout>
      <div className="r360-page r360-page-scroll r360-list-page ev-page">
        <div className="r360-page-header">
          <div>
            <h1>{isEs ? 'Matriz de Evidencias' : 'Evidence Matrix'}</h1>
            <p className="r360-subtitle">
              {isEs
                ? 'Catálogo plano de evidencias con criterios estándar y buscador de evidencia por requisito.'
                : 'Flat evidence catalog with standard criteria and requirement-to-evidence matching.'}
            </p>
          </div>
          <div className="r360-header-actions">
            {tab === 'catalog' && (
              <>
                <button className="r360-btn" onClick={exportXlsx}>
                  ⤓ {isEs ? 'Excel' : 'Excel'}
                </button>
                <button className="r360-btn" onClick={exportCsv}>
                  CSV
                </button>
              </>
            )}
            {canManage && (
              <>
                <input
                  ref={importRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) importFile(file);
                    event.target.value = '';
                  }}
                />
                <button className="r360-btn" disabled={busy} onClick={() => importRef.current?.click()}>
                  {isEs ? 'Importar' : 'Import'}
                </button>
                <button className="r360-btn" onClick={() => setCriteriaOpen(true)}>
                  {isEs ? 'Criterios' : 'Criteria'}
                </button>
                <Link className="r360-btn r360-btn-primary" to="/evidence-matrix/new">
                  + {isEs ? 'Nueva evidencia' : 'New evidence'}
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="ev-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'catalog'}
            className={tab === 'catalog' ? 'ev-tab ev-tab-active' : 'ev-tab'}
            onClick={() => setTab('catalog')}
          >
            {isEs ? 'Catálogo' : 'Catalog'}
          </button>
          <button
            role="tab"
            aria-selected={tab === 'match'}
            className={tab === 'match' ? 'ev-tab ev-tab-active' : 'ev-tab'}
            onClick={() => setTab('match')}
          >
            {isEs ? 'Buscar por requisito' : 'Find by requirement'}
          </button>
        </div>

        {tab === 'catalog' ? (
          <>
            <div className="ev-summary">
              <div className="ev-summary-item">
                <span>{isEs ? 'Evidencias' : 'Evidence'}</span>
                <strong>{total}</strong>
              </div>
              <div className="ev-summary-item">
                <span>{isEs ? 'Dominios' : 'Domains'}</span>
                <strong>{catalogs.evidenceDomains.length}</strong>
              </div>
              <div className="ev-summary-item">
                <span>{isEs ? 'Frameworks' : 'Frameworks'}</span>
                <strong>{catalogs.evidenceFrameworks.length}</strong>
              </div>
            </div>

            <ErrorBanner error={error} />
            {notice && <div className="r360-success">{notice}</div>}
            {importResult && (
              <div className={importResult.errors.length ? 'r360-note' : 'r360-success'}>
                {isEs
                  ? `${importResult.created} evidencias importadas de ${importResult.total} filas.`
                  : `${importResult.created} evidence items imported from ${importResult.total} rows.`}
                {importResult.errors.length > 0 && (
                  <ul className="ev-import-errors">
                    {importResult.errors.slice(0, 8).map((entry) => (
                      <li key={`${entry.row}-${entry.message}`}>
                        {isEs ? 'Fila' : 'Row'} {entry.row}: {entry.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="r360-filters ev-filters">
              <input
                type="search"
                placeholder={isEs ? 'Buscar por título, dominio, área, proceso, control, etiqueta…' : 'Search by title, domain, area, process, control, tag…'}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select value={filters.domain} onChange={(event) => setFilter({ domain: event.target.value })}>
                <option value="">{isEs ? 'Todos los dominios' : 'All domains'}</option>
                {catalogs.evidenceDomains.map((domain) => <option key={domain} value={domain}>{domain}</option>)}
              </select>
              <select value={filters.framework} onChange={(event) => setFilter({ framework: event.target.value })}>
                <option value="">{isEs ? 'Todos los frameworks' : 'All frameworks'}</option>
                {catalogs.evidenceFrameworks.map((framework) => <option key={framework} value={framework}>{framework}</option>)}
              </select>
              <select value={filters.area} onChange={(event) => setFilter({ area: event.target.value })}>
                <option value="">{isEs ? 'Todas las áreas' : 'All areas'}</option>
                {suggestions.areas.map((area) => <option key={area} value={area}>{area}</option>)}
              </select>
              <select value={filters.status} onChange={(event) => setFilter({ status: event.target.value })}>
                <option value="">{isEs ? 'Todo estado' : 'Any status'}</option>
                <option value="active">{labelOf(EVIDENCE_STATUS_LABELS, 'active', language)}</option>
                <option value="expiring">{labelOf(EVIDENCE_STATUS_LABELS, 'expiring', language)}</option>
                <option value="expired">{labelOf(EVIDENCE_STATUS_LABELS, 'expired', language)}</option>
                <option value="archived">{labelOf(EVIDENCE_STATUS_LABELS, 'archived', language)}</option>
              </select>
              <label className="r360-checkbox">
                <input
                  type="checkbox"
                  checked={filters.includeArchived}
                  onChange={(event) => setFilter({ includeArchived: event.target.checked })}
                />
                {isEs ? 'Incluir archivadas' : 'Include archived'}
              </label>
              {filtersActive && (
                <button className="r360-btn" onClick={clearFilters}>{isEs ? 'Limpiar' : 'Clear'}</button>
              )}
            </div>

            {loading ? (
              <Loading lang={language} />
            ) : items.length === 0 ? (
              <EmptyState
                icon="🗂️"
                title={filtersActive
                  ? (isEs ? 'Sin resultados para los filtros' : 'No results for these filters')
                  : (isEs ? 'Catálogo de evidencias vacío' : 'Evidence catalog is empty')}
                text={filtersActive
                  ? (isEs ? 'Prueba con otro texto o limpia los filtros.' : 'Try another search or clear the filters.')
                  : (isEs ? 'Crea la primera evidencia para empezar a construir la matriz.' : 'Create the first evidence to start building the matrix.')}
              />
            ) : (
              <div className="r360-card ev-table-card">
                {selectedIds.size > 0 && (
                  <div className="ev-bulk-bar">
                    <strong>
                      {selectedIds.size} {isEs
                        ? (selectedIds.size === 1 ? 'seleccionada' : 'seleccionadas')
                        : (selectedIds.size === 1 ? 'selected' : 'selected')}
                    </strong>
                    <button className="r360-btn r360-btn-primary" disabled={busy} onClick={downloadZip}>
                      ⤓ {isEs ? 'Descargar ZIP' : 'Download ZIP'}
                    </button>
                    <button className="r360-btn" onClick={() => setSelectedIds(new Set())}>
                      {isEs ? 'Limpiar selección' : 'Clear selection'}
                    </button>
                  </div>
                )}

                <div className="ev-table-scroll">
                  <table className="r360-table ev-table ev-table-flat">
                    <thead>
                      <tr>
                        <th className="ev-col-check">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            aria-label={isEs ? 'Seleccionar página' : 'Select page'}
                            onChange={toggleAll}
                          />
                        </th>
                        <th>{isEs ? 'Documento' : 'Document'}</th>
                        <th>{isEs ? 'Dominio' : 'Domain'}</th>
                        <th>{isEs ? 'Área' : 'Area'}</th>
                        <th>{isEs ? 'Proceso' : 'Process'}</th>
                        <th>Frameworks</th>
                        <th>{isEs ? 'Controles' : 'Controls'}</th>
                        <th>{isEs ? 'Tipo' : 'Type'}</th>
                        <th>{isEs ? 'Compartición' : 'Sharing'}</th>
                        <th>{isEs ? 'Versión' : 'Version'}</th>
                        <th>{isEs ? 'Vigencia' : 'Validity'}</th>
                        <th>{isEs ? 'Archivo' : 'File'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr
                          key={item.id}
                          className={`r360-clickable-row ${item.archived ? 'ev-row-archived' : ''}`}
                          onClick={() => openDrawer(item)}
                        >
                          <td className="ev-col-check" onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(item.id)}
                              aria-label={isEs ? `Seleccionar ${item.title}` : `Select ${item.title}`}
                              onChange={() => toggleOne(item.id)}
                            />
                          </td>
                          <td>
                            <div className="ev-doc-title">
                              {item.title}
                              {item.ndaRequired && <span className="ev-badge ev-nda">NDA</span>}
                            </div>
                            <div className="r360-muted ev-doc-file">
                              {evidenceFileLabel(item, isEs)}
                            </div>
                          </td>
                          <td>{item.domain || '—'}</td>
                          <td>{item.area || '—'}</td>
                          <td>{item.process || '—'}</td>
                          <td>{renderChips(item.frameworks)}</td>
                          <td>{renderChips(item.controls)}</td>
                          <td>{labelOf(DOCUMENT_TYPE_LABELS, item.documentType, language)}</td>
                          <td>
                            <span className={`ev-badge ev-share-${item.shareMode}`}>
                              {labelOf(SHARE_MODE_SHORT_LABELS, item.shareMode, language)}
                            </span>
                          </td>
                          <td>{item.version || '—'}</td>
                          <td>
                            <span className={`ev-badge ev-status-${item.status}`}>
                              {labelOf(EVIDENCE_STATUS_LABELS, item.status, language)}
                            </span>
                            {item.validUntil && <div className="r360-muted">{formatDate(item.validUntil, language)}</div>}
                          </td>
                          <td onClick={(event) => event.stopPropagation()}>
                            {item.hasAsset ? (
                              <button
                                className="ev-icon-btn"
                                title={isEs ? 'Descargar archivo' : 'Download file'}
                                aria-label={isEs ? 'Descargar archivo' : 'Download file'}
                                onClick={() => download(item)}
                              >
                                ↓
                              </button>
                            ) : (
                              <span
                                className="r360-muted"
                                title={item.localPath || item.sourceUrl || (isEs ? 'Sin archivo' : 'No file')}
                              >
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="r360-pagination">
              <button className="r360-btn" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                ← {isEs ? 'Anterior' : 'Previous'}
              </button>
              <span>
                {isEs ? `Página ${page} · ${total} resultados` : `Page ${page} · ${total} results`}
              </span>
              <button className="r360-btn" disabled={!hasMore} onClick={() => setPage((current) => current + 1)}>
                {isEs ? 'Siguiente' : 'Next'} →
              </button>
            </div>
          </>
        ) : (
          <>
            <ErrorBanner error={error} />
            {notice && <div className="r360-success">{notice}</div>}
            <EvidenceMatcherTab
              language={language}
              canManage={canManage}
              onOpenItem={openDrawer}
              onDownload={download}
            />
          </>
        )}

        <p className="r360-muted">
          <Link className="r360-link" to="/requests">{isEs ? 'Volver a solicitudes' : 'Back to requests'}</Link>
        </p>
      </div>

      {id && (
        <EvidenceDetailDrawer
          item={selected}
          loading={detailLoading}
          error={detailError}
          language={language}
          canManage={canManage}
          busy={busy}
          onClose={closeDrawer}
          onEdit={(item) => navigate(`/evidence-matrix/${item.id}/edit`)}
          onArchive={archive}
          onRestore={restore}
          onUpload={uploadAsset}
          onRemoveAsset={removeAsset}
          onDownload={download}
          onOpen={openAsset}
        />
      )}

      <EvidenceCriteriaModal
        open={criteriaOpen}
        language={language}
        domains={catalogs.evidenceDomains}
        frameworks={catalogs.evidenceFrameworks}
        saving={criteriaSaving}
        error={criteriaError}
        onClose={() => setCriteriaOpen(false)}
        onSave={saveCriteria}
      />
    </Layout>
  );
}

export default EvidenceMatrixPage;
