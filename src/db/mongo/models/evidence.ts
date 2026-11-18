import mongoose, { Schema } from 'mongoose';
import { Classifications } from '../../../types/request';
import {
  EvidenceDocumentTypes,
  EvidenceLanguages,
  EvidenceOrigins,
  EvidenceShareModes,
} from '../../../types/evidence';

interface AnyDoc {
  _id: any;
  [key: string]: any;
}
type AnyModel = mongoose.Model<AnyDoc>;

function model(name: string, schema: Schema): AnyModel {
  return (mongoose.models[name] || mongoose.model(name, schema)) as AnyModel;
}

/**
 * File stored for the evidence. Files live in local disk or S3/MinIO using the
 * same storage abstraction as request documents.
 */
export const EvidenceAssetSchema = new Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, default: 'application/octet-stream' },
  size: { type: Number, default: 0 },
  checksum: { type: String, index: true },
  storageProvider: { type: String, enum: ['local', 's3'], default: 'local' },
  storageKey: { type: String, required: true },
  uploadedBy: { type: String },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

/**
 * Global evidence catalog entry. `area` is the process/area the evidence is
 * indexed under. `shareMode` only describes what the reader receives:
 * full document, index-only PDF, or internal (not shareable).
 */
export const EvidenceItemSchema = new Schema({
  title: { type: String, required: true, trim: true, index: true },
  description: { type: String },
  // Standard criteria. `domain` and `frameworks` come from admin-editable
  // catalogs; `area`/`process`/`controls` stay free text with autocomplete.
  domain: { type: String, trim: true, index: true },
  area: { type: String, required: true, trim: true, index: true },
  process: { type: String, trim: true },
  frameworks: { type: [String], default: [], index: true },
  controls: { type: [String], default: [] },
  // Free text describing the requirement this evidence answers. It is the
  // strongest signal for the requirement matcher.
  covers: { type: String },
  language: { type: String, enum: EvidenceLanguages, default: 'other', index: true },
  documentType: { type: String, enum: EvidenceDocumentTypes, default: 'other', index: true },
  classification: { type: String, enum: Classifications, default: 'internal', index: true },
  shareMode: { type: String, enum: EvidenceShareModes, default: 'full', index: true },
  ndaRequired: { type: Boolean, default: false, index: true },
  version: { type: String, trim: true },
  owner: { type: String, trim: true },
  // Multilingual keywords / aliases used by search and the matcher.
  tags: { type: [String], default: [] },

  origin: { type: String, enum: EvidenceOrigins, default: 'upload', index: true },
  localPath: { type: String },
  kbDocumentId: { type: String },
  sourceUrl: { type: String },
  asset: { type: EvidenceAssetSchema },

  validFrom: { type: Date },
  validUntil: { type: Date, index: true },
  lastReviewedAt: { type: Date },
  notes: { type: String },

  archived: { type: Boolean, default: false, index: true },
  archivedAt: { type: Date },
  archivedBy: { type: String },
  createdBy: { type: String },
  updatedBy: { type: String },
}, { timestamps: true });

EvidenceItemSchema.index({ archived: 1, area: 1, title: 1 });
EvidenceItemSchema.index({ archived: 1, shareMode: 1, updatedAt: -1 });
EvidenceItemSchema.index({ title: 1, area: 1 });
EvidenceItemSchema.index({ archived: 1, domain: 1, title: 1 });
EvidenceItemSchema.index({ archived: 1, frameworks: 1 });

export const EvidenceItem = model('EvidenceItem', EvidenceItemSchema);

/**
 * Saved requirement → evidence mapping. Once an admin confirms that a request
 * line is answered by a given evidence, the matcher boosts that evidence for
 * identical or very similar requirement texts.
 */
export const EvidenceMappingSchema = new Schema({
  requirement: { type: String, required: true, trim: true },
  normalized: { type: String, required: true, index: true },
  evidenceId: { type: Schema.Types.ObjectId, ref: 'EvidenceItem', required: true, index: true },
  language: { type: String, enum: EvidenceLanguages, default: 'other' },
  notes: { type: String },
  hits: { type: Number, default: 0 },
  createdBy: { type: String },
  updatedBy: { type: String },
}, { timestamps: true });

EvidenceMappingSchema.index({ normalized: 1, evidenceId: 1 }, { unique: true });

export const EvidenceMapping = model('EvidenceMapping', EvidenceMappingSchema);
