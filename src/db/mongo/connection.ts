import mongoose from 'mongoose';
import { env } from '../../config';

export async function connectMongoDB(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

export async function disconnectMongoDB(): Promise<void> {
  await mongoose.disconnect();
  console.log('✅ MongoDB disconnected');
}
