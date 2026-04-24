import type { Client } from '../types';
import { useI18n } from '../i18n/useI18n';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ViewClientModalProps {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ViewClientModal({ client, isOpen, onClose }: ViewClientModalProps) {
  const { t, language } = useI18n();

  if (!isOpen || !client) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-large" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        
        <h2 className="modal-title">{t('clientDetails')}</h2>
        
        <div className="client-details-grid">
          <div className="detail-item">
            <label>{t('clientName')}</label>
            <div className="detail-value">{client.name}</div>
          </div>

          <div className="detail-item">
            <label>{t('clientType')}</label>
            <div className="detail-value">{client.clientType}</div>
          </div>

          {client.country && (
            <div className="detail-item">
              <label>{t('clientCountry')}</label>
              <div className="detail-value">{client.country}</div>
            </div>
          )}

          {client.contact && (
            <div className="detail-item">
              <label>{t('clientContact')}</label>
              <div className="detail-value">{client.contact}</div>
            </div>
          )}

          <div className="detail-item">
            <label>{t('createdAt')}</label>
            <div className="detail-value">{formatDate(client.createdAt)}</div>
          </div>

          <div className="detail-item">
            <label>{t('updatedAt')}</label>
            <div className="detail-value">{formatDate(client.updatedAt)}</div>
          </div>
        </div>

        <div className="detail-item full-width">
          <label>{t('attachments')}</label>
          {client.attachments && client.attachments.length > 0 ? (
            <div className="attachments-list">
              {client.attachments.map((attachment, idx) => (
                <a 
                  key={idx} 
                  href={`${API_URL}${attachment.path}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="attachment-link"
                >
                  📎 {attachment.originalName}
                </a>
              ))}
            </div>
          ) : (
            <div className="detail-value">{t('noAttachments')}</div>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}