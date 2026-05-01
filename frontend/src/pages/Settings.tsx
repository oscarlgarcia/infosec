import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Layout } from '../components/Layout';
import { useApi } from '../contexts/AuthContext';
import '../styles/App.css';
import { Link } from 'react-router-dom';

export function Settings() {
  const { language, setLanguage, t } = useLanguage();
  const apiFetch = useApi();
  const [reindexing, setReindexing] = useState(false);
  const [reindexMsg, setReindexMsg] = useState('');
  const [debugLogging, setDebugLogging] = useState(false);
  const [loading, setLoading] = useState(true);

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
  }, []);

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
      </div>
    </Layout>
  );
}
