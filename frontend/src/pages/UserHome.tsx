import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import '../styles/App.css';

export function UserHome() {
  const { language } = useLanguage();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <Layout>
      <div className="user-home">
        <div className="user-home-card">
          <div className="user-home-icon">👤</div>
          <h1>
            {language === 'es' ? 'Bienvenido' : 'Welcome'}, {user?.username}!
          </h1>
          <p className="user-home-message">
            {language === 'es'
              ? 'Tu cuenta tiene acceso básico. Pronto tendrás más funcionalidades.'
              : 'Your account has basic access. More features coming soon.'}
          </p>
          <div className="user-home-role">
            <span className="role-badge-small">
              {user?.role === 'usuario' ? (language === 'es' ? 'Usuario' : 'User') : user?.role}
            </span>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            {language === 'es' ? 'Cerrar Sesión' : 'Logout'}
          </button>
        </div>
      </div>
    </Layout>
  );
}
