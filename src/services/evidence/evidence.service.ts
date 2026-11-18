import mongoose from 'mongoose';
import { DocumentModel, EvidenceItem } from '../../db/mongo/models';
import { EvidenceCreateInput, EvidenceUpdateInput } from '../../schemas/evidence';
import {
  buildStorageKey,
  checksumBuffer,
  deleteObject,
  getObjectStream,
  putObject,
  sanitizeFilename,
} from '../storage/storage.service';

export interface EvidenceActor {
  id?: string;
  username?: string;
  email?: string;
  role?: string;
}

export interface EvidenceListFilters {
  q?: string;
  domain?: string;
  area?: string;
  framework?: string;
  language?: string;
  shareMode?: string;
  origin?: string;
  documentType?: string;
  classification?: string;
  ndaRequired?: boolean;
  includeArchived?: boolean;
  status?: string;
  page?: number;
  limit?: number;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ['image/', 'text/'];
const ALLOWED_MIME_EXACT = new Set([
  'application/pdf',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/octet-stream',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
]);

function badRequest(message: string, details?: any) {
  return Object.assign(new Error(message), { statusCode: 400, details });
}

function notFound(message = 'Evidence not found') {
  return Object.assign(new Error(message), { statusCode: 404 });
}

function assertAllowedFile(file: { filename: string; data: Buffer; mimetype?: string }) {
  if (!file.data?.length) throw badRequest('Empty file');
  if (file.data.length > MAX_FILE_SIZE) {
    throw Object.assign(new Error(`File ${file.filename} exceeds the 50MB limit`), { statusCode: 413 });
  }
  const mime = file.mimetype || 'application/octet-stream';
  const allowed = ALLOWED_MIME_EXACT.has(mime) || ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
  if (!allowed) {
    throw Object.assign(new Error(`File type ${mime} is not allowed`), { statusCode: 415 });
  }
}

function assertObjectId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw notFound();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toDate(value?: string | null): Date | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function actorName(actor?: EvidenceActor) {
  return actor?.username || actor?.email || actor?.id || 'system';
}

function evidenceStorageKey(itemId: string, filename: string) {
  // buildStorageKey produces `requests/<id>/...`; evidence assets live under
  // their own prefix so retention/cleanup policies can be applied separately.
  return buildStorageKey(itemId, filename).replace(/^requests\//, 'evidence/');
}

export function computeEvidenceStatus(item: any): 'active' | 'expiring' | 'expired' | 'archived' {
  if (item?.archived) return 'archived';
  if (!item?.validUntil) return 'active';
  const until = new Date(item.validUntil).getTime();
  if (Number.isNaN(until)) return 'active';
  const now = Date.now();
  if (until < now) return 'expired';
  if (until - now <= 30 * 24 * 60 * 60 * 1000) return 'expiring';
  return 'active';
}

export function serializeEvidence(doc: any) {
  if (!doc) return null;
  const id = String(doc._id);
  const asset = doc.asset && doc.asset.storageKey
    ? {
        originalName: doc.asset.originalName,
        filename: doc.asset.filename,
        mimeType: doc.asset.mimeType,
        size: doc.asset.size || 0,
        checksum: doc.asset.checksum,
        uploadedAt: doc.asset.uploadedAt,
        uploadedBy: doc.asset.uploadedBy,
      }
    : null;

  return {
    id,
    title: doc.title,
    description: doc.description || '',
    domain: doc.domain || '',
    area: doc.area,
    process: doc.process || '',
    frameworks: Array.isArray(doc.frameworks) ? doc.frameworks : [],
    controls: Array.isArray(doc.controls) ? doc.controls : [],
    covers: doc.covers || '',
    language: doc.language || 'other',
    documentType: doc.documentType || 'other',
    classification: doc.classification || 'internal',
    shareMode: doc.shareMode || 'full',
    ndaRequired: Boolean(doc.ndaRequired),
    version: doc.version || '',
    owner: doc.owner || '',
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    origin: doc.origin || 'upload',
    localPath: doc.localPath || '',
    kbDocumentId: doc.kbDocumentId || '',
    sourceUrl: doc.sourceUrl || '',
    asset,
    hasAsset: Boolean(asset),
    downloadUrl: asset ? `/api/evidence/${id}/download` : null,
    validFrom: doc.validFrom || null,
    validUntil: doc.validUntil || null,
    lastReviewedAt: doc.lastReviewedAt || null,
    notes: doc.notes || '',
    archived: Boolean(doc.archived),
    archivedAt: doc.archivedAt || null,
    archivedBy: doc.archivedBy || '',
    status: computeEvidenceStatus(doc),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdBy: doc.createdBy || '',
    updatedBy: doc.updatedBy || '',
  };
}

export function buildEvidenceQuery(filters: EvidenceListFilters = {}) {
  const query: Record<string, any> = {};
  if (!filters.includeArchived) query.archived = { $ne: true };
  if (filters.domain) query.domain = new RegExp(`^${escapeRegex(filters.domain)}$`, 'i');
  if (filters.area) query.area = new RegExp(`^${escapeRegex(filters.area)}$`, 'i');
  if (filters.framework) query.frameworks = new RegExp(`^${escapeRegex(filters.framework)}$`, 'i');
  if (filters.language) query.language = filters.language;
  if (filters.shareMode) query.shareMode = filters.shareMode;
  if (filters.origin) query.origin = filters.origin;
  if (filters.documentType) query.documentType = filters.documentType;
  if (filters.classification) query.classification = filters.classification;
  if (filters.ndaRequired !== undefined) query.ndaRequired = filters.ndaRequired;

  const q = String(filters.q || '').trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    query.$or = [
      { title: rx },
      { description: rx },
      { domain: rx },
      { area: rx },
      { process: rx },
      { frameworks: rx },
      { controls: rx },
      { covers: rx },
      { owner: rx },
      { tags: rx },
      { version: rx },
      { localPath: rx },
      { 'asset.originalName': rx },
    ];
  }

  if (filters.status) {
    const now = new Date();
    if (filters.status === 'archived') {
      query.archived = true;
    } else if (filters.status === 'expired') {
      query.archived = { $ne: true };
      query.validUntil = { $lt: now };
    } else if (filters.status === 'expiring') {
      query.archived = { $ne: true };
      query.validUntil = {
        $gte: now,
        $lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      };
    } else if (filters.status === 'active') {
      query.archived = { $ne: true };
      query.$and = [
        {
          $or: [
            { validUntil: { $exists: false } },
            { validUntil: null },
            { validUntil: { $gt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) } },
          ],
        },
      ];
    }
  }

