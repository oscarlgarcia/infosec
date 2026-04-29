import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Layout } from '../components/Layout';
import { AgentModal } from '../components/AgentModal';
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
      alert(language === 'es' ? 'No se pueden editar los agentes del sistema' : 'Cannot edit system agents');
      return;
    }
    setEditingAgent(agent);
    setShowModal(true);
  };

  const handleDelete = async (agent: Agent) => {
    if (agent.isSystem) {
      alert(language === 'es' ? 'No se pueden eliminar los agentes del sistema' : 'Cannot delete system agents');
      return;
    }
    if (!confirm(language === 'es' ? '¿Estás seguro de eliminar este agente?' : 'Are you sure you want to delete this agent?')) return;
    
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
          <h1>{language === 'es' ? 'Gestión de Agentes IA' : 'AI Agents Management'}</h1>
          <Link to="/settings" className="back-link">← {language === 'es' ? 'Volver a Configuración' : 'Back to Settings'}</Link>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="header-actions">
          <button className="create-btn" onClick={handleCreateNew}>
            + {language === 'es' ? 'Crear Agente' : 'Create Agent'}
          </button>
        </div>

        {loading ? (
          <div className="loading">{language === 'es' ? 'Cargando...' : 'Loading...'}</div>
        ) : (
          <table className="agents-table">
            <thead>
              <tr>
                <th>{language === 'es' ? 'Nombre' : 'Name'}</th>
                <th>{language === 'es' ? 'Nombre Mostrado' : 'Display Name'}</th>
                <th>{language === 'es' ? 'Descripción' : 'Description'}</th>
                <th>{language === 'es' ? 'Tipo' : 'Type'}</th>
                <th>{language === 'es' ? 'Acciones' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => (
                <tr key={agent._id}>
                  <td>
                    <strong>{agent.name}</strong>
                    {agent.isSystem && <span className="badge-system">{language === 'es' ? 'Sistema' : 'System'}</span>}
                    {!agent.isActive && <span className="badge-inactive">{language === 'es' ? 'Inactivo' : 'Inactive'}</span>}
                  </td>
                  <td>{agent.displayName}</td>
                  <td>{agent.description || '-'}</td>
                  <td>
                    {agent.isSystem ? (language === 'es' ? 'Sistema' : 'System') : (language === 'es' ? 'Personalizado' : 'Custom')}
                  </td>
                  <td className="actions-cell">
                    {!agent.isSystem && (
                      <>
                        <button 
                          className="btn-edit"
                          onClick={() => handleEdit(agent)}
                        >
                          {language === 'es' ? 'Editar' : 'Edit'}
                        </button>
                        <button 
                          className="btn-delete"
                          onClick={() => handleDelete(agent)}
                        >
                          {language === 'es' ? 'Eliminar' : 'Delete'}
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
