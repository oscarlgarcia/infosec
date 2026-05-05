import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import { env } from '../../config';

const isDummyKey = env.OPENAI_API_KEY.startsWith('dummy') || 
  env.OPENAI_API_KEY.includes('placeholder') ||
  env.OPENAI_API_KEY === 'sk-placeholder' ||
  !env.OPENAI_API_KEY.startsWith('sk-');
const resolvedBaseUrl = env.OPENAI_BASE_URL || (isDummyKey ? 'http://llm-ollama:11434/v1' : undefined);
const resolvedApiKey = resolvedBaseUrl ? (env.OPENAI_API_KEY || 'dummy') : env.OPENAI_API_KEY;

export const openai = new OpenAI({
  baseURL: resolvedBaseUrl,
  apiKey: resolvedApiKey,
});

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export async function chat(options: ChatOptions): Promise<string> {
  const { messages, model = 'qwen2.5:latest', temperature = 0.3, maxTokens = 4000 } = options;
  
  // DEBUG: Log LLM inputs
  console.error('[LLM INPUT] Model: ' + model);
  console.error('[LLM INPUT] Messages: ' + JSON.stringify(messages, null, 2));
  
  try {
    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('❌ Error calling Ollama:', error);
    throw error;
  }
}

export async function createEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'nomic-embed-text',
      input: text,
    });

    return response.data[0]?.embedding || [];
  } catch (error) {
    console.warn('⚠️ Embedding not available, returning empty array');
    return [];
  }
}

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const response = await openai.embeddings.create({
      model: 'nomic-embed-text',
      input: texts,
    });

    return response.data.map(item => item.embedding);
  } catch (error) {
    console.warn('⚠️ OpenAI embeddings not available, trying Ollama direct');
    return createOllamaEmbeddings(texts);
  }
}

export async function createOllamaEmbedding(text: string): Promise<number[]> {
  const EMBEDDING_MODELS = ['nomic-embed-text', 'mxbai-embed-large', 'snowflake-arctic-embed:latest'];
  
  for (const model of EMBEDDING_MODELS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      const response = await fetch('http://llm-ollama:11434/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: text,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        if (data.embedding && data.embedding.length > 0) {
          return data.embedding;
        }
      }
    } catch (error) {
      console.warn(`⚠️ Model ${model} failed:`, error);
    }
  }
  
  console.error('❌ All embedding models failed');
  return [];
}

export async function createOllamaEmbeddings(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(text => createOllamaEmbedding(text)));
}

export async function* streamChat(options: ChatOptions): AsyncGenerator<string> {
  const { messages, model = 'qwen2.5:latest', temperature = 0.7, maxTokens = 4000 } = options;
  
  const stream = await openai.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      yield content;
    }
  }
}

export interface FileSearchCitation {
  fileId?: string;
  filename?: string;
  score?: number;
  snippet?: string;
}

export interface ResponseGenerationOptions {
  input: string;
  instructions: string;
  conversationId?: string;
  vectorStoreIds?: string[];
}

export interface ResponseGenerationResult {
  outputText: string;
  responseId?: string;
  conversationId?: string;
  citations: FileSearchCitation[];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

function extractCitations(response: any): FileSearchCitation[] {
  const citations: FileSearchCitation[] = [];
  const outputItems = response?.output || [];

  for (const outputItem of outputItems) {
    const contentItems = outputItem?.content || [];
    for (const contentItem of contentItems) {
      const annotations = contentItem?.annotations || [];
      for (const annotation of annotations) {
        if (annotation?.type === 'file_citation') {
          citations.push({
            fileId: annotation.file_id,
            filename: annotation.filename,
            score: annotation.score,
            snippet: annotation.quote,
          });
        }
      }
    }
  }

  return citations;
}

export async function generateWithResponses(options: ResponseGenerationOptions): Promise<ResponseGenerationResult> {
  const { input, instructions, conversationId, vectorStoreIds = [] } = options;
  const responsesClient = (openai as any).responses;
  if (!responsesClient || typeof responsesClient.create !== 'function') {
    throw new Error('Responses API is not available in current OpenAI SDK/runtime');
  }

  // DEBUG: Log LLM inputs
  console.error('[LLM INPUT] Model: ' + env.OPENAI_MODEL);
  console.error('[LLM INPUT] Instructions: ' + instructions);
  console.error('[LLM INPUT] Input: ' + input);
  console.error('[LLM INPUT] VectorStoreIds: ' + JSON.stringify(vectorStoreIds));

  const tools = vectorStoreIds.length > 0
    ? [{ type: 'file_search' as const, vector_store_ids: vectorStoreIds }]
    : [];

  const response = await responsesClient.create({
    model: env.OPENAI_MODEL,
    instructions,
    input,
    ...(conversationId ? { conversation: conversationId } : {}),
    ...(tools.length > 0 ? { tools } : {}),
  } as any);

  const usage = response.usage
    ? {
        inputTokens: (response.usage as any).input_tokens,
        outputTokens: (response.usage as any).output_tokens,
        totalTokens: (response.usage as any).total_tokens,
      }
    : undefined;

  return {
    outputText: response.output_text || '',
    responseId: response.id,
    conversationId: (response as any).conversation || conversationId,
    citations: extractCitations(response),
    usage,
  };
}

export async function uploadFileToVectorStores(args: {
  filename: string;
  buffer: Buffer;
  mimeType?: string;
  vectorStoreIds?: string[];
}): Promise<{ fileId: string; vectorStoreIds: string[] } | null> {
  const configuredVectorStoreIds = args.vectorStoreIds && args.vectorStoreIds.length > 0
    ? args.vectorStoreIds
    : env.OPENAI_VECTOR_STORE_IDS
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

  if (!env.OPENAI_INGEST_TO_VECTOR_STORES || configuredVectorStoreIds.length === 0) {
    return null;
  }

  try {
    const file = await openai.files.create({
      file: await toFile(args.buffer, args.filename, { type: args.mimeType || 'application/octet-stream' }),
      purpose: 'assistants',
    });

    for (const vectorStoreId of configuredVectorStoreIds) {
      try {
        const vectorStoresClient = (openai as any).vectorStores;
        if (vectorStoresClient?.files?.create) {
          await vectorStoresClient.files.create(vectorStoreId, { file_id: file.id });
        }
      } catch (error) {
        console.warn(`Failed to attach file ${file.id} to vector store ${vectorStoreId}:`, error);
      }
    }

    return {
      fileId: file.id,
      vectorStoreIds: configuredVectorStoreIds,
    };
  } catch (error) {
    console.warn('OpenAI vector store ingestion skipped due to upload error:', error);
    return null;
  }
}
