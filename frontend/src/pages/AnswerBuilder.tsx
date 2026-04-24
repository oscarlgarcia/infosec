import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useApi } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import '../styles/App.css';

type AnswerBuilderJob = {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  outputRows?: Array<{
    question: string;
    answer: string;
    confidence: number;
    notes: string;
  }>;
  errorMessage?: string;
};

export function AnswerBuilderPage() {
  const apiFetch = useApi();
  const { language } = useLanguage();
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [domain, setDomain] = useState('infosec');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<AnswerBuilderJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadClients();
  }, []);

  useEffect(() => {
    if (!job?.jobId || job.status === 'completed' || job.status === 'failed') return;
    const timer = setInterval(() => {
      void pollJob(job.jobId);
    }, 2500);
    return () => clearInterval(timer);
  }, [job?.jobId, job?.status]);

  const loadClients = async () => {
    const response = await apiFetch('/clients');
    if (!response.ok) return;
    const data = await response.json();
    setClients(data);
    if (data.length > 0) setSelectedClientId(data[0].id);
  };

  const pollJob = async (jobId: string) => {
    const response = await apiFetch(`/answer-builder/jobs/${jobId}`);
    if (!response.ok) return;
    setJob(await response.json());
  };

  const submit = async () => {
    if (!selectedClientId || !file) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await apiFetch(`/answer-builder/upload?clientId=${selectedClientId}&domain=${encodeURIComponent(domain)}`, {
        method: 'POST',
        body: form,
      });
      if (!response.ok) throw new Error(language === 'es' ? 'Error creando job' : 'Unable to create job');
      setJob(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'answer-builder error');
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = async () => {
    if (!job?.jobId) return;
    const response = await apiFetch(`/answer-builder/jobs/${job.jobId}/export.csv`);
    if (!response.ok) {
      setError(language === 'es' ? 'No se pudo descargar el CSV' : 'Unable to download CSV');
      return;
    }
    const text = await response.text();
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `answer-builder-${job.jobId}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="analytics-page">
        <div className="analytics-header">
          <h1>{language === 'es' ? 'Answer Builder (Batch)' : 'Answer Builder (Batch)'}</h1>
        </div>

        <section className="analytics-panel">
          <div className="analytics-grid">
            <div>
              <label>{language === 'es' ? 'Cliente' : 'Client'}</label>
              <select className="analytics-window" value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>{language === 'es' ? 'Dominio' : 'Domain'}</label>
              <input className="search-input" value={domain} onChange={(event) => setDomain(event.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
            <input
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              accept=".csv,.xlsx,.xls,.docx,.txt"
            />
            <button className="btn-primary" onClick={submit} disabled={loading || !file || !selectedClientId}>
              {loading ? (language === 'es' ? 'Procesando...' : 'Processing...') : (language === 'es' ? 'Lanzar job' : 'Run job')}
            </button>
          </div>
          {error && <div className="analytics-error" style={{ marginTop: 12 }}>{error}</div>}
        </section>

        {job && (
          <section className="analytics-panel">
            <h2>{language === 'es' ? 'Estado del job' : 'Job status'}</h2>
            <table className="analytics-table">
              <tbody>
                <tr><td>Job ID</td><td>{job.jobId}</td></tr>
                <tr><td>Status</td><td>{job.status}</td></tr>
                {job.errorMessage && <tr><td>Error</td><td>{job.errorMessage}</td></tr>}
              </tbody>
            </table>
            {job.status === 'completed' && (
              <div style={{ marginTop: 12 }}>
                <button className="btn-secondary" onClick={downloadCsv}>
                  {language === 'es' ? 'Descargar CSV' : 'Download CSV'}
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </Layout>
  );
}
