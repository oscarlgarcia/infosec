import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Layout } from '../components/Layout';
import { useApi } from '../contexts/AuthContext';
import '../styles/App.css';

export function Settings() {
  const { language, setLanguage, t } = useLanguage();
  const apiFetch = useApi();
  const [reindexing, setReindexing] = useState(false);
  const [reindexMsg, setReindexMsg] = useState('');

  const toggleLanguage = () => {
    setLanguage(language === 'es' ? 'en' : 'es');
  };

  const handleReindex = async () => {
    if (!confirm(language === 'es' ? '¿Forzar reindexado de QA en ChromaDB?' : 'Force reindex QA entries to ChromaDB?')) return;
    setReindexing(true);
    setReindexMsg('');
    try {
      const res = await apiFetch('/qa/reindex', { method: 'POST' });
      const data = await res.json();
      setReindexMsg(language === 'es' ? `Reindexado: ${data.success} exitos, ${data.failed} fallos` : `Reindexed: ${data.success} success, ${data.failed} failed`);
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
            className="btn-primary"
            onClick={handleReindex}
            disabled={reindexing}
          >
            {reindexing 
              ? (language === 'es' ? 'Reindexando...' : 'Reindexing...') 
              : (language === 'es' ? 'Forzar Reindexado de QA' : 'Force QA Reindex')}
          </button>
          {reindexMsg && (
            <p className="reindex-msg">{reindexMsg}</p>
          )}
        </div>
      </div>
    </Layout>
  );
}
