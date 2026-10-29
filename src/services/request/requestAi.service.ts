import mongoose from 'mongoose';
import { AiArtifact, ClientRequest, RequestEvent } from '../../db/mongo/models';
import { AiArtifactKind, RequestTypes } from '../../types/request';
import { chat } from '../llm/openai';
import { createProviderEmbedding } from '../llm/openai';
import { getChromaClient } from '../chroma/indexer';
import { getRequest360 } from './request.service';
import { logEvent } from './event.service';
import { RequestActor } from './request.service';

const REQUEST_COLLECTION = 'requests';

interface TimelineLine {
  at: string;
  type: string;
  visibility: string;
  author: string;
  body: string;
}

function renderTimeline(events: any[]): string {
  return events
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((event) => {
      const line: TimelineLine = {
        at: new Date(event.createdAt).toISOString(),
        type: event.type,
        visibility: event.visibility,
        author: event.authorName || event.authorId || 'sistema',
        body: String(event.body || '').slice(0, 1200),
      };
      return `- [${line.at}] (${line.type}/${line.visibility}) ${line.author}: ${line.body}`;
    })
    .join('\n');
}

async function buildCaseContext(requestId: string, includeInternal: boolean) {
  const data = await getRequest360(requestId, { includeInternal });
  if (!data) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  const request: any = data.request;
  const context = [
    `Solicitud ${request.requestKey} — ${request.title || request.requestType}`,
    `Cliente: ${request.client?.name || request.clientSnapshot?.name || 'n/d'}`,
    `Tipo: ${request.requestType} · Prioridad: ${request.priority} · Severidad: ${request.severity}`,
    `Estado: ${request.statusNew} · Deadline: ${request.deadline ? new Date(request.deadline).toISOString().slice(0, 10) : 'sin deadline'}`,
    `Alcance: ${request.scope || request.sectionToReview || 'n/d'}`,
    '',
    'Hilos:',
    ...data.threads.map((thread: any) => `- ${thread.type} · ${thread.title} (${thread.status})`),
    '',
    'Entregables:',
    ...data.deliverables.map((deliverable: any) => `- ${deliverable.type} · ${deliverable.name} · ${deliverable.status} · v${deliverable.version}`),
    '',
    'Documentos:',
    ...data.documents.map((document: any) => `- ${document.documentType} · ${document.originalName} · ${document.visibility}`),
    '',
    'Cronología:',
    renderTimeline(data.events),
  ];
  return { data, request, context: context.join('\n') };
}

async function saveArtifact(data: {
  requestId: string;
  kind: AiArtifactKind;
  content: string;
  responseId?: string;
  model?: string;
  citations?: any[];
  actor?: RequestActor;
  promptHash?: string;
}) {
  const artifact = await AiArtifact.create({
    requestId: data.requestId,
    kind: data.kind,
    content: data.content,
    responseId: data.responseId,
    model: data.model,
    citations: data.citations || [],
    promptHash: data.promptHash,
    createdBy: data.actor?.id || data.actor?.username,
  });
  await logEvent({
    requestId: data.requestId,
    type: 'ai_draft',
    visibility: 'internal',
    authorId: data.actor?.id,
    authorName: data.actor?.username || 'IA',
    authorRole: data.actor?.role,
    body: `Borrador IA generado (${data.kind}). Revisión humana requerida.`,
    metadata: { artifactId: String(artifact._id), responseId: data.responseId, kind: data.kind },
  });
  return artifact;
}

export async function generateCaseSummary(requestId: string, actor?: RequestActor, options: { includeInternal?: boolean } = {}) {
  const { data, request, context } = await buildCaseContext(requestId, options.includeInternal !== false);
  const prompt = [
    {
      role: 'system' as const,
      content:
        'Eres un analista de seguridad. Resume el caso en español, en 8-12 bullets: situación, riesgos, ' +
        'qué se ha hecho, qué falta y próximos pasos. No inventes datos. No reveles contenido marcado internal ' +
        'si el resumen se destina al cliente.',
    },
    { role: 'user' as const, content: context },
  ];

  let content = '';
  let model = 'fallback';
  try {
    content = await chat({ messages: prompt, temperature: 0.2, maxTokens: 1200 });
    model = 'llm';
  } catch {
    content = [
      `Resumen de ${request.requestKey}`,
      `- Cliente: ${request.client?.name || request.clientSnapshot?.name || 'n/d'}`,
      `- Estado: ${request.statusNew} · Prioridad ${request.priority}`,
      `- Eventos registrados: ${data.counts.events}`,
      `- Hilos abiertos/cerrados: ${data.threads.length}`,
      `- Entregables: ${data.deliverables.length}`,
      `- Documentos: ${data.documents.length}`,
    ].join('\n');
  }

  const artifact = await saveArtifact({
    requestId,
    kind: 'summary',
    content: content || 'Sin contenido',
    model,
    actor,
    promptHash: `summary:${requestId}:${Date.now()}`,
  });
  return { artifact, content: artifact.content };
}

