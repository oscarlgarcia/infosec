import { useEffect, useState } from 'react';
import { useApi } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

interface SourceViewModalProps {
  source: {
    sourceType: string;
    itemId: string;
    title: string;
    score: number;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SourceViewModal({ source, isOpen, onClose }: SourceViewModalProps) {
  const apiFetch = useApi();
  const { language } = useLanguage();
  const [qaData, setQaData] = useState<{ question: string; answer: string } | null>(null);
  const [docData, setDocData] = useState<{ title: string; content?: string; url?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !source) return;
    setQaData(null);
    setDocData(null);
    setError(null);

    if (source.sourceType === 'qa' || source.sourceType === 'faq') {
      setLoading(true);
      apiFetch(`/qa/${source.itemId}`)
        .then(res => {
          if (!res.ok) throw new Error(language === 'es' ? 'No se pudo cargar la fuente' : 'Could not load source');
          return res.json();
        })
        .then(data => setQaData(data))
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    } else if (source.sourceType === 'document') {
      setLoading(true);
      apiFetch(`/api/knowledge-base/items/document/${source.itemId}`)
        .then(res => {
          if (!res.ok) throw new Error(language === 'es' ? 'No se pudo cargar el documento' : 'Could not load document');
          return res.json();
        })
        .then(data => {
          setDocData({
            title: data.title || source.title,
            content: data.content || data.snippet,
            url: data.url || data.openTarget,
          });
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [isOpen, source?.itemId, source?.sourceType]);

  if (!isOpen || !source) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-large" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <div className="modal-header">
          <h3>{language === 'es' ? 'Fuente completa' : 'Full source'}</h3>
        </div>
        <div className="modal-body">
          <p className="source-meta">
            <strong>{language === 'es' ? 'Tipo' : 'Type'}:</strong> {source.sourceType.toUpperCase()} &nbsp;
            <strong>{language === 'es' ? 'Relevancia' : 'Relevance'}:</strong> {Math.round(source.score * 100)}%
          </p>

          {loading && <div className="analytics-loading">{language === 'es' ? 'Cargando...' : 'Loading...'}</div>}
          {error && <div className="analytics-error">{error}</div>}

          {qaData && (
            <div className="source-qa-content">
              <div className="detail-item">
                <label>{language === 'es' ? 'Pregunta' : 'Question'}</label>
                <p>{qaData.question}</p>
              </div>
              <div className="detail-item">
                <label>{language === 'es' ? 'Respuesta' : 'Answer'}</label>
                <p style={{ whiteSpace: 'pre-wrap' }}>{qaData.answer}</p>
              </div>
            </div>
          )}

          {docData && (
            <div className="source-doc-content">
              <div className="detail-item">
                <label>{language === 'es' ? 'Título' : 'Title'}</label>
                <p>{docData.title}</p>
              </div>
              {docData.content && (
                <div className="detail-item">
                  <label>{language === 'es' ? 'Contenido' : 'Content'}</label>
                  <p style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>{docData.content}</p>
                </div>
              )}
              {docData.url && (
                <a href={docData.url} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: 'inline-block', marginTop: 12 }}>
                  {language === 'es' ? 'Abrir documento' : 'Open document'}
                </a>
              )}
            </div>
          )}

          {!loading && !error && !qaData && !docData && (
            <div className="detail-item">
              <label>{language === 'es' ? 'Título' : 'Title'}</label>
              <p>{source.title}</p>
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {language === 'es' ? 'Cerrar' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
