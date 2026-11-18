/**
 * Domain constants for the global Evidence Matrix (Matriz de Evidencias).
 *
 * The catalog is global for now, but the shape is intentionally independent
 * from a client/request so it can later be scoped per client request without
 * changing the API contract.
 */

/** How much of the document is shared with the reader. */
export const EvidenceShareModes = ['full', 'index', 'internal'] as const;
export type EvidenceShareMode = typeof EvidenceShareModes[number];

/** Where the evidence file lives. */
export const EvidenceOrigins = ['upload', 'local_path', 'kb_document'] as const;
export type EvidenceOrigin = typeof EvidenceOrigins[number];

export const EvidenceDocumentTypes = [
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
export type EvidenceDocumentType = typeof EvidenceDocumentTypes[number];

/** Computed lifecycle status exposed by the serializer (never stored). */
export const EvidenceStatuses = ['active', 'expiring', 'expired', 'archived'] as const;
export type EvidenceStatus = typeof EvidenceStatuses[number];

/** Language of the evidence document, used to hint the requirement matcher. */
export const EvidenceLanguages = ['es', 'en', 'it', 'other'] as const;
export type EvidenceLanguage = typeof EvidenceLanguages[number];

/**
 * Default values for the admin-editable evidence criteria catalogs. They are
 * only fallbacks: once an admin saves the catalog it is stored in `Setting`.
 */
export const DefaultEvidenceDomains = [
  'Security',
  'Compliance',
  'Risk',
  'IT Operations',
  'Privacy',
  'Legal',
  'Business Continuity',
  'Third Parties',
  'Physical Security',
  'Human Resources',
] as const;

export const DefaultEvidenceFrameworks = [
  'ISO 27001',
  'SOC 2',
  'PCI DSS',
  'GDPR',
  'NIS2',
  'DORA',
  'ISO 22301',
  'ISO 9001',
  'NIST CSF',
  'Other',
] as const;