  return query;
}

export async function listEvidence(filters: EvidenceListFilters = {}) {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(filters.limit) || 50));
  const query = buildEvidenceQuery(filters);

  const [items, total] = await Promise.all([
    EvidenceItem.find(query)
      .sort({ domain: 1, area: 1, title: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    EvidenceItem.countDocuments(query),
  ]);

  return {
    items: items.map(serializeEvidence),
    total,
    page,
    limit,
    hasMore: page * limit < total,
  };
}

export async function getEvidence(id: string) {
  assertObjectId(id);
  const item = await EvidenceItem.findById(id).lean();
  if (!item) throw notFound();
  return serializeEvidence(item);
}

function cleanDistinct(values: any[]): string[] {
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export async function listEvidenceAreas() {
  const areas = await EvidenceItem.distinct('area', { archived: { $ne: true } });
  return cleanDistinct(areas);
}

/**
 * Existing values used to autocomplete the free-text criteria (area, process,
 * controls). Domains and frameworks come from the admin-editable catalogs.
 */
export async function listEvidenceSuggestions() {
  const query = { archived: { $ne: true } };
  const [areas, processes, controls, tags] = await Promise.all([
    EvidenceItem.distinct('area', query),
    EvidenceItem.distinct('process', query),
    EvidenceItem.distinct('controls', query),
    EvidenceItem.distinct('tags', query),
  ]);
  return {
    areas: cleanDistinct(areas),
    processes: cleanDistinct(processes),
    controls: cleanDistinct(controls),
    tags: cleanDistinct(tags),
  };
}

async function resolveKnowledgeBaseDocument(kbDocumentId: string) {
  if (!mongoose.Types.ObjectId.isValid(kbDocumentId)) {
    throw badRequest('Knowledge base document not found', { field: 'kbDocumentId' });
  }
  const doc = await DocumentModel.findById(kbDocumentId).lean();
  if (!doc) throw badRequest('Knowledge base document not found', { field: 'kbDocumentId' });
  return {
    id: String(doc._id),
    originalName: doc.originalName,
    sourceUrl: `/uploads/knowledge/${doc.filename}`,
  };
}

async function buildOriginFields(input: EvidenceCreateInput | EvidenceUpdateInput) {
  const payload: Record<string, any> = {};
  if (input.origin !== undefined) payload.origin = input.origin;
  if (input.localPath !== undefined) payload.localPath = input.localPath || undefined;
  if (input.kbDocumentId !== undefined) payload.kbDocumentId = input.kbDocumentId || undefined;

  if (input.origin === 'kb_document') {
    if (!input.kbDocumentId) throw badRequest('A knowledge base document is required', { field: 'kbDocumentId' });
    const kb = await resolveKnowledgeBaseDocument(input.kbDocumentId);
    payload.kbDocumentId = kb.id;
    payload.sourceUrl = kb.sourceUrl;
    payload.localPath = undefined;
  } else if (input.origin === 'local_path') {
    payload.sourceUrl = undefined;
    payload.kbDocumentId = undefined;
  } else if (input.origin === 'upload') {
    payload.sourceUrl = undefined;
    payload.kbDocumentId = undefined;
    payload.localPath = undefined;
  }

  return payload;
}

function buildCommonPayload(input: EvidenceCreateInput | EvidenceUpdateInput) {
  const payload: Record<string, any> = {};
  const passthrough = [
    'title',
    'description',
    'domain',
    'area',
    'process',
    'frameworks',
    'controls',
    'covers',
    'language',
    'documentType',
    'classification',
    'shareMode',
    'ndaRequired',
    'version',
    'owner',
    'tags',
    'notes',
  ];
  for (const key of passthrough) {
    if ((input as any)[key] !== undefined) {
      const value = (input as any)[key];
      payload[key] = value === null ? undefined : value;
    }
  }
  for (const key of ['validFrom', 'validUntil', 'lastReviewedAt']) {
    if ((input as any)[key] !== undefined) payload[key] = toDate((input as any)[key]);
  }
  return payload;
}

export async function createEvidence(input: EvidenceCreateInput, actor?: EvidenceActor) {
  const payload = buildCommonPayload(input);
  payload.origin = input.origin || 'upload';
  Object.assign(payload, await buildOriginFields({ ...input, origin: payload.origin }));
  payload.createdBy = actorName(actor);
  payload.updatedBy = actorName(actor);
  payload.archived = false;

  const created = await EvidenceItem.create(payload);
  return serializeEvidence(created.toObject());
}

export async function updateEvidence(id: string, input: EvidenceUpdateInput, actor?: EvidenceActor) {
  assertObjectId(id);
  const item = await EvidenceItem.findById(id);
  if (!item) throw notFound();

  const payload = buildCommonPayload(input);
  const nextOrigin = input.origin !== undefined ? input.origin : item.origin;

  if (input.origin !== undefined) {
    payload.origin = input.origin;
    Object.assign(payload, await buildOriginFields({ ...input, origin: input.origin }));
  } else if (input.localPath !== undefined || input.kbDocumentId !== undefined) {
    Object.assign(payload, await buildOriginFields({
      origin: nextOrigin,
      localPath: input.localPath !== undefined ? input.localPath : item.localPath,
      kbDocumentId: input.kbDocumentId !== undefined ? input.kbDocumentId : item.kbDocumentId,
    }));
  }

  // Keep the origin coherent when switching between local path / KB document.
  if (nextOrigin === 'local_path' && !payload.localPath && !item.localPath) {
    throw badRequest('Local path is required', { field: 'localPath' });
  }
  if (nextOrigin === 'kb_document' && !payload.kbDocumentId && !item.kbDocumentId) {
    throw badRequest('A knowledge base document is required', { field: 'kbDocumentId' });
  }
  if (nextOrigin === 'local_path') {
    const path = payload.localPath !== undefined ? payload.localPath : item.localPath;
    if (!path || !/^(?:[A-Za-z]:\\|\\\\)/.test(String(path))) {
      throw badRequest('Local path must be a Windows path (C:\\... or \\\\server\\...)', { field: 'localPath' });
    }
  }

  if (input.archived !== undefined && input.archived !== Boolean(item.archived)) {
    payload.archived = input.archived;
    payload.archivedAt = input.archived ? new Date() : undefined;
    payload.archivedBy = input.archived ? actorName(actor) : undefined;
  }
  payload.updatedBy = actorName(actor);

  Object.assign(item, payload);
  await item.save();
  return serializeEvidence(item.toObject());
}

export async function setEvidenceAsset(
  id: string,
  file: { filename: string; data: Buffer; mimetype?: string },
  actor?: EvidenceActor
) {
  assertObjectId(id);
  const item = await EvidenceItem.findById(id);
  if (!item) throw notFound();

  assertAllowedFile(file);

  const previousKey = item.asset?.storageKey;
  const storageKey = evidenceStorageKey(id, file.filename);
  const { provider } = await putObject(storageKey, file.data, file.mimetype || 'application/octet-stream');

  item.set('asset', {
    filename: sanitizeFilename(file.filename),
    originalName: file.filename,
    mimeType: file.mimetype || 'application/octet-stream',
    size: file.data.length,
    checksum: checksumBuffer(file.data),
    storageProvider: provider,
    storageKey,
    uploadedBy: actorName(actor),
    uploadedAt: new Date(),
  });
  item.set('origin', 'upload');
  item.set('localPath', undefined);
  item.set('kbDocumentId', undefined);
  item.set('sourceUrl', undefined);
  item.set('updatedBy', actorName(actor));
  await item.save();

  if (previousKey && previousKey !== storageKey) {
    deleteObject(previousKey).catch((error) => {
      console.warn('[Evidence] Could not delete previous asset:', (error as Error).message);
    });
  }

  return serializeEvidence(item.toObject());
}

export async function removeEvidenceAsset(id: string, actor?: EvidenceActor) {
  assertObjectId(id);
  const item = await EvidenceItem.findById(id);
  if (!item) throw notFound();
  const storageKey = item.asset?.storageKey;
  item.set('asset', undefined);
  item.set('updatedBy', actorName(actor));
  await item.save();
  if (storageKey) {
    deleteObject(storageKey).catch((error) => {
      console.warn('[Evidence] Could not delete asset:', (error as Error).message);
    });
  }
  return serializeEvidence(item.toObject());
}

export async function getEvidenceAsset(id: string) {
  assertObjectId(id);
  const item = await EvidenceItem.findById(id).lean();
  if (!item) throw notFound();
  if (!item.asset?.storageKey) throw Object.assign(new Error('Evidence has no attached file'), { statusCode: 404 });
  return item;
}

export async function openEvidenceAssetStream(item: any) {
  return getObjectStream(item.asset.storageKey);
}

function csvCell(value: any) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[";\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export async function exportEvidenceCsv(filters: EvidenceListFilters = {}) {
  const query = buildEvidenceQuery(filters);
  const items = await EvidenceItem.find(query).sort({ domain: 1, area: 1, title: 1 }).limit(5000).lean();

  const headers = [
    'Título',
    'Dominio',
    'Área',
    'Proceso',
    'Frameworks',
    'Controles',
    'Cubre',
    'Idioma',
    'Tipo',
    'Clasificación',
    'Compartición',
    'NDA',
    'Versión',
    'Propietario',
    'Origen',
    'Archivo',
    'Ruta local',
    'Válido desde',
    'Válido hasta',
    'Última revisión',
    'Estado',
    'Etiquetas',
    'Notas',
    'Creado',
    'Actualizado',
  ];

  const rows = items.map((item: any) => {
    const serialized: any = serializeEvidence(item);
    return [
      serialized.title,
      serialized.domain,
      serialized.area,
      serialized.process,
      serialized.frameworks.join(', '),
      serialized.controls.join(', '),
      serialized.covers,
      serialized.language,
      serialized.documentType,
      serialized.classification,
      serialized.shareMode,
      serialized.ndaRequired ? 'Sí' : 'No',
      serialized.version,
      serialized.owner,
      serialized.origin,
      serialized.asset?.originalName || '',
      serialized.localPath,
      serialized.validFrom ? new Date(serialized.validFrom).toISOString().slice(0, 10) : '',
      serialized.validUntil ? new Date(serialized.validUntil).toISOString().slice(0, 10) : '',
      serialized.lastReviewedAt ? new Date(serialized.lastReviewedAt).toISOString().slice(0, 10) : '',
      serialized.status,
      serialized.tags.join(', '),
      serialized.notes,
      serialized.createdAt ? new Date(serialized.createdAt).toISOString().slice(0, 10) : '',
      serialized.updatedAt ? new Date(serialized.updatedAt).toISOString().slice(0, 10) : '',
    ].map(csvCell).join(';');
  });

  return [headers.map(csvCell).join(';'), ...rows].join('\r\n');
}
