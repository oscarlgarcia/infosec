/**
 * Domain constants and types for the Request 360 module.
 * Kept framework-free so they can be reused by services, routes and tests.
 */

export const RequestTypes = [
  'RFI/RFP',
  'Customer Agreement Review',
  'Customer Agreements Execution',
  'InfoSec Support',
  '3rd Party PT',
  'BC/DR Test Result Request',
  'Cloud Customer PT Request',
  'Certification Request',
  'Document Request',
  'Other Support',
  'Answer Builder',
] as const;
export type RequestType = typeof RequestTypes[number];

export const RequestKinds = ['standard', 'quick_query', 'cve'] as const;
export type RequestKind = typeof RequestKinds[number];

export const RequestStatuses = [
  'new',
  'in_analysis',
  'waiting_client',
  'working',
  'on_hold',
  'cancelled',
  'delivered',
  'closed',
] as const;
export type RequestStatus = typeof RequestStatuses[number];

/** Legacy statuses that must keep working during the migration. */
export const LegacyRequestStatuses = ['open', 'in_progress', 'completed'] as const;
export type LegacyRequestStatus = typeof LegacyRequestStatuses[number];

export const ActiveRequestStatuses: RequestStatus[] = [
  'new',
  'in_analysis',
  'waiting_client',
  'working',
  'on_hold',
];

export const TerminalRequestStatuses: RequestStatus[] = ['cancelled', 'closed'];

export const Priorities = ['P1', 'P2', 'P3', 'P4'] as const;
export type Priority = typeof Priorities[number];

export const Severities = ['critical', 'high', 'medium', 'low', 'info'] as const;
export type Severity = typeof Severities[number];

export const RequestChannels = ['email', 'portal', 'call', 'meeting', 'internal', 'other'] as const;
export type RequestChannel = typeof RequestChannels[number];

export const ContractTypes = ['MSA', 'SOW', 'DPA', 'NDA', 'subscription', 'reseller', 'other'] as const;
export type ContractType = typeof ContractTypes[number];

export const ContractStatuses = ['draft', 'pending_signature', 'active', 'renewed', 'cancelled', 'expired'] as const;
export type ContractStatus = typeof ContractStatuses[number];

export const ServiceModels = ['cloud', 'rent', 'ps', 'hybrid'] as const;
export type ServiceModel = typeof ServiceModels[number];

export const CustomerStatuses = ['prospect', 'active', 'strategic', 'at_risk', 'churned'] as const;
export type CustomerStatus = typeof CustomerStatuses[number];

export const ClientPhases = ['onboarding', 'active', 'renewal', 'offboarding'] as const;
export type ClientPhase = typeof ClientPhases[number];

export const EventTypes = [
  'comment',
  'status_change',
  'assignment',
  'document_added',
  'deliverable_sent',
  'client_followup',
  'cve_impact',
  'meeting_note',
  'email',
  'ai_draft',
  'task_linked',
  'deadline_changed',
  'thread_created',
  'thread_closed',
  'sla_at_risk',
  'sla_breached',
  'reopened',
  'system',
] as const;
export type EventType = typeof EventTypes[number];

export const Visibilities = ['internal', 'client', 'public'] as const;
export type Visibility = typeof Visibilities[number];

export const Classifications = ['public', 'internal', 'confidential', 'restricted'] as const;
export type Classification = typeof Classifications[number];

export const ThreadTypes = [
  'general',
  'followup',
  'questionnaire',
  'report',
  'certificate',
  'evidence',
  'cve',
  'architecture',
  'guide',
] as const;
export type ThreadType = typeof ThreadTypes[number];

export const ThreadStatuses = ['open', 'in_progress', 'waiting_client', 'done', 'cancelled'] as const;
export type ThreadStatus = typeof ThreadStatuses[number];

export const DeliverableTypes = [
  'soc_report',
  'iso_certificate',
  'soc2_certificate',
  'evidence',
  'architecture_doc',
  'guide',
  'dpia',
  'pentest_report',
  'cve_advisory',
  'questionnaire_response',
  'other',
] as const;
export type DeliverableType = typeof DeliverableTypes[number];

export const DeliverableStatuses = [
  'pending',
  'in_preparation',
  'in_review',
  'sent',
  'accepted',
  'rejected',
  'expired',
] as const;
export type DeliverableStatus = typeof DeliverableStatuses[number];

