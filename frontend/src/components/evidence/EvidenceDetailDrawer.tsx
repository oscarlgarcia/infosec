import { useEffect, useRef, useState } from 'react';
import type { EvidenceItem } from '../../types/evidence';
import {
  CLASSIFICATION_LABELS,
  DOCUMENT_TYPE_LABELS,
  EVIDENCE_STATUS_LABELS,
  LANGUAGE_LABELS,
  ORIGIN_LABELS,
  SHARE_MODE_LABELS,
  labelOf,
} from '../../types/evidence';
import { copyText } from '../../utils/directory';
import { formatDate, formatDateTime } from '../request360/badges';

type Lang = 'es' | 'en';

interface EvidenceDetailDrawerProps {
  item: EvidenceItem | null;
  loading?: boolean;
  error?: string | null;
  language: Lang;
  canManage: boolean;
  busy?: boolean;
  onClose: () => void;
  onEdit: (item: EvidenceItem) => void;
  onArchive: (item: EvidenceItem) => void;
  onRestore: (item: EvidenceItem) => void;
  onUpload: (item: EvidenceItem, file: File) => void;
  onRemoveAsset: (item: EvidenceItem) => void;
  onDownload: (item: EvidenceItem) => void;
  onOpen: (item: EvidenceItem) => void;
}

