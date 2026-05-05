import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { Layout } from '../components/Layout';
import '../styles/App.css';

export function SmeHeroLanding() {
  const { language } = useLanguage();

  const menuItems = language === 'es'
    ? [
        { path: '/ask', icon: '💬', label: 'Chat Inteligente', desc: 'Consulta y responde con evidencia' },
        { path: '/knowledge-base', icon: '📚', label: 'Base de Conocimiento', desc: 'Explora todo el conocimiento' },
        { path: '/kb-documents', icon: '📄', label: 'Mis Documentos', desc: 'Gestiona tus documentos' },
        { path: '/kb-candidates', icon: '✅', label: 'Candidatos KB', desc: 'Revisa y valida contenido' },
      ]
    : [
        { path: '/ask', icon: '💬', label: 'Smart Chat', desc: 'Query and answer with evidence' },
        { path: '/knowledge-base', icon: '📚', label: 'Knowledge Base', desc: 'Explore all knowledge' },
        { path: '/kb-documents', icon: '📄', label: 'My Documents', desc: 'Manage your documents' },
        { path: '/kb-candidates', icon: '✅', label: 'KB Candidates', desc: 'Review and validate content' },
      ];

  return (
    <Layout>
      <div className="sme-simple-hero">
        {/* Header Badge */}
        <div className="sme-hero-header">
          <span className="sme-badge">{language === 'es' ? 'EXPERTO' : 'SME'}</span>
          <h1 className="sme-title">{language === 'es' ? 'Portal de Expertos' : 'SME Portal'}</h1>
          <p className="sme-subtitle">
            {language === 'es' ? 'Contribuye tu conocimiento al sistema' : 'Contribute your expertise to the system'}
          </p>
        </div>

        {/* Menu Grid */}
        <div className="sme-menu-grid">
          {menuItems.map((item, idx) => (
            <Link key={idx} to={item.path} className="sme-menu-card">
              <div className="sme-menu-icon">{item.icon}</div>
              <div className="sme-menu-content">
                <h3 className="sme-menu-label">{item.label}</h3>
                <p className="sme-menu-desc">{item.desc}</p>
              </div>
              <div className="sme-menu-arrow">→</div>
            </Link>
          ))}
        </div>

        {/* Info Section */}
        <section className="sme-info-section">
          <div className="sme-info-card">
            <h3>📊 {language === 'es' ? 'Tu Rol' : 'Your Role'}</h3>
            <p>
              {language === 'es' 
                ? 'Como experto en tu área, validas respuestas y aportas evidencia documental para mantener la base de conocimiento actualizada.'
                : 'As a subject matter expert, you validate answers and provide documented evidence to keep the knowledge base current.'}
            </p>
          </div>
          <div className="sme-info-card">
            <h3>🎯 {language === 'es' ? 'Objetivo' : 'Objective'}</h3>
            <p>
              {language === 'es'
                ? 'Asegurar que las respuestas del sistema tengan respaldo documental y validación humana experta.'
                : 'Ensure system answers have documented backing and expert human validation.'}
            </p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
