import { TaskList, Task } from '../../db/mongo/models';

export interface CreateListData {
  name: string;
  order?: number;
  isDefault?: boolean;
}

export async function createList(data: CreateListData): Promise<any> {
  const list = await TaskList.create({
    name: data.name,
    order: data.order || 0,
    isDefault: data.isDefault || false,
  });
  return list;
}

export async function getLists(): Promise<any[]> {
  return TaskList.find().sort({ order: 1 }).lean();
}

export async function updateList(id: string, data: Partial<CreateListData>): Promise<any | null> {
  return TaskList.findByIdAndUpdate(
    id,
    { ...data, updatedAt: new Date() },
    { new: true }
  );
}

export async function deleteList(id: string): Promise<void> {
  // Check if list has tasks
  const tasksCount = await Task.countDocuments({ listId: id });
  if (tasksCount > 0) {
    throw new Error('Cannot delete list with tasks. Move or delete tasks first.');
  }
  await TaskList.findByIdAndDelete(id);
}

export async function initializeDefaultLists(): Promise<void> {
  const existingCount = await TaskList.countDocuments();
  if (existingCount > 0) return;
  
  const defaultLists = [
    { name: 'TODO', order: 0, isDefault: true },
    { name: 'Current', order: 1, isDefault: true },
    { name: 'In revision', order: 2, isDefault: true },
    { name: 'Blocked', order: 3, isDefault: true },
    { name: 'Done', order: 4, isDefault: true },
  ];
  
  for (const list of defaultLists) {
    await TaskList.create(list);
  }
  console.log('Default task lists created');
}