export async function generateFollowupDraft(requestId: string, actor?: RequestActor, instructions?: string) {
  const data = await getRequest360(requestId, { includeInternal: true });
  if (!data) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  const request: any = data.request;
  const clientId = request.clientId;
  const question = [
    instructions || 'Redacta un follow-up breve y profesional para el cliente.',
    `Contexto: solicitud ${request.requestKey} (${request.requestType}), estado ${request.statusNew}.`,
    `Últimos eventos relevantes:`,
    renderTimeline(data.events.filter((event: any) => event.visibility !== 'internal').slice(0, 20)),
    'No incluyas información interna ni prometas fechas no confirmadas. Devuelve solo el texto del correo.',
  ].join('\n');

  let content = '';
  let responseId: string | undefined;
  let citations: any[] = [];
  try {
    const { runChatQuery } = await import('../rag/orchestrator');
    const result = await runChatQuery({
      requestId,
      clientId,
      userId: actor?.id,
      question,
    });
    content = result.answer_text;
    responseId = result.response_id;
    citations = result.citations as any[];
  } catch (error) {
    content = [
      `Hola,`,
      '',
      `Os escribimos en relación con ${request.requestKey} — ${request.title || request.requestType}.`,
      'Seguimos trabajando en la solicitud y os mantendremos informados de cualquier avance.',
      '',
      'Un saludo,',
      'Equipo de Seguridad de la Información',
    ].join('\n');
  }

  const artifact = await saveArtifact({
    requestId,
    kind: 'followup_draft',
    content,
    responseId,
    citations,
    model: responseId ? 'rag' : 'fallback',
    actor,
    promptHash: `followup:${requestId}:${Date.now()}`,
  });
  return { artifact, content: artifact.content, citations, responseId };
}

export async function generateMeetingMinutes(requestId: string, actor?: RequestActor) {
  const data = await getRequest360(requestId, { includeInternal: false });
  if (!data) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  const request: any = data.request;
  const context = [
    `Solicitud ${request.requestKey} — ${request.title || request.requestType}`,
    `Cliente: ${request.client?.name || request.clientSnapshot?.name || 'n/d'}`,
    'Cronología visible para cliente:',
    renderTimeline(data.events),
  ].join('\n');

  let content = '';
  try {
    content = await chat({
      messages: [
        {
          role: 'system' as const,
          content:
            'Convierte la cronología en un acta breve para el cliente: acuerdos, decisiones, pendientes y ' +
            'responsables. Usa solo información presente en la cronología. Español formal.',
        },
        { role: 'user' as const, content: context },
      ],
      temperature: 0.2,
      maxTokens: 900,
    });
  } catch {
    content = `Acta de ${request.requestKey}\n\n${data.events.map((event: any) => `- ${event.body}`).join('\n')}`;
  }

  const artifact = await saveArtifact({
    requestId,
    kind: 'meeting_minutes',
    content,
    model: 'llm',
    actor,
    promptHash: `minutes:${requestId}:${Date.now()}`,
  });
  return { artifact, content: artifact.content };
}

function heuristicClassification(text: string) {
  const lower = String(text || '').toLowerCase();
  const rules: Array<{ type: string; words: string[] }> = [
    { type: 'RFI/RFP', words: ['rfi', 'rfp', 'cuestionario', 'questionnaire'] },
    { type: 'Certification Request', words: ['certificado', 'certification', 'iso 27001', 'soc 2', 'soc2'] },
    { type: '3rd Party PT', words: ['pentest', 'penetration test', 'pt '] },
    { type: 'BC/DR Test Result Request', words: ['bc/dr', 'bcdr', 'disaster recovery', 'continuidad'] },
    { type: 'Cloud Customer PT Request', words: ['customer pt', 'prueba de penetración'] },
    { type: 'Customer Agreement Review', words: ['contrato', 'agreement', 'msa', 'dpa', 'nda'] },
    { type: 'InfoSec Support', words: ['soporte', 'support', 'ayuda', 'incidencia'] },
  ];
  const matched = rules.find((rule) => rule.words.some((word) => lower.includes(word)));
  const priority = /urgente|urgent|inmediato|asap/.test(lower) ? 'P1' : /semana|week/.test(lower) ? 'P2' : 'P3';
  const severity = /brecha|ransomware|critical|crítico|exposición/.test(lower) ? 'high' : 'medium';
  const missing: string[] = [];
  if (!/deadline|fecha límite|antes del|by /.test(lower)) missing.push('deadline');
  if (!/alcance|scope|preguntas|questions/.test(lower)) missing.push('scope');
  return {
    requestType: matched?.type || 'Other Support',
    priority,
    severity,
    missingFields: missing,
    suggestedDocuments: matched?.type === 'RFI/RFP' ? ['questionnaire', 'soc_report'] : ['other'],
    confidence: matched ? 0.7 : 0.35,
    summary: String(text || '').slice(0, 400),
    source: 'heuristic' as const,
  };
}

