import { config } from 'dotenv';
import { z } from 'zod';
import path from 'path';

config({ path: path.join(process.cwd(), '.env') });

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  OPENAI_MODEL_MINI: z.string().default('gpt-4o-mini'),
  OPENAI_BASE_URL: z.string().optional(),
  OPENAI_USE_RESPONSES: z.coerce.boolean().default(false),
  OPENAI_VECTOR_STORE_IDS: z.string().default(''),
  OPENAI_INGEST_TO_VECTOR_STORES: z.coerce.boolean().default(false),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/infosec'),
  CHROMA_PERSIST_DIRECTORY: z.string().default('./data/chroma'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
