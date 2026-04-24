import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useApi } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import type { KbCandidate } from '../types';
import '../styles/App.css';

export function KbCandidatesPage() {
  const apiFetch = useApi();
  const { language } = useLanguage();
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<KbCandidate[]>([]);

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
    const note = prompt(language === 'es' ? 'Nota de revision (opcional):' : 'Review note (optional):') || '';
    const res = await apiFetch(`/kb/candidates/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.message || data.error || 'Decision failed');
      return;
    }
    await fetchCandidates();
  };

  return (
    <Layout>
      <div className="kb-candidates-page">
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
                  <td>{item.domain || 'general'}</td>
                  <td>{item.question}</td>
                  <td>{item.suggestedAnswer.slice(0, 260)}{item.suggestedAnswer.length > 260 ? '...' : ''}</td>
                  <td>{item.status}</td>
                  <td>
                    {item.status === 'draft' || item.status === 'in_review' ? (
                      <div className="kb-candidate-actions">
                        <button type="button" className="btn-primary" onClick={() => void handleDecision(item._id, 'approve')}>
                          {language === 'es' ? 'Aprobar' : 'Approve'}
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => void handleDecision(item._id, 'reject')}>
                          {language === 'es' ? 'Rechazar' : 'Reject'}
                        </button>
                      </div>
                    ) : (
                      <span>-</span>
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

