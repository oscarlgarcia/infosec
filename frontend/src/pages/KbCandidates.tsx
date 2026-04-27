import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useApi } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import type { KbCandidate } from '../types';
import '../styles/App.css';

const INFOSEC_DOMAINS = [
  'InfoSec Policy & Procedures',
  'Security Human Resource',
  'Asset management',
  'Access control',
  'Encryption',
  'Physical and Logical security',
  'ESG',
  'SDLC',
  'Relation with suppliers/third-party',
  'Incident Management',
  'Business Continuity',
  'Operational management',
  'Compliance',
  'Audit',
  'Information Security',
  'IT General Security',
  'IT Network Security',
  'IT Systems Security',
  'Risk Management',
  'Segregation of Duties',
  'Intellectual Property & Proprietary Rights',
];

export function KbCandidatesPage() {
  const apiFetch = useApi();
  const { language } = useLanguage();
  const [status, setStatus] = useState<string>('draft');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<KbCandidate[]>([]);
  const [notification, setNotification] = useState<string>('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ question: '', suggestedAnswer: '', domain: '' });

  useEffect(() => {
    void fetchCandidates();
  }, [status]);

  const fetchCandidates = async () => {
    setLoading(true);
    setError(null);
    try {
      const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
      const res = await apiFetch(`/kb/candidates${suffix}`);
      if (!res.ok) {
        throw new Error(language === 'es' ? 'No se pudieron cargar los candidatos' : 'Unable to load candidates');
      }
      setCandidates(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Candidates error');
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (id: string, action: 'approve' | 'reject') => {
    const res = await apiFetch(`/kb/candidates/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: action === 'approve' ? 'Approved and saved to Q&A' : 'Rejected' }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.message || data.error || 'Decision failed');
      return;
    }
    if (action === 'approve') {
      setNotification(language === 'es' ? 'Candidato aprobado y guardado en Q&A' : 'Candidate approved and saved to Q&A');
      setTimeout(() => setNotification(''), 3000);
    }
    await fetchCandidates();
  };

  const startEdit = (item: KbCandidate) => {
    setEditingId(item._id);
    setEditData({
      question: item.question,
      suggestedAnswer: item.suggestedAnswer,
      domain: item.domain || 'InfoSec Policy & Procedures',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({ question: '', suggestedAnswer: '', domain: '' });
  };

  const saveEdit = async (id: string) => {
    const res = await apiFetch(`/kb/candidates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Save failed');
      return;
    }
    setEditingId(null);
    await fetchCandidates();
  };

  return (
    <Layout>
      <div className="kb-candidates-page">
        {notification && (
          <div className="kb-notification">{notification}</div>
        )}
        <div className="kb-candidates-header">
          <h1>{language === 'es' ? 'Candidatos de Knowledge Base' : 'Knowledge Base Candidates'}</h1>
          <select
            className="analytics-window"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">{language === 'es' ? 'Todos' : 'All'}</option>
            <option value="draft">draft</option>
            <option value="in_review">in_review</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
          </select>
        </div>

        {loading && <div className="analytics-loading">{language === 'es' ? 'Cargando...' : 'Loading...'}</div>}
        {error && <div className="analytics-error">{error}</div>}

        {!loading && !error && (
          <table className="analytics-table">
            <thead>
              <tr>
                <th>{language === 'es' ? 'Dominio' : 'Domain'}</th>
                <th>{language === 'es' ? 'Pregunta' : 'Question'}</th>
                <th>{language === 'es' ? 'Respuesta sugerida' : 'Suggested answer'}</th>
                <th>{language === 'es' ? 'Estado' : 'Status'}</th>
                <th>{language === 'es' ? 'Acciones' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((item) => (
                <tr key={item._id}>
                  <td>
                    {editingId === item._id ? (
                      <select
                        value={editData.domain}
                        onChange={(e) => setEditData({ ...editData, domain: e.target.value })}
                        className="kb-edit-select"
                      >
                        {INFOSEC_DOMAINS.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    ) : (
                      item.domain || 'general'
                    )}
                  </td>
                  <td>
                    {editingId === item._id ? (
                      <textarea
                        value={editData.question}
                        onChange={(e) => setEditData({ ...editData, question: e.target.value })}
                        className="kb-edit-textarea"
                        rows={2}
                      />
                    ) : (
                      item.question
                    )}
                  </td>
                  <td>
                    {editingId === item._id ? (
                      <textarea
                        value={editData.suggestedAnswer}
                        onChange={(e) => setEditData({ ...editData, suggestedAnswer: e.target.value })}
                        className="kb-edit-textarea"
                        rows={4}
                      />
                    ) : (
                      <>
                        {item.suggestedAnswer.slice(0, 260)}
                        {item.suggestedAnswer.length > 260 ? '...' : ''}
                      </>
                    )}
                  </td>
                  <td>{item.status}</td>
                  <td>
                    {editingId === item._id ? (
                      <div className="kb-candidate-actions">
                        <button type="button" className="btn-primary" onClick={() => void saveEdit(item._id)}>
                          {language === 'es' ? 'Guardar' : 'Save'}
                        </button>
                        <button type="button" className="btn-secondary" onClick={cancelEdit}>
                          {language === 'es' ? 'Cancelar' : 'Cancel'}
                        </button>
                      </div>
                    ) : (
                      <div className="kb-candidate-actions">
                        {item.status === 'draft' || item.status === 'in_review' ? (
                          <>
                            <button type="button" className="btn-primary" onClick={() => void handleDecision(item._id, 'approve')}>
                              {language === 'es' ? 'Aprobar' : 'Approve'}
                            </button>
                            <button type="button" className="btn-secondary" onClick={() => void handleDecision(item._id, 'reject')}>
                              {language === 'es' ? 'Rechazar' : 'Reject'}
                            </button>
                          </>
                        ) : null}
                        <button type="button" className="btn-secondary" onClick={() => startEdit(item)}>
                          {language === 'es' ? 'Editar' : 'Edit'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
