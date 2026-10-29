import { getRequest360 } from './request.service';
import { getEventTimelineForExport } from './event.service';

function formatDate(value: any) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toISOString().replace('T', ' ').slice(0, 16);
}

function escapeHtml(value: any) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function buildLogbookMarkdown(requestId: string, options: { includeInternal?: boolean } = {}) {
  const data = await getRequest360(requestId, { includeInternal: options.includeInternal !== false });
  if (!data) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  const request: any = data.request;
  const includeInternal = options.includeInternal !== false;
  const events = await getEventTimelineForExport(requestId, includeInternal);

  const lines: string[] = [];
  lines.push(`# ${request.requestKey} — ${request.title || request.requestType}`);
  lines.push('');
  lines.push(`- **Cliente:** ${request.client?.name || request.clientSnapshot?.name || '—'}`);
  lines.push(`- **Tipo:** ${request.requestType}`);
  lines.push(`- **Estado:** ${request.statusNew}`);
  lines.push(`- **Prioridad / Severidad:** ${request.priority} / ${request.severity}`);
  lines.push(`- **Canal:** ${request.requestChannel || '—'}`);
  lines.push(`- **Owner InfoSec:** ${request.infosecOwnerId || '—'}`);
  lines.push(`- **Deadline:** ${formatDate(request.deadline)}`);
  lines.push(`- **SLA:** ${request.slaState} · respuesta ${formatDate(request.slaResponseDueAt)} · resolución ${formatDate(request.slaResolutionDueAt)}`);
  lines.push(`- **Creada:** ${formatDate(request.createdAt)} · **Última actividad:** ${formatDate(request.lastActivityAt)}`);
  if (request.scope) {
    lines.push('');
    lines.push('## Alcance');
    lines.push('');
    lines.push(request.scope);
  }

  lines.push('');
  lines.push('## Hilos');
  lines.push('');
  if (!data.threads.length) {
    lines.push('_Sin hilos._');
  } else {
    for (const thread of data.threads as any[]) {
      lines.push(`- ${thread.parentThreadId ? '  └ ' : ''}**${thread.title}** (${thread.type}, ${thread.status}) — ${thread.eventCount ?? 0} eventos`);
    }
  }

  lines.push('');
  lines.push('## Entregables');
  lines.push('');
  if (!data.deliverables.length) {
    lines.push('_Sin entregables._');
  } else {
    for (const deliverable of data.deliverables as any[]) {
      lines.push(`- **${deliverable.name}** · ${deliverable.type} · ${deliverable.status} · v${deliverable.version}`);
      if (deliverable.description) lines.push(`  ${deliverable.description}`);
    }
  }

  lines.push('');
  lines.push('## Documentos');
  lines.push('');
  if (!data.documents.length) {
    lines.push('_Sin documentos._');
  } else {
    for (const document of data.documents as any[]) {
      lines.push(`- ${document.originalName} · ${document.documentType} · ${document.visibility} · ${formatDate(document.createdAt)}`);
    }
  }

  lines.push('');
  lines.push('## Logbook');
  lines.push('');
  if (!events.length) {
    lines.push('_Sin eventos._');
  } else {
    let currentDay = '';
    for (const event of events as any[]) {
      const day = formatDate(event.createdAt).slice(0, 10);
      if (day !== currentDay) {
        currentDay = day;
        lines.push('');
        lines.push(`### ${day}`);
        lines.push('');
      }
      const visibility = event.visibility === 'internal' ? ' · interno' : '';
      lines.push(`- **${formatDate(event.createdAt).slice(11)}** · \`${event.type}\`${visibility} · ${event.authorName || 'sistema'}`);
      if (event.fromStatus || event.toStatus) {
        lines.push(`  - Estado: ${event.fromStatus || '—'} → ${event.toStatus || '—'}`);
      }
      if (event.body) {
        lines.push(`  - ${String(event.body).replace(/\n/g, '\n    ')}`);
      }
    }
  }

  lines.push('');
  lines.push('---');
  lines.push(`_Exportado el ${new Date().toISOString()} · ${includeInternal ? 'incluye contenido interno' : 'solo contenido visible para cliente'}_`);
  return { markdown: lines.join('\n'), request, events };
}

export async function buildLogbookHtml(requestId: string, options: { includeInternal?: boolean } = {}) {
  const { markdown, request } = await buildLogbookMarkdown(requestId, options);
  const escaped = escapeHtml(markdown);
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(request.requestKey)} — Logbook</title>
  <style>
    body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; margin: 40px; color: #1f2937; }
    pre { white-space: pre-wrap; word-wrap: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; line-height: 1.6; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <pre>${escaped}</pre>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
}
