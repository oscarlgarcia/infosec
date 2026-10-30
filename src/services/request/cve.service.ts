import mongoose from 'mongoose';
import { Client, CveAdvisory, CveImpact } from '../../db/mongo/models';
import { Severities } from '../../types/request';
import { chat } from '../llm/openai';
import { sendEmailToAddress } from '../notifications/notification.service';
import { logEvent } from './event.service';
import { RequestActor } from './request.service';

const SEVERITY_ORDER: Record<string, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

async function findAdvisoryByKey(key: string) {
  const conditions: any[] = [{ cveId: String(key).toUpperCase() }];
  if (mongoose.Types.ObjectId.isValid(key)) conditions.push({ _id: key });
  return CveAdvisory.findOne({ $or: conditions }).lean();
}

export interface CreateAdvisoryInput {
  cveId: string;
  title: string;
  severity?: string;
  cvssScore?: number;
  products?: string[];
  publishedAt?: string;
  summary?: string;
  posture?: string;
  status?: string;
  sourceUrl?: string;
  communicationTemplate?: string;
  cveRecordId?: string;
}

export async function listAdvisories(filters: { severity?: string; status?: string; q?: string; page?: number; limit?: number } = {}) {
  const query: Record<string, any> = {};
  if (filters.severity) query.severity = filters.severity;
  if (filters.status) query.status = filters.status;
  if (filters.q) query.$or = [
    { cveId: new RegExp(String(filters.q), 'i') },
    { title: new RegExp(String(filters.q), 'i') },
    { products: new RegExp(String(filters.q), 'i') },
  ];
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 25));
  const [items, total] = await Promise.all([
    CveAdvisory.find(query).sort({ publishedAt: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    CveAdvisory.countDocuments(query),
  ]);
  return { items, total, page, limit, hasMore: page * limit < total };
}

export async function getAdvisory(id: string) {
  const advisory = await CveAdvisory.findById(id).lean();
  if (!advisory) throw Object.assign(new Error('Advisory not found'), { statusCode: 404 });
  const impacts = await CveImpact.find({ advisoryId: id })
    .populate('clientId', 'name clientType country customerStatus')
    .lean();
  return { ...advisory, impacts };
}

export async function createAdvisory(data: CreateAdvisoryInput, actor?: RequestActor) {
  const cveId = String(data.cveId || '').trim().toUpperCase();
  if (!/^CVE-\d{4}-\d{4,}$/.test(cveId)) {
    throw Object.assign(new Error('cveId must look like CVE-2024-12345'), { statusCode: 400 });
  }
  const existing = await CveAdvisory.findOne({ cveId }).lean();
  if (existing) throw Object.assign(new Error('Advisory already exists for this CVE'), { statusCode: 409 });

  return CveAdvisory.create({
    cveId,
    cveRecordId: data.cveRecordId && mongoose.Types.ObjectId.isValid(data.cveRecordId) ? data.cveRecordId : undefined,
    title: data.title,
    severity: data.severity || 'medium',
    cvssScore: data.cvssScore,
    products: data.products || [],
    publishedAt: data.publishedAt ? new Date(data.publishedAt) : undefined,
    summary: data.summary,
    posture: data.posture || 'unknown',
    status: data.status || 'draft',
    sourceUrl: data.sourceUrl,
    communicationTemplate: data.communicationTemplate,
    createdBy: actor?.id || actor?.username,
  });
}

export async function updateAdvisory(id: string, data: Partial<CreateAdvisoryInput>) {
  const update: Record<string, any> = { ...data };
  if (data.cveId) update.cveId = String(data.cveId).toUpperCase();
  if (data.publishedAt) update.publishedAt = new Date(data.publishedAt);
  const advisory = await CveAdvisory.findByIdAndUpdate(id, { $set: update }, { new: true });
  if (!advisory) throw Object.assign(new Error('Advisory not found'), { statusCode: 404 });
  if (data.status === 'published') await notifySubscribers(String(advisory._id));
  return advisory;
}

export async function deleteAdvisory(id: string) {
  await CveImpact.deleteMany({ advisoryId: id });
  await CveAdvisory.findByIdAndDelete(id);
}

export async function listImpacts(cveId: string) {
  const advisory = await findAdvisoryByKey(cveId);
  const query: Record<string, any> = advisory ? { advisoryId: advisory._id } : { cveId };
  return CveImpact.find(query)
    .populate('clientId', 'name clientType country customerStatus contractType serviceModel')
    .sort({ affected: -1, createdAt: -1 })
    .lean();
}

export interface UpsertImpactInput {
  clientId: string;
  affected?: boolean;
  rationale?: string;
  posture?: string;
  responseText?: string;
  communicate?: boolean;
  requestId?: string;
  threadId?: string;
}

export async function upsertImpact(cveId: string, data: UpsertImpactInput, actor?: RequestActor) {
  const advisory = await findAdvisoryByKey(cveId);
  if (!advisory) throw Object.assign(new Error('Advisory not found'), { statusCode: 404 });
  const client = await Client.findById(data.clientId).lean();
  if (!client) throw Object.assign(new Error('Client not found'), { statusCode: 404 });

  const update: Record<string, any> = {
    cveId: advisory.cveId,
    advisoryId: advisory._id,
    clientId: client._id,
    affected: data.affected ?? true,
    rationale: data.rationale,
    posture: data.posture || (data.affected ? 'affected' : 'not_affected'),
    responseText: data.responseText,
    requestId: data.requestId || undefined,
    threadId: data.threadId || undefined,
  };
  if (data.communicate) {
    update.communicatedAt = new Date();
    update.communicatedBy = actor?.id || actor?.username;
  }

  const impact = await CveImpact.findOneAndUpdate(
    { cveId: advisory.cveId, clientId: client._id },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (data.requestId && mongoose.Types.ObjectId.isValid(data.requestId)) {
    await logEvent({
      requestId: data.requestId,
      threadId: data.threadId,
      type: 'cve_impact',
      visibility: 'internal',
      authorId: actor?.id,
      authorName: actor?.username || 'InfoSec',
      authorRole: actor?.role,
      body: `Impacto CVE ${advisory.cveId} (${advisory.severity}): ${impact.posture}`,
      metadata: { cveId: advisory.cveId, affected: impact.affected, impactId: String(impact._id) },
    });
  }

  return impact;
}

/**
 * Generates an editable draft. Never sends anything. Uses the LLM when
 * available and falls back to a deterministic template.
 */
export async function generateCommunicationDraft(cveId: string, clientId: string, tone = 'formal') {
  const advisory = await findAdvisoryByKey(cveId);
  if (!advisory) throw Object.assign(new Error('Advisory not found'), { statusCode: 404 });
  const client = await Client.findById(clientId).lean();
  if (!client) throw Object.assign(new Error('Client not found'), { statusCode: 404 });

  const fallback = [
    `Hola equipo de ${client.name},`,
    '',
    `Os contactamos en relación con ${advisory.cveId} — ${advisory.title}.`,
    `Severidad: ${advisory.severity}${advisory.cvssScore ? ` (CVSS ${advisory.cvssScore})` : ''}.`,
    advisory.summary ? `\nResumen: ${advisory.summary}` : '',
    advisory.products?.length ? `\nProductos afectados: ${advisory.products.join(', ')}.` : '',
    "\nEstamos evaluando el impacto en los servicios que os prestamos y os mantendremos informados. Si tenéis alguna pregunta, responded a este correo.",
    '',
    'Un saludo,',
    'Equipo de Seguridad de la Información',
  ].filter(Boolean).join('\n');

  let content = fallback;
  try {
    const prompt = [
      {
        role: 'system' as const,
        content:
          'Eres un analista de seguridad redactando un borrador de comunicación a un cliente. ' +
          'Tono ' + tone + '. No inventes hechos, no prometas plazos y no incluyas datos internos. ' +
          'Devuelve solo el texto del correo.',
      },
      {
        role: 'user' as const,
        content: `Cliente: ${client.name}\nCVE: ${advisory.cveId} (${advisory.severity})\nTítulo: ${advisory.title}\nResumen: ${advisory.summary || 'n/d'}\nProductos: ${(advisory.products || []).join(', ') || 'n/d'}`,
      },
    ];
    const generated = await chat({ messages: prompt, temperature: 0.2, maxTokens: 800 });
    if (generated?.trim()) content = generated.trim();
  } catch {
    // Keep deterministic fallback when the LLM is unavailable.
  }

  return { cveId: advisory.cveId, clientId, content, model: 'draft', tone };
}

export async function getClientCveSubscription(clientId: string) {
  const client = await Client.findById(clientId).select('name cveSubscriptions').lean();
  if (!client) throw Object.assign(new Error('Client not found'), { statusCode: 404 });
  return {
    clientId,
    name: (client as any).name,
    enabled: Boolean((client as any).cveSubscriptions?.enabled),
    severityThreshold: (client as any).cveSubscriptions?.severityThreshold || 'high',
    recipients: (client as any).cveSubscriptions?.recipients || [],
  };
}

export async function updateClientCveSubscription(clientId: string, data: Record<string, any>) {
  const client = await Client.findById(clientId);
  if (!client) throw Object.assign(new Error('Client not found'), { statusCode: 404 });
  (client as any).cveSubscriptions = {
    enabled: data.enabled ?? (client as any).cveSubscriptions?.enabled ?? false,
    severityThreshold: data.severityThreshold || (client as any).cveSubscriptions?.severityThreshold || 'high',
    recipients: data.recipients || (client as any).cveSubscriptions?.recipients || [],
  };
  await client.save();
  return getClientCveSubscription(clientId);
}

/**
 * Notifies subscribed clients when an advisory is published. Email delivery is
 * best-effort; results are always reported back to the caller.
 */
export async function notifySubscribers(advisoryId: string) {
  const advisory = await CveAdvisory.findById(advisoryId).lean();
  if (!advisory) throw Object.assign(new Error('Advisory not found'), { statusCode: 404 });

  const threshold = SEVERITY_ORDER[advisory.severity] ?? 0;
  const clients = await Client.find({ 'cveSubscriptions.enabled': true }).lean();
  const results: Array<{ clientId: string; sent: number; recipients: string[] }> = [];

  for (const client of clients as any[]) {
    const clientThreshold = SEVERITY_ORDER[client.cveSubscriptions?.severityThreshold] ?? SEVERITY_ORDER.high;
    if (threshold < clientThreshold) continue;
    const recipients = new Set<string>(client.cveSubscriptions?.recipients || []);
    for (const stakeholder of client.stakeholders || []) {
      if (stakeholder.email) recipients.add(stakeholder.email);
    }
    let sent = 0;
    for (const recipient of recipients) {
      try {
        if (await sendEmailToAddress(
          recipient,
          `Aviso de seguridad ${advisory.cveId} (${advisory.severity})`,
          `${advisory.title}\n\n${advisory.summary || ''}`
        )) {
          sent++;
        }
      } catch (error) {
        console.warn('CVE subscriber email failed:', (error as Error).message);
      }
    }
    await CveImpact.findOneAndUpdate(
      { cveId: advisory.cveId, clientId: client._id },
      {
        $setOnInsert: {
          cveId: advisory.cveId,
          advisoryId: advisory._id,
          clientId: client._id,
          affected: false,
          posture: 'under_review',
        },
      },
      { upsert: true, new: true }
    );
    results.push({ clientId: String(client._id), sent, recipients: [...recipients] });
  }

  return { advisoryId, cveId: advisory.cveId, severity: advisory.severity, clients: results.length, results };
}

export function severityAtLeast(value: string, threshold: string) {
  return (SEVERITY_ORDER[value] ?? 0) >= (SEVERITY_ORDER[threshold] ?? 0);
}

export { Severities };