export const DocumentTypes = [
  'contract',
  'dpa',
  'tom',
  'sow',
  'nda',
  'questionnaire',
  'questionnaire_response',
  'evidence',
  'architecture',
  'guide',
  'certificate',
  'soc_report',
  'pentest_report',
  'cve_advisory',
  'other',
] as const;
export type DocumentType = typeof DocumentTypes[number];

export const DocumentSources = ['upload', 'canonical_answer', 'kb_document', 'generated'] as const;
export type DocumentSource = typeof DocumentSources[number];

export const TaskTypes = ['review', 'questionnaire', 'evidence', 'approval', 'delivery', 'followup', 'other'] as const;
export type TaskType = typeof TaskTypes[number];

export const SlaStates = ['on_track', 'at_risk', 'breached', 'paused'] as const;
export type SlaState = typeof SlaStates[number];

export const StakeholderRoles = [
  'decision_maker',
  'technical',
  'legal',
  'procurement',
  'security',
  'sales',
  'other',
] as const;
export type StakeholderRole = typeof StakeholderRoles[number];

export const StakeholderPartyTypes = ['internal', 'client'] as const;
export type StakeholderPartyType = typeof StakeholderPartyTypes[number];

export const AiArtifactKinds = ['summary', 'followup_draft', 'meeting_minutes', 'intake_classification'] as const;
export type AiArtifactKind = typeof AiArtifactKinds[number];

export const NotificationTypes = [
  'mention',
  'assignment',
  'status_change',
  'sla_at_risk',
  'sla_breached',
  'followup_due',
  'deliverable_sent',
  'cve_impact',
  'system',
] as const;
export type NotificationType = typeof NotificationTypes[number];

/**
 * Canonical transition table. `null` keys are never valid.
 */
export const AllowedTransitions: Record<RequestStatus, RequestStatus[]> = {
  new: ['in_analysis', 'on_hold', 'cancelled'],
  in_analysis: ['waiting_client', 'working', 'delivered', 'on_hold', 'cancelled'],
  waiting_client: ['in_analysis', 'working', 'delivered', 'on_hold', 'cancelled'],
  working: ['in_analysis', 'waiting_client', 'delivered', 'on_hold', 'cancelled'],
  on_hold: ['in_analysis', 'working', 'cancelled'],
  delivered: ['closed', 'in_analysis', 'working'],
  closed: ['in_analysis'],
  cancelled: ['in_analysis'],
};

const LEGACY_TO_NEW: Record<LegacyRequestStatus, RequestStatus> = {
  open: 'new',
  in_progress: 'in_analysis',
  completed: 'closed',
};

const NEW_TO_LEGACY: Record<RequestStatus, LegacyRequestStatus> = {
  new: 'open',
  in_analysis: 'in_progress',
  waiting_client: 'in_progress',
  working: 'in_progress',
  on_hold: 'in_progress',
  delivered: 'completed',
  closed: 'completed',
  cancelled: 'completed',
};

export function normalizeStatus(status: string | undefined | null): RequestStatus {
  if (!status) return 'new';
  if ((RequestStatuses as readonly string[]).includes(status)) return status as RequestStatus;
  return LEGACY_TO_NEW[status as LegacyRequestStatus] || 'new';
}

export function toLegacyStatus(status: string | undefined | null): LegacyRequestStatus {
  return NEW_TO_LEGACY[normalizeStatus(status)];
}

export function canTransition(from: string | undefined | null, to: string | undefined | null): boolean {
  const source = normalizeStatus(from);
  const target = normalizeStatus(to);
  return AllowedTransitions[source]?.includes(target) || false;
}

export function isTerminalStatus(status: string | undefined | null): boolean {
  return TerminalRequestStatuses.includes(normalizeStatus(status));
}

export function isActiveStatus(status: string | undefined | null): boolean {
  return ActiveRequestStatuses.includes(normalizeStatus(status));
}

/**
 * Statuses that pause the SLA clock (waiting on the client or explicitly on hold).
 */
export function isSlaPausedStatus(status: string | undefined | null): boolean {
  const normalized = normalizeStatus(status);
  return normalized === 'waiting_client' || normalized === 'on_hold';
}
