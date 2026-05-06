import { Task, TaskList, Client, ClientRequest, ChecklistItemSchema } from '../../db/mongo/models';

export interface CreateTaskData {
  name: string;
  description?: string;
  status?: 'Not Started' | 'In Progress' | 'Completed';
  dueDate?: Date;
  listId: string;
  requestId?: string;
  checklist?: Array<{ text: string; completed?: boolean; order?: number }>;
  labelIds?: string[];
}

export async function createTask(data: CreateTaskData): Promise<any> {
  const task = await Task.create({
    name: data.name,
    description: data.description,
    status: data.status || 'Not Started',
    dueDate: data.dueDate,
    listId: data.listId,
    requestId: data.requestId,
    checklist: data.checklist || [],
    labelIds: data.labelIds || [],
  });
  return task;
}

export async function getTasks(filters?: { listId?: string; status?: string }): Promise<any[]> {
  const query: any = {};
  if (filters?.listId) query.listId = filters.listId;
  if (filters?.status) query.status = filters.status;
  
  return Task.find(query)
    .populate('listId', 'name')
    .populate('labelIds', 'name color')
    .sort({ createdAt: -1 })
    .lean();
}

export async function getTaskById(id: string): Promise<any | null> {
  return Task.findById(id)
    .populate('listId', 'name')
    .populate('labelIds', 'name color')
    .populate('requestId', 'requestType sectionToReview deadline');
}

export async function updateTask(id: string, data: Partial<CreateTaskData>): Promise<any | null> {
  const task = await Task.findById(id);
  if (!task) return null;
  
  // If status changes to "In Progress" and no startDate, set it
  if (data.status === 'In Progress' && !task.startDate) {
    data = { ...data, startDate: new Date() };
  }
  
  Object.assign(task, data);
  await task.save();
  return task;
}

export async function deleteTask(id: string): Promise<void> {
  await Task.findByIdAndDelete(id);
}

export async function moveTaskToList(taskId: string, newListId: string): Promise<any | null> {
  return Task.findByIdAndUpdate(
    taskId,
    { listId: newListId },
    { new: true }
  ).populate('listId', 'name');
}
