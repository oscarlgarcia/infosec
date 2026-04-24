import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import '../styles/App.css';

export function Home() {
  const { language, setLanguage } = useLanguage();

  const content = {
    eyebrow: language === 'es' ? 'Workspace de planificación y seguridad' : 'Security planning workspace',
    title: language === 'es'
      ? 'Coordina revisiones, conocimiento y respuestas de InfoSec desde un único entorno.'
      : 'Coordinate reviews, knowledge, and InfoSec responses from one workspace.',
    description: language === 'es'
      ? 'InfoSec Agent reúne gestión de clientes, contenido interno, chat operativo y una Knowledge Base separada para que los equipos respondan con más rigor y menos fricción.'
      : 'InfoSec Agent brings client management, internal content, operational chat, and a dedicated Knowledge Base together so teams can respond with more rigor and less friction.',
    primaryCta: language === 'es' ? 'Iniciar sesión' : 'Sign in',
    secondaryCta: language === 'es' ? 'Ir a Knowledge Base' : 'Open Knowledge Base',
    overviewLabel: language === 'es' ? 'Qué puedes hacer' : 'What you can do',
    accessLabel: language === 'es' ? 'Accesos directos' : 'Quick access',
    benefitOneTitle: language === 'es' ? 'Separa consulta y conversación' : 'Separate search from conversation',
    benefitOneText: language === 'es'
      ? 'Mantén el Chat como flujo conversacional y la Knowledge Base como espacio específico de búsqueda y lectura.'
      : 'Keep Chat as the conversational workflow and the Knowledge Base as the dedicated search and reading workspace.',
    benefitTwoTitle: language === 'es' ? 'Centraliza el contexto' : 'Centralize context',
    benefitTwoText: language === 'es'
      ? 'Reúne clientes, conversaciones, CMS, FAQs, Q&A y documentos en una arquitectura coherente.'
      : 'Bring clients, conversations, CMS, FAQs, Q&A, and documents into one coherent architecture.',
    benefitThreeTitle: language === 'es' ? 'Prepara la capa RAG' : 'Prepare the future RAG layer',
    benefitThreeText: language === 'es'
      ? 'Deja el producto listo para conectar más adelante un servidor MCP sin rehacer la interfaz principal.'
      : 'Keep the product ready to plug into a future MCP server without rebuilding the primary interface.',
    benefitFourTitle: language === 'es' ? 'Mejora la respuesta operativa' : 'Improve operational response',
    benefitFourText: language === 'es'
      ? 'Prioriza acceso rápido, trazabilidad de fuentes y continuidad del trabajo diario.'
      : 'Prioritize quick access, source traceability, and continuity for daily work.',
    loginCardTitle: language === 'es' ? 'Entrar al workspace' : 'Enter the workspace',
    loginCardText: language === 'es'
      ? 'Acceso a paneles por rol, conversaciones y operaciones del entorno.'
      : 'Access role-based dashboards, conversations, and workspace operations.',
    chatCardTitle: 'Chat',
    chatCardText: language === 'es'
      ? 'Mantén el flujo conversacional actual para clientes, conversaciones y seguimiento operativo.'
      : 'Keep the current conversational flow for clients, conversations, and operational follow-up.',
    kbCardTitle: 'Knowledge Base',
    kbCardText: language === 'es'
      ? 'Busca contenido de CMS, FAQs, Q&A y documentos en una experiencia separada de consulta.'
      : 'Search CMS content, FAQs, Q&A, and documents in a dedicated discovery experience.',
    metricOneLabel: language === 'es' ? 'Capacidades visibles' : 'Visible capabilities',
    metricTwoLabel: language === 'es' ? 'Fuentes iniciales' : 'Initial sources',
    metricThreeLabel: language === 'es' ? 'Próximo paso' : 'Next step',
    metricThreeValue: language === 'es' ? 'MCP / RAG' : 'MCP / RAG',
  };

  return (
    <div className="public-home">
      <header className="public-home-header">
        <Link to="/" className="public-home-logo">
          <span className="public-home-logo-box">IS</span>
          <span>InfoSec Agent</span>
        </Link>

        <div className="public-home-header-actions">
          <div className="public-home-language" role="group" aria-label={language === 'es' ? 'Selector de idioma' : 'Language selector'}>
            <button
              type="button"
              className={`public-home-lang-btn ${language === 'es' ? 'active' : ''}`}
              onClick={() => setLanguage('es')}
            >
              ES
            </button>
            <button
              type="button"
              className={`public-home-lang-btn ${language === 'en' ? 'active' : ''}`}
              onClick={() => setLanguage('en')}
            >
              EN
            </button>
          </div>

          <Link to="/login" className="public-home-login-link">
            {content.primaryCta}
          </Link>
        </div>
      </header>

      <main className="public-home-main">
        <section className="public-home-hero">
          <div className="public-home-hero-copy">
            <span className="public-home-eyebrow">{content.eyebrow}</span>
            <h1>{content.title}</h1>
            <p>{content.description}</p>

            <div className="public-home-cta-row">
              <Link to="/login" className="public-home-cta-primary">
                {content.primaryCta}
              </Link>
              <Link to="/knowledge-base" className="public-home-cta-secondary">
                {content.secondaryCta}
              </Link>
            </div>
          </div>

          <div className="public-home-hero-panel" aria-hidden="true">
            <div className="public-home-panel-frame">
              <div className="public-home-panel-bar"></div>
              <div className="public-home-panel-grid">
                <article className="public-home-panel-card">
                  <span>{content.metricOneLabel}</span>
                  <strong>3</strong>
                </article>
                <article className="public-home-panel-card">
                  <span>{content.metricTwoLabel}</span>
                  <strong>4</strong>
                </article>
                <article className="public-home-panel-card public-home-panel-card-wide">
                  <span>{content.metricThreeLabel}</span>
                  <strong>{content.metricThreeValue}</strong>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className="public-home-section">
          <div className="public-home-section-heading">
            <span>{content.overviewLabel}</span>
            <h2>{language === 'es' ? 'Una portada pensada para orientar la operación.' : 'A landing designed to orient the operation.'}</h2>
          </div>

          <div className="public-home-benefits">
            <article className="public-home-benefit-card">
              <h3>{content.benefitOneTitle}</h3>
              <p>{content.benefitOneText}</p>
            </article>
            <article className="public-home-benefit-card">
              <h3>{content.benefitTwoTitle}</h3>
              <p>{content.benefitTwoText}</p>
            </article>
            <article className="public-home-benefit-card">
              <h3>{content.benefitThreeTitle}</h3>
              <p>{content.benefitThreeText}</p>
            </article>
            <article className="public-home-benefit-card">
              <h3>{content.benefitFourTitle}</h3>
              <p>{content.benefitFourText}</p>
            </article>
          </div>
        </section>

        <section className="public-home-section">
          <div className="public-home-section-heading">
            <span>{content.accessLabel}</span>
            <h2>{language === 'es' ? 'Empieza desde el punto que necesitas.' : 'Start from the entry point you need.'}</h2>
          </div>

          <div className="public-home-access-grid">
            <Link to="/login" className="public-home-access-card">
              <div className="public-home-access-icon">01</div>
              <h3>{content.loginCardTitle}</h3>
              <p>{content.loginCardText}</p>
            </Link>

            <Link to="/chat" className="public-home-access-card">
              <div className="public-home-access-icon">02</div>
              <h3>{content.chatCardTitle}</h3>
              <p>{content.chatCardText}</p>
            </Link>

            <Link to="/knowledge-base" className="public-home-access-card">
              <div className="public-home-access-icon">03</div>
              <h3>{content.kbCardTitle}</h3>
              <p>{content.kbCardText}</p>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
