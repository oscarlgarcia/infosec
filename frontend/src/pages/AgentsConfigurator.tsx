import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Layout } from '../components/Layout';
import type { Agent } from '../types';

export function AgentsConfigurator() {
  const { language, t } = useLanguage();
  const apiFetch = useApi();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch('/agents');
      if (!res.ok) throw new Error(`Error: ${res.status}`);
      const data = await res.json();
      setAgents(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load agents');
      console.error('Error loading agents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleCreateNew = () => {
    setEditingAgent(null);
    setShowModal(true);
  };

  const handleEdit = (agent: Agent) => {
    if (agent.isSystem) {
      alert(t('Cannot edit system agents'));
      return;
    }
    setEditingAgent(agent);
    setShowModal(true);
  };

  const handleDelete = async (agent: Agent) => {
    if (agent.isSystem) {
      alert(t('Cannot delete system agents'));
      return;
    }
    if (!confirm(t('Are you sure you want to delete this agent?'))) return;
    
    try {
      const res = await apiFetch(`/agents/${agent._id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Error: ${res.status}`);
      await loadAgents();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleSave = async (data: Partial<Agent>) => {
    try {
      if (editingAgent) {
        const res = await apiFetch(`/agents/${editingAgent._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(`Error: ${res.status}`);
      } else {
        const res = await apiFetch('/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(`Error: ${res.status}`);
      }
      setShowModal(false);
      setEditingAgent(null);
      await loadAgents();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <Layout>
      <div className="agents-configurator">
        <div className="page-header">
          <h1>{t('AI Agents Management') || 'AI Agents Management'}</h1>
          <Link to="/settings" className="back-link">← {t('Back to Settings') || 'Back to Settings'}</Link>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="header-actions">
          <button className="create-btn" onClick={handleCreateNew}>
            + {t('Create Agent') || 'Create Agent'}
          </button>
        </div>

        {loading ? (
          <div className="loading">{t('Loading...') || 'Loading...'}</div>
        ) : (
          <table className="agents-table">
            <thead>
              <tr>
                <th>{t('Name') || 'Name'}</th>
                <th>{t('Display Name') || 'Display Name'}</th>
                <th>{t('Description') || 'Description'}</th>
                <th>{t('Type') || 'Type'}</th>
                <th>{t('Actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => (
                <tr key={agent._id}>
                  <td>
                    <strong>{agent.name}</strong>
                    {agent.isSystem && <span className="badge-system">{t('System') || 'System'}</span>}
                    {!agent.isActive && <span className="badge-inactive">{t('Inactive') || 'Inactive'}</span>}
                  </td>
                  <td>{agent.displayName}</td>
                  <td>{agent.description || '-'}</td>
                  <td>
                    {agent.isSystem ? (t('System') || 'System') : (t('Custom') || 'Custom')}
                  </td>
                  <td className="actions-cell">
                    {!agent.isSystem && (
                      <>
                        <button 
                          className="btn-edit"
                          onClick={() => handleEdit(agent)}
                        >
                          {t('Edit') || 'Edit'}
                        </button>
                        <button 
                          className="btn-delete"
                          onClick={() => handleDelete(agent)}
                        >
                          {t('Delete') || 'Delete'}
                        </button>
                      </>
                    )}
                    {agent.isSystem && <span className="text-muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <AgentModal
          agent={editingAgent}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingAgent(null); }}
        />
      )}
    </Layout>
  );
}
