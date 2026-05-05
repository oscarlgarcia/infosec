import { useState, useEffect } from 'react';
import { useApi } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Link } from 'react-router-dom';
import type { Agent, AnswerRule } from '../types';

interface AgentModalProps {
  agent: Agent | null;  // null = create, Agent = edit
  onSave: (data: any) => void;
  onClose: () => void;
}

export function AgentModal({ agent, onSave, onClose }: AgentModalProps) {
  const { language } = useLanguage();
  const [name, setName] = useState(agent?.name || '');
  const [displayName, setDisplayName] = useState(agent?.displayName || '');
  const [description, setDescription] = useState(agent?.description || '');
  const [instructions, setInstructions] = useState(agent?.instructions || '');
  const [error, setError] = useState<string | null>(null);
  const [associatedRules, setAssociatedRules] = useState<AnswerRule[]>([]);
  const [availableRules, setAvailableRules] = useState<any[]>([]);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [viewingRule, setViewingRule] = useState<any | null>(null);
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
        .then((data: any) => {
          setAssociatedRules(data);
          // Pre-select rules that are already assigned to this agent
          const ids = new Set(data.map((r: any) => String(r._id || r.id)));
          setSelectedRuleIds(ids as any);
        })
        .catch(err => console.error('Error loading rules:', err));
      
      // Fetch ALL available rules
      apiFetch('/rules')
        .then(res => res.json())
        .then((data: any) => setAvailableRules(data))
        .catch(err => console.error('Error loading available rules:', err));
    }
  }, [agent]);

  const toggleRuleAssignment = (ruleId: string) => {
    setSelectedRuleIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ruleId)) {
        newSet.delete(ruleId);
      } else {
        newSet.add(ruleId);
      }
      return newSet;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

      if (!name.trim() || !displayName.trim() || !instructions.trim()) {
        setError('Name, Display Name, and Instructions are required');
        return;
      }
      
      // Validate name format (no spaces, unique identifier)
      if (!/^[a-zA-Z0-9_-]+$/.test(name.trim())) {
        setError('Name must be alphanumeric (letters, numbers, hyphens, underscores only, no spaces)');
        return;
      }

    try {
      if (agent) {
        // Update agent
        await apiFetch(`/agents/${String(agent._id || (agent as any)._id || (agent as any).id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: displayName.trim(),
            description: description.trim(),
            instructions: instructions.trim(),
          }),
        });

        // Update appliesTo for EACH rule
        const allRules = [...availableRules];
        for (const rule of allRules) {
          const ruleId = (rule as any)._id || (rule as any).id || '';
          if (!ruleId) continue;
          
          const isSelected = selectedRuleIds.has(ruleId);
          const currentAppliesTo = (rule as any).appliesTo || [];
          const hasAgent = currentAppliesTo.includes(name.trim());
          
          if (isSelected && !hasAgent && ruleId) {
            // Assign to agent
            await apiFetch(`/rules/${ruleId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                appliesTo: [...currentAppliesTo, name.trim()]
              }),
            });
          } else if (!isSelected && hasAgent && ruleId) {
            // Unassign from agent
            await apiFetch(`/rules/${ruleId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                appliesTo: currentAppliesTo.filter((a: string) => a !== name.trim())
              }),
            });
          }
        }
      } else {
        // Create new agent
        await apiFetch('/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            displayName: displayName.trim(),
            description: description.trim(),
            instructions: instructions.trim(),
          }),
        });
      }
      
      onSave({});
    } catch (err: any) {
      setError(err.message || 'Error saving agent');
    }
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
                  <div key={(rule as any)._id || (rule as any).id} style={{
                    padding: '4px 8px', 
                    fontSize: '13px',
                    borderBottom: '1px solid var(--border)'
                  }}>
                    <strong>{(rule as any).name || (rule as any).name}</strong>
                    {!((rule as any).enabled ?? (rule as any).enabled) && <span style={{ color: 'var(--muted)', marginLeft: '8px' }}>({language === 'es' ? 'Deshabilitada' : 'Disabled'})</span>}
                  </div>
                ))}
              </div>
              <small className="text-muted">
                {language === 'es' ? 'Las reglas se gestionan en ' : 'Rules are managed in '}<Link to="/rules-manager">Rules Manager</Link>
              </small>
            </div>
          )}

          {/* NEW: Rules Explorer */}
          <div className="form-group rules-explorer">
            <label>
              {language === 'es' ? 'Explorador de Reglas' : 'Rules Explorer'}
              <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--muted)' }}>
                ({selectedRuleIds.size} {language === 'es' ? 'seleccionadas' : 'selected'})
              </span>
            </label>
            
            <div style={{
              maxHeight: '300px', 
              overflowY: 'auto', 
              border: '1px solid var(--border)', 
              borderRadius: '6px', 
              padding: '8px',
              backgroundColor: 'var(--bg-secondary)'
            }}>
              {availableRules.map(rule => {
                const ruleId = rule._id;
                const isSelected = selectedRuleIds.has(ruleId);
                const ruleName = (rule as any).name || '';
                const ruleContent = (rule as any).content || '';
                
                return (
                  <div 
                    key={ruleId} 
                    style={{
                      padding: '8px', 
                      borderBottom: '1px solid var(--border)',
                      backgroundColor: isSelected ? 'var(--primary-light)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onClick={() => toggleRuleAssignment(ruleId)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>
                        <a 
                          href="#" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setViewingRule(rule); 
                          }}
                          style={{ color: 'var(--primary)', textDecoration: 'none' }}
                        >
                          {ruleName}
                        </a>
                      </strong>
                      <input 
                        type="checkbox" 
                        checked={isSelected} 
                        onChange={() => toggleRuleAssignment(ruleId)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                    <small style={{ color: 'var(--muted)', display: 'block', marginTop: '4px' }}>
                      {!((rule as any).enabled) && <span style={{ color: 'var(--danger)' }}>({language === 'es' ? 'Deshabilitada' : 'Disabled'}) </span>}
                      <span>{(rule as any).domain || 'General'}</span>
                    </small>
                  </div>
                );
              })}
            </div>
            
            <small className="text-muted">
              {language === 'es' 
                ? 'Haz clic en una regla para asignarla/desasignarla. Haz clic en el nombre para ver su contenido.'
                : 'Click on a rule to assign/unassign it. Click the name to view its content.'}
            </small>
          </div>

          <div className="modal-actions">
            <button type="submit" className="agents-link" style={{ border: 'none', cursor: agent?.isSystem ? 'not-allowed' : 'pointer' }} disabled={!!agent?.isSystem}>
              {agent ? 'Update' : 'Create'}
            </button>
            <button type="button" className="settings-link" onClick={onClose} style={{ border: 'none', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* NEW: Rule Viewer Modal */}
      {viewingRule && (
        <div className="modal-overlay" onClick={() => setViewingRule(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3>{(viewingRule as any).name}</h3>
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              padding: '12px',
              borderRadius: '6px',
              whiteSpace: 'pre-wrap',
              maxHeight: '400px',
              overflowY: 'auto',
              fontSize: '14px',
              lineHeight: '1.6'
            }}>
              {(viewingRule as any).content}
            </div>
            <div className="modal-actions" style={{ marginTop: '12px' }}>
              <button onClick={() => setViewingRule(null)}>
                {language === 'es' ? 'Cerrar' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