function formatSize(size?: number) {
  if (!size) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export function EvidenceDetailDrawer({
  item,
  loading,
  error,
  language,
  canManage,
  busy,
  onClose,
  onEdit,
  onArchive,
  onRestore,
  onUpload,
  onRemoveAsset,
  onDownload,
  onOpen,
}: EvidenceDetailDrawerProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setNotice(null);
  }, [item?.id]);

  const isEs = language === 'es';

  const copy = async (value: string, message: string) => {
    const ok = await copyText(value);
    setNotice(ok ? message : (isEs ? 'No se pudo copiar al portapapeles.' : 'Could not copy to the clipboard.'));
  };

  const buildIndexText = (evidence: EvidenceItem) => {
    const lines = [
      `${isEs ? 'Matriz de Evidencias' : 'Evidence Matrix'} — ${evidence.title}`,
      `${isEs ? 'Dominio' : 'Domain'}: ${evidence.domain || '—'}`,
      `${isEs ? 'Área' : 'Area'}: ${evidence.area || '—'}`,
      `${isEs ? 'Proceso' : 'Process'}: ${evidence.process || '—'}`,
      `${isEs ? 'Frameworks' : 'Frameworks'}: ${evidence.frameworks?.join(', ') || '—'}`,
      `${isEs ? 'Controles' : 'Controls'}: ${evidence.controls?.join(', ') || '—'}`,
      `${isEs ? 'Idioma' : 'Language'}: ${labelOf(LANGUAGE_LABELS, evidence.language, language)}`,
      `${isEs ? 'Cubre' : 'Covers'}: ${evidence.covers || '—'}`,
      `${isEs ? 'Tipo' : 'Type'}: ${labelOf(DOCUMENT_TYPE_LABELS, evidence.documentType, language)}`,
      `${isEs ? 'Versión' : 'Version'}: ${evidence.version || '—'}`,
      `${isEs ? 'Compartición' : 'Sharing'}: ${labelOf(SHARE_MODE_LABELS, evidence.shareMode, language)}`,
      `${isEs ? 'Archivo' : 'File'}: ${evidence.asset?.originalName || '—'}`,
    ];
    if (evidence.asset && evidence.downloadUrl) {
      lines.push(`${isEs ? 'Enlace' : 'Link'}: ${window.location.origin}${evidence.downloadUrl}`);
    }
    if (evidence.localPath) lines.push(`${isEs ? 'Ruta local' : 'Local path'}: ${evidence.localPath}`);
    if (evidence.sourceUrl) lines.push(`${isEs ? 'Origen KB' : 'KB source'}: ${window.location.origin}${evidence.sourceUrl}`);
    return lines.join('\n');
  };

  const shareMode = (item?.shareMode || 'full') as string;
  const status = (item?.status || 'active') as string;
  // Display priority follows the chosen origin, so switching an item to a
  // local path or KB document does not keep showing an older uploaded file.
  const origin = item?.origin || 'upload';
  const sourceKind = !item
    ? 'none'
    : origin === 'local_path' && item.localPath
      ? 'local'
      : origin === 'kb_document' && item.sourceUrl
        ? 'kb'
        : item.asset
          ? 'asset'
          : item.localPath
            ? 'local'
            : item.sourceUrl
              ? 'kb'
              : 'none';

  return (
    <div className="ev-drawer-layer" role="presentation">
      <div className="ev-drawer-overlay" onClick={onClose} />
      <aside className="ev-drawer" role="dialog" aria-modal="true" aria-label={item?.title || (isEs ? 'Detalle de evidencia' : 'Evidence detail')}>
        <header className="ev-drawer-head">
          <div>
            <div className="r360-detail-topline">
              <span className={`ev-badge ev-share-${shareMode}`}>{labelOf(SHARE_MODE_LABELS, shareMode, language)}</span>
              <span className={`ev-badge ev-status-${status}`}>{labelOf(EVIDENCE_STATUS_LABELS, status, language)}</span>
              {item?.ndaRequired && <span className="ev-badge ev-nda">NDA</span>}
            </div>
            <h2>{item?.title || (loading ? (isEs ? 'Cargando…' : 'Loading…') : (isEs ? 'Evidencia' : 'Evidence'))}</h2>
            {item && <p className="r360-muted">{item.area}{item.process ? ` · ${item.process}` : ''}</p>}
          </div>
          <button className="ev-drawer-close" onClick={onClose} aria-label={isEs ? 'Cerrar' : 'Close'}>×</button>
        </header>

        <div className="ev-drawer-body">
          {error && <div className="r360-error" role="alert">{error}</div>}
          {notice && <div className="r360-success">{notice}</div>}

          {loading || !item ? (
            <div className="r360-loading">{isEs ? 'Cargando…' : 'Loading…'}</div>
          ) : (
            <>
              <section className="ev-drawer-section">
                <h3>{isEs ? 'Archivo / fuente' : 'File / source'}</h3>
                {sourceKind === 'asset' ? (
                  <div className="ev-asset">
                    <div className="ev-asset-icon" aria-hidden="true">📄</div>
                    <div className="ev-asset-main">
                      <strong>{item.asset.originalName}</strong>
                      <span className="r360-muted">
                        {formatSize(item.asset.size)} · {item.asset.mimeType}
                        {item.asset.uploadedAt ? ` · ${formatDateTime(item.asset.uploadedAt, language)}` : ''}
                      </span>
                      {item.asset.uploadedBy && (
                        <span className="r360-muted">{isEs ? 'Subido por' : 'Uploaded by'} {item.asset.uploadedBy}</span>
                      )}
                    </div>
                    <div className="r360-inline-group">
                      <button className="r360-btn r360-btn-primary" onClick={() => onOpen(item)}>
                        {isEs ? 'Abrir' : 'Open'}
                      </button>
                      <button className="r360-btn" onClick={() => onDownload(item)}>
                        {isEs ? 'Descargar' : 'Download'}
                      </button>
                      <button className="r360-btn" onClick={() => copy(buildIndexText(item), isEs ? 'Índice copiado.' : 'Index copied.')}>
                        {isEs ? 'Copiar índice' : 'Copy index'}
                      </button>
                    </div>
                  </div>
                ) : sourceKind === 'local' ? (
                  <div className="ev-source">
                    <div>
                      <span className="r360-muted">{isEs ? 'Ruta local (Directorio)' : 'Local path (Directory)'}</span>
                      <code className="ev-code">{item.localPath}</code>
                    </div>
                    <div className="r360-inline-group">
                      <button className="r360-btn" onClick={() => copy(item.localPath, isEs ? 'Ruta copiada.' : 'Path copied.')}>
                        {isEs ? 'Copiar ruta' : 'Copy path'}
                      </button>
                      <button className="r360-btn" onClick={() => copy(buildIndexText(item), isEs ? 'Índice copiado.' : 'Index copied.')}>
                        {isEs ? 'Copiar índice' : 'Copy index'}
                      </button>
                    </div>
                  </div>
                ) : sourceKind === 'kb' ? (
                  <div className="ev-source">
                    <div>
                      <span className="r360-muted">{isEs ? 'Documento del Knowledge Base' : 'Knowledge Base document'}</span>
                      <a className="r360-link" href={item.sourceUrl} target="_blank" rel="noreferrer">
                        {isEs ? 'Abrir documento del KB' : 'Open KB document'}
                      </a>
                    </div>
                    <div className="r360-inline-group">
                      <button className="r360-btn" onClick={() => copy(`${window.location.origin}${item.sourceUrl}`, isEs ? 'Enlace copiado.' : 'Link copied.')}>
                        {isEs ? 'Copiar enlace' : 'Copy link'}
                      </button>
                      <button className="r360-btn" onClick={() => copy(buildIndexText(item), isEs ? 'Índice copiado.' : 'Index copied.')}>
                        {isEs ? 'Copiar índice' : 'Copy index'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="r360-note">
                    {isEs
                      ? 'Esta evidencia todavía no tiene archivo ni fuente asociada. Puedes subir un PDF (documento completo o solo índice) desde Editar.'
                      : 'This evidence has no file or source yet. You can upload a PDF (full document or index only) from Edit.'}
                  </div>
                )}

                {canManage && (
                  <div className="r360-inline-group ev-drawer-actions">
                    <input
                      ref={fileInputRef}
                      type="file"
                      style={{ display: 'none' }}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) onUpload(item, file);
                        event.target.value = '';
                      }}
                    />
                    <button className="r360-btn" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                      {item.asset ? (isEs ? 'Reemplazar archivo' : 'Replace file') : (isEs ? 'Subir archivo' : 'Upload file')}
                    </button>
                    {item.asset && (
                      <button className="r360-btn r360-btn-danger" disabled={busy} onClick={() => onRemoveAsset(item)}>
                        {isEs ? 'Quitar archivo' : 'Remove file'}
                      </button>
                    )}
                  </div>
                )}
              </section>

              <section className="ev-drawer-section">
                <h3>{isEs ? 'Metadatos' : 'Metadata'}</h3>
                <div className="r360-detail-list">
                  <div className="r360-detail-row"><span className="r360-muted">{isEs ? 'Dominio' : 'Domain'}</span><strong>{item.domain || '—'}</strong></div>
                  <div className="r360-detail-row"><span className="r360-muted">{isEs ? 'Área / proceso' : 'Area / process'}</span><strong>{item.area || '—'}</strong></div>
                  <div className="r360-detail-row"><span className="r360-muted">{isEs ? 'Proceso' : 'Process'}</span><strong>{item.process || '—'}</strong></div>
                  <div className="r360-detail-row"><span className="r360-muted">Frameworks</span><strong>{item.frameworks?.length ? item.frameworks.join(', ') : '—'}</strong></div>
                  <div className="r360-detail-row"><span className="r360-muted">{isEs ? 'Controles' : 'Controls'}</span><strong>{item.controls?.length ? item.controls.join(', ') : '—'}</strong></div>
                  <div className="r360-detail-row"><span className="r360-muted">{isEs ? 'Idioma' : 'Language'}</span><strong>{labelOf(LANGUAGE_LABELS, item.language, language)}</strong></div>
                  <div className="r360-detail-row"><span className="r360-muted">{isEs ? 'Tipo de documento' : 'Document type'}</span><strong>{labelOf(DOCUMENT_TYPE_LABELS, item.documentType, language)}</strong></div>
                  <div className="r360-detail-row"><span className="r360-muted">{isEs ? 'Clasificación' : 'Classification'}</span><strong>{labelOf(CLASSIFICATION_LABELS, item.classification, language)}</strong></div>
                  <div className="r360-detail-row"><span className="r360-muted">{isEs ? 'Compartición' : 'Sharing'}</span><strong>{labelOf(SHARE_MODE_LABELS, item.shareMode, language)}</strong></div>
                  <div className="r360-detail-row"><span className="r360-muted">NDA</span><strong>{item.ndaRequired ? (isEs ? 'Requerido' : 'Required') : (isEs ? 'No requerido' : 'Not required')}</strong></div>
                  <div className="r360-detail-row"><span className="r360-muted">{isEs ? 'Versión' : 'Version'}</span><strong>{item.version || '—'}</strong></div>
                  <div className="r360-detail-row"><span className="r360-muted">{isEs ? 'Propietario' : 'Owner'}</span><strong>{item.owner || '—'}</strong></div>
                  <div className="r360-detail-row"><span className="r360-muted">{isEs ? 'Origen' : 'Origin'}</span><strong>{labelOf(ORIGIN_LABELS, item.origin, language)}</strong></div>
                  <div className="r360-detail-row"><span className="r360-muted">{isEs ? 'Válido desde' : 'Valid from'}</span><strong>{formatDate(item.validFrom, language)}</strong></div>
                  <div className="r360-detail-row"><span className="r360-muted">{isEs ? 'Válido hasta' : 'Valid until'}</span><strong>{formatDate(item.validUntil, language)}</strong></div>
                  <div className="r360-detail-row"><span className="r360-muted">{isEs ? 'Última revisión' : 'Last review'}</span><strong>{formatDate(item.lastReviewedAt, language)}</strong></div>
                  <div className="r360-detail-row"><span className="r360-muted">{isEs ? 'Creado' : 'Created'}</span><strong>{formatDateTime(item.createdAt, language)}{item.createdBy ? ` · ${item.createdBy}` : ''}</strong></div>
                  <div className="r360-detail-row"><span className="r360-muted">{isEs ? 'Actualizado' : 'Updated'}</span><strong>{formatDateTime(item.updatedAt, language)}{item.updatedBy ? ` · ${item.updatedBy}` : ''}</strong></div>
                  {item.archived && (
                    <div className="r360-detail-row">
                      <span className="r360-muted">{isEs ? 'Archivada' : 'Archived'}</span>
                      <strong>{formatDateTime(item.archivedAt, language)}{item.archivedBy ? ` · ${item.archivedBy}` : ''}</strong>
                    </div>
                  )}
                </div>
              </section>

              {item.covers && (
                <section className="ev-drawer-section">
                  <h3>{isEs ? 'Cubre' : 'Covers'}</h3>
                  <p className="ev-text">{item.covers}</p>
                </section>
              )}

              {item.tags.length > 0 && (
                <section className="ev-drawer-section">
                  <h3>{isEs ? 'Etiquetas' : 'Tags'}</h3>
                  <div className="ev-tags">
                    {item.tags.map((tag) => <span key={tag} className="ev-tag">{tag}</span>)}
                  </div>
                </section>
              )}

              {item.description && (
                <section className="ev-drawer-section">
                  <h3>{isEs ? 'Descripción' : 'Description'}</h3>
                  <p className="ev-text">{item.description}</p>
                </section>
              )}

              {item.notes && (
                <section className="ev-drawer-section">
                  <h3>{isEs ? 'Notas internas' : 'Internal notes'}</h3>
                  <p className="ev-text">{item.notes}</p>
                </section>
              )}
            </>
          )}
        </div>

        <footer className="ev-drawer-foot">
          {canManage && item && (
            <div className="r360-inline-group">
              <button className="r360-btn r360-btn-primary" onClick={() => onEdit(item)}>
                {isEs ? 'Editar' : 'Edit'}
              </button>
              {item.archived ? (
                <button className="r360-btn" disabled={busy} onClick={() => onRestore(item)}>
                  {isEs ? 'Restaurar' : 'Restore'}
                </button>
              ) : (
                <button className="r360-btn r360-btn-danger" disabled={busy} onClick={() => onArchive(item)}>
                  {isEs ? 'Archivar' : 'Archive'}
                </button>
              )}
            </div>
          )}
          <button className="r360-btn" onClick={onClose}>{isEs ? 'Cerrar' : 'Close'}</button>
        </footer>
      </aside>
    </div>
  );
}
