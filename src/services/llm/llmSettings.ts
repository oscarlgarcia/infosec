import { Setting } from '../../db/mongo/models';
import { encrypt, decrypt } from '../../utils/encryption';

export interface LLMSettings {
  provider: 'ollama' | 'openai';
  ollamaHost: string;
  ollamaPort: number;
  ollamaModel: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel: string;
  activeModel: string;
}

const DEFAULTS: LLMSettings = {
  provider: 'ollama',
  ollamaHost: 'llm-ollama',
  ollamaPort: 11434,
  ollamaModel: 'qwen2.5:latest',
  openaiApiKey: '',
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiModel: 'gpt-4o',
  activeModel: 'qwen2.5:latest',
};

async function getSetting(key: string): Promise<any> {
  try {
    const doc = await Setting.findOne({ key }).lean();
    return doc?.value;
  } catch {
    return undefined;
  }
}

export async function getLLMSettings(): Promise<LLMSettings> {
  const provider = await getSetting('llm_provider');
  if (!provider) return DEFAULTS;

  const ollamaHost = await getSetting('llm_ollama_host') || DEFAULTS.ollamaHost;
  const ollamaPort = await getSetting('llm_ollama_port') || DEFAULTS.ollamaPort;
  const ollamaModel = await getSetting('llm_ollama_model') || DEFAULTS.ollamaModel;
  const openaiBaseUrl = await getSetting('llm_openai_base_url') || DEFAULTS.openaiBaseUrl;
  const openaiModel = await getSetting('llm_openai_model') || DEFAULTS.openaiModel;

  let openaiApiKey = '';
  const encryptedKey = await getSetting('llm_openai_api_key');
  if (encryptedKey) {
    try { openaiApiKey = decrypt(encryptedKey); } catch { openaiApiKey = ''; }
  }

  const activeModel = provider === 'openai' ? openaiModel : ollamaModel;

  return { provider, ollamaHost, ollamaPort, ollamaModel, openaiApiKey, openaiBaseUrl, openaiModel, activeModel };
}

export async function saveLLMSettings(settings: Partial<LLMSettings>): Promise<void> {
  const ops: { key: string; value: any }[] = [];

  if (settings.provider !== undefined) ops.push({ key: 'llm_provider', value: settings.provider });
  if (settings.ollamaHost !== undefined) ops.push({ key: 'llm_ollama_host', value: settings.ollamaHost });
  if (settings.ollamaPort !== undefined) ops.push({ key: 'llm_ollama_port', value: settings.ollamaPort });
  if (settings.ollamaModel !== undefined) ops.push({ key: 'llm_ollama_model', value: settings.ollamaModel });
  if (settings.openaiBaseUrl !== undefined) ops.push({ key: 'llm_openai_base_url', value: settings.openaiBaseUrl });
  if (settings.openaiModel !== undefined) ops.push({ key: 'llm_openai_model', value: settings.openaiModel });
  if (settings.openaiApiKey !== undefined) {
    ops.push({ key: 'llm_openai_api_key', value: encrypt(settings.openaiApiKey) });
  }

  for (const { key, value } of ops) {
    await Setting.findOneAndUpdate(
      { key },
      { key, value, updatedAt: new Date() },
      { upsert: true }
    );
  }
}
