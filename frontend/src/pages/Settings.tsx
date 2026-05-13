import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Layout } from '../components/Layout';
import { useApi } from '../contexts/AuthContext';
import '../styles/App.css';
import { Link } from 'react-router-dom';

interface LLMConfig {
  provider: 'ollama' | 'openai';
  ollamaHost: string;
  ollamaPort: number;
  ollamaModel: string;
  openaiHasKey: boolean;
  openaiBaseUrl: string;
  openaiModel: string;
  activeModel: string;
}

interface OllamaModel {
  name: string;
  size: number;
  modified: string;
}

interface OpenAIModel {
  id: string;
  created: number;
  ownedBy: string;
}

export function Settings() {
  const { language, setLanguage, t } = useLanguage();
  const apiFetch = useApi();
  const [reindexing, setReindexing] = useState(false);
  const [reindexMsg, setReindexMsg] = useState('');
  const [reindexDocsLoading, setReindexDocsLoading] = useState(false);
  const [reindexDocsMsg, setReindexDocsMsg] = useState('');
  const [debugLogging, setDebugLogging] = useState(false);
  const [loading, setLoading] = useState(true);

  // LLM Config state
  const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null);
  const [llmConfigLoading, setLlmConfigLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [editingApiKey, setEditingApiKey] = useState('');
  const [browsingModels, setBrowsingModels] = useState(false);
  const [modelsList, setModelsList] = useState<(OllamaModel | OpenAIModel)[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; embedding?: string; chat?: string; model?: string; error?: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState('');
  const [configStatus, setConfigStatus] = useState<'env' | 'saved'>('env');

  const toggleLanguage = () => {
    setLanguage(language === 'es' ? 'en' : 'es');
  };

  useEffect(() => {
    const fetchDebugSetting = async () => {
      try {
        const res = await apiFetch('/settings/llm-debug');
        const data = await res.json();
        setDebugLogging(data.enabled);
      } catch (e) {
        console.error('Failed to fetch debug setting:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDebugSetting();
    loadLLMConfig();
  }, []);

  const loadLLMConfig = async () => {
    try {
      const res = await apiFetch('/settings/llm');
      const data = await res.json();
      setLlmConfig(data);
      setConfigStatus(data.provider ? 'saved' : 'env');
    } catch (e) {
      console.error('Failed to fetch LLM config:', e);
    } finally {
      setLlmConfigLoading(false);
    }
  };

  const handleProviderChange = (provider: 'ollama' | 'openai') => {
    if (!llmConfig) return;
    setLlmConfig({ ...llmConfig, provider });
    setTestResult(null);
  };

  const handleSaveConfig = async () => {
    if (!llmConfig) return;
    setSavingConfig(true);
    setConfigMsg('');
    try {
      const body: any = {
        provider: llmConfig.provider,
        ollamaHost: llmConfig.ollamaHost,
        ollamaPort: llmConfig.ollamaPort,
        ollamaModel: llmConfig.ollamaModel,
        openaiBaseUrl: llmConfig.openaiBaseUrl,
        openaiModel: llmConfig.openaiModel,
      };
      if (editingApiKey) {
        body.openaiApiKey = editingApiKey;
      }
      const res = await apiFetch('/settings/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Save failed');
      setConfigMsg(language === 'es' ? 'Configuración guardada' : 'Configuration saved');
      setConfigStatus('saved');
      setEditingApiKey('');
    } catch (e) {
      setConfigMsg(language === 'es' ? 'Error al guardar' : 'Save failed');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestConnection = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await apiFetch('/settings/llm/test', { method: 'POST' });
      const data = await res.json();
      setTestResult(data);
    } catch (e) {
      setTestResult({ success: false, error: 'Connection test failed' });
    } finally {
      setTestLoading(false);
    }
  };

  const handleBrowseModels = async () => {
    if (!llmConfig) return;
    setBrowsingModels(true);
    setModelsLoading(true);
    setModelsList([]);
    try {
      const endpoint = llmConfig.provider === 'openai' ? '/settings/llm/openai/models' : '/settings/llm/ollama/models';
      const res = await apiFetch(endpoint);
      const data = await res.json();
      setModelsList(data.models || []);
    } catch (e) {
      console.error('Failed to fetch models:', e);
    } finally {
      setModelsLoading(false);
    }
  };

  const handleSelectModel = (modelName: string) => {
    if (!llmConfig) return;
    if (llmConfig.provider === 'openai') {
      setLlmConfig({ ...llmConfig, openaiModel: modelName });
    } else {
      setLlmConfig({ ...llmConfig, ollamaModel: modelName });
    }
    setBrowsingModels(false);
  };

  const toggleDebugLogging = async () => {
    const newValue = !debugLogging;
    setDebugLogging(newValue);
    try {
      await apiFetch('/settings/llm-debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newValue }),
      });
    } catch (e) {
      console.error('Failed to save debug setting:', e);
      setDebugLogging(!newValue);
    }
  };

  const handleReindex = async () => {
    if (!confirm(language === 'es' ? '¿Forzar reindexado de QA en ChromaDB?' : 'Force reindex QA entries to ChromaDB?')) return;
    setReindexing(true);
    setReindexMsg('');
    try {
        const res = await apiFetch('/qa/reindex', { method: 'POST' });
        const data = await res.json();
        setReindexMsg(language === 'es' ? `Reindexado: ${data.success} éxitos, ${data.failed} fallos` : `Reindexed: ${data.success} success, ${data.failed} failed`);
      } catch (e) {
        setReindexMsg(language === 'es' ? 'Error en reindexado' : 'Reindex failed');
      } finally {
        setReindexing(false);
      }
    };

    const handleReindexDocs = async () => {
      if (!confirm(language === 'es' ? '¿Forzar reindexado de documentos KB?' : 'Force reindex KB documents?')) return;
      setReindexDocsLoading(true);
      setReindexDocsMsg('');
      try {
        const res = await apiFetch('/kb/documents/reindex', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        });
        const data = await res.json();
        setReindexDocsMsg(language === 'es' ? `Documentos reindexados: ${data.success || 0} éxitos, ${data.failed || 0} fallos` : `Documents reindexed: ${data.success || 0} success, ${data.failed || 0} failed`);
      } catch (e) {
        setReindexDocsMsg(language === 'es' ? 'Error en reindexado de documentos' : 'Documents reindex failed');
      } finally {
        setReindexDocsLoading(false);
      }
    };

  return (
    <Layout>
      <div className="settings-page">
        <h1 className="settings-title">{t('settings') || 'Settings'}</h1>
        
        <div className="settings-section">
          <h2 className="settings-section-title">{t('language') || 'Language'}</h2>
          <div className="language-toggle">
            <span className={`lang-option ${language === 'es' ? 'active' : ''}`}>ES</span>
            <button 
              className="toggle-switch"
              onClick={toggleLanguage}
              aria-label="Toggle language"
            >
              <span className={`toggle-slider ${language === 'en' ? 'right' : 'left'}`}></span>
            </button>
            <span className={`lang-option ${language === 'en' ? 'active' : ''}`}>EN</span>
          </div>
          <p className="language-description">
            {language === 'es' 
              ? 'Cambia el idioma de la aplicación' 
              : 'Change the application language'}
          </p>
        </div>

        {/* LLM Configuration */}
        <div className="settings-section">
          <h2 className="settings-section-title">
            {language === 'es' ? 'Configuración LLM' : 'LLM Configuration'}
          </h2>
          {configStatus === 'env' && !llmConfigLoading && (
            <p className="env-notice">
              {language === 'es'
                ? 'Usando variables de entorno. Guarda la configuración para personalizar.'
                : 'Using environment variables. Save configuration to customize.'}
            </p>
          )}

          {llmConfigLoading ? (
            <p className="loading-text">{language === 'es' ? 'Cargando...' : 'Loading...'}</p>
          ) : llmConfig && (
            <div className="llm-config-form">
              <div className="form-group">
                <label>{language === 'es' ? 'Proveedor' : 'Provider'}</label>
                <select
                  value={llmConfig.provider}
                  onChange={(e) => handleProviderChange(e.target.value as 'ollama' | 'openai')}
                  className="form-select"
                >
                  <option value="ollama">Ollama</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>

              {llmConfig.provider === 'ollama' && (
                <>
                  <div className="form-group">
                    <label>{language === 'es' ? 'Host' : 'Host'}</label>
                    <input
                      type="text"
                      className="form-input"
                      value={llmConfig.ollamaHost}
                      onChange={(e) => setLlmConfig({ ...llmConfig, ollamaHost: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>{language === 'es' ? 'Puerto' : 'Port'}</label>
                    <input
                      type="number"
                      className="form-input"
                      value={llmConfig.ollamaPort}
                      onChange={(e) => setLlmConfig({ ...llmConfig, ollamaPort: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label>{language === 'es' ? 'Modelo' : 'Model'}</label>
                    <div className="model-select-row">
                      <input
                        type="text"
                        className="form-input model-input"
                        value={llmConfig.ollamaModel}
                        onChange={(e) => setLlmConfig({ ...llmConfig, ollamaModel: e.target.value })}
                      />
                      <button className="btn-secondary" onClick={handleBrowseModels}>
                        {language === 'es' ? 'Explorar' : 'Browse'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {llmConfig.provider === 'openai' && (
                <>
                  <div className="form-group">
                    <label>
                      API Key
                      <span className="api-key-indicator" title={llmConfig.openaiHasKey ? (language === 'es' ? 'Clave configurada' : 'Key configured') : (language === 'es' ? 'Sin clave' : 'No key')}>
                        {llmConfig.openaiHasKey ? ' ✅' : ' ❌'}
                      </span>
                    </label>
                    <div className="api-key-row">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        className="form-input"
                        value={editingApiKey}
                        onChange={(e) => setEditingApiKey(e.target.value)}
                        placeholder={llmConfig.openaiHasKey ? '••••••••' : (language === 'es' ? 'Ingresa tu API Key' : 'Enter your API Key')}
                      />
                      <button
                        className="btn-icon"
                        onClick={() => setShowApiKey(!showApiKey)}
                        title={showApiKey ? (language === 'es' ? 'Ocultar' : 'Hide') : (language === 'es' ? 'Mostrar' : 'Show')}
                      >
                        {showApiKey ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Base URL</label>
                    <input
                      type="text"
                      className="form-input"
                      value={llmConfig.openaiBaseUrl}
                      onChange={(e) => setLlmConfig({ ...llmConfig, openaiBaseUrl: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>{language === 'es' ? 'Modelo' : 'Model'}</label>
                    <div className="model-select-row">
                      <input
                        type="text"
                        className="form-input model-input"
                        value={llmConfig.openaiModel}
                        onChange={(e) => setLlmConfig({ ...llmConfig, openaiModel: e.target.value })}
                      />
                      <button className="btn-secondary" onClick={handleBrowseModels}>
                        {language === 'es' ? 'Explorar' : 'Browse'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="llm-actions">
                <button
                  className="btn-secondary"
                  onClick={handleTestConnection}
                  disabled={testLoading}
                >
                  {testLoading
                    ? (language === 'es' ? 'Probando...' : 'Testing...')
                    : (language === 'es' ? 'Probar Conexión' : 'Test Connection')}
                </button>
                <button
                  className="btn-primary"
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                >
                  {savingConfig
                    ? (language === 'es' ? 'Guardando...' : 'Saving...')
                    : (language === 'es' ? 'Guardar Configuración' : 'Save Configuration')}
                </button>
              </div>

              {testResult && (
                <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                  {testResult.success ? (
                    <p>
                      {language === 'es' ? 'Conexión exitosa' : 'Connection successful'} —{' '}
                      {language === 'es' ? 'Modelo' : 'Model'}: {testResult.model}
                      {testResult.embedding && ` | Embedding: ${testResult.embedding}`}
                      {testResult.chat && ` | Chat: ${testResult.chat}`}
                    </p>
                  ) : (
                    <p>{language === 'es' ? 'Error' : 'Error'}: {testResult.error || (language === 'es' ? 'Falló la conexión' : 'Connection failed')}</p>
                  )}
                </div>
              )}

              {configMsg && (
                <p className="config-msg">{configMsg}</p>
              )}
            </div>
          )}
        </div>

        {/* Model Browser Modal */}
        {browsingModels && (
          <div className="modal-overlay" onClick={() => setBrowsingModels(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>
                  {language === 'es' ? 'Modelos disponibles' : 'Available Models'}
                  {llmConfig?.provider === 'openai' ? ' (OpenAI)' : ' (Ollama)'}
                </h3>
                <button className="modal-close" onClick={() => setBrowsingModels(false)}>✕</button>
              </div>
              <div className="modal-body">
                {modelsLoading ? (
                  <p className="loading-text">{language === 'es' ? 'Cargando modelos...' : 'Loading models...'}</p>
                ) : modelsList.length === 0 ? (
                  <p className="empty-text">{language === 'es' ? 'No se encontraron modelos' : 'No models found'}</p>
                ) : (
                  <ul className="model-list">
                    {llmConfig?.provider === 'openai'
                      ? (modelsList as OpenAIModel[]).map((m) => (
                          <li key={m.id} className="model-item" onClick={() => handleSelectModel(m.id)}>
                            <span className="model-name">{m.id}</span>
                            <span className="model-meta">{m.ownedBy}</span>
                          </li>
                        ))
                      : (modelsList as OllamaModel[]).map((m) => (
                          <li key={m.name} className="model-item" onClick={() => handleSelectModel(m.name)}>
                            <span className="model-name">{m.name}</span>
                            <span className="model-meta">{formatSize(m.size)}</span>
                          </li>
                        ))
                    }
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="settings-section">
          <h2 className="settings-section-title">{language === 'es' ? 'Base de Conocimientos' : 'Knowledge Base'}</h2>
          <button
            className="settings-link"
            onClick={handleReindex}
            disabled={reindexing}
            style={{ border: 'none', cursor: reindexing ? 'not-allowed' : 'pointer', opacity: reindexing ? 0.6 : 1 }}
          >
            {reindexing 
              ? (language === 'es' ? 'Reindexando...' : 'Reindexing...') 
              : (language === 'es' ? 'Forzar Reindexado de QA' : 'Force QA Reindex')}
          </button>
          {reindexMsg && (
            <p className="reindex-msg">{reindexMsg}</p>
          )}
        </div>

        <div className="settings-section">
          <h2 className="settings-section-title">{language === 'es' ? 'Documentos KB' : 'KB Documents'}</h2>
          <button
            className="settings-link"
            onClick={handleReindexDocs}
            disabled={reindexDocsLoading}
            style={{ border: 'none', cursor: reindexDocsLoading ? 'not-allowed' : 'pointer', opacity: reindexDocsLoading ? 0.6 : 1 }}
          >
            {reindexDocsLoading 
              ? (language === 'es' ? 'Reindexando documentos...' : 'Reindexing documents...') 
              : (language === 'es' ? 'Forzar Reindexado de Documentos' : 'Force KB Documents Reindex')}
          </button>
          {reindexDocsMsg && (
            <p className="reindex-msg">{reindexDocsMsg}</p>
          )}
        </div>
        
        <div className="settings-section">
          <h2 className="settings-section-title">
            {language === 'es' ? 'Depuración LLM' : 'LLM Debug Logging'}
          </h2>
          <div className="language-toggle">
            <span className={`lang-option ${!debugLogging ? 'active' : ''}`}>
              {language === 'es' ? 'DESACTIVADO' : 'OFF'}
            </span>
            <button 
              className="toggle-switch"
              onClick={toggleDebugLogging}
              disabled={loading}
              aria-label="Toggle LLM debug logging"
            >
              <span className={`toggle-slider ${debugLogging ? 'right' : 'left'}`}></span>
            </button>
            <span className={`lang-option ${debugLogging ? 'active' : ''}`}>
              {language === 'es' ? 'ACTIVADO' : 'ON'}
            </span>
          </div>
          <p className="language-description">
            {language === 'es' 
              ? 'Muestra en consola lo que se envía al LLM' 
              : 'Log to console what is sent to the LLM'}
          </p>
        </div>

        <div className="settings-section">
          <h2 className="settings-section-title">AI Agents</h2>
          <Link 
            to="/agents-configurator" 
            className="btn-primary settings-link"
          >
            🤖 {language === 'es' ? 'Gestionar Agentes IA' : 'Manage AI Agents'}
          </Link>
          <p className="settings-description">
            {language === 'es' 
              ? 'Crear, editar y configurar agentes de IA para el chat' 
              : 'Create, edit and configure AI agents for chat'}
          </p>
        </div>

        <div className="settings-section">
          <h2>📊 {language === 'es' ? 'Gestión de Métricas' : 'Metrics Management'}</h2>
          <Link 
            to="/metrics-config" 
            className="btn-primary settings-link"
          >
            ⚙️ {language === 'es' ? 'Configurar Métricas' : 'Configure Metrics'}
          </Link>
          <p className="settings-description">
            {language === 'es' 
              ? 'Crear, editar y eliminar métricas del dashboard' 
              : 'Create, edit and delete dashboard metrics'}
          </p>
        </div>
      </div>
    </Layout>
  );
}

function formatSize(bytes: number): string {
  if (!bytes) return '';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}
