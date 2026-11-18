import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { evidenceApi } from '../api/evidence';
import type { KbDocumentOption } from '../api/evidence';
import type {
  EvidenceCriteriaCatalog,
  EvidenceItem,
  EvidencePayload,
  EvidenceSuggestions,
} from '../types/evidence';
import {
  CLASSIFICATION_LABELS,
  DOCUMENT_TYPE_LABELS,
  EVIDENCE_CLASSIFICATIONS,
  EVIDENCE_DOCUMENT_TYPES,
  EVIDENCE_LANGUAGES,
  EVIDENCE_ORIGINS,
  EVIDENCE_SHARE_MODES,
  LANGUAGE_LABELS,
  ORIGIN_LABELS,
  SHARE_MODE_LABELS,
  labelOf,
} from '../types/evidence';
import { ErrorBanner } from '../components/request360/badges';
import { normalizeLocalPath } from '../utils/directory';

const EMPTY_FORM = {
  title: '',
  description: '',
  domain: '',
  area: '',
  process: '',
  frameworks: [] as string[],
  controls: '',
  covers: '',
  language: 'other',
  documentType: 'other',
  classification: 'internal',
  shareMode: 'full',
  ndaRequired: false,
  version: '',
  owner: '',
  tags: '',
  origin: 'upload',
  localPath: '',
  kbDocumentId: '',
  validFrom: '',
  validUntil: '',
  lastReviewedAt: '',
  notes: '',
};

type FormState = typeof EMPTY_FORM;

