import { useLanguage } from '../i18n/LanguageContext';
import type { Task } from '../types';

interface TaskCardProps {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
}

export function TaskCard({ task, onEdit, onDelete }: TaskCardProps) {
  const { language } = useLanguage();
  const completedItems = (task.checklist || []).filter((item: any) => item.completed).length;
  const totalItems = (task.checklist || []).length;
  
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && dueDate < new Date() && task.status !== 'Completed';
  
  return (
    <div className="task-card" onClick={onEdit}>
      <div className="task-card-header">
        <span className="task-name">{task.name}</span>
        <button 
          className="btn-delete" 
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          🗑️
        </button>
      </div>
      
      {task.description && (
        <div className="task-description">
          {task.description.length > 80 
            ? task.description.substring(0, 80) + '...' 
            : task.description}
        </div>
      )}
      
      {totalItems > 0 && (
        <div className="checklist-progress">
          {language === 'es' ? 'Progreso' : 'Progress'}: {completedItems}/{totalItems}
        </div>
      )}
      
      {task.labelIds && (task.labelIds as any[]).length > 0 && (
        <div className="task-labels">
          {(task.labelIds as any[]).map((label: any) => (
            <span 
              key={label._id || label} 
              className="task-label"
              style={{ backgroundColor: label.color || '#6B7280' }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}
      
      {dueDate && (
        <div className={`task-due-date ${isOverdue ? 'overdue' : ''}`}>
          {language === 'es' ? 'Vence' : 'Due'}: {dueDate.toLocaleDateString()}
        </div>
      )}
      
      <div className="task-status">
        {task.status === 'Not Started' && (language === 'es' ? 'Sin iniciar' : 'Not Started')}
        {task.status === 'In Progress' && (language === 'es' ? 'En progreso' : 'In Progress')}
        {task.status === 'Completed' && (language === 'es' ? 'Completado' : 'Completed')}
      </div>
    </div>
  );
}
