import type { Priority, RequestStatus, Severity, SlaState } from '../../types/request360';
import { SLA_LABELS, STATUS_LABELS } from '../../types/request360';

type Lang = 'es' | 'en';

export function formatDate(value?: string | Date | null, lang: Lang = 'es'): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-GB');
}

export function formatDateTime(value?: string | Date | null, lang: Lang = 'es'): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(lang === 'es' ? 'es-ES' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function badgeClass(prefix: string, value?: string) {
  return `r360-badge ${prefix}-${String(value || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export function StatusBadge({ status, lang = 'es' }: { status?: RequestStatus | string; lang?: Lang }) {
  const key = (status || 'new') as RequestStatus;
  const label = STATUS_LABELS[key]?.[lang] || status || '—';
  return <span className={badgeClass('r360-status', key)}>{label}</span>;
}

export function SlaBadge({ state, lang = 'es' }: { state?: SlaState | string; lang?: Lang }) {
  const key = (state || 'on_track') as SlaState;
  const label = SLA_LABELS[key]?.[lang] || state || '—';
  return <span className={badgeClass('r360-sla', key)}>{label}</span>;
}

export function PriorityBadge({ priority }: { priority?: Priority | string }) {
  const value = priority || 'P3';
  return <span className={badgeClass('r360-priority', value)}>{value}</span>;
}

export function SeverityBadge({ severity, lang = 'es' }: { severity?: Severity | string; lang?: Lang }) {
  const value = severity || 'medium';
  const labels: Record<string, { es: string; en: string }> = {
    critical: { es: 'Crítica', en: 'Critical' },
    high: { es: 'Alta', en: 'High' },
    medium: { es: 'Media', en: 'Medium' },
    low: { es: 'Baja', en: 'Low' },
    info: { es: 'Info', en: 'Info' },
  };
  return <span className={badgeClass('r360-severity', value)}>{labels[value]?.[lang] || value}</span>;
}

export function EmptyState({ icon = '📭', title, text }: { icon?: string; title: string; text?: string }) {
  return (
    <div className="r360-empty">
      <div className="r360-empty-icon">{icon}</div>
      <div className="r360-empty-title">{title}</div>
      {text && <div className="r360-empty-text">{text}</div>}
    </div>
  );
}

export function Loading({ lang = 'es' }: { lang?: Lang }) {
  return <div className="r360-loading">{lang === 'es' ? 'Cargando…' : 'Loading…'}</div>;
}

export function ErrorBanner({ error }: { error?: string | null }) {
  if (!error) return null;
  return <div className="r360-error" role="alert">{error}</div>;
}
