import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Layout } from '../components/Layout';
import { AgentModal } from '../components/AgentModal';
import type { Agent } from '../types';

export function AgentsConfigurator() {
  const { language } = useLanguage();
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
    // Allow editing InfoSec and Standard agents, but not other system agents
    if (agent.isSystem && agent.name !== 'InfoSec' && agent.name !== 'Standard') {
      alert(language === 'es' ? 'No se pueden editar este agente del sistema' : 'Cannot edit this system agent');
      return;
    }
    setEditingAgent(agent);
    setShowModal(true);
  };

  const handleDelete = async (agent: Agent) => {
    // Allow deleting Standard agent, but not other system agents except InfoSec
    if (agent.isSystem && agent.name !== 'Standard' && agent.name !== 'InfoSec') {
      alert(language === 'es' ? 'No se pueden eliminar este agente del sistema' : 'Cannot delete this system agent');
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

  const handleSave = async () => {
    setShowModal(false);
    setEditingAgent(null);
    await loadAgents();
  };

  return (
    <Layout>
      <div className="agents-configurator">
        <div className="page-header">
          <h1>{language === 'es' ? 'Gestión de Agentes IA' : 'AI Agents Management'}</h1>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Link to="/settings" className="back-link">
              ← {language === 'es' ? 'Volver a Configuración' : 'Back to Settings'}
            </Link>
            <Link to="/rules-manager" className="agents-link">
              📋 {language === 'es' ? 'Gestionar Reglas' : 'Manage Rules'}
            </Link>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="header-actions">
          <button className="agents-link" onClick={handleCreateNew} style={{ border: 'none', cursor: 'pointer' }}>
            + {language === 'es' ? 'Crear Agente' : 'Create Agent'}
          </button>
        </div>

        {loading ? (
          <div className="loading">{language === 'es' ? 'Cargando...' : 'Loading...'}</div>
        ) : (
          <div className="table-container">
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
                      {(agent.name === 'InfoSec' || agent.name === 'Standard' || !agent.isSystem) ? (
                        <>
                          <button 
                            className="btn-edit"
                            onClick={() => handleEdit(agent)}
                          >
                            {language === 'es' ? 'Editar' : 'Edit'}
                          </button>
                          {(agent.name === 'Standard' || !agent.isSystem) && (
                            <button 
                              className="btn-delete"
                              onClick={() => handleDelete(agent)}
                            >
                              {language === 'es' ? 'Eliminar' : 'Delete'}
                            </button>
                          )}
                          {agent.name === 'InfoSec' && (
                            <span className="text-muted" style={{marginLeft: '8px'}}>
                              {language === 'es' ? '(No eliminable)' : '(Not deletable)'}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
