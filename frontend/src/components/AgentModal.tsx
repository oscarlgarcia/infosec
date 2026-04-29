import { useState, useEffect } from 'react';
import { useApi } from '../contexts/AuthContext';
import type { Agent, AnswerRule } from '../types';

interface AgentModalProps {
  agent: Agent | null;  // null = create, Agent = edit
  onSave: (data: any) => void;
  onClose: () => void;
}

export function AgentModal({ agent, onSave, onClose }: AgentModalProps) {
  const [name, setName] = useState(agent?.name || '');
  const [displayName, setDisplayName] = useState(agent?.displayName || '');
  const [description, setDescription] = useState(agent?.description || '');
  const [instructions, setInstructions] = useState(agent?.instructions || '');
  const [error, setError] = useState<string | null>(null);
  const [associatedRules, setAssociatedRules] = useState<AnswerRule[]>([]);
  const apiFetch = useApi();

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setDisplayName(agent.displayName);
      setDescription(agent.description || '');
      setInstructions(agent.instructions || '');
      
      // Fetch rules for this agent
      apiFetch(`/rules?agent=${agent.name}`)
        .then(res => res.json())
        .then(data => setAssociatedRules(data))
        .catch(err => console.error('Error loading rules:', err));
    }
  }, [agent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !displayName.trim() || !instructions.trim()) {
      setError('Name, Display Name, and Instructions are required');
      return;
    }

    onSave({
      name: name.trim(),
      displayName: displayName.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
    });
  };

  const placeholder = `You are a {{task}} specialist.

Query: {{query}}

Response format: (describe expected format)

Rules:
{{rules}}

Recovered passages:
{{passages}}

Metrics: {{metrics}}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{agent ? 'Edit Agent' : 'Create Agent'}</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name (unique identifier):</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              disabled={!!agent?.isSystem || !!agent}  // Disable for system agents or editing
              required 
            />
            {agent?.isSystem && <small className="text-muted">System agents cannot be renamed</small>}
          </div>

          <div className="form-group">
            <label>Display Name:</label>
            <input 
              type="text" 
              value={displayName} 
              onChange={(e) => setDisplayName(e.target.value)}
              required 
            />
          </div>

          <div className="form-group">
            <label>Description:</label>
            <textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="form-group">
            <label>Instructions (Markdown template):</label>
            <textarea 
              value={instructions} 
              onChange={(e) => setInstructions(e.target.value)}
              rows={15}
              placeholder={placeholder}
              required 
            />
            <small className="text-muted">
              Available placeholders: <code>{"{{query}}"}</code>, <code>{"{{sessionSummary}}"}</code>,
              <code>{"{{rules}}"}</code>, <code>{"{{passages}}"}</code>, <code>{"{{metrics}}"}</code>
            </small>
          </div>

          {associatedRules.length > 0 && (
            <div className="form-group">
              <label>{language === 'es' ? `Reglas asociadas (${associatedRules.length}):` : `Associated Rules (${associatedRules.length}):`}</label>
              <div style={{ 
                maxHeight: '150px', 
                overflowY: 'auto', 
                border: '1px solid var(--border)', 
                borderRadius: '6px', 
                padding: '8px' 
              }}>
                {associatedRules.map(rule => (
                  <div key={(rule as any)._id || rule._id} style={{ 
                    padding: '4px 8px', 
                    fontSize: '13px',
                    borderBottom: '1px solid var(--border)'
                  }}>
                    <strong>{(rule as any).name || rule.name}</strong>
                    {!((rule as any).enabled ?? rule.enabled) && <span style={{ color: 'var(--muted)', marginLeft: '8px' }}>({language === 'es' ? 'Deshabilitada' : 'Disabled'})</span>}
                  </div>
                ))}
              </div>
              <small className="text-muted">
                {language === 'es' ? 'Las reglas se gestionan en ' : 'Rules are managed in '}<Link to="/rules-manager">Rules Manager</Link>
              </small>
            </div>
          )}

          <div className="modal-actions">
            <button type="submit" className="agents-link" style={{ border: 'none', cursor: 'pointer' }}>
              {agent ? 'Update' : 'Create'}
            </button>
            <button type="button" className="settings-link" onClick={onClose} style={{ border: 'none', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
