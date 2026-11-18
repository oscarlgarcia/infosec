import { z } from 'zod';
import { Classifications } from '../types/request';
import {
  EvidenceDocumentTypes,
  EvidenceLanguages,
  EvidenceOrigins,
  EvidenceShareModes,
} from '../types/evidence';

function tuple<T extends readonly string[]>(values: T) {
  return values as unknown as [string, ...string[]];
}

const localPathSchema = z
  .string()
  .trim()
  .min(1, { message: 'Local path is required' })
  .max(500)
  .refine((value) => /^(?:[A-Za-z]:\\|\\\\)/.test(value), {
    message: 'Local path must be a Windows path (C:\\... or \\\\server\\...)',
  });

const optionalText = (max = 5000) => z.string().trim().max(max).nullable().optional();

const criterionList = (maxItems: number) =>
  z.array(z.string().trim().min(1).max(160)).max(maxItems).optional();

export const evidenceBaseSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: optionalText(5000),
  domain: z.string().trim().min(1).max(160),
  area: z.string().trim().min(1).max(200),
  process: optionalText(200),
  frameworks: criterionList(30),
  controls: criterionList(60),
  covers: optionalText(5000),
  language: z.enum(tuple(EvidenceLanguages)).optional(),
  documentType: z.enum(tuple(EvidenceDocumentTypes)).optional(),
  classification: z.enum(tuple(Classifications)).optional(),
  shareMode: z.enum(tuple(EvidenceShareModes)).optional(),
  ndaRequired: z.boolean().optional(),
  version: optionalText(60),
  owner: optionalText(200),
  tags: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  origin: z.enum(tuple(EvidenceOrigins)).optional(),
  localPath: z.string().trim().max(500).nullable().optional(),
  kbDocumentId: z.string().trim().max(200).nullable().optional(),
  validFrom: z.string().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  lastReviewedAt: z.string().optional().nullable(),
  notes: optionalText(5000),
});

export const evidenceCreateSchema = evidenceBaseSchema.superRefine((value, ctx) => {
  const origin = value.origin || 'upload';
  if (origin === 'local_path') {
    const parsed = localPathSchema.safeParse(value.localPath || '');
    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['localPath'],
        message: parsed.error.issues[0]?.message || 'Local path is required',
      });
    }
  }
  if (origin === 'kb_document' && !value.kbDocumentId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['kbDocumentId'],
      message: 'A knowledge base document is required',
    });
  }
});

export const evidenceUpdateSchema = evidenceBaseSchema.partial().extend({
  archived: z.boolean().optional(),
  archiveReason: z.string().trim().max(1000).nullable().optional(),
});

export const evidenceMappingCreateSchema = z.object({
  requirement: z.string().trim().min(3).max(5000),
  evidenceId: z.string().trim().min(1),
  language: z.enum(tuple(EvidenceLanguages)).optional(),
  notes: optionalText(2000),
});

export const evidenceMappingUpdateSchema = z.object({
  language: z.enum(tuple(EvidenceLanguages)).optional(),
  notes: optionalText(2000),
});

export const evidenceZipSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(100),
});

export const evidenceMatchQuerySchema = z.object({
  q: z.string().trim().min(2).max(5000),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export type EvidenceCreateInput = z.infer<typeof evidenceCreateSchema>;
export type EvidenceUpdateInput = z.infer<typeof evidenceUpdateSchema>;
export type EvidenceMappingCreateInput = z.infer<typeof evidenceMappingCreateSchema>;
export type EvidenceMappingUpdateInput = z.infer<typeof evidenceMappingUpdateSchema>;
