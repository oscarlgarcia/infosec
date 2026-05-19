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
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    void fetchDocuments();
  }, []);

  const fetchDocuments = async (department?: string) => {
    setIsLoading(true);
    const url = department ? `/kb/documents?department=${encodeURIComponent(department)}` : '/kb/documents';
    const res = await apiFetch(url);
    if (res.ok) {
      const data = await res.json();
      setDocuments(data);
    }
    setIsLoading(false);
  };

  useEffect(() => { setPage(1); }, [documents]);

  const pageSize = 10;
  const totalPages = Math.ceil(documents.length / pageSize);
  const displayedDocs = documents.length > 15 ? documents.slice((page - 1) * pageSize, page * pageSize) : documents;

  const handleDelete = async (id: string) => {
    if (!window.confirm(language === 'es' ? '¿Eliminar documento?' : 'Delete document?')) {
      return;
    }
    const res = await apiFetch(`/kb/documents/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchDocuments(filter || undefined);
    }
  };

  return (
    <Layout>
      <div style={{ maxWidth: '1600px', margin: '0 auto', maxHeight: '1000px', overflowY: 'auto' }}>
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
          <table style={{ width: '1600px', tableLayout: 'fixed', borderCollapse: 'collapse', background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ width: '55%', padding: '12px 16px', textAlign: 'left', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '600' }}>{language === 'es' ? 'Nombre' : 'Name'}</th>
                <th style={{ width: '9%', padding: '12px 16px', textAlign: 'left', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '600' }}>{language === 'es' ? 'Departamento' : 'Department'}</th>
                <th style={{ width: '9%', padding: '12px 16px', textAlign: 'left', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '600' }}>{language === 'es' ? 'Fecha' : 'Date'}</th>
                <th style={{ width: '9%', padding: '12px 16px', textAlign: 'left', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '600' }}>{language === 'es' ? 'Última indexación' : 'Last indexed'}</th>
                <th style={{ width: '9%', padding: '12px 16px', textAlign: 'left', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '600' }}>{language === 'es' ? 'Tamaño' : 'Size'}</th>
                <th style={{ width: '9%', padding: '12px 16px', textAlign: 'left', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '600' }}>{language === 'es' ? 'Acción' : 'Action'}</th>
              </tr>
            </thead>
            <tbody>
              {displayedDocs.map((doc) => (
                  <tr key={doc.id}>
                    <td style={{ width: '55%', padding: '12px 16px' }}>
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
                    <td style={{ width: '9%', padding: '12px 16px' }}>{doc.department}</td>
                    <td style={{ width: '9%', padding: '12px 16px' }}>{new Date(doc.createdAt).toLocaleDateString()}</td>
                    <td style={{ width: '9%', padding: '12px 16px' }}>{doc.lastIndexedAt ? new Date(doc.lastIndexedAt).toLocaleDateString() : (language === 'es' ? 'No indexado' : 'Not indexed')}</td>
                    <td style={{ width: '9%', padding: '12px 16px' }}>{(doc.metadata?.size || 0) / (1024 * 1024) > 0.01 ? ((doc.metadata?.size || 0) / (1024 * 1024)).toFixed(2) + ' MB' : '< 0.01 MB'}</td>
                    <td style={{ width: '9%', padding: '12px 16px' }}>
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
        {documents.length > 15 && totalPages > 1 && (
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← {language === 'es' ? 'Anterior' : 'Prev'}</button>
            <span>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{language === 'es' ? 'Siguiente' : 'Next'} →</button>
          </div>
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