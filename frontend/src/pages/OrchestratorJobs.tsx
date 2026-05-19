import { useEffect, useState, useCallback, useRef } from 'react';
import { Layout } from '../components/Layout';
import { useApi, API_URL } from '../contexts/AuthContext';
import type { Client, Agent } from '../types';
import '../styles/App.css';

interface PipelineStep {
  stage: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface OutputRow {
  question: string;
  answer: string;
  domain?: string;
  confidence?: number;
  requiresLegalReview?: boolean;
  contradictionFlag?: boolean;
  evidenceCount?: number;
  notes?: string;
  timingMs?: number;
}

interface Job {
  id: string;
  name: string;
  pipeline: string;
  status: string;
  clientId: string;
  requestId?: string;
  agent?: string;
  inputQuestions: string[];
  outputRows: OutputRow[];
  totalQuestions: number;
  completedQuestions: number;
  progress: number;
  steps: PipelineStep[];
  errorMessage?: string;
  outputFile?: string;
  avgTimingMs?: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface ClientRequest {
  id: string;
  clientId: string;
  requestKey: string;
  requestType: string;
  status: string;
}

interface Toast {
  message: string;
  type: 'success' | 'error' | 'info';
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#6B7280',
  queued: '#3B82F6',
  running: '#10B981',
  paused: '#F59E0B',
  completed: '#10B981',
  failed: '#EF4444',
  cancelled: '#6B7280',
};

export function OrchestratorJobs() {
  const apiFetch = useApi();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [jobName, setJobName] = useState('');
  const [jobClientId, setJobClientId] = useState('');
  const [jobQuestions, setJobQuestions] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('InfoSec');
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestType, setRequestType] = useState('');
  const [requestOwner, setRequestOwner] = useState('');
  const [requestComments, setRequestComments] = useState('');
  const [requests, setRequests] = useState<ClientRequest[]>([]);

  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [notifEnabled, setNotifEnabled] = useState(() => 'Notification' in window && Notification.permission === 'granted');
  const prevStatusRef = useRef<Record<string, string>>({});

  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    if (perm === 'granted') setNotifEnabled(true);
  };

