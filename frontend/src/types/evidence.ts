/**
 * Frontend types for the global Evidence Matrix. Mirrors
 * `src/services/evidence/evidence.service.ts#serializeEvidence`.
 */

export const EVIDENCE_SHARE_MODES = ['full', 'index', 'internal'] as const;
export type EvidenceShareMode = typeof EVIDENCE_SHARE_MODES[number];

export const EVIDENCE_ORIGINS = ['upload', 'local_path', 'kb_document'] as const;
export type EvidenceOrigin = typeof EVIDENCE_ORIGINS[number];

export const EVIDENCE_DOCUMENT_TYPES = [
  'policy',
  'procedure',
  'standard',
  'guideline',
  'certificate',
  'report',
  'register',
  'plan',
  'record',
  'other',
] as const;
export type EvidenceDocumentType = typeof EVIDENCE_DOCUMENT_TYPES[number];

export const EVIDENCE_STATUSES = ['active', 'expiring', 'expired', 'archived'] as const;
export type EvidenceStatus = typeof EVIDENCE_STATUSES[number];

export const EVIDENCE_CLASSIFICATIONS = ['public', 'internal', 'confidential', 'restricted'] as const;
export type EvidenceClassification = typeof EVIDENCE_CLASSIFICATIONS[number];

export const EVIDENCE_LANGUAGES = ['es', 'en', 'it', 'other'] as const;
export type EvidenceLanguage = typeof EVIDENCE_LANGUAGES[number];

type Lang = 'es' | 'en';

export const LANGUAGE_LABELS: Record<EvidenceLanguage, { es: string; en: string }> = {
  es: { es: 'Español', en: 'Spanish' },
  en: { es: 'Inglés', en: 'English' },
  it: { es: 'Italiano', en: 'Italian' },
  other: { es: 'Otro', en: 'Other' },
};

export const MATCH_FIELD_LABELS: Record<string, { es: string; en: string }> = {
  covers: { es: 'Cubre', en: 'Covers' },
  tags: { es: 'Etiquetas', en: 'Tags' },
  title: { es: 'Título', en: 'Title' },
  controls: { es: 'Controles', en: 'Controls' },
  frameworks: { es: 'Frameworks', en: 'Frameworks' },
  area: { es: 'Área', en: 'Area' },
  process: { es: 'Proceso', en: 'Process' },
  domain: { es: 'Dominio', en: 'Domain' },
  description: { es: 'Descripción', en: 'Description' },
  saved_mapping: { es: 'Mapeo guardado', en: 'Saved mapping' },
};

export const SHARE_MODE_LABELS: Record<EvidenceShareMode, { es: string; en: string }> = {
  full: { es: 'Documento completo', en: 'Full document' },
  index: { es: 'Solo índice', en: 'Index only' },
  internal: { es: 'Interno', en: 'Internal' },
};

export const SHARE_MODE_SHORT_LABELS: Record<EvidenceShareMode, { es: string; en: string }> = {
  full: { es: 'Completo', en: 'Full' },
  index: { es: 'Índice', en: 'Index' },
  internal: { es: 'Interno', en: 'Internal' },
};

export const ORIGIN_LABELS: Record<EvidenceOrigin, { es: string; en: string }> = {
  upload: { es: 'Archivo subido', en: 'Uploaded file' },
  local_path: { es: 'Ruta local (Directorio)', en: 'Local path (Directory)' },
  kb_document: { es: 'Documento del KB', en: 'KB document' },
};

export const DOCUMENT_TYPE_LABELS: Record<EvidenceDocumentType, { es: string; en: string }> = {
  policy: { es: 'Política', en: 'Policy' },
  procedure: { es: 'Procedimiento', en: 'Procedure' },
  standard: { es: 'Estándar', en: 'Standard' },
  guideline: { es: 'Guía', en: 'Guideline' },
  certificate: { es: 'Certificado', en: 'Certificate' },
  report: { es: 'Informe', en: 'Report' },
  register: { es: 'Registro', en: 'Register' },
  plan: { es: 'Plan', en: 'Plan' },
  record: { es: 'Evidencia / registro', en: 'Record' },
  other: { es: 'Otro', en: 'Other' },
};

export const EVIDENCE_STATUS_LABELS: Record<EvidenceStatus, { es: string; en: string }> = {
  active: { es: 'Vigente', en: 'Active' },
  expiring: { es: 'Por vencer', en: 'Expiring' },
  expired: { es: 'Vencida', en: 'Expired' },
  archived: { es: 'Archivada', en: 'Archived' },
};

export const CLASSIFICATION_LABELS: Record<EvidenceClassification, { es: string; en: string }> = {
  public: { es: 'Pública', en: 'Public' },
  internal: { es: 'Interna', en: 'Internal' },
  confidential: { es: 'Confidencial', en: 'Confidential' },
  restricted: { es: 'Restringida', en: 'Restricted' },
};

export function labelOf(
  map: Record<string, { es: string; en: string }>,
  value: string | undefined,
  lang: Lang
): string {
  if (!value) return '—';
  return map[value]?.[lang] || value;
}

export interface EvidenceAsset {
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  checksum?: string;
  uploadedAt?: string;
  uploadedBy?: string;
}

export interface EvidenceItem {
  id: string;
  title: string;
  description: string;
  domain: string;
  area: string;
  process: string;
  frameworks: string[];
  controls: string[];
  covers: string;
  language: EvidenceLanguage | string;
  documentType: EvidenceDocumentType | string;
  classification: EvidenceClassification | string;
  shareMode: EvidenceShareMode | string;
  ndaRequired: boolean;
  version: string;
  owner: string;
  tags: string[];
  origin: EvidenceOrigin | string;
  localPath: string;
  kbDocumentId: string;
  sourceUrl: string;
  asset: EvidenceAsset | null;
  hasAsset: boolean;
  downloadUrl: string | null;
  validFrom: string | null;
  validUntil: string | null;
  lastReviewedAt: string | null;
  notes: string;
  archived: boolean;
  archivedAt: string | null;
  archivedBy: string;
  status: EvidenceStatus | string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface EvidenceListResponse {
  items: EvidenceItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface EvidencePayload {
  title: string;
  description?: string | null;
  domain: string;
  area: string;
  process?: string | null;
  frameworks?: string[];
  controls?: string[];
  covers?: string | null;
  language?: string;
  documentType?: string;
  classification?: string;
  shareMode?: string;
  ndaRequired?: boolean;
  version?: string | null;
  owner?: string | null;
  tags?: string[];
  origin?: string;
  localPath?: string | null;
  kbDocumentId?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  lastReviewedAt?: string | null;
  notes?: string | null;
}

export interface EvidenceCriteriaCatalog {
  evidenceDomains: string[];
  evidenceFrameworks: string[];
}

export interface EvidenceSuggestions {
  areas: string[];
  processes: string[];
  controls: string[];
  tags: string[];
}

export interface EvidenceMapping {
  id: string;
  requirement: string;
  normalized: string;
  evidenceId: string;
  evidenceTitle: string;
  language: string;
  notes: string;
  hits: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceMatchReason {
  field: string;
  tokens: string[];
}

export interface EvidenceMatch {
  evidence: EvidenceItem;
  score: number;
  reasons: EvidenceMatchReason[];
  savedMapping?: { id: string; requirement: string };
}

export interface EvidenceMatchResponse {
  query: string;
  tokens: string[];
  matches: EvidenceMatch[];
}

export interface EvidenceImportResult {
  created: number;
  total: number;
  errors: Array<{ row: number; message: string }>;
}
