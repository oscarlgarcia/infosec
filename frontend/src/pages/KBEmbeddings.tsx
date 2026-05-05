import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useApi } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import '../styles/App.css';

const DEPARTMENT_OPTIONS = ['Cloud', 'IT', 'Development', 'Compliance', 'Legal'] as const;

interface DocumentWithEmbedding {
  id: string;
  originalName: string;
  department: string;
  embedding: number[] | null;
  embeddingStatus?: 'pending' | 'generated' | 'failed';
  embeddingError?: string | null;
  createdAt: string;
}

export function KBEmbeddingsPage() {
  const { language } = useLanguage();
  const apiFetch = useApi();
  const [documents, setDocuments] = useState<DocumentWithEmbedding[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentWithEmbedding | null>(null);

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

  return (
    <Layout>
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <span style={{ display: 'inline-flex', marginBottom: '14px', padding: '8px 12px', borderRadius: '999px', background: 'rgba(13, 58, 122, 0.08)', color: '#0d3a7a', fontSize: '12px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Knowledge Base</span>
            <h1 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>🔍 {language === 'es' ? 'Embeddings Generados' : 'Generated Embeddings'}</h1>
          </div>
          <Link to="/kb-documents" className="btn-primary">
            ← {language === 'es' ? 'Volver a Documentos' : 'Back to Documents'}
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <label>{language === 'es' ? 'Departamento' : 'Department'}:</label>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              void fetchDocuments(e.target.value || undefined);
            }}
            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }}
          >
            <option value="">{language === 'es' ? 'Todos' : 'All'}</option>
            {DEPARTMENT_OPTIONS.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
            {language === 'es' ? 'Cargando...' : 'Loading...'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '600' }}>
                  {language === 'es' ? 'Nombre' : 'Name'}
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '600' }}>
                  {language === 'es' ? 'Departamento' : 'Department'}
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '600' }}>
                  Embedding
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '600' }}>
                  {language === 'es' ? 'Estado' : 'Status'}
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '600' }}>
                  {language === 'es' ? 'Fecha' : 'Date'}
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    {language === 'es' ? 'No hay documentos' : 'No documents'}
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px 16px' }}>{doc.originalName}</td>
                    <td style={{ padding: '12px 16px' }}>{doc.department}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {doc.embedding && doc.embedding.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setSelectedDoc(doc)}
                          style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                        >
                          {language === 'es' ? 'Ver Embedding' : 'View Embedding'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedDoc(doc)}
                          style={{ padding: '6px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                        >
                          ⚠️ {language === 'es' ? 'Ver Error' : 'View Error'}
                        </button>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: doc.embeddingStatus === 'generated' ? '#16a34a' : doc.embeddingStatus === 'failed' ? '#dc2626' : '#ca8a04' }}>
                      {doc.embeddingStatus === 'generated' ? '✅ Generado' : doc.embeddingStatus === 'failed' ? '❌ Error' : '⏳ Pendiente'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>{new Date(doc.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {selectedDoc && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '800px',
              maxHeight: '80vh',
              overflow: 'auto',
              margin: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ margin: 0 }}>{selectedDoc.originalName}</h2>
                <button
                  type="button"
                  onClick={() => setSelectedDoc(null)}
                  style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}
                >
                  ×
                </button>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <strong>{language === 'es' ? 'Estado' : 'Status'}:</strong>{' '}
                <span style={{ color: selectedDoc.embeddingStatus === 'generated' ? '#16a34a' : '#dc2626' }}>
                  {selectedDoc.embeddingStatus === 'generated' ? '✅ Generado' : '❌ Error'}
                </span>
              </div>
              {selectedDoc.embeddingError && (
                <div style={{ marginBottom: '16px', padding: '12px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <strong>{language === 'es' ? 'Error' : 'Error'}:</strong>
                  <p style={{ margin: '4px 0 0', color: '#dc2626', fontSize: '13px' }}>{selectedDoc.embeddingError}</p>
                </div>
              )}
              {selectedDoc.embedding && selectedDoc.embedding.length > 0 && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <strong>{language === 'es' ? 'Dimensión' : 'Dimension'}:</strong> {selectedDoc.embedding.length}
                  </div>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', overflow: 'auto', maxHeight: '400px' }}>
                    <code style={{ fontSize: '11px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {JSON.stringify(selectedDoc.embedding, null, 2)}
                    </code>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export const KBEmbeddings = KBEmbeddingsPage;