  const fetchJobs = useCallback(async () => {
    try {
      const response = await apiFetch('/orchestrator/jobs?limit=100');
      if (!response.ok) throw new Error('Failed to fetch jobs');
      const data = await response.json();
      setJobs(data.jobs || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  useEffect(() => {
    const current = Object.fromEntries(jobs.map(j => [j.id, j.status]));
    for (const job of jobs) {
      const prev = prevStatusRef.current[job.id];
      if (prev && prev !== job.status && (job.status === 'completed' || job.status === 'failed')) {
        const title = job.status === 'completed' ? 'Job Completed' : 'Job Failed';
        const body = `${job.name} - ${job.completedQuestions}/${job.totalQuestions} questions`;
        setToast({ message: `${title}: ${job.name}`, type: job.status === 'completed' ? 'success' : 'error' });
        if (notifEnabled && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body });
        }
      }
    }
    prevStatusRef.current = current;
  }, [jobs, notifEnabled]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    (async () => {
      const r = await apiFetch('/clients');
      if (r.ok) setClients(await r.json());
    })();
  }, [apiFetch]);

  useEffect(() => {
    (async () => {
      const r = await apiFetch('/agents');
      if (r.ok) {
        const agentList: Agent[] = await r.json();
        setAgents(agentList);
        if (agentList.length > 0) setSelectedAgent(agentList[0].name);
      }
    })();
  }, [apiFetch]);

  useEffect(() => {
    (async () => {
      const r = await apiFetch('/clients');
      if (!r.ok) return;
      const allClients: Client[] = await r.json();
      const allReqs: ClientRequest[] = [];
      for (const c of allClients) {
        const rr = await apiFetch(`/clients/${c.id}/requests`);
        if (rr.ok) allReqs.push(...(await rr.json()));
      }
      setRequests(allReqs);
    })();
  }, [apiFetch]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobClientId) return;
    if (inputMode === 'text' && !jobQuestions.trim()) return;
    if (inputMode === 'file' && !uploadFile) return;
    try {
      if (inputMode === 'file' && uploadFile) {
        const form = new FormData();
        form.append('file', uploadFile);
        const query = new URLSearchParams({ clientId: jobClientId, agent: selectedAgent });
        if (jobName) query.set('name', jobName);
        const response = await apiFetch(`/orchestrator/jobs/upload?${query}`, { method: 'POST', body: form });
        if (!response.ok) throw new Error(await response.text());
        setToast({ message: 'Job created from file', type: 'success' });
      } else {
        const questions = jobQuestions.split('\n').filter(q => q.trim());
        const response = await apiFetch('/orchestrator/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: jobName || `Answer Builder - ${new Date().toLocaleDateString()}`,
            clientId: jobClientId,
            agent: selectedAgent,
            inputQuestions: questions,
          }),
        });
        if (!response.ok) throw new Error(await response.text());
        setToast({ message: 'Job created successfully', type: 'success' });
      }
      setShowCreateForm(false);
      setJobName('');
      setJobQuestions('');
      setUploadFile(null);
      fetchJobs();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobClientId || !requestType) return;
    try {
      const response = await apiFetch('/orchestrator/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: jobClientId,
          requestType,
          owner: requestOwner,
          comments: requestComments,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const createdRequest = await response.json();
      setShowRequestForm(false);
      setRequestType('');
      setRequestOwner('');
      setRequestComments('');
      setToast({ message: `Client request created: ${createdRequest.requestKey}`, type: 'success' });
      const allReqs: ClientRequest[] = [];
      for (const c of clients) {
        const rr = await apiFetch(`/clients/${c.id}/requests`);
        if (rr.ok) allReqs.push(...(await rr.json()));
      }
      setRequests(allReqs);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePauseResume = async (job: Job) => {
    try {
      const endpoint = job.status === 'running' ? 'pause' : 'resume';
      const response = await apiFetch(`/orchestrator/jobs/${job.id}/${endpoint}`, { method: 'POST' });
      if (!response.ok) throw new Error(await response.text());
      fetchJobs();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      const response = await apiFetch(`/orchestrator/jobs/${jobId}/cancel`, { method: 'POST' });
      if (!response.ok) throw new Error(await response.text());
      fetchJobs();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!window.confirm('Delete this job?')) return;
    try {
      const response = await apiFetch(`/orchestrator/jobs/${jobId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await response.text());
      fetchJobs();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const formatMs = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const pageSize = 10;
  const totalPages = Math.ceil(jobs.length / pageSize);
  const displayedJobs = jobs.length > 10 ? jobs.slice((page - 1) * pageSize, page * pageSize) : jobs;

  if (loading) return (
    <Layout>
      <div className="analytics-loading">Loading jobs...</div>
    </Layout>
  );

  return (
    <Layout>
      <div className="analytics-page">
        {toast && (
          <div style={{
            position: 'fixed', top: 16, right: 16, zIndex: 1000,
            padding: '12px 20px', borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            color: 'white', fontSize: 14,
            display: 'flex', alignItems: 'center', gap: 10,
            backgroundColor: toast.type === 'success' ? '#10B981' : toast.type === 'error' ? '#EF4444' : '#3B82F6'
          }}>
            {toast.message}
            <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}>
              &times;
            </button>
          </div>
        )}

        <div className="analytics-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Orchestrator Jobs</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {'Notification' in window && (
              <button
                className={notifEnabled ? 'btn-submit' : 'btn-cancel'}
                onClick={handleEnableNotifications}
                title={notifEnabled ? 'Notifications enabled' : 'Enable notifications'}
                style={{ fontSize: 13, padding: '6px 10px', lineHeight: 1 }}
              >
                {notifEnabled ? '🔔' : '🔕'}
              </button>
            )}
            <button className="btn-submit" onClick={() => setShowCreateForm(!showCreateForm)}>
              {showCreateForm ? 'Cancel' : 'New Job'}
            </button>
          </div>
        </div>

        {error && (
          <div className="analytics-error" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', fontWeight: 'bold', cursor: 'pointer', color: 'inherit', fontSize: 18 }}>&times;</button>
          </div>
        )}

        {showCreateForm && (
          <div className="analytics-panel" style={{ marginBottom: 24 }}>
            <h2>Create New Job</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Job Name</label>
                <input
                  type="text"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  placeholder="Optional - defaults to today's date"
                />
              </div>
              <div className="form-group">
                <label>Client</label>
                <select value={jobClientId} onChange={(e) => setJobClientId(e.target.value)} required>
                  <option value="">Select client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Agent</label>
                <select className="analytics-window" value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}>
                  {agents.map((a) => (
                    <option key={a._id} value={a.name}>{a.displayName || a.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>
                  Client Request (optional)
                  <button
                    type="button"
                    onClick={() => setShowRequestForm(!showRequestForm)}
                    style={{ background: 'none', border: 'none', color: 'var(--secondary)', textDecoration: 'underline', cursor: 'pointer', fontSize: 12, marginLeft: 8 }}
                  >
                    {showRequestForm ? 'Close' : '+ New Request'}
                  </button>
                </label>
                {showRequestForm && (
                  <div style={{ background: 'var(--surface)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                    <div className="form-group">
                      <label style={{ fontSize: 12 }}>Request Type</label>
                      <select value={requestType} onChange={(e) => setRequestType(e.target.value)} required>
                        <option value="">Select type...</option>
                        <option value="Answer Builder">Answer Builder</option>
                        <option value="RFI/RFP">RFI/RFP</option>
                        <option value="Customer Agreement Review">Customer Agreement Review</option>
                        <option value="InfoSec Support">InfoSec Support</option>
                        <option value="Other Support">Other Support</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: 12 }}>Owner</label>
                      <input value={requestOwner} onChange={(e) => setRequestOwner(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: 12 }}>Comments</label>
                      <textarea rows={2} value={requestComments} onChange={(e) => setRequestComments(e.target.value)} />
                    </div>
                    <button type="button" className="btn-submit" style={{ fontSize: 13, padding: '8px 14px' }} onClick={handleCreateRequest}>
                      Create Request
                    </button>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span>Questions</span>
                  <span style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 6, padding: 2 }}>
                    <button
                      type="button"
                      className={inputMode === 'text' ? 'btn-submit' : 'btn-cancel'}
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => setInputMode('text')}
                    >
                      Paste text
                    </button>
                    <button
                      type="button"
                      className={inputMode === 'file' ? 'btn-submit' : 'btn-cancel'}
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => setInputMode('file')}
                    >
                      Upload file
                    </button>
                  </span>
                </label>
                {inputMode === 'text' ? (
                  <textarea
                    rows={8}
                    value={jobQuestions}
                    onChange={(e) => setJobQuestions(e.target.value)}
                    placeholder="Enter each question on a new line..."
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-300)', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
                    required={inputMode === 'text'}
                  />
                ) : (
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.docx,.txt"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    required={inputMode === 'file'}
                  />
                )}
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-submit" disabled={(inputMode === 'text' && !jobQuestions.trim()) || (inputMode === 'file' && !uploadFile)}>
                  Create Job
                </button>
              </div>
            </form>
          </div>
        )}

        <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--gray-500)' }}>
          Total: {total} jobs | Auto-refreshes every 5s
        </div>

        {jobs.length === 0 && <p style={{ color: 'var(--gray-500)' }}>No jobs yet.</p>}

        {displayedJobs.map((job) => {
          const isExpanded = expandedJob === job.id;
          return (
            <div key={job.id} className="analytics-panel" style={{ padding: 0, marginBottom: 12, overflow: 'hidden' }}>
              <div
                onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                style={{
                  padding: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', fontSize: 12, color: 'var(--gray-400)', flexShrink: 0 }}>
                  ▶
                </span>
                <div style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, backgroundColor: STATUS_COLORS[job.status] || '#6B7280' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, marginBottom: 2 }}>{job.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                    {job.status} | {job.completedQuestions}/{job.totalQuestions} questions | {job.progress}%
                    {job.avgTimingMs ? ` | Avg ${formatMs(job.avgTimingMs)}/q` : ''}
                    {job.agent ? ` | Agent: ${job.agent}` : ''}
                  </div>
                </div>
                <div style={{ width: 120, flexShrink: 0, marginRight: 8 }}>
                  <div style={{ background: 'var(--gray-200)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
                    <div style={{ height: 8, borderRadius: 999, transition: 'width 0.3s', width: `${Math.max(job.progress, 2)}%`, backgroundColor: job.status === 'failed' ? '#EF4444' : job.status === 'completed' ? '#10B981' : 'var(--secondary)' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {(job.status === 'running' || job.status === 'paused') && (
                    <button className="btn-cancel" style={{ fontSize: 12, padding: '4px 10px' }} onClick={(e) => { e.stopPropagation(); handlePauseResume(job); }}>
                      {job.status === 'running' ? 'Pause' : 'Resume'}
                    </button>
                  )}
                  {(job.status === 'running' || job.status === 'queued' || job.status === 'paused') && (
                    <button className="btn-delete" style={{ fontSize: 12, padding: '4px 10px' }} onClick={(e) => { e.stopPropagation(); handleCancel(job.id); }}>
                      Cancel
                    </button>
                  )}
                  <button className="btn-cancel" style={{ fontSize: 12, padding: '4px 10px' }} onClick={(e) => { e.stopPropagation(); handleDelete(job.id); }}>
                    Delete
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border)', padding: 16, background: 'var(--surface)' }}>
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--gray-700)' }}>Pipeline Steps</h4>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {(job.steps || []).map((step) => (
                        <div key={step.stage} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 10px', borderRadius: 6, background: 'white' }}>
                          <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{step.stage}</span>
                          <span style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                            color: step.status === 'completed' ? '#059669' : step.status === 'running' ? '#2563EB' : step.status === 'failed' ? '#DC2626' : '#6B7280',
                            backgroundColor: step.status === 'completed' ? '#D1FAE5' : step.status === 'running' ? '#DBEAFE' : step.status === 'failed' ? '#FEE2E2' : '#F3F4F6'
                          }}>
                            {step.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {job.errorMessage && (
                    <div className="analytics-error" style={{ marginBottom: 16, padding: 12, fontSize: 13 }}>
                      <strong>Error:</strong> {job.errorMessage}
                    </div>
                  )}

                  {job.outputFile && job.status === 'completed' && (
                    <div style={{ marginBottom: 16 }}>
                      <a href={`${API_URL}${job.outputFile}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--secondary)', fontSize: 13, fontWeight: 500 }}>
                        Download Output Excel File
                      </a>
                    </div>
                  )}

                  {job.outputRows.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--gray-700)' }}>Per-Question Timing</h4>
                      <div style={{ maxHeight: 160, overflowY: 'auto', background: 'white', borderRadius: 6, padding: '8px 12px' }}>
                        <table className="analytics-table" style={{ fontSize: 12 }}>
                          <thead>
                            <tr>
                              <th style={{ width: 32 }}>#</th>
                              <th>Question</th>
                              <th style={{ width: 80, textAlign: 'right' }}>Time</th>
                              {job.outputRows.some(r => r.confidence !== undefined) && <th style={{ width: 60, textAlign: 'right' }}>Conf.</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {job.outputRows.map((row, i) => (
                              <tr key={i}>
                                <td style={{ color: 'var(--gray-400)' }}>{i + 1}</td>
                                <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>{row.question}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{row.timingMs ? formatMs(row.timingMs) : '-'}</td>
                                {row.confidence !== undefined && <td style={{ textAlign: 'right' }}>{(row.confidence * 100).toFixed(0)}%</td>}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {job.outputRows.some(r => r.evidenceCount !== undefined || r.requiresLegalReview || r.contradictionFlag) && (
                    <div style={{ marginBottom: 16 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--gray-700)' }}>Metadata (RAG Source Evidence)</h4>
                      <div style={{ maxHeight: 120, overflowY: 'auto', background: 'white', borderRadius: 6, padding: '8px 12px' }}>
                        <table className="analytics-table" style={{ fontSize: 12 }}>
                          <thead>
                            <tr>
                              <th style={{ width: 32 }}>#</th>
                              <th>Question</th>
                              <th style={{ width: 80 }}>Sources</th>
                              <th style={{ width: 60 }}>Legal</th>
                              <th style={{ width: 80 }}>Contradiction</th>
                            </tr>
                          </thead>
                          <tbody>
                            {job.outputRows.map((row, i) => (
                              <tr key={i}>
                                <td style={{ color: 'var(--gray-400)' }}>{i + 1}</td>
                                <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>{row.question}</td>
                                <td>{row.evidenceCount !== undefined ? row.evidenceCount : '-'}</td>
                                <td>{row.requiresLegalReview ? <span style={{ color: '#D97706', fontWeight: 600 }}>Yes</span> : '-'}</td>
                                <td>{row.contradictionFlag ? <span style={{ color: '#DC2626', fontWeight: 600 }}>Yes</span> : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {job.inputQuestions.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--gray-700)' }}>Questions ({job.inputQuestions.length})</h4>
                      <div style={{ maxHeight: 180, overflowY: 'auto', background: 'white', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: 'var(--gray-600)' }}>
                        {job.inputQuestions.slice(0, 20).map((q, i) => (
                          <div key={i} style={{ padding: '2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i + 1}. {q}</div>
                        ))}
                        {job.inputQuestions.length > 20 && (
                          <div style={{ color: 'var(--gray-400)', padding: '4px 0' }}>...and {job.inputQuestions.length - 20} more</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {jobs.length > 10 && totalPages > 1 && (
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>
    </Layout>
  );
}
