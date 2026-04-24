import React, { useState, useRef, useEffect } from 'react';
import type { ClientRequest, RequestType } from '../types';
import { useI18n } from '../i18n/useI18n';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ViewRequestModalProps {
  request: ClientRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<ClientRequest>) => Promise<void>;
  onUpload?: (requestId: string, files: File[]) => Promise<void>;
  downloadUrl?: (filename: string) => string;
}

const REQUEST_TYPES: RequestType[] = [
  'RFI/RFP',
  'Customer Agreement Review',
  'Customer Agreements Execution',
  'InfoSec Support',
  '3rd Party PT',
  'BC/DR Test Result Request',
  'Cloud Customer PT Request',
  'Certification Request',
  'Other Support',
];

export function ViewRequestModal({ request, isOpen, onClose, onUpdate, onUpload, downloadUrl }: ViewRequestModalProps) {
  const { t } = useI18n();
  const [formData, setFormData] = useState<Partial<ClientRequest>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newFiles, setNewFiles] = useState<File[]>([]);

  useEffect(() => {
    if (request) {
      let deadlineValue = '';
      if (request.deadline) {
        const d = new Date(request.deadline);
        deadlineValue = d.toISOString().split('T')[0];
      }
      setFormData({
        requestType: request.requestType,
        sectionToReview: request.sectionToReview,
        deadline: deadlineValue,
        owner: request.owner,
        comments: request.comments,
        status: request.status,
      });
      setNewFiles([]);
    }
  }, [request]);

  const existingAttachments = request?.attachments || [];

  if (!isOpen || !request) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await onUpdate(request.id, formData);
      if (newFiles.length > 0 && onUpload) {
        await onUpload(request.id, newFiles);
      }
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error updating request';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setNewFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
    }
  };

  const removeNewFile = (index: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        
        <h2 className="modal-title">{t('viewRequest')}</h2>
        {error && (
          <div className="modal-error" role="alert">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t('requestKey')}</label>
            <input type="text" value={request.requestKey} disabled />
          </div>

          <div className="form-group">
            <label>{t('requestType')}</label>
            <select
              value={formData.requestType || ''}
              onChange={e => setFormData({ ...formData, requestType: e.target.value as any })}
              required
            >
              {REQUEST_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>{t('sectionToReview')}</label>
            <textarea
              value={formData.sectionToReview || ''}
              onChange={e => setFormData({ ...formData, sectionToReview: e.target.value })}
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>{t('deadline')}</label>
            <input
              type="date"
              value={formData.deadline || ''}
              onChange={e => setFormData({ ...formData, deadline: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>{t('owner')}</label>
            <input
              type="text"
              value={formData.owner || ''}
              onChange={e => setFormData({ ...formData, owner: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>{t('status')}</label>
            <select
              value={formData.status || 'open'}
              onChange={e => setFormData({ ...formData, status: e.target.value as any })}
            >
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="form-group">
            <label>{t('comments')}</label>
            <textarea
              value={formData.comments || ''}
              onChange={e => setFormData({ ...formData, comments: e.target.value })}
              rows={4}
            />
          </div>

          <div className="form-group">
            <label>{t('attachments')}</label>
            {existingAttachments.length > 0 && (
              <div className="file-list">
                {existingAttachments.map((att: any, index: number) => (
                  <div key={`existing-${index}`} className="file-item">
                    <a 
                      href={downloadUrl ? downloadUrl(att.path) : `${API_URL}${att.path}`}
                      download={att.originalName}
                      rel="noopener noreferrer"
                      style={{ color: '#007bff', textDecoration: 'underline' }}
                    >
                      {att.originalName}
                    </a>
                  </div>
                ))}
              </div>
            )}
            <div 
              className="file-drop-zone"
              onClick={() => fileInputRef.current?.click()}
            >
              <span>📎 {t('dragFiles')}</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>
            {newFiles.length > 0 && (
              <div className="file-list">
                {newFiles.map((file, index) => (
                  <div key={index} className="file-item">
                    <span>{file.name}</span>
                    <button type="button" onClick={() => removeNewFile(index)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={saving}>
              {t('cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('loading') + '...' : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
