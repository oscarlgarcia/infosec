import { TaskLabel } from '../../db/mongo/models';

export interface CreateLabelData {
  name: string;
  color?: string;
}

export async function createLabel(data: CreateLabelData): Promise<any> {
  const label = await TaskLabel.create({
    name: data.name,
    color: data.color || '#6B7280',
  });
  return label;
}

export async function getLabels(): Promise<any[]> {
  return TaskLabel.find().sort({ name: 1 }).lean();
}

export async function updateLabel(id: string, data: Partial<CreateLabelData>): Promise<any | null> {
  return TaskLabel.findByIdAndUpdate(
    id,
    { ...data, updatedAt: new Date() },
    { new: true }
  );
}

export async function deleteLabel(id: string): Promise<void> {
  await TaskLabel.findByIdAndDelete(id);
}
