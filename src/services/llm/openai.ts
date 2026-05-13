import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import { env } from '../../config';
import { getLLMSettings } from './llmSettings';

const isDummyKey = env.OPENAI_API_KEY.startsWith('dummy') ||
  env.OPENAI_API_KEY.includes('placeholder') ||
  env.OPENAI_API_KEY === 'sk-placeholder' ||
  !env.OPENAI_API_KEY.startsWith('sk-');
const resolvedBaseUrl = env.OPENAI_BASE_URL || (isDummyKey ? 'http://llm-ollama:11434/v1' : undefined);
const resolvedApiKey = resolvedBaseUrl ? (env.OPENAI_API_KEY || 'dummy') : env.OPENAI_API_KEY;

const fallbackClient = new OpenAI({
  baseURL: resolvedBaseUrl,
  apiKey: resolvedApiKey,
});

let cachedConfigKey: string | null = null;
let cachedConfigUrl: string | null = null;
let activeClient: OpenAI | null = null;

export async function getOpenAIClient(): Promise<OpenAI> {
  try {
    const settings = await getLLMSettings();
    const key = settings.provider === 'openai' ? settings.openaiApiKey : 'dummy';
    const url = settings.provider === 'openai'
      ? settings.openaiBaseUrl
      : `http://${settings.ollamaHost}:${settings.ollamaPort}/v1`;

    if (cachedConfigKey !== key || cachedConfigUrl !== url) {
      activeClient = new OpenAI({ baseURL: url, apiKey: key });
      cachedConfigKey = key;
      cachedConfigUrl = url;
    }
    return activeClient;
  } catch {
    return fallbackClient;
  }
}

export async function invalidateClient(): Promise<void> {
  cachedConfigKey = null;
  cachedConfigUrl = null;
  activeClient = null;
}

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
  const { messages, temperature = 0.3, maxTokens = 4000 } = options;
  const settings = await getLLMSettings();
  const model = options.model || settings.activeModel;

  console.error('[LLM INPUT] Model: ' + model);
  console.error('[LLM INPUT] Messages: ' + JSON.stringify(messages, null, 2));

  try {
    const client = await getOpenAIClient();
    const response = await client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });
    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Error calling LLM:', error);
    throw error;
  }
}

export async function createProviderEmbedding(text: string): Promise<number[]> {
  const settings = await getLLMSettings();
  try {
    if (settings.provider === 'openai') {
      const client = await getOpenAIClient();
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0]?.embedding || [];
    }
  } catch {
    console.warn('Provider embedding failed, falling back to Ollama');
  }
  return createOllamaEmbedding(text);
}

export async function createProviderEmbeddings(texts: string[]): Promise<number[][]> {
  const settings = await getLLMSettings();
  try {
    if (settings.provider === 'openai') {
      const client = await getOpenAIClient();
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
      });
      return response.data.map(item => item.embedding);
    }
  } catch {
    console.warn('Provider embeddings failed, falling back to Ollama');
  }
  return createOllamaEmbeddings(texts);
}

export async function createEmbedding(text: string): Promise<number[]> {
  try {
    const client = await getOpenAIClient();
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0]?.embedding || [];
  } catch {
    console.warn('Embedding not available, falling back to Ollama');
    return createOllamaEmbedding(text);
  }
}

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const client = await getOpenAIClient();
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    });
    return response.data.map(item => item.embedding);
  } catch {
    console.warn('OpenAI embeddings not available, trying Ollama direct');
    return createOllamaEmbeddings(texts);
  }
}

export async function createOllamaEmbedding(text: string): Promise<number[]> {
  const EMBEDDING_MODELS = ['nomic-embed-text', 'mxbai-embed-large', 'snowflake-arctic-embed:latest'];

  for (const model of EMBEDDING_MODELS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);

      const settings = await getLLMSettings().catch(() => null);
      const host = settings?.ollamaHost || process.env.OLLAMA_HOST || 'llm-ollama';
      const port = settings?.ollamaPort || process.env.OLLAMA_PORT || '11434';

      const response = await fetch(`http://${host}:${port}/api/embeddings`, {
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
      console.warn(`Model ${model} failed:`, error);
    }
  }

  console.error('All embedding models failed');
  return [];
}

async function runWithConcurrencyLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = [];
  const running: Promise<void>[] = [];

  for (const [i, task] of tasks.entries()) {
    const p = task().then(r => { results[i] = r; });
    const e = p.then(() => running.splice(running.indexOf(e!), 1));
    running.push(e!);
    if (running.length >= limit) {
      await Promise.race(running);
    }
  }
  await Promise.all(running);
  return results;
}

export async function createOllamaEmbeddings(texts: string[]): Promise<number[][]> {
  const tasks = texts.map(text => {
    return async (): Promise<number[]> => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await createOllamaEmbedding(text);
          if (result.length > 0) return result;
        } catch (err) {
          lastError = err;
          if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
      console.warn(`Embedding failed for text after 3 attempts:`, lastError);
      return [];
    };
  });
  return runWithConcurrencyLimit(tasks, 2);
}

export async function* streamChat(options: ChatOptions): AsyncGenerator<string> {
  const { messages, temperature = 0.7, maxTokens = 4000 } = options;
  const settings = await getLLMSettings();
  const model = options.model || settings.activeModel;

  const client = await getOpenAIClient();
  const stream = await client.chat.completions.create({
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
  const client = await getOpenAIClient();

  const responsesClient = (client as any).responses;
  if (!responsesClient || typeof responsesClient.create !== 'function') {
    throw new Error('Responses API is not available in current OpenAI SDK/runtime');
  }

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
    const client = await getOpenAIClient();
    const file = await client.files.create({
      file: await toFile(args.buffer, args.filename, { type: args.mimeType || 'application/octet-stream' }),
      purpose: 'assistants',
    });

    for (const vectorStoreId of configuredVectorStoreIds) {
      try {
        const vectorStoresClient = (client as any).vectorStores;
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