function toDateInput(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formatSize(size?: number) {
  if (!size) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export function EvidenceFormPage() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEs = language === 'es';
  const isEdit = Boolean(id);
  const canManage = user?.role === 'admin';

  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [item, setItem] = useState<EvidenceItem | null>(null);
  const [catalogs, setCatalogs] = useState<EvidenceCriteriaCatalog>({
    evidenceDomains: [],
    evidenceFrameworks: [],
  });
  const [suggestions, setSuggestions] = useState<EvidenceSuggestions>({
    areas: [],
    processes: [],
    controls: [],
    tags: [],
  });
  const [kbDocuments, setKbDocuments] = useState<KbDocumentOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  const toggleFramework = (framework: string) => {
    setForm((current) => ({
      ...current,
      frameworks: current.frameworks.includes(framework)
        ? current.frameworks.filter((entry) => entry !== framework)
        : [...current.frameworks, framework],
    }));
  };

  const addControl = (control: string) => {
    const current = form.controls.split(',').map((entry) => entry.trim()).filter(Boolean);
    if (current.includes(control)) return;
    set({ controls: [...current, control].join(', ') });
  };

  useEffect(() => {
    evidenceApi
      .suggestions()
      .then((response) => setSuggestions(response))
      .catch(() => undefined);
    evidenceApi
      .catalogs()
      .then((response) =>
        setCatalogs({
          evidenceDomains: response?.evidenceDomains || [],
          evidenceFrameworks: response?.evidenceFrameworks || [],
        })
      )
      .catch(() => undefined);
    evidenceApi.kbDocuments().then((docs) => setKbDocuments(docs)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!id) {
      setItem(null);
      setForm({ ...EMPTY_FORM });
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    evidenceApi
      .get(id)
      .then((loaded) => {
        if (!active) return;
        setItem(loaded);
        setForm({
          title: loaded.title || '',
          description: loaded.description || '',
          domain: loaded.domain || '',
          area: loaded.area || '',
          process: loaded.process || '',
          frameworks: loaded.frameworks || [],
          controls: (loaded.controls || []).join(', '),
          covers: loaded.covers || '',
          language: loaded.language || 'other',
          documentType: loaded.documentType || 'other',
          classification: loaded.classification || 'internal',
          shareMode: loaded.shareMode || 'full',
          ndaRequired: Boolean(loaded.ndaRequired),
          version: loaded.version || '',
          owner: loaded.owner || '',
          tags: (loaded.tags || []).join(', '),
          origin: loaded.origin || 'upload',
          localPath: loaded.localPath || '',
          kbDocumentId: loaded.kbDocumentId || '',
          validFrom: toDateInput(loaded.validFrom),
          validUntil: toDateInput(loaded.validUntil),
          lastReviewedAt: toDateInput(loaded.lastReviewedAt),
          notes: loaded.notes || '',
        });
      })
      .catch((err: any) => {
        if (active) setError(err.message || 'Error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const currentKbDocument = useMemo(
    () => kbDocuments.find((doc) => doc.id === form.kbDocumentId) || null,
    [kbDocuments, form.kbDocumentId]
  );

  const buildPayload = (): EvidencePayload => ({
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    domain: form.domain.trim(),
    area: form.area.trim(),
    process: form.process.trim() || undefined,
    frameworks: form.frameworks,
    controls: form.controls
      ? form.controls.split(',').map((control) => control.trim()).filter(Boolean)
      : [],
    covers: form.covers.trim() || undefined,
    language: form.language || 'other',
    documentType: form.documentType || 'other',
    classification: form.classification || 'internal',
    shareMode: form.shareMode || 'full',
    ndaRequired: form.ndaRequired,
    version: form.version.trim() || undefined,
    owner: form.owner.trim() || undefined,
    tags: form.tags
      ? form.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
      : [],
    origin: form.origin,
    localPath: form.origin === 'local_path' ? normalizeLocalPath(form.localPath) : undefined,
    kbDocumentId: form.origin === 'kb_document' ? form.kbDocumentId || undefined : undefined,
    validFrom: form.validFrom || undefined,
    validUntil: form.validUntil || undefined,
    lastReviewedAt: form.lastReviewedAt || undefined,
    notes: form.notes.trim() || undefined,
  });

  const validate = (): string | null => {
    if (!form.title.trim()) return isEs ? 'El título es obligatorio.' : 'Title is required.';
    if (!form.domain.trim()) return isEs ? 'El dominio es obligatorio.' : 'Domain is required.';
    if (!form.area.trim()) return isEs ? 'El área o proceso es obligatorio.' : 'Area or process is required.';
    if (form.origin === 'local_path' && !normalizeLocalPath(form.localPath)) {
      return isEs ? 'Indica la ruta local del documento.' : 'Provide the local path of the document.';
    }
    if (form.origin === 'local_path') {
      const normalized = normalizeLocalPath(form.localPath);
      if (!/^(?:[A-Za-z]:\\|\\\\)/.test(normalized)) {
        return isEs
          ? 'La ruta debe ser una ruta de Windows (C:\\... o \\\\servidor\\...).'
          : 'The path must be a Windows path (C:\\... or \\\\server\\...).';
      }
    }
    if (form.origin === 'kb_document' && !form.kbDocumentId) {
      return isEs ? 'Selecciona un documento del Knowledge Base.' : 'Select a Knowledge Base document.';
    }
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      let saved: EvidenceItem;
      if (isEdit && id) {
        saved = await evidenceApi.update(id, payload);
      } else {
        saved = await evidenceApi.create(payload);
      }

      if (file) {
        try {
          saved = await evidenceApi.uploadAsset(saved.id, file);
        } catch (uploadError: any) {
          navigate(`/evidence-matrix/${saved.id}`, { replace: true });
          throw new Error(
            isEs
              ? `La evidencia se guardó, pero el archivo no se pudo subir: ${uploadError.message}`
              : `Evidence was saved, but the file could not be uploaded: ${uploadError.message}`
          );
        }
      }

      navigate(`/evidence-matrix/${saved.id}`, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const removeAsset = async () => {
    if (!item) return;
    const confirmed = window.confirm(
      isEs ? '¿Quitar el archivo adjunto de esta evidencia?' : 'Remove the file attached to this evidence?'
    );
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await evidenceApi.removeAsset(item.id);
      setItem(updated);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!item) return;
    const confirmed = window.confirm(
      isEs ? `¿Archivar "${item.title}"?` : `Archive "${item.title}"?`
    );
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await evidenceApi.update(item.id, { archived: !item.archived });
      setItem(updated);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const backTo = isEdit && id ? `/evidence-matrix/${id}` : '/evidence-matrix';

  if (!canManage) {
    return (
      <Layout>
        <div className="r360-page r360-page-scroll r360-list-page ev-page">
          <div className="r360-page-header">
            <div>
              <h1>{isEdit ? (isEs ? 'Editar evidencia' : 'Edit evidence') : (isEs ? 'Nueva evidencia' : 'New evidence')}</h1>
            </div>
            <Link className="r360-btn" to="/evidence-matrix">← {isEs ? 'Volver' : 'Back'}</Link>
          </div>
          <div className="r360-note">
            {isEs
              ? 'Solo los administradores pueden crear o editar evidencias.'
              : 'Only administrators can create or edit evidence.'}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="r360-page r360-page-scroll r360-list-page ev-page">
        <div className="r360-page-header">
          <div>
            <h1>{isEdit ? (isEs ? 'Editar evidencia' : 'Edit evidence') : (isEs ? 'Nueva evidencia' : 'New evidence')}</h1>
            <p className="r360-subtitle">
              {isEs
                ? 'Documento completo, solo índice o interno. El archivo puede ser una subida, una ruta local o un documento del Knowledge Base.'
                : 'Full document, index only or internal. The file can be an upload, a local path or a Knowledge Base document.'}
            </p>
          </div>
          <Link className="r360-btn" to={backTo}>← {isEs ? 'Volver' : 'Back'}</Link>
        </div>

        <ErrorBanner error={error} />

        {loading ? (
          <div className="r360-loading">{isEs ? 'Cargando…' : 'Loading…'}</div>
        ) : (
          <form className="r360-card ev-form" onSubmit={handleSubmit}>
            <div className="r360-section">
              <div className="r360-section-head">
                <h2>{isEs ? 'Documento' : 'Document'}</h2>
              </div>
              <div className="r360-form-grid">
                <label className="r360-field r360-field-full">
                  <span>{isEs ? 'Título' : 'Title'} *</span>
                  <input
                    value={form.title}
                    maxLength={300}
                    onChange={(event) => set({ title: event.target.value })}
                  />
                </label>

                <label className="r360-field">
                  <span>{isEs ? 'Área o proceso' : 'Area or process'} *</span>
                  <input
                    list="ev-area-options"
                    value={form.area}
                    maxLength={200}
                    placeholder={isEs ? 'Ej. Gestión de accesos' : 'e.g. Access management'}
                    onChange={(event) => set({ area: event.target.value })}
                  />
                  <datalist id="ev-area-options">
                    {suggestions.areas.map((area) => <option key={area} value={area} />)}
                  </datalist>
                </label>

                <label className="r360-field">
                  <span>{isEs ? 'Proceso específico' : 'Specific process'}</span>
                  <input
                    list="ev-process-options"
                    value={form.process}
                    maxLength={200}
                    placeholder={isEs ? 'Ej. Altas y bajas de usuarios' : 'e.g. User onboarding/offboarding'}
                    onChange={(event) => set({ process: event.target.value })}
                  />
                  <datalist id="ev-process-options">
                    {suggestions.processes.map((process) => <option key={process} value={process} />)}
                  </datalist>
                </label>

                <label className="r360-field">
                  <span>{isEs ? 'Tipo de documento' : 'Document type'}</span>
                  <select value={form.documentType} onChange={(event) => set({ documentType: event.target.value })}>
                    {EVIDENCE_DOCUMENT_TYPES.map((type) => (
                      <option key={type} value={type}>{labelOf(DOCUMENT_TYPE_LABELS, type, language)}</option>
                    ))}
                  </select>
                </label>

                <label className="r360-field">
                  <span>{isEs ? 'Clasificación' : 'Classification'}</span>
                  <select value={form.classification} onChange={(event) => set({ classification: event.target.value })}>
                    {EVIDENCE_CLASSIFICATIONS.map((classification) => (
                      <option key={classification} value={classification}>
                        {labelOf(CLASSIFICATION_LABELS, classification, language)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="r360-field">
                  <span>{isEs ? 'Versión' : 'Version'}</span>
                  <input
                    value={form.version}
                    maxLength={60}
                    placeholder={isEs ? 'Ej. v2.1' : 'e.g. v2.1'}
                    onChange={(event) => set({ version: event.target.value })}
                  />
                </label>

                <label className="r360-field">
                  <span>{isEs ? 'Propietario' : 'Owner'}</span>
                  <input
                    value={form.owner}
                    maxLength={200}
                    placeholder={isEs ? 'Equipo o persona responsable' : 'Responsible team or person'}
                    onChange={(event) => set({ owner: event.target.value })}
                  />
                </label>

                <label className="r360-field r360-field-full">
                  <span>{isEs ? 'Descripción' : 'Description'}</span>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(event) => set({ description: event.target.value })}
                  />
                </label>

                <label className="r360-field r360-field-full">
                  <span>{isEs ? 'Etiquetas (separadas por coma)' : 'Tags (comma separated)'}</span>
                  <input
                    value={form.tags}
                    placeholder="iso27001, soc2, acceso"
                    onChange={(event) => set({ tags: event.target.value })}
                  />
                </label>
              </div>
            </div>

            <div className="r360-section">
              <div className="r360-section-head">
                <h2>{isEs ? 'Criterios de evidencia' : 'Evidence criteria'}</h2>
              </div>
              <div className="r360-form-grid">
                <label className="r360-field">
                  <span>{isEs ? 'Dominio' : 'Domain'} *</span>
                  <select value={form.domain} onChange={(event) => set({ domain: event.target.value })}>
                    <option value="">{isEs ? 'Selecciona un dominio' : 'Select a domain'}</option>
                    {catalogs.evidenceDomains.map((domain) => (
                      <option key={domain} value={domain}>{domain}</option>
                    ))}
                    {form.domain && !catalogs.evidenceDomains.includes(form.domain) && (
                      <option value={form.domain}>{form.domain}</option>
                    )}
                  </select>
                </label>

                <label className="r360-field">
                  <span>{isEs ? 'Idioma del documento' : 'Document language'}</span>
                  <select value={form.language} onChange={(event) => set({ language: event.target.value })}>
                    {EVIDENCE_LANGUAGES.map((code) => (
                      <option key={code} value={code}>{labelOf(LANGUAGE_LABELS, code, language)}</option>
                    ))}
                  </select>
                </label>

                <div className="r360-field r360-field-full">
                  <span>Frameworks</span>
                  {catalogs.evidenceFrameworks.length === 0 ? (
                    <span className="r360-muted">
                      {isEs
                        ? 'No hay frameworks configurados. Un administrador puede añadirlos desde Criterios.'
                        : 'No frameworks configured. An administrator can add them from Criteria.'}
                    </span>
                  ) : (
                    <div className="ev-check-grid">
                      {catalogs.evidenceFrameworks.map((framework) => (
                        <label className="r360-checkbox" key={framework}>
                          <input
                            type="checkbox"
                            checked={form.frameworks.includes(framework)}
                            onChange={() => toggleFramework(framework)}
                          />
                          {framework}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <label className="r360-field r360-field-full">
                  <span>{isEs ? 'Controles (separados por coma)' : 'Controls (comma separated)'}</span>
                  <input
                    list="ev-control-options"
                    value={form.controls}
                    placeholder="CC7.1, A.8.8, Art. 32"
                    onChange={(event) => set({ controls: event.target.value })}
                  />
                  <datalist id="ev-control-options">
                    {suggestions.controls.map((control) => <option key={control} value={control} />)}
                  </datalist>
                  {suggestions.controls.length > 0 && (
                    <div className="ev-chip-list ev-chip-actions">
                      {suggestions.controls.slice(0, 12).map((control) => (
                        <button
                          type="button"
                          className="ev-chip ev-chip-button"
                          key={control}
                          onClick={() => addControl(control)}
                        >
                          + {control}
                        </button>
                      ))}
                    </div>
                  )}
                </label>

                <label className="r360-field r360-field-full">
                  <span>{isEs ? 'Cubre (requisito que responde)' : 'Covers (requirement it answers)'}</span>
                  <textarea
                    rows={3}
                    value={form.covers}
                    placeholder={isEs
                      ? 'Ej. Evidencia de pruebas de seguridad estáticas, dinámicas y manuales'
                      : 'e.g. Evidence of static, dynamic and manual security testing'}
                    onChange={(event) => set({ covers: event.target.value })}
                  />
                  <span className="r360-muted">
                    {isEs
                      ? 'Se usa para sugerir esta evidencia al buscar por requisito.'
                      : 'Used to suggest this evidence when searching by requirement.'}
                  </span>
                </label>
              </div>
            </div>

            <div className="r360-section">
              <div className="r360-section-head">
                <h2>{isEs ? 'Compartición' : 'Sharing'}</h2>
              </div>
              <div className="r360-form-grid">
                <label className="r360-field">
                  <span>{isEs ? 'Modo de compartición' : 'Sharing mode'}</span>
                  <select value={form.shareMode} onChange={(event) => set({ shareMode: event.target.value })}>
                    {EVIDENCE_SHARE_MODES.map((mode) => (
                      <option key={mode} value={mode}>{labelOf(SHARE_MODE_LABELS, mode, language)}</option>
                    ))}
                  </select>
                </label>

                <label className="r360-checkbox ev-checkbox-field">
                  <input
                    type="checkbox"
                    checked={form.ndaRequired}
                    onChange={(event) => set({ ndaRequired: event.target.checked })}
                  />
                  {isEs ? 'Requiere NDA' : 'Requires NDA'}
                </label>

                <div className="r360-note r360-field-full">
                  {form.shareMode === 'index'
                    ? (isEs
                        ? 'Solo índice: sube el PDF que contiene el índice. Quien lo reciba podrá descargarlo, pero no el documento completo.'
                        : 'Index only: upload the PDF containing the index. Recipients can download it, but not the full document.')
                    : form.shareMode === 'internal'
                      ? (isEs
                          ? 'Interno: la evidencia queda catalogada pero no está pensada para compartirse fuera del equipo.'
                          : 'Internal: the evidence is cataloged but not intended for sharing outside the team.')
                      : (isEs
                          ? 'Documento completo: quien lo reciba obtiene el documento íntegro.'
                          : 'Full document: recipients get the complete document.')}
                  {' '}
                  {isEs
                    ? 'El indicador NDA es informativo en esta fase.'
                    : 'The NDA flag is informational in this phase.'}
                </div>
              </div>
            </div>

            <div className="r360-section">
              <div className="r360-section-head">
                <h2>{isEs ? 'Archivo / fuente' : 'File / source'}</h2>
              </div>

              <div className="r360-inline-group ev-origin-options">
                {EVIDENCE_ORIGINS.map((origin) => (
                  <label key={origin} className="r360-checkbox">
                    <input
                      type="radio"
                      name="ev-origin"
                      value={origin}
                      checked={form.origin === origin}
                      onChange={() => set({ origin })}
                    />
                    {labelOf(ORIGIN_LABELS, origin, language)}
                  </label>
                ))}
              </div>

              <div className="r360-form-grid ev-origin-fields">
                {form.origin === 'upload' && (
                  <div className="r360-field r360-field-full">
                    <span>{isEs ? 'Archivo' : 'File'}</span>
                    <input
                      type="file"
                      onChange={(event) => setFile(event.target.files?.[0] || null)}
                    />
                    <span className="r360-muted">
                      {isEs
                        ? 'PDF, Word, Excel, PowerPoint, imágenes o texto. Máximo 50 MB. El archivo se sube al guardar.'
                        : 'PDF, Word, Excel, PowerPoint, images or text. Up to 50 MB. The file is uploaded when saving.'}
                    </span>
                    {file && (
                      <span className="r360-muted">
                        {isEs ? 'Seleccionado' : 'Selected'}: {file.name} ({formatSize(file.size)})
                      </span>
                    )}
                    {!file && item?.asset && (
                      <div className="ev-source">
                        <div>
                          <span className="r360-muted">
                            {isEs ? 'Archivo actual' : 'Current file'}: {item.asset.originalName} ({formatSize(item.asset.size)})
                          </span>
                        </div>
                        <div className="r360-inline-group">
                          <button type="button" className="r360-btn r360-btn-danger" disabled={saving} onClick={removeAsset}>
                            {isEs ? 'Quitar archivo' : 'Remove file'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {form.origin === 'local_path' && (
                  <label className="r360-field r360-field-full">
                    <span>{isEs ? 'Ruta local (Directorio)' : 'Local path (Directory)'} *</span>
                    <input
                      value={form.localPath}
                      placeholder="C:\Users\...\Documento.pdf"
                      onChange={(event) => set({ localPath: event.target.value })}
                      onBlur={(event) => set({ localPath: normalizeLocalPath(event.target.value) })}
                    />
                    <span className="r360-muted">
                      {isEs
                        ? 'Solo se guarda la ruta; el servidor no abre ni lista el archivo.'
                        : 'Only the path is stored; the server never opens or lists the file.'}
                    </span>
                  </label>
                )}

                {form.origin === 'kb_document' && (
                  <label className="r360-field r360-field-full">
                    <span>{isEs ? 'Documento del Knowledge Base' : 'Knowledge Base document'} *</span>
                    <select value={form.kbDocumentId} onChange={(event) => set({ kbDocumentId: event.target.value })}>
                      <option value="">{isEs ? 'Selecciona un documento' : 'Select a document'}</option>
                      {kbDocuments.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.originalName}{doc.department ? ` · ${doc.department}` : ''}
                        </option>
                      ))}
                    </select>
                    {currentKbDocument?.path && (
                      <span className="r360-muted">{isEs ? 'Origen' : 'Source'}: {currentKbDocument.path}</span>
                    )}
                  </label>
                )}
              </div>
            </div>

            <div className="r360-section">
              <div className="r360-section-head">
                <h2>{isEs ? 'Vigencia y revisión' : 'Validity and review'}</h2>
              </div>
              <div className="r360-form-grid">
                <label className="r360-field">
                  <span>{isEs ? 'Válido desde' : 'Valid from'}</span>
                  <input type="date" value={form.validFrom} onChange={(event) => set({ validFrom: event.target.value })} />
                </label>
                <label className="r360-field">
                  <span>{isEs ? 'Válido hasta' : 'Valid until'}</span>
                  <input type="date" value={form.validUntil} onChange={(event) => set({ validUntil: event.target.value })} />
                </label>
                <label className="r360-field">
                  <span>{isEs ? 'Última revisión' : 'Last review'}</span>
                  <input
                    type="date"
                    value={form.lastReviewedAt}
                    onChange={(event) => set({ lastReviewedAt: event.target.value })}
                  />
                </label>
                <label className="r360-field r360-field-full">
                  <span>{isEs ? 'Notas internas' : 'Internal notes'}</span>
                  <textarea rows={3} value={form.notes} onChange={(event) => set({ notes: event.target.value })} />
                </label>
              </div>
            </div>

            <div className="r360-section ev-form-actions">
              <div className="r360-inline-group">
                <button type="submit" className="r360-btn r360-btn-primary" disabled={saving}>
                  {saving
                    ? (isEs ? 'Guardando…' : 'Saving…')
                    : (isEs ? 'Guardar' : 'Save')}
                </button>
                <Link className="r360-btn" to={backTo}>{isEs ? 'Cancelar' : 'Cancel'}</Link>
                {isEdit && item && (
                  <button type="button" className="r360-btn r360-btn-danger" disabled={saving} onClick={archive}>
                    {item.archived
                      ? (isEs ? 'Restaurar' : 'Restore')
                      : (isEs ? 'Archivar' : 'Archive')}
                  </button>
                )}
              </div>
              {isEdit && item?.archived && (
                <div className="r360-note">
                  {isEs
                    ? 'Esta evidencia está archivada y no aparece en el catálogo por defecto.'
                    : 'This evidence is archived and does not appear in the catalog by default.'}
                </div>
              )}
            </div>
          </form>
        )}
      </div>
    </Layout>
  );
}

export default EvidenceFormPage;
