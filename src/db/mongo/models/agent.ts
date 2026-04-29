import mongoose, { Schema, Document } from 'mongoose';

export interface IAgent extends Document {
  name: string;               // Ej: "InfoSec", "Gap Analysis"
  displayName: string;        // Ej: "InfoSec Specialist"
  description: string;         // Descripción para el UI
  instructions: string;         // Prompt template (Markdown with placeholders)
  isSystem: boolean;            // true para "Standard" e "InfoSec" (no se puede borrar/modificar)
  isActive: boolean;            // Para desactivar sin eliminar
  createdAt: Date;
  updatedAt: Date;
}

const AgentSchema = new Schema<IAgent>({
  name: { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  description: { type: String, default: '' },
  instructions: { type: String, required: true },  // Prompt template
  isSystem: { type: Boolean, default: false },      // No se puede borrar/modificar
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Update updatedAt on save
AgentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const Agent = mongoose.model<IAgent>('Agent', AgentSchema);
