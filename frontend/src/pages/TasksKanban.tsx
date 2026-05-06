import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Layout } from '../components/Layout';
import { TaskCard } from '../components/TaskCard';
import { TaskModal } from '../components/TaskModal';
import type { Task, TaskList } from '../types';

export function TasksKanban() {
  const { language } = useLanguage();
  const apiFetch = useApi();
  const [lists, setLists] = useState<TaskList[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListName, setEditingListName] = useState('');
  const [newListName, setNewListName] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [listsRes, tasksRes] = await Promise.all([
        apiFetch('/task-lists'),
        apiFetch('/tasks'),
      ]);
      const listsData = await listsRes.json();
      const tasksData = await tasksRes.json();
      setLists(listsData);
      setTasks(tasksData);
    } catch (err: any) {
      alert(`${language === 'es' ? 'Error:' : 'Error:'} ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, language]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    try {
      await apiFetch('/task-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newListName.trim() }),
      });
      setNewListName('');
      await loadData();
    } catch (err: any) {
      alert(`${language === 'es' ? 'Error:' : 'Error:'} ${err.message}`);
    }
  };

  const handleDeleteList = async (listId: string, listName: string) => {
    if (!confirm(language === 'es' ? `¿Eliminar la lista "${listName}"?` : `Delete list "${listName}"?`)) return;
    try {
      await apiFetch(`/task-lists/${listId}`, { method: 'DELETE' });
      await loadData();
    } catch (err: any) {
      alert(`${language === 'es' ? 'Error:' : 'Error:'} ${err.message}`);
    }
  };

  const handleEditListName = async (listId: string) => {
    if (!editingListName.trim()) return;
    try {
      await apiFetch(`/task-lists/${listId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingListName.trim() }),
      });
      setEditingListId(null);
      await loadData();
    } catch (err: any) {
      alert(`${language === 'es' ? 'Error:' : 'Error:'} ${err.message}`);
    }
  };

  const handleDeleteTask = async (task: Task) => {
    if (!confirm(language === 'es' ? `¿Eliminar la tarea "${task.name}"?` : `Delete task "${task.name}"?`)) return;
    try {
      await apiFetch(`/tasks/${task._id || (task as any)._id || (task as any).id}`, { method: 'DELETE' });
      await loadData();
    } catch (err: any) {
      alert(`${language === 'es' ? 'Error:' : 'Error:'} ${err.message}`);
    }
  };

  const getTasksForList = (listId: string) => {
    return tasks.filter((t: any) => {
      const taskListId = (t.listId as any)?._id || t.listId;
      return taskListId?.toString() === listId;
    });
  };

  if (loading) return <Layout><div className="loading">{language === 'es' ? 'Cargando...' : 'Loading...'}</div></Layout>;

  return (
    <Layout>
      <div className="kanban-page">
        <div className="kanban-header">
          <h1>{language === 'es' ? 'Tablero de Tareas' : 'Tasks Board'}</h1>
          <div className="new-list-form">
            <input
              type="text"
              placeholder={language === 'es' ? 'Nueva lista...' : 'New list...'}
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateList(); }}
            />
            <button onClick={handleCreateList}>{language === 'es' ? 'Añadir' : 'Add'}</button>
          </div>
        </div>

        <div className="kanban-board">
          {lists.map((list: any) => (
            <div key={list._id} className="kanban-list">
              <div className="kanban-list-header">
                {editingListId === list._id ? (
                  <input
                    className="list-name-input"
                    value={editingListName}
                    onChange={(e) => setEditingListName(e.target.value)}
                    onBlur={() => handleEditListName(list._id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleEditListName(list._id);
                      if (e.key === 'Escape') setEditingListId(null);
                    }}
                    autoFocus
                  />
                ) : (
                  <span
                    onDoubleClick={() => {
                      setEditingListId(list._id);
                      setEditingListName(list.name);
                    }}
                  >
                    {list.name}
                  </span>
                )}
                <button
                  className="btn-delete"
                  onClick={() => handleDeleteList(list._id, list.name)}
                >
                  🗑️
                </button>
              </div>
              <div className="kanban-list-tasks">
                {getTasksForList(list._id).map((task: any) => (
                  <TaskCard
                    key={task._id || task.id}
                    task={task}
                    onEdit={() => { setEditingTask(task); setShowModal(true); }}
                    onDelete={() => handleDeleteTask(task)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {showModal && (
          <TaskModal
            task={editingTask}
            lists={lists}
            onSave={async () => {
              setShowModal(false);
              setEditingTask(null);
              await loadData();
            }}
            onClose={() => { setShowModal(false); setEditingTask(null); }}
          />
        )}
      </div>
    </Layout>
  );
}
