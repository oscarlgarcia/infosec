import { useState, useEffect } from 'react';
import { useApi } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import type { Task, TaskList } from '../types';

interface TaskModalProps {
  task: Task | null;  // null = create, Task = edit
  lists: TaskList[];
  onSave: () => void;
  onClose: () => void;
}

export function TaskModal({ task, lists, onSave, onClose }: TaskModalProps) {
  const { language } = useLanguage();
  const apiFetch = useApi();
  const [name, setName] = useState(task?.name || '');
  const [description, setDescription] = useState(task?.description || '');
  const [status, setStatus] = useState(task?.status || 'Not Started');
  const [dueDate, setDueDate] = useState(
    task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''
  );
  const [listId, setListId] = useState(
    task ? (task.listId as any)?._id || (task as any).listId || '' : (lists[0]?._id || '')
  );
  const [checklist, setChecklist] = useState<Array<{ text: string; completed: boolean }>>(
    (task?.checklist || []).map((item: any) => ({
      text: item.text,
      completed: item.completed,
    }))
  );
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [labelIds, setLabelIds] = useState<string[]>(
    (task?.labelIds || []).map((l: any) => l._id || l)
  );
  const [labels, setLabels] = useState<any[]>([]);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#6B7280');

  useEffect(() => {
    loadLabels();
  }, []);

  const loadLabels = async () => {
    try {
      const res = await apiFetch('/task-labels');
      const data = await res.json();
      setLabels(data);
    } catch (err: any) {
      console.error('Error loading labels:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const taskData: any = {
        name: name.trim(),
        description: description.trim(),
        status,
        dueDate: dueDate || undefined,
        listId,
        checklist: checklist.map((item, idx) => ({ ...item, order: idx })),
        labelIds,
      };

      if (task) {
        await apiFetch(`/tasks/${task._id || (task as any)._id || (task as any).id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData),
        });
      } else {
        await apiFetch('/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData),
        });
      }
      onSave();
    } catch (err: any) {
      alert(`${language === 'es' ? 'Error:' : 'Error:'} ${err.message}`);
    }
  };

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    setChecklist([...checklist, { text: newChecklistItem.trim(), completed: false }]);
    setNewChecklistItem('');
  };

  const toggleChecklistItem = (index: number) => {
    const updated = [...checklist];
    updated[index].completed = !updated[index].completed;
    setChecklist(updated);
  };

  const removeChecklistItem = (index: number) => {
    setChecklist(checklist.filter((_, idx) => idx !== index));
  };

  const toggleLabel = (labelId: string) => {
    if (labelIds.includes(labelId)) {
      setLabelIds(labelIds.filter(id => id !== labelId));
    } else {
      setLabelIds([...labelIds, labelId]);
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    try {
      await apiFetch('/task-labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newLabelName.trim(), color: newLabelColor }),
      });
      setNewLabelName('');
      await loadLabels();
    } catch (err: any) {
      alert(`${language === 'es' ? 'Error:' : 'Error:'} ${err.message}`);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
        <h2>{task ? (language === 'es' ? 'Editar Tarea' : 'Edit Task') : (language === 'es' ? 'Nueva Tarea' : 'New Task')}</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{language === 'es' ? 'Nombre' : 'Name'}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>{language === 'es' ? 'Descripción' : 'Description'}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{language === 'es' ? 'Estado' : 'Status'}</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
                <option value="Not Started">{language === 'es' ? 'Sin iniciar' : 'Not Started'}</option>
                <option value="In Progress">{language === 'es' ? 'En progreso' : 'In Progress'}</option>
                <option value="Completed">{language === 'es' ? 'Completado' : 'Completed'}</option>
              </select>
            </div>

            <div className="form-group">
              <label>{language === 'es' ? 'Lista' : 'List'}</label>
              <select value={listId} onChange={(e) => setListId(e.target.value)}>
                {lists.map((list: any) => (
                  <option key={list._id} value={list._id}>{list.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>{language === 'es' ? 'Fecha de vencimiento' : 'Due Date'}</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>{language === 'es' ? 'Etiquetas' : 'Labels'}</label>
            <div className="labels-selector">
              {labels.map((label: any) => (
                <span
                  key={label._id}
                  className={`task-label ${labelIds.includes(label._id) ? 'selected' : ''}`}
                  style={{ backgroundColor: label.color }}
                  onClick={() => toggleLabel(label._id)}
                >
                  {label.name}
                </span>
              ))}
            </div>
            <div className="new-label-form">
              <input
                type="text"
                placeholder={language === 'es' ? 'Nueva etiqueta...' : 'New label...'}
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
              />
              <input
                type="color"
                value={newLabelColor}
                onChange={(e) => setNewLabelColor(e.target.value)}
              />
              <button type="button" onClick={handleCreateLabel}>
                {language === 'es' ? 'Añadir' : 'Add'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>{language === 'es' ? 'Checklist' : 'Checklist'}</label>
            <div className="checklist-items">
              {checklist.map((item, idx) => (
                <div key={idx} className="checklist-item">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => toggleChecklistItem(idx)}
                  />
                  <span className={item.completed ? 'completed' : ''}>{item.text}</span>
                  <button type="button" className="btn-delete" onClick={() => removeChecklistItem(idx)}>🗑️</button>
                </div>
              ))}
            </div>
            <div className="new-checklist-form">
              <input
                type="text"
                placeholder={language === 'es' ? 'Nuevo item...' : 'New item...'}
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(); } }}
              />
              <button type="button" onClick={addChecklistItem}>
                {language === 'es' ? 'Añadir' : 'Add'}
              </button>
            </div>
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn-submit">
              {language === 'es' ? 'Guardar' : 'Save'}
            </button>
            <button type="button" className="btn-cancel" onClick={onClose}>
              {language === 'es' ? 'Cancelar' : 'Cancel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
