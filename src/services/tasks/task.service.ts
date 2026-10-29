import { Task, TaskList, Client, ClientRequest, ChecklistItemSchema } from '../../db/mongo/models';
import { logEvent } from '../request/event.service';

export interface CreateTaskData {
  name: string;
  description?: string;
  status?: 'Not Started' | 'In Progress' | 'Completed';
  dueDate?: Date;
  startDate?: Date;
  listId: string;
  requestId?: string;
  checklist?: Array<{ text: string; completed?: boolean; order?: number }>;
  labelIds?: string[];
  // Request 360 business attributes
  clientId?: string;
  threadId?: string;
  priority?: string;
  severity?: string;
  ownerIds?: string[];
  requestType?: string;
  requestKey?: string;
  deadline?: Date;
  slaState?: string;
  taskType?: string;
  tags?: string[];
  clientVisible?: boolean;
}

export interface TaskFilters {
  listId?: string;
  status?: string;
  clientId?: string;
  priority?: string;
  severity?: string;
  ownerId?: string;
  requestId?: string;
  requestType?: string;
  slaState?: string;
  overdue?: boolean;
  q?: string;
}

const BUSINESS_FIELDS: Array<keyof CreateTaskData> = [
  'clientId', 'threadId', 'priority', 'severity', 'ownerIds', 'requestType', 'requestKey',
  'deadline', 'slaState', 'taskType', 'tags', 'clientVisible', 'startDate',
];

export async function createTask(data: CreateTaskData): Promise<any> {
  return Task.create({
    name: data.name,
    description: data.description,
    status: data.status || 'Not Started',
    dueDate: data.dueDate,
    startDate: data.startDate,
    listId: data.listId,
    requestId: data.requestId,
    checklist: data.checklist || [],
    labelIds: data.labelIds || [],
    clientId: data.clientId,
    threadId: data.threadId,
    priority: data.priority,
    severity: data.severity,
    ownerIds: data.ownerIds || [],
    requestType: data.requestType,
    requestKey: data.requestKey,
    deadline: data.deadline || data.dueDate,
    slaState: data.slaState,
    taskType: data.taskType || 'other',
    tags: data.tags || [],
    clientVisible: Boolean(data.clientVisible),
  });
}

export async function getTasks(filters?: TaskFilters): Promise<any[]> {
  const query: any = {};
  if (filters?.listId) query.listId = filters.listId;
  if (filters?.status) query.status = filters.status;
  if (filters?.clientId) query.clientId = filters.clientId;
  if (filters?.priority) query.priority = filters.priority;
  if (filters?.severity) query.severity = filters.severity;
  if (filters?.ownerId) query.ownerIds = filters.ownerId;
  if (filters?.requestId) query.requestId = filters.requestId;
  if (filters?.requestType) query.requestType = filters.requestType;
  if (filters?.slaState) query.slaState = filters.slaState;
  if (filters?.overdue) query.deadline = { $lt: new Date() };
  if (filters?.q) {
    const regex = new RegExp(String(filters.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ name: regex }, { requestKey: regex }, { tags: regex }];
  }

  return Task.find(query)
    .populate('listId', 'name')
    .populate('labelIds', 'name color')
    .populate('clientId', 'name clientType')
    .populate('requestId', 'requestKey title requestType status')
    .sort({ createdAt: -1 })
    .lean();
}

export async function getTaskById(id: string): Promise<any | null> {
  return Task.findById(id)
    .populate('listId', 'name')
    .populate('labelIds', 'name color')
    .populate('clientId', 'name clientType')
    .populate('requestId', 'requestKey title requestType sectionToReview deadline status priority');
}

export async function updateTask(id: string, data: Partial<CreateTaskData>): Promise<any | null> {
  const task = await Task.findById(id);
  if (!task) return null;

  const previousStatus = task.status;

  // If status changes to "In Progress" and no startDate, set it
  if (data.status === 'In Progress' && !task.startDate) {
    data = { ...data, startDate: new Date() };
  }

  Object.assign(task, data);
  await task.save();

  if (previousStatus !== task.status && task.requestId) {
    await logEvent({
      requestId: task.requestId as any,
      threadId: (task as any).threadId,
      type: 'task_linked',
      visibility: 'internal',
      authorName: 'Kanban',
      body: `Tarea "${task.name}": ${previousStatus} → ${task.status}`,
      taskId: task._id as any,
      taskType: (task as any).taskType || 'other',
      metadata: { from: previousStatus, to: task.status, listId: String(task.listId) },
    });
  }

  return task;
}

export async function deleteTask(id: string): Promise<void> {
  await Task.findByIdAndDelete(id);
}

export async function moveTaskToList(taskId: string, newListId: string): Promise<any | null> {
  const task = await Task.findByIdAndUpdate(
    taskId,
    { listId: newListId },
    { new: true }
  ).populate('listId', 'name');

  if (task?.requestId) {
    await logEvent({
      requestId: task.requestId as any,
      threadId: (task as any).threadId,
      type: 'task_linked',
      visibility: 'internal',
      authorName: 'Kanban',
      body: `Tarea "${task.name}" movida a ${(task.listId as any)?.name || 'otra lista'}`,
      taskId: task._id as any,
      taskType: (task as any).taskType || 'other',
    });
  }
  return task;
}