export async function classifyIntake(text: string, actor?: RequestActor) {
  const fallback = heuristicClassification(text);
  try {
    const raw = await chat({
      messages: [
        {
          role: 'system' as const,
          content:
            'Clasifica un email o texto de intake de seguridad. Devuelve SOLO JSON válido con: ' +
            'requestType (uno de ' + RequestTypes.join(' | ') + '), priority (P1-P4), severity ' +
            '(critical|high|medium|low|info), missingFields (array), suggestedDocuments (array), ' +
            'confidence (0-1), summary (1 frase). No inventes datos.',
        },
        { role: 'user' as const, content: String(text || '').slice(0, 6000) },
      ],
      temperature: 0,
      maxTokens: 500,
    });
    const json = JSON.parse(raw.replace(/```json|```/g, '').trim());
    const requestType = RequestTypes.includes(json.requestType) ? json.requestType : fallback.requestType;
    return {
      ...fallback,
      ...json,
      requestType,
      source: 'llm' as const,
    };
  } catch {
    return fallback;
  }
}

export async function getArtifact(id: string) {
  const artifact = await AiArtifact.findById(id).lean();
  if (!artifact) throw Object.assign(new Error('Artifact not found'), { statusCode: 404 });
  return artifact;
}

export async function acceptArtifact(id: string, actor?: RequestActor, editedContent?: string) {
  const artifact = await AiArtifact.findById(id);
  if (!artifact) throw Object.assign(new Error('Artifact not found'), { statusCode: 404 });
  artifact.acceptedAt = new Date();
  if (editedContent !== undefined) artifact.editedContent = editedContent;
  await artifact.save();
  await logEvent({
    requestId: artifact.requestId,
    type: 'ai_draft',
    visibility: 'internal',
    authorId: actor?.id,
    authorName: actor?.username || 'InfoSec',
    body: `Borrador IA aceptado (${artifact.kind})${editedContent ? ' con ediciones' : ''}`,
    metadata: { artifactId: String(artifact._id), edited: editedContent !== undefined },
  });
  return artifact;
}

export async function discardArtifact(id: string, actor?: RequestActor) {
  const artifact = await AiArtifact.findById(id);
  if (!artifact) throw Object.assign(new Error('Artifact not found'), { statusCode: 404 });
  artifact.discardedAt = new Date();
  await artifact.save();
  return artifact;
}

export async function listArtifacts(requestId: string, kind?: string) {
  const query: Record<string, any> = { requestId: new mongoose.Types.ObjectId(requestId) };
  if (kind) query.kind = kind;
  return AiArtifact.find(query).sort({ createdAt: -1 }).limit(50).lean();
}

/**
 * Semantic dedupe using the `requests` Chroma collection. Failures are
 * non-fatal: the deterministic dedupe remains the source of truth.
 */
export async function indexRequestInChroma(request: any) {
  try {
    const text = `${request.requestKey || ''} ${request.title || request.sectionToReview || ''} ${request.scope || ''}`.trim();
    if (!text) return false;
    const embedding = await createProviderEmbedding(text);
    if (!embedding.length) return false;
    const client = await getChromaClient();
    const collection = await client.getOrCreateCollection({ name: REQUEST_COLLECTION });
    await collection.upsert({
      ids: [String(request._id)],
      embeddings: [embedding],
      documents: [text],
      metadatas: [{
        clientId: String(request.clientId?._id || request.clientId),
        status: request.status,
        requestType: request.requestType,
        requestKey: request.requestKey || '',
      }],
    });
    return true;
  } catch (error) {
    console.warn('Chroma request index failed:', (error as Error).message);
    return false;
  }
}

export async function semanticDuplicateCheck(data: {
  clientId: string;
  title?: string;
  scope?: string;
  requestType?: string;
}) {
  try {
    const text = `${data.title || ''} ${data.scope || ''}`.trim();
    if (!text) return [];
    const embedding = await createProviderEmbedding(text);
    if (!embedding.length) return [];
    const client = await getChromaClient();
    const collection = await client.getOrCreateCollection({ name: REQUEST_COLLECTION });
    const result: any = await collection.query({
      queryEmbeddings: [embedding],
      nResults: 5,
      where: { clientId: String(data.clientId) },
    });
    const ids: string[] = result.ids?.[0] || [];
    const distances: number[] = result.distances?.[0] || [];
    const metadatas: any[] = result.metadatas?.[0] || [];
    return ids
      .map((id, index) => ({
        id,
        similarity: Number((1 - (distances[index] ?? 1)).toFixed(2)),
        requestKey: metadatas[index]?.requestKey,
        requestType: metadatas[index]?.requestType,
        status: metadatas[index]?.status,
      }))
      .filter((candidate) => candidate.similarity >= 0.85);
  } catch (error) {
    console.warn('Semantic dedupe unavailable:', (error as Error).message);
    return [];
  }
}
