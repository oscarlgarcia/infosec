import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Layout } from '../components/Layout';
import type { AnswerRule, Agent } from '../types';

export function RulesManager() {
  const { language } = useLanguage();
  const apiFetch = useApi();
  const [rules, setRules] = useState<AnswerRule[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AnswerRule | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [rulesRes, agentsRes] = await Promise.all([
        apiFetch('/rules'),
        apiFetch('/agents')
      ]);
      
      if (!rulesRes.ok) throw new Error(`Error loading rules: ${rulesRes.status}`);
      if (!agentsRes.ok) throw new Error(`Error loading agents: ${agentsRes.status}`);
      
      const rulesData = await rulesRes.json();
      const agentsData = await agentsRes.json();
      
      setRules(rulesData);
      setAgents(agentsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateNew = () => {
    setEditingRule(null);
    setShowModal(true);
  };

  const handleEdit = (rule: AnswerRule) => {
    setEditingRule(rule);
    setShowModal(true);
  };

  const handleDelete = async (rule: AnswerRule) => {
    if (!confirm(language === 'es' ? '¿Estás seguro de eliminar esta regla?' : 'Are you sure you want to delete this rule?')) return;
    
    try {
      const res = await apiFetch(`/rules/${(rule as any)._id || rule._id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Error: ${res.status}`);
      await loadData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleSave = async (data: Partial<AnswerRule>) => {
    try {
      if (editingRule) {
        const res = await apiFetch(`/rules/${(editingRule as any)._id || editingRule._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(`Error: ${res.status}`);
      } else {
        const res = await apiFetch('/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(`Error: ${res.status}`);
      }
      setShowModal(false);
      setEditingRule(null);
      await loadData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const getAgentDisplayNames = (rule: AnswerRule): string => {
    if (!rule.appliesTo || rule.appliesTo.length === 0) {
      return language === 'es' ? 'Todos los agentes' : 'All Agents';
    }
    return rule.appliesTo
      .map(agentName => {
        const agent = agents.find(a => a.name === agentName);
        return agent ? (agent.displayName || agent.name) : agentName;
      })
      .join(', ');
  };

  return (
    <Layout>
      <div className="agents-configurator">
        <div className="page-header">
          <h1>{language === 'es' ? 'Gestión de Reglas' : 'Rules Management'}</h1>
          <Link to="/agents-configurator" className="back-link">
            ← {language === 'es' ? 'Volver a Agentes' : 'Back to Agents'}
          </Link>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="header-actions">
          <button className="agents-link" onClick={handleCreateNew} style={{ border: 'none', cursor: 'pointer' }}>
            + {language === 'es' ? 'Crear Regla' : 'Create Rule'}
          </button>
        </div>

        {loading ? (
          <div className="loading">{language === 'es' ? 'Cargando...' : 'Loading...'}</div>
        ) : (
          <table className="agents-table">
            <thead>
              <tr>
                <th>{language === 'es' ? 'Nombre' : 'Name'}</th>
                <th>{language === 'es' ? 'Dominio' : 'Domain'}</th>
                <th>{language === 'es' ? 'Aplica a' : 'Applies To'}</th>
                <th>{language === 'es' ? 'Estado' : 'Status'}</th>
                <th>{language === 'es' ? 'Acciones' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={(rule as any)._id || rule._id}>
                  <td>
                    <strong>{(rule as any).name || rule.name}</strong>
                  </td>
                  <td>{(rule as any).domain || rule.domain || '-'}</td>
                  <td style={{ fontSize: '13px' }}>
                    {getAgentDisplayNames(rule)}
                  </td>
                  <td>
                    {(rule as any).enabled ?? rule.enabled ? (
                      <span className="badge-system">{language === 'es' ? 'Habilitada' : 'Enabled'}</span>
                    ) : (
                      <span className="badge-inactive">{language === 'es' ? 'Deshabilitada' : 'Disabled'}</span>
                    )}
                  </td>
                  <td className="actions-cell">
                    <button 
                      className="btn-edit"
                      onClick={() => handleEdit(rule)}
                    >
                      {language === 'es' ? 'Editar' : 'Edit'}
                    </button>
                    <button 
                      className="btn-delete"
                      onClick={() => handleDelete(rule)}
                    >
                      {language === 'es' ? 'Eliminar' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <RuleModal
          rule={editingRule}
          agents={agents}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingRule(null); }}
        />
      )}
    </Layout>
  );
}
// Types for modal
interface RuleModalProps {
  rule: AnswerRule | null;
  agents: Agent[];
  onSave: (data: any) => void;
  onClose: () => void;
}

function RuleModal({ rule, agents, onSave, onClose }: RuleModalProps) {
  const { language } = useLanguage();
  const [name, setName] = useState((rule as any)?.name || '');
  const [content, setContent] = useState((rule as any)?.content || '');
  const [domain, setDomain] = useState((rule as any)?.domain || '');
  const [appliesTo, setAppliesTo] = useState<string[]>((rule as any)?.appliesTo || []);
  const [enabled, setEnabled] = useState((rule as any)?.enabled ?? true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !content.trim()) {
      setError(language === 'es' ? 'Nombre y Contenido son requeridos' : 'Name and Content are required');
      return;
    }

    onSave({
      name: name.trim(),
      content: content.trim(),
      domain: domain.trim(),
      appliesTo: appliesTo,
      enabled,
    });
  };

  const toggleAgent = (agentName: string) => {
    if (appliesTo.includes(agentName)) {
      setAppliesTo(appliesTo.filter(a => a !== agentName));
    } else {
      setAppliesTo([...appliesTo, agentName]);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{rule ? (language === 'es' ? 'Editar Regla' : 'Edit Rule') : (language === 'es' ? 'Crear Regla' : 'Create Rule')}</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{language === 'es' ? 'Nombre:' : 'Name:'}</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              disabled={!!rule}
              required 
            />
            {rule && <small className="text-muted">{language === 'es' ? 'El nombre no se puede cambiar' : 'Name cannot be changed'}</small>}
          </div>

          <div className="form-group">
            <label>{language === 'es' ? 'Contenido:' : 'Content:'}</label>
            <textarea 
              value={content} 
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              required 
            />
          </div>

          <div className="form-group">
            <label>{language === 'es' ? 'Dominio:' : 'Domain:'}</label>
            <input 
              type="text" 
              value={domain} 
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>{language === 'es' ? 'Aplica a (dejar vacío para todos):' : 'Applies To (leave empty for all):'}</label>
            <div style={{ 
              maxHeight: '200px', 
              overflowY: 'auto', 
              border: '1px solid var(--border)', 
              borderRadius: '6px', 
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              {agents.map(agent => (
                <label key={agent._id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}>
                  <input 
                    type="checkbox" 
                    checked={appliesTo.includes(agent.name)}
                    onChange={() => toggleAgent(agent.name)}
                  />
                  {agent.displayName || agent.name}
                  {agent.isSystem && <span className="badge-system" style={{ fontSize: '10px' }}>System</span>}
                </label>
              ))}
            </div>
            {appliesTo.length === 0 && (
              <small className="text-muted">
                {language === 'es' ? 'Se aplicará a todos los agentes' : 'Will apply to all agents'}
              </small>
            )}
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              {language === 'es' ? 'Habilitada' : 'Enabled'}
            </label>
          </div>

          <div className="modal-actions">
            <button type="submit" className="agents-link" style={{ border: 'none', cursor: 'pointer' }}>
              {rule ? (language === 'es' ? 'Actualizar' : 'Update') : (language === 'es' ? 'Crear' : 'Create')}
            </button>
            <button type="button" className="settings-link" onClick={onClose} style={{ border: 'none', cursor: 'pointer' }}>
              {language === 'es' ? 'Cancelar' : 'Cancel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
