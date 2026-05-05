import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { API_URL, useApi } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import { UploadDocumentModal } from '../components/UploadDocumentModal';
import '../styles/App.css';

const DEPARTMENT_OPTIONS = ['Cloud', 'IT', 'Development', 'Compliance', 'Legal'] as const;

interface KBDocument {
  id: string;
  originalName: string;
  department: string;
  createdAt: string;
  lastIndexedAt?: string;
  path?: string;
  metadata?: {
    size?: number;
  };
}

export function KBDocumentsPage() {
  const { language } = useLanguage();
  const apiFetch = useApi();
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    void fetchDocuments();
  }, []);

  const fetchDocuments = async (department?: string) => {
    setIsLoading(true);
    const url = department ? `/documents?department=${encodeURIComponent(department)}` : '/documents';
    const res = await apiFetch(url);
    if (res.ok) {
      const data = await res.json();
      setDocuments(data);
    }
    setIsLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(language === 'es' ? '¿Eliminar documento?' : 'Delete document?')) {
      return;
    }
    const res = await apiFetch(`/documents/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchDocuments(filter || undefined);
    }
  };

  return (
    <Layout>
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <span style={{ display: 'inline-flex', marginBottom: '14px', padding: '8px 12px', borderRadius: '999px', background: 'rgba(13, 58, 122, 0.08)', color: '#0d3a7a', fontSize: '12px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Knowledge Base</span>
            <h1 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>📄 {language === 'es' ? 'Documentos del Knowledge Base' : 'Knowledge Base Documents'}</h1>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link 
              to="/knowledge-base"
              className="btn-primary"
              style={{ background: '#64748b', textDecoration: 'none', padding: '10px 16px', borderRadius: '8px', color: 'white' }}
            >
              ← {language === 'es' ? 'Volver' : 'Back'}
            </Link>
            <Link 
              to="/kb-embeddings"
              className="btn-primary"
              style={{ background: '#8b5cf6', textDecoration: 'none', padding: '10px 16px', borderRadius: '8px', color: 'white' }}
            >
              🔍 {language === 'es' ? 'Ver Embeddings' : 'View Embeddings'}
            </Link>
            <button 
              type="button" 
              className="btn-primary"
              onClick={() => setShowUploadModal(true)}
            >
              + {language === 'es' ? 'Subir documento' : 'Upload document'}
            </button>
          </div>
        </div>

        <div className="kb-docs-filters">
          <label>{language === 'es' ? 'Departamento' : 'Department'}:</label>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              void fetchDocuments(e.target.value || undefined);
            }}
          >
            <option value="">{language === 'es' ? 'Todos' : 'All'}</option>
            {DEPARTMENT_OPTIONS.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="kb-loading">
            <span className="kb-spinner"></span>
            {language === 'es' ? 'Cargando...' : 'Loading...'}
          </div>
        ) : documents.length === 0 ? (
          <div className="kb-empty-state">
            {language === 'es' ? 'No hay documentos' : 'No documents'}
          </div>
        ) : (
          <table className="kb-docs-table">
            <thead>
              <tr>
                <th>{language === 'es' ? 'Nombre' : 'Name'}</th>
                <th>{language === 'es' ? 'Departamento' : 'Department'}</th>
                <th>{language === 'es' ? 'Fecha' : 'Date'}</th>
                <th>{language === 'es' ? 'Última indexación' : 'Last indexed'}</th>
                <th>{language === 'es' ? 'Tamaño' : 'Size'}</th>
                <th>{language === 'es' ? 'Acción' : 'Action'}</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    {doc.path ? (
                      <a 
                        href={`${API_URL}${doc.path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="kb-doc-link"
                      >
                        📄 {doc.originalName}
                      </a>
                    ) : (
                      <span>📄 {doc.originalName}</span>
                    )}
                  </td>
                  <td>{doc.department}</td>
                  <td>{new Date(doc.createdAt).toLocaleDateString()}</td>
                  <td>{doc.lastIndexedAt ? new Date(doc.lastIndexedAt).toLocaleDateString() : (language === 'es' ? 'No indexado' : 'Not indexed')}</td>
                  <td>{(doc.metadata?.size || 0) / (1024 * 1024) > 0.01 ? ((doc.metadata?.size || 0) / (1024 * 1024)).toFixed(2) + ' MB' : '< 0.01 MB'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-icon"
                      title={language === 'es' ? 'Eliminar' : 'Delete'}
                      onClick={() => handleDelete(doc.id)}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <UploadDocumentModal 
        isOpen={showUploadModal} 
        onClose={() => {
          setShowUploadModal(false);
          void fetchDocuments(filter || undefined);
        }} 
      />
    </Layout>
  );
}

export const KBDocuments = KBDocumentsPage;