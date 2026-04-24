import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { Layout } from '../components/Layout';
import heroImage from '../assets/images/board-confluence-hero.png';
import '../styles/App.css';

export function SmeManagerHome() {
  const { language } = useLanguage();

  const content = language === 'es'
    ? {
        title: 'InfoSec Agent',
        description: 'Consulta, valida y responde con contexto operativo y evidencia documental.',
        ctaPrimary: 'Abrir Chat',
        ctaSecondary: 'Knowledge Base',
      }
    : {
        title: 'InfoSec Agent',
        description: 'Query, validate and answer with operational context and documented evidence.',
        ctaPrimary: 'Open Chat',
        ctaSecondary: 'Knowledge Base',
      };

  return (
    <Layout>
      <div className="home-page">
        <section className="sme-hero-bg" aria-label="InfoSec hero background">
          <img src={heroImage} alt="" className="sme-hero-bg-image" />
          <div className="sme-hero-content-overlay">
            <h1 className="sme-hero-overlay-title">{content.title}</h1>
            <p className="sme-hero-overlay-description">{content.description}</p>
            <div className="sme-hero-overlay-actions">
              <Link to="/ask" className="sme-hero-overlay-btn sme-hero-overlay-btn-primary">
                {content.ctaPrimary}
              </Link>
              <Link to="/knowledge-base" className="sme-hero-overlay-btn sme-hero-overlay-btn-secondary">
                {content.ctaSecondary}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
