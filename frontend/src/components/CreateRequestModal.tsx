import React, { useState, useRef, useEffect } from 'react';
import type { RequestType, Client } from '../types';
import { useI18n } from '../i18n/useI18n';

const COUNTRIES = [
  { code: 'ES', name: 'España' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'GB', name: 'Reino Unido' },
  { code: 'FR', name: 'Francia' },
  { code: 'DE', name: 'Alemania' },
  { code: 'IT', name: 'Italia' },
  { code: 'PT', name: 'Portugal' },
  { code: 'NL', name: 'Países Bajos' },
  { code: 'BE', name: 'Bélgica' },
  { code: 'CH', name: 'Suiza' },
  { code: 'AT', name: 'Austria' },
  { code: 'IE', name: 'Irlanda' },
  { code: 'SE', name: 'Suecia' },
  { code: 'NO', name: 'Noruega' },
  { code: 'DK', name: 'Dinamarca' },
  { code: 'FI', name: 'Finlandia' },
  { code: 'PL', name: 'Polonia' },
  { code: 'CZ', name: 'República Checa' },
  { code: 'HU', name: 'Hungría' },
  { code: 'RO', name: 'Rumania' },
  { code: 'GR', name: 'Grecia' },
  { code: 'MX', name: 'México' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'BR', name: 'Brasil' },
  { code: 'PE', name: 'Perú' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'CA', name: 'Canadá' },
  { code: 'AU', name: 'Australia' },
  { code: 'JP', name: 'Japón' },
  { code: 'CN', name: 'China' },
  { code: 'IN', name: 'India' },
  { code: 'SG', name: 'Singapur' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'KR', name: 'Corea del Sur' },
  { code: 'AE', name: 'Emiratos Árabes Unidos' },
  { code: 'SA', name: 'Arabia Saudita' },
  { code: 'IL', name: 'Israel' },
  { code: 'ZA', name: 'Sudáfrica' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'EG', name: 'Egipto' },
  { code: 'MA', name: 'Marruecos' },
];

interface CreateRequestModalProps {
  clientId?: string;
  clients?: Client[];
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (clientId: string, data: {
    requestType: string;
    sectionToReview?: string;
    deadline?: string;
    owner?: string;
    comments?: string;
  }) => Promise<void>;
  onCreateClient?: (data: { name: string; clientType: string; country?: string; contact?: string }) => Promise<Client>;
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

const CLIENT_TYPES = ['Cloud', 'Rent', 'PS'] as const;

export function CreateRequestModal({ clientId, clients = [], isOpen, onClose, onSubmit, onCreateClient }: CreateRequestModalProps) {
  const { t } = useI18n();
  const [selectedClientId, setSelectedClientId] = useState<string>(clientId || '');
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [formData, setFormData] = useState({
    requestType: '' as RequestType | '',
    sectionToReview: '',
    deadline: '',
    owner: '',
    comments: '',
  });
  const [clientFormData, setClientFormData] = useState({
    name: '',
    clientType: 'Cloud' as 'Cloud' | 'Rent' | 'PS',
    country: '',
    contact: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    if (isOpen) {
      setSelectedClientId(clientId || '');
      setShowCreateClient(false);
      setFormData({
        requestType: '',
        sectionToReview: '',
        deadline: '',
        owner: '',
        comments: '',
      });
      setClientFormData({
        name: '',
        clientType: 'Cloud',
        country: '',
        contact: '',
      });
      setError(null);
    }
  }, [isOpen, clientId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      setError(t('selectClient'));
      return;
    }
    setSaving(true);
    setError(null);

    try {
      await onSubmit(selectedClientId, {
        requestType: formData.requestType,
        sectionToReview: formData.sectionToReview || undefined,
        deadline: formData.deadline || undefined,
        owner: formData.owner || undefined,
        comments: formData.comments || undefined,
      });

      setFormData({
        requestType: '',
        sectionToReview: '',
        deadline: '',
        owner: '',
        comments: '',
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error creating request';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateClient) return;
    setSaving(true);
    setError(null);

    try {
      const newClient = await onCreateClient({
        name: clientFormData.name,
        clientType: clientFormData.clientType,
        country: clientFormData.country || undefined,
        contact: clientFormData.contact || undefined,
      });
      setSelectedClientId(newClient.id);
      setShowCreateClient(false);
      setClientFormData({
        name: '',
        clientType: 'Cloud',
        country: '',
        contact: '',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error creating client';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  if (showCreateClient) {
    return (
      <div className="modal-overlay" onClick={() => setShowCreateClient(false)}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setShowCreateClient(false)}>×</button>
          
          <h2 className="modal-title">{t('createClient')}</h2>
          {error && (
            <div className="modal-error" role="alert">
              {error}
            </div>
          )}
          
          <form onSubmit={handleCreateClient}>
            <div className="form-group">
              <label>{t('clientName')}</label>
              <input
                type="text"
                value={clientFormData.name}
                onChange={e => setClientFormData({ ...clientFormData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>{t('clientType')}</label>
              <select
                value={clientFormData.clientType}
                onChange={e => setClientFormData({ ...clientFormData, clientType: e.target.value as any })}
              >
                {CLIENT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>{t('clientCountry')}</label>
              <select
                value={clientFormData.country}
                onChange={e => setClientFormData({ ...clientFormData, country: e.target.value })}
              >
                <option value="">--</option>
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>{t('clientContact')}</label>
              <input
                type="text"
                value={clientFormData.contact}
                onChange={e => setClientFormData({ ...clientFormData, contact: e.target.value })}
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setShowCreateClient(false)} disabled={saving}>
                {t('cancel')}
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? t('loading') + '...' : t('createClient')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        
        <h2 className="modal-title">{t('clientRequestTitle')}</h2>
        {error && (
          <div className="modal-error" role="alert">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          {(!clientId || clients.length > 0) && (
            <div className="form-group">
              <label>{t('selectClient')}</label>
              <select
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                required
              >
                <option value="">--</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              <button 
                type="button" 
                className="btn-link" 
                onClick={() => setShowCreateClient(true)}
                style={{ marginTop: 8, display: 'block' }}
              >
                + {t('createClient')}
              </button>
            </div>
          )}

          <div className="form-group">
            <label>{t('requestType')}</label>
            <select
              value={formData.requestType}
              onChange={e => setFormData({ ...formData, requestType: e.target.value as any })}
              required
            >
              <option value="">--</option>
              {REQUEST_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>{t('sectionToReview')}</label>
            <textarea
              value={formData.sectionToReview}
              onChange={e => setFormData({ ...formData, sectionToReview: e.target.value })}
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>{t('deadline')}</label>
            <input
              type="date"
              value={formData.deadline}
              onChange={e => setFormData({ ...formData, deadline: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>{t('owner')}</label>
            <input
              type="text"
              value={formData.owner}
              onChange={e => setFormData({ ...formData, owner: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>{t('attachments')}</label>
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
            {files.length > 0 && (
              <div className="file-list">
                {files.map((file, index) => (
                  <div key={index} className="file-item">
                    <span>{file.name}</span>
                    <button type="button" onClick={() => removeFile(index)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>{t('comments')}</label>
            <textarea
              value={formData.comments}
              onChange={e => setFormData({ ...formData, comments: e.target.value })}
              rows={4}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={saving}>
              {t('cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={saving || !selectedClientId}>
              {saving ? t('loading') + '...' : t('createRequest')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}