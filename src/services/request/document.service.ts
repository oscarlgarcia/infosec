import mongoose from 'mongoose';
import { ClientRequest, RequestDocument } from '../../db/mongo/models';
import {
  Classification,
  DocumentType,
  Visibility,
} from '../../types/request';
import {
  buildStorageKey,
  checksumBuffer,
  deleteObject,
  getObjectStream,
  putObject,
  sanitizeFilename,
} from '../storage/storage.service';
import { logEvent } from './event.service';
import { serializeDocument } from './serializer';

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

export interface UploadFileInput {
  filename: string;
  data: Buffer;
  mimetype?: string;
  documentType?: DocumentType;
  visibility?: Visibility;
  classification?: Classification;
  source?: 'upload' | 'canonical_answer' | 'kb_document' | 'generated';
  sourceRef?: string;
  expiryDate?: string | Date;
  threadId?: string;
  deliverableId?: string;
  version?: number;
  supersedesId?: string;
}

export interface UploadActor {
  id?: string;
  username?: string;
  role?: string;
}

function assertAllowedFile(file: UploadFileInput) {
  if (!file.data?.length) throw Object.assign(new Error('Empty file'), { statusCode: 400 });
  if (file.data.length > MAX_FILE_SIZE) {
    throw Object.assign(new Error(`File ${file.filename} exceeds the 50MB limit`), { statusCode: 413 });
  }
  const mime = file.mimetype || 'application/octet-stream';
  const allowed = ALLOWED_MIME_EXACT.has(mime) || ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
  if (!allowed) {
    throw Object.assign(new Error(`File type ${mime} is not allowed`), { statusCode: 415 });
  }
}

export async function addRequestDocuments(data: {
  requestId: string;
  files: UploadFileInput[];
  actor?: UploadActor;
}) {
  const request = await ClientRequest.findById(data.requestId);
  if (!request) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  if (!data.files.length) throw Object.assign(new Error('No files uploaded'), { statusCode: 400 });

  const created: any[] = [];
  const duplicates: Array<{ filename: string; documentId: string }> = [];

  for (const file of data.files) {
    assertAllowedFile(file);
    const checksum = checksumBuffer(file.data);
    const existing = await RequestDocument.findOne({
      requestId: request._id,
      checksum,
      deletedAt: null,
    }).lean();
    if (existing) {
      duplicates.push({ filename: file.filename, documentId: String(existing._id) });
    }

    const storageKey = buildStorageKey(data.requestId, file.filename);
    const { provider } = await putObject(storageKey, file.data, file.mimetype || 'application/octet-stream');

    const document = await RequestDocument.create({
      requestId: request._id,
      threadId: file.threadId || undefined,
      deliverableId: file.deliverableId || undefined,
      documentType: file.documentType || 'other',
      classification: file.classification || 'internal',
      visibility: file.visibility || 'internal',
      filename: sanitizeFilename(file.filename),
      originalName: file.filename,
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.data.length,
      checksum,
      version: file.version || 1,
      supersedesId: file.supersedesId || undefined,
      source: file.source || 'upload',
      sourceRef: file.sourceRef,
      expiryDate: file.expiryDate ? new Date(file.expiryDate) : undefined,
      storageProvider: provider,
      storageKey,
      uploadedBy: data.actor?.id || data.actor?.username,
    });

    await logEvent({
      requestId: request._id,
      threadId: document.threadId,
      type: 'document_added',
      visibility: document.visibility,
      authorId: data.actor?.id,
      authorName: data.actor?.username || 'InfoSec',
      authorRole: data.actor?.role,
      body: `Documento añadido: ${document.originalName}`,
      documentIds: [document._id],
      metadata: { documentType: document.documentType, checksum, duplicate: Boolean(existing) },
    });

    created.push(serializeDocument(document));
  }

  return { documents: created, duplicates };
}

export async function listRequestDocuments(requestId: string, filters: { documentType?: string; threadId?: string; includeDeleted?: boolean } = {}) {
  const query: Record<string, any> = { requestId: new mongoose.Types.ObjectId(requestId) };
  if (!filters.includeDeleted) query.deletedAt = null;
  if (filters.documentType) query.documentType = filters.documentType;
  if (filters.threadId) query.threadId = filters.threadId;
  const docs = await RequestDocument.find(query).sort({ createdAt: -1 }).lean();
  return docs.map(serializeDocument);
}

export async function getRequestDocument(requestId: string, documentId: string) {
  return RequestDocument.findOne({ _id: documentId, requestId }).lean();
}

export async function openDocumentStream(document: any) {
  return getObjectStream(document.storageKey);
}

export async function softDeleteDocument(requestId: string, documentId: string, actor?: UploadActor) {
  const document = await RequestDocument.findOne({ _id: documentId, requestId });
  if (!document) throw Object.assign(new Error('Document not found'), { statusCode: 404 });
  document.deletedAt = new Date();
  await document.save();
  await logEvent({
    requestId,
    threadId: document.threadId,
    type: 'system',
    visibility: 'internal',
    authorId: actor?.id,
    authorName: actor?.username || 'InfoSec',
    authorRole: actor?.role,
    body: `Documento eliminado: ${document.originalName}`,
    metadata: { deletedDocumentId: documentId, documentType: document.documentType },
  });
  return true;
}

export async function hardDeleteStoredDocument(document: any) {
  try {
    await deleteObject(document.storageKey);
  } catch (error) {
    console.warn('Could not delete stored document:', (error as Error).message);
  }
}
