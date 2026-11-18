import { useCallback, useEffect, useRef, useState } from 'react';
import { evidenceApi } from '../../api/evidence';
import type {
  EvidenceImportResult,
  EvidenceItem,
  EvidenceMapping,
  EvidenceMatch,
  EvidenceMatchResponse,
} from '../../types/evidence';
import { LANGUAGE_LABELS, MATCH_FIELD_LABELS, labelOf } from '../../types/evidence';
import { ErrorBanner } from '../request360/badges';

type Lang = 'es' | 'en';

interface EvidenceMatcherTabProps {
  language: Lang;
  canManage: boolean;
  onOpenItem: (item: EvidenceItem) => void;
  onDownload: (item: EvidenceItem) => void;
}

export function EvidenceMatcherTab({
  language,
  canManage,
  onOpenItem,
  onDownload,
}: EvidenceMatcherTabProps) {
  const isEs = language === 'es';
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvidenceMatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mappings, setMappings] = useState<EvidenceMapping[]>([]);
  const [mappingsLoading, setMappingsLoading] = useState(true);
  const [busyMappingId, setBusyMappingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<EvidenceImportResult | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const loadMappings = useCallback(async () => {
    setMappingsLoading(true);
    try {
      const response = await evidenceApi.listMappings();
      setMappings(response.items || []);
    } catch {
      // The matcher is still usable without the saved mappings list.
    } finally {
      setMappingsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  const search = async () => {
    const text = query.trim();
    if (text.length < 3) {
      setError(isEs ? 'Escribe al menos 3 caracteres del requisito.' : 'Type at least 3 characters of the requirement.');
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await evidenceApi.match(text, 8);
      setResult(response);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const saveMapping = async (match: EvidenceMatch) => {
    if (!result?.query) return;
    setBusyMappingId(match.evidence.id);
    setError(null);
    setNotice(null);
    try {
      await evidenceApi.createMapping({
        requirement: result.query,
        evidenceId: match.evidence.id,
        language: match.evidence.language || 'other',
      });
      setNotice(isEs ? 'Mapeo guardado. Se usará para futuras búsquedas.' : 'Mapping saved. It will be used for future searches.');
      await loadMappings();
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setBusyMappingId(null);
    }
  };

  const removeMapping = async (mapping: EvidenceMapping) => {
    const confirmed = window.confirm(
      isEs
        ? `¿Eliminar el mapeo "${mapping.requirement.slice(0, 80)}…"?`
        : `Delete the mapping "${mapping.requirement.slice(0, 80)}…"?`
    );
    if (!confirmed) return;
    setBusyMappingId(mapping.id);
    setError(null);
    try {
      await evidenceApi.deleteMapping(mapping.id);
      setNotice(isEs ? 'Mapeo eliminado.' : 'Mapping deleted.');
      await loadMappings();
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setBusyMappingId(null);
    }
  };

  const importMappings = async (file: File) => {
    setImporting(true);
    setError(null);
    setNotice(null);
    setImportResult(null);
    try {
      const response = await evidenceApi.importMappings(file);
      setImportResult(response);
      if (response.created) await loadMappings();
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setImporting(false);
    }
  };

  const scorePercent = (score: number) => Math.round(Math.max(0, Math.min(1, score)) * 100);

  return (
    <div className="ev-matcher">
      <div className="r360-card ev-matcher-card">
        <div className="ev-matcher-head">
          <div>
            <h2>{isEs ? 'Buscar evidencia para un requisito' : 'Find evidence for a requirement'}</h2>
            <p className="r360-muted">
              {isEs
                ? 'Pega una línea del cuestionario (ES/EN/IT). Se compara con dominio, área, proceso, frameworks, controles, «cubre» y etiquetas.'
                : 'Paste a questionnaire line (ES/EN/IT). It is matched against domain, area, process, frameworks, controls, “covers” and tags.'}
            </p>
          </div>
          {canManage && (
            <>
              <input
                ref={importRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) importMappings(file);
                  event.target.value = '';
                }}
              />
              <button className="r360-btn" disabled={importing} onClick={() => importRef.current?.click()}>
                {importing
                  ? (isEs ? 'Importando…' : 'Importing…')
                  : (isEs ? 'Importar requisitos' : 'Import requirements')}
              </button>
            </>
          )}
        </div>

        <div className="ev-matcher-input">
          <textarea
            rows={4}
            value={query}
            placeholder={isEs
              ? 'Ej. Attestazione / evidenza dell’esecuzione dei processi di security testing (statici, dinamici e manuali)…'
              : 'e.g. Evidence of security testing execution (static, dynamic and manual)…'}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) search();
            }}
          />
          <div className="r360-inline-group">
            <button className="r360-btn r360-btn-primary" disabled={loading} onClick={search}>
              {loading ? (isEs ? 'Buscando…' : 'Searching…') : (isEs ? 'Buscar evidencia' : 'Find evidence')}
            </button>
            <span className="r360-muted">
              {isEs ? 'Ctrl + Enter para buscar' : 'Ctrl + Enter to search'}
            </span>
          </div>
        </div>

        <ErrorBanner error={error} />
        {notice && <div className="r360-success">{notice}</div>}

        {importResult && (
          <div className={importResult.errors.length ? 'r360-note' : 'r360-success'}>
            {isEs
              ? `${importResult.created} mapeos importados de ${importResult.total} filas.`
              : `${importResult.created} mappings imported from ${importResult.total} rows.`}
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
      </div>

      {result && (
        <div className="ev-match-results">
          <div className="ev-match-results-head">
            <h3>{isEs ? 'Evidencias sugeridas' : 'Suggested evidence'}</h3>
            <span className="r360-muted">
              {result.matches.length
                ? (isEs ? `${result.matches.length} resultados` : `${result.matches.length} results`)
                : (isEs ? 'Sin coincidencias' : 'No matches')}
            </span>
          </div>

          {result.matches.length === 0 ? (
            <div className="r360-note">
              {isEs
                ? 'No hay evidencias que coincidan. Añade criterios a las evidencias o crea una nueva, y vuelve a buscar.'
                : 'No evidence matches. Add criteria to evidence or create a new item, then search again.'}
            </div>
          ) : (
            <div className="ev-match-list">
              {result.matches.map((match) => (
                <article className="ev-match-card" key={match.evidence.id}>
                  <div className="ev-match-head">
                    <div className="ev-match-title">
                      <strong>{match.evidence.title}</strong>
                      <span className="r360-muted">
                        {[match.evidence.domain, match.evidence.area, match.evidence.process]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </span>
                    </div>
                    <div className="ev-match-score" title={isEs ? 'Puntuación de coincidencia' : 'Match score'}>
                      <span>{scorePercent(match.score)}%</span>
                      <div className="ev-match-score-bar">
                        <span style={{ width: `${scorePercent(match.score)}%` }} />
                      </div>
                    </div>
                  </div>

                  {match.evidence.frameworks.length > 0 && (
                    <div className="ev-match-badges">
                      {match.evidence.frameworks.map((framework) => (
                        <span className="ev-badge" key={framework}>{framework}</span>
                      ))}
                      <span className="ev-badge ev-lang">
                        {labelOf(LANGUAGE_LABELS, match.evidence.language, language)}
                      </span>
                    </div>
                  )}

                  <div className="ev-match-reasons">
                    {match.reasons.map((reason) => (
                      <span className="ev-match-reason" key={reason.field}>
                        {labelOf(MATCH_FIELD_LABELS, reason.field, language)}
                        {reason.tokens.length > 0 ? `: ${reason.tokens.join(', ')}` : ''}
                      </span>
                    ))}
                  </div>

                  {match.evidence.covers && (
                    <p className="ev-match-covers">
                      <span className="r360-muted">{isEs ? 'Cubre' : 'Covers'}:</span> {match.evidence.covers}
                    </p>
                  )}

                  <div className="ev-match-actions">
                    <button className="r360-btn" onClick={() => onOpenItem(match.evidence)}>
                      {isEs ? 'Abrir ficha' : 'Open details'}
                    </button>
                    <button
                      className="r360-btn"
                      disabled={!match.evidence.hasAsset}
                      title={match.evidence.hasAsset ? '' : (isEs ? 'Sin archivo descargable' : 'No downloadable file')}
                      onClick={() => onDownload(match.evidence)}
                    >
                      {isEs ? 'Descargar' : 'Download'}
                    </button>
                    {canManage && (
                      <button
                        className="r360-btn r360-btn-primary"
                        disabled={busyMappingId === match.evidence.id}
                        onClick={() => saveMapping(match)}
                      >
                        {match.savedMapping
                          ? (isEs ? 'Mapeo guardado ✓' : 'Mapping saved ✓')
                          : (isEs ? 'Guardar mapeo' : 'Save mapping')}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="r360-card ev-mappings">
        <div className="ev-match-results-head">
          <h3>{isEs ? 'Mapeos guardados' : 'Saved mappings'}</h3>
          <span className="r360-muted">{mappings.length}</span>
        </div>
        {mappingsLoading ? (
          <div className="r360-loading">{isEs ? 'Cargando…' : 'Loading…'}</div>
        ) : mappings.length === 0 ? (
          <div className="r360-note">
            {isEs
              ? 'Todavía no hay mapeos confirmados. Busca un requisito y guarda la evidencia que lo responde.'
              : 'No confirmed mappings yet. Search a requirement and save the evidence that answers it.'}
          </div>
        ) : (
          <div className="ev-mapping-list">
            {mappings.map((mapping) => (
              <div className="ev-mapping-row" key={mapping.id}>
                <div className="ev-mapping-text">
                  <span>{mapping.requirement}</span>
                  <span className="r360-muted">→ {mapping.evidenceTitle || '—'}</span>
                </div>
                {canManage && (
                  <button
                    className="r360-btn r360-btn-danger"
                    disabled={busyMappingId === mapping.id}
                    onClick={() => removeMapping(mapping)}
                  >
                    {isEs ? 'Eliminar' : 'Delete'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
