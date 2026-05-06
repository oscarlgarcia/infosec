import { Task } from '../../db/mongo/models';

export interface AddChecklistItemData {
  text: string;
  completed?: boolean;
  order?: number;
}

export async function addChecklistItem(taskId: string, data: AddChecklistItemData): Promise<any | null> {
  const task = await Task.findById(taskId);
  if (!task) return null;
  
  task.checklist.push({
    text: data.text,
    completed: data.completed || false,
    order: data.order ?? task.checklist.length,
  });
  await task.save();
  return task;
}

export async function updateChecklistItem(taskId: string, itemIndex: number, data: Partial<{ text: string; completed: boolean; order: number }>): Promise<any | null> {
  const task = await Task.findById(taskId);
  if (!task) return null;
  if (itemIndex < 0 || itemIndex >= task.checklist.length) return null;
  
  Object.assign(task.checklist[itemIndex], data);
  await task.save();
  return task;
}

export async function deleteChecklistItem(taskId: string, itemIndex: number): Promise<any | null> {
  const task = await Task.findById(taskId);
  if (!task) return null;
  if (itemIndex < 0 || itemIndex >= task.checklist.length) return null;
  
  task.checklist.splice(itemIndex, 1);
  await task.save();
  return task;
}

export async function reorderChecklistItems(taskId: string, orderedItems: Array<{ text: string; completed: boolean; order: number }>): Promise<any | null> {
  const task = await Task.findById(taskId);
  if (!task) return null;
  
  task.checklist = orderedItems.map((item, index) => ({
    ...item,
    order: index,
  }));
  await task.save();
  return task;
}
