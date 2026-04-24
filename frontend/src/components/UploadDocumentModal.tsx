import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { API_URL, useApi } from '../contexts/AuthContext';
import '../styles/App.css';

const DEPARTMENT_OPTIONS = ['Cloud', 'IT', 'Development', 'Compliance', 'Legal'] as const;

interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UploadDocumentModal({ isOpen, onClose }: UploadDocumentModalProps) {
  const { language } = useLanguage();
  const apiFetch = useApi();
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDepartment, setUploadDepartment] = useState<(typeof DEPARTMENT_OPTIONS)[number]>('Cloud');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUploadDocument = async () => {
    if (!uploadFile) return;

    setIsUploading(true);
    setError(null);
    setUploadSuccess(false);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const res = await apiFetch(`/knowledge-base/documents?department=${encodeURIComponent(uploadDepartment)}`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) throw new Error(`Error uploading document: ${res.status}`);
      setUploadFile(null);
      setUploadSuccess(true);
      setTimeout(() => {
        onClose();
        setUploadSuccess(false);
      }, 1500);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        setError(language === 'es' ? 'Tiempo de espera agotado' : 'Request timeout');
      } else {
        setError(err instanceof Error ? err.message : 'Upload error');
      }
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{language === 'es' ? 'Subir documento' : 'Upload document'}</h2>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="form-group">
            <label>{language === 'es' ? 'Departamento' : 'Department'}</label>
            <select
              value={uploadDepartment}
              onChange={(event) => setUploadDepartment(event.target.value as (typeof DEPARTMENT_OPTIONS)[number])}
            >
              {DEPARTMENT_OPTIONS.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>{language === 'es' ? 'Archivo' : 'File'}</label>
            <input
              type="file"
              onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          {uploadSuccess && (
            <div className="kb-success">
              {language === 'es' ? '✅ Documento subido' : '✅ Document uploaded'}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn-cancel"
            onClick={onClose}
            disabled={isUploading}
          >
            {language === 'es' ? 'Cancelar' : 'Cancel'}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleUploadDocument}
            disabled={!uploadFile || isUploading}
          >
            {isUploading ? (
              <span className="kb-loading">
                <span className="kb-spinner"></span>
                {language === 'es' ? 'Subiendo...' : 'Uploading...'}
              </span>
            ) : (language === 'es' ? 'Subir' : 'Upload')}
          </button>
        </div>
      </div>
    </div>
  );
}