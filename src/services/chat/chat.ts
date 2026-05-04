import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { Conversation, Client, ClientRequest } from '../../db/mongo/models';
import { processQuestion } from '../agent/infosec-agent';
import { newId } from '../../utils/ids';
import { runChatQuery } from '../rag/orchestrator';
import type { Conversation as ConversationType, Message, Client as ClientType, Attachment, ClientRequest as ClientRequestType } from '../../types';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'clients');

export async function createClient(data: {
  name: string;
  clientType: string;
  country?: string;
  contact?: string;
}): Promise<ClientType> {
  const client = await Client.create(data);
  return {
    id: client._id.toString(),
    name: client.name,
    clientType: client.clientType as any,
    country: client.country,
    contact: client.contact,
    attachments: [],
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}

export async function getAllClients(): Promise<ClientType[]> {
  const clients = await Client.find().sort({ createdAt: -1 }).lean();
  return clients.map((c: any) => ({
    id: c._id.toString(),
    name: c.name,
    clientType: c.clientType,
    country: c.country,
    contact: c.contact,
    attachments: (c.attachments || []).map((a: any) => ({
      id: a._id?.toString() || a.filename,
      filename: a.filename,
      originalName: a.originalName,
      path: a.path,
      mimeType: a.mimeType,
      size: a.size,
      createdAt: a.createdAt,
    })),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}

export async function getClient(id: string): Promise<ClientType | null> {
  const client = await Client.findById(id).lean();
  if (!client) return null;
  return {
    id: (client as any)._id.toString(),
    name: client.name,
    clientType: client.clientType as any,
    country: client.country,
    contact: client.contact,
    attachments: (client.attachments || []).map((a: any) => ({
      id: a._id?.toString() || a.filename,
      filename: a.filename,
      originalName: a.originalName,
      path: a.path,
      mimeType: a.mimeType,
      size: a.size,
      createdAt: a.createdAt,
    })),
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}

export async function updateClient(id: string, data: Partial<{
  name: string;
  clientType: string;
  country?: string;
  contact?: string;
}>): Promise<ClientType | null> {
  const client = await Client.findByIdAndUpdate(id, data, { new: true }).lean();
  if (!client) return null;
  return {
    id: (client as any)._id.toString(),
    name: client.name,
    clientType: client.clientType as any,
    country: client.country,
    contact: client.contact,
    attachments: (client.attachments || []).map((a: any) => ({
      id: a._id?.toString() || a.filename,
      filename: a.filename,
      originalName: a.originalName,
      path: a.path,
      mimeType: a.mimeType,
      size: a.size,
      createdAt: a.createdAt,
    })),
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}

export async function deleteClient(id: string): Promise<void> {
  await Client.findByIdAndDelete(id);
  await Conversation.deleteMany({ clientId: new mongoose.Types.ObjectId(id) });
}

function generateRequestKey(clientName: string, requestType: string): string {
  const date = new Date().toISOString().split('T')[0];
  return `${clientName}-${requestType}-${date}`;
}

export async function createClientRequest(data: {
  clientId: string;
  requestType: string;
  sectionToReview?: string;
  deadline?: string;
  owner?: string;
  comments?: string;
}): Promise<ClientRequestType> {
  const client = await Client.findById(data.clientId);
  if (!client) {
    throw new Error('Client not found');
  }

  const requestKey = generateRequestKey(client.name, data.requestType);

  const deadlineDate = data.deadline ? (data.deadline.includes('T') ? new Date(data.deadline) : new Date(data.deadline + 'T00:00:00')) : undefined;

  const request = await ClientRequest.create({
    clientId: new mongoose.Types.ObjectId(data.clientId),
    requestKey,
    requestType: data.requestType,
    sectionToReview: data.sectionToReview,
    deadline: deadlineDate,
    owner: data.owner,
    comments: data.comments,
    status: 'open',
  });

return {
    id: (request as any)._id.toString(),
    clientId: request.clientId.toString(),
    requestKey: request.requestKey,
    requestType: request.requestType,
    sectionToReview: request.sectionToReview,
    deadline: request.deadline,
    owner: request.owner,
    comments: request.comments,
    status: request.status as 'open' | 'in_progress' | 'completed',
    attachments: request.attachments || [],
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

export async function getClientRequests(clientId: string): Promise<ClientRequestType[]> {
  const requests = await ClientRequest.find({ clientId: new mongoose.Types.ObjectId(clientId) })
    .sort({ createdAt: -1 })
    .lean();

  return requests.map((req: any) => ({
    id: req._id.toString(),
    clientId: req.clientId.toString(),
    requestKey: req.requestKey,
    requestType: req.requestType,
    sectionToReview: req.sectionToReview,
    deadline: req.deadline,
    owner: req.owner,
    comments: req.comments,
    status: req.status as 'open' | 'in_progress' | 'completed',
    attachments: req.attachments || [],
    createdAt: req.createdAt,
    updatedAt: req.updatedAt,
  }));
}

export async function getClientRequest(id: string): Promise<ClientRequestType | null> {
  const request = await ClientRequest.findById(id).lean();
  if (!request) return null;

  return {
    id: (request as any)._id.toString(),
    clientId: request.clientId.toString(),
    requestKey: request.requestKey,
    requestType: request.requestType,
    sectionToReview: request.sectionToReview,
    deadline: request.deadline,
    owner: request.owner,
    comments: request.comments,
    status: request.status as 'open' | 'in_progress' | 'completed',
    attachments: request.attachments || [],
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

export async function updateClientRequest(id: string, data: Partial<{
  requestType: string;
  sectionToReview: string;
  deadline: string;
  owner: string;
  comments: string;
  status: 'open' | 'in_progress' | 'completed';
}>): Promise<ClientRequestType | null> {
  const updateData: any = { ...data };
  if (data.deadline) {
    updateData.deadline = new Date(data.deadline);
  }

  const request = await ClientRequest.findByIdAndUpdate(id, updateData, { new: true }).lean();
  if (!request) return null;

  return {
    id: (request as any)._id.toString(),
    clientId: request.clientId.toString(),
    requestKey: request.requestKey,
    requestType: request.requestType,
    sectionToReview: request.sectionToReview,
    deadline: request.deadline,
    owner: request.owner,
    comments: request.comments,
    status: request.status as 'open' | 'in_progress' | 'completed',
    attachments: (request.attachments || []).map((a: any) => ({
      id: a._id?.toString() || a.filename,
      filename: a.filename,
      originalName: a.originalName,
      path: a.path,
      mimeType: a.mimeType,
      size: a.size,
      createdAt: a.createdAt,
    })),
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

export async function deleteClientRequest(id: string): Promise<void> {
  await ClientRequest.findByIdAndDelete(id);
}

export async function cleanAllData(): Promise<void> {
  await Client.deleteMany({});
  await Conversation.deleteMany({});
  await ClientRequest.deleteMany({});
}

export async function createConversation(clientId: string, title?: string, agent?: string, requestId?: string): Promise<ConversationType> {
  // Handle 'default' clientId - create default client if needed
  if (clientId === 'default') {
    let defaultClient = await Client.findOne({ name: 'Default Client' });
    if (!defaultClient) {
      defaultClient = await Client.create({
        name: 'Default Client',
        clientType: 'Cloud',  // Must be valid enum: 'Cloud', 'Rent', 'PS'
        country: 'US',
        contact: 'admin@example.com'
      });
    }
    clientId = defaultClient._id.toString();
  }
  
  const conversation = await Conversation.create({
    clientId: new mongoose.Types.ObjectId(clientId),
    requestId: requestId ? new mongoose.Types.ObjectId(requestId) : undefined,
    title: title || 'Nueva conversación',
    agent: agent || 'InfoSec',
    favorite: false,
    messages: [],
  });

  return {
    id: conversation._id.toString(),
    clientId: conversation.clientId.toString(),
    requestId: (conversation as any).requestId?.toString(),
    title: conversation.title,
    agent: conversation.agent,
    favorite: conversation.favorite,
    messages: [],
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

export async function getConversation(id: string): Promise<ConversationType | null> {
  const conv = await Conversation.findById(id).lean();
  if (!conv) return null;

  return {
    id: (conv as any)._id.toString(),
    clientId: conv.clientId.toString(),
    requestId: (conv as any).requestId?.toString(),
    title: conv.title,
    agent: conv.agent,
    favorite: conv.favorite,
    messages: conv.messages as Message[],
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
  };
}

export async function getClientConversations(clientId: string, requestId?: string): Promise<ConversationType[]> {
  const filter: any = { clientId: new mongoose.Types.ObjectId(clientId) };
  if (requestId) {
    filter.requestId = new mongoose.Types.ObjectId(requestId);
  }

  const convs = await Conversation.find(filter)
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();

  return convs.map((conv: any) => ({
    id: conv._id.toString(),
    clientId: conv.clientId.toString(),
    requestId: conv.requestId?.toString(),
    title: conv.title,
    agent: conv.agent,
    favorite: conv.favorite,
    messages: conv.messages as Message[],
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
  }));
}

export async function updateConversation(id: string, data: Partial<{
  title: string;
  agent: string;
  favorite: boolean;
}>): Promise<ConversationType | null> {
  const conv = await Conversation.findByIdAndUpdate(id, data, { new: true }).lean();
  if (!conv) return null;
  return {
    id: (conv as any)._id.toString(),
    clientId: conv.clientId.toString(),
    title: conv.title,
    agent: conv.agent,
    favorite: conv.favorite,
    messages: conv.messages as Message[],
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
  };
}

export async function sendMessage(
  conversationId: string,
  userMessage: string,
  agent?: string,
  context?: { requestId?: string; userId?: string }
): Promise<{ conversation: ConversationType; response: string; responseId?: string }> {
  const conv = await Conversation.findById(conversationId);
  if (!conv) {
    throw new Error('Conversation not found');
  }

  const userMsg: Message = {
    role: 'user',
    content: userMessage,
    timestamp: new Date(),
  };
  conv.messages.push(userMsg);

  let responseContent = '';
  let responseId: string | undefined;
  let ragResponse: any = undefined;

  try {
    console.error('[LLM INPUT] sendMessage: Calling runChatQuery with agent: ' + (agent || conv.agent || 'InfoSec'));
    ragResponse = await runChatQuery({
      requestId: context?.requestId || newId('req'),
      userId: context?.userId,
      clientId: conv.clientId.toString(),
      sessionId: conversationId,
      question: userMessage,
      agent: agent || conv.agent,
      taskProfile: `Conversation agent: ${agent || conv.agent || 'InfoSec'}`,
      expectedFormat: 'Provide concise answer and evidence bullets.',
      domain: 'infosec',
    });
    console.error('[LLM INPUT] sendMessage: runChatQuery succeeded');
    responseId = ragResponse.response_id;
    responseContent = ragResponse.answer_text;
    // NO appendear citas y flags al contenido - se pasan como metadata
  } catch (error) {
    console.error('[LLM INPUT] sendMessage: runChatQuery FAILED, falling back to processQuestion. Error: ' + error.message);
    const agentResponse = await processQuestion(userMessage, agent);
    responseContent = agentResponse.content;
    // NO appendear información adicional al contenido
  }

  const assistantMsg: Message = {
    role: 'assistant',
    content: responseContent,
    timestamp: new Date(),
    // Solo agregar metadata si hay datos disponibles (RAG flow)
    ...(typeof ragResponse !== 'undefined' ? {
      metadata: {
        confidence: ragResponse.confidence,
        coverage_status: ragResponse.coverage_status,
        flags: ragResponse.flags,
        citations: ragResponse.citations,
        used_sources: ragResponse.used_sources,
        response_id: ragResponse.response_id,
      }
    } : {})
  };
  conv.messages.push(assistantMsg);

  await conv.save();

  return {
    conversation: {
      id: conv._id.toString(),
      clientId: conv.clientId.toString(),
      title: conv.title,
      agent: conv.agent,
      favorite: conv.favorite,
      messages: conv.messages as Message[],
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    },
    response: responseContent,
    responseId,
  };
}

export async function deleteConversation(id: string): Promise<void> {
  await Conversation.findByIdAndDelete(id);
}

export async function uploadClientAttachment(
  clientId: string,
  file: { filename: string; data: Buffer; mimetype?: string }
): Promise<Attachment> {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  const clientObjId = new mongoose.Types.ObjectId(clientId);
  const client = await Client.findById(clientObjId);
  if (!client) {
    throw new Error('Client not found');
  }

  const ext = path.extname(file.filename);
  const storedFilename = `${clientId}-${Date.now()}${ext}`;
  const filePath = path.join(UPLOAD_DIR, storedFilename);

  fs.writeFileSync(filePath, file.data);

  const attachment = {
    filename: storedFilename,
    originalName: file.filename,
    path: `/uploads/clients/${storedFilename}`,
    mimeType: file.mimetype || 'application/octet-stream',
    size: file.data.length,
    createdAt: new Date(),
  };

  client.attachments.push(attachment as any);
  await client.save();

  return {
    id: (client.attachments[client.attachments.length - 1] as any)._id?.toString() || storedFilename,
    ...attachment,
  };
}
