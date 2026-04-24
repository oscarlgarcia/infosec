import { useLanguage } from '../i18n/LanguageContext';
import { Layout } from '../components/Layout';
import '../styles/App.css';

export function Settings() {
  const { language, setLanguage, t } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'es' ? 'en' : 'es');
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
      </div>
    </Layout>
  );
}
